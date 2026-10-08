/** 0.40 正文模式面板：正文末尾的 <booksea-game>迷宫模式</booksea-game> 由同一个外链加载正则渲染到这里。
 *  只在“当前聊天的远征处于正文模式”时出现；不是最新一条消息时只显示信息、按钮停用。
 *  迷宫模式 → 照常进入书间并自动继续；进入下一层 → 只推进层数并请求正文；离开迷宫 → 结算缓存存档并发送离场请求。 */
import {sessionPort} from '../host/game-session';
import {narrativeFloor,activeParty,type State} from '../game/expedition';
import {descendNarrativeMode,leaveNarrativeMode} from '../host/narrative-mode';
import {shellHeader,escapeHtml as esc} from '../ui/theme';

/** 与书间入口同一份本机存档键（host-game-entry）。 */
const hostRunKey=(contextId:string)=>'booksea-host-run:random-v2:'+contextId;
export function narrativeState(globals:any):State|undefined{
 try{
  const h=globals.TavernHelper??globals,ctx=globals.SillyTavern?.getContext?.();
  const a=h.getVariables?.({type:'chat'})?.booksea?.activeExpedition as State|undefined;
  if(!a||a.mode==='ended'||!a.narrative?.active)return undefined;
  if(ctx&&typeof ctx.getCurrentChatId==='function'&&a.hostContext!==`${ctx.characterId}:${ctx.getCurrentChatId()}`)return undefined;
  return a;
 }catch{return undefined;}
}
function latestMessage(globals:any):boolean{
 try{const h=globals.TavernHelper??globals,own=typeof globals.getCurrentMessageId==='function'?globals.getCurrentMessageId():typeof h.getCurrentMessageId==='function'?h.getCurrentMessageId():undefined;
  return typeof own!=='number'||own===Number(h.getLastMessageId());}catch{return true;}
}
const PANEL_STYLE=`.bs-portal.bs-narrative{min-height:0}.bs-narrative-body{padding:18px 22px 22px;display:grid;gap:12px}.bs-narrative-floor{margin:0;font-size:20px;letter-spacing:.06em;color:#f0e2c2}.bs-narrative-meta{margin:0;font-size:13.5px;line-height:1.7;opacity:.82}
.bs-narrative-actions{display:flex;flex-wrap:wrap;gap:10px}.bs-narrative-actions .bs-button{flex:1 1 140px;justify-content:center}.bs-narrative-note{margin:0;font-size:12.5px;opacity:.7;line-height:1.6}
@media(max-width:480px){.bs-narrative-body{padding:14px 2px 16px;gap:10px}.bs-narrative-floor{font-size:18px}}`;
export function mountNarrativePanel(root:HTMLElement,globals:any,toMaze:()=>void):{dispose():void}|undefined{
 const s=narrativeState(globals);if(!s)return undefined;
 const latest=latestMessage(globals),depth=s.narrative!.depth,f=narrativeFloor(depth,s.regionSeed??s.seed);
 const party=activeParty(s).map(p=>p.name);
 root.innerHTML=`<style>${PANEL_STYLE}</style><section class="bs-portal bs-narrative">${shellHeader('正文模式')}
 <div class="bs-narrative-body"><p class="bs-narrative-floor">第 ${depth} 层 · ${esc(f.themeName)} · ${esc(f.scene)}</p>
 <p class="bs-narrative-meta">本层敌怪 Lv.${f.level} · 战利品品质 ${esc(f.quality)}${f.bossFloor?' · 本层有区域守关者':''}<br>同行：${esc(party.join('、')||'—')}；迷宫进度已缓存（从第 ${s.narrative!.startDepth} 层切出）</p>
 <div class="bs-narrative-actions"><button id="nm-maze" class="bs-button">迷宫模式</button><button id="nm-down" class="bs-button">进入下一层</button><button id="nm-leave" class="bs-button">离开迷宫</button></div>
 <p id="nm-status" class="bs-player-status" role="status" aria-live="polite"></p>
 <p class="bs-narrative-note">${latest?'迷宫模式：接着缓存的进度继续游戏化游玩（层数按正文推进到的层数）。进入下一层：以正文方式继续深入。离开迷宫：结算缓存存档里的所得，结束本次探索。':'这是较早的面板；请使用最新一条消息末尾的面板。'}</p></div></section>`;
 const el=(id:string)=>root.querySelector<HTMLButtonElement>('#'+id)!,status=(t:string)=>{root.querySelector('#nm-status')!.textContent=t;};
 const buttons=['nm-maze','nm-down','nm-leave'].map(el);let busy=false,leaveArmed=false,disposed=false;
 const lock=(on:boolean)=>{for(const b of buttons)b.disabled=on||!latest;};lock(false);
 const run=async(label:string,fn:()=>Promise<string>)=>{if(busy||disposed)return;busy=true;lock(true);status(label);
  try{status(await fn());}catch(error){status('没有完成：'+String((error as Error)?.message??error));busy=false;lock(false);}};
 el('nm-maze').onclick=()=>{if(busy)return;busy=true;lock(true);toMaze();};
 el('nm-down').onclick=()=>void run('正在前往下一层……',async()=>{const port=sessionPort(globals),next=await descendNarrativeMode(port,()=>globals.localStorage?.getItem(hostRunKey(port.id()))??null);return `已来到第 ${next.depth} 层（${next.themeName} · ${next.scene}），正文生成中……`;});
 el('nm-leave').onclick=()=>{if(!leaveArmed){leaveArmed=true;el('nm-leave').textContent='确认离开迷宫';status('再点一次确认：结算缓存存档里的所得，并结束本次迷宫探索。');return;}
  void run('正在结算并离开迷宫……',async()=>{const port=sessionPort(globals);await leaveNarrativeMode(port,()=>globals.localStorage?.getItem(hostRunKey(port.id()))??null);return '已离开普罗泰利西翁：所得已结算，正在书写归途……';});};
 return {dispose(){disposed=true;}};
}
