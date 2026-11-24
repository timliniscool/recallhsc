/* Shared browser-test helpers. */
'use strict';
const NS='essayRecall2.';
// open the app as a returning visitor (no first-visit popups), optionally with seeded storage
async function openApp(page,{seed,raw}={}){
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',m=>{if(m.type()==='error'&&!/favicon|net::ERR_INTERNET_DISCONNECTED/.test(m.text()))errors.push(m.text())});
  await page.addInitScript(({seed,raw,NS})=>{
    if(sessionStorage.getItem('__seeded'))return;sessionStorage.setItem('__seeded','1');
    localStorage.clear();
    localStorage.setItem(NS+'seen','1');
    const st={startG:0,g:0,ti:0,learned:[],started:true};
    localStorage.setItem(NS+'state.sample',JSON.stringify(st));
    for(const[k,v]of Object.entries(seed||{}))localStorage.setItem(NS+k,JSON.stringify(v));
    for(const[k,v]of Object.entries(raw||{}))localStorage.setItem(NS+k,v);
  },{seed,raw,NS});
  await page.goto('./');
  await page.waitForFunction(()=>typeof task!=='undefined'&&task&&typeof COMPUTE!=='undefined');
  return errors;
}
// type the current task's answer (optionally transformed) into the real input and wait for the marking
async function answer(page,fn){
  const text=await page.evaluate(()=>task.text);
  const val=fn?fn(text):text;
  await page.locator('#ta').fill(val);
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>phase!=='type'&&phase!=='marking');
  return page.evaluate(()=>phase);
}
module.exports={openApp,answer,NS};
