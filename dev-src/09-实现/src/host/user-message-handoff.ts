import type {NarrativeMeta} from '../core/handoff-message';
import {readMessageExtra} from '../core/message-extra';
import type {State} from '../game/expedition';
import type {SessionPort} from './game-session';
import {prepareUserNarrative,attachUserNarrative} from './narrative-mode';

type Runtime={isPlaying():boolean;captureForNarrative():Promise<State|undefined>;acceptNarrative(s:State):void;cancelNarrativeCapture?():void};
type Pending={head:number;native:any;swipe:unknown;ready:Promise<void>;state?:State;meta?:NarrativeMeta};
type Delivered={messageId:number;runId:string;finished:unknown};
function draft(globals:any):string{
 for(const w of [globals.parent,globals])try{const input=w?.document?.getElementById?.('send_textarea');if(input&&typeof input.value==='string')return input.value;}catch{/* The next accessible host surface is sufficient. */}
 return '';
}

/** SillyTavern 1.19.0 (7e8663c): Generate awaits AFTER_COMMANDS before reading
 * the textarea (script.js:4321/4407), then sendMessageAsUser appends and awaits
 * MESSAGE_SENT (5917), before world-info/prompt construction. Listen directly
 * to the exposed native eventSource so both asynchronous commits are awaited.
 * No global API patch, synthetic message, or second generation is involved. */
export function mountUserMessageHandoff(globals:any,port:SessionPort,options:{runtime():Runtime|undefined;onHandoff?():void;onError?(error:unknown):void;readDraft?():string}){
 const context=()=>globals.SillyTavern.getContext(),initial=context(),source=initial.eventSource,events=initial.eventTypes??globals.tavern_events;
 if(!source?.makeFirst||!source?.removeListener||!events?.GENERATION_AFTER_COMMANDS||!events?.MESSAGE_SENT)return {dispose(){}};
 const identity=()=>`${context().characterId}:${context().getCurrentChatId()}`,pinned=identity();
 let disposed=false,pending:Pending|undefined,cancelling:Promise<void>|undefined,delivered:Delivered|undefined;
 const current=()=>!disposed&&identity()===pinned;
 const finished=()=>{const row=context().chat?.at(-1);return row?.swipe_info?.[row?.swipe_id??0]?.gen_finished??row?.gen_finished;};
 const fail=(error:unknown)=>{options.onError?.(error);if(current())context().stopGeneration?.();};
 const before=async(type:string|undefined,option:{automatic_trigger?:boolean;depth?:number}={},dryRun=false)=>{
  if(cancelling)await cancelling;
  if(current()&&!dryRun){
   delivered=undefined;
   // Retrying prose has its own lifecycle even though the game remains hidden.
   // A successful retry replaces only this selected reply's interruption mark.
   if(!option.automatic_trigger&&[undefined,'normal','swipe','regenerate','continue'].includes(type)){
    const s=(port.chat().booksea as {activeExpedition?:State}|undefined)?.activeExpedition,n=s?.narrative;
    if(s&&n?.active&&n.transition==='user-message'&&Number.isSafeInteger(n.messageId))delivered={messageId:n.messageId!,runId:s.run.id,finished:finished()};
   }
  }
  if(!current()||dryRun||option.automatic_trigger||option.depth||type!==undefined&&type!=='normal')return;
  const text=(options.readDraft?.()??draft(globals)).trim();if(!text||text.startsWith('/'))return;
  const runtime=options.runtime();if(!runtime?.isPlaying())return;
  if(pending)return pending.ready;
  const rows=context().chat,head=rows.length-1,native=rows[head];
  const item:Pending={head,native,swipe:native?.swipe_id,ready:Promise.resolve()};pending=item;
  // captureForNarrative freezes before returning its promise. No interval can
  // invalidate/stop the live encounter while native saveChat awaits below.
  const capture=runtime.captureForNarrative();
  item.ready=(async()=>{
   const s=await capture;if(!s){if(pending===item)pending=undefined;return;}
   if(!current()||context().chat[head]!==native||native?.swipe_id!==item.swipe)throw Error('聊天或候选已变化，已暂停旧现场');
   item.state=s;item.meta=await prepareUserNarrative(port,s);if(!current())throw Error('聊天已切换，未应用正文交接');
  })();
  try{await item.ready;}catch(error){fail(error);throw error;}
 };
 const sent=async(messageId:number)=>{
  const item=pending;if(!item||!current())return;
  await item.ready;if(!item.state||!item.meta||pending!==item||!current())return;
  const rows=context().chat,row=rows[messageId],extra=readMessageExtra(row?.extra,row);
  // Only the one newly appended original user message can receive this handoff.
  // Program-owned entry/exit/narrative requests carry their own metadata.
  if(messageId!==item.head+1||messageId!==rows.length-1||!(row?.is_user===true||row?.role==='user')||row?.is_system||extra.bookseaHandoff)return;
  if(rows[item.head]!==item.native||item.native?.swipe_id!==item.swipe){const error=Error('原楼层已回退，未应用旧现场');fail(error);throw error;}
  try{await attachUserNarrative(port,item.state,item.meta);if(!current())return;options.runtime()?.acceptNarrative(item.state);pending=undefined;delivered={messageId,runId:item.state.run.id,finished:finished()};options.onHandoff?.();}
  catch(error){fail(error);throw error;}
 };
 const changed=()=>{pending=undefined;delivered=undefined;};
 const interrupted=async()=>{
  const owner=delivered;delivered=undefined;if(!owner||!current())return;
  try{await port.markNarrativeInterrupted?.(owner.messageId,owner.runId);}catch(error){options.onError?.(error);}
 };
 const ended=async()=>{
  if(delivered){
   const owner=delivered,processor=context().streamingProcessor;
   if(processor?.isStopped||processor?.abortController?.signal?.aborted)await interrupted();
   else{
    delivered=undefined;
    const next=finished();if(next&&String(next)!==String(owner.finished)&&(!processor||processor.isFinished))try{await port.markNarrativeCompleted?.(owner.messageId,owner.runId);}catch(error){options.onError?.(error);}
   }
  }
  const item=pending;if(!item)return;pending=undefined;
  if(!current())return;
  const rows=context().chat;
  if(rows.length-1!==item.head||rows[item.head]!==item.native||item.native?.swipe_id!==item.swipe)return;
  const job=(async()=>{
   try{
    // The preview was never a checkpoint: rebuilding the unchanged old frame
    // removes it. Re-enable capture only after that rebuild has completed.
    await item.ready.catch(()=>{});await port.prepare?.();if(!current())return;
    options.runtime()?.cancelNarrativeCapture?.();
   }catch(error){options.onError?.(error);}
  })();
  cancelling=job;try{await job;}finally{if(cancelling===job)cancelling=undefined;}
 };
 const stopped=async()=>{await interrupted();await ended();};
 source.makeFirst(events.GENERATION_AFTER_COMMANDS,before);source.makeFirst(events.MESSAGE_SENT,sent);
 if(events.CHAT_CHANGED)source.makeFirst(events.CHAT_CHANGED,changed);
 if(events.GENERATION_ENDED)source.makeFirst(events.GENERATION_ENDED,ended);
 if(events.GENERATION_STOPPED)source.makeFirst(events.GENERATION_STOPPED,stopped);
 return {dispose(){disposed=true;pending=undefined;delivered=undefined;source.removeListener(events.GENERATION_AFTER_COMMANDS,before);source.removeListener(events.MESSAGE_SENT,sent);if(events.CHAT_CHANGED)source.removeListener(events.CHAT_CHANGED,changed);if(events.GENERATION_ENDED)source.removeListener(events.GENERATION_ENDED,ended);if(events.GENERATION_STOPPED)source.removeListener(events.GENERATION_STOPPED,stopped);}};
}
