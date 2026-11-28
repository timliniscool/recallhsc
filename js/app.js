/* RecallHSC app: UI, state, storage, guide. Algorithms live in js/engine/. */
const RAW = `Leadership is rarely found where we expect it, and democracy has long underestimated the wisdom of the back row. Bart Simpson, a ten-year-old from Springfield Elementary, exposes the paradox that the very qualities which earn detention are precisely those a nation requires in a crisis. His permanent record is long, but so is the Constitution, and nobody calls that a weakness. In an age of committee meetings and carefully focus-grouped slogans, Bart offers decisiveness, creativity and a skateboard. Read against a political culture exhausted by beige candidates, his record of mischief reveals a leader who understands power, labour and diplomacy better than most adults, and his candidacy suggests that the presidency might finally be fun again. Taken together, his hidden labour, his rebellion, his economics and his diplomacy make the strongest case yet for a ten-year-old in the Oval Office.
Bart’s most overlooked qualification is his secret career completing every assignment set for Ms Loveday Sharpington-Recny, the teacher who is supposed to be grading him. Each night Ms Sharpington-Recny carries home a tower of professional development modules, and each morning they return finished in suspiciously confident handwriting. When asked about the arrangement, she admits, “I have not filled out a single worksheet since March, and my performance reviews have never been better.” The juxtaposition between her glowing appraisal and her empty evenings exposes a system that rewards outcomes while ignoring who actually produced them. Bart describes the work with the weariness of a seasoned public servant: “Somebody has to read the policy documents, and it is never the people who wrote them.” The aphorism positions him as the unseen labourer behind institutional success, a figure familiar to any functioning government. His efficiency is extraordinary. He completed her entire module on classroom behaviour management during a single detention. He even submitted her reflective journal, which included the line, “Today I learned that children are the future, and the future is doing my paperwork.” The irony exposes an adult outsourcing her own professional growth to the very child it is meant to serve. Her colleagues have noticed a dramatic rise in the quality of her lesson plans, which now include footnotes, diagrams and a recurring cartoon of a triumphant boy. The principal praised one plan as “visionary, if slightly vengeful”, and the paired adjectives capture Bart’s style of governance perfectly. Ms Sharpington-Recny has since been nominated for Teacher of the Year, an honour she plans to accept with a speech that Bart is currently drafting. A president must delegate, but a great president must also know how to be the person everyone else delegates to.
Bart also represents rebellion not as chaos but as a disciplined critique of institutions that have stopped listening. Confronted by yet another assembly on hallway etiquette, Bart declares, “If the rules were any good, they would not need a laminated poster.” The irony of a child outmanoeuvring a laminating machine exposes how authority often mistakes decoration for legitimacy. Bureaucrats call this insolence, but historians would call it the first draft of a reform agenda. His approach to reform is equally inventive, as he proposes replacing the school bell with “a gentle trumpet fanfare, so that every lesson ends like a victory”. The metaphor of victory transforms the mundane into the triumphant, revealing a leader who understands that morale is a policy area. Critics object that his methods include water balloons. Yet even here Bart insists, “A balloon is just a petition that has been filled with conviction.” The personification recasts protest as civic participation, recalling how democracies have always relied on loud citizens to correct quiet errors. Teachers who once confiscated his slingshot now quietly admit that he was right about the fire drill schedule. His rebellion therefore models the agency that voters claim to want but rarely elect.
Bart’s economic instincts are equally presidential, as his management of the playground economy proves that markets respond to imagination rather than lectures. When the canteen raised the price of jelly cups, Bart opened a rival stall behind the bike racks and promised “fair prices, fast service and absolutely no questions about where the jelly came from”. The tricolon builds a slogan of reassuring confidence before collapsing into comic evasion, exposing how much of public policy depends on what voters agree not to ask. Within a week the canteen had lowered its prices. Bart declared victory at a press conference held from the top of the monkey bars. “Competition is just cooperation that refuses to wait its turn,” he explained to an audience of second graders and one confused seagull. The paradox reframes rivalry as a form of service, suggesting that Bart understands markets as systems of mutual pressure rather than personal greed. His accounts were kept in crayon. Every trade was nevertheless recorded, and every debt was eventually repaid in trading cards. Even the school auditor, a retired accountant who volunteers on Thursdays, admitted that the books were “messier than a toddler’s lunch but more honest than most budgets”. The simile turns disorder into a mark of transparency. A nation tired of polished deficits might welcome a treasurer whose mistakes are at least written in bright colours.
Finally, Bart demonstrates that diplomacy depends less on formality than on understanding what other people secretly want. During a lunchtime dispute over the last chocolate milk, he brokered peace by announcing, “Nobody gets the milk, and everybody gets a turn on the swing.” The balance of shared loss and shared reward reveals a negotiator who knows that fairness is felt before it is understood. He later ended a standoff between the fourth and fifth grades with a treaty written on a paper lunch bag. Its single clause read, “No wedgies before noon.” The brevity of the clause shows that effective law need not be lengthy to be respected. The treaty has not been broken once, a record few international agreements can claim. Such moments suggest that his foreign policy would rest on empathy, humour and a strategic supply of snacks. His opponents call him immature. His supporters call him relatable. History suggests that maturity has produced plenty of wars, while immaturity has mostly produced pranks.
Bart Simpson presents leadership as a willingness to labour unseen, to challenge, to trade boldly and to make peace on unusual terms. The boy who spent his childhood in detention has used that time to study the institutions he would one day run. He has balanced budgets in crayon, brokered treaties on lunch bags and survived more parent-teacher interviews than any sitting politician. His secret years of homework prove that he can carry a heavy burden without asking for credit. Springfield has already trusted him with its lunch money, its jelly cups and its peace. Voters may hesitate to elect a ten-year-old, but they will struggle to find a candidate with more experience in actually getting things done.`;


/* =====================================================================
TEXT MODEL (works for any pasted essay)
===================================================================== */
/* engine (js/engine/*.js) */
const {normWord,items,tokens,mdClean,FN,BREAK,DET,bare,chunkSentence,ABBR,splitSentences,quotedWords,TECH,ANALYSIS_RX,VERB_RX,outsideQuoteWords,hasQuote,TECH_RX,detectStructure,HEAD_RX,looksHeading,looksCreative,discScore,looksDiscursive,detectKind,TURN_RX,ANEC_RX,REFL_RX,ABSTRACT_RX,PAST_RX,PRES_RX,tagMoves,origPhrase,pieceStyle,markMotifs,parseEssay,isFormulaic,splitSentence,lev,fuzzy,align}=RecallEngine;
const rangeText=(a,b)=>RecallEngine.rangeText({SENTS},a,b);
const buildQueue=g=>RecallEngine.buildQueue({SENTS,PARAS,PSTART,S,SET},g);
/* heavy marking/parsing runs in js/workers/compute.worker.js; small jobs and fallbacks run inline */
const COMPUTE=createCompute({onError:r=>console.warn('compute worker:',r)});
const {markAttempt,liveAccuracy,MODES,modeOf,vItems,endsInsideQuote}=RecallEngine;
let QSTART=[];          // QSTART[g]: sentence g begins inside a quotation that opened earlier (for strict quotes)
let markSeq=0;          // bumped whenever an attempt, task, essay, reset or mode changes; older results are ignored
let attemptMode='standard'; // marking mode fixed when an attempt starts (changes apply from the next attempt)
let composing=false;    // IME composition in progress: never auto-submit mid-composition
const taskQuoteStart=t=>{const q=!!QSTART[t.a];return t.pre?endsInsideQuote(t.pre,q):q};
function invalidateMarking(){markSeq++;COMPUTE.cancel()}
let PARAS=[],SENTS=[],PSTART=[],TOTALW=1,FORMULAIC=false;

/* ---------- storage ---------- */
const NS='essayRecall2.';
const ls={get(k){try{return JSON.parse(localStorage.getItem(NS+k))}catch(e){return null}},set(k,v){try{localStorage.setItem(NS+k,JSON.stringify(v))}catch(e){}},del(k){try{localStorage.removeItem(NS+k)}catch(e){}}};
const hashId=s=>{let h=5381;for(let i=0;i<s.length;i++)h=(h*33^s.charCodeAt(i))>>>0;return'e'+h.toString(36)};
const titleOf=t=>{const w=t.trim().split(/\s+/).slice(0,6).join(' ');return w.length>42?w.slice(0,42)+'…':w+'…'};
/* Settings. New fields (v2): mode (marking mode, Standard by default for everyone), reduce (reduced motion:
   null = follow the device), hc (high contrast), plainInput (standard text box instead of the styled one),
   fs (text size multiplier), keys (keyboard shortcuts on/off). Older saved settings simply lack them. */
const DEFSET={delay:2,strict:88,phrase:4,essay:true,hide:true,scope:'start',motion:true,hidden:['deep','map'],focus:false,view:'mem',gsec:'common',
  mode:'standard',reduce:null,hc:false,plainInput:false,fs:1,keys:true,v:2};
const DEFSTATS=()=>({modes:{},att:0,pass:0,words:0,chars:0,time:0,accSum:0,keys:0,bs:0,wpmSum:0,wpmN:0,bestWpm:0,bestBurst:0,flawless:0,rhythmSum:0,rhythmN:0,hes:0,longestPause:0,
missed:{},typos:{},fails:{},slipSum:0,slipN:0,recAtt:0,recPass:0,bldAtt:0,bldPass:0,hours:{},cps:0,hist:[],retries:0,tasks:0,firstLetter:0,firstLetterN:0,taskMs:{build:[0,0],para:[0,0],essay:[0,0]}});
const DEFSTATE=()=>({startG:0,g:0,ti:0,learned:[],started:false,stats:DEFSTATS()});
/* ---- validation: storage and imported backups are untrusted input ---- */
const okId=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,40}$/.test(v);
const num=v=>{v=Number(v);return Number.isFinite(v)?v:0};
function cleanLib(list){
return (Array.isArray(list)?list:[]).filter(e=>e&&okId(e.id)&&e.id!=='sample'&&typeof e.text==='string').slice(0,200).map(e=>({
id:e.id,title:String(e.title||'Essay').slice(0,60),text:e.text.slice(0,200000),kind:e.kind==='creative'?'creative':'essay',
src:typeof e.src==='string'?e.src.slice(0,80):undefined,updated:num(e.updated),
// sync bookkeeping (js/sync): the text's revision hash and its edit version. Kept, so a reload doesn't reset the
// version and let an older title from another device win
rev:typeof e.rev==='string'&&/^r[0-9a-f]{1,32}$/.test(e.rev)?e.rev:undefined,ver:Number.isInteger(e.ver)&&e.ver>=0&&e.ver<1e9?e.ver:undefined}));
}
function cleanState(st){
if(!st||typeof st!=='object')return null;
const d=DEFSTATE(),s=st.stats&&typeof st.stats==='object'?st.stats:{},o={...d.stats};
for(const k of Object.keys(d.stats)){if(typeof d.stats[k]==='number')o[k]=num(s[k])}
const map=(m,max)=>{const r={};if(m&&typeof m==='object')for(const[k,v]of Object.entries(m).slice(0,max))r[String(k).slice(0,80)]=num(v);return r};
o.missed=map(s.missed,2000);o.typos=map(s.typos,2000);o.fails=map(s.fails,2000);
o.hours={};if(s.hours&&typeof s.hours==='object')for(const[k,v]of Object.entries(s.hours))if(/^\d{1,2}$/.test(k)&&Array.isArray(v))o.hours[k]=[num(v[0]),num(v[1])];
// history entries: [pct, pass] for Standard (legacy entries have no mode and are Standard), [pct, pass, mode] otherwise
o.hist=(Array.isArray(s.hist)?s.hist:[]).slice(-60).map(h=>{const e=[Math.max(0,Math.min(100,num(h&&h[0]))),h&&h[1]?1:0],m=h&&h[2];return m&&m!=='standard'&&RecallEngine.MODES[m]?[...e,m]:e});
o.modes={};if(s.modes&&typeof s.modes==='object')for(const m of Object.keys(RecallEngine.MODES)){const v=s.modes[m];if(v&&typeof v==='object')o.modes[m]={att:num(v.att),pass:num(v.pass),accSum:num(v.accSum)}}
o.taskMs={};for(const t of['build','para','essay']){const v=s.taskMs&&s.taskMs[t];o.taskMs[t]=[num(v&&v[0]),num(v&&v[1])]}
const g=st.game&&typeof st.game==='object'?{level:Math.max(0,num(st.game.level)|0),coins:Math.max(0,num(st.game.coins)|0),marks:{}}:undefined;
if(g&&st.game.marks&&typeof st.game.marks==='object')for(const[k,v]of Object.entries(st.game.marks))if(/^\d+$/.test(k)&&['step','flag','castle'].includes(v))g.marks[k]=v;
return{startG:Math.max(0,num(st.startG)|0),g:Math.max(0,num(st.g)|0),ti:Math.max(0,num(st.ti)|0),learned:(Array.isArray(st.learned)?st.learned:[]).map(Boolean),
started:!!st.started,nS:num(st.nS),stats:o,game:g,resetAt:num(st.resetAt),epoch:Math.max(0,num(st.epoch)|0),rev:typeof st.rev==='string'&&/^r[0-9a-f]{1,32}$/.test(st.rev)?st.rev:undefined,part:st.part&&typeof st.part==='object'?{g:Math.max(0,num(st.part.g)|0),w:Math.max(0,num(st.part.w)|0)}:null,posAt:Math.max(0,num(st.posAt)),
// handwriting (beta) keeps its own statistics; it never changes the typing ones
hw:(()=>{const h=st.hw&&typeof st.hw==='object'?st.hw:{};return{att:Math.max(0,num(h.att)|0),pass:Math.max(0,num(h.pass)|0),words:Math.max(0,num(h.words)),secs:Math.max(0,num(h.secs)),strokes:Math.max(0,num(h.strokes)|0),bestWpm:Math.max(0,num(h.bestWpm))}})()};
}
/* settings from storage or a backup file are untrusted: whitelist, type-check and clamp every field (idempotent) */
function cleanSettings(raw){
const o={...DEFSET,...(raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{})};
for(const k of Object.keys(o))if(!(k in DEFSET)&&!['choice','gamify','preGame'].includes(k))delete o[k]; // unknown keys dropped

if(typeof o.choice!=='boolean')o.choice=null;
o.hidden=(Array.isArray(o.hidden)?o.hidden:[]).filter(x=>typeof x==='string');
['delay','strict','phrase'].forEach(k=>{o[k]=num(o[k])||DEFSET[k]});
// validate everything else read back from storage (it is untrusted input)
o.delay=Math.min(4,Math.max(.5,o.delay));o.strict=Math.min(100,Math.max(60,o.strict));o.phrase=Math.min(7,Math.max(2,o.phrase|0));
o.mode=RecallEngine.modeOf(o.mode);
if(typeof o.reduce!=='boolean')o.reduce=null;
for(const k of ['essay','hide','motion','focus','hc','plainInput','keys'])o[k]=typeof o[k]==='boolean'?o[k]:DEFSET[k];
o.fs=Math.min(1.4,Math.max(.9,num(o.fs)||1));
if(o.view!=='mem'&&o.view!=='guide')o.view='mem';
if(typeof o.gsec!=='string'||!/^[A-Za-z]{1,20}$/.test(o.gsec))o.gsec='common';
o.hidden=o.hidden.filter(x=>x!=='settings'); // settings moved from a side panel into its own window
o.v=2;
o.gamify=!!o.gamify;if(o.preGame!==undefined&&!(Array.isArray(o.preGame)&&o.preGame.every(x=>typeof x==='string')))delete o.preGame;
return o;
}
let SET=cleanSettings(ls.get('settings'));
// beta: Focus is on by default. It's kept separately, because the beta shares saved settings with the main site
// and turning it on here shouldn't change the main site.
const MAIN_FOCUS=SET.focus;
{let b=null;try{b=localStorage.getItem('essayRecall2.betaFocus')}catch(_){}SET.focus=b!=='0'}
const storeSET=()=>{try{localStorage.setItem('essayRecall2.betaFocus',SET.focus?'1':'0')}catch(_){}return {...SET,focus:MAIN_FOCUS}};
let LIB=cleanLib(ls.get('lib'));
let ACTIVE=okId(ls.get('active'))?ls.get('active'):'sample';
let S=null;
const essayText=id=>id==='sample'?RAW:(LIB.find(e=>e.id===id)||{}).text;
const essayKind=id=>id==='sample'?'essay':(LIB.find(e=>e.id===id)||{}).kind||'essay';
/* words memorised: whole learnt sentences, plus the chunks already passed in the sentence being built */
function learnedWords(){
let w=SENTS.reduce((a,x,g)=>a+(S.learned[g]?x.wc:0),0);
if(S.part&&SENTS[S.part.g]&&!S.learned[S.part.g])w+=Math.min(S.part.w,SENTS[S.part.g].wc);
return w;
}
// another tab saved this essay: keep both tabs' progress instead of the older tab overwriting it
addEventListener('storage',e=>{
if(!S||e.key!==NS+'state.'+ACTIVE||!e.newValue)return;
let inc;try{inc=cleanState(JSON.parse(e.newValue))}catch(_){return}if(!inc)return;
if((inc.resetAt||0)>(S.resetAt||0)){S=inc;loadTask();return}   // a reset in the other tab wins
inc.learned.forEach((v,g)=>{if(v)S.learned[g]=true});
// position: the most recent move wins (so going back in one tab sticks); older saves without a move time: furthest wins
const newer=(inc.posAt||S.posAt)?(inc.posAt||0)>(S.posAt||0):(inc.g>S.g||(inc.g===S.g&&inc.ti>S.ti));
if(newer&&(inc.g!==S.g||inc.ti!==S.ti)){S.g=inc.g;S.ti=inc.ti;S.posAt=inc.posAt||0;S.started=true;adoptPos();if(!answering())loadTask()}
if(inc.part&&(!S.part||inc.part.g>S.part.g||(inc.part.g===S.part.g&&inc.part.w>S.part.w)))S.part=inc.part;
renderSide();
});
let saveWarned=false;
function lsTry(k,v){try{localStorage.setItem(NS+k,JSON.stringify(v));if(self.RecallSyncHook)try{RecallSyncHook(k)}catch(_){}return true}catch(e){
if(!saveWarned){saveWarned=true;setTimeout(()=>{toast('Couldn’t save progress: browser storage is full or blocked');announce('Could not save progress: browser storage is full or blocked.',true)},0)}return false}}
/* When the student moves (next step, back, a sentence picked on the map, a new start point), record the time,
   so sync and other tabs can tell a deliberate move back from an older save. */
let POS=null;
function adoptPos(){if(S)POS={id:ACTIVE,g:S.g,ti:S.ti}} // take the current position as already known (loads, merges)
function stampPos(){if(!S)return;if(POS&&POS.id===ACTIVE&&(POS.g!==S.g||POS.ti!==S.ti))S.posAt=Date.now();if(!POS||POS.id!==ACTIVE||POS.g!==S.g||POS.ti!==S.ti)adoptPos()}
const save=()=>{if(S){stampPos();S.nS=SENTS.length;lsTry('state.'+ACTIVE,S)}lsTry('settings',storeSET());lsTry('active',ACTIVE)};
const saveSettings=()=>{lsTry('settings',storeSET());lsTry('active',ACTIVE)};
addEventListener('pagehide',()=>save());
function loadEssay(id){
if(!allEssays().some(e=>e.id===id))id=allEssays()[0].id;let text=essayText(id);
ACTIVE=id;
({paras:PARAS,sents:SENTS,pstart:PSTART,total:TOTALW,formulaic:FORMULAIC}=parseEssay(text,essayKind(id)));
TOTALW=TOTALW||1;
{let inside=false;QSTART=SENTS.map(x=>{const q=inside;inside=endsInsideQuote(x.text,inside);return q})}
invalidateMarking();
S=cleanState(ls.get('state.'+id))||DEFSTATE();
if(S.g>SENTS.length)S.g=0;
// repair: long (two-half) sentences already moved past used to stay uncounted unless the whole-sentence recall
// was passed too, so the % and sentence map lagged behind. Count every one behind the current position.
for(let g=Math.min(S.startG,S.g);g<Math.min(S.g,SENTS.length);g++)if(g>=S.startG&&!S.learned[g]&&splitSentence(SENTS[g].text))S.learned[g]=true;
// repair: map clicks used to move the start point, which cut earlier parts out of essay recalls. If everything before
// the start point is learnt, the student knows it, so recalls go back to covering the whole essay.
if(S.startG>0&&S.startG<=SENTS.length){let all=true;for(let k=0;k<S.startG;k++)if(!S.learned[k]){all=false;break}if(all)S.startG=0}
adoptPos();
}

/* ---------- task flow ---------- */
let queue=[],task=null,phase='type',typed='',t0=0,tries=0,lastKey=0,idleT=0,autoT=0;
let L=null; // live telemetry for the current attempt
/* The student is in the middle of something that a background reload of the step (cloud sync, another tab, an update)
   must not throw away: a typed or HANDWRITTEN answer in progress, marking, or the marked result on screen. */
function answering(){if(phase==='type')return!!((typeof typed==='string'&&typed.trim())||(self.HW&&HW.hasInk&&HW.hasInk()));return phase!=='done'}
const newLive=()=>({keys:0,bs:0,ins:[],gaps:[],hes:0,longest:0,samples:[],peak:0,acc:null,accAt:0});
const $=id=>document.getElementById(id);
const ta=$('ta'),typebox=$('typebox'),typedEl=$('typed'),mark=$('mark'),caret=$('caret'),prompt=$('prompt'),foot=$('foot');
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// Apple keyboards (Mac, iPad Magic Keyboard): shortcuts use Control (⌃), never ⌘, so ⌘H/⌘P/⌘O keep their system meaning
const IS_APPLE=/Mac|iPhone|iPad|iPod/.test(navigator.platform||'')||/Macintosh/.test(navigator.userAgent)&&navigator.maxTouchPoints>0;
const CTRL=IS_APPLE?'⌃':'Ctrl';
let passT=0,rep1Pct=null; // pending auto-advance after a passed build chunk
const ROLE={ts:'Topic sentence',quote:'Quote',analysis:'Analysis',lead:'Lead-in',context:'Point',heading:'Heading',line:'Line',prose:'Prose',anecdote:'Narrative',reflect:'Reflection',question:'Question',turn:'Turn'};
const RCLS={ts:'ts',quote:'quote',analysis:'an',lead:'lead',context:'context',heading:'ts',line:'lead',prose:'context',anecdote:'lead',reflect:'context',question:'quote',turn:'ts'};

function loadTask(fresh=true){
if(self.HW)HW.task();
if(!SENTS.length){showEmpty();return}
if(S.g>=SENTS.length){showDone();return}
queue=buildQueue(S.g);
if(S.ti>=queue.length)S.ti=0;
task=queue[S.ti];
if(fresh)tries=0;
clearTimeout(passT);passT=0;invalidateMarking();attemptMode=modeOf(SET.mode);
phase='type';typed='';ta.value='';t0=0;L=newLive();cIdx=0;
typebox.classList.remove('ok','bad');
renderHead();renderPrompt();renderTyped();renderFoot();renderQueue();renderSide();renderLive();Game.task(task);renderChoices();
ta.setAttribute('aria-label','Your answer · '+$('chip').textContent);
announce($('chip').textContent+'. '+(task.type==='build'?'Type: '+task.text:(prompt.querySelector('h3')||{}).textContent||''));
focusTa();save();
}
function focusTa(){if(typeof choiceOn==='function'&&choiceOn())return;if(document.body.classList.contains('hw'))return; // handwriting: no on-screen keyboard
if($('setModal').hidden&&$('upModal').hidden&&$('modal').hidden&&$('essayModal').hidden&&$('howto').hidden&&SET.view==='mem')ta.focus({preventScroll:true})}
function renderHead(){
gbHud();
const mb=$('modeBadge');if(mb)mb.textContent=attemptMode!=='standard'?MODES[attemptMode].label:'';
const x=SENTS[S.g],chip=$('chip');
chip.className='chip'+(task.type==='para'||task.type==='unit'||task.type==='sent'||task.type==='motif'?' para':task.type==='essay'?' essay':'');
chip.textContent=task.type==='build'?(task.half?`Half ${task.half} of 2 · chunk ${task.k}/${task.n}`:`Build · chunk ${task.k}/${task.n}`):task.type==='motif'?'Motif':task.type==='sent'?'Whole sentence':task.type==='unit'?unitLabel(task,true):task.type==='para'?(task.rep===1?'Full paragraph':task.rep===2?'Full paragraph · again':'Paragraph so far'):(essayKind(ACTIVE)==='creative'?'Whole piece so far':'Whole essay so far');
$('ctx').innerHTML=`¶${x.p+1} · Sentence ${x.s+1} of ${PARAS[x.p].length} <span class="rt ${RCLS[x.role]}">${ROLE[x.role]}</span>`;
$('tools').style.display='';
$('btnBack').disabled=S.g===0&&S.ti===0;$('btnHint').disabled=false;
}
// "IQTVE" for quote + evaluation units in essays; neutral wording for intros, conclusions and creative pieces
function unitLabel(t,short){
const kind=essayKind(ACTIVE);
if(kind==='creative'){
let a=0,r=0;for(let g=t.a;g<=t.b;g++){const ro=SENTS[g].role;if(ro==='anecdote')a++;else if(['reflect','question','turn','line'].includes(ro))r++}
const nm=a&&r?'narrative + reflection':a?'narrative':r?'reflection':'passage';
return short?nm[0].toUpperCase()+nm.slice(1)+(t.done?'':' so far'):`Type the ${nm}${t.done?'':' so far'}`;
}
const creative=kind==='creative';
const iq=t.iq&&!creative&&FORMULAIC,ev=t.iq&&!creative&&!FORMULAIC;
const name=creative?'passage':iq?'IQTVE':ev?'quote + analysis':'section';
if(short)return (creative?'Passage':iq?'IQTVE':ev?'Quote + analysis':'Section')+(t.done?'':' so far');
return `Type the ${name}${t.done?'':' so far'}`;
}
function describeRange(t){
const A=SENTS[t.a],B=SENTS[t.b];
if(A.p===B.p)return `¶${A.p+1}, sentence${A.s===B.s?'':'s'} ${A.s+1}${A.s===B.s?'':'–'+(B.s+1)}`;
return `¶${A.p+1}.${A.s+1} → ¶${B.p+1}.${B.s+1}`;
}
function renderPrompt(){
prompt.classList.remove('veil');
prompt.classList.remove('enter');void prompt.offsetWidth;prompt.classList.add('enter');
if(task.type==='build'){
prompt.innerHTML=task.shown.map((p,i)=>i===task.shown.length-1?`<mark>${esc(p)}</mark>`:`<span class="old">${esc(p)}</span>`).join(' ')+
(task.next?` <span class="nextc" aria-hidden="true" title="Coming next: no need to memorise yet">${esc(task.next)}${task.k+1<task.n?' …':''}</span>`:'')+
(task.half===2&&task.k===1?`<div class="phint">…after “${esc(task.pre.split(/\s+/).slice(-3).join(' '))}”</div>`:'');
}else{
const first=items(task.text).filter(i=>i.norm).slice(0,2).map(i=>i.orig).join(' ');
const title=task.type==='motif'?`Where did “${esc(task.phrase)}” first come up?`:task.type==='sent'?'Type the whole sentence':task.type==='essay'?(essayKind(ACTIVE)==='creative'?'Type the whole piece so far':'Type the whole essay so far'):task.type==='unit'?unitLabel(task):task.rep===1?'Type the full paragraph':task.rep===2?'Once more, no cue':'Type the paragraph so far';
prompt.innerHTML=`<div class="recall"><div class="ico"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></div>
<div><h3>${title}</h3><p>From memory · ${describeRange(task)} · ${task.T.length} words</p>${task.rep===2?`<p>No hints this time.${rep1Pct!=null?` Last go: <b>${rep1Pct}%</b>.`:''}</p>`:`<p>Starts with <span class="cue">${esc(first)}…</span></p>`}</div></div>`;
}
}
function renderTyped(){
typedEl.textContent=typed;
typebox.classList.toggle('empty',!typed);
$('phd').textContent=task&&task.type==='build'?'Start typing…':'Type from memory…';
requestAnimationFrame(placeCaret);
const U=tokens(typed).length,N=task?task.T.length:1;
$('meterFill').style.width=Math.min(100,U/N*100)+'%';
const wc=document.querySelector('.foot .wc');if(wc)wc.textContent=`${U} / ${N} words`;
}
function placeCaret(){
// centre the caret on the marker's own text box, so it lines up whatever the font or line height
const y=mark.offsetTop+(mark.offsetHeight-caret.offsetHeight)/2;
caret.style.transform=`translate(${mark.offsetLeft}px,${Math.round(y)}px)`;
const over=mark.offsetTop+44-typebox.clientHeight;
if(over>typebox.scrollTop)typebox.scrollTop=over;
}
function renderFoot(extra){
if(phase==='type'){
foot.innerHTML=`<span class="wc"></span><span class="spacer"></span><span class="khint"><kbd>Enter</kbd> check <span class="dotsep">·</span> <kbd>${CTRL}</kbd><kbd>/</kbd> shortcuts</span>`;
renderTyped();
}else foot.innerHTML=extra;
}
function renderQueue(){
$('queue').innerHTML='<span class="lbl">This sentence</span>'+queue.map((t,i)=>{
const l=t.type==='build'?(t.gk||t.k):t.type==='motif'?'Motif':t.type==='sent'?'Sentence':t.type==='unit'?unitLabel(t,true):t.type==='para'?(t.rep===1?'Full ¶':t.rep===2?'Again':'¶ so far'):'Essay';
const tt=t.type==='build'?`${t.half?'Half '+t.half+' · ':''}Chunk ${t.k}/${t.n}: ${t.shown[t.shown.length-1]}`:t.type==='motif'?`Motif: “${t.phrase}”`:t.type==='sent'?'Whole sentence recall':t.type==='unit'?unitLabel(t):t.type==='para'?'Paragraph recall':'Whole essay recall';
return `<button class="q ${i<S.ti?'done':''} ${i===S.ti?'cur':''}" data-i="${i}" title="${esc(tt)}">${l}</button>`;
}).join('');
}
$('queue').addEventListener('click',e=>{const b=e.target.closest('.q');if(!b)return;S.ti=+b.dataset.i;loadTask()});

ta.addEventListener('input',e=>{
if(phase!=='type'){ta.value=typed;return}
const now=performance.now();
if(!t0)t0=now;
if(lastKey){
const gap=now-lastKey;
if(gap<20000)S.stats.time+=gap/1000;
if(L.keys>0){L.gaps.push(gap);if(L.gaps.length>80)L.gaps.shift();if(gap>1200)L.hes++;L.longest=Math.max(L.longest,gap)}
}
lastKey=now;window.__lastKey=now;
const del=(e.inputType||'').startsWith('delete');
L.keys++;if(del)L.bs++;else{const n=(e.data||' ').length;for(let i=0;i<n;i++)L.ins.push(now)}
typed=ta.value.replace(/\s*\n\s*/g,' ');
if(e.isComposing||composing){renderTyped();return}
if(task.type==='build'&&SET.hide&&typed.length)prompt.classList.add('veil');
typebox.classList.remove('idle');clearTimeout(idleT);idleT=setTimeout(()=>typebox.classList.add('idle'),600);
renderTyped();
Pet.event('type');
if(motionOn()&&window.bgPulse){const r=caret.getBoundingClientRect();bgPulse(r.left,r.top+10,del?'239,68,68':'56,189,248',del?.5:.35)}
clearTimeout(autoT);
const U=tokens(typed),T=task.T;
Game.progress(U.length/T.length);
if(U.length>=T.length&&U[U.length-1]===T[T.length-1])autoT=setTimeout(()=>{if(phase==='type')check()},180);
// typing ahead: once the target's last word is in, check after a short pause
else if(U.length>T.length&&U.slice(T.length-2).includes(T[T.length-1]))autoT=setTimeout(()=>{if(phase==='type')check()},650);
});
ta.addEventListener('compositionstart',()=>{composing=true;clearTimeout(autoT)});
ta.addEventListener('compositionend',()=>{composing=false;ta.dispatchEvent(new Event('input'))});
ta.addEventListener('focus',()=>typebox.classList.add('focus','idle'));
ta.addEventListener('blur',()=>typebox.classList.remove('focus'));
typebox.addEventListener('mousedown',e=>{e.preventDefault();focusTa()});
$('card').addEventListener('click',e=>{if(!e.target.closest('button'))focusTa()});

document.addEventListener('keydown',e=>{
if(SET.view!=='mem'||!$('howto').hidden)return;
if(e.target.id==='essaySel')return;
if(!$('upModal').hidden||!$('setModal').hidden)return;
if(!$('essayModal').hidden){if(e.key==='Escape')closeEssay();return}
if(!$('cfModal').hidden)return;
if(!$('modal').hidden){if(e.key==='Escape')$('bCloseStart').click();return}
if(e.target.closest&&e.target.closest('.panel[data-panel=settings],.menu-pop'))return;
if((e.key==='Enter'||e.key===' ')&&e.target!==ta&&e.target.closest&&e.target.closest('button,a[href],input,select,textarea,summary,[role=button],[role=radio]'))return;
// shortcuts use e.code so they still work when Option/Alt or a non-US layout changes e.key
const ctl=e.ctrlKey&&!e.altKey&&SET.keys,K=e.code;
if(ctl&&K==='Slash'){e.preventDefault();toggleKeys();return}
if(e.key==='Escape'&&!$('keysPop').hidden){e.preventDefault();toggleKeys(false);return}
if(ctl&&(K==='KeyP'||K==='KeyO')){e.preventDefault();if(!e.repeat)peek(K==='KeyP'?'para':'essay');return}
if((ctl||e.metaKey&&!e.altKey)&&K==='KeyZ'&&!e.shiftKey){
// typing still in the box → normal undo; otherwise step back
if(phase==='type'&&ta.value.length&&document.activeElement===ta)return;
e.preventDefault();back();return;
}
if(phase==='type'&&choiceOn()&&SET.keys&&!e.ctrlKey&&!e.metaKey&&!e.altKey){
if(/^Digit[1-3]$/.test(K)){e.preventDefault();pick($('chRow').children[+K.slice(5)-1]);return}
if(e.key==='Backspace'){e.preventDefault();$('chUndo').click();return}
}
if(phase==='type'){
if(e.key==='Enter'){if(e.isComposing||composing)return;e.preventDefault();if(typed.trim())check()}
else if(ctl&&K==='KeyH'){e.preventDefault();hint()}
else if(document.activeElement!==ta&&e.key.length===1&&!e.ctrlKey&&!e.metaKey)focusTa();
}else if(phase==='fail'){
if(e.key==='Enter'){e.preventDefault();retry()}
else if(e.key==='Tab'&&!e.shiftKey&&(document.activeElement===ta||document.activeElement===document.body)){e.preventDefault();skip()}
else if(document.activeElement===ta)e.preventDefault();
}else if(phase==='ok'||phase==='review'){
if(e.key==='Enter'){e.preventDefault();advance()}
else if(document.activeElement===ta)e.preventDefault();
}
});
document.addEventListener('keyup',e=>{if(peekOn&&(e.code==='KeyP'||e.code==='KeyO'||e.key==='Control'))unpeek()});
window.addEventListener('blur',()=>{if(peekOn)unpeek()});

/* ---------- hold-to-peek: paragraph / whole essay so far, the part being tested in blue ---------- */
let peekOn=null;
function peek(kind){
if(!task||phase==='done'||!SENTS.length)return;
const disc=essayKind(ACTIVE)==='creative',x=SENTS[S.g],whole=kind!=='para',a=whole?0:PSTART[x.p],b=whole?SENTS.length-1:S.g; // the essay peek shows everything
let html='',cur=-1;
for(let g=a;g<=b;g++){
const s=SENTS[g];
if(s.p!==cur){if(cur>=0)html+='</p>';html+='<p>';cur=s.p}
// the current sentence is only revealed up to what the student has been shown so far
let t=s.text;if(!whole&&g===S.g&&task.type==='build')t=(task.pre?task.pre+' ':'')+task.text;
const hl=g>=task.a&&g<=task.b;
const inner=hl?`<mark>${esc(t)}</mark>`:g>S.g?`<span class="pv-ahead">${esc(t)}</span>`:esc(t);
html+=(disc&&ROLE[s.role]?`<span class="pm-${s.role}" title="${ROLE[s.role]}">${inner}</span>`:inner)+' ';
}
html+='</p>';
const o=$('peekView');
o.querySelector('.pv-h').textContent=kind==='para'?`Paragraph ${x.p+1} so far`:(disc?'Whole piece':'Whole essay');
o.querySelector('.pv-b').innerHTML=html;
o.querySelector('.pv-f').innerHTML='Let go to hide'+(disc?'<span class="pv-key"><span><i style="background:#a78bfa"></i>narrative</span><span><i style="background:#38bdf8"></i>reflection</span><span><i style="background:#f59e0b"></i>question</span><span><i style="background:#22c55e"></i>turn</span></span>':'');
o.hidden=false;peekOn=kind;
const m=o.querySelector('mark');if(m)m.scrollIntoView({block:whole?'center':'nearest'});
}
function unpeek(){peekOn=null;$('peekView').hidden=true;document.querySelectorAll('.tb.held').forEach(b=>b.classList.remove('held'));focusTa()}
for(const [id,k] of [['btnPeekP','para'],['btnPeekE','essay']]){
const b=$(id);
b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);b.classList.add('held');peek(k)});
for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>{if(peekOn)unpeek()});
b.addEventListener('contextmenu',e=>e.preventDefault());
}
$('btnBack').onclick=back;
/* in-screen readout for game mode on phones: level and sentence (e.g. LV 20 · 3/6) */
function gbHud(){const el=$('gbHud');if(!el||!SENTS[S.g])return;const x=SENTS[S.g];el.textContent=`LV ${(S.game&&S.game.level)|0} · ${x.s+1}/${PARAS[x.p].length}`}

/* ---------- live telemetry ---------- */
function liveCalc(){
const now=performance.now(),el=t0?(now-t0)/1000:0;
const wpm=el>0.5?typed.length/5/(el/60):0;
const recent=L.ins.filter(t=>now-t<3000).length,burst=recent/5*20;
const g=L.gaps.slice(-40),mean=g.length?g.reduce((a,b)=>a+b,0)/g.length:0;
const sd=g.length>2?Math.sqrt(g.reduce((a,b)=>a+(b-mean)**2,0)/g.length):0;
const rhythm=g.length>4?Math.max(0,Math.round(100-(sd/mean)*60)):null;
const U=tokens(typed);
if(now-L.accAt>400&&U.length&&phase==='type'){L.accAt=now;const L0=L,tok=markSeq;
  COMPUTE.run('live',{text:task.text,typed,mode:attemptMode,startInside:taskQuoteStart(task)},{channel:'live',size:U.length})
    .then(v=>{if(v!==COMPUTE.STALE&&L===L0&&tok===markSeq)L.acc=v}).catch(()=>{})}
const left=Math.max(0,task.T.length-U.length),eta=wpm>3?left/(wpm)*60:null;
return{wpm,burst,rhythm,mean,el,left,eta,U:U.length,pause:lastKey&&t0?now-lastKey:0};
}
const fmtS=s=>s==null?'—':s<60?s.toFixed(s<10?1:0)+'s':`${Math.floor(s/60)}m ${Math.round(s%60)}s`;
function renderLive(){
if(!L||!task)return;
const c=liveCalc(),typing=phase==='type'&&t0&&c.pause<1500;
$('liveDot').classList.toggle('on',!!typing);
$('lWpm').textContent=Math.round(c.wpm);
$('lPeak').textContent=L.peak?`peak burst ${Math.round(L.peak)}`:'';
const cells=[
['Burst (3s)',Math.round(c.burst)+' <small>wpm</small>'],
['Live match',L.acc==null?'—':Math.round(L.acc*100)+'%'],
['Rhythm',c.rhythm==null?'—':c.rhythm+'<small>/100</small>'],
['Avg key gap',c.mean?Math.round(c.mean)+' <small>ms</small>':'—'],
['Backspaces',`${L.bs} <small>${L.keys?Math.round(L.bs/L.keys*100):0}%</small>`],
['Hesitations',L.hes+' <small>&gt;1.2s</small>'],
['Current pause',fmtS(c.pause/1000)],
['Longest pause',fmtS(L.longest/1000)],
['Words left',c.left],
['Finish in',fmtS(c.eta)],
];
$('liveKv').innerHTML=cells.map(([k,v])=>`<div class="k"><div class="l">${k}</div><div class="v">${v}</div></div>`).join('');
$('hud').innerHTML=`<span><b>${Math.round(c.wpm)}</b>wpm</span><span><b>${Math.round(c.burst)}</b>burst</span><span><b>${L.acc==null?'—':Math.round(L.acc*100)+'%'}</b>match</span><span><b>${c.rhythm??'—'}</b>rhythm</span><span><b>${c.left}</b>words left</span>`;
drawSpark();
}
function drawSpark(){
const cv=$('spark');if(!cv.offsetWidth)return;
const dpr=Math.min(2,devicePixelRatio||1),w=cv.offsetWidth,h=cv.offsetHeight;
if(cv.width!==w*dpr){cv.width=w*dpr;cv.height=h*dpr}
const x=cv.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,w,h);
const s=L.samples;
x.strokeStyle='#e3edf8';x.lineWidth=1;x.setLineDash([3,4]);x.beginPath();x.moveTo(0,h-1);x.lineTo(w,h-1);x.stroke();x.setLineDash([]);
if(s.length<2){x.fillStyle='#94a3b8';x.font='11px Inter';x.fillText('your speed shows up here as you type',4,h/2+4);return}
const mx=Math.max(40,...s.map(v=>v.b),...s.map(v=>v.w))*1.1,N=Math.max(s.length,30),px=i=>i/(N-1)*w,py=v=>h-3-(v/mx)*(h-8);
x.beginPath();s.forEach((v,i)=>i?x.lineTo(px(i),py(v.b)):x.moveTo(px(i),py(v.b)));
x.strokeStyle='rgba(124,58,237,.45)';x.lineWidth=1.2;x.stroke();
const gr=x.createLinearGradient(0,0,0,h);gr.addColorStop(0,'rgba(14,165,233,.28)');gr.addColorStop(1,'rgba(14,165,233,0)');
x.beginPath();s.forEach((v,i)=>i?x.lineTo(px(i),py(v.w)):x.moveTo(px(i),py(v.w)));
x.lineTo(px(s.length-1),h);x.lineTo(0,h);x.closePath();x.fillStyle=gr;x.fill();
x.beginPath();s.forEach((v,i)=>i?x.lineTo(px(i),py(v.w)):x.moveTo(px(i),py(v.w)));
x.strokeStyle='#0ea5e9';x.lineWidth=2;x.lineJoin='round';x.stroke();
const l=s[s.length-1];x.beginPath();x.arc(px(s.length-1),py(l.w),3,0,7);x.fillStyle='#0ea5e9';x.fill();
}
setInterval(()=>{
if(SET.view!=='mem'||!L||!task)return;
if(phase==='type'&&t0){const c=liveCalc();L.samples.push({w:c.wpm,b:c.burst});if(L.samples.length>120)L.samples.shift();L.peak=Math.max(L.peak,c.burst)}
renderLive();
},500);

/* ---------- check ---------- */
function sentenceAtToken(t,idx){
let acc=0;for(let g=t.a;g<=t.b;g++){acc+=SENTS[g].wc;if(idx<acc)return g}return t.b;
}
function check(){
if(phase!=='type'||!task||composing)return;
clearTimeout(autoT);
const myTask=task,myTyped=typed,essay=ACTIVE,epoch=S.resetAt||0,token=++markSeq;
const payload={text:myTask.text,typed:myTyped,mode:attemptMode,strict:SET.strict,startInside:taskQuoteStart(myTask)};
phase='marking';typebox.classList.add('marking');
const apply=res=>{
  if(res===COMPUTE.STALE||token!==markSeq||task!==myTask||ACTIVE!==essay||(S.resetAt||0)!==epoch||phase!=='marking')return; // out of date: ignore
  typebox.classList.remove('marking');finishCheck(res,myTyped);
};
COMPUTE.run('mark',payload,{channel:'mark',size:myTask.T.length}).then(apply,()=>apply(markAttempt(payload)));
}
function finishCheck(res,typedNow){
const st=S.stats,U=res.U,T=res.T,r=res.r,mode=res.mode;typed=typedNow;
const secs=Math.max(1,(performance.now()-(t0||performance.now()))/1000),wpm=Math.round(typed.length/5/(secs/60));
st.att++;tries++;S.started=true;st.words+=U.length;st.chars+=typed.length;st.accSum+=r.acc;st.keys+=L.keys;st.bs+=L.bs;st.hes+=L.hes;
st.longestPause=Math.max(st.longestPause,L.longest);st.bestBurst=Math.max(st.bestBurst,Math.round(L.peak));
const lc=liveCalc();if(lc.rhythm!=null){st.rhythmSum+=lc.rhythm;st.rhythmN++}
// word-level forensics
let run=0,firstErr=-1;
for(const o of r.ops){
if(o.op==='ok'){run++;st.flawless=Math.max(st.flawless,run);continue}
run=0;
if(o.op!=='ins'){
if(firstErr<0)firstErr=o.t;
const w=T[o.t];if(w.length>2)st.missed[w]=(st.missed[w]||0)+1;
if(o.op==='sub'){const k=U[o.u]+'→'+w;st.typos[k]=(st.typos[k]||0)+1}
}
}
if(task.type!=='build'){st.slipSum+=firstErr<0?1:firstErr/T.length;st.slipN++}
if(U.length&&T.length){st.firstLetterN++;if(U[0][0]===T[0][0])st.firstLetter++}
const h=new Date().getHours();st.hours[h]=st.hours[h]||[0,0];st.hours[h][0]+=r.acc;st.hours[h][1]++;
const tm=st.taskMs[task.type==='unit'||task.type==='sent'||task.type==='motif'?'para':task.type];tm[0]+=secs/Math.max(1,task.T.length);tm[1]++;
const pass=res.pass;
// per-mode tallies, so stricter modes are never averaged in with Standard
const mm=st.modes[mode]||(st.modes[mode]={att:0,pass:0,accSum:0});mm.att++;mm.accSum+=r.acc;if(pass)mm.pass++;
if(tries===1){if(task.type==='build'){st.bldAtt++;if(pass)st.bldPass++}else{st.recAtt++;if(pass)st.recPass++}}else st.retries++;
st.hist.push(mode==='standard'?[Math.round(r.acc*100),pass?1:0]:[Math.round(r.acc*100),pass?1:0,mode]);if(st.hist.length>60)st.hist.shift();
const pct=Math.round(r.acc*100),card=$('card');if(task.rep===1)rep1Pct=pct;$('choices').hidden=true;
card.classList.remove('flash-ok','flash-bad');void card.offsetWidth;
if(pass){
st.pass++;st.tasks++;if(task.type==='essay')st.cps++;if(self.track){track('study');if(task.type==='para')track('paragraph-recall');if(task.type==='essay')track('essay-recall')}
if(U.length>=4){st.wpmSum+=wpm;st.wpmN++;st.bestWpm=Math.max(st.bestWpm,wpm)}
// a sentence counts as learned once it has been built right to the end (for a long sentence: the last chunk of half 2);
// the whole-sentence and paragraph recalls after that are consolidation, so skipping one never undoes the progress
if(task.type!=='build'||(task.k===task.n&&(!task.half||task.half===2)))for(let g=task.a;g<=task.b;g++)S.learned[g]=true;
if(task.type==='build'){const w=tokens((task.pre?task.pre+' ':'')+task.text).length;if(!S.part||S.part.g!==task.a||w>S.part.w)S.part={g:task.a,w}} // partial credit
phase='ok';typebox.classList.add('ok');card.classList.add('flash-ok');
Pet.event(task.type==='essay'?'checkpoint':task.rep===2?'para':L.peak>75?'fast':'pass');
Game.pass(task,r.ok);gbHud();
if(motionOn()&&window.bgBurst){const r2=card.getBoundingClientRect();bgBurst(r2.left+r2.width/2,r2.top+r2.height/2)}
showDiff(r,U,true,res);
const stats=`<span class="resmsg ok">✓ ${pct===100?'Perfect':pct+'% match'}</span><span>${wpm} wpm</span><span>${(secs/Math.max(1,task.T.length)).toFixed(2)} s/word</span>${tries>1?`<span>Try ${tries}</span>`:''}<span class="spacer"></span>`;
save();renderSide();
announce(`Passed, ${pct}% match.${task.type==='build'?'':' Press Enter to continue.'}`);
if(task.type==='build'){
// chunks: show the marking for the set delay, then move on (Enter moves on straight away)
renderFoot(stats+`<button class="btn small" id="bCont">Next <kbd>Enter</kbd></button>`);
$('bCont').onclick=advance;
passT=setTimeout(advance,SET.delay*1000);
}else{
// longer recalls: stay on the marking until the student is ready
phase='review';
renderFoot(stats+`<button class="btn small" id="bAgain">Again</button><button class="btn primary small" id="bCont">Continue <kbd>Enter</kbd></button>`);
$('bCont').onclick=advance;$('bAgain').onclick=retry;
}
}else{
const g=firstErr<0?task.b:sentenceAtToken(task,firstErr);st.fails[g]=(st.fails[g]||0)+1;
phase='fail';typebox.classList.add('bad');card.classList.add('flash-bad');Pet.event('fail');Game.fail();
showDiff(r,U,false,res);
const qFail=res.quote&&res.quote.bad.length&&r.acc*100>=SET.strict;
renderFoot(`<span class="resmsg bad">✗ ${pct}% · ${qFail?`${res.quote.bad.length} quote word${res.quote.bad.length>1?'s':''} wrong`:'need '+SET.strict+'%'}</span><span>${firstErr>=0?'First slip at word '+(firstErr+1):''}</span><span class="spacer"></span>
<button class="btn primary small" id="bRetry">Retry <kbd>Enter</kbd></button><button class="btn small" id="bSkip">Skip <kbd>Tab</kbd></button>`);
$('bRetry').onclick=retry;$('bSkip').onclick=skip;
announce(`Not yet: ${pct}% match${qFail?', with a quote slip':''}, need ${SET.strict}%. ${r.ops.filter(o=>o.op==='sub').length} wrong, ${r.ops.filter(o=>o.op==='del').length} missed. Press Enter to retry.`);
save();renderSide();
}
}
function showDiff(r,U,passed,res){
const its=res&&res.mode==='verbatim'?vItems(task.text):items(task.text),cmp=[],qbad=new Set(res&&res.quote?res.quote.bad:[]);its.forEach((it,i)=>{if(it.norm)cmp.push(i)});
let html='',ptr=0;
const plain=it=>it.br?'<span class="br"></span>':`<span class="w">${esc(it.orig)}</span> `;
const flush=k=>{while(ptr<k){html+=plain(its[ptr]);ptr++}};
for(const o of r.ops){
if(o.op==='ins'){const ahead=r.ops.indexOf(o)>=r.ops.length-r.trail;html+=`<span class="w ${ahead?'ahead':'ins'}"${ahead?' title="Typed ahead: not counted"':''}>${esc(U[o.u])}<span class="sr-only"> (${ahead?'typed ahead':'extra'})</span></span> `;continue}
const ii=cmp[o.t];flush(ii);
const it=its[ii];
if(o.op==='ok')html+=`<span class="w">${esc(it.orig)}</span> `;
else if(o.op==='sub')html+=`<span class="w sub${qbad.has(o.t)?' qerr':''}">${esc(it.orig)}<s>${esc(U[o.u])}</s><span class="sr-only"> (you wrote ${esc(U[o.u])})</span></span> `;
else html+=`<span class="w del${qbad.has(o.t)?' qerr':''}">${esc(it.orig)}<span class="sr-only"> (missed)</span></span> `;
ptr=ii+1;
}
flush(its.length);
prompt.classList.remove('veil');
const has=k=>r.ops.some((o,i)=>o.op===k&&(k!=='ins'||i<r.ops.length-r.trail));
const keys=[has('sub')&&'<span><i style="background:#fde68a"></i>wrong word (yours crossed out)</span>',has('del')&&'<span><i style="background:#fecaca"></i>missed</span>',has('ins')&&'<span><i style="background:#e2e8f0"></i>extra</span>',r.trail&&'<span><i class="lg-ahead"></i>typed ahead (doesn’t count)</span>',qbad.size&&'<span><i class="lg-q"></i>quote slip</span>'].filter(Boolean).join('');
const note=passed?(keys?'Passed. Have a quick look at what slipped.':'Nailed it.'):'Have a read, then go again.';
prompt.innerHTML=`<div class="diff">${html}</div><div class="legend">${keys}<span>${note}</span></div>`;
}
function advance(){clearTimeout(passT);passT=0;$('card').classList.remove('flash-ok');if(phase==='ok'||phase==='review')next()}
/* Back one step (Ctrl+Z on an empty box, or the ← button). In the box itself Ctrl+Z keeps its normal
job of undoing typing; it only steps back once there is nothing left to undo, or while marking is shown. */
function back(){
if(phase==='done'||!SENTS.length)return;
clearTimeout(passT);passT=0;clearTimeout(autoT);
if(S.ti>0)S.ti--;
else if(S.g>0){S.g--;S.ti=buildQueue(S.g).length-1}
else return;
loadTask();
const t=$('toast');t.textContent='Back to: '+$('chip').textContent;t.classList.add('show');
clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),1400);
}
function retry(){if(self.HW)HW.task();clearTimeout(passT);passT=0;invalidateMarking();attemptMode=modeOf(SET.mode);phase='type';typed='';ta.value='';t0=0;L=newLive();cIdx=0;typebox.classList.remove('bad','ok');$('card').classList.remove('flash-bad');renderPrompt();renderFoot();renderChoices();focusTa()}
function skip(){clearTimeout(passT);passT=0;next()}
function next(){clearTimeout(passT);passT=0;S.ti++;if(S.ti>=queue.length){S.g++;S.ti=0}loadTask()}
function hint(){
if(phase!=='type')return;
// align what's typed against the target (like the marking does), so a skipped or extra word
// doesn't throw the count off: the next word is the one after the last word you actually matched
const its=items(task.text).filter(i=>i.norm),U=tokens(typed);
let n=0,missed=null;
if(U.length){
// try target prefixes near the typed length and keep the one that matches most words
let r=null;
const off=Math.max(0,U.length-120),Uw=U.slice(off);
for(let k=Math.max(1,U.length-4);k<=Math.min(task.T.length,U.length+4);k++){const x=align(task.T.slice(off,k),Uw);x.ops.forEach(o=>{if(o.t!=null)o.t+=off});if(!r||x.ok>r.ok)r=x}
let j=-1;
for(const o of r.ops)if(o.op==='ok'||o.op==='sub')j=Math.max(j,o.t);
n=j+1;
const d=r.ops.find(o=>o.op==='del'&&o.t<j);if(d)missed=its[d.t];
}
const w=its[Math.min(n,its.length-1)];
if(!w)return;
const t=$('toast');t.textContent='Next word: '+w.orig+(missed?` · you skipped “${missed.orig}” earlier`:'');t.classList.add('show');
clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),2200);
focusTa();
}
$('btnHint').onclick=hint;

/* ---------- tap-to-pick mode (phones): choose each next word from three ---------- */
const IS_PHONE=matchMedia('(pointer:coarse)').matches&&Math.min(screen.width,screen.height)<600;
const choiceOn=()=>SET.choice==null?IS_PHONE:!!SET.choice;
let cIdx=0,cWords=[],VOCAB=null,VOCAB_FOR=null;
function setChoice(on){SET.choice=on;saveSettings();$('sChoice').checked=on;applyChoice();if(phase==='type'){cIdx=0;typed='';ta.value='';renderTyped();renderPrompt();renderFoot()}renderChoices();if(!on)focusTa()}
function applyChoice(){
const on=choiceOn();document.body.classList.toggle('choice',on);
ta.readOnly=on;ta.inputMode=on?'none':'text';if(on)ta.blur();
$('mChoice').textContent=on?'Switch to typing':'Tap-to-pick words';
$('phd').textContent=on?'Tap the next word below…':'Start typing…';
renderChoices();
}
// essay vocabulary: each word's display form, and which words follow which (for believable decoys)
function vocab(){
if(VOCAB_FOR===SENTS)return VOCAB;
const words=new Map(),follow=new Map();let prev=null;
for(const x of SENTS)for(const it of items(x.text)){if(!it.norm)continue;
const disp=it.orig.replace(/^[“"‘(]+|[”"’),.;:!?]+$/g,'');
if(!words.has(it.norm)&&disp)words.set(it.norm,disp);
if(prev){if(!follow.has(prev))follow.set(prev,new Set());follow.get(prev).add(it.norm)}prev=it.norm}
VOCAB={words,follow,list:[...words.keys()]};VOCAB_FOR=SENTS;return VOCAB;
}
const SUFX=['ing','ed','ly','tion','sion','ment','ness','ity','ous','ive','al','er','est','s'];
const sufOf=w=>SUFX.find(x=>w.length>x.length+2&&w.endsWith(x))||'';
// decoys come from the essay itself: same word class (function vs content word), same ending,
// similar length, and words that really follow the previous word somewhere else in the essay
function decoys(right,prevNorm,n=2){
const V=vocab(),r=right.norm,fn=FN.has(r),suf=sufOf(r),cap=/^[A-Z]/.test(right.orig.replace(/^[“"‘(]+/,''));
const fol=prevNorm&&V.follow.get(prevNorm),scored=[];
for(const w of V.list){
if(w===r||lev(w,r)<=1)continue;
let sc=Math.random()*1.5;
sc+=FN.has(w)===fn?3:-4;
if(suf&&w.endsWith(suf))sc+=2;
sc-=Math.abs(w.length-r.length)*.35;
if(fol&&fol.has(w))sc+=2.5;
if(/^[A-Z]/.test(V.words.get(w))===cap)sc+=.8;
scored.push([sc,w]);
}
scored.sort((a,b)=>b[0]-a[0]);
const pool=scored.slice(0,8),out=[];
while(out.length<n&&pool.length){const k=Math.floor(Math.random()*Math.min(4,pool.length));out.push(V.words.get(pool.splice(k,1)[0][1]))}
for(const f of ['the','and','which','through','as','of'])if(out.length<n&&f!==r&&!out.includes(f))out.push(f);
return out;
}
function renderChoices(){
const box=$('choices'),on=choiceOn()&&phase==='type'&&!!task&&SET.view==='mem';
box.hidden=!on;if(!on)return;
cWords=items(task.text).filter(i=>i.norm);
if(cIdx>=cWords.length){box.hidden=true;return}
const right=cWords[cIdx],prev=cIdx?cWords[cIdx-1].norm:(task.a>0?tokens(SENTS[task.a-1].text).pop():null);
const mode=attemptMode,inQ=mode==='quotes'&&RecallEngine.quoteMask(task.text,taskQuoteStart(task))[cIdx];
const disp=mode==='verbatim'?right.orig:(right.orig.replace(/^[“"‘(]+|[”"’),.;:!?]+$/g,'')||right.orig);
let dec=decoys(right,prev);
if(mode==='verbatim')dec=[literalVariant(right.orig),dec[0]];          // same word, different capitals/punctuation
else if((mode==='exact'||inQ)&&right.norm.length>=4)dec=[misspell(disp),dec[0]]; // a near-miss spelling
dec=dec.filter((t,i,a)=>t&&t!==disp&&a.indexOf(t)===i);while(dec.length<2)dec.push(decoys(right,prev)[dec.length]||'and');
const opts=[{t:disp,ok:true},...dec.slice(0,2).map(t=>({t,ok:false}))];
for(let i=opts.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[opts[i],opts[j]]=[opts[j],opts[i]]}
$('chRow').innerHTML=opts.map((o,i)=>`<button class="ch" data-ok="${o.ok?1:0}" data-w="${esc(o.t)}"><span class="n">${i+1}</span>${esc(o.t)}</button>`).join('');
$('chUndo').disabled=cIdx===0;
}
// decoys for strict modes
function misspell(w){const a=[...w];if(a.length<4)return w+'e';const i=1+Math.floor(Math.random()*(a.length-3));[a[i],a[i+1]]=[a[i+1],a[i]];const v=a.join('');return v===w?w.slice(0,-1):v}
function literalVariant(w){
  const core=w.replace(/[.,;:!?”"’)]+$/,''),tail=w.slice(core.length);
  if(tail)return core;                                   // drop the punctuation
  if(/^[A-Z]/.test(w))return w[0].toLowerCase()+w.slice(1); // wrong capital
  if(/^[a-z]/.test(w))return w[0].toUpperCase()+w.slice(1);
  return w+',';
}
// every tap adds a word, right or wrong, so the normal marking shows exactly which picks were off
function pick(btn){
if(phase!=='type'||!btn||btn.classList.contains('right')||btn.classList.contains('wrong'))return;
const now=performance.now();if(!t0)t0=now;
if(lastKey){const gap=now-lastKey;if(gap<20000)S.stats.time+=gap/1000;if(L.keys>0){L.gaps.push(gap);if(L.gaps.length>80)L.gaps.shift();if(gap>1200)L.hes++;L.longest=Math.max(L.longest,gap)}}
lastKey=now;L.keys++;L.ins.push(now);
const ok=btn.dataset.ok==='1',w=ok?cWords[cIdx].orig:btn.dataset.w;
btn.classList.add(ok?'right':'wrong');
if(!ok){const c=$('chRow').querySelector('[data-ok="1"]');if(c)c.classList.add('right')}
typed=(typed?typed+' ':'')+w;ta.value=typed;cIdx++;
if(task.type==='build'&&SET.hide)prompt.classList.add('veil');
renderTyped();Pet.event('type');Game.progress(cIdx/cWords.length);
setTimeout(()=>{if(phase!=='type')return;if(cIdx>=cWords.length){$('choices').hidden=true;check()}else renderChoices()},ok?90:650);
}
$('chRow').addEventListener('click',e=>pick(e.target.closest('.ch')));
$('chUndo').onclick=()=>{if(phase!=='type'||!cIdx)return;cIdx--;L.bs++;const w=typed.split(' ');w.pop();typed=w.join(' ');ta.value=typed;renderTyped();renderChoices()};
$('chKb').onclick=()=>setChoice(false);
$('btnSkip').onclick=()=>{if(phase!=='done')skip()};
document.querySelectorAll('.k-ctl').forEach(k=>k.textContent=CTRL);
// tooltips show the shortcut on keyboard devices
if(!matchMedia('(pointer:coarse)').matches)document.querySelectorAll('.tb[data-k]').forEach(b=>b.dataset.kl='  '+CTRL+b.dataset.k);
(()=>{
const K=(...k)=>k.map(x=>`<kbd>${x}</kbd>`).join('');
const row=(l,k)=>`<div class="krow"><span>${l}</span><span>${k}</span></div>`;
$('keysPop').innerHTML='<div class="kh">While typing</div>'+row('Check',K('Enter'))+row('Next word',K(CTRL,'H'))+row('Hold: paragraph so far',K(CTRL,'P'))+row('Hold: whole essay',K(CTRL,'O'))+row('Back one step <small>(empty box)</small>',K(CTRL,'Z'))+
'<div class="kh">After marking</div>'+row('Continue / retry',K('Enter'))+row('Skip',K('Tab'))+
'<div class="kh">Anywhere</div>'+row('Switch essay',K(IS_APPLE?'⌥':'Alt','1–9'))+row('This list',K(CTRL,'/'));
})();
function placeKeys(){
const p=$('keysPop');if(p.hidden)return;
const b=$('btnKeys').getBoundingClientRect(),w=p.offsetWidth,h=p.offsetHeight,m=10;
const left=Math.max(m,Math.min(b.right-w,innerWidth-w-m));
const below=b.bottom+8,top=below+h<=innerHeight-m?below:Math.max(m,b.top-8-h); // below the button, or above if no room
p.style.left=left+'px';p.style.top=top+'px';
}
function toggleKeys(force){const p=$('keysPop'),open=force??p.hidden;p.hidden=!open;$('btnKeys').setAttribute('aria-expanded',open);document.body.classList.toggle('kpop',open);if(open)placeKeys();else focusTa()}
addEventListener('resize',placeKeys);addEventListener('scroll',placeKeys,{passive:true});
/* one tooltip for the toolbar, placed above the icon (below only if there's no room) */
(()=>{
const tip=$('tip');let cur=null,tmr=0;
const show=b=>{cur=b;tip.innerHTML=esc(b.dataset.tip)+(b.dataset.kl?`<kbd>${esc(b.dataset.kl.trim())}</kbd>`:'');
tip.classList.remove('show');const r=b.getBoundingClientRect(),w=tip.offsetWidth,h=tip.offsetHeight,m=8;
const x=Math.max(m,Math.min(r.left+r.width/2-w/2,innerWidth-w-m));let y=r.top-h-9;if(y<m)y=r.bottom+9;
tip.style.left=x+'px';tip.style.top=y+'px';tip.style.setProperty('--ax',(r.left+r.width/2-x)+'px');
requestAnimationFrame(()=>tip.classList.add('show'))};
const hide=()=>{clearTimeout(tmr);cur=null;tip.classList.remove('show')};
$('tools').addEventListener('pointerover',e=>{const b=e.target.closest('.tb[data-tip]');if(!b||b===cur||e.pointerType==='touch')return;clearTimeout(tmr);tmr=setTimeout(()=>show(b),cur?0:250)});
$('tools').addEventListener('pointerleave',hide);
$('tools').addEventListener('focusin',e=>{const b=e.target.closest('.tb[data-tip]');if(b&&b.matches(':focus-visible'))show(b)});
$('tools').addEventListener('focusout',hide);
$('tools').addEventListener('pointerdown',hide);
addEventListener('scroll',hide,{passive:true});
})();
$('btnKeys').onclick=e=>{e.stopPropagation();toggleKeys()};
function endScreen(title,msg,btn,fn){
phase='done';task=null;
$('chip').className='chip';$('chip').textContent=title;$('ctx').textContent='';
$('tools').style.display='none';clearTimeout(passT);
prompt.innerHTML=`<div class="done-wrap"><h2>${title}</h2><p style="font-family:var(--sans);color:var(--muted)">${msg}</p></div>`;
typedEl.textContent='';$('queue').innerHTML='';$('meterFill').style.width='0';
foot.innerHTML=`<span class="spacer"></span><button class="btn primary small" id="bEnd">${btn}</button>`;
$('bEnd').onclick=fn;renderSide();save();
}
const showDone=()=>endScreen('That’s the whole essay','Want another go? Pick where to start.','Choose a start',openModal);
const showEmpty=()=>endScreen('No essay yet','Paste one in and you’re away.','Upload essay',openUpload);

/* ---------- side panels ---------- */
function fmtTime(s){s=Math.round(s);const h=Math.floor(s/3600),m=Math.floor(s%3600/60);return h?`${h}h ${m}m`:`${m}m ${s%60}s`}
const topOf=o=>Object.entries(o).sort((a,b)=>b[1]-a[1]);
function renderSide(){
const lw=learnedWords(),pct=Math.min(1,lw/TOTALW),P=Math.round(pct*100);
$('ringPct').textContent=P+'%';$('leftPct').textContent=(100-P)+'% left';
$('wordsLeft').textContent=(TOTALW-lw).toLocaleString();
$('sentDone').textContent=`${SENTS.filter((_,g)=>S.learned[g]).length}/${SENTS.length}`;
const paraDone=PARAS.filter((ss,p)=>ss.every((_,s)=>S.learned[PSTART[p]+s])).length;
$('paraDone').textContent=`${paraDone}/${PARAS.length}`;
$('ringArc').style.strokeDashoffset=314.16*(1-pct);
$('tbFill').style.width=pct*100+'%';$('topPct').textContent=P+'% memorised';
if(!$('essPop').hidden)renderSwitcher();if(!$('essayModal').hidden&&!$('mgListView')?.hidden)mgList();
const st=self.RecallCloud?RecallCloud.displayStats(ACTIVE,S.stats):S.stats;
const nem=topOf(st.missed)[0],typo=topOf(st.typos)[0],hard=topOf(st.fails)[0];
const hrs=st.time/3600,rate=hrs>0.01?lw/hrs:0,eta=rate?(TOTALW-lw)/rate*3600:null;
const hourBest=Object.entries(st.hours).filter(([,v])=>v[1]>=3).sort((a,b)=>b[1][0]/b[1][1]-a[1][0]/a[1][1])[0];
const hourLbl=h=>{h=+h;return `${(h%12)||12}${h<12?'am':'pm'}`};
const deep=[
['Avg match',st.att?Math.round(st.accSum/st.att*100)+'%':'—'],
['Avg speed',st.wpmN?Math.round(st.wpmSum/st.wpmN)+' <small>wpm</small>':'—'],
['Fastest burst',st.bestBurst?st.bestBurst+' <small>wpm</small>':'—'],
['Flawless run',st.flawless+' <small>words</small>'],
['Typing rhythm',st.rhythmN?Math.round(st.rhythmSum/st.rhythmN)+'<small>/100</small>':'—'],
['Correction rate',st.keys?(st.bs/st.keys*100).toFixed(1)+'%':'—'],
['Longest blank',fmtS(st.longestPause/1000)],
['Hesitations',st.hes.toLocaleString()],
['Keystrokes',st.keys.toLocaleString()],
['Finger travel',(st.keys*0.019).toFixed(st.keys*0.019<10?1:0)+' <small>m</small>'],
['Booklet pages',(st.words/250).toFixed(1)+' <small>written</small>'],
['Study time',fmtTime(st.time)],
];
$('deepKv').innerHTML=deep.map(([k,v])=>`<div class="k"><div class="l">${k}</div><div class="v">${v}</div></div>`).join('');
$('hist').innerHTML=st.hist.map(([a,p])=>`<i class="${p?'':'f'}" style="height:${Math.max(4,a)}%" title="${a}%"></i>`).join('');
$('histN').textContent=st.att?`${st.att} total`:'';
const tm=t=>{const v=st.taskMs[t];return v[1]?(v[0]/v[1]).toFixed(2)+' <small>s/word</small>':'—'};
const mem=[
['Nemesis word',nem?`“${esc(nem[0])}”`:'—',nem?`missed ${nem[1]}×`:'the word you drop most',1],
['Signature typo',typo?esc(typo[0]):'—',typo?`${typo[1]}× · what you type → what it is`:'the typo you keep making',1],
['Hardest sentence',hard&&SENTS[hard[0]]?`¶${SENTS[hard[0]].p+1}.${SENTS[hard[0]].s+1} · ${esc(SENTS[hard[0]].text.split(/\s+/).slice(0,6).join(' '))}…`:'—',hard?`${hard[1]} failed attempts start here`:'where you usually get stuck',1],
['Slip point',st.slipN?Math.round(st.slipSum/st.slipN*100)+'%':'—',`how far you usually get before the first mistake`],
['Cold recall',st.recAtt?Math.round(st.recPass/st.recAtt*100)+'%':'—','paragraph/essay recalls passed first go'],
['Warm recall',st.bldAtt?Math.round(st.bldPass/st.bldAtt*100)+'%':'—','chunk builds passed first go'],
['First-word recall',st.firstLetterN?Math.round(st.firstLetter/st.firstLetterN*100)+'%':'—','attempts that start on the right word'],
['Memorise rate',rate?Math.round(rate)+' <small>words/hr</small>':'—','words learnt per hour'],
['Done by',eta?fmtTime(eta):'—','to go, at this pace'],
['Sharpest hour',hourBest?hourLbl(hourBest[0]):'—',hourBest?`${Math.round(hourBest[1][0]/hourBest[1][1]*100)}% avg match`:'shows after 3+ goes in one hour'],
['Build pace',tm('build'),'per word, chunk builds'],
['Recall pace',tm('para'),'per word, paragraph recalls'],
['Checkpoints',st.cps,'full-essay recalls cleared'],
['Retries',st.retries,'second-or-later attempts'],
];
const filled=mem.filter(([,v])=>v!=='—'&&v!==0&&v!=='0');
$('memKv').innerHTML=filled.length<3
?`<div class="empty-prof"><b>Nothing here yet.</b><span>Do a few rounds and this fills in: the word you keep dropping, your go-to typo, the sentence that trips you up, and how fast it’s sticking.</span></div>`
:filled.map(([k,v,s,w])=>`<div class="k ${w?'wide':''}"><div class="l">${k}</div><div class="v">${v}</div><div class="sub">${s}</div></div>`).join('');
$('map').innerHTML=PARAS.map((ss,p)=>`<div class="maprow"><span class="pl">¶${p+1}</span><div class="dots">${ss.map((t,s)=>{const g=PSTART[p]+s,x=SENTS[g];
return `<button class="dot ${S.learned[g]?'l':''} ${x.role==='ts'?'ts':''} ${x.unitEnd?'ue':''} ${g===S.g&&phase!=='done'?'cur':''}" data-g="${g}" title="${ROLE[x.role]}: ${esc(t.slice(0,90))}…"></button>`}).join('')}</div></div>`).join('');
}
// picking a sentence on the map just goes there (to relearn it, say). It doesn't change the start point, so essay
// recalls still cover everything from where the student started; going back before that start point moves it back.
$('map').addEventListener('click',e=>{const d=e.target.closest('.dot');if(d)jumpTo(+d.dataset.g)});
function jumpTo(g){if(g<S.startG)S.startG=g;S.g=g;S.ti=0;S.started=true;closeModal();loadTask()}

/* ---------- panels / focus ---------- */
const PANELS=[...document.querySelectorAll('.panel[data-panel]')];
function applyPanels(){
PANELS.forEach(p=>p.classList.toggle('hide',SET.hidden.includes(p.dataset.panel)));
let cols='';
['colL','colR'].forEach(id=>{const vis=[...$(id).querySelectorAll('.panel')].some(p=>!p.classList.contains('hide'));$(id).classList.toggle('empty',!vis);if(vis&&!SET.focus)cols+=id.slice(-1)});
document.querySelector('.mem').dataset.cols=cols;
document.body.classList.toggle('focus',!!SET.focus);
$('pet').classList.toggle('hidden',SET.hidden.includes('pet'));
Game.set(!!SET.gamify);
if(window.bgRepaint)bgRepaint(); // theme swap repaints immediately, even with motion off
const T=(attr,on,name)=>`<label><span>${name}</span><input type="checkbox" class="sw" ${attr} ${on?'checked':''}></label>`;
$('panelMenu').innerHTML=`<button class="focustile" id="mFocusBtn" aria-pressed="${!!SET.focus}"><span class="fi"><svg width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path fill=\"currentColor\" d=\"M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1z\"/></svg></span><span class="ft"><b>Focus</b><small>${SET.focus?'On · panels hidden':'Off'}</small></span></button><div class="ehead">Panels</div>`+PANELS.map(p=>T(`data-p="${p.dataset.panel}"`,!SET.hidden.includes(p.dataset.panel),p.dataset.name)).join('')+
T('data-p="pet"',!SET.hidden.includes('pet'),'Don the falcon')+
`<hr><div class="ehead">Modes</div>`+T('id="mGame"',SET.gamify,'Gamify (retro platformer)');
requestAnimationFrame(()=>{placeCaret();drawSpark()});
save();
}
PANELS.forEach(p=>{const x=p.querySelector('.x');x.setAttribute('aria-label','Hide '+p.dataset.name);x.onclick=()=>{SET.hidden.push(p.dataset.panel);applyPanels()}});
function fitPop(el){
if(!el||el.hidden)return;
el.style.left=el.style.right=el.style.maxHeight=el.style.maxWidth='';el.style.transformOrigin='';
// measure the menu at its real size: the opening animation scales it, which made the old check miss overflow
const anim=el.style.animation;el.style.animation='none';
const vw=document.documentElement.clientWidth,m=10;
el.style.maxWidth=(vw-2*m)+'px';
const pr=el.offsetParent?el.offsetParent.getBoundingClientRect():{left:0,right:vw};let r=el.getBoundingClientRect();
if(r.left<m||r.right>vw-m){
const w=Math.min(r.width,vw-2*m),left=Math.max(m,Math.min(r.left,vw-m-w));
el.style.right='auto';el.style.left=(left-pr.left)+'px';el.style.transformOrigin='top left';r=el.getBoundingClientRect();
}
const room=innerHeight-Math.max(0,r.top)-m;if(r.height>room){el.style.maxHeight=Math.max(160,room)+'px';el.style.overflowY='auto'}
el.style.animation=anim;
}
// refit whenever a menu's contents change size (long essay titles, the list re-rendering while open)
if(window.ResizeObserver){const ro=new ResizeObserver(es=>es.forEach(e=>{if(!e.target.hidden)fitPop(e.target)}));['panelMenu','moreMenu','essPop','keysPop'].forEach(id=>$(id)&&ro.observe($(id)))}
addEventListener('resize',()=>['panelMenu','moreMenu','essPop'].forEach(id=>fitPop($(id))));
document.addEventListener('pointerdown',e=>{if(e.target.closest('.menu'))return;for(const id of ['panelMenu','moreMenu','essPop','keysPop'])$(id).hidden=true;$('essBtn').classList.remove('open');$('btnKeys').setAttribute('aria-expanded',false);document.body.classList.remove('kpop')},true);
$('btnPanels').onclick=e=>{e.stopPropagation();const p=$('panelMenu');p.hidden=!p.hidden;$('moreMenu').hidden=true;$('essPop').hidden=true;fitPop(p)};
$('panelMenu').addEventListener('pointermove',e=>{const t=e.target.closest('.focustile');if(!t)return;const r=t.getBoundingClientRect();t.style.setProperty('--mx',(e.clientX-r.left)+'px');t.style.setProperty('--my',(e.clientY-r.top)+'px')});
$('panelMenu').addEventListener('click',e=>{e.stopPropagation();if(e.target.closest('#mFocusBtn')){const tile=e.target.closest('#mFocusBtn').getBoundingClientRect();SET.focus=!SET.focus;applyPanels();$('mFocusBtn').focus();if(SET.focus){lockInRipple(tile.left+28,tile.top+tile.height/2);self.track&&track('focus')}announce(SET.focus?'Focus on. Locked in.':'Focus off.')}});
/* Focus on: pearlescent ripple out of the tile, plus a brief "Locked in" tag. Skipped with reduced motion. */
function lockInRipple(x,y){
if(document.body.classList.contains('reduce')||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
document.querySelectorAll('.lockin').forEach(n=>n.remove());
const far=Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y));
const o=document.createElement('div');o.className='lockin';o.setAttribute('aria-hidden','true');
o.style.cssText=`--x:${x}px;--y:${y}px;--s:${(far*2/100*1.08).toFixed(2)}`;
o.innerHTML='<i></i><i></i><i></i><b>Locked in</b>';
document.body.appendChild(o);setTimeout(()=>o.remove(),2100);
}
$('panelMenu').addEventListener('change',e=>{
const t=e.target;
if(t.id==='mGame'){setGame(t.checked);return}
else{const id=t.dataset.p;SET.hidden=SET.hidden.filter(x=>x!==id);if(!t.checked)SET.hidden.push(id);if(t.checked)SET.focus=false}
applyPanels();
});
/* game mode on/off: from the Panels menu (desktop) or the ⋯ menu (phones) */
function setGame(on){
if(on&&document.body.classList.contains('hw')){toast('Handwriting works in normal mode. Switch to typing to play game mode.');return}
on=!!on;if(on===!!SET.gamify)return;
SET.gamify=on;if(on&&self.track)track('game-mode');
if(on){SET.preGame=[...SET.hidden];SET.hidden=[...PANELS.map(p=>p.dataset.panel),'pet']}
else if(SET.preGame){SET.hidden=SET.preGame;delete SET.preGame}
applyPanels();save();
requestAnimationFrame(()=>{placeCaret();focusTa()});
announce(on?'Game mode on.':'Game mode off.');
}
document.addEventListener('click',()=>{$('panelMenu').hidden=true});
$('btnSettings').onclick=()=>openSettings();
$('btnMore').onclick=e=>{e.stopPropagation();const m=$('moreMenu');$('mGameItem').textContent=SET.gamify?'Leave game mode':'Game mode (retro platformer)';m.hidden=!m.hidden;$('panelMenu').hidden=true;$('essPop').hidden=true;fitPop(m)};
$('moreMenu').addEventListener('click',e=>{const b=e.target.closest('[data-more]');if(!b)return;$('moreMenu').hidden=true;
({manage:()=>openEssay(),start:openModal,upload:openUpload,help:showHowto,settings:()=>openSettings(),install:()=>self.RecallPWA&&RecallPWA.install(),choice:()=>setChoice(!choiceOn()),game:()=>setGame(!SET.gamify)})[b.dataset.more]()});
document.addEventListener('click',()=>{$('moreMenu').hidden=true});
$('petX').onclick=()=>{SET.hidden.push('pet');applyPanels()};

/* ---------- start modal ---------- */
/* Starting mid-essay: either the earlier part is still to learn (recalls start here and it isn't counted),
or the student already knows it (we take their word: it counts as learnt and recalls cover the whole essay). */
function setStart(g,known){
if(known){for(let k=0;k<g;k++)S.learned[k]=true;S.startG=0}else S.startG=g;
S.g=g;S.ti=0;S.started=true;closeModal();loadTask();
}
let pickG=0;
function openModal(){
const canResume=S.g<SENTS.length&&(S.g>0||S.ti>0);
$('resumeBox').innerHTML='';
$('startOpts').querySelector('#bResume')?.remove();
if(canResume)$('startOpts').insertAdjacentHTML('afterbegin',`<button class="sbig wide rec" id="bResume"><span class=\"si\"><svg viewBox=\"0 0 24 24\" width=\"18\" height=\"18\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M8 5v14l11-7z\"/></svg></span><span class="st"><b>Pick up where you left off</b><span class="d">¶${SENTS[S.g].p+1}, sentence ${SENTS[S.g].s+1}</span></span></button>`);
$('bFromTop').classList.toggle('rec',!canResume);
if($('bResume'))$('bResume').onclick=closeModal;
$('sentList').innerHTML=PARAS.map((ss,p)=>`<div class="pgroup"><h5>Paragraph ${p+1}</h5>${ss.map((t,s)=>{const g=PSTART[p]+s,w=t.split(/\s+/),x=SENTS[g];
return `<button class="sopt ${S.learned[g]?'l':''}" data-g="${g}"><span class="n">${s+1}</span><span class="rt ${RCLS[x.role]}" style="margin-right:8px">${ROLE[x.role]}</span>${esc(w.slice(0,12).join(' '))}${w.length>12?'…':''}</button>`}).join('')}</div>`).join('');
$('sentWrap').hidden=true;$('startPick').hidden=true;$('bPickSent').classList.remove('on');
$('modal').hidden=false;setTimeout(()=>($('bResume')||$('bFromTop')).focus({preventScroll:true}),50);
}
function closeModal(){$('modal').hidden=true;$('startPick').hidden=true;focusTa()}
$('sentList').addEventListener('click',e=>{
const b=e.target.closest('.sopt');if(!b)return;const g=+b.dataset.g;
if(g===0){setStart(0);return}                       // nothing before it to ask about
pickG=g;document.querySelectorAll('.sopt.sel').forEach(x=>x.classList.remove('sel'));b.classList.add('sel');
const x=SENTS[g];
$('startPickQ').innerHTML=`Starting at <b>¶${x.p+1}, sentence ${x.s+1}</b>. What about everything before it?`;
$('startPick').hidden=false;$('bKnown').focus({preventScroll:true});
});
$('bLater').onclick=()=>setStart(pickG,false);
$('bFromTop').onclick=()=>setStart(0);
$('bPickSent').onclick=()=>{const w=$('sentWrap');w.hidden=!w.hidden;$('bPickSent').classList.toggle('on',!w.hidden);if(!w.hidden){const c=document.querySelector('.sopt.cur')||$('sentList').firstElementChild;if(c)c.scrollIntoView({block:'nearest'})}};
$('bKnown').onclick=()=>setStart(pickG,true);
$('modal').addEventListener('click',e=>{if(e.target.id==='modal'&&S.started)closeModal()});

// × always works: if nothing has been picked yet, start from the top rather than leaving the user stuck
const hasProgress=()=>S.g>0||S.ti>0||S.learned.some(Boolean)||!!S.part;
$('bCloseStart').onclick=()=>{if(S.started||hasProgress()){S.started=true;save();closeModal()}else setStart(0)};

/* ---------- essay library: list + edit view ---------- */
/* Essays live in localStorage (cookies cap out at ~4 KB, far too small for essays). It is per browser/device,
so Back up / Restore moves everything between devices as one JSON file. */
const SAMPLE_TITLE='Sample · Bart for President';
const allEssays=()=>[...(ls.get('sampleGone')?[]:[{id:'sample',title:SAMPLE_TITLE,kind:'essay'}]),...LIB];
const essayTitle=id=>(allEssays().find(e=>e.id===id)||{}).title||'Essay';
/* % memorised by words, the same measure as the progress ring and top bar. The active essay uses live
state; others are worked out from their saved state (parsed once per text and cached). */
const PCT_CACHE=new Map();
function pctOf(id){
if(id===ACTIVE)return Math.round(Math.min(1,learnedWords()/Math.max(1,TOTALW))*100);
const st=ls.get('state.'+id);if(!st||!Array.isArray(st.learned)||!st.learned.some(Boolean))return 0;
const txt=essayText(id)||'',key=id+':'+txt.length;
let wc=PCT_CACHE.get(key);if(!wc){wc=parseEssay(txt,essayKind(id)).sents.map(x=>x.wc);PCT_CACHE.set(key,wc)}
const tot=wc.reduce((a,b)=>a+b,0);return Math.round(wc.reduce((a,w,g)=>a+(st.learned[g]?w:0),0)/Math.max(1,tot)*100);
}
function renderSwitcher(){
$('essName').textContent=essayTitle(ACTIVE);
$('essPop').innerHTML=`<div class="ehead">Your essays</div>`+allEssays().map((e,i)=>{const p=pctOf(e.id);
return `<button class="eitem ${e.id===ACTIVE?'on':''}" data-sw="${e.id}"${i<9?` title="Shortcut: ${IS_APPLE?'⌥':'Alt + '}${i+1}"`:''}><span class="edot"></span><span class="t">${esc(e.title)}</span>${essayKind(e.id)==='creative'?'<span class="kind">creative</span>':''}<span class="bar"><i style="width:${p}%"></i></span><span class="p">${p}%</span></button>`}).join('')+
`<hr><div class="act"><button class="btn small primary" data-act="up">+ Upload</button><button class="btn small" data-act="manage">Manage</button><button class="btn small" data-act="start">Choose start</button></div>`;
}
$('essBtn').onclick=e=>{e.stopPropagation();renderSwitcher();const p=$('essPop');p.hidden=!p.hidden;$('essBtn').classList.toggle('open',!p.hidden);$('panelMenu').hidden=true;$('moreMenu').hidden=true;fitPop(p);if(!p.hidden)(p.querySelector('.eitem.on')||p.querySelector('.eitem')).focus()};
$('essPop').addEventListener('click',e=>{
e.stopPropagation();const b=e.target.closest('[data-sw],[data-act]');if(!b)return;
$('essPop').hidden=true;$('essBtn').classList.remove('open');
if(b.dataset.sw)switchEssay(b.dataset.sw);else if(b.dataset.act==='up')openUpload();else if(b.dataset.act==='start')openModal();else openEssay();
});
$('essPop').addEventListener('keydown',e=>{
const it=[...$('essPop').querySelectorAll('.eitem')],i=it.indexOf(document.activeElement);
if(e.key==='ArrowDown'){e.preventDefault();(it[i+1]||it[0]).focus()}else if(e.key==='ArrowUp'){e.preventDefault();(it[i-1]||it[it.length-1]).focus()}
else if(e.key==='Escape'){$('essPop').hidden=true;$('essBtn').classList.remove('open');$('essBtn').focus()}
});
document.addEventListener('click',()=>{$('essPop').hidden=true;$('essBtn').classList.remove('open')});

const ICON={edit:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
del:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>'};
let editId=null,editKind='essay';
const wordsOf=id=>tokens(mdClean(essayText(id)||'')).length;
function mgList(){
const list=allEssays(),only=list.length<=1;
$('mgCount').textContent=list.length;
$('mgList').innerHTML=list.map(e=>{
const p=pctOf(e.id),cur=e.id===ACTIVE,k=essayKind(e.id);
return `<div class="mrow ${cur?'on':''}">
<button class="mmain" data-open="${e.id}" title="${cur?'Currently studying':'Study this essay'}">
<span class="mt">${esc(e.title)}</span>
<span class="mmeta"><span class="mk2 ${k}">${k==='creative'?'Creative':'Essay'}</span><span>${wordsOf(e.id).toLocaleString()} words</span><span>${p}% memorised</span>${cur?'<span class="mcur">Studying</span>':''}</span>
<span class="mbar"><i style="width:${p}%"></i></span>
</button>
<div class="macts">
<button class="iconbtn" data-edit="${e.id}" title="Edit" aria-label="Edit ${esc(e.title)}">${ICON.edit}</button>
<button class="iconbtn del" data-del="${e.id}" ${only?'disabled title="Keep at least one essay"':'title="Delete"'} aria-label="Delete ${esc(e.title)}">${ICON.del}</button>
</div></div>`;
}).join('');
$('mgSample').hidden=!ls.get('sampleGone');
}
function mgShow(view){
const list=view==='list';
$('mgListView').hidden=!list;$('mgEditView').hidden=list;$('mgBack').hidden=list;
$('mgH').textContent=list?'Your essays':(editId==='sample'?'Sample essay':'Edit essay');$('mgCount').hidden=!list;
}
function openEssay(id){
$('upModal').hidden=true;
if(id){mgEdit(id)}else{mgList();mgShow('list')}
$('essayModal').hidden=false;
}
function mgSetKind(k){editKind=k;$('mgKind').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.v===k));mgDirty()}
function mgEdit(id){
editId=id;
$('mgTitle').value=essayTitle(id);
const src=essayText(id)||'';
$('mgText').value=essayKind(id)==='creative'?src:src.replace(/\n(?!\n)/g,'\n\n');
mgSetKind(essayKind(id));
$('mgDel').disabled=allEssays().length<=1;$('mgDel').title=$('mgDel').disabled?'Keep at least one essay':'';
$('mgSave').textContent=id==='sample'?'Save as my copy':'Save';
mgShow('edit');mgDirty();setTimeout(()=>$('mgTitle').focus(),50);
}
function mgDirty(){
const txt=$('mgText').value;
if(!txt.trim()){$('mgSum').innerHTML='';$('mgSave').disabled=true;return}
$('mgSave').disabled=false;
const m=parseEssay(txt,editKind),pl=(n,w)=>`<span>${n.toLocaleString()} ${w}${n===1?'':'s'}</span>`;
$('mgSum').innerHTML=pl(m.paras.length,editKind==='creative'?'block':'paragraph')+pl(m.sents.length,'sentence')+pl(m.total,'word');
const changed=editId!=='sample'&&(txt.replace(/\s+/g,' ').trim()!==(essayText(editId)||'').replace(/\s+/g,' ').trim()||editKind!==essayKind(editId));
$('mgWarn').textContent=editId==='sample'?'Saving makes your own copy. The sample stays as is.':changed?'Heads up: changing this resets your progress on this essay.':'';
}
/* Game mode on phones: move Undo / Type instead and the toolbar out of the console into #gbExtras below it,
   and put them back for every other layout. Same elements, so all their handlers keep working. */
const consoleSlots=[['chTools'],['tools']].map(([id])=>{const el=$(id);return{el,parent:el.parentNode,next:el.nextSibling}});
function placeConsoleExtras(){
  const out=document.body.classList.contains('gamify')&&matchMedia('(max-width:640px)').matches;
  for(const sl of consoleSlots){
    if(out){if(sl.el.parentNode!==$('gbExtras'))$('gbExtras').appendChild(sl.el)}
    else if(sl.el.parentNode!==sl.parent)sl.parent.insertBefore(sl.el,sl.next&&sl.next.parentNode===sl.parent?sl.next:null);
  }
  // in this layout the tap-to-pick tools show only while the choices do
  if(out)sl0Visible();else $('chTools').hidden=false;
}
function sl0Visible(){const c=$('chTools');c.hidden=$('choices').hidden}
new MutationObserver(()=>{if(document.body.classList.contains('gamify')&&$('chTools').parentNode===$('gbExtras'))sl0Visible()}).observe($('choices'),{attributes:true,attributeFilter:['hidden']});
new MutationObserver(placeConsoleExtras).observe(document.body,{attributes:true,attributeFilter:['class']});
matchMedia('(max-width:640px)').addEventListener('change',placeConsoleExtras);
placeConsoleExtras();
/* askConfirm(message,{title,ok,cancel,danger}) -> Promise<boolean>; notice(message) -> Promise (OK only).
   Accessible: it is a .modal, so js/a11y/dialogs.js gives it dialog semantics, focus trap and focus return. */
function askConfirm(message,o){
  o=o||{};
  return new Promise(res=>{
    const m=$('cfModal'),yes=$('cfYes'),no=$('cfNo');
    $('cfTitle').textContent=o.title||'Are you sure?';$('cfMsg').textContent=message;
    yes.textContent=o.ok||'OK';yes.className='btn '+(o.danger?'danger-solid':'primary');
    no.textContent=o.cancel||'Cancel';no.hidden=!!o.alertOnly;
    const done=v=>{m.hidden=true;yes.onclick=no.onclick=m.onclick=m.onkeydown=null;res(v)};
    yes.onclick=()=>done(true);no.onclick=()=>done(false);
    m.onclick=e=>{if(e.target===m)done(false)};
    m.onkeydown=e=>{if(e.key==='Escape'){e.stopPropagation();done(false)}};
    m.hidden=false;
    requestAnimationFrame(()=>(o.danger?no:yes).focus());
  });
}
const notice=(message,title)=>askConfirm(message,{title:title||'RecallHSC',ok:'OK',alertOnly:true});
async function mgDelete(id){
const list=allEssays();if(list.length<=1)return;
if(!await askConfirm(`“${essayTitle(id)}” and your progress on it will be deleted from this device (unless you’ve got a backup).`,{title:'Delete this essay?',ok:'Delete',danger:true}))return;
if(id==='sample')ls.set('sampleGone',1);else{LIB=LIB.filter(x=>x.id!==id);lsTry('lib',LIB)}
ls.del('state.'+id);
if(id===ACTIVE){const next=allEssays()[0];ACTIVE='';loadEssay(next.id);save();loadTask();if(!S.started)$('modal').hidden=true}
renderSwitcher();mgList();mgShow('list');toast('Essay deleted');
}
function closeEssay(){$('essayModal').hidden=true;focusTa()}
function switchEssay(id){
if(id===ACTIVE){closeEssay();return}
save();loadEssay(id);save();closeEssay();renderSwitcher();loadTask();
toast(`Switched to “${essayTitle(id)}”`);
if(!S.started)openModal();
}
function toast(t){const el=$('toast');el.textContent=t;el.classList.add('show');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),2000)}
document.addEventListener('keydown',e=>{const d=/^Digit([1-9])$/.exec(e.code);if(SET.keys&&e.altKey&&!e.ctrlKey&&!e.metaKey&&d){const t=allEssays()[+d[1]-1];if(t){e.preventDefault();switchEssay(t.id)}}});

$('mgList').addEventListener('click',e=>{
const o=e.target.closest('[data-open]'),ed=e.target.closest('[data-edit]'),d=e.target.closest('[data-del]');
if(o)switchEssay(o.dataset.open);else if(ed)mgEdit(ed.dataset.edit);else if(d&&!d.disabled)mgDelete(d.dataset.del);
});
$('mgKind').onclick=e=>{const b=e.target.closest('button');if(b)mgSetKind(b.dataset.v)};
let mgT=0;$('mgText').addEventListener('input',()=>{clearTimeout(mgT);mgT=setTimeout(mgDirty,150)});
$('mgBack').onclick=()=>{mgList();mgShow('list')};
$('mgCancel').onclick=()=>{mgList();mgShow('list')};
$('mgDel').onclick=()=>{if(!$('mgDel').disabled)mgDelete(editId)};
$('mgSample').onclick=()=>{ls.del('sampleGone');renderSwitcher();mgList();toast('Sample is back')};
$('mgSave').onclick=()=>{
const txt=$('mgText').value.trim();if(!txt)return;
const title=($('mgTitle').value.trim()||titleOf(mdClean(txt))).slice(0,60);
if(editId==='sample'){
const id='e'+Date.now().toString(36);LIB.unshift({id,title:title===SAMPLE_TITLE?'My copy · Bart for President':title,text:txt,kind:editKind,updated:Date.now()});
lsTry('lib',LIB);renderSwitcher();switchEssay(id);return;
}
const e=LIB.find(x=>x.id===editId);if(!e)return;
const reset=e.text.replace(/\s+/g,' ').trim()!==txt.replace(/\s+/g,' ').trim()||(e.kind||'essay')!==editKind;
if(e.title!==title)e.ver=(e.ver|0)+1; // a rename alone doesn't change the text's revision, so it needs its own version bump to win a sync
e.text=txt;e.title=title;e.kind=editKind;e.updated=Date.now();lsTry('lib',LIB);
if(reset){ls.del('state.'+e.id);if(e.id===ACTIVE){loadEssay(e.id);loadTask()}}
renderSwitcher();mgList();mgShow('list');toast('Saved');
};
$('bNew').onclick=openUpload;
$('bExport').onclick=()=>{
save();
const states={};allEssays().forEach(e=>{const st=ls.get('state.'+e.id);if(st)states[e.id]=st});
const blob=new Blob([JSON.stringify({app:'essay-recall',v:3,exported:new Date().toISOString(),lib:LIB,sampleGone:!!ls.get('sampleGone'),states,settings:SET},null,1)],{type:'application/json'});
const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`recallhsc-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
};
$('bImport').onchange=async e=>{
const f=e.target.files[0];if(!f)return;e.target.value='';
try{
if(f.size>20e6)throw 0;
const d=JSON.parse(await f.text());if(!d||d.app!=='essay-recall')throw 0;
const inc=cleanLib(d.lib);
const clash=inc.filter(x=>LIB.some(y=>y.id===x.id&&y.text!==x.text));
if(clash.length&&!await askConfirm(`${clash.length} essay${clash.length>1?'s':''} in this backup will replace the version on this device (${clash.map(x=>'“'+x.title+'”').slice(0,3).join(', ')}${clash.length>3?'…':''}). Continue?`,{title:'Replace essays?',ok:'Replace'}))return;
const keepSettings=d.settings&&typeof d.settings==='object'&&await askConfirm('Also restore the settings saved in this backup (marking mode, pass mark, display options)?',{title:'Restore settings too?',ok:'Restore settings',cancel:'Just essays'});
const nextLib=[...LIB];inc.forEach(x=>{const i=nextLib.findIndex(y=>y.id===x.id);if(i<0)nextLib.push(x);else nextLib[i]=x});
let ok=lsTry('lib',nextLib);
if(ok&&d.states&&typeof d.states==='object')for(const[k,v]of Object.entries(d.states)){const c=cleanState(v);if(c&&(k==='sample'||okId(k))&&!lsTry('state.'+k,c)){ok=false;break}}
if(!ok){notice('Couldn’t restore: this browser’s storage is full or blocked. Nothing was changed on screen; free up space and try again.');LIB=cleanLib(ls.get('lib'));return}
LIB=nextLib;
if(keepSettings){const keepView={view:SET.view,hidden:SET.hidden,focus:SET.focus};SET={...cleanSettings(d.settings),...keepView};saveSettings();bindSettings();applyPanels()}
renderSwitcher();loadEssay(ACTIVE);loadTask();mgList();toast(`Restored ${inc.length} essay${inc.length===1?'':'s'}${keepSettings?' and settings':''}`);
}catch(err){notice('That’s not a RecallHSC backup file.')}
};
$('bCloseEssay').onclick=closeEssay;
$('essayModal').addEventListener('click',e=>{if(e.target.id==='essayModal')closeEssay()});
$('essayModal').addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('mgEditView').hidden){e.stopPropagation();mgList();mgShow('list')}});

$('btnUpload').onclick=openUpload;

/* ---------- upload panel (separate from managing essays) ---------- */
const UP={kind:'essay',touched:false,t:0};
function openUpload(){
$('essayModal').hidden=true;
$('upTitle').value='';$('upText').value='';UP.kind='essay';UP.touched=false;
$('upModal').querySelector('.sheet-head h2').textContent='Upload an essay';
upSync();$('upModal').hidden=false;setTimeout(()=>$('upTitle').focus(),50);
}
let ONBOARD=false;
function closeUpload(){
$('upModal').hidden=true;
if(ONBOARD){                                          // first visit and they passed on uploading: try the sample
ONBOARD=false;$('upCancel').textContent=$('upCancel').dataset.label||'Cancel';
if(ACTIVE!=='sample'){loadEssay('sample');renderSwitcher()}
if(!S.started){setStart(0);toast('Here’s a sample essay to try')}
}
focusTa();
}
function openOnboardUpload(){
ONBOARD=true;openUpload();
const c=$('upCancel');c.dataset.label=c.textContent;c.textContent='Skip, try the sample';
$('upModal').querySelector('.sheet-head h2').textContent='Add your essay';
}
function upSetKind(k,auto){
UP.kind=k;$('upKind').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.v===k));
$('upHelp').innerHTML=(k==='creative'?'Stories, discursive or a mix: we’ll spot the narrative and reflective parts and your motifs. A reflection gets treated like an essay.':'We’ll find the topic sentences and quotes.')+(auto?' <span class="auto">(worked this out from your text)</span>':'');
}
function upSync(){
const txt=$('upText').value;
$('upDrop').classList.toggle('has',!!txt);
if(!UP.touched){const k=txt.trim()?detectKind(txt):'essay';upSetKind(k,!!txt.trim()&&k!=='essay')}
$('upAdd').disabled=!txt.trim();
if(!txt.trim()){$('upSum').innerHTML='';$('upPrev').innerHTML='';$('upPrevWrap').hidden=true;return}
clearTimeout(upSync.t);const kind=UP.kind,words=txt.split(/\s+/).length;
upSync.t=setTimeout(()=>COMPUTE.run('parse',{text:txt,kind},{channel:'uparse',size:words}).then(m=>{if(m!==COMPUTE.STALE&&$('upText').value===txt&&UP.kind===kind)upShow(m)},()=>upShow(parseEssay(txt,kind))),words>400?160:0);
}
function upShow(m){
const pl=(n,w)=>`<span>${n.toLocaleString()} ${w}${n===1?'':'s'}</span>`;
$('upSum').innerHTML=(UP.kind==='creative'&&m.style?`<span class="auto">reads as ${m.style}</span> · `:'')+pl(m.paras.length,UP.kind==='creative'?'block':'paragraph')+pl(m.sents.length,'sentence')+pl(m.total,'word')+(UP.kind==='essay'?pl(m.sents.filter(x=>x.role==='quote').length,'quote'):'');
$('upPrevWrap').hidden=false;
if($('upPrevWrap').open)upPreview(m);
}
function upPreview(m){
m=m||parseEssay($('upText').value,UP.kind);
$('upPrev').innerHTML=m.paras.map((ss,p)=>{
let html='',open=false;
ss.forEach((t,s)=>{const x=m.sents[m.pstart[p]+s];if(!open){html+='<span class="unit">';open=true}
html+=`<span class="s ${x.role}" title="${ROLE[x.role]}">${chunkSentence(t,SET.phrase).map(c=>`<span class="ch">${esc(c)}</span>`).join('')}</span> `;
if(x.unitEnd){html+='</span>';open=false}});
if(open)html+='</span>';
return `<div class="ap"><h6>${UP.kind==='creative'?'Block':'Paragraph'} ${p+1}</h6>${html}</div>`;
}).join('');
}
async function upLoadFile(f){
if(!f)return;
if(f.size>2e6){toast('That file is too big for an essay');return}
$('upText').value=(await f.text()).replace(/\r/g,'');
if(!$('upTitle').value.trim())$('upTitle').value=f.name.replace(/\.[^.]+$/,'').slice(0,60);
upSync();
}
$('upText').addEventListener('input',()=>{clearTimeout(UP.t);UP.t=setTimeout(upSync,150)});
$('upKind').onclick=e=>{const b=e.target.closest('button');if(!b)return;UP.touched=true;upSetKind(b.dataset.v,false);upSync()};
$('upPrevWrap').addEventListener('toggle',()=>{if($('upPrevWrap').open)upPreview()});
$('upFile').onchange=e=>{upLoadFile(e.target.files[0]);e.target.value=''};
['dragenter','dragover'].forEach(ev=>$('upDrop').addEventListener(ev,e=>{e.preventDefault();$('upDrop').classList.add('over')}));
['dragleave','drop'].forEach(ev=>$('upDrop').addEventListener(ev,e=>{e.preventDefault();$('upDrop').classList.remove('over')}));
$('upDrop').addEventListener('drop',e=>upLoadFile(e.dataTransfer.files[0]));
$('upX').onclick=closeUpload;$('upCancel').onclick=closeUpload;
$('upModal').addEventListener('click',e=>{if(e.target.id==='upModal')closeUpload()});
$('upModal').addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();closeUpload()}});
$('upAdd').onclick=()=>{
const txt=$('upText').value.trim();if(!txt)return;
const id='e'+Date.now().toString(36);
LIB.unshift({id,title:($('upTitle').value.trim()||titleOf(mdClean(txt))).slice(0,60),text:txt,kind:UP.kind,updated:Date.now()});
const onb=ONBOARD;ONBOARD=false;$('upCancel').textContent=$('upCancel').dataset.label||$('upCancel').textContent;
lsTry('lib',LIB);$('upModal').hidden=true;renderSwitcher();
self.track&&track('upload');
if(onb){save();loadEssay(id);renderSwitcher();setStart(0);toast('Saved. Off you go')}else switchEssay(id);
};

/* ---------- settings ---------- */
/* ---------- settings window ---------- */
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
const motionOn=()=>SET.motion&&!self.RECALL_REDUCE; // background motion: user switch AND not reduced motion
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
function bindSettings(){
const fill=el=>el.style.setProperty('--p',((el.value-el.min)/(el.max-el.min)*100)+'%');
const R=(id,key,fmt,rebuild)=>{const el=$(id),o=$('o'+id.slice(1));el.value=SET[key];o.textContent=fmt(SET[key]);fill(el);
el.oninput=()=>{SET[key]=+el.value;o.textContent=fmt(SET[key]);fill(el);saveSettings()};
if(rebuild)el.onchange=()=>{S.ti=0;if(phase!=='done')loadTask()}};
R('sDelay','delay',v=>v+'s');R('sStrict','strict',v=>v+'%');R('sPhrase','phrase',v=>v+'w',true);
const C=(id,key)=>{const el=$(id);el.checked=SET[key];el.onchange=()=>{SET[key]=el.checked;save();if(key==='essay'){S.ti=0;if(phase!=='done')loadTask()}else if(key==='hide'&&phase==='type')renderPrompt()}};
C('sEssay','essay');C('sHide','hide');C('sMotion','motion');
const A=(id,key)=>{const el=$(id);el.checked=!!SET[key];el.onchange=()=>{SET[key]=el.checked;saveSettings();applyA11y();if(key==='plainInput'){renderTyped();focusTa()}}};
A('sHc','hc');A('sPlain','plainInput');A('sKeys','keys');
const fsEl=$('sFs');fsEl.value=SET.fs;$('oFs').textContent=Math.round(SET.fs*100)+'%';fill(fsEl);
fsEl.oninput=()=>{SET.fs=+fsEl.value;$('oFs').textContent=Math.round(SET.fs*100)+'%';fill(fsEl);applyA11y();saveSettings()};
const rv=()=>SET.reduce==null?'auto':SET.reduce?'on':'off';
const rseg=()=>$('sReduce').querySelectorAll('button').forEach(b=>{const on=b.dataset.v===rv();b.classList.toggle('on',on);b.setAttribute('aria-checked',on)});rseg();
$('sReduce').onclick=e=>{const b=e.target.closest('button');if(!b)return;SET.reduce=b.dataset.v==='auto'?null:b.dataset.v==='on';rseg();saveSettings();applyA11y()};
syncModeRadios();applyA11y();
{const k=$('sKeys').closest('label').querySelector('small');if(k)k.textContent=`(${CTRL}H, ${CTRL}P, ${CTRL}O, ${CTRL}Z, ${CTRL}/, 1–3, ${IS_APPLE?'⌥':'Alt+'}number)`}
$('sChoice').checked=choiceOn();$('sChoice').onchange=e=>setChoice(e.target.checked);
$('btnReset').onclick=async()=>{if(await askConfirm('This essay’s progress and stats will start again from zero. Your essay text stays.',{title:'Reset progress?',ok:'Reset',danger:true})){const ep=(S.epoch|0)+1;S=DEFSTATE();S.resetAt=Date.now();S.epoch=ep;save();closeSettings();loadTask();openModal();announce('Progress reset for this essay.')}};
}

/* ---------- background: drifting aurora + particles + keystroke ripples ---------- */
(function(){
const c=$('bg'),x=c.getContext('2d');let W,H;
// touch tablets/phones (iPad reports itself as a Mac with touch points): lighter background so typing stays smooth
const TOUCH=matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>1;document.body.classList.toggle('touch',TOUCH);
const dpr=TOUCH?1:Math.min(1.5,devicePixelRatio||1);
const blobs=[{c:'56,189,248',r:.55,sx:.11,sy:.08,ox:.18,oy:.2,a:.30},{c:'125,211,252',r:.5,sx:.07,sy:.1,ox:.82,oy:.22,a:.32},{c:'167,139,250',r:.36,sx:.09,sy:.06,ox:.7,oy:.85,a:.16},{c:'14,165,233',r:.4,sx:.05,sy:.09,ox:.12,oy:.85,a:.18},{c:'186,230,253',r:.65,sx:.04,sy:.05,ox:.5,oy:.45,a:.35}];
const parts=Array.from({length:70},()=>({x:Math.random(),y:Math.random(),v:.00003+Math.random()*.0001,r:.5+Math.random()*1.7,a:.12+Math.random()*.3,p:Math.random()*6}));
const rip=[],sparks=[];
// The soft colour field is drawn on a tiny offscreen canvas and scaled up (it's blurry anyway): ~30x fewer pixels to fill.
const bc=document.createElement('canvas'),bx=bc.getContext('2d');let BW,BH;
// Reallocate only when the canvas's CSS box really changes (width change or a taller viewport). Height-only
// shrinks from the mobile address bar are ignored, and every reallocation repaints at once (no blank frame).
function size(force){
const r=c.getBoundingClientRect(),nw=Math.ceil(r.width),nh=Math.ceil(r.height);OT=r.top;
if(!force&&nw===W&&nh<=H)return;
W=nw;H=Math.max(nh,force?0:H||0);
c.width=Math.ceil(W*dpr);c.height=Math.ceil(H*dpr);x.setTransform(dpr,0,0,dpr,0,0);
BW=bc.width=Math.ceil(W/8);BH=bc.height=Math.ceil(H/8);
still=false;lastF=0;paint(performance.now());
}
let resizeT=0,OT=0; // OT: the canvas overhangs the top of the screen; page coordinates are shifted by it
addEventListener('resize',()=>{cancelAnimationFrame(resizeT);resizeT=requestAnimationFrame(()=>size())});
addEventListener('orientationchange',()=>setTimeout(()=>size(true),250));
if(matchMedia('(prefers-reduced-motion: reduce)').matches&&ls.get('settings')==null)SET.motion=false;
let lastF=0;
window.bgPulse=(px,py,col='56,189,248',a=.35)=>{if(TOUCH)return;rip.push({x:px,y:py-OT,t:0,c:col,a});if(rip.length>14)rip.shift()};
window.bgBurst=(px,py)=>{py-=OT;for(let i=0;i<26;i++){const an=Math.random()*6.28,sp=1.5+Math.random()*4;sparks.push({x:px,y:py,vx:Math.cos(an)*sp,vy:Math.sin(an)*sp,t:0})}rip.push({x:px,y:py,t:0,c:'16,185,129',a:.4,big:1})};
let still=false;
function frame(t){
requestAnimationFrame(frame);
if(document.hidden||!W)return;
const busy=rip.length||sparks.length;
if(!motionOn()&&!busy){if(still)return;still=true}else still=false;
// on touch devices the background holds still while you type (it competes with the keyboard for the GPU)
if(TOUCH&&!sparks.length&&performance.now()-(window.__lastKey||0)<1500)return;
if(t-lastF<(busy?16:TOUCH?66:33))return;lastF=t; // 30fps when calm (15 on touch), 60fps while ripples are animating
paint(t);
}
function paint(t){
if(!W||!H)return;
const s=motionOn()?t/1000:0,dark=document.body.classList.contains('gamify');
const DARKC=['101,163,13','163,230,53','124,58,237','21,128,61','34,197,94'];
bx.fillStyle=dark?'#06080b':'#f3f8ff';bx.fillRect(0,0,BW,BH);
for(const[bi,b] of blobs.entries()){
const cx=(b.ox+Math.sin(s*b.sx+b.ox*9)*.16)*BW,cy=(b.oy+Math.cos(s*b.sy+b.oy*7)*.16)*BH,R=b.r*Math.max(BW,BH);
const col=dark?DARKC[bi]:b.c,al=dark?b.a*.45:b.a;
const g=bx.createRadialGradient(cx,cy,0,cx,cy,R);g.addColorStop(0,`rgba(${col},${al})`);g.addColorStop(1,`rgba(${col},0)`);
bx.fillStyle=g;bx.fillRect(0,0,BW,BH);
}
x.imageSmoothingEnabled=true;x.drawImage(bc,0,0,W,H);
// slow contour rings
x.save();x.translate(W*.78,H*.3);x.rotate(s*.02);
for(let i=1;i<9;i++){x.beginPath();x.ellipse(0,0,i*70+Math.sin(s*.4+i)*6,i*52+Math.cos(s*.3+i)*6,0,0,7);x.strokeStyle=dark?`rgba(163,230,53,${.08-i*.007})`:`rgba(14,116,190,${.07-i*.006})`;x.lineWidth=1;x.stroke()}
x.restore();
for(const p of parts){
if(motionOn()){p.y-=p.v*16;if(p.y<-.02){p.y=1.02;p.x=Math.random()}}
x.beginPath();x.arc(p.x*W+Math.sin(s*.3+p.p)*14,p.y*H,p.r,0,7);x.fillStyle=dark?`rgba(190,242,100,${p.a})`:`rgba(14,165,233,${p.a})`;x.fill();
}
for(let i=rip.length-1;i>=0;i--){const r=rip[i];r.t+=1/60;const rad=r.t*(r.big?520:260),al=r.a*(1-r.t/(r.big?1.4:1));if(al<=0){rip.splice(i,1);continue}
x.beginPath();x.arc(r.x,r.y,rad,0,7);x.strokeStyle=`rgba(${r.c},${al})`;x.lineWidth=r.big?2:1.2;x.stroke()}
for(let i=sparks.length-1;i>=0;i--){const p=sparks[i];p.t+=1/60;p.x+=p.vx;p.y+=p.vy;p.vx*=.96;p.vy*=.96;const al=1-p.t/1.1;if(al<=0){sparks.splice(i,1);continue}
x.beginPath();x.arc(p.x,p.y,2.2*al+.4,0,7);x.fillStyle=`rgba(16,185,129,${al*.8})`;x.fill()}
}
window.bgRepaint=()=>{still=false;lastF=0;paint(performance.now())};
size(true);
requestAnimationFrame(frame);
})();

/* =====================================================================
RUBRIC GUIDE
===================================================================== */
const THSC='https://thsconline.github.io/s/yr12/English/trialpapers_paper2_advanced.html';
const SRC_THE='Counts cover 123 essay questions and 593 unseen short-answer questions from 144 English Advanced trial papers (43 schools), plus every HSC paper 2019–2025, as coded by Art of Smart Insights.';
const GUIDE={
common:{nav:'Common Module',small:'Texts & Human Experiences',kick:'Paper 1 · Standard & Advanced',title:'Texts and Human Experiences',
blurb:'How texts capture what it is like to be human, for one person and for groups, and how reading them should shift what you assume about people. The 2027 rubric adds named kinds of experience, a focus on identity, culture, acceptance and growth, and the pull between agency and conformity.',
fmt:[['Section I · 20 marks','Short answers on unseen texts. At least three questions are shared by both courses.'],['Section II · 20 marks','One essay on your prescribed text. Same question for Standard and Advanced.'],['1 h 30 min','Plus 10 minutes reading time for the whole of Paper 1.']],
links:[['Past trial papers ↗',THSC,1],['Trial stats source ↗','https://artofsmart.com.au/hsc-english/texts-and-human-experiences/']],
verbs:['deepen','examine','explore','represent','invite','challenge','consider','reflect'],
rubric:`Students deepen their understanding of how texts represent individual and collective human experiences. They examine how texts represent emotions and qualities related to these experiences. By responding to a range of texts, students explore how texts provide insight into emotional, intellectual, physical, cultural and lived experiences. They explore the ways texts represent identity, culture, acceptance and growth, invite the reader to see the world differently, and challenge assumptions. Students explore how texts can represent the tension between agency and conformity in our human experience, while examining the paradoxes of motivation and behaviour. Through critical and creative responses to texts, students consider the ways that texts encourage them to reflect personally and challenge their assumptions about the nature of human experience.`,
chips:['individual and collective human experiences','represent emotions and qualities','emotional, intellectual, physical, cultural and lived experiences','identity, culture, acceptance and growth','see the world differently, and challenge assumptions','represent the tension between agency and conformity','examining the paradoxes of motivation and behaviour','reflect personally and challenge their assumptions'],
outcomes:[['Understanding',[
['The language, forms and features of texts that ','shape meaning for different audiences and purposes',' in familiar and unfamiliar texts'],
['The language, forms and features of texts that ','shape a range of perspectives, personal and public worlds,',' and ','diverse human experiences',''],
['The ','aesthetic qualities of texts',' and the ','power of language',' to ','express personal ideas and experiences',''],
['Language used for ','making connections, questioning, affirming, challenging and speculating',' about texts'],
['The evaluative language and metalanguage used to make ','informed judgements',' about texts and express personal perspectives']]],
['Responding',[
['Develop ','creative, informed and sustained interpretations of texts,',' supported by close textual analysis'],
['','Compose',' creative and critical texts that ','affirm or challenge ideas, values and perspectives',' represented in a range of texts'],
['','Compose texts using structures, language features and stylistic elements for specific audiences,',' to reinterpret ideas and perspectives.']]]],
note:'Within the Texts and human experiences representation is central to students’ understanding and exploration of meaning. Textual representation reinforces or challenges values and attitudes, constructing meaning within texts through the depiction of people or ideas. Ultimately, representation provides ‘ways of seeing the world’ and positions the reader to respond to the text. Representation is done through the creation of storyworlds.',
newTitle:'New in the 2027 rubric: barely tested so far',
newLead:'These ideas are named for the first time. Trials have hardly touched them, so expect schools to write questions on them now.',
fresh:[
{t:'Identity, culture, acceptance and growth',p:'Our identities are shaped by the cultures we grow up in. Learning to accept or reject parts of ourselves and our communities is what produces growth, or leaves us stuck.',note:'Newly named. Lots of past questions brush against identity or culture, but acceptance and growth are rare.'},
{t:'Emotional, intellectual, physical, cultural and lived experiences',p:'Five labels for telling kinds of experience apart. Use them to sharpen what kind of experience your text is actually showing.',defs:[['Emotional','Feelings and inner states, from mild to overwhelming, positive or negative.'],['Intellectual','Thinking and learning: discovery, doubt, realisation, a belief shifting.'],['Physical','The body and its world: illness, work, hunger, ageing, journeys, places. Often carries what characters can’t say.'],['Cultural','Shaped by family, faith, language, nation and history: rituals, shared stories, moving between cultures.'],['Lived','First-hand: what it is actually like to be this person in this situation. Memoir and first-person voice.']],stat:'Only 1 trial question so far. NESA’s 2027 sample paper has a 5-mark unseen question on how a text represents a character’s lived experience.'},
{t:'The tension between agency and conformity',p:'Agency is the wish to choose your own life. Conformity is what a group asks of you in return for belonging and protection. Texts live in the friction between the two.',stat:'Only 3 trial questions so far (e.g. North Sydney Boys 2025, Fort St 2025).'}],
hotTitle:'Asked most often',hotLead:'Ranked by how often trial essay questions targeted each idea. Violet bars show the unseen short-answer share.',
hot:[
{t:'Human qualities and emotions',p:'Qualities are what make us human: imagination, reason, memory, connection. Emotions are what we feel in response to the world.',e:24,en:'30/123',s:27,sn:'163/593',y:[2021,2024,2025]},
{t:'Individual and collective experiences',p:'One character’s (or one reader’s) experience versus an experience shared by a family, culture or society.',e:18,en:'22/123',s:27,sn:'161/593',y:[2023]},
{t:'Seeing the world differently and challenging assumptions',p:'Good texts leave you with a new view of the world. Markers expect this idea at least implicitly in most essays.',e:18,en:'22/123',s:20,sn:'118/593',y:[2019]},
{t:'Paradoxes of motivation and behaviour',p:'Why people do what they do is rarely tidy. Choices can contradict values, and consequences can be unexpected or self-defeating.',e:14,en:'17/123',s:11,sn:'67/593',y:[]},
{t:'How the text represents experience',p:'Form, structure, language and perspective decide how an experience reaches the reader. Show how the author makes it matter, not just what happens.',e:14,en:'17/123',s:4,sn:'25/593',y:[2022]}],
oldTitle:'No longer named, still asked',
old:[{t:'Storytelling',p:'Who tells the story, what’s left out, the order of events, and why. Dropped from the Year 12 rubric but still fair game.',e:11,en:'14/123',s:10,sn:'58/593',y:[2020],note:'NESA’s own 2027 sample essay reuses the 2020 HSC storytelling question.'}],
src:SRC_THE},
modA:{nav:'Module A',small:'Textual Conversations',kick:'Paper 2 · Advanced',title:'Textual Conversations',
blurb:'A comparative study of two prescribed texts: where they echo each other (resonances), where they pull apart (dissonances), and how each composer is shaped by other texts, contexts and values. The 2027 rubric moves context and form to the front.',
links:[['Trial stats source ↗','https://artofsmart.com.au/hsc-english/advanced/textual-conversations/']],
verbs:['explore','reveal','identify','interpret','analyse','evaluate','compare','understand'],
rubric:`Students explore the ways in which the comparative study of texts can reveal resonances and dissonances within and between texts. Students identify, interpret, analyse and evaluate the textual features, conventions, contexts, values and purposes of TWO prescribed texts. By comparing TWO texts, students understand how authors are influenced by other texts, contexts and values, and how these shape meaning. Through their comparative study, they explore common or disparate issues, values, assumptions or perspectives, and the ways these are depicted. By responding imaginatively, interpretively and critically to the comparative study, students explore and evaluate individual and common textual features, concepts, ideas and values.`,
outcomes:[['Understanding',[
['The ','relationship between reader, author, text and context',''],
['Text structures, including ','mode, medium, form, language features and stylistic elements',', and the ways they ','shape meaning',''],
['The ','influence of context and values',' on the perspectives and ideas in texts'],
['','Theme, genre and aesthetic elements',', and the ways they are used to represent ','personal and public worlds',' and influence responses'],
['The ','influence of historical and cultural context',' across a pair of texts'],
['The ways a comparative study creates a ','new understanding and appreciation',' of each text']]],
['Responding',[
['Compose texts that explore text structures, language features and stylistic elements from different contexts to ','deepen understanding of how meaning is made',''],
['','Compare and evaluate',' textual form and language features in a pair of texts'],
['Compose ','sustained critical texts that affirm and challenge ideas, values and perspectives',' in a pair of texts'],
['Use the ','language of critical and creative expression',' to ','refine arguments',' and craft sustained writing'],
['Apply appropriate language and terminology used for ','making connections, interpreting texts and shaping meaning','']]]],
chips:['resonances and dissonances within and between texts','identify, interpret, analyse and evaluate','textual features, conventions, contexts, values and purposes','how authors are influenced by other texts, contexts and values','how these shape meaning','common or disparate issues, values, assumptions or perspectives','the ways these are depicted','imaginatively, interpretively and critically','individual and common textual features, concepts, ideas and values'],
newTitle:'New weight in the 2027 rubric',newLead:'Module A has no brand-new ideas, but these two get much more emphasis, and NESA’s 2027 sample paper leans on them.',
samples:[['Analyse how each text’s context shapes your understanding of the conversation between them.','NESA 2027 sample · Example A, any pair · 20 marks (paraphrased)'],['How has comparing the pair deepened your understanding of shared or differing perspectives on identity?','NESA 2027 sample · Example B, pair-specific · 20 marks (paraphrased)']],
fresh:[
{t:'Context and values',p:'Most thematic arguments come back to how texts change to suit their contexts, or how their contexts shape them. A universal concern, like mortality, recurs because it matters to every audience.',e:20,en:'15/75',y:[],note:'The 2027 rubric puts context up front, and the sample paper asks about it directly.'},
{t:'Form, medium and textual features',p:'Changing form changes how characters and ideas are portrayed. Don’t just name the form; make formal analysis part of the argument.',e:7,en:'5/75',y:[],note:'The rubric now names mode, medium and form.'}],
hotTitle:'Asked most often',hotLead:'Share of 75 trial essay questions.',
hot:[
{t:'Resonances and dissonances',p:'Resonances are where the two texts agree. Dissonances are where they diverge in representation, perspective or form.',e:24,en:'18/75',y:[2021,2024,2025]},
{t:'Shared and different issues, values and perspectives',p:'How each text handles the same themes and perspectives, similarly and differently.',e:19,en:'14/75',y:[2022]}],
oldTitle:'No longer in the rubric, less likely in 2027',
old:[{t:'Reimagining and reframing',p:'How the later text keeps, changes or answers back to the earlier one. Historically the most common angle, but the rubric dropped it.',e:31,en:'23/75',y:[2019,2020,2023],note:'Keep it as a backup angle, not the spine of your response. Marking criteria still mention composers being influenced by another text’s ideas, and reimagining now sits in Year 11.'}],
src:'Counts cover 75 essay questions from 144 English Advanced trial papers (43 schools), plus every HSC paper 2019–2025, as coded by Art of Smart Insights.'},
modB:{nav:'Module B',small:'Critical Study of Literature',kick:'Paper 2 · Advanced',title:'Critical Study of Literature',
blurb:'A close study of one substantial text as a whole: its construction, content and language, what makes it distinctive, what it means, why it lasts, and what it has given to culture. You need your own informed view, tested against other readings.',
links:[['Trial stats source ↗','https://artofsmart.com.au/hsc-english/advanced/critical-study-of-literature/']],
verbs:['develop','understand','appreciate','analyse','evaluate','investigate','explore','strengthen'],
rubric:`Students develop detailed analytical and critical knowledge of a substantial literary text. Through increasingly informed personal responses to the text in its entirety, students understand and appreciate the text’s distinctive qualities, notions of meaning, and significance. Students study ONE prescribed text, focusing on an analysis of the text’s construction, content and language. This enables students to develop informed personal perspectives of the text as well as an understanding of its cultural contribution, basing their judgements on evidence drawn from their critical reading. They evaluate the context of the text’s composition and reception, investigate and evaluate the perspectives of others, and explore the ideas in the text, further strengthening their personal perspectives.`,
outcomes:[['Understanding',[
['The ','relationship between reader, author, text and context',''],
['The ways a text can be ','valued for its aesthetic qualities',', text structures, language features and stylistic elements'],
['The ','language of critical expression',' in refining arguments and interpreting texts'],
['The ways ','mode, medium and form',' shape and inform responses to texts'],
['The ways language forms, features and structures are used to ','represent a range of perspectives',''],
['The ways texts can ','reflect, confirm and challenge expectations',' associated with particular ','genres and styles',''],
['The ways ','context can shape social, moral and ethical perspectives',' in texts'],
['The effect of ','theme and genre',', and how these can ','influence a texts value','']]],
['Responding',[
['Compose critical texts that ','affirm or challenge the ideas, values and perspectives',' represented in a complex text'],
['Compose ','informed personal responses',' shaped by critical interpretations of texts and textual analysis'],
['Support critical interpretations of texts through ','sustained argument and relevant textual analysis','']]]],
chips:['detailed analytical and critical knowledge','increasingly informed personal responses to the text in its entirety','distinctive qualities, notions of meaning, and significance','construction, content and language','informed personal perspectives','cultural contribution','evidence drawn from their critical reading','the context of the text’s composition and reception','the perspectives of others','explore the ideas in the text'],
newTitle:'New in the 2027 rubric: barely tested so far',newLead:'Two ideas are completely new, and one has been renamed. Expect trial writers to target them.',
samples:[['To what extent does your text use distinctive features to shape meaning?','NESA 2027 sample · Example A, any text · 20 marks (paraphrased)'],['A two-idea statement (“a representation of X and Y”): how far does it match your understanding of the text?','NESA 2027 sample · Examples B and C, text-specific · 20 marks (paraphrased)']],
fresh:[
{t:'Genre',p:'How your text meets, confirms or breaks the expectations of its genre, and how that affects its value.',stat:'0 trial questions so far.'},
{t:'Cultural contribution',p:'What the text has given culture since it was written: conversations, later works, ideas and ways of seeing.',stat:'Only 1 trial question so far (Fort St 2023).'},
{t:'The whole text and its notions of meaning',tag:'Changed',p:'Replaces “textual integrity”. What the text means as a whole and how its parts build that meaning. Often set with an extract you must connect to the whole.',e:10,en:'8/79',y:[2020,2025]}],
hotTitle:'Asked most often',hotLead:'Share of 79 trial essay questions.',
hot:[
{t:'Ideas and thematic concerns',p:'Most questions name an idea and ask how your text explores it. Know each big idea and how construction, content and language develop it across the whole text.',e:43,en:'34/79',y:[2019,2022]},
{t:'Significance, value and reception',p:'Why the text has lasted: what it still offers new generations, and how it has been received over time.',e:25,en:'20/79',y:[2021,2024]},
{t:'Distinctive qualities',p:'What makes the text recognisably its author’s, usually technical choices that create meaning in a unique way.',e:18,en:'14/79',y:[2023]},
{t:'Informed personal perspective',p:'Your own judgement, built on wide reading of other views and on evidence, rather than a recycled reading.',e:4,en:'3/79',y:[]}],
src:'Counts cover 79 essay questions from 144 English Advanced trial papers (43 schools), plus every HSC paper 2019–2025, as coded by Art of Smart Insights.'},
modC:{nav:'Module C',small:'The Craft of Writing',kick:'Paper 2 · Advanced',title:'The Craft of Writing',
blurb:'Your own sustained, cohesive writing for different purposes and audiences, modelled on quality past and contemporary texts, usually followed by a reflection on your choices. From 2027 there are no prescribed texts, and reflective writing joins the list of forms.',
fmt:[['Section III · 20 marks','One task, often a piece plus a reflection on it.'],['≈ 12 + 8 marks','Average trial split between piece and reflection when both are set.'],['No set texts','From 2027. Paper 2 is 2 hours plus 5 minutes reading.']],
links:[['Trial stats source ↗','https://artofsmart.com.au/hsc-english/advanced/the-craft-of-writing/']],
verbs:['strengthen','extend','reflect','apply','evaluate','generate','explore','experiment','consider','refine'],
rubric:`Students strengthen and extend their knowledge and skills as accomplished writers. They write for a range of purposes and audiences, using language to convey ideas with power and precision. Through the study of quality texts of the past as well as recognised contemporary works, students reflect on the process of writing and apply their knowledge of structure, language and form to create their own sustained and cohesive compositions. These provide models and stimulus for the development of their own complex ideas and written expression. They evaluate how writers use language critically, creatively and imaginatively for a range of purposes, including to express insights, evoke emotion, shape perspective or share aesthetic vision.

Students generate and explore various concepts through discussion and speculation. Through drafting and revising, they experiment with figurative, rhetorical and linguistic devices, including allusion, imagery, narrative voice, characterisation and tone. Students consider context, purpose and audience to deliberately shape meaning in their own compositions. They apply the conventions of spelling, punctuation and grammar appropriately in critical, creative and imaginative writing. Students also reflect on the processes of writing to develop their knowledge of textual forms and features in their own sustained and cohesive compositions.

Students refine and strengthen their own skills in composing highly crafted, imaginative, discursive, persuasive and reflective texts.`,
outcomes:[['Understanding',[
['The ','aesthetic qualities of texts',' and the ','power of language',' to express ideas, perspectives and experiences'],
['The ','forms, language features and stylistic choices',' that shape imaginative, discursive, persuasive and reflective texts']]],
['Responding',[
['Compose personal, critical and creative texts that ','experiment with emerging forms',', language features and literary devices including ','imagery, motif and allusion',''],
['Compose texts that use the ','language of critical and creative expression',''],
['Compose imaginative, discursive, persuasive and reflective texts that ','affirm or challenge ideas, values and perspectives',' represented in texts'],
['Use ','metalanguage',' to ','assess and reflect on their own process of writing',' and the writing of others'],
['','Draft, reflect, edit, refine, revise and present',' texts for a range of audiences and purposes']]]],
chips:['accomplished writers','a range of purposes and audiences','power and precision','quality texts of the past as well as recognised contemporary works','reflect on the process of writing','structure, language and form','sustained and cohesive compositions','complex ideas and written expression','critically, creatively and imaginatively','express insights, evoke emotion, shape perspective or share aesthetic vision','discussion and speculation','drafting and revising','figurative, rhetorical and linguistic devices','allusion, imagery, narrative voice, characterisation and tone','context, purpose and audience','deliberately shape meaning','conventions of spelling, punctuation and grammar','textual forms and features','highly crafted, imaginative, discursive, persuasive and reflective texts'],
newTitle:'New in the 2027 rubric: barely tested so far',newLead:'One new form, and a change to what the reflection is about.',
samples:[['(a) Continue a literary extract as imaginative, discursive or persuasive writing that evokes a particular emotion.','NESA 2027 sample · Part (a) · 10 marks (paraphrased)'],['(b) Evaluate how your language in (a) evokes that emotional response.','NESA 2027 sample · Part (b) · 10 marks (paraphrased)']],
fresh:[
{t:'Reflective writing',p:'Looks back on an experience, idea or moment and explores what it means to you. It’s close to discursive writing but turns inward: the thinking is the point, and it can end on an open question.',stat:'No trial task has asked for it yet. The HSC offered it as a choice in 2023 and 2024.'},
{t:'Reflections without prescribed texts',p:'Reflections are now about your own craft and the writing that inspired it, not links back to a set text. Think about who you’d be writing for if you were trying to get published.'}],
formsTitle:'The forms you can be asked for',
forms:[['Imaginative',17,'11/64',61,'39/64','Fiction with at least one character and something that happens, even if that’s just going somewhere or noticing something.'],['Discursive',16,'10/64',62,'40/64','Discusses a topic, tells a personal story, or both, without trying to convince. Memoir and autobiographical writing fit here.'],['Persuasive',2,'1/64',59,'38/64','Argues the author’s view, usually structured like an essay.'],['Reflective',0,'0/64',0,'0/64','New for 2027 (see above).']],
setup:[['Respond to a stimulus idea',55,'35/64'],['Given opening',20,'13/64'],['Write to a title or theme',6,'4/64'],['Central metaphor or motif',6,'4/64'],['Incorporate a quote or line',5,'3/64']],
refl:[['Explain composition choices',57,'16/28'],['Analyse own language use',21,'6/28'],['Evaluate effectiveness',18,'5/28'],['Analyse a mentor text or stimulus',4,'1/28']],
src:'Counts cover 92 craft of writing tasks (64 creative pieces) from 67 English Advanced trial papers, plus every HSC paper 2019–2025, as coded by Art of Smart Insights. 28 of the 92 tasks include a reflection.'}
};

const yearsHtml=y=>`<div class="years">${y.length?y.map(v=>`<span>HSC ${v}</span>`).join(''):'<span class="none">not yet set in an HSC paper</span>'}</div>`;
const bar=(label,v,n,scale,alt)=>`<div class="bar"><span class="bl">${label}</span><div class="bt"><div class="bf ${alt?'alt':''}" data-w="${Math.min(100,v/scale*100)}"></div></div><span class="bv">${v}% <small>${n}</small></span></div>`;
function ideaHtml(it,i,cls,scale=50){
return `<div class="idea ${cls}"><div class="num">${i}</div><div>
<h3>${it.t}${it.tag?` <span class="rt quote">${it.tag}</span>`:''}</h3><p>${it.p}</p>
${it.defs?`<div class="defs">${it.defs.map(([a,b])=>`<div><b>${a}</b>${b}</div>`).join('')}</div>`:''}
${it.e!=null?`<div class="bars">${bar('Essay Qs',it.e,it.en,scale)}${it.s!=null?bar('Short answers',it.s,it.sn,scale,1):''}</div>`:''}
${it.y?yearsHtml(it.y):''}
${it.stat?`<div class="note">${it.stat}</div>`:''}${it.note?`<div class="note">${it.note}</div>`:''}
</div></div>`;
}
function renderModule(m){
let n=0,h=`<section class="gsec ghero"><div class="kick">${m.kick}</div><h1>${m.title}</h1><p>${m.blurb}</p>
${m.fmt?`<div class="fmt">${m.fmt.map(([a,b])=>`<div><b>${a}</b><span>${b}</span></div>`).join('')}</div>`:''}
<div class="rlab">NESA verbs</div><div class="chips verbs">${m.verbs.map(c=>`<span>${c}</span>`).join('')}</div>
<div class="glinks">${m.links.map(([t,u,p])=>`<a class="btn ${p?'primary':''}" href="${u}" target="_blank" rel="noopener">${t}</a>`).join('')}</div></section>`;
let rub=esc(m.rubric);
[...m.chips].sort((a,b)=>b.length-a.length).forEach(c=>{rub=rub.split(esc(c)).join(`<mark class="rk">${esc(c)}</mark>`)});
const seg=parts=>parts.map((p,i)=>i%2?`<mark class="rk">${esc(p)}</mark>`:esc(p)).join('');
h+=`<section class="gsec"><h2>The NESA rubric <span class="tag hot">exact wording</span></h2>
<div class="rubric">${rub.split(/\n\s*\n/).map(p=>`<p>${p}</p>`).join('')}</div>
${m.outcomes?m.outcomes.map(([t,list])=>`<div class="rlab">${t}</div><ul class="outc">${list.map(l=>`<li>${seg(l)}</li>`).join('')}</ul>`).join(''):''}
${m.note?`<div class="rnote">${esc(m.note)}</div>`:''}
<div class="rlab">Key terms to use in your responses</div><div class="chips">${m.chips.map(c=>`<span>${esc(c)}</span>`).join('')}</div></section>`;
h+=`<section class="gsec"><h2>${m.newTitle} <span class="tag new">2027</span></h2><p class="lead">${m.newLead}</p>
${m.samples?m.samples.map(([q,s])=>`<div class="sample">${q}<small>${s}</small></div>`).join(''):''}
${m.fresh.map(it=>ideaHtml(it,++n,'newi')).join('')}</section>`;
if(m.hot)h+=`<section class="gsec"><h2>${m.hotTitle} <span class="tag hot">trials</span></h2><p class="lead">${m.hotLead} Bar scale 0–50%.</p>${m.hot.map(it=>ideaHtml(it,++n,'')).join('')}</section>`;
if(m.forms){
h+=`<section class="gsec"><h2>${m.formsTitle} <span class="tag hot">trials</span></h2><p class="lead">Sky = set as the only form · violet = offered as one of several choices (of 64 creative tasks).</p>
${m.forms.map(([f,o,on,c,cn,d],i)=>`<div class="idea"><div class="num">${i+1}</div><div><h3>${f}</h3><p>${d}</p><div class="bars">${bar('Only form',o,on,100)}${bar('One choice',c,cn,100,1)}</div></div></div>`).join('')}</section>
<section class="gsec"><h2>How tasks set you up <span class="tag hot">trials</span></h2><p class="lead">A literary stimulus is either your opening lines or an idea to build on. With visual stimulus, the strongest responses use the image metaphorically, not literally.</p>
<div class="bars">${m.setup.map(([a,v,c])=>bar(a,v,c,100)).join('')}</div></section>
<section class="gsec"><h2>What reflections ask <span class="tag hot">trials</span></h2><p class="lead">Of 28 trial reflections. The usual split is 12 marks for the piece and 8 for the reflection.</p>
<div class="bars">${m.refl.map(([a,v,c])=>bar(a,v,c,100,1)).join('')}</div></section>`;
}
if(m.old)h+=`<section class="gsec"><h2>${m.oldTitle} <span class="tag old">legacy</span></h2>${m.old.map(it=>ideaHtml(it,++n,'oldi')).join('')}</section>`;
h+=`<p class="src">${m.src} Figures and idea summaries adapted from Art of Smart’s HSC 2027 module pages and rewritten for this guide.</p>`;
return h;
}
/* Exam tips, the Adaptation guide, the Mod C exemplars and the writing booklet are the NSBHS toolkit. They are
   stored encrypted (js/toolkit.vault.json) and unlocked with the access password: see js/toolkit.js. */

function bookletHtml(){
return `<section class="gsec ghero"><div class="kick">Practice paper</div><h1>Writing booklet</h1><p>A 9-page lined booklet for timed practice. It’s built into the page, so it works offline.</p></section>
<section class="gsec"><div class="booklet"><div class="page"><b>English Advanced</b><i>Writing Booklet · NESA number ______</i></div>
<div><h2>English Advanced writing booklet</h2><p class="lead">PDF · 9 pages · ${self.TOOLKIT&&self.TOOLKIT.booklet?Math.round(self.TOOLKIT.booklet.length*3/4/1024)+' KB · ':''}lined answer pages with a NESA number box.</p>
<div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn primary" id="bDl">Download PDF</button><button class="btn" id="bOpen">Open in new tab</button></div>
<p class="src" style="margin-top:12px">Print a few and do timed responses by hand. In the exam, how fast you write is the real limit.</p></div></div></section>`;
}
/* the booklet PDF comes from the unlocked toolkit */
async function bookletBlob(){const b64=self.TOOLKIT&&self.TOOLKIT.booklet;if(!b64)throw new Error('locked');const b=atob(b64),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return new Blob([u],{type:'application/pdf'})}
const GNAV=[['common','Common Module','Texts & Human Experiences'],['modA','Module A','Textual Conversations'],['modB','Module B','Critical Study of Literature'],['modC','Module C','The Craft of Writing'],['tips','Exam tips','PEPSS/PECIL, SAQ, themes, Mod C'],['adapt','Adaptation guide','SAQ, phrases, every module'],['exemplars','Mod C exemplars','Read them, or memorise one'],['booklet','Writing booklet','Download the PDF']];
const DOCS=()=>(self.TOOLKIT&&self.TOOLKIT.docs)||{ex:[]};
const chipList=a=>`<div class="chips">${a.map(x=>`<span>${x}</span>`).join('')}</div>`;
const qList=(title,qs,hard)=>`<details class="qset"><summary><b>${title}</b><small>${qs.length+(hard?hard.length:0)} questions</small></summary><ol>${qs.map(q=>`<li>${q}</li>`).join('')}</ol>${hard?`<div class="rlab">Extra challenging</div><ol start="${qs.length+1}">${hard.map(q=>`<li>${q}</li>`).join('')}</ol>`:''}</details>`;
const dell=items=>`<ul class="dell">${items.map(x=>`<li>${x}</li>`).join('')}</ul>`;

function adaptHtml(){return self.TOOLKIT?self.TOOLKIT.adapt:''}
function exemplarsHtml(){
return `<section class="gsec ghero"><div class="kick">Module C</div><h1>Mod C exemplars</h1><p>Imaginative and discursive pieces, with reflections. Read one, or hit <b>Memorise</b> to add it to your essays.</p></section>
${DOCS().ex.map((d,i)=>`<details class="gsec doc ex"><summary><span class="exn">${i+1}</span><span class="ext"><b>${esc(d.title)}</b><small>${esc(d.form)} · ${d.words} words</small></span><button class="btn primary small" data-mem="${i}">Memorise</button></summary>${d.html}</details>`).join('')}`;
}
function bindExemplars(){
document.querySelectorAll('[data-mem]').forEach(b=>b.onclick=e=>{
e.preventDefault();e.stopPropagation();
const d=DOCS().ex[+b.dataset.mem];
let e2=LIB.find(x=>x.src===d.title);
if(!e2){e2={id:'e'+Date.now().toString(36),title:d.title,text:d.text,kind:'creative',src:d.title,updated:Date.now()};LIB.unshift(e2);lsTry('lib',LIB)}
renderSwitcher();setView('mem');switchEssay(e2.id);
});
}
function renderGuide(){
const nb=([id,a,b])=>`<button data-g="${id}" class="${SET.gsec===id?'on':''}">${a}<small>${b}</small></button>`;
$('gnav').innerHTML=`<div class="gnh">Modules · rubric &amp; trial stats</div>`+GNAV.slice(0,4).map(nb).join('')+`<div class="gnh">Toolkit</div>`+GNAV.slice(4).map(nb).join('');
const g=SET.gsec;
const toolkit=['tips','booklet','adapt','exemplars'].includes(g);
if(toolkit&&!self.TOOLKIT&&self.Toolkit){$('gmain').innerHTML=self.Toolkit.lockedHtml();self.Toolkit.bindLock(()=>renderGuide());return}
$('gmain').innerHTML=g==='tips'?self.TOOLKIT.tips:g==='booklet'?bookletHtml():g==='adapt'?adaptHtml():g==='exemplars'?exemplarsHtml():renderModule(GUIDE[g]||GUIDE.common);
requestAnimationFrame(()=>document.querySelectorAll('.bf').forEach(el=>el.style.width=el.dataset.w+'%'));
if(g==='exemplars')bindExemplars();
if(g==='booklet'){
$('bDl').onclick=async()=>{let blob;try{blob=await bookletBlob()}catch(e){toast('Couldn’t load the booklet. Check your connection.');return}const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='English-Advanced-Writing-Booklet.pdf';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)};
$('bOpen').onclick=async()=>{const w=window.open('','_blank');if(w)w.opener=null;try{const blob=await bookletBlob();if(w)w.location=URL.createObjectURL(blob)}catch(e){if(w)w.close();toast('Couldn’t load the booklet. Check your connection.')}};
}
}
$('gnav').addEventListener('click',e=>{const b=e.target.closest('[data-g]');if(!b)return;SET.gsec=b.dataset.g;saveSettings();renderGuide();window.scrollTo({top:0,behavior:'smooth'})});

/* =====================================================================
PET FALCON: pixel sprite, eats cookies, studies maths, reacts to you
===================================================================== */
