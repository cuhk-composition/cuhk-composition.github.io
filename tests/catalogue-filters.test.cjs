const {test} = require('node:test');
const assert = require('node:assert/strict');
const {voiceMatches, instruments, minutes, matches} = require('../scripts/catalogue-filters.js');
const base = {voice:[],instrument:[],composer:[],score:false,min:0,max:10};
test('alternative voices match each option without confusing mezzo with soprano', () => {
 assert.equal(voiceMatches('mezzo soprano/baritone','soprano'),false);
 assert.equal(voiceMatches('mezzo soprano/baritone','mezzo'),true);
 assert.equal(voiceMatches('soprano + tenor','tenor'),true);
 assert.equal(voiceMatches('contralto','alto'),true);
 assert.equal(voiceMatches('baritone/bass','bass'),true);
});
test('instrument options preserve named ensembles and normalize case', () => {
 assert.deepEqual(instruments('Piano/harp'),['piano','harp']);
 assert.deepEqual(instruments('string quartet (2 violins, viola, cello)'),['string quartet (2 violins, viola, cello)']);
});
test('minute labels, unknown durations and 10+ preserve catalogue entries', () => {
 assert.equal(minutes('4 mins'),4); assert.equal(minutes('4.5 min'),4.5); assert.equal(minutes(''),null);
 assert.equal(matches({Duration:'45 min'},base),true);
 assert.equal(matches({Duration:'45 min'},{...base,max:6}),false);
 assert.equal(matches({Duration:''},{...base,max:6}),true);
});
test('categories intersect, choices within a category combine, source records stay unchanged', () => {
 const row = {'Voice Type':'soprano/tenor','Instrument(s)':'piano/harp','Composer (C)':'陳啟揚','Composer (E)':'Chan Kai-Young','Perusal Score':'https://example.org/score',Duration:'3 min'};
 const before = JSON.stringify(row);
 assert.equal(matches(row,{...base,voice:['bass','tenor'],instrument:['harp'],composer:['陳啟揚\u0000Chan Kai-Young'],score:true}),true);
 assert.equal(matches(row,{...base,instrument:['percussion']}),false);
 assert.equal(matches({...row,'Perusal Score':''},{...base,score:true}),false);
 assert.equal(JSON.stringify(row),before);
});
