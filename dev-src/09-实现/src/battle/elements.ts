/** 六属性伤害类型：物/火/水/暗/光/精/无。无对所有单位恒为1.0，既不特攻也无抗性。 */
export const DAMAGE_TYPES=['物','火','水','暗','光','精','无'] as const;
export type DamageType=typeof DAMAGE_TYPES[number];
/** 旧元素与宿主/模型用语归并到六属性：雷/电→光，冰→水，风/土→物，毒/影/腐→暗，物理/精神通道名同样可作类型名。 */
const aliases:Record<string,DamageType>={
 物:'物',物理:'物',physical:'物',风:'物',wind:'物',土:'物',earth:'物',岩:'物',地:'物',
 火:'火',火焰:'火',炎:'火',fire:'火',flame:'火',爆炸:'火',
 水:'水',water:'水',冰:'水',冰霜:'水',ice:'水',frost:'水',霜:'水',
 暗:'暗',黑暗:'暗',dark:'暗',darkness:'暗',毒:'暗',poison:'暗',影:'暗',shadow:'暗',腐:'暗',
 光:'光',light:'光',holy:'光',圣:'光',雷:'光',雷电:'光',电:'光',lightning:'光',thunder:'光',electric:'光',
 精:'精',精神:'精',mental:'精',psychic:'精',
 无:'无',none:'无',true:'无',真实:'无',
};
export const isDamageType=(x:unknown):x is DamageType=>typeof x==='string'&&(DAMAGE_TYPES as readonly string[]).includes(x);
/** 未知字符串视为无属性，不会让自定义元素悄悄获得或绕过抗性。 */
export const elementKey=(name:string|undefined|null):DamageType=>{if(!name)return '无';return aliases[name]??aliases[name.toLowerCase()]??(isDamageType(name)?name:'无');};
type ChannelAmounts={physical:AmountLike;energy:AmountLike;mental:AmountLike;true:AmountLike};
type AmountLike={flat:number;attribute:string;factor:number;maxResource:string;maxFraction:number;currentResource?:string;currentFraction?:number;lostResource?:string;lostFraction?:number;eventFraction?:number;expression?:unknown;dependency?:string};
type DamageLike={amounts:ChannelAmounts;element?:string;types?:readonly string[];perType?:boolean};
const active=(a:AmountLike)=>a.flat!==0||(a.attribute!=='none'&&a.factor!==0)||(a.maxResource!=='none'&&a.maxFraction!==0)||!!(a.currentResource&&a.currentFraction)||!!(a.lostResource&&a.lostFraction)||!!a.eventFraction||!!a.expression||!!a.dependency;
/** 含目标/资源比例项的伤害数额即百分比伤害；费用中的比例不在此处，由动作cost表达。 */
export const percentAmount=(a:AmountLike)=>(a.maxResource!=='none'&&a.maxFraction!==0)||!!(a.currentResource&&a.currentFraction)||!!(a.lostResource&&a.lostFraction)||!!a.eventFraction;
export const isPercentDamage=(e:DamageLike)=>(['physical','energy','mental','true'] as const).some(ch=>percentAmount(e.amounts[ch]));
/**
 * 解析一次伤害效果的属性标签：
 * 1. 百分比伤害与仅真实通道的伤害固定为无属性，无视抗性；
 * 2. 显式types优先（去重、归并别名）；
 * 3. 否则由旧element字段归并；
 * 4. 仍无依据时按通道推导：物理→物、精神→精、能量/真实→无。
 */
export function resolveDamageTypes(e:DamageLike):{types:DamageType[];perType:boolean;fixed:'percent'|'true'|null}{
 const channels=(['physical','energy','mental','true'] as const).filter(ch=>active(e.amounts[ch]));
 if(isPercentDamage(e))return {types:['无'],perType:false,fixed:'percent'};
 if(channels.length&&channels.every(ch=>ch==='true'))return {types:['无'],perType:false,fixed:'true'};
 let types:DamageType[]=[];
 if(e.types?.length)types=[...new Set(e.types.map(elementKey))];
 else if(e.element&&elementKey(e.element)!=='无')types=[elementKey(e.element)];
 else{types=[...new Set(channels.map(ch=>ch==='physical'?'物':ch==='mental'?'精':'无') as DamageType[])];if(types.length>1)types=types.filter(t=>t!=='无');}
 if(!types.length)types=['无'];
 return {types,perType:!!e.perType&&types.length>1,fixed:null};
}
/** 单位对某属性的承伤倍率；无恒为1。允许0表示完全无效。 */
export const typeMultiplier=(table:Record<string,number>|undefined,type:DamageType)=>type==='无'?1:Math.max(0,table?.[type]??1);
/** 多属性技能默认取目标抗性最弱（倍率最高）的属性结算。 */
export function bestType(table:Record<string,number>|undefined,types:readonly DamageType[]):{type:DamageType;multiplier:number}{
 let best:{type:DamageType;multiplier:number}={type:types[0]??'无',multiplier:typeMultiplier(table,types[0]??'无')};
 for(const t of types){const m=typeMultiplier(table,t);if(m>best.multiplier)best={type:t,multiplier:m};}
 return best;
}
export const affinityLabel=(m:number)=>m<=0?'无效':m<1?'抵抗':m>=2?'特攻':m>1?'弱点':'';
