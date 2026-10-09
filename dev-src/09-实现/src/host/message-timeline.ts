import {canonical} from '../core/cache';
import {readMessageExtra,writeNativeMessageExtra} from '../core/message-extra';
import type {Obj} from '../core/actors';
export type HostSaveStamp={frame:string;revision:number};
// Runtime saves have optional undefined fields; JSON storage omits these by contract.
const comparable=(value:unknown)=>canonical(JSON.parse(JSON.stringify(value)));
const FRAME='bookseaFrameV1', SNAPSHOT='bookseaCheckpointV1', REF='bookseaProgressRef';
const FIELDS=['activeExpedition','lastExpedition','unlockedIds','exitDeliveries','narrativeRequests','failureHandoff','activeRun','lastEndedRun','endings'] as const;
const rec=(v:unknown):Obj=>v&&typeof v==='object'&&!Array.isArray(v)?v as Obj:{};
function progress(book:Obj):Obj {const out:Obj={activeExpedition:null,lastExpedition:null,unlockedIds:['depth-1'],exitDeliveries:{},narrativeRequests:{},failureHandoff:null,activeRun:null,lastEndedRun:null,endings:{}};for(const k of FIELDS)if(book[k]!==undefined)out[k]=structuredClone(book[k]);return out;}
function stampRuns(value:Obj,stamp:HostSaveStamp){for(const key of ['activeExpedition','lastExpedition'])if(value[key]&&typeof value[key]==='object')(value[key] as Obj).hostSave={...stamp};}
/** Full saves live in the owning message's extra, which MVU does not copy to every
 * response. Message variables carry only a small reference. Chat metadata is a
 * rebuildable mirror/index, NEVER authority after deleting a message. */
export function createMessageTimeline(globals:any){
  const raw=globals.TavernHelper??globals,context=()=>globals.SillyTavern.getContext();
  const identity=()=>`${context().characterId}:${context().getCurrentChatId()}`,pinned=identity();
  let head=-2,frame='',native:any,swipe:unknown,prepared=false,preparing:Promise<void>|undefined,own=0;
  let current:Obj=progress({}),currentReceipts:Obj={},sourceFrame='',sourceRevision=0;
  const last=()=>Number(raw.getLastMessageId());
  const assertContext=()=>{if(identity()!==pinned)throw Error('聊天已切换，拒绝写入另一聊天');};
  const message=(id:number)=>{const rows=raw.getChatMessages(id);const row=rows?.find((r:any)=>r.message_id===id)??rows?.[id]??(rows?.length===1?rows[0]:undefined);if(!row)throw Error('聊天楼层已变化，请重新打开书海');return {...row,extra:readMessageExtra(row.extra,nativeAt(id))};};
  const nativeAt=(id:number)=>Array.isArray(context().chat)?context().chat[id]:undefined;
  const rawChat=()=>raw.getVariables({type:'chat'}) as Obj;
  function valid(expected?:HostSaveStamp){
    if(!prepared||identity()!==pinned||last()!==head)return false;
    const now=nativeAt(head);if(native&&(now!==native||now?.swipe_id!==swipe||rec(now.extra)[FRAME]!==frame))return false;
    return !expected||expected.frame===frame;
  }
  function assertFrame(expected?:HostSaveStamp){assertContext();if(!valid(expected))throw Error('聊天楼层已回退或变化，旧旅程不能写入；请从当前楼层继续');}
  function findSnapshot(token:string,index:Obj[]):{id:number;data:Obj}|undefined {
    const entry=index.find(x=>x.token===token);const candidates:number[]=[];
    if(entry&&Number(entry.messageId)<=last())candidates.push(Number(entry.messageId));
    const rows=context().chat;
    if(Array.isArray(rows))for(let i=rows.length-1;i>=0;i--)if(rec(rec(rows[i]?.extra)[SNAPSHOT]).token===token&&!candidates.includes(i)){candidates.push(i);break;}
    for(const id of candidates){try{const data=rec(rec(message(id).extra)[SNAPSHOT]);if(data.version===1&&data.contextId===pinned&&data.token===token)return {id,data};}catch{}}
    return;
  }
  function resolve(vars:Obj,chat:Obj,ownSnapshot:Obj):{value:Obj;token:string;revision:number;receipts:Obj}{
    const book=rec(chat.booksea),ref=rec(vars[REF]),index=Array.isArray(book.timelineIndex)?book.timelineIndex.map(rec):[];
    if(ref.version===1&&ref.contextId===pinned){
      if(ref.token===null)return {value:progress({}),token:'',revision:0,receipts:{}};
      const found=findSnapshot(String(ref.token),index);
      if(found)return {value:progress(rec(found.data.progress)),token:String(found.data.token),revision:Number(found.data.revision)||0,receipts:rec(found.data.receipts)};
      // A removed checkpoint cannot be resurrected from a global mirror or localStorage.
      return {value:progress({}),token:'',revision:0,receipts:{}};
    }
    if(book.timelineVersion===1){
      if(ownSnapshot.version===1&&ownSnapshot.contextId===pinned)return {value:progress(rec(ownSnapshot.progress)),token:String(ownSnapshot.token),revision:Number(ownSnapshot.revision)||0,receipts:rec(ownSnapshot.receipts)};
      for(const entry of [...index].filter(x=>Number(x.messageId)<=last()).sort((a,b)=>Number(b.messageId)-Number(a.messageId))){const found=findSnapshot(String(entry.token),index);if(found)return {value:progress(rec(found.data.progress)),token:String(found.data.token),revision:Number(found.data.revision)||0,receipts:rec(found.data.receipts)};}
      return {value:progress({}),token:'',revision:0,receipts:{}};
    }
    // Upgrade binds the last committed legacy save HERE, never fabricates past saves.
    return {value:progress(book),token:'',revision:0,receipts:rec(vars.bookseaSessionReceipts)};
  }
  async function mirror(value:Obj,anchor?:{id:number;token:string}){
    await raw.updateVariablesWith((v:Obj)=>{assertFrame();const b=rec(v.booksea),list=(Array.isArray(b.timelineIndex)?b.timelineIndex.map(rec):[]).filter(x=>Number(x.messageId)<=last());
      const index=anchor?[...list.filter(x=>x.messageId!==anchor.id&&x.token!==anchor.token),{messageId:anchor.id,token:anchor.token}].sort((a,b)=>Number(a.messageId)-Number(b.messageId)):list;
      return {...v,booksea:{...b,...structuredClone(value),timelineVersion:1,timelineIndex:index}};
    },{type:'chat'});
  }
  async function writeMessage(id:number,extra:Obj,transform:(vars:Obj)=>Obj,expectedNative:any,expectedToken?:string){
    const check=()=>{assertContext();if(last()!==id||(expectedNative&&nativeAt(id)!==expectedNative)||(expectedToken&&String(rec(nativeAt(id)?.extra)[FRAME]??rec(message(id).extra)[FRAME])!==expectedToken))throw Error('聊天楼层已变化，已取消旧记录写入');};
    check();
    if(expectedNative){
      // The updater executes synchronously on the current message: the guard and
      // metadata/MVU mutations have no async gap. Only our namespaced extra changes.
      await raw.updateVariablesWith((vars:Obj)=>{check();const next=transform(vars);writeNativeMessageExtra(expectedNative,extra);return next;},{type:'message',message_id:id});
    }else if(typeof raw.setChatMessages==='function'){
      const row=message(id),vars=raw.getVariables({type:'message',message_id:id});check();
      await raw.setChatMessages([{message_id:id,data:transform(vars),extra:{...rec(row.extra),...extra}}],{refresh:'none'});
    }else throw Error('酒馆助手缺少楼层存档接口，请更新助手后重试');
    check();
  }
  async function prepare(){
    assertContext();if(preparing)return preparing;
    preparing=(async()=>{
      const id=last();if(id<0)throw Error('当前聊天没有可保存的楼层');
      const row=message(id),vars=raw.getVariables({type:'message',message_id:id}) as Obj,chat=rawChat(),book=rec(chat.booksea),extra=rec(row.extra),nextNative=nativeAt(id);
      const resolved=resolve(vars,chat,rec(extra[SNAPSHOT])),token=typeof extra[FRAME]==='string'?String(extra[FRAME]):'frame-'+crypto.randomUUID();
      const needsMigration=book.timelineVersion!==1,reference={version:1,contextId:pinned,token:resolved.token||null};
      head=id;native=nextNative;swipe=nextNative?.swipe_id;frame=token;current=resolved.value;currentReceipts=resolved.receipts;sourceFrame=resolved.token;sourceRevision=resolved.revision;prepared=true;
      if(needsMigration){
        const stamped=progress(current),stamp={frame:token,revision:1};stampRuns(stamped,stamp);
        await writeMessage(id,{[FRAME]:token,[SNAPSHOT]:{version:1,contextId:pinned,token,revision:1,progress:stamped,receipts:currentReceipts}},v=>({...v,[REF]:{version:1,contextId:pinned,token}}),nextNative);
        current=stamped;sourceFrame=token;sourceRevision=1;await mirror(current,{id,token});await context().saveChat();
      }else{
        const changedFrame=extra[FRAME]!==token,changedRef=comparable(rec(vars[REF]))!==comparable(reference);
        if(changedFrame||changedRef)await writeMessage(id,{[FRAME]:token},v=>({...v,[REF]:reference}),nextNative);
        const changed=comparable(progress(book))!==comparable(current);if(changed)await mirror(current);
        if(changedFrame||changedRef||changed)await context().saveChat();
      }
      assertFrame();
    })().catch(e=>{prepared=false;throw e;}).finally(()=>{preparing=undefined;});
    return preparing;
  }
  const chat=():Obj=>{assertContext();const v=rawChat();return prepared?{...v,booksea:{...rec(v.booksea),...structuredClone(current)}}:v;};
  const readVars=():Obj=>{assertContext();const vars=raw.getVariables({type:'message',message_id:last()}) as Obj;return vars.bookseaSessionReceipts===undefined&&prepared&&Object.keys(currentReceipts).length>0?{...vars,bookseaSessionReceipts:structuredClone(currentReceipts)}:vars;};
  const stamp=():HostSaveStamp=>{assertFrame();const data=rec(rec(message(head).extra)[SNAPSHOT]);return {frame,revision:data.token===frame?Number(data.revision)||0:0};};
  async function commit(mvu:Obj|undefined,update:(v:Obj)=>Obj,expected?:HostSaveStamp){
    assertFrame(expected);const id=head,token=frame,nextNative=native,oldStamp=stamp();
    const result=update(chat()),value=progress(rec(result.booksea)),nextStamp={frame:token,revision:oldStamp.revision+1};stampRuns(value,nextStamp);
    const receipts=rec(mvu?.bookseaSessionReceipts??readVars().bookseaSessionReceipts);
    await writeMessage(id,{[FRAME]:token,[SNAPSHOT]:{version:1,contextId:pinned,token,revision:nextStamp.revision,progress:value,receipts}},vars=>({... (mvu??vars),bookseaSessionReceipts:receipts,[REF]:{version:1,contextId:pinned,token}}),nextNative,token);
    current=value;currentReceipts=receipts;sourceFrame=token;sourceRevision=nextStamp.revision;await mirror(value,{id,token});assertFrame(expected);await context().saveChat();assertFrame(expected);return nextStamp;
  }
  async function updateChat(fn:(v:Obj)=>Obj){
    assertFrame();const before=chat(),after=fn(before);
    if(comparable(progress(rec(before.booksea)))!==comparable(progress(rec(after.booksea)))){await commit(undefined,()=>after);return after;}
    await raw.updateVariablesWith((v:Obj)=>{assertFrame();const actual=rec(v.booksea);return {...after,booksea:{...rec(after.booksea),timelineVersion:actual.timelineVersion,timelineIndex:actual.timelineIndex}};},{type:'chat'});
    await context().saveChat();return after;
  }
  async function ownedAppend<T>(fn:()=>Promise<T>){
    const before=last(),beforeNative=nativeAt(before),beforeToken=frame;let value:T|undefined,failure:unknown;
    own++;try{
      try{value=await fn();}catch(error){failure=error;}
      assertContext();if(last()<before||(beforeNative&&nativeAt(before)!==beforeNative)||String(rec(message(before).extra)[FRAME])!==beforeToken)throw Error('聊天楼层已回退，已停止旧交接');
      await prepare();if(failure)throw failure;return value as T;
    }finally{own--;}
  }
  return {prepare,chat,readVars,stamp,commit,updateChat,valid,assertFrame,
    authorizedFrames:()=>[...new Set([frame,sourceFrame].filter(Boolean))],
    sourceRevision:()=>sourceRevision,
    ownedAppend,
    invalidate(){prepared=false;},
    get contextId(){return pinned;}
  };
}
