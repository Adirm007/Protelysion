import {finite,integer} from '../core/actors';
export type ClockUnit={id:string;side:'ally'|'enemy';agility:number;speedBonus:number;haste:number;active:boolean;stopped?:boolean;atb:number;recoveryMs:number;cast:null|{commandId:string;remainingMs:number;recoveryFactor:number};actionsCompleted:number};
export type ClockEvent={kind:'ready';unitId:string}|{kind:'resolve';unitId:string;commandId:string;recoveryFactor:number};
export type BattleClock={version:1;timeMs:number;paused:boolean;ended:boolean;units:ClockUnit[];pending:ClockEvent[]};
const EPS=1e-7;
export function speedFactor(u:Pick<ClockUnit,'agility'|'speedBonus'|'haste'>):number {
 const value=Math.sqrt(Math.max(finite(u.agility,'敏捷')+finite(u.speedBonus,'速度修正'),1)/10)*finite(u.haste,'急速倍率');
 if(value<=0||!Number.isFinite(value))throw Error('速度倍率必须为有限正数');return value;
}
export function createClock(units:Pick<ClockUnit,'id'|'side'|'agility'|'speedBonus'|'haste'>[]):BattleClock {
 if(units.length<2||new Set(units.map(u=>u.id)).size!==units.length||units.some(u=>!u.id||!['ally','enemy'].includes(u.side)))throw Error('战场成员非法');
 if(!units.some(u=>u.side==='ally')||!units.some(u=>u.side==='enemy'))throw Error('缺少敌我一方');
 units.forEach(speedFactor);
 return {version:1,timeMs:0,paused:false,ended:false,units:units.map(u=>({...u,active:true,atb:0,recoveryMs:0,cast:null,actionsCompleted:0})),pending:[]};
}
export function clockPhase(c:BattleClock):'ended'|'paused'|'menu'|'resolving'|'flowing' {
 if(c.ended)return 'ended';if(c.paused)return 'paused';const e=c.pending[0];
 return e?(e.kind==='ready'&&c.units.find(u=>u.id===e.unitId)!.side==='ally'?'menu':'resolving'):'flowing';
}
function requireHead(c:BattleClock,id:string,kind:ClockEvent['kind']):void {
 if(c.ended||c.paused||c.pending[0]?.unitId!==id||c.pending[0].kind!==kind)throw Error('当前行动权不属于此成员或战斗已暂停/结束');
}
/** Advance only simulation time up to the next decision/resolution boundary. Animation elapsed time must not be fed back as a catch-up budget. */
export function advanceClock(clock:BattleClock,budgetMs:number):{clock:BattleClock;consumedMs:number} {
 finite(budgetMs,'规则时间');if(budgetMs<0)throw Error('规则时间不得倒流');
 const c=structuredClone(clock);if(clockPhase(c)!=='flowing')return {clock:c,consumedMs:0};
 let left=budgetMs,consumed=0;
 while(true){
  const actors=c.units.filter(u=>u.active&&!u.stopped);if(!actors.length){c.timeMs+=left;return {clock:c,consumedMs:consumed+left};}
  const eventIn=(u:ClockUnit)=>u.cast?u.cast.remainingMs:u.recoveryMs>EPS?u.recoveryMs:(100-u.atb)/(speedFactor(u)/40);
  const next=Math.max(0,Math.min(...actors.map(eventIn))),dt=Math.min(left,next);
  for(const u of actors){if(u.cast)u.cast.remainingMs=Math.max(0,u.cast.remainingMs-dt);else if(u.recoveryMs>EPS)u.recoveryMs=Math.max(0,u.recoveryMs-dt);else u.atb=Math.min(100,u.atb+dt*speedFactor(u)/40);}
  c.timeMs+=dt;consumed+=dt;left-=dt;
  // Fixed sort: completed casts first, then original roster order. Simultaneous readiness is never discarded.
  const resolves:ClockEvent[]=[],ready:ClockEvent[]=[];
  for(const u of actors){if(u.cast&&u.cast.remainingMs<=EPS){resolves.push({kind:'resolve',unitId:u.id,commandId:u.cast.commandId,recoveryFactor:u.cast.recoveryFactor});u.cast=null;}else if(!u.cast&&u.recoveryMs<=EPS&&u.atb>=100-EPS){u.atb=100;ready.push({kind:'ready',unitId:u.id});}}
  c.pending.push(...resolves,...ready);
  if(c.pending.length||left<=EPS)return {clock:c,consumedMs:consumed};
 }
}
export function submitAction(clock:BattleClock,unitId:string,command:{id:string;castMs:number;recoveryFactor:number}):BattleClock {
 requireHead(clock,unitId,'ready');finite(command.castMs,'施法时间');finite(command.recoveryFactor,'恢复系数');
 if(!command.id||command.castMs<0||command.recoveryFactor<0)throw Error('行动参数非法');
 const c=structuredClone(clock),u=c.units.find(u=>u.id===unitId)!;c.pending.shift();u.atb=0;
 if(command.castMs>EPS)u.cast={commandId:command.id,remainingMs:command.castMs,recoveryFactor:command.recoveryFactor};
 else c.pending.unshift({kind:'resolve',unitId,commandId:command.id,recoveryFactor:command.recoveryFactor});
 return c;
}
function recover(u:ClockUnit,factor:number):void {u.atb=Math.max(0,100*(1-factor));u.recoveryMs=Math.max(0,factor-1)*4000/speedFactor(u);}
/** Call after the effect executor has resolved the action, not after the animation finishes. */
export function completeAction(clock:BattleClock,commandId:string):BattleClock {
 const e=clock.pending[0];if(!e||e.kind!=='resolve'||e.commandId!==commandId)throw Error('待结算命令不匹配');requireHead(clock,e.unitId,'resolve');
 const c=structuredClone(clock),u=c.units.find(u=>u.id===e.unitId)!;c.pending.shift();recover(u,e.recoveryFactor);u.actionsCompleted++;return c;
}
export function interruptCast(clock:BattleClock,unitId:string):BattleClock {
 const c=structuredClone(clock),u=c.units.find(u=>u.id===unitId);if(!u?.cast)throw Error('没有可打断的施法');
 recover(u,u.cast.recoveryFactor);u.cast=null;return c;
}
export function deactivateUnit(clock:BattleClock,unitId:string):BattleClock {
 const c=structuredClone(clock),u=c.units.find(u=>u.id===unitId);if(!u)throw Error('成员不存在');
 u.active=false;u.cast=null;c.pending=c.pending.filter(e=>e.unitId!==unitId);return c;
}
/** Strictly restore the clock schema; effect/RNG/world state is saved by the enclosing battle, not invented here. */
export function restoreClock(value:BattleClock):BattleClock {
 const c=structuredClone(value);if(c.version!==1||typeof c.paused!=='boolean'||typeof c.ended!=='boolean')throw Error('时钟存档格式不兼容');
 finite(c.timeMs,'时钟');if(c.timeMs<0)throw Error('时钟非法');createClock(c.units);
 for(const u of c.units){finite(u.atb,'ATB');finite(u.recoveryMs,'恢复时间');integer(u.actionsCompleted,'已完成行动');if(u.atb<0||u.atb>100||u.recoveryMs<0||typeof u.active!=='boolean')throw Error('时钟成员非法');if(u.cast){finite(u.cast.remainingMs,'剩余施法');finite(u.cast.recoveryFactor,'恢复系数');if(!u.cast.commandId||u.cast.remainingMs<0||u.cast.recoveryFactor<0)throw Error('施法存档非法');}}
 if(new Set(c.pending.map(e=>e.unitId)).size!==c.pending.length)throw Error('重复行动权');
 for(const e of c.pending){const u=c.units.find(u=>u.id===e.unitId);if(!u?.active||u.cast)throw Error('行动权成员非法');if(e.kind==='ready'){if(u.atb!==100)throw Error('就绪槽不满');}else if(e.kind==='resolve'){if(!e.commandId||finite(e.recoveryFactor,'恢复系数')<0)throw Error('待结算行动非法');}else throw Error('未知行动类型');}
 return c;
}
