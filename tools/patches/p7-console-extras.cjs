/* Game mode on phones: Undo / Type instead and the toolbar sit below the console, outside it. Applied once. */
'use strict';
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..','..');
const edit=(rel,fn)=>{const f=path.join(root,rel);fs.writeFileSync(f,fn(fs.readFileSync(f,'utf8')))};
const R=(s,a,b)=>{const n=s.split(a).length-1;if(n!==1)throw new Error(n+' matches in '+a.slice(0,80));return s.replace(a,()=>b)};
edit('index.html',s=>{
  s=R(s,`<div class="hud" id="hud"></div>`,`<div class="gbextras" id="gbExtras"></div>\n<div class="hud" id="hud"></div>`);
  s=R(s,`<div class="ch-tools">`,`<div class="ch-tools" id="chTools">`);
  s=R(s,`/* in-app confirmation */`,`/* controls moved below the console (game mode on phones) */
.gbextras{display:none}
@media(max-width:640px){
  body.gamify .gbextras{display:flex;flex-direction:column;align-items:stretch;gap:10px;margin:14px 2px 0}
  body.gamify .gbextras .ch-tools{margin:0;display:flex;gap:10px}
  body.gamify .gbextras .ch-tools .spacer{display:none}
  body.gamify .gbextras .ch-tools .btn{flex:1;justify-content:center;min-height:44px}
  body.gamify .gbextras .tools{display:flex!important;justify-content:space-around;width:100%}
  body.gamify .gbextras .tools .tb{flex:1}
  body.gamify .gbextras:empty{display:none}
}
/* in-app confirmation */`);
  return s;
});
edit('js/app.js',s=>R(s,`/* askConfirm(message,{title,ok,cancel,danger})`,`/* Game mode on phones: move Undo / Type instead and the toolbar out of the console into #gbExtras below it,
   and put them back for every other layout. Same elements, so all their handlers keep working. */
const consoleSlots=[['chTools'],['tools']].map(([id])=>{const el=$(id);return{el,parent:el.parentNode,next:el.nextSibling}});
function placeConsoleExtras(){
  const out=document.body.classList.contains('gamify')&&matchMedia('(max-width:640px)').matches;
  for(const sl of consoleSlots){
    if(out){if(sl.el.parentNode!==$('gbExtras'))$('gbExtras').appendChild(sl.el)}
    else if(sl.el.parentNode!==sl.parent)sl.parent.insertBefore(sl.el,sl.next&&sl.next.parentNode===sl.parent?sl.next:null);
  }
  // in this layout the tap-to-pick tools show only while the choices do
  if(out)sl0Visible();
}
function sl0Visible(){const c=$('chTools');c.hidden=$('choices').hidden}
new MutationObserver(()=>{if(document.body.classList.contains('gamify')&&$('chTools').parentNode===$('gbExtras'))sl0Visible()}).observe($('choices'),{attributes:true,attributeFilter:['hidden']});
new MutationObserver(placeConsoleExtras).observe(document.body,{attributes:true,attributeFilter:['class']});
matchMedia('(max-width:640px)').addEventListener('change',placeConsoleExtras);
/* askConfirm(message,{title,ok,cancel,danger})`));
console.log('p7 applied');
