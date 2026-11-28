'use strict';
/* The main site invites iPad users to the handwriting beta, and never serves its own copy at the beta address. */
const {test,expect}=require('@playwright/test');
const {openApp}=require('../helpers/page.cjs');
// on the beta itself, handwriting is built in and shows its own invite instead
const BUILT_IN=require('fs').existsSync(require('path').join(__dirname,'..','..','js','handwriting','handwriting.js'));
const IPAD_UA='Mozilla/5.0 (iPad; CPU OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.6778.73 Mobile/15E148 Safari/604.1';

test('iPad: a popup at the bottom invites to the beta; Not now keeps it away',async({browser})=>{
  test.skip(BUILT_IN,'the beta shows its own handwriting invite');
  const ctx=await browser.newContext({userAgent:IPAD_UA,hasTouch:true,viewport:{width:820,height:1180}});
  const page=await ctx.newPage();await openApp(page);
  await expect(page.locator('#betaInvite')).toBeVisible({timeout:5000});
  await expect(page.locator('#biTry')).toHaveAttribute('href','beta/');
  await page.locator('#biNo').click();
  await expect(page.locator('#betaInvite')).toHaveCount(0);
  await page.reload();await page.waitForTimeout(2200);
  await expect(page.locator('#betaInvite')).toHaveCount(0);
  await ctx.close();
});

test('not an iPad: no invite',async({page})=>{
  await openApp(page);await page.waitForTimeout(2200);
  await expect(page.locator('#betaInvite')).toHaveCount(0);
});

test('the main site never answers for the beta address, with or without the trailing slash',async({page})=>{
  await openApp(page);
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  for(const p of ['beta','beta/']){
    const res=await page.goto(p);
    expect(res.status(),p).toBe(404); // straight to the server (no beta folder locally), not the main app from the cache
    await page.goto('./');await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
  }
});
