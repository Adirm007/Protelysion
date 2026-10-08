import {createMessageTimeline,type HostSaveStamp} from './message-timeline';
import {isBattleConsumable} from '../core/battle-items';
import {entryNotice,requestNarrativeOnce,requireNarrativeConnection} from './narrative';
import {bindInitialStates} from './initial-states';
import {actorAt,actorKey,listActors,object,resourceMax,eligibility,type ActorRef,type Obj} from '../core/actors';
import {assertEntry,canonical,inspectCache,type Cache} from '../core/cache';
import {createCompilationEngine,validateCompiled,type Rules} from '../compiler/engine';
import {compileActorInChat,type CompileEnvironment} from './compile-actor';
import {chatCacheStore} from './chat-cache';
import {helperCompilerModel} from './compiler';
import {hostReward,restoreDeparture,consumeItem,redeemVoucher,settleRunRewards,bagThreadCount,bagHasSilverCross,craftSilverCrossInBag} from '../core/settlement';
import {failureNotice} from '../core/failure';
import {keepsGains} from '../core/run';
import {EXIT_REQUEST,exitExtra,exitMeta,exitPromptData,sameExit,NARRATIVE_REQUEST,NARRATIVE_DESCEND,narrativeExtra,narrativePromptData,type HandoffMessage,type NarrativeMeta} from '../core/handoff-message';
import {promptData} from '../compiler/engine';
import {growParticipant} from './growth';
import {startExpedition,type State} from '../game/expedition';
import type {SupplierPrompt} from '../game/supplier-agent';
import {knockoutLines} from '../game/defeat-report';
import type {PartyMember} from '../game/content';
import {HOST_RULES} from '../compiler/rules';
export {HOST_RULES};
export type SessionPort={id():string;messageId():number;read():Obj;write(v:Obj):Promise<void>;chat():Obj;updateChat(fn:(v:Obj)=>Obj):Promise<void>;env:CompileEnvironment;lodash:unknown;prepare?():Promise<void>;bind?(s:State):void;saveCurrent?(s:State):boolean;assertSave?(s:State):void;authorizedFrames?():string[];commitProgress?(mvu:Obj|undefined,fn:(v:Obj)=>Obj,s:State):Promise<void>;requireNarrativeReady?():void;enterNarrative?:(refs:ActorRef[],depth:number,id:string)=>Promise<void>;deliver(s:State):Promise<void>;lock<T>(key:string,fn:()=>Promise<T>):Promise<T>;supplierChat?(prompt:SupplierPrompt):Promise<string>;postNarrative?(kind:NarrativeMeta['kind'],runId:string,depth:number,summary:string):Promise<void>};
/** 补给员一句回复的最长等待；超时会停止该次生成。 */
export const SUPPLIER_CHAT_TIMEOUT_MS=90000;
/** 读者「彩蛋设置 → 独立API」写入的同源存储。
 *  0.40：v2 保存多套方案与按调用类型的路由（routes）；书海用 booksea_compile（技能整备）与 booksea_supplier（补给员对话）。
 *  路由为 'tavern' 或默认方案为空时沿用酒馆当前连接；只有旧 v1 时按 v1 的单一方案处理。 */
export const INDEPENDENT_API_KEY='dream_independent_api_v1';
export const INDEPENDENT_API_V2_KEY='dream_independent_api_v2';
export type ApiRoute='booksea_compile'|'booksea_supplier';
const apiPreset=(c:any):Obj|undefined=>{if(!c||typeof c!=='object'||c.enabled===false)return undefined;const apiurl=String(c.apiurl??'').trim(),model=String(c.model??'').trim();if(!/^https?:\/\//i.test(apiurl)||!model)return undefined;return {apiurl,key:String(c.key??''),model,source:String(c.source||'openai')};};
export function independentApi(globals:any,route:ApiRoute='booksea_compile'):Obj|undefined{
 for(const w of [globals,globals?.parent]){try{
  const store=w?.localStorage;if(!store)continue;
  const v2=store.getItem(INDEPENDENT_API_V2_KEY);
  if(v2){const c=JSON.parse(v2);if(c&&Array.isArray(c.presets)){const choice=String(c.routes?.[route]??'default');if(choice==='tavern')return undefined;const id=choice==='default'?String(c.defaultId??''):choice;return apiPreset(c.presets.find((p:any)=>p&&String(p.id)===id));}}
  const raw=store.getItem(INDEPENDENT_API_KEY);if(!raw)continue;return apiPreset(JSON.parse(raw));
 }catch{}}
 return undefined;
}
export function withIndependentApi(globals:any,config:Obj,route:ApiRoute='booksea_compile'):Obj{const custom=independentApi(globals,route);return custom?{...config,custom_api:{...object(config.custom_api??{}),...custom}}:config;}
export function sessionPort(globals:any):SessionPort{
 const h=globals.TavernHelper??globals,c=()=>globals.SillyTavern.getContext();
 if(!globals.SillyTavern?.getContext||typeof h.getVariables!=='function')throw Error('请在启用酒馆助手的聊天消息内打开书海宿主入口；独立试玩请使用试玩页面。');
 if(!globals.navigator?.locks?.request)throw Error('当前页面缺少安全上下文的跨窗口锁；请通过HTTPS或本机localhost访问酒馆，避免不安全写入。');
 const timeline=createMessageTimeline(globals);
 const id=()=>`${c().characterId}:${c().getCurrentChatId()}`,pinned=id(),messageId=()=>h.getLastMessageId();
 const assert=()=>{if(id()!==pinned)throw Error('请回到此趟所属聊天');};
 const read=()=>{assert();return timeline.readVars();};
 const save=async()=>{assert();await c().saveChat();};
 const api={getVariables:(o:Obj)=>o.type==='chat'?timeline.chat():h.getVariables(o),updateVariablesWith:(fn:(v:Obj)=>Obj,o:Obj)=>o.type==='chat'?timeline.updateChat(fn):h.updateVariablesWith(fn,o),generateRaw:(config:Obj)=>h.generateRaw(withIndependentApi(globals,config,'booksea_compile')),stopGenerationById:h.stopGenerationById};
 const narrativeApi={...api,getLastMessageId:()=>h.getLastMessageId(),getChatMessages:(range:unknown)=>h.getChatMessages(range),triggerSlash:(command:string)=>timeline.ownedAppend(()=>h.triggerSlash(command))};
 return {id,messageId,read,chat:timeline.chat,lodash:globals._,prepare:timeline.prepare,authorizedFrames:timeline.authorizedFrames,bind(s){s.hostSave=timeline.stamp();},saveCurrent:s=>timeline.valid(s.hostSave),assertSave:s=>{if(!s.hostSave)throw Error('远征缺少楼层绑定，请重新打开入口');timeline.assertFrame(s.hostSave);},async commitProgress(mvu,fn,s){s.hostSave=await timeline.commit(mvu,fn,s.hostSave);},requireNarrativeReady:()=>requireNarrativeConnection(c()),
  async enterNarrative(refs,depth,runId){assert();await timeline.prepare();const current=read();await timeline.ownedAppend(()=>h.createChatMessages([{role:'user',message:entryNotice(refs,depth,runId),data:exitPromptData(current,{}),extra:{bookseaHandoff:{version:2,kind:'entry',contextId:pinned,runId}}}]));await save();await requestNarrativeOnce(narrativeApi,c(),'entry:'+runId);},
  async write(v){assert();await h.replaceVariables(v,{type:'message',message_id:messageId()});await save();},
  async deliver(s){
   assert();if(!s.hostSave){await timeline.prepare();s.hostSave=timeline.stamp();}else timeline.assertFrame(s.hostSave);
   try {
   if(s.mode!=='ended'||!['success','failed'].includes(s.run.status))throw Error('本趟尚未结算结束');
   const b=object(timeline.chat().booksea??{}),requests=object(b.narrativeRequests??{}),receipts=object(b.exitDeliveries??{}),key='exit:'+s.run.id;
   if(requests[key]==='delivered')return;
   if((b.activeExpedition as State|undefined)?.run.id&&((b.activeExpedition as State).run.id!==s.run.id))return;
   if((b.lastExpedition as State|undefined)?.run.id&&((b.lastExpedition as State).run.id!==s.run.id))return;
   const finalMembers=s.party.filter(p=>p.ref&&s.run.failureSignal?.finalDowned?.some(r=>actorKey(r)===actorKey(p.ref!))).map(p=>p.id);
   const failure=s.run.status==='failed'?failureNotice(s.run,{depth:s.depth,encounter:s.region.name+' / '+s.notice,knockouts:knockoutLines(s,finalMembers),consumed:Object.values(s.inventory??{}).filter(i=>i.used>0).map(i=>({owner:i.owner,name:i.name,count:i.used}))}):null;
   const summary=failure?.directive??[
    `参战名单：${promptData(s.party.map(p=>p.name))}。`,
    `起始深度${s.depthLog?.start??1}；最深${s.depthLog?.maximum??s.depth}；向下${s.depthLog?.down??0}次、向上${s.depthLog?.up??0}次、访问${s.depthLog?.visits??s.visit+1}区。`,
    `实际遭遇：${promptData(s.encounters??[])}`,
    `已结算的未开启盲盒、怪物素材、FP及来源：${promptData(s.run.rewards)}`,
    `已扣除的原有物品：${promptData(Object.values(s.inventory??{}).filter(i=>i.used>0).map(i=>({owner:i.owner,name:i.name,count:i.used})))}`,
    `离场人员：${promptData(s.run.participants.map(p=>({actor:p.ref,exit:p.status,experience:p.experience})))}`,
    ...knockoutLines(s),
    '本趟逐人经验、FP、盲盒与怪物素材结算已完成，离场三资源已恢复。',
   ].join('\n');
   const messages=()=>h.getChatMessages(`0-${messageId()}`) as HandoffMessage[];
   let found=messages().filter(m=>sameExit(m,pinned,s.run.id));
   // Preserve pre-update chat history, rather than turning an old completed exit into a new request.
   const oldMarker=`结束标识：booksea-${failure?'failure':'success'}:${s.run.id}`;
   if(!found.length&&messages().some(m=>m.role==='user'&&m.message.split('\n').includes(oldMarker)))return;
   if(found.length>1)throw Error('本趟存在重复离场记录，请核对；结算保留');
   if(receipts[s.run.id]&&!found.length)throw Error('本趟离场消息已被删除；结算保留，不自动重发');
   if(found.length&&found[0]!.message!==EXIT_REQUEST)throw Error('本趟离场消息已被编辑；结算保留，不覆盖修改');
   if(!found.length){
    const current=read(),extra=exitExtra(pinned,s.run.id,s.run.status as 'success'|'failed',summary);
    await timeline.ownedAppend(()=>h.createChatMessages([{role:'user',message:EXIT_REQUEST,data:exitPromptData(current,extra),extra}]));assert();
    found=messages().filter(m=>sameExit(m,pinned,s.run.id));
   }
   if(found.length!==1||found[0]!.role!=='user'||found[0]!.message!==EXIT_REQUEST)throw Error('离场请求未确认送达，请检查酒馆助手消息元数据支持');
   const meta=exitMeta(found[0]!)!;
   if(meta.status!==s.run.status)throw Error('离场消息与本趟结算状态冲突，请核对');
   await timeline.updateChat((v:Obj)=>{const book=object(v.booksea??{});return {...v,booksea:{...book,exitDeliveries:{...object(book.exitDeliveries??{}),[s.run.id]:{version:2,messageId:found[0]!.message_id??messageId(),status:meta.status}},...(failure?{failureHandoff:{version:2,phase:'delivered',runId:s.run.id,message:EXIT_REQUEST,summary:meta.summary}}:{})}};});
   await save();
   if(object(object(timeline.chat().booksea??{}).settings??{}).narrative!==false){
    const latest=h.getChatMessages(-1)[0] as HandoffMessage|undefined;
    if(!latest||!sameExit(latest,pinned,s.run.id)||latest.role!=='user')throw Error('最新消息已不是本次离场请求；结算保留，请核对聊天后补写正文');
    await requestNarrativeOnce(narrativeApi,c(),key);
   }

   } finally {if(timeline.valid()&&(object(timeline.chat().booksea??{}).lastExpedition as State|undefined)?.run.id===s.run.id)s.hostSave=timeline.stamp();}
  },
  async updateChat(fn){assert();await timeline.updateChat(fn);},lock:(key,fn)=>globals.navigator.locks.request(key,fn),
  /** 0.40 正文模式：以用户身份发送可见请求（断点 / 楼层信息在 extra 与消息变量里），然后照常触发一次正文生成。 */
  async postNarrative(kind,runId,depth,summary){
   assert();await timeline.prepare();
   const message=kind==='narrative'?NARRATIVE_REQUEST:NARRATIVE_DESCEND,extra=narrativeExtra(pinned,runId,kind,depth,summary),current=read();
   await timeline.ownedAppend(()=>h.createChatMessages([{role:'user',message,data:narrativePromptData(current,extra),extra}]));assert();await save();
   if(object(object(timeline.chat().booksea??{}).settings??{}).narrative!==false)await requestNarrativeOnce(narrativeApi,c(),`${kind}:${runId}:${depth}:${Date.now().toString(36)}`);
  },
  /** 0.40 补给员对话：独立生成（不进聊天记录、不带聊天历史），走独立API的 booksea_supplier 路由，否则走酒馆当前连接。 */
  async supplierChat(prompt){
   assert();if(typeof h.generateRaw!=='function')throw Error('当前酒馆助手不支持独立生成');
   const id='booksea-supplier-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
   const config=withIndependentApi(globals,{generation_id:id,should_stream:false,should_silence:true,max_chat_history:0,ordered_prompts:[{role:'system',content:prompt.system},...prompt.messages]},'booksea_supplier');
   let timer:ReturnType<typeof setTimeout>|undefined;
   try{return String(await Promise.race([h.generateRaw(config),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{try{h.stopGenerationById?.(id);}catch{/* best effort */}reject(Error('她想得太久了（超时）'));},SUPPLIER_CHAT_TIMEOUT_MS);})])??'');}
   finally{if(timer)clearTimeout(timer);}
  },
  env:{compilerTransport:'portable-action-json',contextId:id,saveChat:save,readMvu:async()=>read(),api,locks:globals.navigator.locks}};
}
const booksea=(port:SessionPort)=>object(port.chat().booksea??{});
export function hostRoster(port:SessionPort){const m=port.read(),caches=object(booksea(port).actorCache??{});return listActors(m).map(ref=>{
 const name=ref.kind==='player'?'主角':ref.name;
 try{const a=actorAt(m,ref),gate=eligibility(m,ref),hp=Number((a.生命值 as Obj|undefined)?.当前??0),maxHp=resourceMax(a,'生命值');return {ref,name,level:a.等级,hp,maxHp,skills:Object.keys(object(a.技能??{})),allowed:gate.allowed&&hp>0,reason:gate.allowed&&hp<=0?'休整中':gate.reason,compiled:inspectCache(caches[actorKey(ref)] as Cache|undefined,a,ref).status==='ready'};}
 catch{return {ref,name,level:0,hp:0,maxHp:0,skills:[] as string[],allowed:false,reason:'资料尚未就绪',compiled:false};}
});}
export async function compileHostMember(port:SessionPort,ref:ActorRef){
 const settings=object(booksea(port).settings??{});return compileActorInChat(ref,{...port.env,compilerApi:object(settings.compiler??{})},HOST_RULES);
}
export async function enterHostExpedition(port:SessionPort,refs:ActorRef[],startDepth=1,options:{narrateEntry?:boolean}={}):Promise<State>{
 const contextId=port.id();
 return port.lock(`booksea-entry:${contextId}`,async()=>{
 if(port.id()!==contextId)throw Error('聊天已切换，书海入场未执行');
 await port.prepare?.();
 if(booksea(port).activeExpedition)throw Error('还有远征记录：请继续本版本远征、撤退，或明确清空开发存档后新开');
 const m=port.read(),store=chatCacheStore(port.env.api),engine=createCompilationEngine(async()=>{throw Error('请先点击编译');},HOST_RULES);
 await assertEntry(m,refs,store,engine);if(options.narrateEntry!==false&&object(booksea(port).settings??{}).narrative!==false)port.requireNarrativeReady?.();
 const items:NonNullable<State['inventory']>={},party:PartyMember[]=[];
 for(const [index,ref] of refs.entries()){
  const a=actorAt(m,ref),cache=(await store.read(actorKey(ref)))!,card=structuredClone(validateCompiled(cache.compiledActor)),id=`host-${index}`;
  card.skills=card.skills.filter(s=>!s.sourceId.startsWith('/道具定义/')||Number((object(a.背包)[s.name] as Obj|undefined)?.数量??0)>0&&isBattleConsumable(object(a.背包)[s.name]));
  for(const skill of card.skills.filter(s=>s.sourceId.startsWith('/道具定义/')&&s.mapping.disposition==='active')){
   const raw=object(a.背包)[skill.name] as Obj|undefined;if(!raw||Number(raw.数量)<=0)continue;
   const key='item-'+index+'-'+Object.keys(items).length;skill.sourceId=key;skill.mapping.sourceId=key;if(skill.mapping.action)skill.mapping.action.copyable=false;items[key]={owner:ref,name:skill.name,remaining:Number(raw.数量),used:0,actorId:id};
  }
  bindInitialStates(card,a);
  const dynamics:Record<string,number>={affection:Number(a.好感度??0)};for(const [name,item] of Object.entries(object(a.背包)))dynamics['inventory:'+name]=Number(object(item).数量);
  party.push({id,ref,persistent:{dependencies:dynamics},name:ref.kind==='player'?'主角':ref.name,color:['#e7bd75','#83cfb5','#ac9ce5','#80b8df'][index]!,card,current:{hp:Number(object(a.生命值).当前),mp:Number(object(a.法力值).当前),sp:Number(object(a.体力值).当前)}});
 }
 const s=startExpedition(party,Date.now()>>>0,startDepth,booksea(port).unlockedIds as string[]??['depth-1']);s.source='host';s.inventory=items;s.potions=0;s.run.id='host-'+crypto.randomUUID();s.hostContext=port.id();s.writeback='pending';
 s.hostFp=Math.max(0,Math.floor(Number(object(m.stat_data??{}).命运点数)||0));s.threadsHeld=bagThreadCount(m);s.crossHeld=bagHasSilverCross(m);s.crossWard=s.crossHeld&&booksea(port).crossWard===true;
 port.bind?.(s);await checkpointHost(port,s);if(options.narrateEntry!==false&&object(booksea(port).settings??{}).narrative!==false)await port.enterNarrative?.(refs,startDepth,s.run.id);return s;
 });
}
async function persistProgress(port:SessionPort,mvu:Obj|undefined,s:State,fn:(v:Obj)=>Obj){
 port.assertSave?.(s);
 if(port.commitProgress)await port.commitProgress(mvu,fn,s);
 else{if(mvu)await port.write(mvu);await port.updateChat(fn);}
}
function syncResources(mvu:Obj,s:State,departed:string[]=[]):Obj{
 let next=structuredClone(mvu);
 for(const p of s.party){
  const ref=p.ref!,status=s.run.participants.find(q=>actorKey(q.ref)===actorKey(ref))!.status;
  if(status!=='active'){if(!departed.includes(actorKey(ref)))next=restoreDeparture(next,ref);continue;}
  const current=s.battle?.units.find(u=>u.id===p.id)?.current??p.current,actor=actorAt(next,ref);
  // A downed combatant stays down only in the local battle, never triggers the host's narrative death path.

  for(const [key,name] of [['hp','生命值'],['mp','法力值'],['sp','体力值']] as const){if(key==='hp'&&current.hp<=0)continue;object(actor[name]).当前=Math.min(resourceMax(actor,name),current[key]);}
 }
 return next;
}
export async function checkpointHost(port:SessionPort,s:State):Promise<void>{
 if(s.hostContext!==port.id())throw Error('这份存档属于另一聊天');
 await port.lock(`booksea-session:${port.id()}`,async()=>{
  port.assertSave?.(s);let m=port.read();const receipts=object(m.bookseaSessionReceipts??{}),prior=receipts[s.run.id] as {items:Record<string,number>;settled:boolean;departed:string[];cross?:boolean;hostFpSpent?:number}|undefined;
  if(prior?.settled){
   s.writeback='done';
   if(s.mode==='ended'){
    // Refresh display numbers from the already committed host, without awarding twice.
    for(const p of s.party){const a=actorAt(m,p.ref!);p.card.numeric.level=Number(a.等级);for(const [k,r] of [['hp','生命值'],['mp','法力值'],['sp','体力值']] as const){p.current[k]=Number(object(a[r]).当前);p.card.numeric.max[k]=resourceMax(a,r);}}
    // A previous resource commit can succeed while chat metadata persistence fails.
    // Repair only this run; never clear another, newer active expedition.
    await persistProgress(port,undefined,s,v=>{const b=object(v.booksea??{}),active=b.activeExpedition as State|undefined,last=b.lastExpedition as State|undefined;
     return {...v,booksea:{...b,activeExpedition:active?.run.id===s.run.id?null:active??null,lastExpedition:!last||last.run.id===s.run.id||active?.run.id===s.run.id?structuredClone(s):last,unlockedIds:[...new Set([...(b.unlockedIds as string[]??[]),...s.run.unlocks])]}};});
    await port.deliver(s);port.bind?.(s);
   }return;
  }
  m=syncResources(m,s,prior?.departed);
  for(const [id,item] of Object.entries(s.inventory??{})){const delta=item.used-(prior?.items[id]??0);if(delta>0)m=consumeItem(m,item.owner,item.name,delta);}
  // 银十字：扣线与放入银十字在同一次写回里完成，回执保证只做一次。
  if(s.crossCrafted&&!prior?.cross)m=craftSilverCrossInBag(m,s.crossCrafted.bagThreads);
  // 0.41 商店扣宿主总 FP：按回执差额只扣一次（与胜负无关，已花掉的就是花掉了）。
  const hostSpent=Math.max(0,(s.hostFpSpent??0)-(prior?.hostFpSpent??0));
  if(hostSpent){m=structuredClone(m);const stat=object(m.stat_data);stat.命运点数=Math.max(0,Math.floor(Number(stat.命运点数)||0)-hostSpent);}
  if(s.mode==='ended'){
   if(keepsGains(s.run)){
    for(const p of s.run.participants)m=growParticipant(m,p.ref,p.experience,port.lodash);
    m=settleRunRewards(m,s.run.rewards);
   }
   for(const p of s.party)if(!prior?.departed.includes(actorKey(p.ref!)))m=restoreDeparture(m,p.ref!);
  }
  m.bookseaSessionReceipts={...receipts,[s.run.id]:{items:Object.fromEntries(Object.entries(s.inventory??{}).map(([k,v])=>[k,v.used])),settled:s.mode==='ended',departed:s.run.participants.filter(p=>p.status!=='active').map(p=>actorKey(p.ref)),...(s.crossCrafted||prior?.cross?{cross:true}:{}),...(Math.max(s.hostFpSpent??0,prior?.hostFpSpent??0)?{hostFpSpent:Math.max(s.hostFpSpent??0,prior?.hostFpSpent??0)}:{})}};
  const committedFlag=s.mode==='ended'?'done':'synced';
  if(s.mode==='ended')for(const p of s.party){const a=actorAt(m,p.ref!);p.card.numeric.level=Number(a.等级);for(const [k,r] of [['hp','生命值'],['mp','法力值'],['sp','体力值']] as const){p.current[k]=Number(object(a[r]).当前);p.card.numeric.max[k]=resourceMax(a,r);}}
  const persisted={...s,writeback:committedFlag} as State;
  await persistProgress(port,m,s,v=>{const b=object(v.booksea??{});return {...v,booksea:{...b,...(s.crossHeld?{crossWard:!!s.crossWard}:{}),activeExpedition:s.mode==='ended'?null:structuredClone(persisted),lastExpedition:s.mode==='ended'?structuredClone(persisted):b.lastExpedition??null,unlockedIds:[...new Set([...(b.unlockedIds as string[]??[]),...s.run.unlocks])]}};});
  s.writeback=committedFlag;
  if(s.mode==='ended'){await port.deliver(s);port.bind?.(s);}
 });
}
export async function redeemHostVoucher(port:SessionPort,name:string,count:number){await port.lock(`booksea-session:${port.id()}`,async()=>{await port.write(redeemVoucher(port.read(),name,count));});}

/** Explicit user-confirmed development reset. Never settles, refunds, modifies
 * actor resources, runs compilation, or calls a model. Not a save migration. */
export async function discardDevelopmentExpedition(port:SessionPort,expectedContext=port.id()){
 if(port.id()!==expectedContext)throw Error('聊天已切换，开发重置未执行');
 await port.lock(`booksea-session:${expectedContext}`,async()=>{
  if(port.id()!==expectedContext)throw Error('聊天已切换，开发重置未执行');
  await port.updateChat(v=>{const b=object(v.booksea??{});return {...v,booksea:{...b,activeExpedition:null,lastExpedition:null,unlockedIds:['depth-1']}};});
 });
}
