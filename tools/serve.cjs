#!/usr/bin/env node
/* Tiny static server for local development and the browser tests.
   Serves the repo under /recallhsc/ (the GitHub Pages path) and also at / , so subdirectory hosting is exercised.
   Usage: node tools/serve.cjs [port]   (default 5179) */
'use strict';
const http=require('http'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'),port=+process.argv[2]||+process.env.PORT||5179;
const TYPES={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.wasm':'application/wasm','.cjs':'text/javascript; charset=utf-8','.json':'application/json',
  '.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.txt':'text/plain; charset=utf-8','.xml':'application/xml','.css':'text/css'};
const BLOCK=/^\/(node_modules|tests|tools|supabase|\.git|\.github|package)/;
http.createServer((req,res)=>{
  let u=decodeURIComponent(req.url.split('?')[0]);
  if(u.startsWith('/recallhsc/'))u=u.slice('/recallhsc'.length);else if(u==='/recallhsc')u='/';
  if(u.endsWith('/'))u+='index.html';
  const fp=path.normalize(path.join(root,u));
  if(!fp.startsWith(root)||BLOCK.test(u)){res.statusCode=404;return res.end('not found')}
  fs.readFile(fp,(e,d)=>{
    if(e){res.statusCode=404;return res.end('not found')}
    res.setHeader('content-type',TYPES[path.extname(fp)]||'application/octet-stream');
    res.setHeader('cache-control','no-cache');
    if(path.basename(fp)==='sw.js')res.setHeader('service-worker-allowed','/');
    res.end(d);
  });
}).listen(port,()=>console.log(`RecallHSC on http://localhost:${port}/recallhsc/`));
