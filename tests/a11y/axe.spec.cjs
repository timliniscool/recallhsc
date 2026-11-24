/* Automated accessibility checks (axe-core, WCAG 2.0/2.1/2.2 A + AA rules) on representative screens.
   Fails on serious or critical violations. Passing does not mean full WCAG conformance: see docs/ACCESSIBILITY.md. */
'use strict';
const {test,expect}=require('@playwright/test');
const path=require('path');
const {openApp,answer}=require('../helpers/page.cjs');
const AXE=path.join(require.resolve('axe-core'),'..','axe.min.js');
async function scan(page,label,include){
  // measure final colours: finish fade-ins / theme cross-fades before scanning
  await page.addStyleTag({content:'*,*::before,*::after{transition:none!important;animation:none!important}'});
  await page.waitForTimeout(150);
  await page.addScriptTag({path:AXE});
  const res=await page.evaluate(async inc=>{
    // .nextc is the deliberately faint "coming next" preview (a design choice; hidden from screen readers, stronger in high contrast)
    const r=await axe.run(inc?{include:[inc],exclude:['.nextc']}:{exclude:['.nextc']},{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']},resultTypes:['violations']});
    return r.violations.map(v=>({id:v.id,impact:v.impact,help:v.help,nodes:v.nodes.slice(0,4).map(n=>n.target.join(' '))}));
  },include||null);
  const bad=res.filter(v=>v.impact==='serious'||v.impact==='critical');
  if(res.length)console.log(`[a11y] ${label}:`,res.map(v=>`${v.impact} ${v.id} (${v.nodes.length})`).join('; '));
  expect(bad,`${label}: ${JSON.stringify(bad,null,1)}`).toEqual([]);
}
test('main study screen',async({page})=>{await openApp(page);await scan(page,'main')});
test('marking feedback after a miss',async({page})=>{await openApp(page);await answer(page,()=>'wrong words entirely');await scan(page,'feedback')});
test('settings window',async({page})=>{await openApp(page);await page.evaluate(()=>openSettings());await scan(page,'settings','#setModal')});
test('upload window',async({page})=>{await openApp(page);await page.evaluate(()=>openUpload());await scan(page,'upload','#upModal')});
test('essay library',async({page})=>{await openApp(page);await page.evaluate(()=>openEssay());await scan(page,'library','#essayModal')});
test('start menu',async({page})=>{await openApp(page);await page.evaluate(()=>openModal());await scan(page,'start','#modal')});
test('rubric guide',async({page})=>{await openApp(page);await page.evaluate(()=>setView('guide'));await scan(page,'guide')});
test('game mode',async({page})=>{await openApp(page,{seed:{settings:{gamify:true}}});await scan(page,'game mode')});
test('high contrast',async({page})=>{await openApp(page,{seed:{settings:{hc:true}}});await scan(page,'high contrast')});
test('phone: tap-to-pick',async({browser})=>{
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,bypassCSP:true});const page=await ctx.newPage();
  await openApp(page,{seed:{settings:{choice:true}}});await scan(page,'phone tap-to-pick');await ctx.close();
});
test('phone: game mode console',async({browser})=>{
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,bypassCSP:true});const page=await ctx.newPage();
  await openApp(page,{seed:{settings:{choice:true,gamify:true}}});await scan(page,'phone game mode');await ctx.close();
});
