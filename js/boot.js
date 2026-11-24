/* RecallHSC start-up: views, first paint */
/* ---------- views ---------- */
function setView(v){
SET.view=v;saveSettings();
document.body.classList.toggle('guide',v==='guide');
document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t.dataset.view===v));
if(v==='guide')renderGuide();else{requestAnimationFrame(()=>{placeCaret();drawSpark()});focusTa()}
}
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>setView(t.dataset.view));

if(document.fonts)document.fonts.ready.then(()=>placeCaret());
window.addEventListener('resize',()=>placeCaret());
function showHowto(){$('howto').hidden=false;setTimeout(()=>$('bHowto').focus(),50)}
$('bHowto').onclick=()=>{const first=!ls.get('seen');$('howto').hidden=true;ls.set('seen',1);if(first&&!LIB.length&&SET.view==='mem')openOnboardUpload();else if(!S.started&&SET.view==='mem')openModal();else focusTa()};
$('btnHelp').onclick=showHowto;
$('howto').addEventListener('keydown',e=>{if(e.key==='Escape'||e.key==='Enter'){e.preventDefault();$('bHowto').click()}});

bindSettings();
loadEssay(ACTIVE);
renderSwitcher();
applyPanels();
applyChoice();
loadTask();
setView(SET.view);
if(!ls.get('seen'))showHowto();
else if(!S.started&&!hasProgress()&&SET.view==='mem')openModal();
else if(!S.started&&hasProgress()){S.started=true;save()}
