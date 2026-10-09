/** Synthetic compiler/executor fixtures only; never release defaults. */
import type {ActionSpec,AmountSpec,MappingSpec} from '../src/compiler/contract';
import {fixture,player} from './fixtures';import {actorAt,type Obj} from '../src/core/actors';
import {combatProjection,canonical} from '../src/core/cache';
import {COMPILER_ID,type CompiledActor,type Rules} from '../src/compiler/engine';
import {EFFECT_VERSION} from '../src/compiler/contract';
export const rules:Rules={numericOnlySpecies:{'联调无特性测试体':'这是明确无种族固有能力的合成测试对象。'}};
export const zero=():AmountSpec=>({flat:0,attribute:'none',factor:0,scale:'flat',maxResource:'none',maxFraction:0});
export const flat=(n:number):AmountSpec=>({...zero(),flat:n});
export function damageAction(amount=40):ActionSpec{return {target:'enemy',cost:{hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:10,maxFraction:0}},castMs:0,recoveryFactor:1,perBattleUses:0,effects:[{op:'damage',amounts:{physical:flat(amount),energy:zero(),mental:zero(),true:zero()},element:'none',types:['物'],hitChance:1,hitRule:'guaranteed',critChance:0,critMultiplier:1}]};}
export function cleanSource():Obj {const a=actorAt(fixture(),player);a.种族='联调无特性测试体';a.状态效果={};a.装备={};a.背包={};a.登神长阶={是否开启:false};a.技能={定量打击:{品质:'普通',类型:'主动',消耗:'10SP',标签:[],效果:{伤害:'对单个敌人造成40物理伤害，必中，不暴击'},描述:'技术夹具'}};return combatProjection(a);}
export const mapping=(action=damageAction()):MappingSpec=>({sourceId:'/技能/定量打击',disposition:'active',fidelity:{mode:'exact',summary:'合成夹具按原文数值映射',changes:[],clauses:[{original:'对单个敌人造成40物理伤害，必中，不暴击',implementation:'damage与cost.sp'}]},reason:'仅按测试原文映射固定伤害与SP消耗',action});
export function card(action=damageAction(),id='/技能/定量打击'):CompiledActor{return {version:COMPILER_ID,effectVersion:EFFECT_VERSION,sourceFingerprint:canonical(cleanSource()),rulesFingerprint:canonical(rules),numeric:{level:1,attributes:{力量:10,敏捷:10,体质:10,智力:10,精神:10},max:{hp:100,mp:80,sp:100}},skills:[{sourceId:id,name:id.slice('/技能/'.length),sourceFingerprint:'{}',mapping:{...mapping(action),sourceId:id}}]};}
export const mitigation=()=>({armor:{physical:0,energy:0,mental:0},attributeReduction:{physical:0,energy:0,mental:0},elementMultipliers:{}});
