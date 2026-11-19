'use strict';
/* Prespecified paired world-seed analysis of AI② genotype function.
 * Run on disjoint 100 seeds of 3 inheritance modes, never treat
 * repeated genome/arena observations as independent samples.
 */
const fs=require('node:fs'),assert=require('node:assert/strict');
const BASE=20485001,SEED_COUNT=100,OFFSETS=Array.from({length:20},(_,i)=>i*5);
const DAYS=[0,30,60,100],MODES=['evolve','clone','noninherited'];
const KEYS=['formationGroupPct','formationNear','formationApproachPx','formationAlignment',
  'crowdClosePct','crowdNearestPct','dangerNoHitPct','dangerFirstHitTime','dangerAlivePct','dangerGroupPct','dangerFinalEnergy'];
const samples=[];
for(const offset of OFFSETS){
 const d=JSON.parse(fs.readFileSync('reports/ai2-genome-common-garden-v2-raw/shard-'+offset+'.json','utf8'));
 assert.equal(d.seedBase,BASE);assert.equal(d.offset,offset);assert.equal(d.count,5);
 assert.equal(d.samplePerWorldCheckpoint,8);
 assert.equal(d.daysPerAssay,2.4);
 samples.push(...d.samples);
}
samples.sort((a,b)=>a.seed-b.seed);
assert.equal(samples.length,SEED_COUNT);
assert.equal(new Set(samples.map(x=>x.seed)).size,SEED_COUNT);
for(let i=0;i<SEED_COUNT;i++)assert.equal(samples[i].seed,BASE+i);
const mean=(arr,fn)=>arr.length?arr.reduce((t,x)=>t+fn(x),0)/arr.length:null;
function profile(mode,day){
 const arr=samples.map(s=>s[mode].checkpoints[day]);
 const valid=arr.filter(s=>s.sampled>0);
 return {
  worldsAlive:valid.length,
  sampledGenomes:valid.reduce((sum,x)=>sum+x.sampled,0),
  meanPopulation:mean(arr,x=>x.population),
  meanGeneration:mean(valid,x=>x.meanGeneration),
  ...Object.fromEntries(KEYS.map(k=>[k,mean(valid,x=>x[k])]))
 };
}
const profiles=Object.fromEntries(MODES.map(mode=>[mode,Object.fromEntries(DAYS.map(day=>[day,profile(mode,day)]))]));
let state=0x713e059a;
function rand(){state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296}
function pairs(mode,reference,metric,day=100,referenceDay=100){
 const vals=samples.filter(s=>s[mode].checkpoints[day].sampled>0&&s[reference].checkpoints[referenceDay].sampled>0)
  .map(s=>s[mode].checkpoints[day][metric]-s[reference].checkpoints[referenceDay][metric]);
 if(!vals.length)return {n:0,pairedMean:null,ci95:null,positive:null,negative:null};
 const means=[];
 for(let b=0;b<4000;b++){
  let sum=0;
  for(let i=0;i<vals.length;i++)sum+=vals[Math.floor(rand()*vals.length)];
  means.push(sum/vals.length);
 }
 means.sort((a,b)=>a-b);
 return {n:vals.length,pairedMean:mean(vals,x=>x),ci95:[means[100],means[3900]],
  positive:vals.filter(x=>x>0).length,negative:vals.filter(x=>x<0).length};
}
const comparisons={};
for(const day of [30,60,100]){
 comparisons[day]={
  evolveVsFounder:Object.fromEntries(KEYS.map(k=>[k,pairs('evolve','evolve',k,day,0)])),
  cloneVsFounder:Object.fromEntries(KEYS.map(k=>[k,pairs('clone','clone',k,day,0)])),
  noninheritedVsFounder:Object.fromEntries(KEYS.map(k=>[k,pairs('noninherited','noninherited',k,day,0)])),
  evolveVsClone:Object.fromEntries(KEYS.map(k=>[k,pairs('evolve','clone',k,day,day)])),
  evolveVsNoninherited:Object.fromEntries(KEYS.map(k=>[k,pairs('evolve','noninherited',k,day,day)]))
 };
}
const fullEcology=Object.fromEntries(MODES.map(mode=>[mode,{
 greenSpeciesSurvived:samples.filter(x=>x[mode].greenAlive).length,
 coexist:samples.filter(x=>x[mode].coexist).length,
 meanFinalGreen:mean(samples,x=>x[mode].finalGreen),
 meanFinalRed:mean(samples,x=>x[mode].finalRed),
 meanBirths:mean(samples,x=>x[mode].greenBirths),
 meanPredationDeaths:mean(samples,x=>x[mode].hunted),
 meanStarvationDeaths:mean(samples,x=>x[mode].starved),
 meanMutatedOffspring:mean(samples,x=>x[mode].mutatedOffspring)
}]));
const d=comparisons[100];
const base=d.evolveVsFounder.formationGroupPct,
  inherited=d.evolveVsNoninherited.formationGroupPct,
  mutated=d.evolveVsClone.formationGroupPct,
  preyFitness=d.evolveVsFounder.dangerNoHitPct;
const cmp=(x,threshold)=>x.n>=75&&x.pairedMean>threshold&&x.ci95&&x.ci95[0]>0;
const conclusions={
  standardizedSocialCohesionChange:cmp(base,3),
  parentChildInheritanceAdvantage:cmp(inherited,2),
  addedMutationAdvantage:cmp(mutated,2),
  predatorEncounterImproved:cmp(preyFitness,2),
  socialSkillAdaptationDemonstrated:false,
  verdict:''
};
conclusions.socialSkillAdaptationDemonstrated=conclusions.standardizedSocialCohesionChange&&
 conclusions.parentChildInheritanceAdvantage&&preyFitness.n>=75&&preyFitness.ci95[0]>=-5;
conclusions.verdict=conclusions.socialSkillAdaptationDemonstrated?
  'some_heritable_social_improvement_while_no_serious_predator_cost_detected':
  'adaptive_social_evolution_not_demonstrated';
const report={
 title:'AI② calibrated common-garden assay v2: 100 unseen seeds, standardized social and forced-target predator encounters',
 runDate:'2026-11-19',
 seedRange:[BASE,BASE+SEED_COUNT-1],
 nWorlds:SEED_COUNT,
 days:DAYS,
 samplePerAliveWorldCheckpoint:8,
 fixedCommonGarden:{
  focalGreen:1,referenceGreenPeers:4,
  sixScenes:'3 founder-calibrated grouping trials (fixed peers, initially 75-85px apart), 1 crowd separation scene (fixed peers), 2 moving predator scenes (initial targeting forced on focal, 124-126px), 2.4 days each',
  trialDays:2.4,dt:0.08,body:'fixed green and red physiology, food=.75, initial positions/headings identical per scene',
  intervention:'only the focal neural genome differs by sampled world and stage; the peer genomes and predator initial states are common',
  metrics:'formationGroupPct percentage of focal time with >=2 peers inside 65px, formationApproachPx centroid proximity gained, formationAlignment cos-angle similarity, crowdClosePct time within 20px of any peer, focal predator attack-free rate, first-hit time (censored at 2.4 days), energy'
 },
 modes:{
  evolve:'released AI② neural genomes inherit with mutation as-is',
  clone:'parent neural genome inherited exactly, normal mutation RNG calls consumed',
  noninherited:'offspring assigned a genotype from the same seed founding pool, without parent-child genotype inheritance'
 },
 profiles,
 comparisons,
 fullEcology,
 predefinedThresholds:{
  primary:'formation group participation time improves >3 pp with seed-level CI lower >0 compared with founder and >2 pp with CI lower >0 compared with no parent-child inheritance',
  safety:'no more than 5 pp significant loss in common-garden focal red-predator attack-free probability relative to founders; use first-hit time as complementary outcome',
  mutationClaim:'mutation-specific gain >2pp with CI lower >0 over exact clonal inheritance',
  caution:'No automatic fitness bonus for groups; increased grouping alone does not demonstrate higher evolutionary fitness.'
 },
 conclusions,
 caveats:[
  'Original-world sample at DAY100 conditions on green extinction. A sampled descendant is not a random founder and results may reflect founder drift or survivor biases.',
  'All assay distances were set using only independent seed20472001 DAY0 founder brains. The earlier v1 assay had a severe group formation floor (<1%) and predator no-hit ceiling (100%) and cannot support those claims.',
  'Reference peers are held stationary in formation/crowding tasks to isolate focal genotype effects. This tests behavior in a standardized stimulus, not natural free-ranging herd dynamics.',
  'A genetic effect in a standardized task does not prove higher offspring count, lineage expansion, or long-term predator-prey coexistence.',
  'Across 10 secondary metrics and three timepoints, uncorrected 95% intervals are exploratory. Prespecified primary is standardized focal group participation.',
  'The algorithm is genetic mutation/inheritance in a hand-designed social steering rule, not lifelong RL or a brain that invents new objectives.'
 ]
};
fs.mkdirSync('reports/ai2-genome-common-garden-v2-results',{recursive:true});
fs.writeFileSync('reports/ai2-genome-common-garden-v2-results/summary.json',JSON.stringify(report,null,2));
fs.writeFileSync('reports/ai2-genome-common-garden-v2-results/seed-level.json',JSON.stringify(samples.map(s=>({
 seed:s.seed,
 population:Object.fromEntries(MODES.map(mode=>[mode,{green:s[mode].finalGreen,red:s[mode].finalRed}])),
 days:Object.fromEntries(MODES.map(mode=>[mode,Object.fromEntries(DAYS.map(day=>[day,Object.fromEntries(['population','sampled','meanGeneration',...KEYS].map(k=>[k,s[mode].checkpoints[day][k]]))]))]))
}))));
console.log('AI2_GENOME_AGG_BEGIN');
console.log(JSON.stringify({
 seeds:report.seedRange,n:report.nWorlds,profiles,fullEcology,
 day100:comparisons[100],days30and60:Object.fromEntries([30,60].map(day=>[day,{
  evoFounder:comparisons[day].evolveVsFounder.formationGroupPct,
  evoClone:comparisons[day].evolveVsClone.formationGroupPct,
  evoNonInherited:comparisons[day].evolveVsNoninherited.formationGroupPct
 }])),conclusions,caveats:report.caveats
}));
console.log('AI2_GENOME_AGG_END');
