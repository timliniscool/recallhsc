/* RecallHSC engine · marking: Levenshtein, fuzzy word match, word alignment
   Pure functions shared by the page, the compute worker and the tests. Loaded as a classic script (window /
   worker global: RecallEngine) or required from Node (module.exports). Code moved verbatim from index.html. */
(function(E){
/* ---------- fuzzy alignment ---------- */
function lev(a,b){
const m=a.length,n=b.length;let prev=[],cur=[];
for(let j=0;j<=n;j++)prev[j]=j;
for(let i=1;i<=m;i++){cur[0]=i;for(let j=1;j<=n;j++)cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(a[i-1]===b[j-1]?0:1));[prev,cur]=[cur,prev]}
return prev[n];
}
function fuzzy(a,b){
if(a===b)return true;
const L=Math.max(a.length,b.length),tol=L<=2?0:L<=6?1:2;
if(Math.abs(a.length-b.length)>tol)return false;
return lev(a,b)<=tol;
}
function align(T,U){
const n=T.length,m=U.length,W=m+1,D=new Uint16Array((n+1)*W),M=new Uint8Array((n+1)*W),ratio=m?n/m:1;
for(let i=0;i<=n;i++)D[i*W]=i;for(let j=0;j<=m;j++)D[j]=j;
for(let i=1;i<=n;i++)for(let j=1;j<=m;j++){
const f=Math.abs(i-j*ratio)<=220&&fuzzy(T[i-1],U[j-1]);M[i*W+j]=f?1:0;
const a=D[(i-1)*W+j-1]+(f?0:1),b=D[(i-1)*W+j]+1,c=D[i*W+j-1]+1;
D[i*W+j]=a<b?(a<c?a:c):(b<c?b:c);
}
const ops=[];let i=n,j=m;
while(i>0||j>0){
if(i>0&&j>0){const f=M[i*W+j];if(D[i*W+j]===D[(i-1)*W+j-1]+(f?0:1)){ops.push({op:f?'ok':'sub',t:i-1,u:j-1});i--;j--;continue}}
if(i>0&&D[i*W+j]===D[(i-1)*W+j]+1){ops.push({op:'del',t:i-1});i--;continue}
ops.push({op:'ins',u:j-1});j--;
}
ops.reverse();
const ok=ops.filter(o=>o.op==='ok').length;
// Words typed past the end of the target (typing ahead) don't count against you; stray extras in the middle count half.
let trail=0;for(let k=ops.length-1;k>=0&&ops[k].op==='ins';k--)trail++;
const interior=ops.filter(o=>o.op==='ins').length-trail;
return{ops,ok,trail,acc:n?Math.min(1,ok/(n+.5*interior)):0};
}

Object.assign(E,{lev,fuzzy,align});
})(typeof globalThis!=='undefined'?(globalThis.RecallEngine=globalThis.RecallEngine||{}):this.RecallEngine=this.RecallEngine||{});
if(typeof module!=='undefined'&&module.exports)module.exports=globalThis.RecallEngine;
