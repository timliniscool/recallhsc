/* RecallHSC engine · policies: marking modes on top of the one word-alignment algorithm.

   standard  Standard — spelling tolerant (default). Exactly the original marking: words normalised (case,
             punctuation and apostrophes ignored), fuzzy spelling tolerance (0/1/2 edits by word length),
             words typed past the end are free, stray words in the middle count half.
   exact     Exact word recall. Same normalisation and alignment, but a word only matches if it is spelled
             exactly. Typing ahead and stray-word weighting as in standard.
   quotes    Strict quotations. Standard outside quotations; inside quotations (taken from the essay's own
             text, never from the answer) words must be exact, and every quoted word must be right to pass.
   verbatim  Verbatim recall. Literal words: capitalisation, punctuation, apostrophes and hyphens count.
             Only keyboard-equivalent characters are normalised (curly quotes -> straight, en/em dash -> "-",
             "…" -> "...", any run of spaces/new lines -> one break). Every extra word counts in full,
             including words typed past the end.

   Each mode = a tokeniser + a word-equivalence rule + extra-word weights + a pass rule; alignment is shared. */
(function(E){
const {items,tokens,fuzzy}=E;

/* ---- alignment with a pluggable match rule. For the standard rule this is the original align():
   identical DP, tie-breaking and scoring (verified against the golden fixtures). ---- */
function alignBy(T,U,match,opt){return alignCore(T.length,U.length,(i,j)=>match(T[i],U[j],i),opt)}
/* Fast path with identical results: every distinct word gets a number, so "same word" is an integer compare and
   the fuzzy verdict for each word pair is computed once and kept in a small typed array (no string keys per cell).
   rule: 'fuzzy' | 'exact'; strictMask[i] true = target word i must match exactly (strict quotes). */
function alignWords(T,U,rule,strictMask,opt){
  const ids=new Map(),words=[],id=w=>{let k=ids.get(w);if(k===undefined){k=words.length;ids.set(w,k);words.push(w)}return k};
  const a=Int32Array.from(T,id),b=Int32Array.from(U,id),V=words.length;
  let memo=null,map=null;if(rule==='fuzzy'){if(V*V<=8e6)memo=new Int8Array(V*V).fill(-1);else map=new Map()}
  const match=(i,j)=>{
    const x=a[i],y=b[j];if(x===y)return true;
    if(rule!=='fuzzy'||(strictMask&&strictMask[i]))return false;
    const k=x*V+y;
    if(memo){let v=memo[k];if(v<0){v=fuzzy(words[x],words[y])?1:0;memo[k]=v}return v===1}
    let v=map.get(k);if(v===undefined){v=fuzzy(words[x],words[y]);map.set(k,v)}return v;
  };
  return alignCore(T.length,U.length,match,opt);
}
function alignCore(n,m,match,opt){
  const trailFree=opt?opt.trailFree!==false:true,interiorW=opt&&opt.interiorW!=null?opt.interiorW:.5;
  const W=m+1,D=new Uint16Array((n+1)*W),M=new Uint8Array((n+1)*W),ratio=m?n/m:1;
  for(let i=0;i<=n;i++)D[i*W]=i;for(let j=0;j<=m;j++)D[j]=j;
  for(let i=1;i<=n;i++)for(let j=1;j<=m;j++){
    const f=Math.abs(i-j*ratio)<=220&&match(i-1,j-1);M[i*W+j]=f?1:0;
    const a=D[(i-1)*W+j-1]+(f?0:1),b=D[(i-1)*W+j]+1,c=D[i*W+j-1]+1;
    D[i*W+j]=a<b?(a<c?a:c):(b<c?b:c);
  }
  const ops=[];let i=n,j=m;
  while(i>0||j>0){
    if(i>0&&j>0){const f=M[i*W+j];if(D[i*W+j]===D[(i-1)*W+j-1]+(f?0:1)){ops.push({op:f?'ok':'sub',t:i-1,u:j-1});i--;j--;continue}}
    if(i>0&&D[i*W+j]===D[(i-1)*W+j]+1){ops.push({op:'del',t:i-1});i--;continue}
    ops.push({op:'ins',u:j-1});j--;
  }
  ops.reverse();
  const ok=ops.filter(o=>o.op==='ok').length;
  let trail=0;if(trailFree)for(let k=ops.length-1;k>=0&&ops[k].op==='ins';k--)trail++;
  const interior=ops.filter(o=>o.op==='ins').length-trail;
  return{ops,ok,trail,acc:n?Math.min(1,ok/(n+interiorW*interior)):0};
}

/* fuzzy() is pure, so repeated word pairs (live accuracy re-marks the same words every few hundred ms)
   are cached. Bounded: the cache is dropped when it passes CACHE_MAX entries. */
const CACHE_MAX=60000,FZ=new Map();
function fuzzyCached(a,b){
  if(a===b)return true;
  const k=a+'\u0001'+b;let v=FZ.get(k);
  if(v===undefined){v=fuzzy(a,b);if(FZ.size>=CACHE_MAX)FZ.clear();FZ.set(k,v)}
  return v;
}

/* ---- verbatim tokens: literal words with keyboard-equivalent characters folded ---- */
const vFold=s=>s.replace(/[‘’‚‛′]/g,"'").replace(/[“”„‟″]/g,'"').replace(/[–—―−]/g,'-').replace(/…/g,'...').replace(/ /g,' ');
function vItems(text){
  const out=[];
  String(text).split(/\n\s*\n/).forEach((para,pi)=>{
    if(pi)out.push({br:true,orig:'',norm:''});
    para.split(/\s+/).filter(Boolean).forEach(tok=>out.push({orig:tok,norm:vFold(tok)}));
  });
  return out;
}
const vTokens=text=>vItems(text).filter(i=>i.norm).map(i=>i.norm);

/* ---- quotation spans, read from the expected (essay) text only ----
   A word is inside a quotation from an opening “ or " (or ‘ at the start of a word) to the matching close.
   Apostrophes inside or at the end of words (don’t, students’) never open or close a quotation.
   startInside: the text begins inside a quotation that opened earlier in the essay. */
function quoteMask(text,startInside){
  const its=items(text),mask=[];let dq=!!startInside,sq=false;
  for(const it of its){
    if(!it.norm)continue;
    const o=it.orig,body=o.replace(/^[(\[]*/,'');
    if(!dq&&/^[“"]/.test(body))dq=true;          // opening double quote at the start of a word
    else if(!sq&&!dq&&/^‘/.test(body))sq=true;    // opening single quote (not an apostrophe: those sit inside or after a word)
    mask.push(dq||sq);
    const tail=o.replace(/[)\].,;:!?]+$/,'');
    if(dq&&/[”"]$/.test(tail)&&!(tail.length===1))dq=false;
    else if(sq&&/’$/.test(tail))sq=false;
  }
  return mask;
}
// whether the essay is still inside a double quotation at the end of this text (to carry into the next sentence)
function endsInsideQuote(text,startInside){
  let dq=!!startInside;
  for(const ch of String(text)){if(ch==='“')dq=true;else if(ch==='”')dq=false;else if(ch==='"')dq=!dq}
  return dq;
}

const MODES={
  standard:{id:'standard',label:'Standard',name:'Standard — spelling tolerant',blurb:'Allows small spelling slips. Best for smooth memorising.'},
  exact:{id:'exact',label:'Exact words',name:'Exact word recall',blurb:'Every word must be spelled right. Punctuation and capitals still don’t matter.'},
  quotes:{id:'quotes',label:'Strict quotes',name:'Strict quotations',blurb:'Quotes must be word-perfect (and all correct to pass). Everything else is marked like Standard.'},
  verbatim:{id:'verbatim',label:'Verbatim',name:'Verbatim recall',blurb:'Wording, capitals and punctuation all count. Curly vs straight quotes and dash types don’t.'},
};
const modeOf=m=>MODES[m]?m:'standard';

/* Marks one attempt.  in: {text, typed, mode, strict, startInside}
   out: {mode, T, U, r:{ops,ok,trail,acc}, pass, pct, quote:{n,ok,bad:[t indices]}, items}  (items: for rendering) */
function markAttempt(p){
  const mode=modeOf(p.mode),strict=p.strict==null?88:p.strict;
  let T,U,its,r,quote=null;
  if(mode==='verbatim'){
    its=vItems(p.text);T=its.filter(i=>i.norm).map(i=>i.norm);U=vTokens(p.typed||'');
    r=alignWords(T,U,'exact',null,{trailFree:false,interiorW:1});
  }else{
    its=items(p.text);T=its.filter(i=>i.norm).map(i=>i.norm);U=tokens(p.typed||'');
    if(mode==='exact')r=alignWords(T,U,'exact');
    else if(mode==='quotes'){
      const q=quoteMask(p.text,p.startInside);
      r=alignWords(T,U,'fuzzy',q);
      const okT=new Set(r.ops.filter(o=>o.op==='ok').map(o=>o.t)),inQ=[];q.forEach((v,i)=>{if(v)inQ.push(i)});
      quote={n:inQ.length,ok:inQ.filter(i=>okT.has(i)).length,bad:inQ.filter(i=>!okT.has(i)),mask:q};
    }else r=alignWords(T,U,'fuzzy');
  }
  const pct=Math.round(r.acc*100);
  const pass=r.acc*100>=strict&&(!quote||quote.bad.length===0);
  return{mode,T,U,r,pass,pct,quote};
}
/* live "match so far": marks the typed words against the same number of target words (as the original did) */
function liveAccuracy(p){
  const mode=modeOf(p.mode);
  if(mode==='verbatim'){const T=vTokens(p.text),U=vTokens(p.typed||'');if(!U.length)return null;return alignWords(T.slice(0,U.length),U,'exact',null,{trailFree:false,interiorW:1}).acc}
  const T=tokens(p.text),U=tokens(p.typed||'');if(!U.length)return null;
  if(mode==='exact')return alignWords(T.slice(0,U.length),U,'exact').acc;
  if(mode==='quotes'){const q=quoteMask(p.text,p.startInside);return alignWords(T.slice(0,U.length),U,'fuzzy',q).acc}
  return alignWords(T.slice(0,U.length),U,'fuzzy').acc;
}
Object.assign(E,{alignBy,alignWords,alignCore,fuzzyCached,vFold,vItems,vTokens,quoteMask,endsInsideQuote,MODES,modeOf,markAttempt,liveAccuracy});
})(typeof globalThis!=='undefined'?(globalThis.RecallEngine=globalThis.RecallEngine||{}):this.RecallEngine=this.RecallEngine||{});
if(typeof module!=='undefined'&&module.exports)module.exports=globalThis.RecallEngine;
