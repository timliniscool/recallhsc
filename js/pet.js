/* Don the falcon */
const Pet=(()=>{
const cv=$('petCv'),x=cv.getContext('2d'),bub=$('petBub'),root=$('pet');
const PAL={K:'#1e293b',D:'#475569',B:'#64748b',W:'#f8fafc',S:'#94a3b8',Y:'#fbbf24',E:'#0b1324',O:'#f59e0b',P:'#fda4af'};
const BODY=[
'......KKKK......',
'.....KDDDDK.....',
'....KDDDDDDK....',
'....KDDWYEDKK...',
'....KDWWDYYYYK..',
'...KDDWWDWKYK...',
'...KDBWSWWK.....',
'..KDBBWWSWWK....',
'..KDBBWSWWWK....',
'.KDDBBWWSWWK....',
'.KDDBBBWWWK.....',
'KDDDBBBBWK......',
'.KKDDBBBK.......',
'...KKOKOK.......',
'....O..O........'];
const WING_UP=[[1,3,'K'],[2,3,'K'],[0,4,'K'],[1,4,'D'],[2,4,'D'],[3,4,'K'],[0,5,'K'],[1,5,'D'],[2,5,'B'],[1,6,'K'],[2,6,'D']];
const COOKIE=['.OOO.','OKOOO','OOOKO','OKOOO','.OOO.'];
let state='idle',stT=0,frame=0,bites=0,blink=0,flap=0,mood=null,moodT=0,lastAct=performance.now(),bubT=0,lastSay=0,hearts=[],crumbs=[],syms=[];
const hr=new Date().getHours(),tod=hr<5?'it’s very late. respect.':hr<12?'good morning!':hr<18?'good afternoon!':'evening study arc?';
const LINES={
eat:['nom nom nom','cookie #4 today. or #7. who’s counting','sorry, crumbs on your essay','chocolate chip > every other chip','this cookie is a primary source','a cookie a day keeps Band 4 away','crunch-based learning','this one tastes like a Band 6','I only eat cookies with strong thematic concerns','emotional support cookie','cookies are a lived experience','do raisins count as a dissonance','technically this is a cookie in its entirety'],
study:['∫ cookie dx = crumbs + C','if x = cookies, x → ∞','π is just a round cookie','2 + 2 = one fewer cookie','proof: cookies are good. QED','solving for y. y not more cookies','lim(sleep → 0) = HSC','the derivative of me is a pigeon','my vectors point at the cookie jar','eigenvalues? I barely know her','probability I eat another cookie: 1','Pythagoras was a cookie in a triangle','Fourier transform but for crumbs','sin²x + cos²x = snack','I failed maths once. the cookie was irrational'],
pass:['SKREE! nice one','falcon approves','+1 cookie for you','you’re flying now','that was peregrine-fast','marker would cry happy tears','zero errors. suspicious. well done','Band 6 energy','you ate that (unlike my cookie)','that sentence lives in your head now','clean. like freshly baked','top speed for a falcon is 390 km/h. you’re close','memorised harder than my times tables'],
fail:['it happens. snack break?','even falcons miss sometimes','read it again, I’ll guard the cookies','plot twist: try again','the words are hiding. we’ll find them','mistakes are just drafts','that word was sneaky','one more go. I believe in you','I once forgot how to fly. it was fine'],
sleep:['zz… dreaming of calculus','zz… cookies… derivatives…','zz… resonances and dissonances…','zz… five more minutes…','zz… is lived experience a cookie…'],
pet:['eee!','*happy falcon noises*','cookie? for me??','I will remember this kindness','that tickles','skree :)','you’re my favourite student','headpats increase retention by 400%','I’m telling the other falcons about you'],
para:['paragraph locked in!','that whole paragraph? in your brain now','one paragraph closer to freedom','that paragraph slaps','*writes it down in my tiny notebook*'],
checkpoint:['full essay checkpoint cleared. legend','that’s a lot of words from memory','your hippocampus is flexing','the essay fears you now'],
fast:['whoa, fingers on fire','slow down, I can’t read that fast','speedrun any%','are you a falcon too?'],
long:['you’ve been at it a while. water?','stretch your wings for a sec','quick break? I’ll hold your spot','posture check! sit like a proud falcon'],
idle:['hi','falcon pride','fly falcon fly','ypt warrior confirmed','going to C block swimming pool later','visiting mularovski after this','falcons don’t do Band 5','the quad is my natural habitat','I’d skip the queue at the canteen. I can fly','sports house? falcon house','I’ve been in the library since 7am (for the wifi)','one day I’ll understand Hamlet','my study playlist is just bird noises','I peaked at the swimming carnival','proud to be a falcon','peregrine mindset','fun fact: peregrines are the fastest animal alive','did you know HSC markers like clear topic sentences','reminder: NESA verbs matter','tip: say the human experience out loud. explicitly.','I’m guarding the cookie jar. no reason','hmm, what’s the paradox of motivation and behaviour… *eats cookie*','I can count to π','my essay would be about cookies','if you’re stuck, try the first word','Don’s rule: one more sentence, then a cookie'],
scroll:['doomscrolling… just one more reel','ok this is the last video','why is my screen time 9 hours','*scrolls past 40 study tips without studying*','the algorithm knows I like cookies','wait this falcon on my fyp is me','checking the group chat. 214 messages. about nothing','liking memes instead of memorising quotes'],
fly:['visiting mularovski','going to C block swimming pool','fly falcon fly','brb, canteen run','off to the library (for the aircon)','quick lap of the quad','delivering a cookie to a friend'],
back:['back!','I’m back. did you miss me','mularovski says hi','the pool was freezing','I brought crumbs'],
swim:['laps at C block pool','swimming carnival training arc','goggles on, focus on','backstroke is just lying down with extra steps','chlorine smell = peak motivation'],
hello:['hi','hi! I’m Don. I study maths & eat cookies','falcon pride','ypt warrior confirmed',`${tod} I’m Don, your study falcon`,'type away, I’ll be down here','Don reporting for cookie duty']};
const MORE={
eat:['this cookie has a strong thesis','oatmeal raisin? in THIS economy?','crumb-based learning strategy','I’m on cookie #3. emotionally, #12','a balanced diet is a cookie in each wing','this one is a lived experience','I’d write an essay on this cookie. 20/20','the cookie represents individual and collective joy','nom. that’s the whole analysis','cookies are my love language','technically I’m stress eating','chewy outside, existential inside','this cookie challenges my assumptions','cookie in, wisdom out','choc chip resonates, raisin dissonates','one cookie for each body paragraph','fuel for Paper 2','I traded my pencil for this cookie','canteen cookie hits different','nom nom… sorry, what were we memorising'],
study:['∑ (cookies) from n=1 to ∞ diverges','e^(iπ) + 1 = 0, cookie + 1 = happiness','integration by cookies','d/dx (study) = vibes','sin, cos, tan, snack','matrix multiplication? no thanks, cookie multiplication','solving quadratics like they owe me money','complex numbers are just numbers with feelings','probability of a Band 6: rising','mean, median, cookie','completing the square of the cookie jar','vectors are just arrows with confidence','graphing my snack intake. exponential','this triangle is acute. like me','Ext 2 maths is a lived experience','the chain rule but it’s a cookie chain','proof by induction: if I eat one cookie, I eat k+1','statistics say you should keep going','rationalising the denominator and my life choices','my calculator is in sleep mode. like me at 3pm'],
pass:['falcon pride!','fly falcon fly!','that’s a perfect landing','you just ate that sentence','ok scholar','LET’S GO','nailed it, no notes','the markers felt that','memory unlocked','you’re in the zone','HSC who? you’re ready','that was clean','gold star from Don','I’m telling everyone at the pool','straight into long-term memory','smooth like a fresh exercise book','built different','you could teach this','that’s the stuff','Ms Sharpington-Recny would be proud'],
fail:['don’t stress, birds fall out of trees too','that one’s slippery','look again, you’ve got this','learning is just failing in style','one word off, that’s basically right','your brain is warming up','rome wasn’t memorised in a day','take a breath, then go','even Shakespeare had drafts','the sentence is scared of you','that’s data, not defeat','reset, refocus, retype','we go again','almost! read it once more','the falcon believes in second attempts'],
sleep:['zz… ypt warrior… zz…','zz… mularovski… zz…','zz… dreaming of C block pool…','zz… the quotes are chasing me…','zz… ten more minutes… then study…','zz… band 6… band 6…'],
pet:['you found my favourite spot','10/10 would be patted again','I’ll study harder for you','feathers: ruffled. heart: full','you’re officially my study buddy','cookie points +1','skree skree!','I’m blushing under these feathers','ok fine, one more cookie','that’s the good stuff','I feel seen','is this what humans call support'],
para:['paragraph secured!','a whole paragraph. who are you','paragraph done. hydrate','that paragraph is yours now','paragraph complete. falcon pride','one paragraph closer to the castle'],
checkpoint:['the whole essay?! from memory?!','essay checkpoint: smashed','that’s exam-ready right there','you’re basically a walking essay','my feathers are standing up','the markers aren’t ready'],
fast:['speed demon','your keyboard needs a rest','is that a world record','falcon speed unlocked','slow down, you’ll overtake me','are you even reading or just vibing'],
long:['stretch break? your wings will thank you','been a while. grab some water','go look at something far away for 20 seconds','snack break is a valid study strategy','your posture is giving question mark','5 minute break, then back to greatness'],
idle:['going to C block swimming pool','falcon pride','fly falcon fly','hi','visiting mularovski','ypt warrior confirmed','anyone seen my goggles','the quad is too loud today','who left a pie in the common room','I heard there’s a test on Friday. I heard wrong. I hope','period 5 maths is a test of character','the library printer jammed again','I tried to sign out of PE. denied','lunch line is 40 minutes long. worth it','house points for typing? I’d win','ypt timer running. respect','sports carnival tomorrow, I’m flying','assembly ran overtime again','I left my calculator in C block','the vending machine took my coin','I’m saving my energy for the swimming carnival','is it a mufti day? asking for a falcon','rain means the quad is closed. sad','studying is just remembering on purpose','one essay at a time','small steps, big Band 6','consistency > cramming','today’s goal: one paragraph. easy','you’re doing better than you think','future you is cheering','quotes are just friends you haven’t memorised yet','tip: say your topic sentence out loud','tip: chunk it, then link it','tip: rest is part of studying','did you drink water today','I believe in you. also cookies','HSC is a marathon. I’m a falcon. we fly','reminder: you’ve got this','*does a little hop*','*preens feathers thoughtfully*','*stares at a pigeon judgementally*','*practises dramatic wing reveal*','*hums the school song badly*','*flaps once for motivation*'],
hello:['hello hello','back for more? love that','the study falcon has arrived','Don here, cookies ready','welcome back, scholar','let’s lock in','ready when you are']
};
for(const k in MORE)LINES[k]=(LINES[k]||[]).concat(MORE[k]);
// 2026 lines: terms checked against current slang coverage (lock in, cooked, crash out, tuff, unc, "I know ball",
// "quiet on the creek", "son I'm crine", "you paid me no mind", "I can't do Nathan", wrizz, "2026 is the new 2016").
const NOW={
pass:['locked in fr','you know ball','that was tuff (the good kind)','son I’m crine, that was clean','not cooked. not even a little','memory said “I got you”','lock-in era activated','ok you’re actually HIM','that sentence paid you mind'],
fail:['that’s tuff. go again','we are not crashing out over one word','lightly toasted, not cooked','you paid that word no mind 😔','unc moment. retry','I can’t do Nathan… jk we go again','reroute, not a crash out'],
checkpoint:['son I’m crine, the WHOLE essay??','you know ball fr','that’s a lock-in for the history books','the markers are not ready for this'],
para:['locked that paragraph in','paragraph = secured. no crash out','you know ball'],
fast:['go go go go go','locked in AND speedy?','typing like there’s a crash out behind you'],
sleep:['zz… locked out, not locked in…','zz… quiet on the creek…'],
long:['even lock-ins need water breaks','stretch before your shoulders crash out','unc needs a 5 minute break. so do you'],
pet:['wrizz detected','ok the wrizz is real','you paid me mind 🥹'],
eat:['cookie lock-in','this cookie is tuff','unc snack: plain biscuit','I can’t do Nathan without a cookie first'],
study:['locked in on this integral','quiet on the creek, I’m doing calc','the derivative of a lock-in is a Band 6','I know ball and I know calculus','2026 is the new 2016 but the maths is still hard'],
idle:['quiet on the creek, Don is studying','lock in, no crash outs today','you paid this essay no mind yesterday. today we lock in','2026 is the new 2016 and I still can’t find my calculator','we are so cooked if Paper 1 is tomorrow (it isn’t… right?)','unc behaviour: highlighting the entire page','I know ball: your next chunk is a pass','son I’m crine, the canteen ran out of cookies','can’t do Nathan till this paragraph is done','lowkey this paragraph is tuff','period 6 is a crash out waiting to happen','the group chat paid me no mind so I’m studying','wrizz is remembering their quote for them'],
hello:['locked in? let’s go','we lock in today','quiet on the creek. study time']
};
for(const k in NOW)LINES[k]=(LINES[k]||[]).concat(NOW[k]);
let sessionStart=performance.now(),longSaid=0;
const pick=a=>a[Math.floor(Math.random()*a.length)];
/* Pacing: one line every 20–30s at most. Lines are weighted towards pauses: mid-typing (a key in the last
2s) only ~1 in 4 chances get through; after a submission or during a hesitation they almost always do.
Clicking Don, and his hello, always get an answer. */
let lastType=0,nextOk=0;
function say(t,force){const now=performance.now();
if(force!=="always"){if(now<nextOk)return;if(now-lastType<2000&&Math.random()>.25)return}
nextOk=now+20000+Math.random()*10000;lastSay=now;bub.textContent=t;bub.classList.add('show');clearTimeout(bubT);bubT=setTimeout(()=>bub.classList.remove('show'),3400)}
function setState(s){state=s;stT=0;bites=0;if(s==='study')syms=[]}
function px(X,Y,c){x.fillStyle=PAL[c]||c;x.fillRect(X,Y,1,1)}
function sprite(rows,ox,oy){rows.forEach((r,j)=>{for(let i=0;i<r.length;i++)if(r[i]!=='.')px(ox+i,oy+j,r[i])})}
function flyOff(){ // horizontal offset + lift for the 'fly' trip (leave, gone, return)
if(state!=='fly')return[0,0];
if(stT<12)return[0,-Math.round(stT/3)];
if(stT<36)return[-Math.round((stT-12)*1.6),-4-Math.round(Math.sin(stT/3)*1.5)];
if(stT<120)return[-60,0];
if(stT<146)return[-Math.round((146-stT)*1.6),-Math.round((146-stT)/6)];
return[0,0];
}
function draw(){
x.clearRect(0,0,32,24);
const[fo,fl]=flyOff(),flying=state==='fly'&&stT<146;
const bob=(state==='sleep'?(frame>>3)%2:(frame>>2)%2),ox=4+fo,oy=6+bob-(flap>0||flying?1:0)+fl+(state==='swim'?3:0);
if(!flying){x.fillStyle='rgba(14,116,190,.15)';x.fillRect(5,22,10,1)}
if(state==='fly'&&stT>=36&&stT<120){x.fillStyle='rgba(100,116,139,.7)';x.font='5px monospace';x.textBaseline='top';x.fillText('brb',8,10);return}
sprite(BODY,ox,oy);
if(flying&&frame%2===0)WING_UP.forEach(([i,j,c])=>px(ox+i,oy+j-2,c));
if(state==='swim'){ // goggles + pool water
px(ox+8,oy+3,'#38bdf8');px(ox+9,oy+3,'#0ea5e9');px(ox+7,oy+3,'#0369a1');
for(let i=0;i<32;i++){const w=Math.round(Math.sin((i+frame)*.6));x.fillStyle='rgba(56,189,248,.75)';x.fillRect(i,17+w,1,7);x.fillStyle='rgba(224,242,254,.9)';x.fillRect(i,17+w,1,1)}
}
if(state==='scroll'){ // tiny phone with a scrolling feed
const phx=ox+12,phy=oy+6;x.fillStyle='#0b1324';x.fillRect(phx,phy,5,8);x.fillStyle='#67e8f9';x.fillRect(phx+1,phy+1,3,6);
x.fillStyle='#0e7490';for(let k=0;k<3;k++){const ly=phy+1+((k*2+(frame>>1))%6);x.fillRect(phx+1,ly,2+(k%2),1)}
if((frame>>2)%5===0){px(phx+3,phy+2,'#f43f5e')}
}
if(flap>0&&frame%2===0)WING_UP.forEach(([i,j,c])=>px(ox+i,oy+j-2,c));
if(state==='sleep'||blink>0){px(ox+9,oy+3,'D');px(ox+8,oy+3,'D')}
if(mood==='pass'){px(ox+6,oy+5,'P');px(ox+10,oy+5,'P')}
if(state==='eat'){
const cx=ox+13,cy=oy+8;
COOKIE.forEach((r,j)=>{for(let i=0;i<r.length;i++){if(r[i]==='.')continue;if(i<bites&&j>0&&j<4)continue;px(cx+i,cy+j,r[i]==='K'?'#78350f':r[i])}});
}
if(state==='study'){
x.fillStyle='#fff';x.fillRect(ox+12,oy+10,7,4);x.fillStyle='#bae6fd';x.fillRect(ox+15,oy+10,1,4);
x.fillStyle='#94a3b8';for(let i=0;i<3;i++){x.fillRect(ox+13,oy+11+i,1+((frame+i)%2),1);x.fillRect(ox+16,oy+11+i,2,1)}
const pb=(frame>>1)%2;x.fillStyle='#0ea5e9';x.fillRect(ox+19,oy+7+pb,1,4);px(ox+19,oy+11+pb,'#fbbf24');
}
x.font='5px monospace';x.textBaseline='top';
syms.forEach(s=>{x.fillStyle=`rgba(3,105,161,${s.a})`;x.fillText(s.t,s.x,s.y)});
crumbs.forEach(c=>px(Math.round(c.x),Math.round(c.y),'#d97706'));
hearts.forEach(h=>{x.fillStyle=`rgba(244,63,94,${h.a})`;const X=Math.round(h.x),Y=Math.round(h.y);x.fillRect(X,Y,1,1);x.fillRect(X+2,Y,1,1);x.fillRect(X,Y+1,3,1);x.fillRect(X+1,Y+2,1,1)});
if(state==='sleep'){x.fillStyle='rgba(100,116,139,.8)';x.fillText((frame>>3)%2?'z':'Z',ox+12,oy-3-((frame>>2)%3))}
if(mood==='fail'){px(ox+11,oy+1,'#7dd3fc');px(ox+11,oy+2,'#38bdf8')}
if(mood==='pass'&&moodT>0){x.fillStyle='#f59e0b';x.fillText('!',ox+12,oy-4)}
}
function tick(){
frame++;stT++;if(blink>0)blink--;else if(Math.random()<.02)blink=2;
if(flap>0)flap--;if(moodT>0)moodT--;else mood=null;
const idle=performance.now()-lastAct;
if(state!=='sleep'&&idle>45000){setState('sleep');say(pick(LINES.sleep))}
if(state==='eat'&&stT%9===0){bites++;for(let i=0;i<3;i++)crumbs.push({x:17+Math.random()*4,y:16,vy:-.3-Math.random()*.4,vx:(Math.random()-.5)*.6});if(bites>5)setState('idle')}
if(state==='study'&&stT%7===0)syms.push({t:pick(['π','∑','x²','√','∞','+','=','∫','dx','3']),x:6+Math.random()*16,y:9,a:1});
if(state==='study'&&stT>90&&idle>4000)setState('idle');
if(idle<8000&&performance.now()-sessionStart>1800000*(longSaid+1)){longSaid++;say(pick(LINES.long),true)}
if(state==='idle'&&(stT===30||stT===100)&&Math.random()<.85)say(pick(LINES.idle));
// while studying: a chance to chat every ~7s; pauses of 2s+ (hesitations) get extra chances
if(state==='study'){const p=performance.now()-lastType;
if(stT%60===0&&Math.random()<.6)say(pick(Math.random()<.5?LINES.study:LINES.idle));
else if(p>2000&&p<15000&&Math.random()<.06)say(pick(Math.random()<.5?LINES.study:LINES.idle))}
if((state==='scroll'||state==='swim'||state==='eat')&&stT===70&&Math.random()<.6)say(pick(LINES[state]));
if(state==='scroll'&&stT>110)setState('idle');
if(state==='swim'&&stT>120)setState('idle');
if(state==='fly'&&stT===120)say(pick(LINES.back),true);
if(state==='fly'&&stT>150)setState('idle');
if(state==='idle'&&stT>140){
const r=Math.random(),acts=[['eat',.3],['study',.55],['scroll',.72],['fly',.86],['swim',1]];
const act=acts.find(a=>r<a[1])[0];setState(act);
const p={eat:.75,study:.75,scroll:.85,fly:1,swim:.9}[act];if(Math.random()<p)say(pick(LINES[act]),act==='fly');
}
syms.forEach(s=>{s.y-=.35;s.a-=.025});syms=syms.filter(s=>s.a>0);
crumbs.forEach(c=>{c.vy+=.12;c.y+=c.vy;c.x+=c.vx});crumbs=crumbs.filter(c=>c.y<23);
hearts.forEach(h=>{h.y-=.3;h.a-=.03});hearts=hearts.filter(h=>h.a>0);
if(!self.RECALL_REDUCE||stT%10===0)draw(); // reduced motion: about one frame a second
}
setInterval(()=>{if(!document.hidden&&!root.classList.contains('hidden'))tick()},110);
cv.addEventListener('click',()=>{lastAct=performance.now();flap=8;for(let i=0;i<3;i++)hearts.push({x:6+Math.random()*10,y:6,a:1});setState('eat');say(pick(LINES.pet),"always")});
setTimeout(()=>say(pick(LINES.hello),"always"),1800);
return{
event(e){
lastAct=performance.now();
if(e==='type'){lastType=performance.now();if(state==='sleep'||state==='idle')setState('study');return}
lastType=0; // a result means they have finished typing
if(e==='pass'){mood='pass';moodT=14;flap=10;if(Math.random()<.85)say(pick(LINES.pass))}
if(e==='fail'){mood='fail';moodT=30;if(Math.random()<.6)say(pick(LINES.fail),true)}
if(e==='para'){mood='pass';moodT=20;flap=14;say(pick(LINES.para),true)}
if(e==='checkpoint'){mood='pass';moodT=24;flap=18;for(let i=0;i<4;i++)hearts.push({x:4+Math.random()*14,y:6,a:1});say(pick(LINES.checkpoint),true)}
if(e==='fast'){flap=6;say(pick(LINES.fast))}
}};
})();

/* =====================================================================
GAMIFY: retro platformer skin over the same typing engine.
Every passed task = jump up one floating platform. Fail = stay put (rain cloud).
Typing walks the student along the platform. Paragraph recalls aim at a flag
platform, full-essay checkpoints at a castle. Day/night cycle, clouds, birds, Don.
===================================================================== */
