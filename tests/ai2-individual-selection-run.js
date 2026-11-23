'use strict';
/* Prospective individual-level selection study, no changes to ecology.
 * Each seed runs AI2 with neural social steering enabled and switched off.
 * The same founders carry the same fixed genotypes / physiques / positions.
 *
 * node tests/ai2-individual-selection-run.js <offset> <count> <baseSeed>
 */
const assert=require('node:assert/strict'),fs=require('node:fs');
const {Lab}=require('../src/sim-core.js');
const offset=Number(process.argv[2]??0),count=Number(process.argv[3]??5);
const base=Number(process.argv[4]??20630001);
assert.ok(Number.isInteger(offset)&&offset>=0&&Number.isInteger(count)&&count>0&&count<=10);
const DAYS=[0,10,20,30,60,100];
const TRAITS=['gather','align','separate'];
const mean=(a,fn)=>a.length?a.reduce((s,x)=>s+fn(x),0)/a.length:null;
const clean=(x)=>Number.isFinite(x)?Number(x.toFixed(6)):null;
function fixedTraits(people){
 return Object.fromEntries(TRAITS.map(t=>[t,clean(mean(people,p=>p.traits[t]))]));
}
function runOne(seed,steer){
 const lab=new Lab({seed,green:100,red:20,blue:0,mode:'social',duration:100,
  socialEnabled:steer,escapePolicy:'wide',regrowth:100,variance:10,socialAudit:true});
 lab.aiLog=function(){};
 const founders=lab.auditPeople.filter(x=>x.generation===0);
 assert.equal(founders.length,100);
 const redStarts=lab.entities.filter(e=>e.type==='r').map(e=>({x:e.x,y:e.y}));
 const founderInitial=founders.map(a=>({
  id:a.id,traits:a.traits,x:a.x0,y:a.y0,energy:a.initialEnergy,
  age:a.initialAge,speed:a.speed,view:a.view,hp:a.maxhp,
  temperament:a.temperament,
  grass:lab.grass[lab.gridIndex(a.x0,a.y0)],
  redInitialDistance:Math.min(...redStarts.map(r=>Math.hypot(a.x0-r.x,a.y0-r.y)))
 }));
 const checkpoints={};
 for(const day of DAYS){
  if(lab.day<day)lab.run(day,.08);
  const alive=lab.auditPeople.filter(a=>a.owner.alive);
  const green=lab.counts().g,red=lab.counts().r;
  const founderAlive=founders.filter(a=>a.owner.alive);
  const visible=alive.map(a=>a.traits);
  const branches=new Set(alive.map(a=>a.rootId));
  checkpoints[day]={
   green,red,founderAlive:founderAlive.length,
   representedFounderFamilies:branches.size,
   meanLivingTraits:Object.fromEntries(TRAITS.map(t=>[t,clean(mean(alive,a=>a.traits[t]))])),
   meanFounderTraits:fixedTraits(founders),
   meanGeneration:clean(mean(alive,a=>a.generation)),
   meanAliveGroupPct:clean(mean(alive.filter(a=>a.lifeDays>0),a=>100*a.groupDays/a.lifeDays)),
   births:lab.stats.births.g,hunted:lab.stats.deaths.g.hunt,starved:lab.stats.deaths.g.starve,
   grass:clean(lab.grassTotal())
  };
  if(day===20)for(const a of founders){
   a.births20=a.owner.children;
   a.survived20=a.owner.alive?1:0;
   a.group20=a.groupDays;
   a.food20=a.foodEnergy;
   a.life20=a.lifeDays;
  }
 }
 const living=lab.auditPeople.filter(a=>a.owner.alive);
 const lineages=new Map(),allDescendants=new Map();
 for(const a of lab.auditPeople){
  if(a.generation>0)allDescendants.set(a.rootId,(allDescendants.get(a.rootId)||0)+1);
 }
 for(const a of living){
  lineages.set(a.rootId,(lineages.get(a.rootId)||0)+1);
 }
 const founderRecords=founders.map((a,i)=>{
  const x=founderInitial[i],exposure=Math.max(.08,a.lifeDays);
  return {
   ...x,
   lifespan:clean(a.lifeDays),births:a.owner.children,
   births20:a.births20,survived20:a.survived20,
   death:a.deathReason||'alive',
   hitCount:a.hitCount,encounterSurvived:a.encounterSurvived,
   foodEnergy:clean(a.foodEnergy),
   foodPerDay:clean(a.foodEnergy/exposure),
   groupPct:clean(100*a.groupDays/exposure),
   neighborsPerDay:clean(a.neighborsDays/exposure),
   redNearPct:clean(100*a.redNearDays/exposure),
   fleePct:clean(100*a.fleeDays/exposure),
   lowEnergyPct:clean(100*a.lowEnergyDays/exposure),
   descendantsBorn:allDescendants.get(a.id)||0,
   descendantsAlive:lineages.get(a.id)||0
  };
 });
 for(const a of founderRecords){assert.ok(Number.isFinite(a.foodPerDay));assert.ok(a.groupPct>=0&&a.groupPct<=100.01)}
 const all=lab.auditPeople;
 return {
  steer,seed,initial:founderInitial,founders:founderRecords,
  checkpoints,
  ecology:{green:lab.counts().g,red:lab.counts().r,
   greenPersistence:lab.counts().g>0,coexist:lab.counts().g>0&&lab.counts().r>0,
   greenBirths:lab.stats.births.g,redBirths:lab.stats.births.r,
   hunted:lab.stats.deaths.g.hunt,starved:lab.stats.deaths.g.starve,
   generations:lab.stats.ai.highestGeneration,
   allGreenBorn:all.length,
   finalFoundingLineages:lineages.size
  }
 };
}
const results=[];
for(let i=0;i<count;i++){
 const seed=base+offset+i;
 const enabled=runOne(seed,true),disabled=runOne(seed,false);
 assert.deepEqual(enabled.initial,disabled.initial,'Founders must share exact innate genes, bodies and surroundings');
 results.push({seed,enabled,disabled});
 console.error('INDIVIDUAL_SELECTION',offset+i+1,'/',offset+count,
  seed,'AI2',enabled.ecology.green+'/'+enabled.ecology.red,
  'no-steer',disabled.ecology.green+'/'+disabled.ecology.red);
}
fs.mkdirSync('reports/ai2-selection-gradient-raw',{recursive:true});
const path='reports/ai2-selection-gradient-raw/shard-'+offset+'.json';
fs.writeFileSync(path,JSON.stringify({
 version:1,seedBase:base,offset,count,days:DAYS,traits:TRAITS,
 metricInfo:'Fixed-genome NN gathering/aligning/separating potentials across four identical inputs; observed grouping uses >=2 neighbors within 65px. Founder mortality, births and food are measured prospectively. Original ecology unchanged; no-steering has same NN founder genomes but ignores social movement.',
 results
}));
console.log('INDIVIDUAL_SELECTION_SHARD_BEGIN');
console.log(JSON.stringify({path,offset,count,first:results[0].seed,last:results.at(-1).seed,
 lastEnabled:results.at(-1).enabled.ecology}));
console.log('INDIVIDUAL_SELECTION_SHARD_END');
