/* RecallHSC compute worker: runs the pure engine off the main thread.
   Protocol  in:  {id, op, payload}            op: 'mark' | 'live' | 'parse' | 'ping'
             out: {id, ok:true, result} | {id, ok:false, error}
   Scripts are same-origin and relative to this file, so it works under /recallhsc/ and locally. */
'use strict';
importScripts('../engine/text.js','../engine/chunker.js','../engine/parser.js','../engine/marking.js','../engine/policies.js');
const E=self.RecallEngine;
const OPS={
  mark:p=>E.markAttempt(p),
  live:p=>E.liveAccuracy(p),
  parse:p=>E.parseEssay(p.text,p.kind),
  ping:()=>'pong',
};
self.onmessage=e=>{
  const {id,op,payload}=e.data||{};
  const fn=OPS[op];
  if(!fn){self.postMessage({id,ok:false,error:'unknown op: '+op});return}
  try{self.postMessage({id,ok:true,result:fn(payload)})}
  catch(err){self.postMessage({id,ok:false,error:String(err&&err.message||err)})}
};
