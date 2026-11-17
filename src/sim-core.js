/* Ecosystem Lab — deterministic, browser-and-Node compatible simulation engine.
 * All times are fictional in-game days. No actual machine learning is used.
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
        // Default stays at 100 days for batch studies; the live UI opts into unlimited days.
        duration:settings.duration===Infinity?Infinity:clamp(Number(settings.duration??100),1,5000000)
      };
      this.seed=this.settings.seed||1;this.day=0;this.nextId=0;this.entities=[];
      this.grass=Array.from({length:GRID_X*GRID_Y},()=>this.rand(.5,1));
      this.history=[];this.events=[];this.effects=[];
      this.stats={births:{g:0,r:0,b:0},deaths:{g:{hunt:0,starve:0,age:0,defense:0},r:{hunt:0,starve:0,age:0,defense:0},b:{hunt:0,starve:0,age:0,defense:0}},kills:{r:0,b:0},hunts:{r:0,b:0},strikes:{r:0,b:0},counters:0,
        // Exposure is the total time spent alive by all members of each species.
        individualDays:{g:0,r:0,b:0},edgeDays:{g:0,r:0,b:0},starveWithGlobalGrass:{g:0,r:0,b:0},starveWithLocalGrass:{g:0,r:0,b:0}};
      for(const [k,count] of [['g',this.settings.green],['r',this.settings.red],['b',this.settings.blue]]) for(let i=0;i<count;i++) this.spawn(k,this.rand(24,W-24),this.rand(24,H-24),true);
      this.record('start','緑・赤・青の生物を同時投入');this.snapshot(0);
      return this;
    }
    rnd(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296}
    rand(a,b){return a+(b-a)*this.rnd()}
    record(kind,text){this.events.unshift({day:Number(this.day.toFixed(1)),kind,text});if(this.events.length>50)this.events.pop()}
    spawn(type,x,y,initial=false){
      const t=SPECIES[type], variation=()=>1+this.rand(-this.settings.variance,this.settings.variance);
      const temperament= type==='g'?(this.rnd()<.25?'timid':this.rnd()<.333?'brave':'normal'):(this.rnd()<.5?'bold':'careful');
      const age=initial?(type==='g'?this.rand(0,4):this.rand(3,9)):0;
      const e={id:++this.nextId,type,x:clamp(x,9,W-9),y:clamp(y,9,H-9),angle:this.rand(-Math.PI,Math.PI),maxhp:t.hp*variation(),attack:t.attack*variation(),speed:t.speed*variation(),life:t.life*variation(),view:t.view*variation(),energy:initial?this.rand(75,98):this.rand(80,95),age,lastBirth:this.day-(initial?this.rand(0,t.reproduction):0),lastAttack:-2,lastCounter:-2,turnAt:0,children:0,kills:0,counters:0,temperament,targetId:null,phase:this.rand(0,6),alive:true,flash:0};
      e.hp=e.maxhp;this.entities.push(e);return e;
    }
    counts(){const out={g:0,r:0,b:0};for(const a of this.entities)if(a.alive)out[a.type]++;return out}
    grassTotal(){return this.grass.reduce((sum,v)=>sum+v,0)/this.grass.length}
    gridIndex(x,y){return clamp(Math.floor(y/CELL),0,GRID_Y-1)*GRID_X+clamp(Math.floor(x/CELL),0,GRID_X-1)}
    snapshot(d){const n=this.counts();this.history.push({day:d,...n,grass:this.grassTotal(),birthg:this.stats.births.g,birthr:this.stats.births.r,birthb:this.stats.births.b,killsr:this.stats.kills.r,killsb:this.stats.kills.b,huntsr:this.stats.hunts.r,huntsb:this.stats.hunts.b,starveg:this.stats.deaths.g.starve,starver:this.stats.deaths.r.starve,starveb:this.stats.deaths.b.starve,ager:this.stats.deaths.r.age,ageb:this.stats.deaths.b.age,counters:this.stats.counters,
        daysr:this.stats.individualDays.r,daysb:this.stats.individualDays.b,edger:this.stats.edgeDays.r,edgeb:this.stats.edgeDays.b,starvegrassg:this.stats.starveWithGlobalGrass.g})}
    particle(x,y,color,n=6){for(let i=0;i<n;i++)this.effects.push({x,y,vx:this.rand(-45,45),vy:this.rand(-45,45),life:this.rand(.25,.65),color})}
    die(a,reason,killer=null){
      if(!a.alive)return;
      a.alive=false;this.stats.deaths[a.type][reason]++;
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
        e.age+=dt;e.energy-=dt*t.drain*(e.age<t.mature?.46:1);
        if(e.age>=e.life){this.die(e,'age');continue}
        // Hunger is checked *after* a foraging/hunting opportunity this tick.
        // Otherwise an animal may die just before eating food already underfoot.
        if(e.type==='g'){
          // When severely hungry, a herbivore takes a controlled risk to
          // graze unless the predator is already close. This prevents endless
          // long-range fleeing while accessible plants remain nearby.
          const dangerRange=(e.energy<28?48:85)*e.view;
          const danger=this.nearest(e,index,dangerRange,'r');const dangerB=this.nearest(e,index,dangerRange,'b');
          const threat=!danger?dangerB:!dangerB?danger:Math.hypot(e.x-danger.x,e.y-danger.y)<Math.hypot(e.x-dangerB.x,e.y-dangerB.y)?danger:dangerB;
          if(threat){const dx=e.x-threat.x,dy=e.y-threat.y;this.move(e,dx-.12*dy,dy+.12*dx,dt,149*e.speed*(e.temperament==='timid'?1.13:1),0,'flee');}
          else{
            const gi=this.gridIndex(e.x,e.y);let food=this.grass[gi],tx=null,ty=null;
            const cx=clamp(Math.floor(e.x/CELL),0,GRID_X-1),cy=clamp(Math.floor(e.y/CELL),0,GRID_Y-1);
            for(const [vx,vy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=clamp(cx+vx,0,GRID_X-1),ny=clamp(cy+vy,0,GRID_Y-1),n=this.grass[ny*GRID_X+nx];if(n>food+.18){food=n;tx=(nx+.5)*CELL;ty=(ny+.5)*CELL}}
            if(this.day>=e.turnAt){e.turnAt=this.day+this.rand(.22,.65);e.angle+=this.rand(-1.7,1.7)}
            const dx=tx!==null?tx-e.x:Math.cos(e.angle),dy=ty!==null?ty-e.y:Math.sin(e.angle);
            this.move(e,dx,dy,dt,55*e.speed,0,'wander');
          }
          const gidx=this.gridIndex(e.x,e.y),amount=Math.min(this.grass[gidx],dt*.48);
          if(amount>0){this.grass[gidx]-=amount;e.energy=Math.min(100,e.energy+amount*92)}
        }else{
          const needsFood=e.energy<(e.type==='r'?55:64);
          let target=null;
          if(needsFood){
            if(e.targetId)target=this.entities.find(a=>a.id===e.targetId&&a.alive&&a.type==='g');
            if(target&&Math.hypot(e.x-target.x,e.y-target.y)>200*e.view)target=null;
            if(!target){target=this.nearest(e,index,185*e.view,'g');if(target){e.targetId=target.id;e.hunts=(e.hunts||0)+1;this.stats.hunts[e.type]++}}
          }
          if(target){
            this.move(e,target.x-e.x,target.y-e.y,dt,(e.type==='r'?165:145)*e.speed,15);
            const dist=Math.hypot(target.x-e.x,target.y-e.y);
            if(dist<20 && this.day-e.lastAttack>=t.attackCooldown){
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
              if(target.hp<=0 && target.alive){this.die(target,'hunt',e);e.targetId=null}
            }
          }else{
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
          newborn.push({type:e.type,x:e.x+this.rand(-10,10),y:e.y+this.rand(-10,10)});this.stats.births[e.type]++;
          if(e.type!=='g'&&this.stats.births[e.type]===1)this.record('birth', (e.type==='r'?'赤':'青')+'の捕食者が初めて繁殖');
        }
        e.phase+=dt*10;e.flash=Math.max(0,e.flash-dt);
      }
      for(const item of newborn)this.spawn(item.type,item.x,item.y);
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
  return {Lab,SPECIES,W,H,GRID_X,GRID_Y,CELL};
});
