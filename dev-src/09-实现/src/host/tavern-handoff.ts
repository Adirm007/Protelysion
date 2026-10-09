import type { Obj } from '../core/actors';
import {exitPromptData,type HandoffMessage} from '../core/handoff-message';
import { handoffFailure, type FailureRequest, type HandoffPort } from './failure-handoff';

/** Real Helper/MVU adapter. All writes are explicit; importing this module performs no writes. */
export function createTavernHandoffPort(env: {
  context():{chatId?:string;characterId?:string|number;saveChat():Promise<unknown>};
  helper:{getLastMessageId():number;getVariables(o:Obj):Obj;updateVariablesWith(fn:(v:Obj)=>Obj,o:Obj):unknown;getChatMessages(range:string):HandoffMessage[];createChatMessages(messages:{role:'user';message:string;extra?:Obj;data?:Obj}[]):Promise<unknown>};
  mvu:{getMvuData(o:Obj):Obj;replaceMvuData(v:Obj,o:Obj):Promise<unknown>};
  locks:{request<T>(key:string,fn:()=>Promise<T>):Promise<T>};
}):HandoffPort {
  const id=()=>{const c=env.context();if(!c.chatId||c.characterId===undefined)throw Error('未选择独立角色聊天');return `${c.characterId}:${c.chatId}`;};
  if(!env.locks?.request)throw Error('缺少跨iframe互斥锁，禁止不安全写入');
  const pinned=id();const assert=()=>{if(id()!==pinned)throw Error('聊天已切换');};
  const save=async()=>{assert();await env.context().saveChat();assert();};
  return {
    contextId:id,latestMessageId:()=>env.helper.getLastMessageId(),
    readChat:()=>{assert();return env.helper.getVariables({type:'chat'});},
    async updateChat(fn){assert();await env.helper.updateVariablesWith(fn,{type:'chat'});await save();},
    readMvu(messageId){assert();return env.mvu.getMvuData({type:'message',message_id:messageId});},
    async writeMvu(messageId,v){assert();await env.mvu.replaceMvuData(v,{type:'message',message_id:messageId});await save();},
    userMessages:()=>{assert();return env.helper.getChatMessages(`0-${env.helper.getLastMessageId()}`).filter(m=>m.role==='user');},
    async sendUser(message,extra){assert();const data=env.mvu.getMvuData({type:'message',message_id:env.helper.getLastMessageId()});await env.helper.createChatMessages([{role:'user',message,extra,data:exitPromptData(data,extra)}]);await save();},
    lock:(key,fn)=>env.locks.request(key,fn),
  };
}
export {handoffFailure};
export type {FailureRequest};
