#!/usr/bin/env node
/* Records what the ORIGINAL (pre-refactor) RecallHSC algorithms output for a fixed set of inputs.
   It slices the algorithm source straight out of a given index.html, so the golden files describe the
   shipped behaviour, not a re-implementation.  Usage: node tools/capture-golden.cjs [path/to/index.html]
   Writes tests/fixtures/golden.json. Run once before refactoring; afterwards the tests compare against it. */
'use strict';
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const src=fs.readFileSync(process.argv[2]||path.join(root,'index.html'),'utf8');
const lines=src.split('\n');
const at=(re,from=0)=>{for(let i=from;i<lines.length;i++)if(re.test(lines[i]))return i;throw new Error('marker not found: '+re)};
// algorithm sections in the original monolith
const a0=at(/^const ABBR=/),a1=at(/^let PARAS=\[\]/);              // parsing, chunking, tokens, creative/discursive
const b0=at(/^function lev\(/),b1=at(/^\/\* -+ storage -+ \*\//);   // lev, fuzzy, align
const c0=at(/^function rangeText\(/),c1=at(/^function loadTask\(/);  // rangeText, splitSentence, buildQueue
const raw=src.match(/const RAW = `([\s\S]*?)`;/)[1];
const docs=JSON.parse(src.match(/<script type="application\/json" id="docs">([\s\S]*?)<\/script>/)[1]);
const code=[lines.slice(a0,a1).join('\n'),'let PARAS=[],SENTS=[],PSTART=[],TOTALW=1,FORMULAIC=false;let S=null,SET=null;',
  lines.slice(b0,b1).join('\n'),lines.slice(c0,c1).join('\n'),
  'return{splitSentences,chunkSentence,normWord,items,tokens,mdClean,looksCreative,looksDiscursive,detectKind,tagMoves,parseEssay,lev,fuzzy,align,splitSentence,buildQueue,origPhrase,'+
  'setCtx(c){PARAS=c.m.paras;SENTS=c.m.sents;PSTART=c.m.pstart;S=c.S;SET=c.SET}}'].join('\n');
const E=new Function(code)();
const I=require(path.join(root,'tests','fixtures','inputs.cjs'))({raw,docs});

const out={meta:{source:'index.html before the engine refactor',created:new Date().toISOString().slice(0,10)}};
out.splitSentences=I.sentences.map(t=>({in:t,out:E.splitSentences(t)}));
out.normWord=I.words.map(w=>({in:w,out:E.normWord(w)}));
out.items=I.itemTexts.map(t=>({in:t,out:E.items(t)}));
out.lev=I.levPairs.map(([a,b])=>({a,b,out:E.lev(a,b)}));
out.fuzzy=I.fuzzyPairs.map(([a,b])=>({a,b,out:E.fuzzy(a,b)}));
out.chunk=[];for(const s of I.chunkSentences)for(const max of [2,3,4,5,6,7])out.chunk.push({in:s,max,out:E.chunkSentence(s,max)});
out.splitLong=I.longSentences.map(t=>({in:t,out:E.splitSentence(t)}));
out.align=I.alignCases.map(([t,u])=>{const T=E.tokens(t),U=E.tokens(u);return{t,u,out:E.align(T,U)}});
out.kinds=I.essays.map(e=>({name:e.name,out:E.detectKind(e.text)}));
const slim=m=>({paras:m.paras,pstart:m.pstart,total:m.total,kind:m.kind,formulaic:m.formulaic,motifs:m.motifs,style:m.style,
  sents:m.sents.map(x=>{const o={p:x.p,s:x.s,text:x.text,wc:x.wc,role:x.role,unitEnd:x.unitEnd,cp:x.cp};if(x.echo)o.echo=x.echo;return o})});
out.parse=[];for(const e of I.essays)for(const kind of ['essay','creative'])out.parse.push({name:e.name,kind,out:slim(E.parseEssay(e.text,kind))});
// long texts are stored as length:hash so the file stays small but comparisons stay exact
const h=t=>{let x=2166136261;for(let i=0;i<t.length;i++){x^=t.charCodeAt(i);x=Math.imul(x,16777619)>>>0}return t.length+':'+x.toString(36)};
const slimTask=t=>{const o={...t};delete o.T;for(const k of ['text','pre','next'])if(typeof o[k]==='string')o[k]=h(o[k]);if(o.shown)o.shown=o.shown.map(h);return o};
module.exports.slimTask=slimTask;
// task queues for every sentence, under a few setting combinations
const DEFSET={delay:2,strict:88,phrase:4,essay:true};
out.queues=[];
for(const e of I.essays.filter(x=>x.queue))for(const kind of e.kinds)for(const v of I.queueVariants){
  const m=E.parseEssay(e.text,kind),SET={...DEFSET,...v.set},S={startG:v.startG||0,learned:[]};
  E.setCtx({m,S,SET});
  const qs=m.sents.map((_,g)=>E.buildQueue(g).map(slimTask));
  out.queues.push({name:e.name,kind,variant:v.name,out:qs});
}
const dest=path.join(root,'tests','fixtures','golden.json');
fs.writeFileSync(dest,JSON.stringify(out));
console.log('wrote',path.relative(root,dest),(fs.statSync(dest).size/1024).toFixed(0)+' KB',
  Object.entries(out).filter(([k])=>k!=='meta').map(([k,v])=>k+':'+v.length).join(' '));
