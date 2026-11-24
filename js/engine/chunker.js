/* RecallHSC engine · chunker: meaning-based dynamic-programming chunker
   Pure functions shared by the page, the compute worker and the tests. Loaded as a classic script (window /
   worker global: RecallEngine) or required from Node (module.exports). Code moved verbatim from index.html. */
(function(E){
/* Meaning-based chunker: scores each gap between words (punctuation > quotation edge >
before a preposition/conjunction/relative word > before a determiner), never ends a
chunk on a function word, keeps names, "X of Y" and short quotations together, then
picks the best 2–4 word split with dynamic programming. */
const FN=new Set('a an the of to in on at by for from with into onto upon as than and or but nor so yet that which who whom whose this these those his her its their our my your it he she they we i is was are were be been has have had not no very more most such'.split(' '));
const BREAK=new Set('of in on at by for from with into onto upon through throughout beyond among amongst between against without within about across after before during toward towards under over beneath behind despite via and or but yet so nor while whereas although though because since until unless as if when whenever where wherever which who whom whose that how what why even rather than'.split(' '));
const DET=new Set('the a an his her its their this these those our my your every each such another'.split(' '));
const bare=x=>x.toLowerCase().replace(/^[“"‘(]+/,'').replace(/[”"’),.;:!?]+$/,'').replace(/’s$/,'');
function chunkSentence(text,max){
const w=text.split(/\s+/).filter(Boolean),n=w.length;
if(n<=Math.max(2,max-1))return[text];
const ideal=Math.max(2,Math.min(3,max-1));
const inShortQuote=new Array(n).fill(false);
for(let i=0;i<n;i++){
if(/^[(]?[“"]/.test(w[i])){
const closes=k=>/[”"][,.;:!?)]*$/.test(k===i?w[k].replace(/^[(]?[“"]/,''):w[k]);
let j=i;while(j<n&&!closes(j))j++;
if(j<n&&j-i+1<=max+1)for(let k=i;k<j;k++)inShortQuote[k]=true;
i=j;
}
}
const gap=i=>{
const a=w[i],b=w[i+1],ba=bare(a),bb=bare(b);
if(/[,;:—–)]["”’]?$/.test(a)||/[.?!]["”’]?$/.test(a))return 6;
if(/^[(—–]/.test(b))return 5;
if(inShortQuote[i])return -4;
if(/^[“"]/.test(b)||/[”"]$/.test(a))return 4;
if(FN.has(ba))return -6;
if(/^[A-Z]/.test(a.replace(/^[“"‘(]+/,''))&&/^[A-Z]/.test(b))return -3;
if(bb==='of')return 0;
if(BREAK.has(bb))return 3;
if(DET.has(bb))return 2;
return 0;
};
const G=[];for(let i=0;i<n-1;i++)G[i]=gap(i);
const lenCost=L=>L===1?7:L>max?99:(L-ideal)*(L-ideal)*0.7+(L>ideal+1?1.5:0);
const best=new Array(n+1).fill(Infinity),from=new Array(n+1).fill(0);best[0]=0;
for(let j=1;j<=n;j++)for(let L=1;L<=Math.min(max,j);L++){
const i=j-L,c=best[i]+lenCost(L)-(j<n?G[j-1]:0);
if(c<best[j]){best[j]=c;from[j]=i}
}
const cuts=[];let j=n;while(j>0){cuts.push([from[j],j]);j=from[j]}
return cuts.reverse().map(([a,b])=>w.slice(a,b).join(' '));
}
Object.assign(E,{FN,BREAK,DET,bare,chunkSentence});
})(typeof globalThis!=='undefined'?(globalThis.RecallEngine=globalThis.RecallEngine||{}):this.RecallEngine=this.RecallEngine||{});
if(typeof module!=='undefined'&&module.exports)module.exports=globalThis.RecallEngine;
