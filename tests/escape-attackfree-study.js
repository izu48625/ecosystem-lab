'use strict';
/**
 * Matched 100-day experiment: attack-free survival during the next 1 day
 * after a red predator comes within 120 canvas pixels of a green herbivore.
 * Modes: evolving AI1 (2% ±0.10), mutation-free inherited AI1.
 * node tests/escape-attackfree-study.js <offset> <count>
 * All instrumentation is passive; no behavior/predator rules are modified.
 */
const assert=require('node:assert/strict');
const {Lab,SPECIES,ESCAPE_MUTATION}=require('../src/sim-core.js');
const offset=Number(process.argv[2]??0),count=Number(process.argv[3]??25);
assert.ok(Number.isInteger(offset)&&offset>=0&&Number.isInteger(count)&&count>=1&&count<=100);
const settings={green:100,red:20,blue:0,regrowth:100,variance:10,duration:100,mode:'escape'};
const modes=['evolve','clone'];
const groups=['0','1-2','3-5','6-9','10+'];
const generationGroup=n=>n===0?'0':n<=2?'1-2':n<=5?'3-5':n<=9?'6-9':'10+';
const bands=['0-19','20-39','40-59','60-79','80-99'];
const period=day=>bands[Math.min(4,Math.floor(day/20))];
const zero=()=>({start:0,survived:0,hit:0,diedOther:0});
function run(seed,mode){
 const lab=new Lab({...settings,seed});
 // The browser caps downloadable individual logs at 20,000 entries.
 // Research runs intentionally retain the full events, without truncation.
 lab.aiLog=function(event){this.stats.ai.escapeEvents.push(event);};
 if(mode==='clone'){
  const mutate=lab.mutateBrain;
  lab.mutateBrain=function(parent){
   const prevOff=this.stats.ai.mutatedOffspring,prevGenes=this.stats.ai.mutatedGenes;
   mutate.call(this,parent);
   this.stats.ai.mutatedOffspring=prevOff;this.stats.ai.mutatedGenes=prevGenes;
   return parent.genome.slice();
  };
 }
 lab.run(100,.08);
 const ai=lab.stats.ai,n=lab.counts();
 const byGeneration=Object.fromEntries(groups.map(x=>[x,zero()]));
 for(const [k,val] of Object.entries(ai.byGeneration)){
  const g=byGeneration[generationGroup(Number(k))];
  g.start+=val.encounterStarts;g.survived+=val.encounterSurvived;
  g.hit+=val.encounterHit;g.diedOther+=val.encounterDiedOther;
 }
 const byDayBand=Object.fromEntries(bands.map(k=>[k,zero()]));
 const episodes=[];
 for(const ev of ai.escapeEvents){
  if(ev.kind==='red_proximity_start'){
   byDayBand[period(ev.day)].start++;
  }else if(ev.kind==='red_proximity_end'){
   const o=byDayBand[period(ev.startDay)];
   o[ev.outcome]++;
   episodes.push({generation:ev.generation,startDay:ev.startDay,startDistance:ev.startDistance,startEnergy:ev.startEnergy,outcome:ev.outcome});
  }
 }
 const agg={starts:ai.encounterStarts,survived:ai.encounterSurvived,hit:ai.encounterHit,diedOther:ai.encounterDiedOther};
 const unresolved=agg.starts-agg.survived-agg.hit-agg.diedOther;
 if(ai.eventsDropped!==0)throw new Error('Raw event cap reached: cannot safely calculate time-band trends');
 assert.ok(unresolved>=0);
 assert.equal(groups.reduce((a,k)=>a+byGeneration[k].start,0),agg.starts);
 for(const key of ['survived','hit','diedOther'])
  assert.equal(groups.reduce((a,k)=>a+byGeneration[k][key],0),agg[key]);
 assert.equal(bands.reduce((a,k)=>a+byDayBand[k].start,0),agg.starts);
 for(const key of ['survived','hit','diedOther'])
  assert.equal(bands.reduce((a,k)=>a+byDayBand[k][key],0),agg[key]);
 assert.equal(ai.escapeEvents.filter(e=>e.kind==='red_proximity_end').length,
   agg.survived+agg.hit+agg.diedOther);
 return {
  seed,finalGreen:n.g,finalRed:n.r,greenSurvived:n.g>0,
  greenHunted:lab.stats.deaths.g.hunt,greenStarved:lab.stats.deaths.g.starve,
  greenBirths:lab.stats.births.g,redBirths:lab.stats.births.r,
  ...agg,unresolved,
  fraction:agg.survived+agg.hit+agg.diedOther?
   Number((agg.survived/(agg.survived+agg.hit+agg.diedOther)).toFixed(8)):null,
  byGeneration,byDayBand
 };
}
const samples=[];
for(let i=0;i<count;i++){
 const seed=20261117+offset+i;
 samples.push({seed,evolve:run(seed,'evolve'),clone:run(seed,'clone')});
}
console.log('ATTACKFREE_STUDY_BEGIN');
console.log(JSON.stringify({offset,count,firstSeed:samples[0].seed,lastSeed:samples.at(-1).seed,settings,
  redRules:SPECIES.r,mutation:ESCAPE_MUTATION,windowDays:1,triggerDistancePx:120,
  outcomeDefinition:'survived=alive without red strike for 1 in-game day; hit=red strikes green during window; diedOther=green dies without red strike; unresolved=window not finished at DAY100',
  independentEpisodes:'one exposure on entry into <=120px; no rearm until no red within 120px; attacks before green update also trigger/resolve an exposure',
  samples}));
console.log('ATTACKFREE_STUDY_END');
