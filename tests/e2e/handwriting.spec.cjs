'use strict';
/* Handwriting with Apple Pencil (iPad only; beta). Runs as an iPad: iPadOS Safari reports a Mac with touch points.
   The on-device reader (a 60–85 MB model) can't run in CI, so a stand-in worker answers like the real one:
   it "reads" the expected answer back (or a given wrong answer), line by line. */
const {test,expect}=require('@playwright/test');
const {openApp}=require('../helpers/page.cjs');

test.use({
  userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  hasTouch:true,viewport:{width:1024,height:768},
});

async function fakeReader(page){
  await page.addInitScript(()=>{
    const Real=window.Worker;window.__hwMsgs=[];
    window.Worker=function(url,opts){
      if(!String(url).includes('hw.worker'))return new Real(url,opts);
      const w={onmessage:null,onerror:null,terminate(){},postMessage(m){
        window.__hwMsgs.push(m.type);
        const send=d=>setTimeout(()=>w.onmessage&&w.onmessage({data:d}),5);
        if(m.type==='load')send({type:'ready',device:'wasm'});
        if(m.type==='check'){
          const words=(window.__hwAnswer||m.expected).split(/\s+/),n=m.lines.length,per=Math.ceil(words.length/n),texts=[];
          for(let i=0;i<n;i++)texts.push(words.slice(i*per,(i+1)*per).join(' '));
          texts.forEach((t,i)=>send({type:'line',id:m.id,i,text:t,ok:null}));
          texts.forEach((t,i)=>send({type:'line',id:m.id,i,text:t,ok:!window.__hwAnswer}));
          setTimeout(()=>w.onmessage&&w.onmessage({data:{type:'result',id:m.id,texts,oks:texts.map(()=>!window.__hwAnswer),ms:42,device:'wasm'}}),20);
        }
      }};
      return w;
    };
  });
}
// write with Apple Pencil (or a finger) on the sheet: a short wavy stroke on ruled line `line`
async function stroke(page,pointerType,line=0,x0=40){
  await page.evaluate(([type,line,x0])=>{
    const cv=document.getElementById('hwCanvas'),r=cv.getBoundingClientRect(),[R_,R0]=HW._rule(),y=R0+line*R_+Math.round(R_*.55);
    const ev=(n,x,yy)=>cv.dispatchEvent(new PointerEvent(n,{pointerType:type,pointerId:7,clientX:r.left+x,clientY:r.top+yy,pressure:.6,bubbles:true,cancelable:true}));
    ev('pointerdown',x0,y);for(let i=1;i<=10;i++)ev('pointermove',x0+i*12,y+Math.sin(i)*6);ev('pointerup',x0+120,y);
  },[pointerType,line,x0]);
}
const nStrokes=page=>page.evaluate(()=>HW._strokes().length);

test('iPad: offered on the main screen; a big sheet in the card, tools on top; only Apple Pencil draws',async({page})=>{
  await fakeReader(page);await openApp(page);
  await expect(page.locator('#hwOffer')).toBeVisible();
  await page.locator('#hwTry').click();
  await expect(page.locator('#hwPad')).toBeVisible();
  const sheet=await page.locator('#hwSheet').boundingBox(),bar=await page.locator('.hwbar').boundingBox(),card=await page.locator('#card').boundingBox();
  expect(sheet.height).toBeGreaterThan(420);expect(sheet.width).toBeGreaterThan(card.width-80); // big, and inside the card
  expect(bar.y).toBeLessThan(sheet.y);                                 // Check and the tools sit above the paper
  await expect(page.locator('#prompt')).toBeVisible();                  // the normal page around it
  await stroke(page,'touch');expect(await nStrokes(page)).toBe(0);  // fingers and palms are ignored
  await stroke(page,'pen');
  expect(await page.evaluate(()=>[HW._strokes().length,HW._strokes()[0].pts.length])).toEqual([1,11]); // pen-down + 10 moves
  await expect(page.locator('#hwOffer')).toBeHidden();
});

test('normal mode only, focus-style: game mode and the stats panels are off while handwriting',async({page})=>{
  await fakeReader(page);await openApp(page);
  await page.evaluate(()=>setGame(true));
  await page.evaluate(()=>HW.setOn(true));
  expect(await page.evaluate(()=>[SET.gamify,document.body.classList.contains('gamify'),SET.focus])).toEqual([false,false,true]);
  await page.evaluate(()=>setGame(true)); // refused while handwriting
  expect(await page.evaluate(()=>SET.gamify)).toBe(false);
  await page.locator('#hwType').click(); // back to typing
  await expect(page.locator('#hwPad')).toBeHidden();
  await expect(page.locator('#typebox')).toBeVisible();
});

test('eraser removes whole strokes; paper button shows the other style; Clear asks first',async({page})=>{
  await fakeReader(page);await openApp(page);
  await page.evaluate(()=>HW.setOn(true));
  await stroke(page,'pen',0,40);await stroke(page,'pen',2,40);
  expect(await nStrokes(page)).toBe(2);
  await page.locator('#hwErase').click();
  await expect(page.locator('#hwErase')).toHaveAttribute('aria-pressed','true');
  await stroke(page,'pen',0,40); // drag the eraser over the first stroke: it goes, whole
  expect(await nStrokes(page)).toBe(1);
  await page.locator('#hwErase').click();
  await expect(page.locator('#hwPaper')).toHaveText(/Blank/);
  await page.locator('#hwPaper').click();
  await expect(page.locator('#hwPaper')).toHaveText(/Lined/);
  await page.locator('#hwClear').click();
  await expect(page.locator('#cfModal')).toBeVisible();
  await page.locator('#cfNo').click();
  expect(await nStrokes(page)).toBe(1);
  await page.locator('#hwClear').click();await page.locator('#cfYes').click();
  expect(await nStrokes(page)).toBe(0);
});

test('Check: finished lines are prepared while writing; the reading shows line by line, then the usual marking with writing speed',async({page})=>{
  await fakeReader(page);await openApp(page);
  await page.evaluate(()=>HW.setOn(true));
  await stroke(page,'pen',0);await stroke(page,'pen',1);
  await page.waitForTimeout(800);
  expect(await page.evaluate(()=>__hwMsgs.includes('encode'))).toBe(true); // line 1 encoded in the background
  await page.locator('#hwDone').click();
  await page.waitForFunction(()=>phase==='ok'||phase==='review');
  await expect(page.locator('#foot .hwstats')).toContainText('wpm');
  await expect(page.locator('#foot .hwstats')).toContainText('strokes/s');
  await expect(page.locator('#hwPad')).toBeVisible();   // the ink stays…
  await expect(page.locator('#typebox')).toBeVisible(); // …with the marked answer under it
  expect(await nStrokes(page)).toBe(2);
});

test('a wrong answer is marked wrong (nothing is auto-corrected towards the essay)',async({page})=>{
  await fakeReader(page);await openApp(page);
  await page.evaluate(()=>{window.__hwAnswer='completely different words written here';HW.setOn(true)});
  await stroke(page,'pen',0);
  await page.locator('#hwDone').click();
  await page.waitForFunction(()=>phase==='fail');
});

test('not an iPad (other tablets included): no handwriting at all',async({browser})=>{
  const ctx=await browser.newContext({userAgent:'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 Chrome/131 Safari/537.36',hasTouch:true});
  const page=await ctx.newPage();
  await openApp(page);
  expect(await page.evaluate(()=>!!document.getElementById('hwPad')||!!document.getElementById('hwOffer')||!!self.HW)).toBe(false);
  await ctx.close();
});

test('Chrome on iPad is detected too (its user agent says iPad)',async({browser})=>{
  const ctx=await browser.newContext({userAgent:'Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1',hasTouch:true,viewport:{width:1024,height:768}});
  const page=await ctx.newPage();await openApp(page);
  await expect(page.locator('#hwOffer')).toBeVisible();
  await ctx.close();
});

test('elsewhere, Settings explains handwriting is iPad-only and shows what the device reports',async({browser})=>{
  const ctx=await browser.newContext({userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36'});
  const page=await ctx.newPage();await openApp(page);
  await page.evaluate(()=>openSettings());
  await expect(page.locator('#hwRow')).toBeVisible();
  await expect(page.locator('#hwRow')).toContainText('touch points');
  await expect(page.locator('#sHw')).toBeDisabled();
  await ctx.close();
});

test('line spacing follows the iPad size (wider on big screens)',async({page})=>{
  await fakeReader(page);await openApp(page);
  await page.evaluate(()=>HW.setOn(true));
  const [r]=await page.evaluate(()=>HW._rule());expect(r).toBeGreaterThanOrEqual(48);
  await expect(page.locator('#hwSheet')).toHaveCSS('--rule',r+'px');
});

test('endless paper: writing near the bottom adds more lines, and the sheet scrolls',async({page})=>{
  await fakeReader(page);await openApp(page);
  await page.evaluate(()=>HW.setOn(true));
  const h0=await page.evaluate(()=>document.getElementById('hwPage').offsetHeight);
  const [R_,R0]=await page.evaluate(()=>HW._rule());const lines=Math.floor((h0-R0)/R_)-2;
  await stroke(page,'pen',lines);
  const h1=await page.evaluate(()=>document.getElementById('hwPage').offsetHeight);
  expect(h1).toBeGreaterThan(h0);
  expect(await page.evaluate(()=>{const s=document.getElementById('hwSheet');return s.scrollHeight>s.clientHeight})).toBe(true);
});

test('first-time download shows a progress bar across the top',async({page})=>{
  await page.addInitScript(()=>{const Real=window.Worker;window.Worker=function(url,o){if(!String(url).includes('hw.worker'))return new Real(url,o);
    const w={onmessage:null,terminate(){},postMessage(m){if(m.type==='load')setTimeout(()=>w.onmessage&&w.onmessage({data:{type:'progress',loaded:30,total:100}}),10)}};return w}});
  await openApp(page);
  await page.evaluate(()=>HW.setOn(true));
  await expect(page.locator('#hwLoad')).toBeVisible();
  await expect(page.locator('#hwLoad')).toContainText('30%');
  const b=await page.locator('#hwLoad').boundingBox();expect(b.y).toBe(0);
});

test('handwriting counts towards progress, but only its own statistics change (typing stats untouched)',async({page})=>{
  await fakeReader(page);await openApp(page);
  await page.evaluate(()=>HW.setOn(true));
  const before=await page.evaluate(()=>JSON.stringify(S.stats));
  const g0=await page.evaluate(()=>[S.g,S.ti]);
  await stroke(page,'pen',0);
  await page.locator('#hwDone').click();
  await page.waitForFunction(()=>phase==='ok'||phase==='review');
  await page.waitForFunction(()=>S.hw&&S.hw.att===1);
  expect(await page.evaluate(()=>JSON.stringify(S.stats))).toBe(before); // typing statistics unchanged
  expect(await page.evaluate(()=>[S.hw.att,S.hw.pass])).toEqual([1,1]);
  await page.evaluate(()=>advance());
  expect(await page.evaluate(()=>[S.g,S.ti])).not.toEqual(g0);        // progress moved on
  // and it is saved
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('essayRecall2.state.sample')).hw.att)).toBe(1);
});

test('a letter with a tail (p, g, y) stays on its own line; a scribble is ignored with the word under it',async({page})=>{
  await fakeReader(page);await openApp(page);
  await page.evaluate(()=>HW.setOn(true));
  const [R_,R0]=await page.evaluate(()=>HW._rule());
  // a word on line 0, then a "p" whose tail hangs well below line 0's rule
  await stroke(page,'pen',0,40);
  await page.evaluate(([R_,R0])=>{const cv=document.getElementById('hwCanvas'),r=cv.getBoundingClientRect(),x=200,top=R0+R_*.55,bottom=R0+R_*1.5;
    const ev=(n,y)=>cv.dispatchEvent(new PointerEvent(n,{pointerType:'pen',pointerId:9,clientX:r.left+x,clientY:r.top+y,pressure:.6,bubbles:true,cancelable:true}));
    ev('pointerdown',top);for(let i=1;i<=10;i++)ev('pointermove',top+(bottom-top)*i/10);ev('pointerup',bottom)},[R_,R0]);
  expect(await page.evaluate(()=>HW._lines().length)).toBe(1);
  // a word on line 2, then scribbled out: the line disappears from the reading
  await stroke(page,'pen',2,40);
  await page.evaluate(([R_,R0])=>{const cv=document.getElementById('hwCanvas'),r=cv.getBoundingClientRect(),y=R0+2*R_+R_*.55;
    const ev=(n,x,yy)=>cv.dispatchEvent(new PointerEvent(n,{pointerType:'pen',pointerId:10,clientX:r.left+x,clientY:r.top+yy,pressure:.6,bubbles:true,cancelable:true}));
    ev('pointerdown',30,y);for(let i=1;i<=24;i++)ev('pointermove',i%2?175:30,y+(i%3-1)*8);ev('pointerup',40,y)},[R_,R0]);
  expect(await page.evaluate(()=>HW._lines().length)).toBe(1);
});

test('joined-up (cursive) words are never mistaken for scribbles',async({page})=>{
  await fakeReader(page);await openApp(page);
  await page.evaluate(()=>HW.setOn(true));
  const [R_,R0]=await page.evaluate(()=>HW._rule());
  // a long looping cursive word in ONE stroke (lots of loops, but it moves along the line)
  await page.evaluate(([R_,R0])=>{const cv=document.getElementById('hwCanvas'),r=cv.getBoundingClientRect(),base=R0+R_*.8;
    const ev=(n,x,y)=>cv.dispatchEvent(new PointerEvent(n,{pointerType:'pen',pointerId:11,clientX:r.left+x,clientY:r.top+y,pressure:.6,bubbles:true,cancelable:true}));
    ev('pointerdown',60,base);for(let t=0;t<=120;t++){const a=t/120*Math.PI*14;ev('pointermove',60+t*2.2+Math.cos(a)*9,base-R_*.25-Math.sin(a)*R_*.22)}ev('pointerup',330,base)},[R_,R0]);
  expect(await page.evaluate(()=>HW._scribbled().size)).toBe(0);
  expect(await page.evaluate(()=>HW._lines().length)).toBe(1);
});

test('after marking, the pen turns into a red marking pen whose ink is never read',async({page})=>{
  await fakeReader(page);await openApp(page);
  await page.evaluate(()=>HW.setOn(true));
  await stroke(page,'pen',0);
  await page.locator('#hwDone').click();
  await page.waitForFunction(()=>phase==='ok'||phase==='review');
  await expect(page.locator('#hwNote')).toContainText('Red pen');
  await stroke(page,'pen',2);
  expect(await page.evaluate(()=>HW._strokes().map(s=>!!s.red))).toEqual([false,true]);
  expect(await page.evaluate(()=>HW._lines().length)).toBe(1); // only the black writing counts
});

test('reports from handwriting include pictures of the lines; samples go only when signed in and switched on',async({page})=>{
  const posts=[];
  await page.route('**/rest/v1/feedback',async route=>{posts.push(JSON.parse(route.request().postData()));await route.fulfill({status:201,body:''})});
  await fakeReader(page);await openApp(page);
  await page.evaluate(()=>{RECALL_CLOUD.feedback=true;self.RecallCloudAuth=async()=>null;HW.setOn(true)}); // signed out
  await stroke(page,'pen',0);await page.locator('#hwDone').click();
  await page.waitForFunction(()=>HW._lastReport()&&HW._lastReport().images.length===1);
  expect(posts.filter(p=>p.kind==='hw_sample').length).toBe(0);              // signed out: no samples
  await page.locator('#foot .fblink').click();await page.locator('#fbSend').click();
  await expect.poll(()=>posts.filter(p=>p.kind==='marking').length).toBe(1);
  const rep=posts.find(p=>p.kind==='marking');
  expect(rep.reason).toBe('misread');expect(rep.images[0]).toMatch(/^data:image\/png;base64,/);
  // signed in, samples on (the default): a sample is sent with each check
  await page.evaluate(()=>{self.RecallCloudAuth=async()=>'token';retry()});
  await stroke(page,'pen',0);await page.locator('#hwDone').click();
  await expect.poll(()=>posts.filter(p=>p.kind==='hw_sample').length).toBe(1);
  // switched off in Settings: none
  await page.evaluate(()=>{localStorage.setItem('essayRecall2.hwSamples','off');retry()});
  await stroke(page,'pen',0);await page.locator('#hwDone').click();
  await page.waitForTimeout(800);
  expect(posts.filter(p=>p.kind==='hw_sample').length).toBe(1);
});
