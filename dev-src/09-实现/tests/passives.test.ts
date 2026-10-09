import test from 'node:test';import assert from 'node:assert/strict';
import {createCompilationEngine,validateCompiled} from '../src/compiler/engine';
import {type ActionSpec,type EffectSpec,EFFECT_VERSION} from '../src/compiler/contract';
import {createBattle,EXECUTORS,advanceBattle,assertPassive} from '../src/battle/executor';
import {contentCard,bareMitigation,flat,strike,heal} from '../src/game/content';
import {rules,cleanSource,mapping} from './compiler-fixtures';
const passive=(effects:EffectSpec[]):ActionSpec=>({...heal(1),target:'self',castMs:0,cost:{hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}},effects});
function fight(effects:EffectSpec[]){
 const c=contentCard(4,500,10,{'斩击':strike(100)});
 c.skills.push({sourceId:'/装备/甲',name:'甲',sourceFingerprint:'authored',mapping:{sourceId:'/装备/甲',disposition:'passive',reason:'定量装备',action:passive(effects)}});
 const b=createBattle([{id:'ally',side:'ally',card:c,current:{hp:200,mp:30,sp:50},mitigation:bareMitigation()},{id:'enemy',side:'enemy',card:contentCard(4,1000,5,{'打击':strike(100)}),current:{hp:1000,mp:50,sp:50},mitigation:bareMitigation()}],1);return b;
}
test('装备纳入同一次编译，改动只重编译装备，卸装直接移除加成',async()=>{
 const source=cleanSource();source.装备={护甲:{描述:'物理护甲1000'}};let calls=0;const requested:string[][]=[];
 const e=createCompilationEngine(async({prompt})=>{calls++;const req=JSON.parse(prompt.split('\n').at(-1)!).changedSkills;requested.push(req.map((x:any)=>x.sourceId));return {version:EFFECT_VERSION,mappings:req.map((x:any)=>x.sourceId.startsWith('/技能/')?mapping():{sourceId:x.sourceId,disposition:'passive',fidelity:{mode:'exact',summary:'合成护甲夹具',changes:[],clauses:[{original:'物理护甲1000',implementation:'armor physical 1000'}]},reason:'护甲原文',action:passive([{op:'armor',channel:'physical',amount:flat(1000)}])})};},rules);
 const first=await e.compile(source,undefined,[]);assert.equal(validateCompiled(first.actor).skills.length,2);e.validateSource!(first.actor,source);
 source.装备={护甲:{描述:'明确的物理护甲1000'}};const second=await e.compile(source,first.actor,[]);assert.deepEqual(requested[1],['/装备/护甲']);
 source.装备={};const third=await e.compile(source,second.actor,[]);assert.equal(validateCompiled(third.actor).skills.length,1);assert.equal(calls,2);
});
test('常驻护甲、减伤与元素抗性实际降低结算伤害',()=>{
 const b=fight([{op:'armor',channel:'physical',amount:flat(1000)},{op:'reduction',channel:'physical',fraction:.2},{op:'element_resist',element:'火',multiplier:.5}]);
 const damage={...strike(300).effects[0]!,element:'火',hitRule:'guaranteed',critChance:0} as EffectSpec;
 EXECUTORS.damage!(damage,{battle:b,caster:b.units[1]!,target:b.units[0]!,key:'test'});
 assert.equal(b.units[0]!.current.hp,120);assert.ok(Math.abs(b.units[0]!.mitigation.attributeReduction.physical-.2)<1e-8);
});
test('武器与被动增伤相乘，不给不存在的伤害通道凭空追加伤害',()=>{
 const b=fight([{op:'damage_bonus',channel:'physical',flat:10,multiplier:1.25},{op:'damage_bonus',channel:'physical',flat:0,multiplier:1.2},{op:'damage_bonus',channel:'energy',flat:999,multiplier:1}]);
 const d={...strike(100).effects[0]!,hitRule:'guaranteed',critChance:0} as EffectSpec;
 EXECUTORS.damage!(d,{battle:b,caster:b.units[0]!,target:b.units[1]!,key:'test'});assert.equal(b.units[1]!.current.hp,835);
});
test('治疗增幅真实恢复60而非40，且不超过上限',()=>{
 const b=fight([{op:'heal_bonus',multiplier:1.5}]);EXECUTORS.heal!(heal(40).effects[0]!,{battle:b,caster:b.units[0]!,target:b.units[0]!,key:'test'});assert.equal(b.units[0]!.current.hp,260);
 EXECUTORS.heal!(heal(1000).effects[0]!,{battle:b,caster:b.units[0]!,target:b.units[0]!,key:'test'});assert.equal(b.units[0]!.current.hp,500);
});
test('常驻加速开场即生效，开场盾不在时钟推进或存档恢复时重复生成',()=>{
 let b=fight([{op:'speed',name:'步法',multiplier:1.25,chance:1,duration:{clock:'permanent',value:0},stack:'refresh'},{op:'shield',amount:flat(30),channels:['physical','energy'],duration:{clock:'permanent',value:0}}]);
 assert.equal(b.clock.units[0]!.haste,1.25);b.units[0]!.shields[0]!.amount=7;b=advanceBattle(JSON.parse(JSON.stringify(b)),100).battle;assert.equal(b.units[0]!.shields[0]!.amount,7);assert.equal(b.clock.units[0]!.haste,1.25);assert.equal(Object.keys(b.units[0]!.actions).filter(k=>!k.startsWith('booksea:')).length,1);
});
test('装备不反向修改宿主数值卡和基础减免对象',()=>{
 const card=contentCard(4,100,8,{}),before=structuredClone(card),mitigation=bareMitigation();card.skills.push({sourceId:'armor',name:'甲',sourceFingerprint:'authored',mapping:{sourceId:'armor',disposition:'passive',reason:'测试',action:passive([{op:'armor',channel:'physical',amount:flat(500)}])}});
 const saved=structuredClone(card);createBattle([{id:'one',side:'ally',card,current:{...card.numeric.max},mitigation},{id:'two',side:'enemy',card:before,current:{...before.numeric.max},mitigation}],2);assert.deepEqual(card,saved);assert.equal(mitigation.armor.physical,0);
});
test('常驻不是自动免费施放主动伤害，装备主动动作仍由正常行动提交',()=>{
 assert.throws(()=>assertPassive(passive(strike(50).effects)),/常驻被动/);const b=fight([{op:'armor',channel:'physical',amount:flat(100)}]);assert.equal(b.units[1]!.current.hp,1000);assert.deepEqual(Object.keys(b.units[0]!.actions).filter(k=>!k.startsWith('booksea:')),['斩击']);
});
