/* Ecosystem Lab — deterministic, browser-and-Node compatible simulation engine.
 * All times are fictional in-game days. Optional escape mode uses local neuroevolution.
 */
(function (host, factory) {
  const API = factory();
  if (typeof module === 'object' && module.exports) module.exports = API;
  if (host) host.EcosystemCore = API;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const W = 960, H = 600, GRID_X = 32, GRID_Y = 20, CELL = 30, MAX_POP = 850;
  const SPECIES = Object.freeze({
    g: { name:'草食・緑', hp:60, attack:10, speed:1, life:24, mature:3, reproduction:5, drain:20, view:1.2, birthRate:0.50, birthEnergy:72, birthCost:30, hunting:false, color:'#7de2a5' },
    r: { name:'肉食A・赤', hp:80, attack:20, speed:1.15, life:38, mature:5, reproduction:9, drain:12, view:1, birthRate:0.19, birthEnergy:71, birthCost:28, hunting:true, foodGain:94, attackCooldown:0.24, color:'#ff816f' },
    b: { name:'肉食B・青', hp:100, attack:35, speed:1.35, life:45, mature:7, reproduction:13, drain:23, view:1.1, birthRate:0.18, birthEnergy:76, birthCost:32, hunting:true, foodGain:91, attackCooldown:0.18, color:'#7baaff' }
  });
  function clamp(a,min,max){return Math.max(min,Math.min(max,a))}
  // Each green herbivore carries an independently inherited neural genome.
  // 10 sensory inputs -> 8 hidden units -> 3 action parameters (115 weights).
  const BRAIN_INPUTS=10,BRAIN_HIDDEN=8,BRAIN_OUTPUTS=3;
  const BRAIN_SIZE=(BRAIN_INPUTS+1)*BRAIN_HIDDEN+(BRAIN_HIDDEN+1)*BRAIN_OUTPUTS;
  const ESCAPE_MUTATION=Object.freeze({probability:.02,maxDelta:.10});
  function initialBrain(seed,id){
    let state=(seed^Math.imul(id,0x9e3779b1))>>>0;
    const rand=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296};
    return Array.from({length:BRAIN_SIZE},()=> (rand()*2-1)*.38);
  }
  function neuralForward(weights,input){
    let offset=0;
    const hidden=new Array(BRAIN_HIDDEN);
    for(let i=0;i<BRAIN_HIDDEN;i++){
      let v=weights[offset+BRAIN_INPUTS];
      for(let j=0;j<BRAIN_INPUTS;j++)v+=weights[offset+j]*input[j];
      hidden[i]=Math.tanh(v);offset+=BRAIN_INPUTS+1;
    }
    const outputs=[];
    for(let i=0;i<BRAIN_OUTPUTS;i++){
      let v=weights[offset+BRAIN_HIDDEN];
      for(let j=0;j<BRAIN_HIDDEN;j++)v+=weights[offset+j]*hidden[j];
      outputs.push(Math.tanh(v));offset+=BRAIN_HIDDEN+1;
    }
    return outputs; // avoidance angle, lateral motion, danger threshold adaptation
  }
  class Lab {
    constructor(settings={}) { this.reset(settings); }
    reset(settings={}){
      this.settings={
        seed:Math.floor(settings.seed??12345)>>>0,
        green:clamp(Number(settings.green??100),0,300),
        red:clamp(Number(settings.red??10),0,60),
        blue:clamp(Number(settings.blue??10),0,60),
        variance:clamp(Number(settings.variance??10),0,25)/100,
        regrowth:clamp(Number(settings.regrowth??100),20,250)/100,
        mode:settings.mode==='social'?'social':settings.mode==='escape'?'escape':'normal',
        // Social ablation: identical AI2 predator avoidance without neighbour steering.
        socialEnabled:settings.socialEnabled!==false,
        socialEvolution:['baseline','ecoMate','ecoMateWide','ecoMateHunger'].includes(settings.socialEvolution)?settings.socialEvolution:'baseline',
        socialNoMutation:settings.socialNoMutation===true,
        // Green-only strategies. 'baseline' preserves the old AI1 for reproducible historical comparison.
        escapePolicy:['baseline','early','guard','wide'].includes(settings.escapePolicy)?
          settings.escapePolicy:'wide',
        // Default stays at 100 days for batch studies; the live UI opts into unlimited days.
        duration:settings.duration===Infinity?Infinity:clamp(Number(settings.duration??100),1,5000000)
      };
      this.seed=this.settings.seed||1;this.day=0;this.nextId=0;this.entities=[];
      this.grass=Array.from({length:GRID_X*GRID_Y},()=>this.rand(.5,1));
      this.history=[];this.events=[];this.effects=[];
      this.stats={births:{g:0,r:0,b:0},deaths:{g:{hunt:0,starve:0,age:0,defense:0},r:{hunt:0,starve:0,age:0,defense:0},b:{hunt:0,starve:0,age:0,defense:0}},kills:{r:0,b:0},hunts:{r:0,b:0},strikes:{r:0,b:0},counters:0,
        // Exposure is the total time spent alive by all members of each species.
        individualDays:{g:0,r:0,b:0},edgeDays:{g:0,r:0,b:0},starveWithGlobalGrass:{g:0,r:0,b:0},starveWithLocalGrass:{g:0,r:0,b:0},ai:{founders:0,offspring:0,mutatedOffspring:0,mutatedGenes:0,highestGeneration:0,threatDays:0,fleeDays:0,riskDays:0,
          // Observational telemetry only: no changes to movement, predators, or PRNG.
          fleeStarts:0,startDistanceSum:0,turnSamples:0,turnDegSum:0,awayDegSum:0,
          chaseStarts:0,chaseEscaped:0,chaseCaught:0,chaseOther:0,
          // One-day, attack-free survival after a red comes within 120px.
          encounterStarts:0,encounterSurvived:0,encounterHit:0,encounterDiedOther:0,
          byGeneration:{},escapeEvents:[],eventsDropped:0}};
      for(const [k,count] of [['g',this.settings.green],['r',this.settings.red],['b',this.settings.blue]]) for(let i=0;i<count;i++) this.spawn(k,this.rand(24,W-24),this.rand(24,H-24),true);
      this.record('start',this.settings.mode==='social'?'AI②：緑の群れ行動を遺伝・突然変異させる実験を開始':this.settings.mode==='escape'?'AI①：緑の逃走判断を遺伝・突然変異させる実験を開始':'緑・赤の生物を投入');this.snapshot(0);
      return this;
    }
    rnd(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296}
    rand(a,b){return a+(b-a)*this.rnd()}
    record(kind,text){this.events.unshift({day:Number(this.day.toFixed(1)),kind,text});if(this.events.length>50)this.events.pop()}
    mutateBrain(parent,mate=null){
      const experimental=this.settings.mode==='social'&&this.settings.socialEvolution!=='baseline';
      const wide=experimental&&this.settings.socialEvolution==='ecoMateWide';
      const chance=wide?.05:ESCAPE_MUTATION.probability,deltaMax=wide?.24:ESCAPE_MUTATION.maxDelta;
      let changed=0;
      const child=parent.genome.map((w,i)=>{
        const inherited=experimental&&mate&&this.rnd()<.35?mate.genome[i]:w;
        if(this.rnd()<chance){
          const delta=(this.rnd()*2-1)*deltaMax;
          if(experimental&&this.settings.socialNoMutation)return inherited;
          changed++;return clamp(inherited+delta,-3,3);
        }
        return inherited;
      });
      this.stats.ai.offspring++;
      if(changed)this.stats.ai.mutatedOffspring++;
      this.stats.ai.mutatedGenes+=changed;
      return child;
    }
    // The mate preference is imposed by the researcher: ecological mate choice,
    // not evidence that natural evolution has already occurred.
    ecologicalMateScore(e){
      const days=Math.max(.4,e.ecoDays||.4);
      const foodRate=(e.ecoFood||0)/days;
      const escapes=e.ecoEscapes||0,hits=e.ecoHits||0;
      const births=e.children/Math.max(1,days/8);
      return .50*Math.min(2.5,foodRate/32)
        +.30*Math.min(3,births)+.30*Math.min(2.5,escapes/(1+hits))
        -.55*Math.min(3,hits/Math.max(1,days/10))
        +.16*Math.max(0,(e.energy-45)/55);
    }
    chooseEcologicalMate(parent,index){
      const {cellSize,nx,ny,buckets}=index,range=132;
      const minX=clamp(Math.floor((parent.x-range)/cellSize),0,nx-1),maxX=clamp(Math.floor((parent.x+range)/cellSize),0,nx-1);
      const minY=clamp(Math.floor((parent.y-range)/cellSize),0,ny-1),maxY=clamp(Math.floor((parent.y+range)/cellSize),0,ny-1);
      const candidates=[];
      for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++)for(const e of buckets[y*nx+x]){
        if(e===parent||!e.alive||e.type!=='g'||e.age<SPECIES.g.mature||e.energy<55)continue;
        if((e.x-parent.x)**2+(e.y-parent.y)**2<range**2)candidates.push(e);
      }
      if(!candidates.length)return null;
      let chosen=candidates[Math.floor(this.rnd()*candidates.length)];
      let best=this.ecologicalMateScore(chosen);
      for(let i=0;i<2;i++){
        const next=candidates[Math.floor(this.rnd()*candidates.length)];
        const score=this.ecologicalMateScore(next);
        if(score>best){chosen=next;best=score}
      }
      return chosen;
    }
    aiGeneration(generation){
      const ai=this.stats.ai,key=String(generation);
      if(!ai.byGeneration[key])ai.byGeneration[key]={
        born:0,fleeStarts:0,startDistanceSum:0,turnSamples:0,turnDegSum:0,awayDegSum:0,
        chaseStarts:0,chaseEscaped:0,chaseCaught:0,chaseOther:0,
        encounterStarts:0,encounterSurvived:0,encounterHit:0,encounterDiedOther:0
      };
      return ai.byGeneration[key];
    }
    aiLog(event){
      const ai=this.stats.ai;
      if(ai.escapeEvents.length<20000)ai.escapeEvents.push(event);
      else ai.eventsDropped++;
    }
    aiFleeStarted(green,red,distance,priorHeading,x,y){
      const ai=this.stats.ai,gen=this.aiGeneration(green.generation);
      ai.fleeStarts++;gen.fleeStarts++;
      ai.startDistanceSum+=distance;gen.startDistanceSum+=distance;
      const displacement=Math.hypot(green.x-x,green.y-y);
      let turnDeg=null,awayDeg=null;
      if(displacement>1e-8){
        const heading=Math.atan2(green.y-y,green.x-x);
        const away=Math.atan2(y-red.y,x-red.x);
        const degrees=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)))*180/Math.PI;
        turnDeg=degrees(heading,priorHeading);
        awayDeg=degrees(heading,away);
        ai.turnSamples++;gen.turnSamples++;
        ai.turnDegSum+=turnDeg;gen.turnDegSum+=turnDeg;
        ai.awayDegSum+=awayDeg;gen.awayDegSum+=awayDeg;
      }
      this.aiLog({
        day:Number(this.day.toFixed(3)),kind:'flee_start',
        greenId:green.id,generation:green.generation,redId:red.id,
        startDistance:Number(distance.toFixed(2)),
        turnDeg:turnDeg===null?null:Number(turnDeg.toFixed(2)),
        awayDeg:awayDeg===null?null:Number(awayDeg.toFixed(2))
      });
    }
    aiChaseStart(red,green){
      if(this.settings.mode==='normal'||red.type!=='r')return;
      if(red.aiChase)this.aiChaseFinish(red,'other');
      red.aiChase={greenId:green.id,generation:green.generation,startDay:this.day};
      this.stats.ai.chaseStarts++;this.aiGeneration(green.generation).chaseStarts++;
      this.aiLog({
        day:Number(this.day.toFixed(3)),kind:'chase_start',
        greenId:green.id,generation:green.generation,redId:red.id,
        startDistance:Number(Math.hypot(green.x-red.x,green.y-red.y).toFixed(2)),
        turnDeg:null,awayDeg:null,outcome:null,detail:null,pursuitDays:null
      });
    }
    aiChaseFinish(red,outcome,detail=''){
      const ongoing=red.aiChase;
      if(!ongoing)return;
      const ai=this.stats.ai,group=this.aiGeneration(ongoing.generation);
      const field={escaped:'chaseEscaped',caught:'chaseCaught',other:'chaseOther'}[outcome];
      ai[field]++;group[field]++;
      this.aiLog({
        day:Number(this.day.toFixed(3)),kind:'chase_end',
        greenId:ongoing.greenId,generation:ongoing.generation,redId:red.id,
        outcome,detail,startDistance:null,turnDeg:null,awayDeg:null,
        pursuitDays:Number((this.day-ongoing.startDay).toFixed(3))
      });
      red.aiChase=null;
    }
    aiEncounterFinish(green,outcome){
      const episode=green.aiEncounter;
      if(!episode)return;
      const ai=this.stats.ai,group=this.aiGeneration(green.generation);
      const field={survived:'encounterSurvived',hit:'encounterHit',diedOther:'encounterDiedOther'}[outcome];
      if(!field)throw new Error('Unknown encounter result: '+outcome);
      ai[field]++;group[field]++;
      if(this.settings.mode==='social'&&this.settings.socialEvolution!=='baseline'){
        if(outcome==='survived')green.ecoEscapes=(green.ecoEscapes||0)+1;
        if(outcome==='hit')green.ecoHits=(green.ecoHits||0)+1;
      }
      this.aiLog({
        day:Number(this.day.toFixed(3)),kind:'red_proximity_end',
        greenId:green.id,generation:green.generation,redId:episode.redId,
        startDay:Number(episode.startDay.toFixed(3)),
        startDistance:Number(episode.startDistance.toFixed(2)),
        startEnergy:Number(episode.startEnergy.toFixed(2)),
        outcome,windowDays:1
      });
      green.aiEncounter=null;
    }
    aiEncounterStart(green,red,distance){
      if(this.settings.mode==='normal'||green.type!=='g'||red.type!=='r')return;
      const ai=this.stats.ai,group=this.aiGeneration(green.generation);
      green.aiEncounter={
        startDay:this.day,redId:red.id,startDistance:distance,startEnergy:green.energy
      };
      green.aiThreatNear=true;
      ai.encounterStarts++;group.encounterStarts++;
      this.aiLog({
        day:Number(this.day.toFixed(3)),kind:'red_proximity_start',
        greenId:green.id,generation:green.generation,redId:red.id,
        startDistance:Number(distance.toFixed(2)),startEnergy:Number(green.energy.toFixed(2)),
        windowDays:1
      });
    }
    aiEncounterObserve(green,red){
      if(this.settings.mode==='normal')return;
      const active=green.aiEncounter;
      if(active&&this.day-active.startDay>=1-1e-8)this.aiEncounterFinish(green,'survived');
      const distance=red?Math.hypot(green.x-red.x,green.y-red.y):Infinity;
      const near=distance<=120;
      // One event per contiguous near-red interval; do not count each tick.
      if(!near)green.aiThreatNear=false;
      if(near&&!green.aiThreatNear&&!green.aiEncounter){
        this.aiEncounterStart(green,red,distance);
      }
    }
    aiEncounterHit(green,red){
      if(this.settings.mode==='normal'||red.type!=='r'||green.type!=='g')return;
      // If an attack occurs before this green's update, do not miss the exposure.
      if(!green.aiEncounter && !green.aiThreatNear){
        this.aiEncounterStart(green,red,Math.hypot(green.x-red.x,green.y-red.y));
      }
      if(green.aiEncounter)this.aiEncounterFinish(green,'hit');
    }
    spawn(type,x,y,initial=false,parent=null,mate=null){
      const t=SPECIES[type], variation=()=>1+this.rand(-this.settings.variance,this.settings.variance);
      const temperament= type==='g'?(this.rnd()<.25?'timid':this.rnd()<.333?'brave':'normal'):(this.rnd()<.5?'bold':'careful');
      const age=initial?(type==='g'?this.rand(0,4):this.rand(3,9)):0;
      const e={id:++this.nextId,type,x:clamp(x,9,W-9),y:clamp(y,9,H-9),angle:this.rand(-Math.PI,Math.PI),maxhp:t.hp*variation(),attack:t.attack*variation(),speed:t.speed*variation(),life:t.life*variation(),view:t.view*variation(),energy:initial?this.rand(75,98):this.rand(80,95),age,lastBirth:this.day-(initial?this.rand(0,t.reproduction):0),lastAttack:-2,lastCounter:-2,turnAt:0,children:0,kills:0,counters:0,temperament,targetId:null,phase:this.rand(0,6),alive:true,flash:0};
      e.hp=e.maxhp;
      if(type==='g'&&this.settings.mode==='social'&&this.settings.socialEvolution!=='baseline'){
        e.ecoDays=0;e.ecoFood=0;e.ecoEscapes=0;e.ecoHits=0;
      }
      if(type==='g'&&this.settings.mode!=='normal'){
        e.genome=parent?this.mutateBrain(parent,mate):initialBrain(this.settings.seed,e.id);
        e.generation=parent?parent.generation+1:0;
        e.parentId=parent?parent.id:null;
        if(!parent)this.stats.ai.founders++;
        this.stats.ai.highestGeneration=Math.max(this.stats.ai.highestGeneration,e.generation);
        this.aiGeneration(e.generation).born++;
      }
      this.entities.push(e);return e;
    }
    counts(){const out={g:0,r:0,b:0};for(const a of this.entities)if(a.alive)out[a.type]++;return out}
    grassTotal(){return this.grass.reduce((sum,v)=>sum+v,0)/this.grass.length}
    gridIndex(x,y){return clamp(Math.floor(y/CELL),0,GRID_Y-1)*GRID_X+clamp(Math.floor(x/CELL),0,GRID_X-1)}
    snapshot(d){const n=this.counts();
      const ai=this.stats.ai,aliveGreen=this.entities.filter(e=>e.alive&&e.type==='g');
      const meanGeneration=this.settings.mode!=='normal'&&aliveGreen.length?
        aliveGreen.reduce((sum,e)=>sum+e.generation,0)/aliveGreen.length:0;
      const reference=[-.45,.15,1,0,.65,.65,.9,0,0,.8];
      const meanDangerSignal=this.settings.mode!=='normal'&&aliveGreen.length?
        aliveGreen.reduce((sum,e)=>sum+neuralForward(e.genome,reference)[2],0)/aliveGreen.length:0;
      const herd=this.settings.mode==='social'?this.herdSnapshot():null;
      this.history.push({day:d,...n,...(herd?{
        ai2GroupedPct:Number(herd.groupedPct.toFixed(2)),
        ai2MeanNeighbors:Number(herd.meanNeighbors.toFixed(2)),
        ai2MaxLocalGroup:herd.maxLocalGroup,
        ai2MeanNearest:Number(herd.meanNearest.toFixed(1))
      }:{}),aiMeanGeneration:Number(meanGeneration.toFixed(3)),aiEscapeBias:Number(meanDangerSignal.toFixed(3)),aiOffspring:ai.offspring,aiMutated:ai.mutatedOffspring,aiFleeDays:Number(ai.fleeDays.toFixed(2)),
        aiFleeStarts:ai.fleeStarts,
        aiMeanFleeStartDistance:ai.fleeStarts?Number((ai.startDistanceSum/ai.fleeStarts).toFixed(2)):null,
        aiMeanTurnDeg:ai.turnSamples?Number((ai.turnDegSum/ai.turnSamples).toFixed(2)):null,
        aiMeanAwayDeg:ai.turnSamples?Number((ai.awayDegSum/ai.turnSamples).toFixed(2)):null,
        aiChaseStarts:ai.chaseStarts,aiChaseEscaped:ai.chaseEscaped,aiChaseCaught:ai.chaseCaught,
        aiChaseOther:ai.chaseOther,
        aiEncounterStarts:ai.encounterStarts,
        aiEncounterSurvived:ai.encounterSurvived,
        aiEncounterHit:ai.encounterHit,
        aiEncounterDiedOther:ai.encounterDiedOther,
        aiEncounterPending:ai.encounterStarts-ai.encounterSurvived-ai.encounterHit-ai.encounterDiedOther,
        aiAttackFree1dPct:(ai.encounterSurvived+ai.encounterHit+ai.encounterDiedOther)?
          Number((100*ai.encounterSurvived/(ai.encounterSurvived+ai.encounterHit+ai.encounterDiedOther)).toFixed(2)):null,
        aiChaseDistanceBreakPct:(ai.chaseEscaped+ai.chaseCaught)?Number((100*ai.chaseEscaped/(ai.chaseEscaped+ai.chaseCaught)).toFixed(2)):null,
        grass:this.grassTotal(),birthg:this.stats.births.g,birthr:this.stats.births.r,birthb:this.stats.births.b,killsr:this.stats.kills.r,killsb:this.stats.kills.b,huntsr:this.stats.hunts.r,huntsb:this.stats.hunts.b,starveg:this.stats.deaths.g.starve,starver:this.stats.deaths.r.starve,starveb:this.stats.deaths.b.starve,ager:this.stats.deaths.r.age,ageb:this.stats.deaths.b.age,counters:this.stats.counters,
        daysr:this.stats.individualDays.r,daysb:this.stats.individualDays.b,edger:this.stats.edgeDays.r,edgeb:this.stats.edgeDays.b,starvegrassg:this.stats.starveWithGlobalGrass.g})}
    particle(x,y,color,n=6){for(let i=0;i<n;i++)this.effects.push({x,y,vx:this.rand(-45,45),vy:this.rand(-45,45),life:this.rand(.25,.65),color})}
    die(a,reason,killer=null){
      if(!a.alive)return;
      if(this.settings.mode!=='normal'&&a.type==='g'&&a.aiEncounter)
        this.aiEncounterFinish(a,'diedOther');
      a.alive=false;this.stats.deaths[a.type][reason]++;
      if(this.settings.mode!=='normal'&&a.type==='r')this.aiChaseFinish(a,'other','red_died');
      if(reason==='starve'){
        // Global grass alone cannot indicate whether an individual could reach food.
        if(this.grassTotal()>.5)this.stats.starveWithGlobalGrass[a.type]++;
        const ix=clamp(Math.floor(a.x/CELL),0,GRID_X-1),iy=clamp(Math.floor(a.y/CELL),0,GRID_Y-1);
        let nearby=0;
        for(let y=Math.max(0,iy-1);y<=Math.min(GRID_Y-1,iy+1);y++)for(let x=Math.max(0,ix-1);x<=Math.min(GRID_X-1,ix+1);x++)nearby=Math.max(nearby,this.grass[y*GRID_X+x]);
        if(nearby>.25)this.stats.starveWithLocalGrass[a.type]++;
      }
      if(killer && killer.alive){killer.kills++;killer.energy=clamp(killer.energy+SPECIES[killer.type].foodGain,0,100);this.stats.kills[killer.type]++;this.particle(a.x,a.y,'#ffd18b',8);
        if(this.stats.kills[killer.type]===1)this.record('hunt',(killer.type==='r'?'赤':'青')+'が初めて捕食に成功');
      }else{this.particle(a.x,a.y,reason==='starve'?'#f5b67a':'#f2adbf',4)}
      if(a.type!=='g' && reason==='starve' && this.stats.deaths[a.type].starve===1)this.record('starve',(a.type==='r'?'赤':'青')+'の個体が餓死');
    }
    move(a,dx,dy,dt,velocity,stop=0,mode='direct'){
      const d=Math.hypot(dx,dy);if(d<1e-8)return;
      let ux=dx/d,uy=dy/d;
      // A fleeing or wandering creature should run *along* a wall rather than
      // repeatedly attempt to move through it. Direct hunting remains unaffected
      // so predators can reach prey close to a wall.
      if(mode!=='direct'){
        const margin=43, handed=a.id%2===0?1:-1;
        if(a.x<margin&&ux<0){const old=-ux;ux=old*.55;uy+=handed*old*.7}
        if(a.x>W-margin&&ux>0){const old=ux;ux=-old*.55;uy+=handed*old*.7}
        if(a.y<margin&&uy<0){const old=-uy;uy=old*.55;ux+=handed*old*.7}
        if(a.y>H-margin&&uy>0){const old=uy;uy=-old*.55;ux+=handed*old*.7}
        const len=Math.hypot(ux,uy);ux/=len;uy/=len;
      }
      const distance=Math.min(velocity*dt,Math.max(0,d-stop));
      const nx=clamp(a.x+ux*distance,9,W-9),ny=clamp(a.y+uy*distance,9,H-9);
      a.angle=Math.atan2(ny-a.y,nx-a.x);
      a.x=nx;a.y=ny;
    }
    // Spatial search: scan nearby grid buckets rather than every pair of entities.
    buildIndex(){
      const cellSize=60,nx=Math.ceil(W/cellSize),ny=Math.ceil(H/cellSize);
      const buckets=Array.from({length:nx*ny},()=>[]);
      for(const a of this.entities)if(a.alive){const col=clamp(Math.floor(a.x/cellSize),0,nx-1),row=clamp(Math.floor(a.y/cellSize),0,ny-1);buckets[row*nx+col].push(a)}
      return {cellSize,nx,ny,buckets};
    }
    nearest(a,index,range,type){
      const {cellSize,nx,ny,buckets}=index;
      const minX=clamp(Math.floor((a.x-range)/cellSize),0,nx-1),maxX=clamp(Math.floor((a.x+range)/cellSize),0,nx-1);
      const minY=clamp(Math.floor((a.y-range)/cellSize),0,ny-1),maxY=clamp(Math.floor((a.y+range)/cellSize),0,ny-1);
      let best=null,bestD=range*range;
      for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++)for(const other of buckets[y*nx+x]){
        if(other===a || !other.alive || other.type!==type)continue;
        const dx=a.x-other.x,dy=a.y-other.y,d=dx*dx+dy*dy;if(d<bestD){best=other;bestD=d}
      }
      return best;
    }
    // Nearest-neighbour observations come from the SAME spatial buckets used by all species.
    // No communication ability is granted other than what actual nearby green headings reveal.
    socialContext(a,index,range=115){
      const {cellSize,nx,ny,buckets}=index;
      const minX=clamp(Math.floor((a.x-range)/cellSize),0,nx-1),maxX=clamp(Math.floor((a.x+range)/cellSize),0,nx-1);
      const minY=clamp(Math.floor((a.y-range)/cellSize),0,ny-1),maxY=clamp(Math.floor((a.y+range)/cellSize),0,ny-1);
      let count=0,nearCount=0,cx=0,cy=0,ax=0,ay=0,sx=0,sy=0,nearest=range;
      for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++)for(const b of buckets[y*nx+x]){
        if(b===a||!b.alive||b.type!=='g')continue;
        const dx=b.x-a.x,dy=b.y-a.y,dist=Math.hypot(dx,dy);
        if(dist>=range||dist<1e-5)continue;
        count++;if(dist<65)nearCount++;cx+=b.x;cy+=b.y;ax+=Math.cos(b.angle);ay+=Math.sin(b.angle);
        nearest=Math.min(nearest,dist);
        if(dist<38){sx-=dx/Math.max(dist,1);sy-=dy/Math.max(dist,1)}
      }
      const dir=Math.hypot(ax,ay),repel=Math.hypot(sx,sy);
      return {count,nearCount,cx:count?cx/count:a.x,cy:count?cy/count:a.y,
        ax:dir?ax/dir:0,ay:dir?ay/dir:0,
        sx:repel?sx/repel:0,sy:repel?sy/repel:0,nearest};
    }
    // Observable group: >=2 neighbours within 65 px. This is not a fitness reward.
    herdSnapshot(){
      const greens=this.entities.filter(e=>e.alive&&e.type==='g');
      if(!greens.length)return {groupedPct:0,meanNeighbors:0,maxLocalGroup:0,meanNearest:0};
      const index=this.buildIndex();let group=0,sum=0,max=1,near=0;
      for(const e of greens){
        const local=this.socialContext(e,index,65);
        sum+=local.count;max=Math.max(max,local.count+1);
        near+=local.nearest;
        if(local.count>=2)group++;
      }
      return {groupedPct:100*group/greens.length,meanNeighbors:sum/greens.length,
        maxLocalGroup:max,meanNearest:near/greens.length};
    }
    update(dt=.05){
      if(this.day>=this.settings.duration)return;      dt=Math.min(dt,this.settings.duration-this.day);
      if(dt<=0)return;
      const oldDay=Math.floor(this.day);this.day+=dt;
      if(this.settings.duration-this.day<1e-8)this.day=this.settings.duration;
      for(let i=0;i<this.grass.length;i++)this.grass[i]=Math.min(1,this.grass[i]+dt*.18*this.settings.regrowth*(.8+.4*((i*17)%13)/12));
      const index=this.buildIndex(), newborn=[];
      const foodAvailability=this.grassTotal();
      // Shuffle per step to avoid permanent species update-order bias.
      const agents=this.entities.filter(e=>e.alive);
      for(let i=agents.length-1;i>0;i--){const j=Math.floor(this.rnd()*(i+1));[agents[i],agents[j]]=[agents[j],agents[i]]}
      for(const e of agents){
        if(!e.alive)continue;
        const t=SPECIES[e.type];
        this.stats.individualDays[e.type]+=dt;
        if(e.type==='g'&&this.settings.mode==='social'&&this.settings.socialEvolution!=='baseline')e.ecoDays+=dt;
        e.age+=dt;e.energy-=dt*t.drain*(e.age<t.mature?.46:1);
        if(e.age>=e.life){this.die(e,'age');continue}
        // Hunger is checked *after* a foraging/hunting opportunity this tick.
        // Otherwise an animal may die just before eating food already underfoot.
        if(e.type==='g'){
          // When severely hungry, a herbivore takes a controlled risk to
          // graze unless the predator is already close. This prevents endless
          // long-range fleeing while accessible plants remain nearby.
          const escapeAI=this.settings.mode!=='normal',socialAI=this.settings.mode==='social';
          const social=socialAI&&this.settings.socialEnabled?this.socialContext(e,index):null;
          if(socialAI)e.socialNeighbors=social?.nearCount||0;
          const socialGenes=social?neuralForward(e.genome,[
            clamp((social.cx-e.x)/115,-1,1),clamp((social.cy-e.y)/115,-1,1),
            social.ax,social.ay,clamp(social.count/12,0,1),
            clamp(social.nearest/115,0,1),e.energy/100,
            this.grass[this.gridIndex(e.x,e.y)],
            clamp((e.x-W/2)/(W/2),-1,1),clamp((e.y-H/2)/(H/2),-1,1)
          ]):null;
          const dangerRange=(escapeAI?180:(e.energy<28?48:85))*e.view;
          const danger=this.nearest(e,index,dangerRange,'r');
          if(escapeAI)this.aiEncounterObserve(e,danger);
          const dangerB=this.nearest(e,index,dangerRange,'b');
          const threat=!danger?dangerB:!dangerB?danger:Math.hypot(e.x-danger.x,e.y-danger.y)<Math.hypot(e.x-dangerB.x,e.y-dangerB.y)?danger:dangerB;
          let fleeing=false;
          if(threat&&escapeAI){
            const distance=Math.max(.01,Math.hypot(e.x-threat.x,e.y-threat.y));
            const proximity=clamp(1-distance/(180*e.view),0,1);
            const inputs=[
              clamp((threat.x-e.x)/180,-1,1),clamp((threat.y-e.y)/180,-1,1),
              Math.cos(threat.angle),Math.sin(threat.angle),proximity,e.energy/100,
              clamp(e.hp/e.maxhp,0,1),clamp((e.x-W/2)/(W/2),-1,1),
              clamp((e.y-H/2)/(H/2),-1,1),this.grass[this.gridIndex(e.x,e.y)]
            ];
            // AI② allocates the same 115 inherited weights to social decisions.
            // Threat reflex stays fixed; AI① alone uses genome for escape tactics.
            const [turn,offset,urge]=socialAI?[0,0,0]:neuralForward(e.genome,inputs);
            const hunger=(100-e.energy)/100;
            // The standard escape reflex provides a survivable founding policy.
            // The network evolves when to flee and which route/lateral dodge to take.
            const alarm=proximity+urge*.33;
            const policy=this.settings.escapePolicy;
            const threshold=policy==='wide'?.25+hunger*.19:
              policy==='early'?.30+hunger*.22:
              policy==='guard'?.31+hunger*.22:.39+hunger*.25;
            this.stats.ai.threatDays+=dt;
            if(alarm>threshold){
              const dx=e.x-threat.x,dy=e.y-threat.y;
              const angleScale=policy==='guard'?.65:policy==='wide'?.65:1.05;
              const lateralScale=policy==='guard'?.30:policy==='wide'?.30:.55;
              const rotation=turn*angleScale,cos=Math.cos(rotation),sin=Math.sin(rotation);
              let vx=dx*cos-dy*sin-dy*offset*lateralScale;
              let vy=dx*sin+dy*cos+dx*offset*lateralScale;
              if(socialGenes&&social.count){
                // Group direction can help or obstruct escape. No extra speed or safety bonus.
                const alignment=Math.max(0,.12+socialGenes[1]*1.8);
                const len=Math.max(1,Math.hypot(vx,vy));
                vx+=len*alignment*.30*social.ax;
                vy+=len*alignment*.30*social.ay;
              }
              const wasFleeing=!!e.aiFleeActive,priorHeading=e.angle,priorX=e.x,priorY=e.y;
              this.move(e,vx,vy,dt,149*e.speed*(e.temperament==='timid'?1.13:1),0,'flee');
              if(!wasFleeing&&threat.type==='r')this.aiFleeStarted(e,threat,distance,priorHeading,priorX,priorY);
              e.aiFleeActive=true;
              this.stats.ai.fleeDays+=dt;
              fleeing=true;
            }else this.stats.ai.riskDays+=dt;
          }else if(threat){
            const dx=e.x-threat.x,dy=e.y-threat.y;
            this.move(e,dx-.12*dy,dy+.12*dx,dt,149*e.speed*(e.temperament==='timid'?1.13:1),0,'flee');
            fleeing=true;
          }
          if(!fleeing){
            if(escapeAI)e.aiFleeActive=false;
            const gi=this.gridIndex(e.x,e.y);let food=this.grass[gi],tx=null,ty=null;
            const cx=clamp(Math.floor(e.x/CELL),0,GRID_X-1),cy=clamp(Math.floor(e.y/CELL),0,GRID_Y-1);
            for(const [vx,vy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=clamp(cx+vx,0,GRID_X-1),ny=clamp(cy+vy,0,GRID_Y-1),n=this.grass[ny*GRID_X+nx];if(n>food+.18){food=n;tx=(nx+.5)*CELL;ty=(ny+.5)*CELL}}
            if(this.day>=e.turnAt){e.turnAt=this.day+this.rand(.22,.65);e.angle+=this.rand(-1.7,1.7)}
            let dx=tx!==null?tx-e.x:Math.cos(e.angle),dy=ty!==null?ty-e.y:Math.sin(e.angle);
            if(socialGenes&&social.count){
              const length=Math.max(1e-5,Math.hypot(dx,dy));dx/=length;dy/=length;
              // Heritable choices for cohesion, heading alignment, crowd separation.
              // All can become zero: a herd is never forced or given a survival bonus.
              const expressive=this.settings.socialEvolution==='ecoMateWide'?1.4:1;
              const hungerGate=this.settings.socialEvolution==='ecoMateHunger'?clamp((e.energy-28)/53,.12,1):1;
              const gather=Math.max(0,.16+socialGenes[0]*2.5)*expressive*hungerGate;
              const align=Math.max(0,.12+socialGenes[1]*2.0)*expressive*hungerGate;
              const spread=Math.max(0,.34+socialGenes[2]*2.2)*expressive;
              const cx=social.cx-e.x,cy=social.cy-e.y,d=Math.max(1,Math.hypot(cx,cy));
              dx+=gather*cx/d+align*social.ax+spread*social.sx;
              dy+=gather*cy/d+align*social.ay+spread*social.sy;
            }
            this.move(e,dx,dy,dt,55*e.speed,0,'wander');
          }
          const gidx=this.gridIndex(e.x,e.y),amount=Math.min(this.grass[gidx],dt*.48);
          if(amount>0){
            this.grass[gidx]-=amount;
            const gained=Math.min(100-e.energy,amount*92);
            if(this.settings.mode==='social'&&this.settings.socialEvolution!=='baseline')e.ecoFood+=gained;
            e.energy=Math.min(100,e.energy+amount*92);
          }
        }else{
          const needsFood=e.energy<(e.type==='r'?55:64);
          let target=null;
          if(needsFood){
            if(e.targetId)target=this.entities.find(a=>a.id===e.targetId&&a.alive&&a.type==='g');
            if(target&&Math.hypot(e.x-target.x,e.y-target.y)>200*e.view){
              if(this.settings.mode!=='normal'&&e.type==='r')this.aiChaseFinish(e,'escaped','distance_exceeded');
              target=null;
            }
            if(!target&&e.aiChase)this.aiChaseFinish(e,'other','target_missing');
            if(!target){target=this.nearest(e,index,185*e.view,'g');if(target){e.targetId=target.id;e.hunts=(e.hunts||0)+1;this.stats.hunts[e.type]++;if(e.type==='r')this.aiChaseStart(e,target)}}
          }
          if(target){
            this.move(e,target.x-e.x,target.y-e.y,dt,(e.type==='r'?165:145)*e.speed,15);
            const dist=Math.hypot(target.x-e.x,target.y-e.y);
            if(dist<20 && this.day-e.lastAttack>=t.attackCooldown){
              if(e.type==='r')this.aiEncounterHit(target,e);
              e.lastAttack=this.day;target.hp-=e.attack;target.flash=.28;this.stats.strikes[e.type]++;this.particle(target.x,target.y,e.type==='r'?'#ffc38c':'#b1d7ff',3);
              if(target.alive && target.hp>0 && this.day-target.lastCounter>.42){
                const counterChance=target.temperament==='brave'?.3:target.temperament==='timid'?.15:.2;
                if(this.rnd()<counterChance){target.lastCounter=this.day;e.hp-=target.attack;target.counters++;this.stats.counters++;e.flash=.28;
                  const dx=e.x-target.x,dy=e.y-target.y,dd=Math.max(1,Math.hypot(dx,dy));e.x=clamp(e.x+dx/dd*15,9,W-9);e.y=clamp(e.y+dy/dd*15,9,H-9);
                  this.particle(e.x,e.y,'#b2ffcf',6);
                  if(e.hp<=0)this.die(e,'defense');
                  if(this.stats.counters===1)this.record('counter','草食生物が初めて反撃');
                }
              }
              if(target.hp<=0 && target.alive){if(e.type==='r')this.aiChaseFinish(e,'caught','caught_target');this.die(target,'hunt',e);e.targetId=null}
            }
          }else{
            if(e.aiChase)this.aiChaseFinish(e,'other','stopped_hunting');
            e.targetId=null;if(this.day>=e.turnAt){e.turnAt=this.day+this.rand(.16,.55);e.angle+=this.rand(-1.8,1.8)}
            this.move(e,Math.cos(e.angle),Math.sin(e.angle),dt,75*e.speed,0,'wander');
          }
        }
        if(!e.alive)continue;
        if(e.x<28||e.x>W-28||e.y<28||e.y>H-28)this.stats.edgeDays[e.type]+=dt;
        if(e.energy<=0){this.die(e,'starve');continue}
        if(e.energy>62 && e.hp<e.maxhp)e.hp=Math.min(e.maxhp,e.hp+dt*t.hp*.045);
        const canBirth=e.age>=t.mature&&this.day-e.lastBirth>=t.reproduction&&e.energy>=t.birthEnergy;
        const fertility=e.type==='g'?clamp((foodAvailability-.05)/.38,.05,1):1;
        if(canBirth && this.rnd()<dt*t.birthRate*fertility && this.entities.length+newborn.length<MAX_POP){
          e.energy-=t.birthCost;e.lastBirth=this.day;e.children++;
          const mate=e.type==='g'&&this.settings.mode==='social'&&this.settings.socialEvolution!=='baseline'?this.chooseEcologicalMate(e,index):null;
          newborn.push({type:e.type,x:e.x+this.rand(-10,10),y:e.y+this.rand(-10,10),
            parent:this.settings.mode!=='normal'&&e.type==='g'?e:null,mate});this.stats.births[e.type]++;
          if(e.type!=='g'&&this.stats.births[e.type]===1)this.record('birth', (e.type==='r'?'赤':'青')+'の捕食者が初めて繁殖');
        }
        e.phase+=dt*10;e.flash=Math.max(0,e.flash-dt);
      }
      for(const item of newborn)this.spawn(item.type,item.x,item.y,false,item.parent,item.mate);
      this.entities=this.entities.filter(e=>e.alive);
      for(const p of this.effects){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt}
      this.effects=this.effects.filter(p=>p.life>0);
      const today=Math.floor(this.day);
      if(today>oldDay){for(let d=oldDay+1;d<=today;d++){this.snapshot(d);if(d%20===0){const n=this.counts();this.record('milestone',`緑${n.g}匹、赤${n.r}匹、青${n.b}匹が生存`)}}}
      if(Number.isFinite(this.settings.duration)&&this.day>=this.settings.duration)this.record('end',`${this.settings.duration}日間の実験終了`);
    }
    run(days=Number.isFinite(this.settings.duration)?this.settings.duration:this.day+100,step=.08){if(!Number.isFinite(days))throw new RangeError('Run target day must be finite');let loops=0;const to=clamp(days,0,this.settings.duration);while(this.day<to){this.update(Math.min(step,to-this.day));if(++loops>100000)throw new Error('Unexpected simulation loop')}return this}
    summary(){return {seed:this.settings.seed,day:Number(this.day.toFixed(3)),counts:this.counts(),stats:this.stats,grass:Number(this.grassTotal().toFixed(3)),history:this.history}}
  }
  return {Lab,SPECIES,W,H,GRID_X,GRID_Y,CELL,BRAIN_SIZE,ESCAPE_MUTATION,neuralForward};
});
