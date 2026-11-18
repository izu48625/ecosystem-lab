'use strict';
/* Multi-factor AI1 survival study against unchanged Normal and released AI1.
   No predator behavior changes; instrumentation wraps existing methods.
   node tests/chase-improvement-study.js <seedOffset> <count> <seedBase> <comma-separated arms>
   Arms: normal,baseline,alert,multi,wall,combo,budget,adaptive,baselineClone
*/
const assert=require('node:assert/strict');
const {Lab,SPECIES}=require('../src/sim-core.js');
const offset=Number(process.argv[2]??0),count=Number(process.argv[3]??25);
const base=Number(process.argv[4]??20261117);
const selected=(process.argv[5]||'normal,baseline,alert,multi,wall,combo,budget,adaptive').split(',');
assert.ok(Number.isInteger(offset)&&offset>=0&&Number.isInteger(count)&&count>=1&&count<=100);
assert.ok(Number.isInteger(base)&&base>0);
const allowed=['normal','baseline','alert','multi','wall','combo','budget','adaptive','baselineClone','alertClone'];
assert.ok(selected.length>=2&&new Set(selected).size===selected.length&&selected.every(x=>allowed.includes(x)));
const options={green:100,red:20,blue:0,regrowth:100,variance:10,duration:100};
const groups=['0','1-2','3-5','6-9','10+'];
const genGroup=n=>n===0?'0':n<=2?'1-2':n<=5?'3-5':n<=9?'6-9':'10+';
const zero=()=>({starts:0,unhit:0,hit:0,diedOther:0,pending:0,startDistance:0,startEnergy:0});
function observeChase(lab){
 const totals=zero(),byGen=Object.fromEntries(groups.map(k=>[k,zero()]));
 let targetSelections=0;
 // No research need for raw logs or browser-specific 20k cap; reduces memory load.
 lab.aiLog=function(){};
 function close(g,outcome){
  const episode=g.chaseStudy;
  if(!episode)return;
  if(outcome==='hit'&&this.day-episode.startDay>=1-1e-8)outcome='unhit';
  if(outcome==='diedOther'&&this.day-episode.startDay>=1-1e-8)outcome='unhit';
  totals[outcome]++;
  byGen[episode.group][outcome]++;
  g.chaseStudy=null;
 }
 const nearest=lab.nearest;
 lab.nearest=function(agent,index,range,type){
  const green=nearest.call(this,agent,index,range,type);
  if(agent.type==='r'&&type==='g'&&green){
   targetSelections++;
   if(!green.chaseStudy){
    const group=genGroup(green.generation||0);
    const dist=Math.hypot(green.x-agent.x,green.y-agent.y);
    green.chaseStudy={startDay:this.day,group};
    totals.starts++;totals.startDistance+=dist;totals.startEnergy+=green.energy;
    const q=byGen[group];q.starts++;q.startDistance+=dist;q.startEnergy+=green.energy;
   }
  }
  return green;
 };
 const aiHit=lab.aiEncounterHit;
 lab.aiEncounterHit=function(g,red){
  if(g.chaseStudy)close.call(this,g,'hit');
  return aiHit.call(this,g,red);
 };
 const die=lab.die;
 lab.die=function(g,reason,killer){
  if(g.type==='g'&&g.chaseStudy)close.call(this,g,reason==='hunt'&&killer?.type==='r'?'hit':'diedOther');
  return die.call(this,g,reason,killer);
 };
 const update=lab.update;
 lab.update=function(dt){
  const ret=update.call(this,dt);
  for(const g of this.entities){
   if(g.alive&&g.type==='g'&&g.chaseStudy&&this.day-g.chaseStudy.startDay>=1-1e-8)close.call(this,g,'unhit');
  }
  return ret;
 };
 return {totals,byGen,targetCount:()=>targetSelections};
}
function simulate(seed,arm){
 const normal=arm==='normal',clone=arm==='baselineClone'||arm==='alertClone';
 const strategy=arm==='alertClone'?'alert':(['alert','multi','wall','combo','budget','adaptive'].includes(arm)?arm:'baseline');
 const lab=new Lab({...options,seed,mode:normal?'normal':'escape',escapePolicy:'wide',escapeStrategy:strategy});
 if(clone){
  const actual=lab.mutateBrain;
  lab.mutateBrain=function(parent){
   const oldOff=this.stats.ai.mutatedOffspring,oldGenes=this.stats.ai.mutatedGenes;
   actual.call(this,parent); // preserve RNG draws
   this.stats.ai.mutatedOffspring=oldOff;this.stats.ai.mutatedGenes=oldGenes;
   return parent.genome.slice();
  };
 }
 const study=observeChase(lab);
 lab.run(100,.08);
 const a=study.totals,pending=a.starts-a.unhit-a.hit-a.diedOther;
 assert.ok(pending>=0,'Negative pending chase windows');
 const unsettled=lab.entities.filter(g=>g.alive&&g.type==='g'&&g.chaseStudy).length;
 assert.equal(pending,unsettled,'All starts must have exactly one resolution or a right-censored window');
 assert.equal(study.targetCount(),lab.stats.hunts.r,'Actual red target selections must match predator hunt stats');
 const n=lab.counts(),resolved=a.unhit+a.hit+a.diedOther;
 return {
  green:n.g,red:n.r,greenAlive:n.g>0,bothAlive:n.g>0&&n.r>0,
  greenIndividualDays:lab.stats.individualDays.g,redIndividualDays:lab.stats.individualDays.r,
  greenFleeDays:lab.stats.ai.fleeDays,greenThreatDays:lab.stats.ai.threatDays,
  greenStarvePer100IndividualDays:100*lab.stats.deaths.g.starve/Math.max(1,lab.stats.individualDays.g),
  greenBirths:lab.stats.births.g,redBirths:lab.stats.births.r,
  greenHunted:lab.stats.deaths.g.hunt,greenStarved:lab.stats.deaths.g.starve,
  redStarved:lab.stats.deaths.r.starve,
  redTargetSelections:study.targetCount(),
  chaseWindows:a.starts,unhit:a.unhit,hit:a.hit,diedOther:a.diedOther,pending,
  attackFreePct:resolved?100*a.unhit/resolved:null,
  hitPct:resolved?100*a.hit/resolved:null,
  startDistanceMean:a.starts?a.startDistance/a.starts:null,
  startEnergyMean:a.starts?a.startEnergy/a.starts:null,
  maxGeneration:lab.stats.ai.highestGeneration,
  groups:Object.fromEntries(groups.map(k=>{
   const q=study.byGen[k],r=q.unhit+q.hit+q.diedOther;
   return [k,{starts:q.starts,unhit:q.unhit,hit:q.hit,diedOther:q.diedOther,pending:q.starts-r,
     attackFreePct:r?100*q.unhit/r:null}];
  }))
 };
}
const samples=[];
for(let i=0;i<count;i++){
 const seed=base+offset+i,arms={};
 for(const arm of selected)arms[arm]=simulate(seed,arm);
 samples.push({seed,...arms});
}
console.log('CHASE_STUDY_BEGIN');
console.log(JSON.stringify({offset,count,seedBase:base,firstSeed:samples[0].seed,lastSeed:samples.at(-1).seed,arms:selected,
 settings:options,redRules:SPECIES.r,
 definition:'A green one-day window begins on first real red target selection; success = green survives with no red strike. Green survival metric = ecosystem species remains at DAY100, not founding individual still living. Compare paired seeds and do not count chase events as independent replicates.',
 samples}));
console.log('CHASE_STUDY_END');
