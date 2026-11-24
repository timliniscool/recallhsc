/* RecallHSC service worker.
   Caching strategy
   - App shell (HTML, JS, icons, images, manifest, booklet data): precached as one versioned set and served
     cache-first. A new deploy changes ASSET_HASH below (stamped by `npm run stamp`), the browser sees a new
     sw.js, installs the new set alongside the old one, and waits. The page shows "An update is available";
     nothing reloads until the student taps Update. Old and new files are never mixed.
   - Google Fonts: stylesheet stale-while-revalidate, font files cache-first (open-licence fonts).
   - Everything else (including any cloud-sync / Supabase requests): not intercepted, never cached.
   Scope: only requests under this worker's own directory (/recallhsc/ on GitHub Pages). */
'use strict';
const VERSION='2.0.0';
const ASSET_HASH='b005b26a23f1';
const SHELL='recallhsc-shell-'+VERSION+'-'+ASSET_HASH;
const FONTS='recallhsc-fonts-v1';
const PRECACHE=[
  './','index.html','manifest.webmanifest',
  'js/engine/text.js','js/engine/chunker.js','js/engine/parser.js','js/engine/marking.js','js/engine/policies.js','js/engine/recall.js',
  'js/workers/worker-manager.js','js/workers/compute.worker.js',
  'js/app.js','js/pet.js','js/game.js','js/boot.js','js/a11y/dialogs.js','js/pwa/pwa.js','js/sync/config.js','js/sync/conflict.js','js/sync/sync.js',
  'js/booklet-data.js',
  'icons/icon.svg','icons/icon-192.png','icons/icon-512.png','icons/icon-maskable-512.png','icons/apple-touch-icon.png','icons/favicon-32.png',
  'img/adapt-5.png','img/adapt-6.png',
];
const FONT_CSS='https://fonts.googleapis.com/';
const FONT_FILES='https://fonts.gstatic.com/';

self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    const c=await caches.open(SHELL);
    // cache:'reload' bypasses the HTTP cache so a new version never precaches stale files
    await c.addAll(PRECACHE.map(u=>new Request(u,{cache:'reload'})));
  })());
  // no skipWaiting here: the page decides when to switch (never mid-answer)
});

self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    // remove only this app's old shells; other caches on the origin are left alone
    for(const k of await caches.keys())if(k.startsWith('recallhsc-shell-')&&k!==SHELL)await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('message',e=>{
  if(e.data&&e.data.type==='SKIP_WAITING')self.skipWaiting();
  if(e.data&&e.data.type==='VERSION')e.source&&e.source.postMessage({type:'VERSION',version:VERSION,hash:ASSET_HASH});
});

const scope=new URL(self.registration.scope);
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.href.startsWith(FONT_CSS)){e.respondWith(staleWhileRevalidate(req,FONTS));return}
  if(url.href.startsWith(FONT_FILES)){e.respondWith(cacheFirst(req,FONTS));return}
  if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return; // outside our scope: browser handles it
  if(req.mode==='navigate'){e.respondWith(navigate(req));return}
  e.respondWith(shell(req));
});

async function navigate(req){
  const c=await caches.open(SHELL);
  const hit=await c.match('index.html');
  if(hit)return hit;                       // installed: same version as the cached scripts
  try{return await fetch(req)}catch(err){return new Response('<h1>Offline</h1><p>Open RecallHSC once while online so it can be saved for offline use.</p>',{status:503,headers:{'content-type':'text/html; charset=utf-8'}})}
}
async function shell(req){
  const c=await caches.open(SHELL);
  const hit=await c.match(req,{ignoreSearch:true});
  if(hit)return hit;
  try{
    const res=await fetch(req);
    // only same-origin, successful, basic responses are added (e.g. a file missing from PRECACHE)
    if(res.ok&&res.type==='basic')c.put(req,res.clone());
    return res;
  }catch(err){return new Response('',{status:504,statusText:'offline'})}
}
async function cacheFirst(req,name){
  const c=await caches.open(name);const hit=await c.match(req);if(hit)return hit;
  try{const res=await fetch(req);if(res.ok||res.type==='opaque')c.put(req,res.clone());return res}catch(err){return new Response('',{status:504})}
}
async function staleWhileRevalidate(req,name){
  const c=await caches.open(name);const hit=await c.match(req);
  const net=fetch(req).then(res=>{if(res.ok)c.put(req,res.clone());return res}).catch(()=>null);
  return hit||(await net)||new Response('',{status:504});
}
