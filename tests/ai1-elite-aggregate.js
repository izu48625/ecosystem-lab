'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const N=Number(process.argv[2]??20),STEP=Number(process.argv[3]??5),BASE=Number(process.argv[4]??20370001),STAGE=process.argv[5]??'discovery';
assert.ok([20,100].includes(N)&&[5,10].includes(STEP)&&N%STEP===0);
const ARMS=['released','random10','random25','random50','elite10','elite25','elite50'];
const samples=[];
for(let i=0;i<N;i+=STEP){
 const doc=JSON.parse(fs.readFileSync('reports/ga-elite-ecology/shard-'+i+'.json','utf8'));
 assert.equal(doc.offset,i);assert.equal(doc.count,STEP);assert.equal(doc.base,BASE);
 samples.push(...doc.samples);
}
samples.sort((a,b)=>a.seed-b.seed);
assert.equal(samples.length,N);for(let i=0;i<N;i++)assert.equal(samples[i].seed,BASE+i);
const avg=(a,fn)=>a.reduce((s,x)=>s+fn(x),0)/a.length;
const stats=Object.fromEntries(ARMS.map(arm=>{
 const rows=samples.map(x=>x.arms[arm]);
 const aliveRows=rows.filter(x=>x.green>0);
 return [arm,{
  greenPersist:rows.filter(x=>x.aliveGreen).length,
  coexist:rows.filter(x=>x.coexist).length,
  meanGreen:avg(rows,x=>x.green),
  meanRed:avg(rows,x=>x.red),
  meanHunted:avg(rows,x=>x.hunted),
  meanStarved:avg(rows,x=>x.starved),
  meanStarveRate:avg(rows,x=>x.starvePer100GreenDays),
  meanTaggedDay0:arm==='released'?null:avg(rows,x=>x.lineage[0].tagPct),
  meanTaggedDay30:arm==='released'?null:avg(rows.filter(x=>x.lineage[1].tagPct!==null),x=>x.lineage[1].tagPct),
  meanTaggedDay60:arm==='released'?null:avg(rows.filter(x=>x.lineage[2].tagPct!==null),x=>x.lineage[2].tagPct),
  meanTaggedDay100:arm==='released'?null:aliveRows.length?avg(aliveRows,x=>x.lineage[3].tagPct):null,
  trackedAliveWorlds:aliveRows.length
 }];}));
function delta(x,ref){return {
 greenPersist:x.greenPersist-ref.greenPersist,coexist:x.coexist-ref.coexist,
 meanGreenPct:100*(x.meanGreen/ref.meanGreen-1),
 meanRedPct:100*(x.meanRed/ref.meanRed-1),
 huntedPct:100*(x.meanHunted/ref.meanHunted-1),
 starveRatePct:100*(x.meanStarveRate/ref.meanStarveRate-1),
 taggedShareDelta:x.meanTaggedDay100===null||ref.meanTaggedDay100===null?null:x.meanTaggedDay100-ref.meanTaggedDay100
}}
const candidates=[10,25,50].map(f=>{
 const id='elite'+f,control='random'+f;
 return {id,fraction:f,versusReleased:delta(stats[id],stats.released),
  versusMatchedFounder:delta(stats[id],stats[control])};
});
const eligibility=c=> c.versusReleased.meanGreenPct>=5&&
 c.versusReleased.greenPersist>=-(N===20?1:3)&&
 c.versusReleased.coexist>=-(N===20?2:5)&&
 c.versusReleased.meanRedPct>=-30&&
 c.versusReleased.starveRatePct<=15&&
 c.versusMatchedFounder.meanGreenPct>=0;
const eligible=candidates.filter(eligibility).sort((a,b)=>b.versusReleased.meanGreenPct-a.versusReleased.meanGreenPct);
const chosen=eligible[0]?.id??null;
let randomState=0x8ac21501;const rand=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296};
function pairCI(label,field,arm,control='released'){
 const values=samples.map(s=>field(s.arms[arm])-field(s.arms[control])),means=[];
 for(let i=0;i<3000;i++){let sum=0;for(let j=0;j<values.length;j++)sum+=values[Math.floor(rand()*values.length)];means.push(sum/values.length)}
 means.sort((x,y)=>x-y);return {label,n:values.length,mean:avg(values,x=>x),ci95:[means[75],means[2925]]};
}
const CI=Object.fromEntries([10,25,50].map(f=>{
 const arm='elite'+f,c='random'+f;
 return [arm,{
  greenVsReleased:pairCI('final green population',x=>x.green,arm),
  coexistVsReleased:pairCI('two-species ecological persistence',x=>Number(x.coexist),arm),
  redVsReleased:pairCI('red predator population',x=>x.red,arm),
  greenVsRandomFounder:pairCI('elite vs matched non-trained founder final green',x=>x.green,arm,c),
  lineageVsRandomFounder:pairCI('elite-descendant tagged population fraction DAY100',x=>x.lineage[3].tagPct??0,arm,c)
 }];
}));
const report={
 title:'Transplant genetically trained escape genome into original wide ecology at 10%, 25%, 50% founder fraction',
 stage:STAGE,seedRange:[BASE,BASE+N-1],worlds:N,
 source:'Training genome learned in separate 12-generation artificial-selection arena; transplanted into original wide-escape simulation using identical speed, HP, grass growth, reproduction and red rules. No new selection/reproduction fitness reward in recipient ecology.',
 matchedControl:'Same number and positions of tagged founders receive a single randomly chosen untrained founder genome from the identical training founder pool. Relative lineage expansion indicates differential descendant success, not proof of a specific causal gene or spontaneous mutation.',
 prespecifiedScreen:'Improve final green >=5% vs released, green species persistence decline <=1/20 or 3/100, coexistence decline <=2/20 or 5/100, red mean decline <=30%, starvation rate rise <=15%, green mean >= matched random founder cohort.',
 stats,candidates,eligible:eligible.map(c=>c.id),selected:chosen??'none',
 comparisons:CI,
 outcome:chosen?'candidate_exploratory_screen_passed_requires_new_100_seed_holdout':'none_qualified_no_rollout',
 caution:'Do not select a favorable mixture from validation-only data. This ecological recipient uses original AI1 policy; the training procedure and founder placement are external interventions.'
};
const dir='reports/ga-elite-summary/'+STAGE;fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(dir+'/summary.json',JSON.stringify(report,null,2));
fs.writeFileSync(dir+'/seed-level.json',JSON.stringify(samples));
console.log('ELITE_ECO_RESULT_BEGIN');
console.log(JSON.stringify({stage:STAGE,seedRange:report.seedRange,stats,candidates,eligible:report.eligible,selected:report.selected,outcome:report.outcome,comparisons:CI}));
console.log('ELITE_ECO_RESULT_END');
