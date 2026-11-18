'use strict';
/*
 * Ecological transfer experiment for predator-trained elite brain.
 * Use exactly unchanged released AI1 (wide). Seed 10/25/50% founders with
 * a genome trained outside the ecology. All other species/biology unchanged.
 * At fixed fraction compare elite founder clone against random-founder clone.
 *
 * node tests/ai1-elite-ecology.js <offset> <count> <baseSeed>
 */
const fs=require('node:fs'),assert=require('node:assert/strict');
const {Lab,BRAIN_SIZE,SPECIES}=require('../src/sim-core.js');
const OFFSET=Number(process.argv[2]??0),COUNT=Number(process.argv[3]??5),BASE=Number(process.argv[4]??20370001);
assert.ok(Number.isInteger(OFFSET)&&OFFSET>=0&&Number.isInteger(COUNT)&&COUNT>=1&&COUNT<=10);
const MODES=['released','random10','random25','random50','elite10','elite25','elite50'];
function hash(seed,v){
 let x=(seed^Math.imul(v,0x9e3779b1))>>>0;
 x=Math.imul(x^(x>>>16),0x7feb352d);x=Math.imul(x^(x>>>15),0x846ca68b);
 return (x^(x>>>16))>>>0;
}
function world(seed,arm,elite){
 const options={seed:seed^0x13428d0b,green:100,red:20,blue:0,mode:'escape',escapePolicy:'wide',
  duration:100,regrowth:100,variance:10};
 const lab=new Lab(options);
 lab.aiLog=()=>{};
 const green=lab.entities.filter(e=>e.type==='g');
 const initialGenomes=green.map(e=>e.genome.slice());
 if(arm!=='released'){
  assert.equal(elite.length,BRAIN_SIZE);
  const n=arm.endsWith('10')?10:arm.endsWith('50')?50:25;
  // The control genome comes from the same initial founder pool as the trained elite.
  const reference=new Lab({seed,green:30,red:0,blue:0,mode:'escape'});
  const founders=reference.entities.filter(e=>e.type==='g');
  const genome=arm.startsWith('random')?founders[hash(seed,91221)%founders.length].genome:elite;
  const chosen=[...green].sort((a,b)=>hash(seed,a.id)-hash(seed,b.id)||a.id-b.id).slice(0,n);
  for(const e of chosen){e.genome=genome.slice();e.trainedLineage=true;}
  const originalSpawn=lab.spawn;
  lab.spawn=function(type,x,y,initial=false,parent=null){
   const child=originalSpawn.call(this,type,x,y,initial,parent);
   if(type==='g'&&parent?.trainedLineage)child.trainedLineage=true;
   return child;
  };
 }
 const history=[];
 for(const day of [0,30,60,100]){
  if(day>lab.day)lab.run(day,.08);
  const all=lab.entities.filter(e=>e.alive&&e.type==='g');
  const greenTagged=all.filter(e=>e.trainedLineage).length;
  history.push({day,green:all.length,red:lab.counts().r,
   tagged:greenTagged,tagPct:all.length?100*greenTagged/all.length:null});
 }
 const count=lab.counts();
 return {
  aliveGreen:count.g>0,coexist:count.g>0&&count.r>0,
  green:count.g,red:count.r,
  births:lab.stats.births.g,hunted:lab.stats.deaths.g.hunt,
  starved:lab.stats.deaths.g.starve,
  starvePer100GreenDays:100*lab.stats.deaths.g.starve/Math.max(1,lab.stats.individualDays.g),
  lineage:history
 };
}
function trainingSample(seed){
 const offset=Math.floor((seed-BASE)/5)*5;
 const path='reports/ga-training/shard-'+offset+'.json';
 const data=JSON.parse(fs.readFileSync(path,'utf8'));
 const row=data.samples.find(r=>r.seed===seed);
 assert.ok(row,'Missing trained brain for '+seed);
 return row;
}
const samples=[];
for(let i=0;i<COUNT;i++){
 const seed=BASE+OFFSET+i;
 const orig=trainingSample(seed),elite=orig.arms.genetic.bestGenome;
 const arms={};
 for(const a of MODES)arms[a]=world(seed,a,elite);
 samples.push({seed,trainingHoldoutNoHitPct:orig.arms.genetic.history.at(-1).meanNoHitPct,arms});
 console.error('ELITE_ECO',i+1,'/',COUNT,'seed',seed,MODES.map(a=>a+':'+samples.at(-1).arms[a].green+'/'+samples.at(-1).arms[a].red).join(' '));
}
fs.mkdirSync('reports/ga-elite-ecology',{recursive:true});
fs.writeFileSync('reports/ga-elite-ecology/shard-'+OFFSET+'.json',
 JSON.stringify({offset:OFFSET,count:COUNT,base:BASE,modes:MODES,samples}));
console.log('ELITE_ECO_SHARD_BEGIN');
console.log(JSON.stringify({offset:OFFSET,count:COUNT,from:samples[0].seed,to:samples.at(-1).seed}));
console.log('ELITE_ECO_SHARD_END');
