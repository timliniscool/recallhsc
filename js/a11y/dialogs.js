/* Accessible modal dialogs for every .modal in the page, without touching each window's own open/close code.
   - Gives each window role="dialog", aria-modal and an accessible name (its heading).
   - When a window opens (its [hidden] attribute is removed): the rest of the page becomes inert, focus moves
     into the window (an [autofocus] element, else the first field/button), and Tab / Shift+Tab stay inside.
   - When it closes: inert is lifted and focus returns to whatever opened it.
   Escape is handled by each window's existing code (so destructive actions keep their own confirmations). */
(function(){
'use strict';
const FOCUSABLE='a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const stack=[];
const visible=el=>!!(el.offsetWidth||el.offsetHeight||el.getClientRects().length);
function label(modal,i){
  const sheet=modal.querySelector('.sheet')||modal;
  sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');
  const h=sheet.querySelector('h2,h3');
  if(h){if(!h.id)h.id='dlg-title-'+(modal.id||i);sheet.setAttribute('aria-labelledby',h.id)}
  if(!sheet.hasAttribute('tabindex'))sheet.setAttribute('tabindex','-1');
}
function background(on){
  // everything that isn't an open modal (or the live regions) is made inert while a dialog is open
  for(const el of document.body.children){
    if(el.classList.contains('modal')||el.id==='sr'||el.id==='srAlert'||el.tagName==='SCRIPT')continue;
    if(on){if(!el.inert){el.inert=true;el.dataset.dlgInert='1'}}
    else if(el.dataset.dlgInert){el.inert=false;delete el.dataset.dlgInert}
  }
}
function open(modal){
  if(stack.some(e=>e.modal===modal))return;
  stack.push({modal,opener:document.activeElement});
  background(true);
  stack.forEach(e=>{e.modal.inert=e.modal!==modal});
  requestAnimationFrame(()=>{
    if(modal.hidden||modal.contains(document.activeElement))return;
    const sheet=modal.querySelector('.sheet')||modal;
    const target=sheet.querySelector('[autofocus]')||[...sheet.querySelectorAll(FOCUSABLE)].find(visible)||sheet;
    target.focus({preventScroll:true});
  });
}
function close(modal){
  const i=stack.findIndex(e=>e.modal===modal);if(i<0)return;
  const [{opener}]=stack.splice(i,1);
  if(stack.length){const top=stack[stack.length-1].modal;top.inert=false}else background(false);
  // restore focus unless the closing action already moved it somewhere meaningful (e.g. into another dialog)
  if(opener&&document.contains(opener)&&visible(opener)&&(!document.activeElement||document.activeElement===document.body||modal.contains(document.activeElement)))
    opener.focus({preventScroll:true});
}
document.addEventListener('keydown',e=>{
  if(e.key!=='Tab'||!stack.length)return;
  const modal=stack[stack.length-1].modal,sheet=modal.querySelector('.sheet')||modal;
  const f=[...sheet.querySelectorAll(FOCUSABLE)].filter(visible);if(!f.length){e.preventDefault();sheet.focus();return}
  const first=f[0],last=f[f.length-1];
  if(!sheet.contains(document.activeElement)){e.preventDefault();first.focus();return}
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
},true);
function init(){
  const modals=[...document.querySelectorAll('.modal')];
  modals.forEach(label);
  const mo=new MutationObserver(list=>{for(const m of list){const el=m.target;if(el.hidden)close(el);else open(el)}});
  modals.forEach(el=>{mo.observe(el,{attributes:true,attributeFilter:['hidden']});if(!el.hidden)open(el)});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
self.RecallDialogs={openCount:()=>stack.length};
})();
