'use strict';
/**
 * AI1 behavior telemetry study (no physics or red-rule mutations).
 * Usage: node tests/escape-telemetry-study.js <offset> <count>
 * Runs 100 fictional days, 100/20 green/red, seed base 20261117.
 * Captures escape-start positions, actual turn and away angles, and predator
 * chase outcomes in the 2026-11-19 instrumented model.
 */
const assert=require('node:assert/strict');
const {Lab,SPECIES,ESCAPE_MUTATION}=require('../src/sim-core.js');
const offset=Number(process.argv[2]??0),count=Number(process.argv[3]??25);
assert.ok(Number.isInteger(offset)&&offset>=0&&Number.isInteger(count)&&count>=1&&count<=100);
const settings={green:100,red:20,blue:0,variance:10,regrowth:100,duration:100,mode:'escape'};
const groups=['gen0','gen1_2','gen3_5','gen6_9','gen10plus'];
const groupOf=n=>n===0?'gen0':n<=2?'gen1_2':n<=5?'gen3_5':n<=9?'gen6_9':'gen10plus';
const zero=()=>({born:0,fleeStarts:0,startDistanceSum:0,turnSamples:0,turnDegSum:0,awayDegSum:0,chaseStarts:0,chaseEscaped:0,chaseCaught:0,chaseOther:0});
const total=Object.fromEntries(groups.map(x=>[x,zero()])),samples=[];
for(let i=0;i<count;i++){
  const seed=20261117+offset+i,lab=new Lab({...settings,seed});
  lab.run(100,.08);
  const a=lab.stats.ai,n=lab.counts(),by=Object.fromEntries(groups.map(x=>[x,zero()]));
  for(const [k,v] of Object.entries(a.byGeneration)){
    const g=groupOf(Number(k)),o=by[g];
    for(const field of Object.keys(o))o[field]+=v[field]||0;
  }
  const sum=field=>Object.values(by).reduce((s,v)=>s+v[field],0);
  for(const field of ['fleeStarts','startDistanceSum','turnSamples','turnDegSum','awayDegSum','chaseStarts','chaseEscaped','chaseCaught','chaseOther']){
    assert.ok(Math.abs(sum(field)-a[field])<1e-6*Math.max(1,Math.abs(a[field])),field+' generation telemetry mismatch');
  }
  assert.ok(a.chaseStarts>=a.chaseEscaped+a.chaseCaught+a.chaseOther);
  assert.equal(lab.day,100);
  for(const g of groups)for(const field of Object.keys(total[g]))total[g][field]+=by[g][field];
  samples.push({
    seed,green:n.g,red:n.r,greenSurvived:n.g>0,redSurvived:n.r>0,
    maxGeneration:a.highestGeneration,greenHunted:lab.stats.deaths.g.hunt,greenStarved:lab.stats.deaths.g.starve,
    greenBirths:lab.stats.births.g,redBirths:lab.stats.births.r,
    fleeStarts:a.fleeStarts,meanStartDistance:a.fleeStarts?a.startDistanceSum/a.fleeStarts:null,
    meanTurnDeg:a.turnSamples?a.turnDegSum/a.turnSamples:null,
    meanAwayDeg:a.turnSamples?a.awayDegSum/a.turnSamples:null,
    chaseStarts:a.chaseStarts,chaseEscaped:a.chaseEscaped,chaseCaught:a.chaseCaught,
    chaseOther:a.chaseOther,chaseOpen:a.chaseStarts-a.chaseEscaped-a.chaseCaught-a.chaseOther,
    eventsDropped:a.eventsDropped,generations:by
  });
}
for(const group of groups)for(const field of ['startDistanceSum','turnDegSum','awayDegSum'])total[group][field]=Number(total[group][field].toFixed(7));
console.log('ESCAPE_TELEMETRY_STUDY_BEGIN');
console.log(JSON.stringify({offset,count,seedFirst:samples[0].seed,seedLast:samples.at(-1).seed,settings,redRules:SPECIES.r,mutation:ESCAPE_MUTATION,groups,aggregates:total,samples}));
console.log('ESCAPE_TELEMETRY_STUDY_END');
