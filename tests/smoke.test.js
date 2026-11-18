'use strict';
const assert=require('node:assert/strict');
const {Lab,SPECIES,ESCAPE_MUTATION}=require('../src/sim-core.js');
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
function testUnlimitedBeyond100(){
 const settings={seed:20261117,green:100,red:20,blue:0,duration:Infinity};
 const a=new Lab(settings);
 a.run(100,.08);
 const checkpoint={historyCount:a.history.length,kills:a.stats.kills.r,births:a.stats.births.g};
 assert.equal(a.day,100,'DAY100 is still a checkpoint');
 assert.equal(checkpoint.historyCount,101);
 a.run(150,.08);
 assert.equal(a.day,150,'Simulation must continue beyond DAY100');
 assert.equal(a.history.length,151,'Daily history must extend continuously');
 assert.equal(a.history[100].day,100);
 assert.equal(a.history[150].day,150);
 assert.ok(a.stats.kills.r>=checkpoint.kills);
 assert.ok(a.stats.births.g>=checkpoint.births);
 assert.ok(a.events.every(e=>e.kind!=='end'),'Unlimited simulation must not emit end event');
 a.run(200,.08);
 assert.equal(a.history.at(-1).day,200);
 const b=new Lab(settings);b.run(100,.08);b.run(150,.08);b.run(200,.08);
 assert.deepEqual(a.summary(),b.summary(),'Replay across day100/150/200 is deterministic');
 const c=new Lab({seed:20261117,green:100,red:20,blue:0});
 c.run();assert.equal(c.day,100,'Finite benchmark still ends at 100 days by default');
 console.log('✓ DAY100, DAY150, DAY200への継続と統計記録を確認');
}
testDefault();testSpecies();testNoPredators();testUnlimitedBeyond100();

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
function testNeuroevolution(){
 const settings={seed:20261117,green:100,red:20,blue:0,duration:Infinity,mode:'escape'};
 const normal=new Lab({...settings,mode:'normal'});
 const ai=new Lab(settings);
 assert.equal(ai.settings.mode,'escape');
 assert.equal(ai.stats.ai.founders,100);
 assert.equal(ai.entities.filter(e=>e.type==='g').length,100);
 assert.ok(ai.entities.filter(e=>e.type==='r').every(e=>!e.genome),'Red predators remain rule-based');
 for(let i=0;i<normal.entities.length;i++){
   assert.equal(ai.entities[i].x,normal.entities[i].x,'Initial world coordinates must match Normal');
   assert.equal(ai.entities[i].y,normal.entities[i].y,'Initial world coordinates must match Normal');
   assert.equal(ai.entities[i].age,normal.entities[i].age,'Initial age must match Normal');
 }
 const first=ai.entities.find(e=>e.type==='g');
 assert.equal(first.genome.length,115,'Green must carry all neural weights');
 assert.ok(first.genome.every(v=>Number.isFinite(v)));
 const startGenome=first.genome.slice();
 ai.update(.08);
 if(first.alive)assert.deepEqual(first.genome,startGenome,'No in-life neural learning');
 ai.run(100,.08);
 assert.equal(ai.day,100);
 assert.equal(ai.history.length,101);
 assert.ok(ai.stats.ai.offspring>0,'Green offspring should inherit neural policy');
 assert.ok(ai.stats.ai.mutatedOffspring>0,'A portion of offspring should mutate');
 assert.ok(ai.stats.ai.highestGeneration>0,'Population should span generations');
 assert.ok(ai.stats.ai.threatDays>=ai.stats.ai.fleeDays,'Flee duration cannot exceed danger exposure');
 assert.ok(ai.stats.ai.fleeDays>0,'The neural escape policy must be exercised');
 assert.ok(ai.history.some(n=>n.aiMeanGeneration>0),'Daily records should contain generation statistics');
 for(const e of ai.entities.filter(e=>e.type==='g')){
   assert.equal(e.genome.length,115);
   assert.ok(e.genome.every(v=>Number.isFinite(v)),'Finite evolved weights');
 }
 const replay=new Lab(settings);replay.run(100,.08);
 assert.deepEqual(ai.summary(),replay.summary(),'Neuroevolution must be reproducible at same seed and step');
 console.log('✓ AI①の神経回路・遺伝・変異・世代交代・赤の固定行動を検証');
}
function testGentlerMutation(){
 assert.deepEqual(ESCAPE_MUTATION,{probability:.02,maxDelta:.10});
 const lab=new Lab({seed:19910101,green:1,red:0,blue:0,mode:'escape'});
 const parent=lab.entities[0],genes=parent.genome.length;
 let mutated=0;
 for(let i=0;i<200;i++){
   const child=lab.mutateBrain(parent);
   assert.equal(child.length,genes);
   for(let j=0;j<genes;j++){
     const difference=Math.abs(child[j]-parent.genome[j]);
     assert.ok(difference<=.100000001,'Mutation magnitude must not exceed ±0.10');
     if(difference>1e-10)mutated++;
   }
 }
 assert.ok(mutated>200&&mutated<700,'Per-gene mutation frequency should be near 2%');
 assert.equal(lab.stats.ai.offspring,200);
 assert.equal(lab.stats.ai.mutatedGenes,mutated);
 console.log('✓ AI①遺伝子の変異は確率2%、最大±0.10である');
}
function testEscapeBehaviorTelemetry(){
 const input={seed:20261117,green:100,red:20,blue:0,regrowth:100,variance:10,mode:'escape',escapePolicy:'baseline',duration:100};
 const lab=new Lab(input);
 lab.run(100,.08);
 // Stored 100-seed validation from before telemetry was implemented:
 // proves these measurement hooks do not change actual simulated outcomes.
 const n=lab.counts(),st=lab.stats,ai=st.ai;
 assert.equal(n.g,14);
 assert.equal(n.r,1);
 assert.equal(st.births.g,706);
 assert.equal(st.births.r,108);
 assert.equal(st.deaths.g.hunt,473);
 assert.equal(st.deaths.g.starve,225);
 assert.ok(ai.fleeStarts>0,'Flee starts should be recorded');
 assert.ok(ai.turnSamples>0,'Actual motion turning angles should be observed');
 assert.ok(ai.startDistanceSum>0);
 assert.ok(ai.turnDegSum>=0&&ai.turnDegSum<=ai.turnSamples*180+1e-6);
 assert.ok(ai.awayDegSum>=0&&ai.awayDegSum<=ai.turnSamples*180+1e-6);
 assert.ok(ai.chaseStarts>0,'Red tracking episode starts should be measured');
 assert.ok(ai.chaseCaught>0,'Red-caused captured prey should be recorded');
 assert.ok(ai.chaseEscaped>=0&&ai.chaseEscaped+ai.chaseCaught+ai.chaseOther<=ai.chaseStarts);
 const groups=Object.values(ai.byGeneration),sum=key=>groups.reduce((n,g)=>n+g[key],0);
 assert.equal(sum('fleeStarts'),ai.fleeStarts);
 assert.equal(sum('turnSamples'),ai.turnSamples);
 assert.equal(sum('chaseStarts'),ai.chaseStarts);
 assert.equal(sum('chaseEscaped'),ai.chaseEscaped);
 assert.equal(sum('chaseCaught'),ai.chaseCaught);
 assert.equal(sum('chaseOther'),ai.chaseOther);
 assert.equal(ai.escapeEvents.length+ai.eventsDropped,
   ai.fleeStarts+ai.chaseStarts+ai.chaseEscaped+ai.chaseCaught+ai.chaseOther+
   ai.encounterStarts+ai.encounterSurvived+ai.encounterHit+ai.encounterDiedOther);
 for(const event of ai.escapeEvents){
   assert.ok(event.generation>=0&&event.day>0&&event.day<=100);
   if(event.kind==='flee_start'){
     assert.ok(event.startDistance>0&&event.startDistance<300);
     if(event.turnDeg!==null){
       assert.ok(event.turnDeg>=0&&event.turnDeg<=180);
       assert.ok(event.awayDeg>=0&&event.awayDeg<=180);
     }
   }else if(event.kind==='chase_start'){
     assert.ok(event.startDistance>0&&event.startDistance<=300);
   }else if(event.kind==='red_proximity_start'){
     assert.ok(event.startDistance>=0&&event.startDistance<=120.000001);
     assert.equal(event.windowDays,1);
   }else if(event.kind==='red_proximity_end'){
     assert.ok(['survived','hit','diedOther'].includes(event.outcome));
     assert.ok(event.startDistance>=0&&event.startDistance<=120.000001);
     assert.equal(event.windowDays,1);
   }else{
     assert.equal(event.kind,'chase_end');
     assert.ok(['escaped','caught','other'].includes(event.outcome));
     assert.ok(event.pursuitDays>=0);
   }
 }
 const end=lab.history.at(-1);
 assert.equal(end.aiFleeStarts,ai.fleeStarts);
 assert.equal(end.aiChaseStarts,ai.chaseStarts);
 assert.equal(end.aiChaseEscaped,ai.chaseEscaped);
 assert.ok(Math.abs(end.aiMeanFleeStartDistance-ai.startDistanceSum/ai.fleeStarts)<.011);
 const normal=new Lab({...input,mode:'normal'});normal.run(100,.08);
 assert.equal(normal.stats.ai.fleeStarts,0);
 assert.equal(normal.stats.ai.chaseStarts,0);
 assert.equal(normal.history.at(-1).aiMeanFleeStartDistance,null);
 console.log('✓ 逃走開始距離・方向転換・追跡終了を世代別と日別に正しく記録（旧結果一致）');
 console.log('  観測：',JSON.stringify({fleeStarts:ai.fleeStarts,chases:ai.chaseStarts,breaks:ai.chaseEscaped,caught:ai.chaseCaught,other:ai.chaseOther}));
}
function testDistanceBreakClassification(){
 const lab=new Lab({seed:424242,green:1,red:1,blue:0,mode:'escape',duration:5});
 const green=lab.entities.find(e=>e.type==='g'),red=lab.entities.find(e=>e.type==='r');
 green.x=150;green.y=60;red.x=55;red.y=60;
 red.energy=30;red.view=1;red.age=7;red.life=80;
 green.life=80;green.energy=90;
 lab.update(.08);
 assert.equal(lab.stats.ai.chaseStarts,1,'Hungry red should acquire nearby green');
 green.x=900;green.y=500;
 lab.update(.08);
 assert.equal(lab.stats.ai.chaseEscaped,1,'Red drops target only after it leaves its 200×view pursuit range');
 assert.equal(lab.stats.ai.chaseCaught,0);
 assert.equal(lab.stats.ai.chaseOther,0);
 console.log('✓ 追跡解除の理由（距離離脱）を実際の赤の追跡ロジックから観測');
}
function testAttackFreeExposure(){
 const options={seed:20261117,green:100,red:20,blue:0,mode:'escape',escapePolicy:'baseline',variance:10,regrowth:100,duration:100};
 const lab=new Lab(options);
 lab.run(100,.08);
 // Previous pre-telemetry deterministic study (AI1 2% ±0.10):
 const n=lab.counts(),ai=lab.stats.ai;
 assert.deepEqual(n,{g:14,r:1,b:0},'New observational telemetry must not change population');
 assert.equal(lab.stats.births.g,706);
 assert.equal(lab.stats.births.r,108);
 assert.equal(lab.stats.deaths.g.hunt,473);
 assert.equal(lab.stats.deaths.g.starve,225);
 assert.ok(ai.encounterStarts>0,'Red approaches should create exposure episodes');
 assert.ok(ai.encounterSurvived>0,'Some exposures should survive attack-free for a whole day');
 assert.ok(ai.encounterHit>0,'At least some exposures should be attacked');
 assert.equal(ai.encounterStarts,
   ai.encounterSurvived+ai.encounterHit+ai.encounterDiedOther+
   lab.entities.filter(e=>e.type==='g'&&e.aiEncounter).length,
   'Every episode resolves into attack-free survival, red attack, other death or active censoring');
 const groups=Object.values(ai.byGeneration);
 for(const key of ['encounterStarts','encounterSurvived','encounterHit','encounterDiedOther']){
   assert.equal(groups.reduce((sum,g)=>sum+g[key],0),ai[key]);
 }
 const latest=lab.history.at(-1);
 assert.equal(latest.aiEncounterStarts,ai.encounterStarts);
 assert.equal(latest.aiEncounterSurvived,ai.encounterSurvived);
 const control=new Lab({...options,mode:'normal'});control.run(100,.08);
 assert.equal(control.stats.ai.encounterStarts,0,'Normal behavior must be untouched');
 console.log('✓ 赤の120px接近後の1日無被弾生存を追跡し、旧シードの生態系結果を完全再現');
 console.log('  近接エピソード:',JSON.stringify({starts:ai.encounterStarts,survived:ai.encounterSurvived,hit:ai.encounterHit,diedOther:ai.encounterDiedOther}));
}
function testAttackFreeOutcomes(){
 const lab=new Lab({seed:410,green:1,red:1,blue:0,mode:'escape',duration:5});
 const g=lab.entities.find(e=>e.type==='g'),r=lab.entities.find(e=>e.type==='r');
 lab.day=.1;
 lab.aiEncounterStart(g,r,80);
 assert.equal(lab.stats.ai.encounterStarts,1);
 lab.day=1.101;lab.aiEncounterObserve(g,null);
 assert.equal(lab.stats.ai.encounterSurvived,1);
 assert.equal(lab.stats.ai.encounterHit,0);
 lab.day=1.3;lab.aiEncounterStart(g,r,95);lab.aiEncounterHit(g,r);
 assert.equal(lab.stats.ai.encounterHit,1);
 lab.day=1.5;lab.aiEncounterStart(g,r,100);lab.die(g,'age');
 assert.equal(lab.stats.ai.encounterDiedOther,1);
 assert.equal(lab.stats.ai.encounterStarts,3);
 console.log('✓ 1日無被弾／途中被弾／その他死亡を重複なく分類');
}
function testUnchangedRedRules(){
 const input={seed:424242,green:0,red:10,blue:0,variance:10,regrowth:100,duration:40};
 const n=new Lab({...input,mode:'normal'});
 const a=new Lab({...input,mode:'escape'});
 // No green = neural escape system never runs. Red dynamics must be identical.
 n.run(40,.08);a.run(40,.08);
 assert.deepEqual(a.counts(),n.counts(),'Red population must be unchanged when green behavior is absent');
 assert.deepEqual(a.stats.births.r,n.stats.births.r,'Red births share exactly the same rule');
 assert.deepEqual(a.stats.deaths.r,n.stats.deaths.r,'Red death rules share the same implementation');
 assert.deepEqual(a.history.map(x=>x.r),n.history.map(x=>x.r),'Red trajectory must match step-by-step');
 console.log('✓ 赤の出生・死亡・移動のルールはノーマルとAI①で完全一致');
}
testLastChanceMeal();testWalls();
testNeuroevolution();
testGentlerMutation();
testEscapeBehaviorTelemetry();
testDistanceBreakClassification();
testAttackFreeExposure();
testAttackFreeOutcomes();
testUnchangedRedRules();
