/* RecallHSC engine · parser: sentences, essay structure, creative/discursive moves, motifs
   Pure functions shared by the page, the compute worker and the tests. Loaded as a classic script (window /
   worker global: RecallEngine) or required from Node (module.exports). Code moved verbatim from index.html. */
(function(E){
const {items,tokens,mdClean,FN,BREAK}=E;
const ABBR=/^(?:e\.g|i\.e|etc|vs|cf|al|Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|ch|pp|p|vol|no|ed|eds|fig|approx|c|ca)\.$/i;
function splitSentences(t){
const out=[];let depth=0,sq=false,start=0;
for(let i=0;i<t.length;i++){
const c=t[i];
if(c==='“')depth++;else if(c==='”')depth=Math.max(0,depth-1);else if(c==='"')sq=!sq;
if(!'.?!'.includes(c))continue;
if(c==='.'&&(t[i+1]==='.'||t[i-1]==='.'))continue;
const lastTok=t.slice(start,i+1).split(/\s+/).pop().replace(/^[“"‘(]+/,'');
if(c==='.'&&(ABBR.test(lastTok)||/^[A-Z]\.$/.test(lastTok)))continue;
let j=i+1,d=depth,q=sq;
while(j<t.length&&'”’)"\''.includes(t[j])){if(t[j]==='”')d=Math.max(0,d-1);if(t[j]==='"')q=!q;j++}
const rest=t.slice(j).replace(/^\s+/,'');
if(d===0&&!q&&(j>=t.length||(/\s/.test(t[j])&&/^[A-Z0-9“"‘(]/.test(rest)))){
out.push(t.slice(start,j).trim());start=j;i=j-1;depth=0;sq=false;
}
}
if(t.slice(start).trim())out.push(t.slice(start).trim());
return out;
}
/* IQTVE detection. English essays aren't a formula, so this reads cues rather than counting sentences:
- topic sentence: first sentence of every paragraph (its own unit)
- a quotation of 3+ words is evidence and anchors an IQTVE; a 1–2 word echo ("hollow") inside a sentence is analysis
- one or two plain sentences right before a quote are its idea statement / lead-in
- sentences opening like analysis ("The metaphor…", "This…", "Thus…") always attach as evaluation
- a second quote with no evaluation in between joins the same IQTVE (evidence chains), max 2 quotes
- each IQTVE holds roughly one quote; quote-free paragraphs (intro/conclusion) group in pairs */
const quotedWords=s=>{let best=0;for(const m of s.matchAll(/“([^”]+)”|"([^"]+)"|(?:^|[\s(—–])‘([^’]+)’(?=[\s.,;:!?)]|$)/g)){const w=(m[1]||m[2]||m[3]||'').trim().split(/\s+/).filter(Boolean).length;if(w>best)best=w}return best};
const TECH='irony|ironic|metaphor|metaphors|simile|juxtaposition|imagery|image|motif|symbol|symbolism|personification|tricolon|paradox|hyperbole|allusion|repetition|anaphora|epistrophe|contrast|tone|diction|phrase|line|verb|adjective|noun|use|effect|shift|structure|form|parallel|pun|oxymoron|binary|antithesis|word|words|rhetorical|question|enjambment|caesura|sibilance|alliteration|anecdote|dialogue|monologue|soliloquy|characterisation|setting|narration|narrator|voice|perspective|refrain|cumulation|listing|accumulation|emotive|connotation|connotations|truncated|fragment|imperative|modality|register|epithet|apostrophe|chiasmus';
const ANALYSIS_RX=new RegExp(`^(?:[“"‘(]*)(?:this|these|that|those|such|thus|hence|here|therefore|consequently|ultimately|accordingly|in (?:doing so|turn|this way|effect)|as (?:such|a result)|by (?:doing so|this|contrast)|through (?:this|such|these)|so|indeed|evidently|clearly|crucially|notably|similarly|likewise|conversely|in contrast|(?:the|his|her|their|its|this|such|[a-z]+’s) (?:[a-z]+ ){0,2}(?:${TECH}))\\b`,'i');
const VERB_RX=/\b(?:reveal|reveals|expose|exposes|suggest|suggests|implies|imply|highlight|highlights|underscore|underscores|emphasi[sz]es|convey|conveys|evoke|evokes|position|positions|invite|invites|recall|recalls|reflect|reflects|symboli[sz]es|signifies|illustrate|illustrates|demonstrate|demonstrates|depict|depicts|portray|portrays|represent|represents|reinforce|reinforces|recast|recasts|reduce|reduces|juxtapose|juxtaposes|foreground|foregrounds|capture|captures|accentuate|accentuates|elucidate|elucidates|delineate|delineates|epitomi[sz]es|encapsulate|encapsulates|critiques|satiri[sz]es|undermines|subverts|amplifies|evinces|exemplifies)\b/i;
const outsideQuoteWords=s=>s.replace(/“[^”]*”|"[^"]*"|‘[^’]*’/g,' ').split(/\s+/).filter(w=>/\w/.test(w)).length;
const hasQuote=s=>quotedWords(s)>0;
const TECH_RX=new RegExp(`\\b(?:${TECH})\\b`,'i');
function detectStructure(ss){
const n=ss.length,qw=ss.map(quotedWords),major=qw.map(w=>w>=3),roles=new Array(n),unitEnd=new Array(n).fill(false);
let cur=null;
// an integrated quote sentence with lots of commentary outside the quote marks already evaluates itself
const selfEval=i=>major[i]&&outsideQuoteWords(ss[i])>=12?1:0; // reporting verbs ("Ovid recalls") don't count as evaluation
const open=(i,role,state)=>{if(i>0)unitEnd[i-1]=true;cur={n:1,state,quotes:state==='quote'?1:0,evals:state==='quote'?selfEval(i):0,leads:role==='lead'?1:0};roles[i]=role};
const add=(i,role,state)=>{cur.n++;roles[i]=role;if(state)cur.state=state;if(role==='analysis')cur.evals++;if(role==='quote')cur.quotes++;if(role==='lead')cur.leads++};
for(let i=0;i<n;i++){
const s=ss[i];
if(i===0){roles[0]='ts';unitEnd[0]=true;cur=null;continue}
const isAnalysis=ANALYSIS_RX.test(s)||VERB_RX.test(s)||(qw[i]>0&&!major[i]);
const nextMajor=!!major[i+1],next2Major=!!major[i+2];
if(major[i]){
if(cur&&cur.state==='lead'){add(i,'quote','quote');cur.evals+=selfEval(i);continue} // idea statement → its quote
if(cur&&cur.state==='quote'&&cur.evals===0&&cur.quotes<2&&!ANALYSIS_RX.test(s)){add(i,'quote','quote');cur.evals+=selfEval(i);continue} // evidence chain
open(i,'quote','quote');continue;
}
if(!cur){open(i,nextMajor||(next2Major&&!isAnalysis)?'lead':'context',nextMajor||(next2Major&&!isAnalysis)?'lead':'context');continue}
if(cur.state==='quote'||cur.state==='analysis'){
if(cur.evals===0){add(i,'analysis','analysis');continue}                           // first sentence after a quote evaluates it
if(isAnalysis&&cur.n<6){add(i,'analysis','analysis');continue}                     // further evaluation
// only start the next IQTVE's idea statement once this one has been properly evaluated
if(cur.evals>=2&&(nextMajor||(next2Major&&!isAnalysis))){open(i,'lead','lead');continue}
if(cur.n<5){add(i,'analysis','analysis');continue}                                  // extra evaluation / link
open(i,'context','context');continue;
}
if(cur.state==='lead'){                                                              // multi-sentence idea statement
if(nextMajor&&cur.leads<2){add(i,'lead','lead');continue}
cur.state='context';add(i,'context');continue;
}
// quote-free stretch (intro / conclusion / context)
if(nextMajor){open(i,'lead','lead');continue}
if(cur.n>=2)open(i,'context','context');else add(i,'context');
}
unitEnd[n-1]=true;
return{roles,unitEnd};
}
const HEAD_RX=/^(?:#{1,6}\s|\*\*[^*]+\*\*\s*$)/;
function looksHeading(raw,clean){
if(HEAD_RX.test(raw.trim()))return true;
const w=clean.split(/\s+/).length;
return w<=7&&!/[.!?”"’,;:]$/.test(clean)&&!/^[“"‘]/.test(clean);
}
function looksCreative(text){
const lines=text.replace(/\r/g,'').split(/\n/).map(l=>l.trim()).filter(Boolean);
const heads=lines.filter(l=>looksHeading(l,mdClean(l))).length;
return /^\W*(reflection|rationale)\b/im.test(mdClean(text))||heads>=3||lines.filter(l=>l.split(/\s+/).length<=6).length/lines.length>.35;
}
/* Discursive writing: personal, exploratory, lots of "I/we", questions and "perhaps", and little literary analysis. */
function discScore(text){
const t=mdClean(text),w=t.split(/\s+/).filter(Boolean).length||1;
const fp=(t.match(/\b(?:I|I’m|I'm|I’ve|I've|my|me|we|our|us)\b/g)||[]).length/w*100;
const q=(t.match(/\?/g)||[]).length;
const refl=(t.match(/\b(?:perhaps|maybe|I (?:think|wonder|suppose|remember|realise|realize)|we (?:tend|often|forget|remember|are)|what if|it seems)\b/gi)||[]).length;
const ss=splitSentences(t.replace(/\s+/g,' ')),ana=ss.filter(x=>ANALYSIS_RX.test(x)||VERB_RX.test(x)).length/Math.max(1,ss.length);
return{fp,q,refl,ana};
}
function looksDiscursive(text){const d=discScore(text);return d.ana<.3&&((d.fp>=2.5)+(d.q>=2)+(d.refl>=2))>=2}
function detectKind(text){return looksDiscursive(text)||looksCreative(text)?'creative':'essay'}
/* Moves in discursive prose: anecdote (something that happened), reflection (thinking about it),
question, turn (a pivot: "But…", "And yet…") and line (a short closing sentence). */
const TURN_RX=/^(?:[“"‘(]*)(?:but|and yet|yet|still|however|instead|then again|even so|except|and now|only now)\b/i;
const ANEC_RX=/\b(?:I remember|I was|we were|when I|when we|years ago|as a child|that (?:day|night|summer|winter|morning|evening|afternoon|year)|once,|last (?:week|year|summer)|my (?:mother|father|grandmother|grandfather|mum|dad|nan|brother|sister))\b/i;
const REFL_RX=/\b(?:perhaps|maybe|I (?:think|wonder|suppose|realise|realize|believe|know)|we (?:tend|often|forget|remember|are|all|never|always)|it seems|what if|there is something)\b/i;
const ABSTRACT_RX=/\b(?:must|can only|cannot|can never|is to|why|write|writing|words|stories|art|meaning|world|reality|perception|mind|truth|we|us|our|one’s|people|everyone|nobody|no one|humans?|humanity|life|memory|memories|time|truth|love|grief|identity|belonging|home|history|language|always|never|sometimes|often|perhaps|maybe|somehow)\b/i;
const PAST_RX=/\b(?:was|were|had|did|went|came|saw|said|told|took|felt|knew|thought|found|left|sat|stood|ran|held|\w{3,}ed)\b/gi;
const PRES_RX=/\b(?:is|are|am|do|does|has|have|can|will|seem|seems|become|becomes|remain|remains|mean|means)\b/gi;
function tagMoves(ss){
let prev='reflect';
return ss.map((s,i)=>{
const words=s.split(/\s+/).length,plain=s.replace(/“[^”]*”|"[^"]*"/g,' ');
let r;
if(/\?["”’)]*$/.test(s.trim()))r='question';
else if(TURN_RX.test(s))r='turn';
else if(ANEC_RX.test(plain))r='anecdote';
else if(REFL_RX.test(plain))r='reflect';
else{const pa=(plain.match(PAST_RX)||[]).length,pr=(plain.match(PRES_RX)||[]).length;
r=pr>=pa&&ABSTRACT_RX.test(plain)?'reflect':pa||pr?'anecdote':prev}
const speech=/[“"]/.test(s);
if(r!=='question'&&!speech&&((ss.length>1&&i===ss.length-1&&words<=8)||(ss.length===1&&words<=8)))r='line';
if(r==='anecdote'||r==='reflect')prev=r;
return r;
});
}
// recurring phrases across paragraphs: the piece's motifs. Each later echo remembers where it first appeared.
function origPhrase(text,k){
const its=items(text).filter(i=>i.norm),g=k.split(' ');
for(let i=0;i+g.length<=its.length;i++)if(g.every((w,j)=>its[i+j].norm===w))return its.slice(i,i+g.length).map(x=>x.orig).join(' ').replace(/^[“"‘(—–-]+|[”"’),.;:!?—–-]+$/g,'').replace(/(\D)\d+$/,'$1');
return k;
}
function pieceStyle(sents){
// share of narrative vs reflective words (questions and turns count as reflective; lines and essay-style reflections are ignored)
let n=0,d=0;sents.forEach(x=>{if(x.role==='anecdote')n+=x.wc;else if(['reflect','question','turn'].includes(x.role))d+=x.wc});
if(n+d<40)return'';const r=d/(n+d);return r<.22?'narrative':r>.6?'discursive':'hybrid';
}
function markMotifs(sents){
const occ=new Map();
sents.forEach((x,g)=>{if(x.role==='heading')return;const tk=tokens(x.text),seen=new Set();
for(let n=1;n<=6;n++)for(let i=0;i+n<=tk.length;i++){const gram=tk.slice(i,i+n);
if(FN.has(gram[0])||FN.has(gram[n-1])||BREAK.has(gram[0])||BREAK.has(gram[n-1]))continue;
if(!gram.some(w=>!FN.has(w)&&!BREAK.has(w)&&w.length>=4))continue;
if(n===1&&gram[0].length<6)continue;
const k=gram.join(' ');if(seen.has(k))continue;seen.add(k);
if(!occ.has(k))occ.set(k,[]);occ.get(k).push(g)}});
const cands=[...occ].filter(([k,gs])=>new Set(gs.map(g=>sents[g].p)).size>=2&&(k.includes(' ')?gs.length>=2:gs.length>=3))
.sort((a,b)=>b[0].split(' ').length-a[0].split(' ').length||b[1].length-a[1].length);
// longest phrases first; a shorter phrase that sits inside (or overlaps) one already kept is the same motif
const words=k=>' '+k+' ',kept=[];
for(const[k,gs]of cands){
if(gs.length>Math.max(3,sents.length*.4))continue;
const sh=gs.filter(g=>kept.some(m=>m.gs.includes(g))).length;
if(kept.some(m=>words(m.k).includes(words(k))||(m.k.split(' ').some(w=>k.split(' ').includes(w)&&w.length>=4)&&sh>=gs.length*.5)))continue;
kept.push({k,gs});
}
const top=kept.sort((a,b)=>b.gs.length*Math.min(4,b.k.split(' ').length)-a.gs.length*Math.min(4,a.k.split(' ').length)).slice(0,6);
for(const m of top){const f=m.gs[0],done=new Set([sents[f].p]);for(const g of m.gs.slice(1)){const p=sents[g].p;if(done.has(p))continue;if(!sents[g].echo||m.k.length>sents[g].echo.k.length){sents[g].echo={k:m.k,first:f};done.add(p)}}}
return top.map(m=>origPhrase(sents[m.gs[0]].text,m.k));
}
/* Essays: topic sentence / quote / analysis units (detectStructure).
Creative pieces: headings and short poetic lines become their own units; full-piece recalls land at the
end of each section or every ~120 words; any "Reflection" section is analysed like an essay. */
function parseEssay(text,kind){
let paras=[],meta=[];
if(kind==='creative'){
const rawBlocks=text.replace(/\r/g,'').split(/\n\s*\n+/);
let mode='creative';
for(const rb of rawBlocks){
const rawLines=rb.split('\n').filter(l=>l.trim()),lines=rawLines.map(mdClean).filter(Boolean);
if(!lines.length)continue;
if(lines.length===1&&looksHeading(rawLines[0],lines[0])){
paras.push([lines[0]]);meta.push('heading');
if(/reflection|rationale/i.test(lines[0]))mode='essay';
continue;
}
if(mode==='essay'){const ss=splitSentences(lines.join(' ').replace(/\s+/g,' '));if(ss.length){paras.push(ss);meta.push('essay')}continue}
const shortLines=lines.length>1&&lines.every(l=>l.split(/\s+/).length<=16);
const ss=shortLines?lines.flatMap(l=>splitSentences(l)):splitSentences(lines.join(' ').replace(/\s+/g,' '));
if(ss.length){paras.push(ss);meta.push('disc')} // short lines stay one per sentence, but still get move tags
}
}else{
const clean=mdClean(text);
const blocks=(/\n\s*\n/.test(clean)?clean.split(/\n\s*\n+/):clean.split(/\n+/)).map(p=>p.replace(/\s+/g,' ').trim()).filter(Boolean);
paras=blocks.map(splitSentences).filter(ss=>ss.length);meta=paras.map(()=>'essay');
}
const sents=[],pstart=[];let since=0;
paras.forEach((ss,p)=>{
pstart[p]=sents.length;const m=meta[p],nextHead=meta[p+1]==='heading'||p===paras.length-1;
if(m==='essay'){
const{roles,unitEnd}=detectStructure(ss);
ss.forEach((t,s)=>sents.push({p,s,text:t,wc:tokens(t).length,role:roles[s],unitEnd:unitEnd[s],cp:roles[s]==='ts'||unitEnd[s]||s===ss.length-1}));
since=0;return;
}
if(m==='disc'){
// beats: an anecdote and the reflection on it. A beat ends before a turn, before a new anecdote once
// it has been reflected on, after a closing line, at the paragraph end, or after 5 sentences.
// Whole-piece recalls land on turns (60+ words in) and at section ends.
const roles=tagMoves(ss);let bl=0,hadR=false;
ss.forEach((t,s)=>{
const wc=tokens(t).length,r=roles[s],nr=roles[s+1],last=s===ss.length-1;since+=wc;bl++;if(r!=='anecdote')hadR=true;
const ue=last||r==='line'||nr==='turn'||(nr==='anecdote'&&hadR)||bl>=5;if(ue){bl=0;hadR=false}
const cp=(r==='turn'&&since>=60)||(last&&(since>=150||nextHead));if(cp)since=0;
sents.push({p,s,text:t,wc,role:r,unitEnd:ue,cp});
});
return;
}
ss.forEach((t,s)=>{
const wc=tokens(t).length;since+=wc;
const last=s===ss.length-1,cp=m!=='heading'&&last&&(since>=120||nextHead);
if(cp)since=0;
sents.push({p,s,text:t,wc,role:m==='heading'?'heading':m==='lines'?'line':'prose',unitEnd:cp,cp});
});
});
return{paras,sents,pstart,total:sents.reduce((a,x)=>a+x.wc,0),kind:kind||'essay',formulaic:isFormulaic(sents),motifs:kind==='creative'?markMotifs(sents):[],style:kind==='creative'?pieceStyle(sents):''};
}
/* Formulaic IQTVE essays (Idea. Quote. Technique. Evaluation. — or QTVE, IQTVEVE…) set the idea out in its own
sentence and drop the quote in with a short lead-in. Integrated essays weave quotes into their own claims, so
their units are labelled neutrally instead. */
function isFormulaic(sents){
let units=0,hits=0,u=[];
const flush=()=>{const qi=u.findIndex(x=>x.role==='quote');
if(qi>=0&&u[0].s>0){units++;const q=u[qi].text,after=u[qi+1]&&u[qi+1].text||'';
const idea=qi>0&&u[0].role==='lead',bareQuote=outsideQuoteWords(q)<=9,named=TECH_RX.test(q)||TECH_RX.test(after.split(/\s+/).slice(0,8).join(' '));
if((idea&&(bareQuote||named))||(bareQuote&&named))hits++}
u=[]};
sents.forEach((x,i)=>{if(x.role===undefined)return;if(u.length&&u[0].p!==x.p)flush();u.push(x);if(x.unitEnd)flush()});flush();
return units>=3&&hits/units>=.6;
}
/* Long sentences (20+ words) are learnt in two halves, split at the clause break (, ; : —) nearest the
middle, never inside a quotation and never leaving the first half under 4 words or the second under 6. */
function splitSentence(text){
const w=text.split(/\s+/).filter(Boolean),n=w.length;
if(n<20)return null;
let inQ=false,best=-1,bestD=1e9;
for(let i=0;i<n-1;i++){
const t=w[i];
const opens=(t.match(/[“]/g)||[]).length+(/^[(]?"/.test(t)?1:0),closes=(t.match(/[”]/g)||[]).length+(/"[,.;:!?)]*$/.test(t)&&!/^[(]?"[^"]*$/.test(t)?1:0);
if(opens>closes)inQ=true;else if(closes>opens)inQ=false;
const brk=/[,;:]["”’)]?$/.test(t)||/^[—–]$/.test(w[i+1])||/[—–]$/.test(t)||(!inQ&&/^[(]?[“"]/.test(w[i+1])); // clause break, or just before a quotation opens
if(!brk||inQ||i+1<4||n-(i+1)<6)continue;
const d=Math.abs((i+1)-n/2);if(d<bestD){bestD=d;best=i+1}
}
return best<0?null:[w.slice(0,best).join(' '),w.slice(best).join(' ')];
}
Object.assign(E,{ABBR,splitSentences,quotedWords,TECH,ANALYSIS_RX,VERB_RX,outsideQuoteWords,hasQuote,TECH_RX,detectStructure,HEAD_RX,looksHeading,looksCreative,discScore,looksDiscursive,detectKind,TURN_RX,ANEC_RX,REFL_RX,ABSTRACT_RX,PAST_RX,PRES_RX,tagMoves,origPhrase,pieceStyle,markMotifs,parseEssay,isFormulaic,splitSentence});
})(typeof globalThis!=='undefined'?(globalThis.RecallEngine=globalThis.RecallEngine||{}):this.RecallEngine=this.RecallEngine||{});
if(typeof module!=='undefined'&&module.exports)module.exports=globalThis.RecallEngine;
