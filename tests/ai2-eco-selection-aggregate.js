'use strict';
// Pre-registered screening for ecological mating; 20 independent seeds per model.
const fs=require('node:fs'),assert=require('node:assert/strict');
const MODELS=['baseline','ecoMate','ecoMateWide','ecoMateHunger'];
const ARMS=['evolve','clone','noninherited'],DAYS=[0,30,60,100];
const OFFSETS=[0,5,10,15],BASE=20560001;
const GROUP_METRICS=['formationGroupPct','formationApproachPx','formationAlignment','crowdClosePct','dangerNoHitPct','dangerFirstHitTime','dangerFinalEnergy'];
const data={};
for(const model of MODELS){
 const samples=[];
 for(const offset of OFFSETS){
  const d=JSON.parse(fs.readFileSync('reports/ai2-eco-selection-raw/'+model+'/shard-'+offset+'.json','utf8'));
  assert.equal(d.selectionModel,model);assert.equal(d.offset,offset);assert.equal(d.count,5);assert.equal(d.seedBase,BASE);
  samples.push(...d.samples);
 }
 samples.sort((a,b)=>a.seed-b.seed);
 assert.equal(samples.length,20);assert.equal(new Set(samples.map(x=>x.seed)).size,20);
 for(let i=0;i<20;i++)assert.equal(samples[i].seed,BASE+i);
 data[model]=samples;
}
const mean=(a,fn)=>a.length?a.reduce((x,v)=>x+fn(v),0)/a.length:null;
let state=0x20261123;
const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
function bootstrap(rows,fn){
 const deltas=rows.map(fn).filter(v=>Number.isFinite(v));
 if(!deltas.length)return {n:0,mean:null,ci95:null};
 const draws=[];
 for(let j=0;j<4000;j++){
  let total=0;
  for(let i=0;i<deltas.length;i++)total+=deltas[Math.floor(rand()*deltas.length)];
  draws.push(total/deltas.length);
 }
 draws.sort((a,b)=>a-b);
 return {n:deltas.length,mean:mean(deltas,x=>x),ci95:[draws[100],draws[3900]]};
}
function prof(rows,arm,day){
 const vals=rows.map(r=>r[arm].checkpoints[day]),alive=vals.filter(v=>v.sampled>0);
 return {
  nWorldsAlive:alive.length,
  sampledGenomes:alive.reduce((s,x)=>s+x.sampled,0),
  meanGeneration:mean(alive,x=>x.meanGeneration),
  ...Object.fromEntries(GROUP_METRICS.map(k=>[k,mean(alive,x=>x[k])]))
 };
}
const result={date:'2026-11-23',design:'Exploratory only: eco-mate tournament on actually realized foraging, red encounters, existing offspring. No direct group defense/fertility bonus; this is imposed mate preference, not purely spontaneous natural selection.',
seedRange:[BASE,BASE+19],independentWorldsPerModel:20,
models:MODELS,arms:ARMS,profiles:{},ecology:{},contrasts:{}};
for(const model of MODELS){
 const rows=data[model];
 result.profiles[model]=Object.fromEntries(ARMS.map(arm=>[arm,Object.fromEntries(DAYS.map(day=>[day,prof(rows,arm,day)]))]));
 result.ecology[model]=Object.fromEntries(ARMS.map(arm=>[arm,{
  greenAlive:rows.filter(x=>x[arm].greenAlive).length,
  coexist:rows.filter(x=>x[arm].coexist).length,
  meanGreen:mean(rows,x=>x[arm].finalGreen),
  meanRed:mean(rows,x=>x[arm].finalRed),
  meanGreenHunted:mean(rows,x=>x[arm].hunted),
  meanGreenStarved:mean(rows,x=>x[arm].starved),
  meanGreenBirths:mean(rows,x=>x[arm].greenBirths)
 }]));
 const measures={};
 for(const key of GROUP_METRICS){
  const p=(row,arm,day)=>row[arm].checkpoints[day][key];
  measures[key]={
   descendantVsFounder:bootstrap(rows,r=>p(r,'evolve',100)-p(r,'evolve',0)),
   descendantVsClone:bootstrap(rows,r=>p(r,'evolve',100)-p(r,'clone',100)),
   descendantVsNoInheritance:bootstrap(rows,r=>p(r,'evolve',100)-p(r,'noninherited',100))
  };
 }
 result.contrasts[model]=measures;
}
const baseline=result.ecology.baseline.evolve;
result.screening={};
for(const model of MODELS.slice(1)){
 const a=result.contrasts[model].formationGroupPct;
 const crowd=result.contrasts[model].crowdClosePct.descendantVsFounder;
 const danger=result.contrasts[model].dangerNoHitPct.descendantVsFounder;
 const ec=result.ecology[model].evolve;
 const good={genomeImprovement:a.descendantVsFounder.mean>=3&&a.descendantVsFounder.ci95[0]>0,
  betterThanNoninherited:a.descendantVsNoInheritance.mean>=2&&a.descendantVsNoInheritance.ci95[0]>0,
  mutationValue:a.descendantVsClone.mean>=2&&a.descendantVsClone.ci95[0]>0,
  noCrowdingHarm:crowd.mean<=5,
  noPredatorHarm:danger.mean>=-5,
  greenPersistence:ec.greenAlive>=baseline.greenAlive-1,
  speciesCoexistence:ec.coexist>=baseline.coexist-2,
  greenCount:ec.meanGreen>=.85*baseline.meanGreen};
 result.screening[model]={...good,qualifiesForHoldout:good.genomeImprovement&&good.betterThanNoninherited&&good.noCrowdingHarm&&good.noPredatorHarm&&good.greenPersistence&&good.speciesCoexistence&&good.greenCount};
}
result.predefinedDecisionRule='Genotype evolution is credible only if common-garden group participation increases >=3pp vs founders with positive seed bootstrap lower bound, and >=2pp vs non-inherited founder assignment with positive lower bound, without strong crowding, predator avoidance, species coexistence or green population harms. A mutation-specific claim separately requires significance vs recombining-mate mutation-off. Exploratory screening never qualifies for deployment; use unseen 100-seed holdout.';
result.warning='Selection on measured food/encounter/offspring is explicitly researcher-designed mate preference, not spontaneous social natural selection. A raw density increase in the ecology does NOT count as genetic adaptation.';
fs.mkdirSync('reports/ai2-eco-selection-screen',{recursive:true});
fs.writeFileSync('reports/ai2-eco-selection-screen/summary.json',JSON.stringify(result,null,2));
console.log('AI2_ECO_DISCOVERY_BEGIN');
console.log(JSON.stringify({seedRange:result.seedRange,ecology:result.ecology,
profiles:Object.fromEntries(MODELS.map(m=>[m,Object.fromEntries(ARMS.map(a=>[a,Object.fromEntries(DAYS.map(day=>[day,{
group:result.profiles[m][a][day].formationGroupPct,approach:result.profiles[m][a][day].formationApproachPx,
crowd:result.profiles[m][a][day].crowdClosePct,noHit:result.profiles[m][a][day].dangerNoHitPct
}]))]))])),
contrasts:result.contrasts,screening:result.screening}));
console.log('AI2_ECO_DISCOVERY_END');
