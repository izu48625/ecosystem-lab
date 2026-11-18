'use strict';
// CI study: 100 paired seeds to select a candidate, followed by 100 disjoint holdout seeds.
// Run: node tests/forage-decision.js
const cp=require('node:child_process'),fs=require('node:fs'),assert=require('node:assert/strict');
const arms=['baseline','safeSearch','route','adaptive','graze','grazeRoute'];
function runBatch(base,selected){
  const data=[];
  for(let offset=0;offset<100;offset+=25){
    console.log('Research checkpoint: '+base+' + '+offset+'...'+(offset+24)+'; arms='+selected.join(','));
    const p=cp.spawnSync(process.execPath,['tests/forage-policy-study.js',String(offset),'25',String(base),selected.join(',')],
      {encoding:'utf8',maxBuffer:50*1024*1024,timeout:35*60*1000});
    if(p.status!==0)throw Error('Study failed: '+p.status+' '+(p.stderr||'').slice(-5000));
    const report=JSON.parse(p.stdout);
    assert.equal(report.samples.length,25);
    data.push(...report.samples);
  }
  assert.equal(data.length,100);
  assert.equal(new Set(data.map(x=>x.seed)).size,100);
  return data;
}
function metric(samples,arm){
  const a=samples.map(x=>x.arms[arm]),mean=f=>a.reduce((s,x)=>s+f(x),0)/a.length;
  const sums=['unhit','hit','diedOther','starts'].reduce((v,k)=>(v[k]=a.reduce((s,x)=>s+x.chase[k],0),v),{});
  return {
    n:a.length, greenAlive:a.filter(x=>x.green>0).length, bothAlive:a.filter(x=>x.bothAlive).length,
    finalGreenMean:mean(x=>x.green), huntedMean:mean(x=>x.hunted), starvedMean:mean(x=>x.starved),
    starveRate:mean(x=>x.starvationPer100GreenDays),
    huntRate:mean(x=>x.hunted/(x.starvationPer100GreenDays===null?1:Math.max(1,x.births+x.green))),
    chaseAttackFreePct:(sums.unhit+sums.hit+sums.diedOther)?100*sums.unhit/(sums.unhit+sums.hit+sums.diedOther):null,
    chaseEpisodes:sums.starts,
    meanSeedChasePct:mean(x=>x.chaseAttackFreePct??0),
  };
}
function grouped(samples,selected){return Object.fromEntries(selected.map(a=>[a,metric(samples,a)]));}
function compare(candidate,baseline){
  return {
    deltaStarveRate:candidate.starveRate-baseline.starveRate,
    relStarveRate:candidate.starveRate/baseline.starveRate-1,
    deltaChasePct:candidate.chaseAttackFreePct-baseline.chaseAttackFreePct,
    deltaGreenAlive:candidate.greenAlive-baseline.greenAlive,
    deltaCoexist:candidate.bothAlive-baseline.bothAlive,
    relHunted:candidate.huntedMean/baseline.huntedMean-1,
    relFinalGreen:candidate.finalGreenMean/baseline.finalGreenMean-1
  };
}
function passes(c){
  // Conservative pre-set screen: this must hold on both discovery and holdout.
  return c.relStarveRate<=-.05 && c.deltaChasePct>=-1 &&
    c.deltaGreenAlive>=-3 && c.deltaCoexist>=-3 &&
    c.relHunted<=.05 && c.relFinalGreen>=-.05;
}
function pairBoot(samples,arm,metricKey,rep=1500){
  let state=123456789;const next=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
  const diffs=samples.map(x=>{
    const a=x.arms[arm],b=x.arms.baseline;
    if(metricKey==='starvation')return a.starvationPer100GreenDays-b.starvationPer100GreenDays;
    if(metricKey==='chase')return (a.chaseAttackFreePct??0)-(b.chaseAttackFreePct??0);
    if(metricKey==='green')return a.green-b.green;
    throw Error(metricKey);
  });
  const means=[];
  for(let k=0;k<rep;k++){let sum=0;for(let j=0;j<diffs.length;j++)sum+=diffs[Math.floor(next()*diffs.length)];means.push(sum/diffs.length)}
  means.sort((a,b)=>a-b);
  return {pairedMean:diffs.reduce((a,b)=>a+b,0)/diffs.length,ci95:[means[Math.floor(.025*rep)],means[Math.floor(.975*rep)]]};
}
const discovery=runBatch(20270001,arms),summary=grouped(discovery,arms);
const screens=arms.filter(a=>a!=='baseline').map(a=>({arm:a,...compare(summary[a],summary.baseline)}));
const eligible=screens.filter(passes).sort((a,b)=>a.relStarveRate-b.relStarveRate);
// If no policy passes the hard screening, test the best starvation candidate diagnostically.
// It is NOT treated as adopted or validated.
const winner=eligible.length?eligible[0].arm:[...screens].sort((a,b)=>a.relStarveRate-b.relStarveRate)[0].arm;
console.log('Discovery concluded; selected '+winner+'; passed screen: '+(eligible.length>0));
const holdout=runBatch(20281001,['baseline',winner]),confirm=grouped(holdout,['baseline',winner]);
const holdCmp=compare(confirm[winner],confirm.baseline);
const decision=passes(holdCmp)&&eligible.some(e=>e.arm===winner)?'candidate_passed_preset_checks_not_deployed':'not_adopted';
const result={
  study:'AI1 hunger policy paired study',configuredBeforeHoldout:true,
  source:'experiment/ai1-foraging-20261119-v1',settings:'green100 red20 blue0 100 days dt.08 wide escape mutation 2%, ±0.10',
  discoverySeeds:'20270001..20270100',holdoutSeeds:'20281001..20281100',
  metricsDefinition:'Starve rate is average seed-level deaths per 100 herbivore individual-days. Chase survival is pooled finished one-day observations initiated at real red target selection; exposure windows can overlap.',
  safetyScreen:'starvation rate improves >=5%; chase no-hit >=baseline-1 percentage point; green alive trials >=baseline-3; coexist trials >=baseline-3; hunted mean <=baseline*1.05; final green mean >=baseline*0.95',
  discovery:summary,discoveryComparisons:screens,discoveryEligible:eligible.map(x=>x.arm),
  candidate: winner,holdout:confirm,holdoutComparison:holdCmp,
  bootstrap:{
    discoveryStarve:pairBoot(discovery,winner,'starvation'),
    holdoutStarve:pairBoot(holdout,winner,'starvation'),
    discoveryChaseSeedMean:pairBoot(discovery,winner,'chase'),
    holdoutChaseSeedMean:pairBoot(holdout,winner,'chase'),
    holdoutGreen:pairBoot(holdout,winner,'green')
  },
  decision,notes:[
    'A positive point estimate without statistical robustness is not evidence that evolution learned a better tactic.',
    'Multiple exploratory candidates were screened; the holdout is disjoint and selected only once.',
    'Even when preset thresholds are met, review ecological validity and CI before deployment.',
    'Pre-existing manual policy wide remains fixed and is not a neural evolution effect.'
  ]
};
fs.mkdirSync('reports/forage-benchmark-output',{recursive:true});
fs.writeFileSync('reports/forage-benchmark-output/summary.json',JSON.stringify(result,null,2));
fs.writeFileSync('reports/forage-benchmark-output/discovery-100.json',JSON.stringify(discovery));
fs.writeFileSync('reports/forage-benchmark-output/holdout-100.json',JSON.stringify(holdout));
console.log('DECISION_RESULT_BEGIN');
console.log(JSON.stringify({candidate:winner,decision,discovery:summary,holdout:confirm,holdoutComparison:holdCmp,bootstrap:result.bootstrap}));
console.log('DECISION_RESULT_END');
