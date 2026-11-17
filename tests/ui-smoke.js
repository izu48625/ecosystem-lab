'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const EcosystemCore=require('../src/sim-core.js');
const noop=()=>{};
const context2d=new Proxy({}, {get:(target,key)=>target[key]??noop,set:(target,key,val)=>(target[key]=val,true)});
const values={seed:20261117,startg:100,startr:20,startb:0,variance:10,regrowth:100};
const elements=new Map();
function element(id){
 if(!elements.has(id))elements.set(id,{id,value:values[id]??0,textContent:'',style:{},hidden:false,attributes:{},setAttribute(n,v){this.attributes[n]=v},disabled:false,onclick:null,oninput:null,addEventListener:noop,click:noop,getBoundingClientRect:()=>({left:0,top:0,width:960,height:600}),getContext:()=>context2d});
 return elements.get(id);
}
const speedButtons=[1,5,20].map(v=>({dataset:{s:String(v)},classList:{toggle:noop},onclick:null}));
let pngDownloads=0;
const dom={
 getElementById:element,querySelectorAll:()=>speedButtons,
 body:{appendChild:noop},
 createElement:tag=>tag==='canvas'?
   {width:0,height:0,getContext:()=>context2d,toBlob:cb=>cb({type:'image/png'})}:
   {click:()=>{pngDownloads++},remove:noop}
};
let requested=0,nextFrame=null;
const appContext={document:dom,window:{EcosystemCore},requestAnimationFrame:fn=>{requested++;nextFrame=fn},setTimeout:noop,URL:{createObjectURL:()=>'',revokeObjectURL:noop},Blob:class{},console,Math,Number};
vm.createContext(appContext);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../src/report.js'),'utf8'),appContext);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../src/ui.js'),'utf8'),appContext);
assert.equal(element('ng').textContent,100);assert.equal(element('nr').textContent,20);assert.equal(element('nb').textContent,0);assert.ok(requested>0);
element('tabButtonAi1').onclick();
assert.equal(element('view-normal').hidden,true);
assert.equal(element('view-ai1').hidden,false);
assert.equal(element('view-live').hidden,false);
assert.equal(element('view-ai2').hidden,true);
assert.ok(element('toggle').textContent.includes('▶'),'AI① should start paused');
assert.equal(element('ng').textContent,100);
assert.equal(element('nr').textContent,20);
assert.equal(Number(element('aiHighestGeneration').textContent),0);
element('openReport').onclick();
assert.equal(element('reportOverlay').hidden,false,'AI results open in a single-screen overlay');
assert.ok(element('reportHeading').textContent.includes('逃走進化'));
assert.equal(element('rrGreen').textContent,'100');
assert.ok(element('reportGenetics').textContent.includes('8%'));
assert.ok(element('reportRule').textContent.includes('赤の捕食・繁殖'));
element('closeReport').onclick();
assert.equal(element('reportOverlay').hidden,true,'Result overlay closes without losing experiment state');
element('jump100').onclick();
assert.ok(element('day').textContent.includes('DAY 100.0'),'AI① reaches its own DAY100');
assert.ok(Number(element('aiOffspring').textContent)>0,'AI① generations should reproduce');
assert.ok(Number(element('aiMutations').textContent)>0,'AI① mutations should occur');
assert.ok(Number(element('aiHighestGeneration').textContent)>0,'AI① generation number should increase');
element('openReport').onclick();
assert.equal(element('reportOverlay').hidden,false);
assert.equal(element('rrGreen').textContent,String(element('ng').textContent),'Report matches live population');
assert.equal(element('rrRed').textContent,String(element('nr').textContent));
assert.ok(Number(element('rrMutation').textContent.replaceAll(',',''))>0,'Mutated offspring shown');
assert.ok(Number(element('rrMaxGen').textContent)>0,'Reached generation shown even after extinction');
assert.ok(Number(element('rrPeakGen').textContent)>=0,'Historical peak generation shown');
assert.ok(element('reportMeta').textContent.includes('DAY 100.0'));
element('reportSavePng').onclick();
assert.ok(pngDownloads>0,'Screenshot report can be exported as a single PNG');
element('reportReturn').onclick();
assert.equal(element('reportOverlay').hidden,true);
assert.ok(element('day').textContent.includes('DAY 100.0'),'Opening report does not reset AI simulation');
assert.equal(element('tabButtonAi1').attributes['aria-selected'],'true');
element('tabButtonAi2').onclick();
assert.equal(element('view-ai1').hidden,true);assert.equal(element('view-ai2').hidden,false);
assert.equal(element('view-live').hidden,true,'AI② should not run an unfinished simulation');
element('tabButtonAi1').onclick();
assert.ok(element('day').textContent.includes('DAY 100.0'),'Switching tabs restores independent AI world');
element('toggle').onclick();
element('single').onclick();
assert.ok(element('day').textContent.includes('DAY 101.0'),'AI① should resume beyond checkpoint');
element('tabButtonNormal').onclick();
assert.equal(element('view-normal').hidden,false);
assert.equal(element('view-live').hidden,false);
assert.ok(element('day').textContent.includes('DAY 0.0'),'Normal world should not advance while AI① is running');
element('openReport').onclick();
assert.ok(element('reportHeading').textContent.includes('ノーマル'));
assert.equal(element('rrMaxGen').textContent,'—','No fake AI data on normal');
assert.ok(element('reportInputs').textContent.includes('学習なし'));
element('closeReport').onclick();
element('preset10').onclick();assert.equal(element('nr').textContent,10);
element('preset30').onclick();assert.equal(element('nr').textContent,30);
element('preset20').onclick();assert.equal(element('nr').textContent,20);
element('single').onclick();assert.ok(element('day').textContent.includes('1.0'));
element('reset').onclick();assert.ok(element('day').textContent.includes('0.0'));
element('newseed').onclick();assert.equal(Number(element('seed').value),20261118);
element('jump100').onclick();
assert.ok(element('day').textContent.includes('DAY 100.0'),'100日目に到達する');
assert.ok(element('toggle').textContent.includes('▶ 100日以降を再生'),'100日到達時に再開ボタンを表示');
element('single').onclick();
assert.ok(element('day').textContent.includes('DAY 101.0'),'101日目に進める');
element('jump10').onclick();
assert.ok(element('day').textContent.includes('DAY 111.0'),'110日より先へ進める');
element('jump100').onclick();
assert.ok(element('day').textContent.includes('DAY 211.0'),'200日以降も操作可能');
assert.ok(element('stateText').textContent!=='100日間の実験終了');
console.log('✓ DAY100以降の+1日・+10日・+100日とUI表示を確認');

// Automatic time progression also stops at exactly 100, then resumes once for good.
element('reset').onclick();
speedButtons[2].onclick(); // 20× acceleration for the simulated animation frames
let timestamp=1000,frames=0;
while(frames<250&&!element('toggle').textContent.includes('▶ 100日以降を再生')){
  assert.equal(typeof nextFrame,'function','animation callback should exist');
  nextFrame(timestamp);timestamp+=200;frames++;
}
assert.ok(frames<250,'autoplay must reach the automatic DAY100 checkpoint');
assert.equal(element('day').textContent.includes('DAY 100.0'),true,'autoplay stops at DAY100, not after it');
assert.ok(element('stateText').textContent.includes('DAY100'),'state explains the checkpoint');
for(let i=0;i<4;i++){nextFrame(timestamp);timestamp+=200}
assert.ok(element('day').textContent.includes('DAY 100.0'),'no extra time elapses until ▶ is pressed');
element('toggle').onclick();
assert.ok(element('toggle').textContent.includes('⏸'),'▶ should resume continuous playback');
nextFrame(timestamp);timestamp+=200;
assert.ok(!element('day').textContent.includes('DAY 100.0'),'the next frame should advance beyond DAY100');
for(let i=0;i<80;i++){nextFrame(timestamp);timestamp+=200}
assert.ok(Number(element('day').textContent.match(/DAY ([0-9.]+)/)[1])>200,'playback should go beyond DAY200');
assert.ok(element('toggle').textContent.includes('⏸'),'there must be no later automatic stop');
console.log('✓ DAY100で1回だけ自動停止し、▶の後はDAY200以降も連続再生する');
console.log('✓ UI操作の基本テストに成功');
