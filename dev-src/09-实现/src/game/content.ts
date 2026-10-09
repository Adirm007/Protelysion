import {DAMAGE_TYPES} from '../battle/elements';
import {MONSTER_ROSTER,MONSTER_THEMES,MONSTER_THEME_BY_ID,MONSTER_BY_ID,type ThemeId} from './monsters/catalog';
import {monsterKit} from './monsters/kits';
import {MIMIC_ID,mimicKit} from './monsters/mimic';
import {STRAY_ID,STRAY_NAME,strayKit} from './monsters/stray';
import {monsterNumbers} from './monsters/numbers';
import type {ActionSpec,AmountSpec} from '../compiler/contract';
import {EFFECT_VERSION} from '../compiler/contract';
import {COMPILER_ID,type CompiledActor} from '../compiler/engine';
import type {Mitigation} from '../battle/executor';
export const flat=(n:number):AmountSpec=>({flat:n,attribute:'none',factor:0,scale:'flat',maxResource:'none',maxFraction:0});
const cost=(mp=0,sp=0)=>({hp:{flat:0,maxFraction:0},mp:{flat:mp,maxFraction:0},sp:{flat:sp,maxFraction:0}});
export function strike(power:number,channel:'physical'|'energy'='physical',sp=0,castMs=0):ActionSpec{return {target:'enemy',cost:cost(channel==='energy'?8:0,sp),castMs,recoveryFactor:1,perBattleUses:0,effects:[{op:'damage',amounts:{physical:flat(channel==='physical'?power:0),energy:flat(channel==='energy'?power:0),mental:flat(0),true:flat(0)},element:'none',hitChance:.95,hitRule:'normal',critChance:.1,critMultiplier:1.5}]};}
export function heal(power=38,item=false):ActionSpec{return {target:'ally',cost:cost(item?0:10),castMs:item?0:450,recoveryFactor:1,perBattleUses:0,effects:[{op:'heal',resource:'hp',amount:flat(power)}]};}
export function ward(amount=24):ActionSpec{return {target:'self',cost:cost(),castMs:0,recoveryFactor:.7,perBattleUses:0,effects:[{op:'shield',amount:flat(amount),channels:['physical','energy'],duration:{clock:'target_action',value:2}}]};}
export function quicken():ActionSpec{return {target:'self',cost:cost(),castMs:0,recoveryFactor:.6,perBattleUses:0,effects:[{op:'speed',name:'疾行',multiplier:1.55,chance:1,duration:{clock:'battle_time',value:5000},stack:'refresh'}]};}
export const bareMitigation=():Mitigation=>({armor:{physical:0,energy:0,mental:0},attributeReduction:{physical:0,energy:0,mental:0},elementMultipliers:{}});
export function contentCard(level:number,hp:number,agility:number,skills:Record<string,ActionSpec>):CompiledActor {
  return {version:COMPILER_ID,effectVersion:EFFECT_VERSION,sourceFingerprint:'authored-slice-content',rulesFingerprint:'slice-balance-v1',numeric:{level,attributes:{力量:12,敏捷:agility,体质:12,智力:12,精神:12},max:{hp,mp:65,sp:100}},skills:Object.entries(skills).map(([name,action])=>({sourceId:name,name,sourceFingerprint:'authored-content',mapping:{sourceId:name,disposition:'active',reason:'书海内容切片的显式设计技能',action}}))};
}
export type Foe={id:string;name:string;shape:string;role:'普通'|'精英'|'Boss';hp:number;agility:number;skills:Record<string,ActionSpec>;behavior:'strike'|'charge'|'shield'|'heal'|'ranged'|'control'|'summon'|'counter'|'low_health'|'burn'|'suicide'|'escape'|'combo';tint:string;phase?:{name:string;haste:number;shield:number;power:number};elementMultipliers?:Record<string,number>};
/** Full formal roster. The compatibility skills getter is tier ONE only; encounter generation MUST use monsterKit. */
export const FOES:Record<string,Foe>=Object.fromEntries(MONSTER_ROSTER.map(m=>{
 const n=monsterNumbers(m,1),shape={brute:'zombie',hunter:'bird',caster:'alchemist',guard:'knight',swarm:'bug',spirit:'ghost'}[m.build];
 const behavior:Foe['behavior']=m.cores.includes('swarm')?'summon':m.cores.includes('mend')?'heal':m.build==='guard'?'shield':m.build==='caster'||m.build==='spirit'?'control':m.build==='hunter'?'combo':'strike';
 const element=MONSTER_THEME_BY_ID[m.theme]!.element,tint:Record<string,string>={火:'#b97766',冰:'#a3ccdd',水:'#80b8b5',雷:'#9ca9db',土:'#afa07b',风:'#abcaa9',暗:'#a394b7',光:'#d6cdaf'};
 const f:Foe={id:m.id,name:m.name,shape,role:m.role,hp:n.max.hp,agility:n.attributes.敏捷,behavior,tint:tint[element]!,get skills(){return Object.fromEntries(monsterKit(m.id,1).card.skills.filter(s=>s.mapping.disposition==='active').map(s=>[s.sourceId,s.mapping.action!]));}};
 return [m.id,f];
}));
FOES[MIMIC_ID]={id:MIMIC_ID,name:'宝箱怪',shape:'chest',role:'精英',get hp(){return mimicKit(6).numbers.max.hp;},get agility(){return mimicKit(6).numbers.attributes.敏捷;},behavior:'strike',tint:'#a87942',get skills(){return Object.fromEntries(mimicKit(6).card.skills.filter(s=>s.mapping.disposition==='active').map(s=>[s.sourceId,s.mapping.action!]));}};
FOES[STRAY_ID]={id:STRAY_ID,name:STRAY_NAME,shape:'ghost',role:'精英',get hp(){return strayKit(6,[]).numbers.max.hp;},get agility(){return strayKit(6,[]).numbers.attributes.敏捷;},behavior:'strike',tint:'#c9c9d4',get skills(){return Object.fromEntries(strayKit(6,[]).card.skills.filter(s=>s.mapping.disposition==='active').map(s=>[s.sourceId,s.mapping.action!]));}};
/** Historical smoke-test route length, NOT an expedition cap. */
export const TOTAL_DEPTH=15;
export type {ThemeId} from './monsters/catalog';
export const THEME_ORDER:ThemeId[]=["T15","T01","T02","T03","T04","T05","T06","T07","T08","T09","T10","T11","T12","T13","T14","T16","T17","T18","T19","T20","T21","T22","T23","T24","T25","T26","T27","T28","T29","T30","T31","T32","T33","T34","T35","T36","T37","T38","T39","T40","T41","T42","T43","T44","T45","T46","T47","T48"];
export const THEMES:Record<ThemeId,{name:string;subtitle:string;scenes:string[]}>=Object.fromEntries(MONSTER_THEMES.map(t=>[t.id,{name:t.name,subtitle:t.subtitle,scenes:t.scenes}]));
export type PartyMember={persistent?:Partial<import('../battle/executor').Unit>;id:string;ref?:import('../core/actors').ActorRef;name:string;card:CompiledActor;current:{hp:number;mp:number;sp:number};color:string};
/** Explicitly chosen playtest party. Never used as a host compiler fallback or written to MVU. */
function demoStrike(power:number,channel:'physical'|'energy'='physical',sp=0,castMs=0):ActionSpec {
 const a=strike(power,channel,sp,castMs);if(channel==='energy')a.cost.mp.flat=10;
 for(const e of a.effects)if(e.op==='damage')e.amounts[channel]={...e.amounts[channel],attribute:channel==='physical'?'力量':'智力',factor:10,scale:'host_tier'};
 return a;
}
/** 玩家/队友种族抗性特例：只登记原文明确的相性，其余种族全属性1.0。倍率仅取0/0.5/1.5/2。被动与状态（element_resist/immune_element）在战斗中继续叠乘。 */
export const RACE_RESISTANCE:Readonly<Record<string,Readonly<Record<string,number>>>>={
 花灵:{火:1.5,水:.5},
};
export function raceResistance(card:Pick<CompiledActor,'traits'>):Record<string,number>{
 const race=card.traits?.tags.find(t=>t.startsWith('种族:'))?.slice(3)??'';
 const hit=Object.entries(RACE_RESISTANCE).find(([name])=>race===name||race.includes(name));
 return hit?{...hit[1]}:{};
}
export function hostMitigation(card:CompiledActor):Mitigation {
 const a=card.numeric.attributes,clamp=(x:number)=>Math.max(0,Math.min(1,x));
 const elementMultipliers:Record<string,number>={};for(const t of DAMAGE_TYPES)if(t!=='无')elementMultipliers[t]=1;Object.assign(elementMultipliers,raceResistance(card));
 return {...bareMitigation(),attributeReduction:{physical:clamp((a.力量+a.敏捷+a.体质)*.0025),energy:clamp((a.智力+a.精神)*.004),mental:clamp(a.精神*.008)},elementMultipliers};
}
export function playtestParty():PartyMember[]{
 const numbers=[monsterNumbers({...MONSTER_BY_ID.T15_N01!,role:'Boss'},3),monsterNumbers({...MONSTER_BY_ID.T12_N03!,role:'Boss'},3)];
 const block=ward(60);block.cost.sp.flat=15;
 const party:PartyMember[]=[
  {id:'reader',name:'试玩旅人',color:'#dce5e6',card:contentCard(3,1,1,{'短刃':demoStrike(20),'贯穿斩':demoStrike(100,'physical',14,450),'格挡':block,'恢复药':heal(60,true)}),current:{hp:1,mp:1,sp:1}},
  {id:'keeper',name:'试玩守灯人',color:'#b5b7d3',card:contentCard(3,1,1,{'墨矢':demoStrike(75,'energy'),'疗愈':heal(60),'杖击':demoStrike(20),'恢复药':heal(60,true)}),current:{hp:1,mp:1,sp:1}}
 ];
 party.forEach((p,i)=>{const n=numbers[i]!;p.card.numeric={level:3,attributes:n.attributes,max:n.max};p.current={...n.max};});return party;
}
