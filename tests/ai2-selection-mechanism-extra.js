'use strict';
/* Supplementary paired-seed CIs for allele shift, high-low
 * reproduction, flight time and founder lineage bottleneck.
 * Uses saved 100-seed observations; DOES NOT re-run ecology.
 */
const fs=require('node:fs'),assert=require('node:assert/strict');
const BASE=20630001;const ROWS=[];
for(let i=0;i<100;i+=10){
 const d=JSON.parse(fs.readFileSync('reports/ai2-selection-gradient-raw/shard-'+i+'.json','utf8'));
 assert.equal(d.offset,i);assert.equal(d.count,10);ROWS.push(...d.results);
}
ROWS.sort((a,b)=>a.seed-b.seed);
assert.equal(ROWS.length,100);ROWS.forEach((r,i)=>assert.equal(r.seed,BASE+i));
const TRAITS=['gather','align','separate'];
const mean=(a,fn)=>{const v=a.map(fn).filter(Number.isFinite);return v.length?v.reduce((x,y)=>x+y,0)/v.length:null};
let state=0xbec02026;function rnd(){state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296}
function boot(list){
 const v=list.filter(Number.isFinite);if(v.length===0)return{n:0,mean:null,ci95:null};
 const b=[];for(let i=0;i<4000;i++){
  let t=0;for(let j=0;j<v.length;j++)t+=v[Math.floor(rnd()*v.length)];
  b.push(t/v.length);
 }
 b.sort((x,y)=>x-y);
 return {n:v.length,mean:mean(v,x=>x),ci95:[b[100],b[3900]],
  nPositive:v.filter(x=>x>0).length};
}
const shifts={};
for(const trait of TRAITS){
 shifts[trait]={};
 for(const day of [10,20,30,60,100]){
  const shiftsFor={};
  for(const mode of ['enabled','disabled'])shiftsFor[mode]=ROWS.map(row=>{
   const v=row[mode].checkpoints[day].meanLivingTraits[trait];
   const base=row[mode].checkpoints[0].meanLivingTraits[trait];
   return Number.isFinite(v)?v-base:NaN;
  });
  shifts[trait][day]={
   socialOn:boot(shiftsFor.enabled),
   socialOff:boot(shiftsFor.disabled),
   neuralSelectionExcess:boot(shiftsFor.enabled.map((x,i)=>x-shiftsFor.disabled[i]))
  };
 }
}
const highLow={};
for(const trait of TRAITS){
 highLow[trait]={};
 for(const metric of ['fleePct','groupPct','crowdPct','foodPerDay',
  'births','births20','descendantsAlive','descendantsBorn','redNearPct','hitCount']){
  function worldDifference(row,mode){
   const f=row[mode].founders.slice().sort((a,b)=>a.traits[trait]-b.traits[trait]||a.id-b.id);
   return mean(f.slice(-25),a=>a[metric])-mean(f.slice(0,25),a=>a[metric]);
  }
  highLow[trait][metric]={
   socialOn:boot(ROWS.map(r=>worldDifference(r,'enabled'))),
   socialOff:boot(ROWS.map(r=>worldDifference(r,'disabled'))),
   diffInDiff:boot(ROWS.map(r=>worldDifference(r,'enabled')-worldDifference(r,'disabled')))
  };
 }
}
const demographic={
 trackedFounderGenomes:100*100,
 auditUnits:ROWS.length,
 greenFoundingFamiliesAtDay100:{
  socialOn:boot(ROWS.map(r=>r.enabled.ecology.finalFoundingLineages)),
  socialOff:boot(ROWS.map(r=>r.disabled.ecology.finalFoundingLineages)),
  pairedDifference:boot(ROWS.map(r=>r.enabled.ecology.finalFoundingLineages-r.disabled.ecology.finalFoundingLineages))
 },
 founderGroupDays:{
  socialOn:boot(ROWS.map(r=>mean(r.enabled.founders,p=>p.groupPct))),
  socialOff:boot(ROWS.map(r=>mean(r.disabled.founders,p=>p.groupPct)))
 },
 founderCrowdingDays:{
  socialOn:boot(ROWS.map(r=>mean(r.enabled.founders,p=>p.crowdPct))),
  socialOff:boot(ROWS.map(r=>mean(r.disabled.founders,p=>p.crowdPct)))
 },
 founderFleeDays:{
  socialOn:boot(ROWS.map(r=>mean(r.enabled.founders,p=>p.fleePct))),
  socialOff:boot(ROWS.map(r=>mean(r.disabled.founders,p=>p.fleePct)))
 }
};
const report={metadata:'100 matched seeds x (AI2 active and disabled) reanalysis from saved per-founder telemetry, no engine changes',shifts,highLow,demographic};
fs.mkdirSync('reports/ai2-selection-gradient-extra',{recursive:true});
fs.writeFileSync('reports/ai2-selection-gradient-extra/summary.json',JSON.stringify(report,null,2));
console.log('SELECTION_EXTRA_BEGIN');console.log(JSON.stringify({day100Shifts:Object.fromEntries(TRAITS.map(k=>[k,shifts[k][100]])),
 day20Shifts:Object.fromEntries(TRAITS.map(k=>[k,shifts[k][20]])),
 founderFlee:Object.fromEntries(TRAITS.map(k=>[k,highLow[k].fleePct])),
 founderGroup:Object.fromEntries(TRAITS.map(k=>[k,highLow[k].groupPct])),
 founderCrowd:Object.fromEntries(TRAITS.map(k=>[k,highLow[k].crowdPct])),
 demographics:demographic}));console.log('SELECTION_EXTRA_END');
