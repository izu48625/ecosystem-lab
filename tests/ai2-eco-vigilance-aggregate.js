'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const MODELS=['ecoMate','ecoVigilance'],ARMS=['evolve','clone','noninherited'],DAYS=[0,30,60,100],OFFSETS=[0,5,10,15],BASE=20560001;
const METRICS=['formationGroupPct','formationApproachPx','formationAlignment','crowdClosePct','dangerNoHitPct','dangerFirstHitTime'];
const data={};
for(const model of MODELS){
 const rows=[];
 for(const offset of OFFSETS){
  const d=JSON.parse(fs.readFileSync('reports/ai2-eco-vigilance-input/'+model+'/shard-'+offset+'.json','utf8'));
  assert.equal(d.selectionModel,model);assert.equal(d.seedBase,BASE);assert.equal(d.count,5);assert.equal(d.offset,offset);
  rows.push(...d.samples);
 }
 rows.sort((a,b)=>a.seed-b.seed);
 assert.equal(rows.length,20);assert.equal(new Set(rows.map(x=>x.seed)).size,20);
 for(let i=0;i<20;i++)assert.equal(rows[i].seed,BASE+i);
 data[model]=rows;
}
const mean=(a,f)=>a.length?a.reduce((s,x)=>s+f(x),0)/a.length:null;
let state=0xada12026;function rand(){state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296}
function bootstrap(deltas){
 const v=deltas.filter(x=>Number.isFinite(x));if(!v.length)return {n:0,mean:null,ci95:null};
 const arr=[];for(let i=0;i<4000;i++){let sum=0;for(let j=0;j<v.length;j++)sum+=v[Math.floor(rand()*v.length)];arr.push(sum/v.length)}
 arr.sort((a,b)=>a-b);return {n:v.length,mean:mean(v,x=>x),ci95:[arr[100],arr[3900]],positive:v.filter(x=>x>0).length};
}
const profile={};
for(const model of MODELS){
 const rows=data[model];profile[model]={};
 for(const arm of ARMS){
  const r=rows.map(x=>x[arm]);
  profile[model][arm]={
   greenAlive:r.filter(x=>x.greenAlive).length,
   coexist:r.filter(x=>x.coexist).length,
   meanGreen:mean(r,x=>x.finalGreen),
   meanRed:mean(r,x=>x.finalRed),
   meanHunted:mean(r,x=>x.hunted),
   meanStarved:mean(r,x=>x.starved),
   meanBirths:mean(r,x=>x.greenBirths),
   timeline:Object.fromEntries(DAYS.map(day=>{
    const all=r.map(x=>x.checkpoints[day]),valid=all.filter(x=>x.sampled>0);
    return [day,{nWorlds:valid.length,meanGeneration:mean(valid,x=>x.meanGeneration),
     ...Object.fromEntries(METRICS.map(k=>[k,mean(valid,x=>x[k])]))}];
   }))
  };
 }
}
const contrasts={};
for(const model of MODELS){
 const rows=data[model],read=(r,a,d,k)=>r[a].checkpoints[d][k];
 contrasts[model]={};
 for(const k of METRICS){
  contrasts[model][k]={
   vsFounder:bootstrap(rows.map(r=>read(r,'evolve',100,k)-read(r,'evolve',0,k))),
   vsMutationOff:bootstrap(rows.map(r=>read(r,'evolve',100,k)-read(r,'clone',100,k))),
   vsNoInheritance:bootstrap(rows.map(r=>read(r,'evolve',100,k)-read(r,'noninherited',100,k)))
  };
 }
}
const between={};
for(const key of ['finalGreen','finalRed','hunted','starved','greenBirths','greenAlive','coexist']){
 const get=r=>typeof r[key]==='boolean'?Number(r[key]):r[key];
 const x=data.ecoMate,y=data.ecoVigilance;
 between[key]=bootstrap(x.map((row,i)=>get(y[i].evolve)-get(row.evolve)));
}
for(const key of METRICS){
 const x=data.ecoMate,y=data.ecoVigilance;
 between[key]=bootstrap(x.map((row,i)=>y[i].evolve.checkpoints[100][key]-row.evolve.checkpoints[100][key]));
}
const v=contrasts.ecoVigilance.formationGroupPct,p=contrasts.ecoVigilance.dangerNoHitPct;
const screening={
 geneticGroupAdaptation:v.vsFounder.mean>3&&v.vsFounder.ci95[0]>0&&v.vsNoInheritance.mean>2&&v.vsNoInheritance.ci95[0]>0,
 mutationSpecificGroupImprovement:v.vsMutationOff.mean>2&&v.vsMutationOff.ci95[0]>0,
 predatorSkillImprovement:p.vsFounder.mean>3&&p.vsFounder.ci95[0]>0,
 ecologyNotDestroyed:profile.ecoVigilance.evolve.coexist>=profile.ecoMate.evolve.coexist-2&&
  profile.ecoVigilance.evolve.meanGreen>=profile.ecoMate.evolve.meanGreen*.85,
 decision:''
};
screening.decision=screening.geneticGroupAdaptation&&screening.ecologyNotDestroyed?
 'candidate_for_independent_100_seed_validation':
 'no_robust_genetic_group_improvement_in_20_seed_discovery';
const report={
 title:'Ecological mate preference plus neighbor-shared predator alarm: 20 independent seeds',
 goal:'Provide a biologically interpretable reason for cohesion without numeric safety bonuses; a green with direct red sighting can warn neighbours within 95px for .32 day. The inherited NN controls willingness to trust the warning.',
 redRulesChanged:false,bodyRulesChanged:false,
 note:'Researcher-designed mate choice and information transfer are interventions, not spontaneous innovation or proof of adaptive neuroevolution.',
 seedRange:[BASE,BASE+19],nWorlds:20,MODELS,ARMS,profiles:profile,withinModel:contrasts,between,screening,
 predeclaredClaimRules:'Improvement must be in held-out common-garden genotypes (not density): group formation rises >3pp over founder and >2pp over random-founder inheritance, seed-level CI lower>0 for both, and ecology coexistence decline <=2/20 with >=85% green count. Separate mutation claim needs >2pp and CI lower>0 over recombining mutation-off control.'
};
fs.mkdirSync('reports/ai2-eco-vigilance-report',{recursive:true});
fs.writeFileSync('reports/ai2-eco-vigilance-report/summary.json',JSON.stringify(report,null,2));
console.log('AI2_VIGILANCE_RESULT_BEGIN');
console.log(JSON.stringify({profile,contrasts,between,screening}));
console.log('AI2_VIGILANCE_RESULT_END');
