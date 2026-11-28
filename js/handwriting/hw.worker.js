/* RecallHSC · on-device handwriting checker (module Web Worker).
   Model: TrOCR-small handwritten (MIT) via transformers.js + ONNX Runtime Web, entirely on the device. The model is
   downloaded once from Hugging Face, kept in the browser cache, and works offline after that. Nothing is uploaded.

   How it stays fast and fair:
     1. Encoding a written line is the expensive step (~0.1–0.6 s). The page sends each finished line to be encoded
        in the background while the student is still writing, so by Check usually only the last line is left.
     2. Reading a line from its cached encoding takes a few milliseconds per word.
     3. Rescue: where what was read differs from the expected words, one quick pass checks whether the expected words
        fit that ink. Messy-but-right writing is accepted; a different word the student actually wrote fits very
        poorly (~0.0001), so real mistakes still reach the marking.

   Messages in:
     {type:'load'}
     {type:'encode', key, blob}                                   background pre-encoding of a finished line
     {type:'check', id, expected, lines:[{key, blob, width}]}     read the page against the expected answer
   Messages out:
     {type:'progress', loaded, total} | {type:'ready', device}
     {type:'line', id, i, text, ok}   (ok: the line matched the expected words)
     {type:'result', id, texts, oks, ms} | {type:'error', id, message} */
import {env, AutoProcessor, AutoTokenizer, VisionEncoderDecoderModel, RawImage, Tensor} from '../vendor/transformers/transformers.min.js';

const MODEL='Xenova/trocr-small-handwritten';
const START=2,EOS=2;      // TrOCR starts and ends every line with token 2
const RESCUE=0.03;        // expected words replace a misread when they fit the ink at least this well (a different word scores ~0.0001)
const RESCUE_LOOKALIKE=0.001; // ...or fit it somewhat AND look like what was read (half the letters or more in common)
const RESCUE_DROPPED=0.05;    // expected words the reader dropped or merged away come back when they fit the ink this well
const NEAR=2.5;               // ...or are within this much (log-probability per token, ~12x) of the reader's own guess
// letter-level likeness of two word groups: 1 = identical, 0 = nothing in common (edit distance, case and punctuation ignored)
function similar(a,b){
  a=a.toLowerCase().replace(/[^a-z0-9]/g,'');b=b.toLowerCase().replace(/[^a-z0-9]/g,'');
  if(!a||!b)return 0;
  let prev=Array.from({length:b.length+1},(_,j)=>j);
  for(let i=1;i<=a.length;i++){const cur=[i];for(let j=1;j<=b.length;j++)cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));prev=cur}
  return 1-prev[b.length]/Math.max(a.length,b.length);
}
env.allowLocalModels=false;
env.useBrowserCache=true;
env.backends.onnx.wasm.wasmPaths=new URL('../vendor/transformers/',import.meta.url).href; // our own copy, not a CDN
env.backends.onnx.wasm.numThreads=1; // GitHub Pages can't enable cross-origin isolation, so no threads

let M=null,device='wasm';
const files=new Map();
const cache=new Map(); // line key -> encoder output (newest last; capped)
let queue=Promise.resolve(); // one model, one job at a time

async function hasWebGPU(){try{return !!(self.navigator&&navigator.gpu&&await navigator.gpu.requestAdapter())}catch(_){return false}}
function load(){
  if(M)return M;
  M=(async()=>{
    device=await hasWebGPU()?'webgpu':'wasm';
    const progress_callback=p=>{if(p.status==='progress'&&p.file){files.set(p.file,[p.loaded||0,p.total||0]);let l=0,t=0;for(const[a,b] of files.values()){l+=a;t+=b}postMessage({type:'progress',loaded:l,total:t})}};
    // image encoder on the GPU when there is one (one big pass per line); the word-by-word reader always on the CPU
    // (each word is a tiny step, and a GPU round trip per word is slower than just doing it)
    const make=gpu=>VisionEncoderDecoderModel.from_pretrained(MODEL,{device:gpu?{encoder_model:'webgpu',decoder_model_merged:'wasm'}:'wasm',dtype:{encoder_model:gpu?'fp16':'q8',decoder_model_merged:'q8'},progress_callback});
    let model;try{model=await make(device==='webgpu')}catch(e){if(device==='wasm')throw e;device='wasm';model=await make(false)} // no usable GPU: CPU
    if(!model.forward_params.includes('encoder_outputs'))model.forward_params.push('encoder_outputs'); // so generate() reuses a cached encoding
    const [proc,tok]=await Promise.all([AutoProcessor.from_pretrained(MODEL),AutoTokenizer.from_pretrained(MODEL)]);
    return {model,proc,tok};
  })();
  M.then(()=>postMessage({type:'ready',device}),e=>{M=null;postMessage({type:'error',message:String(e&&e.message||e)})});
  return M;
}
const job=fn=>{const p=queue.then(fn,fn);queue=p.catch(()=>{});return p};

async function encode(key,blob){
  if(key&&cache.has(key)){const v=cache.get(key);cache.delete(key);cache.set(key,v);return v} // keep it fresh
  const {model,proc}=await load();
  const img=await RawImage.fromBlob(blob);
  const {pixel_values}=await proc(img);
  // the library's own encoder step (pinned version, bundled with the app)
  const mi=await model._prepare_encoder_decoder_kwargs_for_generation({model_inputs:{pixel_values},generation_config:{guidance_scale:null}});
  const v={pv:pixel_values,enc:mi.encoder_outputs};
  if(key){cache.set(key,v);while(cache.size>40)cache.delete(cache.keys().next().value)}
  return v;
}
const ids64=a=>new Tensor('int64',BigInt64Array.from(a.map(BigInt)),[1,a.length]);
function logProb(logits,pos,token){
  const V=logits.dims[2],d=logits.data,o=pos*V;let mx=-Infinity;
  for(let v=0;v<V;v++)if(d[o+v]>mx)mx=d[o+v];
  let s=0;for(let v=0;v<V;v++)s+=Math.exp(d[o+v]-mx);
  return d[o+token]-mx-Math.log(s);
}
// read one line from its cached encoding (the decoder keeps its working memory between words: a few ms per word)
async function readLine(v){
  const {model,tok}=await load();
  const out=await model.generate({pixel_values:v.pv,encoder_outputs:v.enc,max_new_tokens:48});
  return tok.decode(Array.from(out.tolist()[0]).map(Number),{skip_special_tokens:true}).trim();
}
// how well do these exact words fit this line, after the given words? (geometric-mean token probability)
async function fit(v,before,words){
  const {model,tok}=await load();
  const enc=t=>Array.from(tok.encode(t,{add_special_tokens:false})).map(Number);
  const pre=before?enc(before):[],all=enc(before?before+' '+words:words);
  if(all.length<=pre.length)return 0;
  const ids=[START,...all];
  const {logits}=await model({encoder_outputs:v.enc,decoder_input_ids:ids64(ids)});
  let s=0,n=0;for(let k=1+pre.length;k<ids.length;k++){s+=logProb(logits,k-1,ids[k]);n++}
  return Math.exp(s/n);
}
const norm=w=>w.toLowerCase().replace(/[^a-z0-9']/g,'');
// word alignment (edit distance): returns pairs [gi|-1, ej|-1]
function alignWords(G,E){
  const g=G.map(norm),e=E.map(norm),n=g.length,m=e.length,D=[];
  for(let i=0;i<=n;i++){D.push(new Int32Array(m+1));D[i][0]=i}for(let j=0;j<=m;j++)D[0][j]=j;
  for(let i=1;i<=n;i++)for(let j=1;j<=m;j++)D[i][j]=Math.min(D[i-1][j]+1,D[i][j-1]+1,D[i-1][j-1]+(g[i-1]===e[j-1]?0:1));
  const out=[];let i=n,j=m;
  while(i>0||j>0){
    if(i>0&&j>0&&D[i][j]===D[i-1][j-1]+(g[i-1]===e[j-1]?0:1)){out.push([i-1,j-1]);i--;j--}
    else if(i>0&&D[i][j]===D[i-1][j]+1){out.push([i-1,-1]);i--}
    else{out.push([-1,j-1]);j--}
  }
  return out.reverse();
}

async function check(m){
  const t0=performance.now();
  await load();
  const E=String(m.expected||'').trim().split(/\s+/).filter(Boolean);
  // 1. read every line (already encoded while writing, except usually the last)
  const vs=[],lines=[],perf={enc:0,read:0,fit:0,fits:0};
  for(let i=0;i<m.lines.length;i++){
    const L=m.lines[i];let t=performance.now();const v=await encode(L.key,L.blob);perf.enc+=performance.now()-t;vs.push(v);
    t=performance.now();const text=await readLine(v);perf.read+=performance.now()-t;lines.push(text.split(/\s+/).filter(Boolean));
    postMessage({type:'line',id:m.id,i,text,ok:null});
  }
  // 2. rescue misreads: where what was read differs from the expected words, check whether the expected words fit
  //    the ink. Accept them only if they do (RESCUE); a different word the student actually wrote fits very poorly.
  const G=[],at=[];lines.forEach((ws,li)=>ws.forEach((w,wi)=>{G.push(w);at.push([li,wi])}));
  const pairs=alignWords(G,E);
  const out=lines.map(ws=>ws.slice()),repl=lines.map(()=>[]);
  for(let p=0;p<pairs.length;){
    if(pairs[p][0]>=0&&pairs[p][1]>=0&&norm(G[pairs[p][0]])===norm(E[pairs[p][1]])){p++;continue}
    // a run of mismatches; keep it within one line
    let q=p;const li=pairs.find((x,k)=>k>=p&&x[0]>=0)?at[pairs.find((x,k)=>k>=p&&x[0]>=0)[0]][0]:-1;
    const gs=[],es=[];
    while(q<pairs.length&&!(pairs[q][0]>=0&&pairs[q][1]>=0&&norm(G[pairs[q][0]])===norm(E[pairs[q][1]]))){
      const [gi,ej]=pairs[q];if(gi>=0&&at[gi][0]!==li)break;if(gi>=0)gs.push(gi);if(ej>=0)es.push(ej);q++}
    if(q===p)q++;
    if(es.length){
      // which line, and where in it: the misread words themselves, or (for words the reader dropped or merged away)
      // the word just before the gap
      let L=li,first;
      if(gs.length){first=at[gs[0]][1]}
      else{let k=p-1;while(k>=0&&pairs[k][0]<0)k--;if(k>=0){L=at[pairs[k][0]][0];first=at[pairs[k][0]][1]+1}else{L=0;first=0}}
      if(L>=0&&L<lines.length){
        const before=lines[L].slice(0,first).join(' '),want=es.map(j=>E[j]).join(' '),seen=gs.map(g=>G[g]).join(' ');
        const tf=performance.now();const f_=await fit(vs[L],before,want);perf.fit+=performance.now()-tf;perf.fits++;
        // messy handwriting: accept the expected words when they fit the ink well, or fit it somewhat and look like
        // what was read (e.g. "place" read as "slave"). A genuinely different word fits ~0.0001 and looks different.
        let ok=gs.length?(f_>=RESCUE||(f_>=RESCUE_LOOKALIKE&&similar(seen,want)>=0.5)):f_>=RESCUE_DROPPED;
        // cursive and very messy writing: compare the expected words with the reader's own guess on the same ink.
        // If the expected words are nearly as believable (within NEAR per token), the writing gets the benefit of the
        // doubt. A clearly different word is thousands of times less likely, so real mistakes still fail.
        if(!ok&&gs.length){const fs_=await fit(vs[L],before,seen);perf.fits++;if(fs_>0&&f_>0&&Math.log(f_)>=Math.log(fs_)-NEAR)ok=true}
        if(ok)repl[L].push([first,gs.length,es.map(j=>E[j])]);
      }
    }
    p=q;
  }
  const texts=[],oks=[];
  for(let li=0;li<out.length;li++){
    let ws=out[li];for(const [s,n,with_] of repl[li].sort((a,b)=>b[0]-a[0]))ws.splice(s,n,...with_);
    texts.push(ws.join(' '));
  }
  // a line is "ok" when, after rescue, every word on it matches the answer
  const W=texts.join(' ').split(/\s+/).filter(Boolean),lineOf=[];texts.forEach((t,li)=>t.split(/\s+/).filter(Boolean).forEach(()=>lineOf.push(li)));
  const bad=new Set();
  for(const [a,b] of alignWords(W,E))if(a>=0&&(b<0||norm(W[a])!==norm(E[b])))bad.add(lineOf[a]);
  texts.forEach((t,i)=>{oks.push(!bad.has(i));postMessage({type:'line',id:m.id,i,text:t,ok:!bad.has(i)})});
  for(const k in perf)perf[k]=Math.round(perf[k]);
  return {texts,oks,ms:Math.round(performance.now()-t0),perf};
}

onmessage=e=>{
  const m=e.data||{};
  if(m.type==='load'){load();return}
  if(m.type==='encode'){job(()=>encode(m.key,m.blob)).catch(()=>{});return}
  if(m.type==='check')job(()=>check(m)).then(r=>postMessage({type:'result',id:m.id,...r,device}),err=>postMessage({type:'error',id:m.id,message:String(err&&err.message||err)}));
};
