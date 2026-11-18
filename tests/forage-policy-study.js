'use strict';
// Paired 100-day AI1 forage experiments. No changes to predator rules, prey speed or neural genes.
// Usage: node tests/forage-policy-study.js 0 25 20270001 baseline,safeSearch,route,adaptive,graze,grazeRoute
const assert=require('node:assert/strict');
const {Lab,SPECIES}=require('../src/sim-core.js');
const offset=Number(process.argv[2]??0),count=Number(process.argv[3]??10);
const base=Number(process.argv[4]??20270001);
const arms=(process.argv[5]??'baseline,safeSearch,route,adaptive,graze,grazeRoute').split(',');
const allowed=['baseline','safeSearch','route','adaptive','graze','grazeRoute'];
assert.ok(Number.isInteger(offset)&&offset>=0&&Number.isInteger(count)&&count>0&&count<=100);
assert.ok(Number.isInteger(base)&&base>0);
assert.ok(arms.length>1&&new Set(arms).size===arms.length&&arms.every(a=>allowed.includes(a)));

function observeRedChases(lab){
  const result={starts:0,unhit:0,hit:0,diedOther:0};
  let targetSelections=0;
  // Event logging is irrelevant to these aggregate metrics and costs memory.
  lab.aiLog=function(){};
  function finish(g,kind){
    if(!g.forageStudy)return;
    if(this.day-g.forageStudy.startDay>=1-1e-8)kind='unhit';
    result[kind]++;
    g.forageStudy=null;
  }
  const nearest=lab.nearest;
  lab.nearest=function(a,index,range,type){
    const found=nearest.call(this,a,index,range,type);
    if(a.type==='r'&&type==='g'&&found){
      targetSelections++;
      if(!found.forageStudy){found.forageStudy={startDay:this.day};result.starts++;}
    }
    return found;
  };
  const hit=lab.aiEncounterHit;
  lab.aiEncounterHit=function(g,r){if(g.forageStudy)finish.call(this,g,'hit');return hit.call(this,g,r);};
  const die=lab.die;
  lab.die=function(g,reason,killer){if(g.type==='g'&&g.forageStudy)finish.call(this,g,'diedOther');return die.call(this,g,reason,killer);};
  const update=lab.update;
  lab.update=function(dt){
    const ret=update.call(this,dt);
    for(const g of this.entities)
      if(g.alive&&g.type==='g'&&g.forageStudy&&this.day-g.forageStudy.startDay>=1-1e-8)
        finish.call(this,g,'unhit');
    return ret;
  };
  return {result,targetSelections:()=>targetSelections};
}
function simulate(seed,arm){
  const lab=new Lab({seed,green:100,red:20,blue:0,variance:10,regrowth:100,mode:'escape',
    escapePolicy:'wide',foragePolicy:arm,duration:100});
  const tracker=observeRedChases(lab);
  lab.run(100,.08);
  const ch=tracker.result,pending=ch.starts-ch.unhit-ch.hit-ch.diedOther;
  assert.equal(pending,lab.entities.filter(g=>g.alive&&g.type==='g'&&g.forageStudy).length);
  assert.equal(tracker.targetSelections(),lab.stats.hunts.r);
  const resolved=ch.unhit+ch.hit+ch.diedOther;
  const alive=lab.counts();
  const greenDays=lab.stats.individualDays.g;
  return {
    green:alive.g,red:alive.r,bothAlive:alive.g>0&&alive.r>0,
    births:lab.stats.births.g,hunted:lab.stats.deaths.g.hunt,starved:lab.stats.deaths.g.starve,
    starvationPer100GreenDays:greenDays?100*lab.stats.deaths.g.starve/greenDays:null,
    chase:ch,pending,
    chaseAttackFreePct:resolved?100*ch.unhit/resolved:null
  };
}
const samples=[];
for(let i=0;i<count;i++){
  const seed=base+offset+i,byArm={};
  for(const arm of arms)byArm[arm]=simulate(seed,arm);
  samples.push({seed,arms:byArm});
}
const summary={};
for(const arm of arms){
  const data=samples.map(x=>x.arms[arm]);
  const total=key=>data.reduce((sum,v)=>sum+v[key],0);
  const ch=data.reduce((out,v)=>{
    for(const key of ['starts','unhit','hit','diedOther'])out[key]+=v.chase[key];
    return out;
  },{starts:0,unhit:0,hit:0,diedOther:0});
  const resolved=ch.unhit+ch.hit+ch.diedOther;
  summary[arm]={
    greenAliveTrials:data.filter(v=>v.green>0).length,
    bothAliveTrials:data.filter(v=>v.bothAlive).length,
    avgFinalGreen:total('green')/count,
    avgStarved:total('starved')/count,
    avgHunted:total('hunted')/count,
    avgStarvationPer100GreenDays:total('starvationPer100GreenDays')/count,
    chaseAttackFreePct:resolved?100*ch.unhit/resolved:null,
    chaseEpisodes:ch.starts
  };
}
console.log(JSON.stringify({
  title:'AI1 forage policy study',seedBase:base,offset,count,arms,dt:.08,days:100,
  redRules:SPECIES.r,summary,samples,
  limitations:'Comparisons are paired by starting seed, not identical later world states. Chases are overlapping observations, not independent causal effects. Run >=100 seeds incl. holdout before any rollout.'
},null,2));
