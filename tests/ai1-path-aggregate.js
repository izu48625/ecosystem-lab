'use strict';
/* AI1 path forage study: 100 discovery paired seeds, 100 disjoint holdout paired seeds.
 * Prior alert-only holdout was rejected; we investigate movement sampling as a new intervention.
 */
const assert=require('node:assert/strict'),fs=require('node:fs');
const arms=['normal','baseline','path2','path3','alert','alertPath2','alertPath3'];
function read(stage){
 const samples=[];
 for(const offset of [0,25,50,75]){
  const raw=fs.readFileSync('path-shards/'+stage+'-'+offset+'.txt','utf8');
  const i=raw.indexOf('CHASE_STUDY_BEGIN'),j=raw.indexOf('CHASE_STUDY_END');
  assert.ok(i>=0&&j>i);
  const data=JSON.parse(raw.slice(i+'CHASE_STUDY_BEGIN'.length,j).trim());
  assert.equal(data.samples.length,25);
  samples.push(...data.samples);
 }
 samples.sort((a,b)=>a.seed-b.seed);
 assert.equal(samples.length,100);
 assert.equal(new Set(samples.map(x=>x.seed)).size,100);
 return samples;
}
const discovery=read('discovery'),holdout=read('holdout');
assert.ok(discovery.at(-1).seed<holdout[0].seed);
function stats(items,arm){
 const arr=items.map(x=>x[arm]),count=arr.length;
 const avg=f=>arr.reduce((s,x)=>s+f(x),0)/count;
 const tot=f=>arr.reduce((s,x)=>s+f(x),0);
 const resolved=tot(x=>x.unhit+x.hit+x.diedOther);
 return {
  greenAlive:arr.filter(x=>x.greenAlive).length,coexist:arr.filter(x=>x.bothAlive).length,
  avgGreen:avg(x=>x.green),avgRed:avg(x=>x.red),
  hunted:avg(x=>x.greenHunted),starved:avg(x=>x.greenStarved),
  starveRate:avg(x=>x.greenStarvePer100IndividualDays),
  noHit:resolved>0?100*tot(x=>x.unhit)/resolved:null,
  meanSeedNoHit:avg(x=>x.attackFreePct??0)
 };
}
const metrics=items=>Object.fromEntries(arms.map(arm=>[arm,stats(items,arm)]));
const D=metrics(discovery),H=metrics(holdout);
function delta(a,b){return {
 greenAlive:a.greenAlive-b.greenAlive,coexist:a.coexist-b.coexist,
 avgGreenPct:100*(a.avgGreen/b.avgGreen-1),
 huntedPct:100*(a.hunted/b.hunted-1),
 starveRatePct:100*(a.starveRate/b.starveRate-1),
 noHitPoints:a.noHit-b.noHit
}}
const choices=arms.filter(x=>!['normal','baseline'].includes(x)).map(arm=>({arm,...delta(D[arm],D.baseline)}));
const meets=x=>x.greenAlive>=-2&&x.coexist>=-6&&x.avgGreenPct>=5&&
 x.huntedPct<=8&&x.starveRatePct<=-3&&x.noHitPoints>=-.75;
const qualified=choices.filter(meets).sort((a,b)=>b.avgGreenPct-a.avgGreenPct);
const candidate=qualified.length?qualified[0].arm:null;
const check=candidate?delta(H[candidate],H.baseline):null;
let rng=123456;const random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
function ci(items,arm,field){
 const values=items.map(o=>field(o[arm],o.baseline));const means=[];
 for(let k=0;k<2200;k++){let sum=0;for(let j=0;j<values.length;j++)sum+=values[Math.floor(random()*values.length)];means.push(sum/values.length)}
 means.sort((a,b)=>a-b);
 return {pairedMean:values.reduce((a,b)=>a+b,0)/values.length,ci95:[means[55],means[2145]]};
}
const holdCI=candidate?{
 green:ci(holdout,candidate,(a,b)=>a.green-b.green),
 hunt:ci(holdout,candidate,(a,b)=>a.greenHunted-b.greenHunted),
 starve:ci(holdout,candidate,(a,b)=>a.greenStarvePer100IndividualDays-b.greenStarvePer100IndividualDays),
 chase:ci(holdout,candidate,(a,b)=>(a.attackFreePct??0)-(b.attackFreePct??0))
}:null;
const pass=!!(candidate&&meets(check)&&holdCI.green.ci95[0]>0&&holdCI.starve.ci95[1]<0);
const report={
 title:'AI1 path grazing and alarm: 100 discovery + 100 independent confirmation seeds',
 configs:'green100 red20 blue0 regrowth100 variance10 duration100 dt.08',
 discoveryRange:'20294001..20294100',holdoutRange:'20304001..20304100',
 grazing:'Equal per-tick maximum grass intake; choose among actually traversed tiles. Red behavior and green physical abilities unchanged.',
 predefinedDecision:'Compared with released AI1: final green +5%; starve rate -3%; no-hit drop <0.75 pp; hunted rise <=8%; green persistence decrease <=2/100; coexist decrease <=6/100; on holdout require lower 95% green delta above 0 and upper 95% starvation-rate delta below 0.',
 discovery:D,choices,eligible:qualified.map(x=>x.arm),candidate:candidate??'baseline-no-qualifier',
 holdout:H,holdoutComparison:check,bootstrap:holdCI,
 deploymentVerdict:pass?'candidate_passed_exploratory_gates_needs_review':'not_adopted',
 caveat:'Human-programmed foraging improvement is not evidence that neural genomes evolved new foraging behavior.'
};
fs.mkdirSync('reports/ai1-path-output',{recursive:true});
fs.writeFileSync('reports/ai1-path-output/summary.json',JSON.stringify(report,null,2));
fs.writeFileSync('reports/ai1-path-output/discovery.json',JSON.stringify(discovery));
fs.writeFileSync('reports/ai1-path-output/holdout.json',JSON.stringify(holdout));
console.log('PATH_STUDY_BEGIN');console.log(JSON.stringify(report));console.log('PATH_STUDY_END');
