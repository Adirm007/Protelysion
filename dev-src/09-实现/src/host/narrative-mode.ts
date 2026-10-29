/** 0.40 正文模式（宿主侧）：
 *  - 游戏里点“正文模式”：存档带 narrative 标记写回聊天（缓存存档），聊天变量 booksea.narrativeMode 写入当前楼层信息供读者 EJS 注入，
 *    然后以用户身份发送“普罗泰利西翁正文模式”并触发正文；
 *  - 正文末尾的 <booksea-game>迷宫模式</booksea-game> 面板：迷宫模式（沿用缓存继续玩，层数用正文推进到的层数）/
 *    进入下一层（只推进层数并请求正文）/ 离开迷宫（结算缓存存档所得、结束本趟、清理缓存）。 */
import {object,actorAt,finite,integer,hostLevel,resourceMax,ATTRIBUTES} from '../core/actors';
import {rebaseUnitNumeric} from '../battle/executor';
import {hostMitigation} from '../game/content';
import {narrativeFloor,narrativeBreakpoint,narrativeDescend,exitNarrative,handoffNarrativeEncounter,leaveFromNarrative,activeParty,view,type State,type NarrativeFloor} from '../game/expedition';
import {resumeHostExpedition} from './resume';
import {checkpointHost,type SessionPort} from './game-session';
import {narrativeExtra,type NarrativeMeta} from '../core/handoff-message';
import {promptData} from '../compiler/engine';

export type NarrativeChat={version:1;active:true;runId:string;contextId:string;depth:number;startDepth:number;floor:NarrativeFloor;party:string[];updatedAt:number;transition?:'user-message';breakpoint?:string};
const book=(port:Pick<SessionPort,'chat'>)=>object(port.chat().booksea??{});
export function narrativeChat(s:State,contextId:string):NarrativeChat{
 const depth=s.narrative?.depth??s.depth;
 return {version:1,active:true,runId:s.run.id,contextId,depth,startDepth:s.narrative?.startDepth??s.depth,floor:narrativeFloor(depth,s.regionSeed??s.seed),
  party:activeParty(s).map(p=>p.name),updatedAt:Date.now()};
}
/** 聊天记录里的存档才是权威：处于正文模式的未结束远征。 */
export function narrativeExpedition(port:Pick<SessionPort,'chat'|'id'>):State|undefined{
 const a=book(port).activeExpedition as State|undefined;
 return a&&a.mode!=='ended'&&a.narrative?.active&&a.hostContext===port.id()?a:undefined;
}
async function setNarrativeChat(port:SessionPort,value:NarrativeChat|null){await port.updateChat(v=>({...v,booksea:{...object(v.booksea??{}),narrativeMode:value}}));}
export async function clearNarrativeChat(port:SessionPort){try{if(book(port).narrativeMode)await setNarrativeChat(port,null);}catch{/* 只是给 EJS 的镜像；存档里的 narrative 标记才是权威 */}}
function restore(port:SessionPort,readLocal:()=>string|null):State{
 const s=resumeHostExpedition(book(port).activeExpedition,readLocal,port.id(),port.authorizedFrames?.());
 if(!s.narrative?.active)throw Error('这趟旅程已经不在正文模式');
 port.bind?.(s);return s;
}
/** 游戏里切到正文模式之后（存档已写回）：写楼层镜像，发送请求并触发正文。 */
export async function enterNarrativeMode(port:SessionPort,s:State){
 if(!s.narrative?.active)throw Error('这趟旅程没有进入正文模式');
 if(!port.postNarrative)throw Error('当前环境不能发送正文请求');
 await port.prepare?.();await setNarrativeChat(port,narrativeChat(s,port.id()));
 await port.postNarrative('narrative',s.run.id,s.narrative.depth,narrativeBreakpoint(s));
}
export async function descendNarrativeMode(port:SessionPort,readLocal:()=>string|null):Promise<NarrativeFloor>{
 if(!port.postNarrative)throw Error('当前环境不能发送正文请求');
 return port.lock(`booksea-narrative:${port.id()}`,async()=>{
  await port.prepare?.();const s=restore(port,readLocal);
  reconcileNarrativeResources(port,s);
  const from=s.narrative!.depth,depth=narrativeDescend(s);
  await checkpointHost(port,s);await setNarrativeChat(port,narrativeChat(s,port.id()));
  const f=narrativeFloor(depth,s.regionSeed??s.seed);
  await port.postNarrative!('narrative-descend',s.run.id,depth,`<user>与同行者从第 ${from} 层继续深入，来到第 ${depth} 层：主题「${f.themeName}」（${f.subtitle}）· 场景「${f.scene}」。本层敌怪等级 Lv.${f.level}，战利品品质 ${f.quality}。`);
  return f;
 });
}
/** 正文模式里离开迷宫：缓存存档按正文层数撤离结算，照常发送离场请求并触发正文。 */
export async function leaveNarrativeMode(port:SessionPort,readLocal:()=>string|null){
 return port.lock(`booksea-narrative:${port.id()}`,async()=>{
  await port.prepare?.();const s=restore(port,readLocal);reconcileNarrativeResources(port,s);leaveFromNarrative(s);
  if(s.mode!=='ended')throw Error('离开迷宫未完成，请切回迷宫模式后从入口返回');
  await clearNarrativeChat(port);await checkpointHost(port,s);
 });
}
/** 切回迷宫模式：清除正文标记（层数跳到正文推进到的层），之后由入口照常启动游戏。 */
export async function resumeFromNarrative(port:SessionPort,s:State){
 if(!s.narrative?.active)return;
 reconcileNarrativeResources(port,s);
 if(hasNarrativeReply(port,s))handoffNarrativeEncounter(s);
 exitNarrative(s);await clearNarrativeChat(port);
}

function hasNarrativeReply(port:SessionPort,s:State):boolean{
 const n=s.narrative;if(n?.transition!=='user-message'||!Number.isSafeInteger(n.messageId)||n.depth!==s.depth||!port.readNarrativeMessages)return false;
 const rows=port.readNarrativeMessages(),owner=rows.find(m=>m.message_id===n.messageId),meta=owner?.extra?.bookseaHandoff as NarrativeMeta|undefined;
 if(owner?.role!=='user'||meta?.version!==2||meta.kind!=='narrative'||meta.messageId!==n.messageId||meta.runId!==s.run.id||meta.contextId!==port.id())return false;
 return rows.some(m=>{
  if((m.message_id??-1)<=n.messageId!||m.role!=='assistant'||!m.finished||m.failed)return false;
  const prose=m.message.replace(/<(booksea-game|UpdateVariable|JSONPatch|think|thinking|analysis)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'').replace(/<!--[^]*?-->/g,'').replace(/<[^>]*>/g,'').replace(/&(?:nbsp|#160);/gi,' ').trim();
  return /[\p{L}\p{N}]/u.test(prose)&&!/^(?:error|exception|generation failed|生成失败|生成错误|请求失败|网络错误)(?:\s*[:：]|$)/i.test(prose);
 });
}

/** Prose may consume the host's HP/MP/SP or original items while the numeric
 * encounter is frozen. Respect those current values without replaying its paid
 * casts, resetting the clock, or importing prose loot into unsettled rewards. */
function reconcileNarrativeResources(port:SessionPort,s:State){
 const mvu=port.read();
 // Validate the whole handoff before changing the cached encounter. Invalid MVU
 // must not leave half-adopted resources behind for a subsequent retry.
 const party=s.party.filter(p=>p.ref).map(p=>{
  const actor=actorAt(mvu,p.ref!),current={} as State['party'][number]['current'],numeric={level:hostLevel(actor),attributes:{} as typeof p.card.numeric.attributes,max:{} as typeof p.card.numeric.max};
  for(const key of ATTRIBUTES)numeric.attributes[key]=finite(object(actor.属性)[key],key);
  for(const [key,label] of [['hp','生命值'],['mp','法力值'],['sp','体力值']] as const){
   const amount=finite(object(actor[label]).当前,`${p.name}${label}.当前`);numeric.max[key]=resourceMax(actor,label);if(amount<0||amount>numeric.max[key])throw Error(`${p.name}${label}.当前超出范围`);current[key]=amount;
  }
  const bag=object(actor.背包),dependencies:Record<string,number>={};
  const known=new Set([...Object.keys(bag),...Object.keys(p.persistent?.dependencies??{}).filter(k=>k.startsWith('inventory:')).map(k=>k.slice(10))]);
  for(const name of known)dependencies['inventory:'+name]=bag[name]===undefined?0:integer(object(bag[name]).数量,`物品「${name}」库存`);
  return {p,current,dependencies,numeric};
 });
 const receipt=object(object(mvu.bookseaSessionReceipts??{})[s.run.id]??{}),items=object(receipt.items??{});
 const inventory=Object.entries(s.inventory??{}).map(([id,item])=>{const bag=object(actorAt(mvu,item.owner).背包);return {item,count:bag[item.name]===undefined?0:integer(object(bag[item.name]).数量,`物品「${item.name}」库存`),used:Math.max(integer(item.used,'物品累计消耗'),integer(items[id]??0,'已写回物品消耗'))};});
 const fp=integer(object(mvu.stat_data).命运点数,'命运点数'),spent=integer(receipt.hostFpSpent??0,'已写回命运点数消费'),totalSpent=Math.max(integer(s.hostFpSpent??0,'累计命运点数消费'),spent);
 for(const {p,current,dependencies,numeric} of party){
  p.card.numeric=numeric;p.current={...current};
  p.persistent??={};p.persistent.dependencies={...p.persistent.dependencies,...dependencies};
  for(const battle of [s.battle,s.world]){const unit=battle?.units.find(u=>u.id===p.id);if(unit){rebaseUnitNumeric(battle!,p.id,numeric,hostMitigation(p.card),current);unit.dependencies={...unit.dependencies,...dependencies};}}
 }
 for(const {item,count,used} of inventory){item.remaining=count;item.used=used;}
 // hostFpSpent remains cumulative for checkpoint receipts. Refresh its base by
 // the amount already committed, so prose FP changes neither revive an old
 // wallet nor cause a second charge for the same game purchase.
 s.hostFp=fp+spent;s.hostFpSpent=totalSpent;
}

/** The prose follows the actual frozen encounter, including a cast/choice that
 * has not resolved. Presentation state is quoted as data, never executed as EJS. */
export function userNarrativeBreakpoint(s:State):string{
 const v=view(s),b=s.battle;
 const commands=b?Object.values(b.commands).filter(c=>b.clock.pending.some(p=>p.kind==='resolve'&&p.commandId===c.id)||b.clock.units.some(u=>u.cast?.commandId===c.id)).map(c=>({
  actor:b.units.find(u=>u.id===c.caster)?.name??c.caster,action:c.action.name??c.sourceId,targets:(c.targets??[c.target]).map(id=>b.units.find(u=>u.id===id)?.name??id),paid:c.paid??null,
 })):[];
 const state={
  position:{depth:s.depth,theme:v.themeName,scene:s.region.name,x:s.x,z:s.z},phase:s.mode,
  party:v.party.map(p=>({name:p.name,level:p.level,status:p.status,hp:p.hp,maxHp:p.maxHp,mp:p.mp,maxMp:p.maxMp,sp:p.sp,maxSp:p.maxSp})),
  encounter:b?{outcome:b.outcome,timeMs:b.clock.timeMs,units:v.battle.units.map(u=>({name:u.name,side:u.side,alive:u.alive,hp:u.hp,maxHp:u.maxHp,mp:u.mp,sp:u.sp,shield:u.shield,statuses:u.statuses})),pending:commands,
   decision:b.clock.pending.map(p=>({kind:p.kind,actor:b.units.find(u=>u.id===p.unitId)?.name??p.unitId})),selectedAction:s.selected,selectedTargets:s.selectedTargets??[],recent:v.battle.log.slice(-8)}:null,
  interaction:s.mode==='event'?v.event:s.mode==='supplier'?v.supplier:null,
  nearby:s.region.things.filter(t=>!t.used&&Math.abs(t.x-s.x)+Math.abs(t.z-s.z)<=2).map(t=>({kind:t.kind,name:t.name,x:t.x,z:t.z})),
  currentIntent:{notice:v.notice,warning:v.warning,exitConfirmation:!!s.exitAsk},
  gains:{unsettledFp:v.pendingFp,unsettledRewards:v.loot,relics:v.relicDetails.map(r=>({name:r.name,owner:r.ownerName,stacks:r.stacks})),bag:v.bag},
 };
 return promptData({journey:narrativeBreakpoint(s),...state});
}

/** Called by the awaited pre-generation listener while the previous frame is
 * still current. This also makes the facts available to EJS generate-before. */
export async function prepareUserNarrative(port:SessionPort,s:State):Promise<NarrativeMeta>{
 if(s.source!=='host'||s.hostContext!==port.id()||s.run.status!=='active'||s.mode==='ended')throw Error('当前没有可交接的迷宫现场');
 s.paused=true;
 for(const p of s.party){const u=(s.battle??s.world)?.units.find(u=>u.id===p.id);if(u)p.current={...u.current};}
 const waiting=Object.values(s.supplierTalks??{}).some(t=>t.pending);
 // In-flight supplier replies cannot execute a later trade against this snapshot.
 for(const talk of Object.values(s.supplierTalks??{}))if(talk.pending){talk.pending=false;talk.serial++;}
 // Save the original paused encounter on the old frame. Deleting the user's
 // forthcoming message must restore this encounter, not a future prose mode.
 await checkpointHost(port,s);
 s.narrative??={active:true,startDepth:s.depth,depth:s.depth,since:Date.now()};s.narrative.active=true;s.narrative.transition='user-message';
 const summary=userNarrativeBreakpoint(s)+(waiting?'\n补给员此前的回复尚未完成，尚未产生新的交易结果。':''),mirror: NarrativeChat={...narrativeChat(s,port.id()),transition:'user-message',breakpoint:summary};
 if(!port.previewNarrative)throw Error('当前宿主缺少生成前现场交接接口');
 await port.previewNarrative(mirror);
 port.bind?.(s);
 return narrativeExtra(port.id(),s.run.id,'narrative',s.narrative.depth,summary).bookseaHandoff;
}

/** The host already appended the user's original message. Adopt that frame and
 * attach facts without appending another request or starting another generation. */
export async function attachUserNarrative(port:SessionPort,s:State,meta:NarrativeMeta):Promise<void>{
 if(meta.contextId!==port.id()||meta.runId!==s.run.id)throw Error('正文交接身份已变化');
 await port.prepare?.();if(s.narrative)s.narrative.messageId=port.messageId();port.bind?.(s);await checkpointHost(port,s);
 await setNarrativeChat(port,{...narrativeChat(s,port.id()),transition:'user-message',breakpoint:meta.summary});
 if(!port.attachNarrative)throw Error('当前宿主缺少原消息正文交接接口');
 await port.attachNarrative(meta);port.bind?.(s);
}
