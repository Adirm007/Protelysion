import {compileBattleItem} from './items';
import {Action,EMPTY_LIBRARY,type ActionSpec,type EffectSpec,type MappingSpec,type AmountSpec,type StatusSpec,type SourceKindSpec} from './contract';
import {DELAYED_RETURN,CONTROL_GUARD,STORY_MASTER} from './examples';
import {INTERLUDE_SUMMARY,interludeAction,isInterludeName} from './interlude';
import type {DamageType} from '../battle/elements';
/** 降级编译的属性推断：按用户分类表从原文关键词判定，无依据时物理通道=物、精神通道=精、其余=无；只给单属性。 */
export function inferDamageTypes(text:string,channel:'physical'|'energy'|'mental'|'true'):DamageType[]{
 const rules:[RegExp,DamageType][]=[[/爆炸|爆破|火|焰|炎|灼|燃|熔|烈日/,'火'],[/冰|霜|水|寒|潮|雪|冻/,'水'],[/雷|电|闪电|激光|等离子|辐射|神圣|圣光|净化|审判|光/,'光'],[/毒|腐蚀|瘟疫|诅咒|咒|汲取|吸血|亡灵|怨|影|暗/,'暗'],[/恐惧|魅惑|混乱|心灵|精神冲击|梦魇|惑/,'精'],[/空间切割|次元|删除|虚无|概念|魔力弹|纯粹魔力|真实/,'无'],[/风|岩|土|石|重力|音波|震荡|剑|刀|枪|拳|斩|踢|锤|弓|箭|弹/,'物']];
 for(const [re,t] of rules)if(re.test(text))return [t];
 return [channel==='physical'?'物':channel==='mental'?'精':'无'];
}
import {hostSkillScale} from './host-skill-scale';
import {sourceText,sourceCitation} from './source-text';
import type {Rules} from './rules';
import type {Obj} from '../core/actors';
export type AbilityEntry={name:string;sourceId:string;raw:unknown};
export type Adaptation={mode:'original'|'approximate'|'replacement';summary:string;quality?:string;originalQuality?:string;basisLevel?:number;method?:'native'|'model'|'local';policy?:number};
/** 编译策略修订号。2=0.38.1：增益/治疗默认可选同伴、敌我两用、正面状态与净化不再当成攻击。
 * 3=0.38.2：原文固定值治疗照原值编（amount / hotAmount），只有原文是百分比才编成百分比。
 * 旧修订号的模型结果在“重新整备”时按需重编（见 engine.ts needsTargetRefresh / needsHealRefresh）。 */
export const COMPILE_POLICY=3;
export type AdaptedMapping={mapping:MappingSpec;adaptation:Adaptation};
export const amount=(flat=0,attribute:AmountSpec['attribute']='none',factor=0):AmountSpec=>({flat,attribute,factor,scale:factor?'host_tier':'flat',maxResource:'none',maxFraction:0});
export function action(effects:EffectSpec[],target:ActionSpec['target']='self'):ActionSpec{return {target,cost:{hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}},castMs:0,recoveryFactor:1,perBattleUses:0,effects};}
export function sourceKind(id:string):SourceKindSpec{return id.startsWith('/装备/')?'equipment':id.startsWith('/道具定义/')?'item':id.startsWith('/状态定义/')?'status':id.startsWith('/种族')?'race':id.startsWith('/登神')?'ascension':'skill';}
const keyFor=(s:string)=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return 'bs'+(h>>>0).toString(36);};
function record(raw:unknown):Obj{return raw&&typeof raw==='object'&&!Array.isArray(raw)?raw as Obj:{};}
export function sourcePassive(entry:AbilityEntry){const raw=record(entry.raw),inner=record(raw.原文),type=String(raw.类型??inner.类型??'');return entry.sourceId.startsWith('/状态定义/')||type.includes('被动')||raw.阶段==='要素'||raw.阶段==='神位'||raw.阶段==='神国';}
function explicitCosts(entry:AbilityEntry,a:ActionSpec){
 const wrapper=record(entry.raw),raw=Object.hasOwn(wrapper,'阶段')?record(wrapper.原文):wrapper,text=sourceText(raw.消耗??''),isPassive=sourcePassive(entry);
 if(isPassive)return;
 for(const [key,mark]of [['hp','HP'],['mp','MP'],['sp','SP']] as const){const value=record(raw.消耗)[mark];if(typeof value==='number'&&value>=0){a.cost[key]={flat:value,maxFraction:0};continue;}const m=text.match(new RegExp(mark+'[：:\\s]+([0-9.]+)(%)?','i'))??text.match(new RegExp('([0-9.]+)(%)?\\s*'+mark,'i'));if(m)a.cost[key]=m[2]?{flat:0,maxFraction:Math.min(1,Number(m[1])/100)}:{flat:Number(m[1]),maxFraction:0};}
}
function result(entry:AbilityEntry,a:ActionSpec,mode:Adaptation['mode'],summary:string,passive=false,quality?:string,basisLevel?:number):AdaptedMapping{
 a.name??=entry.name.slice(0,200)||'未命名能力';a.description=summary;if(mode!=='replacement')explicitCosts(entry,a);
 const citation=sourceCitation(entry.raw),changed=mode!=='original';
 const mapping:MappingSpec={sourceId:entry.sourceId,disposition:passive?'passive':'active',reason:summary,action:Action.parse(a),fidelity:{mode:changed?'approximate':'exact',summary,clauses:[{original:citation,implementation:summary}],changes:changed?[{original:citation,implemented:summary,reason:mode==='replacement'?'按角色自身等级转化为同阶技能':'按书海中可执行的规则保留能力主题'}]:[]}};
 return {mapping,adaptation:{mode,summary,method:'local',...(quality?{quality}:{}),...(basisLevel?{basisLevel}:{}),...(record(entry.raw).品质?{originalQuality:String(record(entry.raw).品质)}:{})}};
}
/** Recognizable rules are compiled directly, without asking a model to re-quote them. */
export function nativeAbility(entry:AbilityEntry):AdaptedMapping|undefined{
 const text=entry.name+'\n'+sourceText(entry.raw),key=keyFor(entry.sourceId);
 if(entry.sourceId.startsWith('/道具定义/')){const item=compileBattleItem(entry.sourceId,entry.name,entry.raw);if(item)return result(entry,item,'original',item.description??'保留原物品效果。');}
 const materialTags=record(entry.raw).标签;
 if(entry.sourceId.startsWith('/道具定义/')&&Array.isArray(materialTags)&&materialTags.some(t=>['法则源质','材料','制作素材','剧情物品'].includes(String(t)))){const summary='保留为原用途物品，不生成战斗消耗动作。';return {mapping:{sourceId:entry.sourceId,disposition:'noncombat',reason:summary,action:null,fidelity:{mode:'exact',summary,clauses:[{original:sourceCitation(entry.raw),implementation:summary}],changes:[]}},adaptation:{mode:'original',summary,method:'local'}};}
 if(!entry.sourceId.startsWith('/道具定义/')&&isInterludeName(entry.name))return result(entry,interludeAction(entry.name),'approximate',INTERLUDE_SUMMARY);
 if(/(?:转移|传送|返回)/.test(text)&&/(?:下下回合|下下次.*行动)/.test(text)&&/(?:小憩|安全区|不明次元|空间封锁)/.test(text)){
  const a=structuredClone(DELAYED_RETURN),id=key+':return';a.library!.actions[id]=a.library!.actions.return_now!;delete a.library!.actions.return_now;
  for(const e of a.effects)if(e.op==='time'){e.action=id;e.key=id;}
  return result(entry,a,'approximate','战斗中发动后，在自身第二次行动开始时安全离开迷宫；战斗外立即离开。普通打断无效，倒下会终止传送。');
 }
 if(/故事的主人/.test(entry.name)&&/免疫/.test(text)&&/精神/.test(text))return result(entry,structuredClone(STORY_MASTER),'approximate','读者九十九夜梦赋予：常驻免疫恐惧、魅惑、混乱与嘲讽，精神属性伤害归零；该归零来自迷宫创造者，不作为普通技能的抗性模板。',true);
 if(/免疫/.test(text)&&/恐惧/.test(text)&&/魅惑/.test(text)&&/(?:精神|意志|心灵)/.test(text))return result(entry,structuredClone(CONTROL_GUARD),'approximate','常驻免疫恐惧、魅惑、混乱与嘲讽；冲突时按双方强度判定。',true);
 return undefined;
}
function duration(text:string,fallback=2){const m=text.match(/(?:持续|维持)\s*([1-9]\d?)\s*(?:回合|轮)/);return m?Math.min(12,Number(m[1])):fallback;}
function passiveTrigger(entry:AbilityEntry,child:ActionSpec,event:'hit'|'battle_start'='battle_start',uses=1){
 const key=keyFor(entry.sourceId),root=action([]);root.activation='always';const {library,...core}=child;root.library=library??EMPTY_LIBRARY();root.library.actions[key]=core;root.triggers=[{id:key,event,scope:'self',action:key,uses,payCost:false,reset:'battle'}];
 if(child.target==='enemy')child.targeting={side:'enemy',selection:event==='hit'?'manual':'random',count:1,life:'alive',...(event==='hit'?{anchor:'event_target' as const}:{})};
 return root;
}
/** A source-shaped playable approximation, before a generic equal-rank replacement. */
export function approximateAbility(entry:AbilityEntry,source:Obj,rules:Rules):AdaptedMapping|undefined{
 const native=nativeAbility(entry);if(native)return native;
 const text=entry.name+'\n'+sourceText(entry.raw),level=Number(source.等级),scale=hostSkillScale(level,rules),key=keyFor(entry.sourceId),passive=sourcePassive(entry);
 if(entry.sourceId.startsWith('/状态定义/'))return undefined; // Dedicated host-status ownership path below.
 if(/(?:束缚|禁锢|缠绕)/.test(text)){
  const turns=duration(text),a=action([{op:'apply_status',status:key,opposedAttribute:'精神'}],'enemy');a.library=EMPTY_LIBRARY();a.library.statuses[key]={name:'束缚',tags:['束缚'],polarity:'negative',duration:{clock:'target_action',value:turns},stack:'refresh',maxStacks:1,scaleWithStacks:false,priority:0,dispellable:true,removeOnDeath:true,scope:'battle',control:'bind'};
  if(passive){const root=action([]);root.activation='always';root.library=a.library;const {library:unused,...child}=a;root.library.actions[key+':bind']=child;root.triggers=[{id:key,event:'hit',scope:'self',action:key+':bind',uses:0,payCost:false}];root.library.actions[key+':bind']!.targeting={side:'enemy',selection:'manual',anchor:'event_target',count:1,life:'alive'};return result(entry,root,'approximate',`命中时对目标进行精神对抗；成功后施加${turns}次行动的束缚。`,true);}
  return result(entry,a,'approximate',`对目标进行精神对抗；成功后束缚${turns}次行动。`);
 }
 if(/(?:侦查|侦探|调查|直觉|线索|观察|洞察|感知|搜索|寻宝|推理|识破|探案)/.test(text))return result(entry,action([{op:'explore',kind:'reveal',value:Math.max(2,scale.tier+1),duration:{clock:'permanent',value:0}}]),'approximate','感知当前区域的敌人。',false);
 const fixed=text.match(/造成\s*(\d+(?:\.\d+)?)\s*(?:点)?(物理|能量|精神|真实)伤害/);
 if(fixed){const channel=({物理:'physical',能量:'energy',精神:'mental',真实:'true'} as const)[fixed[2] as '物理'|'能量'|'精神'|'真实'],values={physical:amount(),energy:amount(),mental:amount(),true:amount()};values[channel]=amount(Number(fixed[1]));const hit=action([{op:'damage',amounts:values,element:'none',hitChance:text.includes('必中')?1:.9,hitRule:text.includes('必中')?'guaranteed':'normal',critChance:0,critMultiplier:1.5}],'enemy');if(passive)return result(entry,passiveTrigger(entry,hit),'approximate',`每场战斗开始时造成${fixed[1]}点${fixed[2]}伤害。`,true);return result(entry,hit,'approximate',`保留原能力的${fixed[1]}点${fixed[2]}伤害。`);}
 if(/(?:治疗|治愈|恢复生命|小憩|休息|料理|烹饪|医疗)/.test(text)){
  const a=action([{op:'heal',resource:'hp',amount:amount(scale.power,'精神',1)}],'ally');
  if(passive){a.target='self';return result(entry,passiveTrigger(entry,a),'approximate',`战斗开始时为自身恢复${scale.power}点基础生命，另受精神与层级加成。`,true);}
  a.cost.mp.flat=scale.cost;return result(entry,a,'approximate',`恢复一名同伴${scale.power}点基础生命，另受精神与层级加成。`);
 }
 if(/(?:护盾|屏障|结界|守护|保护|锻造|铸造|缝纫|制造|炼金)/.test(text)){
  const a=action([{op:'shield',amount:amount(scale.power),channels:['physical','energy','mental','true'],duration:{clock:'target_action',value:3}}]);
  if(passive)return result(entry,passiveTrigger(entry,a),'approximate',`每场战斗开始时获得${scale.power}点护盾，持续3次行动。`,true);
  a.cost.mp.flat=scale.cost;return result(entry,a,'approximate',`获得${scale.power}点护盾，持续3次行动。`);
 }
 if(/(?:命运|幸运|运势|必胜|必中)/.test(text)){
  const a=action([{op:'rule',rule:'guaranteed_hit',key:'*',duration:{clock:'permanent',value:0},uses:1},{op:'rule',rule:'guaranteed_evade',key:'*',duration:{clock:'permanent',value:0},uses:1}]);a.perBattleUses=1;
  if(passive){a.activation='battle_start';return result(entry,a,'approximate','每场战斗获得一次必中与一次必闪。',true);}
  return result(entry,a,'approximate','本场下一次攻击必中，并获得一次必闪；每场限用一次。');
 }
 if(/(?:复活|不死|免死|重生)/.test(text)){
  const a=action([{op:'rule',rule:'death_guard',key:'*',duration:{clock:'permanent',value:0},uses:1,amount:amount(1)}]);a.perBattleUses=1;if(passive)a.activation='battle_start';
  return result(entry,a,'approximate','每场抵挡一次致命伤害，保留1点生命。',passive);
 }
 if(/(?:净化|驱散|解除负面|解毒)/.test(text))return result(entry,action([{op:'dispel',mode:'remove',polarity:'negative',count:1}],'ally'),'approximate','解除一名同伴的一个可驱散负面状态。');
 if(/(?:隐身|潜行|隐匿|伪装)/.test(text))return result(entry,action([{op:'explore',kind:'stealth',value:1,duration:{clock:'exploration_time',value:15000}}]),'approximate','在探索中隐匿15秒，降低遭遇敌人的机会。');
 return undefined;
}
function statusReplacement(entry:AbilityEntry,source:Obj,rules:Rules):AdaptedMapping{
 const text=sourceText(entry.raw),scale=hostSkillScale(Number(source.等级),rules),key=keyFor(entry.sourceId),negative=/负面|中毒|流血|诅咒|虚弱|伤势|麻痹|衰弱/.test(entry.name+text);
 const status:StatusSpec={name:entry.name.slice(0,100),tags:[entry.name.slice(0,100)],polarity:negative?'negative':'positive',duration:{clock:'permanent',value:0},stack:'refresh',maxStacks:1,scaleWithStacks:false,priority:0,dispellable:true,removeOnDeath:false,scope:'host',modifiers:[{stat:'recovery',multiplier:negative?1.15:.9}]};
 const a=action([{op:'apply_status',status:key}]);a.library=EMPTY_LIBRARY();a.library.statuses[key]=status;a.activation='always';
 return result(entry,a,'approximate',negative?'该状态在迷宫中转为行动恢复时间增加15%。':'该状态在迷宫中转为行动恢复时间减少10%。',true,scale.qualityName,Number(source.等级));
}
/** Terminal fallback is a real executable skill at this actor's host-worldbook rank. */
export function replacementAbility(entry:AbilityEntry,source:Obj,rules:Rules):AdaptedMapping{
 if(entry.sourceId.startsWith('/状态定义/'))return statusReplacement(entry,source,rules);
 const scale=hostSkillScale(Number(source.等级),rules),attrs=record(source.属性),text=entry.name+'\n'+sourceText(entry.raw),physical=/剑|刀|枪|拳|斩|踢|击|锤|弓|格斗/.test(text)&&!/(?:精神|魔法|法术)/.test(text);
 const attribute=physical?'力量':Number(attrs.精神??0)>Number(attrs.智力??0)?'精神':'智力',channel=physical?'physical':attribute==='精神'?'mental':'energy',types=inferDamageTypes(text,channel);
 const amounts={physical:amount(),energy:amount(),mental:amount(),true:amount()};amounts[channel]=amount(scale.power,attribute,scale.attributeFactor);
 const attack=action([{op:'damage',amounts,element:'none',types,hitChance:.9,hitRule:'normal',critChance:0,critMultiplier:1.5}],'enemy');attack.category=physical?'skill':'spell';attack.source={id:entry.sourceId,kind:sourceKind(entry.sourceId),quality:scale.quality};
 const label=physical?'破阵一击':channel==='mental'?'心弦冲击':'辉光术式';attack.name=scale.qualityName+'·'+label;
 const passive=sourcePassive(entry);
 if(passive){attack.targeting={side:'enemy',selection:'random',count:1,life:'alive'};const a=passiveTrigger(entry,attack);a.source=attack.source;return result(entry,a,'replacement',`每场战斗开始时发动「${attack.name}」：对一名敌人造成${scale.power}点基础${physical?'物理':channel==='mental'?'精神':'能量'}伤害，另受${attribute}与层级加成。`,true,scale.qualityName,scale.level);}
 const mp=record(source.法力值),sp=record(source.体力值),mpMax=Number(mp._基础??0)+Number(mp.额外??0),spMax=Number(sp._基础??0)+Number(sp.额外??0);
 const resource=physical?(spMax>=scale.cost||spMax>=mpMax?'sp':'mp'):(mpMax>=scale.cost||mpMax>=spMax?'mp':'sp');attack.cost[resource].flat=sourceKind(entry.sourceId)==='item'?0:scale.cost;
 return result(entry,attack,'replacement',`转化为「${attack.name}」：造成${scale.power}点基础${physical?'物理':channel==='mental'?'精神':'能量'}伤害，另受${attribute}与层级加成。`,false,scale.qualityName,scale.level);
}
