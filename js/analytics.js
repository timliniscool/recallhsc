/* RecallHSC · anonymous usage counts (GoatCounter), with no cookies and no third-party script.
   One small request per page view and a handful of events (e.g. "essay uploaded"). Nothing is stored on the device
   except the student's own opt-out choice. No essay text, titles or anything typed is ever sent.
   Off on localhost, under automated browsers, with Do Not Track / Global Privacy Control, and when turned off in Settings. */
(function(){
'use strict';
const CODE='timliniscool';           // GoatCounter site code: https://timliniscool.goatcounter.com
const OPT='essayRecall2.noStats';    // '1' = the student turned usage stats off
const off=()=>{try{return localStorage.getItem(OPT)==='1'}catch(_){return false}};
const blocked=()=>!CODE||/^(localhost|127\.0\.0\.1|\[::1\])$|\.(localhost|test)$/.test(location.hostname)||
  navigator.webdriver||navigator.doNotTrack==='1'||navigator.globalPrivacyControl===true||off();
const sent=new Set();
function hit(path,title,event){
  if(blocked())return;
  const q=new URLSearchParams({p:path,t:title||'',s:String(screen.width||0),rnd:Math.random().toString(36).slice(2)});
  if(event)q.set('e','true');else if(document.referrer&&!document.referrer.startsWith(location.origin))q.set('r',document.referrer.slice(0,200));
  const url=`https://${CODE}.goatcounter.com/count?${q}`;
  try{if(!(navigator.sendBeacon&&navigator.sendBeacon(url)))fetch(url,{method:'GET',mode:'no-cors',keepalive:true,credentials:'omit'}).catch(()=>{})}catch(_){}
}
// track('upload') etc. Each event counts at most once per page load, so it measures how many visits do it.
self.track=(name)=>{if(typeof name!=='string'||!/^[a-z0-9-]{1,40}$/.test(name)||sent.has(name))return;sent.add(name);hit(name,name,true)};
self.RecallStats={enabled:()=>!off(),set(on){try{on?localStorage.removeItem(OPT):localStorage.setItem(OPT,'1')}catch(_){}},configured:()=>!!CODE};
// Settings switch (App section). Hidden until a site code is set.
{const sw=document.getElementById('sStats'),row=document.getElementById('statsRow');
if(row)row.hidden=!CODE;
if(sw){sw.checked=!off();sw.onchange=()=>{self.RecallStats.set(sw.checked);if(self.announce)announce(sw.checked?'Anonymous usage stats on.':'Anonymous usage stats off.')}}}
// one page view per visit (the app is a single page)
if(document.readyState==='complete')hit(location.pathname,'RecallHSC');else addEventListener('load',()=>hit(location.pathname,'RecallHSC'),{once:true});
})();
