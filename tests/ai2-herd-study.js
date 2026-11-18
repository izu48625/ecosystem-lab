'use strict';
/* Paired same-seed ecology validation of neural-herd evolution.
 * node tests/ai2-herd-study.js <offset> <count> <baseSeed>
 * All death, birth, grass, predator rules and physical green traits unchanged.
 */
const fs=require('node:fs'),assert=require('node:assert/strict');
const {Lab}=require('../src/sim-core.js');
const offset=Number(process.argv[2]??0),count=Number(process.argv[3]??10),
 seedBase=Number(process.argv[4]??20400001);
assert.ok(Number.isInteger(offset)&&offset>=0&&Number.isInteger(count)&&count>=1&&count<=20);
const MODES=['normal','ai1','social','socialOff','socialClone','socialNoInheritance'];
const DAYS=[0,30,60,100];
const mix=(a,b)=>{let x=(a^Math.imul(b+1,0x9e3779b1))>>>0;x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);return(x^(x>>>16))>>>0};
function oneWorld(seed,mode){
 const spec=mode==='normal'?'normal':mode==='ai1'?'escape':'social';
 const lab=new Lab({seed,green:100,red:20,blue:0,variance:10,regrowth:100,mode:spec,
  escapePolicy:'wide',socialEnabled:mode!=='socialOff',duration:100});
 lab.aiLog=function(){};
 const founders=lab.entities.filter(e=>e.type==='g').map(e=>e.genome.slice());
 if(mode==='socialClone'){
  const original=lab.mutateBrain;
  lab.mutateBrain=function(parent){original.call(this,parent);return parent.genome.slice()};
 }
 if(mode==='socialNoInheritance'){
  const original=lab.spawn;
  lab.spawn=function(type,x,y,initial=false,parent=null){
   const child=original.call(this,type,x,y,initial,parent);
   if(type==='g'&&!initial&&parent)child.genome=founders[mix(seed,child.id)%founders.length].slice();
   return child;
  };
 }
 const checkpoints={};
 for(const day of DAYS){
  if(lab.day<day)lab.run(day,.08);
  const h=lab.history.find(x=>x.day===day);
  assert.ok(h,'Missing DAY'+day);
  checkpoints[day]={
   green:h.g,red:h.r,greenAlive:h.g>0,coexist:h.g>0&&h.r>0,
   groupPct:h.ai2GroupedPct??null,meanNeighbors:h.ai2MeanNeighbors??null,
   maxLocalGroup:h.ai2MaxLocalGroup??null,
   meanNearest:h.ai2MeanNearest??null,
   meanGeneration:h.aiMeanGeneration??null
  };
 }
 return {
  checkpoints,green:lab.counts().g,red:lab.counts().r,
  greenAlive:lab.counts().g>0,coexist:lab.counts().g>0&&lab.counts().r>0,
  hunted:lab.stats.deaths.g.hunt,starved:lab.stats.deaths.g.starve,
  starveRate:100*lab.stats.deaths.g.starve/Math.max(1,lab.stats.individualDays.g),
  greenBirths:lab.stats.births.g,redBirths:lab.stats.births.r,
  aiOffspring:lab.stats.ai.offspring,mutatedOffspring:lab.stats.ai.mutatedOffspring,
  maxGeneration:lab.stats.ai.highestGeneration
 };
}
const samples=[];
for(let i=0;i<count;i++){
 const seed=seedBase+offset+i,row={seed};
 for(const mode of MODES)row[mode]=oneWorld(seed,mode);
 for(const other of ['socialOff','socialClone','socialNoInheritance']){
  assert.equal(row.social.checkpoints[0].groupPct,row[other].checkpoints[0].groupPct,'Day0 matched group geometry');
  assert.equal(row.social.checkpoints[0].meanNeighbors,row[other].checkpoints[0].meanNeighbors,'Day0 matched initial ecology');
 }
 samples.push(row);
 console.error('AI2',offset+i+1,'/',offset+count,seed,
  MODES.map(m=>m+':'+row[m].green+'/'+row[m].red).join(' '));
}
fs.mkdirSync('reports/ai2-herd-raw',{recursive:true});
const out='reports/ai2-herd-raw/shard-'+offset+'.json';
fs.writeFileSync(out,JSON.stringify({version:1,seedBase,offset,count,modes:MODES,days:DAYS,
 definition:'group = green with >= 2 other green within 65px; mean nearest and group count calculated once/day; no ability or food gain from grouping',
 samples}));
console.log('AI2_STUDY_SHARD_BEGIN');
console.log(JSON.stringify({offset,count,seedStart:samples[0].seed,seedEnd:samples.at(-1).seed,path:out}));
console.log('AI2_STUDY_SHARD_END');
