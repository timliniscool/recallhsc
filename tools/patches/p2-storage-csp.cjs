/* Settings/stats schema additions (with validation and safe defaults) + CSP + script tags. Applied once. */
'use strict';
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..','..');
const edit=(rel,fn)=>{const f=path.join(root,rel);fs.writeFileSync(f,fn(fs.readFileSync(f,'utf8')))};
const R=(s,a,b)=>{const n=s.split(a).length-1;if(n!==1)throw new Error(n+' matches: '+a.slice(0,90));return s.replace(a,()=>b)};

edit('js/app.js',s=>{
  s=R(s,`const DEFSET={delay:2,strict:88,phrase:4,essay:true,hide:true,scope:'start',motion:true,hidden:['settings','deep','map'],focus:false,view:'mem',gsec:'common'};`,
`/* Settings. New fields (v2): mode (marking mode, Standard by default for everyone), reduce (reduced motion:
   null = follow the device), hc (high contrast), plainInput (standard text box instead of the styled one),
   fs (text size multiplier), keys (keyboard shortcuts on/off). Older saved settings simply lack them. */
const DEFSET={delay:2,strict:88,phrase:4,essay:true,hide:true,scope:'start',motion:true,hidden:['deep','map'],focus:false,view:'mem',gsec:'common',
  mode:'standard',reduce:null,hc:false,plainInput:false,fs:1,keys:true,v:2};`);
  s=R(s,`['delay','strict','phrase'].forEach(k=>{SET[k]=num(SET[k])||DEFSET[k]});`,
`['delay','strict','phrase'].forEach(k=>{SET[k]=num(SET[k])||DEFSET[k]});
// validate everything else read back from storage (it is untrusted input)
SET.delay=Math.min(4,Math.max(.5,SET.delay));SET.strict=Math.min(100,Math.max(60,SET.strict));SET.phrase=Math.min(7,Math.max(2,SET.phrase|0));
SET.mode=RecallEngine.modeOf(SET.mode);
if(typeof SET.reduce!=='boolean')SET.reduce=null;
for(const k of ['essay','hide','motion','focus','hc','plainInput','keys'])SET[k]=typeof SET[k]==='boolean'?SET[k]:DEFSET[k];
SET.fs=Math.min(1.4,Math.max(.9,num(SET.fs)||1));
if(SET.view!=='mem'&&SET.view!=='guide')SET.view='mem';
if(typeof SET.gsec!=='string'||!/^[A-Za-z]{1,20}$/.test(SET.gsec))SET.gsec='common';
SET.hidden=SET.hidden.filter(x=>x!=='settings'); // settings moved from a side panel into its own window
SET.v=2;`);
  s=R(s,`o.hist=(Array.isArray(s.hist)?s.hist:[]).slice(-60).map(h=>[Math.max(0,Math.min(100,num(h&&h[0]))),h&&h[1]?1:0]);`,
`// history entries: [pct, pass] for Standard (legacy entries have no mode and are Standard), [pct, pass, mode] otherwise
o.hist=(Array.isArray(s.hist)?s.hist:[]).slice(-60).map(h=>{const e=[Math.max(0,Math.min(100,num(h&&h[0]))),h&&h[1]?1:0],m=h&&h[2];return m&&m!=='standard'&&RecallEngine.MODES[m]?[...e,m]:e});
o.modes={};if(s.modes&&typeof s.modes==='object')for(const m of Object.keys(RecallEngine.MODES)){const v=s.modes[m];if(v&&typeof v==='object')o.modes[m]={att:num(v.att),pass:num(v.pass),accSum:num(v.accSum)}}`);
  s=s.replace(/^(const DEFSTATS=\(\)=>\(\{)/m,'$1modes:{},');
  return s;
});
edit('index.html',s=>{
  s=R(s,`script-src 'self' 'unsafe-inline';`,`script-src 'self';`);
  s=R(s,`connect-src 'none';`,`connect-src 'self' https://*.supabase.co wss://*.supabase.co;`);
  s=R(s,`worker-src 'none'; manifest-src 'none'`,`worker-src 'self'; manifest-src 'self'`);
  s=R(s,`<script src="js/engine/marking.js"></script>`,`<script src="js/engine/marking.js"></script>\n<script src="js/engine/policies.js"></script>\n<script src="js/workers/worker-manager.js"></script>`);
  return s;
});
console.log('p2 applied');
