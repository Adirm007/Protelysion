import * as s from './schema';
import {Formula,MAX_ATTACK_BEATS} from './formula';
export {MAX_ATTACK_BEATS,ROUND_MS} from './formula';
export const EFFECT_VERSION='booksea-effects/2';
const opt=s.optional, num=s.number, text=s.text, en=s.enumeration, bool=s.boolean;
export const Resource=en(['hp','mp','sp']);
export const Attribute=en(['none','力量','敏捷','体质','智力','精神']);
export const Channel=en(['physical','energy','mental','true']);
/** 六属性伤害类型。无：所有单位倍率恒为1。旧元素名（冰/雷/风/土等）由执行器归并到六类，不再是独立类型。 */
export const DamageType=en(['物','火','水','暗','光','精','无']);
export type DamageTypeSpec=s.Infer<typeof DamageType>;
/** 抗性倍率仅五档；0仅限原文明确“无效/免疫”。 */
export const RESISTANCE_STEPS=[0,.5,1,1.5,2] as const;
export const Quality=en(['common','uncommon','rare','epic','legendary','mythic','unique']);
export const SourceFilter=s.object({qualities:opt(s.array(Quality,1,7)),excludeQualities:opt(s.array(Quality,1,7)),kinds:opt(s.array(en(['skill','equipment','race','status','ascension','item','law','system']),1,8)),tags:opt(s.array(text(100))),excludeTags:opt(s.array(text(100))),maxQuality:opt(Quality),delivery:opt(en(['targeted','area','any']))});
export const Amount=s.object({flat:num(-1e12),attribute:Attribute,factor:num(-1e12),scale:en(['flat','host_tier']),maxResource:en(['none','hp','mp','sp']),maxFraction:num(-100,100),subject:opt(en(['caster','target','event_source','event_target'])),resourceSubject:opt(en(['caster','target','event_source','event_target'])),currentResource:opt(Resource),currentFraction:opt(num(-100,100)),lostResource:opt(Resource),lostFraction:opt(num(-100,100)),eventFraction:opt(num(-100,100)),dependency:opt(text(200)),dependencyFactor:opt(num(-1e12)),minimum:opt(num(-1e12)),maximum:opt(num(-1e12)),expression:opt(Formula)});
export const Cost=s.object({flat:num(),maxFraction:num(0,1),currentFraction:opt(num(0,1))});
export const Duration=s.object({clock:en(['target_action','target_ready','battle_time','exploration_time','permanent','field','round']),value:num(0,1e12,true)});
/** 0.34：按累计伤害解除。received = 持有者累计受伤；dealt_to_source = 持有者对状态来源累计造成；source_received = 状态来源累计受伤。fraction 按被打者最大生命。 */
export const BreakAfterDamage=s.object({from:en(['received','dealt_to_source','source_received']),fraction:num(0,100)});
export const Targeting=s.object({anchor:opt(en(['caster','target','event_source','event_target'])),minTier:opt(num(1,7,true)),maxTier:opt(num(1,7,true)),side:en(['self','ally','enemy','any','owner','event_source','event_target']),selection:en(['manual','all','random','bounce','lowest_resource','highest_resource','nearest','highest_atb','highest_attack']),count:opt(num(1,64,true)),life:opt(en(['alive','downed','any'])),tags:opt(s.array(text(100))),excludeSelf:opt(bool()),allowRepeat:opt(bool()),ignoreRedirect:opt(bool()),range:opt(num()),ids:opt(s.array(text(200),1,64)),names:opt(s.array(text(200),1,64)),excludeTags:opt(s.array(text(100))),resource:opt(Resource),minLevel:opt(num()),maxLevel:opt(num())});
export const Condition=s.object({subject:opt(en(['caster','target','owner','event_source','event_target'])),kind:en(['resource','resource_ratio','status','tag','side','alive_count','kill_count','critical','shield','field','category','uses','dependency','phase','expression','event_tag','event_resource']),key:opt(text(200)),compare:opt(en(['eq','ne','lt','lte','gt','gte'])),value:opt(num(-1e12)),invert:opt(bool()),expression:opt(Formula),compareExpression:opt(Formula)});
export const Modifier=s.object({stat:en(['力量','敏捷','体质','智力','精神','max_hp','max_mp','max_sp','hit','evade','crit','crit_multiplier','armor_physical','armor_energy','armor_mental','reduction_physical','reduction_energy','reduction_mental','reduction_true','damage_physical','damage_energy','damage_mental','damage_true','heal_power','heal_received','cost_hp','cost_mp','cost_sp','cast_speed','recovery','penetration','vulnerability','element','speed','initiative','check_strength','check_agility','check_constitution','check_intelligence','check_spirit','crit_taken','atb_scale']),flat:opt(num(-1e12)),amount:opt(Amount),multiplier:opt(num(0,1e6)),element:opt(text(100))});
export const TriggerPoint=en(['battle_start','ready','before_action','after_cost','hit','damage_dealt','damage_received','shield_break','before_down','after_down','kill','action_end','battle_end','new_region','pickup','open_chest','use_item','tick','before_damage','before_heal','after_heal','before_status','after_status','before_cost','miss','blocked','round','death_prevented','action_resolved','shield_gained']);
export const Trigger=s.object({id:text(100),event:TriggerPoint,action:text(200),scope:en(['self','ally','enemy','any']),reset:opt(en(['battle','run','action'])),chance:opt(num(0,1)),conditions:opt(s.array(Condition)),priority:opt(num(-1e6,1e6)),uses:opt(num(0,10000,true)),cooldownMs:opt(num()),payCost:opt(bool())});
const common={scope:opt(en(['battle','run','host'])),targeting:opt(Targeting),conditions:opt(s.array(Condition)),priority:opt(num(-1e6,1e6)),tags:opt(s.array(text(100))),probability:opt(num(0,1)),presentation:opt(text(100)),requiresHit:opt(text(100)),independent:opt(bool())};
const effect=<const T extends Record<string,s.Schema<unknown>>>(shape:T)=>s.object({...common,...shape});
export const Damage=effect({op:s.literal('damage'),amounts:s.object({physical:Amount,energy:Amount,mental:Amount,true:Amount}),element:text(64),types:opt(s.array(DamageType,1,7)),perType:opt(bool()),hitChance:num(0,1),hitRule:en(['normal','guaranteed','impossible']),critChance:num(0,1),critMultiplier:num(1,100),lethal:opt(bool()),penetration:opt(num(0,1)),hits:opt(num(1,MAX_ATTACK_BEATS,true)),hitCountExpression:opt(Formula),maxHits:opt(num(1,MAX_ATTACK_BEATS,true)),hitGroup:opt(text(100)),onHitAction:opt(text(200)),bypass:opt(s.array(en(['shield','reduction','death_guard','immunity']),1,4)),powerMode:opt(en(['per_hit','split_total'])),execute:opt(bool()),drain:opt(s.object({resource:Resource,fraction:num(0,100),basis:en(['actual','raw'])}))});
export const Heal=effect({op:s.literal('heal'),resource:Resource,amount:Amount,overflowShield:opt(bool()),allowDead:opt(bool()),adaptive:opt(bool())});
export const Shield=effect({op:s.literal('shield'),amount:Amount,channels:s.array(Channel,1,4),duration:Duration,charges:opt(num(1,10000,true)),order:opt(num(-1e6,1e6)),ruleLevel:opt(num()),stack:opt(en(['refresh','independent','strongest']))});
export const Speed=effect({op:s.literal('speed'),name:text(100),multiplier:num(.001,1000),chance:num(0,1),duration:Duration,stack:en(['refresh','independent','strongest'])});
export const Armor=effect({op:s.literal('armor'),channel:en(['physical','energy','mental']),amount:Amount});
export const Reduction=effect({op:s.literal('reduction'),channel:en(['physical','energy','mental','true']),fraction:num(0,1)});
export const DamageBonus=effect({op:s.literal('damage_bonus'),channel:Channel,flat:num(-1e12),multiplier:num(0,1000)});
export const HealBonus=effect({op:s.literal('heal_bonus'),multiplier:num(0,1000)});
export const ElementResist=effect({op:s.literal('element_resist'),element:text(64),multiplier:num(0,1000)});
export const ResourceEffect=effect({op:s.literal('resource'),resource:Resource,amount:Amount,mode:en(['add','subtract','set','exchange','burn','swap']),other:opt(Resource),ratio:opt(num(0,100)),lethal:opt(bool())});
export const Modify=effect({op:s.literal('modify'),modifiers:s.array(Modifier,1),duration:Duration,name:text(100)});
export const ApplyStatus=effect({op:s.literal('apply_status'),status:text(200),stacks:opt(num(1,1000,true)),duration:opt(Duration),opposedAttribute:opt(Attribute),opposedDifficulty:opt(num(-1e12))});
export const Dispel=effect({op:s.literal('dispel'),filter:opt(SourceFilter),mode:en(['remove','steal','transfer']),recipient:opt(en(['caster','owner','lowest_ally','selected_other'])),polarity:en(['positive','negative','any']),status:opt(text(200)),source:opt(text(200)),count:opt(num(1,1000,true)),stacks:opt(num(1,1000,true)),includeUndispellable:opt(bool())});
export const RemoveShield=effect({op:s.literal('remove_shield'),count:opt(num(1,1000,true)),channel:opt(Channel)});
export const Atb=effect({op:s.literal('atb'),mode:en(['push','retreat','set','immediate','extra','end','rotate']),value:num(-100,1000),recoveryFactor:opt(num(0,100))});
export const Cast=effect({op:s.literal('cast'),mode:en(['interrupt','accelerate','delay','seal']),value:num(),category:opt(text(100)),duration:opt(Duration)});
/** selection：按目标的使用记录挑技能（0.31）；给出 selection 时 skill 只作占位（写 '*'），指令类（普攻/防御）不在候选内。 */
export const Uses=effect({op:s.literal('uses'),mode:en(['restore','spend','charge','seal','unseal','reset']),skill:text(200),value:num(0,10000,true),duration:opt(Duration),selection:opt(en(['used_latest','used_random','most_used']))});
export const Revive=effect({op:s.literal('revive'),amount:Amount,atb:opt(num(0,100))});
export const Summon=effect({op:s.literal('summon'),template:text(200),count:num(1,8,true),mode:en(['summon','clone','substitute'])});
export const Retreat=effect({op:s.literal('retreat')});
export const Recall=effect({op:s.literal('recall'),ownerOnly:opt(bool()),template:opt(text(200))});
export const Field=effect({op:s.literal('field'),field:text(200),remove:opt(bool())});
export const Time=effect({op:s.literal('time'),mode:en(['stop','delay','snapshot','rewind']),duration:opt(Duration),action:opt(text(200)),key:text(100),restore:s.array(en(['resources','statuses','atb','position']),0,4)});
/** freeze：隔离期间被隔离者身上其他状态 / 护盾 / 速度的计时全部暂停（0.35.1，T44 入库）。 */
export const Space=effect({op:s.literal('space'),mode:en(['isolate','move','swap','release','swap_pair']),value:num(-10000,10000),duration:opt(Duration),freeze:opt(bool())});
export const Copy=effect({op:s.literal('copy'),activate:opt(bool()),originalStats:opt(bool()),steal:opt(bool()),mode:en(['skill','status','passive']),id:text(200),duration:Duration,selection:opt(en(['named','used_latest','used_random','random'])),category:opt(text(100))});
export const Rule=effect({op:s.literal('rule'),rule:en(['immune_element','immune_channel','immune_status','immune_concept','immune_source','seal_category','guaranteed_hit','guaranteed_evade','causality','no_heal','death_guard','substitute','no_revive','luck','first_strike','undying','sealed','uninterruptible','untargetable','draft','repeat_seal','blank_page','buff_cap','debuff_cap','element_rewrite','percent_to_heal','true_reflect','nth_skill_scale','guard_first','nth_use_free','blood_tax','gear_cost','hp_gate_damage','hp_gate_attrs','echo_first','type_scale','taken_type_scale','dot_scale','control_tax']),key:text(200),duration:Duration,uses:opt(num(0,10000,true)),amount:opt(Amount),filter:opt(SourceFilter),onTrigger:opt(text(200)),selection:opt(en(['used_latest','used_random','most_used'])),breakAfterDamage:opt(BreakAfterDamage),absolute:opt(bool())});
export const Explore=effect({op:s.literal('explore'),kind:en(['reveal','sense_chest','stealth','danger_reduction','event_option']),value:num(),duration:Duration});
export const Sequence=effect({op:s.literal('sequence'),action:text(200),repeat:num(1,MAX_ATTACK_BEATS,true)});
export const Variable=effect({op:s.literal('variable'),key:text(200),mode:en(['set','add','random_int']),value:Formula,maximum:opt(Formula)});
export const Counter=effect({op:s.literal('counter'),key:text(200),mode:en(['set','add','clear']),value:Formula,reset:en(['battle','round','target_ready']),perTarget:opt(bool()),minimum:opt(num(-1e12)),maximum:opt(num(-1e12))});
export const Branch=effect({op:s.literal('branch'),when:s.array(Condition,1,32),then:text(200),otherwise:opt(text(200))});
export const Repeat=effect({op:s.literal('repeat'),action:text(200),count:Formula,limit:num(1,MAX_ATTACK_BEATS,true)});
export const Check=effect({op:s.literal('check'),attacker:Formula,defender:Formula,scale:num(.001,1e12),baseChance:num(0,1),minimumChance:opt(num(0,1)),maximumChance:opt(num(0,1)),advantage:opt(num(-1,1,true)),success:text(200),failure:opt(text(200)),result:opt(text(200))});
export const AlterEvent=effect({op:s.literal('alter_event'),mode:en(['cancel_action','cancel_effect','scale','set','damage_to_heal','heal_to_damage','redirect']),value:opt(Formula),recipient:opt(en(['caster','target','owner','event_source','event_target','random_any']))});
export const SourceKind=en(['skill','equipment','race','status','ascension','item','law','system']);
export const SourceEffect=effect({op:s.literal('source'),filter:opt(SourceFilter),passiveOnly:opt(bool()),mode:en(['suppress','restore','remove']),kinds:opt(s.array(SourceKind,1,8)),id:opt(text(400)),tag:opt(text(100)),selection:en(['all','random','first']),count:opt(num(1,64,true)),duration:Duration});
export const StatusTransform=effect({op:s.literal('status_transform'),filter:opt(SourceFilter),mode:en(['swap','invert_numeric','swap_pair']),polarity:en(['positive','negative','any']),includeUndispellable:opt(bool())});
/** Bounded choices, battle-local links and whole-action reflection; never arbitrary scripts. */
export const Choose=effect({op:s.literal('choose'),actions:s.array(text(200),1,32),count:num(1,MAX_ATTACK_BEATS,true),replace:bool(),weights:opt(s.array(num(0),1,32))});
export const Link=effect({op:s.literal('link'),mode:en(['life','sever','detach']),key:text(200),members:opt(Targeting),minimumMembers:opt(num(2,16,true)),duration:Duration,delayRounds:opt(num(1,100,true)),recovery:opt(s.object({hp:num(0,1),mp:num(0,1),sp:num(0,1)})),cleanse:opt(bool())});
export const Replay=effect({op:s.literal('replay'),originalStats:bool()});
export const Effect=s.union(Choose,Link,Replay,Variable,Counter,Branch,Repeat,Check,AlterEvent,SourceEffect,StatusTransform,Damage,Heal,Shield,Speed,Armor,Reduction,DamageBonus,HealBonus,ElementResist,ResourceEffect,Modify,ApplyStatus,Dispel,RemoveShield,Atb,Cast,Uses,Revive,Summon,Retreat,Recall,Field,Time,Space,Copy,Rule,Explore,Sequence);
export const Reaction=s.object({reflect:opt(num(0,100)),kind:en(['block','parry','counter','reflect','share','absorb','lifesteal','manasteal','death_guard','substitute','redirect','convert','damage_cap','resource_guard']),fromChannel:opt(Channel),toChannel:opt(Channel),direction:opt(en(['incoming','outgoing'])),fraction:opt(num(0,100)),flat:opt(num()),basis:opt(en(['actual','raw'])),chance:opt(num(0,1)),action:opt(text(200)),resource:opt(Resource),channels:opt(s.array(Channel)),element:opt(text(100)),uses:opt(num(0,10000,true)),priority:opt(num(-1e6,1e6)),target:opt(en(['source','owner','lowest_ally'])),allowArea:opt(bool()),amount:opt(Amount),reset:opt(en(['round','target_ready','battle'])),cancelEffects:opt(bool()),attacker:opt(Formula),defender:opt(Formula),checkScale:opt(num(.001)),advantage:opt(num(-1,1,true))});
export const Status=s.object({inverse:opt(text(200)),onExpire:opt(text(200)),name:text(100),tags:s.array(text(100)),polarity:en(['positive','negative','neutral']),duration:Duration,stack:en(['independent','refresh','stack','strongest','replace']),stackGroup:opt(text(200)),maxStacks:num(1,1000,true),scaleWithStacks:bool(),priority:num(-1e6,1e6),dispellable:bool(),removeOnDeath:bool(),scope:en(['battle','run','host']),modifiers:opt(s.array(Modifier)),triggers:opt(s.array(Trigger)),reactions:opt(s.array(Reaction)),control:opt(en(['stun','freeze','silence','bind','sleep','fear','confusion','charm','taunt','hidden','mark','guard','isolate','time_stop','petrify','knockdown','disarm','polymorph','no_action'])),breakOnDamage:opt(bool()),breakAfterDamage:opt(BreakAfterDamage),tick:opt(s.object({interval:num(1),clock:en(['battle_time','exploration_time','target_action','target_ready','round']),action:text(200),count:num(0,10000,true),payCost:opt(bool())}))});
const JointCost=s.object({targeting:Targeting,cost:s.object({hp:Cost,mp:Cost,sp:Cost}),minimumParticipants:num(1,64,true),insufficient:en(['reject','pay_remaining'])});
const actionFields={initiative:opt(en(['normal','absolute'])),perTargetUses:opt(num(1,1000,true)),jointCost:opt(JointCost),source:opt(s.object({id:text(400),kind:SourceKind,quality:opt(Quality),tags:opt(s.array(text(100))),priority:opt(num(-1e6,1e6))})),activation:opt(en(['always','battle_start','run_start'])),grantedActions:opt(s.array(text(200))),target:en(['enemy','ally','self']),cost:s.object({hp:Cost,mp:Cost,sp:Cost}),castMs:num(0,600000,true),recoveryFactor:num(0,100),perBattleUses:num(0,10000,true),effects:s.array(Effect,0,128),targeting:opt(Targeting),category:opt(text(100)),tags:opt(s.array(text(100))),payment:opt(en(['submit','resolve','hit'])),suicideCost:opt(bool()),refundOnInterrupt:opt(num(0,1)),copyable:opt(bool()),conditions:opt(s.array(Condition)),charges:opt(num(0,10000,true)),cooldown:opt(num(1,100,true)),name:opt(text(200)),description:opt(text(8000))};
export const CoreAction=s.object(actionFields);
export const SummonTemplate=s.object({name:text(100),level:en(['caster','fixed']),fixedLevel:opt(num(1,10000,true)),inheritance:num(0,100),resources:s.object({hp:num(),mp:num(),sp:num()}),attributes:s.object({力量:num(-1e12),敏捷:num(-1e12),体质:num(-1e12),智力:num(-1e12),精神:num(-1e12)}),actions:s.array(text(200),1),duration:Duration,ownerDeath:en(['despawn','persist','expire_after_action']),limit:num(1,8,true),rewardEligible:bool(),cloneResources:opt(s.object({hp:num(0,1),mp:num(0,1),sp:num(0,1)})),inheritPassives:opt(bool()),tags:opt(s.array(text(100))),
 /** 普通怪物模板：设置时属性与资源取该等级普通怪物面板（build 为怪物构型），inheritance 不再生效。 */
 panel:opt(s.object({build:en(['brute','hunter','caster','guard','swarm','spirit'])}))});
export const FieldTemplate=s.object({name:text(100),group:text(100),priority:num(-1e6,1e6),stack:en(['replace','strongest','independent']),targeting:Targeting,status:text(200),duration:Duration,element:opt(text(100))});
export const Library=s.object({actions:s.record(CoreAction),statuses:s.record(Status),summons:s.record(SummonTemplate),fields:s.record(FieldTemplate)});
export const Action=s.object({...actionFields,library:opt(Library),triggers:opt(s.array(Trigger))});
export const Fidelity=s.object({mode:en(['exact','equivalent','approximate']),summary:text(4000),changes:s.array(s.object({original:text(4000),implemented:text(4000),reason:text(2000)}),0,32),clauses:s.array(s.object({original:text(4000),implementation:text(4000)}),1,64)});
const MappingIdentity={fidelity:opt(Fidelity),sourceId:text(400),disposition:en(['active','passive','noncombat','unsupported']),reason:text(8000)};
export const Mapping=s.object({...MappingIdentity,action:s.nullable(Action),actions:opt(s.array(Action)),dependencies:opt(s.array(text(200)))});
export const PortableReply=s.object({version:s.literal(EFFECT_VERSION),mappings:s.array(s.object({...MappingIdentity,actionJson:text(500000)}),0,256)});
export const ModelReply=s.object({version:s.literal(EFFECT_VERSION),mappings:s.array(Mapping,0,256)});
export type SourceKindSpec=s.Infer<typeof SourceKind>;
export type SourceFilterSpec=s.Infer<typeof SourceFilter>;
export type QualitySpec=s.Infer<typeof Quality>;
export type AmountSpec=s.Infer<typeof Amount>;
export type DurationSpec=s.Infer<typeof Duration>;
export type EffectSpec=s.Infer<typeof Effect>;
export type ActionSpec=s.Infer<typeof Action>;
export type MappingSpec=s.Infer<typeof Mapping>;
export type ModelReplySpec=s.Infer<typeof ModelReply>;
export type TargetSpec=s.Infer<typeof Targeting>;
export type StatusSpec=s.Infer<typeof Status>;
export type ModifierSpec=s.Infer<typeof Modifier>;
export type TriggerSpec=s.Infer<typeof Trigger>;
export type ReactionSpec=s.Infer<typeof Reaction>;
export type LibrarySpec=s.Infer<typeof Library>;
export type ConditionSpec=s.Infer<typeof Condition>;
export const CAPABILITIES=Object.fromEntries((Effect.json.anyOf as Record<string,unknown>[]).map(x=>[((x.properties as Record<string,{enum?:string[]}>).op!.enum![0]),x]));
export const EMPTY_LIBRARY=():LibrarySpec=>({actions:{},statuses:{},summons:{},fields:{}});
export function validateAction(value:unknown):ActionSpec {
 const a=Action.parse(value),lib=a.library??EMPTY_LIBRARY();
 if(!a.effects.length&&!a.triggers?.length&&!a.grantedActions?.length)throw Error('空能力没有实际执行内容');
 if(!a.triggers?.length&&!a.grantedActions?.length&&a.effects.length&&a.effects.every(e=>e.op==='damage'&&Object.values(e.amounts).every(n=>!(n.flat||n.factor||n.maxFraction||n.currentFraction||n.lostFraction||n.eventFraction||n.dependency||n.expression))))throw Error('不能使用零伤害兜底伪装实际能力');
 const conditionsCheck=(cs:ConditionSpec[]|undefined)=>{for(const c of cs??[]){if(c.kind==='expression'&&!c.expression)throw Error('表达式条件缺少表达式');if(['resource','resource_ratio','event_resource'].includes(c.kind)&&!['hp','mp','sp'].includes(c.key??''))throw Error('资源条件必须明确hp/mp/sp');}};conditionsCheck(a.conditions);
 const effectCheck=(effects:EffectSpec[])=>{for(const e of effects){conditionsCheck(e.conditions);if(e.op==='branch')conditionsCheck(e.when);
  if(e.op==='choose'){if(!e.replace&&e.count>e.actions.length)throw Error('不重复抽取数超过候选数');if(new Set(e.actions).size!==e.actions.length)throw Error('候选动作不能重复');for(const id of e.actions)if(!lib.actions[id])throw Error('随机候选动作缺失');}
  if(e.op==='rule'&&e.onTrigger&&!lib.actions[e.onTrigger])throw Error('规则触发动作缺失');
  if(e.op==='rule'&&e.rule==='immune_source'&&!e.filter)throw Error('来源免疫必须声明筛选范围');
  if(e.op==='link'&&e.mode==='life'&&(!e.members||e.members.selection!=='all'||!e.recovery||!e.recovery.hp||!e.minimumMembers||!e.delayRounds))throw Error('生命链接必须有确定成员筛选、至少2人、非零HP恢复及公共轮延迟');
  if(e.op==='link'&&!['permanent','round','battle_time'].includes(e.duration.clock))throw Error('链接只使用战斗时间/公共轮/本战永久');
  if(e.op==='copy'&&e.mode==='passive'&&!['round','battle_time'].includes(e.duration.clock))throw Error('整套被动复制/窃取必须有有限战斗时间或公共轮期限');
  if(e.op==='copy'&&(e.activate||e.originalStats)&&e.mode!=='skill')throw Error('即时借用与原数值仅适用于主动技能');
  if(e.op==='copy'&&e.steal&&e.mode!=='passive')throw Error('steal用于整套被动；状态转移使用status/dispel');
  if(e.op==='rule'&&e.rule==='causality'&&!['guaranteed_hit','guaranteed_evade','no_heal','death_guard'].includes(e.key))throw Error('因果键仅支持明确的命中、闪避、治疗阻断、死亡豁免及优先级，不执行任意叙述');
  if(e.op==='damage'&&(e.powerMode==='split_total'&&!e.hits&&!e.hitCountExpression))throw Error('分摊总威力必须声明段数');
  if(e.op==='damage'&&e.hitCountExpression&&!e.maxHits)throw Error('动态段数必须声明maxHits；整次技能最多24段');
  if(e.op==='damage'&&e.onHitAction&&!lib.actions[e.onHitAction])throw Error('逐段命中动作缺失');
  if(e.op==='repeat'&&!lib.actions[e.action])throw Error('循环动作缺失');
  if(e.op==='branch')for(const id of [e.then,e.otherwise].filter(Boolean))if(!lib.actions[id!])throw Error('条件分支动作缺失');
  if(e.op==='check')for(const id of [e.success,e.failure].filter(Boolean))if(!lib.actions[id!])throw Error('检定分支动作缺失');
  if(e.op==='check'&&e.minimumChance!==undefined&&e.maximumChance!==undefined&&e.minimumChance>e.maximumChance)throw Error('检定概率上下界错误');
  if(e.op==='variable'&&e.mode==='random_int'&&!e.maximum)throw Error('随机变量缺少最大值');
  if(e.op==='source'&&e.mode==='suppress'&&!['round','battle_time','permanent'].includes(e.duration.clock))throw Error('来源封锁只支持轮、战斗时间或本战永久');
  if(e.op==='apply_status'&&!lib.statuses[e.status])throw Error('缺少状态定义: '+e.status);
  if(e.op==='summon'&&!lib.summons[e.template])throw Error('缺少召唤模板');
  if(e.op==='field'&&!lib.fields[e.field])throw Error('缺少场域定义');
  if(e.op==='sequence'&&!lib.actions[e.action])throw Error('缺少引用动作: '+e.action);
  if(e.op==='time'&&['stop','delay'].includes(e.mode)&&(!e.duration||e.duration.value<=0))throw Error('时停/延迟必须有有限持续时间');
  if(e.op==='time'&&e.mode==='delay'&&(!e.action||!lib.actions[e.action]))throw Error('缺少延迟动作');
  if(e.op==='time'&&e.mode==='delay'&&['target_action','target_ready'].includes(e.duration!.clock)&&lib.actions[e.action!]!.effects.some(x=>x.op==='revive'))throw Error('倒地复活不能依赖死者自身行动，使用明确的公共轮或战斗时间');
  if(e.op==='space'&&e.mode==='isolate'&&!e.duration)throw Error('隔离缺少持续时间');
  if(e.op==='cast'&&e.mode==='seal'&&!e.duration)throw Error('施法封锁缺少持续时间');
  if(e.op==='resource'&&e.mode==='exchange'&&!e.other)throw Error('资源转化缺少目标资源');
 }};
 effectCheck(a.effects);for(const action of Object.values(lib.actions)){effectCheck(action.effects);conditionsCheck(action.conditions);}
 for(const status of Object.values(lib.statuses)){if(status.inverse&&!lib.statuses[status.inverse])throw Error('具名逆状态缺失');if(status.onExpire&&!lib.actions[status.onExpire])throw Error('状态到期动作缺失');if(['stun','freeze','sleep','time_stop','petrify','knockdown'].includes(status.control??'')&&['target_action','target_ready'].includes(status.duration.clock))throw Error('硬控不能依赖冻结者自己的行动时钟；声明round/战斗时间或显式外部解除');for(const r of status.reactions??[])if(['damage_cap','resource_guard'].includes(r.kind)&&r.channels&&r.channels.length<4||r.kind==='resource_guard'&&r.resource==='hp')throw Error('承伤预算/资源抵伤目前作用于全部通道；资源抵伤只允许MP/SP');if(status.tick&&!lib.actions[status.tick.action])throw Error('DOT/HOT动作缺失');for(const t of status.triggers??[])if(!lib.actions[t.action])throw Error('触发动作缺失');for(const r of status.reactions??[])if(r.action&&!lib.actions[r.action]||r.kind==='counter'&&!r.action)throw Error('反应动作缺失');}
 for(const t of a.triggers??[])if(!lib.actions[t.action])throw Error('触发动作缺失');
 for(const id of a.grantedActions??[])if(!lib.actions[id])throw Error('授予的动作缺失');
 for(const summon of Object.values(lib.summons))for(const id of summon.actions)if(!lib.actions[id])throw Error('召唤动作缺失');
 for(const field of Object.values(lib.fields))if(!lib.statuses[field.status])throw Error('场域状态缺失');
 const legacyVisit=(id:string,path:string[])=>{if(path.includes(id))throw Error('sequence不能同步循环');for(const e of lib.actions[id]!.effects)if(e.op==='sequence')legacyVisit(e.action,[...path,id]);};for(const id of Object.keys(lib.actions))legacyVisit(id,[]);
 const budget=(effects:EffectSpec[],path:string[]):number=>effects.reduce((sum,e)=>{
  const child=(id:string)=>{if(path.includes(id))throw Error('同步动作引用不能循环');if(path.length>16)throw Error('动作嵌套过深');return budget(lib.actions[id]!.effects,[...path,id]);};
  let n=0;if(e.op==='damage')n=(e.hits??e.maxHits??1)*(1+(e.onHitAction?child(e.onHitAction):0));
  if(e.op==='choose'){const counts=e.actions.map(child).sort((a,b)=>b-a);n=e.replace?e.count*counts[0]!:counts.slice(0,e.count).reduce((a,b)=>a+b,0);}
  if(e.op==='sequence')n=e.repeat*child(e.action);if(e.op==='repeat')n=e.limit*child(e.action);
  if(e.op==='branch')n=Math.max(child(e.then),e.otherwise?child(e.otherwise):0);if(e.op==='check')n=Math.max(child(e.success),e.failure?child(e.failure):0);
  if(sum+n>MAX_ATTACK_BEATS)throw Error('整次动作最多24段攻击，不能用sequence/repeat绕过；请明确披露压缩映射');return sum+n;
 },0);
 budget(a.effects,[]);for(const [id,x] of Object.entries(lib.actions))budget(x.effects,[id]);
 for(const x of [a,...Object.values(lib.actions)]){if(x.perTargetUses&&x.targeting&&x.targeting.selection!=='manual')throw Error('逐目标次数目前要求手动选择目标');if(x.jointCost&&x.jointCost.targeting.selection!=='all')throw Error('共同支付成员必须明确按all筛选，不能随机扣费');}
 return a;
}
