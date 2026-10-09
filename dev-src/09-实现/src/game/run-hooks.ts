/** 0.36 跑段侧聚合：遗物 hooks、临时修正（事件给的“下 N 场 / 本层 / 本次迷宫”）、FP 账本、遗物槽位、商店药剂。 */
import {RELIC_CATALOG,type RelicHooks} from './relic-catalog';
import {lifeTierOf} from './monsters/materials';
import type {ActionSpec,EffectSpec} from '../compiler/contract';
import {addReward,type Run,type Reward} from '../core/run';

export type OwnedRelic={id:string;owner:string;stacks:number};
export type BattleMod={fights:number;enemyDamage?:number;expMul?:number;materialRate?:number;enemyDouble?:boolean;thenRelic?:number;member?:string;memberDamage?:number;memberSpeed?:number};
export type LayerMods=Partial<{noMaterials:number;noChase:number;eliteBounty:number;enemyAttrs:number;strayHaste:number}>;
export type RunState={ownedRelics?:OwnedRelic[];battleMods?:BattleMod[];layerMods?:LayerMods;runMods?:LayerMods;layerFights?:number;fpDebt?:number;bag?:Record<string,number>;bell?:number;strayGuaranteedOnce?:boolean;sealedSkills?:Record<string,string[]>;stepsSinceHeal?:number;run:Run;depth:number};

/** 聚合全队所有遗物的跑段 hooks（乘算类相乘、加算类相加、布尔取或、最值取极值）。 */
export function relicHooks(s:{ownedRelics?:OwnedRelic[]}):Required<RelicHooks>{
 const h:Required<RelicHooks>={chestRate:0,chestForce:false,fightsToDescend:0,materialRate:1,eliteMaterialRate:1,fpMul:1,battleFpMul:1,fpPerDescend:0,fpPerVictory:0,expMul:1,strayStepDiv:1,strayDistance:0,straySpawn:0,strayBonusBox:0,groupEnemies:false,noFlee:false,fleeSure:false,fleeCost:0,boxQualityUp:0,potionMul:1,potionsPerLayer:0,vision:1,extraGroups:0,eliteBoost:false,supplierForced:false,shopDiscount:1,stepsHeal:{steps:0,fraction:0},firstFightNoDrop:false,layerMaterialRamp:0,slotBonus:0,layerParity:false,ashFp:0,firstFightStealth:false};
 const H=h as unknown as Record<string,number|boolean>;
 for(const o of s.ownedRelics??[]){const k=RELIC_CATALOG[o.id]?.hooks;if(!k)continue;
  for(const [key,value] of Object.entries(k) as [string,unknown][]){
   if(['materialRate','eliteMaterialRate','fpMul','battleFpMul','expMul','potionMul','vision','shopDiscount'].includes(key))H[key]=(H[key] as number)*(value as number);
   else if(['chestRate','fpPerDescend','fpPerVictory','extraGroups','boxQualityUp','potionsPerLayer','fleeCost','slotBonus','ashFp','strayBonusBox','layerMaterialRamp'].includes(key))H[key]=(H[key] as number)+(value as number);
   else if(['strayStepDiv','strayDistance','straySpawn','fightsToDescend'].includes(key))H[key]=Math.max(H[key] as number,value as number);
   else if(key==='stepsHeal'){const v=value as {steps:number;fraction:number};h.stepsHeal={steps:h.stepsHeal.steps?Math.min(h.stepsHeal.steps,v.steps):v.steps,fraction:h.stepsHeal.fraction+v.fraction};}
   else H[key]=!!H[key]||!!value;
  }
 }
 return h;
}
/** 遗物槽：生命层级 + 空遗物盒加成；空遗物盒自身不占槽。 */
export function relicCapacity(level:number,owned:OwnedRelic[],owner:string){return lifeTierOf(level)+owned.filter(o=>o.owner===owner).reduce((n,o)=>n+(RELIC_CATALOG[o.id]?.hooks?.slotBonus??0),0);}
export const relicSlotsUsed=(owned:OwnedRelic[],owner:string)=>owned.filter(o=>o.owner===owner&&!(RELIC_CATALOG[o.id]?.hooks?.slotBonus)).length;

/** 待结算 FP：全部 fp 奖励之和减去欠账。 */
export function pendingFp(run:Run,debt=0){return Math.max(0,run.rewards.reduce((n,r)=>n+(r.kind==='fp'?r.amount*r.count:0),0)-debt);}
/** 记入 FP（可负）。正数先抵欠账；负数先从既有 fp 奖励里扣，扣不完记欠账（之后的收入先还账）。返回实际变动。 */
export function adjustFp(s:RunState,delta:number,source:string):number{
 delta=Math.round(delta);if(!delta)return 0;
 if(delta>0){const pay=Math.min(delta,s.fpDebt??0);s.fpDebt=(s.fpDebt??0)-pay;const rest=delta-pay;if(rest>0)s.run=addReward(s.run,{kind:'fp',amount:rest,count:1,source});return delta;}
 let need=-delta;const rewards:Reward[]=[];
 for(const r of [...s.run.rewards].reverse()){if(r.kind!=='fp'||need<=0){rewards.unshift(r);continue;}const total=r.amount*r.count;if(total<=need){need-=total;continue;}rewards.unshift({...r,amount:total-need,count:1});need=0;}
 s.run={...s.run,rewards};if(need>0)s.fpDebt=(s.fpDebt??0)+need;return delta;
}
export function scaleFp(s:RunState,mul:number,source:string){const now=pendingFp(s.run,s.fpDebt);adjustFp(s,Math.round(now*mul)-now,source);}
/** 遗物 / 事件倍率下发放 FP（所有来源 FP 收益 ×fpMul）。 */
export function grantFp(s:RunState,amount:number,source:string,extraMul=1){const h=relicHooks(s);return adjustFp(s,Math.round(amount*h.fpMul*extraMul),source);}
export const countBoxes=(run:Run)=>run.rewards.reduce((n,r)=>n+(r.kind==='box'?r.count:0),0);
export function removeBoxes(s:RunState,count:number){let need=count;const rewards:Reward[]=[];for(const r of [...s.run.rewards].reverse()){if(r.kind!=='box'||need<=0){rewards.unshift(r);continue;}if(r.count<=need){need-=r.count;continue;}rewards.unshift({...r,count:r.count-need});need=0;}s.run={...s.run,rewards};}
export const BOX_QUALITIES=['普通','优良','稀有','史诗','传说','神话'] as const;
export function bumpQuality(q:string,by:number){const i=BOX_QUALITIES.indexOf(q as never);return i<0?q:BOX_QUALITIES[Math.min(BOX_QUALITIES.length-1,i+by)]!;}

/** 商店药剂（战斗中可用的指令类物品；R23 铁胃倍率在生成动作时代入）。 */
export type Potion={id:string;name:string;description:string;price:number;build:(mul:number)=>ActionSpec};
const zeroCost={hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}};
const flat=(n:number)=>({flat:n,attribute:'none' as const,factor:0,scale:'flat' as const,maxResource:'none' as const,maxFraction:0});
const item=(effects:EffectSpec[],target:ActionSpec['target']='ally',name=''):ActionSpec=>({target,cost:zeroCost,castMs:0,recoveryFactor:1,perBattleUses:0,effects,category:'item',name,targeting:{side:target,selection:'manual',count:1,life:'alive'}});
const heal=(r:'hp'|'mp'|'sp',f:number):EffectSpec=>({op:'heal',resource:r,amount:{...flat(0),subject:'target',maxResource:r,maxFraction:f}});
export const POTIONS:Potion[]=[
 {id:'red',name:'红药剂',description:'单体回复 40% 最大 HP',price:150,build:m=>item([heal('hp',Math.min(1,.4*m))],'ally','红药剂')},
 {id:'blue',name:'蓝药剂',description:'单体回复 40% 最大 MP',price:150,build:m=>item([heal('mp',Math.min(1,.4*m))],'ally','蓝药剂')},
 {id:'yellow',name:'黄药剂',description:'单体回复 40% 最大 SP',price:120,build:m=>item([heal('sp',Math.min(1,.4*m))],'ally','黄药剂')},
 {id:'tricolor',name:'三色药剂',description:'单体 HP / MP / SP 各回复 25%',price:300,build:m=>item([heal('hp',Math.min(1,.25*m)),heal('mp',Math.min(1,.25*m)),heal('sp',Math.min(1,.25*m))],'ally','三色药剂')},
 ...(['物','火','水','暗','光','精'] as const).map(el=>({id:'enchant-'+el,name:'附魔药·'+el,description:'使用者接下来 3 次攻击附加'+el+'属性',price:200,build:(_m:number)=>item([{op:'rule',rule:'element_rewrite',key:'*|'+el,duration:{clock:'permanent',value:0},uses:3}],'self','附魔药·'+el)})),
 {id:'antidote',name:'解毒药',description:'单体清除全部负面状态',price:180,build:()=>item([{op:'dispel',mode:'remove',polarity:'negative',count:99}],'ally','解毒药')},
 {id:'smoke',name:'烟雾弹',description:'本场战斗普通逃跑成功率 100%（对「?」与宝箱怪仍无效）',price:250,build:()=>item([{op:'modify',name:'烟雾',duration:{clock:'permanent',value:0},modifiers:[{stat:'evade',flat:.01}]}],'self','烟雾弹')},
];
export const POTION_BY_ID:Record<string,Potion>=Object.fromEntries(POTIONS.map(p=>[p.id,p]));
export const potionPrice=(p:Potion,depth:number,discount:number)=>Math.round(p.price*(1+depth/50)*discount);
export const POTION_KEY='potion:';
/** 0.39 商店「死亡不掉落」：固定 3000 FP，本趟限购一次；全灭时照常败退离场，但保留本趟全部所得（逐人经验、盲盒、素材、FP）。 */
export const INSURANCE={id:'keep-on-defeat',name:'死亡不掉落',price:3000,description:'本趟全灭时照常败退离场，但保留本趟全部所得（经验、盲盒、素材、FP）；本趟限购一次'} as const;
