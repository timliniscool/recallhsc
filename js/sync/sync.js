/* RecallHSC optional cloud sync (local-first).
   localStorage stays the source of truth for the running app. Sync is an add-on: every change is saved locally
   first, a persistent queue remembers what needs uploading, and a background pass reconciles with the cloud
   when the student is signed in and online. Failures never block local saving.

   Part 1  createSyncEngine(deps): the reconciliation pass. No DOM, no network library: everything it needs is
           injected (cloud client, key-value store, app adapter), so it is unit-tested with fakes.
   Part 2  Browser glue: lazy-loads the vendored Supabase client only when js/sync/config.js is filled in,
           handles magic-link sign-in, the Settings > Cloud sync UI, and wires the engine to the app.

   Conflict rules live in js/sync/conflict.js (RecallSync.*): revision-aware progress merging, reset epochs,
   per-device stats, deletion tombstones, edit/edit forks that keep both texts. */
(function(root){
'use strict';
const C=root.RecallSync;
const SYNC_PREFS=['mode','strict','delay','phrase','essay','hide','motion','reduce','hc','plainInput','fs','keys','choice'];

/* ======================= Part 1: engine ======================= */
function createSyncEngine(d){
  const {cloud,store,app}=d;
  const now=d.now||(()=>Date.now());
  const online=d.online||(()=>true);
  const meta=()=>Object.assign({enabled:false,userId:null,base:{},tombs:{},prefsDirty:false,lastSync:0,statsDirty:{}},store.get('cloud')||{});
  const setMeta=m=>store.set('cloud',m);
  const queue=()=>Object.assign({},store.get('syncQueue')||{});
  let running=null,status='local',listeners=[],timer=0,fails=0,lastError='';
  const setStatus=(s,err)=>{status=s;lastError=err||'';listeners.forEach(f=>{try{f(s,lastError)}catch(_){}})};

  function mark(kind,id){
    // called after every local save; cheap, persistent, coalesced by key
    const m=meta();if(!m.enabled)return;
    const q=queue();q[kind+(id?':'+id:'')]=now();store.set('syncQueue',q);
    if(kind==='prefs'){m.prefsDirty=true;setMeta(m)}
    if(kind==='state'&&id){m.statsDirty[id]=1;setMeta(m)}
    schedule(4000);
  }
  function schedule(ms){
    clearTimeout(timer);
    if(!meta().enabled)return;
    timer=setTimeout(()=>{run().catch(()=>{})},ms);
  }
  async function run(){
    if(running)return running;
    const m=meta();
    if(!m.enabled){setStatus('local');return}
    if(!online()){setStatus('offline');return}
    running=(async()=>{
      setStatus('syncing');
      try{await pass();fails=0;setStatus('ok')}
      catch(e){
        fails++;setStatus(online()?'error':'offline',String(e&&e.message||e));
        // exponential backoff with jitter, capped at 5 minutes
        const base=Math.min(300000,2000*2**Math.min(fails,8));schedule(base*(.5+Math.random()));
      }
      finally{running=null}
    })();
    return running;
  }

  async function pass(){
    const m=meta(),dev=app.deviceId();
    /* ---- library ---- */
    let lib=app.getLib();
    // stamp revisions: a changed text/type bumps ver
    let stamped=false;
    for(const e of lib){const rev=C.hashEssay(e.text,e.kind);if(e.rev!==rev){e.ver=(e.ver|0)+1;e.rev=rev;stamped=true}}
    if(stamped)app.setLib(lib);
    // essays that were synced before but are gone locally were deleted on this device -> tombstone
    for(const id of Object.keys(m.base))if(!lib.some(e=>e.id===id)&&!m.tombs[id])m.tombs[id]={ver:m.base[id].ver|0};
    const remote=await cloud.listEssays();
    const plan=C.reconcileLibrary({local:lib,remote,tombs:m.tombs,base:m.base});
    for(const l of plan.links){app.renameEssay(l.localId,l.remoteId);m.base[l.remoteId]={rev:l.remote.rev,ver:l.remote.ver|0}}
    for(const id of plan.removeLocal){app.deleteEssay(id);delete m.base[id]}
    for(const r of plan.download){
      const prev=app.getLib().find(e=>e.id===r.essay_id);
      app.putEssay({id:r.essay_id,title:r.title||'Essay',text:r.body||'',kind:r.kind==='creative'?'creative':'essay',rev:r.rev,ver:r.ver|0,updated:Date.parse(r.updated_at)||now()},!!prev&&prev.rev!==r.rev);
      m.base[r.essay_id]={rev:r.rev,ver:r.ver|0};
    }
    const uploads=[...plan.upload];
    for(const f of plan.forks){
      app.putEssay({id:f.newId,title:f.title,text:f.remote.body||'',kind:f.remote.kind==='creative'?'creative':'essay',rev:f.remote.rev,ver:1,updated:now()},false);
      uploads.push(f.newId);
    }
    lib=app.getLib();
    const rows=uploads.map(id=>lib.find(e=>e.id===id)).filter(Boolean)
      .map(e=>({essay_id:e.id,title:String(e.title||'Essay').slice(0,60),body:e.text,kind:e.kind==='creative'?'creative':'essay',rev:e.rev,ver:e.ver|0,deleted:false,deleted_ver:null,device_id:dev}));
    // deletions are pushed as tombstones with the text removed from the cloud
    for(const t of plan.pushDeletes)rows.push({essay_id:t.id,title:'',body:'',kind:'essay',rev:'',ver:t.ver|0,deleted:true,deleted_ver:t.ver|0,device_id:dev});
    for(const id of Object.keys(m.tombs))if(!remote.some(r=>r.essay_id===id)||remote.some(r=>r.essay_id===id&&!r.deleted&&(r.ver|0)<=(m.tombs[id].ver|0)))
      if(!rows.some(r=>r.essay_id===id))rows.push({essay_id:id,title:'',body:'',kind:'essay',rev:'',ver:m.tombs[id].ver|0,deleted:true,deleted_ver:m.tombs[id].ver|0,device_id:dev});
    if(rows.length)await cloud.upsertEssays(rows);
    for(const r of rows){if(r.deleted){delete m.tombs[r.essay_id];delete m.base[r.essay_id]}else m.base[r.essay_id]={rev:r.rev,ver:r.ver}}
    for(const t of plan.pushDeletes)delete m.tombs[t.id];
    // tombstones the cloud already has (deleted remotely too) are done
    for(const r of remote)if(r.deleted&&m.tombs[r.essay_id])delete m.tombs[r.essay_id];

    /* ---- progress (only between identical essay revisions; resets win by epoch) ---- */
    const prog=await cloud.listProgress();
    const progRows=[];
    for(const e of lib){
      let local=app.getState(e.id);
      if(local&&!local.rev)local=Object.assign({},local,{rev:e.rev}); // legacy progress belongs to the current text
      const row=prog.find(r=>r.essay_id===e.id&&r.rev===e.rev);
      const res=C.mergeProgress(local,row?C.rowToProgress(row):null,e.rev);
      if(!res.progress)continue;
      if(res.usedRemote||!local||local.rev!==e.rev)app.setState(e.id,res.progress);
      const out=C.progressToRow(res.progress,e.id,e.rev,dev);
      const at=gm=>gm&&typeof gm==='object'&&gm.posAt||0;
      if(!row||JSON.stringify([row.learned,row.g,row.ti,row.epoch|0,row.start_g,row.part||null,at(row.game)])!==JSON.stringify([out.learned,out.g,out.ti,out.epoch,out.start_g,out.part||null,at(out.game)]))progRows.push(out);
    }
    if(progRows.length)await cloud.upsertProgress(progRows);

    /* ---- stats: each device uploads only its own totals; other devices' are summed for display ---- */
    const statRows=[];
    for(const e of lib){if(!m.statsDirty[e.id]&&m.lastSync)continue;const st=app.getState(e.id);if(st&&st.stats)statRows.push({essay_id:e.id,device_id:dev,data:st.stats})}
    if(statRows.length)await cloud.upsertStats(statRows);
    m.statsDirty={};
    const allStats=await cloud.listStats();
    const others={};for(const r of allStats)if(r.device_id!==dev&&r.data)(others[r.essay_id]=others[r.essay_id]||[]).push(r.data);
    store.set('cloudStats',others);

    /* ---- preferences (local wins while it has unsynced changes) ---- */
    const rp=await cloud.getPrefs();
    const localP=app.getPrefs(SYNC_PREFS);
    const merged=C.mergePrefs(localP,rp&&rp.data,m.prefsDirty);
    const pick={};for(const k of SYNC_PREFS)if(merged&&Object.prototype.hasOwnProperty.call(merged,k))pick[k]=merged[k];
    app.setPrefs(pick);
    if(m.prefsDirty||!rp)await cloud.upsertPrefs(pick);
    m.prefsDirty=false;

    m.lastSync=now();setMeta(m);store.set('syncQueue',{});
  }
  return{
    mark,schedule,run,
    get status(){return status},get lastError(){return lastError},
    onStatus(f){listeners.push(f)},
    pending(){return Object.keys(queue()).length},
    displayStats(id,own){const o=(store.get('cloudStats')||{})[id];return o&&o.length?C.mergeStats(own,o):own},
    enable(userId){const m=meta();m.enabled=true;m.userId=userId;setMeta(m);store.set('syncQueue',{all:now()});return run()},
    disable(){const m=meta();m.enabled=false;setMeta(m);clearTimeout(timer);setStatus('local')},
    meta,
  };
}

/* ======================= Part 2: browser glue ======================= */
if(typeof document==='undefined'){if(typeof module!=='undefined'&&module.exports)module.exports={createSyncEngine,SYNC_PREFS};return}

const cfg=root.RECALL_CLOUD||{};
const configured=typeof cfg.url==='string'&&/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cfg.url.replace(/\/+$/,''))&&typeof cfg.anonKey==='string'&&cfg.anonKey.length>20;
const $=id=>document.getElementById(id);
const store={get:k=>ls.get(k),set:(k,v)=>lsTry(k,v)};
const deviceId=()=>{let d=ls.get('device');if(typeof d!=='string'||!/^[a-z0-9]{8,24}$/.test(d)){d=Math.random().toString(36).slice(2,12)+Date.now().toString(36);lsTry('device',d)}return d};
const busy=()=>typeof answering==='function'?answering():phase==='type'&&typeof typed==='string'&&typed.trim().length>0; // includes handwriting on the sheet

/* app adapter: how the engine reads and writes the app's essays, progress and settings */
const app={
  deviceId,
  getLib:()=>LIB.map(e=>Object.assign({},e)),
  setLib(list){
    // only sync bookkeeping (rev/ver) is written back here; text edits come through putEssay
    for(const e of list){const t=LIB.find(x=>x.id===e.id);if(t){t.rev=e.rev;t.ver=e.ver}}
    lsTry('lib',LIB);
  },
  putEssay(e,textChanged){
    const i=LIB.findIndex(x=>x.id===e.id);
    if(i>=0)LIB[i]=Object.assign({},LIB[i],e);else LIB.push(e);
    lsTry('lib',LIB);
    if(textChanged){ls.del('state.'+e.id);if(ACTIVE===e.id&&!busy()){loadEssay(e.id);loadTask()}}
    renderSwitcher();
  },
  deleteEssay(id){
    LIB=LIB.filter(x=>x.id!==id);lsTry('lib',LIB);ls.del('state.'+id);
    if(ACTIVE===id){const n=allEssays()[0];loadEssay(n.id);save();loadTask()}
    renderSwitcher();
  },
  renameEssay(from,to){
    const e=LIB.find(x=>x.id===from);if(!e||LIB.some(x=>x.id===to))return;
    e.id=to;lsTry('lib',LIB);const st=ls.get('state.'+from);if(st){lsTry('state.'+to,st);ls.del('state.'+from)}
    if(ACTIVE===from){ACTIVE=to;saveSettings()}
    renderSwitcher();
  },
  getState:id=>id===ACTIVE?S:cleanState(ls.get('state.'+id)),
  setState(id,p){
    const fields=['learned','g','ti','startG','part','game','epoch','rev','started','resetAt','posAt'];
    if(id===ACTIVE){
      const mid=busy(),pos=[S.g,S.ti];
      for(const k of fields)if(p[k]!==undefined)S[k]=p[k];
      if(mid){S.g=pos[0];S.ti=pos[1]} // never yank the student off the answer they're typing
      adoptPos(); // a position that came from another device is not a new move on this one
      save();renderSide();if(!mid)loadTask();
    }else{
      const cur=cleanState(ls.get('state.'+id))||DEFSTATE();
      for(const k of fields)if(p[k]!==undefined)cur[k]=p[k];
      lsTry('state.'+id,cur);
    }
  },
  getPrefs:keys=>{const o={};for(const k of keys)o[k]=SET[k];return o},
  setPrefs(p){let ch=false;for(const k of Object.keys(p))if(SET[k]!==p[k]){SET[k]=p[k];ch=true}if(ch){saveSettings();try{bindSettings()}catch(_){}}}
};

self.__syncApp=app; // for the tests: lets them apply a merge the way a real sync does
let sb=null,engine=null,user=null,loading=null;
// the signed-in access token, for features that send to the project (marking reports); null when signed out
self.RecallCloudAuth=async()=>{if(!sb)return null;try{const r=await sb.auth.getSession();return r.data.session?r.data.session.access_token:null}catch(_){return null}};
function loadClient(){
  if(sb)return Promise.resolve(sb);
  if(!configured)return Promise.reject(new Error('Cloud sync is not configured'));
  return loading||(loading=new Promise((res,rej)=>{
    const s=document.createElement('script');s.src='js/vendor/supabase-2.117.3.js';
    s.onload=()=>{try{
      sb=root.supabase.createClient(cfg.url.replace(/\/+$/,''),cfg.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'pkce',storageKey:'essayRecall2.auth'}});
      sb.auth.onAuthStateChange((ev,session)=>{user=session&&session.user||null;onAuth(ev)});
      res(sb)}catch(e){rej(e)}};
    s.onerror=()=>{loading=null;rej(new Error('Couldn’t load the sync library (offline?)'))};
    document.head.appendChild(s);
  }));
}
const cloudClient=client=>{
  const ok=({data,error})=>{if(error)throw new Error(error.message||'cloud error');return data};
  return{
    listEssays:async()=>ok(await client.from('essays').select('essay_id,title,body,kind,rev,ver,deleted,deleted_ver,updated_at'))||[],
    upsertEssays:async rows=>ok(await client.from('essays').upsert(rows,{onConflict:'user_id,essay_id'})),
    listProgress:async()=>ok(await client.from('progress').select('essay_id,rev,epoch,learned,g,ti,start_g,part,game,updated_at'))||[],
    upsertProgress:async rows=>ok(await client.from('progress').upsert(rows,{onConflict:'user_id,essay_id,rev'})),
    upsertStats:async rows=>ok(await client.from('stats').upsert(rows,{onConflict:'user_id,essay_id,device_id'})),
    listStats:async()=>ok(await client.from('stats').select('essay_id,device_id,data'))||[],
    getPrefs:async()=>{const d=ok(await client.from('prefs').select('data,updated_at').limit(1));return d&&d[0]||null},
    upsertPrefs:async data=>ok(await client.from('prefs').upsert({data},{onConflict:'user_id'})),
    deleteAllData:async()=>{for(const t of ['stats','progress','essays','prefs'])ok(await client.from(t).delete().not('user_id','is',null))},
    deleteAccount:async()=>ok(await client.rpc('delete_my_account')),
  };
};
function ensureEngine(){
  if(!engine){
    engine=createSyncEngine({cloud:cloudClient(sb),store,app,online:()=>navigator.onLine});
    engine.onStatus(()=>render());
  }
  return engine;
}
/* sign-in state changes */
function onAuth(ev){
  const m=(engine||{meta:()=>ls.get('cloud')||{}}).meta();
  if(user&&m.enabled&&m.userId===user.id){ensureEngine().run()}
  render();
}
/* every local save tells the engine what changed (hooked from lsTry in app.js) */
root.RecallSyncHook=k=>{
  if(!engine||!(ls.get('cloud')||{}).enabled)return;
  if(k==='lib')engine.mark('lib');else if(k.startsWith('state.'))engine.mark('state',k.slice(6));else if(k==='settings')engine.mark('prefs');
};
addEventListener('online',()=>{if(engine)engine.run()});
addEventListener('offline',()=>{if(engine&&engine.meta().enabled)render()});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&engine)engine.schedule(500)});
setInterval(()=>{if(engine)engine.schedule(0)},5*60*1000);

/* ---------- Settings > Cloud sync ---------- */
const STATUS={local:'Local only',syncing:'Syncing…',ok:'Up to date',offline:'Offline: changes are saved on this device and will sync later',error:'Sync problem: your work is safe on this device. Retrying.'};
const html=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const PRIVACY='<details class="snote"><summary>What’s stored and how to remove it</summary><ul><li>Sync is optional. Without an account, everything stays in this browser.</li><li>When sync is on, your essays (title, text, type), progress (which sentences you’ve learnt, where you’re up to), per-device stats and study settings are stored in this site’s Supabase database, which only your account can read (row-level security), sent over HTTPS.</li><li>Keystroke timings and live typing are never uploaded.</li><li>Turn sync off at any time; your essays stay on this device. “Delete cloud data” removes everything stored online; “Delete account” also removes the account.</li><li>You can always export a backup from Essays → Back up.</li></ul></details>';
function render(){
  const box=$('syncBox');if(!box)return;
  if(!configured)return; // the static local-only message in index.html stays
  const m=engine?engine.meta():(ls.get('cloud')||{});
  if(!sb){box.innerHTML=`<p class="snote">Sync your essays and progress across devices with a free account. Optional: RecallHSC works fully without it.</p><button class="btn small" id="syLoad">Set up cloud sync</button>${PRIVACY}`;$('syLoad').onclick=()=>loadClient().then(()=>sb.auth.getSession()).then(r=>{user=r.data.session&&r.data.session.user||null;render()}).catch(e=>toast(e.message));return}
  if(!user){
    box.innerHTML=`<p class="snote">Sign in with a one-time email link. No password.</p>
<div class="syrow"><label class="sr-only" for="syEmail">Email address</label><input id="syEmail" class="etitle" type="email" autocomplete="email" placeholder="you@example.com" maxlength="254"><button class="btn small primary" id="sySend">Email me a link</button></div>
<p class="snote" id="syMsg" aria-live="polite"></p>${m.userId?'<p class="snote">This device has synced with an account before. Your essays here are still on this device.</p>':''}${PRIVACY}`;
    $('sySend').onclick=async()=>{
      const email=$('syEmail').value.trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){$('syMsg').textContent='That doesn’t look like an email address.';return}
      $('sySend').disabled=true;
      const {error}=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname}});
      $('sySend').disabled=false;$('syMsg').textContent=error?'Couldn’t send the link: '+error.message:'Check your inbox and open the link on this device.';
    };
    return;
  }
  const email=html(user.email||'your account');
  if(!m.enabled){
    const other=m.userId&&m.userId!==user.id;
    const n=LIB.length;
    box.innerHTML=`<p class="snote">Signed in as <b>${email}</b>.</p>
${other?`<p class="snote warn">This device last synced with a <b>different account</b>. Its essays won’t be uploaded to ${email} unless you choose to.</p>`:''}
<p class="snote">Turning on sync <b>combines</b> this device’s ${n} essay${n===1?'':'s'} with any already in your account. Nothing is deleted: identical essays are matched, and if the same essay was edited differently on two devices you’ll keep both versions. The built-in sample essay isn’t synced.</p>
<div class="syrow"><button class="btn small primary" id="syOn">${other?'Upload this device’s essays to this account':'Turn on sync'}</button><button class="btn small" id="syOut">Sign out</button></div>${PRIVACY}`;
    $('syOn').onclick=async()=>{const e=ensureEngine();const mm=e.meta();if(mm.userId&&mm.userId!==user.id){mm.base={};mm.tombs={};lsTry('cloud',mm)}await e.enable(user.id);announce('Cloud sync turned on.');if(self.track)track('sync');render()};
    $('syOut').onclick=signOut;
    return;
  }
  const e=ensureEngine(),st=e.status==='local'?'ok':e.status;
  box.innerHTML=`<p class="snote">Signed in as <b>${email}</b>. <span class="systat ${st}">${html(STATUS[st]||st)}</span>${m.lastSync?` · last synced ${new Date(m.lastSync).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}`:''}</p>
<div class="syrow"><button class="btn small" id="syNow">Sync now</button><button class="btn small" id="syOff">Turn off sync</button><button class="btn small" id="syOut">Sign out</button></div>
<div class="syrow"><button class="btn small danger" id="syDel">Delete cloud data</button><button class="btn small danger" id="syAcct">Delete account</button></div>${PRIVACY}`;
  $('syNow').onclick=()=>e.run();
  $('syOff').onclick=()=>{e.disable();announce('Cloud sync off. Your essays stay on this device.');render()};
  $('syOut').onclick=signOut;
  $('syDel').onclick=async()=>{if(!await askConfirm('Everything RecallHSC stored online will be deleted. Essays on this device are kept. This can’t be undone.',{title:'Delete cloud data?',ok:'Delete cloud data',danger:true}))return;try{e.disable();await cloudClient(sb).deleteAllData();const mm=e.meta();mm.base={};mm.tombs={};lsTry('cloud',mm);toast('Cloud data deleted');render()}catch(err){toast('Couldn’t delete: '+err.message)}};
  $('syAcct').onclick=async()=>{if(!await askConfirm('Your account and everything stored online will be deleted. Essays on this device are kept. This can’t be undone.',{title:'Delete account?',ok:'Delete account',danger:true}))return;try{e.disable();await cloudClient(sb).deleteAccount();await sb.auth.signOut();lsTry('cloud',{});toast('Account deleted');render()}catch(err){toast('Couldn’t delete the account: '+err.message)}};
}
async function signOut(){
  if(!await askConfirm('Your essays and progress stay on this device. Sync stops until you sign in again.',{title:'Sign out?',ok:'Sign out'}))return;
  if(engine)engine.disable();await sb.auth.signOut();user=null;render();announce('Signed out. Your essays are still on this device.');
}
root.RecallSyncUI={render,configured};
root.RecallCloud={displayStats:(id,own)=>engine&&(ls.get('cloud')||{}).enabled?engine.displayStats(id,own):own,get status(){return engine?engine.status:'local'}};
// resume a session (or finish a magic-link sign-in) without loading anything for local-only users
if(configured&&((ls.get('cloud')||{}).enabled||/[?&]code=|access_token=/.test(location.search+location.hash)||localStorage.getItem('essayRecall2.auth')))
  loadClient().then(c=>c.auth.getSession()).then(r=>{user=r.data.session&&r.data.session.user||null;
    if(/[?&]code=/.test(location.search))history.replaceState(null,'',location.pathname); // tidy the URL after sign-in
    onAuth('INITIAL')}).catch(()=>{});
})(typeof globalThis!=='undefined'?globalThis:this);
