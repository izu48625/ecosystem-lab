'use strict';
/* Balance study: normal rules only, no learning or evolution.
 * Usage: node tests/predator-balance.js [runs=100]
 */
const {Lab}=require('../src/sim-core.js');
const N=Math.max(1,Math.min(200,Number(process.argv[2]||100)));
const green=100, reds=[10,20,30], seed0=20261117;
const results=[];
for(const red of reds){
  const rows=[];
  for(let i=0;i<N;i++){
    const lab=new Lab({seed:seed0+i,green,red,blue:0,variance:10,regrowth:100,duration:100});
    lab.run(100,.08);
    const n=lab.counts(),s=lab.stats;
    rows.push({g:n.g,r:n.r,gBirth:s.births.g,rBirth:s.births.r,
      gHunt:s.deaths.g.hunt,gStarve:s.deaths.g.starve,rStarve:s.deaths.r.starve,
      kills:s.kills.r,grass:lab.grassTotal(),
      both:n.g>0&&n.r>0,greenExtinct:n.g===0,redExtinct:n.r===0,
      rRate:s.individualDays.r?s.kills.r/s.individualDays.r*100:0});
  }
  const avg=k=>Number((rows.reduce((sum,x)=>sum+x[k],0)/N).toFixed(2));
  const pct=k=>Number((rows.filter(x=>x[k]).length/N*100).toFixed(1));
  const sorted=k=>rows.map(x=>x[k]).sort((a,b)=>a-b);
  const med=k=>{const a=sorted(k);return Number(((a[Math.floor((a.length-1)/2)]+a[Math.ceil((a.length-1)/2)])/2).toFixed(2))};
  results.push({initial:{g:green,r:red,b:0},runs:N,
    bothSurvivePct:pct('both'),greenExtinctPct:pct('greenExtinct'),redExtinctPct:pct('redExtinct'),
    averageFinal:{green:avg('g'),red:avg('r')},
    medianFinal:{green:med('g'),red:med('r')},
    averageGreenHunted:avg('gHunt'),averageGreenStarved:avg('gStarve'),
    averageRedStarved:avg('rStarve'),averageRedKillsPer100IndividualDays:avg('rRate'),
    averageGrassFraction:avg('grass'),meanGreenBirths:avg('gBirth'),meanRedBirths:avg('rBirth')});
}
console.log('BALANCE_RESULT_START');
console.log(JSON.stringify({seedStart:seed0,seedEnd:seed0+N-1,simulationDays:100,dt:.08,conditions:'normal fixed-rule species only; no AI',results},null,2));
console.log('BALANCE_RESULT_END');
