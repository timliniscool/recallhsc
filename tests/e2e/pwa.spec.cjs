'use strict';
const {test,expect}=require('@playwright/test');
const {openApp,answer}=require('../helpers/page.cjs');

test('manifest is valid and scoped to /recallhsc/; icons load',async({page,request})=>{
  await page.goto('./');
  const href=await page.locator('link[rel=manifest]').getAttribute('href');
  const res=await request.get(href);expect(res.status()).toBe(200);
  const m=await res.json();
  for(const k of ['id','name','short_name','start_url','scope','display','theme_color','background_color','icons'])expect(m[k],k).toBeTruthy();
  expect(m.name).toBe('RecallHSC');expect(m.start_url).toBe('./');expect(m.scope).toBe('./');
  const sizes=m.icons.map(i=>i.sizes);expect(sizes).toContain('192x192');expect(sizes).toContain('512x512');
  expect(m.icons.some(i=>i.purpose==='maskable')).toBe(true);
  for(const i of m.icons){const r=await request.get(i.src);expect(r.status(),i.src).toBe(200)}
  expect((await request.get('icons/apple-touch-icon.png')).status()).toBe(200);
});

test('service worker installs, precaches the app, and RecallHSC works offline',async({page,context})=>{
  await openApp(page);
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const scope=await page.evaluate(async()=>(await navigator.serviceWorker.getRegistration()).scope);
  expect(scope).toMatch(/\/recallhsc\/$/);
  const cached=await page.evaluate(async()=>{const k=(await caches.keys()).find(k=>k.startsWith('recallhsc-shell-'));const c=await caches.open(k);return(await c.keys()).map(r=>new URL(r.url).pathname)});
  for(const f of ['/recallhsc/index.html','/recallhsc/js/app.js','/recallhsc/js/workers/compute.worker.js','/recallhsc/js/booklet-data.js','/recallhsc/manifest.webmanifest'])expect(cached).toContain(f);
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(()=>typeof task!=='undefined'&&task);
  expect(await answer(page)).toBe('ok');                         // study offline
  const big=await page.evaluate(async()=>(await COMPUTE.run('mark',{text:RAW,typed:RAW},{size:9999})).pct); // worker offline
  expect(big).toBe(100);
  await page.evaluate(()=>{setView('guide')});await expect(page.locator('#viewGuide, .gwrap').first()).toBeVisible(); // rubric guide offline
  const pdf=await page.evaluate(async()=>(await bookletBlob()).size);expect(pdf).toBeGreaterThan(10000); // booklet offline
  await context.setOffline(false);
});

test('while the site is in use, a new version is offered (never forced); Update keeps the answer being typed',async({page})=>{
  await openApp(page);
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  // simulate a deploy: the server starts serving a sw.js with a different asset hash (restored afterwards)
  const fs=require('fs'),swPath=require('path').join(__dirname,'..','..','sw.js'),orig=fs.readFileSync(swPath,'utf8');
  fs.writeFileSync(swPath,orig.replace(/const ASSET_HASH='[^']*'/,"const ASSET_HASH='e2etestnew'"));
  try{
  await page.locator('#ta').fill('Leadership is rarely');
  await page.evaluate(async()=>{const reg=await navigator.serviceWorker.getRegistration();await reg.update()});
  await expect(page.locator('#updBar')).toBeVisible({timeout:20000});
  expect(await page.locator('#ta').inputValue()).toBe('Leadership is rarely'); // nothing reloaded by itself
  await Promise.all([page.waitForEvent('load'),page.locator('#updGo').click()]);
  await page.waitForFunction(()=>typeof task!=='undefined'&&task);
  await expect.poll(()=>page.locator('#ta').inputValue()).toBe('Leadership is rarely');
  const hash=await page.evaluate(()=>new Promise(res=>{navigator.serviceWorker.addEventListener('message',e=>res(e.data.hash),{once:true});navigator.serviceWorker.controller.postMessage({type:'VERSION'})}));
  expect(hash).toBe('e2etestnew');
  }finally{fs.writeFileSync(swPath,orig)}
});

test('opening the site switches to a newer version by itself (no button needed)',async({page})=>{
  await openApp(page);
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  const fs=require('fs'),swPath=require('path').join(__dirname,'..','..','sw.js'),orig=fs.readFileSync(swPath,'utf8');
  fs.writeFileSync(swPath,orig.replace(/const ASSET_HASH='[^']*'/,"const ASSET_HASH='e2etestauto'"));
  try{
    await page.reload(); // the student opens the site again after a deploy
    const hashNow=()=>page.evaluate(()=>new Promise(res=>{const c=navigator.serviceWorker.controller;if(!c)return res(null);
      navigator.serviceWorker.addEventListener('message',e=>res(e.data.hash),{once:true});c.postMessage({type:'VERSION'});setTimeout(()=>res(null),1500)})).catch(()=>null);
    await expect.poll(hashNow,{timeout:20000}).toBe('e2etestauto');
    await expect(page.locator('#updBar')).toHaveCount(0);
  }finally{fs.writeFileSync(swPath,orig)}
});
