/* Ecosystem Lab UI: visuals do not influence the deterministic simulation. */
(() => {
'use strict';
const $=id=>document.getElementById(id), {Lab,SPECIES,W,H,GRID_X,GRID_Y,CELL}=window.EcosystemCore;
const cv=$('world'),c=cv.getContext('2d'),pop=$('chart'),popCtx=pop.getContext('2d'),pred=$('predChart'),predCtx=pred.getContext('2d');
const CHECKPOINT_DAY=100;
const video=window.EcosystemVideo, family=window.EcosystemLineage, batchStudio=window.EcosystemBatch;
let activeFamilyId=null,lastFamilyLab=null,lastFamilyDay=-1,lastFamilyRecordCount=-1;
let batchStudy=null,batchRunning=false,batchAbort=false;
let videoComparison=null,videoCompareRunning=false,lastVideoLab=null,lastVideoLength=-1,lastVideoGraph='',lastVideoComparison=null;
let lab,playing=true,ended=false,checkpointPassed=false,speed=5,focus=null,zoom=1,cam={x:W/2,y:H/2},time=0,accum=0,lastUI=0,chartAt=0,activeTab='normal';
const worlds={normal:null,ai1:null,ai2:null};
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
function options(){return {seed:Number($('seed').value)||1,green:Number($('startg').value),red:Number($('startr').value),blue:0,variance:Number($('variance').value),regrowth:Number($('regrowth').value),duration:Infinity,trackLineages:true,mode:activeTab==='ai1'?'escape':activeTab==='ai2'?'social':'normal'}}
function reset(){lab=new Lab(options());playing=true;ended=false;checkpointPassed=false;accum=0;focus=null;zoom=1;cam={x:W/2,y:H/2};activeFamilyId=null;lastFamilyLab=null;show();draw();drawCharts();drawFamily(true)}
function creature(e){
 c.save();c.translate(e.x,e.y);c.rotate(e.angle);const sz=e.type==='g'?.88:e.type==='r'?1.08:1.22;c.scale(sz,sz);
 c.fillStyle='#08161399';c.beginPath();c.ellipse(1,4,12,8,0,0,Math.PI*2);c.fill();
 c.strokeStyle=e.type==='g'?'#4cad79':e.type==='r'?'#bb4d45':'#4479bb';c.lineWidth=3;c.lineCap='round';const wig=Math.sin(e.phase*2.5)*3;
 for(const side of [-1,1]){c.beginPath();c.moveTo(-5,side*5);c.lineTo(-9-wig,side*8);c.moveTo(5,side*5);c.lineTo(8+wig,side*8);c.stroke()}
 if(e.type==='g'){  c.fillStyle='#b3f2c8';for(const side of [-1,1]){c.beginPath();c.ellipse(-7,side*5,5,2.3,0,0,Math.PI*2);c.fill()}
  c.fillStyle='#70cd99';c.beginPath();c.ellipse(-1,0,10.3,7.4,0,0,Math.PI*2);c.fill();c.fillStyle='#8af4b8';c.beginPath();c.ellipse(6,0,5.5,6.3,0,0,Math.PI*2);c.fill();
  c.fillStyle='#0b3128';c.fillRect(7,-3,2,2);c.fillRect(7,2,2,2);
 }else{
  c.fillStyle=e.type==='r'?'#b65a4d':'#507fc4';c.beginPath();c.moveTo(-8,-3);c.lineTo(-18,0);c.lineTo(-8,3);c.fill();
  c.fillStyle=e.type==='r'?'#f87c70':'#72a9f8';c.beginPath();c.ellipse(-1,0,11.4,7.8,0,0,Math.PI*2);c.fill();
  for(const side of [-1,1]){c.beginPath();c.moveTo(3,side*5);c.lineTo(8,side*11);c.lineTo(10,side*5);c.fill()}
  c.fillStyle=e.type==='r'?'#ffd2ac':'#bdd6ff';c.beginPath();c.moveTo(6,-4);c.lineTo(15,0);c.lineTo(6,4);c.fill();
  c.fillStyle='#183541';c.fillRect(6,-4,3,2);c.fillRect(6,3,3,2)
 }
 if(e.type==='g'&&lab.settings.mode==='social'&&e.socialNeighbors>=2){
  // Observable local herd marker (>=2 green neighbours within 65px), not a defense buff.
  c.strokeStyle='rgba(168,255,204,.38)';c.lineWidth=1.6;
  c.beginPath();c.arc(0,0,16.5,0,Math.PI*2);c.stroke();
 }
 if(e.flash>0){c.globalAlpha=clamp(e.flash*1.9,0,.65);c.fillStyle='#ffffff';c.beginPath();c.ellipse(0,0,11,8,0,0,Math.PI*2);c.fill()}
 c.restore();
 if(e.id===focus){c.lineWidth=2;c.setLineDash([4,3]);c.strokeStyle='#ffef9e';c.beginPath();c.arc(e.x,e.y,19,0,Math.PI*2);c.stroke();c.setLineDash([]);c.fillStyle='#081e1ccc';c.fillRect(e.x-19,e.y-30,38,6);c.fillStyle='#87e6a6';c.fillRect(e.x-19,e.y-30,38*clamp(e.hp/e.maxhp,0,1),6);c.fillStyle='white';c.font='bold 11px system-ui';c.textAlign='center';c.fillText('#'+e.id,e.x,e.y-35)}
}
function draw(){
 c.fillStyle='#14382f';c.fillRect(0,0,W,H);
 const selected=lab.entities.find(x=>x.id===focus);
 if(focus&&selected){cam.x+=(selected.x-cam.x)*.12;cam.y+=(selected.y-cam.y)*.12}
 else if(focus)focus=null;
 if(zoom===1){cam.x=W/2;cam.y=H/2}
 cam.x=clamp(cam.x,W/(2*zoom),W-W/(2*zoom));cam.y=clamp(cam.y,H/(2*zoom),H-H/(2*zoom));
 c.save();c.translate(W/2,H/2);c.scale(zoom,zoom);c.translate(-cam.x,-cam.y);
 for(let y=0;y<GRID_Y;y++)for(let x=0;x<GRID_X;x++){
  const v=lab.grass[y*GRID_X+x],xx=x*CELL,yy=y*CELL;
  c.fillStyle=`rgb(${Math.round(17+v*8)},${Math.round(50+v*18)},${Math.round(36+v*7)})`;c.fillRect(xx,yy,CELL+1,CELL+1);
  if(v>.26){const ox=(x*97+y*27)%23,oy=(y*79+x*11)%22;c.fillStyle=`rgba(138,213,118,${v*.31})`;c.beginPath();c.ellipse(xx+ox+4,yy+oy+5,Math.max(1,v*4),Math.max(1,v*2),-.5,0,Math.PI*2);c.fill()}
 }
 c.strokeStyle='#b0ffd30b';c.lineWidth=1;for(let x=0;x<=GRID_X;x++){c.beginPath();c.moveTo(x*CELL,0);c.lineTo(x*CELL,H);c.stroke()}for(let y=0;y<=GRID_Y;y++){c.beginPath();c.moveTo(0,y*CELL);c.lineTo(W,y*CELL);c.stroke()}
 for(const e of lab.entities)creature(e);
 for(const fx of lab.effects){c.globalAlpha=clamp(fx.life*3,0,1);c.fillStyle=fx.color;c.beginPath();c.arc(fx.x,fx.y,3,0,Math.PI*2);c.fill()}c.globalAlpha=1;c.restore();
}
function chartDraw(canvas,ctx,keys){
 const w=canvas.width,h=canvas.height,left=45,right=14,top=12,bottom=27;
 // Every 100 days the timeline expands; after 400 days show a moving 400-day window.
 // This preserves readable lines/ticks as the experiment runs indefinitely.
 const xEnd=Math.max(100,Math.ceil(Math.max(100,lab.day)/100)*100);
 const xStart=Math.max(0,xEnd-400),range=xEnd-xStart;
 const visible=lab.history.filter(n=>n.day>=xStart&&n.day<=xEnd);
 const ymax=visible.reduce((max,n)=>Math.max(max,...keys.map(k=>n[k])),10);
 const ceiling=Math.ceil(ymax/(ymax>100?50:10))*(ymax>100?50:10);
 const px=d=>left+(d-xStart)/range*(w-left-right),py=v=>top+(1-v/ceiling)*(h-top-bottom);
 ctx.fillStyle='#102022';ctx.fillRect(0,0,w,h);ctx.lineWidth=1;ctx.font='12px system-ui';ctx.textAlign='right';
 for(let i=0;i<=4;i++){const value=ceiling*i/4,y=py(value);ctx.strokeStyle='#35504a';ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);ctx.stroke();ctx.fillStyle='#a7c4b9';ctx.fillText(Math.round(value),left-8,y+4)}
 ctx.textAlign='center';
 for(let i=0;i<=5;i++){const d=xStart+range*i/5;ctx.fillStyle='#94b1aa';ctx.fillText(Math.round(d)+'日',px(d),h-5)}
 for(const k of keys){ctx.strokeStyle=SPECIES[k].color;ctx.lineWidth=3;ctx.lineJoin='round';ctx.beginPath();
   visible.forEach((n,i)=>{if(!i)ctx.moveTo(px(n.day),py(n[k]));else ctx.lineTo(px(n.day),py(n[k]))});ctx.stroke()}
 ctx.strokeStyle='#d4efda88';ctx.setLineDash([4,6]);ctx.beginPath();ctx.moveTo(px(lab.day),top);ctx.lineTo(px(lab.day),h-bottom);ctx.stroke();ctx.setLineDash([]);
}
function drawCharts(){chartDraw(pop,popCtx,['g','r']);chartDraw(pred,predCtx,['r']);drawVideo();drawFamily()}

function drawFamily(force=false){
 if(!family||!lab?.settings.trackLineages)return;
 const day=Math.floor(lab.day),n=lab.lineageRecords.size;
 if(!force&&lastFamilyLab===lab&&lastFamilyDay===day&&lastFamilyRecordCount===n)return;
 lastFamilyLab=lab;lastFamilyDay=day;lastFamilyRecordCount=n;
 const detail=activeFamilyId===null?null:lab.lineageDetail(activeFamilyId);
 family.paint($('lineageCanvas'),detail,lab);
 if(activeFamilyId!==null&&!detail){
  $('lineageStatus').textContent='緑の個体 #'+activeFamilyId+' の記録がありません。このシードの緑の番号を入力してください。';
  $('lineageDetails').innerHTML='';
 }else if(detail){
  const p=detail.person,rate=(a)=>p.lifeDays?(100*a/p.lifeDays).toFixed(1)+'%':'—';
  const val=x=>Number(x).toFixed(2);
  const traits=p.traits?
   '集合 '+val(p.traits.gather)+' ／方向同調 '+val(p.traits.align)+' ／密集回避 '+val(p.traits.separate):
   'ノーマル：遺伝型ニューラルネットワークなし';
  const parent=p.parentId?'親 #'+p.parentId:'初代（親なし）';
  $('lineageStatus').textContent='緑 #'+p.id+'（'+p.generation+'世代）｜'+parent+'｜初代家系 #'+p.rootId+
   '｜'+(p.alive?'生存中':'死亡：'+p.death+' DAY'+p.deathDay)+
   '\n遺伝的傾向：'+traits+'。親子は母系継承を表示しています。';
  $('lineageDetails').innerHTML=
   '<div><strong>採食と寿命</strong><small>累積採食エネルギー：'+val(p.foodEnergy)+
   '<br>生存期間：'+val(p.lifeDays)+'日<br>低エネルギー時間：'+rate(p.lowEnergyDays)+'</small></div>'+
   '<div><strong>捕食と群れ</strong><small>赤の攻撃：'+p.hitCount+'回'+
   '<br>群れ参加：'+(lab.settings.mode==='social'?rate(p.groupDays):'対象外')+
   '<br>密集時間：'+(lab.settings.mode==='social'?rate(p.crowdDays):'対象外')+'</small></div>'+
   '<div><strong>親子・系統</strong><small>直接の子：'+p.children.length+'匹'+
   '<br>その個体の直系子孫：'+detail.descendantsTotal+'匹（生存 '+detail.descendantsAlive+'）'+
   '<br>初代 #'+p.rootId+' の一族：'+detail.familyTotal+'匹（生存 '+detail.familyAlive+'）</small></div>';
 }else{
  $('lineageStatus').textContent='緑をタップして選択するか、個体番号を入力してください。死亡後の記録も検索できます。';
  $('lineageDetails').innerHTML='';
 }
 // Rebuild a small selector of surviving founder families; never dump thousands of records in DOM.
 const previous=$('lineageSuggested').value;
 const leaders=lab.lineageLeaders(12);
 $('lineageSuggested').innerHTML='<option value="">生存家系トップ '+leaders.length+'件…</option>'+
  leaders.map(x=>'<option value="'+x.rootId+'">初代 #'+x.rootId+'｜生存'+x.alive+
   '匹｜最大'+x.maxGeneration+'世代</option>').join('');
 if(leaders.some(x=>String(x.rootId)===String(previous)))$('lineageSuggested').value=previous;
 $('lineageChildren').innerHTML='<option value="">直接の子を選択…</option>'+
  (detail?.directChildren||[]).slice(0,80).map(child=>
   '<option value="'+child.id+'">緑 #'+child.id+'（第'+child.generation+'世代・'+
   (child.alive?'生存':'死亡')+'）</option>').join('');
 $('lineageGoParent').disabled=!detail?.person?.parentId;
}
function chooseFamily(id){
 const n=Math.floor(Number(id));if(!Number.isFinite(n)||n<=0){$('lineageStatus').textContent='正しい緑の個体番号を入力してください。';return}
 activeFamilyId=n;$('lineageId').value=n;drawFamily(true);
}
function downloadLocalCsv(contents,name){
 const blob=new Blob([contents],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function drawBatch(){
 batchStudio.paint($('batchCanvas'),batchStudy,$('batchGraph').value||'green');
}
function renderBatchStats(){
 if(!batchStudy?.complete){$('batchSummary').innerHTML='';drawBatch();return}
 const data=batchStudio.summary(batchStudy);
 $('batchSummary').innerHTML=batchStudy.modes.map(mode=>{
  const m=data[mode],name=video.modeLabel(mode);
  return '<div><strong>'+name+'｜'+m.n+'シード</strong><small>'+
   '緑最終平均 '+m.green.toFixed(1)+'匹（p10〜p90：'+m.greenP10.toFixed(1)+'〜'+m.greenP90.toFixed(1)+'）'+
   '<br>緑存続 '+m.survived+'/'+m.n+'、赤緑共存 '+m.coexist+'/'+m.n+
   '<br>緑の出生 '+m.births.toFixed(1)+'件、捕食死 '+m.hunted.toFixed(1)+'件、餓死 '+m.starved.toFixed(1)+'件</small></div>';
 }).join('');
 if(data.paired){
  $('batchStatus').textContent+='\\nAI②−AI①の緑最終頭数（対応シード平均）：'+data.paired.mean.toFixed(1)+
   '匹、95%ブートストラップ区間 '+data.paired.ci95[0].toFixed(1)+'〜'+data.paired.ci95[1].toFixed(1)+'匹';
 }
 drawBatch();
}

function videoSelection(){return $('videoGraphSelect').value||'population'}
function validVideoComparison(){
 return videoComparison&&videoComparison.signature===video.signature(options())?videoComparison:null;
}
function drawVideo(force=false){
 if(!video)return;
 const graph=videoSelection(),comp=validVideoComparison();
 if(!force&&lastVideoLab===lab&&lastVideoLength===lab.history.length&&lastVideoGraph===graph&&lastVideoComparison===comp)return;
 const result=video.paint($('videoCanvas'),{lab,graph,comparison:comp});
 lastVideoLab=lab;lastVideoLength=lab.history.length;lastVideoGraph=graph;lastVideoComparison=comp;
 const last=lab.history.at(-1),first=lab.history[0];
 const stats=graph==='genes'&&lab.settings.mode==='social'?
  '集合 '+(first.ai2GeneGather??'—')+' → '+(last.ai2GeneGather??'—')+
  ' ／ 方向同調 '+(first.ai2GeneAlign??'—')+' → '+(last.ai2GeneAlign??'—')+
  ' ／ 密集回避 '+(first.ai2GeneSeparate??'—')+' → '+(last.ai2GeneSeparate??'—'):
  graph==='herd'&&lab.settings.mode==='social'?
    '群れ参加 '+(last.ai2GroupedPct??'—')+'% ／ 最大連結群 '+(last.ai2LargestConnectedPct??'—')+'%':
  graph==='compare'&&comp?
    '同じシード '+comp.seed+' ｜ DAY100実測：ノーマル '+
    comp.normal.history.at(-1).g+'匹 ／ AI① '+comp.ai1.history.at(-1).g+
    '匹 ／ AI② '+comp.ai2.history.at(-1).g+'匹':
   'DAY '+lab.day.toFixed(1)+'・生存 緑'+lab.counts().g+'匹／赤'+lab.counts().r+
   '匹。日別の履歴を自動記録中。';
 if(!videoCompareRunning)$('videoInfo').textContent=result.error||stats;
}

function show(){
 const n=lab.counts(),s=lab.stats;$('ng').textContent=n.g;$('nr').textContent=n.r;$('nb').textContent=n.b;$('day').textContent=`DAY ${lab.day.toFixed(1)} ｜ ${!playing&&checkpointPassed&&Math.abs(lab.day-CHECKPOINT_DAY)<1e-6?'100日地点で一時停止':'観察中'}`;
 const grass=(100*lab.grassTotal()).toFixed(0)+'%';$('grass').textContent=grass;$('grassbar').style.width=grass;
 for(const t of ['g','r','b']){$('birth'+t).textContent=s.births[t];$('death'+t).textContent=s.deaths[t].starve+' / '+s.deaths[t].age+' / '+s.deaths[t].hunt+' / '+s.deaths[t].defense}
 $('killsr').textContent=s.kills.r;$('killsb').textContent=s.kills.b;$('counter').textContent=s.counters;
 $('rateR').textContent=s.hunts.r?Math.round(s.kills.r/s.hunts.r*100)+'%':'—';$('rateB').textContent=s.hunts.b?Math.round(s.kills.b/s.hunts.b*100)+'%':'—';
 $('effR').textContent=s.individualDays.r?(s.kills.r/s.individualDays.r*100).toFixed(1):'—';
 $('effB').textContent=s.individualDays.b?(s.kills.b/s.individualDays.b*100).toFixed(1):'—';
 for(const [t,id] of [['g','edgeG'],['r','edgeR'],['b','edgeB']])$(id).textContent=s.individualDays[t]?(100*s.edgeDays[t]/s.individualDays[t]).toFixed(1)+'%':'—';
 $('nearStarveG').textContent=s.starveWithLocalGrass.g;
 const e=lab.events[0];$('event').textContent=e?`DAY ${Math.floor(e.day)} — ${e.text}`:'';
 const sel=lab.entities.find(e=>e.id===focus);
 $('selected').textContent=sel?`#${sel.id}｜${SPECIES[sel.type].name}\nHP ${Math.ceil(sel.hp)}/${Math.ceil(sel.maxhp)}｜エネルギー ${Math.ceil(sel.energy)}%｜年齢 ${sel.age.toFixed(1)}/${sel.life.toFixed(1)}日｜攻撃力 ${sel.attack.toFixed(1)}｜移動 ${sel.speed.toFixed(2)}｜捕食 ${sel.kills}｜子 ${sel.children}｜反撃 ${sel.counters}`:'生物をタップすると、HP・年齢・エネルギー・個体記録を表示します。';
 $('toggle').textContent=ended?'✓ 実験終了':playing?'⏸ 一時停止':checkpointPassed&&Math.abs(lab.day-CHECKPOINT_DAY)<1e-6?'▶ 100日以降を再生':'▶ 再開';$('toggle').disabled=ended;
 $('stateText').textContent=playing?'シミュレーション実行中':checkpointPassed&&Math.abs(lab.day-CHECKPOINT_DAY)<1e-6?'DAY100｜▶で続きを再生':'一時停止中';
 const herd=lab.history.at(-1);
 $('ai2Grouped').textContent=activeTab==='ai2'&&herd&&herd.ai2GroupedPct!==undefined?herd.ai2GroupedPct.toFixed(1)+'%':'—';
 $('ai2Neighbors').textContent=activeTab==='ai2'&&herd&&herd.ai2MeanNeighbors!==undefined?herd.ai2MeanNeighbors.toFixed(2):'—';
 $('ai2Cluster').textContent=activeTab==='ai2'&&herd?String(herd.ai2MaxLocalGroup??0):'—';
 $('ai2Generation').textContent=activeTab==='ai2'&&herd?Number(herd.aiMeanGeneration||0).toFixed(1):'—';

}
let last=0;
function pauseAtCheckpoint(){
 checkpointPassed=true;
 playing=false;
 accum=0;
}
function frame(t){
 if(!last)last=t;const dt=Math.min(.15,(t-last)/1000);last=t;
 if(playing&&!ended){
   accum+=dt*.68*speed;let loops=0;
   while(accum>.08&&loops<95){
     // Stop exactly once at DAY100. Resume continues past it without another pause.
     const step=checkpointPassed?.08:Math.min(.08,CHECKPOINT_DAY-lab.day);
     if(step<=0){pauseAtCheckpoint();break}
     lab.update(step);accum-=.08;loops++;
     if(!checkpointPassed&&lab.day>=CHECKPOINT_DAY-1e-9){pauseAtCheckpoint();break}
   }
 }
 draw();if(t-chartAt>180){drawCharts();chartAt=t}if(t-lastUI>160){show();lastUI=t}requestAnimationFrame(frame)
}
function exportCSV(){
 const keys=['day','g','r','b','grass','birthg','birthr','birthb','killsr','killsb','huntsr','huntsb','starveg','starver','starveb','ager','ageb','counters','daysr','daysb','edger','edgeb','starvegrassg','aiMeanGeneration','aiEscapeBias','aiOffspring','aiMutated','aiFleeDays',
  'aiFleeStarts','aiMeanFleeStartDistance','aiMeanTurnDeg','aiMeanAwayDeg',
  'aiChaseStarts','aiChaseEscaped','aiChaseCaught','aiChaseOther','aiChaseDistanceBreakPct',
  'aiEncounterStarts','aiEncounterSurvived','aiEncounterHit','aiEncounterDiedOther',
  'aiEncounterPending','aiAttackFree1dPct',
  'ai2GroupedPct','ai2MeanNeighbors','ai2MaxLocalGroup','ai2MeanNearest',
  'ai2LargestConnectedPct','ai2HeadingAlignment',
  'ai2GeneGather','ai2GeneAlign','ai2GeneSeparate',
  'huntg','ageg','redIndividualDays'];
 const rows=[keys.join(','),...lab.history.map(d=>keys.map(k=>d[k]??'').join(','))];
 const blob=new Blob(['\ufeff'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`ecosystem_${lab.settings.mode}_seed_${lab.settings.seed}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
} 
function exportEscapeCSV(){
 if(activeTab!=='ai1')return;
 const ai=lab.stats.ai,keys=['day','kind','greenId','generation','redId','startDistance','turnDeg','awayDeg','outcome','detail','pursuitDays','startDay','startEnergy','windowDays'];
 const rows=[keys.join(','),...ai.escapeEvents.map(event=>keys.map(k=>event[k]??'').join(','))];
 const blob=new Blob(['\ufeff'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='ecosystem_AI1_escape_events_DAY'+Math.round(lab.day)+'_seed'+lab.settings.seed+'.csv';
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
// Tab worlds never share births, individuals, history, paused state, or settings.
function snapshotWorld(){
 worlds[activeTab]={
   lab,playing,checkpointPassed,ended,speed,focus,zoom,cam:{...cam},accum,
   inputs:{
     seed:$('seed').value,startg:$('startg').value,startr:$('startr').value,
     variance:$('variance').value,regrowth:$('regrowth').value
   }
 };
}
function switchTab(next){
 if(next===activeTab)return;
 snapshotWorld();
 activeTab=next;
 for(const [key,view,button] of [['normal','view-normal','tabButtonNormal'],['ai1','view-ai1','tabButtonAi1'],['ai2','view-ai2','tabButtonAi2']]){
   $(view).hidden=key!==next;$(button).setAttribute('aria-selected',String(key===next));
 }
 $('view-live').hidden=false;
 $('escapeCsv').hidden=next!=='ai1';
 if(worlds[next]){
   const w=worlds[next];
   ({lab,playing,checkpointPassed,ended,speed,focus,zoom,cam,accum}=w);
   for(const [id,val] of Object.entries(w.inputs))$(id).value=val;
 }else{
   // Match the baseline conditions while allowing AI① to run independently.
   $('seed').value=20261117;$('startg').value=100;$('startr').value=20;
   $('variance').value=10;$('regrowth').value=100;
   lab=new Lab(options());playing=false;checkpointPassed=false;ended=false;
   speed=5;focus=null;zoom=1;cam={x:W/2,y:H/2};accum=0;
 }
 $('varText').textContent='±'+$('variance').value+'%';
 $('regText').textContent=$('regrowth').value+'%';
 document.querySelectorAll('#speeds button').forEach(btn=>btn.classList.toggle('active',Number(btn.dataset.s)===speed));
 $('dot').style.background='#6fe1a1';
 show();draw();drawCharts();
}
$('tabButtonNormal').onclick=()=>switchTab('normal');
$('tabButtonAi1').onclick=()=>switchTab('ai1');
$('tabButtonAi2').onclick=()=>switchTab('ai2');
function usePreset(red){$('startg').value=100;$('startr').value=red;$('startb').value=0;reset()}
$('preset10').onclick=()=>usePreset(10);
$('preset20').onclick=()=>usePreset(20);
$('preset30').onclick=()=>usePreset(30);
$('toggle').onclick=()=>{if(!ended)playing=!playing;show()};$('reset').onclick=reset;
$('newseed').onclick=()=>{$('seed').value=Number($('seed').value)+1;reset()};
function advanceTo(day){
 playing=false;
 const stopAt100=!checkpointPassed&&lab.day<CHECKPOINT_DAY&&day>=CHECKPOINT_DAY;
 lab.run(stopAt100?CHECKPOINT_DAY:day,.08);
 if(stopAt100)pauseAtCheckpoint();
 show();draw();drawCharts();
}
$('single').onclick=()=>advanceTo(Math.floor(lab.day)+1);
$('jump10').onclick=()=>advanceTo(lab.day+10);
$('jump100').onclick=()=>advanceTo(lab.day+100);
$('csv').onclick=exportCSV;
$('videoGraphSelect').onchange=()=>drawVideo(true);
$('videoSavePng').onclick=()=>{
 drawVideo(true);
 video.download($('videoCanvas'),'ecosystem_video_'+videoSelection()+
  '_DAY'+Math.round(lab.day)+'_seed'+lab.settings.seed+'.png');
};
$('videoSaveCsv').onclick=()=>{
 const graph=videoSelection(),cmp=validVideoComparison();
 const query=video.seriesFor(lab,graph,cmp);
 if(query.error){$('videoInfo').textContent=query.error;return}
 const blob=new Blob([video.csv(lab,graph,cmp)],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='ecosystem_video_'+graph+'_DAY'+Math.round(lab.day)+'_seed'+lab.settings.seed+'.csv';
 document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1500);
};
$('videoRunCompare').onclick=async()=>{
 if(videoCompareRunning)return;
 videoCompareRunning=true;
 const btn=$('videoRunCompare'),originalPlaying=playing,pref=options();
 const signature=video.signature(pref);
 playing=false;btn.disabled=true;
 const result={signature,seed:pref.seed};
 try{
  for(const [model,key] of [['normal','normal'],['escape','ai1'],['social','ai2']]){
   const world=new Lab({...pref,mode:model,duration:100});
   world.aiLog=function(){};
   for(let target=5;target<=100;target+=5){
     world.run(target,.08);
     $('videoInfo').textContent='同条件3モード比較：'+video.modeLabel(model)+'　DAY'+target+'/100を計算中…';
     await new Promise(resolve=>setTimeout(resolve,0));
   }
   result[key]={history:world.history,counts:world.counts()};
  }
  videoComparison=result;
  $('videoGraphSelect').value='compare';
  // If a setting was edited while computation ran, do not show mismatched curves.
  drawVideo(true);
 }catch(error){
  $('videoInfo').textContent='比較データを作れませんでした。設定を確認してください。';
  console.error('Video comparison failed',error);
 }finally{
  videoCompareRunning=false;btn.disabled=false;
  playing=originalPlaying&&!ended;show();
  if(videoComparison&&videoComparison.signature===video.signature(options()))drawVideo(true);
 }
};

$('lineageSearch').onclick=()=>chooseFamily($('lineageId').value);
$('lineageGoParent').onclick=()=>{
 const id=lab.lineageDetail(activeFamilyId)?.person?.parentId;
 if(id)chooseFamily(id);
};
$('lineageChildren').onchange=()=>{
 if($('lineageChildren').value)chooseFamily($('lineageChildren').value);
};
$('lineageFromSelection').onclick=()=>{
 const e=lab.entities.find(x=>x.id===focus&&x.alive&&x.type==='g');
 if(e)chooseFamily(e.id);
 else $('lineageStatus').textContent='先に緑の個体をタップして選択してください。';
};
$('lineageSuggested').onchange=()=>{if($('lineageSuggested').value)chooseFamily($('lineageSuggested').value)};
$('lineageSavePng').onclick=()=>{
 drawFamily(true);
 if(!lab.lineageDetail(activeFamilyId)){$('lineageStatus').textContent='先に個体を選択してください。';return}
 video.download($('lineageCanvas'),'ecosystem_family_'+lab.settings.mode+'_seed'+lab.settings.seed+'_id'+activeFamilyId+'.png');
};
$('lineageSaveCsv').onclick=()=>{
 const detail=lab.lineageDetail(activeFamilyId);
 if(!detail){$('lineageStatus').textContent='先に個体を選択してください。';return}
 downloadLocalCsv(family.csv(detail),'ecosystem_family_seed'+lab.settings.seed+'_id'+activeFamilyId+'.csv');
};
$('batchGraph').onchange=drawBatch;
$('batchSavePng').onclick=()=>{
 if(!batchStudy?.complete){$('batchStatus').textContent='一括統計を実行してください。';return}
 drawBatch();video.download($('batchCanvas'),'ecosystem_batch_'+$('batchGraph').value+'_'+batchStudy.count+'seeds.png');
};
$('batchSaveCsv').onclick=()=>{
 if(!batchStudy?.complete){$('batchStatus').textContent='一括統計を実行してください。';return}
 downloadLocalCsv(batchStudio.csv(batchStudy,$('batchGraph').value),'ecosystem_batch_'+$('batchGraph').value+'.csv');
};
$('batchSaveSeedCsv').onclick=()=>{
 if(!batchStudy?.complete){$('batchStatus').textContent='一括統計を実行してください。';return}
 downloadLocalCsv(batchStudio.summaryCsv(batchStudy),'ecosystem_batch_all_seed_results.csv');
};
$('batchCancel').onclick=()=>{batchAbort=true;$('batchStatus').textContent='集計を中止しています。ここまでの不完全な結果は採用しません。'};
$('batchRun').onclick=async()=>{
 if(batchRunning)return;
 const count=Number($('batchCount').value),scope=$('batchScope').value;
 const modes=scope==='social'?['social']:['normal','escape','social'];
 const pref=options(),origLab=lab,oldPlaying=playing;
 const study=batchStudio.createStudy({baseSeed:pref.seed,count,settings:pref,modes});
 batchRunning=true;batchAbort=false;batchStudy=null;playing=false;
 $('batchRun').disabled=true;$('batchCancel').disabled=false;
 $('batchSummary').innerHTML='';
 let finished=0;
 try{
  for(let i=0;i<count&&!batchAbort;i++){
   for(const mode of modes){
    if(batchAbort)break;
    const world=new Lab({...pref,seed:pref.seed+i,mode,duration:100,trackLineages:false});
    world.aiLog=function(){};
    for(let day=10;day<=100;day+=10){
     if(batchAbort)break;
     world.run(day,.08);
     $('batchStatus').textContent='同一シード比較：'+(i+1)+'/'+count+'シード、'+video.modeLabel(mode)+
      ' DAY'+day+'/100\\n完了 '+finished+'/'+(count*modes.length)+' 世界。端末の性能によって時間がかかります。';
     // Give mobile browsers a chance to paint and process cancel taps.
     await new Promise(resolve=>setTimeout(resolve,0));
    }
    if(!batchAbort){batchStudio.ingest(study,mode,world);finished++}
   }
  }
  if(batchAbort){
   $('batchStatus').textContent='計算を中止しました。完了していない試行は統計結果として使用しません。';
  }else{
   batchStudy=batchStudio.finish(study);
   $('batchStatus').textContent='完了：'+batchStudy.count+'組、'+modes.length+'モード。'+
    (batchStudy.count*modes.length)+'世界×100日を同じ条件で実行しました。'+
    '\\nシード範囲 '+pref.seed+'〜'+(pref.seed+count-1)+
    '。平均線とシードの10〜90%幅をグラフで確認できます。';
   renderBatchStats();
  }
 }catch(error){
  $('batchStatus').textContent='集計エラー：データを採用しません。端末の空きメモリや設定を確認してください。';
  console.error('Multi-seed analytics failed',error);
 }finally{
  batchRunning=false;$('batchRun').disabled=false;$('batchCancel').disabled=true;
  if(lab===origLab)playing=oldPlaying&&!ended;
  show();
 }
};

$('escapeCsv').onclick=exportEscapeCSV;
$('openReport').onclick=()=>{
 playing=false;accum=0;show();
 window.EcosystemReport.render(lab);
};
$('closeReport').onclick=()=>window.EcosystemReport.close();
$('reportReturn').onclick=()=>window.EcosystemReport.close();
$('reportSavePng').onclick=()=>window.EcosystemReport.exportPNG();
$('reportGenerationCsv').onclick=()=>window.EcosystemReport.exportGenerationCSV();
$('unselect').onclick=()=>{focus=null;zoom=1};$('zin').onclick=()=>{zoom=Math.min(4,zoom*1.45)};$('zout').onclick=()=>{zoom=Math.max(1,zoom/1.45)};$('zreset').onclick=()=>{focus=null;zoom=1};
$('variance').oninput=()=>{$('varText').textContent='±'+$('variance').value+'%'};$('regrowth').oninput=()=>{$('regText').textContent=$('regrowth').value+'%'};
document.querySelectorAll('#speeds button').forEach(btn=>btn.onclick=()=>{speed=Number(btn.dataset.s);document.querySelectorAll('#speeds button').forEach(b=>b.classList.toggle('active',b===btn))});
cv.addEventListener('pointerdown',e=>{const r=cv.getBoundingClientRect(),sx=(e.clientX-r.left)/r.width*W,sy=(e.clientY-r.top)/r.height*H,x=(sx-W/2)/zoom+cam.x,y=(sy-H/2)/zoom+cam.y;let best=null,bestD=25/zoom;
for(const a of lab.entities){const d=Math.hypot(a.x-x,a.y-y);if(d<bestD){bestD=d;best=a}}if(best){focus=best.id;zoom=Math.max(zoom,1.7);cam.x=best.x;cam.y=best.y}else{focus=null;if(zoom>1){cam.x=x;cam.y=y}}show()});
$('batch').onclick=async()=>{
 if($('batch').disabled)return;
 const btn=$('batch'),wasPlaying=playing;
 playing=false;btn.disabled=true;
 const pref=options(),modes=['normal','escape','social'],results={};
 for(const mode of modes)results[mode]={greenAlive:0,coexist:0,finalGreen:0,finalRed:0,hunted:0,starved:0};
 try{
  for(let i=0;i<10;i++){
   const seed=pref.seed+i;
   for(const mode of modes){
    const test=new Lab({...pref,seed,mode});
    // Experimental worlds are independent; do not alter the currently visible ecosystem.
    test.aiLog=function(){};test.run(100,.08);
    const counts=test.counts(),out=results[mode];
    if(counts.g>0)out.greenAlive++;
    if(counts.g>0&&counts.r>0)out.coexist++;
    out.finalGreen+=counts.g;
    out.finalRed+=counts.r;
    out.hunted+=test.stats.deaths.g.hunt;
    out.starved+=test.stats.deaths.g.starve;
   }
   $('batchResult').textContent=`ノーマル・AI①・AI②を同じ10シードで比較中… ${i+1}/10回`;
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  const n=results.normal,a=results.escape,h=results.social;
  const avg=v=>(v/10).toFixed(1);
  $('batchResult').textContent=
   `同じ10シード・各100日（参考値）\n`+
   `緑がDAY100まで存続：ノーマル ${n.greenAlive}/10 ／ AI① ${a.greenAlive}/10 ／ AI② ${h.greenAlive}/10\n`+
   `赤緑の共存：ノーマル ${n.coexist}/10 ／ AI① ${a.coexist}/10 ／ AI② ${h.coexist}/10\n`+
   `緑の最終平均：ノーマル ${avg(n.finalGreen)}匹 ／ AI① ${avg(a.finalGreen)}匹 ／ AI② ${avg(h.finalGreen)}匹\n`+
   `緑の平均捕食死：ノーマル ${avg(n.hunted)}件 ／ AI① ${avg(a.hunted)}件 ／ AI② ${avg(h.hunted)}件\n`+
   `緑の平均餓死：ノーマル ${avg(n.starved)}件 ／ AI① ${avg(a.starved)}件 ／ AI② ${avg(h.starved)}件\n`+
   `※10回は動作確認用の参考値です。群れの形成や逃走能力が世代とともに向上した証拠ではありません。`;
 }catch(error){
  $('batchResult').textContent='比較中に問題が発生しました。設定を確認してください。';
  console.error('Paired survival batch failed',error);
 }finally{
  btn.disabled=false;playing=wasPlaying&&!ended;
 }
};
reset();drawVideo(true);drawFamily(true);drawBatch();requestAnimationFrame(frame);
})();
