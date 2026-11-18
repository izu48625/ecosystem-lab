'use strict';
/*
 * Controlled GA selective-breeding experiment using actual red predator attack.
 * This is artificial selection / genetic training, NOT autonomous
 * evolution proven inside the unmodified ecology.
 *
 * node tests/ai1-genetic-training.js <offset> <count> <seedBase>
 */
const fs=require('node:fs'),assert=require('node:assert/strict');
const {Lab,SPECIES,BRAIN_SIZE}=require('../src/sim-core.js');
const OFFSET=Number(process.argv[2]??0),COUNT=Number(process.argv[3]??2),BASE=Number(process.argv[4]??20360001);
assert.ok(Number.isInteger(OFFSET)&&OFFSET>=0&&Number.isInteger(COUNT)&&COUNT>=1&&COUNT<=10&&Number.isInteger(BASE));
const N=30,GENS=12,TRAIN_SCENES=5,TEST_SCENES=8,HORIZON=2,DT=.08;
const ARMS=['genetic','clonal','drift'];
function rng(seed){
 let state=seed>>>0;return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
}
function scenes(seed,count){
 const rand=rng(seed),list=[];
 for(let i=0;i<count;i++){
  const theta=(i%5)*Math.PI*2/5+(rand()-.5)*.45;
  const dist=112+rand()*41;
  const x=170+rand()*620,y=140+rand()*320;
  list.push({id:i,x,y,dx:Math.cos(theta)*dist,dy:Math.sin(theta)*dist,energy:80,grass:.65,seed:62000+i*23});
 }
 return list;
}
function encounter(genome,scene){
 const lab=new Lab({seed:scene.seed,green:1,red:1,blue:0,
  variance:0,regrowth:100,mode:'escape',selectionModel:'express',escapePolicy:'wide',duration:HORIZON});
 lab.aiLog=()=>{};
 const green=lab.entities.find(x=>x.type==='g'),red=lab.entities.find(x=>x.type==='r');
 assert.equal(genome.length,BRAIN_SIZE);
 Object.assign(green,{x:scene.x,y:scene.y,genome:genome.slice(),generation:4,
  age:5,life:24,energy:scene.energy,hp:SPECIES.g.hp,maxhp:SPECIES.g.hp,
  attack:SPECIES.g.attack,speed:SPECIES.g.speed,view:SPECIES.g.view,
  angle:0,temperament:'normal',lastBirth:999,lastCounter:999});
 Object.assign(red,{x:scene.x+scene.dx,y:scene.y+scene.dy,
  age:9,life:38,energy:54,hp:SPECIES.r.hp,maxhp:SPECIES.r.hp,
  attack:SPECIES.r.attack,speed:SPECIES.r.speed,view:SPECIES.r.view,
  angle:0,temperament:'careful',lastBirth:999});
 lab.grass.fill(scene.grass);
 let time=HORIZON;
 const update=lab.update;
 lab.update=function(dt){
  const previous=this.stats.strikes.r;
  const v=update.call(this,dt);
  if(time===HORIZON&&this.stats.strikes.r>previous)time=this.day;
  return v;
 };
 lab.run(HORIZON,DT);
 return {noHit:lab.stats.strikes.r===0?1:0,time};
}
function benchmark(brains,cases){
 const scores=[];
 for(const genome of brains){
  let safe=0,time=0;
  for(const c of cases){const x=encounter(genome,c);safe+=x.noHit;time+=x.time}
  const noHit=safe/cases.length,hitDelay=time/cases.length;
  scores.push({noHit,hitDelay,fitness:noHit+.25*hitDelay/HORIZON});
 }
 return scores;
}
function snapshot(brains,testCases){
 const scores=benchmark(brains,testCases);
 const avg=k=>scores.reduce((s,x)=>s+x[k],0)/scores.length;
 return {meanNoHitPct:100*avg('noHit'),meanTimeToHit:avg('hitDelay'),
   meanFitness:avg('fitness'),bestNoHitPct:100*Math.max(...scores.map(s=>s.noHit)),
   bestFitness:Math.max(...scores.map(s=>s.fitness)),population:brains.length};
}
function evolveOnce(brains,arm,trainingCases,random){
 const scores=benchmark(brains,trainingCases);
 const ordered=brains.map((genome,i)=>({genome,score:scores[i].fitness,index:i}))
  .sort((a,b)=>b.score-a.score||a.index-b.index);
 // Elitism is identical for the genetic and clonal selection arms.
 const next=[];
 if(arm!=='drift')for(let k=0;k<3;k++)next.push(ordered[k].genome.slice());
 const pool=ordered.slice(0,Math.ceil(N*.30)).map(o=>o.genome);
 while(next.length<N){
  let p1,p2;
  if(arm==='drift'){
   p1=brains[Math.floor(random()*brains.length)];
   p2=brains[Math.floor(random()*brains.length)];
  }else{
   p1=pool[Math.floor(random()*pool.length)];
   p2=pool[Math.floor(random()*pool.length)];
  }
  const child=p1.map((w,i)=>random()<.30?p2[i]:w);
  if(arm!=='clonal'){
   for(let i=0;i<child.length;i++){
    if(random()<.07)child[i]=Math.max(-3,Math.min(3,child[i]+(random()*2-1)*.32));
   }
  }
  next.push(child);
 }
 return next;
}
function ecology(seed,brainPool){
 const lab=new Lab({seed:seed^0x13428d0b,green:100,red:20,blue:0,
  mode:'escape',escapePolicy:'wide',selectionModel:'express',
  duration:100,regrowth:100,variance:10});
 lab.aiLog=()=>{};
 const greens=lab.entities.filter(e=>e.type==='g');
 for(let i=0;i<greens.length;i++)greens[i].genome=brainPool[i%brainPool.length].slice();
 lab.run(100,.08);
 const count=lab.counts();
 return {greenAlive:count.g>0,redAlive:count.r>0,finalGreen:count.g,finalRed:count.r,
  greenHunted:lab.stats.deaths.g.hunt,greenStarved:lab.stats.deaths.g.starve,
  births:lab.stats.births.g};
}
function one(seed){
 const genesis=new Lab({seed,green:N,red:0,blue:0,mode:'escape',selectionModel:'express'});
 const founders=genesis.entities.map(e=>e.genome.slice());
 const testCases=scenes(seed^0x3b91ac51,TEST_SCENES);
 const armData={};
 for(let a=0;a<ARMS.length;a++){
  const arm=ARMS[a],random=rng(seed^Math.imul(a+1,0x9e3779b1));
  let brains=founders.map(b=>b.slice());
  const history=[];
  for(let gen=0;gen<=GENS;gen++){
   if(gen===0||gen===4||gen===8||gen===12){
    history.push({generation:gen,...snapshot(brains,testCases)});
   }
   if(gen<GENS){
    const trainingCases=scenes(seed^Math.imul(gen+1,0x7f4a7c15),TRAIN_SCENES);
    brains=evolveOnce(brains,arm,trainingCases,random);
   }
  }
  armData[arm]={history,ecology:ecology(seed,brains),
   bestGenome:brains[0],finalBrainMean:brains.reduce((s,g)=>s+g.reduce((a,b)=>a+b,0)/g.length,0)/N};
 }
 // Also evaluate untouched released AI1 under exact same ecology seed.
 const controlLab=new Lab({seed:seed^0x13428d0b,green:100,red:20,blue:0,mode:'escape',escapePolicy:'wide'});
 controlLab.aiLog=()=>{};controlLab.run(100,.08);
 const nc=controlLab.counts();
 const released={greenAlive:nc.g>0,redAlive:nc.r>0,finalGreen:nc.g,finalRed:nc.r,
  greenHunted:controlLab.stats.deaths.g.hunt,greenStarved:controlLab.stats.deaths.g.starve,births:controlLab.stats.births.g};
 assert.deepEqual(armData.genetic.history[0],armData.clonal.history[0]);
 assert.deepEqual(armData.genetic.history[0],armData.drift.history[0]);
 return {seed,arms:armData,released};
}
const samples=[];
for(let i=0;i<COUNT;i++){
 const seed=BASE+OFFSET+i,result=one(seed);
 samples.push(result);
 console.error('GA_TRAIN',i+1,'/',COUNT,'seed',seed,'holdout no-hit',ARMS.map(a=>a+':'+result.arms[a].history.at(-1).meanNoHitPct.toFixed(2)).join(', '));
}
fs.mkdirSync('reports/ga-training',{recursive:true});
const path='reports/ga-training/shard-'+OFFSET+'.json';
fs.writeFileSync(path,JSON.stringify({version:1,offset:OFFSET,count:COUNT,base:BASE,population:N,generations:GENS,
 trainingScenes:TRAIN_SCENES,heldoutScenes:TEST_SCENES,horizonDays:HORIZON,arms:ARMS,samples}));
console.log('GENETIC_TRAINING_BEGIN');console.log(JSON.stringify({offset:OFFSET,count:COUNT,from:samples[0].seed,to:samples.at(-1).seed,path}));console.log('GENETIC_TRAINING_END');
