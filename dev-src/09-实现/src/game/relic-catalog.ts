/** 0.36 遗物系统重制：60 条声明式遗物。
 *  - 默认只作用于持有者（scope 'holder'）；涉及 FP / 宝箱 / 遇敌 / 掉率 / 楼层规则 / 来访者的为全队（'team'）；影响敌我双方的为全场（'field'）。
 *  - 每名角色可持有数 = 生命层级；可转移 / 丢弃，除非带词条。
 *  - 战斗侧效果 = 一条挂在持有者卡上的被动（契约效果）；跑段侧效果 = hooks，由 run-hooks.ts 聚合后在探索 / 结算处读取。 */
import type {ActionSpec,EffectSpec,ModifierSpec,TriggerSpec,LibrarySpec,StatusSpec} from '../compiler/contract';
import {EMPTY_LIBRARY} from '../compiler/contract';

export type RelicHooks=Partial<{
 chestRate:number;chestForce:boolean;fightsToDescend:number;materialRate:number;eliteMaterialRate:number;fpMul:number;battleFpMul:number;fpPerDescend:number;fpPerVictory:number;expMul:number;
 strayStepDiv:number;strayDistance:number;straySpawn:number;strayBonusBox:number;groupEnemies:boolean;noFlee:boolean;fleeSure:boolean;fleeCost:number;boxQualityUp:number;potionMul:number;potionsPerLayer:number;
 vision:number;extraGroups:number;eliteBoost:boolean;supplierForced:boolean;shopDiscount:number;stepsHeal:{steps:number;fraction:number};firstFightNoDrop:boolean;layerMaterialRamp:number;slotBonus:number;layerParity:boolean;ashFp:number;firstFightStealth:boolean;
}>;
export type RelicDef={id:string;name:string;description:string;rarity:1|2|3;scope:'holder'|'team'|'field';transferable:boolean;droppable:boolean;passive?:ActionSpec;hooks?:RelicHooks;grantFp?:number};

const forever={clock:'permanent' as const,value:0};
const round=(n:number)=>({clock:'round' as const,value:n});
const zeroCost={hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}};
const passive=(effects:EffectSpec[],extra:Partial<ActionSpec>={}):ActionSpec=>({target:'self',cost:zeroCost,castMs:0,recoveryFactor:1,perBattleUses:0,effects,...extra});
const act=(effects:EffectSpec[],target:ActionSpec['target']='self'):ActionSpec=>({target,cost:zeroCost,castMs:0,recoveryFactor:1,perBattleUses:0,effects});
const mod=(name:string,modifiers:ModifierSpec[],duration=forever):EffectSpec=>({op:'modify',name,duration,modifiers});
/** 遗物规则默认仲裁优先级 90：免疫 / 必中 / 费用规则不该因“等级>速度>随机”的冲突裁决被同级敌人偶然压过。 */
const rule=(r:Extract<EffectSpec,{op:'rule'}>['rule'],key='*',extra:Partial<Extract<EffectSpec,{op:'rule'}>>={}):EffectSpec=>({op:'rule',rule:r,key,duration:forever,priority:90,absolute:true,...extra} as EffectSpec);
const flat=(n:number)=>({flat:n,attribute:'none' as const,factor:0,scale:'flat' as const,maxResource:'none' as const,maxFraction:0});
const pct=(r:'hp'|'mp'|'sp',f:number,subject:'caster'|'target'='caster')=>({...flat(0),maxResource:r,maxFraction:f,subject});
const dmgMods=(m:number):ModifierSpec[]=>(['damage_physical','damage_energy','damage_mental','damage_true'] as const).map(stat=>({stat,multiplier:m}));
const attrMods=(m:number):ModifierSpec[]=>(['力量','敏捷','体质','智力','精神'] as const).map(stat=>({stat,multiplier:m}));
const ALL_ALLIES={side:'ally',selection:'all',life:'alive'} as const;
const ALL_ENEMIES={side:'enemy',selection:'all',life:'alive'} as const;
const ANY_ALL={side:'any',selection:'all',life:'alive'} as const;
const EVENT_SOURCE={side:'event_source',selection:'all',life:'alive'} as const;
const status=(name:string,o:Partial<StatusSpec>={}):StatusSpec=>({name,tags:['relic'],polarity:'positive',duration:forever,stack:'refresh',maxStacks:1,scaleWithStacks:true,priority:0,dispellable:false,removeOnDeath:false,scope:'battle',...o});
/** 带库与触发器的被动。 */
function withLib(effects:EffectSpec[],lib:Partial<LibrarySpec>,triggers:TriggerSpec[]=[]):ActionSpec{const a=passive(effects);a.library={...EMPTY_LIBRARY(),...lib};a.triggers=triggers;return a;}
const trig=(id:string,event:TriggerSpec['event'],action:string,extra:Partial<TriggerSpec>={}):TriggerSpec=>({id,event,action,scope:'self',...extra});
const typeless=(amount:ReturnType<typeof flat>|Record<string,unknown>,extra:Record<string,unknown>={}):EffectSpec=>({op:'damage',amounts:{physical:flat(0),energy:flat(0),mental:flat(0),true:{...flat(0),...amount}},element:'none',hitChance:1,hitRule:'guaranteed',critChance:0,critMultiplier:1,...extra} as EffectSpec);

const R=(id:number,name:string,description:string,rarity:1|2|3,scope:RelicDef['scope'],rest:Partial<RelicDef>={}):RelicDef=>({id:'R'+String(id).padStart(3,'0'),name,description,rarity,scope,transferable:true,droppable:true,...rest});

export const RELIC_LIST:RelicDef[]=[
 R(1,'疾风之靴','速度 ×2，攻击力 ×0.5。',2,'holder',{passive:passive([mod('疾风之靴',[{stat:'speed',multiplier:2},...dmgMods(.5)])])}),
 R(2,'巨人之腕','攻击力 ×2，速度 ×0.5。',2,'holder',{passive:passive([mod('巨人之腕',[{stat:'speed',multiplier:.5},...dmgMods(2)])])}),
 R(3,'寻宝罗盘','宝箱出现率 +3%；每层必须打过 3 场战斗才能进入下一层。',2,'team',{hooks:{chestRate:.03,fightsToDescend:3}}),
 R(4,'开幕号角','每场战斗第一个造成伤害的技能伤害 ×2。',2,'holder',{passive:passive([rule('nth_skill_scale','1|2')])}),
 R(5,'采集者之袋','素材掉落率 ×2，全队伤害 ×0.5。',2,'team',{hooks:{materialRate:2},passive:passive([mod('采集者之袋',dmgMods(.5))])}),
 R(6,'赞助契约','所有来源的 FP 收益 +20%，全队伤害与速度 −20%。',2,'team',{hooks:{fpMul:1.2},passive:passive([mod('赞助契约',[{stat:'speed',multiplier:.8},...dmgMods(.8)])])}),
 R(7,'灰烬护符','免疫火属性伤害，受到的水属性伤害 ×3。',2,'holder',{passive:passive([rule('immune_element','火'),mod('灰烬护符',[{stat:'element',element:'水',multiplier:3}])])}),
 R(8,'无字书签','来访者「?」难以追踪锁定你：她每 4 步才走 1 步，刷新距离改为 36 格。',3,'team',{hooks:{strayStepDiv:4,strayDistance:36}}),
 R(9,'盾墙誓约','防御 ×1.5；每场战斗的前两次行动只能选择防御。',2,'holder',{passive:passive([mod('盾墙誓约',[{stat:'armor_physical',multiplier:1.5},{stat:'armor_energy',multiplier:1.5},{stat:'armor_mental',multiplier:1.5}]),rule('guard_first','2')])}),
 R(10,'荆棘之心','受到伤害时把等量伤害反射给来源（不超过自身最大 HP，且仍受来源防御与抗性影响）；战斗中无法恢复 HP。',3,'holder',{passive:withLib([rule('no_heal','*')],{actions:{thorns:act([{op:'damage',amounts:{physical:{...flat(0),expression:[{read:'event',key:'actual'},{read:'max_resource',subject:'caster',key:'hp'},{operator:'min'}]},energy:flat(0),mental:flat(0),true:flat(0)},element:'none',hitChance:1,hitRule:'guaranteed',critChance:0,critMultiplier:1,targeting:EVENT_SOURCE} as EffectSpec],'enemy')}},[trig('thorns','damage_received','thorns')])}),
 R(11,'奇偶天平','每层奇数场战斗全队全属性 ×1.3，偶数场 ×0.7。',2,'team',{hooks:{layerParity:true}}),
 R(12,'群狼哨','普通敌人成群出现（3–4 个，本主题随机混合，可能重复）。',1,'team',{hooks:{groupEnemies:true}}),
 R(13,'命中之眼','敌我双方所有攻击不再落空。',2,'field',{passive:passive([{op:'rule',rule:'guaranteed_hit',key:'*',duration:forever,targeting:ANY_ALL}])}),
 R(14,'赌徒硬币','暴击率 +100%，被暴击率 +100%。',2,'holder',{passive:passive([mod('赌徒硬币',[{stat:'crit',flat:1},{stat:'crit_taken',multiplier:2}])])}),
 R(15,'预支借据','取得时立刻获得 6000 待结算 FP；此后每下一层 FP −1000（可为负）。',3,'team',{droppable:false,grantFp:6000,hooks:{fpPerDescend:-1000}}),
 R(16,'长明灯','探索中每走 20 步全队回复 5% 最大 HP。',1,'team',{hooks:{stepsHeal:{steps:20,fraction:.05}}}),
 R(17,'重甲','防御 ×2，速度 ×0.7。',1,'holder',{passive:passive([mod('重甲',[{stat:'armor_physical',multiplier:2},{stat:'armor_energy',multiplier:2},{stat:'armor_mental',multiplier:2},{stat:'speed',multiplier:.7}])])}),
 R(18,'薄刃','暴击率 +30%，暴击倍率 +0.5，最大 HP ×0.7。',2,'holder',{passive:passive([mod('薄刃',[{stat:'crit',flat:.3},{stat:'crit_multiplier',flat:.5},{stat:'max_hp',multiplier:.7}])])}),
 R(19,'静默指环','免疫沉默与眩晕；最大 MP ×0.7。',1,'holder',{passive:passive([rule('immune_status','silence'),rule('immune_status','stun'),mod('静默指环',[{stat:'max_mp',multiplier:.7}])])}),
 R(20,'回响之弦','每场战斗中第三次使用同一技能时，该次费用为 0。',1,'holder',{passive:passive([rule('nth_use_free','3')])}),
 R(21,'逆位沙漏','每场战斗开始时行动条置满（先手）；每场战斗结束时失去 10% 最大 HP。',2,'holder',{passive:withLib([{op:'atb',mode:'set',value:100}],{actions:{toll:act([{op:'resource',resource:'hp',mode:'subtract',amount:pct('hp',.1),lethal:false}])}},[trig('toll','battle_end','toll')])}),
 R(22,'月光水壶','每场战斗结束后回复 30% 最大 HP 与 MP。',1,'holder',{passive:withLib([],{actions:{sip:act([{op:'heal',resource:'hp',amount:pct('hp',.3)},{op:'heal',resource:'mp',amount:pct('mp',.3)}])}},[trig('sip','battle_end','sip')])}),
 R(23,'铁胃','药剂效果 ×2；每层恢复药 +1。',2,'team',{hooks:{potionMul:2,potionsPerLayer:1}}),
 R(24,'免战通行证','本层的巡游敌群不会主动追击（视野归零）；宝箱出现率 −4%。',1,'team',{hooks:{vision:0,chestRate:-.04}}),
 R(25,'门票撕角','每层第 1 场战斗不掉落任何东西；之后每场素材掉率 +15%（层内累计）。',2,'team',{hooks:{firstFightNoDrop:true,layerMaterialRamp:.15}}),
 R(26,'阴影斗篷','普通敌人视野 ×0.5；速度 ×1.1。',1,'holder',{hooks:{vision:.5},passive:passive([mod('阴影斗篷',[{stat:'speed',multiplier:1.1}])])}),
 R(27,'血税印','技能不再消耗 MP，改为消耗等量 HP（不可致死）。',2,'holder',{passive:passive([rule('blood_tax','*')])}),
 R(28,'学徒笔记','战斗胜利经验 ×1.5，FP 收益 ×0.7。',2,'team',{hooks:{expMul:1.5,fpMul:.7}}),
 R(29,'收藏家目录','获得的盲盒品质提升一档（上限神话）；FP 收益 −50%。',2,'team',{hooks:{boxQualityUp:1,fpMul:.5}}),
 R(30,'空腹护身符','HP 低于 50% 时攻击力 ×1.5；HP 高于 50% 时 ×0.8。',1,'holder',{passive:passive([rule('hp_gate_damage','1.5|0.8|0.5')])}),
 R(31,'满腹护身符','HP 高于 80% 时全属性 ×1.2；低于 80% 时 ×0.9（随血线实时切换）。',1,'holder',{passive:passive([rule('hp_gate_attrs','1.2|0.9|0.8')])}),
 R(32,'复读机','每场战斗第一次使用的技能会在下一轮自动再放一次（免费，目标不变）。',2,'holder',{passive:passive([rule('echo_first','*')])}),
 R(33,'火种','所有攻击附加火属性；受到的火属性伤害 ×1.5。',1,'holder',{passive:passive([rule('element_rewrite','*|火'),mod('火种',[{stat:'element',element:'火',multiplier:1.5}])])}),
 R(34,'寒露','所有攻击附加水属性；速度 ×0.9。',1,'holder',{passive:passive([rule('element_rewrite','*|水'),mod('寒露',[{stat:'speed',multiplier:.9}])])}),
 R(35,'避雷针','免疫雷（光）属性伤害；宝箱出现率 −2%。',1,'holder',{hooks:{chestRate:-.02},passive:passive([rule('immune_element','光')])}),
 R(36,'誓约之锁','不能逃跑；战斗胜利时该场掉落的 FP（若有）+30%。',2,'team',{transferable:false,hooks:{noFlee:true,battleFpMul:1.3}}),
 R(37,'逃生绳','普通逃跑成功率 100%（对「?」与宝箱怪仍无效）；每次逃跑 FP −200。',1,'team',{hooks:{fleeSure:true,fleeCost:200}}),
 R(38,'石像鬼','防御 ×3，无法行动；受到伤害时对攻击者反击 50%。',2,'holder',{passive:withLib([mod('石像鬼',[{stat:'armor_physical',multiplier:3},{stat:'armor_energy',multiplier:3},{stat:'armor_mental',multiplier:3}]),rule('sealed','*')],{actions:{spite:act([{op:'damage',amounts:{physical:{...flat(0),eventFraction:.5},energy:flat(0),mental:flat(0),true:flat(0)},element:'none',hitChance:1,hitRule:'guaranteed',critChance:0,critMultiplier:1,targeting:EVENT_SOURCE} as EffectSpec],'enemy')}},[trig('spite','damage_received','spite')])}),
 R(39,'生锈钥匙','每层宝箱必定出现（普通 / 宝箱怪各半不变）；全队全属性 ×0.9。',2,'team',{hooks:{chestForce:true},passive:passive([mod('生锈钥匙',attrMods(.9))])}),
 R(40,'献祭之刃','持有者每击杀一个敌人，本次迷宫中最大 HP 上限 +3%（可叠加）。',2,'holder',{passive:withLib([],{statuses:{feast:status('献祭',{scope:'run',duration:{clock:'exploration_time',value:1e9},stack:'stack',maxStacks:999,modifiers:[{stat:'max_hp',multiplier:1.03}]})},actions:{feast:act([{op:'apply_status',status:'feast'}])}},[trig('feast','kill','feast')])}),
 R(41,'双生镜','最大 HP ×0.5；每场战斗一次致命伤免死并回复 50%。',3,'holder',{passive:passive([mod('双生镜',[{stat:'max_hp',multiplier:.5}]),rule('death_guard','*',{uses:1,amount:pct('hp',.5)})])}),
 R(42,'惰性齿轮','每轮第一次行动费用 ×0.5，之后的行动费用 ×2。',1,'holder',{passive:passive([rule('gear_cost','0.5|2')])}),
 R(43,'蜂鸣器','遇敌时敌方全员行动条 −50；每层敌群 +1。',2,'team',{hooks:{extraGroups:1},passive:passive([{op:'atb',mode:'retreat',value:50,targeting:ALL_ENEMIES}])}),
 R(44,'白纸','无属性伤害 ×1.5（对「?」仍无效）；其他属性伤害 ×0.8。',1,'holder',{passive:passive([rule('type_scale','无|1.5|0.8')])}),
 R(45,'债主账本','每场战斗胜利 FP +100；每下一层 FP −300。',1,'team',{hooks:{fpPerVictory:100,fpPerDescend:-300}}),
 R(46,'忍耐之环','受到的持续伤害（中毒 / 燃烧 / 流血等 tick）×0.5；受到的直接伤害 ×1.1。',1,'holder',{passive:passive([rule('dot_scale','0.5|1.1')])}),
 R(47,'棱镜','受到的有属性伤害 ×0.7，受到的无属性伤害 ×1.5。',2,'holder',{passive:passive([rule('taken_type_scale','无|1.5|0.7')])}),
 R(48,'招魂铃','队友倒下时立刻以 30% HP 复活（每场一次），持有者失去 30% 最大 HP。',3,'holder',{passive:withLib([],{actions:{knell:act([{op:'revive',amount:{...flat(0),subject:'target',maxResource:'hp',maxFraction:.3},targeting:{side:'event_target',selection:'all',life:'downed'}},{op:'resource',resource:'hp',mode:'subtract',amount:pct('hp',.3),lethal:false,targeting:{side:'self',selection:'all',life:'alive'}}],'ally')}},[trig('knell','after_down','knell',{scope:'ally',uses:1})])}),
 R(49,'磨刀石','每场战斗每轮攻击力 +5%（上限 +50%）。',1,'holder',{passive:withLib([],{statuses:{whet:status('磨砺',{stack:'stack',maxStacks:10,modifiers:dmgMods(1.05)})},actions:{whet:act([{op:'apply_status',status:'whet'}])}},[trig('whet','round','whet')])}),
 R(50,'迷雾灯笼','每层第一场战斗前敌人不主动追击全队；持有者在每场战斗第一轮无法被敌方单体技能选中。',2,'team',{hooks:{firstFightStealth:true},passive:passive([rule('untargetable','*',{duration:round(1)})])}),
 R(51,'兽笼','精英出现率 ×2；精英战素材掉落率 +50%。',2,'team',{hooks:{eliteBoost:true,eliteMaterialRate:1.5}}),
 R(52,'骰子袋','每场战斗开始时公开掷骰：全属性 ×1.5 / ×0.7 / 速度 ×2 / 防御 ×2。',2,'holder',{passive:withLib([{op:'choose',actions:['d1','d2','d3','d4'],count:1,replace:false}],{actions:{d1:act([mod('骰·强',attrMods(1.5))]),d2:act([mod('骰·弱',attrMods(.7))]),d3:act([mod('骰·疾',[{stat:'speed',multiplier:2}])]),d4:act([mod('骰·固',[{stat:'armor_physical',multiplier:2},{stat:'armor_energy',multiplier:2},{stat:'armor_mental',multiplier:2}])])}})}),
 R(53,'补给员的名片','每层必定出现补给员；商店价格 ×0.8；每层敌群 +1。',2,'team',{hooks:{supplierForced:true,shopDiscount:.8,extraGroups:1}}),
 R(54,'灰烬骨灰','战斗胜利时敌方每一个剩余负面状态转为 50 FP。',1,'team',{hooks:{ashFp:50}}),
 R(55,'誓血','每次施放技能失去 5% 最大 HP；技能伤害 ×1.4。',2,'holder',{passive:withLib([mod('誓血',dmgMods(1.4))],{actions:{bleed:act([{op:'resource',resource:'hp',mode:'subtract',amount:pct('hp',.05),lethal:false}])}},[trig('bleed','after_cost','bleed')])}),
 R(56,'破戒','免疫所有控制与负面状态；每次被这类效果命中时失去当前 HP 的 10%。',3,'holder',{passive:passive([rule('immune_status','negative'),rule('control_tax','0.1')])}),
 R(57,'哑铃','全属性 +20%，速度 ×0.6。',1,'holder',{passive:passive([mod('哑铃',[...attrMods(1.2),{stat:'speed',multiplier:.6}])])}),
 R(58,'绷带','战斗结束后回复 30% 最大 HP；战斗中受到的治疗 ×0.5。',1,'holder',{passive:withLib([mod('绷带',[{stat:'heal_received',multiplier:.5}])],{actions:{wrap:act([{op:'heal',resource:'hp',amount:pct('hp',.3)}])}},[trig('wrap','battle_end','wrap')])}),
 R(59,'尾随者','来访者「?」在每个个位 9 的楼层必定出现；击败她额外 +1 盲盒。',3,'team',{transferable:false,hooks:{straySpawn:1,strayBonusBox:1}}),
 R(60,'空遗物盒','无效果；持有时遗物槽 +1（自身不占槽）。',1,'holder',{transferable:false,droppable:false,hooks:{slotBonus:1}}),
];
/** 0.41 商店限定遗物「学习装置」：不进入随机遗物池（RELIC_LIST），只在补给员商店出售，每趟限购一次。
 *  佩戴者近似离场——不参与战斗，但每场战斗胜利照常按参战者获得经验。全队都佩戴时仍会上场，避免无人可战。 */
export const LEARNING_DEVICE:RelicDef=R(61,'学习装置','佩戴者近似离场：不参与战斗，但每场战斗胜利照常获得经验；全队都佩戴时仍会上场。商店限定，每趟限购一次。',3,'holder');
export const LEARNING_DEVICE_PRICE=3000;
/** 0.41 商店随机遗物定价：按稀有度（优良/稀有/史诗），与药剂相同地随层数上浮、受商店折扣影响。 */
export const SHOP_RELIC_BASE={1:800,2:1500,3:2500} as const;
export const shopRelicPrice=(r:RelicDef,depth:number,discount:number)=>Math.round(SHOP_RELIC_BASE[r.rarity]*(1+depth/50)*discount);
export const RELIC_CATALOG:Record<string,RelicDef>=Object.fromEntries([...RELIC_LIST,LEARNING_DEVICE].map(r=>[r.id,r]));
export const RELIC_RARITY_LABEL={1:'优良',2:'稀有',3:'史诗'} as const;
