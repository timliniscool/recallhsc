/* RecallHSC sync · conflict: pure, deterministic merge rules for optional cloud sync
   No DOM, no network, no clocks, no randomness. Loaded as a classic script (window / worker global:
   RecallSync) or required from Node (module.exports). Every function treats its inputs as read-only and
   returns fresh objects.

   ===================================================================================================
   RULES
   ===================================================================================================
   hashEssay(text, kind)
     * Revision id = 'r' + 16 lowercase hex chars: 64-bit FNV-1a over the UTF-8 bytes of
       kind + "\u0000" + normalisedText, computed with two 32-bit halves (no BigInt) so every browser and
       Node produce the same value. Normalisation: remove every "\r", strip trailing whitespace (other
       than "\n") at the end of each line. Lone surrogates are encoded as U+FFFD (as TextEncoder does).
     * kind is part of the hash because changing essay <-> creative changes how the text is practised.

   encodeLearned / decodeLearned
     * boolean[] <-> string of '0'/'1' (index i = sentence i). Capped at 20000 sentences (the DB limit).
       Decoding treats any character other than '1' as false; non-strings decode to [].

   mergeProgress(local, remote, essayRev)
     1. No remote -> local unchanged. No local but remote matches essayRev -> remote.
     2. Sentence flags only make sense for one exact text. Merge only when remote.rev === essayRev AND
        (local.rev || essayRev) === essayRev. Otherwise return local untouched, reason
        'different-revision'.
     3. epoch counts intentional "Reset progress" actions. Different epochs: the higher epoch wins
        wholesale (an older device cannot undo a reset; a newer reset elsewhere wipes local progress for
        that essay). Local-only fields (stats, nS, ...) are kept from local.
     4. Equal epochs:
          learned  = elementwise OR (a sentence learned on either device stays learned)
          (g, ti)  = the furthest position (compare g, then ti)
          startG   = local's
          part     = the partial-sentence marker with the higher g, then higher w; dropped if that
                     sentence is already learned
          game     = level max, coins max, marks union (local wins on a key clash)
          started  = local || remote (a remote row without `started` counts as started if any flag is set)
        usedRemote is true when the remote contributed anything that differs from local.
     Accepts remote either in app shape ({learned: bool[], startG}) or in DB-row shape
     ({learned: '0101', start_g}).

   mergeStats(own, others)
     * Display totals = this device's contribution + every other device's contribution. Each device
       uploads only its own counters (one stats row per device), so summing never double counts.
     * Counters are summed; bests (bestWpm, bestBurst, flawless, longestPause) take the max; maps
       (missed, typos, fails) sum per key; hours sums [accSum,count] per hour "0".."23"; taskMs sums
       [a,b] pairs per task; modes sums {att,pass,accSum} per mode; hist is own.hist only (device-local
       recent history is never merged). Anything non-finite or malformed counts as 0 / is skipped.

   reconcileLibrary({local, remote, tombs, base}) -> plan
     local : app library entries {id,title,text,kind,rev?,ver?}
     remote: essay rows {essay_id,title,body,kind,rev,ver,deleted,deleted_ver,updated_at}
     tombs : {[id]: {ver}} essays deleted on this device, deletion not yet pushed
     base  : {[id]: {rev,ver}} the last revision this device synced for each essay
     plan  : {upload, download, removeLocal, pushDeletes, forks, links, conflicts}
     * Local only, no base                      -> upload.
     * Local only, base exists, remote missing  -> upload (the remote copy was never created or wiped).
     * Duplicate: local only, no base, and its rev equals a live remote essay's rev under a different id
       that is not present locally -> links {localId, remoteId} (adopt the remote id, no duplicate upload).
     * Remote only (live)                       -> download, unless a local tombstone has ver >= remote.ver,
                                                   then pushDeletes {id, ver: tomb.ver}. A tombstone older
                                                   than the remote ver means the essay was edited elsewhere
                                                   after this device deleted it: the edit wins (download).
     * Remote only (deleted)                    -> nothing.
     * Both, same rev                           -> nothing, except metadata: if titles differ the higher ver
                                                   wins (equal ver: remote title wins -> download); if only
                                                   ver differs the higher ver side is propagated.
     * Both, different rev (base = base[id]):
         local.rev === base.rev                 -> download (only the remote changed).
         remote.rev === base.rev                -> upload (only this device changed).
         otherwise (both changed, or no base)   -> conflict 'edit-edit': keep local, upload it, AND fork the
                                                   remote text into a new local essay. newId =
                                                   id (cut so the result fits 40 chars) + '-' + rev.slice(1,7)
                                                   (+ '-2', '-3'... if that id is taken by different text),
                                                   title = remote title + ' (other device)' (fits 60 chars).
                                                   If a local essay already holds that fork (same id, same
                                                   rev) the fork is not repeated. Neither text is discarded.
                                                   The client creates the fork and uploads it as a new essay.
     * Remote deleted, local exists:
         local.ver <= deleted_ver AND local.rev === base.rev -> removeLocal (deleted elsewhere, untouched here).
         otherwise -> conflict 'edit-after-delete': keep local and upload it (revived). Edited work is never
                      deleted silently. deleted_ver missing -> remote.ver is used.
     * Local essay present AND a tombstone for the same id: the live local essay wins (tombstone ignored).
     * Entries with invalid ids are ignored. Output order is deterministic (local order, then remote order).

   mergePrefs(local, remote, localDirty)
     * localDirty -> local wins per key, otherwise remote wins per key; keys only one side has are kept.
     * Only JSON-safe values are accepted (string, finite number, boolean, null, arrays / plain objects of
       those). A winning value whose type differs from the other side's value for the same key is
       ignored (garbage protection). Prototype-polluting keys are dropped. null / garbage inputs -> {}.
*/
(function(S){
'use strict';

/* ---------- small helpers ---------- */
const ID_RE=/^[A-Za-z0-9_-]{1,40}$/;
const MAX_LEARNED=20000;
const BAD_KEYS=new Set(['__proto__','constructor','prototype']);
const isObj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fin=v=>{const n=typeof v==='number'?v:typeof v==='string'&&v.trim()!==''?Number(v):NaN;return Number.isFinite(n)?n:0};
const int=v=>Math.max(0,Math.floor(fin(v)));
const okId=id=>typeof id==='string'&&ID_RE.test(id);
const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);

/* ---------- hashing ---------- */
function utf8Bytes(str){
  const out=[];
  for(let i=0;i<str.length;i++){
    let c=str.charCodeAt(i);
    if(c>=0xD800&&c<=0xDBFF&&i+1<str.length){
      const d=str.charCodeAt(i+1);
      if(d>=0xDC00&&d<=0xDFFF){c=0x10000+((c-0xD800)<<10)+(d-0xDC00);i++}
      else c=0xFFFD;
    }else if(c>=0xD800&&c<=0xDFFF)c=0xFFFD;
    if(c<0x80)out.push(c);
    else if(c<0x800)out.push(0xC0|c>>6,0x80|c&63);
    else if(c<0x10000)out.push(0xE0|c>>12,0x80|c>>6&63,0x80|c&63);
    else out.push(0xF0|c>>18,0x80|c>>12&63,0x80|c>>6&63,0x80|c&63);
  }
  return out;
}
const TWO32=4294967296;
/* 64-bit FNV-1a. offset basis 0xcbf29ce484222325, prime 0x100000001b3 = 2^40 + 0x1b3.
   (hi,lo) * prime = (hi,lo) * 0x1b3 + (lo << 40); all intermediates stay below 2^53. */
function fnv1a64(bytes){
  let hi=0xcbf29ce4,lo=0x84222325;
  for(let i=0;i<bytes.length;i++){
    lo=(lo^bytes[i])>>>0;
    const a=lo*0x1b3;
    const carry=Math.floor(a/TWO32);
    const nlo=a>>>0;
    const nhi=(hi*0x1b3+carry+((lo<<8)>>>0))%TWO32;
    hi=nhi>>>0;lo=nlo;
  }
  return ('00000000'+hi.toString(16)).slice(-8)+('00000000'+lo.toString(16)).slice(-8);
}
function normText(text){
  return String(text==null?'':text).replace(/\r/g,'').replace(/[^\S\n]+$/gm,'');
}
function hashEssay(text,kind){
  const k=kind==='creative'?'creative':'essay';
  return 'r'+fnv1a64(utf8Bytes(k+'\u0000'+normText(text)));
}

/* ---------- learned bitstring ---------- */
function encodeLearned(arr){
  if(!Array.isArray(arr))return '';
  let s='';const n=Math.min(arr.length,MAX_LEARNED);
  for(let i=0;i<n;i++)s+=arr[i]?'1':'0';
  return s;
}
function decodeLearned(str){
  if(typeof str!=='string')return [];
  const n=Math.min(str.length,MAX_LEARNED),out=new Array(n);
  for(let i=0;i<n;i++)out[i]=str.charCodeAt(i)===49;
  return out;
}

/* ---------- progress ---------- */
const MARKS=new Set(['step','flag','castle']);
function normPart(p){
  if(!isObj(p))return null;
  const g=fin(p.g),w=fin(p.w);
  if(!(g>=0)||!(w>=0))return null;
  return {g:Math.floor(g),w:Math.floor(w)};
}
function normGame(gm,filterMarks){
  const o=isObj(gm)?gm:{};
  const marks={};
  if(isObj(o.marks))for(const k of Object.keys(o.marks)){
    if(BAD_KEYS.has(k))continue;
    const v=o.marks[k];
    if(filterMarks&&!MARKS.has(v))continue;
    marks[k]=v;
  }
  return {level:int(o.level),coins:int(o.coins),marks};
}
function learnedOf(p){
  if(Array.isArray(p.learned))return p.learned.slice(0,MAX_LEARNED).map(Boolean);
  if(typeof p.learned==='string')return decodeLearned(p.learned);
  return [];
}
/* The progress fields owned by sync (everything else in the local state object is device-local). */
function syncFields(p,isRemote){
  return {
    learned:learnedOf(p),
    g:int(p.g),ti:int(p.ti),
    startG:int(p.startG!==undefined?p.startG:p.start_g),
    part:normPart(p.part),
    game:normGame(p.game,isRemote),
    started:!!p.started||(isRemote&&learnedOf(p).some(Boolean)),
    epoch:int(p.epoch),
    // when the student last moved (ms). Stored inside the game JSON in the cloud row, so no schema change is needed.
    posAt:int(p.posAt!==undefined?p.posAt:(isObj(p.game)?p.game.posAt:0))
  };
}
/* Key-order-independent structural equality for JSON-like values. */
function canon(v){
  if(Array.isArray(v))return '['+v.map(canon).join(',')+']';
  if(isObj(v))return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canon(v[k])).join(',')+'}';
  return JSON.stringify(v===undefined?null:v);
}
function sameFields(a,b){return canon(a)===canon(b)}

function mergeProgress(local,remote,essayRev){
  const hasL=isObj(local),hasR=isObj(remote);
  if(!hasR)return {progress:hasL?clone(local):null,usedRemote:false,reason:'no-remote'};
  if(remote.rev!==essayRev||(hasL&&(local.rev||essayRev)!==essayRev))
    return {progress:hasL?clone(local):null,usedRemote:false,reason:'different-revision'};
  const R=syncFields(remote,true);
  if(!hasL){
    const p=Object.assign({},R,{rev:essayRev});
    if(Number.isFinite(remote.resetAt))p.resetAt=remote.resetAt;
    return {progress:p,usedRemote:true,reason:'no-local'};
  }
  const L=syncFields(local,false);
  const base=clone(local);
  if(R.epoch!==L.epoch){
    if(R.epoch<L.epoch)return {progress:Object.assign(base,{rev:essayRev}),usedRemote:false,reason:'local-newer-epoch'};
    const p=Object.assign(base,R,{rev:essayRev});
    if(Number.isFinite(remote.resetAt))p.resetAt=remote.resetAt;
    return {progress:p,usedRemote:true,reason:'remote-newer-epoch'};
  }
  const n=Math.max(L.learned.length,R.learned.length),learned=new Array(n);
  for(let i=0;i<n;i++)learned[i]=!!(L.learned[i]||R.learned[i]);
  // Position: the most recent move wins, so going back to relearn an earlier part sticks on every device.
  // Learned sentences are never lost either way (they are merged above). Only when neither side has a move
  // time (older versions) does the furthest position win, as before.
  let pos;
  if(L.posAt||R.posAt)pos=R.posAt>L.posAt?{g:R.g,ti:R.ti,posAt:R.posAt}:{g:L.g,ti:L.ti,posAt:L.posAt};
  else{const remoteAhead=R.g>L.g||(R.g===L.g&&R.ti>L.ti);pos=remoteAhead?{g:R.g,ti:R.ti,posAt:0}:{g:L.g,ti:L.ti,posAt:0}}
  let part=null;
  for(const c of [L.part,R.part]){
    if(!c)continue;
    if(!part||c.g>part.g||(c.g===part.g&&c.w>part.w))part=c;
  }
  if(part&&learned[part.g])part=null;
  const game={
    level:Math.max(L.game.level,R.game.level),
    coins:Math.max(L.game.coins,R.game.coins),
    marks:Object.assign({},R.game.marks,L.game.marks)
  };
  const merged={learned,g:pos.g,ti:pos.ti,startG:L.startG,part,game,started:L.started||R.started,epoch:L.epoch,posAt:pos.posAt};
  // Did the remote contribute anything? Compare against local padded to the same flag length.
  const padded=L.learned.slice();while(padded.length<n)padded.push(false);
  const usedRemote=!sameFields(merged,{learned:padded,g:L.g,ti:L.ti,startG:L.startG,part:L.part,
    game:L.game,started:L.started,epoch:L.epoch,posAt:L.posAt});
  return {progress:Object.assign(base,merged,{rev:essayRev}),usedRemote,reason:usedRemote?'merged':'local-up-to-date'};
}

/* Convert between the app's progress shape and a `progress` table row. */
function progressToRow(p,essayId,rev,deviceId){
  const src=isObj(p)?p:{},f=syncFields(src,false);
  return {essay_id:essayId,rev:rev||src.rev||'',epoch:f.epoch,learned:encodeLearned(f.learned),g:f.g,ti:f.ti,
    start_g:f.startG,part:f.part,game:f.posAt?Object.assign({},f.game,{posAt:f.posAt}):f.game,device_id:deviceId==null?null:String(deviceId)};
}
function rowToProgress(row){
  if(!isObj(row))return null;
  const f=syncFields(row,true);
  return Object.assign(f,{rev:typeof row.rev==='string'?row.rev:''});
}

/* ---------- stats ---------- */
const COUNTERS=['att','pass','words','chars','time','accSum','keys','bs','wpmSum','wpmN','hes','cps','slipSum','slipN',
  'recAtt','recPass','bldAtt','bldPass','retries','tasks','firstLetter','firstLetterN','rhythmSum','rhythmN'];
const BESTS=['bestWpm','bestBurst','flawless','longestPause'];
const COUNT_MAPS=['missed','typos','fails'];
const MODE_FIELDS=['att','pass','accSum'];
const KNOWN=new Set([...COUNTERS,...BESTS,...COUNT_MAPS,'hours','hist','taskMs','modes']);

function pair(v){return Array.isArray(v)?[fin(v[0]),fin(v[1])]:[0,0]}
function blankStats(){
  const o={};
  COUNTERS.forEach(k=>o[k]=0);BESTS.forEach(k=>o[k]=0);COUNT_MAPS.forEach(k=>o[k]={});
  o.hours={};o.taskMs={};o.modes={};o.hist=[];
  return o;
}
function addStats(acc,s){
  if(!isObj(s))return;
  for(const k of COUNTERS)acc[k]+=fin(s[k]);
  for(const k of BESTS)acc[k]=Math.max(acc[k],fin(s[k]));
  for(const m of COUNT_MAPS){
    if(!isObj(s[m]))continue;
    for(const key of Object.keys(s[m])){
      if(BAD_KEYS.has(key))continue;
      const v=fin(s[m][key]);if(!v)continue;
      acc[m][key]=(own(acc[m],key)?acc[m][key]:0)+v;
    }
  }
  if(isObj(s.hours))for(let h=0;h<24;h++){
    const key=String(h);if(!own(s.hours,key))continue;
    const [a,c]=pair(s.hours[key]);
    const cur=acc.hours[key]||[0,0];acc.hours[key]=[cur[0]+a,cur[1]+c];
  }
  if(isObj(s.taskMs))for(const key of Object.keys(s.taskMs)){
    if(BAD_KEYS.has(key)||!Array.isArray(s.taskMs[key]))continue;
    const [a,b]=pair(s.taskMs[key]);
    const cur=acc.taskMs[key]||[0,0];acc.taskMs[key]=[cur[0]+a,cur[1]+b];
  }
  if(isObj(s.modes))for(const key of Object.keys(s.modes)){
    if(BAD_KEYS.has(key)||!isObj(s.modes[key]))continue;
    const cur=acc.modes[key]||{att:0,pass:0,accSum:0};
    for(const f of MODE_FIELDS)cur[f]+=fin(s.modes[key][f]);
    acc.modes[key]=cur;
  }
}
function mergeStats(ownStats,others){
  const acc=blankStats();
  // Carry unknown (future) fields of this device through unchanged so nothing is lost on display.
  if(isObj(ownStats))for(const k of Object.keys(ownStats))
    if(!KNOWN.has(k)&&!BAD_KEYS.has(k))try{acc[k]=clone(ownStats[k])}catch(e){}
  addStats(acc,ownStats);
  if(Array.isArray(others))others.forEach(o=>addStats(acc,o));
  acc.hist=isObj(ownStats)&&Array.isArray(ownStats.hist)?clone(ownStats.hist.filter(Array.isArray)):[];
  return acc;
}

/* ---------- library ---------- */
const FORK_SUFFIX=' (other device)';
function forkTitle(t){
  const base=typeof t==='string'?t:'';
  return base.slice(0,60-FORK_SUFFIX.length)+FORK_SUFFIX;
}
function forkId(id,rev,taken,existingLocal,remoteRev){
  const tag=String(rev||'').replace(/^r/,'').slice(0,6)||'fork';
  for(let n=1;n<1000;n++){
    const suffix='-'+tag+(n>1?'-'+n:'');
    const cand=id.slice(0,40-suffix.length)+suffix;
    const loc=existingLocal.get(cand);
    if(loc&&loc.rev===remoteRev)return {id:cand,exists:true};
    if(!taken.has(cand))return {id:cand,exists:false};
  }
  return null;
}
function reconcileLibrary(opts){
  const o=isObj(opts)?opts:{};
  const localArr=Array.isArray(o.local)?o.local:[];
  const remoteArr=Array.isArray(o.remote)?o.remote:[];
  const tombs=isObj(o.tombs)?o.tombs:{};
  const baseMap=isObj(o.base)?o.base:{};
  const plan={upload:[],download:[],removeLocal:[],pushDeletes:[],forks:[],links:[],conflicts:[]};

  const L=new Map();
  for(const e of localArr){
    if(!isObj(e)||!okId(e.id)||L.has(e.id))continue;
    L.set(e.id,{id:e.id,title:typeof e.title==='string'?e.title:'',
      rev:typeof e.rev==='string'&&e.rev?e.rev:hashEssay(e.text,e.kind),ver:int(e.ver)});
  }
  const R=new Map();
  for(const r of remoteArr){
    if(!isObj(r)||!okId(r.essay_id)||R.has(r.essay_id))continue;
    R.set(r.essay_id,r);
  }
  const baseOf=id=>isObj(baseMap[id])&&own(baseMap,id)?baseMap[id]:null;
  const taken=new Set([...L.keys(),...R.keys()]);

  // Duplicate detection: live remote essays absent locally, indexed by rev.
  const remoteByRev=new Map();
  for(const [id,r] of R)if(!r.deleted&&!L.has(id)&&typeof r.rev==='string'&&r.rev&&!remoteByRev.has(r.rev))remoteByRev.set(r.rev,r);
  const linkedRemote=new Set();

  for(const [id,l] of L){
    const r=R.get(id),b=baseOf(id);
    if(!r){
      if(!b){
        const dup=remoteByRev.get(l.rev);
        if(dup&&!linkedRemote.has(dup.essay_id)){
          linkedRemote.add(dup.essay_id);
          plan.links.push({localId:id,remoteId:dup.essay_id,remote:dup});
          continue;
        }
      }
      plan.upload.push(id);
      continue;
    }
    const rver=int(r.ver);
    if(r.deleted){
      const dver=r.deleted_ver==null?rver:int(r.deleted_ver);
      if(l.ver<=dver&&b&&l.rev===b.rev)plan.removeLocal.push(id);
      else{plan.conflicts.push({id,kind:'edit-after-delete'});plan.upload.push(id)}
      continue;
    }
    if(l.rev===r.rev){
      const rtitle=typeof r.title==='string'?r.title:'';
      if(l.title!==rtitle){
        if(l.ver>rver)plan.upload.push(id);else plan.download.push(r);
      }else if(l.ver>rver)plan.upload.push(id);
      else if(rver>l.ver)plan.download.push(r);
      continue;
    }
    if(b&&l.rev===b.rev){plan.download.push(r);continue}
    if(b&&r.rev===b.rev){plan.upload.push(id);continue}
    plan.conflicts.push({id,kind:'edit-edit'});
    plan.upload.push(id);
    const f=forkId(id,r.rev,taken,L,r.rev);
    if(f&&!f.exists){
      taken.add(f.id);
      plan.forks.push({remote:r,newId:f.id,title:forkTitle(r.title)});
    }
  }

  for(const [id,r] of R){
    if(L.has(id)||linkedRemote.has(id)||r.deleted)continue;
    const t=own(tombs,id)&&isObj(tombs[id])?tombs[id]:null;
    if(t&&int(t.ver)>=int(r.ver))plan.pushDeletes.push({id,ver:int(t.ver)});
    else plan.download.push(r);
  }
  return plan;
}

/* ---------- prefs ---------- */
function jsonSafe(v,depth){
  if(v===null||typeof v==='string'||typeof v==='boolean')return true;
  if(typeof v==='number')return Number.isFinite(v);
  if(depth>8)return false;
  if(Array.isArray(v))return v.every(x=>jsonSafe(x,depth+1));
  if(isObj(v)&&(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null))
    return Object.keys(v).every(k=>!BAD_KEYS.has(k)&&jsonSafe(v[k],depth+1));
  return false;
}
const typeTag=v=>v===null?'null':Array.isArray(v)?'array':typeof v;
function mergePrefs(local,remote,localDirty){
  const l=isObj(local)?local:{},r=isObj(remote)?remote:{};
  const win=localDirty?l:r,lose=localDirty?r:l;
  const out={};
  for(const k of Object.keys(lose)){
    if(!BAD_KEYS.has(k)&&jsonSafe(lose[k],0))out[k]=clone(lose[k]);
  }
  for(const k of Object.keys(win)){
    if(BAD_KEYS.has(k)||!jsonSafe(win[k],0))continue;
    if(own(out,k)&&out[k]!==null&&win[k]!==null&&typeTag(out[k])!==typeTag(win[k]))continue;
    out[k]=clone(win[k]);
  }
  return out;
}

Object.assign(S,{
  SYNC_SCHEMA_VERSION:1,
  hashEssay,encodeLearned,decodeLearned,
  mergeProgress,progressToRow,rowToProgress,
  mergeStats,reconcileLibrary,mergePrefs
});
})(typeof globalThis!=='undefined'?(globalThis.RecallSync=globalThis.RecallSync||{}):this.RecallSync=this.RecallSync||{});
if(typeof module!=='undefined'&&module.exports)module.exports=globalThis.RecallSync;
