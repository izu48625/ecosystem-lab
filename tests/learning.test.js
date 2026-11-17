'use strict';
const assert=require('node:assert/strict');
const {Lab}=require('../src/sim-core.js');
const seed=20261117;
const baseline=new Lab({seed,aiEnabled:false}),ai=new Lab({seed,aiEnabled:true,aiStartDay:30});
baseline.run(30,.08);ai.run(30,.08);
assert.deepEqual(ai.history,baseline.history,'Before DAY30, identical statistics');
assert.deepEqual(ai.entities,baseline.entities,'Before DAY30, identical entities');
assert.deepEqual(ai.grass,baseline.grass,'Before DAY30, identical food');
assert.equal(ai.learning.active,false);
assert.deepEqual(ai.learning.updates,{g:0,r:0,b:0});
console.log('✓ Identical conditions through DAY30');
baseline.run(100,.08);ai.run(100,.08);
assert.equal(ai.learning.active,true);
for(const species of ['g','r','b']){
 assert.ok(ai.learning.updates[species]>0,'Q-learning must update');
 assert.ok(ai.learning.decisions[species].reduce((a,b)=>a+b,0)>0);
 assert.ok(Object.values(ai.learning.q[species]).some(row=>row.some(n=>n!==0)));
}
const replay=new Lab({seed,aiEnabled:true,aiStartDay:30});replay.run(100,.08);
assert.deepEqual(replay.summary(),ai.summary(),'Replay must be deterministic');
for(const type of ['g','r','b']){
 const n=ai.counts(),st=ai.stats;
 assert.equal(n[type],ai.settings[type==='g'?'green':type==='r'?'red':'blue']+st.births[type]-Object.values(st.deaths[type]).reduce((x,y)=>x+y,0));
}
console.log('✓ Q tables changed, action selections recorded, deterministic replay and population conservation');
