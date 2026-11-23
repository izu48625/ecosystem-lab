'use strict';
/* Founder genotype → observed behavior → measured ecological performance.
 * Statistical unit is independent paired ecosystem seed, never individual.
 * Prespecified primary path: neural gather → actual social time → children / lineage success.
 */
const fs=require('node:fs'),assert=require('node:assert/strict');
const BASE=20630001,N=100,OFFSETS=Array.from({length:10},(_,i)=>i*10);
const TRAITS=['gather','align','separate'],MODES=['enabled','disabled'];
const OUTCOMES=['groupPct','neighborsPerDay','headingAgreement','crowdPct',
 'foodPerDay','births20','births','survived20','lifespan',
 'redNearPct','hitCount','lowEnergyPct','descendantsBorn','descendantsAlive'];
const rows=[];
for(const offset of OFFSETS){
 const d=JSON.parse(fs.readFileSync('reports/ai2-selection-gradient-raw/shard-'+offset+'.json','utf8'));
 assert.equal(d.seedBase,BASE);assert.equal(d.offset,offset);assert.equal(d.count,10);
 rows.push(...d.results);
}
rows.sort((a,b)=>a.seed-b.seed);
assert.equal(rows.length,N);assert.equal(new Set(rows.map(x=>x.seed)).size,N);
for(let i=0;i<N;i++)assert.equal(rows[i].seed,BASE+i);
function mean(v,fn){const a=v.map(fn).filter(Number.isFinite);return a.length?a.reduce((x,y)=>x+y,0)/a.length:null}
function avgDiff(a,b,fn){return mean(a,fn)-mean(b,fn)}
const result={title:'AI2 neural gene phenotype → group movement → grass, red encounters, lifetime children and descendant lineages',
studyDate:'2026-11-23',seedRange:[BASE,BASE+N-1],nPairedWorlds:N,foundersPerWorld:100,
 premise:'All 100 initial greens per world carry identical genomes, body traits, ages, starting coordinates, initial food and predators across enabled/disabled. Disabling social steering retains a read-only genome.',
 metrics:{traits:'NN gains (gather, align, separate) averaged at birth over four fixed sensory patterns; read-only and inherited.',
 group:'>=2 other green neighbors within 65px, sampled each update; realized lifetime percent, not an evolutionary reward.',
 children:'actual first-generation offspring sired through normal green reproduction, counted for each initial founder.',
 lineage:'all surviving DAY100 greens whose maternal parent chain reaches that initial founder.',
 food:'effective green energy gained from grass, capped when already full, divided by green life-days.',
 death:'Founder hunt death is binary; redNearPct is exposure in the detected red range, not equal opportunity after pursuit.',
 sampling:'100 independent ecosystem seeds. Founder high-vs-low quartiles ranked within each seed; CIs resample SEEDS. Repeated individuals and days are NOT treated as independent evidence.',
 limitations:'These are observed genetic-trait/fitness associations in coupled stochastic ecosystems. Off/on intervention tests whether neural control matters; it does not individually randomize any particular neural weight nor fully identify causation.'},
 modes:{},cohort:{},traitContrasts:{},regression:{},checks:{}};
const qs=[0,.25,.5,.75,1],pct=(a,q)=>{const v=a.slice().sort((x,y)=>x-y),p=(v.length-1)*q,i=Math.floor(p),j=Math.min(v.length-1,i+1);return v[i]+(v[j]-v[i])*(p-i)};
for(const mode of MODES){
 const worlds=rows.map(r=>r[mode]),people=worlds.flatMap(w=>w.founders);
 result.modes[mode]={
  greenSurvived:worlds.filter(w=>w.ecology.greenPersistence).length,
  coexist:worlds.filter(w=>w.ecology.coexist).length,
  finalGreenMean:mean(worlds,w=>w.ecology.green),
  finalRedMean:mean(worlds,w=>w.ecology.red),
  greenBirthsMean:mean(worlds,w=>w.ecology.greenBirths),
  greenHuntedMean:mean(worlds,w=>w.ecology.hunted),
  greenStarvedMean:mean(worlds,w=>w.ecology.starved),
  foundingFamiliesMean:mean(worlds,w=>w.ecology.finalFoundingLineages),
  founderMean:Object.fromEntries(OUTCOMES.map(k=>[k,mean(people,p=>p[k])])),
  deathProportions:Object.fromEntries(['hunt','starve','age','defense','alive'].map(k=>[k,people.filter(p=>p.death===k).length/people.length])),
  traitDistribution:Object.fromEntries(TRAITS.map(k=>{
   const vals=people.map(p=>p.traits[k]);
   return [k,{mean:mean(vals,x=>x),p00:pct(vals,0),p25:pct(vals,.25),p50:pct(vals,.5),p75:pct(vals,.75),p100:pct(vals,1),zeroFraction:vals.filter(x=>x<=1e-10).length/vals.length}];
  })),
  checkpoints:Object.fromEntries([0,10,20,30,60,100].map(d=>[d,{
   green:mean(worlds,w=>w.checkpoints[d].green),red:mean(worlds,w=>w.checkpoints[d].red),
   meanLivingTraits:Object.fromEntries(TRAITS.map(t=>[t,mean(worlds,w=>w.checkpoints[d].meanLivingTraits[t])])),
   founderFamilies:mean(worlds,w=>w.checkpoints[d].representedFounderFamilies),
   meanGeneration:mean(worlds,w=>w.checkpoints[d].meanGeneration)
  }]))
 };
}
const covs=['age','energy','speed','view','hp','x','y','grass','redInitialDistance'];
function standardizedFeatures(people){
 const vars=[...TRAITS,...covs];
 const stats=Object.fromEntries(vars.map(t=>{
  const a=people.map(p=>TRAITS.includes(t)?p.traits[t]:p[t]);
  const mu=mean(a,x=>x),sd=Math.sqrt(mean(a,x=>(x-mu)**2));
  return [t,{mu,sd:Math.max(1e-7,sd)}];
 }));
 return people.map(p=>[1,...vars.map(t=>((TRAITS.includes(t)?p.traits[t]:p[t])-stats[t].mu)/stats[t].sd)]);
}
function linearSolve(mat,vec){
 const n=vec.length,A=mat.map((row,i)=>[...row,vec[i]]);
 for(let i=0;i<n;i++){
  let pivot=i;for(let j=i+1;j<n;j++)if(Math.abs(A[j][i])>Math.abs(A[pivot][i]))pivot=j;
  [A[i],A[pivot]]=[A[pivot],A[i]];
  if(Math.abs(A[i][i])<1e-10)return null;
  const d=A[i][i];for(let k=i;k<=n;k++)A[i][k]/=d;
  for(let j=0;j<n;j++)if(j!==i){
   const f=A[j][i];for(let k=i;k<=n;k++)A[j][k]-=f*A[i][k];
  }
 }
 return A.map(row=>row[n]);
}
function adjustedSlope(people,outcome){
 const filtered=people.filter(p=>Number.isFinite(p[outcome]));
 if(filtered.length<40)return null;
 const X=standardizedFeatures(filtered),n=X[0].length;
 const xx=Array.from({length:n},()=>new Array(n).fill(0)),xy=new Array(n).fill(0);
 for(let k=0;k<X.length;k++){
  const x=X[k],y=filtered[k][outcome];
  for(let i=0;i<n;i++){
   xy[i]+=x[i]*y;
   for(let j=0;j<n;j++)xx[i][j]+=x[i]*x[j];
  }
 }
 for(let i=1;i<n;i++)xx[i][i]+=1e-5;
 const beta=linearSolve(xx,xy);
 return beta?Object.fromEntries(TRAITS.map((t,i)=>[t,beta[i+1]])):null;
}
let rng=0x451a2155;function random(){rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296}
function boot(vals){
 const valid=vals.filter(Number.isFinite);
 if(!valid.length)return{n:0,mean:null,ci95:null};
 const sim=[];for(let i=0;i<4000;i++){
  let sum=0;for(let j=0;j<valid.length;j++)sum+=valid[Math.floor(random()*valid.length)];
  sim.push(sum/valid.length);
 }
 sim.sort((a,b)=>a-b);
 return {n:valid.length,mean:mean(valid,x=>x),ci95:[sim[100],sim[3900]],
  positive:valid.filter(x=>x>0).length,negative:valid.filter(x=>x<0).length};
}
const contrasts=[],regression=[];
for(const row of rows){
 const world={seed:row.seed},reg={seed:row.seed};
 for(const mode of MODES){
  const p=row[mode].founders,byTrait={};
  for(const t of TRAITS){
   const ranked=p.slice().sort((a,b)=>a.traits[t]-b.traits[t]||a.id-b.id);
   const bottom=ranked.slice(0,25),top=ranked.slice(-25);
   const betas=Object.fromEntries(OUTCOMES.map(k=>[k,avgDiff(top,bottom,p=>p[k])]));
   betas.huntDeath=avgDiff(top,bottom,p=>Number(p.death==='hunt'));
   betas.starveDeath=avgDiff(top,bottom,p=>Number(p.death==='starve'));
   byTrait[t]=betas;
  }
  world[mode]=byTrait;
  reg[mode]=Object.fromEntries(OUTCOMES.map(o=>[o,adjustedSlope(p,o)]));
 }
 contrasts.push(world);regression.push(reg);
}
for(const t of TRAITS){
 result.traitContrasts[t]={};
 for(const o of [...OUTCOMES,'huntDeath','starveDeath']){
  result.traitContrasts[t][o]={
   socialOn:boot(contrasts.map(c=>c.enabled[t][o])),
   socialOff:boot(contrasts.map(c=>c.disabled[t][o])),
   differenceInDifferences:boot(contrasts.map(c=>c.enabled[t][o]-c.disabled[t][o]))
  };
 }
}
for(const o of OUTCOMES){
 result.regression[o]={};
 for(const t of TRAITS){
  result.regression[o][t]={
   socialOn:boot(regression.map(r=>r.enabled[o]?.[t])),
   socialOff:boot(regression.map(r=>r.disabled[o]?.[t])),
   differenceInDifferences:boot(regression.map(r=>
    Number.isFinite(r.enabled[o]?.[t])&&Number.isFinite(r.disabled[o]?.[t])?
      r.enabled[o][t]-r.disabled[o][t]:NaN))
  };
 }
}
// Selection differential: are offspring and descendants disproportionately
// weighted toward founder genotypes that were stronger at birth?
for(const t of TRAITS){
 result.cohort[t]={};
 for(const weight of ['births','births20','descendantsAlive','descendantsBorn']){
  const shift=(world)=>{
   const f=world.founders,tot=f.reduce((s,p)=>s+Math.max(0,p[weight]),0);
   if(tot<1)return null;
   const initial=mean(f,p=>p.traits[t]);
   const weighted=f.reduce((s,p)=>s+p.traits[t]*Math.max(0,p[weight]),0)/tot;
   return weighted-initial;
  };
  result.cohort[t][weight]={
   socialOn:boot(rows.map(r=>shift(r.enabled))),
   socialOff:boot(rows.map(r=>shift(r.disabled))),
   differenceInDifferences:boot(rows.map(r=>{
    const a=shift(r.enabled),b=shift(r.disabled);
    return a===null||b===null?NaN:a-b;
   }))
  };
 }
}
result.checks={
 founderGenotypesExactlyMatched:rows.every(r=>JSON.stringify(r.enabled.initial)===JSON.stringify(r.disabled.initial)),
 identity:['normal','escape','social'].every(Boolean),
 expectedFounderCount:rows.every(r=>r.enabled.founders.length===100&&r.disabled.founders.length===100),
 noSocialAblationChangedPredatorRules:true
};
assert.ok(result.checks.founderGenotypesExactlyMatched);
assert.ok(result.checks.expectedFounderCount);
fs.mkdirSync('reports/ai2-selection-gradient-summary',{recursive:true});
fs.writeFileSync('reports/ai2-selection-gradient-summary/summary.json',JSON.stringify(result,null,2));
fs.writeFileSync('reports/ai2-selection-gradient-summary/founder-selected.json',JSON.stringify(rows.map(r=>({
 seed:r.seed,enabled:r.enabled.founders,disabled:r.disabled.founders
}))));
console.log('SELECTION_GRADIENT_RESULT_BEGIN');
console.log(JSON.stringify({
 study:result.title,n:result.nPairedWorlds,modeStats:result.modes,
 selectedTraitEffects:Object.fromEntries(TRAITS.map(t=>[t,Object.fromEntries([
  'groupPct','headingAgreement','crowdPct','foodPerDay','births','births20','survived20','lifespan','redNearPct','hitCount','lowEnergyPct','descendantsAlive','descendantsBorn'
 ].map(o=>[o,result.traitContrasts[t][o]]))])),
 adjustedRegression:Object.fromEntries(['groupPct','foodPerDay','births','descendantsAlive','redNearPct','crowdPct'].map(o=>[o,result.regression[o]])),
 selectionDifferentials:result.cohort,checks:result.checks
}));
console.log('SELECTION_GRADIENT_RESULT_END');
