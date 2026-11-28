/* The service worker's cache clean-up: main (/recallhsc/) and beta (/recallhsc/beta/) share one origin, so each site
   must only delete its own old shell caches (and the unscoped names used before), never the other site's. */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),vm=require('vm');
const SRC=fs.readFileSync(path.join(__dirname,'..','..','sw.js'),'utf8');

// run sw.js against a stub service-worker global; returns its handlers and the shell cache name it uses
function boot(scope,existing){
  const handlers={},deleted=[],opened=[];
  const caches={keys:async()=>existing.slice(),delete:async k=>{deleted.push(k);return true},open:async k=>{opened.push(k);return{addAll:async()=>{},match:async()=>null,put:async()=>{}}}};
  const self={registration:{scope},addEventListener:(t,f)=>{handlers[t]=f},clients:{claim:async()=>{}},skipWaiting(){}};
  vm.runInNewContext(SRC,{self,caches,URL,Request:function(u){this.url=u},fetch:async()=>{throw new Error('offline')},Response:function(){},console});
  return{handlers,deleted,opened};
}
async function activate(scope,existing){
  const sw=boot(scope,existing);let p;
  sw.handlers.activate({waitUntil:x=>{p=x}});await p;return sw.deleted;
}
async function shellName(scope){
  const sw=boot(scope,[]);let p;sw.handlers.install({waitUntil:x=>{p=x}});await p;return sw.opened[0];
}

test('main and beta name their shell caches after their own site',async()=>{
  const m=await shellName('https://timliniscool.github.io/recallhsc/'),b=await shellName('https://timliniscool.github.io/recallhsc/beta/');
  assert.match(m,/^recallhsc-shell-recallhsc@/);
  assert.match(b,/^recallhsc-shell-recallhsc-beta@/);
  assert.notEqual(m.split('@')[0],b.split('@')[0]);
});

test("activating one site never deletes the other site's shell",async()=>{
  const main='https://timliniscool.github.io/recallhsc/',beta='https://timliniscool.github.io/recallhsc/beta/';
  const others=['recallhsc-shell-recallhsc-beta@2.0.0-aaaaaaaaaaaa','recallhsc-shell-recallhsc@2.0.0-bbbbbbbbbbbb','recallhsc-fonts-v1','some-other-cache'];
  const byMain=await activate(main,others),byBeta=await activate(beta,others);
  assert.ok(!byMain.includes('recallhsc-shell-recallhsc-beta@2.0.0-aaaaaaaaaaaa'),'main deleted beta');
  assert.ok(byMain.includes('recallhsc-shell-recallhsc@2.0.0-bbbbbbbbbbbb'),'main keeps its own old shell');
  assert.ok(!byBeta.includes('recallhsc-shell-recallhsc@2.0.0-bbbbbbbbbbbb'),'beta deleted main');
  assert.ok(byBeta.includes('recallhsc-shell-recallhsc-beta@2.0.0-aaaaaaaaaaaa'),'beta keeps its own old shell');
  for(const d of [byMain,byBeta]){assert.ok(!d.includes('recallhsc-fonts-v1'));assert.ok(!d.includes('some-other-cache'))}
});

test('the unscoped shell names used before are cleaned up',async()=>{
  const d=await activate('https://timliniscool.github.io/recallhsc/',['recallhsc-shell-2.0.0-cccccccccccc']);
  assert.deepEqual(d,['recallhsc-shell-2.0.0-cccccccccccc']);
});
