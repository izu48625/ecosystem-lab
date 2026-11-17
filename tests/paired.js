'use strict';
const assert=require('node:assert/strict');
const {Lab}=require('../src/sim-core.js');
const N=Math.min(150,Math.max(1,Number(process.argv[2]||20)));
const totals={baseline:{both:0,redOnly:0,blueOnly:0,none:0,green:0,red:0,blue:0},learning:{both:0,redOnly:0,blueOnly:0,none:0,green:0,red:0,blue:0}};
let identicalAtDay30=0,updates={g:0,r:0,b:0};
for(let i=0;i<N;i++){
 const seed=20261117+i,a=new Lab({seed,aiEnabled:false}),b=new Lab({seed,aiEnabled:true,aiStartDay:30});
 a.run(30,.08);b.run(30,.08);
 if(JSON.stringify(a.history)===JSON.stringify(b.history)&&JSON.stringify(a.entities)===JSON.stringify(b.entities))identicalAtDay30++;
 a.run(100,.08);b.run(100,.08);
 for(const [key,lab] of [['baseline',a],['learning',b]]){
  const n=lab.counts(),t=totals[key];t.green+=n.g;t.red+=n.r;t.blue+=n.b;
  t[n.r>0&&n.b>0?'both':n.r>0?'redOnly':n.b>0?'blueOnly':'none']++;
 }
 for(const species of ['g','r','b'])updates[species]+=b.learning.updates[species];
}
assert.equal(identicalAtDay30,N);
console.log(JSON.stringify({runs:N,identicalAtDay30,totals,avgLearningUpdates:Object.fromEntries(Object.entries(updates).map(([k,v])=>[k,Math.round(v/N)]))},null,2));
