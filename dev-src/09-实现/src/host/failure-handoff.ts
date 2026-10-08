import { actorAt, actorKey, object, own, type Obj } from '../core/actors';
import { canonical } from '../core/cache';
import { failureNotice, type FailureFacts, type FailureNotice } from '../core/failure';
import type { Run } from '../core/run';
import { restoreDeparture } from '../core/settlement';
import {EXIT_REQUEST,exitExtra,sameExit,type HandoffMessage} from '../core/handoff-message';

export type Ending = { version:1; runId:string; contextId:string; messageId:number; source:string; notice:FailureNotice; phase:'prepared'|'host-committed'|'delivered' };
export type HandoffPort = {
  contextId():string; latestMessageId():number;
  readChat():Obj; updateChat(fn:(v:Obj)=>Obj):Promise<void>;
  readMvu(messageId:number):Obj; writeMvu(messageId:number,v:Obj):Promise<void>;
  userMessages():HandoffMessage[]; sendUser(message:string,extra:Obj):Promise<void>;
  lock<T>(key:string,fn:()=>Promise<T>):Promise<T>;
};
export type FailureRequest = { run:Run; facts:FailureFacts; ownedStateNames:Record<string,string[]>; localModifiersRemoved:true };
function root(v:Obj):Obj { return v.booksea === undefined ? {} : object(v.booksea,'booksea'); }
function ending(v:Obj,id:string):Ending|undefined {
  const b=root(v), es=b.endings === undefined?{}:object(b.endings,'endings');
  return own(es,id) as Ending|undefined;
}
function receipts(v:Obj):Obj { return v.bookseaExitReceipts === undefined?{}:object(v.bookseaExitReceipts,'结束回执'); }

/** Resume-safe, scoped to one chat and one pinned message. Does NOT trigger narrative generation or original revival side effects. */
export async function handoffFailure(port:HandoffPort,request:FailureRequest):Promise<Ending> {
  if (request.localModifiersRemoved !== true) throw Error('必须先移除局内资源上限修正');
  request=structuredClone(request);
  const notice=failureNotice(request.run,request.facts), contextId=port.contextId();
  const bytes=new TextEncoder().encode(canonical({run:request.run,facts:request.facts,ownedStateNames:request.ownedStateNames}));
  const source=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
  const assertContext=()=>{if(port.contextId()!==contextId)throw Error('聊天已切换，停止写入');};
  return port.lock(`booksea-ending:${contextId}`,async()=>{
    assertContext();
    let record=ending(port.readChat(),request.run.id);
    if (record && (record.version!==1||record.contextId!==contextId||record.source!==source)) throw Error('相同结束ID对应不同事实，拒绝覆盖');
    const save=async(next:Ending)=>{
      assertContext();
      await port.updateChat(v=>{
        assertContext();const b=root(v), es=b.endings===undefined?{}:object(b.endings);
        const current=own(es,next.runId) as Ending|undefined;
        if(current&&current.source!==source)throw Error('结束记录冲突');
        if(b.activeRun && object(b.activeRun).id!==request.run.id)throw Error('另一趟正在进行，禁止结束旧趟');
        const unlocked=b.unlockedIds===undefined?[]:b.unlockedIds;
        if(!Array.isArray(unlocked)||unlocked.some(x=>typeof x!=='string'))throw Error('永久解锁记录非法');
        return {...v,booksea:{...b,activeRun:null,lastEndedRun:structuredClone(request.run),unlockedIds:[...new Set([...unlocked,...request.run.unlocks])],endings:{...es,[next.runId]:structuredClone(next)},
          ...(next.phase==='delivered'?{failureHandoff:{version:2,phase:'delivered',runId:next.runId,message:EXIT_REQUEST,summary:next.notice.directive}}:{})}};
      });
      record=next;
    };
    if(!record){
      const messageId=port.latestMessageId();if(!Number.isSafeInteger(messageId)||messageId<0)throw Error('没有可写宿主楼层');
      // Preflight all actors BEFORE any journal or host mutation; do not invent absent actors.
      const m=port.readMvu(messageId);for(const p of request.run.participants)actorAt(m,p.ref);
      await save({version:1,runId:request.run.id,contextId,messageId,source,notice,phase:'prepared'});
    }
    if(record!.phase==='delivered')return structuredClone(record!); // User deletion is not permission to resend.
    if(record!.phase==='prepared'){
      assertContext();const current=port.readMvu(record!.messageId), receipt=own(receipts(current),request.run.id);
      if(receipt!==undefined && receipt!==source)throw Error('结束回执冲突');
      if(receipt===undefined){
        let next=structuredClone(current);
        // Previously departed actors were restored at their own exit: no second refill or death write.
        for(const ref of notice.finalDowned)next=restoreDeparture(next,ref,request.ownedStateNames[actorKey(ref)]??[]);
        next.bookseaExitReceipts={...receipts(next),[request.run.id]:source};
        assertContext();await port.writeMvu(record!.messageId,next);
        assertContext();if(own(receipts(port.readMvu(record!.messageId)),request.run.id)!==source)throw Error('宿主写入未确认');
      }
      await save({...record!,phase:'host-committed'});
    }
    assertContext();
    const matches=port.userMessages().filter(m=>sameExit(m,contextId,notice.runId));
    if(matches.some(m=>m.message!==EXIT_REQUEST)||matches.length>1)throw Error('失败交接元数据冲突，需人工核对，未重复发送');
    if(matches.length===0){assertContext();await port.sendUser(EXIT_REQUEST,exitExtra(contextId,notice.runId,'failed',notice.directive));}
    assertContext();if(!port.userMessages().some(m=>sameExit(m,contextId,notice.runId)&&m.message===EXIT_REQUEST))throw Error('失败交接未确认送达');
    await save({...record!,phase:'delivered'});
    return structuredClone(record!);
  });
}
