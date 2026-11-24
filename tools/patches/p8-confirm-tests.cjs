/* Test updates for the in-app confirmation window. Applied once. */
'use strict';
const fs=require('fs'),path=require('path');
const f=path.join(__dirname,'..','..','tests','e2e','app.spec.cjs');let s=fs.readFileSync(f,'utf8');
const a="  page.on('dialog',d=>d.accept());\n  await page.locator('#bImport').setInputFiles(file);";
if(!s.includes(a))throw new Error('anchor');
s=s.replace(a,`  await page.locator('#bImport').setInputFiles(file);
  // in-app confirmation (no browser pop-ups): restore the settings too
  await expect(page.locator('#cfModal')).toBeVisible();
  await expect(page.locator('#cfTitle')).toHaveText('Restore settings too?');
  await page.locator('#cfYes').click();`);
s+=`
test('confirmations use the in-app window (works where browser pop-ups are blocked)',async({page})=>{
  await page.addInitScript(()=>{window.confirm=()=>false;window.alert=()=>{}}); // like an embedded browser
  await openApp(page);
  await page.evaluate(()=>{S.g=2;S.ti=1;save()});
  await page.evaluate(()=>openSettings());
  await page.locator('#btnReset').click();
  await expect(page.locator('#cfModal')).toBeVisible();
  await expect(page.locator('#cfTitle')).toHaveText('Reset progress?');
  await expect.poll(()=>page.evaluate(()=>document.activeElement.id)).toBe('cfNo'); // destructive: focus starts on Cancel
  await page.keyboard.press('Escape');
  await expect(page.locator('#cfModal')).toBeHidden();
  expect(await page.evaluate(()=>S.g)).toBe(2);
  await page.locator('#btnReset').click();await page.locator('#cfYes').click();
  await expect.poll(()=>page.evaluate(()=>[S.g,S.epoch])).toEqual([0,1]);
});
`;
fs.writeFileSync(f,s);console.log('p8 applied');
