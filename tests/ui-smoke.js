'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const EcosystemCore=require('../src/sim-core.js');
const noop=()=>{};
const context2d=new Proxy({}, {get:(target,key)=>target[key]??noop,set:(target,key,val)=>(target[key]=val,true)});
const values={seed:20261117,startg:100,startr:10,startb:10,variance:10,regrowth:100};
const elements=new Map();
function element(id){
 if(!elements.has(id))elements.set(id,{id,value:values[id]??0,textContent:'',style:{},disabled:false,onclick:null,oninput:null,addEventListener:noop,click:noop,getBoundingClientRect:()=>({left:0,top:0,width:960,height:600}),getContext:()=>context2d});
 return elements.get(id);
}
const speedButtons=[1,5,20].map(v=>({dataset:{s:String(v)},classList:{toggle:noop},onclick:null}));
const dom={getElementById:element,querySelectorAll:()=>speedButtons,createElement:()=>({click:noop})};
let requested=0;
const appContext={document:dom,window:{EcosystemCore},requestAnimationFrame:()=>{requested++},setTimeout:noop,URL:{createObjectURL:()=>'',revokeObjectURL:noop},Blob:class{},console,Math,Number};
vm.createContext(appContext);
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../src/ui.js'),'utf8'),appContext);
assert.equal(element('ng').textContent,100);assert.equal(element('nr').textContent,10);assert.equal(element('nb').textContent,10);assert.ok(requested>0);
element('single').onclick();assert.ok(element('day').textContent.includes('1.0'));
element('reset').onclick();assert.ok(element('day').textContent.includes('0.0'));
element('newseed').onclick();assert.equal(Number(element('seed').value),20261118);
console.log('✓ UI操作の基本テストに成功');
