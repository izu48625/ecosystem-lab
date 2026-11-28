/* ECOSYSTEM LAB - video-ready, read-only 16:9 visual analytics.
 * All curves are computed from live local deterministic history, never from published aggregate numbers.
 */
(function(root){
'use strict';
const CHARTS={
 population:{title:'緑と赤｜生存個体数の推移',tag:'ECOLOGY / POPULATION',note:'現在の世界・同じシードで継続観察。緑が0なら局所的な絶滅。',keys:[['g','緑・草食','#7de2a5'],['r','赤・捕食者','#ff8b77']],unit:'匹'},
 daily:{title:'出生と死亡｜1日ごとの変化',tag:'ECOLOGY / DAILY EVENTS',note:'各日までの累計値の差分。出生・捕食死・餓死を同じグラフで表示。',keys:[['birthg','緑の出生','#7de2a5'],['huntg','緑の捕食死','#ff8b77'],['starveg','緑の餓死','#efbd79']],daily:true,unit:'件/日'},
 cumulative:{title:'緑の出生・捕食死・餓死｜累積',tag:'ECOLOGY / DEMOGRAPHY',note:'緑の個体数＝初期頭数＋出生−捕食死−餓死−その他の死亡。',keys:[['birthg','緑の出生','#7de2a5'],['huntg','緑の捕食死','#ff8b77'],['starveg','緑の餓死','#efbd79']],unit:'件'},
 grass:{title:'草の残量｜資源の変化',tag:'ECOLOGY / RESOURCES',note:'草の平均残量。高い生存頭数が資源の枯渇を招く場合がある。',keys:[['grass','草の残量','#8ccf9d']],scale:100,unit:'%'},
 predation:{title:'赤の捕食活動｜1日ごとの記録',tag:'ECOLOGY / PREDATION',note:'赤の追跡開始・捕食成功・赤の出生を日単位で比較。追跡開始は捕食成功率とは異なる。',keys:[['huntsr','追跡開始','#ff8b77'],['killsr','捕食成功','#e7b97b'],['birthr','赤の出生','#9daccf']],daily:true,unit:'回/日'},
 genes:{title:'AI②｜遺伝的な3つの行動傾向',tag:'EVOLUTION / NEURAL GENOTYPES',note:'生存中の緑のNNを毎日、固定した4入力で採点した平均。能力向上の証明ではなく、遺伝的傾向の変化。絶滅後は欠測。',keys:[['ai2GeneGather','仲間に集まる','#74e5aa'],['ai2GeneAlign','進行方向を合わせる','#85b7fb'],['ai2GeneSeparate','密集を避ける','#f7bd79']],socialOnly:true,unit:'NNゲイン'},
 herd:{title:'AI②｜実際につながる群れ',tag:'EVOLUTION / FLOCK STRUCTURE',note:'局所群れ＝半径65pxに仲間2匹以上。最大連結群＝65px以内の接続が続く最大集団の全緑に占める割合。個体密度の影響あり。',keys:[['ai2GroupedPct','局所群れ参加率','#74e5aa'],['ai2LargestConnectedPct','最大連結群の割合','#85b7fb']],socialOnly:true,unit:'%'},
 alignment:{title:'AI②｜群れの進行方向の一致',tag:'EVOLUTION / HEADING',note:'半径65pxの緑同士の平均 cos(向きの差)。+1で同方向、0で無相関、−1で逆方向。孤立時は欠測。',keys:[['ai2HeadingAlignment','近隣同士の方向一致','#85b7fb']],socialOnly:true,unit:'cos類似度',min:-1,max:1},
 generation:{title:'世代交代｜生存中の緑の平均世代',tag:'EVOLUTION / GENERATIONS',note:'初代が0世代。生存個体の平均世代であり、変異が有利だったことは意味しない。',keys:[['aiMeanGeneration','平均世代','#f4c17e']],aiOnly:true,unit:'世代'},
 compare:{title:'ノーマル・AI①・AI②｜同一条件で比較',tag:'EXPERIMENT / THREE WORLDS',note:'「3モード比較を作成」で同じシードと同じ初期頭数・草・個体差を独立に100日実行した結果のみ表示。実測試行1組で、平均値ではない。',keys:[['normal','ノーマル','#d0d7d4'],['ai1','AI① 逃走','#85b7fb'],['ai2','AI② 群れ','#74e5aa']],unit:'緑・匹'}
};
const $=id=>document.getElementById(id);
const fmt=(v,d=1)=>v===null||v===undefined||!Number.isFinite(v)?'—':Number(v).toLocaleString('ja-JP',{maximumFractionDigits:d});
const limit=(a,b,c)=>Math.min(c,Math.max(b,a));
function modeLabel(mode){return mode==='social'?'AI② 群れ行動':mode==='escape'?'AI① 逃走特化':'ノーマル'}
function signature(options){return JSON.stringify([options.seed,options.green,options.red,options.blue||0,options.variance,options.regrowth])}
function seriesFor(lab,graph,comparison){
 const config=CHARTS[graph]||CHARTS.population;
 if(graph==='compare'){
  if(!comparison)return {config,series:[],maxDay:100,error:'まだ比較データがありません。「同条件3モード比較」を実行すると作成できます。'};
  return {config,maxDay:100,series:config.keys.map(([key,name,color])=>({
   key,name,color,points:comparison[key].history.map(h=>({day:h.day,value:h.g}))
  }))};
 }
 if(config.socialOnly&&lab.settings.mode!=='social')return {config,series:[],maxDay:100,error:'このグラフはAI②の世界だけで測定します。上のAI②タブに切り替えてください。'};
 if(config.aiOnly&&lab.settings.mode==='normal')return {config,series:[],maxDay:100,error:'世代交代のグラフはAI①・AI②で表示できます。'};
 const history=lab.history;
 return {config,maxDay:Math.max(100,Math.ceil(lab.day)),series:config.keys.map(([key,name,color])=>({
  key,name,color,points:history.map((d,i)=>{
   const raw=Number(d[key]);
   const valid=d[key]!==undefined&&d[key]!==null&&Number.isFinite(raw);
   let value=valid?raw:null;
   if(valid&&config.daily){
    const prior=i?Number(history[i-1][key]):null;
    value=i&&Number.isFinite(prior)?Math.max(0,raw-prior):0;
   }
   if(value!==null&&config.scale)value*=config.scale;
   return {day:d.day,value};
  })
 }))};
}
function plot(ctx,rect,series,maxDay,config){
 const {x,y,w,h}=rect;
 const l=x+88,r=x+w-30,top=y+40,bot=y+h-61;
 const vals=series.flatMap(s=>s.points.map(p=>p.value).filter(v=>v!==null&&Number.isFinite(v)));
 let lo=config.min??Math.min(0,...vals),hi=config.max??Math.max(1,...vals);
 if(hi===lo)hi=lo+1;
 if(config.min===undefined&&lo<0)lo=Math.floor(lo*1.1*10)/10;
 if(config.max===undefined)hi=Math.ceil(hi*1.08*10)/10||1;
 const xCoord=day=>l+day/maxDay*(r-l);
 const yCoord=value=>bot-(value-lo)/(hi-lo)*(bot-top);
 ctx.fillStyle='#102c2c';ctx.fillRect(x,y,w,h);
 ctx.strokeStyle='#365454';ctx.lineWidth=1;
 ctx.font='23px system-ui, sans-serif';ctx.textAlign='right';
 for(let i=0;i<=4;i++){
  const value=lo+(hi-lo)*i/4,yy=yCoord(value);
  ctx.beginPath();ctx.moveTo(l,yy);ctx.lineTo(r,yy);ctx.stroke();
  ctx.fillStyle='#abc6bc';ctx.fillText(fmt(value,hi-lo>40?0:2),l-15,yy+7);
 }
 ctx.textAlign='center';ctx.font='20px system-ui, sans-serif';
 for(let i=0;i<=5;i++){
  const day=Math.round(maxDay*i/5),xx=xCoord(day);
  ctx.fillStyle='#acc4be';ctx.fillText('DAY '+day,xx,bot+37);
 }
 ctx.save();ctx.beginPath();ctx.rect(l-2,top-5,r-l+4,bot-top+10);ctx.clip();
 for(const row of series){
  ctx.strokeStyle=row.color;ctx.lineWidth=5;ctx.lineCap='round';ctx.lineJoin='round';
  let active=false;ctx.beginPath();
  for(const p of row.points){
   if(!Number.isFinite(p.value)){active=false;continue}
   const xx=xCoord(p.day),yy=yCoord(p.value);
   if(!active){ctx.moveTo(xx,yy);active=true}else ctx.lineTo(xx,yy);
  }
  ctx.stroke();
  const last=[...row.points].reverse().find(p=>Number.isFinite(p.value));
  if(last){
   ctx.fillStyle=row.color;ctx.beginPath();ctx.arc(xCoord(last.day),yCoord(last.value),5.5,0,Math.PI*2);ctx.fill();
  }
 }
 ctx.restore();
}
function paint(canvas,{lab,graph='population',comparison=null}){
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
 const {config,series,error,maxDay}=seriesFor(lab,graph,comparison);
 ctx.fillStyle='#091c1e';ctx.fillRect(0,0,w,h);
 ctx.fillStyle='#153630';ctx.fillRect(0,0,w,14);
 ctx.fillStyle='#9be3b8';ctx.font='bold 27px system-ui';ctx.textAlign='left';
 ctx.fillText('ECOSYSTEM LAB   /   VIDEO ANALYTICS',65,84);
 ctx.fillStyle='#eefbf6';ctx.font='bold 50px system-ui';
 ctx.fillText(config.title,65,158);
 ctx.font='23px system-ui';ctx.fillStyle='#a8c6c0';
 const subtitle=(graph==='compare'&&comparison?
  '同じシード '+comparison.seed+'  /  各100日 /  3つの独立世界':
  modeLabel(lab.settings.mode)+'  /  DAY '+fmt(lab.day,1)+'  /  Seed '+lab.settings.seed);
 ctx.fillText(subtitle,66,202);
 const sy=258;
 if(!error)plot(ctx,{x:66,y:sy,w:w-132,h:470},series,maxDay,config);
 else{
  ctx.fillStyle='#142b2d';ctx.fillRect(66,sy,w-132,470);
  ctx.textAlign='center';ctx.fillStyle='#c1ded2';ctx.font='28px system-ui';
  ctx.fillText(error,w/2,sy+225);ctx.textAlign='left';
 }
 ctx.font='24px system-ui';ctx.textAlign='left';
 let lx=70,ly=sy+498;
 for(const row of series){
  ctx.fillStyle=row.color;ctx.fillRect(lx,ly-19,16,16);
  ctx.fillStyle='#d6ece0';ctx.fillText(row.name,lx+26,ly);
  const last=[...row.points].reverse().find(p=>Number.isFinite(p.value));
  ctx.fillStyle=row.color;ctx.fillText(fmt(last?.value,2)+(config.unit?' '+config.unit:''),lx+26,ly+33);
  lx+=Math.max(340,Math.min(510,w/Math.max(2,series.length)-20));
 }
 ctx.fillStyle='#9fc5b8';ctx.font='21px system-ui';
 // Short clear notes break on simple phrases to stay readable on 1600px.
 const note=config.note;
 const lineLimit=65;
 if(note.length>lineLimit){
  let split=note.lastIndexOf('。',lineLimit);
  if(split<18)split=lineLimit;else split++;
  ctx.fillText(note.slice(0,split),69,h-93);
  ctx.fillText(note.slice(split),69,h-63);
 }else ctx.fillText(note,69,h-78);
 ctx.strokeStyle='#38675c';ctx.beginPath();ctx.moveTo(65,h-48);ctx.lineTo(w-65,h-48);ctx.stroke();
 ctx.font='18px system-ui';ctx.fillStyle='#8bb6a7';ctx.fillText('LOCAL SIMULATION • NOT A REAL-WORLD PREDICTION • SEED-REPRODUCIBLE',68,h-21);
 return {error:error||null,series,config};
}
function csv(lab,graph='population',comparison=null){
 const d=seriesFor(lab,graph,comparison);
 const data=Array.from(new Set(d.series.flatMap(s=>s.points.map(p=>p.day)))).sort((a,b)=>a-b);
 const cols=['day',...d.series.map(s=>s.key)];
 const esc=x=>'"'+String(x).replaceAll('"','""')+'"';
 const rows=[
  [esc('Graph'),esc(d.config.title)].join(','),
  ['day',...d.series.map(s=>esc(s.name))].join(','),
  ...data.map(day=>[day,...d.series.map(s=>s.points.find(p=>p.day===day)?.value??'')].join(','))
 ];
 return '\ufeff'+rows.join('\r\n');
}
function download(canvas,name){
 canvas.toBlob(blob=>{
  if(!blob)return;
  const url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
 },'image/png');
}
root.EcosystemVideo={CHARTS,signature,seriesFor,paint,csv,download,modeLabel};
})(window);