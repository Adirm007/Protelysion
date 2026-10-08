import type {ActorRef,Obj} from '../core/actors';
import {object} from '../core/actors';
import {ENTRY_REQUEST} from '../core/handoff-message';
export function entryNotice(_refs:ActorRef[],_depth:number,_id:string){return ENTRY_REQUEST;}
export function requireNarrativeConnection(context:{onlineStatus?:string}){if(context.onlineStatus==='no_connection')throw Error('正文模型未连接，请先连接酒馆API后重试交接。');}
/** The one narrative trigger is explicit and journaled alongside the already committed session, not part of combat effects. */
export async function requestNarrativeOnce(h:any,context:any,key:string){
 const chat=h.getVariables({type:'chat'}),b=object(chat.booksea??{}),requests=object(b.narrativeRequests??{});if(requests[key]&&requests[key]!=='failed')return;requireNarrativeConnection(context);
 await h.updateVariablesWith((v:Obj)=>({...v,booksea:{...object(v.booksea??{}),narrativeRequests:{...object(object(v.booksea??{}).narrativeRequests??{}),[key]:'requested'}}}),{type:'chat'});await context.saveChat();
 const before=h.getLastMessageId();let failure:unknown;
 try{await h.triggerSlash('/trigger await=true');}catch(error){failure=error;}
 const last=h.getChatMessages(-1)[0],delivered=h.getLastMessageId()>before&&last?.role==='assistant'&&String(last.message).trim().length>0;
 await h.updateVariablesWith((v:Obj)=>({...v,booksea:{...object(v.booksea??{}),narrativeRequests:{...object(object(v.booksea??{}).narrativeRequests??{}),[key]:delivered?'delivered':'failed'}}}),{type:'chat'});await context.saveChat();
 if(!delivered)throw failure??Error('未生成正文；宿主结算保留，可显式补写，不会自动重试。');
 if(failure)throw failure;
}
