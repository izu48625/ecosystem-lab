'use strict';
/*
 * Predeclared analysis of common-garden AI1 genome experiments.
 * Seed/world, not genome/trial, is the independent bootstrap unit.
 */
const assert=require('node:assert/strict'),fs=require('node:fs');
const MODES=['evolve','clone','random'],DAYS=[0,30,60,100];
const SHARDS=Array.from({length:10},(_,i)=>i*10);
const seeds=[];
for(const start of SHARDS){
 const path='reports/ai1-evolution-output-v2/shard-'+start+'.json';
 const doc=JSON.parse(fs.readFileSync(path,'utf8'));
 assert.equal(doc.offset,start);
 assert.equal(doc.count,10);
 assert.equal(doc.days.join(','),DAYS.join(','));
 assert.equal(doc.samplePerCheckpoint,14);
 assert.equal(doc.arenas.length,8);
 seeds.push(...doc.samples);
}
seeds.sort((a,b)=>a.seed-b.seed);
assert.equal(seeds.length,100);
assert.equal(new Set(seeds.map(a=>a.seed)).size,100);
for(let i=0;i<100;i++)assert.equal(seeds[i].seed,20335001+i);
const average=(arr,fn)=>arr.length?arr.reduce((sum,a)=>sum+fn(a),0)/arr.length:null;
const scalar=(seed,mode,day,key)=>seed[mode].checkpoints[day][key];
function summarize(mode,day){
 const snapshots=seeds.map(s=>s[mode].checkpoints[day]);
 const valid=snapshots.filter(s=>s.sampled>0);
 return {
  worldSeeds:seeds.length,worldsAlive:valid.length,extinct:seeds.length-valid.length,
  sampledGenomes:valid.reduce((t,s)=>t+s.sampled,0),
  meanPopulation:average(snapshots,x=>x.alivePopulation),
  meanGeneration:average(valid,x=>x.meanGeneration),
  meanNoHitPct:average(valid,x=>x.meanNoHitPct),
  meanTimeToHit:average(valid,x=>x.meanTimeToHit),
  meanSurvivedPct:average(valid,x=>x.meanSurvivedPct),
  brainUrge:average(valid,x=>x.brainUrge),
  brainTurn:average(valid,x=>x.brainTurn),
  byArena:Object.fromEntries(Object.keys(valid[0]?.byArena??{}).map(a=>[
   a,{meanNoHitPct:average(valid,x=>x.byArena[a].noHitPct),
      meanTimeToHit:average(valid,x=>x.byArena[a].meanTime)}]))
 };
}
function pairs(config){
 const {mode,control,day=100,referenceDay=day,key='meanNoHitPct'}=config;
 return seeds.filter(s=>scalar(s,mode,day,'sampled')&&scalar(s,control,referenceDay,'sampled'))
  .map(s=>({
   seed:s.seed,
   change:scalar(s,mode,day,key)-scalar(s,control,referenceDay,key),
   treatment:scalar(s,mode,day,key),control:scalar(s,control,referenceDay,key)
  }));
}
function bootstrap(p){
 let state=0x831aefb7;const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
 const vals=p.map(x=>x.change);
 if(!vals.length)return {n:0,mean:null,CI95:null,positive:null};
 const avg=average(vals,x=>x);
 const dist=[];
 for(let i=0;i<4000;i++){
  let sum=0;
  for(let j=0;j<vals.length;j++)sum+=vals[Math.floor(rand()*vals.length)];
  dist.push(sum/vals.length);
 }
 dist.sort((a,b)=>a-b);
 return {n:vals.length,mean:avg,CI95:[dist[100],dist[3900]],
  positive:vals.filter(v=>v>0).length,
  negative:vals.filter(v=>v<0).length,
  unchanged:vals.filter(v=>v===0).length};
}
const profiles=Object.fromEntries(MODES.map(mode=>[mode,Object.fromEntries(DAYS.map(day=>[day,summarize(mode,day)]))]));
const differences={};
for(const day of [30,60,100]){
 differences[day]={
  evolutionVsFounder:bootstrap(pairs({mode:'evolve',control:'evolve',day,referenceDay:0})),
  clonalVsFounder:bootstrap(pairs({mode:'clone',control:'clone',day,referenceDay:0})),
  randomVsFounder:bootstrap(pairs({mode:'random',control:'random',day,referenceDay:0})),
  evolutionVsClonal:bootstrap(pairs({mode:'evolve',control:'clone',day})),
  evolutionVsNoninherited:bootstrap(pairs({mode:'evolve',control:'random',day})),
  clonalVsNoninherited:bootstrap(pairs({mode:'clone',control:'random',day})),
  timeEvolutionVsFounder:bootstrap(pairs({mode:'evolve',control:'evolve',day,referenceDay:0,key:'meanTimeToHit'})),
  timeEvolutionVsClonal:bootstrap(pairs({mode:'evolve',control:'clone',day,key:'meanTimeToHit'})),
  timeEvolutionVsNoninherited:bootstrap(pairs({mode:'evolve',control:'random',day,key:'meanTimeToHit'}))
 };
}
const fullWorld=Object.fromEntries(MODES.map(m=>[m,{
 greenSurvived100:seeds.filter(s=>s[m].finalGreen>0).length,
 meanFinalGreen:average(seeds,s=>s[m].finalGreen),
 meanFinalRed:average(seeds,s=>s[m].finalRed),
 meanPredationDeaths:average(seeds,s=>s[m].hunted),
 meanStarvationDeaths:average(seeds,s=>s[m].starved),
 meanOffspring:average(seeds,s=>s[m].births)
}]));
const d=differences[100];
const positive=(x,minimum=0)=>x.n>=75&&x.mean>minimum&&x.CI95&&x.CI95[0]>0;
const decision={
 populationEvolutionEvidence:positive(d.evolutionVsFounder,2),
 inheritanceSelectionEvidence:positive(d.evolutionVsNoninherited,1),
 mutationAddedBenefitEvidence:positive(d.evolutionVsClonal,1),
 conclusion:''
};
if(decision.populationEvolutionEvidence&&decision.inheritanceSelectionEvidence){
 decision.conclusion=decision.mutationAddedBenefitEvidence?
  'common_garden_improvement_with_mutation_advantage':
  'some_common_garden_improvement_without_confirmed_mutation_advantage';
}else{
 decision.conclusion='no_robust_evolutionary_escape_improvement_demonstrated';
}
const report={
 title:'AI① 2-day common-garden no-hit ability at DAY0/30/60/100, pre-calibrated on independent founders',
 date:'2026-11-19',
 methodRevision:'v2. The original 3-day assay had 0.2% founder success and near-zero discrimination; v2 calibrated only with seed20334001 DAY0 founders before any v2 outcome was observed. The 100 v2 seeds are unseen and disjoint.',
 fullWorld:fullWorld,
 scenarios:8,horizonDays:2,genomesSampledPerWorldAndCheckpoint:14,
 modes:MODES,
 profiles,differences,
 predeclaredEvidenceGates:'100 independent world seeds. Paired 95% bootstrap CI lower >0; at least 75 comparable seeds; improvement >2 percentage points vs founders, >1 point vs non-inherited and vs clonal genome for causal claims. Repeated arenas and genomes are dependent within a world seed.',
 decision,
 limitations:[
  'The 2-day arenas were calibrated only on independent DAY0 founders, not the tested descendants. This avoids the insensitive 3-day success-rate floor.',
  'The neural network only changes fleeing urgency and direction; humans supplied wide escape reflex and the environment.',
  'Population at each checkpoint is sampled among surviving green individuals, so later extinction and survivorship can bias day100 comparisons.',
  'No mutation arm still permits selection among inherited founding genomes; no-inheritance arm deliberately disrupts parent-child genome inheritance.',
  'A positive isolated 3-day test would not imply improved multi-generation ecological fitness or real biology.',
  'These are preselected, standardized encounters, not individual lifetimes in the original evolving ecosystem.'
 ]
};
fs.mkdirSync('reports/ai1-evolution-aggregate-v2',{recursive:true});
fs.writeFileSync('reports/ai1-evolution-aggregate-v2/summary.json',JSON.stringify(report,null,2));
fs.writeFileSync('reports/ai1-evolution-aggregate-v2/seed-level.json',JSON.stringify(seeds.map(s=>({
  seed:s.seed,world:Object.fromEntries(MODES.map(m=>[m,{green:s[m].finalGreen,red:s[m].finalRed}])),
  checkpoints:Object.fromEntries(MODES.map(m=>[m,Object.fromEntries(DAYS.map(day=>[day,{
   n:s[m].checkpoints[day].alivePopulation,gen:s[m].checkpoints[day].meanGeneration,
   noHit:s[m].checkpoints[day].meanNoHitPct,time:s[m].checkpoints[day].meanTimeToHit
  }]))]))
}))));
console.log('AI1_EVOLUTION_RESULT_BEGIN');
console.log(JSON.stringify({
  seeds:seeds.length,fullWorld,profiles,day100:d,
  decision,limitations:report.limitations
}));
console.log('AI1_EVOLUTION_RESULT_END');
