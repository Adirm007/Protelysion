import {SUPPLIER_NAME,SUPPLIER_QUESTION,SUPPLIER_CHOICES} from './supplier';
import {describeAction,statusSummary,runtimeRuleText,effectText,playerNotice,playerBattleLog} from '../ui/ability-text';
import {GENERATOR_VERSION} from './maps/generator';
import {isAlive,createBattle,joinBattle,advanceBattle,chooseAction,resolveAction,applyBattleEffects,advanceExplorationEffects,dispatchBattleEvent,persistentUnit,legalTargets,actionUnavailable,costFor,withdrawEnemy,passTurn,hostileTo,type Battle,type Unit} from '../battle/executor';
import {clockPhase,speedFactor} from '../battle/clock';
import {roll,suppression} from '../battle/damage';
import {rewardFP} from '../core/settlement';
import {MIMIC_ID,MIMIC_DESIGN,mimicKit,mimicLevel} from './monsters/mimic';
import {STRAY_ID,STRAY_NAME,STRAY_SPAWN_CHANCE,STRAY_SPAWN_DISTANCE,STRAY_THREAD,STRAY_THREAD_CHANCE,STRAY_STEP_MS,mirrorStrayLive,strayFloor,strayKit} from './monsters/stray';
import {enemyArtId} from '../presentation/monster-art';
import {eventChoiceDescription,relicDescription} from './event-text';
import {actorKey,type ActorRef} from '../core/actors';
import {awardVictory,exitMembers,addReward,settlementProposal,type Run} from '../core/run';
import {FOES,THEMES,TOTAL_DEPTH,bareMitigation,hostMitigation,contentCard,type PartyMember} from './content';
import {RELICS,passiveAction} from './relics';
import {action,targeting,type EventDefinition,type EventResult,type EventChoice,type EventRequirement} from './mechanism-content';
import {RELIC_CATALOG,RELIC_LIST,RELIC_RARITY_LABEL,LEARNING_DEVICE,LEARNING_DEVICE_PRICE,shopRelicPrice,type RelicDef} from './relic-catalog';
import {EVENT_CATALOG} from './event-catalog';
import {relicHooks,relicCapacity,relicSlotsUsed,pendingFp,adjustFp,scaleFp,grantFp,countBoxes,removeBoxes,bumpQuality,POTIONS,POTION_BY_ID,POTION_KEY,potionPrice,INSURANCE,type BattleMod,type LayerMods,type OwnedRelic} from './run-hooks';
import {makeRegion,themeFor,walkable,near,type Region,type Thing,type RegionOptions} from './region';
import {decide} from './combat-ai';
import {TALK_LIMITS,TALK_LOG_LIMIT,TALK_INPUT_LIMIT,DEAL_LABEL,buildSupplierPrompt,parseSupplierReply,materializeDeal,buildCustomItem,capTierFor,type TalkSession,type SupplierContext,type CustomItemSpec,type SupplierPrompt,type DealKind} from './supplier-agent';
import type {ActionSpec,EffectSpec} from '../compiler/contract';
import {monsterKit} from './monsters/kits';
import {isInterludeAction} from '../compiler/interlude';
import {MONSTER_BY_ID} from './monsters/catalog';
import {MONSTER_CONTENT_VERSION,monsterNumbers} from './monsters/numbers';
import {MATERIAL_DROP_CHANCE,VALUE_CRYSTAL,VALUE_CRYSTAL_CHANCE,isMythicLevel,levelQuality,materialEffect,materialFor} from './monsters/materials';
export type State={version:2;regionSeed?:number;monsterContentVersion?:string;mechanicsVersion?:2;source?:'host';hostContext?:string;hostSave?:{frame:string;revision:number};writeback?:'pending'|'synced'|'done'|'error';inventory?:Record<string,{owner:ActorRef;name:string;actorId:string;remaining:number;used:number}>;relics?:string[];ownedRelics?:{id:string;owner:string;stacks:number}[];bossPhases?:string[];seed:number;mode:'explore'|'battle'|'event'|'supplier'|'ended';supplierState?:{thingId:string;talk?:boolean};paused:boolean;depth:number;visit:number;region:Region;x:number;z:number;party:PartyMember[];run:Run;battle:Battle|null;world?:Battle;encounterId:string;origin:{x:number;z:number};selected:string|null;selectedTargets?:string[];potions:number;notice:string;history:string[];steps:number;fights:number;eventDefinition?:EventDefinition;eventState?:{id:string;thingId:string;offers:string[];results:EventResult[];owner:string;choice:string};eventJournal?:Record<string,string>;flags?:string[];explorationMs?:number;escapeMs?:number;depthLog?:{start:number;maximum:number;down:number;up:number;visits:number};encounters?:{depth:number;region:string;enemies:{name:string;level:number;count:number}[];outcome:string}[];settings?:{animationSpeed:number;shake:boolean;flash:boolean;music:number;effects:number;graphicsQuality?:'auto'|'desktop'|'mobile'};favorites?:string[];actionPage?:number;actionCategory?:string;
 /** 0.36 遗物 / 事件 / 商店 */
 battleMods?:BattleMod[];layerMods?:LayerMods;runMods?:LayerMods;layerFights?:number;fpDebt?:number;bag?:Record<string,number>;bell?:number;strayGuaranteedOnce?:boolean;sealedSkills?:Record<string,string[]>;stepsSinceHeal?:number;skipNextFloorFights?:boolean;shopPage?:boolean;smoke?:boolean;
 /** 0.37.6 银十字：入场时主角背包里的暧昧的线；是否持有 / 本趟合成（需在宿主背包扣的线数）/ 本趟战斗召唤已用 / 探索中屏蔽「?」。 */
 /** 0.41：宿主 MVU 命运点数（开局快照）与本趟商店已从中扣除的累计额（写回按回执差额扣一次）。 */
 hostFp?:number;hostFpSpent?:number;learningBought?:boolean;shopRelics?:Record<string,string>;shopRelicSold?:string[];
 threadsHeld?:number;crossHeld?:boolean;crossCrafted?:{bagThreads:number};crossUsed?:boolean;crossWard?:boolean;
 /** 0.37.6 败退交接：最近一场战斗，以及每名成员倒下时的地点与对手。 */
 lastFight?:FightRecord;knockouts?:Knockout[];
 /** 「?」刚刷出：弹框未关闭前，玩家与她都不能移动，探索时钟不走。 */
 strayWarning?:boolean;
 /** 站在入口互动后弹出的返程确认。 */
 exitAsk?:boolean;
 /** 0.40 补给员对话：按补给员实例记录对话与本次遭遇已给额度；本趟杀害次数；对话能力由运行时按宿主是否有 LLM 设置。生成的遗物 / 道具定义随存档保存。 */
 /** 0.40 正文模式：缓存中的正文进度；宿主可用时由运行时置 narrativeReady；每段正文模式的起止层记入 narrativeSpans。 */
 narrative?:NarrativeState;narrativeReady?:boolean;narrativeSpans?:{from:number;to:number}[];
 supplierTalks?:Record<string,TalkSession>;supplierKills?:number;supplierTalkReady?:boolean;supplierSerial?:number;customRelics?:Record<string,RelicDef>;customItems?:Record<string,CustomItemSpec>;
 eventPick?:{kind:'relic'|'member'|'skills'|'confirm';mode:string;options:{id:string;label:string;description:string}[];max:number;selected:string[];owner?:string;payload?:Record<string,unknown>};};
const ref=(p:PartyMember):ActorRef=>p.ref??{kind:'partner',name:p.id};
export const activeParty=(s:State)=>s.party.filter(p=>s.run.participants.find(q=>actorKey(q.ref)===actorKey(ref(p)))?.status==='active');
/** 0.41 学习装置：佩戴者不上场（仍是在场成员，照常分经验）；若全员都佩戴则全员上场。 */
export const learning=(s:State,id:string)=>(s.ownedRelics??[]).some(o=>o.id===LEARNING_DEVICE.id&&o.owner===id);
export function fighters(s:State){const all=activeParty(s),out=all.filter(p=>!learning(s,p.id));return out.length?out:all;}
/** 0.41 商店可用 FP：待结算 FP + 宿主总 FP（仅宿主游玩）。 */
export function hostFpAvailable(s:State){return s.source==='host'?Math.max(0,(s.hostFp??0)-(s.hostFpSpent??0)):0;}
export function shopFp(s:State){return pendingFp(s.run,s.fpDebt)+hostFpAvailable(s);}
/** 扣款：先扣待结算 FP，不足部分再扣宿主总 FP；总额不足时不扣并返回 false。 */
export function spendFp(s:State,price:number):boolean{price=Math.max(0,Math.round(price));if(shopFp(s)<price)return false;const fromRun=Math.min(price,pendingFp(s.run,s.fpDebt));if(fromRun)adjustFp(s,-fromRun,'商店');const rest=price-fromRun;if(rest)s.hostFpSpent=(s.hostFpSpent??0)+rest;return true;}
function relicOwnerFor(s:State,id:string){return activeParty(s).find(p=>relicUnavailable(s,id,p.id)==='')?.id;}
/** 每位补给员带一件不同的随机遗物（打开商店时按种子生成一次，之后固定）。 */
function ensureShopRelic(s:State,thingId:string){s.shopRelics??={};if(s.shopRelics[thingId])return;const used=new Set([...Object.values(s.shopRelics),...(s.ownedRelics??[]).map(o=>o.id)]);let pool=RELIC_LIST.filter(r=>!used.has(r.id));if(!pool.length)pool=RELIC_LIST.filter(r=>!(s.ownedRelics??[]).some(o=>o.id===r.id));if(!pool.length)return;s.shopRelics[thingId]=pool[Math.floor(rng(s)*pool.length)]!.id;}
function shopRelicChoices(s:State,thingId:string){const id=s.shopRelics?.[thingId],def=id?RELIC_CATALOG[id]:undefined;if(!def)return [];const sold=s.shopRelicSold?.includes(thingId);return [{id:'buy:shop-relic',label:`随机遗物·${def.name}（${RELIC_RARITY_LABEL[def.rarity]}） ${shopRelicPrice(def,s.depth,relicHooks(s).shopDiscount)} FP · ${def.description}`+(sold?'（已售出）':'')}];}
function note(s:State,text:string){s.notice=text;s.history.push(text);if(s.history.length>80)s.history.shift();}
function rng(s:State){const r=roll(s.seed);s.seed=r.seed;return r.value;}
export function startExpedition(party:PartyMember[],seed:number,startDepth=1,unlocks=['depth-1']):State{
 if(!party.length||party.length>4)throw Error('请选择1–4名角色');if(startDepth!==1&&!unlocks.includes('anchor-'+startDepth))throw Error('入口尚未解锁');
 const region=makeRegion(startDepth,0,seed);
 const s:State={version:2,mechanicsVersion:2,regionSeed:seed,monsterContentVersion:MONSTER_CONTENT_VERSION,seed,relics:[],ownedRelics:[],bossPhases:[],mode:'explore',paused:false,depth:startDepth,visit:0,region,x:region.spawn.x,z:region.spawn.z,party:structuredClone(party),run:{id:'run-'+seed,status:'active',battleActive:false,participants:party.map(p=>({ref:ref(p),entryLevel:p.card.numeric.level,status:'active',battles:[],experience:0})),battleIds:[],defeatedIds:[],rewards:[],unlocks:[...unlocks],failureSignal:null},battle:null,encounterId:'',origin:{...region.spawn},selected:null,selectedTargets:[],potions:4,notice:'WASD 移动 · E 交互 / 菜单',history:[],steps:0,fights:0,eventJournal:{},flags:[],explorationMs:0,escapeMs:0,depthLog:{start:startDepth,maximum:startDepth,down:0,up:0,visits:1},encounters:[],settings:{animationSpeed:1,shake:true,flash:true,music:.7,effects:.8,graphicsQuality:'auto'},favorites:[],actionPage:0,actionCategory:'all'};ensureWorld(s);storeWorld(s);return s;
}
export function assertCurrentExpedition(value:State):void{
 if(value.version!==2||value.mechanicsVersion!==2||value.region?.layout?.version!==GENERATOR_VERSION)throw Error('开发版存档版本已更新，请新开随机地图远征；不迁移旧档。');
}
export type FoeRecord={id:string;name:string;level:number};
export type FightRecord={depth:number;region:string;theme:string;foes:FoeRecord[]};
export type Knockout={member:string;name:string;depth:number;region:string;theme:string;cause:'battle'|'event'|'exploration';foes:FoeRecord[];event?:string};
export const CROSS_KEY='booksea:silver-cross',CROSS_ALLY_ID='ally-stray',CROSS_THREADS=9;
/** 本趟可用的暧昧的线 = 本趟战利品里的 + 入场时背包里的。 */
export function threadsAvailable(s:State){return s.run.rewards.filter(r=>r.kind==='material'&&r.monsterId===STRAY_ID).reduce((n,r)=>n+r.count,0)+(s.threadsHeld??0);}
export function crossAllies(b:Battle){return b.units.filter(u=>u.side==='ally'&&!u.owner&&!u.escaped&&isAlive(u)).length;}
export function craftSilverCross(s:State){
 if(s.mode!=='explore'||s.crossHeld||threadsAvailable(s)<CROSS_THREADS)return;
 let left=CROSS_THREADS;const rewards:Run['rewards'][number][]=[];
 for(const r of s.run.rewards){if(left&&r.kind==='material'&&r.monsterId===STRAY_ID){const take=Math.min(r.count,left);left-=take;if(r.count>take)rewards.push({...r,count:r.count-take});continue;}rewards.push(r);}
 s.run={...s.run,rewards};s.threadsHeld=(s.threadsHeld??0)-left;s.crossCrafted={bagThreads:(s.crossCrafted?.bagThreads??0)+left};s.crossHeld=true;note(s,'得到了「银十字」。');
}
export function toggleCrossWard(s:State){
 if(s.mode!=='explore'||!s.crossHeld)return;s.crossWard=!s.crossWard;
 if(s.crossWard){s.region.things=s.region.things.filter(t=>!t.hunter||t.used);s.strayWarning=false;}
 note(s,s.crossWard?'银十字微微发亮。':'银十字的光暗了下去。');
}
function crossAction():ActionSpec{return {target:'self',cost:{hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}},castMs:0,recoveryFactor:1,perBattleUses:0,effects:[{op:'modify',name:'银十字',duration:{clock:'round',value:1},modifiers:[{stat:'evade',flat:0}]}],category:'item',name:'银十字',description:'队伍不足四人时，「?」会前来助战。每趟迷宫一次。',targeting:{side:'self',selection:'all',count:1,life:'alive'},copyable:false,source:{id:CROSS_KEY,kind:'item'}} as ActionSpec;}
function offerCross(s:State){const b=s.battle;if(!b||!s.crossHeld||s.crossUsed)return;for(const u of b.units)if(u.side==='ally'&&!u.owner&&u.id!==CROSS_ALLY_ID){u.actions[CROSS_KEY]=crossAction();u.sources={...u.sources,[CROSS_KEY]:{kind:'item',tags:[],priority:0}} as never;}}
function withdrawCross(b:Battle){for(const u of b.units)delete u.actions[CROSS_KEY];}
/** 银十字：「?」以队伍最高等级 +1 的面板加入我方，携带她的本质，复制队伍里持有百分比 / 真实伤害技能者的技能。 */
function summonCrossAlly(s:State){
 const b=s.battle!,party=activeParty(s),level=Math.max(...party.map(p=>p.card.numeric.level))+1,kit=strayKit(level,party.map(p=>cardFor(s,p)));
 s.battle=joinBattle(b,{id:CROSS_ALLY_ID,name:STRAY_NAME,side:'ally',card:kit.card,combatLevel:level,current:{...kit.card.numeric.max},mitigation:kit.mitigation});
 s.crossUsed=true;withdrawCross(s.battle);note(s,'「?」来了。');
}
function recordKnockouts(s:State,members:PartyMember[],cause:Knockout['cause']){
 if(!members.length)return;const fight=s.lastFight,here={depth:s.depth,region:s.region.name,theme:THEMES[s.region.theme]!.name};
 for(const p of members)(s.knockouts??=[]).push(cause==='battle'&&fight?{member:p.id,name:p.name,...fight,cause}:{member:p.id,name:p.name,...here,cause,foes:fight?.foes??[],...(cause==='event'&&s.eventDefinition?{event:s.eventDefinition.title}:{})});
}
export function restoreExpedition(value:State):State{assertCurrentExpedition(value);const s=structuredClone(value);s.paused=s.mode!=='ended';registerSupplierContent(s);for(const t of Object.values(s.supplierTalks??{}))t.pending=false;repairBattleState(s);return s;}
/** 0.40：补给员生成的遗物 / 道具定义保存在存档里；载入或成交后注册到遗物目录与药剂表（幂等）。 */
export function registerSupplierContent(s:Pick<State,'customRelics'|'customItems'>){
 for(const [id,def] of Object.entries(s.customRelics??{}))RELIC_CATALOG[id]=def;
 for(const [id,spec] of Object.entries(s.customItems??{}))POTION_BY_ID[id]={id,name:spec.name,description:spec.description,price:0,build:mul=>buildCustomItem(spec,mul)};
}
function cardFor(s:State,p:PartyMember){const card=structuredClone(p.card);
 const owned=s.ownedRelics??(s.relics??[]).map(id=>({id,owner:'team',stacks:1}));
 // 0.36：被封印的技能（封印契约）从卡上移除，并按封印数给全属性 +10%。
 const sealed=s.sealedSkills?.[p.id]??[];if(sealed.length){card.skills=card.skills.filter(k=>!sealed.includes(k.sourceId));card.skills.push({sourceId:'seal-bonus',name:'封印契约',sourceFingerprint:'authored',mapping:{sourceId:'seal-bonus',disposition:'passive',reason:'封印 '+sealed.length+' 个技能',action:passiveAction([{op:'modify',name:'封印契约',duration:{clock:'permanent',value:0},modifiers:(['力量','敏捷','体质','智力','精神'] as const).map(stat=>({stat,multiplier:1+.1*sealed.length}))}])}});}
 // 0.39：迷宫内共享背包——仍在迷宫中的同行成员携带的道具，全队任何人都能使用；数量共用，消耗照旧记在携带者名下。
 {const have=new Set(card.skills.map(k=>k.sourceId));for(const q of activeParty(s)){if(q.id===p.id)continue;for(const k of q.card.skills)if((s.inventory?.[k.sourceId]||/^item-\d+-\d+$/.test(k.sourceId))&&!have.has(k.sourceId)){have.add(k.sourceId);card.skills.push(structuredClone(k));}}}
 // 0.36：商店药剂对全队可用（指令类物品）；R23 铁胃倍率。
 const potionMul=relicHooks(s).potionMul;for(const [id,count] of Object.entries(s.bag??{})){const potion=POTION_BY_ID[id];if(!potion||count<=0)continue;card.skills.push({sourceId:POTION_KEY+id,name:potion.name,sourceFingerprint:'authored',mapping:{sourceId:POTION_KEY+id,disposition:'active',reason:potion.description,action:potion.build(potionMul)}});}
 for(const relic of owned){const definition=RELIC_CATALOG[relic.id],legacy=RELICS[relic.id];let ability:ActionSpec;
  if(definition){if(!definition.passive)continue;if(definition.scope==='holder'&&relic.owner!==p.id)continue;if(definition.scope==='field'&&(s.ownedRelics??[]).find(o=>o.id===relic.id)!==relic)continue;if(definition.scope==='field'&&relic.owner!==p.id&&activeParty(s).some(q=>q.id===relic.owner))continue;ability=structuredClone(definition.passive);}
  else if(relic.owner!=='team'&&relic.owner!==p.id)continue;
  else if(legacy){ability=passiveAction(structuredClone(legacy.effects));if(legacy.mpCost)ability.effects.push({op:'modify',name:'旧遗物费用',duration:{clock:'permanent',value:0},modifiers:[{stat:'cost_mp',multiplier:legacy.mpCost}]});if(legacy.victory){ability.library={actions:{repair:action([{op:'heal',resource:'hp',amount:{flat:legacy.victory.hp,attribute:'none',factor:0,scale:'flat',maxResource:'none',maxFraction:0}},{op:'heal',resource:'mp',amount:{flat:legacy.victory.mp,attribute:'none',factor:0,scale:'flat',maxResource:'none',maxFraction:0}}])},statuses:{},summons:{},fields:{}};ability.triggers=[{id:'victory',event:'battle_end',scope:'self',action:'repair'}];}}
  else throw Error('存档遗物定义不存在: '+relic.id);
  for(let i=0;i<relic.stacks;i++)card.skills.push({sourceId:'relic/'+relic.id+'/'+i,name:definition?.name??legacy!.name,sourceFingerprint:'authored',mapping:{sourceId:'relic/'+relic.id+'/'+i,disposition:'passive',reason:definition?.description??legacy!.description,action:ability}});
 }
 return card;
}
function ensureWorld(s:State){if(s.world)return s.world;s.world=createBattle(activeParty(s).map(p=>({id:p.id,name:p.name,side:'ally' as const,card:cardFor(s,p),current:p.current,mitigation:hostMitigation(p.card),persistent:p.persistent})),s.seed,{exploration:true});return s.world;}
function storeWorld(s:State){if(!s.world)return;for(const p of activeParty(s)){const u=s.world.units.find(u=>u.id===p.id);if(u){p.current={...u.current};p.persistent=persistentUnit(u,s.world.clock.timeMs);}}s.seed=s.world.seed;}
function rebuildWorld(s:State){storeWorld(s);s.world=undefined;ensureWorld(s);storeWorld(s);}
function clearTemporary(s:State,p:PartyMember){p.persistent=undefined;p.current={...p.card.numeric.max};if(s.world){const fields=(s.world.fields??[]).filter(f=>f.owner===p.id).map(f=>f.id);s.world.fields=s.world.fields?.filter(f=>f.owner!==p.id);s.world.scheduled=s.world.scheduled?.filter(t=>t.owner!==p.id);for(const u of s.world.units)u.statuses=u.statuses?.filter(x=>!fields.includes(x.sourceKey)&&!(x.source===p.id&&(x.libraryOwner??x.source)===p.id&&x.sourceKey.startsWith('passive:')));s.world.units=s.world.units.filter(u=>u.id!==p.id&&u.owner!==p.id);s.world.clock.units=s.world.clock.units.filter(u=>u.id!==p.id);}}
function finish(s:State){s.mode='ended';s.battle=null;s.world=undefined;s.selected=null;s.eventState=undefined;s.ownedRelics=[];s.relics=[];for(const p of s.party)clearTemporary(s,p);note(s,s.run.status==='success'?'远征归来，正在收好这页。':s.run.keepOnDefeat?'本趟败退，「死亡不掉落」保住了途中收获。':'本趟失败，失去了途中收获。');}
export function withdraw(s:State,ids?:string[]){if(s.mode!=='explore'||s.paused)return;storeWorld(s);const leaving=activeParty(s).filter(p=>!ids||ids.includes(p.id));if(!leaving.length)return;s.run=exitMembers(s.run,leaving.map(p=>({ref:ref(p),reason:'voluntaryExit'})));for(const p of leaving)clearTemporary(s,p);if(s.run.status!=='active')finish(s);else note(s,'所选成员已返回书间。');}
function mayExit(u:Unit){return isAlive({...u,escaped:false});}
function exitTeleported(s:State){const b=s.battle??s.world;if(!b)return;const leaving=activeParty(s).filter(p=>{const u=b.units.find(u=>u.id===p.id);return !!u?.retreatRequested&&mayExit(u);});if(!leaving.length)return;const down=activeParty(s).filter(p=>{const u=b.units.find(u=>u.id===p.id);return !!u&&!mayExit(u);}),inBattle=s.run.battleActive;recordKnockouts(s,down,s.battle?'battle':'exploration');s.run=exitMembers({...s.run,battleActive:false},[...down.map(p=>({ref:ref(p),reason:'downedExit' as const})),...leaving.map(p=>({ref:ref(p),reason:'voluntaryExit' as const}))]);s.run.battleActive=s.run.status==='active'&&inBattle;for(const p of [...down,...leaving])clearTemporary(s,p);if(s.run.status!=='active')finish(s);else note(s,'成功离开战场。');}
function exitDown(s:State,cause:Knockout['cause']='exploration'){const down=activeParty(s).filter(p=>{const u=(s.battle??s.world)?.units.find(u=>u.id===p.id);return u?!isAlive(u):!isAlive({current:p.current,...p.persistent} as Unit);});if(down.length){recordKnockouts(s,down,cause);s.run.battleActive=false;s.run=exitMembers(s.run,down.map(p=>({ref:ref(p),reason:'downedExit'})));for(const p of down)clearTemporary(s,p);}if(s.run.status!=='active')finish(s);}
export function enemyLevel(depth:number){return depth<=50?Math.max(1,Math.ceil(depth/2)):25+Math.ceil((depth-50)/2);}
/** 0.26: blind boxes only come from chests and mimics (quality = mimic level). Ordinary fights keep the old 10% roll and Boss fights the old 100%,
 * but now drop one defeated monster's own material (picked from the battle seed so the expedition RNG stream is unchanged); Boss material is one quality above the floor, capped at 神话. Mythic mimics add a 9% 价值的结晶. */
export function battleDrops(s:State,thing:Thing,b:Battle,boss:boolean){
 const theme=THEMES[s.region.theme]!.name,region=s.region.name,level=enemyLevel(s.depth);
 if(thing.hunter){const her=b.units.find(u=>u.id==='enemy-0')!,lv=her?.level??level;
  s.run=addReward(s.run,{kind:'box',quality:bumpQuality(levelQuality(lv),relicHooks(s).boxQualityUp),style:theme,contentType:'消耗品',count:1+relicHooks(s).strayBonusBox,source:region+'·?'});
  if(roll(((b.seed>>>0)^0x27d4eb2f)>>>0).value<STRAY_THREAD_CHANCE)s.run=addReward(s.run,{kind:'material',name:STRAY_THREAD.name,quality:STRAY_THREAD.quality,theme,region,effect:STRAY_THREAD.effect,description:STRAY_THREAD.description,monsterId:STRAY_ID,count:1,source:region+'·?'});
  return;}
 if(thing.kind==='mimic'){const ml=mimicLevel(level);
  s.run=addReward(s.run,{kind:'box',quality:levelQuality(ml),style:theme,contentType:'消耗品',count:1,source:region+'宝箱怪'});
  if(isMythicLevel(ml)&&roll(((b.seed>>>0)^0x9e3779b9)>>>0).value<VALUE_CRYSTAL_CHANCE)s.run=addReward(s.run,{kind:'material',name:VALUE_CRYSTAL.name,quality:VALUE_CRYSTAL.quality,theme,region,effect:VALUE_CRYSTAL.effect,description:`于${theme}·${region}击败神话级宝箱怪后获得。`,monsterId:MIMIC_ID,count:1,source:region+'宝箱怪'});
  return;}
 // 0.36：素材掉率 = 基础 × 采集者之袋 × 事件倍率 × 门票撕角层内累计 × 兽笼（精英战）；本层禁掉 / 首战不掉直接返回。
 const hooks=relicHooks(s);if(s.layerMods?.noMaterials)return;if(hooks.firstFightNoDrop&&(s.layerFights??0)===0)return;
 const elite=thing.foes.some(id=>FOES[id]?.role==='精英');const eventRate=(s.battleMods??[]).filter(m=>m.fights>0&&m.materialRate!==undefined).reduce((n,m)=>n*m.materialRate!,1);
 const rate=hooks.materialRate*eventRate*(1+hooks.layerMaterialRamp*Math.max(0,(s.layerFights??0)-1))*(elite?hooks.eliteMaterialRate:1);
 if(!boss&&!(rng(s)<Math.min(1,MATERIAL_DROP_CHANCE*rate)))return;if(rate<=0)return;
 const defeated=b.units.filter(u=>u.side==='enemy'&&!u.owner&&!u.escaped&&u.defeated&&!isAlive(u)).map(u=>/^enemy-(\d+)$/.exec(u.id)).map(m=>m?thing.foes[Number(m[1])]:undefined).filter((id):id is string=>!!id&&!!FOES[id]&&id!==MIMIC_ID);
 const pool=boss?thing.foes.filter(id=>FOES[id]?.role==='Boss'):defeated;if(!pool.length)return;
 const id=pool[Math.floor(roll(((b.seed>>>0)^0x85ebca6b)>>>0).value*pool.length)]!,entry=materialFor(id);
 s.run=addReward(s.run,{kind:'material',name:entry.name,quality:levelQuality(level,FOES[id]!.role==='Boss'),theme,region,effect:materialEffect(entry.name,theme,region),description:entry.description,monsterId:id,count:1,source:region+'战斗'});
}
/** 开战：建立战斗失败时整体回滚，绝不留下“战斗模式但没有战斗”的坏档；开场效果已清场时直接结算胜利。 */
function enterBattle(s:State,thing:Thing){
 const before=structuredClone(s);
 try{
  openBattle(s,thing);
  if(s.mode==='battle'&&s.battle&&s.battle.outcome!=='active')endBattle(s);
 }catch(e){
  console.error('Booksea battle setup failed',e);
  for(const k of Object.keys(s))delete (s as Record<string,unknown>)[k];Object.assign(s,before);
  s.escapeMs=Math.max(s.escapeMs??0,6000);recoverFailedEncounter(s,thing.id);
 }
}
/** 0.41.1：建立失败后先“刷新”这只怪（清掉残留血量与追击状态、换一个随机种子），下次碰到重新建立；连续两次失败：守关敌群视为已突破（无奖励，楼梯放行），普通敌群移除。 */
function recoverFailedEncounter(s:State,id:string){
 const t=s.region.things.find(x=>x.id===id);
 if(typeof s.seed==='number')s.seed=(s.seed+0x9e3779b9)>>>0;
 if(!t){note(s,'这场遭遇未能展开，已退回原地。');return;}
 t.setupFails=(t.setupFails??0)+1;delete t.foeResources;
 if(t.ai){t.ai.mode='return';t.ai.lostMs=0;}
 if(t.setupFails<2){note(s,'这场遭遇未能展开，已退回原地；对手已重整，可以再次挑战。');return;}
 const guard=t.kind==='enemy'&&t.foes.some(f=>FOES[f]?.role==='Boss');
 t.used=true;
 note(s,guard?'守关敌群的遭遇反复无法展开，已视为突破（无奖励），可以前往楼梯。':'这群敌人的遭遇反复无法展开，已从地图上消失。');
}
/** 旧版本可能留下 mode==='battle' 却没有战斗数据的存档（开场即清场时建立战斗中途出错）：退回遭遇前的位置继续探索。 */
function repairBattleState(s:State){
 if(s.mode!=='battle'||s.battle)return;
 s.mode='explore';s.run.battleActive=false;s.selected=null;s.selectedTargets=[];s.bossPhases=[];
 if(s.origin){s.x=s.origin.x;s.z=s.origin.z;}
 s.escapeMs=Math.max(s.escapeMs??0,6000);note(s,'上次战斗没有正常建立，已退回遭遇前的位置。');
}
function openBattle(s:State,thing:Thing){
 storeWorld(s);s.world=undefined;s.encounterId=thing.id;s.origin={x:s.x,z:s.z};s.mode='battle';s.run.battleActive=true;s.selected=null;s.selectedTargets=[];s.bossPhases=[];
 const allies=fighters(s).map(p=>({id:p.id,name:p.name,side:'ally' as const,card:cardFor(s,p),current:p.current,mitigation:hostMitigation(p.card),persistent:p.persistent}));
  const strayLevel=Math.max(...fighters(s).map(p=>p.card.numeric.level))+1;
  const enemies=thing.foes.map((id,i)=>{const kit=id===MIMIC_ID?mimicKit(mimicLevel(enemyLevel(s.depth))):id===STRAY_ID?strayKit(strayLevel,activeParty(s).map(p=>cardFor(s,p))):monsterKit(id,enemyLevel(s.depth));
   return {id:'enemy-'+i,name:kit.name,side:'enemy' as const,card:kit.card,combatLevel:id===STRAY_ID?strayLevel:kit.numbers.displayLevel,current:thing.foeResources?.['enemy-'+i]??{...kit.card.numeric.max},mitigation:kit.mitigation};});
 // 0.36：镜厅（敌方数量 ×2）
 const mods=(s.battleMods??[]).filter(m=>m.fights>0);
 if(mods.some(m=>m.enemyDouble))for(const e of [...enemies])enemies.push({...structuredClone(e),id:'enemy-'+enemies.length});
 s.smoke=false;s.battle=createBattle([...allies,...enemies],s.seed);note(s,'遭遇 '+thing.foes.map(id=>FOES[id]!.name).join('、')+'。');
 s.lastFight={depth:s.depth,region:s.region.name,theme:THEMES[s.region.theme]!.name,foes:enemies.map((e,i)=>({id:thing.foes[i%thing.foes.length]!,name:e.name,level:e.combatLevel}))};
 applyBattleOpeners(s,mods);offerCross(s);
}
/** 0.36 开战修正：奇偶天平、事件“下 N 场”修正、本层敌人全属性。 */
function applyBattleOpeners(s:State,mods:BattleMod[]){
 const b=s.battle!,forever={clock:'permanent' as const,value:0},allyIds=b.units.filter(u=>u.side==='ally').map(u=>u.id),enemyIds=b.units.filter(u=>u.side==='enemy').map(u=>u.id);
 const attrs=(m:number)=>(['力量','敏捷','体质','智力','精神'] as const).map(stat=>({stat,multiplier:m}));
 const cast=(name:string,modifiers:{stat:string;multiplier?:number;flat?:number}[],ids:string[])=>{if(!ids.length)return;s.battle=applyBattleEffects(s.battle!,ids[0]!,action([{op:'modify',name,duration:forever,modifiers:modifiers as never,targeting:{side:'any',selection:'all',life:'alive',ids}}],'self'),ids,'effect','opener:'+name);};
 if(relicHooks(s).layerParity){const odd=((s.layerFights??0)+1)%2===1;cast(odd?'奇偶天平·奇':'奇偶天平·偶',attrs(odd?1.3:.7),allyIds);}
 const enemyAttrs=s.layerMods?.enemyAttrs;if(enemyAttrs)cast('沉睡的守卫',attrs(enemyAttrs),enemyIds);
 for(const m of mods){if(m.enemyDamage)cast('高压训练',(['damage_physical','damage_energy','damage_mental','damage_true'] as const).map(stat=>({stat,multiplier:m.enemyDamage!})),enemyIds);if(m.member&&m.memberDamage)cast('训练假人',[...(['damage_physical','damage_energy','damage_mental','damage_true'] as const).map(stat=>({stat,multiplier:m.memberDamage!})),{stat:'speed',multiplier:m.memberSpeed??1}],allyIds.filter(id=>id===m.member));}
}
export function move(s:State,dx:number,dz:number){if(s.mode!=='explore'||s.paused||s.strayWarning||s.exitAsk||Math.abs(dx)+Math.abs(dz)!==1)return;const x=s.x+dx,z=s.z+dz;if(!walkable(s.region,x,z))return;const enemy=s.region.things.find(t=>t.kind==='enemy'&&!t.used&&t.x===x&&t.z===z);if(enemy&&(s.escapeMs??0)<=0){enterBattle(s,enemy);return;}s.x=x;s.z=z;s.steps++;const adjacent=s.region.things.find(t=>!t.used&&t.kind!=='enemy'&&near(s,t));if(adjacent)s.notice='E / 交互：'+adjacent.name;
 const heal=relicHooks(s).stepsHeal;if(heal.steps>0){s.stepsSinceHeal=(s.stepsSinceHeal??0)+1;if(s.stepsSinceHeal>=heal.steps){s.stepsSinceHeal=0;const b=ensureWorld(s);for(const u of b.units)if(u.side==='ally'&&isAlive(u))u.current.hp=Math.min(u.max.hp,u.current.hp+Math.round(u.max.hp*heal.fraction));storeWorld(s);}}}
/** 网格最短路径距离表（四邻域 BFS，只走可行走格）。 */
function distanceMap(r:Region,sx:number,sz:number){const dist=new Map<string,number>();const queue:[number,number][]=[[sx,sz]];dist.set(sx+','+sz,0);while(queue.length){const [x,z]=queue.shift()!;const d=dist.get(x+','+z)!;for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]] as const){const nx=x+dx,nz=z+dz,k=nx+','+nz;if(!walkable(r,nx,nz)||dist.has(k))continue;dist.set(k,d+1);queue.push([nx,nz]);}}return dist;}
/** 「?」：出现在玩家最短路径 18 格外（没有恰好 18 格的位置时取最接近且不少于 18 的格；再没有则取最远格）。 */
export function spawnStray(s:State){const dist=distanceMap(s.region,s.x,s.z);const cells=[...dist.entries()].filter(([k])=>!s.region.things.some(t=>!t.used&&t.x+','+t.z===k));if(!cells.length)return;const want=Math.max(STRAY_SPAWN_DISTANCE,relicHooks(s).strayDistance);const exact=cells.filter(([,d])=>d===want),far=cells.filter(([,d])=>d>=want).sort((a,b)=>a[1]-b[1]);const pool=exact.length?exact:far.length?far.filter(([,d])=>d===far[0]![1]):[cells.sort((a,b)=>b[1]-a[1])[0]!];const [key]=pool[Math.floor(rng(s)*pool.length)]!;const [x,z]=key.split(',').map(Number) as [number,number];s.region.things.push({id:s.region.id+'-stray',kind:'enemy',x,z,name:STRAY_NAME,used:false,foes:[STRAY_ID],hunter:true});s.strayWarning=true;note(s,'有什么在接近…');}
/** 关闭「有什么在接近…」弹框：之后双方才开始移动。 */
export function dismissWarning(s:State){s.strayWarning=false;}
/** 入口返程确认：yes 全员返程，否则继续探索。 */
export function answerExit(s:State,yes:boolean){if(!s.exitAsk)return;s.exitAsk=false;if(yes)withdraw(s);}
/** 「?」沿最短路径追一步；追上即开战。由 tickExploration 按 STRAY_STEP_MS 定时驱动，与玩家是否移动无关。 */
export function strayStep(s:State){const t=s.region.things.find(t=>t.hunter&&!t.used);if(!t||s.mode!=='explore')return;const dist=distanceMap(s.region,s.x,s.z);const here=dist.get(t.x+','+t.z);if(here===undefined)return;let best:[number,number]|null=null,bestD=here;for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]] as const){const nx=t.x+dx,nz=t.z+dz,d=dist.get(nx+','+nz);if(d===undefined||d>=bestD)continue;if(s.region.things.some(o=>o!==t&&!o.used&&['enemy','chest','mimic'].includes(o.kind)&&o.x===nx&&o.z===nz))continue;bestD=d;best=[nx,nz];}if(best){t.x=best[0];t.z=best[1];}if(t.x===s.x&&t.z===s.z)enterBattle(s,t);}
function regionOptions(s:State):RegionOptions{const h=relicHooks(s);return {chestRate:h.chestRate,chestForce:h.chestForce,groupEnemies:h.groupEnemies,extraGroups:h.extraGroups,eliteBoost:h.eliteBoost,supplierForced:h.supplierForced};}
function newDepth(s:State,depth:number){storeWorld(s);s.depthLog??={start:1,maximum:s.depth,up:0,down:0,visits:s.visit+1};const descending=depth>s.depth;if(descending)s.depthLog.down++;else s.depthLog.up++;s.depth=depth;s.visit++;s.depthLog.maximum=Math.max(s.depthLog.maximum,depth);s.depthLog.visits++;s.region=makeRegion(depth,s.visit,s.regionSeed??s.seed,regionOptions(s));s.x=s.region.spawn.x;s.z=s.region.spawn.z;
 const h=relicHooks(s);s.layerFights=0;s.layerMods={};if(descending&&h.fpPerDescend)adjustFp(s,h.fpPerDescend,'遗物：每下一层');if(h.potionsPerLayer)s.potions+=h.potionsPerLayer;
 if(s.skipNextFloorFights){s.skipNextFloorFights=false;for(const t of s.region.things)if(t.kind==='enemy'&&!t.foes.some(id=>FOES[id]?.role==='Boss'))t.used=true;note(s,'逃票：这一层的敌人没注意到你们。');}
 const chance=s.strayGuaranteedOnce?1:Math.max(STRAY_SPAWN_CHANCE,h.straySpawn);if(strayFloor(depth)&&!s.crossWard){const rolled=rng(s)<chance;if(s.strayGuaranteedOnce)s.strayGuaranteedOnce=false;if(rolled)spawnStray(s);}if(!s.run.unlocks.includes('depth-'+depth))s.run.unlocks.push('depth-'+depth);if(depth%5===0&&!s.run.unlocks.includes('anchor-'+depth))s.run.unlocks.push('anchor-'+depth);for(const p of activeParty(s))s.world=dispatchBattleEvent(ensureWorld(s),'new_region',p.id);storeWorld(s);note(s,`抵达${THEMES[s.region.theme]!.name} · 第${depth}层。`);}
function chooseEvent(s:State):string{const pool=Object.values(EVENT_CATALOG).filter(e=>(e.theme===s.region.theme||e.theme==='common')&&e.requirements.every(r=>requirement(s,r)));return pool[Math.floor(rng(s)*pool.length)]!.id;}
export function interact(s:State){if(s.mode!=='explore'||s.paused||s.strayWarning||s.exitAsk)return;const t=s.region.things.filter(t=>!t.used&&t.kind!=='enemy'&&near(s,t)).sort((a,b)=>(Math.abs(s.x-a.x)+Math.abs(s.z-a.z))-(Math.abs(s.x-b.x)+Math.abs(s.z-b.z)))[0];if(!t){s.paused=true;s.notice='';return;}
 if(t.kind==='exit'){s.exitAsk=true;return;}
 if(t.kind==='stairs'){if(s.region.things.some(x=>x.kind==='enemy'&&!x.used&&x.foes.some(id=>FOES[id]!.role==='Boss'))){note(s,'先处理守关敌群。');return;}const need=relicHooks(s).fightsToDescend;if(need&&(s.layerFights??0)<need){note(s,`寻宝罗盘：本层还需打过 ${need-(s.layerFights??0)} 场战斗才能下行。`);return;}newDepth(s,s.depth+1);return;}
 if(t.kind==='mimic'){enterBattle(s,t);note(s,'宝箱张开了利齿！');return;}
 if(t.kind==='chest'){t.used=true;const quality=bumpQuality(['普通','优良','稀有'][Math.floor(rng(s)*3)]!,relicHooks(s).boxQualityUp);s.run=addReward(s.run,{kind:'box',quality,style:THEMES[s.region.theme]!.name,contentType:['消耗品','材料','技能','资产'][Math.floor(rng(s)*4)]!,count:1,source:`深度${s.depth} ${s.region.name}宝箱`});for(const p of activeParty(s)){s.world=dispatchBattleEvent(ensureWorld(s),'open_chest',p.id);s.world=dispatchBattleEvent(s.world,'pickup',p.id);}storeWorld(s);note(s,'获得一个密封盲盒。');}
 if(t.kind==='camp'){t.used=true;const b=ensureWorld(s);for(const u of b.units)if(u.side==='ally'){u.current={...u.max};u.statuses=u.statuses?.filter(x=>x.definition.polarity!=='negative'||x.definition.scope==='run'&&x.definition.tags.includes('relic'));}storeWorld(s);s.notice='';}
 if(t.kind==='supplier'){s.supplierState={thingId:t.id};s.shopPage=false;s.mode='supplier';s.notice='';return;}
 if(t.kind==='event'&&t.customEvent){s.eventDefinition=structuredClone(t.customEvent);ensureWorld(s);s.eventState={id:t.customEvent.id,thingId:t.id,offers:[],results:[],owner:activeParty(s)[0]!.id,choice:''};s.mode='event';note(s,t.customEvent.title);return;}
 if(t.kind==='event'){delete s.eventDefinition;ensureWorld(s);s.eventState={id:chooseEvent(s),thingId:t.id,offers:[],results:[],owner:activeParty(s)[0]!.id,choice:''};s.mode='event';note(s,EVENT_CATALOG[s.eventState.id]!.title);}
}
/** Resolve the offer only; the resulting book/bench requires a fresh interaction. */
/** 0.37.2 补给员：事件 / 长椅（原地留下长椅；互动一次全队完全恢复，长椅随即消失）/ 商店（药剂，战斗可用）/ 杀害。商店页内 buy:<id> 购买、back 返回。 */
export function supplierChoice(s:State,choice:string){
 if(s.mode!=='supplier'||s.paused||!s.supplierState)return;
 const t=s.region.things.find(t=>t.id===s.supplierState!.thingId&&t.kind==='supplier'&&!t.used&&near(s,t));
 if(!t)return;
 if(choice==='shop'){s.shopPage=true;ensureShopRelic(s,t.id);return;}
 if(choice==='talk'){if(!s.supplierTalkReady){note(s,'这里联系不上她的意识（需要在酒馆里游玩）。');return;}const talk=supplierTalkSession(s,t.id);if(!talk.log.length)talk.log.push({role:'supplier',text:'嗯？想聊什么。'});s.supplierState.talk=true;return;}
 if(choice==='back'){s.shopPage=false;return;}
 if(choice==='buy:'+INSURANCE.id){if(s.run.keepOnDefeat){note(s,'本趟已经买过「死亡不掉落」。');return;}if(!spendFp(s,INSURANCE.price)){note(s,'FP 不足。');return;}s.run.keepOnDefeat=true;note(s,`买下「${INSURANCE.name}」（−${INSURANCE.price} FP）：本趟即使全灭，也会带着全部所得离场。`);return;}
 if(choice==='buy:'+LEARNING_DEVICE.id){if(s.learningBought){note(s,'「学习装置」每趟限购一次。');return;}const owner=relicOwnerFor(s,LEARNING_DEVICE.id);if(!owner){note(s,'没有成员能装下「学习装置」（遗物槽已满）。');return;}if(!spendFp(s,LEARNING_DEVICE_PRICE)){note(s,'FP 不足。');return;}s.learningBought=true;acquireRelic(s,LEARNING_DEVICE.id,owner);note(s,`买下「${LEARNING_DEVICE.name}」（−${LEARNING_DEVICE_PRICE} FP），交给 ${s.party.find(p=>p.id===owner)?.name??owner}；可在遗物页转移。`);return;}
 if(choice==='buy:shop-relic'){const id=s.shopRelics?.[t.id],def=id?RELIC_CATALOG[id]:undefined;if(!id||!def)return;if(s.shopRelicSold?.includes(t.id)){note(s,'这件遗物已经卖出去了。');return;}const owner=relicOwnerFor(s,id);if(!owner){note(s,`没有成员能装下「${def.name}」（遗物槽已满或已持有同名）。`);return;}const price=shopRelicPrice(def,s.depth,relicHooks(s).shopDiscount);if(!spendFp(s,price)){note(s,'FP 不足。');return;}(s.shopRelicSold??=[]).push(t.id);acquireRelic(s,id,owner);note(s,`买下「${def.name}」（−${price} FP），交给 ${s.party.find(p=>p.id===owner)?.name??owner}；可在遗物页转移。`);return;}
 if(choice.startsWith('buy:')){const potion=POTION_BY_ID[choice.slice(4)];if(!potion)return;const price=potionPrice(potion,s.depth,relicHooks(s).shopDiscount);if(!spendFp(s,price)){note(s,'FP 不足。');return;}s.bag??={};s.bag[potion.id]=(s.bag[potion.id]??0)+1;rebuildWorld(s);note(s,`买下 ${potion.name}（−${price} FP）。`);return;}
 if(!SUPPLIER_CHOICES.some(c=>c.id===choice))return;
 if(choice==='kill'){s.supplierKills=(s.supplierKills??0)+1;if(s.supplierTalks?.[t.id])s.supplierTalks[t.id]!.pending=false;t.used=true;t.kind='camp';t.name='血迹';const spot=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dz])=>({x:t.x+dx!,z:t.z+dz!})).find(p=>walkable(s.region,p.x,p.z)&&!s.region.things.some(o=>!o.used&&o.x===p.x&&o.z===p.z))??{x:t.x,z:t.z};const mimic=rng(s)<.5;s.region.things.push({id:t.id+':loot',kind:mimic?'mimic':'chest',x:spot.x,z:spot.z,name:'封存的宝匣',used:false,foes:mimic?[MIMIC_ID]:[]});s.strayGuaranteedOnce=true;delete s.supplierState;s.mode='explore';s.notice='';return;}
 if(choice==='bench'){t.kind='camp';t.name='长椅';t.used=false;delete s.supplierState;s.mode='explore';s.notice='';return;}
 t.kind='event';t.name=THEMES[s.region.theme]!.name+'·遗留事件';
 delete s.supplierState;s.mode='explore';
 s.notice='';
}
export function closeSupplier(s:State){
 if(s.mode!=='supplier'||s.paused)return;
 const talk=s.supplierTalks?.[s.supplierState?.thingId??''];if(talk)talk.pending=false;
 delete s.supplierState;s.mode='explore';s.notice='';
}
/* ---- 0.40 正文模式：迷宫进度缓存在存档里，正文按层推进；切回迷宫时沿用缓存的队伍状态、层数用正文推进到的层数 ---- */
export type NarrativeState={active:boolean;startDepth:number;depth:number;since:number};
export type NarrativeFloor={depth:number;theme:string;themeName:string;subtitle:string;scene:string;sceneIndex:number;level:number;quality:string;bossFloor:boolean;monsters:{name:string;role:string;level:number}[]};
/** 任意层的主题 / 场景 / 敌怪等级 / 战利品品质 / 本主题敌怪（与正式地图同一主题序列，不生成地图）。 */
export function narrativeFloor(depth:number,seed:number):NarrativeFloor{
 const theme=themeFor(depth,seed),sceneIndex=(depth-1)%3,info=THEMES[theme]!,level=enemyLevel(depth);
 const ids=[...[1,2,3,4,5].map(n=>`${theme}_N0${n}`),...[1,2,3].map(n=>`${theme}_E0${n}`),`${theme}_B01`].filter(id=>FOES[id]);
 return {depth,theme,themeName:info.name,subtitle:info.subtitle,scene:info.scenes[sceneIndex]??'',sceneIndex,level,quality:levelQuality(level),bossFloor:sceneIndex===2,
  monsters:ids.map(id=>({name:FOES[id]!.name,role:FOES[id]!.role,level:FOES[id]!.role==='Boss'?level+1:level}))};
}
export function canStartNarrative(s:State){return s.mode==='explore'&&s.run.status==='active'&&!s.strayWarning&&!s.exitAsk&&!s.narrative?.active&&activeParty(s).length>0;}
export function startNarrative(s:State):boolean{if(!canStartNarrative(s))return false;storeWorld(s);s.narrative={active:true,startDepth:s.depth,depth:s.depth,since:Date.now()};s.paused=true;note(s,'切换到正文模式：迷宫进度已缓存。');return true;}
export function narrativeDescend(s:State):number{if(!s.narrative?.active)throw Error('当前不在正文模式');s.narrative.depth++;return s.narrative.depth;}
/** 切回迷宫模式。 */
export function exitNarrative(s:State){
 const n=s.narrative;if(!n?.active)return;(s.narrativeSpans??=[]).push({from:n.startDepth,to:n.depth});delete s.narrative;
 if(n.depth!==s.depth){const from=s.depth;newDepth(s,n.depth);if(s.depthLog&&n.depth>from)s.depthLog.down+=n.depth-from-1;}
 note(s,'回到迷宫模式：第 '+s.depth+' 层。');
}
/** 正文模式里离开迷宫：按正文推进到的层数记账，然后全员撤离、照常结算缓存存档里的所得。 */
export function leaveFromNarrative(s:State){
 const n=s.narrative;if(!n?.active)throw Error('当前不在正文模式');(s.narrativeSpans??=[]).push({from:n.startDepth,to:n.depth});delete s.narrative;
 if(n.depth>s.depth){storeWorld(s);s.depthLog??={start:1,maximum:s.depth,up:0,down:0,visits:s.visit+1};s.depthLog.down+=n.depth-s.depth;s.depthLog.maximum=Math.max(s.depthLog.maximum,n.depth);s.depth=n.depth;}
 s.mode='explore';s.paused=false;s.strayWarning=false;s.exitAsk=false;withdraw(s);
}
/** 切回正文时注入给正文 LLM 的断点记录。 */
export function narrativeBreakpoint(s:State):string{
 const f=narrativeFloor(s.narrative?.depth??s.depth,s.regionSeed??s.seed),log=s.depthLog;
 const party=activeParty(s).map(p=>{const m=p.card.numeric.max;return `${p.name}（Lv.${p.card.numeric.level}，HP ${Math.round(p.current.hp/Math.max(1,m.hp)*100)}%、MP ${Math.round(p.current.mp/Math.max(1,m.mp)*100)}%、SP ${Math.round(p.current.sp/Math.max(1,m.sp)*100)}%）`;});
 const loot=s.run.rewards.filter(r=>r.kind!=='fp').map(r=>(r.kind==='box'?`${r.quality}·${r.style}·${r.contentType}盲盒`:r.kind==='material'||r.kind==='gift'?`${r.quality}·${r.name}`:'旧兑换券')+'×'+r.count);
 return [`<user>此前一直在由另外程序处理的迷宫（普罗泰利西翁）中游玩：从第 ${log?.start??1} 层出发，下潜到了第 ${f.depth} 层（最深 ${Math.max(log?.maximum??f.depth,f.depth)} 层）。`,
  `当前位置：第 ${f.depth} 层 · 主题「${f.themeName}」（${f.subtitle}）· 场景「${f.scene}」。`,
  `同行者：${party.join('；')||'无'}`,
  `前面已经经历的遭遇：${(s.encounters??[]).slice(-8).map(e=>`第${e.depth}层${e.region}：${e.enemies.map(x=>x.name).join('、')}（${e.outcome==='victory'?'胜利':e.outcome==='fled'?'撤离':e.outcome}）`).join('；')||'还没有战斗'}`,
  `已获得、尚未结算的战利品：${loot.join('、')||'暂无'}；待结算 FP ${pendingFp(s.run,s.fpDebt)}`,
  `持有遗物：${(s.ownedRelics??[]).map(o=>RELIC_CATALOG[o.id]?.name??o.id).join('、')||'无'}`].join('\n');
}
/* ---- 0.40 补给员对话 ---- */
function supplierTalkSession(s:State,thingId:string):TalkSession{s.supplierTalks??={};return s.supplierTalks[thingId]??={thingId,serial:0,log:[],pending:false,grants:{relic:0,item:0,event:0,loot:0}};}
function openTalk(s:State){if(s.mode!=='supplier'||!s.supplierState?.talk)return undefined;const t=s.region.things.find(t=>t.id===s.supplierState!.thingId&&t.kind==='supplier'&&!t.used);if(!t)return undefined;return supplierTalkSession(s,t.id);}
function talkLog(talk:TalkSession,line:TalkSession['log'][number]){talk.log.push(line);if(talk.log.length>TALK_LOG_LIMIT)talk.log.splice(0,talk.log.length-TALK_LOG_LIMIT);}
const pctText=(cur:number,max:number)=>max>0?Math.round(cur/max*100)+'%':'—';
/** 补给员看到的局内知识库：深度 / 主题 / 场景 / 本层怪物 / 品质 / 队伍 / FP / 遗物与道具 / 最近遭遇 / 本趟杀害次数 / 剩余额度。 */
export function supplierTalkContext(s:State):SupplierContext{
 const talk=supplierTalkSession(s,s.supplierState?.thingId??''),level=enemyLevel(s.depth),floorQuality=levelQuality(level),theme=THEMES[s.region.theme]!;
 const foeIds=[...new Set(s.region.things.filter(t=>t.kind==='enemy'&&!t.hunter).flatMap(t=>t.foes))];
 const owned=s.ownedRelics??[];
 return {depth:s.depth,theme:theme.name,themeSubtitle:theme.subtitle,scene:s.region.name,
  foes:foeIds.slice(0,10).map(id=>({name:FOES[id]?.name??id,level:FOES[id]?.role==='Boss'?level+1:level,role:FOES[id]?.role??'普通'})),
  floorQuality,capTier:capTierFor(floorQuality),
  party:activeParty(s).map(p=>{const max=p.card.numeric.max,cur=(s.world?.units.find(u=>u.id===p.id)?.current)??p.current;return {id:p.id,name:p.name,level:p.card.numeric.level,hp:pctText(cur.hp,max.hp),mp:pctText(cur.mp,max.mp),sp:pctText(cur.sp,max.sp),slots:Math.max(0,relicCapacity(p.card.numeric.level,owned,p.id)-relicSlotsUsed(owned,p.id))};}),
  fp:shopFp(s),relics:owned.map(o=>RELIC_CATALOG[o.id]?.name??o.id),
  items:[...Object.entries(s.bag??{}).filter(([,n])=>n>0).map(([id,n])=>(POTION_BY_ID[id]?.name??id)+'×'+n),...Object.values(s.inventory??{}).filter(i=>i.remaining>0).map(i=>i.name+'×'+i.remaining)].slice(0,16),
  kills:s.supplierKills??0,encounters:(s.encounters??[]).slice(-3).map(e=>`第${e.depth}层${e.region}：${e.enemies.map(x=>x.name).join('、')}（${e.outcome==='victory'?'胜':e.outcome}）`),
  remaining:Object.fromEntries((Object.keys(TALK_LIMITS) as DealKind[]).map(k=>[k,Math.max(0,TALK_LIMITS[k]-talk.grants[k])])) as Record<DealKind,number>,runId:s.run.id};
}
/** 玩家发言：记一行并进入等待；返回发给 LLM 的提示词（无效时 undefined）。 */
export function supplierTalkSend(s:State,text:string):{thingId:string;serial:number;prompt:SupplierPrompt}|undefined{
 if(s.paused)return undefined;const talk=openTalk(s);if(!talk||talk.pending)return undefined;
 const line=String(text??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,TALK_INPUT_LIMIT);if(!line)return undefined;
 talkLog(talk,{role:'player',text:line});talk.pending=true;talk.serial++;
 return {thingId:talk.thingId,serial:talk.serial,prompt:buildSupplierPrompt(supplierTalkContext(s),talk.log)};
}
/** LLM 回复：台词入记录；deal 经校验、额度与 FP 检查后才成交（即兴扣 FP）。过期回复（已离开、换了补给员、序号不对）不成交。 */
export function supplierTalkReply(s:State,thingId:string,serial:number,raw:unknown){
 const talk=s.supplierTalks?.[thingId];if(!talk||!talk.pending||talk.serial!==serial)return;
 talk.pending=false;const here=openTalk(s);
 const reply=parseSupplierReply(raw);talkLog(talk,{role:'supplier',text:reply.say});if(reply.mood)talk.mood=reply.mood;
 if(!reply.deal||here!==talk)return;
 const ctx=supplierTalkContext(s),built=materializeDeal(reply.deal,ctx,(s.supplierSerial??0)+1);
 if(!built.ok){if(built.reason!=='没有成交')talkLog(talk,{role:'system',text:'没有成交：'+built.reason});return;}
 const deal=built.deal;
 if(ctx.fp<deal.price){talkLog(talk,{role:'system',text:`没谈成：${deal.label}要 ${deal.price} FP，可用 FP（待结算＋总 FP）只有 ${ctx.fp}`});return;}
 let owner='';
 if(deal.relic){RELIC_CATALOG[deal.relic.id]=deal.relic;owner=ctx.party.map(p=>p.id).find(id=>relicUnavailable(s,deal.relic!.id,id)==='')??'';if(!owner){delete RELIC_CATALOG[deal.relic.id];talkLog(talk,{role:'system',text:'没谈成：队伍的遗物槽都满了'});return;}}
 if(!spendFp(s,deal.price)){talkLog(talk,{role:'system',text:`没谈成：FP 不足（要 ${deal.price} FP）`});if(deal.relic)delete RELIC_CATALOG[deal.relic.id];return;}s.supplierSerial=(s.supplierSerial??0)+1;
 if(deal.relic){s.customRelics??={};s.customRelics[deal.relic.id]=deal.relic;registerSupplierContent(s);acquireRelic(s,deal.relic.id,owner);rebuildWorld(s);talk.grants.relic++;}
 else if(deal.item){s.customItems??={};s.customItems[deal.item.id]=deal.item.spec;registerSupplierContent(s);s.bag??={};s.bag[deal.item.id]=(s.bag[deal.item.id]??0)+deal.item.count;rebuildWorld(s);talk.grants.item+=deal.item.count;}
 else if(deal.event){const spot=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]].map(([dx,dz])=>({x:s.x+dx!,z:s.z+dz!})).find(p=>walkable(s.region,p.x,p.z)&&!s.region.things.some(o=>!o.used&&o.x===p.x&&o.z===p.z))??{x:s.x,z:s.z};
  s.region.things.push({id:s.region.id+':'+deal.event.id,kind:'event',x:spot.x,z:spot.z,name:'补给员的「'+deal.event.title+'」',used:false,foes:[],customEvent:deal.event});talk.grants.event++;}
 else if(deal.loot){s.run=addReward(s.run,deal.loot);talk.grants.loot++;}
 const holder=owner?`（${s.party.find(p=>p.id===owner)?.name??owner}持有）`:'';
 talkLog(talk,{role:'system',text:`成交：${deal.label}${holder}，补给员收取 ${deal.price} FP`});
 note(s,`补给员：${DEAL_LABEL[deal.kind]}成交（−${deal.price} FP）`);
}
export function supplierTalkFailed(s:State,thingId:string,serial:number,message:string){
 const talk=s.supplierTalks?.[thingId];if(!talk||!talk.pending||talk.serial!==serial)return;
 talk.pending=false;talkLog(talk,{role:'system',text:'她没有回应：'+String(message??'').slice(0,80)});
}
export function supplierTalkBack(s:State){if(s.mode!=='supplier'||s.paused||!s.supplierState?.talk)return;s.supplierState.talk=false;}
function requirement(s:State,r:EventRequirement){const world=ensureWorld(s);if(r.kind==='flag')return s.flags?.includes(r.key);if(r.kind==='relic_any')return (s.ownedRelics??[]).length>=r.amount;if(r.kind==='fp')return pendingFp(s.run,s.fpDebt)>=r.amount;if(r.kind==='box')return countBoxes(s.run)>=r.amount;if(r.kind==='depth')return s.depth>=r.amount;if(r.kind==='party')return activeParty(s).length>=r.amount;if(r.kind==='relic')return (s.ownedRelics??[]).some(x=>x.id===r.key&&x.stacks>=r.amount);if(r.kind==='exploration')return world.units.some(u=>u.exploration?.some(x=>x.kind===r.key&&x.value>=r.amount));return world.units.every(u=>u.current[r.key as keyof Unit['current']]>=r.amount);}
export function eventUnavailable(s:State,choice:EventChoice):string{if(!choice.requirements.every(r=>requirement(s,r)))return '未满足选项条件';for(const cost of choice.costs)if(cost.resource==='fp'&&pendingFp(s.run,s.fpDebt)<cost.flat)return '待结算 FP 不足';for(const u of ensureWorld(s).units)for(const cost of choice.costs){if(cost.resource==='fp')continue;const n=Math.ceil(u.current[cost.resource]*cost.fraction+cost.flat);if(n>u.current[cost.resource]||cost.resource==='hp'&&!cost.lethal&&n>0&&n>=u.current.hp)return '不足以支付此选项代价';}return '';}
function outsideAction(input:ActionSpec,hazard=false){const a=structuredClone(input);if(hazard){a.category='event_hazard';for(const child of Object.values(a.library?.actions??{}))child.category='event_hazard';}for(const d of Object.values(a.library?.statuses??{}))if(d.scope==='battle')d.scope='run';for(const core of [a,...Object.values(a.library?.actions??{})])for(const e of core.effects)if(e.op==='modify'||e.op==='rule')e.scope='run';return a;}
function nextEventResult(s:State){const ev=s.eventState!;
  while(ev.results.length){const result=ev.results.shift()!;
   if(applyNewEventResult(s,result)){if(s.mode!=='event'&&s.mode!=='explore')return;if(s.eventPick||ev.offers.length)return;continue;}
   if(result.kind==='relic'){ev.offers=result.choices.filter(id=>relicUnavailable(s,id,ev.owner)==='');if(ev.offers.length){s.mode='event';return;}continue;}
  if(result.kind==='effect'){const a=outsideAction(result.action,true);if(a.target==='enemy'&&!a.targeting)a.target='ally';s.world=applyBattleEffects(ensureWorld(s),ev.owner,a,activeParty(s).map(p=>p.id),'effect',ev.thingId+':'+ev.id+':'+ev.results.length);storeWorld(s);exitDown(s,'event');if(s.mode==='ended')return;}
  if(result.kind==='reward'){s.run=addReward(s.run,result.reward!=='box'?{kind:'fp',amount:result.amount,count:1,source:(s.eventDefinition?.id===ev.id?s.eventDefinition:EVENT_CATALOG[ev.id])!.title}:{kind:'box',quality:result.quality??'普通',style:THEMES[s.region.theme]!.name,contentType:'材料',count:result.amount,source:(s.eventDefinition?.id===ev.id?s.eventDefinition:EVENT_CATALOG[ev.id])!.title});for(const p of activeParty(s))s.world=dispatchBattleEvent(ensureWorld(s),'pickup',p.id);storeWorld(s);}
  if(result.kind==='flag'){s.flags??=[];if(!s.flags.includes(result.id))s.flags.push(result.id);}
  if(result.kind==='next'){ev.id=result.id;ev.choice='';s.mode='event';return;}
  if(result.kind==='encounter'){const example=s.region.things.find(t=>t.kind==='enemy')!,thing:Thing={id:ev.thingId+':risk:'+s.fights,kind:'enemy',x:s.x,z:s.z,name:'事件遭遇',used:false,foes:example.foes.slice(0,Math.max(1,result.strength))};s.region.things.push(thing);enterBattle(s,thing);return;}
 }
 const thing=s.region.things.find(t=>t.id===ev.thingId);if(thing)thing.used=true;s.eventState=undefined;s.mode='explore';note(s,'继续旅程。');
}
export function eventChoice(s:State,choice:number|string){if(s.mode!=='event'||s.paused||!s.eventState)return;const ev=s.eventState;if(s.eventPick){eventPickChoice(s,choice);return;}if(ev.offers.length){const picked=typeof choice==='number'?(ev.offers[choice]??'skip'):choice;if(picked==='skip'){ev.offers=[];if(ev.id==='relic-offer'){s.eventState=undefined;s.mode='explore';note(s,'你们没有拿走任何东西。');}else nextEventResult(s);return;}acquireRelic(s,picked,ev.owner);return;}const definition=(s.eventDefinition?.id===ev.id?s.eventDefinition:EVENT_CATALOG[ev.id])!,option=typeof choice==='number'?definition.choices[choice]:definition.choices.find(c=>c.id===choice);if(!option)return;const reason=eventUnavailable(s,option);if(reason){note(s,reason);return;}const receipt=ev.thingId+':'+ev.id;if(s.eventJournal?.[receipt])return;
 const world=ensureWorld(s);for(const cost of option.costs)if(cost.resource==='fp')adjustFp(s,-cost.flat,definition.title);for(const u of world.units)for(const cost of option.costs){if(cost.resource==='fp')continue;u.current[cost.resource]-=Math.ceil(u.current[cost.resource]*cost.fraction+cost.flat);}storeWorld(s);
 ev.choice=option.id;s.eventJournal??={};s.eventJournal[receipt]=option.id;s.run.unlocks.push('event:'+ev.id);ev.results=structuredClone(option.results);
 if(option.risks?.length){let n=rng(s)*option.risks.reduce((n,r)=>n+r.weight,0);for(const risk of option.risks){n-=risk.weight;if(n<0){ev.results.push(...structuredClone(risk.results));break;}}}nextEventResult(s);
}
/** 0.36：一人一件同名；槽位 = 生命层级（+ 空遗物盒）。 */
export function relicUnavailable(s:State,id:string,owner:string){const d=RELIC_CATALOG[id];if(!d)return '没有此遗物';const owned=s.ownedRelics??[];if(owned.some(x=>x.id===id&&x.owner===owner))return '已持有同名遗物';const member=s.party.find(p=>p.id===owner);if(!member)return '没有这名成员';if(!d.hooks?.slotBonus&&relicSlotsUsed(owned,owner)>=relicCapacity(member.card.numeric.level,owned,owner))return `遗物槽已满（${relicCapacity(member.card.numeric.level,owned,owner)} 件）`;return '';}
export function acquireRelic(s:State,id:string,owner:string){const reason=relicUnavailable(s,id,owner);if(reason){note(s,reason);return;}const d=RELIC_CATALOG[id]!;s.ownedRelics??=[];s.ownedRelics.push({id,owner,stacks:1});s.relics=[...new Set(s.ownedRelics.map(x=>x.id))];s.run.unlocks.push('relic:'+id);if(d.grantFp)grantFp(s,d.grantFp,d.name);rebuildWorld(s);s.world=dispatchBattleEvent(ensureWorld(s),'pickup',owner);storeWorld(s);note(s,'获得遗物 '+d.name+'（'+(s.party.find(p=>p.id===owner)?.name??owner)+'）');if(s.eventState){s.eventState.offers=[];if(s.eventState.id==='relic-offer'){s.eventState=undefined;s.mode='explore';return;}nextEventResult(s);}}
/** 0.36：转移给同行队友（受不可转移词条与对方槽位限制）。 */
export function transferRelic(s:State,id:string,from:string,to:string){if(s.mode!=='explore'||s.paused)return;const d=RELIC_CATALOG[id];const item=(s.ownedRelics??[]).find(x=>x.id===id&&x.owner===from);if(!d||!item||from===to)return;if(!d.transferable){note(s,d.name+' 不可转移。');return;}if(!activeParty(s).some(p=>p.id===to)){note(s,'对方不在场。');return;}const reason=relicUnavailable(s,id,to);if(reason){note(s,reason);return;}storeWorld(s);item.owner=to;for(const p of s.party)if(p.persistent?.statuses)p.persistent.statuses=p.persistent.statuses.filter(x=>!x.sourceKey.includes('relic/'+id));s.world=undefined;ensureWorld(s);storeWorld(s);note(s,`${d.name} 已交给 ${s.party.find(p=>p.id===to)?.name??to}。`);}
export function removeRelic(s:State,id:string,owner:string){if(s.mode!=='explore'||s.paused)return;const def=RELIC_CATALOG[id];if(def&&!def.droppable){note(s,def.name+' 不可丢弃。');return;}storeWorld(s);s.ownedRelics=s.ownedRelics?.filter(x=>!(x.id===id&&x.owner===owner));s.relics=[...new Set(s.ownedRelics?.map(x=>x.id)??[])];for(const p of s.party)if(p.persistent?.statuses)p.persistent.statuses=p.persistent.statuses.filter(x=>!x.sourceKey.includes('relic/'+id));s.world=undefined;ensureWorld(s);storeWorld(s);note(s,'已放下遗物。');}
function endBattle(s:State){exitTeleported(s);if(s.run.status!=='active')return;const b=s.battle!,thing=s.region.things.find(t=>t.id===s.encounterId)!;
 for(const p of activeParty(s)){const u=b.units.find(u=>u.id===p.id);if(!u)continue;p.current={...u.current};p.persistent=persistentUnit(u,b.clock.timeMs);}s.seed=b.seed;s.encounters??=[];s.encounters.push({depth:s.depth,region:s.region.name,enemies:thing.foes.map((id,i)=>({name:FOES[id]!.name,level:b.units.find(u=>u.id==='enemy-'+i)!.level,count:1})),outcome:b.outcome});
 const runBefore=structuredClone(s.run),pendingRelicOffers:number[]=[];
 if(b.outcome==='victory'){thing.used=true;s.fights++;s.run=awardVictory(s.run,thing.id,activeParty(s).map(p=>actorKey(ref(p))),[...thing.foes.map((id,i)=>({instanceId:thing.id+'-'+i,species:id,level:b.units.find(u=>u.id==='enemy-'+i)!.level,role:FOES[id]!.role,rewardEligible:!b.units.find(u=>u.id==='enemy-'+i)!.escaped})),...b.units.filter(u=>u.side==='enemy'&&u.summon?.rewardEligible&&u.defeated&&!isAlive(u)&&!u.escaped).map(u=>({instanceId:thing.id+':'+u.id,species:u.name!,level:u.level,role:'summon',rewardEligible:true}))]);
   const anyDefeated=b.units.some(u=>u.side==='enemy'&&!u.owner&&!u.escaped&&u.defeated&&!isAlive(u));const boss=anyDefeated&&thing.foes.some(id=>FOES[id]!.role==='Boss'),elite=thing.foes.some(id=>FOES[id]!.role==='精英');
   const hooks=relicHooks(s),bounty=s.layerMods?.eliteBounty;
   if(anyDefeated&&(boss||rng(s)<.3)){if(bounty&&!boss&&!elite){/* 猎人告示：普通敌人不给 FP */}else grantFp(s,boss?200:50,s.region.name+'战斗',hooks.battleFpMul);}
   if(anyDefeated&&bounty&&(elite||boss))grantFp(s,bounty,'猎人告示',hooks.battleFpMul);
   if(anyDefeated&&hooks.fpPerVictory)grantFp(s,hooks.fpPerVictory,'债主账本');
   if(anyDefeated&&hooks.ashFp){const n=b.units.filter(u=>u.side==='enemy').reduce((k,u)=>k+(u.statuses??[]).filter(x=>x.definition.polarity==='negative').length,0);if(n)grantFp(s,n*hooks.ashFp,'灰烬骨灰');}
   if(anyDefeated)battleDrops(s,thing,b,boss);for(const id of thing.foes)if(!s.run.unlocks.includes('enemy:'+id))s.run.unlocks.push('enemy:'+id);
   // 经验倍率：学徒笔记 × 事件
   const expMul=hooks.expMul*(s.battleMods??[]).filter(m=>m.fights>0&&m.expMul).reduce((n,m)=>n*m.expMul!,1);
   if(expMul!==1)for(const [i,p] of s.run.participants.entries()){const before=runBefore.participants[i]?.experience??0,gained=p.experience-before;if(gained>0){const extra=Math.round(gained*expMul)-gained;p.experience+=extra;const last=p.battles[p.battles.length-1];if(last)last.experience+=extra;}}
  }
  s.layerFights=(s.layerFights??0)+1;
  for(const m of s.battleMods??[])m.fights--;const done=(s.battleMods??[]).filter(m=>m.fights<=0);s.battleMods=(s.battleMods??[]).filter(m=>m.fights>0);
  if(b.outcome==='victory'){for(const m of done)if(m.thenRelic)pendingRelicOffers.push(m.thenRelic);const extra=thing.eventReward;if(extra){if(extra.relic)pendingRelicOffers.push(extra.relic);if(extra.fp)grantFp(s,extra.fp,'事件挑战');if(extra.box)s.run=addReward(s.run,{kind:'box',quality:bumpQuality('稀有',relicHooks(s).boxQualityUp),style:THEMES[s.region.theme]!.name,contentType:'消耗品',count:extra.box,source:'事件挑战'});}}
  s.run.battleActive=false;s.battle=null;s.world=undefined;s.selected=null;s.selectedTargets=[];exitDown(s,'battle');if(s.mode==='ended')return;s.mode='explore';if(s.eventState){nextEventResult(s);return;}note(s,b.outcome==='victory'?'战斗胜利。':'战斗结束。');
  for(const rarity of pendingRelicOffers)offerRandomRelics(s,rarity as 1|2|3);
 }
/** 0.36：把一次随机遗物获得变成三选一的拾取（沿用事件 offers 界面）。 */
function offerRandomRelics(s:State,rarity?:1|2|3){const owner=activeParty(s)[0]?.id;if(!owner)return;const pool=RELIC_LIST.filter(r=>(!rarity||r.rarity===rarity)&&relicUnavailable(s,r.id,owner)==='').map(r=>r.id);if(!pool.length){note(s,'没有可以拾取的遗物。');return;}const picks:string[]=[];while(picks.length<3&&pool.length){const i=Math.floor(rng(s)*pool.length);picks.push(pool.splice(i,1)[0]!);}s.eventState={id:'relic-offer',thingId:'relic-offer:'+s.fights,offers:picks,results:[],owner,choice:''};s.mode='event';}
/** 0.21 R-1：AI 选中的动作不可用（被封锁、窗口限制等）时依次退回待机、防御，最后直接让过本回合，战斗绝不卡死。 */
function enemyTurn(b:Battle,id:string,skill:string,targets:string[]):Battle{for(const [k,t] of [[skill,targets],['booksea:wait',[id]],['booksea:guard',[id]]] as [string,string[]][]){try{return chooseAction(b,id,k,t);}catch{/* 换下一个 */}}return passTurn(b,id);}
export function tick(s:State,budget=50,onResolved?:(before:Battle,after:Battle)=>void){if(s.paused||s.mode!=='battle')return;if(!s.battle){repairBattleState(s);return;}exitTeleported(s);if(s.battle&&s.region.things.find(t=>t.id===s.encounterId)?.hunter&&mirrorStrayLive(s.battle))note(s,'她把你们新学会的那一招也写了下来。');if(!s.battle)return;let b=s.battle;if(b.clock.pending[0]?.kind==='ready'&&b.clock.units.find(u=>u.id===b.clock.pending[0]!.unitId)!.side==='ally')return;if(b.outcome!=='active'){endBattle(s);return;}
 for(const u of b.units.filter(u=>u.side==='enemy'&&!u.owner&&isAlive(u))){
  if(!u.tags?.includes('monster:Boss')||s.bossPhases?.includes(u.id))continue;
  const invoked=Object.entries(u.actions).find(([id,a])=>(u.used[id]??0)>0&&a.tags?.some(t=>['monster:authority','monster:law','monster:kingdom'].includes(t)));
  if(invoked){s.bossPhases??=[];s.bossPhases.push(u.id);note(s,u.name+'已展开登神能力：'+invoked[1].name);}
 }
 s.battle=b;const head=b.clock.pending[0];if(head?.kind==='resolve'){s.battle=resolveAction(b);onResolved?.(b,s.battle);exitTeleported(s);if(!s.battle)return;if(s.battle.outcome!=='active')endBattle(s);return;}
 // 时钟侧的 side 已按阵营（含失控 charm）解析：被魅惑的己方单位在这里由怪物 AI 代打。
 if(head?.kind==='ready'&&b.clock.units.find(u=>u.id===head.unitId)!.side==='enemy'){const u=b.units.find(u=>u.id===head.unitId)!,thing=s.region.things.find(t=>t.id===s.encounterId)!,foe=u.owner||u.side!=='enemy'?undefined:FOES[thing.foes[Number(u.id.split('-')[1])]!],choice=decide(b,u,foe?.behavior);if(choice.skill==='__flee__'){s.battle=withdrawEnemy(b,u.id);return;}s.battle=enemyTurn(b,u.id,choice.skill,choice.targets);return;}
 s.battle=advanceBattle(b,budget).battle;exitTeleported(s);
}
export function tickExploration(s:State,dt=50){if(s.mode!=='explore'||s.paused||s.strayWarning||s.exitAsk)return;s.explorationMs=(s.explorationMs??0)+dt;s.escapeMs=Math.max(0,(s.escapeMs??0)-dt);s.world=advanceExplorationEffects(ensureWorld(s),dt);storeWorld(s);exitDown(s);if(s.run.status!=='active')return;
 const stealth=Math.max(0,...s.world!.units.flatMap(u=>(u.exploration??[]).filter(x=>x.kind==='stealth').map(x=>x.value)));
 // 「?」：按玩家步频自主追击（玩家不动她也走），不受隐匿与逃跑宽限影响。
 for(const t of s.region.things.filter(t=>t.hunter&&!t.used)){t.ai??={mode:'chase',homeX:t.x,homeZ:t.z,lostMs:0,stepMs:0};const stepMs=STRAY_STEP_MS*relicHooks(s).strayStepDiv/(s.runMods?.strayHaste??1);t.ai.stepMs+=dt;while(t.ai.stepMs>=stepMs&&s.mode==='explore'){t.ai.stepMs-=stepMs;strayStep(s);}if(s.mode!=='explore')return;}
 for(const t of s.region.things.filter(t=>t.kind==='enemy'&&!t.used&&!t.hunter)){
   t.ai??={mode:'patrol',homeX:t.x,homeZ:t.z,lostMs:0,stepMs:0};const ai=t.ai,dist=Math.abs(t.x-s.x)+Math.abs(t.z-s.z);const hk=relicHooks(s),blind=s.layerMods?.noChase||(hk.firstFightStealth&&(s.layerFights??0)===0)||hk.vision<=0;const vision=blind?-1:Math.max(1,4*(1-stealth)*hk.vision);
  if(dist<=vision&&(s.escapeMs??0)<=0){ai.mode=ai.mode==='patrol'?'alert':'chase';ai.lostMs=0;}else if(ai.mode==='chase'||ai.mode==='alert'){ai.lostMs+=dt;if(ai.lostMs>=2500)ai.mode='return';}
  ai.stepMs+=dt;if(ai.stepMs<650)continue;ai.stepMs=0;
  let dx=0,dz=0;if(ai.mode==='chase'){if(Math.abs(s.x-t.x)>Math.abs(s.z-t.z))dx=Math.sign(s.x-t.x);else dz=Math.sign(s.z-t.z);}else if(ai.mode==='return'){dx=Math.sign(ai.homeX-t.x);if(!dx)dz=Math.sign(ai.homeZ-t.z);if(!dx&&!dz)ai.mode='patrol';}else if(ai.mode==='patrol'){const direction=Math.floor(rng(s)*4);dx=[1,-1,0,0][direction]!;dz=[0,0,1,-1][direction]!;if(Math.abs(t.x+dx-ai.homeX)+Math.abs(t.z+dz-ai.homeZ)>2)dx=dz=0;}
  const x=t.x+dx,z=t.z+dz;if(walkable(s.region,x,z)&&!s.region.things.some(o=>o!==t&&!o.used&&o.x===x&&o.z===z)){t.x=x;t.z=z;}
  if(t.x===s.x&&t.z===s.z&&(s.escapeMs??0)<=0){enterBattle(s,t);return;}
 }
}
export function chooseSkill(s:State,key:string){if(s.mode!=='battle'||s.paused||!s.battle||clockPhase(s.battle.clock)!=='menu')return;const u=s.battle.units.find(u=>u.id===s.battle!.clock.pending[0]!.unitId)!;if(key===CROSS_KEY&&(s.crossUsed||crossAllies(s.battle)>=4)){note(s,s.crossUsed?'银十字已经用过了。':'队伍已满四人。');return;}const reason=actionUnavailable(s.battle,u,key);if(reason){note(s,reason);return;}s.selected=key;s.selectedTargets=[];const a=u.actions[key]!;if(a.targeting?.selection&&a.targeting.selection!=='manual'){chooseTarget(s,legalTargets(s.battle,u,a)[0]?.id??u.id,true);return;}note(s,'选择施放对象。');}
export function chooseTarget(s:State,id:string,confirm=false){if(!s.battle||s.paused||!s.selected)return;const caster=s.battle.clock.pending[0]!.unitId,key=s.selected,u=s.battle.units.find(u=>u.id===caster)!,a=u.actions[key]!,max=a.targeting?.count??1;
 if(s.inventory?.[key]?.remaining===0||key==='恢复药'&&s.potions<=0){note(s,'物品数量不足');return;}
 if(max>1&&!confirm&&a.targeting?.selection==='manual'){s.selectedTargets??=[];if(s.selectedTargets.includes(id))s.selectedTargets=s.selectedTargets.filter(x=>x!==id);else if(s.selectedTargets.length<max)s.selectedTargets.push(id);return;}
 const targets=max>1&&a.targeting?.selection==='manual'?(s.selectedTargets??[]):[id];if(key.startsWith(POTION_KEY)&&!(s.bag?.[key.slice(POTION_KEY.length)]??0)){note(s,'药剂已用完');return;}try{s.battle=chooseAction(s.battle,caster,key,targets);if(key==='恢复药')s.potions--;if(key.startsWith(POTION_KEY)){const pid=key.slice(POTION_KEY.length);s.bag![pid]=Math.max(0,(s.bag![pid]??0)-1);if(pid==='smoke')s.smoke=true;if(!s.bag![pid])for(const u of s.battle.units)if(u.side==='ally')delete u.actions[key];}if(key===CROSS_KEY)summonCrossAlly(s);if(s.inventory?.[key]){const item=s.inventory[key]!;item.remaining--;item.used++;for(const unit of s.battle.units)if(unit.id===item.actorId){unit.dependencies??={};unit.dependencies['inventory:'+item.name]=item.remaining;}s.battle=dispatchBattleEvent(s.battle,'use_item',caster,targets[0]??caster);}s.selected=null;s.selectedTargets=[];}catch(e){note(s,(e as Error).message);}}
export function useOutsideBattle(s:State,actorId:string,key:string,targetIds:string[]){if(s.mode!=='explore'||s.paused)return;const b=ensureWorld(s),u=b.units.find(u=>u.id===actorId)!,a=u.actions[key];if(!a)return;if(isInterludeAction(a)){if(activeParty(s).some(p=>p.id===actorId))withdraw(s);return;}const foeOnly=(e:EffectSpec)=>a.targeting?.side==='any'&&e.targeting?.side==='enemy'&&e.targeting.selection==='manual';const allowed=a.effects.every(e=>['heal','resource','modify','apply_status','dispel','explore','rule','sequence','retreat','time'].includes(e.op)||foeOnly(e));if(!allowed){note(s,'这个技能需要在战斗中使用。');return;}const reason=actionUnavailable(b,u,key,targetIds);if(reason){note(s,reason);return;}const item=s.inventory?.[key];if(item&&item.remaining<=0){note(s,'物品不足');return;}const costs=costFor(u,a);for(const r of ['hp','mp','sp'] as const)u.current[r]-=costs[r];s.world=applyBattleEffects(b,actorId,outsideAction(a),targetIds,'effect',key);if(item){item.remaining--;item.used++;s.world.units.find(u=>u.id===actorId)!.dependencies!['inventory:'+item.name]=item.remaining;s.world=dispatchBattleEvent(s.world,'use_item',actorId,targetIds[0]??actorId);}storeWorld(s);exitTeleported(s);if(s.run.status==='active')exitDown(s);}
export function flee(s:State){if(s.mode!=='battle'||s.paused||!s.battle||clockPhase(s.battle.clock)!=='menu')return;if(s.region.things.find(t=>t.id===s.encounterId)?.kind==='mimic'){note(s,'逃不掉。');return;}if(s.region.things.find(t=>t.id===s.encounterId)?.hunter){note(s,'逃不掉。');return;}const hooks=relicHooks(s);if(hooks.noFlee){note(s,'誓约之锁：你们发过誓，不能逃。');return;}const b=s.battle,actor=b.clock.pending[0]!.unitId,allies=b.clock.units.filter(u=>u.side==='ally'&&u.active),enemies=b.clock.units.filter(u=>u.side==='enemy'&&u.active);let chance=Math.max(.1,Math.min(.95,.5+.25*(allies.reduce((n,u)=>n+speedFactor(u),0)/Math.max(1,allies.length)/Math.max(...enemies.map(speedFactor),.1)-1)));if(hooks.fleeSure||s.smoke)chance=1;if(hooks.fleeCost)adjustFp(s,-hooks.fleeCost,'逃生绳');
 const r=roll(b.seed);b.seed=r.seed;if(r.value>=chance){s.battle=chooseAction(b,actor,'booksea:wait',actor);note(s,'没能逃掉。');return;}
 const thing=s.region.things.find(t=>t.id===s.encounterId)!;thing.foeResources=Object.fromEntries(b.units.filter(u=>u.side==='enemy'&&!u.owner).map(u=>[u.id,{...u.current}]));for(const p of activeParty(s)){const u=b.units.find(u=>u.id===p.id);if(!u)continue;p.current={...u.current};p.persistent=persistentUnit(u,b.clock.timeMs);}s.seed=b.seed;s.run.battleActive=false;s.battle=null;s.world=undefined;s.selected=null;s.mode='explore';s.x=s.origin.x;s.z=s.origin.z;s.escapeMs=6000;exitDown(s,'battle');note(s,'成功逃离。');}
function monsterChallenge(u:Unit){
 const m=u.tags?.includes(MIMIC_ID)?MIMIC_DESIGN:MONSTER_BY_ID[(u.tags??[]).find(t=>MONSTER_BY_ID[t])??''];
 if(m){const n=monsterNumbers(m,u.level);return {...n.challengeGrowth,tier:Math.floor(Math.max(0,u.level-25)/4),kitLevel:n.kitLevel,lifeTier:n.lifeTier};}
 return {hp:1,attack:1,tier:0,kitLevel:Math.min(25,u.level),lifeTier:Math.min(7,Math.ceil(u.level/4))};
}
export function view(s:State){
 const b=s.battle,head=b?.clock.pending[0],actor=head?.kind==='ready'?b!.units.find(u=>u.id===head.unitId):undefined,thing=s.region.things.find(t=>t.id===s.encounterId);
 const naming=(u:Unit)=>u.name??s.party.find(p=>p.id===u.id)?.name??(u.owner?'召唤物':FOES[thing?.foes[Number(u.id.split('-')[1])]??'']?.name??u.id);
 const units=b?b.units.map(u=>({id:u.id,artId:u.side==='enemy'?enemyArtId(u,b.units,thing?.foes??[]):'',name:naming(u),side:b.clock.units.find(c=>c.id===u.id)!.side,alive:isAlive(u),hp:u.current.hp,maxHp:u.max.hp,mp:u.current.mp,sp:u.current.sp,maxMp:u.max.mp,maxSp:u.max.sp,atb:b.clock.units.find(c=>c.id===u.id)!.atb,passives:u.passiveNames??[],monsterAbilities:u.tags?.includes('monster')?Object.entries(u.actions).filter(([,a])=>a.source?.kind!=='system').map(([id,a])=>({id,name:a.name??id,description:a.description??'',kind:a.source?.kind,quality:a.source?.quality??null,cost:costFor(u,a),castMs:a.castMs,limit:a.perBattleUses,used:u.used[id]??0})):[],armor:u.mitigation.armor,haste:b.clock.units.find(c=>c.id===u.id)!.haste,effectiveSpeed:speedFactor(b.clock.units.find(c=>c.id===u.id)!),shield:u.shields.filter(s=>!s.suppressed).reduce((n,a)=>n+a.amount,0),shape:u.owner?'player':u.side==='enemy'?FOES[thing!.foes[Number(u.id.split('-')[1])]!]!.shape:'player',tint:s.party.find(p=>p.id===(u.owner??u.id))?.color??'#bba5a5',level:u.level,templateLevel:Math.min(25,u.level),challenge:monsterChallenge(u),owner:u.owner??'',position:u.position??0,phase:(u.statuses??[]).map(x=>x.definition.tags?.find(t=>t.startsWith('visual:'))).find(Boolean)?.slice(7)??'',charmed:(u.statuses??[]).some(x=>!x.suppressed&&x.definition.control==='charm'),counters:Object.entries(u.counters??{}).filter(([k])=>!k.startsWith('_')).map(([k,v])=>k+' '+Math.round(v.value)),statuses:(u.statuses??[]).map(x=>({name:(x.rule?runtimeRuleText(x.rule):x.definition.name)+(x.definition.scope==='run'||x.clock==='exploration_time'?'（本次迷宫内）':'')+(x.clock==='round'&&x.remaining>0&&x.remaining<1000&&(x.definition.tags.includes('monster:timer')||['charm','isolate','time_stop','stun','silence'].includes(x.definition.control??''))?'·'+Math.ceil(x.remaining)+'轮':'')+(x.suppressed?'（来源已封锁）':''),source:x.source,stacks:x.stacks,remaining:x.remaining,clock:x.clock,priority:x.definition.priority,polarity:x.definition.polarity,control:x.definition.control??'',description:x.rule?runtimeRuleText(x.rule):statusSummary(x.definition)}))})):[];
 const actorIsPlayer=actor&&b!.clock.units.find(c=>c.id===actor.id)!.side==='ally';
 let actions=actorIsPlayer?Object.entries(actor!.actions).map(([id,a])=>{const cost=costFor(actor!,a,id),reason=(s.inventory?.[id]?.remaining===0||id==='恢复药'&&s.potions<=0)?'物品耗尽':id===CROSS_KEY&&crossAllies(b!)>=4?'队伍已满四人':actionUnavailable(b!,actor!,id);return {id,itemCount:s.inventory?.[id]?.remaining??(id==='恢复药'?s.potions:null),name:a.name??s.inventory?.[id]?.name??s.party.find(p=>p.id===(actor!.owner??actor!.id))?.card.skills.find(k=>k.sourceId===id)?.name??(id.startsWith('/')?'特殊能力':id),target:a.target,mp:cost.mp,sp:cost.sp,hp:cost.hp,cast:a.castMs,disabled:!!reason,reason,category:(s.inventory?.[id]||id==='恢复药'||id.startsWith('item-')||id===CROSS_KEY)?'item':id.startsWith('booksea:')?'command':id.startsWith('R')?'relic':a.category==='spell'?'spell':'skill',favorite:s.favorites?.includes(id)??false,sourceDescription:a.description??'',description:id===CROSS_KEY?a.description??'':describeAction({...a,library:actor!.library},{level:actor!.level,attributes:actor!.attributes,max:actor!.max}).join('；'),effectText:id===CROSS_KEY?[a.description??'']:describeAction({...a,library:actor!.library},{level:actor!.level,attributes:actor!.attributes,max:actor!.max}),effects:a.effects,targeting:a.targeting??{side:a.target,selection:'manual',count:1},used:actor!.used[id]??0,limit:a.perBattleUses,charges:actor!.charges?.[id]??null};}):[];
 const allActions=actions;
 if(s.actionCategory&&s.actionCategory!=='all')actions=actions.filter(a=>s.actionCategory==='favorite'?a.favorite:a.category===s.actionCategory);
 const page=Math.min(s.actionPage??0,Math.max(0,Math.ceil(actions.length/6)-1)),selected=actor&&s.selected?actor.actions[s.selected]:undefined;
 const ev=s.eventState,definition=ev?(s.eventDefinition?.id===ev.id?s.eventDefinition:EVENT_CATALOG[ev.id]):undefined;
 if(ev&&ev.id==='relic-offer'&&ev.offers.length===0){/* 已处理 */}
 const pick=s.eventPick;
 const eventView=ev&&ev.id==='relic-offer'?{title:'拾取遗物',body:'三选一（也可以都不要）。遗物默认只作用于持有者，可在遗物页转移给队友。',id:'relic-offer',owner:ev.owner,choices:[...ev.offers.map(id=>({id,relic:id,label:RELIC_CATALOG[id]!.name,description:relicDescription(id),disabled:!!relicUnavailable(s,id,ev.owner),reason:relicUnavailable(s,id,ev.owner)})),{id:'skip',relic:undefined as string|undefined,label:'都不要',description:'',disabled:false,reason:''}]}:definition&&pick?{title:definition.title,body:pick.kind==='skills'?`已选 ${pick.selected.length}/${pick.max}，选好后按“确认”。`:definition.body,id:definition.id,owner:ev!.owner,choices:[...pick.options.map(o=>({id:o.id,relic:undefined as string|undefined,label:(pick.selected.includes(o.id)?'✓ ':'')+o.label,description:o.description,disabled:false,reason:''})),...(pick.kind==='skills'?[{id:'confirm',relic:undefined as string|undefined,label:'确认',description:'',disabled:pick.selected.length<1,reason:pick.selected.length<1?'至少封印一个':''}]:[])]}:definition?{title:definition.title,body:definition.body,id:definition.id,owner:ev!.owner,choices:ev!.offers.length?ev!.offers.map(id=>({id,relic:id,label:RELIC_CATALOG[id]!.name,description:relicDescription(id),disabled:!!relicUnavailable(s,id,ev!.owner),reason:relicUnavailable(s,id,ev!.owner)})):definition.choices.map(c=>({id:c.id,relic:undefined as string|undefined,label:c.label,description:eventChoiceDescription(c,ensureWorld(s).units),disabled:!!eventUnavailable(s,c),reason:eventUnavailable(s,c),costs:c.costs,risks:c.risks?.map(r=>({weight:r.weight,results:r.results.map(x=>x.kind)}))??[]}))}:null;
 const talkSession=s.mode==='supplier'&&s.supplierState?.talk?s.supplierTalks?.[s.supplierState.thingId]:undefined;
 const talkView=talkSession?{log:talkSession.log.slice(-20),pending:talkSession.pending,fp:shopFp(s),mood:talkSession.mood??'',remaining:Object.fromEntries((Object.keys(TALK_LIMITS) as DealKind[]).map(k=>[k,Math.max(0,TALK_LIMITS[k]-talkSession.grants[k])])) as Record<DealKind,number>}:undefined;
 const supplier=s.mode==='supplier'&&s.supplierState?(talkView?{thingId:s.supplierState.thingId,name:SUPPLIER_NAME,question:[...talkView.log].reverse().find(l=>l.role==='supplier')?.text??'……',choices:[] as {id:string;label:string}[],talk:talkView}:s.shopPage?{thingId:s.supplierState.thingId,name:SUPPLIER_NAME,question:`商店 · 待结算 FP ${pendingFp(s.run,s.fpDebt)}`+(s.source==='host'?` · 总 FP ${hostFpAvailable(s)}`:'')+'（先扣待结算）',choices:[...POTIONS.map(p=>({id:'buy:'+p.id,label:`${p.name} ${potionPrice(p,s.depth,relicHooks(s).shopDiscount)} FP · ${p.description}`+((s.bag?.[p.id]??0)?`（已有 ${s.bag![p.id]}）`:'')})),{id:'buy:'+INSURANCE.id,label:`${INSURANCE.name} ${INSURANCE.price} FP · ${INSURANCE.description}`+(s.run.keepOnDefeat?'（已购买）':'')},{id:'buy:'+LEARNING_DEVICE.id,label:`${LEARNING_DEVICE.name} ${LEARNING_DEVICE_PRICE} FP · ${LEARNING_DEVICE.description}`+(s.learningBought?'（本趟已购买）':'')},...shopRelicChoices(s,s.supplierState.thingId),{id:'back',label:'返回'}],talk:undefined}:{thingId:s.supplierState.thingId,name:SUPPLIER_NAME,question:SUPPLIER_QUESTION,choices:[...(s.supplierTalkReady?[{id:'talk',label:'对话'}]:[]),...SUPPLIER_CHOICES.map(c=>({id:c.id as string,label:c.label as string}))],talk:undefined}):null;
 const world=s.world;const exploration=(world??b)?.units.flatMap(u=>u.exploration??[])??[];const explorationIntel={enemies:exploration.some(e=>e.kind==='reveal')?s.region.things.filter(t=>t.kind==='enemy'&&!t.used).map(t=>({x:t.x,z:t.z,enemies:t.foes.map(id=>({name:FOES[id]!.name,role:FOES[id]!.role,level:enemyLevel(s.depth)}))})):[],chests:exploration.some(e=>e.kind==='sense_chest')?s.region.things.filter(t=>(t.kind==='chest'||t.kind==='mimic')&&!t.used).map(t=>({x:t.x,z:t.z})):null,dangerReduction:Math.max(0,...exploration.filter(e=>e.kind==='danger_reduction').map(e=>e.value))};
 const nearby=s.mode==='explore'&&!s.paused?s.region.things.filter(t=>!t.used&&t.kind!=='enemy'&&near(s,t)).sort((a,b)=>(Math.abs(s.x-a.x)+Math.abs(s.z-a.z))-(Math.abs(s.x-b.x)+Math.abs(s.z-b.z))).map(t=>({id:t.id,kind:t.kind,name:t.name}))[0]??null:null;
 return {nearby,narrativeReady:!!s.narrativeReady&&canStartNarrative(s),narrative:s.narrative?.active?{...s.narrative}:undefined,loot:s.run.rewards,explorationIntel,themeName:THEMES[s.region.theme]!.name,totalDepth:s.depth+1,infiniteDepth:true,supplier,event:eventView,relicNames:(s.ownedRelics??(s.relics??[]).map(id=>({id,owner:'team',stacks:1}))).map(x=>(RELIC_CATALOG[x.id]?.name??RELICS[x.id]?.name??x.id)+' ×'+x.stacks),ownedRelics:s.relics??[],relicDetails:(s.ownedRelics??[]).map(x=>({...x,name:RELIC_CATALOG[x.id]?.name??RELICS[x.id]?.name,description:RELIC_CATALOG[x.id]?.description??RELICS[x.id]?.description,ownerName:s.party.find(p=>p.id===x.owner)?.name??x.owner,rarity:RELIC_CATALOG[x.id]?RELIC_RARITY_LABEL[RELIC_CATALOG[x.id]!.rarity]:'',scope:RELIC_CATALOG[x.id]?.scope??'holder',transferable:RELIC_CATALOG[x.id]?.transferable??true,droppable:RELIC_CATALOG[x.id]?.droppable??true,transferTargets:activeParty(s).filter(p=>p.id!==x.owner&&(RELIC_CATALOG[x.id]?.transferable??true)&&relicUnavailable(s,x.id,p.id)==='').map(p=>({id:p.id,name:p.name}))})),relicSlots:s.party.map(p=>({id:p.id,name:p.name,used:relicSlotsUsed(s.ownedRelics??[],p.id),capacity:relicCapacity(p.card.numeric.level,s.ownedRelics??[],p.id)})),pendingFp:pendingFp(s.run,s.fpDebt),bag:Object.entries(s.bag??{}).filter(([,n])=>n>0).map(([id,n])=>({id,name:POTION_BY_ID[id]?.name??id,description:POTION_BY_ID[id]?.description??'',count:n})),bell:s.bell??0,cross:{threads:threadsAvailable(s),need:CROSS_THREADS,held:!!s.crossHeld,ward:!!s.crossWard,used:!!s.crossUsed},warning:s.strayWarning?'有什么在接近…':'',exitAsk:!!s.exitAsk,source:s.source??'playtest',writeback:s.writeback??'',mode:s.mode,paused:s.paused,depth:s.depth,depthLog:s.depthLog,region:s.region,x:s.x,z:s.z,notice:playerNotice(s.notice),history:s.history.slice(-6),potions:s.potions,boxes:s.run.rewards.filter(r=>r.kind==='box').reduce((n,r)=>n+r.count,0),materials:s.run.rewards.filter(r=>r.kind==='material').reduce((n,r)=>n+r.count,0),fp:s.run.rewards.reduce((n,r)=>n+rewardFP(r),0),vouchers:s.run.rewards.reduce((n,r)=>n+rewardFP(r),0),fights:s.fights,settings:s.settings,unlocks:s.run.unlocks,
 party:s.party.map(p=>{const u=b?.units.find(u=>u.id===p.id)??world?.units.find(u=>u.id===p.id),part=s.run.participants.find(q=>actorKey(q.ref)===actorKey(ref(p)))!;return {id:p.id,name:p.name,color:p.color,level:p.card.numeric.level,...u?.current??p.current,maxHp:u?.max.hp??p.card.numeric.max.hp,maxMp:u?.max.mp??p.card.numeric.max.mp,maxSp:u?.max.sp??p.card.numeric.max.sp,status:part.status,experience:part.experience,outsideActions:Object.entries(u?.actions??{}).filter(([,a])=>a.effects.every(e=>['heal','resource','modify','apply_status','dispel','explore','rule','sequence','retreat','time'].includes(e.op))).map(([id,a])=>({id,name:a.name??s.inventory?.[id]?.name??p.card.skills.find(k=>k.sourceId===id)?.name??id,description:describeAction({...a,library:u!.library},p.card.numeric).join('；'),effectText:describeAction({...a,library:u!.library},p.card.numeric),target:a.target,rest:isInterludeAction(a)}))};}),
 battle:{encounterId:s.encounterId,escapeLocked:thing?.kind==='mimic',units,actions,allActions,visibleActions:actions.slice(page*6,(page+1)*6),page,pages:Math.ceil(actions.length/6),ready:!!actorIsPlayer&&!s.paused,actorId:actorIsPlayer?actor!.id:'',actorName:actorIsPlayer?naming(actor!):'',timeMs:b?.clock.timeMs??0,selected:s.selected??'',selectedTargets:s.selectedTargets??[],targets:selected?legalTargets(b!,actor!,selected).sort((x,y)=>selected.target==='enemy'&&(selected.targeting?.side??'enemy')!=='ally'?Number(!hostileTo(b!,actor!,x))-Number(!hostileTo(b!,actor!,y)):0).map(u=>u.id):[],suppression:selected?legalTargets(b!,actor!,selected).map(u=>({id:u.id,...suppression(actor!.level,u.level)})):[],fields:b?.fields??[],log:b?playerBattleLog(b.log,units):[]},outcome:s.run.status,settlement:s.mode==='ended'?{...settlementProposal(s.run),committed:s.source==='host'&&s.writeback==='done'}:null};
}

/* ═══════════ 0.36 事件结果与拾取（新增种类） ═══════════ */
const ATTRS=['力量','敏捷','体质','智力','精神'] as const;
function runModify(s:State,ids:string[],name:string,modifiers:{stat:string;multiplier?:number;flat?:number}[]){if(!ids.length)return;const a=outsideAction(action([{op:'modify',name,duration:{clock:'permanent',value:0},modifiers:modifiers as never,targeting:{side:'any',selection:'all',life:'any',ids}}],'self'));s.world=applyBattleEffects(ensureWorld(s),ids[0]!,a,ids,'effect','event:'+name+':'+s.fights);storeWorld(s);}
function randomRelicPicks(s:State,owner:string,rarity?:1|2|3,exclude:string[]=[]){const pool=RELIC_LIST.filter(r=>(!rarity||r.rarity===rarity)&&!exclude.includes(r.id)&&relicUnavailable(s,r.id,owner)==='').map(r=>r.id);const picks:string[]=[];while(picks.length<3&&pool.length){const i=Math.floor(rng(s)*pool.length);picks.push(pool.splice(i,1)[0]!);}return picks;}
function ownedOptions(s:State){return (s.ownedRelics??[]).filter(o=>RELIC_CATALOG[o.id]).map(o=>({id:o.owner+'|'+o.id,label:RELIC_CATALOG[o.id]!.name+'（'+(s.party.find(p=>p.id===o.owner)?.name??o.owner)+'）',description:relicDescription(o.id)}));}
function memberOptions(s:State){return activeParty(s).map(p=>{const u=s.world?.units.find(u=>u.id===p.id);return {id:p.id,label:p.name,description:`Lv${p.card.numeric.level} · HP ${Math.round(u?.current.hp??p.current.hp)}/${Math.round(u?.max.hp??p.card.numeric.max.hp)}`};});}
function dropOwned(s:State,owner:string,id:string){s.ownedRelics=(s.ownedRelics??[]).filter(x=>!(x.id===id&&x.owner===owner));s.relics=[...new Set(s.ownedRelics.map(x=>x.id))];for(const p of s.party)if(p.persistent?.statuses)p.persistent.statuses=p.persistent.statuses.filter(x=>!x.sourceKey.includes('relic/'+id));}
function tierFoes(s:State,tier:'normal'|'elite'|'boss',count:number){const t=s.region.theme,ids:string[]=[];for(let i=0;i<count;i++)ids.push(tier==='boss'?`${t}_B01`:tier==='elite'?`${t}_E0${1+(i%3)}`:`${t}_N0${1+Math.floor(rng(s)*5)}`);return ids;}
/** 处理 0.36 新增的事件结果；返回 true 表示已处理。 */
function applyNewEventResult(s:State,result:EventResult):boolean{
 const ev=s.eventState!,title=(s.eventDefinition?.id===ev.id?s.eventDefinition:EVENT_CATALOG[ev.id])?.title??ev.id,party=activeParty(s);
 switch(result.kind){
  case 'fp':{if(result.mode==='add')grantFp(s,result.amount,title);else if(result.mode==='scale')scaleFp(s,result.amount,title);else adjustFp(s,-pendingFp(s.run,s.fpDebt),title);return true;}
  case 'box':{if(result.count<0){removeBoxes(s,-result.count);return true;}const qualities=['普通','优良','稀有','史诗','传说'];for(let i=0;i<result.count;i++){const q=result.quality&&result.quality!=='random'?result.quality:qualities[Math.min(qualities.length-1,Math.floor(-Math.log2(Math.max(1e-9,1-rng(s)))))]!;s.run=addReward(s.run,{kind:'box',quality:bumpQuality(q,relicHooks(s).boxQualityUp),style:THEMES[s.region.theme]!.name,contentType:'消耗品',count:1,source:title});}return true;}
  case 'heal_all':{const b=ensureWorld(s);for(const u of b.units){if(u.side!=='ally')continue;if(result.fraction>=1){u.current={...u.max};u.statuses=u.statuses?.filter(x=>x.definition.polarity!=='negative');}else if(result.fraction>0)u.current.hp=Math.min(u.max.hp,u.current.hp+Math.round(u.max.hp*result.fraction));else u.current.hp=Math.max(1,u.current.hp-Math.round(u.max.hp*-result.fraction));}storeWorld(s);return true;}
  case 'cleanse_all':{const b=ensureWorld(s);for(const u of b.units)if(u.side==='ally')u.statuses=u.statuses?.filter(x=>x.definition.polarity!=='negative');storeWorld(s);return true;}
  case 'teleport':{const lo=Math.max(1,s.depth-result.range),hi=Math.min(s.depth+result.range,(Math.floor(s.depth/100)+1)*100-1);let target=lo+Math.floor(rng(s)*(hi-lo+1));if(target===s.depth)target=target<hi?target+1:Math.max(lo,target-1);const thing=s.region.things.find(t=>t.id===ev.thingId);if(thing)thing.used=true;s.eventState=undefined;s.mode='explore';newDepth(s,target);note(s,`错位楼梯把你们送到了第 ${target} 层。`);return true;}
  case 'relic_random':{ev.offers=randomRelicPicks(s,ev.owner,result.rarity);if(!ev.offers.length)note(s,'没有可以拾取的遗物。');return true;}
  case 'relic_grant':{const owner=party.find(p=>relicUnavailable(s,result.id,p.id)==='')?.id;if(owner)acquireRelic(s,result.id,owner);else note(s,'没有人还有空余的遗物槽。');return true;}
  case 'relic_transform':case 'relic_pick':{const options=ownedOptions(s);if(!options.length){note(s,'你们没有遗物。');return true;}s.eventPick={kind:'relic',mode:result.kind==='relic_transform'?'transform':result.mode,options,max:1,selected:[],payload:result as unknown as Record<string,unknown>};return true;}
  case 'encounter_tier':{const foes=tierFoes(s,result.tier,result.count);const thing:Thing={id:ev.thingId+':challenge:'+s.fights,kind:'enemy',x:s.x,z:s.z,name:'事件挑战',used:false,foes,eventReward:{...(result.thenRelic?{relic:result.thenRelic}:{}),...(result.thenFp?{fp:result.thenFp}:{}),...(result.thenBox?{box:result.thenBox}:{})}};s.region.things.push(thing);const host=s.region.things.find(t=>t.id===ev.thingId);if(host)host.used=true;s.eventState=undefined;enterBattle(s,thing);return true;}
  case 'item':{s.bell=(s.bell??0)+result.count;note(s,`获得传唤铃（${s.bell} 次）。`);return true;}
  case 'battle_mod':{s.battleMods??=[];s.battleMods.push({fights:result.fights,...(result.enemyDamage?{enemyDamage:result.enemyDamage}:{}),...(result.expMul?{expMul:result.expMul}:{}),...(result.materialRate!==undefined?{materialRate:result.materialRate}:{}),...(result.enemyDouble?{enemyDouble:true}:{}),...(result.thenRelic?{thenRelic:result.thenRelic}:{})});return true;}
  case 'seal_skills':{s.eventPick={kind:'member',mode:'seal',options:memberOptions(s),max:1,selected:[]};return true;}
  case 'member_pick':{s.eventPick={kind:'member',mode:result.mode,options:memberOptions(s),max:1,selected:[],payload:result as unknown as Record<string,unknown>};return true;}
  case 'run_mod':{const ids=result.member==='all'?party.map(p=>p.id):[party[Math.floor(rng(s)*party.length)]!.id];const mods:{stat:string;multiplier:number}[]=[];if(result.maxHp)mods.push({stat:'max_hp',multiplier:result.maxHp});if(result.maxMp)mods.push({stat:'max_mp',multiplier:result.maxMp});if(result.speed)mods.push({stat:'speed',multiplier:result.speed});runModify(s,ids,title,mods);return true;}
  case 'layer_mod':{if(result.run){s.runMods??={};(s.runMods as Record<string,number>)[result.key]=result.value;}else{s.layerMods??={};(s.layerMods as Record<string,number>)[result.key]=result.value;}return true;}
  case 'potions':{if(result.random){s.bag??={};for(let i=0;i<result.count;i++){const p=POTIONS[Math.floor(rng(s)*POTIONS.length)]!;s.bag[p.id]=(s.bag[p.id]??0)+1;}rebuildWorld(s);}else s.potions+=result.count;return true;}
  case 'swap_hp_mp':{const p=party[Math.floor(rng(s)*party.length)]!;const u=ensureWorld(s).units.find(u=>u.id===p.id)!;const hp=Math.max(1,u.max.hp),mp=Math.max(1,u.max.mp);runModify(s,[p.id],'双生果',[{stat:'max_hp',multiplier:mp/hp},{stat:'max_mp',multiplier:hp/mp}]);return true;}
  case 'stairs':{if(result.skipNext)s.skipNextFloorFights=true;const thing=s.region.things.find(t=>t.id===ev.thingId);if(thing)thing.used=true;s.eventState=undefined;s.mode='explore';newDepth(s,s.depth+1);return true;}
  case 'chest_spawn':{const spot=[[1,0],[-1,0],[0,1],[0,-1],[2,0],[0,2]].map(([dx,dz])=>({x:s.x+dx!,z:s.z+dz!})).find(p=>walkable(s.region,p.x,p.z)&&!s.region.things.some(o=>!o.used&&o.x===p.x&&o.z===p.z));if(spot)s.region.things.push({id:ev.thingId+':chest',kind:'chest',x:spot.x,z:spot.z,name:'封存的宝匣',used:false,foes:[]});return true;}
  case 'withdraw':{const thing=s.region.things.find(t=>t.id===ev.thingId);if(thing)thing.used=true;s.eventState=undefined;s.mode='explore';withdraw(s);return true;}
  default:return false;
 }
}
function eventPickChoice(s:State,choice:number|string){
 const pick=s.eventPick!,ev=s.eventState!;const id=typeof choice==='number'?(pick.options[choice]?.id??(pick.kind==='skills'&&choice===pick.options.length?'confirm':'')):choice;if(!id)return;
 if(pick.kind==='skills'){if(id==='confirm'){if(pick.selected.length<1)return;s.sealedSkills??={};s.sealedSkills[pick.owner!]=[...new Set([...(s.sealedSkills[pick.owner!]??[]),...pick.selected])];s.eventPick=undefined;rebuildWorld(s);note(s,`封印了 ${pick.selected.length} 个技能，全属性 +${pick.selected.length*10}%。`);nextEventResult(s);return;}if(!pick.options.some(o=>o.id===id))return;pick.selected=pick.selected.includes(id)?pick.selected.filter(x=>x!==id):pick.selected.length<pick.max?[...pick.selected,id]:pick.selected;return;}
 if(!pick.options.some(o=>o.id===id))return;
 if(pick.kind==='member'){const member=s.party.find(p=>p.id===id)!;
  if(pick.mode==='seal'){const own=member.card.skills.filter(k=>!/^(relic\/|item-|booksea:|\/道具|seal-bonus|potion:)/.test(k.sourceId)&&!(s.sealedSkills?.[member.id]??[]).includes(k.sourceId));s.eventPick={kind:'skills',mode:'seal',owner:member.id,options:own.map(k=>({id:k.sourceId,label:k.name,description:k.mapping.disposition==='passive'?'被动':'主动'})),max:3,selected:[]};return;}
  if(pick.mode==='train'){s.battleMods??=[];s.battleMods.push({fights:3,member:member.id,memberDamage:1.5,memberSpeed:.7});note(s,member.name+'：接下来 3 场伤害 ×1.5、速度 ×0.7。');}
  if(pick.mode==='bloodpact'){runModify(s,[member.id],'血契',[{stat:'max_hp',multiplier:.7}]);grantFp(s,2500,'血契');}
  if(pick.mode==='exit'){const others=activeParty(s).filter(p=>p.id!==member.id).map(p=>p.id);storeWorld(s);s.run=exitMembers(s.run,[{ref:ref(member),reason:'voluntaryExit'}]);clearTemporary(s,member);if(others.length)runModify(s,others,'空椅子',ATTRS.map(stat=>({stat,multiplier:(pick.payload as {attrs?:number})?.attrs??1.15})));note(s,member.name+' 坐上了空椅子，先行离开。');if(s.run.status!=='active'){s.eventPick=undefined;s.eventState=undefined;finish(s);return;}}
  s.eventPick=undefined;nextEventResult(s);return;}
 if(pick.kind==='relic'){const [owner,relicId]=id.split('|') as [string,string];const def=RELIC_CATALOG[relicId]!;
  if(pick.mode==='transform'){dropOwned(s,owner,relicId);const pool=RELIC_LIST.filter(r=>r.rarity===def.rarity&&r.id!==relicId&&relicUnavailable(s,r.id,owner)==='');if(pool.length){const next=pool[Math.floor(rng(s)*pool.length)]!;s.ownedRelics!.push({id:next.id,owner,stacks:1});s.relics=[...new Set(s.ownedRelics!.map(x=>x.id))];if(next.grantFp)grantFp(s,next.grantFp,next.name);note(s,`${def.name} 变成了 ${next.name}。`);}else note(s,def.name+' 消散了，没有别的遗物愿意成形。');rebuildWorld(s);}
  if(pick.mode==='sacrifice'){if(!def.droppable){note(s,def.name+' 不可丢弃。');return;}dropOwned(s,owner,relicId);runModify(s,activeParty(s).map(p=>p.id),'无人祭坛',ATTRS.map(stat=>({stat,multiplier:(pick.payload as {attrs?:number})?.attrs??1.1})));rebuildWorld(s);note(s,`献祭了 ${def.name}，全队全属性 +10%。`);}
  if(pick.mode==='sell'){if(!def.droppable){note(s,def.name+' 不可丢弃。');return;}dropOwned(s,owner,relicId);rebuildWorld(s);grantFp(s,def.rarity*((pick.payload as {perRarity?:number})?.perRarity??500),'弃牌');note(s,`卖掉了 ${def.name}。`);}
  if(pick.mode==='copy'){const to=activeParty(s).find(p=>p.id!==owner&&relicUnavailable(s,relicId,p.id)==='');if(!to){note(s,'没有队友能接下这件遗物。');return;}s.ownedRelics!.push({id:relicId,owner:to.id,stacks:1});rebuildWorld(s);note(s,`${to.name} 得到了一件相同的 ${def.name}。`);}
  s.eventPick=undefined;nextEventResult(s);return;}
}
/** 传唤铃：在当前位置旁呼出一名补给员（限用次数由事件给出）。 */
export function ringBell(s:State){if(s.mode!=='explore'||s.paused)return;if(!(s.bell??0)){note(s,'没有可用的传唤铃。');return;}const spot=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dz])=>({x:s.x+dx!,z:s.z+dz!})).find(p=>walkable(s.region,p.x,p.z)&&!s.region.things.some(o=>!o.used&&o.x===p.x&&o.z===p.z));if(!spot){note(s,'这里太挤，补给员过不来。');return;}s.bell!--;s.region.things.push({id:s.region.id+':bell:'+s.bell,kind:'supplier',x:spot.x,z:spot.z,name:SUPPLIER_NAME,used:false,foes:[]});note(s,`铃声响过，补给员出现在旁边（剩余 ${s.bell} 次）。`);}
