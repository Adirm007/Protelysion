import type {CompiledActor} from '../compiler/engine';
import {object,type Obj} from '../core/actors';
import type {DurationSpec} from '../compiler/contract';
export function remainingDuration(raw:string):DurationSpec|undefined {
 if(/永久|无限|长期/.test(raw))return {clock:'permanent',value:0};
 const parts=[...raw.matchAll(/([\d.]+)\s*(毫秒|ms|回合|次行动|秒|分钟|分|小时|时|天)/gi)];if(!parts.length)return;
 const turns=parts.filter(p=>p[2]==='回合'||p[2]==='次行动');if(turns.length&&turns.length!==parts.length)return;
 const value=parts.reduce((n,p)=>n+Number(p[1])*(turns.length?1:({'毫秒':1,ms:1,'秒':1000,'分钟':60000,'分':60000,'小时':3600000,'时':3600000,'天':86400000}[p[2]!.toLowerCase()]!)),0);
 return {clock:turns.length?'target_action':'battle_time',value:Math.ceil(value)};
}
export function bindInitialStates(card:CompiledActor,actor:Obj){
 const states=object(actor.状态效果);
 for(const skill of card.skills.filter(s=>s.sourceId.startsWith('/状态定义/'))){const source=states[skill.name];if(!source||object(source).层数===0){skill.mapping.action=null;skill.mapping.disposition='noncombat';continue;}const raw=object(source),a=skill.mapping.action;if(!a)continue;const duration=remainingDuration(String(raw.剩余时间??''));
  for(const e of a.effects)if(e.op==='apply_status'){if(duration)e.duration=duration;e.stacks=Number(raw.层数??1);const d=a.library!.statuses[e.status]!;d.scope='host';d.maxStacks=Math.max(d.maxStacks,e.stacks);if(duration)d.duration=duration;}
 }
}
