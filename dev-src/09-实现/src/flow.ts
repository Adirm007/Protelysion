/** Library entry only. No auto-mount, default actors, game entry, host write or LLM call on import. */
export {newRun,exitMembers,settlementProposal,awardVictory,addReward} from './core/run';
export {actorAt,actorKey} from './core/actors';
export {failureNotice} from './core/failure';
export {handoffFailure,createTavernHandoffPort} from './host/tavern-handoff';
export * from './battle/clock';
export * from './battle/damage';
export {createCompilationEngine,validateCompiled,preflight,CompilationBlocked,COMPILER_ID} from './compiler/engine';
export {EFFECT_VERSION,ModelReply,Action,validateAction,CAPABILITIES} from './compiler/contract';
export {createBattle,advanceBattle,chooseAction,resolveAction,interruptAction,assertExecutable,EXECUTORS} from './battle/executor';
export {helperCompilerModel} from './host/compiler';
export {compileActorInChat} from './host/compile-actor';
export {compileOnUserAction,assertEntry,inspectCache,combatProjection} from './core/cache';
export {chatCacheStore} from './host/chat-cache';
export {BRIDGE_VERSION,Intent,PresentationMessage,BattleView,decodeIntent} from './presentation/protocol';
export {BattleBridge} from './presentation/battle-bridge';
export {mountSamePageBridge,bindBridgeLifecycle} from './presentation/same-page';
export {RosterView} from './presentation/roster-contract';
export {RosterBridge} from './presentation/roster-bridge';
export {projectRoster,selectRoster,createRosterReader,rosterHostFromGlobals} from './host/roster';

export {Library,Status,CoreAction,Targeting,Trigger,Condition,Modifier,EMPTY_LIBRARY} from './compiler/contract';
export {HOST_RULES,relevantRules} from './compiler/rules';
export {applyBattleEffects,dispatchBattleEvent,advanceExplorationEffects,persistentUnit,legalTargets,actionUnavailable,costFor,withdrawEnemy} from './battle/executor';
export {ABILITY_SAMPLES,RELIC_CATALOG,EVENT_CATALOG,mechanismLibrary} from './game/mechanism-content';
export {startExpedition,restoreExpedition,view,tick,tickExploration,eventChoice,acquireRelic,removeRelic,useOutsideBattle,chooseSkill,chooseTarget,flee,withdraw} from './game/expedition';
export {sessionPort,compileHostMember,enterHostExpedition,checkpointHost} from './host/game-session';
