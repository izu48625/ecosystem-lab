/* ECOSYSTEM LAB - single animal family and birth inheritance video card */
(function(root){
'use strict';
const fmt=(v,d=1)=>v===null||v===undefined||!Number.isFinite(v)?'—':Number(v).toFixed(d);
function paint(canvas,detail,lab){
 const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
 ctx.fillStyle='#091d20';ctx.fillRect(0,0,w,h);
 ctx.fillStyle='#a4e4ba';ctx.font='bold 26px system-ui';ctx.textAlign='left';
 ctx.fillText('ECOSYSTEM LAB / ANIMAL FAMILY RECORD',65,83);
 if(!detail){
  ctx.fillStyle='#eefcf2';ctx.font='bold 44px system-ui';ctx.fillText('個体・系統の追跡',65,170);
  ctx.fillStyle='#bdd9c8';ctx.font='26px system-ui';
  ctx.fillText('緑をタップして選択するか、個体番号を入力してください。',65,255);
  return {error:'no selection'};
 }
 const r=detail.person,traits=r.traits;
 ctx.fillStyle='#e6fff4';ctx.font='bold 53px system-ui';
 ctx.fillText('緑 #'+r.id+' ｜ '+r.generation+'世代',65,156);
 ctx.fillStyle='#a8c9b9';ctx.font='23px system-ui';
 ctx.fillText('Seed '+lab.settings.seed+' / DAY '+lab.day.toFixed(1)+' / '+(r.alive?'生存中':'死亡：'+r.death+'　DAY '+fmt(r.deathDay))+
  ' / 初代の系統 #'+r.rootId,65,208);
 const cards=[
  ['採食したエネルギー',fmt(r.foodEnergy,1)],
  ['生存期間（日）',fmt(r.lifeDays,1)],
  ['直接産んだ子',String(r.children.length)],
  ['生存中の直系子孫',String(detail.descendantsAlive)],
  ['赤の攻撃を受けた回数',String(r.hitCount)],
  ['群れ参加時間',r.lifeDays?fmt(100*r.groupDays/r.lifeDays,1)+'%':'—']
 ];
 const cW=470;
 cards.forEach(([name,value],i)=>{
  const x=65+(i%3)*493,y=250+Math.floor(i/3)*125;
  ctx.fillStyle='#153631';ctx.fillRect(x,y,cW,106);
  ctx.fillStyle='#a7caba';ctx.font='20px system-ui';ctx.fillText(name,x+18,y+35);
  ctx.fillStyle='#e8fff3';ctx.font='bold 37px system-ui';ctx.fillText(value,x+18,y+82);
 });
 ctx.fillStyle='#e8fff3';ctx.font='bold 31px system-ui';ctx.fillText('遺伝的な行動傾向（共通NN入力）',66,540);
 const keys=[['gather','集合','#79e7aa'],['align','方向同調','#82aff6'],['separate','密集回避','#efbc7d']];
 keys.forEach(([key,label,color],i)=>{
  const x=68+i*493,y=577;
  ctx.fillStyle='#b5d3c5';ctx.font='24px system-ui';ctx.fillText(label,x,y);
  const val=traits?.[key];
  ctx.fillStyle='#173b34';ctx.fillRect(x,y+26,375,20);
  if(Number.isFinite(val)){
   ctx.fillStyle=color;ctx.fillRect(x,y+26,Math.max(0,Math.min(375,375*val/2.5)),20);
  }
  ctx.fillStyle=color;ctx.font='bold 28px system-ui';
  ctx.fillText(fmt(val,3)+(r.geneticDelta?'  (親との差 '+(r.geneticDelta[key]>=0?'+':'')+fmt(r.geneticDelta[key],3)+')':''),x,y+85);
 });
 ctx.fillStyle='#e8fff3';ctx.font='bold 30px system-ui';ctx.fillText('親子の系統',68,739);
 const a=detail.ancestors.slice(-6);
 const gap=Math.min(260,1460/Math.max(1,a.length));let x=70;
 a.forEach((p,i)=>{
  const last=i===a.length-1;
  ctx.fillStyle=last?'#285b49':'#173b34';ctx.fillRect(x,763,gap-14,76);
  ctx.fillStyle=last?'#a7ffcd':'#d2e7db';ctx.font='bold 24px system-ui';ctx.fillText('#'+p.id,x+11,790);
  ctx.font='17px system-ui';ctx.fillText('第'+p.generation+'世代',x+11,819);
  x+=gap;
 });
 ctx.font='18px system-ui';ctx.fillStyle='#8eb8a7';
 ctx.fillText('親子のつながりは母系の継承経路。生存・採食量・群れ参加は観測値で、進化の因果効果を証明するものではありません。',65,876);
 return {person:r,detail};
}
function csv(detail){
 if(!detail)throw Error('No animal selected');
 const r=detail.person;
 const head=['id','parentId','rootId','generation','bornDay','deathDay','deathReason','alive','lifeDays','foodEnergy',
  'children','descendantsBorn','descendantsAlive','redHits','groupPct','crowdPct','gather','align','separate',
  'deltaGather','deltaAlign','deltaSeparate'];
 const row=[r.id,r.parentId??'',r.rootId,r.generation,r.bornDay,r.deathDay??'',r.death??'',Number(r.alive),
  r.lifeDays,r.foodEnergy,r.children.length,detail.descendantsTotal,detail.descendantsAlive,r.hitCount,
  r.lifeDays?100*r.groupDays/r.lifeDays:0,r.lifeDays?100*r.crowdDays/r.lifeDays:0,
  r.traits?.gather??'',r.traits?.align??'',r.traits?.separate??'',
  r.geneticDelta?.gather??'',r.geneticDelta?.align??'',r.geneticDelta?.separate??''];
 const lines=[head.join(','),row.join(','),'','day,energy,food,children',
  ...r.checkpoints.map(p=>[p.day,p.energy,p.food,p.children].join(',')),
  '','ancestorId,generation,bornDay,deathDay',
  ...detail.ancestors.map(p=>[p.id,p.generation,p.bornDay,p.deathDay??''].join(','))];
 return '\ufeff'+lines.join('\r\n');
}
root.EcosystemLineage={paint,csv};
})(window);