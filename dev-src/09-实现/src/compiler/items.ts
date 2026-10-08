import {Action, type ActionSpec,type AmountSpec,type EffectSpec,type ModifierSpec,type DurationSpec} from './contract';
import {itemEffectText,hasBattleItemEffect} from '../core/battle-items';
import {elementKey} from '../battle/elements';
const amount=(value=0):AmountSpec=>({flat:value,attribute:'none',factor:0,scale:'flat',maxResource:'none',maxFraction:0,subject:'target'});
const aliases={hp:'生命值|生命|血量|HP',mp:'法力值|法力|魔力|MP',sp:'体力值|体力|精力|SP'};
function recovered(text:string,resource:keyof typeof aliases):AmountSpec|undefined {
  const name='(?:'+aliases[resource]+')';if(!new RegExp(name,'i').test(text))return;
  const numeric='([0-9]+(?:\\.[0-9]+)?)(%)?';
  const found=text.match(new RegExp(numeric+'(?:的|点)?(?:最大)?'+name,'i'))??text.match(new RegExp(name+'(?:上限)?(?:的)?'+numeric,'i'));
  if(!found){if(new RegExp('(?:补满|回满|恢复满|回复满|恢复全部|回复全部|完全恢复)(?:目标的?)?(?:最大)?'+name,'i').test(text))return {...amount(),maxResource:resource,maxFraction:1};return;}
  const value=Number(found[1]);return found[2]?{...amount(),maxResource:resource,maxFraction:value/100}:amount(value);
}
function duration(text:string):DurationSpec|undefined {
  const m=text.match(/(?:持续|维持)(\d+)(秒|回合|轮)/);if(m)return {clock:m[2]==='秒'?'battle_time':m[2]==='轮'?'round':'target_action',value:Number(m[1])*(m[2]==='秒'?1000:1)};
  if(/本场战斗|直到.*耗尽/.test(text))return {clock:'permanent',value:0};
}
/** Exact local rules for common consumables. Complex/conditional combinations are
 * left to the existing full action compiler, never silently stripped of clauses. */
export function compileBattleItem(sourceId:string,name:string,raw:unknown):ActionSpec|undefined {
  if(!hasBattleItemEffect(raw))return;
  const text=itemEffectText(raw).replace(/\s+/g,''),effects:EffectSpec[]=[];
  if(/如果|若|每次|每回合|每秒|概率|几率|随机|条件|(?:当.+时)/.test(text))return;
  if(/自身|自己/.test(text)&&/敌人|敌方|同伴/.test(text))return;
  // 0.38.1：消耗品用在谁身上就作用于谁——原文的“自身/自己”指服用者，默认可选同伴（含自身）；只有写明敌人的才对敌使用。
  let target:ActionSpec['target']=/敌方|敌人|敌军/.test(text)?'enemy':'ally',reviving=false;
  if(/复活|复苏/.test(text)){
    const value=recovered(text,'hp');if(!value)return;
    effects.push({op:'revive',amount:value});reviving=true;
  }
  if(/恢复|回复|治疗|补充|补满|回满/.test(text)){
    if(/持续|维持/.test(text))return;
    for(const resource of ['hp','mp','sp'] as const){if(reviving&&resource==='hp')continue;const value=recovered(text,resource);if(value)effects.push({op:'heal',resource,amount:value});}
    // An explicitly mentioned but unparsed resource must not disappear from a mixed potion.
    for(const resource of ['hp','mp','sp'] as const)if(new RegExp(aliases[resource],'i').test(text)&&!recovered(text,resource))return;
  }
  const hit=text.match(/造成(\d+(?:\.\d+)?)(?:点)?(物理|能量|精神|真实|火焰?|冰霜?|雷电?|风|土|水|光|暗)(?:属性)?伤害/);
  if(hit){
    target='enemy';const channels={物理:'physical',能量:'energy',精神:'mental',真实:'true'} as const,type=hit[2]!,channel=channels[type as keyof typeof channels]??'energy';
    const amounts={physical:amount(),energy:amount(),mental:amount(),true:amount()};amounts[channel]=amount(Number(hit[1]));
    effects.push({op:'damage',amounts,element:'none',types:[elementKey(type in channels?(channel==='physical'?'物':channel==='mental'?'精':'无'):type)],hitChance:1,hitRule:text.includes('必中')?'guaranteed':'normal',critChance:0,critMultiplier:1.5});
  }else if(/造成.*伤害/.test(text))return;
  const shield=text.match(/(?:获得|生成|提供)(\d+(?:\.\d+)?)(?:点)?(?:全通道)?护盾/);
  if(shield){const d=duration(text);if(!d)return;effects.push({op:'shield',amount:amount(Number(shield[1])),channels:['physical','energy','mental','true'],duration:d});}
  if(/解除中毒|解毒/.test(text))for(const status of ['中毒','poison'])effects.push({op:'dispel',mode:'remove',polarity:'negative',status,count:1000});
  else if(/(?:净化|解除|驱散)(?:一个|1个|所有|全部)?(?:可驱散的)?负面(?:效果|状态)/.test(text))effects.push({op:'dispel',mode:'remove',polarity:'negative',count:/所有|全部/.test(text)?1000:1});
  if(/驱散(?:所有|全部)增益/.test(text)){target='enemy';effects.push({op:'dispel',mode:'remove',polarity:'positive',count:1000});}
  const fields:Record<string,ModifierSpec['stat']>={力量:'力量',敏捷:'敏捷',体质:'体质',智力:'智力',精神:'精神',物理伤害:'damage_physical',能量伤害:'damage_energy',精神伤害:'damage_mental',物理防御:'armor_physical',能量防御:'armor_energy',精神防御:'armor_mental',行动速度:'speed'};
  for(const m of text.matchAll(/(力量|敏捷|体质|智力|精神|物理伤害|能量伤害|精神伤害|物理防御|能量防御|精神防御|行动速度)(提升|提高|增加|降低|减少)(\d+(?:\.\d+)?)(%)?/g)){
    const d=duration(text);if(!d)return;const sign=/降低|减少/.test(m[2]!)?-1:1,value=Number(m[3])*sign;
    effects.push({op:'modify',name,modifiers:[{stat:fields[m[1]!]!,...(m[4]?{multiplier:Math.max(0,1+value/100)}:{flat:value})}],duration:d});
  }
  if(/立即(?:退出(?:当前|本次)?远征|返回入口)/.test(text)){target='self';effects.push({op:'retreat'});}
  if(!effects.length)return;
  if(/提升|提高|增加|降低|减少/.test(text)&&!effects.some(e=>e.op==='modify'))return;
  if(/解除|驱散|净化|解毒/.test(text)&&!effects.some(e=>e.op==='dispel'))return;
  if(effects.some(e=>e.op==='damage')&&effects.some(e=>e.op==='heal'||e.op==='revive'||e.op==='shield'))return;
  // These effects require the general compiler: do not partially compile them as a simple potion.
  if(/召唤|复制|反射|免疫|眩晕|冻结|燃烧|流血|沉默|束缚|恐惧|魅惑|充能|冷却|蓄能|交换|上限提升/.test(text))return;
  const result:ActionSpec={name,description:itemEffectText(raw),source:{id:sourceId,kind:'item'},target,cost:{hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}},castMs:0,recoveryFactor:1,perBattleUses:0,copyable:false,effects};
  if(/全体|所有(?:队友|同伴|敌人|敌方)/.test(text))result.targeting={side:target,selection:'all',life:reviving?'downed':'alive'};
  else if(/(?:两|三|四|[2-9])(?:名|个)(?:目标|同伴|队友|敌人)/.test(text)){const count=text.match(/(两|三|四|[2-9])(?:名|个)(?:目标|同伴|队友|敌人)/)![1]!;result.targeting={side:target,selection:'manual',count:({'两':2,'三':3,'四':4} as Record<string,number>)[count]??Number(count),life:reviving?'downed':'alive'};}
  else if(reviving)result.targeting={side:'ally',selection:'manual',count:1,life:'downed'};
  return Action.parse(result);
}
