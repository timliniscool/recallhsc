#!/usr/bin/env node
/* Reproducible engine benchmarks: original monolith algorithms (sliced from tests/fixtures/index.original.html)
   vs the refactored engine, on synthetic essays of ~100 to 5,000 words. Prints real measurements; nothing estimated.
   Usage: npm run test:performance  (add --json for machine-readable output) */
'use strict';
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..','..');
require(path.join(root,'tests','helpers','engine.cjs'));
const NEW=globalThis.RecallEngine;
// original algorithms
const L=fs.readFileSync(path.join(root,'tests','fixtures','index.original.html'),'utf8').split('\n');
const at=re=>L.findIndex(l=>re.test(l));
const OLD=new Function(L.slice(at(/^const ABBR=/),at(/^let PARAS=\[\]/)).join('\n')+'\n'+L.slice(at(/^function lev\(/),at(/^\/\* -+ storage -+ \*\//)).join('\n')+
  '\nreturn{parseEssay,chunkSentence,tokens,align}')();
// deterministic synthetic essay of n words (realistic sentence/paragraph shape, quotes included)
const VOC='the a of to and in that ambition reveals Shakespeare power guilt metaphor imagery suggests audience human experience identity memory explores conflict nature through his her their which while because despite language form structure'.split(' ');
function essay(n){let s=1,out=[],w=0,inQ=false;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
  while(w<n){const len=12+Math.floor(rnd()*14),words=[];for(let i=0;i<len&&w<n;i++,w++)words.push(VOC[Math.floor(rnd()*VOC.length)]);
    if(rnd()<.25&&words.length>6){words[2]='“'+words[2];words[5]=words[5]+'”'}
    words[0]=words[0][0].toUpperCase()+words[0].slice(1);out.push(words.join(' ')+'.');if(rnd()<.18)out.push('\n\n')}
  return out.join(' ').replace(/ \n\n /g,'\n\n')}
// answer with ~6% mistakes (substitutions, drops, insertions)
function noisy(text){let s=7;const rnd=()=>(s=(s*48271)%2147483647)/2147483647;return text.split(/\s+/).flatMap(w=>{const r=rnd();return r<.02?[]:r<.04?[w,'extra']:r<.06?[w.slice(0,-1)+'x']:[w]}).join(' ')}
const time=(fn,reps)=>{fn();const t0=process.hrtime.bigint();for(let i=0;i<reps;i++)fn();return Number(process.hrtime.bigint()-t0)/1e6/reps};
const rows=[];
for(const n of [100,500,1000,2000,5000]){
  const text=essay(n),typed=noisy(text),reps=n<=1000?20:n<=2000?4:1;
  const T=NEW.tokens(text),U=NEW.tokens(typed);
  const sent=text.split(/(?<=\.)\s+/).find(x=>x.split(' ').length>15)||text.slice(0,200);
  rows.push({words:n,
    parseOld:time(()=>OLD.parseEssay(text,'essay'),reps),parseNew:time(()=>NEW.parseEssay(text,'essay'),reps),
    chunkOld:time(()=>OLD.chunkSentence(sent,4),200),chunkNew:time(()=>NEW.chunkSentence(sent,4),200),
    alignOld:time(()=>OLD.align(T,U),reps),alignNew:time(()=>NEW.markAttempt({text,typed,mode:'standard'}),reps),
    sameResult:JSON.stringify(OLD.align(T,U))===JSON.stringify(NEW.markAttempt({text,typed,mode:'standard'}).r)});
}
const mem=process.memoryUsage();
if(process.argv.includes('--json')){console.log(JSON.stringify({node:process.version,rows,heapMB:+(mem.heapUsed/1048576).toFixed(1)}));process.exit(0)}
const f=v=>v<1?v.toFixed(3):v<100?v.toFixed(1):Math.round(v)+'';
console.log(`RecallHSC engine benchmark · Node ${process.version} · times in ms (mean)\n`);
console.log('words | parse old → new | chunk old → new | align/mark old → new | identical');
for(const r of rows)console.log(`${String(r.words).padStart(5)} | ${f(r.parseOld).padStart(7)} → ${f(r.parseNew).padEnd(7)} | ${f(r.chunkOld).padStart(6)} → ${f(r.chunkNew).padEnd(6)} | ${f(r.alignOld).padStart(8)} → ${f(r.alignNew).padEnd(8)} | ${r.sameResult}`);
console.log(`\nheap used ${(mem.heapUsed/1048576).toFixed(1)} MB. "align/mark new" includes tokenising both texts (the old column is the align call alone).`);
