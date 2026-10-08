import {restoreExpedition,type State} from '../game/expedition';
/** The chat record authorizes the run. Local storage is an optional fresher copy,
 * never permission to revive a cleared, unrelated or other-chat expedition. */
export function resumeHostExpedition(active:unknown,readLocal:()=>string|null,contextId:string,authorizedFrames?:string[]):State{
 if(!active||typeof active!=='object')throw Error('当前聊天没有未结束的远征');
 const saved=restoreExpedition(active as State);
 if(saved.source!=='host'||saved.hostContext!==contextId)throw Error('这份存档属于另一聊天');
 if(saved.mode==='ended')throw Error('当前聊天没有未结束的远征');
 try{
  const raw=readLocal(),candidate=raw?JSON.parse(raw) as State:undefined;
  if(candidate?.run?.id===saved.run.id&&candidate.source==='host'&&candidate.hostContext===contextId&&(!authorizedFrames||!!candidate.hostSave&&authorizedFrames.includes(candidate.hostSave.frame))&&(!saved.hostSave||!!candidate.hostSave&&candidate.hostSave.revision>=saved.hostSave.revision))return restoreExpedition(candidate);
 }catch{/* Blocked storage, malformed JSON or an invalid local copy must not hide a valid chat save. */}
 return saved;
}
