import {EMPTY_LIBRARY,type ActionSpec,type AmountSpec,type ConditionSpec,type DurationSpec,type EffectSpec,type LibrarySpec,type StatusSpec,type TargetSpec} from '../../compiler/contract';
import type {Core,MonsterDesign,ThemeDesign} from './catalog';
import {elementKey,type DamageType} from '../../battle/elements';
/** 主题元素归并为六属性（雷→光、冰→水、风/土→物）。 */
export const themeType=(t:ThemeDesign):DamageType=>elementKey(t.element);
/** 每个核心的伤害属性标签。多属性核心默认按目标最弱抗性结算；chime/gravity按用户分类为双属性。 */
export const CORE_TYPES:Record<Core,DamageType[]>={fang:['物'],venom:['暗'],pounce:['物'],guard:['物'],mend:['物'],shot:['物'],spore:['暗'],cleave:['物'],frenzy:['物'],ram:['物'],exchange:['无'],seal:['精'],ember:['火'],chain:['物'],curse:['暗'],hex:['精'],drain:['暗'],snare:['物'],mirror:['光'],pledge:['物'],rift:['无'],chime:['物','精'],silence:['精'],mark:['精'],fate:['无'],veil:['物'],collect:['物'],shock:['光'],clock:['无'],sever:['物'],erase:['无'],gravity:['物','无'],echo:['精'],swarm:['物'],frost:['水']};
import {QUALITY_PERCENT,SKILL_POWER,SKILL_RECOVERY,type MonsterNumbers} from './numbers';
export const flat=(n:number):AmountSpec=>({flat:n,attribute:'none',factor:0,scale:'flat',maxResource:'none',maxFraction:0});
export const pct=(resource:'hp'|'mp'|'sp',fraction:number,subject:'caster'|'target'='caster'):AmountSpec=>({...flat(0),maxResource:resource,maxFraction:fraction,subject});
export const round=(value:number):DurationSpec=>({clock:'round',value});
export const permanent:DurationSpec={clock:'permanent',value:0};
export const self:TargetSpec={side:'self',selection:'all',life:'alive'};
export const foe:TargetSpec={side:'enemy',selection:'manual',count:1,life:'alive'};
export const cost=(mp=0,sp=0)=>({hp:{flat:0,maxFraction:0},mp:{flat:mp,maxFraction:0},sp:{flat:sp,maxFraction:0}});
export const action=(effects:EffectSpec[]=[],target:ActionSpec['target']='enemy'):ActionSpec=>({target,cost:cost(),castMs:500,recoveryFactor:1,perBattleUses:0,effects});
export const condition=(subject:ConditionSpec['subject'],kind:ConditionSpec['kind'],key:string,value=1,compare:ConditionSpec['compare']='gte'):ConditionSpec=>({...subject?{subject}:{},kind,key,value,compare});
export type Ctx={m:MonsterDesign;t:ThemeDesign;n:MonsterNumbers;stage:number;pct:number;power:number;recovery:number;lib:LibrarySpec};
export function context(m:MonsterDesign,t:ThemeDesign,n:MonsterNumbers):Ctx{return {m,t,n,stage:n.lifeTier,pct:QUALITY_PERCENT[n.lifeTier-1]!,power:SKILL_POWER[n.lifeTier-1]!*n.challengeGrowth.attack,recovery:SKILL_RECOVERY[n.lifeTier-1]!*n.challengeGrowth.hp,lib:EMPTY_LIBRARY()};}
export function damage(c:Ctx,channel:'physical'|'energy'|'mental'|'true'='physical',factor=1,hits=1,types?:DamageType[]):Extract<EffectSpec,{op:'damage'}>{
 const amount:AmountSpec=channel==='true'?flat(c.power*factor):{...flat(c.power*factor),attribute:channel==='physical'?'力量':channel==='energy'?'智力':'精神',factor:10*c.n.challengeGrowth.attack*factor,scale:'host_tier'};
 const tags=types??(channel==='energy'?[themeType(c.t)]:channel==='physical'?['物']:channel==='mental'?['精']:['无']);
 return {op:'damage',amounts:{physical:flat(0),energy:flat(0),mental:flat(0),true:flat(0),[channel]:amount},element:'none',types:tags,hitChance:.9,hitRule:'normal',critChance:0,critMultiplier:1,hits,powerMode:'split_total',hitGroup:'impact'};
}
export function status(c:Ctx,key:string,name:string,extra:Partial<StatusSpec>={}):EffectSpec{
 c.lib.statuses[key]={name,tags:['monster:status'],polarity:'negative',duration:round(c.stage===2?1:c.stage===3?2:3),stack:'refresh',maxStacks:1,scaleWithStacks:false,priority:0,dispellable:true,removeOnDeath:true,scope:'battle',...extra};
 return {op:'apply_status',status:key,...(c.lib.statuses[key]!.polarity==='negative'?{opposedAttribute:'精神' as const,opposedDifficulty:0}:{})};
}
export function shield(c:Ctx):EffectSpec{return {op:'shield',amount:flat(c.recovery),channels:['physical','energy','mental','true'],duration:round(c.stage===1?1:c.stage===2?1:c.stage===3?2:3),stack:'refresh'};}
export function finish(c:Ctx,a:ActionSpec){if(Object.values(c.lib).some(x=>Object.keys(x).length))a.library=c.lib;return a;}
export function child(c:Ctx,key:string,effects:EffectSpec[],target:ActionSpec['target']='enemy'){
 const a=action(effects,target);a.castMs=0;c.lib.actions[key]=a;return key;
}
/** Summons have finite lives, a total owner cap in executor, and no independent rewards. */
export function minion(c:Ctx,key:string,inheritance=.22,count=1):EffectSpec{
 const attack=child(c,key+':attack',[damage({...c,power:c.power*.25},'physical')]);
 c.lib.summons[key]={name:c.m.motif+'·衍生体',level:'caster',inheritance,resources:{hp:1,mp:0,sp:0},attributes:{力量:0,敏捷:0,体质:0,智力:0,精神:0},actions:[attack],duration:round(c.stage>=6?3:2),ownerDeath:'despawn',limit:2,rewardEligible:false,tags:['monster:minion']};
 return {op:'summon',template:key,count,mode:'summon',targeting:self};
}
export function primer(c:Ctx,key='primer'):EffectSpec{return status(c,key,c.m.motif+'·前兆',{tags:['monster:primer',c.m.id+':primer'],modifiers:[{stat:'vulnerability',multiplier:1+c.pct}]});}
export function reduce(c:Ctx):EffectSpec{const e=status(c,'reduction',c.m.motif+'·减伤',{polarity:'positive',duration:round(c.stage>=4?3:1),modifiers:[{stat:'reduction_physical',multiplier:1-c.pct},{stat:'reduction_energy',multiplier:1-c.pct},{stat:'reduction_mental',multiplier:1-c.pct}]});e.targeting=self;return e;}

/** Host initiative points enter the generic clock bonus; never mutate agility or pretend +N means N-fold haste. */
export function initiative(_c:Ctx,bonus:number){return {stat:'initiative' as const,flat:bonus};}
