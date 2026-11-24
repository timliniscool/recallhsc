/* Gamify mode: retro platformer */
const Game=(()=>{
const cv=$('game'),x=cv.getContext('2d');
let on=false,W=320,H=180,SC=3,camY=0,raf=0,last=0,t0=performance.now();
let prog=0,shownProg=0,jump=null,rain=0,shake=0,target='step',coins=[],fx=[],birds=[],donFly=null,face=1,walkT=0;
const G=()=>S.game||(S.game={level:0,coins:0});
// ---- sprites -------------------------------------------------------
// Student sprite, modelled on the reference photo: messy black hair, gold round glasses, big smile,
// collared white shirt, long maroon tie, black belt, grey trousers, navy backpack + straps. 14×22, faces right.
const PAL={H:'#101218',h:'#2b303c',S:'#f1c39c',s:'#d39f78',G:'#c9a43a',E:'#1a1d26',M:'#7a2c2c',m:'#fff4ec',W:'#f8fafc',w:'#cdd6e1',
T:'#7f1d1d',t:'#5a1212',N:'#22304f',n:'#151f36',B:'#0f131c',P:'#4b5563',p:'#363f4d',O:'#0a0d14',D:'#9aa3ae'};
const HEAD=[ // 9 rows
'...H.HH.H.....',
'..HHHHHHHH....',
'.HHhHHHHhHH...',
'.HHHSHHSHHH...',
'.HHSSSSSSSH...',
'.HGEGSSGEGs...',
'..SSSSSSSSs...',
'..SMmmmMSs....',
'...SSSSSs.....'];
const BLINK='.HGGGSSGGGs...';
const TORSO=[ // 7 rows, front arm drawn separately
'..N.WwWWW.....',
'.NNNWTTWW.....',
'.NNnWTTWWN....',
'.NNNNTTWNW....',
'.NNnWTTWWW....',
'.NNNWWTWWW....',
'..NBBBBBBB....'];
const LEGS={ // 6 rows each
idle:['...PPPPPP.....','...PPP.PP.....','...PPP.PP.....','...PPP.PP.....','...ppp.pp.....','..OOOO.OOO....'],
a:   ['...PPPPPP.....','...PPP.PPP....','..PPP...PPP...','.PPP.....PP...','.ppp.....pp...','OOOO.....OOO..'],
b:   ['...PPPPPP.....','....PPPPP.....','....PPPP......','....PPPP......','....pppp......','...OOOOO......'],
c:   ['...PPPPPP.....','...PPP.PP.....','...PP...PPP...','..PPP....PP...','..ppp....pp...','.OOOO....OOO..'],
jump:['...PPPPPP.....','...PPPPPPPP...','..PPP...PPPP..','..PPP....pOO..','..ppp.........','.OOOO.........'],
crouch:['..PPPPPPPP....','..PPP..PPP....','.PPP....PPP...','.ppp....ppp...','OOOO....OOOO..']};
const ARMS={ // [x,y,colour] relative to torso top
idle:[[9,1,'W'],[9,2,'W'],[9,3,'W'],[9,4,'w'],[9,5,'w'],[9,6,'S']],
fwd:[[9,1,'W'],[10,2,'W'],[10,3,'W'],[11,4,'w'],[11,5,'S']],
back:[[8,1,'W'],[8,2,'W'],[7,3,'W'],[7,4,'w'],[6,5,'S']],
up:[[9,1,'W'],[10,0,'W'],[10,-1,'W'],[11,-2,'w'],[11,-3,'S']],
slump:[[9,2,'W'],[9,3,'W'],[9,4,'w'],[9,5,'w'],[9,6,'w'],[9,7,'S']]};
function px1(X,Y,i,j,c,flip){x.fillStyle=PAL[c];x.fillRect(Math.round(flip?X+13-i:X+i),Math.round(Y+j),1,1)}
function rows(R,X,Y,flip){for(let j=0;j<R.length;j++){const r=R[j];for(let i=0;i<r.length;i++)if(r[i]!=='.')px1(X,Y,i,j,r[i],flip)}}
/* pose: legs key, arm key, body bob (px, negative = up), head bob, blink, hair flick */
function drawKid(X,Y,pose,flip){
const legs=LEGS[pose.legs],drop=6-legs.length; // crouch has 5 leg rows, so the body sinks 1px
const by=Y+pose.bob+drop,hy=by+(pose.head||0);
rows(legs,X,Y+16+drop,flip); // feet always land on the bottom row
rows(TORSO,X,by+9,flip);
ARMS[pose.arm].forEach(([i,j,c])=>px1(X,by+9,i,j,c,flip));
const head=HEAD.slice();if(pose.blink)head[5]=BLINK;
rows(head,X,hy,flip);
if(pose.flick){px1(X,hy,4,-1,'H',flip);px1(X,hy,9,-1,'H',flip)}
}
let blinkT=0,landT=0,breathT=0;
function platform(px,py,w,kind){
px=Math.round(px);py=Math.round(py);
for(let i=0;i<w;i++){
const m=i%8,edge=i===0||i===w-1;
for(let j=0;j<11;j++){
let c=null;
const dripBottom=4+((m===3||m===4)?2:(m===2||m===5)?1:0);
if(j===0)c=edge?null:'#0b1324';
else if(edge)c=j<10?'#0b1324':null;
else if(j===10)c='#0b1324';
else if(j===1)c=(m>=1&&m<=6)?'#bef264':'#84cc16';
else if(j===2)c=(m>=2&&m<=5)?'#a3e635':'#65a30d';
else if(j<=dripBottom)c=j===dripBottom?'#15803d':'#4d7c0f';
else c=((i*7+j*3)%11===0)?'#92400e':'#b45309';
if(c){x.fillStyle=c;x.fillRect(px+i,py+j,1,1)}
}
}
if(kind==='flag'||kind==='castle'){
const fx0=px+w-10;
if(kind==='castle'){ // little tower
const tx=px+Math.round(w/2)-9,ty=py-22;
x.fillStyle='#0b1324';x.fillRect(tx-1,ty-1,20,23);
x.fillStyle='#e2e8f0';x.fillRect(tx,ty,18,22);
x.fillStyle='#cbd5e1';for(let r=0;r<22;r+=4)x.fillRect(tx+(r%8?0:4),ty+r,18,1);
x.fillStyle='#f3f8ff';for(let k=0;k<4;k++)x.fillRect(tx+k*5,ty-4,3,4);
x.fillStyle='#0b1324';x.fillRect(tx+6,ty+12,6,10);x.fillRect(tx+7,ty+4,4,4);
x.fillStyle='#fbbf24';x.fillRect(tx+8,ty+5,2,2);
}
x.fillStyle='#e5e7eb';x.fillRect(fx0,py-20,1,20);
const wave=Math.round(Math.sin(performance.now()/200));
x.fillStyle=kind==='castle'?'#f59e0b':'#0ea5e9';x.fillRect(fx0+1,py-20+wave,8,5);
x.fillStyle='#fff';x.font='5px "Press Start 2P",monospace';x.fillText(kind==='castle'?'★':'¶',fx0+2,py-15+wave);
}
}
// ---- world layout --------------------------------------------------
const PW={step:56,flag:80,castle:100};
const platY=i=>-i*34;
function platX(i){if(i===0)return 0;return Math.round(W/2+Math.sin(i*1.9)*W*.27)}
function platInfo(i){
const lv=G().level;
if(i===0)return{x:0,y:0,w:W,kind:'ground'};
const kind=i===lv+1?target:(i<=lv&&(G().marks||{})[i])||'step';
const w=PW[kind]||56;return{x:platX(i)-w/2,y:platY(i),w,kind};
}
const standPos=(i,p)=>{const P=platInfo(i);const span=Math.max(8,P.w-24);return{x:P.x+5+p*span,y:P.y-22}};
// ---- sky -------------------------------------------------------------
const KEYS=[[0,'#38bdf8','#e0f2fe'],[.38,'#7dd3fc','#f0f9ff'],[.5,'#fb923c','#fde68a'],[.58,'#7c3aed','#f472b6'],[.66,'#0b1033','#1e3a8a'],[.9,'#0b1033','#312e81'],[.96,'#a78bfa','#fde68a'],[1,'#38bdf8','#e0f2fe']];
const hex=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
const mix=(a,b,t)=>{const A=hex(a),B=hex(b);return`rgb(${A.map((v,i)=>Math.round(v+(B[i]-v)*t)).join(',')})`};
function skyAt(ph){for(let k=0;k<KEYS.length-1;k++){const[a,t1,b1]=KEYS[k],[b,t2,b2]=KEYS[k+1];if(ph>=a&&ph<=b){const t=(ph-a)/(b-a);return[mix(t1,t2,t),mix(b1,b2,t)]}}return[KEYS[0][1],KEYS[0][2]]}
const STARS=Array.from({length:70},()=>({x:Math.random(),y:Math.random()*.7,p:Math.random()*6}));
const CLOUDS=Array.from({length:6},(_,i)=>({x:Math.random(),y:.08+Math.random()*.5,s:.4+Math.random()*.8,v:.004+Math.random()*.008}));
function cloud(cx,cy,s,col){x.fillStyle=col;const w=Math.round(26*s),h=Math.round(7*s);x.fillRect(cx,cy,w,h);x.fillRect(cx+Math.round(5*s),cy-Math.round(4*s),Math.round(10*s),h);x.fillRect(cx+Math.round(13*s),cy-Math.round(6*s),Math.round(9*s),h)}
function bird(bx,by,f,col){x.fillStyle=col;if(f){x.fillRect(bx,by,1,1);x.fillRect(bx+1,by+1,1,1);x.fillRect(bx+2,by+2,1,1);x.fillRect(bx+3,by+1,1,1);x.fillRect(bx+4,by,1,1)}else{x.fillRect(bx,by+2,1,1);x.fillRect(bx+1,by+1,1,1);x.fillRect(bx+2,by+2,1,1);x.fillRect(bx+3,by+1,1,1);x.fillRect(bx+4,by+2,1,1)}}
// ---- frame ---------------------------------------------------------
function resize(){
const r=cv.getBoundingClientRect();if(!r.width)return;
SC=Math.max(2,Math.round(r.width/340));W=Math.ceil(r.width/SC);H=Math.ceil(r.height/SC);
cv.width=W;cv.height=H;x.imageSmoothingEnabled=false;
}
function draw(now){
const sec=(now-t0)/1000,ph=(sec/240+.12)%1,night=ph>.6&&ph<.95?Math.min(1,Math.min(ph-.6,.95-ph)/.06):0;
const lv=G().level;
// player position
let pos;
let jphase=null;
if(jump){
// 0–0.14: crouch (anticipation) · 0.14–1: airborne arc
const raw=Math.min(1,(now-jump.t)/jump.d);
if(raw<.14){pos=jump.a;jphase='crouch'}
else{const k=(raw-.14)/.86,e=k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2;
pos={x:jump.a.x+(jump.b.x-jump.a.x)*e,y:jump.a.y+(jump.b.y-jump.a.y)*k-Math.sin(Math.PI*k)*jump.h};jphase=k<.5?'rise':'fall'}
if(raw>=1){jump=null;shownProg=0;landT=now;
for(let i=0;i<10;i++)fx.push({x:pos.x+7+(Math.random()-.5)*10,y:pos.y+21,vx:(Math.random()-.5)*1.4,vy:-Math.random()*.6,a:.9,c:'#cbd5e1'})}
}else{shownProg+=(prog-shownProg)*.18;pos=standPos(lv,shownProg)}
const wantCam=pos.y-H*.62;camY+=(wantCam-camY)*.08;
const cy=Math.round(camY);
// sky bands (pixel dithered)
const [top,bot]=skyAt(ph);
const g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,top);g.addColorStop(1,bot);x.fillStyle=g;x.fillRect(0,0,W,H);
if(night>0){STARS.forEach(s=>{const a=night*(.5+.5*Math.sin(sec*2+s.p));x.fillStyle=`rgba(255,255,255,${a})`;x.fillRect(Math.round(s.x*W),Math.round(s.y*H),1,1)})}
// sun & moon on an arc
const ang=ph*Math.PI*2,sx=Math.round(W/2-Math.cos(ang)*W*.42),sy=Math.round(H*.75-Math.sin(ang)*H*.62);
if(ph<.62){x.fillStyle='#fde047';x.fillRect(sx-4,sy-4,9,9);x.fillStyle='#fef9c3';x.fillRect(sx-2,sy-2,5,5)}
const ma=ang-Math.PI*1.25,mx=Math.round(W/2-Math.cos(ma)*W*.42),my=Math.round(H*.75-Math.sin(ma)*H*.62);
if(night>0){x.fillStyle=`rgba(241,245,249,${night})`;x.fillRect(mx-3,my-3,7,7);x.fillStyle=`rgba(148,163,184,${night})`;x.fillRect(mx,my-2,2,2)}
// far hills (parallax, drift down as you climb)
const hy=H*.82-cy*.15;
x.fillStyle=night?'#1e1b4b':'#93c5fd';for(let i=0;i<W;i+=1){const h=Math.round(10+Math.sin(i*.05)*6+Math.sin(i*.13)*3);x.fillRect(i,Math.round(hy-h),1,H)}
x.fillStyle=night?'#172554':'#60a5fa';for(let i=0;i<W;i+=1){const h=Math.round(6+Math.sin(i*.08+2)*5);x.fillRect(i,Math.round(hy+6-h),1,H)}
// clouds (parallax)
CLOUDS.forEach(c=>{c.x+=c.v/60;if(c.x>1.15)c.x=-.2;cloud(Math.round(c.x*W),Math.round(c.y*H-cy*.05*c.s),c.s,night?'rgba(148,163,184,.35)':'rgba(255,255,255,.9)')});
// birds
if(Math.random()<.004&&birds.length<6){const dir=Math.random()<.5?1:-1,by=10+Math.random()*H*.4;for(let k=0;k<3;k++)birds.push({x:dir>0?-10-k*7:W+10+k*7,y:by+k*3,v:dir*(.35+Math.random()*.15),p:Math.random()*6})}
birds.forEach(b=>{b.x+=b.v;bird(Math.round(b.x),Math.round(b.y),Math.floor(sec*6+b.p)%2,night?'#cbd5e1':'#1e293b')});birds=birds.filter(b=>b.x>-20&&b.x<W+20);
// Don flies by now and then with a cookie
if(!donFly&&Math.random()<.0012)donFly={x:-14,y:14+Math.random()*30};
if(donFly){donFly.x+=.6;const dx=Math.round(donFly.x),dy=Math.round(donFly.y+Math.sin(sec*5)*2),f=Math.floor(sec*8)%2;
x.fillStyle='#475569';x.fillRect(dx,dy,7,3);x.fillStyle='#f8fafc';x.fillRect(dx+2,dy+2,4,2);x.fillStyle='#fbbf24';x.fillRect(dx+7,dy+1,2,1);x.fillStyle='#0b1324';x.fillRect(dx+5,dy,1,1);
x.fillStyle='#334155';x.fillRect(dx+1,f?dy-3:dy+3,4,2);x.fillStyle='#f59e0b';x.fillRect(dx+9,dy+1,2,2);
if(donFly.x>W+16)donFly=null}
// platforms in view
const first=Math.max(0,Math.floor(-(cy+H)/34)-1),lastI=Math.floor(-cy/34)+2;
for(let i=Math.max(0,lv-6);i<=lv+8;i++){
const P=platInfo(i);const py=P.y-cy;if(py<-30||py>H+12)continue;
if(i===0){x.fillStyle='#0b1324';x.fillRect(0,py,W,1);for(let k=0;k<W;k+=W){}platform(-2,py,W+4,'ground');x.fillStyle='#b45309';x.fillRect(0,py+11,W,H);continue}
platform(P.x,py,P.w,P.kind);
if(i<=lv&&i>0&&(G().marks||{})[i]==='castle'){}
}
// coins
coins.forEach(c=>{c.y-=.5;c.a-=.012;const cx=Math.round(c.x),cyy=Math.round(c.y-cy),f=Math.floor(sec*10+c.p)%4;x.globalAlpha=Math.max(0,c.a);
x.fillStyle='#0b1324';x.fillRect(cx-1,cyy-1,f%2?3:5,7);x.fillStyle='#fbbf24';x.fillRect(cx,cyy,f%2?1:3,5);x.fillStyle='#fef08a';x.fillRect(cx,cyy+1,1,2);x.globalAlpha=1});
coins=coins.filter(c=>c.a>0);
// fireworks / sparkles
fx.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=.03;p.a-=.015;x.fillStyle=p.c;x.globalAlpha=Math.max(0,p.a);x.fillRect(Math.round(p.x),Math.round(p.y-cy),1,1);x.globalAlpha=1});fx=fx.filter(p=>p.a>0);
// player
const moving=!jump&&Math.abs(prog-shownProg)>.002;if(moving)walkT+=.3;
if(blinkT>0)blinkT--;else if(Math.random()<.012)blinkT=4;
breathT+=1;
let pose;
const landing=now-landT<160,sad=rain>0;
if(jphase==='crouch')pose={legs:'crouch',arm:'back',bob:1,head:1};
else if(jphase==='rise')pose={legs:'jump',arm:'up',bob:-1,flick:true};
else if(jphase==='fall')pose={legs:'jump',arm:'up',bob:0,flick:true};
else if(landing)pose={legs:'crouch',arm:'idle',bob:1,head:1,flick:true};
else if(moving){const f=Math.floor(walkT)%4;pose={legs:['a','b','c','b'][f],arm:['fwd','idle','back','idle'][f],bob:f%2?-1:0,flick:f===1}}
else if(sad)pose={legs:'idle',arm:'slump',bob:0,head:1};
else pose={legs:'idle',arm:'idle',bob:Math.floor(breathT/18)%2?0:-1}; // gentle breathing
pose.blink=blinkT>0||sad;
const sh=shake>0?Math.round(Math.sin(now/30)*1.5):0;if(shake>0)shake--;
drawKid(Math.round(pos.x)+sh,Math.round(pos.y-cy),pose,face<0);
// rain cloud after a miss
if(rain>0){rain--;const rx=Math.round(pos.x)-6,ry=Math.round(pos.y-cy)-14;cloud(rx,ry,.7,'#64748b');x.fillStyle='#38bdf8';for(let k=0;k<4;k++){const yy=(Math.floor(sec*20)+k*3)%9;x.fillRect(rx+3+k*4,ry+5+yy,1,2)}}
const hudTxt=`LV ${lv}  ${G().coins}`;if(hudEl.textContent!==hudTxt)hudEl.textContent=hudTxt;
}
const hudEl=$('ghud');
function loop(now){raf=requestAnimationFrame(loop);if(document.hidden||now-last<(self.RECALL_REDUCE?500:33))return;/* reduced motion: 2 fps, rewards still shown */last=now;draw(now)}
function start(){if(raf)return;resize();camY=standPos(G().level,0).y-H*.62;raf=requestAnimationFrame(loop)}
function stop(){cancelAnimationFrame(raf);raf=0}
new ResizeObserver(()=>{if(on)resize()}).observe(cv);
return{
set(v){on=v;document.body.classList.toggle('gamify',v);if(v)requestAnimationFrame(start);else stop()},
task(t){if(!t)return;target=t.type==='essay'?'castle':(t.type==='para'||t.type==='unit')?'flag':'step';prog=0;
const a=platInfo(G().level),b=platInfo(G().level+1);face=(b.x+b.w/2)>=(a.x+a.w/2)?1:-1},
progress(p){prog=Math.max(0,Math.min(1,p))},
pass(t,okWords){
const g=G(),from=standPos(g.level,shownProg);
g.marks=g.marks||{};g.marks[g.level+1]=target;g.level++;g.coins+=okWords;
const to=standPos(g.level,0);
jump={a:from,b:to,t:performance.now(),d:760,h:24};
const n=Math.min(18,Math.max(3,Math.round(okWords/3)));
for(let i=0;i<n;i++)coins.push({x:from.x+4+(Math.random()-.5)*20,y:from.y-4-Math.random()*16,a:1.2,p:Math.random()*4});
if(target!=='step'){const P=platInfo(g.level),cols=target==='castle'?['#f59e0b','#f472b6','#38bdf8','#a3e635','#fff']:['#38bdf8','#fff'];
for(let i=0;i<(target==='castle'?90:40);i++){const an=Math.random()*6.28,sp=.4+Math.random()*1.4;fx.push({x:P.x+P.w/2,y:P.y-30,vx:Math.cos(an)*sp,vy:Math.sin(an)*sp-.6,a:1.3,c:cols[i%cols.length]})}}
const keep={};Object.keys(g.marks).forEach(k=>{if(+k>g.level-20)keep[k]=g.marks[k]});g.marks=keep;
},
fail(){rain=70;shake=18;prog=0},
reset(){S.game={level:0,coins:0};camY=standPos(0,0).y-H*.62}
};
})();

