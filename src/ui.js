/* Ecosystem Lab UI: visuals do not influence the deterministic simulation. */
(() => {
'use strict';
const $=id=>document.getElementById(id), {Lab,SPECIES,W,H,GRID_X,GRID_Y,CELL}=window.EcosystemCore;
const cv=$('world'),c=cv.getContext('2d'),pop=$('chart'),popCtx=pop.getContext('2d'),pred=$('predChart'),predCtx=pred.getContext('2d');
const CHECKPOINT_DAY=100;
let lab,playing=true,ended=false,checkpointPassed=false,speed=5,focus=null,zoom=1,cam={x:W/2,y:H/2},time=0,accum=0,lastUI=0,chartAt=0,activeTab='normal';
const worlds={normal:null,ai1:null};
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
function options(){return {seed:Number($('seed').value)||1,green:Number($('startg').value),red:Number($('startr').value),blue:0,variance:Number($('variance').value),regrowth:Number($('regrowth').value),duration:Infinity,mode:activeTab==='ai1'?'escape':'normal'}}
function reset(){lab=new Lab(options());playing=true;ended=false;checkpointPassed=false;accum=0;focus=null;zoom=1;cam={x:W/2,y:H/2};show();draw();drawCharts()}
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
function drawCharts(){chartDraw(pop,popCtx,['g','r']);chartDraw(pred,predCtx,['r'])}
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
 if(activeTab!=='ai2'){draw();if(t-chartAt>180){drawCharts();chartAt=t}if(t-lastUI>160){show();lastUI=t}}requestAnimationFrame(frame)
}
function exportCSV(){
 const keys=['day','g','r','b','grass','birthg','birthr','birthb','killsr','killsb','huntsr','huntsb','starveg','starver','starveb','ager','ageb','counters','daysr','daysb','edger','edgeb','starvegrassg','aiMeanGeneration','aiEscapeBias','aiOffspring','aiMutated','aiFleeDays'];
 const rows=[keys.join(','),...lab.history.map(d=>keys.map(k=>d[k]).join(','))];
 const blob=new Blob(['\ufeff'+rows.join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`ecosystem_${lab.settings.mode}_seed_${lab.settings.seed}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
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
 if(activeTab!=='ai2')snapshotWorld();
 activeTab=next;
 for(const [key,view,button] of [['normal','view-normal','tabButtonNormal'],['ai1','view-ai1','tabButtonAi1'],['ai2','view-ai2','tabButtonAi2']]){
   $(view).hidden=key!==next;$(button).setAttribute('aria-selected',String(key===next));
 }
 $('view-live').hidden=next==='ai2';
 if(next==='ai2'){
   playing=false;
   $('stateText').textContent='AI②は設計中';
   $('dot').style.background='#8baaa4';
   return;
 }
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
$('openReport').onclick=()=>{
 if(activeTab==='ai2')return;
 playing=false;accum=0;show();
 window.EcosystemReport.render(lab);
};
$('closeReport').onclick=()=>window.EcosystemReport.close();
$('reportReturn').onclick=()=>window.EcosystemReport.close();
$('reportSavePng').onclick=()=>window.EcosystemReport.exportPNG();
$('unselect').onclick=()=>{focus=null;zoom=1};$('zin').onclick=()=>{zoom=Math.min(4,zoom*1.45)};$('zout').onclick=()=>{zoom=Math.max(1,zoom/1.45)};$('zreset').onclick=()=>{focus=null;zoom=1};
$('variance').oninput=()=>{$('varText').textContent='±'+$('variance').value+'%'};$('regrowth').oninput=()=>{$('regText').textContent=$('regrowth').value+'%'};
document.querySelectorAll('#speeds button').forEach(btn=>btn.onclick=()=>{speed=Number(btn.dataset.s);document.querySelectorAll('#speeds button').forEach(b=>b.classList.toggle('active',b===btn))});
cv.addEventListener('pointerdown',e=>{const r=cv.getBoundingClientRect(),sx=(e.clientX-r.left)/r.width*W,sy=(e.clientY-r.top)/r.height*H,x=(sx-W/2)/zoom+cam.x,y=(sy-H/2)/zoom+cam.y;let best=null,bestD=25/zoom;
for(const a of lab.entities){const d=Math.hypot(a.x-x,a.y-y);if(d<bestD){bestD=d;best=a}}if(best){focus=best.id;zoom=Math.max(zoom,1.7);cam.x=best.x;cam.y=best.y}else{focus=null;if(zoom>1){cam.x=x;cam.y=y}}show()});
$('batch').onclick=async()=>{
 if($('batch').disabled)return;
 const btn=$('batch'),wasPlaying=playing;playing=false;btn.disabled=true;$('batchResult').textContent='10回の再実験を計算中…';let count={both:0,greenOnly:0,redOnly:0,none:0};let sg=0,sr=0;
 const pref=options();for(let i=0;i<10;i++){
  const tmp=new Lab({...pref,seed:pref.seed+i});tmp.run(100,.08);const n=tmp.counts();sg+=n.g;sr+=n.r;
  if(n.g&&n.r)count.both++;else if(n.g)count.greenOnly++;else if(n.r)count.redOnly++;else count.none++;
  $('batchResult').textContent=`${i+1}/10 完了`;await new Promise(resolve=>setTimeout(resolve,0));
 }
 $('batchResult').textContent=`10回検証｜緑赤共存 ${count.both}回・緑のみ ${count.greenOnly}回・赤のみ ${count.redOnly}回・両種絶滅 ${count.none}回｜平均最終数 緑${Math.round(sg/10)} 赤${(sr/10).toFixed(1)}`;
 btn.disabled=false;playing=wasPlaying&&!ended;
};
reset();requestAnimationFrame(frame);
})();
