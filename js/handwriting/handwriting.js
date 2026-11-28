/* RecallHSC · handwriting with Apple Pencil (iPad only; beta).
   HSC exams are handwritten, so students can practise writing their recall by hand.
   - A full-screen sheet (lined or blank). Only Apple Pencil strokes draw (pointerType "pen" on iPadOS);
     fingers and palms are ignored.
   - No live recognition while writing: the student writes the whole answer, then presses Check. Only then is the
     page read, on the device itself (js/handwriting/hw.worker.js: a small open handwriting model, free, private,
     offline after a one-time download). The reading is shown line by line, then the normal marking runs.
   - Normal mode only (no game mode), and a focus-style screen: the stats panels are hidden; after each check the
     student sees their writing speed (wpm and strokes per second, from the time taken).
   On any other device (including other tablets) the module does nothing. */
(function(){
'use strict';
const UA=navigator.userAgent||'';
const $=id=>document.getElementById(id);
const flag=k=>{try{return localStorage.getItem(k)}catch(_){return null}};
// iPadOS browsers (Safari, Chrome, Edge…) usually present as a Mac; a Mac with touch is an iPad (real Macs report none).
// Some hide even that, so the first Apple Pencil touch on an Apple device also marks it as an iPad (remembered).
const IPAD=/iPad/.test(UA)||navigator.platform==='iPad'||
  (/Macintosh|Mac OS X/.test(UA)&&(navigator.maxTouchPoints>0||'ontouchend' in document))||flag('essayRecall2.ipad')==='1';
function status(text,enabled){const row=$('hwRow'),s=$('sHw');if(!row)return;row.hidden=false;const sm=row.querySelector('small');if(sm)sm.textContent=text;if(s)s.disabled=!enabled}
if(!IPAD&&!self.__HW_TEST){
  // Settings says why it isn't offered, so a device that should qualify can be checked
  status(`(iPad with Apple Pencil only. This device reports: ${navigator.platform||'unknown platform'}, ${navigator.maxTouchPoints|0} touch points)`,false);
  if(/Mac|iPad|iPhone/.test(UA))document.addEventListener('pointerdown',function pen(e){
    if(e.pointerType!=='pen')return;document.removeEventListener('pointerdown',pen,true);
    try{localStorage.setItem('essayRecall2.ipad','1')}catch(_){}location.reload();
  },true);
  return;
}
status('(practise writing answers by hand, like the exam)',true);
const SRC=(document.currentScript&&document.currentScript.src)||location.href; // to find hw.worker.js next to this file
const KEY='essayRecall2.hw',SEEN='essayRecall2.penSeen',PAPER='essayRecall2.hwPaper',OFFER='essayRecall2.hwOffer';
const get=k=>{try{return localStorage.getItem(k)}catch(_){return null}},put=(k,v)=>{try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(_){}};
let on=get(KEY)==='1',penSeen=get(SEEN)==='1',paper=get(PAPER)==='blank'?'blank':'lined';
let erasing=false,strokes=[],cur=null,busy=false,tStart=0,prevFocus=null,sid=0,preT=0;const sent=new Set(); // line keys already encoded in the background
let RULE=52,RULE0=24; // ruled line spacing, set from the sheet size (closer to real writing paper on bigger iPads)

/* ---------- markup ---------- */
const tb=$('typebox'),promptEl=$('prompt');if(!tb||!promptEl)return;
const promptHome={parent:promptEl.parentNode,next:promptEl.nextSibling};
const sw=document.createElement('button');
sw.className='btn small hwtoggle';sw.id='hwToggle';sw.type='button';sw.hidden=true;
tb.parentNode.insertBefore(sw,tb);
const offer=document.createElement('div');offer.className='hwoffer';offer.id='hwOffer';offer.hidden=true;
offer.innerHTML=`<span class="hwo-ic" aria-hidden="true">✍</span><span class="hwo-t"><b>New on iPad: write it by hand</b><small>Practise your recall with Apple Pencil on a full-screen sheet, like the exam. Read on your iPad, marked in seconds.</small></span><button class="btn small primary" id="hwTry" type="button">Try it</button><button class="btn small" id="hwNo" type="button">Not now</button>`;
offer.setAttribute('role','dialog');offer.setAttribute('aria-label','Try handwriting with Apple Pencil');
document.body.appendChild(offer); // a popup at the bottom, like the update bar
const pad=document.createElement('div');pad.className='hwpad';pad.id='hwPad';pad.hidden=true;
pad.setAttribute('role','group');pad.setAttribute('aria-label','Handwriting sheet');
// part of the normal page: it takes the typing box's place in the card, just much bigger. The paper scrolls and grows.
pad.innerHTML=`<div class="hwsheet lined" id="hwSheet"><div class="hwpage" id="hwPage"><canvas id="hwCanvas" role="img" aria-label="Handwriting area. Write your answer with Apple Pencil, then press Check. Scroll with one finger."></canvas><div class="hwscan" id="hwScan" aria-hidden="true"></div></div></div>
<div class="hwbar"><span class="hwnote" id="hwNote" role="status"></span>
<button class="btn small" id="hwPaper" type="button" aria-label="Paper style"></button>
<button class="btn small" id="hwErase" type="button" aria-pressed="false" title="Eraser: removes whole strokes. Two-finger tap on the sheet switches it on and off.">⌫ Eraser</button><button class="btn small" id="hwClear" type="button">Clear</button>
<button class="btn small" id="hwType" type="button">⌨ Back to typing</button><button class="btn primary" id="hwDone" type="button">Check</button></div>`;
pad.insertBefore(pad.querySelector('.hwbar'),pad.firstChild); // the tools and Check sit above the paper, close to hand
pad.insertBefore(pad.querySelector('#hwNote'),pad.querySelector('.hwsheet')); // status on its own line, so the buttons never wrap
tb.parentNode.insertBefore(pad,tb); // the marked answer (the typing box) then shows below the paper after Check
// first-time download of the reader: a progress bar across the top of everything
const loadBar=document.createElement('div');loadBar.className='hwload';loadBar.id='hwLoad';loadBar.hidden=true;loadBar.setAttribute('role','progressbar');loadBar.setAttribute('aria-label','Getting the handwriting reader ready');
loadBar.innerHTML='<i id="hwLoadFill"></i><span id="hwLoadText">Getting the handwriting reader ready…</span>';
document.body.appendChild(loadBar);
function loading(pct){if(pct==null){loadBar.hidden=true;return}loadBar.hidden=false;$('hwLoadFill').style.width=Math.max(4,pct)+'%';loadBar.setAttribute('aria-valuenow',String(Math.round(pct)));$('hwLoadText').textContent=`Getting the handwriting reader ready (once, then it works offline): ${Math.round(pct)}%`}
const cv=$('hwCanvas'),cx=cv.getContext('2d'),note=$('hwNote'),sheet=$('hwSheet'),page=$('hwPage'),scan=$('hwScan');
// line spacing and margin follow the iPad's size; only changed while the sheet is empty, so ink and rules stay aligned
function ruling(){
  if(strokes.length)return;
  const w=sheet.clientWidth||800;
  RULE=w>=1000?58:w>=760?54:48;RULE0=Math.round(RULE*.45);
  sheet.style.setProperty('--rule',RULE+'px');sheet.style.setProperty('--rule0',RULE0+'px');
  sheet.style.setProperty('--margin',Math.round(Math.min(110,Math.max(40,w*.07)))+'px');
  pageH=0;page.style.height='';grow();
}
let pageH=0; // the paper grows as the student writes near the bottom: no end to it
function grow(minH){const want=Math.max(minH||0,sheet.clientHeight,RULE0+RULE*16);if(want>pageH){pageH=Math.ceil((want-RULE0)/RULE)*RULE+RULE0;page.style.height=pageH+'px';requestAnimationFrame(fit)}}
const say=t=>{note.textContent=t||''};

/* ---------- canvas ---------- */
let DPR=1;
function fit(){
  const r=cv.getBoundingClientRect();if(!r.width||!r.height)return;
  DPR=Math.min(1.5,devicePixelRatio||1); // long pages: keep the canvas memory sensible
  const w=Math.round(r.width*DPR),h=Math.round(r.height*DPR);
  if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h;redraw()}
}
function seg(s){
  const p=s.pts;if(!p.length)return;
  cx.lineCap='round';cx.lineJoin='round';cx.strokeStyle=cx.fillStyle='#0b1324';
  if(p.length===1){cx.beginPath();cx.arc(p[0][0]*DPR,p[0][1]*DPR,(1+p[0][2]*1.6)*DPR,0,7);cx.fill();return}
  for(let i=1;i<p.length;i++){
    const a=p[i-1],b=p[i];cx.lineWidth=(1.1+((a[2]+b[2])/2)*2.6)*DPR;
    cx.beginPath();cx.moveTo(a[0]*DPR,a[1]*DPR);cx.lineTo(b[0]*DPR,b[1]*DPR);cx.stroke();
  }
}
function redraw(){cx.clearRect(0,0,cv.width,cv.height);strokes.forEach(seg)}
const at=e=>{const r=cv.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top,e.pressure>0?e.pressure:.5]};
cv.addEventListener('pointerdown',e=>{
  if(e.pointerType!=='pen'||busy)return; // Apple Pencil only: fingers and palms never draw
  e.preventDefault();try{cv.setPointerCapture(e.pointerId)}catch(_){}
  if(erasing){cur={erase:true};eraseAt(at(e));return}
  if(!tStart)tStart=performance.now();
  cur={id:++sid,pts:[at(e)]};strokes.push(cur);seg(cur);say('');clearReading();clearTimeout(preT);
});
cv.addEventListener('pointermove',e=>{
  if(!cur||e.pointerType!=='pen')return;e.preventDefault();
  if(cur.erase){eraseAt(at(e));return}
  let evs=e.getCoalescedEvents?e.getCoalescedEvents():[];if(!evs.length)evs=[e]; // some browsers return none
  const start=Math.max(0,cur.pts.length-1);
  for(const ev of evs)cur.pts.push(at(ev));
  seg({pts:cur.pts.slice(start)});
});
const end=e=>{if(cur&&e.pointerType==='pen'){const was=cur;cur=null;if(!was.erase){clearTimeout(preT);preT=setTimeout(preEncode,600);
  // writing near the bottom: add ten more lines of paper
  let maxY=0;for(const p of was.pts)if(p[1]>maxY)maxY=p[1];if(maxY>pageH-RULE*4)grow(pageH+RULE*10)}}};
/* Eraser: object by object. Any stroke the pencil passes within ~10px of is removed whole. */
function eraseAt([x,y]){
  const r2=100,before=strokes.length;
  for(let i=strokes.length-1;i>=0;i--){const p=strokes[i].pts;
    for(let k=0;k<p.length;k++){const a=p[k],b=p[k+1]||a,dx=b[0]-a[0],dy=b[1]-a[1],L=dx*dx+dy*dy;let t=L?((x-a[0])*dx+(y-a[1])*dy)/L:0;t=t<0?0:t>1?1:t;const qx=a[0]+t*dx-x,qy=a[1]+t*dy-y;if(qx*qx+qy*qy<=r2){strokes.splice(i,1);break}}}
  if(strokes.length!==before){redraw();clearReading()}
}
function setErase(v){erasing=!!v;const b=$('hwErase');b.setAttribute('aria-pressed',String(erasing));b.classList.toggle('on',erasing);sheet.classList.toggle('erasing',erasing);say(erasing?'Eraser on: touch strokes with Apple Pencil to remove them.':'')}
// Safari doesn't give websites the Apple Pencil double-tap, so a two-finger tap on the sheet toggles the eraser instead
{let t0=0,moved=false;
  sheet.addEventListener('touchstart',e=>{if(e.touches.length===2&&[...e.touches].every(t=>t.touchType!=='stylus')){t0=performance.now();moved=false}},{passive:true});
  sheet.addEventListener('touchmove',()=>{moved=true},{passive:true});
  sheet.addEventListener('touchend',e=>{if(t0&&e.touches.length===0){if(!moved&&performance.now()-t0<350)setErase(!erasing);t0=0}},{passive:true});}
cv.addEventListener('pointerup',end);cv.addEventListener('pointercancel',end);
cv.addEventListener('touchstart',e=>{if(e.touches.length===1&&e.touches[0].touchType==='stylus')e.preventDefault()},{passive:false});
addEventListener('resize',()=>requestAnimationFrame(()=>{ruling();fit()}));

/* ---------- splitting the page into written lines ----------
   Lined paper: each stroke belongs to the ruled line its middle sits on. Blank paper: strokes are grouped by height. */
function lineGroups(){
  const items=strokes.map(s=>{let y0=1e9,y1=-1e9,x0=1e9,x1=-1e9;for(const[x,y] of s.pts){if(y<y0)y0=y;if(y>y1)y1=y;if(x<x0)x0=x;if(x>x1)x1=x}return{s,y0,y1,x0,x1,mid:(y0+y1)/2}});
  const groups=[];
  if(paper==='lined'){
    const m=new Map();for(const it of items){const li=Math.max(0,Math.floor((it.mid-RULE0)/RULE));if(!m.has(li))m.set(li,[]);m.get(li).push(it)}
    for(const k of [...m.keys()].sort((a,b)=>a-b))groups.push(m.get(k));
  }else{
    const hs=items.map(i=>i.y1-i.y0).sort((a,b)=>a-b),h=Math.max(18,hs[hs.length>>1]||24);
    for(const it of items.slice().sort((a,b)=>a.mid-b.mid)){
      const g=groups[groups.length-1];
      if(g&&Math.abs(it.mid-g.mid)<h*.9){g.push(it);g.mid=g.reduce((a,b)=>a+b.mid,0)/g.length}else{const n=[it];n.mid=it.mid;groups.push(n)}
    }
  }
  return groups.map(g=>{let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9,n=0;for(const i of g){x0=Math.min(x0,i.x0);y0=Math.min(y0,i.y0);x1=Math.max(x1,i.x1);y1=Math.max(y1,i.y1);n+=i.s.pts.length}
    const ss=g.map(i=>i.s);return{strokes:ss,x0,y0,x1,y1,key:paper[0]+ss.map(s=>s.id).sort((p,q)=>p-q).join(',')+':'+n}});
}
function lineImage(L){
  const pad=10,x0=L.x0-pad,y0=L.y0-pad,x1=L.x1+pad,y1=L.y1+pad;
  const k=Math.min(2,96/Math.max(1,y1-y0)); // about 96px tall: plenty for the model, quick to process
  const o=document.createElement('canvas');o.width=Math.max(8,Math.round((x1-x0)*k));o.height=Math.max(8,Math.round((y1-y0)*k));
  const g=o.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,o.width,o.height);
  g.lineCap='round';g.lineJoin='round';g.strokeStyle='#000';g.fillStyle='#000';
  for(const s of L.strokes){const p=s.pts;
    if(p.length===1){g.beginPath();g.arc((p[0][0]-x0)*k,(p[0][1]-y0)*k,2.2*k,0,7);g.fill();continue}
    for(let i=1;i<p.length;i++){g.lineWidth=(1.6+((p[i-1][2]+p[i][2])/2)*2.2)*k;g.beginPath();g.moveTo((p[i-1][0]-x0)*k,(p[i-1][1]-y0)*k);g.lineTo((p[i][0]-x0)*k,(p[i][1]-y0)*k);g.stroke()}}
  return new Promise(r=>o.toBlob(b=>r(b),'image/png'));
}

/* ---------- live "reading" view: a scan beam per line, then the words it read under each line ---------- */
function clearReading(){scan.innerHTML='';sheet.classList.remove('reading')}
function showLines(lines){
  scan.innerHTML=lines.map((L,i)=>`<div class="hwl" data-i="${i}" style="top:${L.y0-6}px;height:${L.y1-L.y0+12}px;left:${Math.max(0,L.x0-8)}px;width:${L.x1-L.x0+16}px"><i></i><span class="hwread"></span></div>`).join('');
  sheet.classList.add('reading');
}
function markLine(i,state,text){
  const el=scan.querySelector(`.hwl[data-i="${i}"]`);if(!el)return;
  el.classList.remove('wait','now','read','done','fix');el.classList.add(state);
  if(text!=null)el.querySelector('.hwread').textContent=text;
}

/* ---------- the on-device reader (Web Worker) ---------- */
let W=null,ready=false,seq=0;const waiting=new Map();
function reader(){
  if(W)return W;
  try{W=new Worker(new URL('hw.worker.js',SRC),{type:'module'})}catch(_){W=null;return null}
  W.onmessage=e=>{const m=e.data||{};
    if(m.type==='progress'&&!ready&&m.total)loading(m.loaded/m.total*100);
    else if(m.type==='ready'){ready=true;loading(null);if(!busy)say('')}
    else if(m.type==='line'){const w=waiting.get(m.id);if(w&&w.onLine)w.onLine(m)}
    else if(m.type==='result'||m.type==='error'){const w=waiting.get(m.id);if(w){waiting.delete(m.id);m.type==='result'?w.ok(m):w.no(new Error(m.message))}else if(m.type==='error'&&!busy)say('The handwriting reader couldn’t start. Check your connection, then try again.')}
  };
  W.onerror=()=>{for(const w of waiting.values())w.no(new Error('worker'));waiting.clear();W=null;ready=false};
  W.postMessage({type:'load'});
  return W;
}
function checkLines(lines,expected,onLine){
  const w=reader();if(!w)return Promise.reject(new Error('no-worker'));
  const id=++seq;return new Promise((ok,no)=>{waiting.set(id,{ok,no,onLine});w.postMessage({type:'check',id,expected,lines})});
}
/* While the student writes, quietly encode every finished line (all but the one being written), so Check only has
   the last line left to do. Nothing is shown: this is not live recognition, just getting ahead. */
async function preEncode(){
  if(!on||busy||!strokes.length)return;
  const w=reader();if(!w)return;
  const last=strokes[strokes.length-1];
  for(const L of lineGroups()){
    if(L.strokes.includes(last)||sent.has(L.key))continue;
    sent.add(L.key);const blob=await lineImage(L);w.postMessage({type:'encode',key:L.key,blob});
  }
}

/* ---------- reading + marking ---------- */
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function read(){
  if(busy)return;
  if(!strokes.length){say('Write your answer with Apple Pencil first.');return}
  if(typeof phase==='undefined'||phase!=='type')return;
  const secs=Math.max(1,(performance.now()-(tStart||performance.now()))/1000),nStrokes=strokes.length;
  busy=true;$('hwDone').disabled=true;pad.classList.add('busy');
  const lines=lineGroups();showLines(lines);lines.forEach((_,i)=>markLine(i,'wait'));
  say(ready?'Reading your writing…':'Getting the handwriting reader ready…');
  try{
    const blobs=await Promise.all(lines.map(lineImage));
    markLine(0,'now');
    const r=await checkLines(lines.map((L,i)=>({key:L.key,blob:blobs[i],width:L.x1-L.x0})),task.text,m=>{if(m.ok===null){markLine(m.i,'read',m.text||'·');markLine(m.i+1,'now');say(m.i+1<lines.length?`Reading your writing… line ${m.i+2} of ${lines.length}`:'Checking against your essay…')}else markLine(m.i,m.ok?'done':'fix',m.text||'·')});
    r.texts.forEach((t,i)=>markLine(i,r.oks[i]?'done':'fix',t||'·'));
    const text=r.texts.join(' ').replace(/\s+/g,' ').trim();
    if(!text){say('Couldn’t make out any words. Try writing a little larger, on the lines.');return}
    say(`Read in ${(r.ms/1000).toFixed(1)}s. Marking…`);
    await sleep(650); // a moment to see what was read
    const words=tokens(text).length,wpm=Math.round(words/(secs/60)),sps=(nStrokes/secs).toFixed(1);
    // progress counts (sentences learnt, position), but the typing statistics don't: keep a copy and put it back
    // after the marking, then record this attempt in the handwriting statistics instead
    const typingStats=JSON.parse(JSON.stringify(S.stats)),typingTime=S.stats.time;
    typed=text;ta.value=text;renderTyped();
    if(self.track)track('handwriting');
    document.body.classList.add('hwmarked'); // the ink stays; the marked answer shows just below it
    check();
    for(let i=0;i<80&&phase==='marking';i++)await sleep(50);
    S.stats=typingStats;S.stats.time=typingTime;
    const hs=S.hw||(S.hw={att:0,pass:0,words:0,secs:0,strokes:0,bestWpm:0});
    hs.att++;if(phase==='ok'||phase==='review')hs.pass++;hs.words+=words;hs.secs+=secs;hs.strokes+=nStrokes;hs.bestWpm=Math.max(hs.bestWpm,wpm);
    save();if(typeof renderSide==='function')renderSide();
    const f=$('foot');
    if(f){const s=document.createElement('span');s.className='hwstats';s.textContent=`✍ ${wpm} wpm · ${sps} strokes/s · ${Math.round(secs)}s · handwriting: ${hs.pass}/${hs.att} passed, best ${Math.round(hs.bestWpm)} wpm`;f.insertBefore(s,f.querySelector('.spacer')||null)}
    if($('typebox'))$('typebox').scrollIntoView({block:'nearest',behavior:'smooth'});
    if(self.announce)announce(`Handwriting: ${wpm} words per minute, ${sps} strokes per second.`);
  }catch(err){
    say('Couldn’t read the writing just now. Your ink is still here: try Check again.');clearReading();
  }finally{busy=false;$('hwDone').disabled=false;pad.classList.remove('busy')}
}

/* ---------- on/off, paper, per-task reset ---------- */
function setPaper(p){paper=p==='blank'?'blank':'lined';put(PAPER,paper==='blank'?'blank':null);sheet.classList.toggle('lined',paper==='lined');$('hwPaper').textContent=paper==='lined'?'▢ Blank paper':'▤ Lined paper'; /* shows the paper you'd switch to */clearReading()}
function apply(){
  document.body.classList.toggle('hw',on);
  pad.hidden=!on;sw.hidden=!(on||penSeen);
  sw.textContent=on?'⌨ Type instead':'✍ Handwrite';sw.setAttribute('aria-pressed',String(on));
  offer.hidden=on||get(OFFER)==='no';
  const s=$('sHw');if(s)s.checked=on;
  if(on){requestAnimationFrame(()=>{ruling();grow();fit()});reader();if(!ready)loading(2)}else loading(null);
}
function setOn(v){
  v=!!v;if(v===on){apply();return}
  on=v;put(KEY,on?'1':null);
  if(typeof SET!=='undefined'){
    if(on){if(SET.gamify&&typeof setGame==='function'){document.body.classList.remove('hw');setGame(false)} // normal mode only
      prevFocus=!!SET.focus;SET.focus=true}                                                                 // focus-style: stats panels hidden
    else if(prevFocus!==null){SET.focus=prevFocus;prevFocus=null}
    if(typeof applyPanels==='function')applyPanels();
  }
  apply();
  if(on){put(OFFER,'no');if(self.announce)announce('Handwriting on. Write your answer with Apple Pencil, then press Check.')}
  else if(self.focusTa)focusTa();
}
function reset(){strokes=[];cur=null;tStart=0;clearTimeout(preT);if(erasing)setErase(false);redraw();clearReading();say('');busy=false;pad.classList.remove('busy');document.body.classList.remove('hwmarked');pageH=0;page.style.height='';sheet.scrollTop=0;if(on){ruling();grow()}$('hwDone').disabled=false}
sw.onclick=()=>setOn(!on);
$('hwType').onclick=()=>setOn(false);
$('hwTry').onclick=()=>setOn(true);
$('hwNo').onclick=()=>{put(OFFER,'no');offer.hidden=true};
$('hwPaper').onclick=()=>setPaper(paper==='lined'?'blank':'lined');
$('hwErase').onclick=()=>{if(!busy)setErase(!erasing)};
$('hwClear').onclick=async()=>{
  if(busy||!strokes.length)return;
  const sure=typeof askConfirm==='function'?await askConfirm('Everything on this sheet will be wiped. This can’t be undone.',{title:'Clear the sheet?',ok:'Clear',danger:true}):true;
  if(sure){strokes=[];tStart=0;redraw();clearReading();say('')}
};
$('hwDone').onclick=read;
// the first Apple Pencil touch anywhere offers handwriting
document.addEventListener('pointerdown',e=>{if(e.pointerType==='pen'&&!penSeen){penSeen=true;put(SEEN,'1');apply();if(!on&&self.toast)toast('Apple Pencil found: tap ✍ Handwrite to write your answers by hand')}},true);
{const row=$('hwRow');if(row)row.hidden=false;const s=$('sHw');if(s)s.onchange=()=>setOn(s.checked)}
self.HW={_rule:()=>[RULE,RULE0],setErase,_erase:eraseAt,task:reset,on:()=>on,setOn,setPaper,_strokes:()=>strokes,_lines:lineGroups,_pre:preEncode,_redraw:redraw,_img:lineImage};
setPaper(paper);apply();
})();
