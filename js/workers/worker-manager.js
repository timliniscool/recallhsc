/* RecallHSC worker manager.
   Compute.run(op, payload, {channel, size, timeout}) -> Promise<result>
   - Small jobs (size below INLINE_MAX words) run synchronously on the main thread: messaging would cost more.
   - Big jobs go to the compute worker. Responses are matched by request id.
   - channel: latest request wins. A newer request on the same channel settles the older one with
     Compute.STALE, so an out-of-date live accuracy can never overwrite a newer one.
   - Timeouts and worker crashes restart the worker; the affected request is recomputed synchronously,
     so marking always completes. If workers are unavailable (blocked, unsupported), everything runs inline.
   The same engine functions run in both paths, so results are identical. */
(function(root){
'use strict';
const STALE=Object.freeze({stale:true});
function createCompute(opts){
  opts=opts||{};
  const E=opts.engine||root.RecallEngine;
  const INLINE_MAX=opts.inlineMax!=null?opts.inlineMax:250;
  const makeWorker=opts.makeWorker||(()=>new Worker(opts.url||'js/workers/compute.worker.js'));
  const SYNC={mark:p=>E.markAttempt(p),live:p=>E.liveAccuracy(p),parse:p=>E.parseEssay(p.text,p.kind),ping:()=>'pong'};
  let w=null,disabled=!!opts.disabled,restarts=0,seq=0;
  const pending=new Map(),latest=new Map();
  const stats={worker:0,inline:0,fallback:0,stale:0,restarts:0};
  function syncRun(op,payload){const fn=SYNC[op];if(!fn)throw new Error('unknown op: '+op);return fn(payload)}
  function settle(id,fn){const p=pending.get(id);if(!p)return;pending.delete(id);clearTimeout(p.timer);if(p.channel&&latest.get(p.channel)===id)latest.delete(p.channel);fn(p)}
  function failover(reason){
    // recompute everything still in flight on the main thread, then try a fresh worker (bounded)
    const list=[...pending.keys()];
    for(const id of list)settle(id,p=>{try{stats.fallback++;p.resolve(syncRun(p.op,p.payload))}catch(e){p.reject(e)}});
    if(w){try{w.terminate()}catch(_){}}w=null;
    if(++restarts>3){disabled=true}else stats.restarts++;
    if(opts.onError)opts.onError(reason);
  }
  function ensure(){
    if(disabled)return null;if(w)return w;
    try{
      w=makeWorker();
      w.onmessage=e=>{const d=e.data||{};settle(d.id,p=>d.ok?p.resolve(d.result):p.reject(new Error(d.error)))};
      w.onerror=e=>{if(e&&e.preventDefault)e.preventDefault();failover('worker error')};
      w.onmessageerror=()=>failover('message error');
    }catch(e){disabled=true;w=null}
    return w;
  }
  function run(op,payload,o){
    o=o||{};
    const channel=o.channel||null,size=o.size==null?Infinity:o.size;
    if(channel&&latest.has(channel)){const old=latest.get(channel);settle(old,p=>{stats.stale++;p.resolve(STALE)})}
    if(size<INLINE_MAX||disabled||!ensure()){
      stats.inline++;
      try{return Promise.resolve(syncRun(op,payload))}catch(e){return Promise.reject(e)}
    }
    const id=++seq;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>failover('timeout'),o.timeout||opts.timeout||10000);
      pending.set(id,{op,payload,resolve,reject,timer,channel});
      if(channel)latest.set(channel,id);
      stats.worker++;
      try{w.postMessage({id,op,payload})}catch(e){failover('post failed')}
    });
  }
  // drop everything in flight on a channel (or all), e.g. when the essay, task or marking mode changes
  function cancel(channel){for(const[id,p]of[...pending])if(!channel||p.channel===channel)settle(id,q=>{stats.stale++;q.resolve(STALE)})}
  return{run,cancel,STALE,stats,get usingWorker(){return!!w&&!disabled},get disabled(){return disabled},
    terminate(){cancel();if(w)try{w.terminate()}catch(_){}w=null}};
}
root.createCompute=createCompute;

if(typeof module!=='undefined'&&module.exports)module.exports={createCompute,STALE};
})(typeof globalThis!=='undefined'?globalThis:this);
