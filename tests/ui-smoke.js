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
const dom={getElementById:element,querySelectorAll:()=>speedButtons,createElement:()=>({click:noop})};
let requested=0,nextFrame=null;
const appContext={document:dom,window:{EcosystemCore},requestAnimationFrame:fn=>{requested++;nextFrame=fn},setTimeout:noop,URL:{createObjectURL:()=>'',revokeObjectURL:noop},Blob:class{},console,Math,Number};
vm.createContext(appContext);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../src/ui.js'),'utf8'),appContext);
assert.equal(element('ng').textContent,100);assert.equal(element('nr').textContent,20);assert.equal(element('nb').textContent,0);assert.ok(requested>0);
element('tabButtonAi1').onclick();
assert.equal(element('view-normal').hidden,true);
assert.equal(element('view-ai1').hidden,false);
assert.equal(element('view-ai2').hidden,true);
assert.equal(element('tabButtonAi1').attributes['aria-selected'],'true');
element('tabButtonAi2').onclick();
assert.equal(element('view-ai1').hidden,true);assert.equal(element('view-ai2').hidden,false);
element('tabButtonNormal').onclick();
assert.equal(element('view-normal').hidden,false);
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
