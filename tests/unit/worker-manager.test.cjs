'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {E}=require('../helpers/engine.cjs');
const {createCompute,STALE}=require('../../js/workers/worker-manager.js');
/* A fake Worker that runs the real engine with controllable delay, ordering and failures. */
function fakeWorker(cfg){
  cfg=cfg||{};
  const w={posted:[],terminated:false,postMessage(msg){this.posted.push(msg);if(cfg.crashOn&&cfg.crashOn(msg)){setTimeout(()=>this.onerror&&this.onerror({preventDefault(){}}),1);return}
    if(cfg.hang)return;
    const d=typeof cfg.delay==='function'?cfg.delay(msg):(cfg.delay||1);
    setTimeout(()=>{if(this.terminated)return;let res;try{res={id:msg.id,ok:true,result:{mark:p=>E.markAttempt(p),live:p=>E.liveAccuracy(p),parse:p=>E.parseEssay(p.text,p.kind),ping:()=>'pong'}[msg.op](msg.payload)}}catch(e){res={id:msg.id,ok:false,error:e.message}}
      this.onmessage&&this.onmessage({data:res})},d)},
    terminate(){this.terminated=true}};
  return w;
}
const big='word '.repeat(400);
test('large jobs go to the worker; results equal the synchronous engine',async()=>{
  const c=createCompute({engine:E,makeWorker:()=>fakeWorker()});
  const p={text:big+'end',typed:big+'end',mode:'standard',strict:88};
  const r=await c.run('mark',p,{size:401});
  assert.deepEqual(JSON.parse(JSON.stringify(r)),JSON.parse(JSON.stringify(E.markAttempt(p))));
  assert.equal(c.stats.worker,1);
});
test('small jobs run inline without the worker',async()=>{
  let made=0;const c=createCompute({engine:E,makeWorker:()=>{made++;return fakeWorker()}});
  const r=await c.run('mark',{text:'a b c',typed:'a b c'},{size:3});
  assert.equal(r.pct,100);assert.equal(made,0);assert.equal(c.stats.inline,1);
});
test('out-of-order responses resolve the right promises',async()=>{
  const c=createCompute({engine:E,makeWorker:()=>fakeWorker({delay:m=>m.payload.typed.startsWith('slow')?30:2})});
  const a=c.run('mark',{text:big,typed:'slow '+big},{size:500}),b=c.run('mark',{text:big,typed:big},{size:500});
  const [ra,rb]=await Promise.all([a,b]);
  assert.equal(rb.pct,100);assert.ok(ra.pct<=100&&ra.U[0]==='slow');
});
test('latest request wins on a channel: the older one resolves as STALE',async()=>{
  const c=createCompute({engine:E,makeWorker:()=>fakeWorker({delay:20})});
  const p1=c.run('live',{text:big,typed:'word word'},{channel:'live',size:500});
  const p2=c.run('live',{text:big,typed:'word word word'},{channel:'live',size:500});
  assert.equal(await p1,STALE);assert.equal(await p2,1);assert.equal(c.stats.stale,1);
});
test('cancel() makes in-flight work stale (essay switch, reset, mode change)',async()=>{
  const c=createCompute({engine:E,makeWorker:()=>fakeWorker({delay:20})});
  const p=c.run('mark',{text:big,typed:big},{channel:'mark',size:500});c.cancel('mark');
  assert.equal(await p,STALE);
});
test('timeout restarts the worker and still returns a correct result',async()=>{
  let made=0;const c=createCompute({engine:E,timeout:30,makeWorker:()=>{made++;return fakeWorker({hang:made===1})}});
  const p={text:big,typed:big,mode:'standard'};
  const r=await c.run('mark',p,{size:500});
  assert.equal(r.pct,100);assert.equal(c.stats.fallback,1);
  const r2=await c.run('mark',p,{size:500});assert.equal(r2.pct,100);assert.equal(made,2,'a fresh worker was created');
});
test('a crashing worker falls back to the main thread; repeated crashes disable the worker',async()=>{
  const c=createCompute({engine:E,makeWorker:()=>fakeWorker({crashOn:()=>true})});
  for(let i=0;i<5;i++){const r=await c.run('mark',{text:big,typed:big},{size:500});assert.equal(r.pct,100)}
  assert.equal(c.disabled,true);
});
test('if the Worker constructor throws (blocked or unsupported) everything runs inline',async()=>{
  const c=createCompute({engine:E,makeWorker:()=>{throw new Error('blocked by CSP')}});
  const r=await c.run('parse',{text:'One. Two.',kind:'essay'},{size:999});
  assert.equal(r.sents.length,2);assert.equal(c.disabled,true);
});
test('worker errors are reported as rejections for bad ops',async()=>{
  const c=createCompute({engine:E,makeWorker:()=>fakeWorker()});
  await assert.rejects(c.run('nope',{},{size:999}));
});
