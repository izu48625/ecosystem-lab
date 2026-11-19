'use strict';
/*
 * 2x2 mechanism attribution of AI② advantage.
 * Escape controller: neural (AI①) vs fixed (AI②).
 * Herd steering: absent vs present. 100 independent paired worlds.
 * All genetics, body, red predator, grass, birth, death laws fixed.
 *
 * run: node tests/ai2-survival-factorial-run.js <offset> <count> <seedBase>
 */
const fs=require('node:fs'),assert=require('node:assert/strict');
const {Lab}=require('../src/sim-core.js');
const offset=Number(process.argv[2]??0),count=Number(process.argv[3]??10);
const base=Number(process.argv[4]??20520001);
assert.ok(Number.isInteger(offset)&&offset>=0&&Number.isInteger(count)&&count>0&&count<=10);
const ARM=['neuralSolo','neuralHerd','fixedSolo','fixedHerd'];
const init={green:100,red:20,blue:0,regrowth:100,variance:10,duration:100,escapePolicy:'wide'};
const checkpoints=[0,20,40,60,80,100];
const avg=(a,f)=>a.length?a.reduce((v,x)=>v+f(x),0)/a.length:0;
function world(seed,arm){
 const options={...init,seed,mode:arm==='neuralSolo'?'escape':'social',
  socialEnabled:arm==='neuralHerd'||arm==='fixedHerd',
  socialEscapeNeural:arm==='neuralHerd'};
 const lab=new Lab(options);lab.aiLog=()=>{};
 // Confirm all four initial spatial states/genomes identical for each world seed.
 const initialGreen=lab.entities.filter(e=>e.type==='g').map(e=>({
  id:e.id,x:e.x,y:e.y,g:e.genome.join(','),energy:e.energy,angle:e.angle
 }));
 const result={};
 for(const day of checkpoints){
  if(lab.day<day)lab.run(day,.08);
  const alive=lab.entities.filter(e=>e.alive);
  const green=alive.filter(e=>e.type==='g'),red=alive.filter(e=>e.type==='r');
  const h=lab.history.at(-1);
  result[day]={
   green:green.length,red:red.length,
   greenMeanEnergy:avg(green,e=>e.energy),redMeanEnergy:avg(red,e=>e.energy),
   grass:lab.grassTotal(),
   groupPct:h.ai2GroupedPct??null,
   aiEscapeFleeDays:lab.stats.ai.fleeDays,
   aiEscapeStartDistance:lab.stats.ai.fleeStarts?lab.stats.ai.startDistanceSum/lab.stats.ai.fleeStarts:0,
   greenBirths:lab.stats.births.g,redBirths:lab.stats.births.r,
   greenHunted:lab.stats.deaths.g.hunt,greenStarved:lab.stats.deaths.g.starve,
   redStarved:lab.stats.deaths.r.starve,
   redHunts:lab.stats.hunts.r,redKills:lab.stats.kills.r,
   redStrikes:lab.stats.strikes.r,
   greenIndividualDays:lab.stats.individualDays.g,
   redIndividualDays:lab.stats.individualDays.r
  };
 }
 const end=result[100];
 return {initialGreen,checkpoints:result,
  finalGreen:end.green,finalRed:end.red,
  greenAlive:end.green>0,coexist:end.green>0&&end.red>0,
  greenBirths:end.greenBirths,redBirths:end.redBirths,
  greenHunted:end.greenHunted,greenStarved:end.greenStarved,
  greenStarveRate:100*end.greenStarved/Math.max(1,end.greenIndividualDays),
  redStarved:end.redStarved,redHunts:end.redHunts,redKills:end.redKills,
  redStrikes:end.redStrikes,redAttackPerRedDay:end.redStrikes/Math.max(1,end.redIndividualDays),
  greenHuntPerGreenDay:end.greenHunted/Math.max(1,end.greenIndividualDays),
  aiFleeDays:end.aiEscapeFleeDays,aiFleeStartDistance:end.aiEscapeStartDistance,
  redMeanEnergy:end.redMeanEnergy,greenMeanEnergy:end.greenMeanEnergy,grass:end.grass};
}
const samples=[];
for(let i=0;i<count;i++){
 const seed=base+offset+i,row={seed};
 for(const a of ARM)row[a]=world(seed,a);
 const z=row.neuralSolo.initialGreen;
 for(const a of ARM.slice(1))assert.deepEqual(row[a].initialGreen,z,'All 4 models must share exactly same founder positions, energy and NN genomes');
 for(const a of ARM)delete row[a].initialGreen;
 samples.push(row);
 console.error('AI2 FACTORIAL',offset+i+1,'/',offset+count,'seed',seed,ARM.map(a=>a+':'+row[a].finalGreen+'g/'+row[a].finalRed+'r').join(' '));
}
fs.mkdirSync('reports/ai2-survival-factorial-raw',{recursive:true});
const path='reports/ai2-survival-factorial-raw/shard-'+offset+'.json';
fs.writeFileSync(path,JSON.stringify({offset,count,seedBase:base,arms:ARM,init,checkpoints,samples,
 description:'Four same-seed 100-day worlds: neural/fixed threat response x social steering off/on. The social NN uses the same inherited weights as neural escape if both switches are on; this interaction is intentional and must be disclosed.'}));
console.log('AI2_FACTORIAL_SHARD_BEGIN');console.log(JSON.stringify({offset,count,first:samples[0].seed,last:samples.at(-1).seed,path}));console.log('AI2_FACTORIAL_SHARD_END');
