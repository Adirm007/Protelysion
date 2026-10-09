import {DELAYED_RETURN,CONTROL_GUARD} from '../compiler/examples';
/** P1 logic data, not new visual themes. All templates execute through the shared rule kernel. */
import {EMPTY_LIBRARY,type ActionSpec,type EffectSpec,type LibrarySpec,type StatusSpec,type TargetSpec,type TriggerSpec} from '../compiler/contract';
import {flat} from './content';
const forever={clock:'permanent' as const,value:0},turn=(n:number)=>({clock:'target_action' as const,value:n}),seconds=(n:number)=>({clock:'battle_time' as const,value:n*1000});
export const targeting=(side:TargetSpec['side'],selection:TargetSpec['selection']='manual',count=1):TargetSpec=>({side,selection,count,life:'alive'});
export const action=(effects:EffectSpec[],side:ActionSpec['target']='self',cost=0):ActionSpec=>({target:side,cost:{hp:{flat:0,maxFraction:0},mp:{flat:cost,maxFraction:0},sp:{flat:0,maxFraction:0}},castMs:0,recoveryFactor:1,perBattleUses:0,effects});
const hit=(n:number,channel:'physical'|'energy'|'mental'|'true'='physical'):EffectSpec=>({op:'damage',amounts:{physical:flat(channel==='physical'?n:0),energy:flat(channel==='energy'?n:0),mental:flat(channel==='mental'?n:0),true:flat(channel==='true'?n:0)},element:'none',hitChance:1,hitRule:'guaranteed',critChance:0,critMultiplier:1});
function status(name:string,overrides:Partial<StatusSpec>={}):StatusSpec{return {name,tags:[name],polarity:'positive',duration:turn(3),stack:'refresh',maxStacks:1,scaleWithStacks:true,priority:0,dispellable:true,removeOnDeath:false,scope:'battle',...overrides};}
export function mechanismLibrary():LibrarySpec{
 const lib=EMPTY_LIBRARY();
 lib.actions.poison_tick=action([{...hit(8,'true'),lethal:true} as EffectSpec],'enemy');
 lib.actions.fire_tick=action([{...hit(10,'energy'),element:'火'} as EffectSpec],'enemy');
 lib.actions.regen_tick=action([{op:'heal',resource:'hp',amount:flat(12)}],'ally');
 lib.actions.mana_tick=action([{op:'heal',resource:'mp',amount:flat(8)}],'ally');
 lib.actions.stamina_tick=action([{op:'heal',resource:'sp',amount:flat(8)}],'ally');
 for(const [id,name,clock,interval] of [['poison','中毒','battle_time',1000],['fire','燃烧','battle_time',1000],['regen','再生','target_action',1],['mana','回蓝','target_action',1],['stamina','回体','target_action',1]] as const)lib.statuses[id]=status(name,{polarity:['poison','fire'].includes(id)?'negative':'positive',duration:clock==='battle_time'?seconds(4):turn(3),tick:{interval,clock,action:id+'_tick',count:3}});
 lib.statuses.bleed=status('流血',{polarity:'negative',stack:'stack',maxStacks:5,scaleWithStacks:true,tick:{interval:1,clock:'target_action',action:'poison_tick',count:3}});
 lib.statuses.corrosion=status('腐蚀',{polarity:'negative',modifiers:[{stat:'armor_physical',multiplier:.7}],tick:{interval:1000,clock:'battle_time',action:'poison_tick',count:3},duration:seconds(4)});
 for(const control of ['stun','freeze','silence','bind','sleep','fear','confusion','charm','taunt','hidden','mark','guard'] as const)lib.statuses[control]=status(control,{control,polarity:['hidden','guard'].includes(control)?'positive':'negative',duration:['stun','freeze','sleep'].includes(control)?seconds(2):turn(2),breakOnDamage:control==='sleep'});
 lib.actions.counter=action([hit(18)],'enemy');
 lib.actions.repair=action([{op:'heal',resource:'hp',amount:flat(24)},{op:'heal',resource:'mp',amount:flat(8)}]);
 lib.actions.echo=action([{...hit(15,'mental'),targeting:targeting('event_target')} as EffectSpec],'enemy');
 lib.actions.ward=action([{op:'shield',amount:flat(22),channels:['physical','energy','mental'],duration:forever}]);
 lib.actions.revenge=action([{...hit(20,'true'),targeting:targeting('event_source')} as EffectSpec],'enemy');
 lib.actions.summon_strike=action([hit(12)],'enemy');
 lib.actions.summon_heal=action([{op:'heal',resource:'hp',amount:flat(15)}],'ally');
 lib.actions.summon_revive=action([{op:'revive',amount:{...flat(0),subject:'target',maxResource:'hp',maxFraction:.25},targeting:{...targeting('owner'),life:'downed'}}],'ally',10);
 lib.statuses.reactive=status('镜面反应',{duration:forever,reactions:[{kind:'reflect',fraction:.25,basis:'actual',uses:0}]});
 lib.statuses.guardian=status('伤害分担',{duration:forever,reactions:[{kind:'share',fraction:.4,target:'source',allowArea:true}]});
 lib.statuses.last_stand=status('不屈',{duration:forever,reactions:[{kind:'death_guard',fraction:.1,uses:1,priority:10}]});
 lib.statuses.parry=status('招架',{reactions:[{kind:'parry',fraction:1,chance:.25},{kind:'counter',action:'counter',basis:'actual'}]});
 lib.statuses.vampire=status('汲取',{reactions:[{kind:'lifesteal',fraction:.2,basis:'actual'},{kind:'manasteal',fraction:.05,basis:'actual'}]});
 lib.statuses.fire_field=status('焰域',{duration:{clock:'field',value:0},modifiers:[{stat:'element',element:'火',multiplier:.6},{stat:'damage_energy',multiplier:1.15}]});
 lib.statuses.no_heal_field=status('抑制环境',{duration:{clock:'field',value:0},modifiers:[{stat:'heal_received',multiplier:0}]});
 lib.summons.familiar={name:'临时页灵',level:'caster',inheritance:.2,resources:{hp:20,mp:25,sp:20},attributes:{力量:2,敏捷:3,体质:2,智力:2,精神:2},actions:['summon_strike','summon_heal'],duration:seconds(20),ownerDeath:'despawn',limit:2,rewardEligible:false};
 lib.summons.soul={...lib.summons.familiar,name:'守魂替身',actions:['summon_revive','summon_strike'],ownerDeath:'persist',limit:1};
 lib.fields.fire={name:'火焰场域',group:'weather',priority:2,stack:'strongest',targeting:targeting('ally','all'),status:'fire_field',duration:seconds(10),element:'火'};
 lib.fields.suppression={name:'禁疗环境',group:'weather',priority:3,stack:'replace',targeting:targeting('enemy','all'),status:'no_heal_field',duration:seconds(5)};
 return lib;
}
export const ABILITY_SAMPLES:Record<string,ActionSpec>={
 mixed_ratio:action([{...hit(20),amounts:{physical:{...flat(20),attribute:'力量',factor:10,scale:'host_tier'},energy:{...flat(0),subject:'target',maxResource:'hp',maxFraction:.05},mental:{...flat(0),subject:'target',lostResource:'hp',lostFraction:.1},true:{...flat(0),subject:'target',currentResource:'hp',currentFraction:.03}}} as EffectSpec],'enemy',10),
 volley:action([{...hit(60),hits:3,powerMode:'split_total',targeting:{...targeting('enemy','random',3),allowRepeat:true}} as EffectSpec],'enemy',6),
 combo:action([{...hit(20),hits:3,powerMode:'per_hit'} as EffectSpec],'enemy',5),
 healing_surge:action([{op:'heal',resource:'hp',amount:{...flat(30),subject:'target',maxResource:'hp',maxFraction:.1},overflowShield:true,targeting:targeting('ally','all')}],'ally',8),
 life_exchange:action([{op:'resource',resource:'hp',mode:'exchange',other:'mp',amount:{...flat(0),currentResource:'hp',currentFraction:.2},ratio:2,lethal:false}]),
 mana_burn:action([{op:'resource',resource:'mp',mode:'burn',amount:flat(20),ratio:2,lethal:true}],'enemy'),
 charge_ward:action([{op:'shield',amount:flat(999),charges:2,channels:['physical','energy','mental'],duration:turn(3)}]),
 sunder:action([{op:'remove_shield',count:2},{...hit(20),penetration:.5} as EffectSpec],'enemy',5),
 empower:action([{op:'modify',name:'临时强健',duration:turn(3),modifiers:[{stat:'力量',multiplier:1.25},{stat:'max_hp',flat:40},{stat:'check_strength',flat:2},{stat:'cost_sp',multiplier:.8}]}]),
 poison:action([{op:'apply_status',status:'poison'}],'enemy',4),
 purify:action([{op:'dispel',mode:'remove',polarity:'negative',count:2,stacks:2}],'ally',4),
 steal:action([{op:'dispel',mode:'steal',polarity:'positive',count:1}],'enemy',5),
 regen:action([{op:'apply_status',status:'regen'},{op:'apply_status',status:'mana'},{op:'apply_status',status:'stamina'}],'ally',8),
 interrupt:action([{op:'cast',mode:'interrupt',value:0},{op:'apply_status',status:'silence'}],'enemy',3),
 haste:action([{op:'atb',mode:'push',value:35,targeting:targeting('ally','all')},{op:'cast',mode:'accelerate',value:500,targeting:targeting('ally','all')}],'ally',4),
 extra:action([{op:'atb',mode:'extra',value:1}], 'self',10),
 reset:action([{op:'uses',mode:'reset',skill:'*',value:0}],'ally',15),
 react:action([{op:'apply_status',status:'parry'},{op:'apply_status',status:'reactive'},{op:'apply_status',status:'vampire'}]),
 share:action([{op:'apply_status',status:'guardian'}],'ally',5),
 undying:action([{op:'apply_status',status:'last_stand'}]),
 revive: {...action([{op:'revive',amount:{...flat(0),subject:'target',maxResource:'hp',maxFraction:.3}}],'ally',20),targeting:{...targeting('ally'),life:'downed'}},
 execution:action([{...hit(9999,'true'),execute:true,priority:20} as EffectSpec],'enemy',30),
 familiar:action([{op:'summon',template:'familiar',count:1,mode:'summon'}],'self',10),
 clone:action([{op:'summon',template:'familiar',count:1,mode:'clone'}],'self',15),
 substitute:action([{op:'summon',template:'soul',count:1,mode:'substitute'}],'self',15),
 recall:action([{op:'recall',ownerOnly:true}]),
 weather:action([{op:'field',field:'fire'}],'self',12),
 no_heal:action([{op:'field',field:'suppression'}],'self',12),
 stop_time:action([{op:'time',mode:'stop',key:'stop',duration:seconds(2),restore:[],targeting:targeting('enemy','all')}],'enemy',20),
 snapshot:action([{op:'time',mode:'snapshot',key:'anchor',restore:['resources','statuses','atb','position']}]),
 rewind:action([{op:'time',mode:'rewind',key:'anchor',restore:['resources','statuses','atb','position']}],'self',10),
 delayed_echo:action([{op:'time',mode:'delay',key:'echo',duration:seconds(2),action:'echo',restore:[]}],'enemy',8),
 isolate:action([{op:'space',mode:'isolate',value:0,duration:seconds(3)}],'enemy',8),
 displacement:action([{op:'space',mode:'move',value:3},{op:'atb',mode:'retreat',value:20}],'enemy'),
 copy:action([{op:'copy',mode:'skill',id:'counter',duration:turn(3)}],'enemy',5),
 fire_law:action([{op:'rule',rule:'immune_element',key:'火',duration:turn(3),priority:30},{op:'field',field:'fire'}],'self',20),
 causality:action([{op:'rule',rule:'causality',key:'guaranteed_hit',duration:turn(2),uses:1,priority:20}]),
 sealing:action([{op:'rule',rule:'seal_category',key:'spell',duration:turn(2),priority:20}],'enemy',10),
 scout:action([{op:'explore',kind:'reveal',value:1,duration:forever},{op:'explore',kind:'sense_chest',value:1,duration:forever},{op:'explore',kind:'stealth',value:.5,duration:{clock:'exploration_time',value:30000}}]),
 omen:action([{op:'explore',kind:'event_option',value:1,duration:forever},{op:'explore',kind:'danger_reduction',value:.3,duration:forever}]),
};
for(const k of ['stun','freeze','silence','bind','sleep','fear','confusion','charm','taunt','hidden','mark','guard','bleed','corrosion'])ABILITY_SAMPLES[k]=action([{op:'apply_status',status:k}],['hidden','guard'].includes(k)?'ally':'enemy',5);
for(const [id,a] of Object.entries(ABILITY_SAMPLES)){a.name=id;a.description='机制逻辑样例：'+id;a.library=mechanismLibrary();}
ABILITY_SAMPLES.delayed_return=structuredClone(DELAYED_RETURN);ABILITY_SAMPLES.control_guard=structuredClone(CONTROL_GUARD);
/** 0.36：遗物目录迁到 relic-catalog.ts（声明式 60 条）。 */
export {RELIC_CATALOG,RELIC_LIST,type RelicDef as RelicDefinition} from './relic-catalog';
export type EventRequirement={kind:'resource'|'relic'|'flag'|'exploration'|'relic_any'|'fp'|'box'|'depth'|'party';key:string;amount:number};
export type EventResult={kind:'effect';action:ActionSpec}|{kind:'relic';choices:string[]}|{kind:'reward';reward:'box'|'fp'|'voucher';amount:number;quality?:string}|{kind:'encounter';strength:number}|{kind:'next';id:string}|{kind:'flag';id:string}
 /** 0.36 新增 */
 |{kind:'fp';mode:'add'|'scale'|'clear';amount:number}|{kind:'box';count:number;quality?:string}|{kind:'heal_all';fraction:number}|{kind:'cleanse_all'}|{kind:'teleport';range:number}
 |{kind:'relic_random';rarity?:1|2|3}|{kind:'relic_grant';id:string}|{kind:'relic_transform'}|{kind:'relic_pick';mode:'sacrifice'|'copy'|'sell';attrs?:number;perRarity?:number}
 |{kind:'encounter_tier';tier:'normal'|'elite'|'boss';count:number;thenRelic?:number;thenFp?:number;thenBox?:number}|{kind:'item';id:'bell';count:number}
 |{kind:'battle_mod';fights:number;enemyDamage?:number;expMul?:number;materialRate?:number;enemyDouble?:boolean;thenRelic?:number}
 |{kind:'seal_skills'}|{kind:'member_pick';mode:'train'|'bloodpact'|'exit';attrs?:number}|{kind:'run_mod';member:'random'|'all';maxHp?:number;maxMp?:number;speed?:number}
 |{kind:'layer_mod';key:'noMaterials'|'noChase'|'eliteBounty'|'enemyAttrs'|'strayHaste';value:number;run?:boolean}|{kind:'potions';count:number;random?:boolean}|{kind:'swap_hp_mp'}|{kind:'stairs';skipNext?:boolean}|{kind:'chest_spawn'}|{kind:'withdraw'};
export type EventChoice={id:string;label:string;requirements:EventRequirement[];costs:{resource:'hp'|'mp'|'sp'|'fp';fraction:number;flat:number;lethal:boolean}[];results:EventResult[];risks?:{weight:number;results:EventResult[]}[]};
export type EventDefinition={id:string;theme:string;title:string;body:string;requirements:EventRequirement[];choices:EventChoice[]};
/** 0.36：事件目录迁到 event-catalog.ts（39 条，只经补给员接触）。 */
export {EVENT_CATALOG,EVENT_LIST} from './event-catalog';
