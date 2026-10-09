import {finite,integer,tier} from '../core/actors';
export const CHANNELS=['physical','energy','mental','true'] as const;
export type Channel=typeof CHANNELS[number];
export type Channels=Record<Channel,number>;
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
/** Pairwise and symmetric. Above-25 levels retain tier 7 but use actual level differences. */
export function suppression(attackerLevel:number,targetLevel:number):{damageMultiplier:number;hitDelta:number} {
 integer(attackerLevel,'攻击者等级',1);integer(targetLevel,'目标等级',1);
 const combatTier=(level:number)=>tier(Math.min(25,level))+Math.floor(Math.max(0,level-25)/4);
 const direction=Math.sign(attackerLevel-targetLevel),tiers=Math.abs(combatTier(attackerLevel)-combatTier(targetLevel));
 const gap=Math.min(Math.abs(attackerLevel-targetLevel),3),m=Math.min(1e5,1.6**Math.min(25,tiers)*1.035**gap);
 return {damageMultiplier:direction<0?1/m:m,hitDelta:direction*Math.min(.95,.12*tiers+.015*gap)};
}
/** Explicit serializable PRNG state; never Math.random, frame time, or hidden global entropy. */
export function roll(seed:number):{seed:number;value:number} {
 integer(seed,'随机状态');if(seed>0xffffffff)throw Error('随机状态超出32位');
 const next=(seed+0x6D2B79F5)>>>0;let t=next;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);
 return {seed:next,value:((t^(t>>>14))>>>0)/4294967296};
}
export type DamageRequest={
 attackerLevel:number;targetLevel:number;seed:number;base:Channels;
 armor:Record<Exclude<Channel,'true'>,number>;attributeReduction:Record<Exclude<Channel,'true'>,number>;
 channelMultiplier:Channels;hitChance:number;hitRule:'normal'|'guaranteed'|'impossible';critChance:number;critMultiplier:number;
};
/** Numeric primitive only, BEFORE shields/sharing/death exemptions. Unsupported authored effects must be blocked by the compiler/executor, not discarded here. */
export function calculateDamage(r:DamageRequest):{seed:number;hit:boolean;critical:boolean;hitChance:number;channels:Channels;total:number;suppression:{damageMultiplier:number;hitDelta:number};stage:'before-shields'} {
 const pair=suppression(r.attackerLevel,r.targetLevel);
 for(const c of CHANNELS){if(finite(r.base[c],`${c}基础伤害`)<0||finite(r.channelMultiplier[c],`${c}伤害倍率`)<0)throw Error('伤害不得为负，吸收须使用明确效果');if(c!=='true'&&(finite(r.armor[c],'防具')<0||finite(r.attributeReduction[c],'属性减免')<0||r.attributeReduction[c]>1))throw Error('普通防具/减免非法');}
 if(!['normal','guaranteed','impossible'].includes(r.hitRule)||finite(r.hitChance,'命中率')<0||r.hitChance>1||finite(r.critChance,'暴击率')<0||r.critChance>1||finite(r.critMultiplier,'暴击倍率')<1)throw Error('概率或暴击倍率非法');
 const hitRoll=roll(r.seed),critRoll=roll(hitRoll.seed); // Fixed two rolls even for overrides/misses; replay draw count is stable.
 const hitChance=r.hitRule==='guaranteed'?1:r.hitRule==='impossible'?0:clamp(r.hitChance+pair.hitDelta,.05,.99);
 const hit=hitRoll.value<hitChance,critical=hit&&critRoll.value<r.critChance;
 const channels={} as Channels;
 for(const c of CHANNELS){
  const armorFactor=c==='true'?1:2000/(r.armor[c]+2000),attributeFactor=c==='true'?1:1-r.attributeReduction[c];
  const value=hit?r.base[c]*pair.damageMultiplier*armorFactor*attributeFactor*r.channelMultiplier[c]*(critical?r.critMultiplier:1):0;
  if(!Number.isFinite(value))throw Error('伤害溢出');channels[c]=value;
 }
 const total=Math.floor(CHANNELS.reduce((sum,c)=>sum+channels[c],0));if(!Number.isSafeInteger(total))throw Error('总伤害超出安全整数');
 return {seed:critRoll.seed,hit,critical,hitChance,channels,total,suppression:pair,stage:'before-shields'};
}
