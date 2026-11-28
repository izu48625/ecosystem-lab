'use strict';
// Export actual 100-day snapshots from the production ECOSYSTEM LAB engine.
// This file never edits movement/genomes/fitness; rendering happens afterwards.
const fs=require('node:fs'),path=require('node:path'),{Lab}=require('../src/sim-core.js');
const frames=360,seed=20261117;
const sim=new Lab({seed,green:100,red:20,blue:0,mode:'social',
  variance:10,regrowth:100,duration:100});
sim.aiLog=function(){};
const dir=path.resolve('video-previews');
fs.mkdirSync(dir,{recursive:true});
const fd=fs.openSync(path.join(dir,'ai2-source-frames.jsonl'),'w');
for(let i=0;i<frames;i++){
 const day=100*i/(frames-1);sim.run(day,.08);
 const counts=sim.counts();
 const alive=sim.entities.filter(e=>e.alive);
 const greens=alive.filter(e=>e.type==='g');
 const meanGeneration=greens.length?greens.reduce((v,e)=>v+(e.generation||0),0)/greens.length:0;
 const record={
  frame:i,seed,day:+sim.day.toFixed(4),
  g:counts.g,r:counts.r,grass:+(sim.grassTotal()*100).toFixed(1),
  gen:+meanGeneration.toFixed(2),
  agents:alive.map(e=>[+e.x.toFixed(1),+e.y.toFixed(1),+e.angle.toFixed(2),e.type,+e.energy.toFixed(1)]),
  vegetation:sim.grass.map(v=>Math.round(v*100)/100)
 };
 fs.writeSync(fd,JSON.stringify(record)+'\n');
 if(i%72===0||i===frames-1)console.error('Recorded frame',i+1,'/',frames,'DAY',sim.day.toFixed(1),'green',counts.g,'red',counts.r);
}
fs.closeSync(fd);
fs.writeFileSync(path.join(dir,'ai2-source-metadata.json'),JSON.stringify({
 seed,mode:'social',worlds:1,days:100,frames,initial:{green:100,red:20,blue:0},
 final:sim.counts(),counters:sim.stats,
 note:'This is an accelerated real engine visualization. No voice and no edited ecology.'
},null,2));
console.log('FRAME_EXPORT_FINISHED',frames,sim.day,sim.counts());
