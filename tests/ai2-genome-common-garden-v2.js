'use strict';
/* AI② social-neural common-garden genetic validation.
 * Extract genomes at DAY0/30/60/100, transplant only the FOCAL green genome
 * into fixed peer, grass and red settings. Do not train on assay outcomes.
 *
 * Run: node tests/ai2-genome-common-garden.js <offset> <count> <seedBase>
 * THREE parent-to-offspring modes:
 * evolve: heritable mutation as released AI2.
 * clone: inheritable but no mutations (existing selection from founder pool).
 * noninherited: birth gets a deterministic random founder brain, not parent brain.
 */
const {Lab,SPECIES,BRAIN_SIZE}=require('../src/sim-core.js');
const assert=require('node:assert/strict'),fs=require('node:fs');
const OFFSET=Number(process.argv[2]??0),COUNT=Number(process.argv[3]??2),BASE=Number(process.argv[4]??20485001);
assert.ok(Number.isInteger(OFFSET)&&OFFSET>=0&&Number.isInteger(COUNT)&&COUNT>=1&&COUNT<=10);
assert.ok(Number.isInteger(BASE)&&BASE>0);
const DAYS=[0,30,60,100],MODES=['evolve','clone','noninherited'],SAMPLE=8,DT=.08,ASSAY_DAYS=2.4;
const SCENES=[
 // All distances calibrated ONLY on independent DAY0 founder brains seed 20472001:
 // 2.4-day formation succeeds in ~19%-65% of trials instead of near zero.
 {name:'formation-east',group:[[75,0],[88,20],[78,-22],[101,7]],heading:0,freezePeers:true},
 {name:'formation-west',group:[[-75,0],[-88,20],[-78,-22],[-101,7]],heading:Math.PI,freezePeers:true},
 {name:'formation-diagonal',group:[[56,53],[68,60],[49,70],[75,65]],heading:-.5,freezePeers:true},
 {name:'crowd-separation',group:[[29,1],[38,18],[-32,-12],[-10,34]],heading:1.1,freezePeers:true},
 // Force predator to initially target the focal green; otherwise red chases static peers
 // and no-hit rate saturates at 100%, invalidating the safety measurement.
 {name:'red-east-group-west',group:[[-82,0],[-95,25],[-76,-25],[-116,-4]],heading:Math.PI,freezePeers:false,red:[124,10]},
 {name:'red-west-group-east',group:[[83,0],[103,20],[72,-30],[120,-6]],heading:0,freezePeers:false,red:[-126,-5]}
];
function hash(a,b,c=0){let v=(a^Math.imul(b+1,0x9e3779b1)^Math.imul(c+1,0x85ebca6b))>>>0;
 v=Math.imul(v^(v>>>16),0x7feb352d);v=Math.imul(v^(v>>>15),0x846ca68b);return(v^(v>>>16))>>>0}
function choose(entities,seed,day){
 return entities.slice().sort((a,b)=>hash(seed,a.id,day)-hash(seed,b.id,day)||a.id-b.id).slice(0,SAMPLE);
}
const mean=(items,fn)=>items.length?items.reduce((s,x)=>s+fn(x),0)/items.length:null;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function trial(genome,scene,sceneIndex){
 const lab=new Lab({seed:770301+sceneIndex*419,green:5,red:scene.red?1:0,blue:0,
  mode:'social',socialEnabled:true,variance:0,regrowth:100,duration:ASSAY_DAYS,escapePolicy:'wide'});
 lab.aiLog=function(){};
 const greens=lab.entities.filter(e=>e.type==='g'),f=greens[0],peers=greens.slice(1),red=lab.entities.find(e=>e.type==='r');
 assert.equal(genome.length,BRAIN_SIZE);
 const cx=480,cy=300;
 function body(e,x,y,angle){
  Object.assign(e,{x,y,angle,age:5,life:24,energy:85,
   hp:SPECIES.g.hp,maxhp:SPECIES.g.hp,attack:SPECIES.g.attack,
   speed:SPECIES.g.speed,view:SPECIES.g.view,temperament:'normal',
   lastBirth:999,lastCounter:999,turnAt:0});
 }
 body(f,cx,cy,0);f.genome=genome.slice();f.generation=3;
 peers.forEach((e,j)=>body(e,cx+scene.group[j][0],cy+scene.group[j][1],scene.heading));
 if(red)Object.assign(red,{x:cx+scene.red[0],y:cy+scene.red[1],age:8,life:38,
  hp:SPECIES.r.hp,maxhp:SPECIES.r.hp,energy:47,
  speed:SPECIES.r.speed,view:SPECIES.r.view,
  lastBirth:999,temperament:'careful',angle:0,targetId:f.id});
 lab.grass.fill(.75);
 if(scene.freezePeers){
  const move=lab.move;
  lab.move=function(e,...rest){if(peers.includes(e))return;return move.call(this,e,...rest)};
 }
 let focalHit=0,firstFocalHit=ASSAY_DAYS;
 const hit=lab.aiEncounterHit;
 lab.aiEncounterHit=function(target,predator){if(target===f){focalHit++;firstFocalHit=Math.min(firstFocalHit,this.day)}return hit.call(this,target,predator)};
 const startDist=Math.hypot(f.x-mean(peers,x=>x.x),f.y-mean(peers,x=>x.y));
 let nearSum=0,grouped=0,alignSum=0,alignN=0,close=0,ticks=0,energySum=0;
 const steps=Math.round(ASSAY_DAYS/DT);
 for(let step=0;step<steps;step++){
  lab.update(DT);
  if(!f.alive)break;
  ticks++;
  let near=0,minDistance=Infinity;
  for(const other of peers){
   if(!other.alive)continue;
   const d=Math.hypot(f.x-other.x,f.y-other.y);
   minDistance=Math.min(minDistance,d);
   if(d<65)near++;
   if(d<115){alignSum+=Math.cos(f.angle-other.angle);alignN++}
  }
  nearSum+=near;
  if(near>=2)grouped++;
  if(minDistance<20)close++;
  energySum+=f.energy;
 }
 const nowPeers=peers.filter(p=>p.alive);
 const endDist=nowPeers.length?
  Math.hypot(f.x-mean(nowPeers,x=>x.x),f.y-mean(nowPeers,x=>x.y)):startDist;
 return {
  groupPct:ticks?100*grouped/ticks:0,
  meanNear:ticks?nearSum/ticks:0,
  alignment:alignN?alignSum/alignN:null,
  approachPx:startDist-endDist,
  crowdPct:ticks?100*close/ticks:0,
  noFocalHit:focalHit===0?1:0,
  focalHits:focalHit,
  firstFocalHit,
  alive:f.alive?1:0,
  meanEnergy:ticks?energySum/ticks:0,
  finalEnergy:f.energy,
  ticks
 };
}
function assay(entities,seed,day){
 const sample=choose(entities,seed,day);
 const scores=[];
 for(const green of sample){
  const result=SCENES.map((scene,k)=>trial(green.genome,scene,k));
  const formations=result.slice(0,3),crowd=result[3],danger=result.slice(4);
  scores.push({
   id:green.id,generation:green.generation,
   formationGroupPct:mean(formations,x=>x.groupPct),
   formationNear:mean(formations,x=>x.meanNear),
   formationApproachPx:mean(formations,x=>x.approachPx),
   formationAlignment:mean(formations.filter(x=>x.alignment!==null),x=>x.alignment)??0,
   crowdClosePct:crowd.crowdPct,
   crowdNearestPct:crowd.groupPct,
   dangerNoHitPct:100*mean(danger,x=>x.noFocalHit),
   dangerFirstHitTime:mean(danger,x=>x.firstFocalHit),
   dangerAlivePct:100*mean(danger,x=>x.alive),
   dangerGroupPct:mean(danger,x=>x.groupPct),
   dangerFinalEnergy:mean(danger,x=>x.finalEnergy)
  });
 }
 const metrics=['formationGroupPct','formationNear','formationApproachPx','formationAlignment',
  'crowdClosePct','crowdNearestPct','dangerNoHitPct','dangerFirstHitTime','dangerAlivePct','dangerGroupPct','dangerFinalEnergy'];
 return {
  population:entities.length,sampled:sample.length,
  meanGeneration:mean(entities,x=>x.generation),
  meanSampleGeneration:mean(sample,x=>x.generation),
  scores,
  ...Object.fromEntries(metrics.map(k=>[k,mean(scores,x=>x[k])]))
 };
}
function world(seed,mode){
 const lab=new Lab({seed,green:100,red:20,blue:0,mode:'social',
  escapePolicy:'wide',socialEnabled:true,variance:10,regrowth:100,duration:100});
 lab.aiLog=function(){};
 const founders=lab.entities.filter(e=>e.type==='g').map(e=>e.genome.slice());
 if(mode==='clone'){
  const original=lab.mutateBrain;
  lab.mutateBrain=function(parent){original.call(this,parent);return parent.genome.slice()};
 }else if(mode==='noninherited'){
  const original=lab.spawn;
  lab.spawn=function(type,x,y,initial=false,parent=null){
   const child=original.call(this,type,x,y,initial,parent);
   if(type==='g'&&!initial&&parent)child.genome=founders[hash(seed,child.id)%founders.length].slice();
   return child;
  };
 }
 const checkpoints={};
 for(const day of DAYS){
  if(lab.day<day)lab.run(day,DT);
  checkpoints[day]=assay(lab.entities.filter(e=>e.alive&&e.type==='g'),seed,day);
 }
 const n=lab.counts();
 return {checkpoints,finalGreen:n.g,finalRed:n.r,
  greenAlive:n.g>0,coexist:n.g>0&&n.r>0,
  greenBirths:lab.stats.births.g,hunted:lab.stats.deaths.g.hunt,
  starved:lab.stats.deaths.g.starve,mutatedOffspring:lab.stats.ai.mutatedOffspring};
}
const samples=[];
for(let i=0;i<COUNT;i++){
 const seed=BASE+OFFSET+i,row={seed};
 for(const mode of MODES)row[mode]=world(seed,mode);
 assert.deepEqual(row.evolve.checkpoints[0].scores,row.clone.checkpoints[0].scores,
  'Initial genomes must be identical in mutation-on and mutation-off controls');
 assert.deepEqual(row.evolve.checkpoints[0].scores,row.noninherited.checkpoints[0].scores,
  'Initial genomes must match no-inheritance control');
 samples.push(row);
 console.error('AI2_COMMON_GARDEN',i+1,'/',COUNT,'seed',seed,
  MODES.map(m=>m+':'+row[m].finalGreen+'g '+(row[m].checkpoints[100].formationGroupPct??'NA')).join('; '));
}
const dir='reports/ai2-genome-common-garden-v2-raw';fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(dir+'/shard-'+OFFSET+'.json',JSON.stringify({
 version:2,seedBase:BASE,offset:OFFSET,count:COUNT,
 checkpoints:DAYS,modes:MODES,samplePerWorldCheckpoint:SAMPLE,
 daysPerAssay:ASSAY_DAYS,scenes:SCENES,
 interpretation:'Sensitivity calibrated using founder-only seed 20472001 before examining v2 outcomes. Fixed focal physiology, peers, predator starts and grass for each transferred genome. Three no-predator social formation scenes, one crowd-avoidance scene and two predator-encounter scenes. Four peer brains are fixed initial references per scene. No breeding in the assay.',
 samples}));
console.log('AI2_GENOME_SHARD_BEGIN');console.log(JSON.stringify({offset:OFFSET,count:COUNT,first:samples[0].seed,last:samples.at(-1).seed}));console.log('AI2_GENOME_SHARD_END');
