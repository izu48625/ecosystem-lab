'use strict';
/* Reproducible paired 100-day comparison of Normal and AI① neuroevolution.
   Called as: node tests/escape-study-100.js <seed_offset> <count>
   Core engine and red predator rules are not modified.
*/
const assert=require('node:assert/strict');
const {Lab,SPECIES}=require('../src/sim-core.js');
const offset=Math.floor(Number(process.argv[2]||0)),count=Math.floor(Number(process.argv[3]||25));
assert.ok(offset>=0&&count>=1&&count<=100);
const baseline={green:100,red:20,blue:0,regrowth:100,variance:10,duration:100};
const samples=[];
function metrics(lab){
  const h=lab.history,n=lab.counts(),s=lab.stats,ai=s.ai;
  const first=(species)=>{const r=h.find(x=>x.day>0&&x[species]===0);return r?r.day:null};
  return {
    green:n.g,red:n.r,
    greenExtinctionDay:first('g'),redExtinctionDay:first('r'),
    bothAlive:n.g>0&&n.r>0,
    greenBirths:s.births.g,redBirths:s.births.r,
    greenHunted:s.deaths.g.hunt,greenStarved:s.deaths.g.starve,
    redStarved:s.deaths.r.starve,redAgeDeaths:s.deaths.r.age,
    redKills:s.kills.r,redHuntStarts:s.hunts.r,
    peakGreen:Math.max(...h.map(x=>x.g)),peakRed:Math.max(...h.map(x=>x.r)),
    generationPeak:Math.max(...h.map(x=>x.aiMeanGeneration||0)),
    maxGeneration:ai.highestGeneration,neuralOffspring:ai.offspring,
    mutatedOffspring:ai.mutatedOffspring,
    fleeRate:ai.threatDays>0?Number((ai.fleeDays/ai.threatDays).toFixed(5)):null
  };
}
for(let i=0;i<count;i++){
  const seed=20261117+offset+i,normal=new Lab({...baseline,seed,mode:'normal'}),ai=new Lab({...baseline,seed,mode:'escape'});
  const normalRed=normal.entities.filter(x=>x.type==='r');
  const aiRed=ai.entities.filter(x=>x.type==='r');
  assert.equal(normalRed.length,aiRed.length);
  for(let j=0;j<normalRed.length;j++){
    assert.equal(normalRed[j].x,aiRed[j].x,'initial red x mismatch');
    assert.equal(normalRed[j].y,aiRed[j].y,'initial red y mismatch');
  }
  normal.run(100,.08);
  ai.run(100,.08);
  assert.equal(normal.day,100);assert.equal(ai.day,100);
  samples.push({seed,normal:metrics(normal),escape:metrics(ai)});
}
console.log('ESCAPE_100_STUDY_START');
console.log(JSON.stringify({seedOffset:offset,seeds:count,baseline,redFixedRule:SPECIES.r,samples}));
console.log('ESCAPE_100_STUDY_END');
