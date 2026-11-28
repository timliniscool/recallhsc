/* RecallHSC · invite iPad users to try the handwriting beta (/recallhsc/beta/).
   A popup at the bottom, like the update bar. iPad only (not other tablets), once per device until dismissed. */
(function(){
'use strict';
if(/\/beta(\/|$)/.test(location.pathname))return; // the beta has its own
const UA=navigator.userAgent||'';
// iPadOS browsers (Safari, Chrome, Edge…) usually present as a Mac; a Mac with touch is an iPad (real Macs report none)
const IPAD=/iPad/.test(UA)||navigator.platform==='iPad'||(/Macintosh|Mac OS X/.test(UA)&&(navigator.maxTouchPoints>0||'ontouchend' in document));
if(!IPAD)return;
const KEY='essayRecall2.betaInvite';
try{if(localStorage.getItem(KEY)==='no')return}catch(_){}
const el=document.createElement('div');
el.className='betainvite';el.id='betaInvite';el.setAttribute('role','dialog');el.setAttribute('aria-label','Try handwriting with Apple Pencil');
el.innerHTML='<span class="bi-ic" aria-hidden="true">✍</span><span class="bi-t"><b>New on iPad: write it by hand <span class="bi-tag">BETA</span></b>'+
  '<small>Practise your recall with Apple Pencil on a full-screen sheet, like the exam. Your essays come with you.</small></span>'+
  '<a class="btn small primary" id="biTry" href="beta/">Try it</a><button class="btn small" id="biNo" type="button">Not now</button>';
const show=()=>{document.body.appendChild(el);
  document.getElementById('biNo').onclick=()=>{try{localStorage.setItem(KEY,'no')}catch(_){}el.remove()};
  document.getElementById('biTry').onclick=()=>{if(self.track)track('beta-invite')};};
// after the first-visit intro, so it never covers it
setTimeout(show,1500);
})();
