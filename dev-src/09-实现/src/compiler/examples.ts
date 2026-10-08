import type {ActionSpec} from './contract';
const base={target:'self' as const,cost:{hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}},castMs:0,recoveryFactor:1,perBattleUses:0};
/** Contract examples only; control immunity competes by issuer level/speed/random, never a magic numeric priority. The compiler may not grant these to unrelated source text. */
export const DELAYED_RETURN:ActionSpec={...base,effects:[
 {op:'time',mode:'delay',key:'return',action:'return_now',duration:{clock:'target_ready',value:2},restore:[],conditions:[{kind:'phase',key:'battle'}]},
 {op:'retreat',conditions:[{kind:'phase',key:'exploration'}]},
],library:{actions:{return_now:{...base,effects:[{op:'retreat'}]}},statuses:{},summons:{},fields:{}}};
/** 间章:小憩（0.37.6 固定编译）：战斗中发动后，在使用回合的下下回合开始时，同阵营所有存活成员必定撤离；
 *  由执行器按公开回合结算（见 executor advanceRound），不走延迟任务，不会被打断、封印、驱散或未命中。战斗外立即离开。 */
export const INTERLUDE_TAG='booksea:interlude';
export const INTERLUDE_REST:ActionSpec={...base,tags:[INTERLUDE_TAG],targeting:{side:'self',selection:'all',count:1,life:'alive'},effects:[{op:'retreat',conditions:[{kind:'phase',key:'exploration'}]}]};
/** 故事的主人：迷宫创造者九十九夜梦赋予的唯一被动，精神属性伤害归零（抗性0）并免疫失格类控制。普通来源不得套用。 */
export const STORY_MASTER:ActionSpec={...base,activation:'always',effects:[...['fear','charm','confusion','taunt'].map(key=>({op:'rule' as const,rule:'immune_status' as const,key,duration:{clock:'permanent' as const,value:0},priority:0})),{op:'element_resist' as const,element:'精',multiplier:0}]};
export const CONTROL_GUARD:ActionSpec={...base,activation:'always',effects:['fear','charm','confusion','taunt'].map(key=>({op:'rule',rule:'immune_status',key,duration:{clock:'permanent',value:0},priority:0}))};
