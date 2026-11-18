'use strict';
/*
 * AI1 inherited-genome evolution test.
 * Each sampled genome is removed from its original ecology and evaluated in
 * IDENTICAL "common garden" pursuit arenas. This tests transfer of escape
 * performance, not just success of a crowded ecology.
 *
 * node tests/ai1-evolution-study.js <offset> <count> <baseSeed>
 *
 * Main controls:
 *   evolve: offspring inherit mutated parental genome (current AI1)
 *   clone:  offspring inherit identical parental genome (selection, no new mutation)
 *   random: offspring inherit a deterministic random founder brain (no parent->child inheritance)
 *
 * The three modes consume the normal mutation PRNG draws; sampling and
 * common-garden assays never consume the ecology's PRNG stream.
 */
const {Lab,SPECIES,BRAIN_SIZE,neuralForward}=require('../src/sim-core.js');
const assert=require('node:assert/strict'),fs=require('node:fs');
const offset=Number(process.argv[2]??0),count=Number(process.argv[3]??5);
const seedBase=Number(process.argv[4]??20350001);
const MODEL=process.argv[5]??'baseline';
assert.ok(['baseline','express','survivor','hybrid','hybridStrong'].includes(MODEL),'Unknown AI1 research model');
assert.ok(Number.isInteger(offset)&&offset>=0);
assert.ok(Number.isInteger(count)&&count>=1&&count<=20);
assert.ok(Number.isInteger(seedBase)&&seedBase>0);
const DAYS=[0,30,60,100],MODES=['evolve','clone','random'];
const SAMPLE=Number(process.argv[6]??10);
assert.ok(Number.isInteger(SAMPLE)&&SAMPLE>=4&&SAMPLE<=20);
const DT=.08,HORIZON=2;
const ARENAS=[
 // Difficulty calibrated solely on DAY0 founder brains from separate seed 20334001.
 // A 2-day encounter gives nontrivial success in all areas (avoids the 3-day floor).
 {name:'center-east-116',x:480,y:300,dx:116,dy:0,energy:80,grass:.65},
 {name:'center-west-116',x:480,y:300,dx:-116,dy:0,energy:80,grass:.65},
 {name:'center-north-124',x:480,y:300,dx:0,dy:-124,energy:80,grass:.65},
 {name:'center-south-124',x:480,y:300,dx:0,dy:124,energy:80,grass:.65},
 {name:'near-left-east-160',x:215,y:300,dx:160,dy:0,energy:80,grass:.65},
 {name:'near-right-west-170',x:745,y:300,dx:-170,dy:0,energy:80,grass:.65},
 {name:'diagonal-southeast-115',x:480,y:300,dx:82,dy:82,energy:80,grass:.65},
 {name:'diagonal-southeast-127',x:480,y:300,dx:90,dy:90,energy:80,grass:.65}
];
const sensoryReference=[-.45,.15,1,0,.65,.75,.9,0,0,.65];
function hash(a,b,c){
 let v=(a^Math.imul(b+1,0x9e3779b1)^Math.imul(c+1,0x85ebca6b))>>>0;
 v=Math.imul(v^(v>>>16),0x7feb352d);v=Math.imul(v^(v>>>15),0x846ca68b);
 return (v^(v>>>16))>>>0;
}
function choose(agents,seed,day){
 return [...agents].sort((a,b)=>hash(seed,day,a.id)-hash(seed,day,b.id)||a.id-b.id).slice(0,SAMPLE);
}
function trial(genome,scene,index){
 const lab=new Lab({seed:890001+index*971,green:1,red:1,blue:0,
  variance:0,regrowth:100,mode:'escape',escapePolicy:'wide',selectionModel:MODEL,duration:HORIZON});
 lab.aiLog=function(){};
 const green=lab.entities.find(a=>a.type==='g'),red=lab.entities.find(a=>a.type==='r');
 assert.equal(genome.length,BRAIN_SIZE);
 Object.assign(green,{
  genome:genome.slice(),generation:2,age:5,life:24,
  x:scene.x,y:scene.y,energy:scene.energy,
  hp:SPECIES.g.hp,maxhp:SPECIES.g.hp,speed:SPECIES.g.speed,view:SPECIES.g.view,
  angle:0,temperament:'normal',lastBirth:999,lastCounter:999
 });
 Object.assign(red,{
  x:scene.x+scene.dx,y:scene.y+scene.dy,
  age:9,life:38,energy:54,
  hp:SPECIES.r.hp,maxhp:SPECIES.r.hp,speed:SPECIES.r.speed,view:SPECIES.r.view,
  angle:0,temperament:'careful',lastBirth:999
 });
 // Identical food field, position, physiology, predator and update times.
 lab.grass.fill(scene.grass);
 let hitAt=null;
 const update=lab.update;
 lab.update=function(dt){
  const before=this.stats.strikes.r;
  const result=update.call(this,dt);
  if(hitAt===null&&this.stats.strikes.r>before)hitAt=this.day;
  return result;
 };
 lab.run(HORIZON,DT);
 return {noHit:hitAt===null?1:0,
  timeToHit:hitAt===null?HORIZON:hitAt,
  greenAlive:green.alive?1:0,
  redHunts:lab.stats.hunts.r,
  finalEnergy:green.energy
 };
}
function assay(agents,seed,day){
 const selected=choose(agents,seed,day);
 const scores=[];
 const refSignals=[];
 const byArena=Object.fromEntries(ARENAS.map(x=>[x.name,{unhit:0,time:0,n:0}]));
 for(const a of selected){
  refSignals.push(neuralForward(a.genome,sensoryReference));
  let noHit=0,time=0,alive=0,energy=0,hunts=0;
  for(let j=0;j<ARENAS.length;j++){
   const tr=trial(a.genome,ARENAS[j],j);
   noHit+=tr.noHit;time+=tr.timeToHit;alive+=tr.greenAlive;energy+=tr.finalEnergy;hunts+=tr.redHunts;
   byArena[ARENAS[j].name].unhit+=tr.noHit;
   byArena[ARENAS[j].name].time+=tr.timeToHit;
   byArena[ARENAS[j].name].n++;
  }
  scores.push({id:a.id,generation:a.generation,
   noHitPct:100*noHit/ARENAS.length,
   timeToHit:time/ARENAS.length,
   survivedPct:100*alive/ARENAS.length,
   predatorAcquisitions:hunts/ARENAS.length,
   finalEnergy:energy/ARENAS.length
  });
 }
 const mean=(arr,fn)=>arr.length?arr.reduce((sum,x)=>sum+fn(x),0)/arr.length:null;
 const scoreVar=(items,key)=>items.length?mean(items,x=>(x[key]-mean(items,y=>y[key]))**2):null;
 return {
  alivePopulation:agents.length,sampled:selected.length,
  sampledFounderCount:selected.filter(x=>x.generation===0).length,
  meanGeneration:mean(agents,a=>a.generation),
  meanSampleGeneration:mean(selected,a=>a.generation),
  maxGeneration:agents.length?Math.max(...agents.map(x=>x.generation)):null,
  brainUrge:mean(refSignals,s=>s[2]),
  brainTurn:mean(refSignals,s=>s[0]),
  meanNoHitPct:mean(scores,x=>x.noHitPct),
  meanTimeToHit:mean(scores,x=>x.timeToHit),
  meanSurvivedPct:mean(scores,x=>x.survivedPct),
  withinGenomeVariance:scoreVar(scores,'noHitPct'),
  byArena:Object.fromEntries(Object.entries(byArena).map(([k,v])=>[k,{noHitPct:v.n?100*v.unhit/v.n:null,meanTime:v.n?v.time/v.n:null}])),
  sampledScores:scores
 };
}
function world(seed,mode){
 const lab=new Lab({seed,green:100,red:20,blue:0,mode:'escape',
  escapePolicy:'wide',selectionModel:MODEL,regrowth:100,variance:10,duration:100});
 lab.aiLog=function(){};
 const founders=lab.entities.filter(x=>x.type==='g').map(x=>x.genome.slice());
 if(mode==='clone'){
  const original=lab.mutateBrain;
  lab.mutateBrain=function(parent){original.call(this,parent);return parent.genome.slice();};
 }else if(mode==='random'){
  const originalSpawn=lab.spawn;
  lab.spawn=function(type,x,y,initial=false,parent=null){
   const child=originalSpawn.call(this,type,x,y,initial,parent);
   if(type==='g'&&!initial&&parent){
    // Disrupt parent-child inheritance, but only draw from the SAME founder pool.
    const choice=hash(seed,child.id,0)%founders.length;
    child.genome=founders[choice].slice();
   }
   return child;
  };
 }
 const checkpoints={};
 for(const day of DAYS){
  if(day>lab.day)lab.run(day,DT);
  checkpoints[day]=assay(lab.entities.filter(e=>e.type==='g'&&e.alive),seed,day);
 }
 const n=lab.counts();
 return {
  checkpoints,finalGreen:n.g,finalRed:n.r,
  highestGeneration:lab.stats.ai.highestGeneration,
  births:lab.stats.births.g,hunted:lab.stats.deaths.g.hunt,
  starved:lab.stats.deaths.g.starve,mutatedOffspring:lab.stats.ai.mutatedOffspring
 };
}
const samples=[];
for(let i=0;i<count;i++){
 const seed=seedBase+offset+i;
 const result={seed};
 for(const mode of MODES)result[mode]=world(seed,mode);
 const a=result.evolve.checkpoints[0],b=result.clone.checkpoints[0],c=result.random.checkpoints[0];
 assert.deepEqual(a.sampledScores,b.sampledScores,'Control groups must have exactly matching DAY0 genomes and scores');
 assert.deepEqual(a.sampledScores,c.sampledScores,'Non-inheritance group must match initial founders');
 samples.push(result);
 console.error('EVO-STUDY',offset+i+1,'/',offset+count,'seed',seed,
   'N100:',MODES.map(k=>k+'='+result[k].finalGreen).join(' '));
}
fs.mkdirSync('reports/selection-exploration/'+MODEL,{recursive:true});
const path='reports/selection-exploration/'+MODEL+'/shard-'+offset+'.json';
const doc={
 version:3,selectionModel:MODEL,seedBase,offset,count,dt:DT,days:DAYS,
 samplePerCheckpoint:SAMPLE,arenaHorizon:HORIZON,arenas:ARENAS,MODES,
 caveat:'Experimental intervention includes engineered selective breeding bonus for verified red-chase escape in survivor/hybrid models, plus stronger neural expression in express/hybrid models. It is not spontaneous learning. Standardized common-garden assays cannot alone prove entire ecosystem fitness advantage.',
 samples
};
fs.writeFileSync(path,JSON.stringify(doc));
console.log('AI1_EVOLUTION_SHARD_BEGIN');
console.log(JSON.stringify({offset,count,from:samples[0].seed,to:samples.at(-1).seed,filename:path}));
console.log('AI1_EVOLUTION_SHARD_END');
