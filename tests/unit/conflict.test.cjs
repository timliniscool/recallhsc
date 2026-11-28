'use strict';
/* Unit tests for js/sync/conflict.js (pure cloud-sync merge rules). Run: node --test tests/unit/conflict.test.cjs */
const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../../js/sync/conflict.js');

const deepFreeze=o=>{if(o&&typeof o==='object'){Object.freeze(o);Object.values(o).forEach(deepFreeze)}return o};
const snap=v=>JSON.parse(JSON.stringify(v));

/* Reference 64-bit FNV-1a with BigInt, used only to check the 32-bit-halves implementation. */
function refFnv(str){
  let h=0xcbf29ce484222325n;const P=0x100000001b3n,M=(1n<<64n)-1n;
  for(const b of Buffer.from(str,'utf8')){h^=BigInt(b);h=(h*P)&M}
  return h.toString(16).padStart(16,'0');
}

/* ------------------------------------------------------------------ hashing */
test('hashEssay: format, determinism and agreement with a BigInt FNV-1a reference',()=>{
  const h=S.hashEssay('The quick brown fox.','essay');
  assert.match(h,/^r[0-9a-f]{16}$/);
  assert.equal(h,S.hashEssay('The quick brown fox.','essay'));
  for(const t of ['', 'a', 'Hello, world', 'Ünïcødé “quotes” — dash 😀 emoji', 'x'.repeat(5000)])
    for(const k of ['essay','creative'])
      assert.equal(S.hashEssay(t,k),'r'+refFnv(k+'\u0000'+t),t.slice(0,20));
});
test('hashEssay: known FNV-1a 64 vectors via the reference',()=>{
  assert.equal(refFnv(''),'cbf29ce484222325');
  assert.equal(refFnv('a'),'af63dc4c8601ec8c');
});
test('hashEssay: normalises CR and trailing line whitespace only',()=>{
  const a=S.hashEssay('Line one.\nLine two.','essay');
  assert.equal(S.hashEssay('Line one.\r\nLine two.','essay'),a);
  assert.equal(S.hashEssay('Line one.   \nLine two.\t','essay'),a);
  assert.notEqual(S.hashEssay('Line one. \nLine  two.','essay'),a,'inner whitespace matters');
  assert.notEqual(S.hashEssay('Line one.\nLine two!','essay'),a,'punctuation matters');
  assert.notEqual(S.hashEssay('line one.\nLine two.','essay'),a,'case matters');
  assert.notEqual(S.hashEssay('Line one.\nLine two.','creative'),a,'kind matters');
  assert.equal(S.hashEssay(null,'essay'),S.hashEssay('','essay'));
});

/* ------------------------------------------------------------------ learned */
test('encodeLearned / decodeLearned roundtrip',()=>{
  const arr=[true,false,false,true,true,false];
  assert.equal(S.encodeLearned(arr),'100110');
  assert.deepEqual(S.decodeLearned('100110'),arr);
  assert.deepEqual(S.decodeLearned(S.encodeLearned([])),[]);
  const big=Array.from({length:3000},(_,i)=>i%7===0);
  assert.deepEqual(S.decodeLearned(S.encodeLearned(big)),big);
  assert.deepEqual(S.decodeLearned(null),[]);
  assert.equal(S.encodeLearned('nope'),'');
  assert.equal(S.encodeLearned(new Array(25000).fill(true)).length,20000,'capped at the DB limit');
});

/* ------------------------------------------------------------------ progress */
const REV='r0123456789abcdef';
const prog=o=>Object.assign({rev:REV,epoch:0,startG:0,g:0,ti:0,learned:[],started:false,part:null,
  game:{level:0,coins:0,marks:{}},stats:{att:1}},o);

test('mergeProgress: no remote keeps local',()=>{
  const l=prog({g:2});
  const r=S.mergeProgress(l,null,REV);
  assert.equal(r.usedRemote,false);assert.deepEqual(r.progress,l);
});
test('mergeProgress: same revision ORs learned flags',()=>{
  const r=S.mergeProgress(prog({learned:[true,false,false,false]}),prog({learned:[false,false,true,false,true]}),REV);
  assert.deepEqual(r.progress.learned,[true,false,true,false,true]);
  assert.equal(r.usedRemote,true);assert.equal(r.reason,'merged');
});
test('mergeProgress: accepts a DB-row-shaped remote (bitstring, start_g)',()=>{
  const r=S.mergeProgress(prog({learned:[true]}),{rev:REV,epoch:0,learned:'0110',g:1,ti:0,start_g:5},REV);
  assert.deepEqual(r.progress.learned,[true,true,true,false]);
  assert.equal(r.progress.startG,0,'startG stays local');
});
test('mergeProgress: different revisions are never merged',()=>{
  const l=prog({learned:[true]});
  const other=prog({rev:'rffffffffffffffff',learned:[true,true,true]});
  let r=S.mergeProgress(l,other,REV);
  assert.equal(r.reason,'different-revision');assert.equal(r.usedRemote,false);assert.deepEqual(r.progress,l);
  r=S.mergeProgress(prog({rev:'rffffffffffffffff',learned:[true]}),prog({learned:[false,true]}),REV);
  assert.equal(r.reason,'different-revision');assert.deepEqual(r.progress.learned,[true]);
  // local without rev is assumed to refer to the current essay revision
  r=S.mergeProgress(prog({rev:undefined,learned:[true]}),prog({learned:[false,true]}),REV);
  assert.deepEqual(r.progress.learned,[true,true]);
});
test('mergeProgress: a newer reset elsewhere wipes local progress',()=>{
  const l=prog({epoch:0,learned:[true,true,true],g:3,ti:2,started:true,game:{level:4,coins:50,marks:{1:'flag'}}});
  const remote=prog({epoch:1,learned:[],g:0,ti:0,started:false,resetAt:1700000000000});
  const r=S.mergeProgress(l,remote,REV);
  assert.equal(r.usedRemote,true);assert.equal(r.reason,'remote-newer-epoch');
  assert.deepEqual(r.progress.learned,[]);assert.equal(r.progress.g,0);assert.equal(r.progress.epoch,1);
  assert.deepEqual(r.progress.game,{level:0,coins:0,marks:{}});
  assert.equal(r.progress.resetAt,1700000000000);
  assert.deepEqual(r.progress.stats,{att:1},'device-local fields are kept');
});
test('mergeProgress: an older device cannot undo a reset',()=>{
  const l=prog({epoch:2,learned:[false]});
  const r=S.mergeProgress(l,prog({epoch:1,learned:[true,true,true],g:9}),REV);
  assert.equal(r.usedRemote,false);assert.equal(r.reason,'local-newer-epoch');
  assert.deepEqual(r.progress.learned,[false]);assert.equal(r.progress.g,0);
});
test('mergeProgress: furthest position wins (g, then ti); startG local',()=>{
  let r=S.mergeProgress(prog({g:2,ti:5,startG:1}),prog({g:3,ti:0,startG:7}),REV);
  assert.deepEqual([r.progress.g,r.progress.ti,r.progress.startG],[3,0,1]);
  r=S.mergeProgress(prog({g:3,ti:4}),prog({g:3,ti:1}),REV);
  assert.deepEqual([r.progress.g,r.progress.ti],[3,4]);
  r=S.mergeProgress(prog({g:3,ti:1}),prog({g:3,ti:6}),REV);
  assert.deepEqual([r.progress.g,r.progress.ti],[3,6]);
});
test('mergeProgress: part marker handling',()=>{
  let r=S.mergeProgress(prog({part:{g:2,w:3}}),prog({part:{g:4,w:1}}),REV);
  assert.deepEqual(r.progress.part,{g:4,w:1},'higher g');
  r=S.mergeProgress(prog({part:{g:4,w:6}}),prog({part:{g:4,w:2}}),REV);
  assert.deepEqual(r.progress.part,{g:4,w:6},'same g -> higher w');
  r=S.mergeProgress(prog({part:{g:1,w:6}}),prog({learned:[false,true]}),REV);
  assert.equal(r.progress.part,null,'dropped once that sentence is learned');
  r=S.mergeProgress(prog({part:null}),prog({part:'garbage'}),REV);
  assert.equal(r.progress.part,null);
});
test('mergeProgress: game merge (max level/coins, marks union, local wins clashes)',()=>{
  const r=S.mergeProgress(
    prog({game:{level:3,coins:10,marks:{0:'step',2:'flag'}}}),
    prog({game:{level:2,coins:40,marks:{2:'castle',5:'castle',6:'evil'}}}),REV);
  assert.deepEqual(r.progress.game,{level:3,coins:40,marks:{0:'step',2:'flag',5:'castle'}});
});
test('mergeProgress: started is either; identical remote reports no change',()=>{
  assert.equal(S.mergeProgress(prog({started:false}),prog({started:true}),REV).progress.started,true);
  const same=S.mergeProgress(prog({learned:[true],g:1,started:true}),prog({learned:[true],g:1,started:true,stats:undefined}),REV);
  assert.equal(same.usedRemote,false);assert.equal(same.reason,'local-up-to-date');
});
test('mergeProgress: never mutates its inputs',()=>{
  const l=deepFreeze(prog({learned:[true],part:{g:3,w:1},game:{level:1,coins:1,marks:{1:'step'}}}));
  const r=deepFreeze(prog({learned:[false,true],g:5,game:{level:2,coins:0,marks:{2:'flag'}}}));
  const before=[snap(l),snap(r)];
  const out=S.mergeProgress(l,r,REV);
  assert.deepEqual([snap(l),snap(r)],before);
  assert.notEqual(out.progress,l);
  out.progress.learned.push(true);out.progress.game.marks.x='step';
  assert.deepEqual([snap(l),snap(r)],before);
});
test('progressToRow / rowToProgress roundtrip',()=>{
  const p=prog({learned:[true,false,true],g:2,ti:1,startG:1,epoch:3,part:{g:1,w:2},game:{level:2,coins:5,marks:{1:'flag'}}});
  const row=S.progressToRow(p,'my-essay',REV,'dev1');
  assert.equal(row.learned,'101');assert.equal(row.start_g,1);assert.equal(row.device_id,'dev1');
  const back=S.rowToProgress(row);
  assert.deepEqual(back.learned,[true,false,true]);assert.equal(back.startG,1);assert.equal(back.epoch,3);
  assert.deepEqual(back.game,p.game);assert.equal(back.rev,REV);
});

/* ------------------------------------------------------------------ stats */
test('mergeStats: sums counters, maxes bests, sums maps/hours/taskMs/modes, keeps own hist',()=>{
  const own={att:3,pass:2,words:100,time:60,bestWpm:50,flawless:1,longestPause:900,
    missed:{the:2},typos:{'a→b':1},fails:{3:1},hours:{'9':[180,2]},hist:[[90,1,'standard']],
    taskMs:{build:[1000,2]},modes:{standard:{att:3,pass:2,accSum:270}}};
  const dev2={att:2,pass:1,words:40,time:30,bestWpm:70,flawless:0,longestPause:500,
    missed:{the:1,of:4},typos:{'a→b':2},fails:{3:2,4:1},hours:{'9':[90,1],'22':[80,1]},hist:[[10,0]],
    taskMs:{build:[500,1],essay:[9000,1]},modes:{standard:{att:1,pass:1,accSum:95},exact:{att:1,pass:0,accSum:60}}};
  const m=S.mergeStats(own,[dev2]);
  assert.equal(m.att,5);assert.equal(m.pass,3);assert.equal(m.words,140);assert.equal(m.time,90);
  assert.equal(m.bestWpm,70);assert.equal(m.flawless,1);assert.equal(m.longestPause,900);
  assert.deepEqual(m.missed,{the:3,of:4});assert.deepEqual(m.typos,{'a→b':3});assert.deepEqual(m.fails,{3:3,4:1});
  assert.deepEqual(m.hours,{'9':[270,3],'22':[80,1]});
  assert.deepEqual(m.taskMs,{build:[1500,3],essay:[9000,1]});
  assert.deepEqual(m.modes,{standard:{att:4,pass:3,accSum:365},exact:{att:1,pass:0,accSum:60}});
  assert.deepEqual(m.hist,[[90,1,'standard']],'hist is never merged');
});
test('mergeStats: tolerates garbage and missing fields',()=>{
  const m=S.mergeStats({att:'x',pass:NaN,words:Infinity,bestWpm:null,missed:'nope',hours:{'9':'bad','99':[1,1]},
    taskMs:{build:'x'},modes:{standard:5},hist:'no',['__proto__']:{polluted:1}},[null,42,{att:2,missed:{w:'3'}},undefined]);
  assert.equal(m.att,2);assert.equal(m.pass,0);assert.equal(m.words,0);assert.equal(m.bestWpm,0);
  assert.deepEqual(m.missed,{w:3});assert.deepEqual(m.hours,{'9':[0,0]});
  assert.deepEqual(m.taskMs,{});assert.deepEqual(m.modes,{});assert.deepEqual(m.hist,[]);
  assert.equal({}.polluted,undefined);
  const empty=S.mergeStats(undefined,undefined);
  assert.equal(empty.att,0);assert.deepEqual(empty.hist,[]);
});
test('mergeStats: per-device contributions are not double counted and inputs untouched',()=>{
  const a=deepFreeze({att:4,missed:{x:1}}),b=deepFreeze({att:6,missed:{x:2}});
  // device A displays own(a)+others[b]; device B displays own(b)+others[a]: both see the same totals.
  const onA=S.mergeStats(a,[b]),onB=S.mergeStats(b,[a]);
  assert.equal(onA.att,10);assert.equal(onB.att,10);assert.deepEqual(onA.missed,onB.missed);
  assert.equal(S.mergeStats(a,[]).att,4);
});

/* ------------------------------------------------------------------ library */
const ess=(id,text,o)=>Object.assign({id,title:id+' title',text,kind:'essay',rev:S.hashEssay(text,'essay'),ver:1,updated:1},o);
const row=(id,text,o)=>Object.assign({essay_id:id,title:id+' title',body:text,kind:'essay',rev:S.hashEssay(text,'essay'),
  ver:1,deleted:false,deleted_ver:null,updated_at:'2026-11-24T00:00:00Z'},o);
const plan=o=>S.reconcileLibrary(Object.assign({local:[],remote:[],tombs:{},base:{}},o));
const empty={upload:[],download:[],removeLocal:[],pushDeletes:[],forks:[],links:[],conflicts:[]};

test('reconcile: new local essay is uploaded (with or without a stale base)',()=>{
  assert.deepEqual(plan({local:[ess('a','Alpha.')]}),Object.assign({},empty,{upload:['a']}));
  const p=plan({local:[ess('a','Alpha.')],base:{a:{rev:S.hashEssay('Alpha.','essay'),ver:1}}});
  assert.deepEqual(p.upload,['a'],'remote was wiped -> re-upload');
});
test('reconcile: new remote essay is downloaded; remote tombstone alone does nothing',()=>{
  const r=row('b','Beta.');
  assert.deepEqual(plan({remote:[r]}).download,[r]);
  assert.deepEqual(plan({remote:[row('c','x',{deleted:true,deleted_ver:2})]}),empty);
});
test('reconcile: same revision does nothing; title differences resolved by ver',()=>{
  assert.deepEqual(plan({local:[ess('a','Alpha.')],remote:[row('a','Alpha.')]}),empty);
  let p=plan({local:[ess('a','Alpha.',{title:'Mine',ver:3})],remote:[row('a','Alpha.',{title:'Theirs',ver:2})]});
  assert.deepEqual(p.upload,['a']);assert.deepEqual(p.download,[]);
  const r=row('a','Alpha.',{title:'Theirs',ver:2});
  p=plan({local:[ess('a','Alpha.',{title:'Mine',ver:2})],remote:[r]});
  assert.deepEqual(p.download,[r],'equal ver keeps the remote title');
});
test('reconcile: edited here only -> upload; edited remotely only -> download',()=>{
  const base={a:{rev:S.hashEssay('Old.','essay'),ver:1}};
  let p=plan({local:[ess('a','New here.',{ver:2})],remote:[row('a','Old.')],base});
  assert.deepEqual(p,Object.assign({},empty,{upload:['a']}));
  const r=row('a','New there.',{ver:2});
  p=plan({local:[ess('a','Old.')],remote:[r],base});
  assert.deepEqual(p,Object.assign({},empty,{download:[r]}));
});
test('reconcile: edit-edit keeps local, forks remote, never discards either text',()=>{
  const base={a:{rev:S.hashEssay('Old.','essay'),ver:1}};
  const r=row('a','Theirs.',{ver:2,title:'Shared'});
  const p=plan({local:[ess('a','Mine.',{ver:2})],remote:[r],base});
  assert.deepEqual(p.upload,['a']);assert.deepEqual(p.download,[]);
  assert.deepEqual(p.conflicts,[{id:'a',kind:'edit-edit'}]);
  assert.equal(p.forks.length,1);
  assert.equal(p.forks[0].remote,r);
  assert.equal(p.forks[0].newId,'a-'+r.rev.slice(1,7));
  assert.equal(p.forks[0].title,'Shared (other device)');
  // no base at all (e.g. both devices created the same id independently) is also edit-edit
  assert.equal(plan({local:[ess('a','Mine.')],remote:[r]}).forks.length,1);
});
test('reconcile: fork ids and titles respect the 40 / 60 char limits and avoid collisions',()=>{
  const id='x'.repeat(40);
  const r=row(id,'Theirs.',{title:'T'.repeat(60)});
  const p=plan({local:[ess(id,'Mine.')],remote:[r]});
  const f=p.forks[0];
  assert.match(f.newId,/^[A-Za-z0-9_-]{1,40}$/);assert.equal(f.newId.length,40);
  assert.ok(f.newId.endsWith('-'+r.rev.slice(1,7)));
  assert.equal(f.title.length,60);assert.ok(f.title.endsWith(' (other device)'));
  // an existing local essay with the fork id but different text -> a suffixed id
  const taken='a-'+row('a','Theirs.').rev.slice(1,7);
  const p2=plan({local:[ess('a','Mine.'),ess(taken,'Unrelated.')],remote:[row('a','Theirs.')]});
  assert.equal(p2.forks[0].newId,taken+'-2');
  // the fork already exists locally (same rev) -> not forked again
  const p3=plan({local:[ess('a','Mine.'),ess(taken,'Theirs.')],remote:[row('a','Theirs.')]});
  assert.deepEqual(p3.forks,[]);assert.deepEqual(p3.conflicts,[{id:'a',kind:'edit-edit'}]);
});
test('reconcile: deletion elsewhere propagates when unchanged here',()=>{
  const base={a:{rev:S.hashEssay('Alpha.','essay'),ver:1}};
  const p=plan({local:[ess('a','Alpha.')],remote:[row('a','',{rev:S.hashEssay('Alpha.','essay'),deleted:true,deleted_ver:1,ver:1})],base});
  assert.deepEqual(p,Object.assign({},empty,{removeLocal:['a']}));
});
test('reconcile: deleted remotely but edited here -> kept and uploaded',()=>{
  const base={a:{rev:S.hashEssay('Alpha.','essay'),ver:1}};
  const del=row('a','',{deleted:true,deleted_ver:1,ver:1});
  let p=plan({local:[ess('a','Alpha edited.',{ver:2})],remote:[del],base});
  assert.deepEqual(p.removeLocal,[]);assert.deepEqual(p.upload,['a']);
  assert.deepEqual(p.conflicts,[{id:'a',kind:'edit-after-delete'}]);
  // text changed but ver not bumped: still kept (rev differs from base)
  p=plan({local:[ess('a','Alpha edited.',{ver:1})],remote:[del],base});
  assert.deepEqual(p.upload,['a']);
  // no base: cannot prove it is unchanged -> kept
  p=plan({local:[ess('a','Alpha.')],remote:[del]});
  assert.deepEqual(p.upload,['a']);assert.deepEqual(p.removeLocal,[]);
});
test('reconcile: local tombstone blocks re-download and pushes the delete',()=>{
  const r=row('a','Alpha.',{ver:2});
  let p=plan({remote:[r],tombs:{a:{ver:2}}});
  assert.deepEqual(p,Object.assign({},empty,{pushDeletes:[{id:'a',ver:2}]}));
  p=plan({remote:[r],tombs:{a:{ver:1}}});
  assert.deepEqual(p.download,[r],'edited elsewhere after this device deleted it -> edit wins');
  assert.deepEqual(p.pushDeletes,[]);
});
test('reconcile: duplicate essay under a different id is linked, not uploaded',()=>{
  const r=row('remote1','Same text.');
  const p=plan({local:[ess('local1','Same text.')],remote:[r]});
  assert.deepEqual(p.upload,[]);assert.deepEqual(p.download,[]);
  assert.equal(p.links.length,1);
  assert.equal(p.links[0].localId,'local1');assert.equal(p.links[0].remoteId,'remote1');
  // with a base the local essay is not a fresh duplicate -> uploaded under its own id
  const p2=plan({local:[ess('local1','Same text.')],remote:[r],base:{local1:{rev:r.rev,ver:1}}});
  assert.deepEqual(p2.upload,['local1']);assert.deepEqual(p2.download,[r]);
});
test('reconcile: computes missing local revs, ignores invalid ids, does not mutate inputs',()=>{
  const local=deepFreeze([{id:'a',title:'A',text:'Alpha.',kind:'essay'},{id:'bad id!',text:'x'}]);
  const remote=deepFreeze([row('a','Alpha.',{ver:0,title:'A'}),{essay_id:'../etc',body:'x'}]);
  const before=snap([local,remote]);
  const p=S.reconcileLibrary({local,remote,tombs:null,base:null});
  assert.deepEqual(p.upload,[]);assert.deepEqual(p.download,[]);
  assert.deepEqual(snap([local,remote]),before);
  assert.deepEqual(S.reconcileLibrary(undefined),empty);
});

/* ------------------------------------------------------------------ prefs */
test('mergePrefs: dirty local wins, otherwise remote wins, garbage ignored',()=>{
  const l={theme:'dark',size:18,sound:true},r={theme:'light',size:20,mode:'exact'};
  assert.deepEqual(S.mergePrefs(l,r,true),{theme:'dark',size:18,sound:true,mode:'exact'});
  assert.deepEqual(S.mergePrefs(l,r,false),{theme:'light',size:20,sound:true,mode:'exact'});
  assert.deepEqual(S.mergePrefs(null,null,false),{});
  assert.deepEqual(S.mergePrefs(null,{a:1},true),{a:1});
  assert.deepEqual(S.mergePrefs('junk',[1,2],false),{});
  const g=S.mergePrefs({size:18},{size:'huge',n:NaN,f:()=>1,d:new Date(0),ok:[1,'a',null]},false);
  assert.deepEqual(g,{size:18,ok:[1,'a',null]},'type-changed and non-JSON values ignored');
  const polluted=JSON.parse('{"__proto__":{"x":1},"a":2}');
  assert.deepEqual(S.mergePrefs({},polluted,false),{a:2});
  assert.equal({}.x,undefined);
});

/* ------------------------------------------------------------------ position: most recent move wins */
test('mergeProgress: going back to relearn sticks (local move is newer than the synced position)',()=>{
  const local=prog({g:2,ti:0,posAt:2000,learned:[true,true,true,true,true,true]});
  const remote=prog({g:6,ti:3,posAt:1000,learned:[true,true,true,true,true,true]});
  const r=S.mergeProgress(local,remote,REV).progress;
  assert.deepEqual([r.g,r.ti,r.posAt],[2,0,2000]);
  assert.equal(r.learned.filter(Boolean).length,6,'learned sentences are kept');
});
test('mergeProgress: a newer move on another device wins, backwards or forwards',()=>{
  const r=S.mergeProgress(prog({g:6,ti:1,posAt:1000}),prog({g:1,ti:0,posAt:5000}),REV).progress;
  assert.deepEqual([r.g,r.ti,r.posAt],[1,0,5000]);
});
test('mergeProgress: older saves without move times still use the furthest position',()=>{
  const r=S.mergeProgress(prog({g:2,ti:0}),prog({g:4,ti:1}),REV).progress;
  assert.deepEqual([r.g,r.ti],[4,1]);
});
test('progress rows carry the move time inside game, and read it back',()=>{
  const row=S.progressToRow(prog({g:3,ti:2,posAt:123456789}),'e1',REV,'dev');
  assert.equal(row.game.posAt,123456789);
  assert.equal(S.rowToProgress(Object.assign({},row,{learned:row.learned})).posAt,123456789);
});
