/* Settings window (replaces the side panel), Focus inside the Panels menu, marking-mode picker,
   accessibility preferences, dialog semantics + focus management, live announcements. Applied once. */
'use strict';
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..','..');
const edit=(rel,fn)=>{const f=path.join(root,rel);fs.writeFileSync(f,fn(fs.readFileSync(f,'utf8')))};
const R=(s,a,b)=>{const n=s.split(a).length-1;if(n!==1)throw new Error(n+' matches: '+a.slice(0,90));return s.replace(a,()=>b)};
const gear='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';

edit('index.html',s=>{
  // pull the old settings panel out of the side column
  const a=s.indexOf('<section class="panel" data-panel="settings" data-name="Settings">'),b=s.indexOf('</section>',a)+'</section>'.length;
  if(a<0)throw new Error('settings panel not found');
  const old=s.slice(a,b);s=s.slice(0,a)+s.slice(b);
  const grab=re=>{const m=old.match(re);if(!m)throw new Error('missing in panel: '+re);return m[0]};
  const rows=[/<div class="set"><span>Clear delay[\s\S]*?<\/div>/,/<div class="set"><span>Pass mark[\s\S]*?<\/div>/,/<div class="set"><span>Max chunk[\s\S]*?<\/div>/,
    /<label class="set"><span>Essay checkpoints[\s\S]*?<\/label>/,/<label class="set"><span>Hide the prompt[\s\S]*?<\/label>/,/<label class="set" title="Tap words[\s\S]*?<\/label>/,
    /<label class="set"><span>Background motion[\s\S]*?<\/label>/].map(grab);
  const modes=[['standard','Standard','spelling tolerant · default','Allows small spelling slips. Best for smooth memorising.'],
    ['exact','Exact words','','Every word must be spelled right. Capitals and punctuation still don’t matter.'],
    ['quotes','Strict quotes','','Quotes must be word-perfect, and every quoted word must be right to pass (on top of the pass mark). Everything else is marked like Standard.'],
    ['verbatim','Verbatim','','Wording, capitals and punctuation all count, and extra words always cost marks. Curly vs straight quotes and dash types don’t matter.']];
  const modal=`<div class="modal" id="setModal" hidden>
<div class="sheet setsheet">
<div class="sheet-head"><h2 id="setTitle">Settings</h2><span class="spacer"></span><button class="xbtn" id="setX" aria-label="Close settings"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button></div>
<section class="sgroup" aria-labelledby="sgStudy"><h3 id="sgStudy">Study</h3>
${rows.slice(0,6).join('\n')}
</section>
<section class="sgroup" aria-labelledby="sgMark"><h3 id="sgMark">Marking</h3>
<fieldset class="modes" id="sMode"><legend class="sr-only">Marking mode</legend>
${modes.map(([v,l,tag,d])=>`<label class="mode"><input type="radio" name="mode" value="${v}"><span class="mt"><b>${l}</b>${tag?` <em>${tag}</em>`:''}</span><span class="md">${d}</span></label>`).join('\n')}
</fieldset>
<p class="snote" id="modeNote" aria-live="polite"></p>
</section>
<section class="sgroup" aria-labelledby="sgA11y"><h3 id="sgA11y">Accessibility &amp; display</h3>
<div class="set stack"><span id="lblReduce">Reduce motion</span><div class="seg seg3" id="sReduce" role="radiogroup" aria-labelledby="lblReduce"><button data-v="auto" role="radio">Match device</button><button data-v="on" role="radio">On</button><button data-v="off" role="radio">Off</button></div></div>
${rows[6]}
<label class="set"><span>High contrast</span><input type="checkbox" class="sw" id="sHc"></label>
<label class="set"><span>Standard text box <small>(plain typing box; best with screen readers)</small></span><input type="checkbox" class="sw" id="sPlain"></label>
<div class="set"><span>Text size</span><span class="rng"><input type="range" id="sFs" min="0.9" max="1.4" step="0.05" aria-label="Text size"><output id="oFs"></output></span></div>
<label class="set"><span>Keyboard shortcuts <small>(⌃H, ⌃P, ⌃O, ⌃Z, ⌃/, 1–3, Alt+number)</small></span><input type="checkbox" class="sw" id="sKeys"></label>
</section>
<section class="sgroup" aria-labelledby="sgApp" id="appGroup"><h3 id="sgApp">App</h3>
<div class="set"><span id="installTxt">Install RecallHSC to open it like an app, even offline.</span><button class="btn small" id="btnInstall">Install</button></div>
<p class="snote" id="installHelp" hidden></p>
<p class="snote" id="offlineNote"></p>
</section>
<section class="sgroup" aria-labelledby="sgSync" id="syncGroup"><h3 id="sgSync">Cloud sync <small>(optional)</small></h3>
<div id="syncBox"><p class="snote">Everything is saved in this browser. Cloud sync isn’t set up on this copy of RecallHSC, so nothing leaves your device.</p></div>
</section>
<section class="sgroup" aria-labelledby="sgProg"><h3 id="sgProg">Progress</h3>
<div class="set"><span>Start this essay again from scratch</span><button class="btn small danger" id="btnReset">Reset progress</button></div>
</section>
</div>
</div>
`;
  s=R(s,`<div class="modal" id="modal" hidden>`,modal+`<div class="modal" id="modal" hidden>`);
  // top bar: Settings replaces Focus (Focus now lives in the Panels menu)
  s=R(s,`<button class="btn" id="btnFocus" title="Hide every panel">Focus</button>`,`<button class="btn" id="btnSettings" aria-label="Settings" title="Settings">${gear}</button>`);
  s=R(s,`<button class="mitem" data-more="help">How it works</button>`,`<button class="mitem" data-more="settings">Settings</button>\n<button class="mitem" data-more="help">How it works</button>`);
  // screen-reader plumbing
  s=R(s,`<canvas id="bg"></canvas>`,`<canvas id="bg" aria-hidden="true"></canvas>\n<div id="sr" class="sr-only" aria-live="polite" aria-atomic="true"></div><div id="srAlert" class="sr-only" role="alert"></div>`);
  s=R(s,`<canvas id="spark"></canvas>`,`<canvas id="spark" aria-hidden="true"></canvas>`);
  s=s.replace(/<span id="typed"><\/span><span id="mark">&#8203;<\/span><div id="caret"><\/div>/,'<span id="typed" aria-hidden="true"></span><span id="mark" aria-hidden="true">&#8203;</span><div id="caret" aria-hidden="true"></div>');
  s=R(s,`<textarea id="ta" name="recall-notes"`,`<textarea id="ta" name="recall-notes" aria-label="Your answer" aria-describedby="prompt"`);
  s=s.replace('<canvas id="petCv"','<canvas id="petCv" aria-hidden="true"');
  // styles
  s=R(s,`/* ---------- footer + focus ---------- */`,`/* ---------- accessibility + settings window ---------- */
.sr-only{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}
.setsheet{max-width:600px}
.sgroup{padding:14px 0 6px;border-top:1px solid var(--line2);margin-top:10px}
.sgroup:first-of-type{border-top:0;margin-top:4px}
.sgroup h3{margin:0 0 6px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.sgroup h3 small{text-transform:none;letter-spacing:0;font-weight:500}
.sgroup .set small{display:block;color:var(--muted);font-size:11.5px;font-weight:400}
.snote{margin:6px 0 0;font-size:12.5px;line-height:1.5;color:var(--muted)}
.modes{border:0;margin:0;padding:0;display:grid;gap:8px}
.mode{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;align-items:start;padding:10px 12px;border:1px solid var(--line2);border-radius:12px;cursor:pointer}
.mode:has(input:checked){border-color:var(--sky2);background:var(--tint)}
.mode input{margin:3px 0 0;accent-color:var(--sky);grid-row:span 2}
.mode .mt{font-size:14px}.mode .mt em{font-style:normal;font-size:11.5px;color:var(--muted)}
.mode .md{font-size:12.5px;color:var(--muted);line-height:1.45}
.seg3{grid-template-columns:repeat(3,1fr)}
.modebadge{font-size:11px;font-weight:600;padding:3px 8px;border-radius:99px;background:var(--amber);color:#713f12}
.modebadge:empty{display:none}
.diff .w.qerr{outline:2px dashed #dc2626;outline-offset:1px;font-weight:600}
.lg-q{display:inline-block;width:14px;height:10px;border:2px dashed #dc2626;border-radius:2px;margin-right:4px;vertical-align:middle}
.diff .w.del{text-decoration:underline dotted 2px}
.typebox.marking{opacity:.75}
body.gamify .sgroup{border-color:#1e2833}
body.gamify .mode{border-radius:0;border:2px solid #2f3b4a}
body.gamify .mode:has(input:checked){border-color:#a3e635;background:rgba(163,230,53,.1)}
body.gamify .modebadge{border-radius:0;font-family:var(--px);font-size:7px;background:#a3e635;color:#0b1324}
/* text size: scales the study card and its read-outs */
.center{zoom:var(--fs,1)}
/* standard text box mode: the real textarea is shown and the styled overlay is hidden */
body.plain #ta{position:static;width:100%;height:auto;min-height:120px;opacity:1;padding:12px 14px;border:1.5px solid var(--line2);border-radius:14px;font:inherit;font-family:var(--serif);font-size:19px;line-height:1.6;background:var(--surface);color:var(--ink);resize:vertical}
body.plain #ta:focus{outline:2px solid var(--sky2);outline-offset:2px}
body.plain #typebox{display:none}
/* reduced motion: no transitions or animations anywhere */
body.reduce *,body.reduce *::before,body.reduce *::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}
/* high contrast: darker text and borders, solid focus */
body.hc{--muted:#334155;--faint:#475569;--line2:#64748b;--ink2:#0f172a}
body.hc .nextc{opacity:.45!important}
body.hc :focus-visible{outline:3px solid #0b1324!important;outline-offset:2px}
body.hc.gamify{--muted:#cbd5e1;--faint:#cbd5e1;--line2:#94a3b8}
body.hc.gamify :focus-visible{outline-color:#d9f99d!important}
/* touch: comfortable 44px targets */
@media(pointer:coarse){.btn,.tb,.mitem,.eitem,.q,.xbtn,.sopt,.sbig,.mode{min-height:44px}.tb{min-width:44px}}
/* ---------- footer + focus ---------- */`);
  return s;
});

edit('js/app.js',s=>{
  // Focus as a button inside the Panels menu
  s=R(s,"$('btnFocus').classList.toggle('on',!!SET.focus);\n","");
  s=R(s,"$('panelMenu').innerHTML=`<div class=\"ehead\">Panels</div>`+","$('panelMenu').innerHTML=`<button class=\"mitem focusbtn\" id=\"mFocusBtn\" aria-pressed=\"${!!SET.focus}\">${SET.focus?'Exit focus mode':'Focus mode'} <small>hide every panel</small></button><hr><div class=\"ehead\">Panels</div>`+");
  s=R(s,"T('id=\"mGame\"',SET.gamify,'Gamify (retro platformer)')+T('id=\"mFocus\"',SET.focus,'Focus mode (hide all)');","T('id=\"mGame\"',SET.gamify,'Gamify (retro platformer)');");
  s=R(s,"$('panelMenu').addEventListener('click',e=>e.stopPropagation());","$('panelMenu').addEventListener('click',e=>{e.stopPropagation();if(e.target.closest('#mFocusBtn')){SET.focus=!SET.focus;applyPanels();$('mFocusBtn').focus()}});");
  s=R(s,"if(t.id==='mFocus')SET.focus=t.checked;\nelse if(t.id==='mGame'){","if(t.id==='mGame'){");
  s=R(s,"$('btnFocus').onclick=()=>{SET.focus=!SET.focus;applyPanels();focusTa()};","$('btnSettings').onclick=()=>openSettings();");
  s=R(s,"({manage:()=>openEssay(),start:openModal,upload:openUpload,help:showHowto,","({manage:()=>openEssay(),start:openModal,upload:openUpload,help:showHowto,settings:()=>openSettings(),");
  s=R(s,"PANELS.forEach(p=>p.querySelector('.x').onclick=()=>{SET.hidden.push(p.dataset.panel);applyPanels()});",
    "PANELS.forEach(p=>{const x=p.querySelector('.x');x.setAttribute('aria-label','Hide '+p.dataset.name);x.onclick=()=>{SET.hidden.push(p.dataset.panel);applyPanels()}});");
  // reset increments the reset epoch (so an older device can't undo it when syncing)
  s=R(s,"S=DEFSTATE();S.resetAt=Date.now();save();loadTask();openModal()","const ep=(S.epoch|0)+1;S=DEFSTATE();S.resetAt=Date.now();S.epoch=ep;save();closeSettings();loadTask();openModal();announce('Progress reset for this essay.')");
  s=R(s,"started:!!st.started,nS:num(st.nS),stats:o,game:g,resetAt:num(st.resetAt),","started:!!st.started,nS:num(st.nS),stats:o,game:g,resetAt:num(st.resetAt),epoch:Math.max(0,num(st.epoch)|0),rev:typeof st.rev==='string'&&/^r[0-9a-f]{1,32}$/.test(st.rev)?st.rev:undefined,");
  // settings window + accessibility preferences
  s=R(s,"function bindSettings(){",`/* ---------- settings window ---------- */
function openSettings(){syncModeRadios();$('setModal').hidden=false;if(window.RecallPWA)RecallPWA.refreshUI();if(window.RecallSyncUI)RecallSyncUI.render()}
function closeSettings(){$('setModal').hidden=true}
$('setX').onclick=closeSettings;
$('setModal').addEventListener('click',e=>{if(e.target.id==='setModal')closeSettings()});
$('setModal').addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();closeSettings()}});
function syncModeRadios(){$('sMode').querySelectorAll('input').forEach(i=>i.checked=i.value===SET.mode)}
$('sMode').addEventListener('change',e=>{
  const v=modeOf(e.target.value);SET.mode=v;saveSettings();
  const mid=phase==='type'&&typed.trim().length>0;
  if(!mid){attemptMode=v;invalidateMarking();if(task)renderHead();if(choiceOn())renderChoices()}
  const msg=mid?'Changes apply from your next attempt (this answer keeps its current marking).':v==='standard'?'Standard marking.':MODES[v].name+' is on.';
  $('modeNote').textContent=msg;
});
const reduceOn=()=>SET.reduce==null?matchMedia('(prefers-reduced-motion: reduce)').matches:SET.reduce;
function applyA11y(){
  const red=reduceOn();
  document.body.classList.toggle('reduce',red);self.RECALL_REDUCE=red;
  document.body.classList.toggle('hc',!!SET.hc);
  document.body.classList.toggle('plain',!!SET.plainInput);
  document.documentElement.style.setProperty('--fs',SET.fs);
  if(window.bgRepaint)bgRepaint();
}
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',()=>{if(SET.reduce==null)applyA11y()});
/* ---------- screen reader announcements (polite; failures assertive). Never per keystroke. ---------- */
let annT=0;
function announce(msg,urgent){const el=$(urgent?'srAlert':'sr');clearTimeout(annT);el.textContent='';annT=setTimeout(()=>{el.textContent=msg},60)}
function bindSettings(){`);
  s=R(s,"C('sEssay','essay');C('sHide','hide');C('sMotion','motion');",
`C('sEssay','essay');C('sHide','hide');C('sMotion','motion');
const A=(id,key)=>{const el=$(id);el.checked=!!SET[key];el.onchange=()=>{SET[key]=el.checked;saveSettings();applyA11y();if(key==='plainInput'){renderTyped();focusTa()}}};
A('sHc','hc');A('sPlain','plainInput');A('sKeys','keys');
const fsEl=$('sFs');fsEl.value=SET.fs;$('oFs').textContent=Math.round(SET.fs*100)+'%';fill(fsEl);
fsEl.oninput=()=>{SET.fs=+fsEl.value;$('oFs').textContent=Math.round(SET.fs*100)+'%';fill(fsEl);applyA11y();saveSettings()};
const rv=()=>SET.reduce==null?'auto':SET.reduce?'on':'off';
const rseg=()=>$('sReduce').querySelectorAll('button').forEach(b=>{const on=b.dataset.v===rv();b.classList.toggle('on',on);b.setAttribute('aria-checked',on)});rseg();
$('sReduce').onclick=e=>{const b=e.target.closest('button');if(!b)return;SET.reduce=b.dataset.v==='auto'?null:b.dataset.v==='on';rseg();saveSettings();applyA11y()};
syncModeRadios();applyA11y();`);
  // keyboard shortcuts can be switched off; Tab only skips when focus is in the answer box
  s=R(s,"const ctl=e.ctrlKey&&!e.altKey,K=e.code;","const ctl=e.ctrlKey&&!e.altKey&&SET.keys,K=e.code;");
  s=R(s,"if(phase==='type'&&choiceOn()&&!e.ctrlKey&&!e.metaKey&&!e.altKey){","if(phase==='type'&&choiceOn()&&SET.keys&&!e.ctrlKey&&!e.metaKey&&!e.altKey){");
  s=R(s,"else if(e.key==='Tab'){e.preventDefault();skip()}","else if(e.key==='Tab'&&!e.shiftKey&&(document.activeElement===ta||document.activeElement===document.body)){e.preventDefault();skip()}");
  s=s.replace("document.addEventListener('keydown',e=>{const d=/^Digit([1-9])$/.exec(e.code);if(e.altKey&&","document.addEventListener('keydown',e=>{const d=/^Digit([1-9])$/.exec(e.code);if(SET.keys&&e.altKey&&");
  // announcements: new task (after a short settle) and results
  s=R(s,"renderHead();renderPrompt();renderTyped();renderFoot();renderQueue();renderSide();renderLive();Game.task(task);renderChoices();",
    "renderHead();renderPrompt();renderTyped();renderFoot();renderQueue();renderSide();renderLive();Game.task(task);renderChoices();\nta.setAttribute('aria-label','Your answer · '+$('chip').textContent);\nannounce($('chip').textContent+'. '+(task.type==='build'?'Type: '+task.text:(prompt.querySelector('h3')||{}).textContent||''));");
  s=R(s,"save();renderSide();\nif(task.type==='build'){","save();renderSide();\nannounce(`Passed, ${pct}% match.${task.type==='build'?'':' Press Enter to continue.'}`);\nif(task.type==='build'){");
  s=R(s,"$('bRetry').onclick=retry;$('bSkip').onclick=skip;","$('bRetry').onclick=retry;$('bSkip').onclick=skip;\nannounce(`Not yet: ${pct}% match${qFail?', with a quote slip':''}, need ${SET.strict}%. ${r.ops.filter(o=>o.op==='sub').length} wrong, ${r.ops.filter(o=>o.op==='del').length} missed. Press Enter to retry.`);");
  // mode badge in the card head
  s=R(s,"function renderHead(){","function renderHead(){\nconst mb=$('modeBadge');if(mb)mb.textContent=attemptMode!=='standard'?MODES[attemptMode].label:'';");
  // saving failures are announced
  s=R(s,"if(!saveWarned){saveWarned=true;setTimeout(()=>toast('Couldn’t save progress: browser storage is full or blocked'),0)}",
    "if(!saveWarned){saveWarned=true;setTimeout(()=>{toast('Couldn’t save progress: browser storage is full or blocked');announce('Could not save progress: browser storage is full or blocked.',true)},0)}");
  return s;
});
edit('index.html',s=>R(s,`<span class="ctx" id="ctx"></span>`,`<span class="ctx" id="ctx"></span><span class="modebadge" id="modeBadge" title="Marking mode"></span>`));
console.log('p3 applied');
