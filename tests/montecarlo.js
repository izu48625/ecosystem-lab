'use strict';
const {Lab}=require('../src/sim-core.js');
const N=Math.min(200,Math.max(1,Number(process.argv[2]||20)));
const out=[];
for(let i=0;i<N;i++){
 const s=new Lab({seed:20261117+i});s.run(100,.08);
 const a=s.summary();out.push({seed:a.seed,...a.counts,grass:a.grass,birthr:a.stats.births.r,birthb:a.stats.births.b,killsr:a.stats.kills.r,killsb:a.stats.kills.b,starver:a.stats.deaths.r.starve,starveb:a.stats.deaths.b.starve});
}
const mean=k=>Math.round(out.reduce((s,a)=>s+a[k],0)/N*10)/10;
const result={runs:N,avg:Object.fromEntries(['g','r','b','grass','birthr','birthb','killsr','killsb','starver','starveb'].map(k=>[k,mean(k)])),outcomes:{both:out.filter(x=>x.r>0&&x.b>0).length,redOnly:out.filter(x=>x.r>0&&x.b===0).length,blueOnly:out.filter(x=>x.r===0&&x.b>0).length,bothExtinct:out.filter(x=>x.r===0&&x.b===0).length},examples:out.slice(0,8)};
console.log(JSON.stringify(result,null,2));
if(out.some(x=>!Number.isFinite(x.g)||!Number.isFinite(x.r)||!Number.isFinite(x.b)))process.exitCode=1;
