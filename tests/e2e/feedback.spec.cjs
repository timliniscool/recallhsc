'use strict';
/* Students can report a marking mistake; the report goes write-only to the project's feedback table. */
const {test,expect}=require('@playwright/test');
const {openApp,answer}=require('../helpers/page.cjs');

test('a "Report marking" link under the result sends the step, answer and note (no name or email)',async({page})=>{
  let sent=null,headers=null;
  await page.route('**/rest/v1/feedback',async route=>{sent=JSON.parse(route.request().postData());headers=route.request().headers();await route.fulfill({status:201,body:''})});
  await openApp(page);
  expect(await answer(page,t=>t.split(' ').slice(0,1).join(' ')+' wrong words here')).toBe('fail');
  await expect(page.locator('#foot .fblink')).toBeVisible();
  await page.locator('#foot .fblink').click();
  await expect(page.locator('#fbModal')).toBeVisible();
  await page.locator('#fbModal input[value="expected_wrong"]').check();
  await page.locator('#fbNote').fill('the chunk should end at a comma');
  await page.locator('#fbSend').click();
  await expect(page.locator('#fbModal')).toBeHidden();
  expect(sent.kind).toBe('marking');expect(sent.reason).toBe('expected_wrong');expect(sent.note).toBe('the chunk should end at a comma');
  expect(sent.expected).toBe(await page.evaluate(()=>task.text));expect(sent.answer).toContain('wrong words here');
  expect(Object.keys(sent)).not.toContain('email');
  expect(headers.prefer).toBe('return=minimal'); // write-only: nothing is read back
});

test('if sending fails, the form stays open to try again',async({page})=>{
  await page.route('**/rest/v1/feedback',route=>route.fulfill({status:500,body:''}));
  await openApp(page);
  await answer(page,t=>'nothing like it');
  await page.locator('#foot .fblink').click();
  await page.locator('#fbSend').click();
  await expect(page.locator('#fbSend')).toHaveText('Try again');
  await expect(page.locator('#fbModal')).toBeVisible();
});
