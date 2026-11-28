'use strict';
/* The NSBHS toolkit is encrypted; opening it shows a password wall. Uses a test vault (dummy content, test password). */
const {test,expect}=require('@playwright/test');
const path=require('path');
const {openApp}=require('../helpers/page.cjs');
const VAULT=path.join(__dirname,'..','fixtures','toolkit.test-vault.json');
test.use({serviceWorkers:'block'}); // so the test vault below is the one the page loads

async function openToolkit(page,id){
  await page.route('**/js/toolkit.vault.json*',r=>r.fulfill({path:VAULT,contentType:'application/json'}));
  await openApp(page);
  await page.locator('.tab[data-view="guide"]').click();
  await page.locator(`#gnav [data-g="${id}"]`).click();
}

test('every toolkit section is blurred behind the NSBHS password wall',async({page})=>{
  for(const id of ['tips','adapt','exemplars','booklet']){
    await openToolkit(page,id);
    await expect(page.locator('#tkForm')).toBeVisible();
    await expect(page.locator('#tkTitle')).toHaveText('Warning: this is for NSBHS only!');
    await expect(page.locator('.tkwall')).toContainText('ask Tim if you do not know');
    await expect(page.locator('.tkblur')).toHaveCSS('filter',/blur/);
    await page.unrouteAll();
  }
});

test('a wrong password is refused; the right one unlocks, and the device stays unlocked',async({page})=>{
  await openToolkit(page,'tips');
  await page.locator('#tkPw').fill('wrong-password');await page.locator('#tkGo').click();
  await expect(page.locator('#tkErr')).toContainText('isn’t right');
  await page.locator('#tkPw').fill('test-pass-123');await page.locator('#tkGo').click();
  await expect(page.locator('#gmain')).toContainText('TIPS-SENTINEL');
  await page.locator('#gnav [data-g="exemplars"]').click();
  await expect(page.locator('#gmain')).toContainText('Test exemplar');
  await page.reload();
  await page.locator('#gnav [data-g="tips"]').click();
  await expect(page.locator('#gmain')).toContainText('TIPS-SENTINEL');
});

test('the real toolkit text is not in the page or the repo files the site serves',async({page,request})=>{
  const html=await (await request.get('./')).text();
  const js=await (await request.get('js/app.js')).text();
  for(const t of ['GOOD LUCK TO EVERYONE','Adaptation is arguably','Ms Dell'])expect(html+js).not.toContain(t);
  const vault=await (await request.get('js/toolkit.vault.json')).json();
  expect(vault.kdf).toBe('PBKDF2-SHA256');expect(vault.iter).toBeGreaterThanOrEqual(600000);
});

test('an unlock lasts 24 hours, then the password is needed again',async({page})=>{
  await openToolkit(page,'tips');
  await page.locator('#tkPw').fill('test-pass-123');await page.locator('#tkGo').click();
  await expect(page.locator('#gmain')).toContainText('TIPS-SENTINEL');
  // pretend the unlock happened 25 hours ago
  await page.evaluate(()=>{const k='essayRecall2.toolkitKey',p=localStorage.getItem(k).split('.');p[2]=String(Date.now()-25*3600*1000);localStorage.setItem(k,p.join('.'))});
  await page.reload();await page.locator('#gnav [data-g="tips"]').click();
  await expect(page.locator('#tkForm')).toBeVisible();
});
