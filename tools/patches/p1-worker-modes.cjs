/* Wires the worker manager and marking modes into js/app.js (applied once during the upgrade). */
'use strict';
const fs=require('fs'),path=require('path');
const f=path.join(__dirname,'..','..','js','app.js');let s=fs.readFileSync(f,'utf8');
const R=(a,b)=>{const n=s.split(a).length-1;if(n!==1)throw new Error(n+' matches: '+a.slice(0,90));s=s.replace(a,()=>b)};

// compute manager + quote carry-over per sentence
R(`const buildQueue=g=>RecallEngine.buildQueue({SENTS,PARAS,PSTART,S,SET},g);`,
`const buildQueue=g=>RecallEngine.buildQueue({SENTS,PARAS,PSTART,S,SET},g);
/* heavy marking/parsing runs in js/workers/compute.worker.js; small jobs and fallbacks run inline */
const COMPUTE=createCompute({onError:r=>console.warn('compute worker:',r)});
const {markAttempt,liveAccuracy,MODES,modeOf,vItems,endsInsideQuote}=RecallEngine;
let QSTART=[];          // QSTART[g]: sentence g begins inside a quotation that opened earlier (for strict quotes)
let markSeq=0;          // bumped whenever an attempt, task, essay, reset or mode changes; older results are ignored
let attemptMode='standard'; // marking mode fixed when an attempt starts (changes apply from the next attempt)
let composing=false;    // IME composition in progress: never auto-submit mid-composition
const taskQuoteStart=t=>{const q=!!QSTART[t.a];return t.pre?endsInsideQuote(t.pre,q):q};
function invalidateMarking(){markSeq++;COMPUTE.cancel()}`);
R(`({paras:PARAS,sents:SENTS,pstart:PSTART,total:TOTALW,formulaic:FORMULAIC}=parseEssay(text,essayKind(id)));
TOTALW=TOTALW||1;`,`({paras:PARAS,sents:SENTS,pstart:PSTART,total:TOTALW,formulaic:FORMULAIC}=parseEssay(text,essayKind(id)));
TOTALW=TOTALW||1;
{let inside=false;QSTART=SENTS.map(x=>{const q=inside;inside=endsInsideQuote(x.text,inside);return q})}
invalidateMarking();`);
// each new task / retry starts a fresh attempt
R(`clearTimeout(passT);passT=0;
phase='type';typed='';ta.value='';t0=0;L=newLive();cIdx=0;`,`clearTimeout(passT);passT=0;invalidateMarking();attemptMode=modeOf(SET.mode);
phase='type';typed='';ta.value='';t0=0;L=newLive();cIdx=0;`);
R(`function retry(){clearTimeout(passT);passT=0;phase='type';`,`function retry(){clearTimeout(passT);passT=0;invalidateMarking();attemptMode=modeOf(SET.mode);phase='type';`);

// IME: no auto-submit while composing
R(`typed=ta.value.replace(/\\s*\\n\\s*/g,' ');`,`typed=ta.value.replace(/\\s*\\n\\s*/g,' ');
if(e.isComposing||composing){renderTyped();return}`);
R(`ta.addEventListener('focus',()=>typebox.classList.add('focus','idle'));`,`ta.addEventListener('compositionstart',()=>{composing=true;clearTimeout(autoT)});
ta.addEventListener('compositionend',()=>{composing=false;ta.dispatchEvent(new Event('input'))});
ta.addEventListener('focus',()=>typebox.classList.add('focus','idle'));`);
R(`if(e.key==='Enter'){e.preventDefault();if(typed.trim())check()}`,`if(e.key==='Enter'){if(e.isComposing||composing)return;e.preventDefault();if(typed.trim())check()}`);

// live accuracy: off the main thread, latest request wins, stale answers dropped
R(`if(now-L.accAt>400&&U.length){L.accAt=now;const r=align(task.T.slice(0,U.length),U);L.acc=r.acc}`,
`if(now-L.accAt>400&&U.length&&phase==='type'){L.accAt=now;const L0=L,tok=markSeq;
  COMPUTE.run('live',{text:task.text,typed,mode:attemptMode,startInside:taskQuoteStart(task)},{channel:'live',size:U.length})
    .then(v=>{if(v!==COMPUTE.STALE&&L===L0&&tok===markSeq)L.acc=v}).catch(()=>{})}`);

// submission: snapshot the attempt, mark (worker or inline), apply only if nothing changed meanwhile
R(`function check(){
clearTimeout(autoT);
const st=S.stats,U=tokens(typed),r=align(task.T,U);`,
`function check(){
if(phase!=='type'||!task||composing)return;
clearTimeout(autoT);
const myTask=task,myTyped=typed,essay=ACTIVE,epoch=S.resetAt||0,token=++markSeq;
const payload={text:myTask.text,typed:myTyped,mode:attemptMode,strict:SET.strict,startInside:taskQuoteStart(myTask)};
phase='marking';typebox.classList.add('marking');
const apply=res=>{
  if(res===COMPUTE.STALE||token!==markSeq||task!==myTask||ACTIVE!==essay||(S.resetAt||0)!==epoch||phase!=='marking')return; // out of date: ignore
  typebox.classList.remove('marking');finishCheck(res,myTyped);
};
COMPUTE.run('mark',payload,{channel:'mark',size:myTask.T.length}).then(apply,()=>apply(markAttempt(payload)));
}
function finishCheck(res,typedNow){
const st=S.stats,U=res.U,T=res.T,r=res.r,mode=res.mode;typed=typedNow;`);
R(`const w=task.T[o.t];if(w.length>2)st.missed[w]=(st.missed[w]||0)+1;`,`const w=T[o.t];if(w.length>2)st.missed[w]=(st.missed[w]||0)+1;`);
R(`if(task.type!=='build'){st.slipSum+=firstErr<0?1:firstErr/task.T.length;st.slipN++}
if(U.length&&task.T.length){st.firstLetterN++;if(U[0][0]===task.T[0][0])st.firstLetter++}`,
`if(task.type!=='build'){st.slipSum+=firstErr<0?1:firstErr/T.length;st.slipN++}
if(U.length&&T.length){st.firstLetterN++;if(U[0][0]===T[0][0])st.firstLetter++}`);
R(`const pass=r.acc*100>=SET.strict;`,`const pass=res.pass;
// per-mode tallies, so stricter modes are never averaged in with Standard
const mm=st.modes[mode]||(st.modes[mode]={att:0,pass:0,accSum:0});mm.att++;mm.accSum+=r.acc;if(pass)mm.pass++;`);
R(`st.hist.push([Math.round(r.acc*100),pass?1:0]);`,`st.hist.push(mode==='standard'?[Math.round(r.acc*100),pass?1:0]:[Math.round(r.acc*100),pass?1:0,mode]);`);
R(`showDiff(r,U,true);`,`showDiff(r,U,true,res);`);
R(`showDiff(r,U);
renderFoot(\`<span class="resmsg bad">✗ \${pct}% · need \${SET.strict}%</span>`,
`showDiff(r,U,false,res);
const qFail=res.quote&&res.quote.bad.length&&r.acc*100>=SET.strict;
renderFoot(\`<span class="resmsg bad">✗ \${pct}% · \${qFail?\`\${res.quote.bad.length} quote word\${res.quote.bad.length>1?'s':''} wrong\`:'need '+SET.strict+'%'}</span>`);

// marking display: literal tokens in verbatim mode, quote slips flagged, and text (not just colour) for screen readers
R(`function showDiff(r,U,passed){
const its=items(task.text),cmp=[];`,`function showDiff(r,U,passed,res){
const its=res&&res.mode==='verbatim'?vItems(task.text):items(task.text),cmp=[],qbad=new Set(res&&res.quote?res.quote.bad:[]);`);
R("else if(o.op==='sub')html+=`<span class=\"w sub\">${esc(it.orig)}<s>${esc(U[o.u])}</s></span> `;\nelse html+=`<span class=\"w del\">${esc(it.orig)}</span> `;",
  "else if(o.op==='sub')html+=`<span class=\"w sub${qbad.has(o.t)?' qerr':''}\">${esc(it.orig)}<s>${esc(U[o.u])}</s><span class=\"sr-only\"> (you wrote ${esc(U[o.u])})</span></span> `;\nelse html+=`<span class=\"w del${qbad.has(o.t)?' qerr':''}\">${esc(it.orig)}<span class=\"sr-only\"> (missed)</span></span> `;");
R("if(o.op==='ins'){const ahead=r.ops.indexOf(o)>=r.ops.length-r.trail;html+=`<span class=\"w ${ahead?'ahead':'ins'}\"${ahead?' title=\"Typed ahead: not counted\"':''}>${esc(U[o.u])}</span> `;continue}",
  "if(o.op==='ins'){const ahead=r.ops.indexOf(o)>=r.ops.length-r.trail;html+=`<span class=\"w ${ahead?'ahead':'ins'}\"${ahead?' title=\"Typed ahead: not counted\"':''}>${esc(U[o.u])}<span class=\"sr-only\"> (${ahead?'typed ahead':'extra'})</span></span> `;continue}");
R(`r.trail&&'<span><i class="lg-ahead"></i>typed ahead (doesn’t count)</span>'].filter(Boolean).join('');`,
  `r.trail&&'<span><i class="lg-ahead"></i>typed ahead (doesn’t count)</span>',qbad.size&&'<span><i class="lg-q"></i>quote slip</span>'].filter(Boolean).join('');`);
// hint on huge answers: align a recent window instead of the whole essay (stays instant)
R(`for(let k=Math.max(1,U.length-4);k<=Math.min(task.T.length,U.length+4);k++){const x=align(task.T.slice(0,k),U);if(!r||x.ok>r.ok)r=x}`,
`const off=Math.max(0,U.length-120),Uw=U.slice(off);
for(let k=Math.max(1,U.length-4);k<=Math.min(task.T.length,U.length+4);k++){const x=align(task.T.slice(off,k),Uw);x.ops.forEach(o=>{if(o.t!=null)o.t+=off});if(!r||x.ok>r.ok)r=x}`);
// upload preview: parse off the main thread, debounced, latest wins
R(`const m=parseEssay(txt,UP.kind),pl=(n,w)=>`,`clearTimeout(upSync.t);const kind=UP.kind,words=txt.split(/\\s+/).length;
upSync.t=setTimeout(()=>COMPUTE.run('parse',{text:txt,kind},{channel:'uparse',size:words}).then(m=>{if(m!==COMPUTE.STALE&&$('upText').value===txt&&UP.kind===kind)upShow(m)},()=>upShow(parseEssay(txt,kind))),words>400?160:0);
}
function upShow(m){
const pl=(n,w)=>`);
R(`$('upPrevWrap').hidden=false;
if($('upPrevWrap').open)upPreview(m);
}`,`$('upPrevWrap').hidden=false;
if($('upPrevWrap').open)upPreview(m);
}`);
// tap-to-pick: stricter modes are really assessed (punctuation/capitals in verbatim, spelling in exact/quotes)
R(`const disp=right.orig.replace(/^[“"‘(]+|[”"’),.;:!?]+$/g,'')||right.orig;
const opts=[{t:disp,ok:true},...decoys(right,prev).map(t=>({t,ok:false}))];`,
`const mode=attemptMode,inQ=mode==='quotes'&&RecallEngine.quoteMask(task.text,taskQuoteStart(task))[cIdx];
const disp=mode==='verbatim'?right.orig:(right.orig.replace(/^[“"‘(]+|[”"’),.;:!?]+$/g,'')||right.orig);
let dec=decoys(right,prev);
if(mode==='verbatim')dec=[literalVariant(right.orig),dec[0]];          // same word, different capitals/punctuation
else if((mode==='exact'||inQ)&&right.norm.length>=4)dec=[misspell(disp),dec[0]]; // a near-miss spelling
dec=dec.filter((t,i,a)=>t&&t!==disp&&a.indexOf(t)===i);while(dec.length<2)dec.push(decoys(right,prev)[dec.length]||'and');
const opts=[{t:disp,ok:true},...dec.slice(0,2).map(t=>({t,ok:false}))];`);
R(`// every tap adds a word, right or wrong, so the normal marking shows exactly which picks were off`,
`// decoys for strict modes
function misspell(w){const a=[...w];if(a.length<4)return w+'e';const i=1+Math.floor(Math.random()*(a.length-3));[a[i],a[i+1]]=[a[i+1],a[i]];const v=a.join('');return v===w?w.slice(0,-1):v}
function literalVariant(w){
  const core=w.replace(/[.,;:!?”"’)]+$/,''),tail=w.slice(core.length);
  if(tail)return core;                                   // drop the punctuation
  if(/^[A-Z]/.test(w))return w[0].toLowerCase()+w.slice(1); // wrong capital
  if(/^[a-z]/.test(w))return w[0].toUpperCase()+w.slice(1);
  return w+',';
}
// every tap adds a word, right or wrong, so the normal marking shows exactly which picks were off`);
fs.writeFileSync(f,s);console.log('p1 applied');
