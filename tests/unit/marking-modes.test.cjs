'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {E,golden}=require('../helpers/engine.cjs');
const G=golden();
const plain=v=>JSON.parse(JSON.stringify(v));
const mark=(text,typed,mode,strict)=>E.markAttempt({text,typed,mode,strict});

test('standard mode reproduces the original align() on every golden case',()=>{
  for(const c of G.align){
    const r=mark(c.t,c.u,'standard').r;
    assert.deepEqual(plain(r),c.out,c.t+' | '+c.u);
    assert.deepEqual(plain(E.alignBy(E.tokens(c.t),E.tokens(c.u),E.fuzzy)),c.out);
  }
});
test('unknown or missing mode falls back to standard',()=>{
  assert.equal(E.modeOf(undefined),'standard');assert.equal(E.modeOf('nope'),'standard');
  assert.deepEqual(plain(mark('the cat sat','teh cat sat','zzz').r),plain(mark('the cat sat','teh cat sat','standard').r));
});
test('standard: small spelling slips pass, pass mark is the configurable threshold',()=>{
  const a=mark('Shakespeare reveals that ambition corrupts','Shakespear reveals that ambitoin corrupts','standard',88);
  assert.equal(a.pct,100);assert.equal(a.pass,true);
  assert.equal(mark('one two three four five six seven eight nine ten','one two three four five six seven eight nine','standard',88).pass,true); // 90%
  assert.equal(mark('one two three four five six seven eight nine ten','one two three four five six seven eight','standard',88).pass,false); // 80%
});
test('exact: misspellings and look-alike words are wrong; punctuation and capitals still ignored',()=>{
  const a=mark('Shakespeare reveals that ambition corrupts','Shakespear reveals that ambitoin corrupts','exact',88);
  assert.equal(a.r.ops.filter(o=>o.op==='sub').length,2);assert.equal(a.pct,60);assert.equal(a.pass,false);
  assert.equal(mark('their house','there house','exact').pct,50);
  const b=mark('He said, "Stop now."','he said stop now','exact');assert.equal(b.pct,100);
});
test('exact: missing, extra and typed-ahead words behave like standard',()=>{
  assert.equal(mark('a b c d','a b d','exact').r.ops.filter(o=>o.op==='del').length,1);
  const ahead=mark('the cat sat','the cat sat on the mat','exact');assert.equal(ahead.r.trail,3);assert.equal(ahead.pct,100);
  const mid=mark('the cat sat','the big cat sat','exact');assert.equal(mid.pct,Math.round(3/3.5*100));
});
test('quotes: tolerant outside quotations, exact inside, and every quoted word needed to pass',()=>{
  const text='Macbeth admits, "I have no spur to prick the sides of my intent." This reveals his guilt.';
  const outside=mark(text,'Macbet admits I have no spur to prick the sides of my intent this reveals his guilt','quotes',88);
  assert.equal(outside.pass,true);assert.equal(outside.quote.bad.length,0);
  const inside=mark(text,'Macbeth admits I have no spurr to prick the sides of my intent this reveals his guilt','quotes',88);
  assert.equal(inside.quote.bad.length,1);assert.equal(inside.pass,false,'one wrong quoted word fails even above the pass mark');
  assert.ok(inside.pct>=88);
  const missing=mark(text,'Macbeth admits I have no spur to prick the of my intent this reveals his guilt','quotes',88);
  assert.equal(missing.pass,false);
});
test('quotes: no quotations behaves exactly like standard',()=>{
  const t='The irony reveals his attachment to a culture.',u='The ironny reveals his atachment to a culture';
  const q=mark(t,u,'quotes'),s=mark(t,u,'standard');
  assert.deepEqual(plain(q.r),plain(s.r));assert.equal(q.pass,s.pass);assert.equal(q.quote.n,0);
});
test('quotes: student answer without quote marks is still checked (spans come from the essay)',()=>{
  const r=mark('She cries, “Out, damned spot!”','she cries out damn spot','quotes');
  assert.equal(r.quote.n,3);assert.deepEqual(r.quote.bad,[3]);
});
test('quoteMask: curly, straight, single, multiple, apostrophes and carried-over quotes',()=>{
  const m=t=>E.quoteMask(t).map(Number).join('');
  assert.equal(m('He says, "I am here." Then'),'001110'); // He says [I am here] Then
  assert.equal(m('A “b c” d “e” f'),'011010');
  assert.equal(m('It’s the students’ choice, ‘a bold move’ indeed.'),'0000111'+'0');
  assert.equal(m("Don't stop"),'00');
  assert.equal(E.quoteMask('carried on” and then',true).map(Number).join(''),'1100');
  assert.equal(E.endsInsideQuote('He wrote, “The first part. ',false),true);
});
test('verbatim: capitals and punctuation count; keyboard-equivalent characters do not',()=>{
  const t='He said, “Don’t — stop.”';
  assert.equal(mark(t,'He said, "Don\'t - stop."','verbatim').pct,100,'straight quotes / hyphen are equivalent');
  const caps=mark(t,'he said, "Don\'t - stop."','verbatim');assert.equal(caps.pct,80);
  const punct=mark(t,'He said "Don\'t - stop"','verbatim');assert.ok(punct.pct<100);
  const ahead=mark('The end.','The end. And more.','verbatim');assert.equal(ahead.r.trail,0);assert.ok(ahead.pct<100,'typing ahead is not free');
});
test('verbatim: paragraph breaks and extra spaces are not errors',()=>{
  assert.equal(mark('One two.\n\nThree four.','One   two. Three\nfour.','verbatim').pct,100);
});
test('liveAccuracy matches the original live calculation in standard mode',()=>{
  const text='the cat sat on the mat and looked at the dog',typed='the cat sat on teh';
  const T=E.tokens(text),U=E.tokens(typed);
  assert.equal(E.liveAccuracy({text,typed,mode:'standard'}),E.align(T.slice(0,U.length),U).acc);
  assert.equal(E.liveAccuracy({text,typed:'',mode:'standard'}),null);
});
test('fuzzy cache returns the same answers as fuzzy()',()=>{
  for(const c of G.fuzzy){assert.equal(E.fuzzyCached(c.a,c.b),c.out);assert.equal(E.fuzzyCached(c.a,c.b),c.out)}
});
