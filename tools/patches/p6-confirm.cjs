/* In-app confirmation window instead of window.confirm/alert (blocked or silently cancelled in some embedded
   browsers and webviews). Applied once. */
'use strict';
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..','..');
const edit=(rel,fn)=>{const f=path.join(root,rel);fs.writeFileSync(f,fn(fs.readFileSync(f,'utf8')))};
const R=(s,a,b)=>{const n=s.split(a).length-1;if(n!==1)throw new Error(n+' matches in '+a.slice(0,80));return s.replace(a,()=>b)};
edit('index.html',s=>{
  // last of the modals, so it stacks above Settings when asked from there
  s=R(s,`<div class="peekview" id="peekView"`,`<div class="modal" id="cfModal" hidden>
<div class="sheet cfsheet">
<h2 id="cfTitle">Are you sure?</h2>
<p class="cfmsg" id="cfMsg"></p>
<div class="sp-btns"><button class="btn" id="cfNo">Cancel</button><button class="btn primary" id="cfYes">OK</button></div>
</div>
</div>
<div class="peekview" id="peekView"`);
  s=R(s,`/* ---------- footer + focus ---------- */`,`/* in-app confirmation */
#cfModal{z-index:70}
.cfsheet{max-width:440px}
.cfsheet h2{font-size:19px}
.cfmsg{margin:6px 0 18px;font-size:14.5px;line-height:1.55;color:var(--ink2)}
.cfsheet .btn.danger-solid{background:#dc2626;border-color:#dc2626;color:#fff}
body.gamify .cfsheet .btn.danger-solid{background:#ef4444;border-color:#fecaca;color:#0b1324;box-shadow:3px 3px 0 #7f1d1d}
/* ---------- footer + focus ---------- */`);
  return s;
});
edit('js/app.js',s=>{
  s=R(s,`function mgDelete(id){`,`/* askConfirm(message,{title,ok,cancel,danger}) -> Promise<boolean>; notice(message) -> Promise (OK only).
   Accessible: it is a .modal, so js/a11y/dialogs.js gives it dialog semantics, focus trap and focus return. */
function askConfirm(message,o){
  o=o||{};
  return new Promise(res=>{
    const m=$('cfModal'),yes=$('cfYes'),no=$('cfNo');
    $('cfTitle').textContent=o.title||'Are you sure?';$('cfMsg').textContent=message;
    yes.textContent=o.ok||'OK';yes.className='btn '+(o.danger?'danger-solid':'primary');
    no.textContent=o.cancel||'Cancel';no.hidden=!!o.alertOnly;
    const done=v=>{m.hidden=true;yes.onclick=no.onclick=m.onclick=m.onkeydown=null;res(v)};
    yes.onclick=()=>done(true);no.onclick=()=>done(false);
    m.onclick=e=>{if(e.target===m)done(false)};
    m.onkeydown=e=>{if(e.key==='Escape'){e.stopPropagation();done(false)}};
    m.hidden=false;
    requestAnimationFrame(()=>(o.danger?no:yes).focus());
  });
}
const notice=(message,title)=>askConfirm(message,{title:title||'RecallHSC',ok:'OK',alertOnly:true});
async function mgDelete(id){`);
  s=R(s,"if(!confirm(`Delete “${essayTitle(id)}”? Your progress on it goes too (unless you’ve got a backup).`))return;",
    "if(!await askConfirm(`“${essayTitle(id)}” and your progress on it will be deleted from this device (unless you’ve got a backup).`,{title:'Delete this essay?',ok:'Delete',danger:true}))return;");
  s=R(s,"if(clash.length&&!confirm(`","if(clash.length&&!await askConfirm(`");
  s=R(s,"). Continue?`))return;","). Continue?`,{title:'Replace essays?',ok:'Replace'}))return;");
  s=R(s,"confirm('Also restore the settings saved in this backup (marking mode, pass mark, display options)?');",
    "await askConfirm('Also restore the settings saved in this backup (marking mode, pass mark, display options)?',{title:'Restore settings too?',ok:'Restore settings',cancel:'Just essays'});");
  s=R(s,"if(!ok){alert('Couldn’t restore:","if(!ok){notice('Couldn’t restore:");
  s=R(s,"}catch(err){alert('That’s not a RecallHSC backup file.')}","}catch(err){notice('That’s not a RecallHSC backup file.')}");
  s=R(s,"$('btnReset').onclick=()=>{if(confirm('Reset progress and stats for this essay?')){","$('btnReset').onclick=async()=>{if(await askConfirm('This essay’s progress and stats will start again from zero. Your essay text stays.',{title:'Reset progress?',ok:'Reset',danger:true})){");
  // the global study keys leave the confirmation window alone
  s=R(s,"if(!$('modal').hidden){if(e.key==='Escape')$('bCloseStart').click();return}","if(!$('cfModal').hidden)return;\nif(!$('modal').hidden){if(e.key==='Escape')$('bCloseStart').click();return}");
  return s;
});
edit('js/sync/sync.js',s=>{
  s=R(s,"if(!confirm('Delete all your RecallHSC data stored online? Essays on this device are kept. This can’t be undone.'))return;",
    "if(!await askConfirm('Everything RecallHSC stored online will be deleted. Essays on this device are kept. This can’t be undone.',{title:'Delete cloud data?',ok:'Delete cloud data',danger:true}))return;");
  s=R(s,"if(!confirm('Delete your account and everything stored online? Essays on this device are kept. This can’t be undone.'))return;",
    "if(!await askConfirm('Your account and everything stored online will be deleted. Essays on this device are kept. This can’t be undone.',{title:'Delete account?',ok:'Delete account',danger:true}))return;");
  s=R(s,"if(!confirm('Sign out? Your essays and progress stay on this device. Sync stops until you sign in again.'))return;",
    "if(!await askConfirm('Your essays and progress stay on this device. Sync stops until you sign in again.',{title:'Sign out?',ok:'Sign out'}))return;");
  return s;
});
console.log('p6 applied');
