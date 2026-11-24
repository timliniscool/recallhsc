/* Sync engine against an in-memory cloud: two devices on one account, offline edits, resets, deletes, conflicts. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
require('../../js/sync/conflict.js');
const {createSyncEngine}=require('../../js/sync/sync.js');
const C=globalThis.RecallSync;

/* one account's cloud tables (RLS is checked separately against real Supabase by tools/rls-check.mjs) */
function fakeCloud(){
  const t={essays:new Map(),progress:new Map(),stats:new Map(),prefs:null},clock={n:0};
  const ts=()=>new Date(Date.UTC(2026,0,1)+(++clock.n)*1000).toISOString();
  const api={fail:0,calls:0,
    async listEssays(){api.calls++;return[...t.essays.values()].map(r=>({...r}))},
    async upsertEssays(rows){if(api.fail>0){api.fail--;throw new Error('network down')}for(const r of rows)t.essays.set(r.essay_id,{...t.essays.get(r.essay_id),...r,updated_at:ts()})},
    async listProgress(){return[...t.progress.values()].map(r=>({...r}))},
    async upsertProgress(rows){for(const r of rows)t.progress.set(r.essay_id+'|'+r.rev,{...r,updated_at:ts()})},
    async upsertStats(rows){for(const r of rows)t.stats.set(r.essay_id+'|'+r.device_id,{...r})},
    async listStats(){return[...t.stats.values()]},
    async getPrefs(){return t.prefs},
    async upsertPrefs(data){t.prefs={data,updated_at:ts()}},
  };
  return{api,t};
}
const blankStats=()=>({att:0,pass:0,words:0,time:0,hist:[]});
/* one device: its own localStorage, library, progress and settings */
function device(cloud,id){
  const kv=new Map(),dev={lib:[],state:{},prefs:{mode:'standard',strict:88},online:true};
  const app={
    deviceId:()=>id,
    getLib:()=>dev.lib.map(e=>({...e})),
    setLib(list){for(const e of list){const t=dev.lib.find(x=>x.id===e.id);if(t){t.rev=e.rev;t.ver=e.ver}}},
    putEssay(e,changed){const i=dev.lib.findIndex(x=>x.id===e.id);if(i>=0)dev.lib[i]={...dev.lib[i],...e};else dev.lib.push({...e});if(changed)delete dev.state[e.id]},
    deleteEssay(eid){dev.lib=dev.lib.filter(x=>x.id!==eid);delete dev.state[eid]},
    renameEssay(a,b){const e=dev.lib.find(x=>x.id===a);if(e)e.id=b;if(dev.state[a]){dev.state[b]=dev.state[a];delete dev.state[a]}},
    getState:eid=>dev.state[eid]||null,
    setState(eid,p){dev.state[eid]={...(dev.state[eid]||{stats:blankStats()}),...p}},
    getPrefs:keys=>{const o={};for(const k of keys)if(k in dev.prefs)o[k]=dev.prefs[k];return o},
    setPrefs(p){Object.assign(dev.prefs,p)},
  };
  const store={get:k=>kv.has(k)?JSON.parse(kv.get(k)):null,set:(k,v)=>kv.set(k,JSON.stringify(v))};
  const eng=createSyncEngine({cloud:cloud.api,store,app,online:()=>dev.online});
  return Object.assign(dev,{app,eng,store,
    add(eid,text,title){dev.lib.push({id:eid,title:title||eid,text,kind:'essay',updated:0});dev.state[eid]={g:0,ti:0,startG:0,learned:[],epoch:0,stats:blankStats()}},
    learn(eid,...gs){const s=dev.state[eid];for(const g of gs)s.learned[g]=true;s.g=Math.max(s.g,...gs.map(x=>x+1))},
  });
}
const TEXT='One sentence here. Two sentence here. Three sentence here. Four sentence here.';

test('local-only: nothing happens until sync is enabled',async()=>{
  const cl=fakeCloud(),a=device(cl,'deva');a.add('e1',TEXT);
  a.eng.mark('lib');await a.eng.run();
  assert.equal(cl.api.calls,0);assert.equal(a.eng.status,'local');assert.equal(cl.t.essays.size,0);
});
test('first sync merges libraries without replacing either side',async()=>{
  const cl=fakeCloud(),a=device(cl,'deva'),b=device(cl,'devb');
  a.add('e1',TEXT,'Essay A');await a.eng.enable('u1');
  b.add('e2','Another essay entirely. It differs.','Essay B');await b.eng.enable('u1');
  assert.deepEqual(b.lib.map(e=>e.id).sort(),['e1','e2']);
  await a.eng.run();assert.deepEqual(a.lib.map(e=>e.id).sort(),['e1','e2']);
  assert.equal(a.eng.status,'ok');
});
test('identical essays added on two devices are linked, not duplicated',async()=>{
  const cl=fakeCloud(),a=device(cl,'deva'),b=device(cl,'devb');
  a.add('x1',TEXT);await a.eng.enable('u1');
  b.add('y9',TEXT);await b.eng.enable('u1');
  assert.deepEqual(b.lib.map(e=>e.id),['x1']);assert.equal(cl.t.essays.size,1);
});
test('different sentences learnt on two devices are merged (same essay revision)',async()=>{
  const cl=fakeCloud(),a=device(cl,'deva'),b=device(cl,'devb');
  a.add('e1',TEXT);await a.eng.enable('u1');await b.eng.enable('u1');
  a.learn('e1',0,1);a.eng.mark('state','e1');await a.eng.run();
  b.learn('e1',3);b.eng.mark('state','e1');await b.eng.run();
  await a.eng.run();
  const flags=s=>[0,1,2,3].map(i=>!!s.learned[i]);
  assert.deepEqual(flags(a.state.e1),[true,true,false,true]);assert.deepEqual(flags(b.state.e1),[true,true,false,true]);
  assert.equal(b.state.e1.g,4,'furthest position wins');
});
test('offline changes are queued and uploaded on reconnect',async()=>{
  const cl=fakeCloud(),a=device(cl,'deva');a.add('e1',TEXT);await a.eng.enable('u1');
  a.online=false;a.learn('e1',2);a.eng.mark('state','e1');await a.eng.run();
  assert.equal(a.eng.status,'offline');assert.ok(a.eng.pending()>0,'queue persisted');
  a.online=true;await a.eng.run();
  assert.equal(a.eng.status,'ok');assert.equal(a.eng.pending(),0);
  const row=[...cl.t.progress.values()][0];assert.equal(C.decodeLearned(row.learned)[2],true);
});
test('an interrupted upload is retried without duplicating anything',async()=>{
  const cl=fakeCloud(),a=device(cl,'deva');a.add('e1',TEXT);
  cl.api.fail=1;await a.eng.enable('u1');
  assert.equal(a.eng.status,'error');assert.equal(cl.t.essays.size,0);
  await a.eng.run();assert.equal(a.eng.status,'ok');assert.equal(cl.t.essays.size,1);
  await a.eng.run();assert.equal(cl.t.essays.size,1);
});
test('an intentional reset on one device wins; an older device cannot undo it',async()=>{
  const cl=fakeCloud(),a=device(cl,'deva'),b=device(cl,'devb');
  a.add('e1',TEXT);a.learn('e1',0,1,2);await a.eng.enable('u1');await b.eng.enable('u1');
  assert.equal(b.state.e1.learned[2],true);
  a.state.e1={g:0,ti:0,startG:0,learned:[],epoch:1,stats:blankStats()};a.eng.mark('state','e1');await a.eng.run(); // reset on A
  b.learn('e1',3);await b.eng.run();   // B still has the old progress plus a new sentence
  assert.equal(b.state.e1.epoch,1);assert.equal(!!b.state.e1.learned[0],false,'old progress did not survive');
  await a.eng.run();assert.equal(!!a.state.e1.learned[0],false,'reset was not undone on A');
});
test('a deleted essay does not come back when an offline device reconnects',async()=>{
  const cl=fakeCloud(),a=device(cl,'deva'),b=device(cl,'devb');
  a.add('e1',TEXT);await a.eng.enable('u1');await b.eng.enable('u1');
  b.online=false;
  a.app.deleteEssay('e1');a.eng.mark('lib');await a.eng.run();
  assert.equal(cl.t.essays.get('e1').deleted,true);assert.equal(cl.t.essays.get('e1').body,'','text removed from the cloud');
  b.online=true;await b.eng.run();
  assert.equal(b.lib.length,0,'B dropped it');await a.eng.run();assert.equal(a.lib.length,0,'it did not reappear on A');
});
test('editing the same essay differently on two devices keeps both versions',async()=>{
  const cl=fakeCloud(),a=device(cl,'deva'),b=device(cl,'devb');
  a.add('e1',TEXT,'My essay');await a.eng.enable('u1');await b.eng.enable('u1');
  a.lib[0].text=TEXT+' Edited on A.';b.lib[0].text=TEXT+' Edited on B.';
  await a.eng.run();await b.eng.run();
  const texts=b.lib.map(e=>e.text).sort();
  assert.equal(b.lib.length,2);assert.ok(texts.some(t=>t.endsWith('Edited on A.')));assert.ok(texts.some(t=>t.endsWith('Edited on B.')));
  assert.ok(b.lib.some(e=>/other device/.test(e.title)));
});
test('progress is never merged across different essay texts',async()=>{
  const cl=fakeCloud(),a=device(cl,'deva'),b=device(cl,'devb');
  a.add('e1',TEXT);a.learn('e1',0,1);await a.eng.enable('u1');await b.eng.enable('u1');
  b.lib[0].text='Completely new text now. Nothing like before.';delete b.state.e1;b.eng.mark('lib');await b.eng.run();
  await a.eng.run();
  assert.equal(a.lib[0].text,'Completely new text now. Nothing like before.');
  assert.ok(!a.state.e1||!a.state.e1.learned||!a.state.e1.learned[0],'flags for the old text were not applied to the new text');
});
test('stats: each device uploads its own totals; others are added once for display',async()=>{
  const cl=fakeCloud(),a=device(cl,'deva'),b=device(cl,'devb');
  a.add('e1',TEXT);await a.eng.enable('u1');await b.eng.enable('u1');
  a.state.e1.stats={att:5,pass:4,words:100,time:60,hist:[]};a.eng.mark('state','e1');await a.eng.run();
  b.state.e1.stats={att:3,pass:3,words:50,time:30,hist:[]};b.eng.mark('state','e1');await b.eng.run();
  await a.eng.run();await a.eng.run();
  const shown=a.eng.displayStats('e1',a.state.e1.stats);
  assert.equal(shown.att,8);assert.equal(shown.words,150);
  assert.equal(cl.t.stats.size,2,'one row per device, nothing double counted');
});
test('preferences: unsynced local changes win, otherwise the account’s settings apply',async()=>{
  const cl=fakeCloud(),a=device(cl,'deva'),b=device(cl,'devb');
  await a.eng.enable('u1');a.prefs.mode='exact';a.eng.mark('prefs');await a.eng.run();
  await b.eng.enable('u1');assert.equal(b.prefs.mode,'exact','a device without unsynced changes adopts the account’s settings');
  b.prefs.mode='verbatim';b.eng.mark('prefs');await b.eng.run();
  assert.equal(b.prefs.mode,'verbatim','local unsynced change wins');
  await a.eng.run();assert.equal(a.prefs.mode,'verbatim','and reaches the other device');
});
