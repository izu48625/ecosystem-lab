'use strict';
// Model search is explicitly exploratory. Never interpret its winning model as a validated improvement.
const fs=require('node:fs'),assert=require('node:assert/strict');
const MODELS=['baseline','express','survivor','hybrid','hybridStrong'];
const ARMS=['evolve','clone','random'],DAYS=[0,30,60,100],SHARDS=[0,5,10,15];
function load(model){
 const samples=[];
 for(const n of SHARDS){
  const d=JSON.parse(fs.readFileSync('reports/selection-exploration/'+model+'/shard-'+n+'.json','utf8'));
  assert.equal(d.selectionModel,model);assert.equal(d.count,5);
  assert.equal(d.samplePerCheckpoint,10);
  samples.push(...d.samples);
 }
 samples.sort((a,b)=>a.seed-b.seed);
 assert.equal(samples.length,20);
 assert.equal(new Set(samples.map(s=>s.seed)).size,20);
 for(let i=0;i<20;i++)assert.equal(samples[i].seed,20350001+i);
 return samples;
}
const data=Object.fromEntries(MODELS.map(m=>[m,load(m)]));
const mean=(arr,fun)=>arr.reduce((a,v)=>a+fun(v),0)/arr.length;
const summary={};
for(const model of MODELS){
 const items=data[model],time=day=>Object.fromEntries(ARMS.map(a=>[a,{
   n:items.filter(s=>s[a].checkpoints[day].sampled>0).length,
   noHitPct:mean(items.filter(s=>s[a].checkpoints[day].sampled>0),s=>s[a].checkpoints[day].meanNoHitPct),
   timeToHit:mean(items.filter(s=>s[a].checkpoints[day].sampled>0),s=>s[a].checkpoints[day].meanTimeToHit)
 }]));
 const D0=time(0),D30=time(30),D60=time(60),D100=time(100);
 const modelAlive=items.filter(x=>x.evolve.finalGreen>0).length;
 const byGen={
   founder:D0.evolve.noHitPct,
   d30:D30.evolve.noHitPct,d60:D60.evolve.noHitPct,d100:D100.evolve.noHitPct,
   clone100:D100.clone.noHitPct,random100:D100.random.noHitPct
 };
 const changes={
  evolvedVsFounder:byGen.d100-byGen.founder,
  mutatedVsClone:byGen.d100-byGen.clone100,
  inheritedVsRandom:byGen.d100-byGen.random100
 };
 summary[model]={
  modelAlive,meanFinalGreen:mean(items,s=>s.evolve.finalGreen),
  meanHunted:mean(items,s=>s.evolve.hunted),
  meanStarved:mean(items,s=>s.evolve.starved),
  day0:D0,day30:D30,day60:D60,day100:D100,changes
 };
}
const base=summary.baseline;
const candidates=MODELS.filter(m=>m!=='baseline').map(model=>({
 model,...summary[model].changes,
 greenSurvival:summary[model].modelAlive,
 meanFinalGreen:summary[model].meanFinalGreen,
 relativeGreen:summary[model].meanFinalGreen/base.meanFinalGreen,
 relativeHunted:summary[model].meanHunted/base.meanHunted
}));
// Predeclared exploratory screen, set before examining the result.
const rank=x=> x.evolvedVsFounder+Math.max(-10,x.mutatedVsClone)*.8+
 Math.max(-10,x.inheritedVsRandom)*.8+Math.min(10,Math.log(Math.max(.01,x.relativeGreen))*8);
const eligible=candidates.filter(x=>x.relativeGreen>=.80&&x.greenSurvival>=base.modelAlive-3&&
 x.evolvedVsFounder>=2&&x.inheritedVsRandom>=1);
const selected=eligible.length?
  [...eligible].sort((a,b)=>rank(b)-rank(a))[0]:
  [...candidates].sort((a,b)=>rank(b)-rank(a))[0];
const results={
 title:'AI1 selection-pressure exploratory model comparison',
 date:'2026-11-19',seedRange:'20350001..20350020',independentWorldsPerModel:20,
 definition:'Selection model reward is deliberate fitness shaping after real red-chase escape; expressed-neural models magnify inherited genome effects. All cases keep red rules and green speed, HP and intake limits unchanged.',
 selectionRule:'Eligibility for candidate preference: mean terminal green >=0.8x baseline, green species persistence >=baseline-3/20, gained >=2 pp vs founders, and >1 pp vs no parent-child inheritance. Rank fallback if none passes; fallback is diagnostic, not endorsed.',
 summary,candidates,eligible:eligible.map(c=>c.model),selected:selected.model,
 isEligible:eligible.some(x=>x.model===selected.model),
 caution:'Exploration scores alone NEVER qualify a model for deployment. Confirm on fresh unseen independent 100-world seeds with matched control and common-garden assay.'
};
fs.mkdirSync('reports/selection-exploration-summary',{recursive:true});
fs.writeFileSync('reports/selection-exploration-summary/summary.json',JSON.stringify(results,null,2));
console.log('SELECTION_DISCOVERY_BEGIN');console.log(JSON.stringify(results));console.log('SELECTION_DISCOVERY_END');
