/* RecallHSC · "Report marking": students point out checks that were marked wrongly, so the marking (and the
   handwriting reader) can be improved. A small link under every result opens a short form. What's sent: the expected
   words, the answer, the marking mode, the step type, the student's note, and (handwriting only) pictures of the
   written lines. No name or email. Signed-in reports are linked to the account so they're deleted with it.
   Stored write-only in the project's Supabase `feedback` table (see supabase/migrations/…_feedback.sql). */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const foot=$('foot');if(!foot)return;
// shown once the project's feedback table exists (RECALL_CLOUD.feedback in js/sync/config.js)
const cfg=()=>self.RECALL_CLOUD&&self.RECALL_CLOUD.url&&self.RECALL_CLOUD.anonKey&&self.RECALL_CLOUD.feedback?self.RECALL_CLOUD:null;
const device=()=>{const ua=navigator.userAgent||'';return /iPad/.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>0)?'iPad':/iPhone|Android.+Mobile/.test(ua)?'phone':/Android/.test(ua)?'tablet':'desktop'};
const isHW=()=>document.body.classList.contains('hw');

/* the form (a .modal, so js/a11y/dialogs.js gives it dialog semantics, a focus trap and focus return) */
const m=document.createElement('div');m.className='modal';m.id='fbModal';m.hidden=true;
m.innerHTML=`<div class="sheet fbsheet"><h2 id="fbTitle">Report a marking mistake</h2>
<p class="fbsub">Thanks for helping make RecallHSC's marking fairer. What went wrong?</p>
<div class="fbreasons" role="radiogroup" aria-labelledby="fbTitle">
<label><input type="radio" name="fbr" value="was_right" checked> I wrote it correctly</label>
<label class="fbhw"><input type="radio" name="fbr" value="misread"> It read my handwriting wrong</label>
<label><input type="radio" name="fbr" value="expected_wrong"> The expected words are wrong</label>
<label><input type="radio" name="fbr" value="too_harsh"> The marking is too strict here</label>
<label><input type="radio" name="fbr" value="other"> Something else</label></div>
<label class="fbnote"><span>Anything to add? <small>(optional)</small></span><textarea id="fbNote" maxlength="1000" rows="3" placeholder="e.g. the word was “place”, not “slave”"></textarea></label>
<p class="fbwhat">Sends the expected words, your answer, the marking mode<span class="fbhw"> and pictures of your writing</span>. No name or email. <a href="privacy.html" target="_blank" rel="noopener">Privacy</a></p>
<div class="sp-btns"><button class="btn" id="fbCancel" type="button">Cancel</button><button class="btn primary" id="fbSend" type="button">Send report</button></div></div>`;
document.body.appendChild(m);
let ctx=null; // what was marked, captured when the form opens
function open(){
  ctx={expected:typeof task!=='undefined'&&task?task.text:'',answer:typeof typed==='string'?typed:'',task_type:typeof task!=='undefined'&&task?task.type:'',
    mode:typeof attemptMode!=='undefined'?attemptMode:'',hw:isHW(),extra:self.HW&&self.HW._lastReport?self.HW._lastReport():null};
  m.querySelectorAll('.fbhw').forEach(e=>e.hidden=!ctx.hw);
  m.querySelector('input[value="'+(ctx.hw?'misread':'was_right')+'"]').checked=true;
  $('fbNote').value='';$('fbSend').disabled=false;$('fbSend').textContent='Send report';
  m.hidden=false;
}
const close=()=>{m.hidden=true;ctx=null};
$('fbCancel').onclick=close;
m.addEventListener('click',e=>{if(e.target===m)close()});
m.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();close()}});
async function token(){try{return self.RecallCloudAuth?await self.RecallCloudAuth():null}catch(_){return null}}
$('fbSend').onclick=async()=>{
  const c=cfg();if(!c||!ctx){close();return}
  const reason=(m.querySelector('input[name="fbr"]:checked')||{}).value||'other';
  const body={kind:'marking',reason,note:$('fbNote').value.trim().slice(0,1000)||null,mode:String(ctx.mode||'').slice(0,20)||null,
    task_type:String(ctx.task_type||'').slice(0,20)||null,expected:String(ctx.expected||'').slice(0,20000),answer:String(ctx.answer||'').slice(0,20000),
    read_text:ctx.extra&&ctx.extra.read?String(ctx.extra.read).slice(0,20000):null,
    images:ctx.extra&&Array.isArray(ctx.extra.images)&&ctx.extra.images.length?ctx.extra.images.slice(0,40):null,
    device:device(),app_version:/\/beta(\/|$)/.test(location.pathname)?'beta':'main'};
  $('fbSend').disabled=true;$('fbSend').textContent='Sending…';
  try{
    const t=await token();
    const r=await fetch(c.url.replace(/\/$/,'')+'/rest/v1/feedback',{method:'POST',
      headers:{'apikey':c.anonKey,'Authorization':'Bearer '+(t||c.anonKey),'Content-Type':'application/json','Prefer':'return=minimal'},body:JSON.stringify(body)});
    if(!r.ok)throw new Error('HTTP '+r.status);
    close();if(self.toast)toast('Thanks! Report sent');if(self.announce)announce('Thanks. Your report was sent.');if(self.track)track('report-marking');
  }catch(err){
    $('fbSend').disabled=false;$('fbSend').textContent='Try again';
    if(self.toast)toast('Couldn’t send the report. Check your connection and try again.');
  }
};

/* the link: under every result (passed, failed or a longer recall waiting for Continue) */
function addLink(){
  if(!cfg())return;
  const p=typeof phase!=='undefined'?phase:'';
  if(!['ok','fail','review'].includes(p)||foot.querySelector('.fblink'))return;
  const b=document.createElement('button');b.type='button';b.className='fblink';b.textContent='⚑ Report marking';
  b.title='Marked wrongly? Tell us';b.onclick=open;
  const sp=foot.querySelector('.spacer');foot.insertBefore(b,sp?sp.nextSibling:null);
}
new MutationObserver(addLink).observe(foot,{childList:true});
self.RecallFeedback={open,_ctx:()=>ctx};
})();
