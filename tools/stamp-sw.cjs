#!/usr/bin/env node
/* Stamps sw.js with a hash of every precached file, so each deploy with changed files is a new service worker
   (and students are offered the update). Also checks that every PRECACHE entry exists.
   Usage: node tools/stamp-sw.cjs          rewrite ASSET_HASH
          node tools/stamp-sw.cjs --check  exit 1 if the stamp is stale or a file is missing (used in CI) */
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.join(__dirname,'..'),swPath=path.join(root,'sw.js');
let sw=fs.readFileSync(swPath,'utf8');
const list=eval(sw.match(/const PRECACHE=(\[[\s\S]*?\]);/)[1]);
const h=crypto.createHash('sha256');const missing=[];
for(const u of list){
  const f=path.join(root,u==='./'?'index.html':u);
  if(!fs.existsSync(f)){missing.push(u);continue}
  h.update(u+'\0');h.update(fs.readFileSync(f));
}
if(missing.length){console.error('sw.js precaches missing files:',missing.join(', '));process.exit(1)}
const hash=h.digest('hex').slice(0,12);
const cur=(sw.match(/const ASSET_HASH='([^']*)';/)||[])[1];
if(process.argv.includes('--check')){
  if(cur!==hash){console.error(`sw.js ASSET_HASH is stale (${cur} != ${hash}). Run: npm run stamp`);process.exit(1)}
  console.log('sw.js stamp up to date:',hash);process.exit(0);
}
sw=sw.replace(/const ASSET_HASH='[^']*';/,`const ASSET_HASH='${hash}';`);
fs.writeFileSync(swPath,sw);console.log('sw.js stamped:',hash,`(${list.length} files)`);
