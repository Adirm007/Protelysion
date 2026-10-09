/** 0.40 正文模式（宿主侧）：
 *  - 游戏里点“正文模式”：存档带 narrative 标记写回聊天（缓存存档），聊天变量 booksea.narrativeMode 写入当前楼层信息供读者 EJS 注入，
 *    然后以用户身份发送“普罗泰利西翁正文模式”并触发正文；
 *  - 正文末尾的 <booksea-game>迷宫模式</booksea-game> 面板：迷宫模式（沿用缓存继续玩，层数用正文推进到的层数）/
 *    进入下一层（只推进层数并请求正文）/ 离开迷宫（结算缓存存档所得、结束本趟、清理缓存）。 */
import {object} from '../core/actors';
import {narrativeFloor,narrativeBreakpoint,narrativeDescend,exitNarrative,leaveFromNarrative,activeParty,type State,type NarrativeFloor} from '../game/expedition';
import {resumeHostExpedition} from './resume';
import {checkpointHost,type SessionPort} from './game-session';

export type NarrativeChat={version:1;active:true;runId:string;contextId:string;depth:number;startDepth:number;floor:NarrativeFloor;party:string[];updatedAt:number};
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
  await port.prepare?.();const s=restore(port,readLocal),from=s.narrative!.depth,depth=narrativeDescend(s);
  await checkpointHost(port,s);await setNarrativeChat(port,narrativeChat(s,port.id()));
  const f=narrativeFloor(depth,s.regionSeed??s.seed);
  await port.postNarrative!('narrative-descend',s.run.id,depth,`<user>与同行者从第 ${from} 层继续深入，来到第 ${depth} 层：主题「${f.themeName}」（${f.subtitle}）· 场景「${f.scene}」。本层敌怪等级 Lv.${f.level}，战利品品质 ${f.quality}。`);
  return f;
 });
}
/** 正文模式里离开迷宫：缓存存档按正文层数撤离结算，照常发送离场请求并触发正文。 */
export async function leaveNarrativeMode(port:SessionPort,readLocal:()=>string|null){
 return port.lock(`booksea-narrative:${port.id()}`,async()=>{
  await port.prepare?.();const s=restore(port,readLocal);leaveFromNarrative(s);
  if(s.mode!=='ended')throw Error('离开迷宫未完成，请切回迷宫模式后从入口返回');
  await clearNarrativeChat(port);await checkpointHost(port,s);
 });
}
/** 切回迷宫模式：清除正文标记（层数跳到正文推进到的层），之后由入口照常启动游戏。 */
export async function resumeFromNarrative(port:SessionPort,s:State){if(!s.narrative?.active)return;exitNarrative(s);await clearNarrativeChat(port);}
