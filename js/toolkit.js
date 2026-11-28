/* RecallHSC · the NSBHS toolkit (Exam tips, Adaptation guide, Mod C exemplars, writing booklet).
   The content is stored encrypted in js/toolkit.vault.json (made by tools/toolkit-vault.cjs), so it can't be read on
   GitHub or in the page source. Opening a toolkit section shows it blurred behind a password wall; the right password
   decrypts it here in the browser (PBKDF2-SHA256 -> AES-256-GCM, Web Crypto). The device then stays unlocked for 24 hours
   (or until the password is changed). */
(function(){
'use strict';
const KEY='essayRecall2.toolkitKey';
const TTL=24*60*60*1000; // an unlock lasts 24 hours on a device, then the password is needed again
const b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const tob64=u=>{let s='';for(let i=0;i<u.length;i++)s+=String.fromCharCode(u[i]);return btoa(s)};
let vaultP=null;
const vault=()=>vaultP||(vaultP=fetch('js/toolkit.vault.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw new Error('vault');return r.json()}).catch(e=>{vaultP=null;throw e}));
async function derive(pw,v){
  const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(String(pw).normalize('NFKC')),'PBKDF2',false,['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:b64(v.salt),iterations:v.iter},base,256));
}
async function open(raw,v){
  const k=await crypto.subtle.importKey('raw',raw,'AES-GCM',false,['decrypt']);
  const pt=await crypto.subtle.decrypt({name:'AES-GCM',iv:b64(v.iv)},k,b64(v.data));
  return JSON.parse(new TextDecoder().decode(pt));
}
async function unlock(pw){
  const v=await vault(),raw=await derive(pw,v);
  self.TOOLKIT=await open(raw,v); // throws if the password is wrong
  try{localStorage.setItem(KEY,tob64(raw)+'.'+v.salt+'.'+Date.now())}catch(_){}
  if(self.track)track('toolkit-unlock');
}
// already unlocked on this device (and the password hasn't changed since)
async function auto(){
  let s=null;try{s=localStorage.getItem(KEY)}catch(_){}
  if(!s)return;
  try{
    const [k,salt,at]=s.split('.'),v=await vault();
    if(salt!==v.salt||!(Date.now()-Number(at)<TTL)){localStorage.removeItem(KEY);return} // password changed, or 24 hours are up
    self.TOOLKIT=await open(b64(k),v);
    if(typeof SET!=='undefined'&&SET.view==='guide'&&typeof renderGuide==='function')renderGuide();
  }catch(_){try{localStorage.removeItem(KEY)}catch(e){}}
}
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function lockedHtml(){
  // stand-in "content" to blur behind the wall (no real toolkit text is in the page)
  const fake=Array.from({length:7},(_,i)=>`<section class="gsec tkfake"><h2>${'▇'.repeat(6+i%4*3)}</h2>${Array.from({length:4},(_,j)=>`<p>${'▆▅▇▆ '.repeat(10+((i+j)%5)*3)}</p>`).join('')}</section>`).join('');
  return `<div class="tklock"><div class="tkblur" aria-hidden="true">${fake}</div>
<form class="tkwall" id="tkForm" autocomplete="off" role="dialog" aria-labelledby="tkTitle">
<div class="tkicon" aria-hidden="true">🔒</div>
<h2 id="tkTitle">Warning: this is for NSBHS only!</h2>
<p>Please enter access password (ask Tim if you do not know).</p>
<label class="tkfield"><span class="sr">Access password</span><input id="tkPw" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Access password" required></label>
<p class="tkerr" id="tkErr" role="alert"></p>
<button class="btn primary" id="tkGo" type="submit">Unlock</button>
</form></div>`;
}
function bindLock(done){
  const f=document.getElementById('tkForm');if(!f)return;
  const pw=document.getElementById('tkPw'),err=document.getElementById('tkErr'),go=document.getElementById('tkGo');
  setTimeout(()=>pw&&pw.focus({preventScroll:true}),50);
  f.onsubmit=async e=>{
    e.preventDefault();if(!pw.value)return;
    go.disabled=true;go.textContent='Checking…';err.textContent='';
    try{await unlock(pw.value);done()}
    catch(ex){
      go.disabled=false;go.textContent='Unlock';
      err.textContent=String(ex&&ex.message)==='vault'?'Couldn’t load the toolkit. Check your connection and try again.':'That password isn’t right. Ask Tim if you don’t know it.';
      pw.select();
    }
  };
}
self.Toolkit={unlock,lockedHtml,bindLock,_esc:esc};
auto();
})();
