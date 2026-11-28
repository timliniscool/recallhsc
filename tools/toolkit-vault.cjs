#!/usr/bin/env node
/* The NSBHS toolkit (Exam tips, Adaptation guide, Mod C exemplars, writing booklet) is stored ENCRYPTED in the repo
   (js/toolkit.vault.json), so it can't be read on GitHub or in the page source without the access password.
   The plain content lives only in private/toolkit/ on the maintainer's computer (git-ignored).

   node tools/toolkit-vault.cjs lock           encrypt private/toolkit/* into js/toolkit.vault.json
                                               (asks for the password; or set TOOLKIT_PASSWORD)
   node tools/toolkit-vault.cjs lock --out f   write the vault somewhere else (used by the tests)

   To change the toolkit: edit the files in private/toolkit/, then run lock again and commit js/toolkit.vault.json.
   To change the password: run lock with the new password. Students then enter the new one.
   Crypto: PBKDF2-SHA256 (600,000 rounds, random salt) -> AES-256-GCM (random IV), the same as js/toolkit.js uses. */
'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT=path.join(__dirname,'..'),PRIV=path.join(ROOT,'private','toolkit');
const ITER=600000;

function ask(q){
  return new Promise(res=>{
    if(process.env.TOOLKIT_PASSWORD)return res(process.env.TOOLKIT_PASSWORD);
    const rl=require('readline').createInterface({input:process.stdin,output:process.stdout,terminal:true});
    rl._writeToOutput=s=>{if(s.includes(q))process.stdout.write(s)}; // don't echo the password
    rl.question(q,a=>{rl.close();process.stdout.write('\n');res(a)});
  });
}

async function lock(out){
  const read=f=>fs.readFileSync(path.join(PRIV,f),'utf8');
  const content={tips:read('tips.html'),adapt:read('adapt.html'),docs:JSON.parse(read('docs.json')),booklet:read('booklet.b64').trim()};
  const pw=await ask('Toolkit access password: ');
  if(!pw||pw.length<6)throw new Error('Use a password of at least 6 characters.');
  const salt=crypto.randomBytes(16),iv=crypto.randomBytes(12);
  const key=crypto.pbkdf2Sync(pw.normalize('NFKC'),salt,ITER,32,'sha256');
  const c=crypto.createCipheriv('aes-256-gcm',key,iv);
  const data=Buffer.concat([c.update(JSON.stringify(content),'utf8'),c.final(),c.getAuthTag()]);
  const vault={v:1,kdf:'PBKDF2-SHA256',iter:ITER,salt:salt.toString('base64'),iv:iv.toString('base64'),data:data.toString('base64')};
  fs.writeFileSync(out,JSON.stringify(vault));
  console.log(`Locked the toolkit into ${path.relative(ROOT,out)} (${(data.length/1024).toFixed(0)} KB encrypted).`);
}

const [cmd,...rest]=process.argv.slice(2);
if(cmd==='lock'){const i=rest.indexOf('--out');lock(i>=0?path.resolve(rest[i+1]):path.join(ROOT,'js','toolkit.vault.json')).catch(e=>{console.error(e.message);process.exit(1)})}
else{console.log('Usage: node tools/toolkit-vault.cjs lock [--out file]');process.exit(1)}
