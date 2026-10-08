/** Visible requests are plain language. Technical identity and facts live in message.extra. */
import {unwrapMessageExtra} from './message-extra';
export const ENTRY_REQUEST = '进入普罗泰利西翁';
export const EXIT_REQUEST = '离开普罗泰利西翁';
export type ExitMeta = {version:2;kind:'exit';contextId:string;runId:string;status:'success'|'failed';summary:string};
/** 0.40 正文模式：切回正文与“进入下一层”的可见请求；断点与楼层信息放在 message.extra 与消息变量 bookseaPromptHandoff 里供读者 EJS 读取。 */
export const NARRATIVE_REQUEST = '普罗泰利西翁正文模式';
export const NARRATIVE_DESCEND = '前往下一层（普罗泰利西翁正文模式）';
export type NarrativeMeta = {version:2;kind:'narrative'|'narrative-descend';contextId:string;runId:string;depth:number;summary:string};
export function narrativeExtra(contextId:string,runId:string,kind:NarrativeMeta['kind'],depth:number,summary:string):{bookseaHandoff:NarrativeMeta}{
 return {bookseaHandoff:{version:2,kind,contextId,runId,depth,summary}};
}
export function narrativePromptData(data:Record<string,unknown>,extra:{bookseaHandoff:NarrativeMeta}):Record<string,unknown>{
 const {bookseaPromptHandoff:_previous,...rest}=data;return {...rest,bookseaPromptHandoff:structuredClone(extra.bookseaHandoff)};
}
export type HandoffMessage = {role:string;message:string;message_id?:number;extra?:Record<string,unknown>};
export function exitExtra(contextId:string,runId:string,status:'success'|'failed',summary:string):{bookseaHandoff:ExitMeta}{
 return {bookseaHandoff:{version:2,kind:'exit',contextId,runId,status,summary}};
}
export function exitMeta(message:HandoffMessage):ExitMeta|undefined{
 const value=unwrapMessageExtra(message.extra).bookseaHandoff as Partial<ExitMeta>|undefined;
 return value?.version===2&&value.kind==='exit'&&typeof value.contextId==='string'&&typeof value.runId==='string'&&typeof value.summary==='string'&&['success','failed'].includes(String(value.status))?value as ExitMeta:undefined;
}
export function sameExit(message:HandoffMessage,contextId:string,runId:string){const value=exitMeta(message);return value?.contextId===contextId&&value.runId===runId;}

/** EJS has native message-variable APIs, not the iframe's TavernHelper object or message.extra. */
export function exitPromptData(data:Record<string,unknown>,extra:Record<string,unknown>):Record<string,unknown> {
 const {bookseaPromptHandoff:_previous,...rest}=data;
 const meta=exitMeta({role:'user',message:EXIT_REQUEST,extra});
 return {...rest,...(meta?{bookseaPromptHandoff:structuredClone(meta)}:{})};
}
