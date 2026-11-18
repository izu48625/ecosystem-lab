'use strict';
/* Analyze 7 predeclared settings independently. Unit = paired ecosystem seed.
 * Scenarios never pooled to choose a favorable parameter.
 */
const fs=require('node:fs'),assert=require('node:assert/strict');
const SCENARIOS={
 base:{base:20421001,n:40},red10:{base:20421101,n:20},red30:{base:20421201,n:20},
 grass75:{base:20421301,n:20},grass125:{base:20421401,n:20},
 day200:{base:20421501,n:20},green50:{base:20421601,n:20}
};
const ARMS=['normal','ai1','ai2','ai2Off'];
const out={run:'AI2 independent post-launch ecological stress assessment',rules:'same red predator, green body and grass model; no group-defense bonus',scenarios:{},metricsNotes:[
 'Grouped is local: green with >=2 neighbours within 65px. Density alone can raise this percentage.',
 'LargestComponentPct is the connected component of the within-65px proximity graph as percent of all living greens.',
 'PairAlignment is cos(angle difference) averaged over green neighbours; 0=random headings, 1=fully aligned, -1=opposite.',
 'Diffs are paired per identical seed, not independent groups. 95% intervals use seed-level bootstrap.',
 'No observed change proves adaptive evolution; the model manually specifies social response functions.',
 'The uniform random proximity baseline is approximate because group membership depends on where inside the map an animal sits.'
]};
const mean=(data,fun)=>data.length?data.reduce((s,x)=>s+fun(x),0)/data.length:null;
function pairBootstrap(rows,label,a,b,fn){
 const values=rows.map(r=>fn(r[a],r[b])).filter(v=>v!==null&&Number.isFinite(v));
 let z=0xab517233;const rand=()=>{z=(Math.imul(z,1664525)+1013904223)>>>0;return z/4294967296};
 const boot=[];
 for(let m=0;m<3000;m++){
  let v=0;for(let i=0;i<values.length;i++)v+=values[Math.floor(rand()*values.length)];
  boot.push(v/values.length);
 }
 boot.sort((x,y)=>x-y);
 return {label,n:values.length,delta:mean(values,x=>x),CI95:[boot[75],boot[2925]],
  better:values.filter(x=>x>0).length,worse:values.filter(x=>x<0).length};
}
function approxUniformGrouped(n){
 // P(two uniformly chosen distinct positions in 960x600 are closer than 65 px):
 const W=960,H=600,r=65;
 const p=(Math.PI*r*r*W*H-(4/3)*r*r*r*(W+H)+r**4/2)/(W*H)**2;
 const k=n-1;if(k<=1)return 0;
 return 100*(1-(1-p)**k-k*p*(1-p)**(k-1));
}
function summary(records,arm,day){
 const vals=records.map(r=>r[arm]),last=vals.map(r=>r.checkpoints[day]);
 return {
  greenPersistence:vals.filter(x=>x.greenAlive).length,
  redPersistence:vals.filter(x=>x.redAlive).length,
  coexist:vals.filter(x=>x.coexist).length,
  meanGreen:mean(vals,x=>x.green),meanRed:mean(vals,x=>x.red),
  greenHunted:mean(vals,x=>x.hunted),greenStarved:mean(vals,x=>x.starved),
  greenStarveRate:mean(vals,x=>x.greenStarveRate),
  redStarved:mean(vals,x=>x.redStarved),
  greenBirths:mean(vals,x=>x.greenBirths),redBirths:mean(vals,x=>x.redBirths),
  greenBorderTimePct:mean(vals,x=>x.greenBorderTimePct),
  meanGroupPct:mean(last,x=>x.groupPct),
  approxUniformGroupPct:mean(last,x=>approxUniformGrouped(x.g)),
  meanLocalNeighbors:mean(last,x=>x.meanNeighbors),
  meanLargestGroupFrac:mean(last,x=>x.largestComponentPct),
  meanConnectedGroups3:mean(last,x=>x.components3),
  meanPairAlignment:mean(last.filter(x=>x.pairAlignment!==null),x=>x.pairAlignment),
  meanBorderPct:mean(last,x=>x.borderPct),
  meanGeneration:mean(last,x=>x.meanGeneration)
 };
}
for(const [name,info] of Object.entries(SCENARIOS)){
 const rows=[];
 for(let off=0;off<info.n;off+=10){
  const path='reports/ai2-audit-raw/'+name+'-'+off+'.json';
  const d=JSON.parse(fs.readFileSync(path,'utf8'));
  assert.equal(d.scenario,name);assert.equal(d.offset,off);assert.equal(d.count,10);
  rows.push(...d.samples);
 }
 rows.sort((a,b)=>a.seed-b.seed);
 assert.equal(rows.length,info.n);
 assert.equal(new Set(rows.map(x=>x.seed)).size,info.n);
 for(let i=0;i<info.n;i++)assert.equal(rows[i].seed,info.base+i);
 const last=name==='day200'?200:100;
 const stats=Object.fromEntries(ARMS.map(a=>[a,summary(rows,a,last)]));
 const diffs={
  ai2VsAi1:{
   green:pairBootstrap(rows,'final green count','ai2','ai1',(a,b)=>a.green-b.green),
   coexist:pairBootstrap(rows,'both species survive','ai2','ai1',(a,b)=>Number(a.coexist)-Number(b.coexist)),
   red:pairBootstrap(rows,'final red count','ai2','ai1',(a,b)=>a.red-b.red),
   hunt:pairBootstrap(rows,'cumulative hunted green','ai2','ai1',(a,b)=>a.hunted-b.hunted),
   starvation:pairBootstrap(rows,'starvation deaths per 100 green-days','ai2','ai1',(a,b)=>a.greenStarveRate-b.greenStarveRate)
  },
  socialImpact:{
   green:pairBootstrap(rows,'group steering effect on final green','ai2','ai2Off',(a,b)=>a.green-b.green),
   group:pairBootstrap(rows,'group steering effect on group membership','ai2','ai2Off',(a,b)=>a.checkpoints[last].groupPct-b.checkpoints[last].groupPct),
   largest:pairBootstrap(rows,'group steering effect on largest connected component','ai2','ai2Off',(a,b)=>a.checkpoints[last].largestComponentPct-b.checkpoints[last].largestComponentPct),
   align:pairBootstrap(rows,'group steering effect on neighbour heading alignment','ai2','ai2Off',(a,b)=>{
    const x=a.checkpoints[last].pairAlignment,y=b.checkpoints[last].pairAlignment;return x===null||y===null?null:x-y
   }),
   hunted:pairBootstrap(rows,'group steering effect on predation deaths','ai2','ai2Off',(a,b)=>a.hunted-b.hunted),
   coexist:pairBootstrap(rows,'group steering effect on both-species persistence','ai2','ai2Off',(a,b)=>Number(a.coexist)-Number(b.coexist))
  }
 };
 const checkpoints=Object.fromEntries((last===200?[0,30,60,100,150,200]:[0,30,60,100]).map(day=>[
  day,Object.fromEntries(['ai1','ai2','ai2Off'].map(a=>[a,{
   green:mean(rows,x=>x[a].checkpoints[day].g),
   red:mean(rows,x=>x[a].checkpoints[day].r),
   groupPct:mean(rows,x=>x[a].checkpoints[day].groupPct),
   largestPct:mean(rows,x=>x[a].checkpoints[day].largestComponentPct),
   align:mean(rows.filter(x=>x[a].checkpoints[day].pairAlignment!==null),x=>x[a].checkpoints[day].pairAlignment),
   uniformExpectation:mean(rows,x=>approxUniformGrouped(x[a].checkpoints[day].g))
  }]))
 ]));
 out.scenarios[name]={seedRange:[info.base,info.base+info.n-1],n:info.n,finalDay:last,
  stats,diffs,checkpoints};
}
fs.mkdirSync('reports/ai2-audit-final',{recursive:true});
fs.writeFileSync('reports/ai2-audit-final/summary.json',JSON.stringify(out,null,2));
console.log('AI2_AUDIT_RESULT_BEGIN');console.log(JSON.stringify(out));console.log('AI2_AUDIT_RESULT_END');
