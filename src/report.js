/* Screenshot-ready summary for the local ecosystem simulation. No external services. */
(function(root){
'use strict';
const $=id=>document.getElementById(id);
const pretty=n=>Number(n||0).toLocaleString('ja-JP');
const percent=(a,b)=>b>0?(100*a/b).toFixed(1)+'%':'—';
const safe=(value)=>String(value===undefined?'—':value);
const mutation=root.EcosystemCore.ESCAPE_MUTATION;
const mutationRate=(mutation.probability*100).toFixed(0)+'%';
const mutationAmplitude=mutation.maxDelta.toFixed(2);
let activeLab=null;
const groupConfig=[
 {name:'0世代',from:0,to:0},
 {name:'1–2世代',from:1,to:2},
 {name:'3–5世代',from:3,to:5},
 {name:'6世代以降',from:6,to:Infinity}
];
const blankGroup=()=>({
 born:0,fleeStarts:0,startDistanceSum:0,turnSamples:0,
 turnDegSum:0,awayDegSum:0,chaseStarts:0,chaseEscaped:0,chaseCaught:0,chaseOther:0
});
function generationTable(ai){
 return groupConfig.map(group=>{
   const out=blankGroup();
   for(const [generation,counts] of Object.entries(ai.byGeneration||{})){
     const g=Number(generation);
     if(g<group.from||g>group.to)continue;
     for(const key of Object.keys(out))out[key]+=Number(counts[key]||0);
   }
   const resolved=out.chaseEscaped+out.chaseCaught;
   return {
     name:group.name,...out,
     distance:out.fleeStarts?(out.startDistanceSum/out.fleeStarts).toFixed(1):'—',
     turn:out.turnSamples?(out.turnDegSum/out.turnSamples).toFixed(1):'—',
     away:out.turnSamples?(out.awayDegSum/out.turnSamples).toFixed(1):'—',
     breakRate:percent(out.chaseEscaped,resolved),
     resolved,open:out.chaseStarts-out.chaseEscaped-out.chaseCaught-out.chaseOther
   };
 });
}
function tacticalData(ai){
 const resolved=ai.chaseEscaped+ai.chaseCaught;
 return {
   starts:ai.fleeStarts||0,
   distance:ai.fleeStarts?(ai.startDistanceSum/ai.fleeStarts).toFixed(1):'—',
   turn:ai.turnSamples?(ai.turnDegSum/ai.turnSamples).toFixed(1):'—',
   away:ai.turnSamples?(ai.awayDegSum/ai.turnSamples).toFixed(1):'—',
   breakRate:percent(ai.chaseEscaped,resolved),
   chases:ai.chaseStarts||0,escaped:ai.chaseEscaped||0,caught:ai.chaseCaught||0,
   other:ai.chaseOther||0,unresolved:(ai.chaseStarts||0)-resolved-(ai.chaseOther||0),
   rows:generationTable(ai),eventsDropped:ai.eventsDropped||0
 };
}
function dataFor(lab){
  const n=lab.counts(),st=lab.stats,ai=st.ai||{},mode=lab.settings.mode;
  const isAI=mode==='escape',greenAlive=lab.entities.filter(e=>e.alive&&e.type==='g');
  const peakGeneration=Math.max(0,...lab.history.map(h=>h.aiMeanGeneration||0));
  return {
    isAI,day:lab.day,seed:lab.settings.seed,initialGreen:lab.settings.green,
    initialRed:lab.settings.red,green:n.g,red:n.r,
    birthGreen:st.births.g,birthRed:st.births.r,
    huntGreen:st.deaths.g.hunt,starveGreen:st.deaths.g.starve,
    starveRed:st.deaths.r.starve,redHunts:st.hunts.r,
    redKills:st.kills.r,redRate:percent(st.kills.r,st.hunts.r),
    generation:greenAlive.length?greenAlive.reduce((sum,e)=>sum+e.generation,0)/greenAlive.length:null,
    peakGeneration,
    maxGeneration:isAI?ai.highestGeneration:null,
    mutations:isAI?ai.mutatedOffspring:null,
    offspring:isAI?ai.offspring:null,
    fleeRate:isAI?percent(ai.fleeDays,ai.threatDays):'—',
    tactics:isAI?tacticalData(ai):null,
    history:lab.history
  };
}
function set(id,value){$(id).textContent=safe(value)}
function paintGraph(canvas,data){
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
 const left=45,right=9,top=12,bottom=27;
 const dataPoints=data.history;
 const days=Math.max(100,Math.ceil(data.day));
 const max=Math.max(10,...dataPoints.map(p=>Math.max(p.g,p.r)));
 const yMax=Math.ceil(max/50)*50;
 const xx=d=>left+d/days*(w-left-right),yy=y=>top+(1-y/yMax)*(h-top-bottom);
 ctx.fillStyle='#122c29';ctx.fillRect(0,0,w,h);
 ctx.lineWidth=1;ctx.font='15px system-ui';
 for(let i=0;i<=2;i++){
   const value=Math.round(yMax*i/2),y=yy(value);
   ctx.strokeStyle='#32564e';ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);ctx.stroke();
   ctx.fillStyle='#b2c8bd';ctx.textAlign='right';ctx.fillText(String(value),left-7,y+5);
 }
 ctx.textAlign='center';ctx.fillStyle='#afcbbd';
 for(let i=0;i<=4;i++){const d=days*i/4;ctx.fillText(Math.round(d)+'日',xx(d),h-5)}
 for(const [key,color] of [['g','#7de2a5'],['r','#ff9586']]){
   ctx.strokeStyle=color;ctx.lineWidth=3;ctx.lineJoin='round';ctx.beginPath();
   dataPoints.forEach((p,i)=>i?ctx.lineTo(xx(p.day),yy(p[key])):ctx.moveTo(xx(p.day),yy(p[key])));ctx.stroke();
 }
}
function render(lab){
 activeLab=lab;
 const d=dataFor(lab);
 set('reportHeading',d.isAI?'AI①｜逃走進化・実験結果':'ノーマル｜実験結果');
 set('reportMeta','DAY '+d.day.toFixed(1)+' / Seed '+d.seed+' / 緑'+d.initialGreen+'・赤'+d.initialRed);
 set('reportFinal','緑 '+pretty(d.green)+' / 赤 '+pretty(d.red));
 set('reportStatus',d.green===0&&d.red===0?'両種絶滅':d.green===0?'緑が絶滅':d.red===0?'赤が絶滅':d.day>=100?'100日到達・観察結果':'経過途中の記録');
 set('reportRule','赤の捕食・繁殖・寿命はノーマルと同じルール');
 set('rrGreen',pretty(d.green));set('rrRed',pretty(d.red));
 set('rrBirthG',pretty(d.birthGreen));set('rrBirthR',pretty(d.birthRed));
 set('rrHunted',pretty(d.huntGreen));set('rrStarvedG',pretty(d.starveGreen));
 set('rrStarvedR',pretty(d.starveRed));set('rrHuntRate',d.redRate);
 set('rrMaxGen',d.isAI?pretty(d.maxGeneration):'—');
 set('rrPeakGen',d.isAI?d.peakGeneration.toFixed(2):'—');
 set('rrMutation',d.isAI?pretty(d.mutations):'—');
 set('rrFlee',d.fleeRate);
 $('reportTelemetry').hidden=!d.isAI;
 $('reportGenerationCsv').hidden=!d.isAI;
 if(d.isAI){
   const t=d.tactics;
   set('rrStartDistance',t.distance==='—'?'—':t.distance+'px');
   set('rrTurnAngle',t.turn==='—'?'—':t.turn+'°');
   set('rrChaseBreak',t.breakRate);
   set('reportLogInfo','個別イベント記録 '+pretty(lab.stats.ai.escapeEvents.length)+'件'+(t.eventsDropped?'／上限超過 '+pretty(t.eventsDropped)+'件は個別ログ省略':'')+'。日別・世代別の集計は全件。');
   $('reportGenerationRows').innerHTML=t.rows.map(row=>
     '<tr><td>'+row.name+'</td><td>'+pretty(row.fleeStarts)+'</td><td>'+row.distance+
     '</td><td>'+row.turn+'°</td><td>'+row.chaseEscaped+' / '+row.resolved+'</td></tr>'
   ).join('');
 }
 set('reportMode',d.isAI?'AI① 逃走進化':'ノーマル（学習なし）');
 set('reportInputs',d.isAI?'入力：赤の相対位置・進行方向・近さ、緑自身のHP・空腹・位置、周囲の草':'入力：緑は固定ルールで危険を判定（AIの入力・学習なし）');
 set('reportOutputs',d.isAI?'判断：逃走開始のしきい値・逃げる角度・左右への回避':'判断：敵との距離で逃走し、草を探索する既定の行動');
 set('reportGenetics',d.isAI?`進化：10入力→8神経→3出力／115重み。出生時に親の重みを継承し、各重み${mutationRate}の確率で±${mutationAmplitude}まで変異。生存・繁殖によって自然選択。個体内の強化学習はなし。`:'赤・緑ともに行動AIの遺伝・突然変異・進化はなし。赤の捕食と繁殖条件はAI①と共通。');
 $('reportOverlay').hidden=false;
 paintGraph($('reportChart'),d);
}
function close(){$('reportOverlay').hidden=true;activeLab=null}
function exportPNG(){
 if(!activeLab)return;
 const d=dataFor(activeLab),cv=document.createElement('canvas');
 cv.width=1080;const reportExtra=d.isAI?460:0;cv.height=1500+reportExtra;const ctx=cv.getContext('2d');
 const rect=(x,y,w,h,color,r=0)=>{
   ctx.fillStyle=color;if(r&&ctx.roundRect){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill()}else ctx.fillRect(x,y,w,h);
 };
 const txt=(str,x,y,size,color='#e8faf2',weight='600',align='left')=>{
   ctx.font=weight+' '+size+'px system-ui,-apple-system,sans-serif';ctx.textAlign=align;ctx.fillStyle=color;ctx.fillText(String(str),x,y);
 };
 rect(0,0,1080,cv.height,'#0b191a');
 txt('ECOSYSTEM LAB  /  EXPERIMENT REPORT',55,65,22,'#8dceaa','800');
 txt(d.isAI?'AI①｜逃走進化・結果':'ノーマル｜実験結果',55,133,47,'#f1fff6','800');
 txt('DAY '+d.day.toFixed(1)+'   /   SEED '+d.seed,55,185,27,'#b1d5c4');
 rect(52,215,976,106,'#193e32',16);
 txt(d.green===0&&d.red===0?'両種絶滅':d.day>=100?'100日以上観察':'途中経過',76,258,23,'#abd8bb');
 txt('緑 '+pretty(d.green)+'匹  /  赤 '+pretty(d.red)+'匹',76,299,37,'#d2ffe4','800');
 txt('赤：ノーマルと同じ捕食・繁殖・寿命ルール',52,357,23,'#b4d5c4');
 rect(52,382,976,270,'#122c29',14);
 const chart=document.createElement('canvas');chart.width=950;chart.height=224;paintGraph(chart,d);
 ctx.drawImage(chart,65,400,950,220);
 txt('● 緑  草食',75,684,22,'#7de2a5');
 txt('● 赤  捕食者',280,684,22,'#ff9586');
 const cells=[
   ['緑・生存',d.green],['赤・生存',d.red],['緑・出生',d.birthGreen],['赤・出生',d.birthRed],
   ['緑・捕食死',d.huntGreen],['緑・餓死',d.starveGreen],['赤・餓死',d.starveRed],['赤・捕食成功率',d.redRate],
   ['最高世代',d.isAI?d.maxGeneration:'—'],['ピーク平均世代',d.isAI?d.peakGeneration.toFixed(2):'—'],
   ['変異した子',d.isAI?d.mutations:'—'],['危険時の逃走割合',d.fleeRate]
 ];
 const left=52,cellW=237,gap=9,startY=707,cellH=100;
 cells.forEach(([key,val],i)=>{
   const col=i%4,row=Math.floor(i/4),x=left+col*(cellW+gap),y=startY+row*(cellH+gap);
   rect(x,y,cellW,cellH,'#182f2b',12);
   txt(key,x+14,y+30,19,'#a9c9bb');txt(typeof val==='number'?pretty(val):val,x+14,y+79,35,'#e7fff2','800');
 });
 if(d.isAI){
   const t=d.tactics;
   rect(52,1055,976,439,'#142e29',15);
   txt('実際の逃走戦術｜世代ごとの記録',74,1098,30,'#dcffe8','800');
   const cards=[
     ['平均逃走開始距離',t.distance==='—'?'—':t.distance+'px'],
     ['平均方向転換角',t.turn==='—'?'—':t.turn+'°'],
     ['追跡距離離脱率',t.breakRate]
   ];
   cards.forEach(([label,val],i)=>{
     const x=74+i*319;
     rect(x,1113,299,92,'#204338',10);
     txt(label,x+12,1145,19,'#a4d4bc');
     txt(val,x+12,1188,34,'#d6ffde','800');
   });
   txt('緑の世代',75,1241,19,'#afd4c3');
   txt('逃走開始',300,1241,19,'#afd4c3');
   txt('距離(px)',490,1241,19,'#afd4c3');
   txt('転換角',650,1241,19,'#afd4c3');
   txt('追跡離脱 / 決着',794,1241,19,'#afd4c3');
   t.rows.forEach((row,i)=>{
     const y=1284+i*40;
     txt(row.name,75,y,21,'#e6fff0');
     txt(String(row.fleeStarts),300,y,21,'#e6fff0');
     txt(String(row.distance),490,y,21,'#e6fff0');
     txt(row.turn==='—'?'—':row.turn+'°',650,y,21,'#e6fff0');
     txt(row.chaseEscaped+' / '+row.resolved,794,y,21,'#d4f7df');
   });
   txt('離脱＝赤が追跡中に200×視野の距離を超えた。途中解除や未決着は除外。',74,1472,18,'#9fcbb5');
 }
 const infoShift=reportExtra;
 rect(52,1055+infoShift,976,287,'#142e29',15);
 txt('何を・どう学習させる？',74,1106+infoShift,30,'#dcffe8','800');
 if(d.isAI){
   txt('入力｜赤の相対位置・方向・近さ／緑のHP・空腹・位置／草',74,1159+infoShift,22,'#b7ded0');
   txt('判断｜いつ逃げるか・逃走角度・左右回避',74,1202+infoShift,22,'#b7ded0');
   txt('遺伝｜10入力 → 8神経 → 3出力、115重み',74,1245+infoShift,22,'#b7ded0');
   txt(`進化｜出生時に継承、各重み${mutationRate}で±${mutationAmplitude}変異`,74,1288+infoShift,22,'#b7ded0');
   txt('選択｜生存・繁殖（個体内の経験学習はなし）',74,1325+infoShift,19,'#91cbae');
 }else{
   txt('緑・赤とも行動は固定ルールで決定します。',74,1182+infoShift,25,'#b7ded0');
   txt('行動AIを世代交代で進化させる処理はありません。',74,1236+infoShift,24,'#b7ded0');
   txt('赤のルールはAI①と同一です。',74,1290+infoShift,24,'#91cbae');
 }
 txt('※ 捕食成功率は捕食数／追跡開始数。進化の成功や現実の生態系を保証しません。',52,1418+infoShift,18,'#9bb9a9');
 txt(d.isAI?'離脱率＝距離離脱／（離脱＋同じ赤による捕食）。途中解除・継続中は除外。':'世代交代によるAI進化はノーマルでは行われません。',52,1452+infoShift,18,'#9bb9a9');
 if(d.isAI){
   txt('個別イベントログ最大20,000件・上限以降は集計のみ（累計は常に全件）。',52,1940,18,'#9bb9a9');
 }
 cv.toBlob(blob=>{
   if(!blob)return;
   const url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download='ecosystem_'+(d.isAI?'AI1':'normal')+'_DAY'+Math.round(d.day)+'_seed'+d.seed+'.png';
   document.body.appendChild(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),2000);
 },'image/png');
}
function exportGenerationCSV(){
 if(!activeLab||activeLab.settings.mode!=='escape')return;
 const ai=activeLab.stats.ai;
 const keys=['generation','born','flee_starts','mean_start_distance_px','mean_turn_deg','mean_away_deviation_deg','chase_starts','chase_distance_breaks','chase_caught','chase_other','chase_open','distance_break_pct_resolved'];
 const rows=[keys.join(',')];
 for(const [gen,v] of Object.entries(ai.byGeneration).sort((a,b)=>Number(a[0])-Number(b[0]))){
   const resolved=v.chaseEscaped+v.chaseCaught;
   rows.push([
     gen,v.born,v.fleeStarts,
     v.fleeStarts?(v.startDistanceSum/v.fleeStarts).toFixed(3):'',
     v.turnSamples?(v.turnDegSum/v.turnSamples).toFixed(3):'',
     v.turnSamples?(v.awayDegSum/v.turnSamples).toFixed(3):'',
     v.chaseStarts,v.chaseEscaped,v.chaseCaught,v.chaseOther,
     v.chaseStarts-resolved-v.chaseOther,resolved?(100*v.chaseEscaped/resolved).toFixed(3):''
   ].join(','));
 }
 const blob=new Blob(['\ufeff'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='ecosystem_AI1_generation_DAY'+Math.round(activeLab.day)+'_seed'+activeLab.settings.seed+'.csv';
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
root.EcosystemReport={render,close,exportPNG,exportGenerationCSV,dataFor};
})(window);
