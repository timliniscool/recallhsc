/* RecallHSC engine · text: tokens and clean-up
   Pure functions shared by the page, the compute worker and the tests. Loaded as a classic script (window /
   worker global: RecallEngine) or required from Node (module.exports). Code moved verbatim from index.html. */
(function(E){
const normWord=w=>w.toLowerCase().replace(/[’'‘`]/g,'').replace(/[^a-z0-9]/g,'');
function items(text){
const out=[];
text.split(/\n\s*\n/).forEach((para,pi)=>{
if(pi)out.push({br:true,orig:'',norm:''});
para.split(/\s+/).filter(Boolean).forEach(tok=>tok.split(/(?<=[-–—])/).forEach(pc=>out.push({orig:pc,norm:normWord(pc)})));
});
return out;
}
const tokens=text=>items(text).filter(i=>i.norm).map(i=>i.norm);
/* Markdown / docx-export clean-up: keeps line structure, drops images, rules, emphasis markers and escapes. */
function mdClean(t){
return t.replace(/\r/g,'').replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/^\[image\d*\]:.*$/gim,'')
.replace(/^\s*(-{3,}|\*{3,}|_{3,})\s*$/gm,'').replace(/\\([\[\]\-*_()#.!>~`|])/g,'$1')
.replace(/~~/g,'').replace(/^\s*[*+-]\s+/gm,'').replace(/^#{1,6}\s+/gm,'').replace(/\*\*([^*]+?)\*\*/g,'$1').replace(/(^|[^*\w])\*([^*\n]+?)\*(?!\w)/g,'$1$2').replace(/\*\*/g,'')
.replace(/[ \t]+$/gm,'').replace(/\n{3,}/g,'\n\n').trim();
}
Object.assign(E,{normWord,items,tokens,mdClean});
})(typeof globalThis!=='undefined'?(globalThis.RecallEngine=globalThis.RecallEngine||{}):this.RecallEngine=this.RecallEngine||{});
if(typeof module!=='undefined'&&module.exports)module.exports=globalThis.RecallEngine;
