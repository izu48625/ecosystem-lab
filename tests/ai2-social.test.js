'use strict';
const assert=require('node:assert/strict');
const {Lab,SPECIES,BRAIN_SIZE}=require('../src/sim-core.js');
const base={seed:20261117,green:100,red:20,blue:0,variance:10,regrowth:100,duration:100};
const normal=new Lab({...base,mode:'normal'});
const ai1=new Lab({...base,mode:'escape'});
const ai2=new Lab({...base,mode:'social'});
const ai2NoGroup=new Lab({...base,mode:'social',socialEnabled:false});
function noLog(l){l.aiLog=function(){};return l}
[normal,ai1,ai2,ai2NoGroup].forEach(noLog);
assert.equal(BRAIN_SIZE,115);
assert.equal(ai2.settings.mode,'social');
assert.equal(ai2.entities.filter(e=>e.type==='g').length,100);
assert.equal(ai2.entities.find(e=>e.type==='g').genome.length,115);
assert.equal(ai2.history[0].ai2GroupedPct>=0,true);
assert.equal(ai2.history[0].ai2GroupedPct<=100,true);
assert.equal(ai2.history[0].aiMeanGeneration,0);
assert.equal(ai1.history[0].ai2GroupedPct,undefined);
assert.equal(normal.history[0].ai2GroupedPct,undefined);
assert.equal(SPECIES.r.speed,1.15);
assert.equal(SPECIES.r.attack,20);
function check(l){
 assert.ok(l.history.length>=101,'Must record all days');
 const d=l.history.find(h=>h.day===100);
 assert.ok(d,'100-day history entry');
 assert.equal(d.g,l.counts().g);
 assert.equal(d.r,l.counts().r);
 assert.ok(l.stats.deaths.g.hunt>=0);
 assert.ok(l.stats.births.g>=0);
}
normal.run(100,.08);ai1.run(100,.08);ai2.run(100,.08);ai2NoGroup.run(100,.08);
[normal,ai1,ai2,ai2NoGroup].forEach(check);
assert.ok(ai2.stats.ai.offspring>0,'Social offspring inherit brains');
assert.ok(ai2.stats.ai.mutatedOffspring>0,'Social offspring undergo mutation');
assert.ok(ai2.stats.ai.highestGeneration>=1,'Social evolution has generations');
const hist=ai2.history.filter(h=>h.day%10===0);
for(const h of hist){
 assert.ok(Number.isFinite(h.ai2GroupedPct));
 assert.ok(h.ai2GroupedPct>=0&&h.ai2GroupedPct<=100);
 assert.ok(h.ai2MaxLocalGroup<=h.g);
 assert.ok(h.ai2MeanNeighbors>=0);
 assert.ok(h.ai2MeanNearest>=0&&h.ai2MeanNearest<=65);
}
const final=ai2.history.at(-1);
assert.ok(ai2.settings.socialEnabled);
assert.equal(ai2NoGroup.settings.socialEnabled,false);
const signature=l=>JSON.stringify({counts:l.counts(),h:l.history.map(x=>[x.g,x.r,x.ai2GroupedPct]),ai:l.stats.ai.mutatedOffspring});
const redo=noLog(new Lab({...base,mode:'social'}));redo.run(100,.08);
assert.equal(signature(ai2),signature(redo),'AI2 must be deterministic when seed fixed');
assert.notEqual(signature(ai2),signature(ai2NoGroup),'Opt-in neighbour steering must change ecology');
assert.equal(ai2NoGroup.stats.ai.mutatedOffspring>0,true,'No-group ablation still inherits genome');
assert.ok(ai2.counts().g<=850&&ai2.counts().r<=850);
console.log('✓ AI② independent social NN, heritable mutation, metrics, reproducibility and no-group ablation');
console.log(JSON.stringify({normal:normal.counts(),ai1:ai1.counts(),ai2:ai2.counts(),
 ai2NoGroup:ai2NoGroup.counts(),day0GroupPct:ai2.history[0].ai2GroupedPct,
 day100GroupPct:final.ai2GroupedPct,day100MeanNeighbors:final.ai2MeanNeighbors,
 meanGeneration:final.aiMeanGeneration,mutatedOffspring:ai2.stats.ai.mutatedOffspring}));
