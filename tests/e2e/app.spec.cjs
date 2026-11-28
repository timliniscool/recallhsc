'use strict';
const {test,expect}=require('@playwright/test');
const {openApp,answer,NS}=require('../helpers/page.cjs');

test('first visit: intro, then upload; skipping drops you into the sample (served under /recallhsc/)',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto('./');
  await expect(page.locator('#howto')).toBeVisible();
  await page.locator('#bHowto').click();
  await expect(page.locator('#upModal')).toBeVisible();
  await page.locator('#upCancel').click();
  await expect(page.locator('#chip')).toContainText('chunk');
  expect(await page.evaluate(()=>ACTIVE)).toBe('sample');
  expect(errors).toEqual([]);
});

test('build chunk: typing the answer passes, shows the marking, Enter moves on',async({page})=>{
  const errors=await openApp(page);
  const before=await page.evaluate(()=>S.ti);
  expect(await answer(page)).toBe('ok');
  await expect(page.locator('.prompt .diff')).toBeVisible();
  await page.keyboard.press('Enter');
  await expect.poll(()=>page.evaluate(()=>S.ti)).toBe(before+1);
  expect(errors).toEqual([]);
});

test('fail → corrections → retry → pass; Tab skips from the answer box',async({page})=>{
  await openApp(page);
  expect(await answer(page,t=>'completely wrong words here')).toBe('fail');
  await expect(page.locator('.diff .w.sub, .diff .w.del').first()).toBeVisible();
  await page.keyboard.press('Enter');
  await expect.poll(()=>page.evaluate(()=>phase)).toBe('type');
  expect(await answer(page,t=>'nope nope')).toBe('fail');
  const ti=await page.evaluate(()=>S.ti);
  await page.locator('#ta').focus();await page.keyboard.press('Tab');
  await expect.poll(()=>page.evaluate(()=>S.ti)).toBe(ti+1);
});

test('worker: big recalls are marked off the main thread with identical results; small ones inline',async({page})=>{
  await openApp(page);
  const r=await page.evaluate(async()=>{
    const text=RAW.split(/\n\n/).slice(0,3).join('\n\n'),typed=text.replace(/the /g,'teh ').replace(/ and /g,' ');
    const p={text,typed,mode:'standard',strict:88};
    const viaWorker=await COMPUTE.run('mark',p,{size:9999});
    const inline=RecallEngine.markAttempt(p);
    const all={};for(const m of ['exact','quotes','verbatim']){const q={...p,mode:m};all[m]=[(await COMPUTE.run('mark',q,{size:9999})).pct,RecallEngine.markAttempt(q).pct]}
    return{same:JSON.stringify(viaWorker)===JSON.stringify(inline),usingWorker:COMPUTE.usingWorker,stats:{...COMPUTE.stats},all};
  });
  expect(r.same).toBe(true);expect(r.usingWorker).toBe(true);expect(r.stats.worker).toBeGreaterThan(0);
  for(const[m,[a,b]]of Object.entries(r.all))expect(a,m).toBe(b);
});

test('worker blocked or unavailable: marking still works on the main thread',async({page})=>{
  await page.addInitScript(()=>{window.Worker=function(){throw new Error('blocked')}});
  await openApp(page);
  const r=await page.evaluate(async()=>{const p={text:RAW,typed:RAW,mode:'standard'};const x=await COMPUTE.run('mark',p,{size:9999});return{pct:x.pct,disabled:COMPUTE.disabled}});
  expect(r).toEqual({pct:100,disabled:true});
  expect(await answer(page)).toBe('ok');
});

test('stale results: switching task while marking never applies the old result',async({page})=>{
  await openApp(page);
  const r=await page.evaluate(async()=>{
    // make the next marking slow, submit, then move to another task before it lands
    const orig=COMPUTE.run;COMPUTE.run=(op,p,o)=>op==='mark'?new Promise(res=>setTimeout(()=>res(RecallEngine.markAttempt(p)),200)):orig(op,p,o);
    const att=S.stats.att,ti=S.ti;
    document.getElementById('ta').value=task.text;typed=task.text;check();
    S.ti=ti+1;loadTask();                         // e.g. clicking another step
    await new Promise(r=>setTimeout(r,350));COMPUTE.run=orig;
    return{att:S.stats.att-att,phase,ti:S.ti,expected:ti+1};
  });
  expect(r.att).toBe(0);expect(r.phase).toBe('type');expect(r.ti).toBe(r.expected);
});

test('Enter twice while marking submits once (no double rewards)',async({page})=>{
  await openApp(page);
  const r=await page.evaluate(async()=>{
    const orig=COMPUTE.run;COMPUTE.run=(op,p,o)=>op==='mark'?new Promise(res=>setTimeout(()=>res(RecallEngine.markAttempt(p)),120)):orig(op,p,o);
    const att=S.stats.att;document.getElementById('ta').value=task.text;typed=task.text;check();check();check();
    await new Promise(r=>setTimeout(r,250));COMPUTE.run=orig;return S.stats.att-att;
  });
  expect(r).toBe(1);
});

test('marking modes: chosen in Settings, applied from the next attempt, progress untouched',async({page})=>{
  await openApp(page);
  const g0=await page.evaluate(()=>[S.g,S.ti,S.learned.length]);
  await page.locator('#btnSettings').click();
  await page.locator('#sMode input[value="exact"]').check();
  await page.keyboard.press('Escape');
  await expect(page.locator('#modeBadge')).toHaveText('Exact words');
  const res=await answer(page,t=>t.replace(/([a-z]{4,})/i,m=>m.slice(0,-1)+'x'));
  expect(res).toBe('fail'); // one misspelt word in a short chunk fails under Exact
  expect(await page.evaluate(()=>[S.g,S.ti,S.learned.length])).toEqual(g0);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('essayRecall2.settings')).mode)).toBe('exact');
  const hist=await page.evaluate(()=>S.stats.hist.slice(-1)[0]);expect(hist[2]).toBe('exact');
});

test('changing mode mid-answer waits for the next attempt',async({page})=>{
  await openApp(page);
  await page.locator('#ta').fill('Leadership is');
  await page.evaluate(()=>{openSettings()});
  await page.locator('#sMode input[value="verbatim"]').check();
  await expect(page.locator('#modeNote')).toContainText('next attempt');
  expect(await page.evaluate(()=>attemptMode)).toBe('standard');
});

test('legacy saved data (before this upgrade) loads with progress, stats and essays intact',async({page})=>{
  const lib=[{id:'old1',title:'My old essay',text:'First old sentence here. Second old sentence here.\n\nThird in a new paragraph.',kind:'essay',updated:1}];
  const legacyState={startG:0,g:1,ti:2,learned:[true],started:true,nS:3,stats:{att:7,pass:5,hist:[[90,1],[70,0]],taskMs:{build:[1,2],para:[0,0],essay:[0,0]},missed:{word:2}}};
  const errors=await openApp(page,{seed:{lib,'state.old1':legacyState,active:'old1',settings:{delay:3,strict:80,phrase:5,essay:true,hide:false,scope:'start',motion:true,hidden:['settings','deep'],focus:false,view:'mem',gsec:'modA'}}});
  const r=await page.evaluate(()=>({active:ACTIVE,title:essayTitle(ACTIVE),g:S.g,learned:S.learned,att:S.stats.att,hist:S.stats.hist,mode:SET.mode,strict:SET.strict,delay:SET.delay,hidden:SET.hidden,modes:S.stats.modes,epoch:S.epoch}));
  expect(r.active).toBe('old1');expect(r.g).toBe(1);expect(r.learned[0]).toBe(true);expect(r.att).toBe(7);
  expect(r.hist).toEqual([[90,1],[70,0]]);expect(r.mode).toBe('standard');expect(r.strict).toBe(80);expect(r.delay).toBe(3);
  expect(r.hidden).toEqual(['deep']);expect(r.modes).toEqual({});expect(r.epoch).toBe(0);
  expect(errors).toEqual([]);
});

test('corrupted storage does not break the app',async({page})=>{
  const errors=await openApp(page,{raw:{settings:'{not json',lib:'[{"id":"bad id!","text":5}]','state.sample':'"garbage"',active:'"nope"'}});
  expect(await page.evaluate(()=>[ACTIVE,SET.mode,LIB.length,!!task])).toEqual(['sample','standard',0,true]);
  expect(errors).toEqual([]);
});

test('storage full: saving failure is reported, not hidden',async({page})=>{
  await openApp(page);
  const r=await page.evaluate(()=>{const orig=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException('full','QuotaExceededError')};
    save();Storage.prototype.setItem=orig;return new Promise(res=>setTimeout(()=>res([document.getElementById('toast').textContent,document.getElementById('srAlert').textContent]),200))});
  expect(r[0]).toContain('Couldn’t save');expect(r[1]).toContain('Could not save');
});

test('backup: export then restore brings back essays, progress and (on request) settings',async({page})=>{
  const lib=[{id:'b1',title:'Backup essay',text:'Alpha sentence one. Beta sentence two.',kind:'essay',updated:1}];
  await openApp(page,{seed:{lib}});
  await page.evaluate(()=>{SET.mode='quotes';SET.strict=93;saveSettings()});
  await page.evaluate(()=>openEssay());
  const [dl]=await Promise.all([page.waitForEvent('download'),page.locator('#bExport').click()]);
  const file=await dl.path();
  // wipe, then restore
  await page.evaluate(()=>{LIB=[];lsTry('lib',[]);SET=cleanSettings({});saveSettings()});
  await page.locator('#bImport').setInputFiles(file);
  // in-app confirmation (no browser pop-ups): restore the settings too
  await expect(page.locator('#cfModal')).toBeVisible();
  await expect(page.locator('#cfTitle')).toHaveText('Restore settings too?');
  await page.locator('#cfYes').click();
  await expect.poll(()=>page.evaluate(()=>LIB.map(e=>e.id).join())).toBe('b1');
  expect(await page.evaluate(()=>[SET.mode,SET.strict])).toEqual(['quotes',93]);
});

test('settings dialog: keyboard only, focus trapped, Escape closes and focus returns',async({page})=>{
  await openApp(page);
  await page.locator('#btnSettings').focus();await page.keyboard.press('Enter');
  await expect(page.locator('#setModal')).toBeVisible();
  expect(await page.evaluate(()=>document.querySelector('#setModal .sheet').contains(document.activeElement))).toBe(true);
  for(let i=0;i<60;i++)await page.keyboard.press('Tab');
  expect(await page.evaluate(()=>document.querySelector('#setModal .sheet').contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#setModal')).toBeHidden();
  expect(await page.evaluate(()=>document.activeElement.id)).toBe('btnSettings');
});

test('Focus mode lives in the Panels menu',async({page})=>{
  await openApp(page);
  await expect(page.locator('#btnFocus')).toHaveCount(0);
  await page.locator('#btnPanels').click();
  const was=await page.evaluate(()=>document.body.classList.contains('focus')); // on by default in the beta
  await page.locator('#mFocusBtn').click();
  expect(await page.evaluate(()=>document.body.classList.contains('focus'))).toBe(!was);
  await expect(page.locator('#mFocusBtn')).toHaveAttribute('aria-pressed',String(!was));
});

test('accessibility preferences: reduced motion, high contrast, standard text box, text size',async({page})=>{
  await openApp(page);
  await page.evaluate(()=>openSettings());
  await page.locator('#sReduce button[data-v="on"]').click();
  await page.locator('#sHc').check();await page.locator('#sPlain').check();
  await page.locator('#sFs').fill('1.2');
  const r=await page.evaluate(()=>({cls:document.body.className,fs:getComputedStyle(document.documentElement).getPropertyValue('--fs').trim(),taVisible:document.getElementById('ta').offsetHeight>50}));
  expect(r.cls).toContain('reduce');expect(r.cls).toContain('hc');expect(r.cls).toContain('plain');expect(r.fs).toBe('1.2');expect(r.taVisible).toBe(true);
  await page.keyboard.press('Escape');
  expect(await answer(page)).toBe('ok'); // the plain text box uses the same engine
});

test('keyboard shortcuts can be switched off',async({page})=>{
  await openApp(page);
  await page.evaluate(()=>{SET.keys=false;saveSettings()});
  await page.locator('#ta').focus();await page.keyboard.press('Control+KeyO');
  await expect(page.locator('#peekView')).toBeHidden();
});

test('screen reader announcements for new tasks and results',async({page})=>{
  await openApp(page);
  await answer(page);
  await expect(page.locator('#sr')).toContainText('Passed');
  await page.keyboard.press('Enter');
  await expect(page.locator('#sr')).toContainText('Type:');
});

test('IME composition never auto-submits',async({page})=>{
  await openApp(page);
  const r=await page.evaluate(async()=>{
    const ta=document.getElementById('ta');ta.dispatchEvent(new CompositionEvent('compositionstart'));
    ta.value=task.text;ta.dispatchEvent(new InputEvent('input',{isComposing:true,data:'x',inputType:'insertCompositionText'}));
    await new Promise(r=>setTimeout(r,900));const p1=phase;
    ta.dispatchEvent(new CompositionEvent('compositionend'));await new Promise(r=>setTimeout(r,900));
    return[p1,phase];
  });
  expect(r[0]).toBe('type');expect(['ok','review']).toContain(r[1]);
});

test('tap-to-pick on a phone: options are buttons; verbatim mode asks about punctuation/capitals',async({browser})=>{
  const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const page=await ctx.newPage();
  await openApp(page,{seed:{settings:{choice:true,mode:'verbatim'}}});
  const opts=page.locator('#chRow .ch');
  await expect(opts).toHaveCount(3);
  const words=await opts.allTextContents();
  const right=await page.evaluate(()=>items(task.text).filter(i=>i.norm)[0].orig);
  expect(words.map(w=>w.replace(/^\d/,''))).toContain(right);
  await page.locator('#chRow .ch[data-ok="1"]').click();
  await ctx.close();
});

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

test('a long two-half sentence counts as learned once both halves are built, even if the whole-sentence recall is skipped',async({page})=>{
  await openApp(page,{seed:{'state.sample':{startG:0,g:1,ti:0,learned:[true],started:true}}});
  expect(await page.evaluate(()=>!!splitSentence(SENTS[1].text))).toBe(true); // sample sentence 2 is split into halves
  for(let i=0;i<30&&await page.evaluate(()=>task.type==='build');i++){
    expect(await answer(page)).toBe('ok');
    await page.evaluate(()=>advance());
  }
  expect(await page.evaluate(()=>task.type)).toBe('sent');
  expect(await page.evaluate(()=>S.learned[1])).toBe(true);
  await page.locator('#btnSkip').click(); // skip the whole-sentence recall
  await page.reload();await page.waitForFunction(()=>typeof task!=='undefined'&&task);
  expect(await page.evaluate(()=>[S.g,S.learned[1]])).toEqual([2,true]);
});

test('progress saved before the fix: long sentences already moved past are counted on load',async({page})=>{
  await openApp(page,{seed:{'state.sample':{startG:0,g:2,ti:0,learned:[true],started:true}}});
  expect(await page.evaluate(()=>S.learned[1])).toBe(true);
  expect(await page.evaluate(()=>pctOf(ACTIVE))).toBeGreaterThan(0);
});

test('picking a sentence on the map goes there without cutting earlier parts out of essay recalls',async({page})=>{
  await openApp(page,{seed:{'state.sample':{startG:0,g:8,ti:0,learned:[true,true,true,true,true,true,true,true],started:true}}});
  await page.evaluate(()=>{renderSide&&renderSide()});
  await page.evaluate(()=>document.querySelector('#map .dot[data-g="3"]').click());
  expect(await page.evaluate(()=>[S.g,S.startG])).toEqual([3,0]); // position moves, start point stays
  // an essay checkpoint from here covers the whole essay so far
  const essay=await page.evaluate(()=>{for(let g=3;g<SENTS.length;g++){const q=buildQueue(g).find(t=>t.type==='essay');if(q)return [q.a,q.b]}return null});
  if(essay)expect(essay[0]).toBe(0);
});

test('progress where a map click had moved the start point is repaired when everything before it is learnt',async({page})=>{
  await openApp(page,{seed:{'state.sample':{startG:5,g:5,ti:0,learned:[true,true,true,true,true],started:true}}});
  expect(await page.evaluate(()=>S.startG)).toBe(0);
});

test('beta: Focus is on by default, without changing the main site’s saved setting',async({page})=>{
  await openApp(page);
  expect(await page.evaluate(()=>[SET.focus,document.body.classList.contains('focus')])).toEqual([true,true]);
  await page.evaluate(()=>save());
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('essayRecall2.settings')).focus)).toBe(false);
});

test('footer links to the privacy policy and the open-source code',async({page})=>{
  await openApp(page);
  await expect(page.locator('.flinks a[href="privacy.html"]')).toHaveText('Privacy policy');
  await expect(page.locator('.flinks a[href="https://github.com/timliniscool/recallhsc"]')).toBeVisible();
  const res=await page.goto('privacy.html');expect(res.status()).toBe(200);
  await expect(page.locator('h1')).toHaveText('Privacy policy');
});

test('library: sync bookkeeping survives a reload, a rename bumps the version, every library change reaches sync',async({page})=>{
  const lib=[{id:'e1',title:'Old title',text:'One two three four. Five six seven eight.',kind:'essay',rev:'rabc123',ver:3},
    {id:'e2',title:'Junk',text:'Nine ten eleven twelve.',kind:'essay',rev:'NOT A REV',ver:-1}];
  await openApp(page,{seed:{lib}});
  // kept through the load (before, the sanitiser dropped them, so the version restarted at 0 after every reload)
  expect(await page.evaluate(()=>LIB.map(e=>[e.id,e.rev,e.ver]))).toEqual([['e1','rabc123',3],['e2',undefined,undefined]]);
  await page.evaluate(()=>{window.__hook=[];self.RecallSyncHook=k=>__hook.push(k)});
  // rename only: the text's revision doesn't change, so the version must, or another device's older title wins
  await page.evaluate(()=>{mgEdit('e1');$('mgTitle').value='New title';$('mgSave').click()});
  expect(await page.evaluate(()=>{const e=LIB.find(x=>x.id==='e1');return[e.title,e.ver]})).toEqual(['New title',4]);
  expect(await page.evaluate(()=>__hook.filter(k=>k==='lib').length)).toBe(1);
  // making your own copy of the sample also reaches sync straight away
  await page.evaluate(()=>{mgEdit('sample');$('mgSave').click()});
  expect(await page.evaluate(()=>__hook.filter(k=>k==='lib').length)).toBe(2);
  // and the version is still there after a reload
  await page.reload();await page.waitForFunction(()=>typeof LIB!=='undefined');
  expect(await page.evaluate(()=>{const e=LIB.find(x=>x.id==='e1');return[e.title,e.rev,e.ver]})).toEqual(['New title','rabc123',4]);
});
