'use strict';
/* AI① escape mutation parameter sweep, without changing the published model.
 * Match the same 100 seeds across all 5 cases.
 * Usage: node tests/escape-mutation-sweep.js <seed_offset> <count> [seedBase]
 */
const assert=require('node:assert/strict');
const {Lab,SPECIES,BRAIN_SIZE}=require('../src/sim-core.js');
const offset=Number(process.argv[2]??0),count=Number(process.argv[3]??25);
const seedBase=Number(process.argv[4]??20261117);
assert.ok(Number.isInteger(offset)&&offset>=0&&Number.isInteger(count)&&count>=1&&count<=100&&Number.isInteger(seedBase)&&seedBase>=1);
const settings={green:100,red:20,blue:0,regrowth:100,variance:10,duration:100,mode:'escape'};
const cases=[
 {key:'baseline',p:.08,amp:.34},
 {key:'p04_a034',p:.04,amp:.34},
 {key:'p08_a017',p:.08,amp:.17},
 {key:'p04_a017',p:.04,amp:.17},
 {key:'p02_a010',p:.02,amp:.10}
];
function withMutation(lab,c){
  if(c.key==='baseline')return;
  lab.mutateBrain=function(parent){
    let changed=0;
    const child=parent.genome.map(w=>{
      if(this.rnd()<c.p){changed++;return Math.max(-3,Math.min(3,w+(this.rnd()*2-1)*c.amp))}
      return w;
    });
    this.stats.ai.offspring++;
    if(changed)this.stats.ai.mutatedOffspring++;
    this.stats.ai.mutatedGenes+=changed;
    return child;
  };
}
function run(seed,c){
  const lab=new Lab({...settings,seed});
  const firstRed=lab.entities.filter(e=>e.type==='r').map(e=>[e.id,e.x,e.y,e.maxhp,e.speed,e.attack,e.life,e.temperament]);
  const initialGreen=lab.entities.filter(e=>e.type==='g');
  assert.equal(initialGreen.length,settings.green);
  assert.ok(initialGreen.every(e=>e.genome.length===BRAIN_SIZE));
  assert.ok(lab.entities.filter(e=>e.type==='r').every(e=>e.genome===undefined));
  withMutation(lab,c);
  lab.run(100,.08);
  assert.equal(lab.day,100);
  const n=lab.counts(),s=lab.stats,ext=lab.history.find(h=>h.day>0&&h.g===0)?.day??null;
  return {redFounders:firstRed,metrics:{
    green:n.g,red:n.r,greenSurvived:n.g>0,bothSurvived:n.g>0&&n.r>0,greenExtinctDay:ext,
    presenceDays:ext??100,greenBirths:s.births.g,redBirths:s.births.r,
    greenHunted:s.deaths.g.hunt,greenStarved:s.deaths.g.starve,
    redStarved:s.deaths.r.starve,redKills:s.kills.r,
    highestGeneration:s.ai.highestGeneration,brainOffspring:s.ai.offspring,
    mutatedOffspring:s.ai.mutatedOffspring,mutatedGenes:s.ai.mutatedGenes,
    fleePct:s.ai.threatDays>0?Number((100*s.ai.fleeDays/s.ai.threatDays).toFixed(3)):null
  }};
}
const samples=[];
for(let i=0;i<count;i++){
  const seed=seedBase+offset+i;
  const results=cases.map(c=>run(seed,c));
  for(let j=1;j<results.length;j++)assert.deepEqual(results[j].redFounders,results[0].redFounders,'Red initial conditions must be identical');
  samples.push({seed,...Object.fromEntries(results.map((r,j)=>[cases[j].key,r.metrics]))});
}
console.log('MUTATION_SWEEP_START');
console.log(JSON.stringify({offset,count,seedBase,settings,redRules:SPECIES.r,cases,samples}));
console.log('MUTATION_SWEEP_END');
