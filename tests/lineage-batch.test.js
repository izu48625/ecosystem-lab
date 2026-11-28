'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {Lab}=require('../src/sim-core.js');
function load(name){const window={};vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../src/'+name),'utf8'),{window});return window}
const L=load('lineage-view.js').EcosystemLineage;
const B=load('batch-studio.js').EcosystemBatch;
assert.ok(L&&B);
const vals={seed:20261117,green:100,red:20,blue:0,variance:10,regrowth:100,mode:'social',duration:100};
const a=new Lab({...vals,trackLineages:true}),b=new Lab(vals);
a.aiLog=()=>{};b.aiLog=()=>{};a.run(22,.08);b.run(22,.08);
const stable=(lab)=>JSON.stringify({seed:lab.seed,stats:lab.stats,grass:lab.grass,
entities:lab.entities.map(e=>[e.id,e.x,e.y,e.age,e.energy,e.children,e.genome,e.parentId]),
history:lab.history});
assert.equal(stable(a),stable(b),'read-only lineage tracking must not change ecology or genetics');
assert.equal(a.lineageRecords.size,a.stats.births.g+vals.green,'each green birth and founder retained');
assert.equal(a.lineageIds.length,a.lineageRecords.size);
assert.equal(b.lineageRecords.size,0,'batch worlds do not need lineage memory');
const founders=[...a.lineageRecords.values()].filter(e=>e.parentId===null);
assert.equal(founders.length,100);
let children=0,dead=0,mutated=0;
for(const row of a.lineageRecords.values()){
 assert.ok(row.foodEnergy>=0&&row.lifeDays>=0);
 assert.ok(row.groupDays<=row.lifeDays+.001&&row.crowdDays<=row.lifeDays+.001);
 if(row.death){dead++;assert.ok(row.deathDay!==null&&!row.alive)}
 else assert.ok(row.alive);
 assert.equal(row.children.length,[...a.lineageRecords.values()].filter(p=>p.parentId===row.id).length);
 for(const id of row.children)assert.equal(a.lineageRecords.get(id).parentId,row.id);
 children+=row.children.length;if(row.geneticDelta)mutated++;
 assert.ok(row.checkpoints.every(p=>p.day===row.bornDay||p.day%10===0));
 const family=a.lineageDetail(row.id);assert.equal(family.person.id,row.id);
 assert.ok(family.ancestors.length>=1);
 assert.equal(family.ancestors[0].id,row.rootId);
 if(row.parentId)assert.equal(family.ancestors.at(-2).id,row.parentId);
 assert.ok(family.descendantsAlive<=family.descendantsTotal);
}
assert.equal(children,a.stats.births.g);
assert.ok(dead>0&&mutated>0);
const key=a.lineageIds.find(id=>a.lineageRecords.get(id).children.length>0);
const detail=a.lineageDetail(key);
assert.ok(detail.directChildren.length>0);
assert.ok(L.csv(detail).includes('descendantsAlive'));
assert.ok(L.csv(detail).includes('ancestorId'));
const leaders=a.lineageLeaders(6);
assert.ok(leaders.length>0&&leaders.length<=6);
assert.ok(leaders.every(r=>r.alive>0));
for(let i=1;i<leaders.length;i++)assert.ok(leaders[i-1].alive>=leaders[i].alive);
const fakeCtx=new Proxy({}, {get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
const canvas={width:1600,height:900,getContext:()=>fakeCtx};
assert.equal(L.paint(canvas,detail,a).person.id,key);
assert.ok(L.paint(canvas,null,a).error);
assert.throws(()=>L.csv(null));
console.log('✓ Tracking every green birth, dead/alive lineage, hereditary NN traits, food/attacks and family diagram; deterministic ecology unchanged');
const study=B.createStudy({baseSeed:20261117,count:2,settings:vals});
assert.throws(()=>B.finish(study),'incomplete study must not be presented');
for(let i=0;i<2;i++){
 for(const mode of ['normal','escape','social']){
  const l=new Lab({...vals,seed:20261117+i,mode,trackLineages:false});
  l.aiLog=()=>{};l.run(100,.08);
  B.ingest(study,mode,l);
 }
}
B.finish(study);
const summary=B.summary(study);
assert.equal(summary.social.n,2);
assert.ok(summary.paired.ci95[0]<=summary.paired.mean);
assert.ok(summary.paired.ci95[1]>=summary.paired.mean);
for(const graph of Object.keys(B.METRICS)){
 const result=B.seriesFor(study,graph);
 assert.ok(!result.error&&result.series.length>0);
 for(const series of result.series){assert.equal(series.points.length,101);
  for(const p of series.points)if(p.value!==null){
   assert.ok(p.p10<=p.value+1e-7&&p.value<=p.p90+1e-7);
  }
 }
 const render=B.paint(canvas,study,graph);assert.ok(!render.error);
 const csv=B.csv(study,graph);assert.ok(csv.includes('day')&&csv.startsWith('\ufeff'));
 assert.ok(!csv.includes('NaN'));
}
assert.ok(B.summaryCsv(study).includes('coexist'));
assert.equal(B.seriesFor(null,'green').error,'一括集計がありません。');
assert.throws(()=>B.createStudy({baseSeed:0,count:101,settings:vals}));
assert.throws(()=>B.ingest(study,'social',new Lab({...vals,seed:666})));
console.log('✓ Independent 2 paired world seeds, 100-day curves, p10/p90 band, paired bootstrap, 16:9 graphics and all CSVs');
