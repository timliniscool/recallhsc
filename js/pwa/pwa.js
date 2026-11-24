/* RecallHSC as an installable, offline app: service worker registration, install button, update flow.
   Updates never reload by themselves. When a new version has downloaded, a small bar offers "Update";
   pressing it saves progress (and an answer in progress), switches to the new version, and reloads once.
   Depends on app globals (save, toast, announce, phase, typed, task, S, ACTIVE) only at the moment of use. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const standalone=()=>matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: minimal-ui)').matches||navigator.standalone===true;
let deferred=null,waiting=null,reg=null;
const ua=navigator.userAgent;
const isIOS=/iPhone|iPad|iPod/.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1);
const isSafariMac=/Macintosh/.test(ua)&&/Safari\//.test(ua)&&!/Chrome|Chromium|Edg\//.test(ua)&&navigator.maxTouchPoints<2;
const isFirefox=/Firefox\//.test(ua);
// how to install where the browser has no install prompt (accurate per platform; not every browser can)
function installHelp(){
  if(isIOS)return'On iPhone or iPad: tap Share, then “Add to Home Screen”.';
  if(isSafariMac)return'In Safari on Mac: File → Add to Dock (macOS Sonoma or later).';
  if(isFirefox)return/Android/.test(ua)?'In Firefox on Android: menu (⋮) → Install.':'Firefox on desktop can’t install web apps. Chrome, Edge or Safari can.';
  return'Use your browser’s menu: look for “Install RecallHSC” or “Add to Home screen”.';
}
function refreshUI(){
  const btn=$('btnInstall'),txt=$('installTxt'),help=$('installHelp'),off=$('offlineNote');
  if(!btn)return;
  if(standalone()){txt.textContent='RecallHSC is installed and open as an app.';btn.hidden=true;help.hidden=true}
  else if(deferred){txt.textContent='Install RecallHSC to open it like an app, even offline.';btn.hidden=false;btn.textContent='Install';help.hidden=true}
  else{txt.textContent='Install RecallHSC to open it like an app, even offline.';btn.hidden=true;help.hidden=false;help.textContent=installHelp()}
  const sw='serviceWorker' in navigator;
  off.textContent=!sw?'This browser can’t keep RecallHSC for offline use.':navigator.serviceWorker.controller?(navigator.onLine?'Saved for offline use. ':'You’re offline. Everything you need is saved on this device. ')+'Your essays and progress are always kept in this browser.':'Getting ready for offline use… (open it once more if this doesn’t change)';
  const mi=$('mInstall');if(mi)mi.hidden=standalone()||(!deferred&&!isIOS);
}
addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;refreshUI()});
addEventListener('appinstalled',()=>{deferred=null;refreshUI();if(self.toast)toast('RecallHSC installed')});
addEventListener('online',refreshUI);addEventListener('offline',refreshUI);
async function install(){
  if(!deferred){refreshUI();const h=$('installHelp');if(h){h.hidden=false;h.focus&&h.focus()}return}
  deferred.prompt();
  try{await deferred.userChoice}catch(_){}
  deferred=null;refreshUI();
}
/* ---------- updates ---------- */
function showUpdate(w){
  waiting=w;
  let bar=$('updBar');
  if(!bar){
    bar=document.createElement('div');bar.id='updBar';bar.className='updbar';bar.setAttribute('role','status');
    bar.innerHTML='<span>An update to RecallHSC is available.</span><button class="btn small primary" id="updGo">Update</button><button class="btn small" id="updLater">Later</button>';
    document.body.appendChild(bar);
    $('updGo').onclick=applyUpdate;$('updLater').onclick=()=>{bar.hidden=true};
  }
  bar.hidden=false;
  if(self.announce)announce('An update to RecallHSC is available. Use the Update button when you’re ready.');
}
const STASH='essayRecall2.updateStash';
function applyUpdate(){
  if(!waiting)return;
  try{
    // keep an answer in progress so it can be put back after the reload
    if(typeof phase!=='undefined'&&phase==='type'&&typeof typed==='string'&&typed.trim()&&task)
      sessionStorage.setItem(STASH,JSON.stringify({essay:ACTIVE,g:S.g,ti:S.ti,typed,at:Date.now()}));
    if(typeof save==='function')save();
  }catch(_){}
  let reloaded=false;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!reloaded){reloaded=true;location.reload()}});
  waiting.postMessage({type:'SKIP_WAITING'});
}
// after an update reload: restore the answer that was being typed (same essay and task only, within 10 minutes)
function restoreStash(){
  try{
    const st=JSON.parse(sessionStorage.getItem(STASH)||'null');sessionStorage.removeItem(STASH);
    if(!st||Date.now()-st.at>600000||st.essay!==ACTIVE||st.g!==S.g||st.ti!==S.ti||typeof st.typed!=='string'||phase!=='type')return;
    const ta=$('ta');ta.value=st.typed;ta.dispatchEvent(new Event('input'));if(self.toast)toast('Updated. Your answer is still here.');
  }catch(_){}
}
async function register(){
  if(!('serviceWorker' in navigator)||!/^https?:$/.test(location.protocol))return;
  // development: ?nosw turns the service worker off for this tab session (and removes it) so edits show immediately
  if(/[?&]nosw/.test(location.search))sessionStorage.setItem('essayRecall2.nosw','1');
  if(sessionStorage.getItem('essayRecall2.nosw')){for(const r of await navigator.serviceWorker.getRegistrations())await r.unregister();for(const k of await caches.keys())if(k.startsWith('recallhsc-'))await caches.delete(k);return}
  try{
    reg=await navigator.serviceWorker.register('sw.js',{scope:'./'});
    if(reg.waiting&&navigator.serviceWorker.controller)showUpdate(reg.waiting);
    reg.addEventListener('updatefound',()=>{
      const w=reg.installing;if(!w)return;
      w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)showUpdate(w);if(w.state==='activated')refreshUI()});
    });
    // look for a new version now and then (and when the app comes back to the foreground)
    setInterval(()=>reg.update().catch(()=>{}),60*60*1000);
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')reg.update().catch(()=>{})});
    navigator.serviceWorker.ready.then(refreshUI);
  }catch(e){console.warn('service worker registration failed',e)}
}
self.RecallPWA={refreshUI,install,standalone};
document.addEventListener('DOMContentLoaded',()=>{});
const b=$('btnInstall');if(b)b.onclick=install;
refreshUI();restoreStash();
if(document.readyState==='complete')register();else addEventListener('load',register);
})();
