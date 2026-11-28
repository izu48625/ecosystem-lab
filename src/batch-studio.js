/* Paired-seed local 100-day ecology / video study. */
(function(root){
'use strict';
const MODES=[['normal','ノーマル','#cbd4d1'],['escape','AI①','#82aff6'],['social','AI②','#7de2a5']];
const METRICS={
green:['緑の個体数','g','匹'],red:['赤の個体数','r','匹'],
birth:['緑の出生（累積）','birthg','件'],hunt:['緑の捕食死（累積）','huntg','件'],
starve:['緑の餓死（累積）','starveg','件'],grass:['草の残量','grass','%',100],
gather:['AI②・集合の遺伝的傾向','ai2GeneGather','NN'],
align:['AI②・方向同調の遺伝的傾向','ai2GeneAlign','NN'],
separate:['AI②・密集回避の遺伝的傾向','ai2GeneSeparate','NN'],
herd:['AI②・群れ参加率','ai2GroupedPct','%']
};
const avg=a=>a.reduce((s,v)=>s+v,0)/a.length;
function quantile(a,q){if(!a.length)return null;const v=a.slice().sort((x,y)=>x-y),p=(v.length-1)*q,i=Math.floor(p),t=p-i;return v[i]*(1-t)+v[Math.min(i+1,v.length-1)]*t}
function createStudy({baseSeed,count,settings,modes=['normal','escape','social']}){
 if(!Number.isInteger(count)||count<1||count>100)throw Error('seed count 1–100');
 return {baseSeed,count,settings:{...settings},modes:modes.slice(),rows:Object.fromEntries(modes.map(k=>[k,[]])),complete:false};
}
const KEYS=['day','g','r','birthg','huntg','starveg','grass','ai2GeneGather','ai2GeneAlign','ai2GeneSeparate','ai2GroupedPct'];
function ingest(s,mode,lab){
 if(!s.modes.includes(mode))throw Error('Invalid mode');
 if(lab.settings.seed!==s.baseSeed+s.rows[mode].length)throw Error('Non-sequential seed');
 const history=lab.history.filter(h=>h.day<=100).map(h=>Object.fromEntries(KEYS.map(k=>[k,h[k]??null])));
 if(history.length!==101||history.at(-1).day!==100)throw Error('Incomplete 100-day run');
 const n=lab.counts(),st=lab.stats;
 s.rows[mode].push({seed:lab.settings.seed,history,
 green:n.g,red:n.r,survive:Number(n.g>0),coexist:Number(n.g>0&&n.r>0),
 birth:st.births.g,hunted:st.deaths.g.hunt,starved:st.deaths.g.starve,redBirth:st.births.r});
}
function finish(s){
 for(const mode of s.modes){if(s.rows[mode].length!==s.count)throw Error('Partial study');
  s.rows[mode].forEach((row,i)=>{if(row.seed!==s.baseSeed+i)throw Error('Seed mismatch')});
 }s.complete=true;return s;
}
function summary(s){
 const result={};
 for(const mode of s.modes){const rows=s.rows[mode];if(!rows.length)continue;
  result[mode]={n:rows.length,green:avg(rows.map(r=>r.green)),red:avg(rows.map(r=>r.red)),
   greenP10:quantile(rows.map(r=>r.green),.1),greenP90:quantile(rows.map(r=>r.green),.9),
   survived:rows.reduce((x,r)=>x+r.survive,0),coexist:rows.reduce((x,r)=>x+r.coexist,0),
   births:avg(rows.map(r=>r.birth)),hunted:avg(rows.map(r=>r.hunted)),starved:avg(rows.map(r=>r.starved))};
 }
 if(s.complete&&result.escape&&result.social){
  const diff=s.rows.social.map((r,i)=>r.green-s.rows.escape[i].green);
  let random=0x77170220;const rand=()=>{random=(Math.imul(random,1664525)+1013904223)>>>0;return random/4294967296};
  const boot=[];for(let b=0;b<2000;b++){let t=0;for(let i=0;i<diff.length;i++)t+=diff[Math.floor(rand()*diff.length)];boot.push(t/diff.length)}
  result.paired={mean:avg(diff),ci95:[quantile(boot,.025),quantile(boot,.975)]};
 }
 return result;
}
function seriesFor(s,metric='green'){
 const config=METRICS[metric]||METRICS.green;
 if(!s?.complete)return {config,series:[],error:'一括集計がありません。'};
 const series=[];
 for(const [key,name,color] of MODES){if(['gather','align','separate','herd'].includes(metric)&&key!=='social')continue;
  if(!s.rows[key]?.length)continue;
  const points=Array.from({length:101},(_,day)=>{
   const vals=s.rows[key].map(r=>r.history[day][config[1]]).filter(v=>v!==null&&Number.isFinite(v));
   const multiplier=config[3]||1;
   return {day,value:vals.length?avg(vals)*multiplier:null,
    p10:vals.length?quantile(vals,.1)*multiplier:null,p90:vals.length?quantile(vals,.9)*multiplier:null,observed:vals.length};
  });
  series.push({key,name,color,points});
 }
 return {config,series,error:series.length?'': 'データなし'};
}
function paint(canvas,s,metric='green'){
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
 const {config,series,error}=seriesFor(s,metric);
 ctx.fillStyle='#091d20';ctx.fillRect(0,0,w,h);
 ctx.fillStyle='#a9e9be';ctx.font='bold 26px system-ui';ctx.textAlign='left';ctx.fillText('ECOSYSTEM LAB / MULTI-SEED STUDY',64,86);
 ctx.fillStyle='#e6fff3';ctx.font='bold 48px system-ui';ctx.fillText(config[0],64,158);
 ctx.fillStyle='#b1cfc3';ctx.font='24px system-ui';
 ctx.fillText(s?.complete?'同一条件・'+s.count+'シード ｜ Seed '+s.baseSeed+'〜'+(s.baseSeed+s.count-1):'一括計算前',64,209);
 if(error){ctx.fillText(error,80,420);return{error}}
 const values=series.flatMap(a=>a.points.flatMap(p=>[p.p10,p.p90]).filter(Number.isFinite));
 const max=Math.max(1,Math.max(...values)*1.08),min=Math.min(0,...values);
 const x0=127,x1=w-70,y0=260,y1=h-187;
 const xx=x=>x0+(x1-x0)*x/100,yy=y=>y1-(y-min)/(max-min)*(y1-y0);
 ctx.strokeStyle='#37504d';ctx.lineWidth=1;
 for(let i=0;i<=4;i++){const v=min+(max-min)*i/4,y=yy(v);ctx.beginPath();ctx.moveTo(x0,y);ctx.lineTo(x1,y);ctx.stroke();ctx.fillStyle='#bfd7cb';ctx.textAlign='right';ctx.font='22px system-ui';ctx.fillText(v.toFixed(max>10?0:2),x0-15,y+7)}
 ctx.textAlign='center';for(let d=0;d<=100;d+=20){ctx.fillStyle='#bfd7cb';ctx.fillText('DAY '+d,xx(d),y1+42)}
 ctx.save();ctx.beginPath();ctx.rect(x0,y0,x1-x0,y1-y0);ctx.clip();
 for(const line of series){
  ctx.fillStyle=line.color;ctx.globalAlpha=.15;ctx.beginPath();
  for(const p of line.points)if(p.p90!==null)ctx.lineTo(xx(p.day),yy(p.p90));
  for(let i=100;i>=0;i--){const p=line.points[i];if(p.p10!==null)ctx.lineTo(xx(p.day),yy(p.p10))}
  ctx.closePath();ctx.fill();ctx.globalAlpha=1;
  ctx.strokeStyle=line.color;ctx.lineWidth=5;ctx.beginPath();let started=false;
  for(const p of line.points){if(p.value===null){started=false;continue}if(!started){ctx.moveTo(xx(p.day),yy(p.value));started=true}else ctx.lineTo(xx(p.day),yy(p.value))}
  ctx.stroke();
 }
 ctx.restore();ctx.textAlign='left';ctx.font='24px system-ui';
 let left=74;for(const line of series){ctx.fillStyle=line.color;ctx.fillRect(left,h-144,16,16);ctx.fillText(line.name+'　'+(line.points[100].value?.toFixed(1)??'—')+' '+config[2],left+26,h-127);left+=Math.min(500,w/series.length)}
 ctx.fillStyle='#adc9be';ctx.font='22px system-ui';
 ctx.fillText('実線：シード平均　｜　帯：10〜90パーセンタイル（95%信頼区間ではありません）',64,h-71);
 ctx.font='18px system-ui';ctx.fillText('同一シードの独立した100日間。進化傾向と能力改善は別。',64,h-30);
 return {series,config};
}
function csv(s,metric='green'){
 const {config,series,error}=seriesFor(s,metric);if(error)throw Error(error);
 const lines=[['graph',config[0],'seeds',s.count,'seedFrom',s.baseSeed].map(v=>JSON.stringify(v)).join(','),
 ['day',...series.flatMap(x=>[x.name+' 平均',x.name+' p10',x.name+' p90',x.name+' 有効シード数'])].map(v=>JSON.stringify(v)).join(',')];
 for(let d=0;d<=100;d++)lines.push([d,...series.flatMap(x=>{const p=x.points[d];return [p.value??'',p.p10??'',p.p90??'',p.observed]})].join(','));
 return '\ufeff'+lines.join('\r\n');
}
function summaryCsv(s){
 if(!s?.complete)throw Error('Study incomplete');
 const lines=['mode,seed,green,red,survived,coexist,births,hunted,starved,redBirths'];
 for(const mode of s.modes)for(const r of s.rows[mode])lines.push([mode,r.seed,r.green,r.red,r.survive,r.coexist,r.birth,r.hunted,r.starved,r.redBirth].join(','));
 return '\ufeff'+lines.join('\r\n');
}
root.EcosystemBatch={METRICS,MODES,createStudy,ingest,finish,summary,seriesFor,paint,csv,summaryCsv};
})(window);