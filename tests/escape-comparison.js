'use strict';
/* Preliminary paired-seed study of survival in unchanged Normal vs AI① escape mode.
 * Input: node tests/escape-comparison.js [number-of-seeds]
 * Every study starts with the same green/red world coordinates and species rules.
 */
const {Lab}=require('../src/sim-core.js');
const runs=Math.max(1,Math.min(100,Number(process.argv[2]||4)));
const samples=[];
for(let i=0;i<runs;i++){
  const seed=20261117+i;
  const options={seed,green:100,red:20,blue:0,regrowth:100,variance:10,duration:100};
  const n=new Lab({...options,mode:'normal'});
  const a=new Lab({...options,mode:'escape'});
  n.run(100,.08);a.run(100,.08);
  const sn=n.counts(),sa=a.counts();
  samples.push({
    seed,
    normal:{green:sn.g,red:sn.r,kills:n.stats.kills.r,starved:n.stats.deaths.g.starve,greenHunted:n.stats.deaths.g.hunt},
    escape:{green:sa.g,red:sa.r,kills:a.stats.kills.r,starved:a.stats.deaths.g.starve,greenHunted:a.stats.deaths.g.hunt,
      offspring:a.stats.ai.offspring,mutated:a.stats.ai.mutatedOffspring,maxGeneration:a.stats.ai.highestGeneration,
      fleeRate:a.stats.ai.threatDays>0?Number((a.stats.ai.fleeDays/a.stats.ai.threatDays).toFixed(4)):null}
  });
}
const mean=(mode,key)=>Number((samples.reduce((sum,r)=>sum+r[mode][key],0)/samples.length).toFixed(2));
console.log('ESCAPE_STUDY_START');
console.log(JSON.stringify({runs,days:100,baseline:{green:100,red:20,blue:0},samples,
 mean:{normal:{green:mean('normal','green'),red:mean('normal','red'),greenHunted:mean('normal','greenHunted')},
       escape:{green:mean('escape','green'),red:mean('escape','red'),greenHunted:mean('escape','greenHunted'),offspring:mean('escape','offspring'),maxGeneration:mean('escape','maxGeneration')}}},null,2));
console.log('ESCAPE_STUDY_END');
