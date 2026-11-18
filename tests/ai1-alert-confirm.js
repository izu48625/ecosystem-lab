'use strict';
/* Third untouched 100-seed validation, green-first acceptance gates defined before running.
 * Data set disjoint from discovery 20270001..100 and holdout 20281001..100.
 * Use existing paired engine and red-target observation.
 */
const fs=require('node:fs'),assert=require('node:assert/strict');
const arms=['normal','baseline','alert','baselineClone','alertClone'];
const offsets=[0,25,50,75];
const samples=[];
for(const offset of offsets){
 const raw=fs.readFileSync('confirmation-shards/seed-'+offset+'.txt','utf8');
 const start=raw.indexOf('CHASE_STUDY_BEGIN'),end=raw.indexOf('CHASE_STUDY_END');
 assert.ok(start>=0&&end>start,'Missing shard framing for '+offset);
 const o=JSON.parse(raw.slice(start+'CHASE_STUDY_BEGIN'.length,end).trim());
 assert.equal(o.samples.length,25);
 samples.push(...o.samples);
}
samples.sort((a,b)=>a.seed-b.seed);
assert.equal(samples.length,100);
assert.equal(new Set(samples.map(a=>a.seed)).size,100);
assert.ok(samples[0].seed>=20292001&&samples.at(-1).seed<=20292100);

function metric(arm){
 const data=samples.map(o=>o[arm]),n=data.length;
 const mean=f=>data.reduce((s,v)=>s+f(v),0)/n;
 const total=k=>data.reduce((s,x)=>s+x[k],0);
 const settled=total('unhit')+total('hit')+total('diedOther');
 return {
  greenAlive:data.filter(x=>x.greenAlive).length,
  coexist:data.filter(x=>x.bothAlive).length,
  greenMean:mean(x=>x.green),
  redMean:mean(x=>x.red),
  huntedMean:mean(x=>x.greenHunted),
  starvedMean:mean(x=>x.greenStarved),
  starvationRate:mean(x=>x.greenStarvePer100IndividualDays),
  attackFreePct:settled>0?100*total('unhit')/settled:0,
  chaseSeedMean:mean(x=>x.attackFreePct??0),
  greenBirths:mean(x=>x.greenBirths),
  maxGeneration:mean(x=>x.maxGeneration)
 };
}
const stats=Object.fromEntries(arms.map(arm=>[arm,metric(arm)]));
const b=stats.baseline,a=stats.alert;
const change={
 greenAlive:a.greenAlive-b.greenAlive,
 coexist:a.coexist-b.coexist,
 greenMeanPct:100*(a.greenMean/b.greenMean-1),
 huntedPct:100*(a.huntedMean/b.huntedMean-1),
 starvationRatePct:100*(a.starvationRate/b.starvationRate-1),
 chasePoints:a.attackFreePct-b.attackFreePct,
 redMeanPct:100*(a.redMean/b.redMean-1)
};
let state=223344;const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
function bootstrap(pair,d){
 const vals=samples.map(x=>d(x[pair],x.baseline));
 const means=[];
 for(let n=0;n<3000;n++){let sum=0;for(let i=0;i<vals.length;i++)sum+=vals[Math.floor(rand()*vals.length)];means.push(sum/vals.length)}
 means.sort((p,q)=>p-q);
 return {pairedMean:vals.reduce((p,q)=>p+q,0)/vals.length,ci95:[means[75],means[2925]]};
}
const ci={
 finalGreen:bootstrap('alert',(a,b)=>a.green-b.green),
 hunted:bootstrap('alert',(a,b)=>a.greenHunted-b.greenHunted),
 starvation:bootstrap('alert',(a,b)=>a.greenStarvePer100IndividualDays-b.greenStarvePer100IndividualDays),
 chaseSeedMean:bootstrap('alert',(a,b)=>(a.attackFreePct??0)-(b.attackFreePct??0)),
 greenSpecies:bootstrap('alert',(a,b)=>Number(a.greenAlive)-Number(b.greenAlive)),
 mutationEffectGreen:bootstrap('alertClone',(clone,b)=>clone.green-b.green),
 mutationEffectNoHit:bootstrap('alertClone',(clone,b)=>(clone.attackFreePct??0)-(b.attackFreePct??0))
};
const presetGates={
 greenMeanPctAtLeast:8,
 greenAliveDeltaAtLeast:0,
 huntedPctAtMost:-10,
 chasePointsAtLeast:1,
 starvationRatePctAtMost:12,
 coexistDeltaAtLeast:-6,
 meanGreenCI95LowerGreaterThanZero:true,
 huntedCI95UpperLessThanZero:true
};
const pass=change.greenMeanPct>=8&&change.greenAlive>=0&&change.huntedPct<=-10&&
 change.chasePoints>=1&&change.starvationRatePct<=12&&change.coexist>=-6&&
 ci.finalGreen.ci95[0]>0&&ci.hunted.ci95[1]<0;
const report={
 study:'AI1 green priority third holdout',basis:'independent prespecified priority change after prior 200 seed experiments; no looking at 20292001..20292100 before setting thresholds',
 seeds:'20292001..20292100', count:100,initial:'green=100 red=20 blue=0 variance=10% regrowth=100% duration=100 days dt=.08',
 statuses:stats,change,bootstrap:ci,presetGates,
 decision:pass?'green_priority_screen_passed_needs_regression_and_ecological_review':'do_not_deploy',
 explanation:'Manual early-warning change and inherited NN evolution are different causes; clone control is included. Founder animals cannot survive 100 days due finite lifetime; species persistence is measured.'
};
fs.mkdirSync('reports/ai1-confirm-output',{recursive:true});
fs.writeFileSync('reports/ai1-confirm-output/summary.json',JSON.stringify(report,null,2));
fs.writeFileSync('reports/ai1-confirm-output/per-seed.json',JSON.stringify(samples));
console.log('AI1_CONFIRM_BEGIN');console.log(JSON.stringify(report));console.log('AI1_CONFIRM_END');
