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
    const cv=document.getElementById('hwCanvas'),r=cv.getBoundingClientRect(),y=18+line*44+24;
    const ev=(n,x,yy)=>cv.dispatchEvent(new PointerEvent(n,{pointerType:type,pointerId:7,clientX:r.left+x,clientY:r.top+yy,pressure:.6,bubbles:true,cancelable:true}));
    ev('pointerdown',x0,y);for(let i=1;i<=10;i++)ev('pointermove',x0+i*12,y+Math.sin(i)*6);ev('pointerup',x0+120,y);
  },[pointerType,line,x0]);
}
const nStrokes=page=>page.evaluate(()=>HW._strokes().length);

test('iPad: offered on the main screen; the sheet fills the screen; only Apple Pencil draws',async({page})=>{
  await fakeReader(page);await openApp(page);
  await expect(page.locator('#hwOffer')).toBeVisible();
  await page.locator('#hwTry').click();
  await expect(page.locator('#hwPad')).toBeVisible();
  const box=await page.locator('#hwPad').boundingBox();
  expect(box.width).toBeGreaterThan(1000);expect(box.height).toBeGreaterThan(740); // full screen
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
  await page.locator('#hwType').click(); // "Return to main site"
  await expect(page.locator('#hwPad')).toBeHidden();
  expect(await page.evaluate(()=>SET.focus)).toBe(false);
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
  await expect(page.locator('#hwPad')).toBeHidden(); // steps aside so the marking shows
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
