'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const {Lab,neuralForward}=require('../src/sim-core.js');
const app={};
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../src/video-lab.js'),'utf8'),
 {window:app,document:{},Math,Number});
const video=app.EcosystemVideo;
assert.ok(video);
const seed=20261117,opts={seed,green:100,red:20,blue:0,variance:10,regrowth:100,duration:100};
const labs={};
for(const [key,mode] of [['normal','normal'],['ai1','escape'],['ai2','social']]){
 const lab=new Lab({...opts,mode});lab.aiLog=function(){};
 lab.run(12,.08);labs[key]=lab;
 assert.ok(lab.history.length>=13);
 for(const row of lab.history){
  assert.ok(Number.isFinite(row.birthg));
  assert.ok(Number.isFinite(row.huntg));
  assert.ok(Number.isFinite(row.killsr));
  assert.ok(Number.isFinite(row.huntsr));
  assert.ok(row.birthg>=0&&row.huntg>=0);
 }
 assert.equal(lab.history.at(-1).g,lab.counts().g);
 const table=video.seriesFor(lab,'daily');
 const births=table.series[0].points;
 const hunted=table.series[1].points;
 assert.equal(births.reduce((sum,r)=>sum+r.value,0),lab.stats.births.g);
 assert.equal(hunted.reduce((sum,r)=>sum+r.value,0),lab.stats.deaths.g.hunt);
 const grass=video.seriesFor(lab,'grass').series[0].points;
 assert.ok(grass.every(p=>p.value>=0&&p.value<=100));
 assert.ok(video.csv(lab,'population').includes('DAY')===false);
 assert.ok(video.csv(lab,'daily').includes('緑の捕食死'));
}
assert.equal(video.seriesFor(labs.normal,'genes').series.length,0);
assert.ok(video.seriesFor(labs.normal,'genes').error);
assert.ok(video.seriesFor(labs.ai1,'genes').error);
const social=labs.ai2;
for(const row of social.history){
 assert.ok(row.ai2GeneGather===null||row.ai2GeneGather>=0);
 assert.ok(row.ai2GeneAlign===null||row.ai2GeneAlign>=0);
 assert.ok(row.ai2GeneSeparate===null||row.ai2GeneSeparate>=0);
 assert.ok(row.ai2LargestConnectedPct>=0&&row.ai2LargestConnectedPct<=100);
 assert.ok(row.ai2GroupedPct>=0&&row.ai2GroupedPct<=100);
 assert.ok(row.ai2HeadingAlignment===null||(row.ai2HeadingAlignment>=-1&&row.ai2HeadingAlignment<=1));
}
const genes=video.seriesFor(social,'genes');
assert.equal(genes.series.length,3);
assert.equal(genes.series[0].points[0].value,social.history[0].ai2GeneGather);
// Independently recompute standardized NN probes; must match experiment semantics.
const stimuli=[
 [.72,.12,.8,.2,.35,.7,.85,.7,0,0],
 [-.65,.32,.75,.5,.55,.22,.66,.5,.1,-.2],
 [.43,-.38,-.6,.8,.8,.4,.7,.75,-.2,.1],
 [-.4,-.2,.6,-.5,.35,.55,.72,.45,-.3,.1]
];
const alive=social.entities.filter(e=>e.alive&&e.type==='g');
const means=[0,0,0];
for(const e of alive){
 const outputs=[0,0,0];
 for(const v of stimuli)neuralForward(e.genome,v).forEach((x,j)=>outputs[j]+=x);
 means[0]+=Math.max(0,.16+outputs[0]/4*2.5);
 means[1]+=Math.max(0,.12+outputs[1]/4*2);
 means[2]+=Math.max(0,.34+outputs[2]/4*2.2);
}
const last=social.history.at(-1);
for(const [i,key] of ['ai2GeneGather','ai2GeneAlign','ai2GeneSeparate'].entries()){
 assert.ok(Math.abs(last[key]-means[i]/alive.length)<.000051,key+' matches real neural outputs');
}
// Independently compute true connected component via brute-force graph.
const par=alive.map((e,i)=>i);
const find=i=>{while(par[i]!==i)i=par[i];return i};
let hsum=0,pairs=0;
for(let i=0;i<alive.length;i++)for(let j=i+1;j<alive.length;j++){
 const x=alive[i],y=alive[j];
 const d=(x.x-y.x)**2+(x.y-y.y)**2;
 if(d<65*65&&d>1e-10){par[find(j)]=find(i);hsum+=Math.cos(x.angle-y.angle);pairs++}
}
const groups={};for(let i=0;i<alive.length;i++){const key=find(i);groups[key]=(groups[key]||0)+1}
const largest=Object.values(groups).reduce((a,b)=>Math.max(a,b),0);
assert.ok(Math.abs(last.ai2LargestConnectedPct-largest/alive.length*100)<.011);
assert.ok(pairs>0);
assert.ok(Math.abs(last.ai2HeadingAlignment-hsum/pairs)<.000051);
const mockCtx=new Proxy({}, {get:(target,key)=>target[key]||function(){},set:(target,key,v)=>(target[key]=v,true)});
const canvas={width:1600,height:900,getContext:()=>mockCtx};
for(const graph of Object.keys(video.CHARTS)){
 const result=video.paint(canvas,{lab:social,graph,comparison:graph==='compare'?
  {seed,normal:labs.normal,ai1:labs.ai1,ai2:labs.ai2}:null});
 if(graph==='compare')assert.equal(result.series.length,3);
 else assert.ok(result.series.length>0);
 assert.ok(!result.error);
 const csv=video.csv(social,graph,graph==='compare'?{seed,normal:labs.normal,ai1:labs.ai1,ai2:labs.ai2}:null);
 assert.ok(csv.startsWith('\ufeff'));
 assert.ok(csv.includes('day'));
 assert.ok(!csv.includes('NaN'));
}
const comparison={seed,normal:labs.normal,ai1:labs.ai1,ai2:labs.ai2};
const over=video.seriesFor(social,'compare',comparison);
assert.equal(over.series[0].points.at(-1).value,labs.normal.history.at(-1).g);
assert.equal(over.series[1].points.at(-1).value,labs.ai1.history.at(-1).g);
assert.equal(over.series[2].points.at(-1).value,labs.ai2.history.at(-1).g);
assert.equal(video.signature({seed:1,green:100,red:20,variance:10,regrowth:100}),
 video.signature({seed:1,green:100,red:20,blue:0,variance:10,regrowth:100}));
assert.notEqual(video.signature({seed:1,green:100,red:20,variance:10,regrowth:100}),
 video.signature({seed:2,green:100,red:20,variance:10,regrowth:100}));
console.log('✓ 16:9 video charts: real NN inheritance series, connected groups, heading alignment, daily births/deaths, same-seed overlay, CSV');
