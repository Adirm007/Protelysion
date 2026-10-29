import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,advanceBattle,chooseAction,applyBattleEffects,rebaseUnitNumeric} from '../src/battle/executor';
import {hostMitigation} from '../src/game/content';
import {card,damageAction,mitigation} from './compiler-fixtures';

test('宿主数值同步重算现有效果，保留施法支付、次数、长期状态和时钟进度',()=>{
 const action=damageAction();action.castMs=1000;action.perBattleUses=2;
 let b=createBattle([{id:'a',side:'ally',card:card(action),current:{hp:90,mp:70,sp:90},mitigation:mitigation()},{id:'e',side:'enemy',card:card(),current:{hp:100,mp:80,sp:100},mitigation:mitigation()}],123);
 const buff=damageAction();buff.target='self';buff.effects=[{op:'modify',name:'长期护佑',duration:{clock:'exploration_time',value:60000},modifiers:[{stat:'max_hp',multiplier:1.5},{stat:'力量',flat:2}]}];
 b=applyBattleEffects(b,'a',buff,['a']);b=advanceBattle(b,100000).battle;b=chooseAction(b,'a','/技能/定量打击','e');
 const before=structuredClone(b),numeric={level:6,attributes:{力量:20,敏捷:30,体质:20,智力:20,精神:20},max:{hp:200,mp:140,sp:130}},current={hp:180,mp:120,sp:110};
 const u=rebaseUnitNumeric(b,'a',numeric,hostMitigation({...card(),numeric}),current);
 assert.equal(u.level,6);assert.deepEqual(u.base!.max,numeric.max);assert.equal(u.max.hp,300);assert.equal(u.attributes.力量,22);assert.deepEqual(u.current,current);
 assert.ok(Math.abs(u.base!.mitigation.attributeReduction.physical-.175)<1e-12);assert.deepEqual(u.statuses,before.units[0]!.statuses);assert.deepEqual(u.used,before.units[0]!.used);assert.deepEqual(u.actions,before.units[0]!.actions);assert.deepEqual(b.commands,before.commands);assert.deepEqual(b.log,before.log);assert.equal(b.seed,before.seed);
 assert.equal(b.clock.timeMs,before.clock.timeMs);assert.deepEqual(b.clock.pending,before.clock.pending);
 const cu=b.clock.units[0]!,old=before.clock.units[0]!;assert.equal(cu.agility,30);for(const key of ['atb','cast','recoveryMs','actionsCompleted','active'] as const)assert.deepEqual(cu[key],old[key]);
});

test('宿主数值同步拒绝非法字段时不部分覆盖旧战场',()=>{
 const b=createBattle([{id:'a',side:'ally',card:card(),current:{hp:90,mp:70,sp:90},mitigation:mitigation()},{id:'e',side:'enemy',card:card(),current:{hp:100,mp:80,sp:100},mitigation:mitigation()}],123),before=structuredClone(b),numeric=structuredClone(card().numeric);
 numeric.max.mp=NaN;assert.throws(()=>rebaseUnitNumeric(b,'a',numeric,mitigation(),{hp:180,mp:120,sp:110}),/有限数值/);assert.deepEqual(b,before);
});
