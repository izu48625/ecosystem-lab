'use strict';
/* Ecological robustness of released AI1 versus Normal over varied conditions.
 * Usage node tests/ai1-robustness-study.js red10
 */
const {Lab}=require('../src/sim-core.js'),assert=require('node:assert/strict'),fs=require('node:fs');
const configs={
 red10:{red:10,regrowth:100,duration:100},
 red30:{red:30,regrowth:100,duration:100},
 grass75:{red:20,regrowth:75,duration:100},
 grass125:{red:20,regrowth:125,duration:100},
 day200:{red:20,regrowth:100,duration:200}
};
const id=process.argv[2],cfg=configs[id];
assert.ok(cfg,'Known scenario required: '+Object.keys(configs).join(','));
const count=Number(process.argv[3]??40);
assert.ok(Number.isInteger(count)&&count>=1&&count<=100);
const base=20300001,options={green:100,blue:0,variance:10,...cfg};
function study(seed,mode){
 const lab=new Lab({...options,seed,mode,escapePolicy:'wide',escapeStrategy:'baseline'});
 lab.aiLog=()=>{};
 lab.run(cfg.duration,.08);
 const c=lab.counts();
 return {
  green:c.g,red:c.r,
  greenAlive:c.g>0,bothAlive:c.g>0&&c.r>0,
  greenBirths:lab.stats.births.g,
  greenHunted:lab.stats.deaths.g.hunt,
  greenStarved:lab.stats.deaths.g.starve,
  starvedPer100GreenDays:100*lab.stats.deaths.g.starve/Math.max(1,lab.stats.individualDays.g),
  redDeaths:lab.stats.deaths.r,
  highestGeneration:lab.stats.ai.highestGeneration
 };
}
const samples=[];
for(let i=0;i<count;i++){const seed=base+i;samples.push({seed,normal:study(seed,'normal'),ai1:study(seed,'escape')})}
const avg=(name,fn)=>samples.reduce((s,v)=>s+fn(v[name]),0)/count;
const total=(name,fn)=>samples.filter(v=>fn(v[name])).length;
const result={
 scenario:id,options,count,seedRange:[base,base+count-1],
 summary:Object.fromEntries(['normal','ai1'].map(name=>[name,{
  greenAlive:total(name,v=>v.greenAlive),coexist:total(name,v=>v.bothAlive),
  finalGreenMean:avg(name,v=>v.green),finalRedMean:avg(name,v=>v.red),
  greenHuntedMean:avg(name,v=>v.greenHunted),greenStarvedMean:avg(name,v=>v.greenStarved),
  starvedPer100GreenDaysMean:avg(name,v=>v.starvedPer100GreenDays)
 }])),
 samples
};
fs.mkdirSync('reports/ai1-robustness-output',{recursive:true});
fs.writeFileSync('reports/ai1-robustness-output/'+id+'.json',JSON.stringify(result,null,2));
console.log('ROBUSTNESS_RESULT_BEGIN');
console.log(JSON.stringify({scenario:id,options,count,summary:result.summary}));
console.log('ROBUSTNESS_RESULT_END');
