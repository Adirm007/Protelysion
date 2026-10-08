import {orderClaims,winsConflict,type ConflictLedger,type Claim} from './conflict';
import {isAlive,activeRule} from './presence';
export {isAlive} from './presence';
import {matchesSource,actionMetadata,type SourceMetadata} from './source-metadata';
import {reconcileLifeLinks,hasLinkedReturn,type LifeLink} from './life-links';
import {repairLegacyTargeting} from './targeting';
import {MAX_ATTACK_BEATS,MAX_EFFECT_STEPS,ROUND_MS,type FormulaSpec} from '../compiler/formula';
import type {SourceKindSpec} from '../compiler/contract';
import {elementKey,resolveDamageTypes,bestType,typeMultiplier,affinityLabel,DAMAGE_TYPES,type DamageType} from './elements';
import {bindLibrary} from '../compiler/library';
import {INTERLUDE_TAG} from '../compiler/examples';
import {tier,integer} from '../core/actors';
import {monsterNumbers} from '../game/monsters/numbers';
import type {MonsterDesign} from '../game/monsters/catalog';
import {EFFECT_VERSION,validateAction,EMPTY_LIBRARY,type ActionSpec,type EffectSpec,type AmountSpec,type DurationSpec,type TargetSpec,type StatusSpec,type ModifierSpec,type TriggerSpec,type LibrarySpec,type ConditionSpec,type ReactionSpec} from '../compiler/contract';
import type {CompiledActor} from '../compiler/engine';
import {CHANNELS,calculateDamage,roll,type Channel} from './damage';
import {advanceClock,clockPhase,completeAction,createClock,deactivateUnit,interruptCast,speedFactor,submitAction,type BattleClock} from './clock';
export type Resources={hp:number;mp:number;sp:number};
type OwnedModifier=ModifierSpec&{origin?:string};
type Timed={source?:string;origin?:string;suppressed?:boolean;id:string;clock:DurationSpec['clock'];remaining:number};
export type Ward=Timed&{amount:number;channels:Channel[];charges?:number;order?:number;priority?:number;source?:string};
type SpeedState=Timed&{multiplier:number};
export type Mitigation={armor:{physical:number;energy:number;mental:number};attributeReduction:{physical:number;energy:number;mental:number};elementMultipliers:Record<string,number>};
export type StateInstance=Timed&{sourceLevel?:number;sourceSpeed?:number;definitionId?:string;suppressed?:boolean;definition:StatusSpec;source:string;sourceKey:string;sourceRoot?:string;libraryOwner:string;stacks:number;tickLeft:number;tickCount:number;used:Record<string,number>;last:Record<string,number>;rule?:{declared?:number;kind:string;key:string;uses:number;amount:number;filter?:import('../compiler/contract').SourceFilterSpec;onTrigger?:string};modifiers?:ModifierSpec[];tally?:number};
type Base={attributes:CompiledActor['numeric']['attributes'];max:Resources;mitigation:Mitigation};
/** 0.21：不含敌方强加效果（imposedOn）的节奏、输出与消耗修正。 */
type UnitFree={speed:number;recovery:number;cast_speed:number;damage:Record<Channel,{flat:number;multiplier:number}>;cost:Record<string,{flat:number;multiplier:number}>};
export type Unit={free?:UnitFree;invuln?:Record<string,'perpetual'|'bounded'>;blanketImmunity?:boolean;lastStand?:Record<string,number>;banGrace?:Record<string,number>;negation?:{left:number;round:number;warned?:number};controlStreak?:Record<string,{acted:number;cmd?:string}>;acted?:number;zeroHpProtected?:boolean;deathSeal?:{owner:string;priority:number;root:number;ranking?:NonNullable<Battle['conflicts']>[number]};deathEvent?:{source:string;root:number;priority:number;execute:boolean};openingActions?:string[];passives?:Record<string,ActionSpec>;passiveCopies?:Record<string,{clock:DurationSpec['clock'];remaining:number;donor:string;sourceId:string}>;counters?:Record<string,{value:number;reset:'battle'|'round'|'target_ready'}>;sources?:Record<string,SourceMetadata>;sourceLocks?:Record<string,Timed&{removed:boolean;sourceId?:string;owner?:string;priority?:number}>;history?:string[];repeatSealed?:string[];roundActions?:number;echoUsed?:boolean;echoQueue?:{sourceId:string;targets:string[];round:number}[];targetUsed?:Record<string,number>;noRevivePriority?:number;id:string;name?:string;side:'ally'|'enemy';level:number;attributes:CompiledActor['numeric']['attributes'];max:Resources;current:Resources;actions:Record<string,ActionSpec>;used:Record<string,number>;mitigation:Mitigation;shields:Ward[];speeds:SpeedState[];passiveNames?:string[];damageBonus?:Partial<Record<Channel,{flat:number;multiplier:number}>>;healMultiplier?:number;base?:Base;statuses?:StateInstance[];library?:LibrarySpec;modifiers?:OwnedModifier[];stats?:Record<string,number>;tags?:string[];position?:number;dependencies?:Record<string,number>;kills?:number;owner?:string;summon?:{template:string;clock:DurationSpec['clock'];remaining:number;ownerDeath:string;rewardEligible:boolean};extraActions?:number;sealed?:Record<string,number>;sealClocks?:Record<string,DurationSpec['clock']>;cooling?:string[];charges?:Record<string,number>;copied?:Record<string,{clock:DurationSpec['clock'];remaining:number}>;hostStatesSeen?:string[];exploration?:{kind:string;value:number;clock:DurationSpec['clock'];remaining:number}[];deadHandled?:boolean;defeated?:boolean;retreatRequested?:boolean;escaped?:boolean};
type Command={id:string;caster:string;target:string;targets?:string[];sourceId:string;action:ActionSpec;paid?:Resources;paidBy?:Record<string,Resources>;paidTotal?:Resources;cancelled?:boolean};
type FieldInstance=Timed&{sourceRoot?:string;definition:string;owner:string;group:string;priority:number;status:string;targeting:TargetSpec;members:string[]};
type Scheduled={caster?:string;sourceRoot?:string;variables?:Record<string,number>;id:string;clock?:DurationSpec['clock'];remaining:number;owner:string;target:string;action:string;key:string};
type Snapshot={current:Resources;statuses:StateInstance[];atb:number;position:number};
export type Battle={version:1;conflicts?:ConflictLedger;lifeLinks?:LifeLink[];round?:number;exploration?:boolean;clock:BattleClock;units:Unit[];seed:number;nextCommand:number;commands:Record<string,Command>;outcome:'active'|'victory'|'defeat';log:{kind:string;unit:string;detail:string;value:number}[];fields?:FieldInstance[];scheduled?:Scheduled[];snapshots?:Record<string,Snapshot>;nextEvent?:number;readySeen?:string[];endedEmitted?:boolean;
 /** 间章:小憩（0.37.6）：到期公开回合开始时，该阵营所有存活成员必定撤离。 */
 interludes?:{due:number;side:'ally'|'enemy';caster:string}[]};
type EventContext={automatic?:boolean;unmitigated?:number;unmitigatedFor?:string;imposed?:Record<Channel,number>;lastStandCounted?:boolean;responseUses?:number;responseUnlimited?:boolean;responseProfile?:Claim['profile'];responseOwner?:string;replayDepth?:number;trace?:{action:ActionSpec;caster:string;power:Unit;libraryOwner:string;sourceRoot:string};frame?:Frame;resource?:keyof Resources;responsePriority?:number;commandId?:string;paid?:Resources;paidTotal?:Resources;converted?:boolean;status?:StatusSpec;statusId?:string;control?:{authority?:Claim;cancelled:boolean;scale:number;amount?:number;replacement?:'heal'|'damage';recipient?:string};point:string;source:string;target:string;raw:number;actual:number;critical:boolean;category:string;root:number;seen:string[];priority?:number;execute?:boolean};
type Context={powerCaster?:Unit;bypass?:('shield'|'reduction'|'death_guard'|'immunity')[];battle:Battle;caster:Unit;target:Unit;key:string;event:EventContext;action?:ActionSpec;libraryOwner?:string;sourceRoot?:string;scale?:number;area?:boolean;requested?:string[];hitCallback?:()=>boolean};
const RES=['hp','mp','sp'] as const,coeff=[2,2.8,4,8,15,35,80];
const ATTR=['力量','敏捷','体质','智力','精神'] as const;
const EPS=1e-7;
const clone=<T>(x:T):T=>structuredClone(x);
function unit(b:Battle,id:string):Unit {return b.units.find(x=>x.id===id)!;}
function clockUnit(b:Battle,id:string){return b.clock.units.find(x=>x.id===id)!;}
function log(b:Battle,kind:string,u:string,detail:string,value=0){b.log.push({kind,unit:u,detail,value});if(b.log.length>1000)b.log.shift();}
const timed=(id:string,d:DurationSpec):Timed=>({id,clock:d.clock,remaining:d.value});
const live=(x:Pick<Timed,'clock'|'remaining'>)=>x.clock==='permanent'||x.clock==='field'||x.remaining>EPS;
const emptyMitigation=():Mitigation=>({armor:{physical:0,energy:0,mental:0},attributeReduction:{physical:0,energy:0,mental:0},elementMultipliers:{}});
function event(b:Battle,source:string,target:string,point='effect'):EventContext{return {point,source,target,raw:0,actual:0,critical:false,category:'',root:b.nextEvent=(b.nextEvent??0)+1,seen:[]};}
function random(b:Battle){const r=roll(b.seed);b.seed=r.seed;return r.value;}
function subject(c:Context,which?:string):Unit {if(which==='target')return c.target;if(which==='owner')return unit(c.battle,c.caster.owner??c.caster.id);if(which==='event_source')return unit(c.battle,c.event.source)??c.caster;if(which==='event_target')return unit(c.battle,c.event.target)??c.target;return c.caster;}
function evaluateSubject(which:string,caster:Unit,target:Unit,ev?:EventContext,battle?:Battle):Unit{return which==='target'?target:which==='event_source'?unit(battle!,ev!.source):which==='event_target'?unit(battle!,ev!.target):caster;}
export function evaluateAmount(a:AmountSpec,caster:Unit,target=caster,ev?:EventContext,battle?:Battle):number {
 const source=a.subject==='target'?target:a.subject==='event_source'&&battle&&ev?unit(battle,ev.source):a.subject==='event_target'&&battle&&ev?unit(battle,ev.target):caster;
 const resourceSource=a.resourceSubject?evaluateSubject(a.resourceSubject,caster,target,ev,battle):source;
 let n=a.flat+(a.attribute==='none'?0:source.attributes[a.attribute]*a.factor*(a.scale==='host_tier'?coeff[Math.min(6,tier(Math.min(25,source.level))-1)]!:1))+(a.maxResource==='none'?0:resourceSource.max[a.maxResource]*a.maxFraction);
 if(a.currentResource)n+=resourceSource.current[a.currentResource]*(a.currentFraction??0);
 if(a.lostResource)n+=(resourceSource.max[a.lostResource]-resourceSource.current[a.lostResource])*(a.lostFraction??0);
 if(a.eventFraction)n+=(ev?.actual??0)*a.eventFraction;
 if(a.dependency){const v=source.dependencies?.[a.dependency];if(v===undefined)throw Error('缺少显式动态依赖: '+a.dependency);n+=v*(a.dependencyFactor??1);}
 if(a.expression)n+=readFormula(a.expression,caster,target,ev,battle);
 return Math.max(a.minimum??-Number.MAX_VALUE,Math.min(a.maximum??Number.MAX_VALUE,n));
}
const value=(a:AmountSpec,c:Context)=>evaluateAmount(a,c.powerCaster??c.caster,c.target,c.event,c.battle);
type Frame={owner?:string;budget:{beats:number;steps:number;root?:{steps:number}};variables:Record<string,number>;hits:number;misses:number;blocked:number;damage:number;raw:number;index:number;blockedTargets:Record<string,boolean>;groups:Record<string,number>;attempts:Record<string,number>};
const freshFrame=(budget?:Frame['budget']):Frame=>({budget:budget??{beats:0,steps:0},variables:{},hits:0,misses:0,blocked:0,damage:0,raw:0,index:0,blockedTargets:{},groups:{},attempts:{}});
function frame(c:Context){const f=c.event.frame??=freshFrame();f.owner??=c.caster.id;return f;}
function sourceEnabled(u:Unit|undefined,id:string|undefined){return !id||!Object.entries(u?.sourceLocks??{}).some(([key,lock])=>(lock.sourceId??key)===id&&live(lock));}
function refreshSourceLocks(b:Battle){for(const u of b.units){for(const [id,lock] of Object.entries(u.sourceLocks??{}))if(!live(lock))delete u.sourceLocks![id];for(const s of u.statuses??[])s.suppressed=!sourceEnabled(unit(b,s.source),s.sourceRoot);for(const x of [...u.shields,...u.speeds])x.suppressed=!sourceEnabled(unit(b,x.source??u.id),x.origin);}for(const link of b.lifeLinks??[])link.suppressed=!sourceEnabled(unit(b,link.owner),link.sourceRoot);}
function issuer(c:Context,priority=0):Claim{return {owner:c.event.responseOwner??c.caster.id,priority,...(c.event.responseProfile?{profile:c.event.responseProfile}:{})};}
function stateClaim(s:StateInstance):Claim{return {owner:s.source,priority:s.definition.priority,...(s.sourceLevel===undefined?{}:{profile:{level:s.sourceLevel,speed:s.sourceSpeed??1}})};}
function contest(c:Context,defense:Claim,priority=0,domain='effect'):boolean{
 const won=winsConflict(c.battle,String(c.event.root),issuer(c,priority),defense);
 if(c.caster.id!==defense.owner)log(c.battle,'conflict',won?c.caster.id:defense.owner,domain+':等级>速度>种子随机');
 return won;
}
function strongest(c:Context,states:StateInstance[]):StateInstance|undefined {
 return orderClaims(c.battle,String(c.event.root),states.map(state=>({...stateClaim(state),state})))[0]?.state;
}
const DECISIVE_RULES=new Set(['immune_status','immune_element','immune_channel']);
function opposingRule(c:Context,u:Unit,kind:string,key='',priority=0,wildcardOnly=false):StateInstance|undefined {
 const s=strongest(c,(u.statuses??[]).filter(s=>!s.suppressed&&live(s)&&s.rule?.kind===kind&&s.rule.uses!==0&&(wildcardOnly?s.rule.key==='*':s.rule.key===key||s.rule.key==='*')));
 // 0.36.1：absolute 规则（玩家遗物）不参加“等级>速度>随机”的跨来源裁决，直接生效。
 // 0.21：只认遗物来源；能力里写的 absolute（“无视一切”）照常按等级>速度>随机裁决。
 if(s&&s.definition.tags.includes('absolute')&&relicSourced(s))return s;
 // “免疫一切”类（key='*'）是决定性效果：只挡等级严格低于规则主人的来源；同级及以上不再按速度/随机裁决。
 if(s&&s.rule?.key==='*'&&DECISIVE_RULES.has(kind)){const owner=unit(c.battle,s.source),src=effectiveSource(c);const level=s.sourceLevel??owner?.level??u.level;
  // 变相常驻的“免疫一切”只挡低等级来源；有代价有空窗的正常技能对高等级同样生效。
  if(!boundedInvuln(c.battle,s)&&src.level>=level){if(src.id!==u.id)log(c.battle,'decisive_blocked',u.id,'免疫一切（变相常驻）只对低等级来源生效');return undefined;}
  // 与“必定造成伤害”冲突：等级>速度>随机。
  if(kind!=='immune_status'&&c.bypass?.includes('immunity'))return contest(c,stateClaim(s),priority,'必定伤害/免疫一切')?undefined:s;
  return s;}
 return s&&!contest(c,stateClaim(s),priority,kind)?s:undefined;
}
function reviveBlocked(c:Context,priority=0):boolean {
 const seal=c.target.deathSeal;
 // Immediate death responses reuse the lethal event; a later action is a fresh conflict with current speed.
 if(seal?.ranking&&c.event.root===seal.root&&!(c.battle.conflicts??[]).some(x=>x.key===String(seal.root))){c.battle.conflicts??=[];c.battle.conflicts.push(clone(seal.ranking));}
 if(seal&&!winsConflict(c.battle,String(c.event.root),issuer(c,priority),{...seal,...(seal.ranking?.profiles[seal.owner]?{profile:seal.ranking.profiles[seal.owner]}:{})}))return true;
 return !!opposingRule(c,c.target,'no_revive','*',priority);
}
function guardTriggered(c:Context,s:StateInstance,target:Unit){
 consumeRule(s);if(s.rule?.onTrigger){invoke({...c,caster:target,target,key:s.sourceKey,sourceRoot:s.sourceRoot,libraryOwner:s.libraryOwner,event:{...c.event,responseOwner:s.source,responseProfile:stateClaim(s).profile}},s.rule.onTrigger);}
 emit(c.battle,'death_prevented',{...c.event,target:target.id,source:c.caster.id});
}
function sourceKind(id:string):SourceKindSpec {if(id.startsWith('/装备/'))return 'equipment';if(id.startsWith('/种族'))return 'race';if(id.startsWith('/状态'))return 'status';if(id.startsWith('/登神'))return 'ascension';if(id.startsWith('/道具'))return 'item';return 'skill';}
function readFormula(expr:FormulaSpec,caster:Unit,target:Unit,ev:EventContext|undefined,b:Battle|undefined):number{
 const stack:number[]=[];
 for(const t of expr){let x=0;
  if('operator'in t){const right=stack.pop()!;if(t.operator==='abs')x=Math.abs(right);else if(t.operator==='neg')x=-right;else if(t.operator==='floor')x=Math.floor(right);else{const left=stack.pop()!;if(t.operator==='add')x=left+right;if(t.operator==='sub')x=left-right;if(t.operator==='mul')x=left*right;if(t.operator==='div'){if(right===0)throw Error('表达式不能除以零');x=left/right;}if(t.operator==='min')x=Math.min(left,right);if(t.operator==='max')x=Math.max(left,right);if(t.operator==='mod')x=right===0?0:left%right;}}
  else if('constant'in t)x=t.constant;
  else{
   const u=t.subject==='target'?target:t.subject==='owner'&&b?unit(b,caster.owner??caster.id):t.subject==='event_source'&&b&&ev?unit(b,ev.source):t.subject==='event_target'&&b&&ev?unit(b,ev.target):caster,k=t.key??'';
   if(!u)throw Error('表达式来源不存在');
   if(t.read==='round')x=b?.round??0;if(t.read==='attribute'){if(!(ATTR as readonly string[]).includes(k))throw Error('未知五维读取');x=u.attributes[k as typeof ATTR[number]];}
   if(['resource','max_resource','lost_resource','resource_ratio'].includes(t.read)){if(!(RES as readonly string[]).includes(k))throw Error('未知资源读取');const r=k as keyof Resources;x=t.read==='resource'?u.current[r]:t.read==='max_resource'?u.max[r]:t.read==='lost_resource'?u.max[r]-u.current[r]:u.current[r]/Math.max(1,u.max[r]);}
   if(t.read==='stat')x=k==='speed'?Math.sqrt(Math.max((b?.clock.units.find(v=>v.id===u.id)?.agility??u.attributes.敏捷)+(b?.clock.units.find(v=>v.id===u.id)?.speedBonus??0),1)/10)*(b?.clock.units.find(v=>v.id===u.id)?.haste??1):(u.stats?.[k]??0);
   if(t.read==='member_count')x=b?.units.filter(v=>(k==='owned'?v.owner===u.id:k==='ally'?v.side===u.side:k==='enemy'?v.side!==u.side:true)&&(!t.names||t.names.includes(v.name??v.id))&&(!t.tags||t.tags.every(tag=>v.tags?.includes(tag)||v.statuses?.some(s=>!s.suppressed&&s.definition.tags.includes(tag))))&&(t.life==='any'||(t.life==='downed'?!isAlive(v):isAlive(v)))).length??0;
   if(t.read==='level')x=u.level;if(t.read==='tier')x=tier(Math.min(25,u.level));
   if(t.read==='status_stacks')x=(u.statuses??[]).filter(s=>!s.suppressed&&(s.definition.name===k||s.definitionId===k||s.id===k||s.definition.tags.includes(k))).reduce((n,s)=>n+s.stacks,0);
   if(t.read==='status_kinds')x=new Set((u.statuses??[]).filter(s=>!s.suppressed&&(!k||k==='any'||s.definition.polarity===k)).map(s=>s.definition.name)).size;
   if(t.read==='shield')x=u.shields.filter(s=>!s.suppressed).reduce((n,s)=>n+s.amount,0);if(t.read==='distance')x=Math.abs((caster.position??0)-(target.position??0));
   if(t.read==='alive_count')x=b?.units.filter(v=>v.current.hp>0&&!v.escaped&&(k==='any'||v.side===(k==='enemy'?(u.side==='ally'?'enemy':'ally'):u.side))).length??0;
   if(t.read==='counter')x=u.counters?.[k]?.value??0;if(t.read==='counter_pair')x=u.counters?.[k+'@'+target.id]?.value??0;
   if(t.read==='variable')x=ev?.frame?.variables[k]??0;
   if(t.read==='dependency'){const v=u.dependencies?.[k];if(v===undefined)throw Error('缺少显式动态依赖: '+k);x=v;}
   if(t.read==='event'){const values:Record<string,number>={raw:ev?.raw??0,actual:ev?.actual??0,critical:Number(!!ev?.critical),hits:ev?.frame?.hits??0,misses:ev?.frame?.misses??0,blocked:ev?.frame?.blocked??0,total_damage:ev?.frame?.damage??0,hit_index:ev?.frame?.index??0,paid_hp:ev?.paid?.hp??0,paid_mp:ev?.paid?.mp??0,paid_sp:ev?.paid?.sp??0,paid_total_hp:ev?.paidTotal?.hp??0,paid_total_mp:ev?.paidTotal?.mp??0,paid_total_sp:ev?.paidTotal?.sp??0,status_negative:Number(ev?.status?.polarity==='negative'),status_priority:ev?.status?.priority??0,time_ms:b?.clock.timeMs??0,round:b?.round??0,pair_attempts:ev?.frame?.attempts[target.id]??0,distinct_attempted_targets:Object.keys(ev?.frame?.attempts??{}).length,pair_hits:Object.entries(ev?.frame?.groups??{}).filter(([key])=>key.endsWith('@'+target.id)).reduce((n,[,v])=>n+v,0),distinct_targets:new Set(Object.keys(ev?.frame?.groups??{}).map(k=>k.split('@').pop())).size,action_attacking:Number(ev?.trace?.action.effects.some(e=>e.op==='damage')),action_area:Number(ev?.trace?.action.targeting?.selection==='all')};if(!(k in values))throw Error('未知事件读取: '+k);x=values[k]!;}
  }
  if(!Number.isFinite(x))throw Error('表达式产生非有限结果');stack.push(x);
 }
 if(stack.length!==1)throw Error('表达式栈非法');return stack[0]!;
}
function checkRoll(c:Context,probability:number,advantage=0){const states=(c.caster.statuses??[]).filter(s=>!s.suppressed&&live(s)&&s.rule?.kind==='luck'&&s.rule.uses!==0&&['best','worst'].includes(s.rule.key));if(states.length){const winner=strongest(c,states)!;consumeRule(winner);return winner.rule!.key==='best';}const a=random(c.battle),r=advantage?advantage>0?Math.min(a,random(c.battle)):Math.max(a,random(c.battle)):a;return r<Math.max(0,Math.min(1,probability));}
/** 0.38.1 自适应恢复：目标生命/法力/体力中占上限比例最低的一项（上限为0的不计；同比例按生命→法力→体力）。 */
export function neediest(u:Pick<Unit,'current'|'max'>):keyof Resources{let best:keyof Resources='hp',ratio=Infinity;for(const r of ['hp','mp','sp'] as const){if(!(u.max[r]>0))continue;const x=u.current[r]/u.max[r];if(x<ratio-1e-9){ratio=x;best=r;}}return best;}
function swapResource(a:AmountSpec,from:keyof Resources,to:keyof Resources):AmountSpec{const x={...a};if(x.maxResource===from)x.maxResource=to;if(x.currentResource===from)x.currentResource=to;if(x.lostResource===from)x.lostResource=to;return x;}
function performHeal(c:Context,resource:keyof Resources,total:number,priority=0,overflow=false){
 const b=c.battle;let t=c.target;let rising=false;
 if(!isAlive(t)&&!t.zeroHpProtected){
  // “HP归零时恢复生命”= 先复活再回血：只在倒地前/倒地后的响应里、对倒下的那个单位生效，复活封锁照常仲裁。
  if(resource!=='hp'||t.escaped||activeRule(t,'sealed')||!(c.event.point==='before_down'||c.event.point==='after_down')||c.event.target!==t.id)return 0;
  if(reviveBlocked(c,priority)){log(b,'revive_blocked',t.id,'复活封锁：等级/速度/随机仲裁');return 0;}
  rising=true;
 }
 const ev:EventContext={...c.event,source:c.caster.id,target:t.id,resource,raw:total,actual:0,control:{cancelled:false,scale:1}};
 if(!ev.converted)emit(b,'before_heal',ev);
 if(ev.control!.cancelled)return 0;if(ev.control!.recipient)t=unit(b,ev.control!.recipient)??t;
 total=Math.max(0,(ev.control!.amount??total)*ev.control!.scale);
 if(ev.control!.replacement==='damage'){return receive({...c,target:t,event:{...ev,converted:true}},{physical:0,energy:0,mental:0,true:total},'none',priority);}
 const blocked=opposingRule(c,t,'no_heal','*',priority);if(blocked){consumeRule(blocked);return 0;}
 const n=Math.floor(total*(c.caster.healMultiplier??1)*(t.stats?.heal_received??1)),gain=Math.max(0,Math.min(t.max[resource]-t.current[resource],n));t.current[resource]+=gain;if(t.current.hp>0)t.zeroHpProtected=false;if(rising&&t.current.hp>0){t.deadHandled=false;t.defeated=false;delete t.noRevivePriority;delete t.deathSeal;delete t.deathEvent;clockUnit(b,t.id).active=true;log(b,'revive',t.id,'复苏',t.current.hp);}log(b,'heal',t.id,resource,gain);if(resource==='hp'&&activeRule(t,'hp_gate_attrs'))recompute(t,b);
 if(overflow&&n>gain)t.shields.push({...timed(c.key,{clock:'permanent',value:0}),amount:n-gain,channels:['physical','energy','mental']});
 emit(b,'after_heal',{...ev,target:t.id,actual:gain});return gain;
}
function costPlan(b:Battle,u:Unit,a:ActionSpec,id?:string):{payments:Record<string,Resources>;error:string}{
 const payments:Record<string,Resources>={[u.id]:costFor(u,a,id)};
 if(a.jointCost){const spec=a.jointCost,participants=legalTargets(b,u,a,spec.targeting).slice(0,spec.targeting.count??64);if(participants.length<spec.minimumParticipants)return {payments,error:'共同支付成员不足'};
  for(const p of participants){const n=costFor(p,{...a,cost:spec.cost});payments[p.id]??={hp:0,mp:0,sp:0};for(const r of RES){const available=Math.max(0,p.current[r]-payments[p.id]![r]-(r==='hp'&&!a.suicideCost?1:0));payments[p.id]![r]+=spec.insufficient==='pay_remaining'?Math.min(available,n[r]):n[r];}}
 }
 for(const [id,costs] of Object.entries(payments)){const p=unit(b,id);for(const r of RES)if(costs[r]>p.current[r]||r==='hp'&&costs[r]>0&&!a.suicideCost&&costs[r]>=p.current[r])return {payments,error:'资源不足: '+r+' / '+id};}
 return {payments,error:''};
}
function refundCommand(b:Battle,cmd:Command){if(!cmd.action.refundOnInterrupt)return;for(const [id,paid] of Object.entries(cmd.paidBy??{[cmd.caster]:cmd.paid??{hp:0,mp:0,sp:0}})){const p=unit(b,id);for(const r of RES)p.current[r]=Math.min(p.max[r],p.current[r]+paid[r]*cmd.action.refundOnInterrupt);}}
/** 撤离一个单位（原 retreat 操作的全部结算）：脱离时钟、撤销其指令、带走召唤物与场地、清掉它挂出的被动状态。 */
function retreatUnit(b:Battle,u:Unit,detail:string){u.escaped=true;u.retreatRequested=true;b.clock=deactivateUnit(b.clock,u.id);for(const [id,cmd] of Object.entries(b.commands))if(cmd.caster===u.id)delete b.commands[id];for(const x of b.units.filter(x=>x.owner===u.id&&isAlive(x))){x.escaped=true;b.clock=deactivateUnit(b.clock,x.id);}const fields=(b.fields??[]).filter(f=>f.owner===u.id).map(f=>f.id);b.fields=b.fields?.filter(f=>f.owner!==u.id);for(const x of b.units)x.statuses=x.statuses?.filter(s=>!fields.includes(s.sourceKey)&&!(s.source===u.id&&s.sourceKey.startsWith('passive:')));log(b,'retreat',u.id,detail);}
/** 间章:小憩到期：该阵营所有仍在场的存活成员一起撤离。不经过效果管线，因此没有命中、抗性、封印或打断。 */
function settleInterludes(b:Battle){
 const due=(b.interludes??[]).filter(i=>i.due<=(b.round??0));if(!due.length)return;b.interludes=(b.interludes??[]).filter(i=>i.due>(b.round??0));
 for(const i of due)for(const u of b.units.filter(u=>u.side===i.side&&!u.escaped&&isAlive(u)))retreatUnit(b,u,'间章:小憩：全员撤离');
}
function advanceRound(b:Battle){
 b.round=(b.round??0)+1;
 settleInterludes(b);
 const tasks=[...b.scheduled??[]].filter(s=>s.clock==='round'),fields=[...b.fields??[]];
 for(const link of b.lifeLinks??[])if(link.clock==='round')link.remaining--;
 for(const u of b.units){
  for(const copy of Object.values(u.passiveCopies??{}))if(copy.clock==='round')copy.remaining--;
  for(const x of Object.values(u.counters??{}))if(x.reset==='round')x.value=0;
  u.roundActions=0;
  if(u.echoQueue?.length&&isAlive(u)){const due=u.echoQueue.filter(q=>q.round<=(b.round??0));u.echoQueue=u.echoQueue.filter(q=>q.round>(b.round??0));for(const q of due){const act=u.actions[q.sourceId];if(!act)continue;const targets=q.targets.filter(id=>{const t=unit(b,id);return t&&isAlive(t);});const main=unit(b,targets[0]??u.id)??u;runEffects({battle:b,caster:u,target:main,key:u.id+':'+q.sourceId+':echo',sourceRoot:q.sourceId,libraryOwner:u.id,event:event(b,u.id,main.id),action:act},act.effects,targets.length?targets:[u.id]);log(b,'status',u.id,'复读机：回响 '+(act.name??q.sourceId),0);}}
  for(const s of u.statuses??[])for(const k of Object.keys(s.used))if(k.startsWith('cap:round:'))s.used[k]=0;
  for(const lock of Object.values(u.sourceLocks??{}))if(lock.clock==='round')lock.remaining--;
  const old=[...u.statuses??[]];for(const s of old)if(!s.suppressed&&!clockFrozen(u,s))tickStatus(b,u,s,1,'round');
  for(const s of [...u.shields,...u.speeds,...old,...u.exploration??[]])if(s.clock==='round'&&!clockFrozen(u,s as {definition?:StatusSpec}))s.remaining--;
  for(const [id,copy] of Object.entries(u.copied??{}))if(copy.clock==='round'&&--copy.remaining<=0){delete u.actions[id];delete u.copied![id];}
  for(const [id] of Object.entries(u.sealed??{}))if(u.sealClocks?.[id]==='round'&&--u.sealed![id]!<=0){delete u.sealed![id];delete u.sealClocks![id];}
  if(u.summon?.clock==='round'&&--u.summon.remaining<=0){u.current.hp=0;u.zeroHpProtected=false;u.escaped=true;u.deadHandled=true;b.clock=deactivateUnit(b.clock,u.id);}
 }
 // 被禁止行动的单位读不到自己的回合（ATB停止），改在每个回合边界判定一次挣脱。
 for(const u of b.units)if(isAlive(u)&&b.clock.units.find(x=>x.id===u.id)?.stopped)tryEscape(b,u);
 for(const u of b.units)chargeProtection(b,u);
 for(const f of fields)if(f.clock==='round')f.remaining--;
 refreshSourceLocks(b);
 for(const task of tasks)if(--task.remaining<=0){b.scheduled=b.scheduled!.filter(x=>x!==task);const owner=unit(b,task.owner),target=unit(b,task.target),ev=event(b,owner.id,target.id);ev.frame=freshFrame();ev.frame.variables=clone(task.variables??{});ev.automatic=true;invoke({battle:b,caster:unit(b,task.caster??task.owner)??owner,target,key:task.key,sourceRoot:task.sourceRoot,event:ev,libraryOwner:owner.id},task.action);}
 for(const u of b.units)emit(b,'round',event(b,u.id,u.id,'round'));
 reconcileLifeLinks(b,(link,target)=>restoreLink(b,link,target));
}

function passes(conditions:ConditionSpec[]|undefined,c:Context){return (conditions??[]).every(test=>{
 const u=subject(c,test.subject),key=test.key??'',n=test.compareExpression?readFormula(test.compareExpression,c.caster,c.target,c.event,c.battle):test.value??1;let x=0;
 if(test.kind==='expression')x=readFormula(test.expression!,c.caster,c.target,c.event,c.battle);
 if(test.kind==='event_resource')x=Number(c.event.resource===key);
 if(test.kind==='event_tag')x=Number(c.event.status?.tags.includes(key));
 if(test.kind==='resource')x=u.current[key as keyof Resources];
 if(test.kind==='resource_ratio')x=u.current[key as keyof Resources]/Math.max(1,u.max[key as keyof Resources]);
 if(test.kind==='status')x=u.statuses?.filter(s=>!s.suppressed&&(s.id===key||s.definitionId===key||s.definition.name===key||s.definition.tags.includes(key))).reduce((v,s)=>v+s.stacks,0)??0;
 if(test.kind==='tag')x=Number((u.tags??[]).includes(key)||(u.statuses??[]).some(s=>!s.suppressed&&s.definition.tags.includes(key)));
 if(test.kind==='phase')x=Number(key===(c.battle.exploration?'exploration':'battle'));
 // 0.38.1 敌我两用：same/opposite 以施放者阵营为准（魅惑按控制者阵营）；其它键仍是绝对阵营。
 if(test.kind==='side')x=Number(key==='same'?allegiance(c.battle,u)===allegiance(c.battle,c.caster):key==='opposite'?allegiance(c.battle,u)!==allegiance(c.battle,c.caster):key===u.side);
 if(test.kind==='alive_count')x=c.battle.units.filter(t=>isAlive(t)&&(key==='any'||t.side===(key==='enemy'?(u.side==='ally'?'enemy':'ally'):u.side))).length;
 if(test.kind==='kill_count')x=u.kills??0;
 if(test.kind==='critical')x=Number(c.event.critical);
 if(test.kind==='shield')x=u.shields.filter(s=>!s.suppressed).reduce((v,s)=>v+s.amount,0);
 if(test.kind==='field')x=Number(c.battle.fields?.some(f=>f.definition===key||f.group===key));
 if(test.kind==='category')x=Number(c.event.category===key);
 if(test.kind==='uses')x=u.used[key]??0;
 if(test.kind==='dependency')x=u.dependencies?.[key]??0;
 const ok=test.compare==='eq'?x===n:test.compare==='ne'?x!==n:test.compare==='lt'?x<n:test.compare==='gt'?x>n:test.compare==='lte'?x<=n:x>=n;
 return test.invert?!ok:ok;
 });}
function defaultTarget(a:ActionSpec):TargetSpec{return a.targeting??{side:a.target,selection:'manual',count:1,life:a.effects.some(e=>e.op==='revive')?'downed':'alive'};}
/** 硬控：停止行动时钟且不能选择任何能力。 */
const HARD_CONTROLS=['stun','freeze','sleep','time_stop','petrify','knockdown'];
/** 决定性效果的等级门槛：秒杀/无视免死、免疫一切、必定无效行动、可无限续的禁止行动，只对等级严格低于施加者的单位生效。
 * 施加者取响应归属者（被动/反应的主人），召唤物按召唤物自身等级。原文“无视法则/无视层级”不改变这一点。 */
function effectiveSource(c:Context):Unit{return unit(c.battle,c.event.responseOwner??c.caster.id)??c.caster;}
function decisiveAllowed(source:Unit,target:Unit){return target.level<source.level;}
/** 保命上限：锁血/免死/不死/倒地复活这类“施加于己方、使自己基本不可能落败”的效果。
 * 单场最多发动 = 被保护者的生命层级 次：原文“每场1次”自然只有1次；原文次数超过层级（如“可复活99次”）或没有次数限制的，按层级封顶。
 * 计数按“被保护单位 + 来源”记，同一来源反复重新施加也共用这一个上限。
 * 只限制玩家一方（含其召唤物），以及「？」从队伍复制去的技能；手工设计的敌方机制都有明确次数与解法，不受此限。 */
export function lastStandLimit(level:number){return tier(Math.max(1,Math.min(25,Math.round(level))));}
function lastStandApplies(holder:Unit,key:string){return (holder.side==='ally'||key.includes('stray/'))&&!key.includes('relic/');}
function standUsed(holder:Unit,key:string){return lastStandApplies(holder,key)&&(holder.lastStand?.[key]??0)>=lastStandLimit(holder.level);}
/** 限时的“不死N回合”：同一回合内反复挡致命只计一次，之后每个回合再挡致命都再计一次（0.21：原为整段只计一次）；常驻不死每挡一次致命都计数。 */
function standFree(s:StateInstance,b:Battle){return s.rule?.kind==='undying'&&s.clock!=='permanent'&&s.used.stand===standRound(b);}
function standRound(b:Battle){return (b.round??0)+1;}
function lastStand(b:Battle,holder:Unit,key:string):boolean{
 if(!lastStandApplies(holder,key))return true;
 holder.lastStand??={};const n=holder.lastStand[key]??0,limit=lastStandLimit(holder.level);
 if(n>=limit){log(b,'last_stand_capped',holder.id,`保命效果本场已发动${n}次（上限${limit}，按层级）`);return false;}
 holder.lastStand[key]=n+1;return true;
}
/** 动作（含库内连段）是否含保命成分：复活、治疗、免死/不死规则。 */
function savesLife(lib:LibrarySpec|undefined,id:string,seen=new Set<string>()):boolean{
 if(!lib||seen.has(id))return false;seen.add(id);const a=lib.actions[id];if(!a)return false;
 return a.effects.some(e=>e.op==='revive'||e.op==='heal'&&e.resource==='hp'||e.op==='rule'&&(e.rule==='death_guard'||e.rule==='undying'||e.rule==='substitute')||(e.op==='sequence'||e.op==='repeat')&&savesLife(lib,e.action,seen)||e.op==='branch'&&(savesLife(lib,e.then,seen)||!!e.otherwise&&savesLife(lib,e.otherwise,seen))||e.op==='check'&&(savesLife(lib,e.success,seen)||!!e.failure&&savesLife(lib,e.failure,seen))||e.op==='choose'&&e.actions.some(k=>savesLife(lib,k,seen))||e.op==='time'&&(e.mode==='rewind'&&e.restore.includes('resources')||!!e.action&&savesLife(lib,e.action,seen)));
}
/** 技能组整体审查（禁止完美无缺的无解技能组，敌我通用）。
 * 无敌类效果：免疫一切伤害/属性/状态（key='*'）、无限次必定闪避、把全属性倍率打成0/受到伤害归零/三通道全免的修正。
 * 把单位的全部主动、被动、触发器、资源回复、冷却、次数放在一起估算“能不间断维持多少轮”：
 *  - 常驻、无次数的循环触发、或者“消耗 ≤ 持续期间回复”的主动技，维持轮数为无限；
 *  - 维持轮数 ≥ PERPETUAL_ROUNDS 视为“变相常驻”（perpetual）：只对等级更低的对手生效；
 *  - 否则是有代价、有空窗的正常技能（bounded）：对更高等级的对手同样生效，只有遇到“必定造成伤害”时按等级>速度>随机仲裁。
  * 每次生效只能挡有限次（1~9次）的，本身就挡不住多段/群体，按 bounded 处理；但被触发器反复重新授予时照样计入（0.21）。
  * 迷宫遗物不参加审查（审查对象是角色卡本身的技能组）。执行期另有“完全抵消预算/80%减伤上限”兜底，与本审查无关。 */
export const PERPETUAL_ROUNDS=10;
const INVULN_RULES=new Set(['immune_status','immune_element','immune_channel','guaranteed_evade']);
function blanketMods(mods?:readonly ModifierSpec[]):boolean{
 if(!mods?.length)return false;const zero=new Set<string>(mods.filter(m=>m.stat==='element'&&m.multiplier===0&&m.element).map(m=>elementKey(m.element!)));
 return BLANKET_ELEMENTS.filter(x=>zero.has(x)).length>=5||mods.some(m=>m.stat==='vulnerability'&&m.multiplier===0)||(['physical','energy','mental'] as const).every(ch=>mods.some(m=>m.stat==='reduction_'+ch&&(m.multiplier===0||(m.flat??0)>=1)));
}
function durRounds(d?:DurationSpec):number{if(!d)return 1;if(d.clock==='permanent'||d.clock==='field')return Infinity;if(d.clock==='battle_time')return d.value/ROUND_MS;if(d.clock==='exploration_time')return 0;return d.value;}
type Grant={dur:number;limited:boolean};
function invulnGrants(lib:LibrarySpec,effects:readonly EffectSpec[],seen=new Set<string>()):Grant[]{
 const out:Grant[]=[];const sub=(id?:string)=>{if(!id||seen.has(id))return [];seen.add(id);const a=lib.actions[id];return a?invulnGrants(lib,a.effects,seen):[];};
 for(const e of effects){
  if(e.op==='rule'&&INVULN_RULES.has(e.rule)&&e.key==='*')out.push({dur:durRounds(e.duration),limited:!!e.uses&&e.uses>0&&e.uses<10});
  else if(e.op==='modify'&&blanketMods(e.modifiers))out.push({dur:durRounds(e.duration),limited:false});
   else if(e.op==='apply_status'||e.op==='field'){
    // 0.21 P2-1：领域经由它的状态授予无敌，同样按来源根登记（原先漏登记、被当成常驻）。
    const fd=e.op==='field'?lib.fields[e.field]:undefined;if(e.op==='field'&&(!fd||e.remove))continue;const st=lib.statuses[e.op==='field'?fd!.status:e.status];if(!st)continue;const d=durRounds(fd?fd.duration:st.duration);if(blanketMods(st.modifiers))out.push({dur:d,limited:false});
    for(const t of st.triggers??[])for(const g of sub(t.action))out.push({dur:['round','ready'].includes(t.event)&&g.dur>=1&&!t.uses?d:Math.min(d,g.dur),limited:g.limited&&!['round','ready'].includes(t.event)});
    if(st.tick){const iv=st.tick.clock==='battle_time'?st.tick.interval/ROUND_MS:st.tick.clock==='round'?st.tick.interval:1;for(const g of sub(st.tick.action))out.push({dur:g.dur>=iv?d:Math.min(d,g.dur),limited:g.limited});}}
  else if(e.op==='sequence'||e.op==='repeat'||e.op==='time')out.push(...sub((e as {action?:string}).action));
  else if(e.op==='branch'){out.push(...sub(e.then),...sub(e.otherwise));}
  else if(e.op==='check'){out.push(...sub(e.success),...sub(e.failure));}
  else if(e.op==='choose')for(const k of e.actions)out.push(...sub(k));
 }
 return out;
}
/** 每轮回复占上限的比例：被动里每轮/每回合触发、作用于自身的回复；
  * 0.21 L10：敌方行动、受击等每回合都会发生的触发同样按每回合一次计，给自己或全队的回复都算。遗物不计。 */
const ONE_SHOT_EVENTS=new Set(['battle_start','battle_end','before_down','after_down','kill','new_region','pickup','open_chest','use_item','death_prevented']);
function regenPerRound(u:Unit,r:keyof Resources):number{
  let n=0;const lib=u.library??EMPTY_LIBRARY();
  for(const [pid,p] of Object.entries(u.passives??{})){if(pid.startsWith('relic/'))continue;for(const t of p.triggers??[]){if(ONE_SHOT_EVENTS.has(t.event))continue;const own=['round','ready'].includes(t.event)&&t.scope==='self';const a=lib.actions[t.action]??p.library?.actions[t.action];if(!a)continue;
   for(const e of a.effects){if(!own){const side=(e as {targeting?:TargetSpec}).targeting?.side??a.targeting?.side??a.target;if(side!=='self'&&side!=='ally')continue;}const amt=e.op==='heal'&&e.resource===r?e.amount:e.op==='resource'&&e.resource===r&&['add','set'].includes(e.mode)?e.amount:undefined;if(amt)n+=evaluateAmount(amt,u,u)/Math.max(1,u.max[r])*(t.chance??1);}}}
  return n;
}
function sustainRounds(u:Unit,a:ActionSpec,g:Grant,delivery:'passive'|'reactive'|'round'|'active',trigger?:TriggerSpec):number{
  // 0.21 L07/L08：触发器（每回合、敌方行动前、受伤前……）会反复重新授予，按“触发频率×持续”估算；每次只挡有限次的，只要重新授予不受限同样计入。
  // 0.21 L09：冷却N表示施放后要再过N次行动才能再放，一个周期是 N+1 次行动。
  const repeat=delivery==='round'||delivery==='reactive';
  if(g.limited&&!repeat)return 0;if(g.dur===Infinity)return Infinity;if(delivery==='passive')return g.dur;
  const cycle=repeat?Math.max(1,(trigger?.cooldownMs??0)/ROUND_MS):actionCycle(a);if(g.dur<cycle)return g.dur;
  const uses=repeat?(trigger?.uses||Infinity):(a.perBattleUses>0?a.perBattleUses:Infinity);
 let casts=Infinity;
 if(delivery==='active'||trigger?.payCost){const cost=costFor(u,a);for(const r of RES){const max=Math.max(1,u.max[r]),frac=cost[r]/max;if(frac<=0)continue;if(frac>1||r==='hp'&&frac>=1){casts=0;break;}const net=frac-regenPerRound(u,r)*g.dur;if(net<=0)continue;casts=Math.min(casts,Math.floor((1-frac)/net)+1);}}
 return Math.min(uses,casts)*g.dur;
}
function actionCycle(a:ActionSpec){return Math.max(1,(a.cooldown??0)+1);}
export function auditInvulnerability(u:Unit):Record<string,'perpetual'|'bounded'>{
  const lib=u.library??EMPTY_LIBRARY(),best:Record<string,number>={};const rotation:{roots:string[];share:number;cost:Resources;cycle:number}[]=[];
 const note=(root:string,n:number)=>{best[root]=Math.max(best[root]??0,n);};
 const libOf=(a:ActionSpec)=>a.library?{actions:{...lib.actions,...a.library.actions},statuses:{...lib.statuses,...a.library.statuses},summons:{...lib.summons,...a.library.summons},fields:{...lib.fields,...a.library.fields}} as LibrarySpec:lib;
  for(const [id,a] of Object.entries(u.passives??{})){if(id.startsWith('relic/'))continue;const L=libOf(a);
   for(const g of invulnGrants(L,a.effects))note(id,sustainRounds(u,a,g,'passive'));
   for(const t of a.triggers??[]){const act=L.actions[t.action];if(!act)continue;const delivery=['round','ready'].includes(t.event)?'round':ONE_SHOT_EVENTS.has(t.event)?'passive':'reactive';for(const g of invulnGrants(L,act.effects))note(id,sustainRounds(u,act,g,delivery,t));}}
  for(const [id,a] of Object.entries(u.actions)){if(id.startsWith('booksea:')||a.category==='command'||a.category==='item')continue;const root=a.source?.id??id;if(root.startsWith('relic/'))continue;const L=libOf(a);
   for(const g of invulnGrants(L,a.effects)){const n=sustainRounds(u,a,g,a.activation?'passive':'active');note(id,n);if(root!==id)note(root,n);
    if(!a.activation&&!g.limited&&g.dur!==Infinity&&g.dur<actionCycle(a)&&!(a.perBattleUses>0))rotation.push({roots:root!==id?[id,root]:[id],share:g.dur/actionCycle(a),cost:costFor(u,a),cycle:actionCycle(a)});}}
  // 0.21 L09：同一单位的多个有界无敌轮流施放——覆盖率（持续/周期）合计≥100%、资源撑得住 PERPETUAL_ROUNDS 轮以上，就是变相常驻。
  if(rotation.length>1){const byRoot=new Map<string,typeof rotation[number]>();for(const x of rotation){const k=x.roots[0]!;if((byRoot.get(k)?.share??0)<x.share)byRoot.set(k,x);}const list=[...byRoot.values()];
   if(list.length>1&&list.reduce((n,x)=>n+x.share,0)>=1-1e-9){let horizon=Infinity;for(const r of RES){const drain=list.reduce((n,x)=>n+x.cost[r]/Math.max(1,u.max[r])/x.cycle,0)-regenPerRound(u,r);if(drain>1e-12)horizon=Math.min(horizon,1/drain);}
    if(horizon>=PERPETUAL_ROUNDS)for(const x of list)for(const root of x.roots)note(root,Infinity);}}
 u.invuln=Object.fromEntries(Object.entries(best).map(([k,n])=>[k,n>=PERPETUAL_ROUNDS?'perpetual':'bounded'])) as Record<string,'perpetual'|'bounded'>;
 if(!Object.keys(u.invuln).length)delete u.invuln;return u.invuln??{};
}
/** 无敌类状态是否来自“有代价、有空窗”的正常技能；查不到来源的一律按变相常驻处理（保守）。 */
function boundedInvuln(b:Battle,s:StateInstance):boolean{const owner=unit(b,s.source);return owner?.invuln?.[s.sourceRoot??s.sourceKey]==='bounded';}
/** 可挣脱的控制：所有来自敌对来源的控制类状态，以及封锁全部能力/封印类规则。 */
const ESCAPABLE_CONTROLS=new Set(['stun','freeze','sleep','time_stop','petrify','knockdown','bind','silence','fear','confusion','charm','taunt','disarm','polymorph','no_action','isolate']);
// 0.21：恐惧（只会攻击的单位就动不了）、变形（没有普通攻击的单位只能防御/待机）、魅惑（替对方行动）、敌对的空间隔离同样算“让对方动不了”的强控。
const BAN_CONTROLS=new Set([...HARD_CONTROLS,'no_action','fear','polymorph','charm','isolate']);
function hostileSource(b:Battle,u:Unit,s:StateInstance){if(s.source===u.id)return false;const src=b.units.find(x=>x.id===s.source);return !src||src.side!==u.side;}
/** 0.21 L14：敌对来源的控制一律按负面处理（自定义成“正面”的眩晕同样可挣脱、同样受状态免疫）。 */
function escapable(b:Battle,u:Unit,s:StateInstance){if(s.suppressed||!live(s)||!hostileSource(b,u,s))return false;return !!s.definition.control&&ESCAPABLE_CONTROLS.has(s.definition.control)||s.rule?.kind==='seal_category'&&s.rule.key==='*'||s.rule?.kind==='sealed'&&isAlive(u);}
/** 禁止行动类：硬控、no_action、封锁全部能力、封印。 */
function actionBan(s:{definition:StatusSpec;rule?:StateInstance['rule']}){return !!s.definition.control&&BAN_CONTROLS.has(s.definition.control)||s.rule?.kind==='seal_category'&&s.rule.key==='*'||s.rule?.kind==='sealed';}
/** 挣脱概率：持有者相对施加者越强越容易，同级20%/次，每高1级+8%，限定5%~95%。 */
/** 不可无限续控：对不低于自己等级的目标，同一来源的禁止行动不能在生效中续上，解除后下一回合内也不能再上。 */
function banBlocked(c:Context,t:Unit):boolean{
 const src=effectiveSource(c);if(src.id===t.id||src.side===t.side||decisiveAllowed(src,t))return false;
 if((t.statuses??[]).some(s=>!s.suppressed&&live(s)&&actionBan(s)&&s.source===src.id)){log(c.battle,'decisive_blocked',t.id,'禁止行动不能对同级及以上目标续控');return true;}
 if((t.banGrace?.[src.id]??-1)>=(c.battle.round??0)){log(c.battle,'decisive_blocked',t.id,'刚解除禁止行动，本回合内不可再被同一来源控制');return true;}
 if(streakBlocked(c,t,src)){log(c.battle,'decisive_blocked',t.id,'同一来源不能连续控制：要等对方行动一次');return true;}
 return false;
}
/** 0.21 强控（让对方动不了：禁止行动、推条、打断、取消行动、封锁全部能力）。对等级不低于来源的敌对目标：
  * 同一来源不能连续控制——对方成功行动一次之前，同一来源的下一次强控无效（同一次行动里的多段不算连续）；
  * 瞬时类（推条/打断/取消/封锁）按挣脱概率当场抵抗；必定生效只对等级低于来源的目标。 */
function streakBlocked(c:Context,t:Unit,src:Unit):boolean{const s=t.controlStreak?.[src.id];if(!s||s.acted!==(t.acted??0))return false;const cmd=c.event.commandId;return !(cmd!==undefined&&s.cmd===String(cmd));}
function markControl(c:Context,t:Unit){const src=effectiveSource(c);if(src.id===t.id||src.side===t.side||decisiveAllowed(src,t))return;t.controlStreak??={};const cmd=c.event.commandId;t.controlStreak[src.id]={acted:t.acted??0,...(cmd!==undefined?{cmd:String(cmd)}:{})};}
function controlStreakBlocked(c:Context,t:Unit):boolean{const src=effectiveSource(c);if(src.id===t.id||src.side===t.side||decisiveAllowed(src,t)||!streakBlocked(c,t,src))return false;log(c.battle,'decisive_blocked',t.id,'同一来源不能连续控制：要等对方行动一次');return true;}
function controlAllowed(c:Context,t:Unit,label:string,strong:boolean):boolean{
 const src=effectiveSource(c);if(src.id===t.id||src.side===t.side||decisiveAllowed(src,t))return true;
 if(streakBlocked(c,t,src)){log(c.battle,'decisive_blocked',t.id,label+'：同一来源不能连续控制，要等对方行动一次');return false;}
 if(strong){const p=escapeChance(t.level,src.level);if(random(c.battle)<p){log(c.battle,'escape',t.id,`挣脱「${label}」（${Math.round(p*100)}%）`,Math.round(p*100));return false;}}
 markControl(c,t);return true;
}
export function escapeChance(holderLevel:number,sourceLevel:number){return Math.min(.95,Math.max(.05,.2+.08*(holderLevel-sourceLevel)));}
/** 每到持有者自己的回合（硬控期间按每回合边界）免费判定一次挣脱，不消耗行动次数。 */
function tryEscape(b:Battle,u:Unit){
 if(!isAlive(u)&&!(u.statuses??[]).some(s=>s.rule?.kind==='sealed'))return;let freed=false;
 for(const s of [...u.statuses??[]]){if(!escapable(b,u,s))continue;const p=escapeChance(u.level,s.sourceLevel??unit(b,s.source)?.level??u.level);
  if(random(b)<p){s.remaining=0;s.clock='battle_time';freed=true;log(b,'escape',u.id,`挣脱「${s.definition.name}」（${Math.round(p*100)}%）`,Math.round(p*100));}}
 // 0.21 L17：敌对来源的“封锁能力”（来源封锁）同样可以挣脱。
 for(const [id,lock] of Object.entries(u.sourceLocks??{})){if(lock.removed||!live(lock)||!lock.owner||lock.owner===u.id)continue;const owner=unit(b,lock.owner);if(!owner||owner.side===u.side)continue;const p=escapeChance(u.level,owner.level);
  if(random(b)<p){delete u.sourceLocks![id];freed=true;log(b,'escape',u.id,`挣脱「能力封锁」（${Math.round(p*100)}%）`,Math.round(p*100));}}
 if(freed){refreshSourceLocks(b);expireStatuses(b,u);recompute(u,b);}
}
/** 攻击类动作：以敌方为目标且含伤害程序（宿主的[攻击]槽）；其余非指令能力视为[动作]。 */
function attacking(a:ActionSpec){return (a.target==='enemy'||a.targeting?.side==='enemy')&&a.effects.some(e=>['damage','sequence','repeat','choose','branch','check'].includes(e.op));}
function controls(u:Unit,name:string){return (u.statuses??[]).filter(s=>s.definition.control===name&&live(s)&&!s.suppressed);}
function allegiance(b:Battle,u:Unit){const charm=controls(u,'charm')[0];return charm?unit(b,charm.source).side:u.side;}
/** 0.38.1：按当前阵营（魅惑按控制者）判断 t 对 u 是否敌对。 */
export function hostileTo(b:Battle,u:Unit,t:Unit){return allegiance(b,u)!==allegiance(b,t);}
/** 0.39：以敌方为主目标的攻击——单体手选可以点任何单体（含友方、被魅惑的敌人，不含自己）；群体/随机也会命中被暂时控制（魅惑）过去的敌方单位。 */
function strikeScope(a:ActionSpec,q:TargetSpec):'single'|'group'|null{
 if(q.side!=='enemy'||(a.targeting?.side??a.target)!=='enemy'||!attacking(a))return null;
 return q.selection==='manual'&&(q.count??1)<=1?'single':'group';
}
export function legalTargets(b:Battle,caster:Unit,a:ActionSpec,override?:TargetSpec):Unit[]{
 const q=override??defaultTarget(a),side=allegiance(b,caster),strike=strikeScope(a,q);
 return b.units.filter(t=>{
  if(t.escaped)return false;
  if(q.minTier!==undefined&&tier(Math.min(25,t.level))<q.minTier||q.maxTier!==undefined&&tier(Math.min(25,t.level))>q.maxTier)return false;
  if(q.ids&&!q.ids.includes(t.id)||q.names&&!q.names.includes(t.name??t.id)||q.minLevel!==undefined&&t.level<q.minLevel||q.maxLevel!==undefined&&t.level>q.maxLevel)return false;
  if(q.excludeTags?.some(tag=>t.tags?.includes(tag)||t.statuses?.some(s=>!s.suppressed&&s.definition.tags.includes(tag))))return false;
  if(q.life!=='any'&&(q.life==='downed'?isAlive(t):!isAlive(t)))return false;
  if(q.side==='self'&&t.id!==caster.id)return false;
  if(q.side==='owner'&&t.id!==(caster.owner??caster.id))return false;
  if(q.side==='ally'&&allegiance(b,t)!==side)return false;
  if(q.side==='enemy'&&allegiance(b,t)===side&&!(strike==='single'&&t.id!==caster.id||strike!==null&&t.side!==side&&controls(t,'charm').length>0))return false;
  if(q.excludeSelf&&t.id===caster.id)return false;
  if(q.tags?.some(tag=>!t.tags?.includes(tag)&&!t.statuses?.some(s=>!s.suppressed&&s.definition.tags.includes(tag))))return false;
  if(q.range!==undefined&&Math.abs((t.position??0)-(caster.position??0))>q.range)return false;
  const isolation=controls(t,'isolate')[0],ownIsolation=controls(caster,'isolate')[0];if(t.id!==caster.id&&(isolation?.sourceKey??'')!==(ownIsolation?.sourceKey??'')&&!exposedTo(b,t,caster,isolation))return false;
  if(q.selection==='manual'&&t.id!==caster.id&&activeRule(t,'untargetable')&&!exposedTo(b,t,caster,activeRule(t,'untargetable')))return false;
  if(q.selection==='manual'&&allegiance(b,t)!==side&&controls(t,'hidden').length&&!controls(t,'mark').length&&!exposedTo(b,t,caster,controls(t,'hidden')[0]))return false;
  return true;
 });
}
function select(c:Context,q:TargetSpec,requested:string[]):Unit[]{
 if(q.side==='event_source')return [unit(c.battle,c.event.source)].filter(Boolean);
 if(q.side==='event_target')return [unit(c.battle,c.event.target)].filter(Boolean);
 // 自己倒地的响应里（HP归零时…），“自身”指倒下的自己。
 if(q.side==='self'&&q.life!=='downed'&&(c.event.point==='before_down'||c.event.point==='after_down')&&c.event.target===c.caster.id&&!isAlive(c.caster)&&!c.caster.escaped)return [c.caster];
 const anchor=q.anchor?subject(c,q.anchor):c.caster;
 let pool=legalTargets(c.battle,{...c.caster,position:anchor.position},c.action??zeroAction(),q);if(q.excludeSelf&&q.anchor)pool=pool.filter(t=>t.id!==anchor.id);
 if(controls(c.caster,'confusion').length)pool=c.battle.units.filter(isAlive);
 let selected:Unit[]=[];
 if(q.selection==='all')selected=pool;
 else if(['lowest_resource','highest_resource','nearest'].includes(q.selection)){const r=q.resource??'hp',score=(u:Unit)=>q.selection==='nearest'?Math.abs((u.position??0)-(anchor.position??0)):u.current[r]/Math.max(1,u.max[r]);selected=pool.sort((a,b)=>(score(a)-score(b))*(q.selection==='highest_resource'?-1:1)).slice(0,q.count??1);}
 else if(q.selection==='highest_atb'){selected=[...pool].sort((a,z)=>clockUnit(c.battle,z.id).atb-clockUnit(c.battle,a.id).atb).slice(0,q.count??1);}
 else if(q.selection==='highest_attack'){const atk=(u:Unit)=>Math.max(u.attributes.力量,u.attributes.智力)*Math.max(...CHANNELS.map(ch=>u.damageBonus?.[ch]?.multiplier??1));selected=[...pool].sort((a,z)=>atk(z)-atk(a)).slice(0,q.count??1);}
 else if(q.selection==='random'||q.selection==='bounce'||controls(c.caster,'confusion').length){let candidates=[...pool];for(let i=0;i<(q.count??1)&&candidates.length;i++){const at=Math.floor(random(c.battle)*candidates.length);selected.push(candidates[at]!);if(!q.allowRepeat)candidates.splice(at,1);}}
 else if(q.side==='self'||q.side==='owner')selected=pool.slice(0,1);
 else selected=requested.map(id=>pool.find(u=>u.id===id)).filter((x):x is Unit=>!!x).slice(0,q.count??1);
 if(!q.ignoreRedirect&&q.selection==='manual'&&q.side==='enemy'){
  const taunt=strongest(c,controls(c.caster,'taunt'));if(taunt){const t=pool.find(u=>u.id===taunt.source);if(t)selected=selected.map(()=>t);}
  selected=selected.map(t=>{const guard=strongest(c,controls(t,'guard'));return guard&&unit(c.battle,guard.source)&&isAlive(unit(c.battle,guard.source))?unit(c.battle,guard.source):t;});
 }
 return selected;
}
const BLANKET_ELEMENTS=['物','火','水','暗','光','精'];
/** 对不低于持有者等级的攻击者：全免疫型的0倍率按1、全额减免按原始减免结算（单一属性免疫等正常抗性不受影响）。 */
/** 造成“全免”的修正是否都来自 bounded 技能。 */
function blanketBounded(b:Battle,t:Unit):boolean{
 const zeroing=(m:ModifierSpec)=>m.stat==='element'&&m.multiplier===0||m.stat==='vulnerability'&&m.multiplier===0||m.stat.startsWith('reduction_')&&(m.multiplier===0||(m.flat??0)>=1);
 if((t.modifiers??[]).some(m=>sourceEnabled(t,m.origin)&&zeroing(m)))return false;
 const src=(t.statuses??[]).filter(s=>!s.suppressed&&live(s)&&(s.modifiers??s.definition.modifiers??[]).some(zeroing));
 return src.length>0&&src.every(s=>boundedInvuln(b,s));
}
function relaxBlanket(t:Unit):Mitigation{const m=clone(t.mitigation);if(BLANKET_ELEMENTS.filter(x=>(m.elementMultipliers[x]??1)<=0).length>=5)for(const x of BLANKET_ELEMENTS)if((m.elementMultipliers[x]??1)<=0)m.elementMultipliers[x]=1;
 if((['physical','energy','mental'] as const).every(ch=>m.attributeReduction[ch]>=1))for(const ch of ['physical','energy','mental'] as const)m.attributeReduction[ch]=Math.min(NEGATION_CAP,t.base?.mitigation.attributeReduction[ch]??0);return m;}
/** 0.38.2 建场时逐个挂被动，中途的重算不夹当前值（遗物有增有减时，先挂减的不能把后挂增的那部分血量吃掉）；最后一次重算统一夹。 */
let deferClamp=false;
function recompute(u:Unit,b:Battle){
 u.base??={attributes:clone(u.attributes),max:clone(u.max),mitigation:clone(u.mitigation)};u.statuses??=[];u.modifiers??=[];u.stats={};
 u.attributes=clone(u.base.attributes);u.max=clone(u.base.max);u.mitigation=clone(u.base.mitigation);u.damageBonus={};u.healMultiplier=1;
 // 0.36.1 满腹护身符：按当前血线切换全属性（伤害 / 治疗后会重算）。
 let gateK=1;{const gate=(u.statuses??[]).find(s=>!s.suppressed&&live(s)&&s.rule?.kind==='hp_gate_attrs'&&s.rule.uses!==0);if(gate){const [hi,lo,th]=gate.rule!.key.split('|').map(Number);gateK=u.current.hp/Math.max(1,u.base.max.hp)>(th||.8)?(hi||1):(lo||1);for(const key of ATTR)u.attributes[key]*=gateK;}}
 const mods=[...u.modifiers.filter(m=>sourceEnabled(u,m.origin)).map(m=>({...m,checkOrigin:u.id+':'+(m.origin??'innate'),imposed:false,maze:false})),...u.statuses.filter(s=>!s.suppressed).flatMap(s=>{const imposed=imposedOn(b,u,s),maze=mazeSourced(s);return Array.from({length:s.definition.scaleWithStacks===false?1:s.stacks},()=>s.modifiers??s.definition.modifiers??[]).flat().map(m=>({...m,checkOrigin:s.source+':'+(s.sourceRoot??s.sourceKey),imposed,maze}));})];
 // 0.38.2 迷宫里的遗物 / 事件改动五维时，HP / MP / SP 上限按宿主卡公式随五维增减（在 max_* 修正之前计入；战斗内技能增减益不改上限）。
 {const shifted=Object.fromEntries(ATTR.map(k=>{let flat=0,multiplier=1;for(const m of mods)if(m.maze&&m.stat===k){flat+=m.flat??0;multiplier*=m.multiplier??1;}return [k,(u.base!.attributes[k]*gateK+flat)*multiplier];})) as Record<typeof ATTR[number],number>;
  if(ATTR.some(k=>shifted[k]!==u.base!.attributes[k])){const before=derivedResources(u.level,u.base.attributes),after=derivedResources(u.level,shifted);for(const r of RES)if(u.base.max[r]>0)u.max[r]=Math.max(r==='hp'?1:0,Math.round(u.base.max[r]+after[r]-before[r]));}}
 const checkSources=new Map<string,Map<string,number>>();
 const groups=new Map<string,{flat:number;multiplier:number;stat:string;element?:string}>();
 for(const m of mods){const key=m.stat+':'+(m.element??'');const g=groups.get(key)??{flat:0,multiplier:1,stat:m.stat,element:m.element};if(m.stat==='hit'||m.stat==='evade'){const sources=checkSources.get(key)??new Map<string,number>();sources.set(m.checkOrigin,(sources.get(m.checkOrigin)??0)+(m.flat??0));checkSources.set(key,sources);g.flat=Math.max(0,...sources.values())+Math.min(0,...sources.values());}else g.flat+=m.flat??0;g.multiplier*=m.multiplier??1;groups.set(key,g);}
 for(const g of groups.values()){
  const f=(n:number)=>(n+g.flat)*g.multiplier,k=g.stat;
  if((ATTR as readonly string[]).includes(k))u.attributes[k as typeof ATTR[number]]=f(u.attributes[k as typeof ATTR[number]]);
  else if(k.startsWith('max_')){const r=k.slice(4) as keyof Resources;u.max[r]=Math.max(0,f(u.max[r]));}
  else if(k.startsWith('armor_')){const ch=k.slice(6) as 'physical'|'energy'|'mental';u.mitigation.armor[ch]=Math.max(0,f(u.mitigation.armor[ch]));}
  else if(k==='reduction_true')u.stats.reduction_true=Math.max(0,Math.min(1,1-(1-g.flat)*g.multiplier));
  else if(k.startsWith('reduction_')){const ch=k.slice(10) as 'physical'|'energy'|'mental';u.mitigation.attributeReduction[ch]=Math.max(0,Math.min(1,1-(1-u.mitigation.attributeReduction[ch])*(1-g.flat)*g.multiplier));}
  else if(k.startsWith('cost_')){u.stats[k]=g.multiplier;u.stats[k+'_flat']=g.flat;}
  else if(k.startsWith('damage_'))u.damageBonus[k.slice(7) as Channel]={flat:g.flat,multiplier:g.multiplier};
  else if(k==='element'){const type=elementKey(g.element);if(type!=='无')u.mitigation.elementMultipliers[type]=Math.max(0,f(u.mitigation.elementMultipliers[type]??1));}
  else if(k==='heal_power')u.healMultiplier=f(1);
  else u.stats[k]=f(['speed','cast_speed','recovery','heal_received','cost_hp','cost_mp','cost_sp','vulnerability','crit_taken','atb_scale'].includes(k)?1:0);
 }
 // “一切伤害无效”型修正（≥5个属性倍率为0，或三个通道全额减免）标记为决定性，只对低等级攻击者生效，见 relaxBlanket。
 const blanket=BLANKET_ELEMENTS.filter(t=>(u.mitigation.elementMultipliers[t]??1)<=0).length>=5||(['physical','energy','mental'] as const).every(ch=>u.mitigation.attributeReduction[ch]>=1)||(u.stats.vulnerability??1)<=0;if(blanket)u.blanketImmunity=true;else delete u.blanketImmunity;
 if(!deferClamp)for(const r of RES)u.current[r]=Math.min(u.current[r],u.max[r]);
 // 0.21：敌方强加的时间压制、输出削弱、加税另记一份不含它们的值。行动频率最多被压到一半（速度≥50%、后摇≤2倍、施法速度≥50%）；
 // 输出削弱在 resolveHit 里按目标的覆盖计入；零消耗的行动不受加税影响（costFor）。
 if(mods.some(m=>m.imposed)){const free=(stat:string,base:number)=>{let flat=0,multiplier=1;for(const m of mods)if(m.stat===stat&&!m.imposed){flat+=m.flat??0;multiplier*=m.multiplier??1;}return {flat,multiplier,value:(base+flat)*multiplier};};
  u.free={speed:free('speed',1).value,recovery:free('recovery',1).value,cast_speed:free('cast_speed',1).value,damage:Object.fromEntries(CHANNELS.map(ch=>{const f=free('damage_'+ch,0);return [ch,{flat:f.flat,multiplier:f.multiplier}];})) as UnitFree['damage'],cost:Object.fromEntries(RES.map(r=>{const f=free('cost_'+r,0);return [r,{flat:f.flat,multiplier:f.multiplier}];}))};
  u.stats.recovery=Math.min(u.stats.recovery??1,2*u.free.recovery);u.stats.cast_speed=Math.max(u.stats.cast_speed??1,.5*u.free.cast_speed);}
 else delete u.free;
 const cu=b.clock.units.find(c=>c.id===u.id);if(cu){cu.agility=u.attributes.敏捷;cu.speedBonus=u.stats.initiative??0;
  {const sp=u.speeds.filter(s=>!s.suppressed);let haste=sp.reduce((n,s)=>n*s.multiplier,1)*(u.stats.speed??1);if(u.free||sp.some(s=>imposedOn(b,u,s)))haste=Math.max(haste,.5*sp.filter(s=>!imposedOn(b,u,s)).reduce((n,s)=>n*s.multiplier,1)*(u.free?.speed??u.stats.speed??1));cu.haste=Math.max(1e-3,haste);}
  cu.side=allegiance(b,u);cu.stopped=!!activeRule(u,'sealed')||HARD_CONTROLS.some(k=>controls(u,k).length>0);}
}
/** 0.35：持有 immune_status '*' 的单位，敌对阵营的任何状态类效果（含 modify / rule / 护盾 / 速度）都挂不上。 */
function hostileBlocked(c:Context,t:Unit,priority=0):boolean{if(c.caster.id===t.id||allegiance(c.battle,c.caster)===allegiance(c.battle,t))return false;const s=opposingRule(c,t,'immune_status','*',priority,true);if(!s)return false;log(c.battle,'fizzle',t.id,'对她无效');return true;}
function addStatus(c:Context,id:string,definition:StatusSpec,stacks=1,durationOverride?:DurationSpec):StateInstance {
 const t=c.target;t.statuses??=[];const d=clone(definition);let duration=durationOverride??d.duration;
 const ban=actionBan({definition:d}),ctl=ban||!!d.control&&ESCAPABLE_CONTROLS.has(d.control);if(hostileBlocked(c,t,d.priority)||ban&&banBlocked(c,t)||!ban&&ctl&&controlStreakBlocked(c,t))return {...timed(id,{clock:'round',value:0}),definition:d,source:c.caster.id,sourceKey:c.key,libraryOwner:c.libraryOwner??c.caster.id,stacks:0,tickLeft:0,tickCount:0,used:{},last:{},suppressed:true} as StateInstance;
  // 0.21：沉默、缴械、束缚、嘲讽等单看不算“动不了”，但几种叠在一起可以锁死；所以同一来源的任何控制都要等对方行动一次才能再上。
  if(ctl)markControl(c,t);
  // 中性状态（modify 等）按修正方向推断增减益：费用/承伤类越低越好，其余越高越好。
const inferred=d.polarity!=='neutral'?d.polarity:d.control?'negative':d.modifiers?.length?(d.modifiers.every(m=>['cost_hp','cost_mp','cost_sp','vulnerability','crit_taken'].includes(m.stat)?(m.multiplier??1)<=1&&(m.flat??0)<=0:(m.multiplier??1)>=1&&(m.flat??0)>=0)?'positive':'negative'):'neutral';
 const capRule=inferred==='positive'?activeRule(t,'buff_cap'):inferred==='negative'?activeRule(t,'debuff_cap'):undefined;
 if(capRule&&!d.tags.includes('rule')&&!(d.name.includes(':'))){const n=Math.max(1,Number(capRule.rule!.key)||1);const cap=duration.clock==='battle_time'?n*ROUND_MS:duration.clock==='exploration_time'?Infinity:n;if(cap!==Infinity&&(duration.clock==='permanent'||duration.value>cap))duration={clock:duration.clock==='permanent'?'round':duration.clock,value:cap};}
 if(d.modifiers)d.modifiers=d.modifiers.map(m=>({...m,flat:(m.flat??0)+(m.amount?value(m.amount,c):0)}));
 const matches=(s:StateInstance)=>d.stackGroup?s.definition.stackGroup===d.stackGroup:s.sourceKey===c.key&&s.definition.name===d.name;const same=t.statuses.find(matches);
 const item:StateInstance={...timed(id,duration),definition:d,source:c.event.responseOwner??c.caster.id,sourceLevel:(unit(c.battle,c.event.responseOwner??c.caster.id)??c.caster).level,sourceSpeed:readFormula([{read:'stat',key:'speed'}],unit(c.battle,c.event.responseOwner??c.caster.id)??c.caster,c.target,c.event,c.battle),sourceKey:c.key,sourceRoot:c.sourceRoot??c.key,libraryOwner:c.libraryOwner??c.caster.id,stacks:Math.min(stacks,d.maxStacks),tickLeft:d.tick?.interval??0,tickCount:0,used:{},last:{}};
 if(same&&d.stack==='stack'){same.stacks=Math.min(d.maxStacks,same.stacks+stacks);same.remaining=duration.value;recompute(t,c.battle);return same;}
 const strength=(d:StatusSpec)=>(d.modifiers??[]).reduce((n,m)=>n+Math.abs(m.flat??0)+Math.abs((m.multiplier??1)-1),0);
 if(same&&d.stack==='strongest'&&(!contest(c,stateClaim(same),d.priority,'状态互斥')||same.source===c.caster.id&&same.definition.priority===d.priority&&strength(same.definition)>strength(d)))return same;
 if(d.stack==='replace'){const old=t.statuses.filter(s=>s.definition.name===d.name);if(old.some(s=>!contest(c,stateClaim(s),d.priority,'状态互斥')))return old[0]!;t.statuses=t.statuses.filter(s=>s.definition.name!==d.name);}
 else if(same&&d.stack!=='independent')t.statuses=t.statuses.filter(s=>s!==same);
 if(d.stack==='independent')item.id+=':'+ ++c.battle.nextCommand;
 t.statuses.push(item);recompute(t,c.battle);log(c.battle,'status',t.id,d.name,stacks);return item;
}
/** 0.34：按累计伤害解除状态（含规则状态）。 */
function tallyDamage(b:Battle,t:Unit,source:Unit,loss:number){
 for(const u of b.units){const before=u.statuses?.length??0;u.statuses=u.statuses?.filter(s=>{const w=s.definition.breakAfterDamage;if(!w)return true;const hit=w.from==='received'?u.id===t.id:w.from==='dealt_to_source'?u.id===source.id&&s.source===t.id:s.source===t.id;if(!hit)return true;s.tally=(s.tally??0)+loss;if(s.tally<w.fraction*Math.max(1,t.max.hp))return true;log(b,'status',u.id,s.definition.name+'·解除',0);return false;});if((u.statuses?.length??0)!==before)recompute(u,b);}
}
/** 0.34：按目标使用记录挑一个非指令技能（uses / rule 共用）。 */
function pickBySelection(c:Context,t:Unit,selection:string):string|undefined{const pool=Object.keys(t.actions).filter(k=>t.actions[k]!.category!=='command');if(selection==='most_used'){const top=[...pool].sort((a,b)=>(t.used[b]??0)-(t.used[a]??0))[0];return top&&(t.used[top]??0)>0?top:undefined;}const used=(t.history??[]).filter(k=>pool.includes(k));if(!used.length)return undefined;return selection==='used_latest'?used[used.length-1]:used[Math.floor(random(c.battle)*used.length)];}
function simpleStatus(name:string,duration:DurationSpec):StatusSpec{return {name,tags:[],polarity:'neutral',duration,stack:'refresh',maxStacks:1,scaleWithStacks:true,priority:0,dispellable:true,removeOnDeath:false,scope:duration.clock==='exploration_time'?'run':'battle'};}
function library(c:Context){return unit(c.battle,c.libraryOwner??c.caster.id).library!;}
function actionById(c:Context,id:string):ActionSpec {const a=library(c).actions[id]??c.caster.actions[id];if(!a)throw Error('动作引用不存在: '+id);return a;}
function invoke(c:Context,id:string,pay=false){const a=actionById(c,id);if(pay){const costs=costFor(c.caster,a);if(RES.some(r=>costs[r]>c.caster.current[r]||(r==='hp'&&costs[r]>0&&!a.suicideCost&&costs[r]>=c.caster.current[r])))return;for(const r of RES)c.caster.current[r]-=costs[r];}runEffects({...c,action:a,key:c.key+':'+id},a.effects,[c.target.id]);}
function emit(b:Battle,point:string,ev:EventContext){
 const candidates:{owner:Unit;state:StateInstance;trigger:TriggerSpec}[]=[];
 for(const owner of b.units)for(const state of owner.statuses??[])for(const trigger of state.definition.triggers??[])if(trigger.event===point&&live(state)&&!state.suppressed)candidates.push({owner,state,trigger});
 const ordered=orderClaims(b,String(ev.root),candidates.map(x=>({...x,...stateClaim(x.state),unit:x.owner,priority:x.trigger.priority??x.state.definition.priority})));
 for(const {unit:owner,state,trigger:t} of ordered){
  const related=['damage_received','before_down','after_down','shield_break','shield_gained','before_damage','before_heal','after_heal','before_status','after_status','death_prevented','action_resolved'].includes(point)?unit(b,ev.target):unit(b,ev.source);
  if(!related||state.suppressed||!live(state)||!sourceEnabled(unit(b,state.source),state.sourceRoot))continue;if(point==='before_down'&&ev.execute&&!winsConflict(b,String(ev.root),{owner:state.source,priority:t.priority??state.definition.priority},{owner:ev.source,priority:ev.priority}))continue;
  if(t.scope==='self'&&owner.id!==related.id||t.scope==='ally'&&owner.side!==related.side||t.scope==='enemy'&&owner.side===related.side)continue;
  const k=owner.id+':'+(state.sourceRoot??state.sourceKey)+':'+t.id;if(ev.seen.includes(k)||(t.uses&&((state.used[t.id]??0)>=t.uses))||(t.cooldownMs&&b.clock.timeMs-(state.last[t.id]??-Infinity)<t.cooldownMs))continue;
  // 倒地前/倒地后触发的复活、回血、免死：计入被保护单位的保命上限。
  const standKey=(point==='before_down'||point==='after_down')&&savesLife(unit(b,state.libraryOwner??owner.id)?.library,t.action)?'trig:'+owner.id+':'+(state.sourceRoot??state.sourceKey)+':'+t.id:undefined;
  const standHolder=standKey?unit(b,ev.target):undefined;
  if(standKey&&standHolder&&standUsed(standHolder,standKey)){log(b,'last_stand_capped',standHolder.id,'保命效果已达本场上限（按层级）');continue;}
  const ctx:Context={battle:b,caster:owner,target:unit(b,ev.target)??owner,key:k,event:{...ev,point,responseOwner:state.source,...(t.uses?{responseUses:t.uses}:{}),responseUnlimited:!t.uses&&!t.cooldownMs&&t.chance===undefined&&!t.payCost,responseProfile:stateClaim(state).profile,responsePriority:t.priority??state.definition.priority,frame:freshFrame(ev.frame?.budget)},libraryOwner:state.libraryOwner,sourceRoot:state.sourceRoot??state.sourceKey};
  if(!passes(t.conditions,ctx)||(t.chance!==undefined&&random(b)>=t.chance))continue;
  if(standKey&&standHolder){lastStand(b,standHolder,standKey);ctx.event.lastStandCounted=true;}
  ev.seen.push(k);state.used[t.id]=(state.used[t.id]??0)+1;state.last[t.id]=b.clock.timeMs;invoke(ctx,t.action,t.payCost);
 }
}
function reactionList(u:Unit,kind?:string,c?:Context){const entries=(u.statuses??[]).filter(s=>!s.suppressed&&live(s)).flatMap(state=>(state.definition.reactions??[]).map((r,index)=>({state,r,index}))).filter(x=>!kind||x.r.kind===kind);return c?orderClaims(c.battle,String(c.event.root),entries.map(x=>({...x,...stateClaim(x.state),priority:x.r.priority??x.state.definition.priority}))):entries;}
function reactionAllowed(c:Context,u:Unit,entry:ReturnType<typeof reactionList>[number],channels:readonly Channel[],element:string){const {state,r,index}=entry,key=`reaction:${u.id}:${state.sourceRoot??state.sourceKey}:${state.definition.name}:${index}`;
 if(c.event.seen.includes(key)||r.uses&&(state.used['r'+index]??0)>=r.uses||r.channels&&!r.channels.some(x=>channels.includes(x))||r.element&&elementKey(r.element)!==element||c.area&&!r.allowArea&&['share','substitute','redirect'].includes(r.kind))return false;
 if(r.attacker&&r.defender){const rc={...c,caster:u,target:c.caster},chance=(r.chance??.5)+(readFormula(r.attacker,u,c.caster,c.event,c.battle)-readFormula(r.defender,u,c.caster,c.event,c.battle))/(r.checkScale??100);if(!checkRoll(rc,chance,r.advantage))return false;}else if(r.chance!==undefined&&random(c.battle)>=r.chance)return false;c.event.seen.push(key);state.used['r'+index]=(state.used['r'+index]??0)+1;return true;
}
function rule(u:Unit,kind:string,key=''){return (u.statuses??[]).filter(s=>!s.suppressed&&s.rule?.kind===kind&&(s.rule.key===key||s.rule.key==='*')&&live(s)&&s.rule.uses!==0)[0];}
function consumeRule(s:StateInstance|undefined){if(s?.rule&&s.rule.uses>0){s.rule.uses--;if(!s.rule.uses)s.remaining=0,s.clock='battle_time';}}
/** 0.21 路线A：完全抵消预算与80%减伤上限。
  * 预算：每个单位每场 = 层级（Lv1-4=1 … Lv25=7）个“回合”。某回合里对等级不低于自己的敌对来源至少完全抵消过一次伤害
  * （取消、伤转疗、缩放为0、格挡/招架/吸收100%、全通道免疫、承伤上限压成0、必定闪避……），或处于不可选中/自我隔离，记1个回合。
  * 只有对一切伤害类型都覆盖时才算（staticExposure）；遗物来源的规则不计。 */
export const NEGATION_CAP=.8;
function relicSourced(s:{sourceRoot?:string;sourceKey?:string}){const r=s.sourceRoot??s.sourceKey??'';return r.startsWith('relic/')||r.startsWith('passive:relic/');}
/** 0.38.2 迷宫来源：遗物被动 / 遗物触发、开战修正（奇偶天平、沉睡的守卫）、迷宫事件（无人祭坛、空椅子、封印契约）。 */
function mazeSourced(s:{sourceRoot?:string;sourceKey?:string}){return relicSourced(s)||/^(relic\/|seal-bonus|opener:|event:)/.test(s.sourceRoot??'')||/^(opener:|event:|passive:seal-bonus)/.test(s.sourceKey??'');}
/** 宿主卡世界书《角色生成》资源推演与《核心数值总表》层级乘数：HP = 体 × 100 × HP乘数 + 五维总和；MP = (智 + 精) × 50 × MP/SP乘数；SP = (力 + 敏) × 50 × MP/SP乘数。 */
const HP_TIER_MUL=[1,2,4,10,20,40,100],MPSP_TIER_MUL=[1,2.5,6,15,35,80,160];
export function derivedResources(level:number,a:Record<typeof ATTR[number],number>):Resources{const i=Math.min(7,Math.max(1,Math.ceil(level/4)))-1,sum=ATTR.reduce((n,k)=>n+a[k],0);return {hp:a.体质*100*HP_TIER_MUL[i]!+sum,mp:(a.智力+a.精神)*50*MPSP_TIER_MUL[i]!,sp:(a.力量+a.敏捷)*50*MPSP_TIER_MUL[i]!};}
/** 0.21：敌方强加在 u 身上的效果（来源敌对、来源等级不高于 u、不是遗物）。必定生效的削弱与压制只对低等级完全有效。 */
function imposedOn(b:Battle,u:Unit,s:{source?:string;sourceLevel?:number;sourceRoot?:string;sourceKey?:string;origin?:string}):boolean{
 if(relicSourced({sourceRoot:s.sourceRoot??s.origin,sourceKey:s.sourceKey}))return false;const src=s.source?unit(b,s.source):undefined;
 return !!src&&src.id!==u.id&&allegiance(b,src)!==allegiance(b,u)&&(s.sourceLevel??src.level)<=u.level;
}
function negationRound(b:Battle){return b.round??Math.floor(b.clock.timeMs/ROUND_MS);}
function negationGuard(c:Context,t:Unit,original:number):{ref:number}|undefined{
 if(c.action?.category==='event_hazard')return;const src=effectiveSource(c);if(src.id===t.id||src.side===t.side||src.level<t.level)return;
 const ref=c.event.unmitigatedFor===t.id?Math.max(original,c.event.unmitigated??0):original;return ref>EPS?{ref}:undefined;
}
function negationState(t:Unit){return t.negation??={left:lastStandLimit(t.level),round:-1};}
function chargeNegation(b:Battle,t:Unit,what:string):boolean{
 const n=negationState(t),r=negationRound(b);if(n.round===r)return true;
 if(n.left<=0){if(n.warned!==r){n.warned=r;log(b,'negation_exhausted',t.id,what+'：完全抵消预算已用完（每场'+lastStandLimit(t.level)+'回合），对同级及以上来源最多减伤'+Math.round(NEGATION_CAP*100)+'%');}return false;}
 n.left--;n.round=r;log(b,'negation_budget',t.id,what+'：完全抵消，本场剩余'+n.left+'回合',n.left);return true;
}
function negationSpent(b:Battle,t:Unit){const n=t.negation;return !!n&&n.left<=0&&n.round!==negationRound(b);}
/** 目标自己（非遗物）的承伤缩放与真实反射：同样算进“对一切伤害都覆盖”。 */
function ownRule(t:Unit,kind:string){const s=activeRule(t,kind);return s&&!relicSourced(s)?s:undefined;}
/** 0.21：单位对一切伤害类型都覆盖时（或这条抗性挡住了攻击者全部的伤害手段），把一下伤害整段挡掉的其他机制
  * （比例反转、能力抗性、概念抗性）同样按回合扣预算；返回 true 表示预算已用完，这一下照常结算。 */
function wardExhausted(c:Context,t:Unit,s:StateInstance,label:string):boolean{
 if(relicSourced(s)||!negationGuard(c,t,1))return false;const src=effectiveSource(c);
 if(!wardCovers(src,s)&&!(staticExposure(c.battle,t,src)<=1-NEGATION_CAP+1e-9))return false;
 return !chargeNegation(c.battle,t,label);
}
/** 攻击者能主动使用的伤害手段是否全都被这条能力/概念抗性挡住；还有别的伤害进得来就不算完全覆盖（同单一属性免疫）。 */
function wardCovers(src:Unit,s:StateInstance):boolean{
 const kind=s.rule?.kind;if(kind!=='immune_source'&&kind!=='immune_concept')return false;
 const hits=(a:ActionSpec,depth:number):Extract<EffectSpec,{op:'damage'}>[]=>{const out:Extract<EffectSpec,{op:'damage'}>[]=[];if(depth>4)return out;const sub=(id?:string)=>{const x=id?a.library?.actions[id]??src.library?.actions[id]:undefined;if(x)out.push(...hits(x,depth+1));};
  for(const e of a.effects){if(e.op==='damage')out.push(e);else if(e.op==='sequence'||e.op==='repeat')sub(e.action);else if(e.op==='choose')e.actions.forEach(sub);else if(e.op==='branch'){sub(e.then);sub(e.otherwise);}else if(e.op==='check'){sub(e.success);sub(e.failure);}}return out;};
 const means=Object.entries(src.actions).map(([id,a])=>({id,a,d:hits(a,0)})).filter(x=>x.d.length);
 if(kind==='immune_source')return means.every(({id,a})=>matchesSource(actionMetadata(a,src.sources?.[a.source?.id??id]),s.rule!.filter,a.targeting?.selection==='all'||(a.targeting?.count??1)>1));
 return means.every(({d})=>d.every(e=>(e.tags??[]).some(tag=>s.rule!.key==='*'||s.rule!.key===tag)));
}
/** 不可选中 / 隐身 / 自我隔离（非敌对来源、非遗物）。 */
function targetingShield(b:Battle,u:Unit):StateInstance|undefined{return controls(u,'isolate').find(s=>!hostileSource(b,u,s)&&!relicSourced(s))??controls(u,'hidden').find(s=>!hostileSource(b,u,s)&&!relicSourced(s))??(u.statuses??[]).find(s=>!s.suppressed&&live(s)&&s.rule?.kind==='untargetable'&&s.rule.uses!==0&&!relicSourced(s));}
/** 自我封印（非敌对、非遗物来源的 sealed：不算存活、谁也碰不到）同样按回合扣预算；用完后封印立即失效。 */
function selfSeal(b:Battle,u:Unit){return (u.statuses??[]).find(s=>!s.suppressed&&live(s)&&s.rule?.kind==='sealed'&&s.rule.uses!==0&&!hostileSource(b,u,s)&&!relicSourced(s));}
function chargeProtection(b:Battle,u:Unit){if(b.exploration||u.escaped||u.current.hp<=0&&!u.zeroHpProtected)return;const seal=selfSeal(b,u);if(!seal&&(!isAlive(u)||!targetingShield(b,u)))return;if(!b.units.some(h=>isAlive(h)&&h.side!==u.side&&h.level>=u.level))return;
 if(!chargeNegation(b,u,seal?'自我封印':'不可选中/隔离')&&seal){seal.remaining=0;seal.clock='battle_time';log(b,'decisive_blocked',u.id,'完全抵消预算已用完：自我封印失效');recompute(u,b);}}
function exposedTo(b:Battle,t:Unit,caster:Unit,prot:StateInstance|undefined):boolean{if(!prot||relicSourced(prot)||hostileSource(b,t,prot)||allegiance(b,caster)===allegiance(b,t)||caster.level<t.level)return false;return negationSpent(b,t);}
/** 对全部通道×全部伤害类型取静态承伤比例的最大值；≤20% 说明单位对一切伤害都减免到了上限以下。不调用 opposingRule，避免记日志和裁决。
  * 0.21 复审：逐一模拟“落在某个通道、某种属性上的一下伤害”——先过目标必定发生的受到伤害通道转换，再乘护甲、属性减免、属性倍率、易伤
  * 和目标自己的承伤缩放；免疫的通道、真实反射、按次数整下吸收的护盾记 0；最后过限定通道或属性的格挡/招架/吸收
  * （不限通道与属性的在 receive 里按实际计入 agnostic）。ref 是本次命中的原始伤害，用来折算固定值格挡；不知道时固定值不计。
  * imposed：敌方强加在这名攻击者身上的输出削弱（按伤害起始通道），同样算目标这一方的覆盖。
  * 不提前返回：调用方还要乘本次命中的 agnostic 系数，需要真正的最大值。 */
function staticExposure(b:Battle,t:Unit,src:Unit,ref=Infinity,imposed?:Record<Channel,number>):number{
 const m=t.mitigation,vul=Math.max(0,t.stats?.vulnerability??1);let worst=0;
 const immune=(kind:string,key:string)=>(t.statuses??[]).some(s=>{if(s.suppressed||!live(s)||s.rule?.kind!==kind||s.rule.uses===0||s.rule.key!==key&&s.rule.key!=='*'||relicSourced(s))return false;const level=s.sourceLevel??unit(b,s.source)?.level??t.level;return s.rule.key==='*'?boundedInvuln(b,s)||src.level<level:level>=src.level;});
 // 目标自己的承伤缩放（taken_type_scale / dot_scale，取直接与持续伤害里较大的一档）、真实反射、按次数整下吸收的护盾。
 const tts=ownRule(t,'taken_type_scale'),dot=ownRule(t,'dot_scale'),reflect=!!ownRule(t,'true_reflect');const [tp,m1,m2]=tts?tts.rule!.key.split('|'):[];
 const typeScale=(el:string)=>tts?Math.max(0,el===tp?(Number(m1)||1):(Number(m2)||1)):1,dotScale=dot?Math.max(...[0,1].map(i=>Math.max(0,Number(dot.rule!.key.split('|')[i])||1))):1;
 const warded=new Set(t.shields.filter(w=>w.charges!==undefined&&w.charges>0&&!w.suppressed&&live(w)&&!relicSourced({sourceRoot:w.origin})).flatMap(w=>w.channels));
 const chan=Object.fromEntries(CHANNELS.map(ch=>[ch,immune('immune_channel',ch)||warded.has(ch)||ch==='true'&&reflect?0:(ch==='true'?Math.max(0,1-(t.stats?.reduction_true??0)):2000/(Math.max(0,m.armor[ch])+2000)*Math.max(0,1-m.attributeReduction[ch])*vul)*dotScale])) as Record<Channel,number>;
 // 必定发生、还有次数的反应（遗物来源不计）。
 const own=(t.statuses??[]).filter(s=>!s.suppressed&&live(s)&&!relicSourced(s)).flatMap(s=>(s.definition.reactions??[]).filter((r,i)=>(r.chance===undefined||r.chance>=1)&&!(r.attacker&&r.defender)&&(!r.uses||(s.used['r'+i]??0)<r.uses)));
 const conv=own.filter(r=>r.kind==='convert'&&r.direction==='incoming'&&r.fromChannel&&r.toChannel);
 const guards=own.filter(r=>['block','parry','absorb'].includes(r.kind)&&(!!r.channels&&!CHANNELS.every(ch=>r.channels!.includes(ch))||!!r.element));
 for(const el of DAMAGE_TYPES){if(immune('immune_element',el))continue;
  for(const ch of CHANNELS){const v={physical:0,energy:0,mental:0,true:0} as Record<Channel,number>;v[ch]=imposed?.[ch]??1;
   for(const r of conv){if(r.element&&elementKey(r.element)!==el)continue;const n=v[r.fromChannel!]*Math.min(1,Math.max(0,r.fraction??1));v[r.fromChannel!]-=n;v[r.toChannel!]+=n;}
   for(const x of CHANNELS)v[x]*=chan[x]*(x==='true'?1:typeMultiplier(m.elementMultipliers,el))*typeScale(el);
   for(const r of guards){if(r.element&&elementKey(r.element)!==el)continue;for(const x of CHANNELS){if(r.channels&&!r.channels.includes(x))continue;
    v[x]=r.kind==='absorb'?Math.max(0,v[x]*(1-Math.min(1,Math.max(0,r.fraction??1))*((r.resource??'hp')==='hp'?2:1))):Math.max(0,v[x]*(1-(r.fraction??(r.kind==='parry'?1:0)))-(r.flat??0)/4/ref);}}
   const f=CHANNELS.reduce((n,x)=>n+v[x],0);if(f>worst)worst=f;}}
 return worst;
}
function raiseParts(parts:Record<Channel,number>,shape:Record<Channel,number>,target:number){if(target<=EPS)return;const now=CHANNELS.reduce((n,ch)=>n+parts[ch],0);if(now>EPS){for(const ch of CHANNELS)parts[ch]*=target/now;return;}const total=CHANNELS.reduce((n,ch)=>n+shape[ch],0);for(const ch of CHANNELS)parts[ch]=total>EPS?shape[ch]*target/total:ch==='true'?target:0;}
function receive(c:Context,channels:Record<Channel,number>,element:string,priority:number,lethal=true,execute=false){
 element=elementKey(element);const b=c.battle;let t=c.target;const original=Object.values(channels).reduce((v,n)=>v+n,0);let parts={...channels};
 const before:EventContext={...c.event,source:c.caster.id,target:t.id,raw:original,control:{cancelled:false,scale:1}};
  if(!before.converted)emit(b,'before_damage',before);
  // 0.21 路线A：对等级不低于自己的敌对来源，任何机制把一次伤害完全抵消都按回合扣“完全抵消预算”（每场=层级）；
  // 预算用完后按最多减伤80%结算（至少吃到原始伤害的20%）。单一属性的免疫/抗性、对低等级来源都不受影响。
  let guard=negationGuard(c,t,original),forced=false,agnostic=1,redirected=0,charged=false,absorbHeal=0;
  if(before.control!.cancelled){if(!guard||chargeNegation(b,t,'取消伤害'))return 0;forced=true;}
  if(before.control!.recipient){const to=unit(b,before.control!.recipient),by=before.control!.authority?unit(b,before.control!.authority.owner):undefined;
   // 0.21：己方把整次伤害转给敌方或第三方（反弹、随机转移）等于自己完全抵消，按预算扣；用完后伤害留在原目标身上，按上限结算。
   if(to&&to.id!==t.id&&guard&&allegiance(b,to)!==allegiance(b,t)&&(!by||allegiance(b,by)===allegiance(b,t))&&!chargeNegation(b,t,'转移伤害'))forced=true;
   else if(to){t=to;c={...c,target:t};guard=negationGuard(c,t,original);}}
  const adjusted=(before.control!.amount??original)*before.control!.scale;
  if(before.control!.replacement==='heal'&&!forced){if(!guard||chargeNegation(b,t,'伤害转治疗')){performHeal({...c,event:{...before,converted:true}},'hp',adjusted,priority);return 0;}forced=true;}
  const factor=forced?1-NEGATION_CAP:original>0?adjusted/original:0;agnostic=forced?1-NEGATION_CAP:original>0?factor:1;
  for(const ch of CHANNELS)parts[ch]=original>0?parts[ch]*factor:0;
if(c.action?.category==='event_hazard'){const reduction=Math.min(1,(t.exploration??[]).filter(x=>x.kind==='danger_reduction').reduce((n,x)=>n+x.value,0));for(const ch of CHANNELS)parts[ch]*=1-reduction;}
 const immuneUses=new Set<StateInstance>();for(const ch of CHANNELS){const immunity=opposingRule(c,t,'immune_channel',ch,priority)??opposingRule(c,t,'immune_element',element,priority);if(immunity){parts[ch]=0;immuneUses.add(immunity);}}for(const immunity of immuneUses)consumeRule(immunity);
 for(const entry of reactionList(t,undefined,c)){
  const r=entry.r;if(c.bypass?.includes('reduction')&&contest(c,stateClaim(entry.state),priority,'不可减伤'))continue;if(!['block','parry','share','absorb','redirect','substitute'].includes(r.kind)||!reactionAllowed(c,t,entry,CHANNELS.filter(ch=>parts[ch]>0),element))continue;
   const whole=(!r.channels||CHANNELS.every(ch=>r.channels!.includes(ch)))&&!r.element,pre=CHANNELS.reduce((n,ch)=>n+parts[ch],0);
   if(r.kind==='block'||r.kind==='parry'){for(const ch of CHANNELS)if(!r.channels||r.channels.includes(ch))parts[ch]=Math.max(0,parts[ch]*(1-(r.fraction??(r.kind==='parry'?1:0)))-(r.flat??0)/4);if(whole&&pre>EPS)agnostic*=CHANNELS.reduce((n,ch)=>n+parts[ch],0)/pre;if(r.kind==='parry'&&r.cancelEffects!==false&&Object.values(parts).every(n=>n<=EPS)&&(!guard||redirected>EPS||!(agnostic*staticExposure(b,t,effectiveSource(c),guard.ref)<=1-NEGATION_CAP+1e-9)||chargeNegation(b,t,'招架'))){frame(c).blockedTargets[c.caster.id+'@'+t.id]=true;frame(c).blocked++;emit(b,'blocked',{...c.event,source:c.caster.id,target:t.id});if(r.action)invoke({...c,caster:unit(b,entry.state.source)??t,target:c.caster,key:entry.state.sourceKey,sourceRoot:entry.state.sourceRoot,libraryOwner:entry.state.libraryOwner,event:{...c.event,responseOwner:entry.state.source,responseProfile:stateClaim(entry.state).profile}},r.action);}}
   if(r.kind==='absorb'){let n=0;for(const ch of CHANNELS)if(!r.channels||r.channels.includes(ch)){const take=parts[ch]*(r.fraction??1);parts[ch]-=take;n+=take;}const res=r.resource??'hp';if(whole&&pre>EPS)agnostic*=Math.max(0,pre-n*(res==='hp'?2:1))/pre;if(res==='hp')absorbHeal+=n;else t.current[res]=Math.min(t.max[res],t.current[res]+n);}
  if(['share','redirect','substitute'].includes(r.kind)){
   const receiver=r.target==='lowest_ally'?b.units.filter(u=>u.side===t.side&&u.id!==t.id&&isAlive(u)).sort((a,z)=>a.current.hp-z.current.hp)[0]:unit(b,entry.state.source);
    if(receiver&&receiver.id!==t.id&&isAlive(receiver)){const split=Object.fromEntries(CHANNELS.map(ch=>[ch,parts[ch]*(r.fraction??1)])) as Record<Channel,number>;for(const ch of CHANNELS)parts[ch]-=split[ch];redirected+=CHANNELS.reduce((n,ch)=>n+split[ch],0);receive({...c,target:receiver},split,element,priority,lethal,execute);}
  }
 }
  // 完全抵消/超过80%的减免：只有对一切伤害类型都覆盖时才算（单一属性免疫、别的伤害照样进得来，不算）。
  const floor=guard?guard.ref*(1-NEGATION_CAP):0,covered=(extra=1)=>forced||agnostic*extra*staticExposure(b,t,effectiveSource(c),guard?.ref,c.event.unmitigatedFor===t.id?c.event.imposed:undefined)<=1-NEGATION_CAP+1e-9;
  // 吸收成生命（absorb→hp）既减伤又回血，按两倍计入；净伤害=落到身上的+分给别人的−吸收回的血。
  if(guard&&floor>EPS){const sum=CHANNELS.reduce((n,ch)=>n+parts[ch],0)+redirected;if(sum-absorbHeal<floor-EPS&&covered()){if(sum<=EPS&&!forced&&chargeNegation(b,t,'完全抵消'))charged=true;else{absorbHeal=Math.max(0,Math.min(absorbHeal,sum-floor));if(sum-absorbHeal<floor-EPS)raiseParts(parts,channels,floor-redirected+absorbHeal);log(b,'negation_capped',t.id,'对同级及以上来源最多减伤'+Math.round(NEGATION_CAP*100)+'%',Math.round(floor));}}}
  if(absorbHeal>EPS)t.current.hp=Math.min(t.max.hp,t.current.hp+absorbHeal);
  let left=0,absorbed=0,guardedRes=0,chargeTaken=0;const hitWards=new Set<Ward>();
for(const ch of CHANNELS){let damage=parts[ch];for(const ward of [...t.shields].sort((a,z)=>(z.order??0)-(a.order??0))){if(ward.suppressed||!live(ward)||!ward.channels.includes(ch))continue;if(c.bypass?.includes('shield')&&contest(c,{owner:ward.source??t.id,priority:ward.priority},priority,'无视护盾'))continue;
   if(ward.charges!==undefined){if(ward.charges>0||hitWards.has(ward)){absorbed+=damage;if(!relicSourced({sourceRoot:ward.origin}))chargeTaken+=damage;damage=0;hitWards.add(ward);} }
   else{const take=Math.min(ward.amount,damage);ward.amount-=take;damage-=take;absorbed+=take;}
   if(damage<=0)break;
  }left+=damage;
 }
 // 0.21：按次数整下吃掉伤害的护盾（charges）不是额外血量，而是按次完全抵消：整下被它吃掉时按回合扣预算；
 // 预算用完、或只吃掉一部分时，落到身上的（生命+普通护盾）至少是下限。覆盖判定在扣次数之前做。
 if(guard&&floor>EPS&&!charged&&chargeTaken>EPS){const kept=left+absorbed-chargeTaken;if(kept<floor-EPS&&covered()){if(kept<=EPS&&chargeNegation(b,t,'次数护盾'))charged=true;else{const give=Math.min(chargeTaken,floor-kept);left+=give;absorbed-=give;log(b,'negation_capped',t.id,'按次数抵挡的护盾：对同级及以上来源最多减伤'+Math.round(NEGATION_CAP*100)+'%',Math.round(floor));}}}
 for(const ward of hitWards){ward.charges!--;if(ward.charges===0)ward.amount=0;}
 for(const ward of t.shields.filter(w=>w.amount<=EPS)){emit(b,'shield_break',{...c.event,source:c.caster.id,target:t.id,raw:original,actual:absorbed});log(b,'shield_break',t.id,ward.id);}
 t.shields=t.shields.filter(w=>w.amount>EPS&&live(w));
  const leftBeforeCap=left;
  for(const entry of reactionList(t,undefined,c))if(['damage_cap','resource_guard'].includes(entry.r.kind)&&reactionAllowed(c,t,entry,CHANNELS.filter(ch=>parts[ch]>0),element)){
  const r=entry.r;if(c.bypass?.includes('reduction')&&contest(c,stateClaim(entry.state),priority,'无视承伤保护'))continue;if(r.kind==='damage_cap'){const reset=r.reset??'round',key='cap:'+reset+':'+entry.index,limit=Math.max(0,r.amount?value(r.amount,c):t.max.hp*(r.fraction??1)),allowed=Math.max(0,limit-(entry.state.used[key]??0));left=Math.min(left,allowed);entry.state.used[key]=(entry.state.used[key]??0)+Math.min(left,t.current.hp);}
  else{const res=r.resource??'mp',ratio=Math.max(EPS,r.fraction??1),absorbed=Math.min(left,t.current[res]*ratio);t.current[res]-=absorbed/ratio;left-=absorbed;guardedRes+=absorbed;log(b,'resource_guard',t.id,res,absorbed);if(r.reflect&&absorbed>0)receive({...c,caster:t,target:c.caster,event:{...c.event,point:'reaction',responseOwner:entry.state.source,responseProfile:stateClaim(entry.state).profile,frame:freshFrame(c.event.frame?.budget)}},{physical:0,energy:0,mental:0,true:absorbed*r.reflect},element,r.priority??entry.state.definition.priority);}
 }
  // 承伤上限（damage_cap）把本次伤害压到下限以下时同样计入：全压成0扣预算，否则抬到下限；下限取原始伤害20%与最大生命20%的较小者，
  // 所以“每回合最多掉X%生命（X≥20）”的第一下不受影响；本回合额度用完后再挨的命中被压成0，算完全抵消（走预算）。
  if(guard&&floor>EPS&&!charged&&left<leftBeforeCap-EPS){const capFloor=Math.min(floor,t.max.hp*(1-NEGATION_CAP)),kept=absorbed+guardedRes+redirected,got=left+kept;if(got<capFloor-EPS&&covered(got/Math.max(EPS,leftBeforeCap+absorbed+redirected))){if(got<=EPS&&!forced&&chargeNegation(b,t,'承伤上限'))charged=true;else{left=Math.max(left,capFloor-kept);log(b,'negation_capped',t.id,'承伤上限对同级及以上来源最多减伤'+Math.round(NEGATION_CAP*100)+'%（单次至多按最大生命20%计）',Math.round(capFloor));}}}
  let loss=Math.min(t.current.hp-(lethal?0:Math.min(1,t.current.hp)),Math.max(0,Math.floor(left)));
if(loss>=t.current.hp&&isAlive(t)){
  const protections=(t.statuses??[]).filter(s=>!s.suppressed&&live(s)&&s.rule&&['death_guard','undying'].includes(s.rule.kind)&&s.rule.uses!==0&&(standFree(s,b)||!standUsed(t,'rule:'+(s.sourceRoot??s.sourceKey))));
  const guard=strongest(c,protections.filter(s=>!execute&&!c.bypass?.includes('death_guard')||!contest(c,stateClaim(s),priority,'绝杀/免死')));
  if(guard&&!standFree(guard,b)&&!lastStand(b,t,'rule:'+(guard.sourceRoot??guard.sourceKey))){t.zeroHpProtected=false;}
  else if(guard){guard.used.stand=standRound(b);if(guard.rule!.kind==='undying')t.zeroHpProtected=true;else loss=Math.max(0,t.current.hp-Math.max(1,guard.rule!.amount));guardTriggered(c,guard,t);log(b,'death_guard',t.id,guard.definition.name);}
  else{t.zeroHpProtected=false;if((t.statuses??[]).some(s=>!s.suppressed&&live(s)&&s.rule&&['death_guard','undying'].includes(s.rule.kind)&&s.rule.uses!==0&&standUsed(t,'rule:'+(s.sourceRoot??s.sourceKey))))log(b,'last_stand_capped',t.id,'保命效果本场已达上限（按层级）');}
 }
 loss=Math.max(0,loss);t.current.hp-=loss;if(activeRule(t,'hp_gate_attrs'))recompute(t,b);if(t.current.hp<=0&&!t.zeroHpProtected){t.deathEvent={source:issuer(c,priority).owner,root:c.event.root,priority,execute};if(execute){orderClaims(b,String(c.event.root),[issuer(c,priority),{owner:t.id}]);t.deathSeal={owner:issuer(c,priority).owner,priority,root:c.event.root,...(b.conflicts?.some(x=>x.key===String(c.event.root))?{ranking:clone(b.conflicts.find(x=>x.key===String(c.event.root))!)}:{})};t.noRevivePriority=priority;}}const ev={...c.event,source:c.caster.id,target:t.id,raw:original,actual:loss,priority,execute};
 log(b,'damage',t.id,ev.critical?'暴击':'命中',loss);if(absorbed)log(b,'absorbed',t.id,'护盾',absorbed);
 if(loss>0){t.statuses=t.statuses?.filter(s=>!s.definition.breakOnDamage);tallyDamage(b,t,c.caster,loss);emit(b,'damage_dealt',ev);emit(b,'damage_received',ev);}
 for(const entry of reactionList(t,undefined,c)){
  const r=entry.r;if(!['reflect','counter'].includes(r.kind)||!reactionAllowed({...c,event:ev},t,entry,CHANNELS.filter(ch=>channels[ch]>0),element))continue;
  const rc:Context={...c,caster:t,target:c.caster,key:entry.state.id,event:{...ev,point:'reaction',responseOwner:entry.state.source,responseProfile:stateClaim(entry.state).profile,frame:freshFrame(ev.frame?.budget)},libraryOwner:entry.state.libraryOwner,sourceRoot:entry.state.sourceRoot??entry.state.sourceKey};
  if(r.kind==='counter'&&r.action)invoke(rc,r.action);
  if(r.kind==='reflect'){const n=(r.basis==='raw'?original:loss)*(r.fraction??1)+(r.flat??0);receive(rc,{physical:0,energy:0,mental:0,true:n},element,r.priority??0,true);}
 }
 for(const entry of reactionList(c.caster,undefined,c))if(['lifesteal','manasteal'].includes(entry.r.kind)&&reactionAllowed({...c,event:ev},c.caster,entry,CHANNELS.filter(ch=>channels[ch]>0),element)){const r=entry.r,res=r.kind==='lifesteal'?'hp':'mp';c.caster.current[res]=Math.min(c.caster.max[res],c.caster.current[res]+(r.basis==='raw'?original:loss)*(r.fraction??1));}
 return loss;
}
/** 秒杀类：绝杀（无视免死）或直接按目标生命100%结算。 */
function killsOutright(x:AmountSpec){return (x.resourceSubject==='target'&&x.currentResource==='hp'&&(x.currentFraction??0)>=1)||(x.subject==='target'&&x.maxResource==='hp'&&x.maxFraction>=1);}
function decisiveDamage(e:Extract<EffectSpec,{op:'damage'}>){return !!e.execute||!!e.bypass?.includes('death_guard')||Object.values(e.amounts).some(killsOutright);}
/** 对不低于自己等级的目标：绝杀退化为普通伤害（免死照常）；带斩杀线条件的附加秒杀段不生效，无条件秒杀按一次普通技能伤害结算。 */
function gateDecisiveDamage(e:Extract<EffectSpec,{op:'damage'}>,c:Context):Extract<EffectSpec,{op:'damage'}>|undefined{
 if(!decisiveDamage(e)||decisiveAllowed(effectiveSource(c),c.target))return e;
 log(c.battle,'decisive_blocked',c.target.id,'秒杀/绝杀只对低等级目标生效，按普通伤害结算');
 const g=clone(e);g.execute=false;if(g.bypass)g.bypass=g.bypass.filter(x=>x!=='death_guard');
 const conditional=(e.conditions??[]).some(x=>x.subject==='target'&&(x.kind==='resource_ratio'||x.kind==='resource'));
 let replaced=false;for(const ch of CHANNELS){const x=g.amounts[ch];if(killsOutright(x)){if(conditional)return undefined;g.amounts[ch]={flat:40,attribute:(c.caster.attributes.智力??0)>(c.caster.attributes.力量??0)?'智力':'力量',factor:12,scale:'host_tier',maxResource:'none',maxFraction:0};replaced=true;}}
 void replaced;return g;
}
function damage(e0:Extract<EffectSpec,{op:'damage'}>,c:Context){
 const {battle:b,caster:a,target:t}=c;if(!isAlive(t)){c.event.actual=0;c.event.raw=0;return;}
 const e=gateDecisiveDamage(e0,c);if(!e){c.event.actual=0;c.event.raw=0;return;}
 if(t.blanketImmunity&&effectiveSource(c).side!==t.side&&(!blanketBounded(b,t)&&effectiveSource(c).level>=t.level||e.bypass?.includes('immunity')&&contest(c,{owner:t.id},e.priority??0,'必定伤害/一切伤害无效'))){const saved=t.mitigation,relaxed=relaxBlanket(t),vul=t.stats?.vulnerability;t.mitigation=relaxed;if(vul!==undefined&&vul<=0)t.stats!.vulnerability=1;log(b,'decisive_blocked',t.id,'一切伤害无效只对低等级攻击者生效');try{damageInner(e,c);}finally{if(t.mitigation===relaxed){t.mitigation=saved;if(vul!==undefined&&vul<=0&&t.stats)t.stats.vulnerability=vul;}}return;}
 damageInner(e,c);
}
function damageInner(e:Extract<EffectSpec,{op:'damage'}>,c:Context){
 const {battle:b,caster:a,target:t}=c;
 const guaranteed=strongest(c,(a.statuses??[]).filter(s=>!s.suppressed&&live(s)&&s.rule?.kind==='guaranteed_hit'&&s.rule.uses!==0)),evade=strongest(c,(t.statuses??[]).filter(s=>!s.suppressed&&live(s)&&s.rule?.kind==='guaranteed_evade'&&s.rule.uses!==0&&!(s.rule.uses<0&&s.rule.key==='*'&&!boundedInvuln(c.battle,s)&&effectiveSource(c).level>=(s.sourceLevel??unit(c.battle,s.source)?.level??t.level))));let hitRule=e.hitRule;
 const claims:({owner:string;priority:number;hit:'guaranteed'|'impossible';state?:StateInstance})[]=[];
 if(guaranteed)claims.push({...stateClaim(guaranteed),priority:guaranteed.definition.priority,hit:'guaranteed',state:guaranteed});
 if(evade)claims.push({...stateClaim(evade),priority:evade.definition.priority,hit:'impossible',state:evade});
 if(e.hitRule!=='normal')claims.push({owner:a.id,priority:e.priority??0,hit:e.hitRule});
 if(claims.length){const winner=orderClaims(b,String(c.event.root),claims)[0]!;hitRule=winner.hit;consumeRule(winner.state);if(claims.some(x=>x.hit!==winner.hit))log(b,'conflict',winner.owner,'必中/必闪:等级>速度>种子随机');
   // 0.21：必定闪避也是完全抵消，对同级及以上敌对来源按回合扣预算；预算用完后按普通命中判定。
   if(hitRule==='impossible'&&winner.state&&winner.state===evade&&!relicSourced(evade)&&negationGuard(c,t,1)&&!chargeNegation(b,t,'必定闪避'))hitRule='normal';}
 c={...c,bypass:e.bypass};
 const resolved=resolveDamageTypes(e);
 if(resolved.perType){for(const [i,type] of resolved.types.entries())resolveHit(e,{...c,key:c.key+':type'+i},hitRule,type,typeMultiplier(t.mitigation.elementMultipliers,type),resolved.types.length);return;}
 const chosen=bestType(t.mitigation.elementMultipliers,resolved.types);
 resolveHit(e,c,hitRule,chosen.type,resolved.fixed?1:chosen.multiplier,1);
}
/** 单次属性结算：elemental为该属性承伤倍率（0=无效）。perType时每个属性各以全额威力独立命中一次。 */
function resolveHit(e:Extract<EffectSpec,{op:'damage'}>,c:Context,hitRule:'normal'|'guaranteed'|'impossible',type:DamageType,elemental:number,typeCount:number){
 const {battle:b,caster:a,target:t}=c;if(!isAlive(t))return;
 const power=c.powerCaster??a;const pen=Math.min(1,Math.max(0,(e.penetration??0)+(power.stats?.penetration??0))),base={} as Record<Channel,number>;
 // 0.35「?」：按比例计算的伤害全额反转为目标的治疗；真实通道的伤害在任何减免之前原样弹回攻击者。两者都先于抗性。
 let reflectedTrue=0;
 if(a.id!==t.id&&!(c.event.replayDepth??0)){
  const percentHit=CHANNELS.some(ch=>{const am=e.amounts[ch] as {maxFraction?:number;currentFraction?:number};return (am.maxFraction??0)!==0||(am.currentFraction??0)!==0;});
  const toHeal=percentHit?activeRule(t,'percent_to_heal'):undefined;
  if(toHeal&&!wardExhausted(c,t,toHeal,'比例反转')){const n=CHANNELS.reduce((s,ch)=>s+Math.max(0,value(e.amounts[ch],c)),0)*(c.scale??1);log(b,'heal',t.id,'比例反转',n);performHeal({...c,event:{...c.event,converted:true}},'hp',n,e.priority??0);return;}
  const trueAmount=Math.max(0,value(e.amounts.true,c))*(c.scale??1);
  const reflector=trueAmount>0?activeRule(t,'true_reflect'):undefined;
  if(reflector){const rest=CHANNELS.filter(ch=>ch!=='true').reduce((s,ch)=>s+Math.max(0,value(e.amounts[ch],c)),0);log(b,'damage',a.id,'真实反射',trueAmount);
   runEffects({...c,caster:t,target:a,powerCaster:undefined,scale:1,key:c.key+':reflect',event:{...c.event,source:t.id,target:a.id,replayDepth:1}},[{op:'damage',amounts:{physical:{...e.amounts.physical,flat:0,factor:0,maxFraction:0},energy:{...e.amounts.energy,flat:0,factor:0,maxFraction:0},mental:{...e.amounts.mental,flat:0,factor:0,maxFraction:0},true:{flat:trueAmount,attribute:'none',factor:0,scale:'flat',maxResource:'none',maxFraction:0}},element:'none',hitChance:1,hitRule:'guaranteed',critChance:0,critMultiplier:1,bypass:['shield','reduction'],lethal:true} as EffectSpec],[a.id]);
   // 0.21：对一切伤害类型都覆盖时（其余通道也减到上限以下），弹回的真实伤害仍算进这一下的原始伤害：整下归零走预算，用完后按上限吃到20%。
   if(!relicSourced(reflector)&&negationGuard(c,t,trueAmount)&&staticExposure(b,t,effectiveSource(c))<=1-NEGATION_CAP+1e-9)reflectedTrue=trueAmount;else if(rest<=0)return;
   e={...e,amounts:{...e.amounts,true:{...e.amounts.true,flat:0,factor:0,maxFraction:0,currentFraction:0}}} as typeof e;}
 }
 // 0.34 规则：草稿/定稿（draft）与技能属性改写（element_rewrite）都挂在攻击者身上，按它最近提交的技能判定。
 let draftScale=1;const lastSkill=a.history?.[a.history.length-1]??'';const draft=activeRule(a,'draft');
 if(draft&&lastSkill&&a.actions[lastSkill]?.category!=='command'){const marked=(t.statuses??[]).find(s=>s.definition.name==='线稿'&&s.source===a.id);if(marked){draftScale=Number(draft.rule!.key)||3;hitRule='guaranteed';t.statuses=t.statuses!.filter(s=>s!==marked);}else if((a.used[lastSkill]??0)<=1){draftScale=.3;const d=simpleStatus('线稿',{clock:'round',value:4});d.polarity='negative';d.tags=['x-lineart'];addStatus({...c,target:t},c.key+':draft',d);}}
 // 0.21：敌方强加在攻击者身上的属性改写、输出转换对等级不低于施加者的攻击者不生效；输出缩放记进 imposedScale（按目标的覆盖计入）。
 const rewrite=activeRule(a,'element_rewrite');if(rewrite&&!imposedOn(b,a,rewrite)){const [sid,el]=rewrite.rule!.key.split('|');if(sid&&el&&(sid==='*'||sid===lastSkill)&&a.actions[lastSkill]?.category!=='command'){type=el as DamageType;elemental=typeMultiplier(t.mitigation.elementMultipliers,type);const tagged=rewrite as unknown as {cmdTag?:string};if(tagged.cmdTag!==String(c.event.commandId??'')){tagged.cmdTag=String(c.event.commandId??'');consumeRule(rewrite);}}}
 // 0.36 R04：每场战斗第一个造成伤害的技能 ×key（同一命令内的多段都算）。
 // 0.36.1：按血线切换攻击（空腹护身符）、按属性缩放输出 / 承伤（白纸 / 棱镜）、持续伤害缩放（忍耐之环）。
 let gateScale=1,imposedScale=1,imposedCover=1;const gate=activeRule(a,'hp_gate_damage');if(gate){const [lo,hi,th]=gate.rule!.key.split('|').map(Number);const f=a.current.hp/Math.max(1,a.max.hp)<(th||.5)?(lo||1):(hi||1);if(imposedOn(b,a,gate)){imposedScale*=f;imposedCover*=f;}else gateScale*=f;}
 const ts=activeRule(a,'type_scale');if(ts){const [tp,m1,m2]=ts.rule!.key.split('|');const f=type===tp?(Number(m1)||1):(Number(m2)||1);if(imposedOn(b,a,ts)){imposedScale*=f;imposedCover*=Math.max(Number(m1)||1,Number(m2)||1);}else gateScale*=f;}
 // 0.21：目标自己能力里的承伤缩放不算进原始伤害（80%上限的基准）；遗物的照旧。
 let ownTaken=1;const tts=activeRule(t,'taken_type_scale');if(tts){const [tp,m1,m2]=tts.rule!.key.split('|');const f=type===tp?(Number(m1)||1):(Number(m2)||1);if(relicSourced(tts))gateScale*=f;else ownTaken*=f;}
 const dot=activeRule(t,'dot_scale');if(dot){const [tick,direct]=dot.rule!.key.split('|').map(Number);const f=c.event.point==='tick'?(tick||1):(direct||1);if(relicSourced(dot))gateScale*=f;else ownTaken*=f;}
 let nthScale=1;const nth=activeRule(a,'nth_skill_scale');if(nth&&lastSkill&&a.actions[lastSkill]?.category!=='command'){const [,mult]=nth.rule!.key.split('|');const tag=nth as unknown as {cmdTag?:string},cmd=String(c.event.commandId??'');if(tag.cmdTag===undefined||tag.cmdTag===cmd){tag.cmdTag=cmd;if(imposedOn(b,a,nth)){imposedScale*=Number(mult)||1;imposedCover*=Number(mult)||1;}else nthScale=Number(mult)||1;}else{a.statuses=a.statuses?.filter(s=>s!==nth);}}
 // 原始伤害（80%上限的基准）不含目标自己的承伤缩放和敌方强加的输出削弱；强加的削弱按通道记进 imposed，由 receive 并入覆盖判定。伤害基数不为负。
 let rawTotal=reflectedTrue*draftScale*nthScale*gateScale;const imposed={physical:1,energy:1,mental:1,true:1} as Record<Channel,number>;const anyImposed=imposedScale!==1||imposedCover!==1||!!power.free;
 const out=(n:number,x?:{flat:number;multiplier:number})=>n>0?Math.max(0,(n+(x?.flat??0))*(x?.multiplier??1)):0;
 const n0s=Object.fromEntries(CHANNELS.map(ch=>[ch,Math.max(0,value(e.amounts[ch],c))*(c.scale??1)*draftScale*nthScale*gateScale])) as Record<Channel,number>,nAll=CHANNELS.reduce((n,ch)=>n+n0s[ch],0);
 for(const ch of CHANNELS){const n0=n0s[ch],bonus=power.damageBonus?.[ch],own=power.free?.damage[ch]??bonus;
  base[ch]=out(n0*imposedScale*ownTaken,bonus);rawTotal+=out(n0,own);
  // 本次没有的通道按整下的量折算：强加的削弱对攻击者换用的任何通道同样生效才算覆盖。
  if(anyImposed){const n=n0>0?n0:nAll,free=out(n,own);if(free>0)imposed[ch]=out(n*imposedCover,bonus)/free;}}
 for(const [owner,direction] of [[a,'outgoing'],[t,'incoming']] as const)for(const entry of reactionList(owner,'convert',c))if((entry.r.direction??'outgoing')===direction&&!(owner===a&&imposedOn(b,a,entry.state))&&reactionAllowed(c,owner,entry,CHANNELS,type)){const from=entry.r.fromChannel!,to=entry.r.toChannel!,n=base[from]*(entry.r.fraction??1);base[from]-=n;base[to]+=n;}
 const bypassReduction=e.bypass?.includes('reduction')&&contest(c,{owner:t.id},e.priority??0,'不可减免');
 const armor=Object.fromEntries(Object.entries(t.mitigation.armor).map(([k,v])=>[k,bypassReduction?0:v*(1-pen)])) as Mitigation['armor'];
 const result=calculateDamage({attackerLevel:power.level,targetLevel:t.level,seed:b.seed,base,armor,attributeReduction:bypassReduction?{physical:0,energy:0,mental:0}:t.mitigation.attributeReduction,channelMultiplier:{physical:elemental*(t.stats?.vulnerability??1),energy:elemental*(t.stats?.vulnerability??1),mental:elemental*(t.stats?.vulnerability??1),true:bypassReduction?1:1-(t.stats?.reduction_true??0)},hitChance:Math.max(0,Math.min(1,e.hitChance+(power.stats?.hit??0)-(t.stats?.evade??0))),hitRule,critChance:Math.max(0,Math.min(1,e.critChance+(power.stats?.crit??0))),critMultiplier:Math.max(1,(e.critMultiplier+(power.stats?.crit_multiplier??0))*(t.stats?.crit_taken??1))});
 b.seed=result.seed;if(!result.hit){c.event.actual=0;c.event.raw=0;if(frame(c).owner===a.id)frame(c).misses++;log(b,'miss',t.id,'未命中');emit(b,'miss',{...c.event,source:a.id,target:t.id});return;}
 if(elemental!==1)log(b,'affinity',t.id,type+'·'+affinityLabel(elemental),elemental);else if(typeCount>1)log(b,'affinity',t.id,type,1); // 无效时伤害为0，但命中、附带状态与命中计数照常。
 if(c.hitCallback&&!c.hitCallback())return;
 const critMult=Math.max(1,(e.critMultiplier+(power.stats?.crit_multiplier??0))*(t.stats?.crit_taken??1));
 const ev={...c.event,source:a.id,target:t.id,critical:result.critical,priority:e.priority??0,execute:e.execute??false,raw:Object.values(result.channels).reduce((n,v)=>n+v,0),unmitigated:rawTotal*result.suppression.damageMultiplier*(result.critical?critMult:1),unmitigatedFor:t.id,...(anyImposed?{imposed}:{})};
 const actual=receive({...c,event:ev},result.channels,type,e.priority??0,e.lethal!==false,e.execute);
 if(e.drain){const r=e.drain.resource;a.current[r]=Math.min(a.max[r],a.current[r]+(e.drain.basis==='raw'?ev.raw:actual)*e.drain.fraction);}
 c.event.actual=actual;c.event.raw=ev.raw;c.event.critical=result.critical;if(frame(c).owner===a.id){frame(c).damage+=actual;frame(c).raw+=ev.raw;}if(!frame(c).blockedTargets[c.caster.id+'@'+t.id]){if(frame(c).owner===a.id)frame(c).hits++;emit(b,'hit',ev);frame(c).groups[a.id+'|'+(e.hitGroup??'attack')+'@'+t.id]=(frame(c).groups[a.id+'|'+(e.hitGroup??'attack')+'@'+t.id]??0)+1;if(e.onHitAction)invoke(c,e.onHitAction);}settleDeaths(b,ev);
}
function settleDeaths(b:Battle,ev:EventContext){
 for(const u of b.units){
  if(isAlive(u)){if(u.deadHandled){u.deadHandled=false;const cu=clockUnit(b,u.id);cu.active=true;cu.atb=0;}continue;}
  if(u.deadHandled)continue;
  const death=u.deathEvent?{...ev,...u.deathEvent,root:u.deathEvent.root,target:u.id}:ev;
  emit(b,'before_down',{...death,target:u.id});
  for(const entry of reactionList(u,'death_guard',{battle:b,caster:unit(b,death.source)??u,target:u,key:'death',event:death}))if(u.current.hp<=0&&(!death.execute||winsConflict(b,String(death.root),{owner:entry.state.source,priority:entry.r.priority??entry.state.definition.priority},{owner:death.source,priority:death.priority}))&&!standUsed(u,'react:'+(entry.state.sourceRoot??entry.state.sourceKey)+':'+entry.index)&&reactionAllowed({battle:b,caster:unit(b,ev.source)??u,target:u,key:'death',event:death},u,entry,CHANNELS,'')&&lastStand(b,u,'react:'+(entry.state.sourceRoot??entry.state.sourceKey)+':'+entry.index)){u.current.hp=Math.min(u.max.hp,Math.max(1,entry.r.flat??u.max.hp*(entry.r.fraction??.01)));}
  if(isAlive(u)){delete u.deathSeal;delete u.noRevivePriority;delete u.deathEvent;continue;}
  u.deadHandled=true;b.clock=deactivateUnit(b.clock,u.id);
  for(const [id,cmd] of Object.entries(b.commands))if(cmd.caster===u.id)delete b.commands[id];
  log(b,'down',u.id,'倒地');emit(b,'after_down',{...death,target:u.id});
  if(isAlive(u)){u.deadHandled=false;clockUnit(b,u.id).active=true;continue;}
  u.defeated=true;const killer=unit(b,death.source);if(killer&&killer.id!==u.id){killer.kills=(killer.kills??0)+1;emit(b,'kill',{...death,target:u.id});}
  u.statuses=u.statuses?.filter(s=>!s.definition.removeOnDeath);
  for(const summoned of b.units.filter(x=>x.owner===u.id&&isAlive(x))){
   if(summoned.summon?.ownerDeath==='despawn'){summoned.current.hp=0;summoned.zeroHpProtected=false;summoned.escaped=true;summoned.deadHandled=true;b.clock=deactivateUnit(b.clock,summoned.id);log(b,'recall',summoned.id,'召唤者倒地');}
   else if(summoned.summon?.ownerDeath==='expire_after_action'){summoned.summon.clock='target_action';summoned.summon.remaining=1;}
  }
 }
}
function refreshFields(b:Battle){
 for(const f of b.fields??[]){const owner=unit(b,f.owner);if(!owner)continue;const ctx:Context={battle:b,caster:owner,target:owner,key:f.id,sourceRoot:f.sourceRoot,event:event(b,owner.id,owner.id),libraryOwner:owner.id};
  const targets=live(f)?select(ctx,{...f.targeting,selection:'all'},[]):[];
  for(const u of b.units){const present=targets.some(t=>t.id===u.id);if(!present)u.statuses=u.statuses?.filter(s=>s.sourceKey!==f.id);else if(!u.statuses?.some(s=>s.sourceKey===f.id)){const d=owner.library!.statuses[f.status]!;addStatus({...ctx,target:u},f.id, {...d,duration:{clock:'field',value:0}}).definitionId=f.status;}}
  f.members=targets.map(t=>t.id);
 }
 b.fields=b.fields?.filter(live);
}
function synchronize(b:Battle,resolveOutcome=true){
 refreshSourceLocks(b);expirePassives(b);
 for(const u of b.units){expireStatuses(b,u);u.shields=u.shields.filter(x=>x.amount>0&&live(x));u.speeds=u.speeds.filter(live);u.statuses=u.statuses?.filter(live);u.exploration=u.exploration?.filter(live);recompute(u,b);}
 refreshFields(b);
 b.clock.pending=b.clock.pending.filter(p=>p.kind!=='ready'||!clockUnit(b,p.unitId).stopped);
 reconcileLifeLinks(b);
 if(!resolveOutcome)return;
 settleDeaths(b,event(b,b.units[0]!.id,b.units[0]!.id));
 reconcileLifeLinks(b);
 // 胜负只看正式成员：我方召唤物不计入（我方真人全灭即失败），敌方召唤物照常计入。
 const ally=b.units.some(u=>u.side==='ally'&&!u.owner&&isAlive(u)),enemy=b.units.some(u=>u.side==='enemy'&&isAlive(u));
 const pendingRevive=(side:string)=>(b.scheduled??[]).some(s=>{if(unit(b,s.target)?.side!==side||side==='ally'&&unit(b,s.target)?.owner||!['battle_time','round'].includes(s.clock??''))return false;const lib=unit(b,s.owner)?.library;const seen=new Set<string>();const find=(id:string):boolean=>{if(seen.has(id))return false;seen.add(id);return lib?.actions[id]?.effects.some(e=>e.op==='revive'?true:e.op==='sequence'||e.op==='repeat'?find(e.action):e.op==='branch'?find(e.then)||!!e.otherwise&&find(e.otherwise):e.op==='check'?find(e.success)||!!e.failure&&find(e.failure):false)??false;};return find(s.action);});
 if((!ally&&!pendingRevive('ally')&&!hasLinkedReturn(b,'ally'))||(!enemy&&!pendingRevive('enemy')&&!hasLinkedReturn(b,'enemy'))){
  if(!b.endedEmitted){b.endedEmitted=true;for(const u of b.units)emit(b,'battle_end',event(b,u.id,u.id,'battle_end'));settleDeaths(b,event(b,b.units[0]!.id,b.units[0]!.id));}
  const a=b.units.some(u=>u.side==='ally'&&!u.owner&&isAlive(u)),e=b.units.some(u=>u.side==='enemy'&&isAlive(u));
  if(!a||!e){b.outcome=a?'victory':'defeat';b.clock.ended=true;b.clock.pending=[];b.commands={};}
 }
}
function sourceImmunity(c:Context,e:EffectSpec):StateInstance|undefined {
 if(['variable','counter','branch','repeat','choose','sequence','check'].includes(e.op))return;
 const meta=actionMetadata(c.action,c.caster.sources?.[c.sourceRoot??c.key]);
 return strongest(c,(c.target.statuses??[]).filter(s=>!s.suppressed&&live(s)&&s.rule?.kind==='immune_source'&&s.rule.uses!==0&&matchesSource(meta,s.rule.filter,c.area)&&!contest(c,stateClaim(s),e.priority??0,'来源免疫')));
}
function executeChoice(e:EffectSpec,c:Context){
 if(e.op!=='choose')return;const pool=[...e.actions];
 for(let n=0;n<e.count&&pool.length;n++){
  if(c.event.commandId&&c.battle.commands[c.event.commandId]?.cancelled)break;
  let index:number;if(e.weights){const w=pool.map(x=>e.weights![e.actions.indexOf(x)]??1),total=w.reduce((n,v)=>n+v,0);let r=random(c.battle)*total;index=w.findIndex(v=>(r-=v)<0);if(index<0)index=w.length-1;}else index=Math.floor(random(c.battle)*pool.length);const id=pool[index]!;
  invoke(c,id);if(!e.replace)pool.splice(index,1);
 }
}
function executeLink(e:EffectSpec,c:Context){
 if(e.op!=='link')return;const b=c.battle;b.lifeLinks??=[];
 if(e.mode==='life'){
  const members=select(c,e.members!,[]).map(u=>u.id).sort();
  if(members.length<(e.minimumMembers??2)){log(b,'fizzle',c.caster.id,'生命链接成员不足');return;}
  const id=e.key+':'+members.join('|'),old=b.lifeLinks.find(x=>x.id===id);
  if(old){if(contest(c,{owner:old.owner},e.priority??0,'链接来源')){old.owner=issuer(c).owner;old.sourceRoot=c.sourceRoot??c.key;}return;}
  b.lifeLinks.push({id,key:e.key,owner:issuer(c).owner,sourceRoot:c.sourceRoot??c.key,members,...e.duration,remaining:e.duration.value,delayRounds:e.delayRounds!,recovery:e.recovery!,cleanse:!!e.cleanse,pending:{},failed:{}});
 }else if(e.mode==='sever'){
  b.lifeLinks=b.lifeLinks.filter(l=>!l.members.includes(c.target.id)||(e.key!=='*'&&l.key!==e.key)||!contest(c,{owner:l.owner},e.priority??0,'剪断生命链接'));
 }else{
  const old=c.target.owner;if(!old||!contest(c,{owner:old},e.priority??0,'解除召唤链接'))return;
  delete c.target.owner;
  // A detached construct is inert, not silently switched to the thief's faction.
  const d=simpleStatus('无主无命令',e.duration);d.control='stun';addStatus(c,c.key,d);
  for(const u of b.units)u.statuses=u.statuses?.filter(s=>!(s.source===c.target.id&&s.definition.reactions?.some(r=>r.kind==='substitute'||r.kind==='redirect')));
 }
 log(b,'link',c.target.id,e.mode+':'+e.key);
}
function restoreLink(b:Battle,link:LifeLink,target:Unit):boolean {
 const caster=unit(b,link.owner);if(!caster||!sourceEnabled(caster,link.sourceRoot))return false;
 const c:Context={battle:b,caster,target,key:link.id,sourceRoot:link.sourceRoot,event:event(b,caster.id,target.id)};
 if(reviveBlocked(c))return false;
 for(const s of target.statuses??[])if(s.rule?.kind==='sealed'&&!contest(c,stateClaim(s),0,'生命链接/封印'))return false;
 target.statuses=target.statuses?.filter(s=>s.rule?.kind!=='sealed'&&!(link.cleanse&&s.definition.polarity==='negative'));
 for(const r of RES)target.current[r]=target.max[r]*link.recovery[r];
 delete target.deathSeal;delete target.deathEvent;delete target.noRevivePriority;target.deadHandled=false;target.defeated=false;target.zeroHpProtected=false;
 const cu=clockUnit(b,target.id);cu.active=true;cu.stopped=false;cu.atb=0;cu.cast=null;
 log(b,'linked_return',target.id,link.key,target.current.hp);return true;
}
function executeReplay(e:EffectSpec,c:Context){
 if(e.op!=='replay')return;const trace=c.event.trace;
 if(!trace||!['action_resolved','damage_received','hit','blocked','reaction'].includes(c.event.point)){log(c.battle,'fizzle',c.caster.id,'没有可回放的实际动作');return;}
 if((c.event.replayDepth??0)>=1){log(c.battle,'replay_guard',c.caster.id,'整动作反射最多一层');return;}
 if(!trace.action.effects.some(x=>x.op==='damage'||x.op==='sequence'||x.op==='repeat'||x.op==='choose'||x.op==='branch'))return;
 mergeLibrary(c.caster.library!,unit(c.battle,trace.libraryOwner)?.library);
 const ev:EventContext={...c.event,responseOwner:undefined,point:'effect',commandId:undefined,replayDepth:1,control:undefined,frame:freshFrame({beats:0,steps:0,root:frame(c).budget.root??frame(c).budget})};
 runEffects({...c,powerCaster:e.originalStats?trace.power:undefined,key:c.key+':replay',sourceRoot:c.sourceRoot,libraryOwner:c.caster.id,action:trace.action,event:ev},trace.action.effects,[c.target.id]);
 emit(c.battle,'action_resolved',{...ev,source:c.caster.id,target:c.target.id});
 log(c.battle,'replay',c.caster.id,'完整动作；不重复扣原费用');
}
/** 冻结计时：单位被带 freeze_clocks 标签的隔离包裹时，除该隔离本身外的计时项都不走。 */
function clockFrozen(u:Unit,item:{definition?:StatusSpec}):boolean{if(item.definition?.control==='isolate')return false;return (u.statuses??[]).some(s=>!s.suppressed&&s.definition.control==='isolate'&&s.definition.tags.includes('freeze_clocks'));}
function expireStatuses(b:Battle,u:Unit){
 const expiring=(u.statuses??[]).filter(s=>!live(s));
 for(const s of expiring)if(!s.suppressed&&actionBan(s)&&hostileSource(b,u,s)&&u.level>=(s.sourceLevel??unit(b,s.source)?.level??0)){u.banGrace??={};u.banGrace[s.source]=(b.round??0)+1;}
 u.statuses=u.statuses?.filter(live);
 for(const s of expiring)if(s.definition.onExpire&&!s.suppressed&&sourceEnabled(unit(b,s.source),s.sourceRoot)){
  const caster=unit(b,s.source)??u;
  const ctx:Context={battle:b,caster,target:u,key:s.sourceKey,sourceRoot:s.sourceRoot,libraryOwner:s.libraryOwner,event:event(b,caster.id,u.id,'expire')};const a=actionById(ctx,s.definition.onExpire);runEffects({...ctx,action:{...a,targeting:{side:'any',selection:'manual',life:'any'}}},a.effects,[u.id]);
 }
}
function removePackage(b:Battle,u:Unit,id:string){
 for(const recipient of b.units){recipient.statuses=recipient.statuses?.filter(s=>!(s.source===u.id&&s.sourceRoot===id));recipient.shields=recipient.shields.filter(s=>!(s.source===u.id&&s.origin===id));recipient.speeds=recipient.speeds.filter(s=>!(s.source===u.id&&s.origin===id));}
 u.modifiers=u.modifiers?.filter(m=>m.origin!==id);
 for(const [key,a] of Object.entries(u.actions))if(a.source?.id===id){delete u.actions[key];delete u.charges?.[key];delete u.used[key];}
 b.fields=b.fields?.filter(f=>!(f.owner===u.id&&f.sourceRoot===id));b.scheduled=b.scheduled?.filter(s=>!((s.caster??s.owner)===u.id&&s.sourceRoot===id));for(const cmd of Object.values(b.commands))if(cmd.caster===u.id&&cmd.action.source?.id===id)cmd.cancelled=true;
 b.lifeLinks=b.lifeLinks?.filter(l=>!(l.owner===u.id&&l.sourceRoot===id));
 delete u.passives?.[id];delete u.sources?.[id];
}
function expirePassives(b:Battle){
 for(const u of b.units)for(const [id,copy] of Object.entries(u.passiveCopies??{}))if(!live(copy)){
  removePackage(b,u,id);delete u.passiveCopies![id];log(b,'passive_return',u.id,id);
 }
}
function installPassivePackage(b:Battle,u:Unit,id:string,a:ActionSpec,entryEffects=true){
 u.library??=EMPTY_LIBRARY();u.passives??={};u.sources??={};u.statuses??=[];u.modifiers??=[];
 const bound=clone(a);u.passives[id]=bound;u.sources[id]={kind:a.source?.kind??'skill',...(a.source?.quality?{quality:a.source.quality}:{}),tags:a.source?.tags??[]};mergeLibrary(u.library,a.library);
 const c:Context={battle:b,caster:u,target:u,key:'passive:'+id,sourceRoot:id,event:event(b,u.id,u.id),action:bound};
 if(entryEffects)runEffects(c,bound.effects,[u.id]);
 if(bound.triggers?.length){const d=simpleStatus(a.name??id,{clock:'permanent',value:0});d.triggers=bound.triggers;addStatus(c,'passive:'+id,d);}
 for(const ref of bound.grantedActions??[]){const key=id+'::grant::'+ref,action=u.library.actions[ref]!;u.actions[key]={...clone(action),source:{...a.source,id,kind:a.source?.kind??'skill'}};if(action.charges!==undefined){u.charges??={};u.charges[key]=action.charges;}}
 recompute(u,b);
}
function copyPassive(e:Extract<EffectSpec,{op:'copy'}>,c:Context){
 const donor=c.target,b=c.battle;let entries=Object.entries(donor.passives??{}).filter(([id,a])=>a.copyable!==false&&sourceEnabled(donor,id)&&(!e.category||a.category===e.category));
 if(!e.selection||e.selection==='named')entries=entries.filter(([id,a])=>id===e.id||a.name===e.id);
 if(e.selection==='used_latest'||e.selection==='used_random'){log(b,'fizzle',c.caster.id,'被动不是已使用的主动动作');return;}
 const choice=entries[e.selection==='random'?Math.floor(random(b)*entries.length):0];if(!choice)return;
 const [source,a]=choice,id='passive-copy:'+donor.id+':'+source;
 c.caster.passiveCopies??={};if(c.caster.passiveCopies[id]){log(b,'fizzle',c.caster.id,'同一被动租约不刷新次数或时限');return;}
 if(e.steal&&!contest(c,{owner:donor.id,priority:donor.sources?.[source]?.priority},e.priority??0,'窃取被动'))return;
 installPassivePackage(b,c.caster,id,a,!a.activation||a.activation==='always');
 // Preserve spent reaction/trigger charges; stealing is not a free reset.
 for(const s of c.caster.statuses??[])if(s.sourceRoot===id){const old=donor.statuses?.find(x=>x.sourceRoot===source&&x.definition.name===s.definition.name);if(old){s.used=clone(old.used);s.last=clone(old.last);if(s.rule&&old.rule)s.rule.uses=old.rule.uses;}}
 c.caster.passiveCopies[id]={...e.duration,remaining:e.duration.value,donor:donor.id,sourceId:source};
 if(e.steal){donor.sourceLocks??={};const lockId='lease:'+c.caster.id+':'+id;donor.sourceLocks[lockId]={...timed(lockId,e.duration),sourceId:source,owner:c.caster.id,...(e.priority===undefined?{}:{priority:e.priority}),removed:false};}
 refreshSourceLocks(b);for(const u of b.units)recompute(u,b);log(b,'passive_copy',c.caster.id,(e.steal?'steal:':'copy:')+source);
}
function orderReady(b:Battle,root:number){
 const ready=b.clock.pending.filter(e=>e.kind==='ready');if(ready.length<2)return;
 const absolute=ready.filter(e=>{const u=unit(b,e.unitId);return !!activeRule(u,'first_strike')||!!u.openingActions?.length;});if(!absolute.length)return;
 const ordered=orderClaims(b,'initiative:'+root,absolute.map(e=>({owner:e.unitId,event:e})));
 b.clock.pending=[...b.clock.pending.filter(e=>e.kind==='resolve'),...ordered.map(x=>x.event),...ready.filter(e=>!absolute.includes(e))];
}
function openingInitiative(b:Battle){
 for(const u of b.units){if(!isAlive(u)||clockUnit(b,u.id).stopped)continue;
  const passive=activeRule(u,'first_strike'),ids=Object.entries(u.actions).filter(([id,a])=>a.initiative==='absolute'&&!actionUnavailable(b,u,id)&&legalTargets(b,u,a).length).map(([id])=>id);
  if(!passive&&!ids.length)continue;
  if(!passive)u.openingActions=ids;
  const cu=clockUnit(b,u.id);cu.atb=100;cu.recoveryMs=0;
  if(!b.clock.pending.some(e=>e.unitId===u.id))b.clock.pending.push({kind:'ready',unitId:u.id});
 }
 const ev=event(b,b.units[0]!.id,b.units[0]!.id,'opening');orderReady(b,ev.root);
 for(const pending of [...b.clock.pending])if(pending.kind==='ready')announceReady(b,pending.unitId);
}

const handlers:Record<EffectSpec['op'],(effect:EffectSpec,context:Context)=>void>={
 choose:executeChoice,link:executeLink,replay:executeReplay,
 variable(e,c){if(e.op!=='variable')return;const f=frame(c),v=readFormula(e.value,c.caster,c.target,c.event,c.battle);if(e.mode==='random_int'){const max=readFormula(e.maximum!,c.caster,c.target,c.event,c.battle),min=Math.ceil(v),top=Math.floor(max);if(min>top)throw Error('随机区间上下界非法');f.variables[e.key]=min+Math.floor(random(c.battle)*(top-min+1));}else f.variables[e.key]=e.mode==='add'?(f.variables[e.key]??0)+v:v;},
 counter(e,c){if(e.op!=='counter')return;const owner=e.perTarget?c.caster:c.target,key=e.key+(e.perTarget?'@'+c.target.id:'');owner.counters??={};const old=owner.counters[key]?.value??0,v=readFormula(e.value,c.caster,c.target,c.event,c.battle);owner.counters[key]={value:Math.max(e.minimum??-Number.MAX_VALUE,Math.min(e.maximum??Number.MAX_VALUE,e.mode==='clear'?0:e.mode==='add'?old+v:v)),reset:e.reset};},
 branch(e,c){if(e.op==='branch'){const id=passes(e.when,c)?e.then:e.otherwise;if(id)invoke(c,id);}},
 repeat(e,c){if(e.op==='repeat'){const n=Math.max(0,Math.min(e.limit,Math.floor(readFormula(e.count,c.caster,c.target,c.event,c.battle))));for(let i=0;i<n;i++)invoke(c,e.action);}},
 check(e,c){if(e.op!=='check')return;const chance=Math.max(e.minimumChance??.05,Math.min(e.maximumChance??.95,e.baseChance+(readFormula(e.attacker,c.caster,c.target,c.event,c.battle)-readFormula(e.defender,c.caster,c.target,c.event,c.battle))/e.scale)),success=checkRoll(c,chance,e.advantage);if(e.result)frame(c).variables[e.result]=Number(success);log(c.battle,'check',c.caster.id,success?'检定成功':'检定失败',chance);const id=success?e.success:e.failure;if(id)invoke(c,id);},
 alter_event(e,c){if(e.op!=='alter_event')return;const ev=c.event;if(!ev.control&&e.mode==='cancel_action'&&ev.commandId)ev.control={cancelled:false,scale:1};if(!ev.control)throw Error('当前事件不可改写: '+ev.point);const p=e.priority??ev.responsePriority??0;if(ev.control.authority&&!contest(c,ev.control.authority,p,'事件改写')){log(c.battle,'rewrite_ignored',c.caster.id,'较低仲裁权改写');return;}ev.control.authority=issuer(c,p);const v=e.value?readFormula(e.value,c.caster,c.target,ev,c.battle):1;
  if(e.mode==='cancel_action'){if(!ev.commandId)throw Error('取消行动需要真实命令上下文');const actor=unit(c.battle,c.battle.commands[ev.commandId]?.caster??ev.source);if(actor&&opposingRule(c,actor,'uninterruptible','*',p))return;
   // 无次数/冷却/概率限制、必定生效的常驻“使行动无效”（=无效对方一切技能）是决定性效果：只对等级低于自己的行动者生效；
   // 有次数、冷却、概率或支付代价的无效化照常。
   if(actor&&c.event.responseUnlimited&&actor.side!==effectiveSource(c).side&&(e.probability===undefined||e.probability>=1)&&!decisiveAllowed(effectiveSource(c),actor)){log(c.battle,'decisive_blocked',actor.id,'必定无效只对低等级行动者生效');return;}
    // 0.21 L16：有次数/概率的“使行动无效”同样是强控：可抵抗，同一来源不能连续无效同一行动者。
    if(actor&&!controlAllowed(c,actor,'行动无效',true))return;ev.control.cancelled=true;if(ev.commandId&&c.battle.commands[ev.commandId])c.battle.commands[ev.commandId]!.cancelled=true;}
  if(e.mode==='cancel_effect')ev.control.cancelled=true;
  if(e.mode==='scale'||e.mode==='set'){if(!['before_damage','before_heal'].includes(ev.point))throw Error('数值替换只用于伤害或治疗前事件');if(e.mode==='scale')ev.control.scale*=Math.max(0,v);else ev.control.amount=Math.max(0,v);}
  if(e.mode==='damage_to_heal'){if(ev.point!=='before_damage')throw Error('伤转疗只能作用于伤害前事件');ev.control.replacement='heal';}
  if(e.mode==='heal_to_damage'){if(ev.point!=='before_heal')throw Error('疗转伤只能作用于治疗前事件');ev.control.replacement='damage';}
  if(e.mode==='redirect')ev.control.recipient=e.recipient==='random_any'?(()=>{const pool=c.battle.units.filter(isAlive);return pool[Math.floor(random(c.battle)*pool.length)]!.id;})():subject(c,e.recipient??'caster').id;
 },
 source(e,c){if(e.op!=='source')return;const t=c.target;t.sourceLocks??={};let entries=Object.entries(t.sources??{}).filter(([id,s])=>(!e.id||id===e.id)&&(!e.kinds||e.kinds.includes(s.kind))&&(!e.tag||s.tags?.includes(e.tag))&&matchesSource(s,e.filter)&&(!e.passiveOnly||!!t.passives?.[id]));
  if(e.selection==='random'){const chosen:typeof entries=[];while(entries.length&&chosen.length<(e.count??1)){const i=Math.floor(random(c.battle)*entries.length);chosen.push(entries.splice(i,1)[0]!);}entries=chosen;}else if(e.selection==='first')entries=entries.slice(0,e.count??1);else if(e.count)entries=entries.slice(0,e.count);
  // 0.21 L17/R-1：系统指令（待机/防御等）永远不会被封锁；封完后对方已没有任何可用能力（=让对方动不了）才算强控：
   // 对等级不低于自己的敌对目标可抵抗、不可连续，永久移除降级为2回合封锁。只封一部分能力（如装备、被动）照旧。
   if(e.mode!=='restore')entries=entries.filter(([,s])=>s.kind!=='system');let mode=e.mode,duration=e.duration;
   if(mode!=='restore'&&entries.length){const src=effectiveSource(c),locked=new Set(entries.map(([id])=>id)),left=Object.entries(t.actions).some(([id,a])=>!id.startsWith('booksea:')&&a.category!=='command'&&a.category!=='item'&&!locked.has(a.source?.id??id)&&sourceEnabled(t,a.source?.id??id));if(!left&&src.id!==t.id&&src.side!==t.side&&!decisiveAllowed(src,t)){if(!controlAllowed(c,t,'封锁能力',true))return;if(mode==='remove'){mode='suppress';duration={clock:'round',value:2};log(c.battle,'decisive_blocked',t.id,'永久移除能力只对低等级目标生效，改为封锁2回合');}}}
   for(const [id] of entries){if(mode==='restore'){for(const [lockId,lock] of Object.entries(t.sourceLocks))if((lock.sourceId??lockId)===id&&!lock.removed&&contest(c,{owner:lock.owner??t.id,priority:lock.priority},e.priority??0,'解封'))delete t.sourceLocks[lockId];}else if(contest(c,{owner:t.id,priority:t.sources?.[id]?.priority},e.priority??0,'来源封锁')){const lockId=id+'@'+c.caster.id+':'+(c.sourceRoot??c.key);t.sourceLocks[lockId]={...timed(lockId,mode==='remove'?{clock:'permanent',value:0}:duration),sourceId:id,owner:c.caster.id,...(e.priority===undefined?{}:{priority:e.priority}),removed:mode==='remove'};}log(c.battle,'source',t.id,mode+':'+id);}refreshSourceLocks(c.battle);for(const u of c.battle.units)recompute(u,c.battle);
 },
 status_transform(e,c){if(e.op!=='status_transform')return;const pick=(u:Unit)=>(u.statuses??[]).filter(s=>!s.suppressed&&(e.polarity==='any'||s.definition.polarity===e.polarity)&&(s.definition.dispellable||e.includeUndispellable)&&matchesSource(unit(c.battle,s.source)?.sources?.[s.sourceRoot??s.sourceKey],e.filter)&&(e.mode==='invert_numeric'||contest(c,stateClaim(s),e.priority??0,'状态交换/反转')));
  const swapBetween=(x:Unit,y:Unit)=>{if(x.id===y.id)return;const a=pick(x),z=pick(y);x.statuses=x.statuses!.filter(s=>!a.includes(s));y.statuses=y.statuses!.filter(s=>!z.includes(s));for(const [recipient,states] of [[x,z],[y,a]] as const)for(const state of states){mergeLibrary(recipient.library!,unit(c.battle,state.libraryOwner).library);const moved=clone(state);moved.id+=':swap:'+c.battle.nextCommand++;moved.libraryOwner=recipient.id;recipient.statuses!.push(moved);}recompute(x,c.battle);recompute(y,c.battle);};
  if(e.mode==='swap_pair'){const f=frame(c) as unknown as {spair?:Record<string,string>};f.spair??={};const first=f.spair[c.key];if(!first||first===c.target.id){f.spair[c.key]=c.target.id;return;}swapBetween(unit(c.battle,first),c.target);delete f.spair[c.key];return;}
  if(e.mode==='swap'){if(c.caster.id===c.target.id)return;const a=pick(c.caster),z=pick(c.target);c.caster.statuses=c.caster.statuses!.filter(s=>!a.includes(s));c.target.statuses=c.target.statuses!.filter(s=>!z.includes(s));for(const [recipient,states] of [[c.caster,z],[c.target,a]] as const)for(const state of states){mergeLibrary(recipient.library!,unit(c.battle,state.libraryOwner).library);const moved=clone(state);moved.id+=':swap:'+c.battle.nextCommand++;moved.libraryOwner=recipient.id;recipient.statuses!.push(moved);}}
  else for(const s of pick(c.target)){const d=s.definition;if(d.inverse){if(!contest(c,stateClaim(s),e.priority??0,'具名反转'))continue;const inverse=unit(c.battle,s.libraryOwner)?.library?.statuses[d.inverse];if(!inverse)throw Error('具名逆状态缺失');s.definition=clone(inverse);s.definitionId=d.inverse;continue;}if(d.control||d.tick||d.triggers?.length||d.reactions?.length||!d.modifiers?.length||d.modifiers.some(m=>m.multiplier===0)){log(c.battle,'not_invertible',c.target.id,d.name);continue;}if(!contest(c,stateClaim(s),e.priority??0,'数值反转'))continue;d.modifiers=d.modifiers.map(m=>({...m,flat:-(m.flat??0),multiplier:m.multiplier===undefined?1:1/m.multiplier}));d.polarity=d.polarity==='negative'?'positive':'negative';d.name+='·数值反转';}
  recompute(c.caster,c.battle);recompute(c.target,c.battle);log(c.battle,'status_transform',c.target.id,e.mode);
 },

 damage(e,c){if(e.op==='damage')damage(e,c);},
 heal(e,c){if(e.op!=='heal')return;const r=e.adaptive?neediest(c.target):e.resource;performHeal(c,r,Math.max(0,value(r===e.resource?e.amount:swapResource(e.amount,e.resource,r),c)),e.priority??0,e.overflowShield);},
 shield(e,c){if(e.op!=='shield')return;if(hostileBlocked(c,c.target,e.priority??0))return;const t=c.target,n=Math.max(0,value(e.amount,c)),old=t.shields.find(s=>s.id===c.key);if(e.stack==='strongest'&&old&&old.amount>=n){old.remaining=e.duration.value;return;}if(e.stack!=='independent')t.shields=t.shields.filter(s=>s.id!==c.key);t.shields.push({...timed(e.stack==='independent'?c.key+':'+c.battle.nextCommand++:c.key,e.duration),amount:n,channels:[...e.channels],...(e.charges===undefined?{}:{charges:e.charges}),...(e.order===undefined?{}:{order:e.order}),...(e.ruleLevel===undefined?{}:{priority:e.ruleLevel}),source:c.caster.id,origin:c.sourceRoot??c.key});log(c.battle,'shield',t.id,c.key,n);emit(c.battle,'shield_gained',{...c.event,source:c.caster.id,target:t.id,actual:n,raw:n});},
 speed(e,c){if(e.op!=='speed'||random(c.battle)>=e.chance)return;if(hostileBlocked(c,c.target,e.priority??0))return;const t=c.target;if(e.stack==='strongest'&&t.speeds.some(s=>s.id===c.key&&s.multiplier>=e.multiplier))return;if(e.stack!=='independent')t.speeds=t.speeds.filter(s=>s.id!==c.key);t.speeds.push({...timed(c.key,e.duration),multiplier:e.multiplier,source:c.caster.id,origin:c.sourceRoot??c.key});recompute(t,c.battle);},
 armor(e,c){if(e.op==='armor'){c.target.modifiers!.push({origin:c.sourceRoot??c.key,stat:('armor_'+e.channel) as ModifierSpec['stat'],flat:value(e.amount,c)});recompute(c.target,c.battle);}},
 reduction(e,c){if(e.op==='reduction'){c.target.modifiers!.push({origin:c.sourceRoot??c.key,stat:('reduction_'+e.channel) as ModifierSpec['stat'],multiplier:1-e.fraction});recompute(c.target,c.battle);}},
 damage_bonus(e,c){if(e.op==='damage_bonus'){c.target.modifiers!.push({origin:c.sourceRoot??c.key,stat:('damage_'+e.channel) as ModifierSpec['stat'],flat:e.flat,multiplier:e.multiplier});recompute(c.target,c.battle);}},
 heal_bonus(e,c){if(e.op==='heal_bonus'){c.target.modifiers!.push({origin:c.sourceRoot??c.key,stat:'heal_power',multiplier:e.multiplier});recompute(c.target,c.battle);}},
 element_resist(e,c){if(e.op==='element_resist'){c.target.modifiers!.push({origin:c.sourceRoot??c.key,stat:'element',element:e.element,multiplier:e.multiplier});recompute(c.target,c.battle);}},
 resource(e,c){if(e.op!=='resource')return;const t=c.target,r=e.resource,n=Math.max(0,value(e.amount,c)),minimum=r==='hp'&&!e.lethal?Math.min(t.current.hp,1):0;
  if(r==='hp'&&!isAlive(t)&&['add','set','swap'].includes(e.mode)||e.mode==='exchange'&&e.other==='hp'&&!isAlive(t)||e.mode==='swap'&&e.other==='hp'&&!isAlive(c.caster))return;
  // 0.21 L18：与敌对目标交换/改写生命是决定性效果，只对等级低于来源的目标生效。
   if(r==='hp'&&(e.mode==='swap'||e.mode==='set'&&n<t.current.hp)&&t.id!==c.caster.id){const src=effectiveSource(c);if(src.side!==t.side&&!decisiveAllowed(src,t)){log(c.battle,'decisive_blocked',t.id,'交换/改写生命只对低等级目标生效');return;}}
   if(e.mode==='swap'){const other=e.other??r,old=c.caster.current[other];c.caster.current[other]=Math.max(other==='hp'&&!e.lethal?1:0,Math.min(c.caster.max[other],t.current[r]));t.current[r]=Math.max(minimum,Math.min(t.max[r],old));}
  if(e.mode==='add')t.current[r]=Math.min(t.max[r],t.current[r]+n);
  if(e.mode==='set')t.current[r]=Math.max(minimum,Math.min(t.max[r],n));
  if(['subtract','exchange','burn'].includes(e.mode)){const take=Math.min(Math.max(0,t.current[r]-minimum),n);t.current[r]-=take;if(e.mode==='exchange'){const other=e.other!;t.current[other]=Math.min(t.max[other],t.current[other]+take*(e.ratio??1));}if(e.mode==='burn')receive(c,{physical:0,energy:0,mental:0,true:take*(e.ratio??1)},'none',e.priority??0,e.lethal!==false);}
  log(c.battle,'resource',t.id,e.mode+':'+r,n);
 },
 modify(e,c){if(e.op==='modify'){const d=simpleStatus(e.name,e.duration);d.scope=e.scope??d.scope;d.modifiers=e.modifiers;addStatus(c,c.key,d);}},
 apply_status(e,c){if(e.op!=='apply_status')return;const d=library(c).statuses[e.status];if(!d)throw Error('状态引用不存在: '+e.status);const ev:EventContext={...c.event,source:c.caster.id,target:c.target.id,status:d,statusId:e.status,control:{cancelled:false,scale:1}};emit(c.battle,'before_status',ev);if(ev.control!.cancelled)return;if(ev.control!.recipient){const to=unit(c.battle,ev.control!.recipient)??c.target,by=ev.control!.authority?unit(c.battle,ev.control!.authority.owner):undefined;
   // 0.21：被对方反射/转移出去的状态算发起转移的一方施加的（强控照常可挣脱、不可连续、必定生效只对低等级）。
   if(to.id!==c.target.id&&by&&allegiance(c.battle,by)!==allegiance(c.battle,effectiveSource(c)))c={...c,caster:by,libraryOwner:c.libraryOwner??c.caster.id,event:{...c.event,responseOwner:by.id}};
   c={...c,target:to};}
  const immunity=opposingRule(c,c.target,'immune_status',e.status,e.priority??d.priority)??opposingRule(c,c.target,'immune_status',d.control&&effectiveSource(c).side!==c.target.side?'negative':d.polarity,e.priority??d.priority)??(d.control?opposingRule(c,c.target,'immune_status',d.control,e.priority??d.priority):undefined)??d.tags.map(tag=>opposingRule(c,c.target,'immune_concept',tag,e.priority??d.priority)).find(Boolean);if(immunity){consumeRule(immunity);const tax=activeRule(c.target,'control_tax');if(tax&&(d.control||d.polarity==='negative')&&c.caster.id!==c.target.id){const n=Math.round(c.target.current.hp*(Number(tax.rule!.key)||.1));c.target.current.hp=Math.max(1,c.target.current.hp-n);log(c.battle,'damage',c.target.id,'破戒',n);}return;}
   if(e.opposedAttribute&&e.opposedAttribute!=='none'){const key=({力量:'check_strength',敏捷:'check_agility',体质:'check_constitution',智力:'check_intelligence',精神:'check_spirit'} as const)[e.opposedAttribute];const chance=.5+(c.caster.attributes[e.opposedAttribute]+(c.caster.stats?.[key]??0)-c.target.attributes[e.opposedAttribute]-(c.target.stats?.[key]??0)-(e.opposedDifficulty??0))/100;if(random(c.battle)>=Math.max(.05,Math.min(.95,chance)))return;}
  if(d.control==='charm'){const rivals=controls(c.target,'charm');if(rivals.some(s=>!contest(c,stateClaim(s),e.priority??d.priority,'控制权')))return;c.target.statuses=c.target.statuses?.filter(s=>!rivals.includes(s));}
  addStatus(c,c.key+':'+e.status,d,e.stacks??1,e.duration).definitionId=e.status;emit(c.battle,'after_status',{...ev,target:c.target.id});
 },
 dispel(e,c){if(e.op!=='dispel')return;const list=(c.target.statuses??[]).filter(s=>(e.polarity==='any'||s.definition.polarity===e.polarity)&&(!e.status||s.definition.name===e.status||s.definitionId===e.status||s.id===e.status)&&(!e.source||s.source===e.source||s.sourceKey===e.source)&&(s.definition.dispellable||e.includeUndispellable)&&matchesSource(unit(c.battle,s.source)?.sources?.[s.sourceRoot??s.sourceKey],e.filter)&&contest(c,stateClaim(s),e.priority??0,'净化/不可驱散')).slice(0,e.count??Infinity);
  for(const s of list){const take=Math.min(s.stacks,e.stacks??s.stacks);s.stacks-=take;if(e.mode!=='remove'){const recipient=e.mode==='steal'||!e.recipient||e.recipient==='caster'?c.caster:e.recipient==='owner'?unit(c.battle,c.caster.owner??c.caster.id):e.recipient==='selected_other'?unit(c.battle,c.requested?.find(id=>id!==c.target.id)??c.caster.id):c.battle.units.filter(u=>u.side===c.caster.side&&isAlive(u)).sort((a,b)=>a.current.hp-b.current.hp)[0]!;const transferred=clone(s);transferred.stacks=take;transferred.id+=':transfer:'+c.battle.nextCommand++;mergeLibrary(recipient.library!,unit(c.battle,s.libraryOwner??s.source).library);transferred.libraryOwner=recipient.id;recipient.statuses!.push(transferred);}if(s.stacks===0)c.target.statuses=c.target.statuses!.filter(x=>x!==s);log(c.battle,'dispel',c.target.id,s.definition.name,take);}recompute(c.target,c.battle);recompute(c.caster,c.battle);
 },
 remove_shield(e,c){if(e.op!=='remove_shield')return;const remove=c.target.shields.filter(w=>(!e.channel||w.channels.includes(e.channel))&&contest(c,{owner:w.source??c.target.id,priority:w.priority},e.priority??0,'移除护盾')).slice(0,e.count??Infinity);c.target.shields=c.target.shields.filter(w=>!remove.includes(w));for(const w of remove)emit(c.battle,'shield_break',{...c.event,source:c.caster.id,target:c.target.id});},
 atb(e,c){if(e.op!=='atb')return;const u=clockUnit(c.battle,c.target.id);if(!u.active)return;
  if(e.mode==='end'){if(opposingRule(c,c.target,'uninterruptible','*',e.priority??0))return;if(!controlAllowed(c,c.target,'打断',true))return;for(const cmd of Object.values(c.battle.commands))if(cmd.caster===u.id)cmd.cancelled=true;u.cast=null;u.atb=0;u.recoveryMs=0;c.battle.clock.pending=c.battle.clock.pending.filter(p=>p.unitId!==u.id||p.kind==='resolve');return;}
  if(e.mode==='extra'){c.target.extraActions=(c.target.extraActions??0)+Math.max(1,e.value);return;}
  if(e.mode==='rotate'){const f=frame(c) as unknown as {rotated?:Record<string,boolean>};f.rotated??={};if(f.rotated[c.key])return;f.rotated[c.key]=true;const side=allegiance(c.battle,c.target),cus=c.battle.clock.units.filter(x=>x.active&&x.side===side&&!x.cast);if(cus.length<2)return;const vals=cus.map(x=>x.atb),shift=((Math.round(e.value)%cus.length)+cus.length)%cus.length;cus.forEach((x,i)=>{x.atb=vals[(i+cus.length-shift)%cus.length]!;if(x.atb<100)c.battle.clock.pending=c.battle.clock.pending.filter(p=>!(p.kind==='ready'&&p.unitId===x.id));if(x.atb>=100&&!c.battle.clock.pending.some(p=>p.unitId===x.id)){x.recoveryMs=0;c.battle.clock.pending.push({kind:'ready',unitId:x.id});announceReady(c.battle,x.id);}});return;}
  const atbScale=e.mode==='push'||e.mode==='retreat'?(c.target.stats?.atb_scale??1):1;
   // 0.21 L15：把敌对目标的行动条往回推（推后、拉低、归零）是强控：同一来源不能连续推同一目标；一次推回≥50%时可当场抵抗。
   // 附带的后摇（recoveryFactor）同样折算成行动条损失：等待的时间里本来能涨的行动条。
   // 对等级不低于来源的敌对目标，附带的后摇最多一整回合（等同把行动条推到0），没有挣脱机会的多回合等待不成立。
   const hostileWait=(()=>{const src=effectiveSource(c);return src.side!==c.target.side&&src.id!==c.target.id&&!decisiveAllowed(src,c.target);})(),recoveryFactor=e.recoveryFactor===undefined?undefined:hostileWait?Math.min(1,e.recoveryFactor):e.recoveryFactor;
   {const next=e.mode==='push'?u.atb+e.value*atbScale:e.mode==='retreat'?u.atb-e.value*atbScale:e.mode==='immediate'?100:e.value,wait=recoveryFactor!==undefined&&next<100?Math.max(0,recoveryFactor*4000-u.recoveryMs)*speedFactor(u)/40:0,loss=u.atb-Math.max(0,Math.min(100,next))+wait;if(loss>EPS&&!controlAllowed(c,c.target,'推条',loss>=50||next<=0))return;}
  u.atb=Math.max(0,Math.min(100,e.mode==='push'?u.atb+e.value*atbScale:e.mode==='retreat'?u.atb-e.value*atbScale:e.mode==='immediate'?100:e.value));
  if(recoveryFactor!==undefined)u.recoveryMs=recoveryFactor*4000;
  if(u.atb<100)c.battle.clock.pending=c.battle.clock.pending.filter(p=>!(p.kind==='ready'&&p.unitId===u.id));
  if(u.atb>=100&&!u.cast&&!c.battle.clock.pending.some(p=>p.unitId===u.id)){u.recoveryMs=0;c.battle.clock.pending.push({kind:'ready',unitId:u.id});announceReady(c.battle,u.id);}
 },
 cast(e,c){if(e.op!=='cast')return;const cu=clockUnit(c.battle,c.target.id);
  if(e.mode==='interrupt'&&cu.cast){if(opposingRule(c,c.target,'uninterruptible','*',e.priority??0))return;if(!controlAllowed(c,c.target,'打断',true))return;const cmd=c.battle.commands[cu.cast.commandId];if(cmd)refundCommand(c.battle,cmd);c.battle.clock=interruptCast(c.battle.clock,c.target.id);delete c.battle.commands[cu.cast.commandId];log(c.battle,'interrupted',c.target.id,'打断');}
  if(e.mode==='accelerate'&&cu.cast)cu.cast.remainingMs=Math.max(0,cu.cast.remainingMs-e.value);
  if(e.mode==='delay'&&cu.cast)cu.cast.remainingMs+=e.value;
  if(e.mode==='seal'){if(opposingRule(c,c.target,'immune_status','silence',e.priority??0))return;if((e.category??'*')==='*'&&banBlocked(c,c.target))return;if((e.category??'*')==='*')markControl(c,c.target);const d=simpleStatus('施法封锁',e.duration!);const st=addStatus(c,c.key,d);st.rule={kind:'seal_category',key:e.category??'*',uses:-1,amount:0};}
 },
 uses(e,c){if(e.op!=='uses')return;const t=c.target;let keys=(e.skill==='*'?Object.keys(t.actions):[e.skill]).filter(k=>e.mode!=='seal'||!k.startsWith('booksea:'));if(e.mode==='seal'&&e.skill==='*'&&!e.selection&&!controlAllowed(c,t,'封印全部技能',true))return;if(e.selection){const pool=keys.filter(k=>t.actions[k]&&t.actions[k]!.category!=='command');if(e.selection==='most_used'){const top=[...pool].sort((a,b)=>(t.used[b]??0)-(t.used[a]??0))[0];keys=top&&(t.used[top]??0)>0?[top]:[];}else{const used=(t.history??[]).filter(k=>pool.includes(k));keys=e.selection==='used_latest'?used.slice(-1):used.length?[used[Math.floor(random(c.battle)*used.length)]!]:[];}if(!keys.length){log(c.battle,'fizzle',c.caster.id,'目标没有可选的已用技能');return;}}t.sealed??={};t.sealClocks??={};t.charges??={};for(const k of keys){if(e.mode==='restore')t.used[k]=Math.max(0,(t.used[k]??0)-e.value);if(e.mode==='spend')t.used[k]=(t.used[k]??0)+e.value;if(e.mode==='reset')t.used[k]=0;if(e.mode==='charge')t.charges[k]=(t.charges[k]??0)+e.value;if(e.mode==='seal'){t.sealed[k]=e.duration?.clock==='permanent'?-1:e.duration?.value??-1;t.sealClocks[k]=e.duration?.clock??'permanent';}if(e.mode==='unseal'){delete t.sealed[k];delete t.sealClocks[k];}}},
 revive(e,c){if(e.op!=='revive'||isAlive(c.target)||activeRule(c.target,'sealed'))return;if(reviveBlocked(c,e.priority??0)){log(c.battle,'revive_blocked',c.target.id,'复活封锁：等级/速度/随机仲裁');return;}
  // 自动复活（被动触发/延时复活）计入保命上限；主动施放的复活术不计。
  if((c.event.responseOwner||c.event.automatic)&&!c.event.lastStandCounted&&!lastStand(c.battle,c.target,'revive:'+(c.sourceRoot??c.key)))return;const t=c.target;t.current.hp=Math.min(t.max.hp,Math.max(1,value(e.amount,c)));t.deadHandled=false;t.defeated=false;delete t.noRevivePriority;delete t.deathSeal;delete t.deathEvent;t.zeroHpProtected=false;const cu=clockUnit(c.battle,t.id);cu.active=true;cu.atb=e.atb??0;cu.cast=null;log(c.battle,'revive',t.id,'复苏',t.current.hp);},
 summon(e,c){if(e.op!=='summon')return;const tpl=library(c).summons[e.template];if(!tpl)throw Error('缺少召唤模板: '+e.template);const existing=c.battle.units.filter(u=>u.owner===c.caster.id&&isAlive(u)),same=existing.filter(u=>u.summon?.template===e.template).length;
  for(let n=0;n<Math.min(e.count,tpl.limit-same,8-existing.length);n++){
   const id='summon-'+c.battle.nextCommand++,a=c.caster,level=tpl.level==='caster'?a.level:tpl.fixedLevel!;
   // 普通怪物模板：“与自身同级”只代表等级相同，属性/资源取该等级普通怪物面板，不复制召唤者数值。
   const panel=tpl.panel?monsterNumbers({build:tpl.panel.build,role:'普通'} as MonsterDesign,Math.max(1,Math.round(level))):undefined;
   const attributes=Object.fromEntries(ATTR.map(k=>[k,tpl.attributes[k]+(panel?panel.attributes[k]:a.attributes[k]*tpl.inheritance)])) as Unit['attributes'];
   const max=Object.fromEntries(RES.map(k=>[k,tpl.resources[k]+(panel?panel.max[k]:a.max[k]*tpl.inheritance)])) as Resources;
   const actions=Object.fromEntries(tpl.actions.map(id=>[id,{...actionById(c,id)}]));
   const u:Unit={id,name:tpl.name,side:a.side,level,attributes,max,current:{...max},actions,used:{},mitigation:emptyMitigation(),shields:[],speeds:[],statuses:[],modifiers:[],exploration:[],library:clone(library(c)),tags:['summon',...(tpl.tags??[])],owner:a.id,summon:{template:e.template,...tpl.duration,remaining:tpl.duration.value,ownerDeath:tpl.ownerDeath,rewardEligible:tpl.rewardEligible},position:a.position};
   if(e.mode==='clone'){u.attributes=clone(a.base?.attributes??a.attributes);u.max=clone(a.base?.max??a.max);u.current=clone(a.current);u.tags=['summon',...new Set([...(a.tags??[]),...(tpl.tags??[])])];u.actions=clone(a.actions);u.library=clone(a.library);u.sources=clone(a.sources??{});u.used=clone(a.used);u.charges=clone(a.charges??{});}
   installCommands(u);auditInvulnerability(u);c.battle.units.push(u);c.battle.clock.units.push({id,side:u.side,agility:u.attributes.敏捷,speedBonus:0,haste:1,active:true,atb:0,recoveryMs:0,cast:null,actionsCompleted:0});recompute(u,c.battle);if(e.mode==='clone'&&tpl.inheritPassives){for(const [id,passive] of Object.entries(a.passives??{}))installPassivePackage(c.battle,u,id,passive,!passive.activation||passive.activation==='always');}if(e.mode==='clone'&&tpl.cloneResources)for(const r of RES)u.current[r]=u.max[r]*tpl.cloneResources[r];
   if(e.mode==='substitute'){const d=simpleStatus('替身守护',tpl.duration);d.reactions=[{kind:'substitute',fraction:1,target:'source'}];addStatus({...c,caster:u,target:a},id+':substitute',d);}
   log(c.battle,'summon',id,tpl.name);
  }
 },
 retreat(e,c){if(e.op!=='retreat'||!isAlive(c.target))return;retreatUnit(c.battle,c.target,'原能力传送/成功脱离本趟');},
 recall(e,c){if(e.op!=='recall')return;for(const u of c.battle.units.filter(u=>u.summon&&(!e.ownerOnly||u.owner===c.caster.id)&&(!e.template||u.summon!.template===e.template))){u.current.hp=0;u.zeroHpProtected=false;u.escaped=true;u.deadHandled=true;c.battle.clock=deactivateUnit(c.battle.clock,u.id);log(c.battle,'recall',u.id,'召回');}},
 field(e,c){if(e.op!=='field')return;const b=c.battle;b.fields??=[];if(e.remove){for(const f of b.fields.filter(f=>f.definition===e.field)){f.clock='battle_time';f.remaining=0;}refreshFields(b);return;}
  const d=library(c).fields[e.field];if(!d)throw Error('场域引用不存在: '+e.field);const old=b.fields.filter(f=>f.group===d.group);if(d.stack!=='independent'&&old.some(f=>!contest(c,{owner:f.owner,priority:f.priority},d.priority,'场域互斥')))return;
  if(d.stack!=='independent')for(const f of old){f.remaining=0;f.clock='battle_time';}refreshFields(b);
  b.fields.push({...timed(c.key+':'+b.nextCommand++,d.duration),definition:e.field,sourceRoot:c.sourceRoot??c.key,owner:c.libraryOwner??c.caster.id,group:d.group,priority:d.priority,status:d.status,targeting:d.targeting,members:[]});refreshFields(b);log(b,'field',c.target.id,d.name);
 },
 time(e,c){if(e.op!=='time')return;const b=c.battle,t=c.target,k=c.caster.id+':'+e.key+':'+t.id;b.snapshots??={};b.scheduled??=[];
  if(e.mode==='snapshot')b.snapshots[k]={current:clone(t.current),statuses:clone(t.statuses??[]),atb:clockUnit(b,t.id).atb,position:t.position??0};
  if(e.mode==='rewind'){const saved=b.snapshots[k];if(!saved){log(b,'fizzle',t.id,'未建立回溯快照');return;}
   // 0.21：对敌对目标回溯——把行动条/状态退回过去是强控（可挣脱、同一来源不能连续）；把生命退回更低是决定性效果，只对低等级有效。
   {const src=effectiveSource(c);if(src.side!==t.side&&src.id!==t.id){if(e.restore.includes('resources')&&saved.current.hp<t.current.hp&&!decisiveAllowed(src,t)){log(b,'decisive_blocked',t.id,'回溯降低生命只对低等级有效');return;}if((e.restore.includes('atb')||e.restore.includes('statuses'))&&!controlAllowed(c,t,'时间回溯',true))return;}}
   if(e.restore.includes('resources')){const restoringLife=!isAlive(t)&&saved.current.hp>0;if(restoringLife&&reviveBlocked(c,e.priority??0)){log(b,'revive_blocked',t.id,'回溯不能绕过绝杀');return;}if(restoringLife&&(c.event.responseOwner||c.event.automatic)&&!c.event.lastStandCounted&&!lastStand(b,t,'rewind:'+(c.sourceRoot??c.key)))return;t.current=clone(saved.current);if(restoringLife){delete t.deathSeal;delete t.deathEvent;delete t.noRevivePriority;}}if(e.restore.includes('statuses'))t.statuses=clone(saved.statuses);if(e.restore.includes('position'))t.position=saved.position;if(e.restore.includes('atb')){const cu=clockUnit(b,t.id);cu.atb=saved.atb;cu.cast=null;b.clock.pending=b.clock.pending.filter(e=>e.unitId!==t.id);for(const [id,cmd] of Object.entries(b.commands))if(cmd.caster===t.id)delete b.commands[id];}if(t.current.hp>0){t.deadHandled=false;clockUnit(b,t.id).active=true;}log(b,'rewind',t.id,e.key);}
  if(e.mode==='delay')b.scheduled.push({id:k+':'+b.nextCommand++,clock:e.duration!.clock,remaining:e.duration!.value,owner:c.libraryOwner??c.caster.id,target:t.id,action:e.action!,key:c.key,caster:c.caster.id,sourceRoot:c.sourceRoot??c.key,variables:clone(frame(c).variables)});
  if(e.mode==='stop'){if(opposingRule(c,t,'immune_status','time_stop',e.priority??0))return;const d=simpleStatus('时间停止',e.duration!);d.control='time_stop';d.priority=e.priority??0;addStatus(c,c.key,d);}
 },
 space(e,c){if(e.op!=='space')return;if(e.mode==='move')c.target.position=(c.target.position??0)+e.value;if(e.mode==='swap'){const n=c.target.position;c.target.position=c.caster.position;c.caster.position=n;}if(e.mode==='isolate'){if(opposingRule(c,c.target,'immune_status','isolate',e.priority??0))return;const d=simpleStatus('空间隔离',e.duration!);d.control='isolate';if(e.freeze)d.tags=['freeze_clocks'];const st=addStatus(c,c.key,d);if(!st.suppressed)chargeProtection(c.battle,c.target);}
   if(e.mode==='release'){const before=c.target.statuses?.length??0;c.target.statuses=c.target.statuses?.filter(s=>!(s.definition.control==='isolate'&&s.source===c.caster.id));if((c.target.statuses?.length??0)!==before){recompute(c.target,c.battle);log(c.battle,'status',c.target.id,'空间隔离·解除',0);}}
   if(e.mode==='swap_pair'){const f=frame(c) as unknown as {pair?:Record<string,string>};f.pair??={};const first=f.pair[c.key];if(!first||first===c.target.id){f.pair[c.key]=c.target.id;return;}const other=unit(c.battle,first);const n=c.target.position;c.target.position=other.position;other.position=n;delete f.pair[c.key];}},
 copy(e,c){if(e.op!=='copy')return;if(e.mode==='passive'){copyPassive(e,c);return;}if(e.mode==='skill'){let entries=Object.entries(c.target.actions).filter(([id,a])=>a.copyable!==false&&sourceEnabled(c.target,a.source?.id)&&(!e.category||a.category===e.category));if(e.selection==='used_latest'||e.selection==='used_random'){entries=(c.target.history??[]).map(id=>entries.find(x=>x[0]===id)).filter((x):x is [string,ActionSpec]=>!!x);if(e.selection==='used_latest')entries=entries.slice(-1);}else if(!e.selection||e.selection==='named')entries=entries.filter(([id,a])=>id===e.id||a.name===e.id);const entry=entries[(e.selection==='random'||e.selection==='used_random')?Math.floor(random(c.battle)*entries.length):0],a=entry?.[1];if(!a||a.copyable===false){log(c.battle,'fizzle',c.caster.id,'该技能不许可复制');return;}if(e.activate){if((c.event.replayDepth??0)>=1){log(c.battle,'replay_guard',c.caster.id,'动态借用不可递归');return;}mergeLibrary(c.caster.library!,a.library??c.target.library);const borrowed=clone(a);runEffects({...c,powerCaster:e.originalStats?clone(c.target):undefined,key:c.key+':borrow',action:borrowed,libraryOwner:c.caster.id,event:{...c.event,replayDepth:1}},borrowed.effects,[c.target.id]);log(c.battle,'borrowed_action',c.caster.id,entry![0]);return;}const id='copy:'+c.target.id+':'+(!e.selection||e.selection==='named'?e.id:entry![0]);c.caster.actions[id]=clone(a);c.caster.actions[id]!.source={...a.source,id,kind:a.source?.kind??'skill'};c.caster.sources??={};c.caster.sources[id]={kind:a.source?.kind??'skill'};if(a.charges!==undefined){c.caster.charges??={};c.caster.charges[id]=a.charges;}mergeLibrary(c.caster.library!,a.library??c.target.library);c.caster.copied??={};c.caster.copied[id]={...e.duration,remaining:e.duration.value};}else{const s=c.target.statuses?.find(s=>s.definition.name===e.id||s.id===e.id);if(s&&s.definition.dispellable&&contest(c,stateClaim(s),e.priority??0,'状态窃取')){c.target.statuses=c.target.statuses!.filter(x=>x!==s);const transferred=clone(s);transferred.id+=':stolen';mergeLibrary(c.caster.library!,unit(c.battle,s.libraryOwner??s.source).library);transferred.libraryOwner=c.caster.id;c.caster.statuses!.push(transferred);}}},
 rule(e,c){if(e.op!=='rule')return;const banRule=e.rule==='sealed'&&isAlive(c.target)||e.rule==='seal_category'&&e.key==='*';if(banRule&&banBlocked(c,c.target))return;if(banRule)markControl(c,c.target);let key=e.key;if(e.selection){const picked=pickBySelection(c,c.target,e.selection);if(!picked){log(c.battle,'fizzle',c.caster.id,'目标没有可选的已用技能');return;}key=e.key==='*'?picked:picked+'|'+e.key;}const d=simpleStatus(e.rule+':'+key,e.duration);d.scope=e.scope??d.scope;d.priority=e.priority??0;d.dispellable=false;d.tags=[key,'rule',...(e.absolute?['absolute']:[])];if(e.breakAfterDamage)d.breakAfterDamage=e.breakAfterDamage;const st=addStatus(c,c.key,d);st.rule={kind:e.rule==='causality'?e.key:e.rule==='substitute'?'death_guard':e.rule,key:e.rule==='causality'?'*':e.rule==='immune_element'?elementKey(e.key):key,uses:e.uses&&e.uses>0?e.uses:-1,...(e.uses&&e.uses>0?{declared:e.uses}:{}),amount:e.amount?value(e.amount,c):1,...(e.filter?{filter:e.filter}:{}),...(e.onTrigger?{onTrigger:e.onTrigger}:{})};if((e.rule==='untargetable'||e.rule==='sealed')&&!st.suppressed)chargeProtection(c.battle,c.target);},
 explore(e,c){if(e.op!=='explore')return;c.target.exploration??=[];c.target.exploration.push({kind:e.kind,value:e.value,clock:e.duration.clock,remaining:e.duration.value});},
 sequence(e,c){if(e.op==='sequence')for(let i=0;i<e.repeat;i++)invoke(c,e.action);},
};
export const EXECUTORS = Object.fromEntries(Object.entries(handlers).map(([op,fn])=>[op,(e:EffectSpec,c:Omit<Context,'event'>&{event?:EventContext})=>fn(e,{...c,event:c.event??event(c.battle,c.caster.id,c.target.id)})])) as Record<EffectSpec['op'],(e:EffectSpec,c:Omit<Context,'event'>&{event?:EventContext})=>void>;

function runEffects(c:Context,effects:EffectSpec[],requested:string[]){
 const f=frame(c);
 for(let i=0;i<effects.length;i++){
  if(!sourceEnabled(c.caster,c.sourceRoot))return;
  if(c.event.commandId&&c.battle.commands[c.event.commandId]?.cancelled)return;
  const e=effects[i]!,targeting=e.targeting??(c.action?defaultTarget(c.action):{side:'any',selection:'manual',count:1,life:'any'} as TargetSpec),targets=select(c,targeting,requested);
  const count=e.op==='damage'?(e.hitCountExpression?Math.max(1,Math.min(e.maxHits!,Math.floor(readFormula(e.hitCountExpression,c.caster,c.target,c.event,c.battle)))):e.hits??1):1;
  for(let hit=0;hit<count;hit++){
   if(c.event.commandId&&c.battle.commands[c.event.commandId]?.cancelled)return;
   if(e.op==='damage'){if(f.budget.beats>=MAX_ATTACK_BEATS){log(c.battle,'execution_limit',c.caster.id,'动作链24段上限');return;}f.budget.beats++;if(c.caster.id===f.owner)f.index++;}
   for(const target of targets){if(++(f.budget.root??f.budget).steps>MAX_EFFECT_STEPS){log(c.battle,'execution_limit',c.caster.id,'效果链预算耗尽');return;}
    const ec:Context={...c,sourceRoot:c.sourceRoot??c.key,target,requested,key:c.key+':'+i,area:targeting.selection==='all'||targets.length>1,event:{...c.event,frame:f,category:c.action?.category??c.event.category}};
    if(e.op!=='damage'&&!e.independent&&f.blockedTargets[c.caster.id+'@'+target.id])continue;
    if(e.requiresHit&&!((f.groups[c.caster.id+'|'+e.requiresHit+'@'+target.id]??0)>0))continue;
    if(!passes(e.conditions,ec)||e.probability!==undefined&&random(c.battle)>=e.probability)continue;
    if(e.op==='damage')f.attempts[target.id]=(f.attempts[target.id]??0)+1;
    const immune=(e.tags??[]).map(tag=>opposingRule(ec,target,'immune_concept',tag,e.priority??0)).find(Boolean)??sourceImmunity(ec,e);if(immune&&!(e.op==='damage'&&wardExhausted(ec,target,immune,immune.rule?.kind==='immune_source'?'能力抗性':'概念抗性'))){consumeRule(immune);continue;}
    if(e.op==='damage'){f.blockedTargets[c.caster.id+'@'+target.id]=false;const ev=c.event.point==='effect'?{...c.event,seen:[],control:undefined}:c.event;ec.event={...ev,frame:f,category:c.action?.category??c.event.category};ec.scale=(c.scale??1)*(e.powerMode==='split_total'?1/count:1);}
    if(e.op!=='damage'&&c.hitCallback&&!c.hitCallback())continue;EXECUTORS[e.op](e,ec);
    if(e.op==='damage'){c.event.actual=f.damage;c.event.raw=f.raw;c.event.critical=ec.event.critical;}
    else{if(['sequence','repeat','branch','check'].includes(e.op)){c.event.actual=f.damage;c.event.raw=f.raw;}settleDeaths(c.battle,{...ec.event,source:c.caster.id,target:target.id});}
   }
  }
 }
}
export function assertExecutable(value:unknown):ActionSpec {return validateAction(value);}
export function assertPassive(value:unknown):ActionSpec {const a=validateAction(value);if(a.activation===undefined&&a.effects.some(e=>e.op==='damage'))throw Error('常驻被动伤害必须声明开场或触发时点');if(Object.values(a.cost).some(c=>c.flat||c.maxFraction||c.currentFraction))throw Error('被动的费用应由触发动作声明');return a;}
function zeroAction():ActionSpec{return {target:'self',cost:{hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}},castMs:0,recoveryFactor:1,perBattleUses:0,effects:[]};}
function installCommands(u:Unit){u.actions['booksea:guard']={...zeroAction(),name:'防御',category:'command',copyable:false,effects:[{op:'modify',name:'防御',duration:{clock:'target_action',value:1},modifiers:[{stat:'reduction_physical',multiplier:.7},{stat:'reduction_energy',multiplier:.7},{stat:'reduction_mental',multiplier:.7}]}]};u.actions['booksea:wait']={...zeroAction(),name:'待机',category:'command',copyable:false,effects:[{op:'atb',mode:'set',value:0}]};
 if(u.side==='ally')u.actions['booksea:attack']={...zeroAction(),target:'enemy',category:'command',name:'普通攻击',description:'已确认的书海普通攻击：威力20+力量×10×宿主层级系数，再计入已编译武器与状态；不是编译失败的替代能力。',copyable:false,effects:[{op:'damage',amounts:{physical:{flat:20,attribute:'力量',factor:10,scale:'host_tier',maxResource:'none',maxFraction:0},energy:{flat:0,attribute:'none',factor:0,scale:'flat',maxResource:'none',maxFraction:0},mental:{flat:0,attribute:'none',factor:0,scale:'flat',maxResource:'none',maxFraction:0},true:{flat:0,attribute:'none',factor:0,scale:'flat',maxResource:'none',maxFraction:0}},element:'none',hitChance:.9,hitRule:'normal',critChance:0,critMultiplier:1}]};
}

export function mergeLibrary(a:LibrarySpec,b:LibrarySpec|undefined){if(b)for(const k of ['actions','statuses','summons','fields'] as const)Object.assign(a[k],clone(b[k]));}
export function createBattle(entries:{id:string;side:'ally'|'enemy';card:CompiledActor;combatLevel?:number;current:Resources;mitigation:Mitigation;persistent?:Partial<Unit>;name?:string}[],seed:number,options:{exploration?:boolean}={}):Battle {
 // 0.38.1：旧缓存里“主目标敌方、效果只选同伴”的死效果按结构修复（见 targeting.ts），被动不动。
 const fix=(a:ActionSpec)=>repairLegacyTargeting(a).action;
 const prepared=entries.map(e=>({...e,card:{...e.card,skills:e.card.skills.map(s=>{if(s.mapping.action){if(s.mapping.disposition==='passive')assertPassive(s.mapping.action);else assertExecutable(s.mapping.action);}for(const a of s.mapping.actions??[])assertExecutable(a);const main=s.mapping.action&&s.mapping.disposition==='active'?fix(s.mapping.action):s.mapping.action;return {...s,mapping:{...s.mapping,action:main?bindLibrary(main,e.id+':'+s.sourceId):null,...(s.mapping.actions?{actions:s.mapping.actions.map((a,i)=>bindLibrary(fix(a),e.id+':'+s.sourceId+':'+i))}:{})}};})}}));
 const units:Unit[]=prepared.map(({id,side,card,combatLevel,current,mitigation,persistent,name})=>{
  const actions:Record<string,ActionSpec>={},lib=clone(persistent?.library??EMPTY_LIBRARY());
  for(const s of card.skills){mergeLibrary(lib,s.mapping.action?.library);for(const a of s.mapping.actions??[])mergeLibrary(lib,a.library);if(s.mapping.disposition==='active')actions[s.sourceId]={...clone(s.mapping.action!),name:s.mapping.action!.name??s.name,source:{...s.mapping.action?.source,id:s.sourceId,kind:s.mapping.action?.source?.kind??sourceKind(s.sourceId)}};for(const [i,a] of (s.mapping.actions??[]).entries())actions[s.sourceId+':'+i]={...clone(a),source:{...a.source,id:s.sourceId,kind:a.source?.kind??sourceKind(s.sourceId)}};}
  for(const s of card.skills)for(const id of s.mapping.action?.grantedActions??[])actions[id]={...lib.actions[id]!,source:{...s.mapping.action?.source,id:s.sourceId,kind:s.mapping.action?.source?.kind??sourceKind(s.sourceId)}};
  Object.assign(actions,clone(persistent?.actions??{}));for(const a of Object.values(actions))delete a.library;
  return {zeroHpProtected:persistent?.zeroHpProtected??false,sources:Object.fromEntries(card.skills.map(s=>[s.sourceId,{kind:s.mapping.action?.source?.kind??sourceKind(s.sourceId),...(s.mapping.action?.source?.quality?{quality:s.mapping.action.source.quality}:{}),tags:s.mapping.action?.source?.tags??[],priority:s.mapping.action?.source?.priority??0}])),sourceLocks:{},passives:Object.fromEntries(card.skills.filter(s=>s.mapping.disposition==='passive'&&s.mapping.action).map(s=>[s.sourceId,clone(s.mapping.action!)])),passiveCopies:{},counters:{},history:[],targetUsed:{},id,name:name??id,side,level:combatLevel===undefined?card.numeric.level:integer(combatLevel,'挑战等级',card.numeric.level),attributes:clone(card.numeric.attributes),max:clone(card.numeric.max),current:clone(current),base:{attributes:clone(card.numeric.attributes),max:clone(card.numeric.max),mitigation:clone(mitigation)},actions,used:{},mitigation:clone(mitigation),shields:clone(persistent?.shields??[]),speeds:clone(persistent?.speeds??[]),copied:clone(persistent?.copied??{}),sealed:clone(persistent?.sealed??{}),sealClocks:clone(persistent?.sealClocks??{}),statuses:clone(persistent?.statuses??[]),hostStatesSeen:clone(persistent?.hostStatesSeen??[]),modifiers:[],library:lib,passiveNames:[],tags:clone(card.traits?.tags??[]),position:0,dependencies:clone(persistent?.dependencies??{}),exploration:clone(persistent?.exploration??[])};
 });
 for(const u of units){installCommands(u);for(const [id,a] of Object.entries(u.actions)){const root=a.source?.id??id;u.sources![root]??={kind:a.source?.kind??(id.startsWith('booksea:')?'system':'skill'),...(a.source?.quality?{quality:a.source.quality}:{}),tags:a.source?.tags??[],priority:a.source?.priority??0};}}
 const b:Battle={version:1,...(options.exploration?{exploration:true}:{}),units,clock:options.exploration?{version:1,timeMs:0,paused:false,ended:false,pending:[],units:units.map(u=>({id:u.id,side:u.side,agility:u.attributes.敏捷,speedBonus:0,haste:1,active:true,atb:0,recoveryMs:0,cast:null,actionsCompleted:0}))}:createClock(units.map(u=>({id:u.id,side:u.side,agility:u.attributes.敏捷,speedBonus:0,haste:1}))),seed,nextCommand:1,commands:{},outcome:'active',log:[],fields:[],scheduled:[],snapshots:{},nextEvent:0,readySeen:[]};
 for(const [i,u] of [...units].entries()){
  deferClamp=true;try{
  for(const s of prepared[i]!.card.skills){if(s.mapping.disposition!=='passive')continue;const a=s.mapping.action!,isHost=s.sourceId.startsWith('/状态定义/')||s.mapping.action?.activation==='run_start';u.passiveNames!.push(s.name);
   if(a.activation==='battle_start'&&options.exploration)continue;
   if(isHost&&u.hostStatesSeen!.includes(s.sourceId))continue;
   if(isHost)u.hostStatesSeen!.push(s.sourceId);
   const ctx:Context={sourceRoot:s.sourceId,battle:b,caster:u,target:u,key:'passive:'+s.sourceId,event:event(b,u.id,u.id),action:a};
   runEffects(ctx,a.effects,[u.id]);
   if(a.triggers?.length){const old=u.statuses?.find(x=>x.sourceKey===ctx.key&&x.definition.scope==='run');if(!old){const d=simpleStatus(s.name,{clock:'permanent',value:0});d.scope=a.triggers.some(t=>t.reset==='run')?'run':'battle';d.triggers=a.triggers;addStatus(ctx,'passive:'+s.sourceId,d);}}
  }
  }finally{deferClamp=false;}
  for(const a of Object.values(u.actions))if(a.charges!==undefined)u.charges={...u.charges,[Object.keys(u.actions).find(k=>u.actions[k]===a)!]:a.charges};
  recompute(u,b);
 }
 for(const u of units)auditInvulnerability(u);
 for(const u of units)chargeProtection(b,u);
 // 开场触发（含“战斗开始时造成伤害”）可能在玩家行动前就清场；随后的连锁效果若因战场已结束而抛错，
 // 不能让整场战斗建立失败（否则远征会停在没有战斗数据的战斗模式）。保留已结算部分，照常判定胜负。
 if(!options.exploration){try{for(const u of units)emit(b,'battle_start',event(b,u.id,u.id,'battle_start'));}catch(e){log(b,'opening_error',b.units[0]!.id,'开场效果中断：'+String((e as Error)?.message??e).slice(0,120));}}
 synchronize(b,!options.exploration);if(!options.exploration&&b.outcome==='active')openingInitiative(b);return b;
}
export function costFor(u:Unit,a:ActionSpec,id?:string):Resources{
 // 0.21：系统指令（等待/防御/逃跑）不受消耗修正；零消耗的行动不受敌方强加的加税影响（永远留有免费的行动）。
 const command=a.category==='command'||!!id?.startsWith('booksea:');
 const base=Object.fromEntries(RES.map(r=>{const own=a.cost[r].flat+u.max[r]*a.cost[r].maxFraction+u.current[r]*(a.cost[r].currentFraction??0);const mod=command?{flat:0,multiplier:1}:own<=0&&u.free?u.free.cost[r]!:{flat:u.stats?.['cost_'+r+'_flat']??0,multiplier:u.stats?.['cost_'+r]??1};return [r,Math.max(0,Math.ceil((own+mod.flat)*mod.multiplier))];})) as Resources;
 // 0.36.1 费用规则：第 N 次同技能免费（回响之弦）、每轮首动折价其余加价（惰性齿轮）、以血代蓝（血税印，不可致死）。
 if(a.category!=='command'){
  if(id){const free=activeRule(u,'nth_use_free');if(free&&(u.used[id]??0)+1===(Number(free.rule!.key)||3))return {hp:0,mp:0,sp:0};}
  const gear=activeRule(u,'gear_cost');if(gear){const [first,rest]=gear.rule!.key.split('|').map(Number);const k=(u.roundActions??0)===0?(first||.5):(rest||2);for(const r of RES)base[r]=Math.ceil(base[r]*k);}
 }
 const tax=activeRule(u,'blood_tax');if(tax&&base.mp>0){base.hp=Math.min(Math.max(0,u.current.hp-1),base.hp+base.mp);base.mp=0;}
 return base;}
/** 战斗中途加入一名独立单位（0.37.6 银十字：「?」助战）。按 createBattle 的同一套流程建卡、装被动，再接入当前时钟，不属于任何召唤者。 */
export function joinBattle(battle:Battle,entry:Parameters<typeof createBattle>[0][number]):Battle{
 if(battle.units.some(u=>u.id===entry.id))throw Error('该单位已在场');
 const b=clone(battle),u=createBattle([entry],b.seed,{exploration:true}).units[0]!;
 b.units.push(u);b.clock.units.push({id:u.id,side:u.side,agility:u.attributes.敏捷,speedBonus:0,haste:1,active:true,atb:0,recoveryMs:0,cast:null,actionsCompleted:0});
 recompute(u,b);log(b,'join',u.id,u.name+'加入战斗');return b;
}
export function actionUnavailable(b:Battle,u:Unit,id:string,targetIds?:string[]):string {
 const gf=activeRule(u,'guard_first');if(gf&&id!=='booksea:guard'&&Object.entries(u.used).filter(([k])=>k!=='booksea:guard').reduce((n,[,v])=>n+v,0)<(Number(gf.rule!.key)||2)&&Object.entries(u.used).reduce((n,[,v])=>n+v,0)<(Number(gf.rule!.key)||2))return '盾墙誓约：前'+(Number(gf.rule!.key)||2)+'次行动只能防御';
 const a=u.actions[id];if(!a)return '不存在已编译动作';
 if(!isAlive(u))return activeRule(u,'sealed')?'已封印':'已倒地';
 if(u.openingActions?.length&&!u.openingActions.includes(id))return '先手窗口仅可选择声明绝对先手的能力';
 if(HARD_CONTROLS.some(k=>controls(u,k).length))return controls(u,'petrify').length?'石化：无法行动':controls(u,'knockdown').length?'击倒：无法行动':'无法行动';
 if(controls(u,'polymorph').length&&(a.category??'skill')!=='command')return '变形：只能普通攻击、防御或待机';
 if(controls(u,'disarm').length&&(a.category??'skill')!=='spell'&&attacking(a))return '缴械：无法进行武器攻击';
 if(controls(u,'no_action').length&&(a.category??'skill')!=='command'&&!attacking(a))return '无法进行[动作]：只能攻击';
 if(controls(u,'silence').length&&(a.category??'skill')==='spell')return '沉默：无法施法';
 if(controls(u,'bind').length&&(a.tags??[]).includes('movement'))return '束缚：无法位移';
 if(controls(u,'fear').length&&(a.target==='enemy'||a.targeting?.side==='enemy'))return '恐惧：无法主动攻击';
 const system=id.startsWith('booksea:');
 if(!system&&rule(u,'seal_category',a.category??'skill'))return '该能力类型被封印';
 if(!system&&!sourceEnabled(u,a.source?.id??id))return '能力来源已封锁或移除';
 if(a.perTargetUses&&targetIds?.some(t=>(u.targetUsed?.[id+'@'+t]??0)>=a.perTargetUses!))return '该目标的使用次数已耗尽';
 if(!system&&u.sealed?.[id]!==undefined)return u.cooling?.includes(id)?'冷却中（剩余'+Math.max(1,u.sealed[id]!-1)+'次行动）':'技能封锁';
 if(a.perBattleUses>0&&(u.used[id]??0)>=a.perBattleUses)return '每战次数已用尽';
 if(a.charges!==undefined&&(u.charges?.[id]??0)<=0)return '蓄能不足';
 const plan=costPlan(b,u,a,id);if(plan.error)return plan.error;
 if(!passes(a.conditions,{battle:b,caster:u,target:unit(b,targetIds?.[0]??u.id)??u,key:id,event:{point:'inspect',source:u.id,target:u.id,raw:0,actual:0,critical:false,category:a.category??'',root:0,seen:[]}}))return '使用条件未满足';
 if(targetIds){const q=defaultTarget(a),valid=legalTargets(b,u,a);if(q.selection==='manual'&&(!targetIds.length||targetIds.some(id=>!valid.some(t=>t.id===id))||new Set(targetIds).size!==targetIds.length||targetIds.length>(q.count??1)))return '目标不合法';}
 return '';
}
function pay(b:Battle,u:Unit,a:ActionSpec,cmd:Command){
 if(cmd.paid)return !cmd.cancelled;if(cmd.cancelled)return false;
 const ev=event(b,u.id,cmd.target,'before_cost');ev.commandId=cmd.id;ev.category=a.category??'';ev.control={cancelled:false,scale:1};emit(b,'before_cost',ev);if(ev.control.cancelled){cmd.cancelled=true;return false;}
 const plan=costPlan(b,u,a,cmd.sourceId);if(plan.error){log(b,'fizzle',u.id,plan.error);cmd.cancelled=true;return false;}
 for(const [id,costs] of Object.entries(plan.payments))for(const r of RES)unit(b,id).current[r]-=costs[r];
 cmd.paidBy=plan.payments;cmd.paid=plan.payments[u.id]!;cmd.paidTotal={hp:0,mp:0,sp:0};for(const costs of Object.values(plan.payments))for(const r of RES)cmd.paidTotal[r]+=costs[r];
 ev.paid=cmd.paid;ev.paidTotal=cmd.paidTotal;ev.point='after_cost';emit(b,'after_cost',ev);if(ev.control.cancelled)cmd.cancelled=true;return !cmd.cancelled;
}
export function chooseAction(battle:Battle,casterId:string,sourceId:string,targetId:string|string[]):Battle {
 const ids=typeof targetId==='string'?[targetId]:targetId,actor=unit(battle,casterId),reason=actionUnavailable(battle,actor,sourceId,ids);if(reason)throw Error(reason);
 const b=clone(battle),u=unit(b,casterId),a=clone(u.actions[sourceId]!),id='command-'+b.nextCommand++;
 const cmd:Command={id,caster:casterId,target:ids[0]??casterId,targets:ids,sourceId,action:a};
 b.clock=submitAction(b.clock,casterId,{id,castMs:a.castMs/Math.max(.001,u.stats?.cast_speed??1),recoveryFactor:a.recoveryFactor*(u.stats?.recovery??1)});b.commands[id]=cmd;
 const ev=event(b,casterId,cmd.target,'before_action');ev.commandId=id;ev.category=a.category??'';ev.control={cancelled:false,scale:1};emit(b,'before_action',ev);if(ev.control.cancelled)cmd.cancelled=true;
 if((a.payment??'submit')==='submit')pay(b,u,a,cmd);
 if(a.perTargetUses){u.targetUsed??={};for(const t of ids)u.targetUsed[sourceId+'@'+t]=(u.targetUsed[sourceId+'@'+t]??0)+1;}
 const firstUse=(u.used[sourceId]??0)===0;u.roundActions=(u.roundActions??0)+1;
 if(a.category!=='command'&&!u.echoUsed){const echo=activeRule(u,'echo_first');if(echo){u.echoUsed=true;u.echoQueue=[...(u.echoQueue??[]),{sourceId,targets:[...ids],round:(b.round??0)+1}];log(b,'status',u.id,'复读机：下一轮再放一次',0);}}u.used[sourceId]=(u.used[sourceId]??0)+1;if(a.charges!==undefined)u.charges![sourceId]!--;if(a.cooldown){u.sealed??={};u.sealClocks??={};u.sealed[sourceId]=a.cooldown+1;u.sealClocks[sourceId]='target_ready';u.cooling=[...new Set([...(u.cooling??[]),sourceId])];}
 {const rs=activeRule(u,'repeat_seal');if(rs&&a.category!=='command'){u.repeatSealed??=[];if(firstUse&&u.repeatSealed.length){for(const k of u.repeatSealed){delete u.sealed?.[k];delete u.sealClocks?.[k];}u.repeatSealed=[];log(b,'status',u.id,'重复封印·解除',0);}const limit=Math.max(2,Number(rs.rule!.key)||3);if((u.used[sourceId]??0)>=limit&&!u.repeatSealed.includes(sourceId)){u.sealed??={};u.sealClocks??={};u.sealed[sourceId]=1e9;u.sealClocks[sourceId]='permanent';u.repeatSealed.push(sourceId);log(b,'status',u.id,'重复封印',0);}}}
 if(cmd.cancelled&&clockUnit(b,casterId).cast?.commandId===id){const cast=clockUnit(b,casterId).cast!;clockUnit(b,casterId).cast=null;b.clock.pending.unshift({kind:'resolve',unitId:casterId,commandId:id,recoveryFactor:cast.recoveryFactor});}
 delete u.openingActions;const first=activeRule(u,'first_strike');if(first)consumeRule(first);b.readySeen=b.readySeen?.filter(x=>x!==casterId);log(b,'submitted',casterId,sourceId);return b;
}
export function resolveAction(battle:Battle):Battle {
 const e=battle.clock.pending[0];if(!e||e.kind!=='resolve'||battle.clock.paused)throw Error('没有可结算行动');
 const b=clone(battle),cmd=b.commands[e.commandId]!;const a=unit(b,cmd.caster);const old=new Set([...(a.statuses??[]),...a.shields,...a.speeds,...Object.values(a.copied??{}),...a.exploration??[],...b.scheduled??[],...b.fields??[],...a.summon?[a.summon]:[]]);
 // Resolve the old action-clock seals before this atomic action can refresh them.
 for(const [id] of Object.entries(a.sealed??{}))if(a.sealClocks?.[id]==='target_action'&&--a.sealed![id]!<=0){delete a.sealed![id];delete a.sealClocks[id];}
 const ev=event(b,a.id,cmd.target);ev.category=cmd.action.category??'';ev.trace={action:clone(cmd.action),caster:a.id,power:clone(a),libraryOwner:a.id,sourceRoot:cmd.sourceId};
 let valid=!cmd.cancelled&&(isAlive(a)||cmd.action.suicideCost&&!!cmd.paid?.hp)&&sourceEnabled(a,cmd.action.source?.id??cmd.sourceId)&&(cmd.action.payment!=='resolve'||pay(b,a,cmd.action,cmd));
// 间章:小憩：一经结算必定登记，不受空白页、封印、来源停用或指令作废影响；到期时由 advanceRound 统一撤离。
if(!b.exploration&&cmd.action.tags?.includes(INTERLUDE_TAG)){const round=b.round??Math.floor(b.clock.timeMs/ROUND_MS);b.interludes=[...(b.interludes??[]),{due:round+2,side:a.side,caster:a.id}];log(b,'status',a.id,'间章:小憩：第 '+(round+2)+' 回合开始时全员撤离',0);}
if(valid){const bp=activeRule(a,'blank_page');if(bp&&bp.rule!.key===cmd.sourceId){valid=false;cmd.cancelled=true;consumeRule(bp);a.statuses=a.statuses?.filter(s=>s!==bp);log(b,'fizzle',a.id,'空白页：这一招作废');}}ev.paid=cmd.paid;ev.paidTotal=cmd.paidTotal;ev.commandId=cmd.id;if(valid){a.history??=[];a.history.push(cmd.sourceId);if(a.history.length>128)a.history.shift();}
 if(valid)runEffects({sourceRoot:cmd.sourceId,battle:b,caster:a,target:unit(b,cmd.target)??a,key:a.id+':'+cmd.sourceId,event:ev,action:cmd.action,hitCallback:cmd.action.payment==='hit'?()=>pay(b,a,cmd.action,cmd):undefined},cmd.action.effects,cmd.targets??[cmd.target]);
 // Death/counter reactions can remove the actor's pending command. Effects already resolved; never reinsert it.
 if(b.clock.pending.some(p=>p.kind==='resolve'&&p.commandId===cmd.id)){
  const at=b.clock.pending.findIndex(p=>p.kind==='resolve'&&p.commandId===cmd.id);const head=b.clock.pending.splice(at,1)[0]!;b.clock.pending.unshift(head);b.clock=completeAction(b.clock,cmd.id);
 }
 // 0.21：成功完成一次自己的行动（待机/防御不算）才解除“同一来源不能连续控制”。
 if(valid&&!cmd.cancelled&&cmd.sourceId!=='booksea:wait'&&cmd.sourceId!=='booksea:guard'&&!controls(a,'charm').length)a.acted=(a.acted??0)+1;
 if(valid&&!cmd.cancelled)for(const target of cmd.targets??[cmd.target])emit(b,'action_resolved',{...ev,target,source:a.id});
 delete b.commands[cmd.id];for(const state of a.statuses??[])for(const trigger of state.definition.triggers??[])if(trigger.reset==='action')state.used[trigger.id]=0;emit(b,'action_end',{...ev,source:a.id,target:a.id,point:'action_end'});
 tickTargetAction(b,a,old,'target_action');
 if(a.extraActions&&isAlive(a)){a.extraActions--;const cu=clockUnit(b,a.id);cu.atb=100;cu.recoveryMs=0;b.clock.pending.push({kind:'ready',unitId:a.id});announceReady(b,a.id);}
 synchronize(b);orderReady(b,ev.root);return b;
}
function tickTargetAction(b:Battle,u:Unit,old:Set<object>,clock:'target_action'|'target_ready'){
 if(clock==='target_ready'){for(const x of Object.values(u.counters??{}))if(x.reset==='target_ready')x.value=0;for(const s of u.statuses??[])for(const k of Object.keys(s.used))if(k.startsWith('cap:target_ready:'))s.used[k]=0;}
 if(clock==='target_ready')for(const [id] of Object.entries(u.sealed??{}))if(u.sealClocks?.[id]===clock&&--u.sealed![id]!<=0){delete u.sealed![id];delete u.sealClocks[id];}
 for(const s of u.statuses??[])if(old.has(s)&&s.definition.tick?.clock===clock)tickStatus(b,u,s,1,clock);
 for(const s of [...u.shields,...u.speeds,...u.statuses??[],...u.exploration??[]])if(s.clock===clock&&old.has(s))s.remaining--;
 if(u.summon?.clock===clock&&old.has(u.summon)&&--u.summon.remaining<=0){u.current.hp=0;u.zeroHpProtected=false;u.escaped=true;u.deadHandled=true;b.clock=deactivateUnit(b.clock,u.id);}
 for(const [id,copy] of Object.entries(u.copied??{}))if(old.has(copy)&&copy.clock===clock&&--copy.remaining<=0){delete u.actions[id];delete u.copied![id];}
 for(const f of b.fields??[])if(f.owner===u.id&&f.clock===clock&&old.has(f))f.remaining--;
 for(const s of [...b.scheduled??[]])if(s.target===u.id&&s.clock===clock&&old.has(s)&&--s.remaining<=0){b.scheduled=b.scheduled!.filter(x=>x!==s);const owner=unit(b,s.owner);invoke({battle:b,caster:unit(b,s.caster??s.owner)??owner,target:u,key:s.key,sourceRoot:s.sourceRoot,event:{...event(b,owner.id,u.id),automatic:true,frame:{...freshFrame(),variables:clone(s.variables??{})}},libraryOwner:owner.id},s.action);}
}
export function interruptAction(battle:Battle,casterId:string):Battle {const b=clone(battle),u=unit(b,casterId);if(!clockUnit(b,casterId).cast)throw Error('没有正在施法的行动');EXECUTORS.cast({op:'cast',mode:'interrupt',value:0},{battle:b,caster:u,target:u,key:'interrupt',event:event(b,casterId,casterId)});return b;}
function tickStatus(b:Battle,u:Unit,s:StateInstance,dt:number,clock:string){const tick=s.definition.tick;if(s.suppressed||!tick||tick.clock!==clock)return;s.tickLeft-=dt;if(s.tickLeft>EPS)return;
 if(tick.count>0&&s.tickCount>=tick.count)return;s.tickLeft+=tick.interval;s.tickCount++;
 const owner=unit(b,s.libraryOwner??s.source);if(owner){const c:Context={battle:b,caster:unit(b,s.source)??owner,target:u,key:s.id+':tick',event:event(b,owner.id,u.id,'tick'),libraryOwner:s.libraryOwner,scale:s.definition.scaleWithStacks===false?1:s.stacks};const a=actionById(c,tick.action);if(tick.payCost){const fake:Command={id:'pulse-'+b.nextCommand++,caster:owner.id,target:u.id,sourceId:tick.action,action:a};if(!pay(b,owner,a,fake)){s.clock='battle_time';s.remaining=0;log(b,'channel_stopped',u.id,'持续支付不足或被拦截');return;}c.event.paid=fake.paid;c.event.paidTotal=fake.paidTotal;}runEffects({...c,action:{...a,targeting:{side:'any',selection:'manual',count:1,life:'alive'}}},a.effects,[u.id]);}
}
function announceReady(b:Battle,id:string){b.readySeen??=[];if(b.readySeen.includes(id))return;b.readySeen.push(id);const u=unit(b,id);tryEscape(b,u);tickTargetAction(b,u,new Set([...u.shields,...u.speeds,...u.statuses??[],...u.exploration??[],...Object.values(u.copied??{}),...b.scheduled??[],...b.fields??[],...u.summon?[u.summon]:[]]),'target_ready');if(isAlive(u))emit(b,'ready',event(b,id,id,'ready'));}
export function advanceBattle(battle:Battle,budgetMs:number):{battle:Battle;consumedMs:number}{
 const b=clone(battle);b.round??=Math.floor(b.clock.timeMs/ROUND_MS);let left=budgetMs,total=0;if(clockPhase(b.clock)!=='flowing')return {battle:b,consumedMs:0};synchronize(b);
 while(left>EPS&&b.outcome==='active'&&clockPhase(b.clock)==='flowing'){
  const oldUnits=b.units.map(u=>({u,timed:[...u.shields,...u.speeds,...u.statuses??[],...u.exploration??[]],statuses:[...u.statuses??[]],copies:Object.entries(u.copied??{}),seals:Object.entries(u.sealed??{})})),oldFields=[...b.fields??[]],oldTasks=[...b.scheduled??[]].filter(s=>s.clock==='battle_time');
  const boundaries:number[]=[((b.round??0)+1)*ROUND_MS-b.clock.timeMs];for(const link of b.lifeLinks??[])if(link.clock==='battle_time')boundaries.push(link.remaining);for(const u of b.units)for(const copy of Object.values(u.passiveCopies??{}))if(copy.clock==='battle_time')boundaries.push(copy.remaining);for(const u of b.units)for(const lock of Object.values(u.sourceLocks??{}))if(lock.clock==='battle_time')boundaries.push(lock.remaining);
  for(const u of b.units)for(const s of [...u.shields,...u.speeds,...u.statuses??[],...u.exploration??[]])if(s.clock==='battle_time'&&!clockFrozen(u,s as {definition?:StatusSpec}))boundaries.push(s.remaining);
  for(const u of b.units){for(const s of u.statuses??[])if(s.definition.tick?.clock==='battle_time'&&(!s.definition.tick.count||s.tickCount<s.definition.tick.count))boundaries.push(s.tickLeft);if(isAlive(u)&&u.summon?.clock==='battle_time')boundaries.push(u.summon.remaining);}
  for(const f of oldFields)if(f.clock==='battle_time')boundaries.push(f.remaining);for(const {u,copies,seals} of oldUnits){for(const [,copy] of copies)if(copy.clock==='battle_time')boundaries.push(copy.remaining);for(const [id,n] of seals)if(n>=0&&(u.sealClocks?.[id]??'battle_time')==='battle_time')boundaries.push(n);}
  boundaries.push(...(b.scheduled??[]).filter(s=>s.clock==='battle_time').map(s=>s.remaining));
  const step=Math.min(left,...boundaries.filter(n=>n>=0));const result=advanceClock(b.clock,step);b.clock=result.clock;const dt=result.consumedMs;
  for(const {u,timed,statuses,copies,seals} of oldUnits){
   for(const lock of Object.values(u.sourceLocks??{}))if(lock.clock==='battle_time')lock.remaining-=dt;
   for(const s of timed)if(s.clock==='battle_time'&&!clockFrozen(u,s as {definition?:StatusSpec}))s.remaining-=dt;
   if(isAlive(u)&&u.summon?.clock==='battle_time'){u.summon.remaining-=dt;if(u.summon.remaining<=EPS){u.current.hp=0;u.zeroHpProtected=false;u.escaped=true;u.deadHandled=true;b.clock=deactivateUnit(b.clock,u.id);}}
   for(const [id,n] of seals)if(n>=0&&(u.sealClocks?.[id]??'battle_time')==='battle_time'){u.sealed![id]=n-dt;if(u.sealed![id]!<=0){delete u.sealed![id];delete u.sealClocks![id];}}
   for(const [id,copy] of copies)if(copy.clock==='battle_time'){copy.remaining-=dt;if(copy.remaining<=EPS){delete u.actions[id];delete u.copied![id];}}
  }
  for(const link of b.lifeLinks??[])if(link.clock==='battle_time')link.remaining-=dt;for(const u of b.units)for(const copy of Object.values(u.passiveCopies??{}))if(copy.clock==='battle_time')copy.remaining-=dt;
  for(const f of oldFields)if(f.clock==='battle_time')f.remaining-=dt;
  for(const s of oldTasks)s.remaining-=dt;
  for(const {u,statuses} of oldUnits)for(const st of statuses)if(!clockFrozen(u,st))tickStatus(b,u,st,dt,'battle_time');
  for(const s of oldTasks){if(s.remaining<=EPS){b.scheduled=b.scheduled!.filter(x=>x!==s);const owner=unit(b,s.owner),target=unit(b,s.target);invoke({battle:b,caster:unit(b,s.caster??s.owner)??owner,target,key:s.key,sourceRoot:s.sourceRoot,event:{...event(b,owner.id,target.id),automatic:true,frame:{...freshFrame(),variables:clone(s.variables??{})}},libraryOwner:owner.id},s.action);}}
  if(b.clock.timeMs+EPS>=((b.round??0)+1)*ROUND_MS)advanceRound(b);
  for(const e of [...b.clock.pending])if(e.kind==='ready')announceReady(b,e.unitId);
  synchronize(b);orderReady(b,b.nextEvent??0);left-=dt;total+=dt;if(dt===0&&step>0)break;
 }
 return {battle:b,consumedMs:total};
}
/** Exploration/event/relic effects use the same executors, with no advancement of battle or host world time. */
export function applyBattleEffects(battle:Battle,casterId:string,action:ActionSpec,targetIds:string[],point='effect',sourceKey='external'):Battle {
 action=bindLibrary(validateAction({...action,library:action.library??unit(battle,casterId).library??EMPTY_LIBRARY()}),casterId+':'+sourceKey);const b=clone(battle),caster=unit(b,casterId);caster.library??=EMPTY_LIBRARY();mergeLibrary(caster.library,action.library);caster.sources??={};const origin=action.source?.id??sourceKey;caster.sources[origin]={kind:action.source?.kind??'skill',...(action.source?.quality?{quality:action.source.quality}:{}),tags:action.source?.tags??[],priority:action.source?.priority??0};
 runEffects({sourceRoot:origin,battle:b,caster,target:unit(b,targetIds[0]??casterId)??caster,key:casterId+':'+sourceKey,event:event(b,casterId,targetIds[0]??casterId,point),action},action.effects,targetIds);synchronize(b,false);settleDeaths(b,event(b,casterId,targetIds[0]??casterId));return b;
}
export function dispatchBattleEvent(battle:Battle,point:string,sourceId:string,targetId=sourceId):Battle{const b=clone(battle);emit(b,point,event(b,sourceId,targetId,point));synchronize(b,false);return b;}
export function advanceExplorationEffects(battle:Battle,dt:number):Battle{
 const b=clone(battle);let left=dt;
 while(left>EPS){
  const oldUnits=b.units.map(u=>({u,timed:[...u.shields,...u.speeds,...u.statuses??[],...u.exploration??[]],statuses:[...u.statuses??[]],copies:Object.entries(u.copied??{}),seals:Object.entries(u.sealed??{})}));
  const oldFields=[...b.fields??[]],oldTasks=[...b.scheduled??[]].filter(x=>x.clock==='exploration_time'),times:number[]=[];
  for(const {u,timed,statuses,copies,seals} of oldUnits){
   for(const x of timed)if(x.clock==='exploration_time')times.push(x.remaining);
   for(const s of statuses)if(s.definition.tick?.clock==='exploration_time'&&(!s.definition.tick.count||s.tickCount<s.definition.tick.count))times.push(s.tickLeft);
   for(const [,c] of copies)if(c.clock==='exploration_time')times.push(c.remaining);
   for(const [id,n] of seals)if(n>=0&&u.sealClocks?.[id]==='exploration_time')times.push(n);
   if(isAlive(u)&&u.summon?.clock==='exploration_time')times.push(u.summon.remaining);
  }
  times.push(...oldFields.filter(x=>x.clock==='exploration_time').map(x=>x.remaining),...oldTasks.map(x=>x.remaining));
  const step=Math.min(left,...times.filter(x=>x>=0));b.clock.timeMs+=step;
  for(const {u,timed,copies,seals} of oldUnits){
   for(const s of timed)if(s.clock==='exploration_time')s.remaining-=step;
   for(const [id,n] of seals)if(n>=0&&u.sealClocks?.[id]==='exploration_time'){u.sealed![id]=n-step;if(u.sealed![id]!<=0){delete u.sealed![id];delete u.sealClocks![id];}}
   for(const [id,c] of copies)if(c.clock==='exploration_time'){c.remaining-=step;if(c.remaining<=EPS){delete u.actions[id];delete u.copied![id];}}
   if(isAlive(u)&&u.summon?.clock==='exploration_time'){u.summon.remaining-=step;if(u.summon.remaining<=EPS){u.current.hp=0;u.zeroHpProtected=false;u.escaped=true;u.deadHandled=true;b.clock=deactivateUnit(b.clock,u.id);}}
  }
  for(const f of oldFields)if(f.clock==='exploration_time')f.remaining-=step;
  for(const task of oldTasks)task.remaining-=step;
  for(const {u,statuses} of oldUnits)for(const s of statuses)tickStatus(b,u,s,step,'exploration_time');
  for(const task of oldTasks)if(task.remaining<=EPS){b.scheduled=b.scheduled!.filter(x=>x!==task);const owner=unit(b,task.owner),target=unit(b,task.target);invoke({battle:b,caster:unit(b,task.caster??task.owner)??owner,target,key:task.key,sourceRoot:task.sourceRoot,event:{...event(b,owner.id,target.id),automatic:true,frame:{...freshFrame(),variables:clone(task.variables??{})}},libraryOwner:owner.id},task.action);}
  synchronize(b,false);settleDeaths(b,event(b,b.units[0]!.id,b.units[0]!.id));left-=step;
 }
 return b;
}

export function persistentUnit(u:Unit,timeMs=0):Partial<Unit>{const statuses=clone((u.statuses??[]).filter(s=>s.definition.scope!=='battle'));for(const s of statuses)for(const key of Object.keys(s.last))s.last[key]!-=timeMs;const copied=Object.fromEntries(Object.entries(u.copied??{}).filter(([,c])=>c.clock==='exploration_time'));const sealed=Object.fromEntries(Object.entries(u.sealed??{}).filter(([id])=>u.sealClocks?.[id]==='exploration_time'));return {zeroHpProtected:!!u.zeroHpProtected&&statuses.some(s=>s.rule?.kind==='undying'&&!s.suppressed&&live(s)),library:clone(u.library??EMPTY_LIBRARY()),statuses,shields:clone(u.shields.filter(x=>x.clock==='exploration_time')),speeds:clone(u.speeds.filter(x=>x.clock==='exploration_time')),copied:clone(copied),actions:clone(Object.fromEntries(Object.keys(copied).map(id=>[id,u.actions[id]!]))),sealed,sealClocks:Object.fromEntries(Object.keys(sealed).map(id=>[id,'exploration_time' as const])),hostStatesSeen:clone(u.hostStatesSeen??[]),dependencies:clone(u.dependencies??{}),exploration:clone(u.exploration??[])};}

/** 0.21 R-1：兜底让过本回合——不检查封锁，直接提交一次待机。只给 AI 在所有动作都不可用时使用。 */
export function passTurn(battle:Battle,casterId:string):Battle{const b=clone(battle),u=unit(b,casterId),a=clone(u.actions['booksea:wait']??({...zeroAction(),name:'待机',category:'command',copyable:false,effects:[{op:'atb',mode:'set',value:0}]} as ActionSpec)),id='command-'+b.nextCommand++;
 b.clock=submitAction(b.clock,casterId,{id,castMs:0,recoveryFactor:a.recoveryFactor});b.commands[id]={id,caster:casterId,target:casterId,targets:[casterId],sourceId:'booksea:wait',action:a};delete u.openingActions;b.readySeen=b.readySeen?.filter(x=>x!==casterId);log(b,'submitted',casterId,'booksea:wait');return b;}
export function withdrawEnemy(battle:Battle,id:string):Battle{const b=clone(battle),u=unit(b,id);u.escaped=true;b.clock=deactivateUnit(b.clock,id);for(const [key,c] of Object.entries(b.commands))if(c.caster===id)delete b.commands[key];log(b,'escape',id,'敌人逃离');synchronize(b);return b;}
