'use strict';
/* Paired world-seed bootstrap: predeclared 2x2 causal contrasts.
 * 100 worlds, four mechanisms identical initial founder state.
 */
const fs=require('node:fs'),assert=require('node:assert/strict');
const ARM=['neuralSolo','neuralHerd','fixedSolo','fixedHerd'],OFFSETS=[0,10,20,30,40,50,60,70,80,90];
const DAYS=[0,20,40,60,80,100],BASE=20520001;
const samples=[];
for(const off of OFFSETS){
 const d=JSON.parse(fs.readFileSync('reports/ai2-survival-factorial-raw/shard-'+off+'.json','utf8'));
 assert.equal(d.offset,off);assert.equal(d.count,10);assert.equal(d.seedBase,BASE);
 samples.push(...d.samples);
}
samples.sort((a,b)=>a.seed-b.seed);
assert.equal(samples.length,100);assert.equal(new Set(samples.map(s=>s.seed)).size,100);
for(let i=0;i<100;i++)assert.equal(samples[i].seed,BASE+i);
// Derived per-individual-time rates and exhaustive prey demography. These use
// previously saved shard stats; no physics is rerun or intervention changed.
for(const row of samples)for(const arm of ARM){
 const p=row[arm],last=p.checkpoints[100];
 const greendays=Math.max(1,last.greenIndividualDays),reddays=Math.max(1,last.redIndividualDays);
 p.greenBirthsPer100GreenDays=100*p.greenBirths/greendays;
 p.redBirthsPer100RedDays=100*p.redBirths/reddays;
 p.redHuntsPer100RedDays=100*p.redHunts/reddays;
 p.redKillsPer100RedDays=100*p.redKills/reddays;
 p.redKillPerHuntPct=p.redHunts?100*p.redKills/p.redHunts:0;
 p.greenOtherDeaths=100+p.greenBirths-p.greenHunted-p.greenStarved-p.finalGreen;
 assert.ok(p.greenOtherDeaths>=-0.0001,'Demography mismatch');
}

const mean=(v,f)=>v.reduce((x,a)=>x+f(a),0)/v.length;
const METRICS=['finalGreen','finalRed','greenBirths','redBirths','greenHunted','greenStarved','greenStarveRate','redStarved','redHunts','redKills','redStrikes','redAttackPerRedDay','greenHuntPerGreenDay','greenBirthsPer100GreenDays','redBirthsPer100RedDays','redHuntsPer100RedDays','redKillsPer100RedDays','redKillPerHuntPct','greenOtherDeaths','aiFleeDays','aiFleeStartDistance','redMeanEnergy','greenMeanEnergy','grass'];
const profile=Object.fromEntries(ARM.map(arm=>[arm,{
 ...Object.fromEntries(METRICS.map(k=>[k,mean(samples,s=>s[arm][k])])),
 greenAlive:samples.filter(s=>s[arm].greenAlive).length,
 coexist:samples.filter(s=>s[arm].coexist).length,
 checkpoints:Object.fromEntries(DAYS.map(day=>[day,{
  green:mean(samples,s=>s[arm].checkpoints[day].green),
  red:mean(samples,s=>s[arm].checkpoints[day].red),
  greenMeanEnergy:mean(samples,s=>s[arm].checkpoints[day].greenMeanEnergy),
  redMeanEnergy:mean(samples,s=>s[arm].checkpoints[day].redMeanEnergy),
  grass:mean(samples,s=>s[arm].checkpoints[day].grass),
  greenBirths:mean(samples,s=>s[arm].checkpoints[day].greenBirths),
  greenHunted:mean(samples,s=>s[arm].checkpoints[day].greenHunted),
  redBirths:mean(samples,s=>s[arm].checkpoints[day].redBirths),
  redStrikes:mean(samples,s=>s[arm].checkpoints[day].redStrikes)
 }]))
}]));
let randState=0xf7ac2121;
const rand=()=>{randState=(Math.imul(randState,1664525)+1013904223)>>>0;return randState/4294967296};
const diff={
 rawDifference:s=>(s.fixedHerd-s.neuralSolo),
 fixedEffectNoHerd:s=>(s.fixedSolo-s.neuralSolo),
 fixedEffectWithHerd:s=>(s.fixedHerd-s.neuralHerd),
 herdEffectWithNeuralEscape:s=>(s.neuralHerd-s.neuralSolo),
 herdEffectWithFixedEscape:s=>(s.fixedHerd-s.fixedSolo),
 interaction:s=>(s.fixedHerd-s.fixedSolo)-(s.neuralHerd-s.neuralSolo),
 // Order-invariant two-factor Shapley attribution, sums to AI2 - AI1 by seed.
 escapeShapley:s=>((s.fixedSolo-s.neuralSolo)+(s.fixedHerd-s.neuralHerd))/2,
 herdShapley:s=>((s.neuralHerd-s.neuralSolo)+(s.fixedHerd-s.fixedSolo))/2
};
function pairedBootstrap(metric,transform){
 const vals=samples.map(s=>transform(Object.fromEntries(ARM.map(a=>[a,s[a][metric]]))));
 const boot=[];
 for(let i=0;i<5000;i++){
  let total=0;for(let j=0;j<vals.length;j++)total+=vals[Math.floor(rand()*vals.length)];
  boot.push(total/vals.length);
 }
 boot.sort((a,b)=>a-b);
 return {mean:mean(vals,x=>x),ci95:[boot[125],boot[4875]],positive:vals.filter(x=>x>0).length,negative:vals.filter(x=>x<0).length};
}
const comparisons=Object.fromEntries(METRICS.concat(['coexist','greenAlive']).map(metric=>[metric,Object.fromEntries(Object.entries(diff).map(([name,fn])=>[name,pairedBootstrap(metric,s=>fn(s))]))]));
// Preserve no binaries in non-GA comparisons: each seed is a paired quadruplet.
for(const metric of ['coexist','greenAlive']){
 const p=comparisons[metric];
 // A boolean subtraction is well-defined, but raw selectors must be number.
}
const group= comparisons.finalGreen;
assert.ok(Math.abs(group.escapeShapley.mean+group.herdShapley.mean-group.rawDifference.mean)<1e-7);
const screening={
 escapeDominant:group.escapeShapley.mean>group.herdShapley.mean,
 bothAffectSurvival:group.escapeShapley.ci95[0]>0&&group.herdShapley.ci95[0]>0,
 redCoexistChange:comparisons.coexist.rawDifference.mean,
 outcome:''
};
screening.outcome=!screening.bothAffectSurvival?
  'cannot_confidently_assign_positive_survival_to_both_mechanisms':
  'both_escape_and_social_contribute_to_final_green_in_this_model';
const report={
 title:'AI2 survival advantage mechanism: paired 100-world two-factor intervention and demographic accounting',
 seeds:[BASE,BASE+99],n:100,days:DAYS,initial:{green:100,red:20,blue:0,grassRegrowth:100,variance:10},
 arms:{
 neuralSolo:'Released AI1: neural network controls escape, no social steering',
 neuralHerd:'Neural escape and heritable social steering, sharing the same genome/115 weights',
 fixedSolo:'Released AI2 fixed wide escape but neighbour steering off (socialEnabled=false)',
 fixedHerd:'Released AI2 fixed wide escape plus neighbour social steering'
 },
 decomposition:'Fixed escape Shapley = 0.5 * [(fixedSolo-neuralSolo)+(fixedHerd-neuralHerd)]; Herd Shapley = 0.5 * [(neuralHerd-neuralSolo)+(fixedHerd-fixedSolo)]. Additive decomposition of final AI2-AI1 contrast across intervention orders; valid only within these four implemented conditions. It is not an intrinsic, universal % of animal intelligence.',
 demographics:'green100+births−predationDeaths−starvationDeaths−otherDeaths=finalGreen; otherDeaths includes aging and defense. Rates divide events by individual-days, rather than by terminal population.',
 interpretation:[
  'All four conditions share identical founder genes, body stats, positions and seeds. Red predators, grass regrowth, aging and reproduction code are unchanged.',
  'Neural escape+social steering reuses the same 115 weights for both decisions, which may interfere; it is a real crossed intervention but not independently trained dual-brain genotype.',
  'Changes in red attacks, prey births and red reproduction are mediators/consequences of the green movement policies, not independently randomized factors. Do not present them as proven separate causes.',
  'AI2 vs AI1 differences are not evidence of evolved improvement over generations, as common-garden transfer showed no beneficial social genomic change.',
  '100-day endpoint is a dynamic predator-prey equilibrium, subject to different population densities and eventual red extinction. More green does not equal balanced ecology.',
  'CIs use independent paired ecosystem seeds, not individual animals; subgroup and mediator findings are exploratory.'
 ],
 profile,comparisons,screening
};
fs.mkdirSync('reports/ai2-survival-factorial-summary',{recursive:true});
fs.writeFileSync('reports/ai2-survival-factorial-summary/summary.json',JSON.stringify(report,null,2));
fs.writeFileSync('reports/ai2-survival-factorial-summary/seed-level.json',JSON.stringify(samples.map(s=>({
 seed:s.seed,...Object.fromEntries(ARM.map(a=>[a,{...s[a],checkpoints:s[a].checkpoints}]))
}))));
console.log('AI2_SURVIVAL_CAUSAL_RESULT_BEGIN');
console.log(JSON.stringify({seeds:report.seeds,profile,comparisons,screening}));
console.log('AI2_SURVIVAL_CAUSAL_RESULT_END');
