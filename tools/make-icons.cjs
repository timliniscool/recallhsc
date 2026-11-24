#!/usr/bin/env node
/* Renders the RecallHSC logo (the existing favicon: sky-blue rounded square + white caret bar) to the PWA icon set.
   Uses Playwright with the system Edge/Chrome, so nothing is downloaded. Usage: npm run icons */
'use strict';
const fs=require('fs'),path=require('path');
const {chromium}=require('@playwright/test');
const out=path.join(__dirname,'..','icons');fs.mkdirSync(out,{recursive:true});
// the brand mark, scalable. rounded=true for normal icons; maskable icons are full-bleed with the mark in the safe zone
const svg=(rounded,scale=1)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#38bdf8"/><stop offset="1" stop-color="#0284c7"/></linearGradient></defs>
<rect width="512" height="512" rx="${rounded?144:0}" fill="url(#g)"/>
<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
<rect x="160" y="128" width="48" height="256" rx="24" fill="#fff"/>
<rect x="240" y="232" width="112" height="48" rx="24" fill="#fff" opacity=".55"/>
</g></svg>`;
(async()=>{
  fs.writeFileSync(path.join(out,'icon.svg'),svg(true));
  fs.writeFileSync(path.join(out,'icon-maskable.svg'),svg(false,.72));
  let browser;
  for(const channel of ['msedge','chrome',undefined]){try{browser=await chromium.launch(channel?{channel}:{});break}catch(e){}}
  if(!browser)throw new Error('No Chromium-based browser available for rendering icons');
  const page=await browser.newPage();
  const render=async(file,size,rounded,scale)=>{
    await page.setViewportSize({width:size,height:size});
    await page.setContent(`<html><body style="margin:0;background:transparent">${svg(rounded,scale).replace('<svg ',`<svg width="${size}" height="${size}" `)}</body></html>`);
    await page.screenshot({path:path.join(out,file),omitBackground:true,clip:{x:0,y:0,width:size,height:size}});
  };
  await render('icon-192.png',192,true,1);
  await render('icon-512.png',512,true,1);
  await render('icon-maskable-512.png',512,false,.72);
  await render('apple-touch-icon.png',180,false,.86); // iOS rounds the corners itself and dislikes transparency
  await render('favicon-32.png',32,true,1);
  await browser.close();
  console.log('icons written to',path.relative(process.cwd(),out),fs.readdirSync(out).join(', '));
})().catch(e=>{console.error(e);process.exit(1)});
