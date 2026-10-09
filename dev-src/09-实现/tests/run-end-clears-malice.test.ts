import test from 'node:test';
import assert from 'node:assert/strict';
import {playtestParty} from '../src/game/content';
import {startExpedition,withdraw,type State} from '../src/game/expedition';
import {persistentUnit,type Unit} from '../src/battle/executor';

/** 0.31 §2.1：敌方恶意对玩家的“永久”效果只活在本次迷宫内（run 作用域），迷宫结束（退出/通关/团灭）即清。 */
function fakeUnit():Unit{
 const timed=(clock:'round'|'exploration_time'|'battle_time'|'permanent',remaining:number)=>({clock,remaining});
 const def=(name:string,scope:'battle'|'run')=>({name,tags:['monster:malice'],polarity:'negative',duration:{clock:'permanent',value:0},stack:'refresh',maxStacks:1,scaleWithStacks:false,priority:0,dispellable:true,removeOnDeath:false,scope});
 return {id:'p',side:'ally',level:1,attributes:{力量:1,敏捷:1,体质:1,智力:1,精神:1},max:{hp:10,mp:10,sp:10},current:{hp:10,mp:10,sp:10},
  actions:{'copy:boss:x':{target:'enemy',cost:{hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}},castMs:0,recoveryFactor:1,perBattleUses:0,effects:[]}},
  used:{},mitigation:{armor:{physical:0,energy:0,mental:0},attributeReduction:{physical:0,energy:0,mental:0},elementMultipliers:{}},shields:[],speeds:[],
  statuses:[{id:'s1',definition:def('本场封印','battle'),stacks:1,used:{},last:{},source:'boss',sourceKey:'k1',...timed('permanent',0)},{id:'s2',definition:def('迷宫内失衡','run'),stacks:1,used:{},last:{},source:'boss',sourceKey:'k2',...timed('exploration_time',99999)}],
  sealed:{'skill-a':2,'skill-b':60000},sealClocks:{'skill-a':'round','skill-b':'exploration_time'},
  copied:{'copy:boss:x':{clock:'exploration_time',value:99999,remaining:99999}},
  sourceLocks:{'lease:boss:1':{clock:'round',remaining:2,removed:false,sourceId:'skill-a',owner:'boss'}}} as unknown as Unit;
}

test('persistentUnit 只带走 run 作用域：本场状态、按轮封印、来源租借不出战斗', ()=>{
 const p=persistentUnit(fakeUnit(),0);
 assert.deepEqual(p.statuses!.map(s=>s.definition.name),['迷宫内失衡']);
 assert.deepEqual(Object.keys(p.sealed!),['skill-b']);assert.equal(p.sealClocks!['skill-b'],'exploration_time');
 assert.deepEqual(Object.keys(p.copied!),['copy:boss:x']);assert.ok(p.actions!['copy:boss:x']);
 assert.equal((p as {sourceLocks?:unknown}).sourceLocks,undefined);
});

test('迷宫结束：退出后 party.persistent 被整体清空（封印/偷技/失衡/次数一并消失）', ()=>{
 const s:State=startExpedition(playtestParty(),7);
 for(const m of s.party)m.persistent=persistentUnit(fakeUnit(),0);
 assert.ok(s.party.every(m=>m.persistent&&Object.keys(m.persistent.sealed??{}).length===1));
 withdraw(s);
 assert.equal(s.mode,'ended');
 for(const m of s.party){assert.equal(m.persistent,undefined,m.id+' 仍带着迷宫内效果');assert.deepEqual(m.current,{...m.card.numeric.max});}
});
