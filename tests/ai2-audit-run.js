'use strict';
/* AI② independent ecological audit. Preset conditions, no simulation-rule changes.
 * node tests/ai2-audit-run.js <scenario> <offset> <count>
 */
const fs=require('node:fs'),assert=require('node:assert/strict');
const {Lab}=require('../src/sim-core.js');
const SCENARIOS={
  base:      {base:20421001,count:40,green:100,red:20,regrowth:100,variance:10,duration:100},
  red10:     {base:20421101,count:20,green:100,red:10,regrowth:100,variance:10,duration:100},
  red30:     {base:20421201,count:20,green:100,red:30,regrowth:100,variance:10,duration:100},
  grass75:   {base:20421301,count:20,green:100,red:20,regrowth:75,variance:10,duration:100},
  grass125:  {base:20421401,count:20,green:100,red:20,regrowth:125,variance:10,duration:100},
  day200:    {base:20421501,count:20,green:100,red:20,regrowth:100,variance:10,duration:200},
  green50:   {base:20421601,count:20,green:50,red:20,regrowth:100,variance:10,duration:100}
};
const scenario=process.argv[2]??'base',offset=Number(process.argv[3]??0),count=Number(process.argv[4]??10);
assert.ok(SCENARIOS[scenario],'unknown scenario');
const cfg=SCENARIOS[scenario];
assert.ok(Number.isInteger(offset)&&offset>=0&&Number.isInteger(count)&&count>=1&&offset+count<=cfg.count);
const MODES=['normal','ai1','ai2','ai2Off'];
function structure(lab){
 const greens=lab.entities.filter(e=>e.type==='g'&&e.alive);
 const n=greens.length;
 if(!n)return {groupPct:0,meanNeighbors:0,maxComponent:0,largestComponentPct:0,components3:0,pairAlignment:null,borderPct:0};
 const per=new Array(n).fill(0),parent=Array.from({length:n},(_,i)=>i),sz=new Array(n).fill(1);
 const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i]}return i};
 const link=(a,b)=>{let x=find(a),y=find(b);if(x!==y){if(sz[x]<sz[y])[x,y]=[y,x];parent[y]=x;sz[x]+=sz[y]}};
 const buckets=new Map(),unit=65;
 for(let i=0;i<n;i++){
  const e=greens[i],cx=Math.floor(e.x/unit),cy=Math.floor(e.y/unit);
  const key=cx+','+cy;
  if(!buckets.has(key))buckets.set(key,[]);
  buckets.get(key).push(i);
 }
 let align=0,pairs=0;
 for(let i=0;i<n;i++){
  const a=greens[i],cx=Math.floor(a.x/unit),cy=Math.floor(a.y/unit);
  for(let y=cy-1;y<=cy+1;y++)for(let x=cx-1;x<=cx+1;x++){
   const local=buckets.get(x+','+y)||[];
   for(const j of local){
    if(j<=i)continue;
    const b=greens[j],d=Math.hypot(a.x-b.x,a.y-b.y);
    if(d>=unit||d<1e-7)continue;
    per[i]++;per[j]++;link(i,j);
    align+=Math.cos(a.angle-b.angle);pairs++;
   }
  }
 }
 const comp=new Map();
 for(let i=0;i<n;i++){const root=find(i);comp.set(root,(comp.get(root)||0)+1)}
 const sizes=[...comp.values()];
 const max=Math.max(...sizes);
 return {groupPct:100*per.filter(x=>x>=2).length/n,
  meanNeighbors:per.reduce((a,b)=>a+b,0)/n,
  maxComponent:max,largestComponentPct:100*max/n,
  components3:sizes.filter(x=>x>=3).length,
  pairAlignment:pairs?align/pairs:null,
  borderPct:100*greens.filter(e=>e.x<28||e.x>932||e.y<28||e.y>572).length/n};
}
function execute(seed,mode){
 const spec=mode==='normal'?'normal':mode==='ai1'?'escape':'social';
 const lab=new Lab({seed,green:cfg.green,red:cfg.red,blue:0,variance:cfg.variance,
  regrowth:cfg.regrowth,mode:spec,escapePolicy:'wide',
  socialEnabled:mode!=='ai2Off',duration:cfg.duration});
 lab.aiLog=function(){};
 const days=cfg.duration===200?[0,30,60,100,150,200]:[0,30,60,100];
 const checkpoints={};
 for(const day of days){
  if(day>lab.day)lab.run(day,.08);
  const counts=lab.counts(),shape=structure(lab);
  checkpoints[day]={...counts,...shape,
   meanGeneration:lab.history.at(-1).aiMeanGeneration,
   groupPctInternal:lab.history.at(-1).ai2GroupedPct??null};
  if(spec==='social')assert.ok(Math.abs(shape.groupPct-checkpoints[day].groupPctInternal)<=.011,
   'Internal daily group metric mismatch');
 }
 const counts=lab.counts(),ai=lab.stats.ai;
 return {green:counts.g,red:counts.r,greenAlive:counts.g>0,redAlive:counts.r>0,coexist:counts.g>0&&counts.r>0,
  hunted:lab.stats.deaths.g.hunt,starved:lab.stats.deaths.g.starve,
  greenStarveRate:100*lab.stats.deaths.g.starve/Math.max(1,lab.stats.individualDays.g),
  redStarved:lab.stats.deaths.r.starve,
  greenBirths:lab.stats.births.g,redBirths:lab.stats.births.r,
  redHunts:lab.stats.hunts.r,redKills:lab.stats.kills.r,
  greenTotalDays:lab.stats.individualDays.g,
  greenBorderTimePct:100*lab.stats.edgeDays.g/Math.max(1,lab.stats.individualDays.g),
  greenStarvedWithGrass:lab.stats.starveWithGlobalGrass.g,
  meanGeneration:lab.history.at(-1).aiMeanGeneration,
  mutatedOffspring:ai.mutatedOffspring,checkpoints};
}
const samples=[];
for(let k=0;k<count;k++){
 const seed=cfg.base+offset+k,row={seed};
 for(const mode of MODES)row[mode]=execute(seed,mode);
 for(const [a,b] of [['ai2','ai2Off']]){
  assert.equal(row[a].checkpoints[0].groupPct,row[b].checkpoints[0].groupPct);
  assert.equal(row[a].checkpoints[0].largestComponentPct,row[b].checkpoints[0].largestComponentPct);
 }
 samples.push(row);
 console.error('AI2 AUDIT',scenario,offset+k+1,'/',offset+count,seed,MODES.map(m=>m+':'+row[m].green+'/'+row[m].red).join(' '));
}
const path='reports/ai2-audit-raw/'+scenario+'-'+offset+'.json';
fs.mkdirSync('reports/ai2-audit-raw',{recursive:true});
fs.writeFileSync(path,JSON.stringify({scenario,settings:cfg,offset,count,samples,dayUnit:'simulation days',
 groupDefinition:'>=2 neighbours within 65px; components are connected components of the <=65px proximity graph',
 groupingNoBonus:true}));
console.log('AI2_AUDIT_SHARD_BEGIN');console.log(JSON.stringify({scenario,offset,count,seedMin:samples[0].seed,seedMax:samples.at(-1).seed}));console.log('AI2_AUDIT_SHARD_END');
