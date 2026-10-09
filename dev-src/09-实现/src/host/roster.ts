import {actorAt,actorKey,eligibility,finite,hostLevel,listActors,object,resourceMax,type Obj,type ActorRef} from '../core/actors';
import {inspectCache,type Cache} from '../core/cache';
import {RosterView} from '../presentation/roster-contract';
import {withTimeout} from './probe';

/** Source matches is NOT admission: full executor/rules validation remains assertEntry's job. */
export function projectRoster(mvu:unknown,chat:unknown,messageId:number):RosterView {
  const refs=listActors(mvu);
  if(refs.length>512)throw Error('角色数量超过当前列表上限512');
  const variables=object(chat),booksea=variables.booksea===undefined?{}:object(variables.booksea);
  const caches=booksea.actorCache===undefined?{}:object(booksea.actorCache);
  const actors=refs.map((ref,index)=>{
    const a=actorAt(mvu,ref),gate=eligibility(mvu,ref);
    let level:number|null=null,current:RosterView['actors'][number]['current']=null,max:RosterView['actors'][number]['max']=null;
    let cache:RosterView['actors'][number]['cache']='missing';
    try {
      level=hostLevel(a);
      max={hp:resourceMax(a,'生命值'),mp:resourceMax(a,'法力值'),sp:resourceMax(a,'体力值')};
      current={hp:finite(object(a.生命值).当前,'HP'),mp:finite(object(a.法力值).当前,'MP'),sp:finite(object(a.体力值).当前,'SP')};
      if(current.hp<0||current.hp>max.hp||current.mp<0||current.mp>max.mp||current.sp<0||current.sp>max.sp)throw Error('资源超界');
    }catch {current=null;max=null;}
    try {
      const raw=Object.hasOwn(caches,actorKey(ref))?caches[actorKey(ref)]:undefined;
      const status=inspectCache(raw as Cache|undefined,a,ref).status;
      cache=status==='ready'?'source-matches':status;
    }catch {cache='invalid';}
    return {id:`roster-${index}`,name:ref.kind==='player'?'主角':ref.name,kind:ref.kind,level,current,max,
      eligibility:gate.allowed?'eligible' as const:'blocked' as const,reason:gate.reason.slice(0,1000),cache};
  });
  return RosterView.parse({mode:'readonly-not-entry',messageId,actors,selectedIds:[]});
}
export function selectRoster(view:RosterView,ids:string[]):RosterView {
  if(ids.length<1||ids.length>4||new Set(ids).size!==ids.length)throw Error('请选择1–4名不重复角色');
  const actors=ids.map(id=>view.actors.find(a=>a.id===id));
  if(actors.some(a=>!a||a.eligibility!=='eligible'))throw Error('所选角色已不存在或资格不符合，请刷新列表');
  return RosterView.parse({...view,selectedIds:[...ids]});
}
export type RosterHost={
  getVariables(options:Obj):Obj;getLastMessageId():number;waitGlobalInitialized(name:string):Promise<unknown>;
  context():{chatId:string;characterId:string|number;groupId?:string};
  onChatChanged(listener:()=>void):()=>void;
};
/** No model, write, save or message API exists on this port. Events invalidate even A -> B -> A. */
export function createRosterReader(host:RosterHost,onInvalidated:()=>void,timeoutMs=5000){
  const identity=()=>{const c=host.context();if(!c.chatId||c.characterId===undefined||c.characterId===null||c.characterId===''||c.groupId)throw Error('请先打开宿主角色的独立聊天');return JSON.stringify([String(c.characterId),c.chatId]);};
  const pinned=identity();let closed=false;
  const assert=()=>{if(closed||identity()!==pinned)throw Error('聊天已切换，请重新读取角色');};
  const unsubscribe=host.onChatChanged(()=>{if(!closed){closed=true;onInvalidated();}});
  let previousRefs:ActorRef[]=[];
  return {
    async read():Promise<RosterView>{
      assert();await withTimeout(host.waitGlobalInitialized('Mvu'),timeoutMs);assert();
      const messageId=host.getLastMessageId();if(!Number.isSafeInteger(messageId)||messageId<0)throw Error('没有可读取的消息楼层');
      const mvu=host.getVariables({type:'message',message_id:messageId});
      const view=projectRoster(mvu,host.getVariables({type:'chat'}),messageId);
      assert();if(host.getLastMessageId()!==messageId)throw Error('读取时消息楼层已变化，请重试');
      previousRefs=listActors(mvu);return view;
    },
    /** Re-read before confirming selection; map by full actor reference, never by the new list index. */
    async select(ids:string[]):Promise<RosterView>{
      const keys=ids.map(id=>{const index=Number(id.replace(/^roster-/,''));const ref=previousRefs[index];if(!/^roster-\d+$/.test(id)||!ref)throw Error('所选角色不存在');return actorKey(ref);});
      const current=await this.read();
      const currentIds=keys.map(key=>{const index=previousRefs.findIndex(r=>actorKey(r)===key);if(index<0)throw Error('所选角色已被移除');return `roster-${index}`;});
      return selectRoster(current,currentIds);
    },
    assertCurrent:assert,
    close(){closed=true;previousRefs=[];unsubscribe();}
  };
}
/** Helper injects these same-frame APIs. No scan of parent frames or private storage. */
export function rosterHostFromGlobals(g:any):RosterHost {
  for(const key of ['getVariables','getLastMessageId','waitGlobalInitialized','eventOn','eventRemoveListener'])if(typeof g[key]!=='function')throw Error(`缺少酒馆助手接口：${key}`);
  if(typeof g.SillyTavern?.getCurrentChatId!=='function'||!g.tavern_events?.CHAT_CHANGED)throw Error('缺少聊天身份或聊天切换事件');
  return {
    getVariables:o=>g.getVariables(o),getLastMessageId:()=>g.getLastMessageId(),waitGlobalInitialized:n=>g.waitGlobalInitialized(n),
    context:()=>({chatId:g.SillyTavern.getCurrentChatId(),characterId:g.SillyTavern.characterId,groupId:g.SillyTavern.groupId}),
    onChatChanged(fn){g.eventOn(g.tavern_events.CHAT_CHANGED,fn);return()=>g.eventRemoveListener(g.tavern_events.CHAT_CHANGED,fn);}
  };
}
