'use strict';
/**
 * AI① matched-seed evolutionary controls (no changes to the live engine).
 *   random  - newborns get fresh non-heritable random neural weights (fixed distribution)
 *   clone   - newborns inherit exact weights, without mutation (selection only)
 *   evolve  - newborns inherit mutated weights (live AI①)
 *
 * Red predator code and all other physics/food rules remain identical.
 * Usage: node tests/escape-evolution-controls.js <offset> <count>
 */
const assert=require('node:assert/strict');
const {Lab,SPECIES,BRAIN_SIZE}=require('../src/sim-core.js');
const offset=Number(process.argv[2]??0),count=Number(process.argv[3]??25);
assert.ok(Number.isInteger(offset)&&offset>=0&&Number.isInteger(count)&&count>=1&&count<=100);
const options={green:100,red:20,blue:0,regrowth:100,variance:10,duration:100,mode:'escape',escapePolicy:'baseline'};
const modes=['random','clone','evolve'],samples=[];
const groups=['0','1-2','3-5','6+'];
const bucket=g=>g===0?'0':g<=2?'1-2':g<=5?'3-5':'6+';
const blank=()=>({born:0,days:0,targeted:0,threatDays:0,fleeDays:0,hunt:0,starve:0,age:0,aliveAtEnd:0});
const totalCohorts=Object.fromEntries(modes.map(mode=>[mode,Object.fromEntries(groups.map(g=>[g,blank()]))]));
function brain(seed,id){
  let state=(seed^Math.imul(id,0x9e3779b1))>>>0;
  const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
  return Array.from({length:BRAIN_SIZE},()=> (rand()*2-1)*.38);
}
function attach(lab,mode){
 const co=Object.fromEntries(groups.map(g=>[g,blank()]));
 co['0'].born=lab.settings.green;
 let tick=.08;
 // Historical 2026-11-19 study used the pre-tuning 8% ±0.34 mutation.
 // Pin it here so the archived 100-seed data remains reproducible even
 // after the production AI① model adopts gentler mutations.
 lab.mutateBrain=function(parent){
   let changed=0;
   const child=parent.genome.map(w=>{
     if(this.rnd()<.08){changed++;return Math.max(-3,Math.min(3,w+(this.rnd()*2-1)*.34))}
     return w;
   });
   this.stats.ai.offspring++;
   if(changed)this.stats.ai.mutatedOffspring++;
   this.stats.ai.mutatedGenes+=changed;
   return child;
 };
 if(mode!=='evolve'){
   const mutate=lab.mutateBrain;
   lab.mutateBrain=function(parent){
     const prevMutated=this.stats.ai.mutatedOffspring,prevGenes=this.stats.ai.mutatedGenes;
     // Preserve PRNG consumption and all other simulation mechanics.
     mutate.call(this,parent);
     this.stats.ai.mutatedOffspring=prevMutated;
     this.stats.ai.mutatedGenes=prevGenes;
     return mode==='clone'?parent.genome.slice():brain(this.settings.seed,this.nextId);
   };
 }
 const originalSpawn=lab.spawn;
 lab.spawn=function(...args){
   const newborn=originalSpawn.apply(this,args);
   if(newborn.type==='g')co[bucket(newborn.generation)].born++;
   return newborn;
 };
 const originalNearest=lab.nearest;
 lab.nearest=function(e,index,range,type){
   const target=originalNearest.call(this,e,index,range,type);
   if(target && e.type==='g'&&type==='r')co[bucket(e.generation)].threatDays+=tick;
   if(target && e.type==='r'&&type==='g')co[bucket(target.generation)].targeted++;
   return target;
 };
 const originalMove=lab.move;
 lab.move=function(e,dx,dy,dt,velocity,stop,kind){
   if(e.type==='g'&&kind==='flee')co[bucket(e.generation)].fleeDays+=dt;
   return originalMove.call(this,e,dx,dy,dt,velocity,stop,kind);
 };
 const originalDie=lab.die;
 lab.die=function(e,reason,killer){
   if(e.type==='g'&&e.alive&&Object.prototype.hasOwnProperty.call(co[bucket(e.generation)],reason))co[bucket(e.generation)][reason]++;
   return originalDie.call(this,e,reason,killer);
 };
 const originalUpdate=lab.update;
 lab.update=function(dt){
   const actual=Math.min(dt,this.settings.duration-this.day);
   if(actual>0){
     tick=actual;
     for(const e of this.entities)if(e.alive&&e.type==='g')co[bucket(e.generation)].days+=actual;
   }
   return originalUpdate.call(this,dt);
 };
 return co;
}
function run(seed,mode){
 const lab=new Lab({...options,seed}),co=attach(lab,mode);
 const founders=lab.entities.filter(e=>e.type==='g');
 const seedBrain0=brain(seed,founders[0].id);
 assert.deepEqual(founders[0].genome,seedBrain0,'Founding neural policy must match');
 lab.run(100,.08);
 for(const e of lab.entities)if(e.type==='g')co[bucket(e.generation)].aliveAtEnd++;
 const n=lab.counts(),s=lab.stats;
 const extinction=lab.history.find(h=>h.day>0&&h.g===0)?.day??null;
 return {co,metrics:{
   green:n.g,red:n.r,greenSurvived:n.g>0,bothAlive:n.g>0&&n.r>0,
   greenExtinctionDay:extinction,greenPresenceDays:extinction??100,
   births:s.births.g,redBirths:s.births.r,greenHunted:s.deaths.g.hunt,
   greenStarved:s.deaths.g.starve,redHunts:s.hunts.r,redKills:s.kills.r,
   maxGeneration:s.ai.highestGeneration,mutatedOffspring:s.ai.mutatedOffspring,
   globalFleeFraction:s.ai.threatDays>0?Number((s.ai.fleeDays/s.ai.threatDays).toFixed(4)):null
 }};
}
for(let i=0;i<count;i++){
 const seed=20261117+offset+i;
 const results=Object.fromEntries(modes.map(mode=>[mode,run(seed,mode)]));
 for(const mode of modes)for(const key of groups)for(const k of Object.keys(totalCohorts[mode][key])){
   totalCohorts[mode][key][k]+=results[mode].co[key][k];
 }
 samples.push({seed,...Object.fromEntries(modes.map(mode=>[mode,results[mode].metrics]))});
}
for(const mode of modes)for(const key of groups)for(const k of ['days','threatDays','fleeDays']){
 totalCohorts[mode][key][k]=Number(totalCohorts[mode][key][k].toFixed(3));
}
console.log('EVOLUTION_CONTROL_START');
console.log(JSON.stringify({offset,count,settings:options,redFixedRule:SPECIES.r,definitions:{
 random:'Newborn neural weights reinitialized from deterministic seed and id, no neural inheritance',
 clone:'Offspring get exact parental neural weights; heritable selection without mutation',
 evolve:'Offspring inherit mutated weights; current AI1',
 targeted:'Count of prey selected by red during red hunting acquisition; NOT a strict unique chase outcome',
 escapeProxy:'1 - hunt deaths / targeted; not a confirmed successful escape rate',
 exposure:'Green individual-days with a visible red predator within AI danger range',
 cohort:'Generation zero, one-two, three-five, or six and higher; nonrandom survivor/censoring bias'
},samples,cohorts:totalCohorts}));
console.log('EVOLUTION_CONTROL_END');
