'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const N=Number(process.argv[2]??20),STEP=Number(process.argv[3]??5),BASE=Number(process.argv[4]??20370001);
const STAGE=process.argv[5]??'discovery';
assert.ok([20,100].includes(N)&&[5,10].includes(STEP)&&N%STEP===0);
const ARM=['genetic','clonal','drift'];
const samples=[];
for(let offset=0;offset<N;offset+=STEP){
 const d=JSON.parse(fs.readFileSync('reports/ga-training/shard-'+offset+'.json','utf8'));
 assert.equal(d.offset,offset);assert.equal(d.count,STEP);assert.equal(d.base,BASE);
 samples.push(...d.samples);
}
samples.sort((a,b)=>a.seed-b.seed);
assert.equal(samples.length,N);assert.equal(new Set(samples.map(x=>x.seed)).size,N);
for(let i=0;i<N;i++)assert.equal(samples[i].seed,BASE+i);
function mean(list,fn){return list.reduce((s,x)=>s+fn(x),0)/list.length}
function moments(arm,gen){
 const rec=samples.map(x=>x.arms[arm].history.find(y=>y.generation===gen));
 return {population:N,meanNoHitPct:100*mean(rec,x=>x.meanNoHitPct)/100,
  meanTimeToHit:mean(rec,x=>x.meanTimeToHit),
  meanBestNoHitPct:mean(rec,x=>x.bestNoHitPct)};
}
const profiles=Object.fromEntries(ARM.map(a=>[a,[0,4,8,12].map(g=>({generation:g,...moments(a,g)}))]));
const ecosystem=Object.fromEntries([...ARM,'released'].map(a=>{
 const rec=samples.map(x=>a==='released'?x.released:x.arms[a].ecology);
 return [a,{greenAlive:rec.filter(x=>x.greenAlive).length,coexist:rec.filter(x=>x.greenAlive&&x.redAlive).length,
  meanFinalGreen:mean(rec,x=>x.finalGreen),meanFinalRed:mean(rec,x=>x.finalRed),
  meanHunted:mean(rec,x=>x.greenHunted),meanStarved:mean(rec,x=>x.greenStarved),
  meanBirths:mean(rec,x=>x.births)}]
}));
let bstate=91288039;function rand(){bstate=(Math.imul(bstate,1664525)+1013904223)>>>0;return bstate/4294967296;}
function paired(tag,fn){const d=samples.map(fn),boot=[];for(let i=0;i<3000;i++){let sum=0;for(let k=0;k<d.length;k++)sum+=d[Math.floor(rand()*d.length)];boot.push(sum/d.length)}
 boot.sort((x,y)=>x-y);return {label:tag,n:d.length,mean:mean(d,x=>x),ci95:[boot[75],boot[2925]],positive:d.filter(x=>x>0).length};
}
const last=(sample,a)=>sample.arms[a].history.at(-1).meanNoHitPct;
const first=(sample,a)=>sample.arms[a].history[0].meanNoHitPct;
const ci={
 geneticFromFounders:paired('trained genetic vs founding generation',x=>last(x,'genetic')-first(x,'genetic')),
 geneticVersusClonal:paired('recombination+mutation vs selection of founders without variation',x=>last(x,'genetic')-last(x,'clonal')),
 geneticVersusDrift:paired('survival-based genetic selection vs drift with same variation',x=>last(x,'genetic')-last(x,'drift')),
 clonalFromFounders:paired('founder selection only vs original founder pool',x=>last(x,'clonal')-first(x,'clonal')),
 greenEcologyVsReleased:paired('mean terminal green population of trained genetic vs released AI1',x=>x.arms.genetic.ecology.finalGreen-x.released.finalGreen),
 greenEcologyVsUnselected:paired('trained genetic vs genetic drift in 100-day ecology',x=>x.arms.genetic.ecology.finalGreen-x.arms.drift.ecology.finalGreen),
 greenSpeciesVsReleased:paired('100-day green species persistence',x=>Number(x.arms.genetic.ecology.greenAlive)-Number(x.released.greenAlive)),
 redGreenCoexistVsReleased:paired('red-green coexistence change',x=>
  Number(x.arms.genetic.ecology.greenAlive&&x.arms.genetic.ecology.redAlive)-
  Number(x.released.greenAlive&&x.released.redAlive))
};
const trainingVerified=ci.geneticFromFounders.ci95[0]>0&&ci.geneticVersusDrift.ci95[0]>0;
const variationAddedBenefit=ci.geneticVersusClonal.ci95[0]>0;
const ecologicalSafety=ecosystem.genetic.greenAlive>=ecosystem.released.greenAlive-(N===100?3:1)&&
 ecosystem.genetic.coexist>=ecosystem.released.coexist-(N===100?5:1)&&
 ecosystem.genetic.meanFinalGreen>=ecosystem.released.meanFinalGreen*.95;
const results={
 title:'Escape-genome artificial selection via actual red predator encounters',
 stage:STAGE,seedRange:[BASE,BASE+N-1],independentSeeds:N,
 design:'30 founder neural genomes, 12 trained genetic generations, 5 varying training encounters/generation, 8 unseen heldout encounters, 2 game-days per encounter; 100-day ecosystem transfer with unchanged green baseline physiology and unchanged red predator rules.',
 controls:'genetic=selection+mutation 4%/weight +/-0.18 + 15% crossover, clonal=selection among founding genotypes with exact clone copy, drift=random mating with same variation and no escape-based selection; all start identical.',
 sourcePaths:['tests/ai1-genetic-training.js','src/sim-core.js'],
 holdoutPrinciple:'Training chase scenarios and held-out evaluation scenarios are generated from separate deterministic seeds. No eval score is used by genetic parent selection. Ecological comparison uses identical world seeds but paths diverge.',
 profiles,ecosystem,bootstrap:ci,
 passedTransferGate:trainingVerified&&ecologicalSafety,
 trainingVerified,variationAddedBenefit,ecologicalSafety,
 decision:!trainingVerified?'no_robust_generalizable_genetic_training_evidence':
  !ecologicalSafety?'training_improved_escape_but_not_ecosystem_survival':
  'genetic_training_passed_training_and_ecology_screen_still_experimental',
 caveats:[
  'This is deliberate artificial selection by a genetic algorithm, not unguided natural selection in the ecology.',
  'The genetically trained brains control only alarm and steering, not perception or mobility stats. Stronger genome expression is manually programmed.',
  'Crossovers and mutations are combined in genetic arm: contrast to clonal arm does not isolate mutation from recombination.',
  'Each seed/world is independent; within-seed genomes and chase scenes are correlated. CI uses paired world-level bootstrap.',
  'No arena is a proof of long-term ecosystems or biologically realistic adaptation.'
 ]
};
const dest='reports/ga-training-summary/'+STAGE;
fs.mkdirSync(dest,{recursive:true});
fs.writeFileSync(dest+'/summary.json',JSON.stringify(results,null,2));
fs.writeFileSync(dest+'/world-level.json',JSON.stringify(samples.map(x=>({
 seed:x.seed,
 heldout:Object.fromEntries(ARM.map(a=>[a,x.arms[a].history.map(s=>({generation:s.generation,noHitPct:s.meanNoHitPct,time:s.meanTimeToHit}))])),
 ecology:Object.fromEntries([...ARM,'released'].map(a=>[a,a==='released'?x.released:x.arms[a].ecology]))
})),null,2));
console.log('GENETIC_AGGREGATE_BEGIN');
console.log(JSON.stringify({stage:STAGE,seedRange:results.seedRange,profiles,ecosystem,bootstrap:ci,trainingVerified,variationAddedBenefit,ecologicalSafety,decision:results.decision}));
console.log('GENETIC_AGGREGATE_END');
