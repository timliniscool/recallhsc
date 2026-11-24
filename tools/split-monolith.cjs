#!/usr/bin/env node
/* One-time migration: splits the single-file index.html into an engine (pure algorithms, usable from the page,
   a Web Worker and Node tests), the app, Don, the game and the boot code. Code is moved verbatim; only the
   two context-dependent engine functions (rangeText, buildQueue) take their state as an argument instead of
   reading app globals. Kept in the repo as a record of how the split was made. */
'use strict';
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'tests/fixtures/index.original.html'),'utf8');
const L=html.split('\n');
const at=(re,from=0)=>{for(let i=from;i<L.length;i++)if(re.test(L[i]))return i;throw new Error('marker not found: '+re)};
const slice=(a,b)=>L.slice(a,b).join('\n');
const s0=at(/^<script>$/),s1=at(/^<\/script>$/,s0);
const iABBR=at(/^const ABBR=/,s0),iDetEnd=at(/^\/\* Meaning-based chunker/,iABBR),iFN=at(/^const FN=/,iDetEnd),
  iNorm=at(/^const normWord=/,iFN),iMd=at(/^\/\* Markdown \/ docx-export clean-up/,iNorm),iHead=at(/^const HEAD_RX=/,iMd),
  iParas=at(/^let PARAS=\[\]/,iHead),iLev=at(/^\/\* -+ fuzzy alignment -+ \*\//,iParas),iStore=at(/^\/\* -+ storage -+ \*\//,iLev),
  iRange=at(/^function rangeText\(/,iStore),iSplit=at(/^\/\* Long sentences \(20\+ words\)/,iRange),iBQ=at(/^function buildQueue\(/,iSplit),
  iLoad=at(/^function loadTask\(/,iBQ),iB64=at(/^const BOOKLET_B64 = /,s0),iPet=at(/^const Pet=\(\(\)=>\{/,iLoad),
  iGame=at(/^const Game=\(\(\)=>\{/,iPet),iViews=at(/^\/\* -+ views -+ \*\//,iGame);
// mdClean sits between tokens and HEAD_RX; HEAD_RX..isFormulaic is parser territory
const wrap=(name,deps,body,exports)=>`/* RecallHSC engine · ${name}
   Pure functions shared by the page, the compute worker and the tests. Loaded as a classic script (window /
   worker global: RecallEngine) or required from Node (module.exports). Code moved verbatim from index.html. */
(function(E){
${deps?`const {${deps}}=E;\n`:''}${body}
Object.assign(E,{${exports}});
})(typeof globalThis!=='undefined'?(globalThis.RecallEngine=globalThis.RecallEngine||{}):this.RecallEngine=this.RecallEngine||{});
if(typeof module!=='undefined'&&module.exports)module.exports=globalThis.RecallEngine;
`;
const text=wrap('text: tokens and clean-up','',slice(iNorm,iHead),'normWord,items,tokens,mdClean');
const chunker=wrap('chunker: meaning-based dynamic-programming chunker','',slice(iDetEnd,iNorm),'FN,BREAK,DET,bare,chunkSentence');
const parserExports='ABBR,splitSentences,quotedWords,TECH,ANALYSIS_RX,VERB_RX,outsideQuoteWords,hasQuote,TECH_RX,detectStructure,HEAD_RX,looksHeading,looksCreative,discScore,looksDiscursive,detectKind,TURN_RX,ANEC_RX,REFL_RX,ABSTRACT_RX,PAST_RX,PRES_RX,tagMoves,origPhrase,pieceStyle,markMotifs,parseEssay,isFormulaic,splitSentence';
const parser=wrap('parser: sentences, essay structure, creative/discursive moves, motifs','items,tokens,mdClean,FN,BREAK',
  slice(iABBR,iDetEnd)+'\n'+slice(iHead,iParas)+'\n'+slice(iSplit,iBQ),parserExports);
const marking=wrap('marking: Levenshtein, fuzzy word match, word alignment','',slice(iLev,iStore),'lev,fuzzy,align');
let bq=slice(iRange,iSplit)+'\n'+slice(iBQ,iLoad);
bq=bq.replace(/^function rangeText\(a,b\)\{/m,'function rangeText(ctx,a,b){\nconst {SENTS}=ctx;')
  .replace(/^function buildQueue\(g\)\{/m,'function buildQueue(ctx,g){\nconst {SENTS,PARAS,PSTART,S,SET}=ctx,rangeText=(a,b)=>rangeTextCtx(ctx,a,b);');
bq=bq.replace('function rangeText(ctx,a,b){','function rangeTextCtx(ctx,a,b){');
const recall=wrap('recall: task queue for each sentence (build, units, paragraphs, essay, motifs)','tokens,chunkSentence,splitSentence,origPhrase',bq,'rangeText:rangeTextCtx,buildQueue');
const dir=path.join(root,'js','engine');fs.mkdirSync(dir,{recursive:true});
for(const[f,c]of Object.entries({'text.js':text,'chunker.js':chunker,'parser.js':parser,'marking.js':marking,'recall.js':recall}))fs.writeFileSync(path.join(dir,f),c);

// the app: everything else in the old script, with the engine names bound from RecallEngine
const engineNames='normWord,items,tokens,mdClean,FN,BREAK,DET,bare,chunkSentence,'+parserExports+',lev,fuzzy,align';
const bind=`/* engine (js/engine/*.js) */\nconst {${engineNames}}=RecallEngine;\nconst rangeText=(a,b)=>RecallEngine.rangeText({SENTS},a,b);\nconst buildQueue=g=>RecallEngine.buildQueue({SENTS,PARAS,PSTART,S,SET},g);`;
const appLines=[...L.slice(s0+1,iB64),...L.slice(iB64+1,iABBR),bind,...L.slice(iParas,iLev),...L.slice(iStore,iRange),...L.slice(iLoad,iPet)];
fs.writeFileSync(path.join(root,'js','app.js'),'/* RecallHSC app: UI, state, storage, guide. Algorithms live in js/engine/. */\n'+appLines.join('\n')+'\n');
fs.writeFileSync(path.join(root,'js','pet.js'),'/* Don the falcon */\n'+slice(iPet,iGame)+'\n');
fs.writeFileSync(path.join(root,'js','game.js'),'/* Gamify mode: retro platformer */\n'+slice(iGame,iViews)+'\n');
fs.writeFileSync(path.join(root,'js','boot.js'),'/* RecallHSC start-up: views, first paint */\n'+slice(iViews,s1)+'\n');
// booklet PDF (base64) loads only when someone opens or downloads it
fs.writeFileSync(path.join(root,'js','booklet-data.js'),'/* English Advanced writing booklet (PDF, base64). Loaded on demand. */\nself.BOOKLET_B64'+L[iB64].replace(/^const BOOKLET_B64 /,' ')+'\n');
const tags=['js/engine/text.js','js/engine/chunker.js','js/engine/parser.js','js/engine/marking.js','js/engine/recall.js','js/app.js','js/pet.js','js/game.js','js/boot.js']
  .map(s=>`<script src="${s}"></script>`).join('\n');
const out=[...L.slice(0,s0),tags,...L.slice(s1+1)].join('\n');
fs.writeFileSync(path.join(root,'index.html'),out);
console.log('split done:',fs.readdirSync(dir).join(', '),'+ app.js pet.js game.js boot.js booklet-data.js');
