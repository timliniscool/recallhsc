/* Game mode on phones: handheld-console layout (screen on top, controls below). Applied once. */
'use strict';
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..','..');
const edit=(rel,fn)=>{const f=path.join(root,rel);fs.writeFileSync(f,fn(fs.readFileSync(f,'utf8')))};
const R=(s,a,b)=>{const n=s.split(a).length-1;if(n!==1)throw new Error(n+' matches: '+a.slice(0,90));return s.replace(a,()=>b)};
edit('index.html',s=>{
  s=R(s,`<canvas id="game" aria-hidden="true"></canvas>`,`<div class="gbscreen" aria-hidden="true"><canvas id="game"></canvas><span class="gbled"></span><span class="gblabel">RecallHSC · ARCADE</span></div>`);
  s=R(s,`<div class="toast" id="toast"></div>`,`<div class="toast" id="toast"></div>
<div class="gbpad" id="gbPad" role="group" aria-label="Game controls">
<div class="dpad"><button data-gb="up" aria-label="Hold to see the whole essay"><span aria-hidden="true">▲</span></button><button data-gb="left" aria-label="Back one step"><span aria-hidden="true">◀</span></button><span class="dhub" aria-hidden="true"></span><button data-gb="right" aria-label="Skip this step"><span aria-hidden="true">▶</span></button><button data-gb="down" aria-label="Hold to see the paragraph"><span aria-hidden="true">▼</span></button></div>
<div class="ab"><button class="gbb" data-gb="b" aria-label="B: back"><span>B</span></button><button class="gba" data-gb="a" aria-label="A: check or continue"><span>A</span></button></div>
<div class="ss"><button data-gb="select" aria-label="Select: next word hint">SELECT</button><button data-gb="start" aria-label="Start: settings">START</button></div>
</div>`);
  s=R(s,`/* ---------- footer + focus ---------- */`,`/* ---------- game mode on phones: handheld console ---------- */
.gbscreen{display:contents}
.gbled,.gblabel,.gbpad{display:none}
@media(max-width:640px){
  body.gamify .card{display:flex;flex-direction:column;background:#151a21;border-radius:14px 14px 46px 14px;box-shadow:0 0 0 3px #0b0f14,0 0 0 5px #a3e635,0 18px 40px rgba(0,0,0,.5);padding-bottom:16px}
  body.gamify .gbscreen{display:block;position:relative;order:-2;margin:14px 14px 4px;padding:12px 12px 26px;background:#2a3140;border-radius:10px 10px 34px 10px;box-shadow:inset 0 0 0 2px #0b0f14}
  body.gamify .gbscreen #game{position:relative;inset:auto;display:block;width:100%;height:min(34vh,260px);border:3px solid #0b0f14;background:#7dd3fc}
  body.gamify .gbled{display:block;position:absolute;left:12px;top:50%;width:7px;height:7px;border-radius:50%;background:#ef4444;box-shadow:0 0 6px #ef4444}
  body.gamify .gblabel{display:block;position:absolute;left:0;right:0;bottom:7px;text-align:center;font-family:var(--px);font-size:7px;letter-spacing:.08em;color:#94a3b8}
  body.gamify .gbscreen .gbled{top:auto;bottom:9px;left:14px}
  body.gamify .card-head{order:-1;margin:8px 14px 6px}
  body.gamify .card-head .tools{display:none}
  body.gamify .prompt{margin:0 14px;font-size:11px;line-height:2}
  body.gamify .typebox{margin:10px 14px 0;min-height:64px;max-height:22vh;font-size:11px}
  body.gamify .choices{margin:10px 14px 0}
  body.gamify .foot{margin:8px 14px 0}
  body.gamify .gbpad{display:grid;grid-template-columns:auto 1fr auto;grid-template-rows:auto auto;align-items:center;gap:14px 10px;margin:16px 18px 0;user-select:none;-webkit-user-select:none}
  body.gamify .dpad{grid-row:1;grid-column:1;display:grid;grid-template-columns:40px 40px 40px;grid-template-rows:40px 40px 40px}
  body.gamify .dpad button{background:#0b0f14;border:0;color:#cbd5e1;font-size:13px;display:grid;place-items:center;touch-action:manipulation;box-shadow:inset 0 -3px 0 rgba(255,255,255,.08)}
  body.gamify .dpad button:active,body.gamify .dpad button.held{background:#1f2a12;color:#d9f99d}
  body.gamify .dpad [data-gb=up]{grid-column:2;grid-row:1;border-radius:6px 6px 0 0}
  body.gamify .dpad [data-gb=left]{grid-column:1;grid-row:2;border-radius:6px 0 0 6px}
  body.gamify .dpad .dhub{grid-column:2;grid-row:2;background:#0b0f14}
  body.gamify .dpad [data-gb=right]{grid-column:3;grid-row:2;border-radius:0 6px 6px 0}
  body.gamify .dpad [data-gb=down]{grid-column:2;grid-row:3;border-radius:0 0 6px 6px}
  body.gamify .ab{grid-row:1;grid-column:3;display:flex;gap:14px;transform:rotate(-22deg);padding-top:18px}
  body.gamify .ab button{width:54px;height:54px;border-radius:50%;border:0;font-family:var(--px);font-size:12px;display:grid;place-items:center;touch-action:manipulation;box-shadow:0 4px 0 #0b0f14,inset 0 -3px 0 rgba(0,0,0,.25)}
  body.gamify .ab button span{transform:rotate(22deg)}
  body.gamify .gba{background:#a3e635;color:#0b1324;margin-top:-22px}
  body.gamify .gbb{background:#334155;color:#e2e8f0}
  body.gamify .ab button:active{transform:translateY(3px);box-shadow:0 1px 0 #0b0f14}
  body.gamify .ss{grid-row:2;grid-column:1/4;display:flex;justify-content:center;gap:22px}
  body.gamify .ss button{font-family:var(--px);font-size:7px;letter-spacing:.06em;color:#94a3b8;background:#0b0f14;border:0;border-radius:99px;padding:8px 14px;transform:rotate(-14deg);touch-action:manipulation}
  body.gamify .ss button:active{background:#1f2a12;color:#d9f99d}
  body.gamify .gbpad button:focus-visible{outline:2px dashed #a3e635;outline-offset:3px}
  body.gamify .pet{display:none}
}
/* ---------- footer + focus ---------- */`);
  return s;
});
edit('js/app.js',s=>R(s,"$('btnBack').onclick=back;",`$('btnBack').onclick=back;
/* handheld controls (game mode on phones). pointerdown keeps focus (and the on-screen keyboard) in the answer box */
(()=>{
  const pad=$('gbPad');if(!pad)return;
  const act={
    a(){if(phase==='type'){if(typed.trim())check();else focusTa()}else if(phase==='ok'||phase==='review')advance();else if(phase==='fail')retry()},
    b(){if(phase==='type'&&choiceOn()&&cIdx)$('chUndo').click();else back()},
    left:()=>back(),right:()=>{if(phase!=='done'&&phase!=='marking')skip()},
    select:()=>hint(),start:()=>openSettings(),
  };
  pad.addEventListener('pointerdown',e=>{
    const b=e.target.closest('button');if(!b)return;e.preventDefault();
    const k=b.dataset.gb;
    if(k==='up'||k==='down'){b.classList.add('held');b.setPointerCapture(e.pointerId);peek(k==='up'?'essay':'para');return}
    if(act[k])act[k]();
  });
  const release=e=>{const b=e.target.closest&&e.target.closest('[data-gb=up],[data-gb=down]');if(b&&b.classList.contains('held')){b.classList.remove('held');if(peekOn)unpeek()}};
  for(const ev of ['pointerup','pointercancel','lostpointercapture'])pad.addEventListener(ev,release);
  // keyboard users: Enter/Space on a control works like a tap (peeks toggle)
  pad.addEventListener('click',e=>{if(e.detail!==0)return;const b=e.target.closest('button');if(!b)return;const k=b.dataset.gb;
    if(k==='up'||k==='down'){peekOn?unpeek():peek(k==='up'?'essay':'para')}else if(act[k])act[k]()});
})();`));
console.log('p5 applied');
