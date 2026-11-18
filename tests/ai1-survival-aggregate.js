'use strict';
/* Consume 8 deterministic shards. Selection sees discovery only, then evaluate holdout.
 * Run: node tests/ai1-survival-aggregate.js
 */
const assert=require('node:assert/strict'),fs=require('node:fs');
const names=['normal','baseline','alert','multi','wall','combo','budget','adaptive','baselineClone'];
function read(stage){
 const seeds=[];
 for(const offset of [0,25,50,75]){
  const raw=fs.readFileSync('benchmark-shards/'+stage+'-'+offset+'.json','utf8');
  const start=raw.indexOf('CHASE_STUDY_BEGIN'),end=raw.indexOf('CHASE_STUDY_END');
  assert.ok(start>=0&&end>start,'Missing shard result framing: '+stage+'/'+offset);
  const o=JSON.parse(raw.slice(start+'CHASE_STUDY_BEGIN'.length,end).trim());
  assert.equal(o.samples.length,25);
  seeds.push(...o.samples);
 }
 seeds.sort((a,b)=>a.seed-b.seed);
 assert.equal(seeds.length,100);assert.equal(new Set(seeds.map(x=>x.seed)).size,100);
 return seeds;
}
const discovery=read('discovery'),holdout=read('holdout');
assert.ok(Math.max(...discovery.map(x=>x.seed))<Math.min(...holdout.map(x=>x.seed)));
const mean=(a,fn)=>a.reduce((sum,x)=>sum+fn(x),0)/a.length;
function metrics(samples,name){
 const runs=samples.map(x=>x[name]),n=runs.length;
 const sumKey=k=>runs.reduce((a,x)=>a+x[k],0);
 const resolved=sumKey('unhit')+sumKey('hit')+sumKey('diedOther');
 return {
  n,greenAlive:runs.filter(x=>x.greenAlive).length,
  coexist:runs.filter(x=>x.bothAlive).length,
  finalGreen:mean(runs,x=>x.green),
  finalRed:mean(runs,x=>x.red),
  births:mean(runs,x=>x.greenBirths),
  hunted:mean(runs,x=>x.greenHunted),
  starved:mean(runs,x=>x.greenStarved),
  starvationRate:mean(runs,x=>x.greenStarvePer100IndividualDays),
  chaseAttackFreePct:resolved>0?100*sumKey('unhit')/resolved:null,
  chaseSeedMeanPct:mean(runs,x=>x.attackFreePct??0),
  chaseWindows:sumKey('chaseWindows'),
  fleeRate:mean(runs,x=>x.greenThreatDays?x.greenFleeDays/x.greenThreatDays:0),
  highestGeneration:mean(runs,x=>x.maxGeneration)
 };
}
function summary(samples){return Object.fromEntries(names.map(n=>[n,metrics(samples,n)]))}
const first=summary(discovery);
function diff(a,b){return {
  greenAlive:a.greenAlive-b.greenAlive,coexist:a.coexist-b.coexist,
  finalGreenPct:100*(a.finalGreen/b.finalGreen-1),
  huntedPct:100*(a.hunted/b.hunted-1),
  starvationRatePct:100*(a.starvationRate/b.starvationRate-1),
  attackFreePoints:a.chaseAttackFreePct-b.chaseAttackFreePct
}}
const candidates=names.filter(x=>!['normal','baseline','baselineClone'].includes(x)).map(name=>({
 name, ...diff(first[name],first.baseline)
}));
const eligible=candidates.filter(x=>
  x.greenAlive>=-1&&x.coexist>=-2&&x.finalGreenPct>=7&&x.huntedPct<=8&&
  x.starvationRatePct<=5&&x.attackFreePoints>=-.5
).sort((a,b)=>b.finalGreenPct-a.finalGreenPct);
const picked=eligible.length?eligible[0].name:null;
const last=summary(holdout);
let seed=8675309;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
function pairedBootstrap(samples,arm,metric,reference='baseline'){
 const d=samples.map(x=>{
  const a=x[arm],b=x[reference];
  if(metric==='finalGreen')return a.green-b.green;
  if(metric==='starvation')return a.greenStarvePer100IndividualDays-b.greenStarvePer100IndividualDays;
  if(metric==='chase')return (a.attackFreePct??0)-(b.attackFreePct??0);
  if(metric==='hunted')return a.greenHunted-b.greenHunted;
  if(metric==='species')return Number(a.greenAlive)-Number(b.greenAlive);
 });
 const means=[];for(let i=0;i<2500;i++){let sum=0;for(let j=0;j<d.length;j++)sum+=d[Math.floor(random()*d.length)];means.push(sum/d.length);}
 means.sort((a,b)=>a-b);
 return {mean:mean(d,x=>x),CI95:[means[62],means[2437]]};
}
let result=picked?diff(last[picked],last.baseline):null;
let accepted=picked!==null&&
  result.greenAlive>=-1&&result.coexist>=-2&&result.finalGreenPct>=7&&
  result.huntedPct<=8&&result.starvationRatePct<=5&&result.attackFreePoints>=-.5;
const control=diff(last.baseline,last.normal);
const evolution=diff(last.baseline,last.baselineClone);
const report={
 date:'2026-11-19',goals:'Green species persistence, population, predation, starvation, danger response and evolutionary attribution',
 conditions:'100 starting green, 20 red, 0 blue; 100 game-days; dt=.08; seed-paired; same biology and red behavior; 115-weight NN inheritable with 2% and ±0.10 mutation',
 selection:'Only discovery chooses candidate; must improve final mean green >=7%, reduce no-hit rate by <0.5 percentage points, avoid >8% hunted rise, >5% starvation rate rise, species extinction worsening >1/100, coexist worsening >2/100',
 discoverySeedRange:'20270001..20270100',
 holdoutSeedRange:'20281001..20281100',
 discovery:first, comparisons:candidates, eligible:eligible.map(x=>x.name),
 selected:picked??'baseline-no-candidate',
 holdout:last,
 holdoutComparison:result,
 acceptedForDeployment:accepted,
 holdoutVsNormal:control,holdoutEvolutionOnOff:evolution,
 bootstrap:{
  wideVsNormal:{finalGreen:pairedBootstrap(holdout,'baseline','finalGreen','normal')},
  candidate:picked?Object.fromEntries(['finalGreen','starvation','chase','hunted','species'].map(x=>[x,pairedBootstrap(holdout,picked,x)])):null,
  mutationOnOff:{finalGreen:pairedBootstrap(holdout,'baseline','finalGreen','baselineClone')}
 },
 verdict:accepted?'candidate_preset_checks_passed_review_before_deployment':'no_new_candidate_accepted',
 caveats:['Manual escapeStrategy changes must not be called evolution.', 'Conservation and performance depend on stochastic conditions.', 'The no-hit rate pools overlapping chase windows; bootstrap resamples paired independent world seeds rather than windows.','100-day species persistence does not imply an original green founder lived 100 days.']
};
fs.mkdirSync('reports/ai1-survival-output',{recursive:true});
fs.writeFileSync('reports/ai1-survival-output/summary.json',JSON.stringify(report,null,2));
fs.writeFileSync('reports/ai1-survival-output/discovery.json',JSON.stringify(discovery));
fs.writeFileSync('reports/ai1-survival-output/holdout.json',JSON.stringify(holdout));
console.log('AI1_SURVIVAL_BEGIN');console.log(JSON.stringify(report));console.log('AI1_SURVIVAL_END');
