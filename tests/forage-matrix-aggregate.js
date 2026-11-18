'use strict';
// Aggregate sharded discovery and holdout samples. Selection uses discovery only.
const fs=require('node:fs'),assert=require('node:assert/strict');
const names=['baseline','safeSearch','route','adaptive','graze','grazeRoute'];
const offsets=[0,25,50,75];
function read(set){
 const shards=offsets.map(k=>JSON.parse(fs.readFileSync('benchmark-shards/'+set+'-'+k+'.json','utf8')));
 const samples=shards.flatMap(x=>x.samples).sort((a,b)=>a.seed-b.seed);
 assert.equal(samples.length,100);
 assert.equal(new Set(samples.map(x=>x.seed)).size,100);
 return samples;
}
const discovery=read('discovery'),allHoldout=read('holdout');
function metrics(samples,arm){
 const data=samples.map(x=>x.arms[arm]),n=data.length;
 const mean=f=>data.reduce((s,v)=>s+f(v),0)/n;
 const ch={};
 for(const k of ['starts','unhit','hit','diedOther'])ch[k]=data.reduce((s,v)=>s+v.chase[k],0);
 const decided=ch.unhit+ch.hit+ch.diedOther;
 return {
  greenAlive:data.filter(x=>x.green>0).length,bothAlive:data.filter(x=>x.bothAlive).length,
  greenMean:mean(x=>x.green),starvedMean:mean(x=>x.starved),huntedMean:mean(x=>x.hunted),
  starvationRate:mean(x=>x.starvationPer100GreenDays),chaseNoHitPct:decided?100*ch.unhit/decided:null,
  chaseEpisodes:ch.starts
 };
}
const D=Object.fromEntries(names.map(a=>[a,metrics(discovery,a)]));
function diff(a,b){
 return {
  relativeStarveRate:a.starvationRate/b.starvationRate-1,
  deltaNoHit:a.chaseNoHitPct-b.chaseNoHitPct,
  deltaGreenAlive:a.greenAlive-b.greenAlive,
  deltaBothAlive:a.bothAlive-b.bothAlive,
  relativeHunted:a.huntedMean/b.huntedMean-1,
  relativeGreen:a.greenMean/b.greenMean-1
 };
}
function acceptable(x){
 return x.relativeStarveRate<=-.05&&x.deltaNoHit>=-1&&
   x.deltaGreenAlive>=-3&&x.deltaBothAlive>=-3&&
   x.relativeHunted<=.05&&x.relativeGreen>=-.05;
}
const comparisons=names.filter(n=>n!=='baseline').map(n=>({arm:n,...diff(D[n],D.baseline)}));
const eligible=comparisons.filter(acceptable).sort((a,b)=>a.relativeStarveRate-b.relativeStarveRate);
const chosen=eligible.length?eligible[0].arm:[...comparisons].sort((a,b)=>a.relativeStarveRate-b.relativeStarveRate)[0].arm;
const H=Object.fromEntries(['baseline',chosen].map(a=>[a,metrics(allHoldout,a)]));
const holdCmp=diff(H[chosen],H.baseline);
let seed=20261119;function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}
function bootstrap(samples,arm,key){
 const d=samples.map(s=>{
  const a=s.arms[arm],b=s.arms.baseline;
  if(key==='starve')return a.starvationPer100GreenDays-b.starvationPer100GreenDays;
  if(key==='chase')return (a.chaseAttackFreePct??0)-(b.chaseAttackFreePct??0);
  return a.green-b.green;
 });
 const values=[];for(let k=0;k<2000;k++){let sum=0;for(let j=0;j<d.length;j++)sum+=d[Math.floor(random()*d.length)];values.push(sum/d.length)}
 values.sort((x,y)=>x-y);return {pairedMean:d.reduce((s,v)=>s+v,0)/d.length,ci95:[values[50],values[1950]]};
}
const passes=eligible.some(x=>x.arm===chosen)&&acceptable(holdCmp);
const report={
 title:'AI1 hunger policies: 100 paired discovery seeds and 100 disjoint holdout seeds',
 discoveryRange:'20270001-20270100',holdoutRange:'20281001-20281100',
 candidate:chosen,eligible:eligible.map(x=>x.arm),
 rules:'starvationRate<=baseline*.95, chaseNoHitPct>=baseline-1 pp, greenAlive/bothAlive>=baseline-3 of 100, huntedMean<=baseline*1.05, greenMean>=baseline*.95',
 discovery:D,comparisons,holdout:H,holdoutComparison:holdCmp,
 pairedBootstrap:{
  discoveryStarve:bootstrap(discovery,chosen,'starve'),
  holdoutStarve:bootstrap(allHoldout,chosen,'starve'),
  holdoutChase:bootstrap(allHoldout,chosen,'chase'),
  holdoutGreen:bootstrap(allHoldout,chosen,'green')
 },
 decision:passes?'passed_screen_not_deployed':'not_adopted',
 caution:'The 1-day chase outcomes are overlapping and correlated; 100 random seeds are the paired replicate units. Policy change is manual, not learning proven by evolution.'
};
fs.mkdirSync('reports/forage-benchmark-output',{recursive:true});
fs.writeFileSync('reports/forage-benchmark-output/matrix-summary.json',JSON.stringify(report,null,2));
fs.writeFileSync('reports/forage-benchmark-output/matrix-discovery.json',JSON.stringify(discovery));
fs.writeFileSync('reports/forage-benchmark-output/matrix-holdout.json',JSON.stringify(allHoldout));
console.log('MATRIX_RESULT_BEGIN');console.log(JSON.stringify(report));console.log('MATRIX_RESULT_END');
