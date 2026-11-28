'use strict';
/* Actual ecology measurements for a video documentary. No fabricated trajectories. */
const fs=require('node:fs'),zlib=require('node:zlib'),path=require('node:path');
const {Lab}=require('../src/sim-core.js');
const OUT='video-production',START=20261117;
fs.mkdirSync(OUT,{recursive:true});
const MODES=[['normal','ノーマル'],['escape','AI① 逃走'],['social','AI② 群れ']];
const round=(n,k=3)=>Number(n.toFixed(k));
const save=(name,data)=>fs.writeFileSync(path.join(OUT,name+'.json.gz'),zlib.gzipSync(JSON.stringify(data),{level:7}));
const mean=x=>x.length?x.reduce((a,b)=>a+b,0)/x.length:null;
const quant=(x,p)=>{if(!x.length)return null;const a=x.slice().sort((a,b)=>a-b),v=(a.length-1)*p,i=Math.floor(v),f=v-i;return a[i]*(1-f)+a[Math.min(i+1,a.length-1)]*f};
const finals={},daily={},trajectories={};
for(const [mode,label] of MODES){
 const sim=new Lab({seed:START,green:100,red:20,blue:0,mode,trackLineages:mode==='social',duration:100,variance:10,regrowth:100});
 sim.aiLog=function(){};
 const frames=[];
 for(let i=0;i<=600;i++){
  const day=i/6;sim.run(day,.08);const n=sim.counts();
  frames.push({day:round(sim.day,2),g:n.g,r:n.r,
    agents:sim.entities.filter(e=>e.alive).map(e=>[round(e.x,1),round(e.y,1),round(e.angle,2),e.type,e.id,e.generation||0]),
    grass:sim.grass.map(v=>Math.round(v*100)/100)
  });
 }
 trajectories[mode]={seed:START,label,frames};
 daily[mode]=sim.history.map(h=>({
  day:h.day,g:h.g,r:h.r,grass:h.grass,birthg:h.birthg,huntg:h.huntg,starveg:h.starveg,
  aiMeanGeneration:h.aiMeanGeneration,ai2GroupedPct:h.ai2GroupedPct??null,
  ai2LargestConnectedPct:h.ai2LargestConnectedPct??null,ai2HeadingAlignment:h.ai2HeadingAlignment??null,
  ai2GeneGather:h.ai2GeneGather??null,ai2GeneAlign:h.ai2GeneAlign??null,
  ai2GeneSeparate:h.ai2GeneSeparate??null
 }));
 finals[mode]={counts:sim.counts(),stats:{
  births:sim.stats.births,deaths:sim.stats.deaths,kills:sim.stats.kills,
  individuals:sim.stats.individualDays,ai:{
   offspring:sim.stats.ai.offspring,mutatedOffspring:sim.stats.ai.mutatedOffspring,
   highestGeneration:sim.stats.ai.highestGeneration
  }
 },seed:START};
 if(mode==='social'){
  const lead=sim.lineageLeaders(15);
  const members=[...sim.lineageRecords.values()];
  const familyData={
   founders:100,lineages:members.length,aliveRootFamilies:sim.lineageLeaders(1000).length,
   leaders:lead.map(x=>({
    rootId:x.rootId,alive:x.alive,total:x.total,maxGeneration:x.maxGeneration,
    founder:x.founder?{
     id:x.founder.id,traits:x.founder.traits,children:x.founder.children.length,
     lifeDays:round(x.founder.lifeDays,2),foodEnergy:round(x.founder.foodEnergy,1),
     groupPct:x.founder.lifeDays?round(100*x.founder.groupDays/x.founder.lifeDays,1):0
    }:null
   })),
   selected:members.filter(e=>e.parentId===null).sort((a,b)=>{
    const count=r=>members.filter(x=>x.rootId===r.id&&x.alive).length;
    return count(b)-count(a);
   }).slice(0,7).map(r=>({id:r.id,traits:r.traits,children:r.children.length,
    foodEnergy:round(r.foodEnergy,1),groupPct:r.lifeDays?round(100*r.groupDays/r.lifeDays,1):0,
    aliveDescendants:members.filter(x=>x.rootId===r.id&&x.alive).length
   }))
  };
  fs.writeFileSync(path.join(OUT,'families.json'),JSON.stringify(familyData,null,2));
 }
 save('frames-'+mode,trajectories[mode]);
 console.log('REPRESENTATIVE',mode,'day',sim.day,'counts',JSON.stringify(sim.counts()),'frames',frames.length);
}
fs.writeFileSync(path.join(OUT,'representative.json'),JSON.stringify({seed:START,finals,daily},null,2));
// Paired seed experiment. 30 seeds × 3 modes, 100 days each.  No lineage archive for speed.
const SEEDS=30,from=20265000,results=[];
for(let i=0;i<SEEDS;i++){
 const seed=from+i,byMode={};
 for(const [mode] of MODES){
  const sim=new Lab({seed,green:100,red:20,blue:0,mode,trackLineages:false,duration:100,variance:10,regrowth:100});
  sim.aiLog=function(){};
  sim.run(100,.08);
  const counts=sim.counts();
  const hist=sim.history.map(h=>({day:h.day,g:h.g,r:h.r,
   ai2GeneGather:h.ai2GeneGather??null,ai2GeneAlign:h.ai2GeneAlign??null,
   ai2GeneSeparate:h.ai2GeneSeparate??null,ai2GroupedPct:h.ai2GroupedPct??null}));
  byMode[mode]={seed,g:counts.g,r:counts.r,
   alive:gcount(counts.g),coexist:gcount(counts.g)&&gcount(counts.r),
   births:sim.stats.births.g,hunted:sim.stats.deaths.g.hunt,
   starved:sim.stats.deaths.g.starve,history:hist};
 }
 results.push({seed,byMode});
 if(i%5===0||i===SEEDS-1)console.log('BATCH',i+1,'/',SEEDS);
}
function gcount(n){return Number(n>0)}
const summary={n:SEEDS,seedFrom:from,seedTo:from+SEEDS-1,modes:{}};
for(const [mode] of MODES){
 const a=results.map(r=>r.byMode[mode]);
 summary.modes[mode]={
  green:round(mean(a.map(x=>x.g))),red:round(mean(a.map(x=>x.r))),
  green_p10:round(quant(a.map(x=>x.g),.1)),green_p90:round(quant(a.map(x=>x.g),.9)),
  survive:a.reduce((x,r)=>x+r.alive,0),coexist:a.reduce((x,r)=>x+r.coexist,0),
  births:round(mean(a.map(x=>x.births))),hunted:round(mean(a.map(x=>x.hunted))),
  starved:round(mean(a.map(x=>x.starved)))
 };
}
const keys=['g','r','ai2GeneGather','ai2GeneAlign','ai2GeneSeparate','ai2GroupedPct'];
summary.daily={};
for(const [mode] of MODES){
 const a=results.map(r=>r.byMode[mode]);
 summary.daily[mode]=Array.from({length:101},(_,d)=>{
  const values={day:d};
  for(const key of keys){
   const b=a.map(x=>x.history[d]?.[key]).filter(Number.isFinite);
   values[key]=b.length?round(mean(b),4):null;
   values[key+'_p10']=b.length?round(quant(b,.1),4):null;
   values[key+'_p90']=b.length?round(quant(b,.9),4):null;
   values[key+'_n']=b.length;
  }
  return values;
 });
}
const delta=results.map(r=>r.byMode.social.g-r.byMode.escape.g);
summary.paired={mean:round(mean(delta)),n:SEEDS};
fs.writeFileSync(path.join(OUT,'batch-30-seed.json'),JSON.stringify(summary,null,2));
fs.writeFileSync(path.join(OUT,'batch-seed-final.csv'),[
 'seed,mode,green,red,births,hunted,starved,coexist',
 ...results.flatMap(r=>MODES.map(([k])=>{
  const a=r.byMode[k];return [r.seed,k,a.g,a.r,a.births,a.hunted,a.starved,a.coexist].join(',');
 }))
].join('\n'));
console.log('EXPORT_DONE',JSON.stringify(summary.modes),'paired',summary.paired);
