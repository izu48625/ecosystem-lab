'use strict';
const assert=require('node:assert/strict');
const {Lab,SPECIES}=require('../src/sim-core.js');
function testDefault(){
 const a=new Lab({seed:20261117});
 assert.deepEqual(a.counts(),{g:100,r:10,b:10});
 a.run();const n=a.counts();
 assert.equal(a.day,100);assert.equal(a.history.length,101);
 assert.equal(a.history[0].day,0);assert.equal(a.history.at(-1).day,100);
 assert.equal(a.history.at(-1).g,n.g);assert.equal(a.history.at(-1).r,n.r);assert.equal(a.history.at(-1).b,n.b);
 for(const p of ['g','r','b']){
  assert.equal(n[p],a.settings[p==='g'?'green':p==='r'?'red':'blue']+a.stats.births[p]-Object.values(a.stats.deaths[p]).reduce((x,y)=>x+y,0));
 }
 assert.ok(a.grassTotal()>=0&&a.grassTotal()<=1);
 for(const p of ['g','r','b']){
   assert.ok(a.stats.individualDays[p]>0);
   assert.ok(a.stats.edgeDays[p]>=0&&a.stats.edgeDays[p]<=a.stats.individualDays[p]);
   assert.ok(a.stats.starveWithLocalGrass[p]<=a.stats.deaths[p].starve);
 }
 assert.equal(a.stats.kills.r+a.stats.kills.b,a.stats.deaths.g.hunt);
 for(const e of a.entities){assert.ok(e.alive&&e.hp>0&&e.energy>0&&e.x>=9&&e.x<=951&&e.y>=9&&e.y<=591)}
 const b=new Lab({seed:20261117});b.run();assert.deepEqual(a.summary(),b.summary());
 const c=new Lab({seed:20261118});c.run();assert.notDeepEqual(a.summary(),c.summary());
 console.log('✓ 100日後の集計とシード再現性を確認');
}
function testSpecies(){
 const {g,r,b}=SPECIES;
 assert.ok(g.reproduction<r.reproduction&&r.reproduction<b.reproduction);
 assert.ok(g.attack>0&&r.attack<b.attack);
 assert.ok(g.speed<r.speed&&r.speed<b.speed);
 console.log('✓ ステータスと反撃能力を確認');
}
function testNoPredators(){
 const a=new Lab({seed:13,red:0,blue:0});a.run();
 assert.equal(a.stats.kills.r,0);assert.equal(a.stats.kills.b,0);
 console.log('✓ 肉食0匹の境界条件を確認');
}
testDefault();testSpecies();testNoPredators();

function testLastChanceMeal(){
 const lab=new Lab({seed:1,green:1,red:0,blue:0});
 const a=lab.entities[0];a.energy=.01;a.age=2;a.x=480;a.y=300;
 lab.grass.fill(1);lab.update(.08);
 assert.equal(a.alive,true,'草がある個体は食事前に餓死しない');
 assert.ok(a.energy>0);
 const famine=new Lab({seed:1,green:1,red:0,blue:0});
 famine.grass.fill(0);famine.entities[0].energy=.01;famine.update(.08);
 assert.equal(famine.entities.length,0,'草がない個体は餓死する');
 console.log('✓ 食後の餓死判定を確認');
}
function testWalls(){
 const l=new Lab({seed:1,green:1,red:0,blue:0});
 const a=l.entities[0];a.x=9;a.y=200;
 l.move(a,-1,0,.08,100,0,'flee');
 assert.ok(a.x>9);assert.notEqual(a.y,200);
 console.log('✓ 壁際での逃走を確認');
}
testLastChanceMeal();testWalls();
