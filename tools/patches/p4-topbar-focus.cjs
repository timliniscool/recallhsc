/* Compact top bar, ? beside the tabs, iOS-Focus-style tile, and Enter/Space on focused buttons. Applied once. */
'use strict';
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..','..');
const edit=(rel,fn)=>{const f=path.join(root,rel);fs.writeFileSync(f,fn(fs.readFileSync(f,'utf8')))};
const R=(s,a,b)=>{const n=s.split(a).length-1;if(n!==1)throw new Error(n+' matches: '+a.slice(0,90));return s.replace(a,()=>b)};
const moon='<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1z"/></svg>';

edit('index.html',s=>{
  // ? sits right after the tabs; Essays / Choose start leave the bar (both live in the essay menu)
  s=R(s,`<button class="tab" data-view="guide">Rubric guide</button></div>`,`<button class="tab" data-view="guide">Rubric guide</button></div>\n<button class="btn ibtn" id="btnHelp" aria-label="How it works" title="How it works">?</button>`);
  s=R(s,`<button class="btn" id="btnHelp" title="How it works">?</button>\n`,``);
  s=R(s,`<button class="btn" id="btnEssay" title="Manage essays">Essays</button>\n`,``);
  s=R(s,`<button class="btn" id="btnStart">Choose start</button>\n`,``);
  // essay picker + attached upload
  s=R(s,`<div class="menu" id="essMenu">`,`<div class="essgroup"><div class="menu" id="essMenu">`);
  s=R(s,`<button class="btn primary" id="btnUpload" aria-label="Upload essay">+<span class="lbl"> Upload essay</span></button>`,
    `<button class="btn primary ibtn" id="btnUpload" aria-label="Upload essay" title="Upload essay">+</button></div>`);
  s=R(s,`<span class="lbl">Panels ▾</span></button>`,`</button>`);
  s=R(s,`<button class="btn" id="btnPanels" aria-label="Panels and modes"><svg class="ico-m"`,`<button class="btn ibtn" id="btnPanels" aria-label="Panels and modes" title="Panels and modes" aria-haspopup="true"><svg class="ico-p"`);
  s=R(s,`<button class="btn" id="btnSettings" aria-label="Settings" title="Settings">`,`<button class="btn ibtn" id="btnSettings" aria-label="Settings" title="Settings">`);
  // styles: compact bar
  s=R(s,`/* ---------- footer + focus ---------- */`,`/* ---------- compact top bar ---------- */
.top .ibtn{width:36px;height:36px;padding:0;display:inline-grid;place-items:center;font-size:15px;font-weight:600;flex:none}
#btnHelp{margin-left:-6px;width:32px;height:32px;border-radius:50%;font-size:14px}
.essgroup{display:inline-flex;align-items:stretch}
.essgroup .esel{border-top-right-radius:0;border-bottom-right-radius:0;height:36px}
.essgroup #btnUpload{border-top-left-radius:0;border-bottom-left-radius:0;margin-left:-1px;font-size:19px;line-height:1}
.top .mem-only:last-of-type{display:flex;align-items:center;gap:8px}
body.gamify .essgroup .esel,body.gamify .essgroup #btnUpload{border-radius:0}
body.gamify #btnHelp{border-radius:0;width:30px;height:30px}
body.gamify .top .ibtn{font-size:11px}
@media(max-width:640px){
  #btnHelp{order:3;width:32px;height:32px;margin-left:0}
  #btnSettings{display:none}
  .essgroup{order:10;flex:1 1 100%;min-width:0}
  .essgroup #essMenu{flex:1;min-width:0}
  .essgroup .esel{width:100%;height:38px}
  .essgroup #btnUpload{width:42px;height:38px}
  .top>.mem-only:last-of-type{display:contents}
}
/* ---------- Focus tile (like the iPhone Focus / Do Not Disturb control) ---------- */
.focustile{display:flex;align-items:center;gap:12px;width:100%;margin:2px 0 6px;padding:10px 12px;border:0;border-radius:18px;background:var(--track);color:var(--ink);text-align:left;cursor:pointer;transition:background .2s,color .2s}
.focustile .fi{flex:none;width:36px;height:36px;border-radius:50%;display:grid;place-items:center;background:rgba(15,23,42,.1);color:var(--ink2);transition:background .2s,color .2s}
.focustile .ft{display:flex;flex-direction:column;line-height:1.25}
.focustile b{font-size:14.5px;font-weight:600}
.focustile small{font-size:12px;color:var(--muted)}
.focustile:hover{filter:brightness(.97)}
.focustile[aria-pressed="true"]{background:#5e5ce6;color:#fff}
.focustile[aria-pressed="true"] .fi{background:#fff;color:#5e5ce6}
.focustile[aria-pressed="true"] small{color:#e4e4ff}
body.gamify .focustile{border-radius:0;border:2px solid #2f3b4a;background:#121820;color:#e2e8f0;font-family:var(--px)}
body.gamify .focustile b{font-size:9px}body.gamify .focustile small{font-size:7px;color:#94a3b8}
body.gamify .focustile .fi{border-radius:0;background:#1e2833;color:#cbd5e1}
body.gamify .focustile[aria-pressed="true"]{background:#7c3aed;border-color:#c4b5fd;color:#fff}
body.gamify .focustile[aria-pressed="true"] .fi{background:#ede9fe;color:#7c3aed}
/* ---------- footer + focus ---------- */`);
  // old rules that referenced removed buttons / labels
  s=s.replace(`#btnEssay,#btnStart,#btnFocus,#btnHelp{display:none!important}`,`#btnFocus{display:none!important}`);
  s=s.replace(`#btnPanels .lbl,#btnUpload .lbl{display:none}`,``);
  s=s.replace(`#btnUpload{order:11;width:40px;height:38px;padding:0;font-size:20px;font-weight:600;line-height:1;display:grid;place-items:center}`,``);
  s=s.replace(`#essMenu{order:10;flex:1 1 calc(100% - 56px);min-width:0}`,``);
  s=s.replace(`body.guide #essMenu,body.guide #btnUpload{display:none}`,`body.guide .essgroup{display:none}`);
  return s;
});

edit('js/app.js',s=>{
  s=R(s,"$('btnStart').onclick=openModal;","");
  s=R(s,"$('btnEssay').onclick=()=>openEssay();","");
  // essay menu actions now include Choose start
  s=R(s,"<button class=\"btn small\" data-act=\"manage\">Manage</button></div>`;","<button class=\"btn small\" data-act=\"manage\">Manage</button><button class=\"btn small\" data-act=\"start\">Choose start</button></div>`;");
  s=s.replace(/if\(b\.dataset\.sw\)switchEssay\(b\.dataset\.sw\);else if\(b\.dataset\.act==='up'\)openUpload\(\);else openEssay\(\);/,"if(b.dataset.sw)switchEssay(b.dataset.sw);else if(b.dataset.act==='up')openUpload();else if(b.dataset.act==='start')openModal();else openEssay();");
  // Focus tile
  s=R(s,"$('panelMenu').innerHTML=`<button class=\"mitem focusbtn\" id=\"mFocusBtn\" aria-pressed=\"${!!SET.focus}\">${SET.focus?'Exit focus mode':'Focus mode'} <small>hide every panel</small></button><hr><div class=\"ehead\">Panels</div>`+",
    "$('panelMenu').innerHTML=`<button class=\"focustile\" id=\"mFocusBtn\" aria-pressed=\"${!!SET.focus}\"><span class=\"fi\">"+moon.replace(/"/g,'\\"')+"</span><span class=\"ft\"><b>Focus</b><small>${SET.focus?'On · panels hidden':'Off'}</small></span></button><div class=\"ehead\">Panels</div>`+");
  // Enter / Space on a focused button or field does its normal job (the study shortcuts only apply in the answer box / page)
  s=R(s,"// shortcuts use e.code so they still work when Option/Alt or a non-US layout changes e.key","if((e.key==='Enter'||e.key===' ')&&e.target!==ta&&e.target.closest&&e.target.closest('button,a[href],input,select,textarea,summary,[role=button],[role=radio]'))return;\n// shortcuts use e.code so they still work when Option/Alt or a non-US layout changes e.key");
  return s;
});
console.log('p4 applied');
