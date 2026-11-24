/* RecallHSC engine · recall: task queue for each sentence (build, units, paragraphs, essay, motifs)
   Pure functions shared by the page, the compute worker and the tests. Loaded as a classic script (window /
   worker global: RecallEngine) or required from Node (module.exports). Code moved verbatim from index.html. */
(function(E){
const {tokens,chunkSentence,splitSentence,origPhrase}=E;
function rangeTextCtx(ctx,a,b){
const {SENTS}=ctx;
const out=[];let cur=-1;
for(let g=a;g<=b;g++){const x=SENTS[g];if(x.p!==cur){out.push([]);cur=x.p}out[out.length-1].push(x.text)}
return out.map(a=>a.join(' ')).join('\n\n');
}
function buildQueue(ctx,g){
const {SENTS,PARAS,PSTART,S,SET}=ctx,rangeText=(a,b)=>rangeTextCtx(ctx,a,b);
const x=SENTS[g],q=[],halves=splitSentence(x.text);
if(halves){
// half 1 chunk by chunk, half 2 chunk by chunk, then the whole sentence from memory
let off=0;
halves.forEach((h,hi)=>{const ph=chunkSentence(h,SET.phrase);
ph.forEach((_,k)=>q.push({type:'build',k:k+1,n:ph.length,gk:off+k+1,half:hi+1,pre:hi?halves[0]:'',shown:ph.slice(0,k+1),next:ph[k+1]||'',text:ph.slice(0,k+1).join(' '),a:g,b:g}));
off+=ph.length});
q.push({type:'sent',text:x.text,a:g,b:g});
}else{
const ph=chunkSentence(x.text,SET.phrase);
ph.forEach((_,k)=>q.push({type:'build',k:k+1,n:ph.length,shown:ph.slice(0,k+1),next:ph[k+1]||'',text:ph.slice(0,k+1).join(' '),a:g,b:g}));
}
const floor=Math.min(S.startG,g);
const pa=Math.max(PSTART[x.p],floor),last=x.s===PARAS[x.p].length-1,pt=rangeText(pa,g),solo=PARAS[x.p].length===1;
// the IQTVE (unit) this sentence belongs to: from the sentence after the previous unit end, up to here
let us=g;while(us>pa&&!SENTS[us-1].unitEnd)us--;
const unitHasQuote=()=>{for(let k=us;k<=g;k++)if(SENTS[k].role==='quote')return true;let e=g;while(e<SENTS.length-1&&!SENTS[e].unitEnd&&SENTS[e+1].p===x.p)e++;for(let k=g+1;k<=e;k++)if(SENTS[k].role==='quote')return true;return false};
if(!solo){
if(us<g)q.push({type:'unit',text:rangeText(us,g),a:us,b:g,iq:unitHasQuote()&&x.role!=='ts',done:x.unitEnd});
if(last){const fa=PSTART[x.p],ft=rangeText(fa,g);q.push({type:'para',rep:1,text:ft,a:fa,b:g});q.push({type:'para',rep:2,text:ft,a:fa,b:g})} // "full paragraph" is always the whole paragraph, whatever the start point
else if(x.unitEnd||x.role==='ts')q.push({type:'para',text:pt,a:pa,b:g}); // link the finished IQTVE into the paragraph
}
// discursive motif drill: this sentence echoes a phrase from an earlier paragraph; recall where it first came up
if(x.echo&&SENTS[x.echo.first]&&(S.learned[x.echo.first]||x.echo.first>=floor)){const f=x.echo.first;q.push({type:'motif',text:SENTS[f].text,a:f,b:f,phrase:origPhrase(SENTS[f].text,x.echo.k)})}
if(SET.essay&&x.cp)q.push({type:'essay',text:rangeText(floor,g),a:floor,b:g});
const out=[];
for(const t of q){
const prev=out[out.length-1];
if(prev&&!t.rep&&prev.text===t.text)continue;
if(t.type==='essay'&&out.some(o=>(o.type==='para'||o.type==='unit'||o.type==='sent')&&o.text===t.text))continue;
if((t.type==='unit'||(t.type==='para'&&!t.rep))&&out.some(o=>o.type==='sent'&&o.text===t.text))continue;
if(t.type==='para'&&!t.rep&&out.some(o=>o.type==='unit'&&o.text===t.text))continue;
out.push(t);
}
out.forEach(t=>t.T=tokens(t.text));
return out;
}
Object.assign(E,{rangeText:rangeTextCtx,buildQueue});
})(typeof globalThis!=='undefined'?(globalThis.RecallEngine=globalThis.RecallEngine||{}):this.RecallEngine=this.RecallEngine||{});
if(typeof module!=='undefined'&&module.exports)module.exports=globalThis.RecallEngine;
