/* Regression: the refactored engine must reproduce the original monolith's outputs exactly
   (tests/fixtures/golden.json was captured from tests/fixtures/index.original.html before any refactor). */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {E,golden,slimTask,slimParse,inputs}=require('../helpers/engine.cjs');
const G=golden(),I=inputs();
const plain=v=>JSON.parse(JSON.stringify(v));

test('splitSentences matches original',()=>{for(const c of G.splitSentences)assert.deepEqual(E.splitSentences(c.in),c.out,JSON.stringify(c.in))});
test('normWord matches original',()=>{for(const c of G.normWord)assert.equal(E.normWord(c.in),c.out,c.in)});
test('items matches original',()=>{for(const c of G.items)assert.deepEqual(E.items(c.in),c.out,c.in)});
test('lev matches original',()=>{for(const c of G.lev)assert.equal(E.lev(c.a,c.b),c.out,c.a+'/'+c.b)});
test('fuzzy tolerance boundaries match original',()=>{for(const c of G.fuzzy)assert.equal(E.fuzzy(c.a,c.b),c.out,c.a+'/'+c.b)});
test('chunkSentence matches original for max 2..7',()=>{for(const c of G.chunk)assert.deepEqual(E.chunkSentence(c.in,c.max),c.out,c.in+' @'+c.max)});
test('splitSentence (long sentences) matches original',()=>{for(const c of G.splitLong)assert.deepEqual(E.splitSentence(c.in),c.out,c.in)});
test('align matches original',()=>{for(const c of G.align)assert.deepEqual(plain(E.align(E.tokens(c.t),E.tokens(c.u))),c.out,c.t+' | '+c.u)});
test('detectKind matches original',()=>{for(const c of G.kinds){const e=I.essays.find(x=>x.name===c.name);assert.equal(E.detectKind(e.text),c.out,c.name)}});
test('parseEssay matches original (essay and creative modes)',()=>{
  for(const c of G.parse){const e=I.essays.find(x=>x.name===c.name);assert.deepEqual(plain(slimParse(E.parseEssay(e.text,c.kind))),c.out,c.name+'/'+c.kind)}
});
test('buildQueue matches original for every sentence and setting variant',()=>{
  const DEFSET={delay:2,strict:88,phrase:4,essay:true};
  for(const c of G.queues){
    const e=I.essays.find(x=>x.name===c.name),v=I.queueVariants.find(x=>x.name===c.variant);
    const m=E.parseEssay(e.text,c.kind),ctx={SENTS:m.sents,PARAS:m.paras,PSTART:m.pstart,S:{startG:v.startG||0,learned:[]},SET:{...DEFSET,...v.set}};
    const got=m.sents.map((_,g)=>E.buildQueue(ctx,g).map(slimTask));
    assert.deepEqual(plain(got),c.out,c.name+'/'+c.kind+'/'+c.variant);
  }
});
