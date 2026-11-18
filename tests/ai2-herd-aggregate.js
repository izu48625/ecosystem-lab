'use strict';
/* Prespecified AI2 group structure and survival metrics for 100 paired world seeds.
 * No fitted outcome selection; results can show social behaviour fails.
 */
const fs=require('node:fs'),assert=require('node:assert/strict');
const MODES=['normal','ai1','social','socialOff','socialClone','socialNoInheritance'];
const DAYS=[0,30,60,100],STARTS=[0,10,20,30,40,50,60,70,80,90];
const samples=[];
for(const offset of STARTS){
 const d=JSON.parse(fs.readFileSync('reports/ai2-herd-raw/shard-'+offset+'.json','utf8'));
 assert.equal(d.count,10);assert.equal(d.offset,offset);
 samples.push(...d.samples);
}
samples.sort((a,b)=>a.seed-b.seed);
assert.equal(samples.length,100);
assert.equal(new Set(samples.map(x=>x.seed)).size,100);
for(let i=0;i<100;i++)assert.equal(samples[i].seed,20400001+i);
const mean=(list,f)=>list.length?list.reduce((s,x)=>s+f(x),0)/list.length:null;
function grouped(t){return t===null?null:Number(t)}
function sumMode(mode){
 const results=samples.map(x=>x[mode]);
 const checkpoints=Object.fromEntries(DAYS.map(day=>{
  const rows=results.map(x=>x.checkpoints[day]),valid=rows.filter(x=>x.groupPct!==null);
  return [day,{
   greenAlive:rows.filter(x=>x.greenAlive).length,
   coexist:rows.filter(x=>x.coexist).length,
   meanGreen:mean(rows,x=>x.green),meanRed:mean(rows,x=>x.red),
   groupedPct:mean(valid,x=>x.groupPct),
   meanNeighbors:mean(valid,x=>x.meanNeighbors),
   maxLocalGroup:mean(valid,x=>x.maxLocalGroup),
   meanGeneration:mean(valid,x=>x.meanGeneration)
  }];
 }));
 return {
  greenAlive:results.filter(x=>x.greenAlive).length,
  coexist:results.filter(x=>x.coexist).length,
  meanFinalGreen:mean(results,x=>x.green),
  meanFinalRed:mean(results,x=>x.red),
  meanHunted:mean(results,x=>x.hunted),
  meanStarved:mean(results,x=>x.starved),
  meanStarveRate:mean(results,x=>x.starveRate),
  meanGreenBirths:mean(results,x=>x.greenBirths),
  meanMutatedOffspring:mean(results,x=>x.mutatedOffspring),
  checkpoints
 };
}
const modes=Object.fromEntries(MODES.map(m=>[m,sumMode(m)]));
let seed=20261119;function rand(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
function pair(label,arm,control,func){
 const values=samples.map(x=>func(x[arm],x[control]));
 const boot=[];for(let b=0;b<4000;b++){let v=0;for(let i=0;i<values.length;i++)v+=values[Math.floor(rand()*values.length)];boot.push(v/values.length)}
 boot.sort((a,b)=>a-b);
 return {label,pairedMean:mean(values,x=>x),CI95:[boot[100],boot[3900]],
   positive:values.filter(x=>x>0).length,negative:values.filter(x=>x<0).length};
}
const comparisons={
 AI2vsAI1:{
  finalGreen:pair('green headcount on DAY100','social','ai1',(a,b)=>a.green-b.green),
  coexist:pair('both species present on DAY100','social','ai1',(a,b)=>Number(a.coexist)-Number(b.coexist)),
  hunted:pair('cumulative green predation deaths','social','ai1',(a,b)=>a.hunted-b.hunted),
  starvationRate:pair('green starvation per 100 green individual-days','social','ai1',(a,b)=>a.starveRate-b.starveRate)
 },
 socialSteeringEffect:{
  finalGreen:pair('social steering vs no-neighbour steering, final green','social','socialOff',(a,b)=>a.green-b.green),
  groupedPct:pair('social steering vs no-neighbour steering, local group percentage on DAY100','social','socialOff',(a,b)=>a.checkpoints[100].groupPct-b.checkpoints[100].groupPct),
  coexist:pair('social steering vs ablated mode, both species still present','social','socialOff',(a,b)=>Number(a.coexist)-Number(b.coexist))
 },
 hereditaryEffect:{
  finalGreenVsClone:pair('mutation on vs exact-parent inheritance, final green','social','socialClone',(a,b)=>a.green-b.green),
  groupedPctVsClone:pair('mutation on vs mutation off, local groups on DAY100','social','socialClone',(a,b)=>a.checkpoints[100].groupPct-b.checkpoints[100].groupPct),
  groupedPctVsNoInheritance:pair('inheritance+mutation vs random founder genome per child, groups on DAY100','social','socialNoInheritance',(a,b)=>a.checkpoints[100].groupPct-b.checkpoints[100].groupPct)
 },
 generationChange:{
  social:pair('same world DAY100 minus DAY0 observed group percentage','social','social',(a,b)=>a.checkpoints[100].groupPct-b.checkpoints[0].groupPct),
  clone:pair('mutation-off DAY100 minus DAY0 group percentage','socialClone','socialClone',(a,b)=>a.checkpoints[100].groupPct-b.checkpoints[0].groupPct),
  noInheritance:pair('no-inheritance DAY100 minus DAY0 group percentage','socialNoInheritance','socialNoInheritance',(a,b)=>a.checkpoints[100].groupPct-b.checkpoints[0].groupPct)
 }
};
const social= comparisons.socialSteeringEffect.groupedPct;
const evidence={
 anySocialBehaviorEffect:Math.abs(social.pairedMean)>1&&social.CI95[0]*social.CI95[1]>0,
 selectedEvolutionEvidence:comparisons.hereditaryEffect.groupedPctVsNoInheritance.CI95[0]>0&&
   comparisons.generationChange.social.CI95[0]>0&&comparisons.hereditaryEffect.groupedPctVsClone.CI95[0]>0,
 greenSurvivalBenefitOverAI1:comparisons.AI2vsAI1.finalGreen.CI95[0]>0,
 coexistNotDegraded:comparisons.AI2vsAI1.coexist.CI95[0]>=-0.05,
 verdict:''
};
evidence.verdict=evidence.selectedEvolutionEvidence?'grouping_evolution_benefit_detected_review_ecology':
 evidence.anySocialBehaviorEffect?'social_behavior_detected_but_adaptive_evolution_not_proven':
 'no_robust_social_behavior_difference_detected';
const report={
 title:'AI② group behavior and ecology: 100 independently paired 100-day worlds',
 seeds:'20400001..20400100',
 experiments:'green100 red20 blue0 100 days dt.08 ±10% green traits grass regrowth100%',
 modes:{
 normal:'No green neural genomes, normal danger movement',
 ai1:'Existing heritable neural escape-turn / alarm threshold',
 social:'Same 115-weight genome capacity devoted to social cohesion, alignment and crowd separation; fixed wide escape reflex',
 socialOff:'Same social-mode baseline but neighbour steering explicitly disabled',
 socialClone:'Social steering with exact inheritance and no mutation',
 socialNoInheritance:'Social steering but each offspring draws one deterministic genome from same founder pool rather than its parent'
 },
 metricsDefinition:'Group is any green with at least 2 nearby other greens within 65px. Grouped percent is a local-neighbour proxy, not whole-cluster connectivity. No automatic defense/speed/fecundity bonus. Group estimates are influenced by population density, ecology and survivor conditioning.',
 stats:modes,comparisons,evidence,
 limitations:[
  'AI② is heritable neural control with mutation, not proven adaptive group evolution by default.',
  'A high grouping rate may reflect density, resource convergence, or fixed rule offsets; compare socialOff, clone and no-inheritance.',
  'Day100 grouping percentage after extinction equals 0 for a social world; the bootstrap uses all 100 seeds.',
  'Red speed, damage, vision, birth, aging and behavior are unmodified. The use of existing fixed wide escape is disclosed.',
  'Video claims should distinguish genetic change from increasing reproductive fitness.'
 ]
};
fs.mkdirSync('reports/ai2-herd-study',{recursive:true});
fs.writeFileSync('reports/ai2-herd-study/summary.json',JSON.stringify(report,null,2));
fs.writeFileSync('reports/ai2-herd-study/worlds.json',JSON.stringify(samples));
console.log('AI2_AGG_BEGIN');console.log(JSON.stringify({seeds:report.seeds,stats:modes,comparisons,evidence,limitations:report.limitations}));console.log('AI2_AGG_END');
