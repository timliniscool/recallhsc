/* Shared test inputs. Used to capture golden outputs from the original code and to check the refactored engine.
   Only public material: the built-in sample essay, the Mod C exemplars already published in the Rubric guide,
   and synthetic text written for these tests. No user essays. */
'use strict';
const FORMULAIC=`Shakespeare's Macbeth explores how unchecked ambition corrupts a noble mind and destabilises the natural order.

Shakespeare shows that ambition first appears as a temptation Macbeth tries to resist. Macbeth admits his ambition is unjustified. He says, "I have no spur to prick the sides of my intent, but only vaulting ambition." The equestrian metaphor of the spur shows that nothing but ambition drives him. This reveals that Shakespeare views ambition as self-destructive. Later, guilt overwhelms Macbeth after the murder. He asks, "Will all great Neptune's ocean wash this blood clean from my hand?" The hyperbole emphasises the overwhelming scale of his guilt. This suggests that ambition carries an unbearable moral cost.

Lady Macbeth also suffers from the consequences of ambition. She cries, "Out, damned spot! out, I say!" The exclamation conveys her desperation and fractured mind. This suggests that guilt cannot be escaped. In her final scene she sleepwalks. The doctor observes, "More needs she the divine than the physician." The antithesis shows that her sickness is spiritual. This highlights the corrosive power of ambition.

Ultimately, Macbeth warns audiences that ambition without morality leads to ruin.`;
const DISCURSIVE=`On Keeping Things

I remember my grandmother's kitchen, the radio humming on the windowsill. She kept every jar she ever emptied. When I was nine I asked her why. She laughed and said that nothing is ever really empty.

Perhaps we keep things because we are afraid of forgetting. We tell ourselves that objects hold memory, that a chipped cup can remember a morning. But can a cup remember anything at all? Or do we simply need somewhere to put what we cannot carry?

Years ago, after she died, we cleared the house. I found the jars lined up in the garage, washed and waiting. Nothing is ever really empty, I thought.

And yet I threw most of them away.

Still, I kept one. It sits on my desk now. Maybe that is enough.`;
const NARRATIVE=`The Lighthouse

The storm came in low over the water. Mara pulled the shutters closed and lit the lamp. Somewhere below, the boat knocked against the jetty.

"Will he come back?" her brother asked.

She did not answer. She watched the beam sweep the dark, once, twice, again. At dawn the sea was flat and grey, and the jetty was empty.`;
const MALFORMED=`this essay has no capitals and runs on   without  much punctuation  it just keeps going and going
and then a line break appears mid sentence. "an unclosed quote begins here and never ends
Then?? double marks!! and ... ellipses … everywhere... Finally, a sentence.`;

module.exports=function({raw,docs}){
  const ex=(docs&&docs.ex)||[];
  const essays=[
    {name:'sample',text:raw,queue:true,kinds:['essay']},
    {name:'formulaic',text:FORMULAIC,queue:true,kinds:['essay']},
    {name:'discursive',text:DISCURSIVE,queue:true,kinds:['creative']},
    {name:'narrative',text:NARRATIVE,queue:true,kinds:['creative']},
    {name:'malformed',text:MALFORMED},
    {name:'empty',text:''},
    {name:'whitespace',text:'   \n\n  \t '},
    ...ex.slice(0,3).map((e,i)=>({name:'exemplar'+i,text:e.text,queue:i===0,kinds:['creative']})),
  ];
  return{
    essays,
    sentences:[
      'This is one. This is two.','Dr. Smith met Mr. Jones at 5 p.m. today. They talked.','J. K. Rowling wrote it. It sold well.',
      'Pi is 3.14 roughly. That is close enough.','He paused... then spoke. She left.','Wait… what? No!',
      'She said, "Stop. Now." Then she left.','"Is it over?" he asked. "Yes," she said.','He wrote “I am done. Truly done.” and closed the book.',
      'Nested: “she said ‘leave now’ and went.” Next sentence.','Smart ‘single’ quotes don’t break it. Do they?','Wow! Really? Yes.',
      'e.g. this abbreviation, i.e. that one, etc. all stay. Done.','No ending punctuation','','   ','Ünïcödé façade naïve café. Ελληνικά κείμενο. 中文句子。',
      'A very long sentence that keeps going with clause after clause, and comma after comma, and still more words to test how the splitter handles a runaway sentence without any stops at all, carrying on and on.',
      '?! Malformed start. ..Double dots.. Then normal.','Text (with a bracketed sentence. Inside it.) continues. End.','Chapter 3. The end.',
    ],
    words:['Hello','DON’T','don\'t','rock-and-roll','“quoted”','(bracket)','café','naïve','123','','—','it’s','O’Brien','U.S.A.','e.g.'],
    itemTexts:['Hello, world! It’s me.','A — dash and en–dash; semicolon: colon.','well-known self-aware x-ray','Para one.\n\nPara two.','“Quote,” she said.',''],
    levPairs:[['',''],['a',''],['','abc'],['kitten','sitting'],['flaw','lawn'],['abc','abc'],['abc','acb'],['abcd','abdc'],['ambition','ambitoin'],['their','there'],['form','from'],['ab','ba']],
    fuzzyPairs:[['a','a'],['a','b'],['an','am'],['to','too'],['the','teh'],['cat','cut'],['cat','cart'],['house','horse'],['house','hous'],['metaphor','metaphr'],
      ['metaphor','metafor'],['juxtaposition','juxtapositon'],['juxtaposition','juxtaposiiton'],['ambition','ambitions'],['ambition','emotion'],['form','from'],['their','there'],
      ['abcdef','abcxyz'],['abcdefg','abcdxyz'],['shakespeare','shakespear'],['quintessential','quintesential'],['affect','effect'],['six','sixty']],
    chunkSentences:['Short one.','Two words','The cat sat.','Leadership is rarely found where we expect it, and democracy has long underestimated the wisdom of the back row.',
      'He says, "I have no spur to prick the sides of my intent." Then he leaves.','Mary Anne Smith visited New South Wales in March.',
      'In the end — after everything (and there was much) — she stayed; he did not.','Through the deft use of metaphor, Malouf reveals that exile is a state of mind rather than a place.',
      'of in on at by for from with into onto upon','The quick brown fox jumps over the lazy dog because of the noise in the barn behind the old red house on the hill near the river by the sea.',
      '“Out, damned spot! out, I say!” she cries, and the audience recoils.'],
    longSentences:['Bart Simpson, a ten-year-old from Springfield Elementary, exposes the paradox that the very qualities which earn detention are precisely those a nation requires in a crisis.',
      'Yet he still measures Tomis by Roman standards, declaring it “centuries from the notion of an orchard or a garden made simply to please”.',
      'In Parts IV and V, Malouf links Ovid’s imaginative transformation to a growing capacity to accept what he cannot direct and what he cannot name.',
      'Short sentence with fewer than twenty words, no split.',
      'A very long sentence without any clause breaks that just keeps going word after word after word after word after word after word after word.'],
    alignCases:[
      ['the cat sat on the mat','the cat sat on the mat'],['the cat sat on the mat','the cat on the mat'],['the cat sat on the mat','the big cat sat on the mat'],
      ['the cat sat on the mat','the dog sat on the mat'],['the cat sat on the mat','the cat sat on the mat and then left'],['the cat sat on the mat','and the cat sat on the mat'],
      ['the cat sat on the mat',''],['','anything'],['the cat sat on the mat','teh cat sat on teh mat'],['the cat sat on the mat','mat the on sat cat the'],
      ['the the the cat','the cat'],['one two three four five six seven eight','one two six seven eight'],['a b c d e f g h i j','a x y z e f g h i j'],
      ['Shakespeare reveals ambition corrupts','Shakespear reveals ambitoin corrupts'],['He said, "Stop now."','he said stop now'],
      ['ambition drives him to murder the king','ambition drives him to murder'],['ambition drives him to murder the king','ambition drives him to murder the king the queen and everyone'],
    ],
    queueVariants:[{name:'default',set:{}},{name:'phrase3',set:{phrase:3}},{name:'phrase6-noessay',set:{phrase:6,essay:false}},{name:'start5',set:{},startG:5}],
  };
};
