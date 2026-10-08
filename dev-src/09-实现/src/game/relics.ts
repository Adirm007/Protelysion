import type {ActionSpec,EffectSpec} from '../compiler/contract';
import {flat,type ThemeId} from './content';
export type Relic={name:string;description:string;effects:EffectSpec[];mpCost?:number;victory?:{hp:number;mp:number}};
export const RELICS:Record<string,Relic>={
 sword_echo:{name:'回声剑穗',description:'物理伤害×1.30',effects:[{op:'damage_bonus',channel:'physical',flat:0,multiplier:1.3}]},
 meridian:{name:'温玉丹心',description:'治疗×1.35；能量伤害×0.90',effects:[{op:'heal_bonus',multiplier:1.35},{op:'damage_bonus',channel:'energy',flat:0,multiplier:.9}]},
 suture:{name:'缝隙修补针',description:'胜利后存活在队者恢复30HP、12MP',effects:[],victory:{hp:30,mp:12}},
 gyro:{name:'失重陀螺',description:'行动速度×1.20',effects:[{op:'speed',name:'失重陀螺',multiplier:1.2,chance:1,duration:{clock:'permanent',value:0},stack:'refresh'}]},
 overload:{name:'超载电容',description:'能量伤害×1.50；固定MP费用×1.25',effects:[{op:'damage_bonus',channel:'energy',flat:0,multiplier:1.5}],mpCost:1.25},
 frost_lantern:{name:'不熄霜灯',description:'冰属性承伤×0.50；每战护盾28',effects:[{op:'element_resist',element:'冰',multiplier:.5},{op:'shield',amount:flat(28),channels:['physical','energy'],duration:{clock:'permanent',value:0}}]},
 oath:{name:'守夜誓片',description:'每战护盾45；物理伤害减免10%',effects:[{op:'shield',amount:flat(45),channels:['physical','energy'],duration:{clock:'permanent',value:0}},{op:'reduction',channel:'physical',fraction:.1}]}
};
export const passiveAction=(effects:EffectSpec[]):ActionSpec=>({target:'self',cost:{hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}},castMs:0,recoveryFactor:1,perBattleUses:0,effects});
type Choice={label:string;relic?:string;restore?:'hp'|'mp'|'sp';fp?:number;hpCost?:number};
export type ExpeditionEvent={title:string;body:string;choices:Choice[]};
const r=(id:string):Choice=>({label:`取走「${RELICS[id]!.name}」：${RELICS[id]!.description}`,relic:id});
const heal=(resource:'hp'|'mp'|'sp'):Choice=>({label:`休整：在队成员${{hp:'生命',mp:'法力',sp:'体力'}[resource]}恢复至上限`,restore:resource});
const offer=(fp:number,hpCost:number):Choice=>({label:`血契：损失当前HP的${hpCost*100}%，换${fp}FP券`,fp,hpCost});
export const EVENTS:Partial<Record<ThemeId,ExpeditionEvent[]>>={
 T02:[
 {title:'断桥悬铃',body:'剑穗缠在断桥上。取下它，\n每次出剑都将留下第二道回声。',choices:[r('sword_echo'),heal('sp'),offer(3,.2)]},
 {title:'空丹炉',body:'炉中只有一颗温玉。\n它能放大治疗，却让攻击术式变钝。',choices:[r('meridian'),heal('hp'),offer(3,.25)]},
 {title:'倒悬遗训',body:'银针悬在倒流的丹液上。\n每次胜利，它都会缝合身上的裂痕。',choices:[r('suture'),heal('mp'),offer(5,.3)]}],
 T05:[
 {title:'失重储藏柜',body:'舱柜中漂着一枚不停旋转的陀螺。\n你可以取走它，或接通补给接口。',choices:[r('gyro'),heal('mp'),offer(3,.2)]},
 {title:'超载协议',body:'电容仍在发热。攻击术式将更猛烈，\n代价是每次消耗更多法力。',choices:[r('overload'),heal('mp'),offer(5,.3)]},
 {title:'最后的维修指令',body:'维护终端只剩最后一条协议：\n把仍然活着的人修补完整。',choices:[r('suture'),heal('hp'),offer(5,.25)]}],
 T12:[
 {title:'雪中的灯',body:'风雪无法熄灭这盏灯。\n它替持灯人承受冰寒，并张开护盾。',choices:[r('frost_lantern'),heal('hp'),heal('mp')]},
 {title:'守夜誓言',body:'誓片上没有写名字。\n只要取走，守夜者的职责便属于你。',choices:[r('oath'),heal('sp'),offer(5,.25)]},
 {title:'终钟之前',body:'冰封的钟摆即将落下。\n选择你要带进最后一战的力量。',choices:[r('meridian'),heal('hp'),offer(7,.35)]}]
};
export const eventFor=(theme:ThemeId,depth:number)=>EVENTS[theme]?.[(depth-1)%3];
