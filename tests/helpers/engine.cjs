/* Loads the engine exactly as the page and worker do (classic scripts attaching to RecallEngine), in page order. */
'use strict';
const path=require('path');
const root=path.join(__dirname,'..','..');
for(const f of ['text','chunker','parser','marking','policies','recall'])
  try{require(path.join(root,'js','engine',f+'.js'))}catch(e){if(!(f==='policies'&&e.code==='MODULE_NOT_FOUND'))throw e}
const E=globalThis.RecallEngine;
// same compaction the golden capture uses for task queues
const h=t=>{let x=2166136261;for(let i=0;i<t.length;i++){x^=t.charCodeAt(i);x=Math.imul(x,16777619)>>>0}return t.length+':'+x.toString(36)};
const slimTask=t=>{const o={...t};delete o.T;for(const k of ['text','pre','next'])if(typeof o[k]==='string')o[k]=h(o[k]);if(o.shown)o.shown=o.shown.map(h);return o};
const slimParse=m=>({paras:m.paras,pstart:m.pstart,total:m.total,kind:m.kind,formulaic:m.formulaic,motifs:m.motifs,style:m.style,
  sents:m.sents.map(x=>{const o={p:x.p,s:x.s,text:x.text,wc:x.wc,role:x.role,unitEnd:x.unitEnd,cp:x.cp};if(x.echo)o.echo=x.echo;return o})});
const golden=()=>require(path.join(root,'tests','fixtures','golden.json'));
const inputs=()=>{const fs=require('fs'),src=fs.readFileSync(path.join(root,'tests','fixtures','index.original.html'),'utf8');
  return require(path.join(root,'tests','fixtures','inputs.cjs'))({raw:src.match(/const RAW = `([\s\S]*?)`;/)[1],docs:JSON.parse(src.match(/<script type="application\/json" id="docs">([\s\S]*?)<\/script>/)[1])})};
module.exports={E,root,slimTask,slimParse,golden,inputs};
