/** 0.40 正文模式面板：正文末尾的 <booksea-game>迷宫模式</booksea-game> 由同一个外链加载正则渲染到这里。
 *  只在“当前聊天的远征处于正文模式”时出现；不是最新一条消息时只显示信息、按钮停用。
 *  迷宫模式 → 照常进入书间并自动继续；进入下一层 → 只推进层数并请求正文；离开迷宫 → 结算缓存存档并发送离场请求。 */
import {sessionPort} from '../host/game-session';
import {narrativeFloor,activeParty,type State} from '../game/expedition';
import {descendNarrativeMode,leaveNarrativeMode} from '../host/narrative-mode';
import {shellHeader,escapeHtml as esc} from '../ui/theme';
import {BK,paperFill,tornEdge} from '../ui/binding-kit';

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
// The chat's end of a chapter: a paper slip with three bookmark ribbons hanging from it (red = back into the maze,
// blue = read on into the next floor, ink = close the book). Fixed-size ribbons keep a 44px+ touch target.
const PANEL_STYLE=`.bs-portal.bs-narrative{min-height:0}
.bs-portal.bs-narrative{background:transparent;overflow:visible;padding:4px 0 6px}
.bs-narrative-leaf{position:relative;z-index:2;max-width:640px;margin:0 auto;padding:12px 20px 18px;background:${paperFill()};box-shadow:0 10px 24px rgba(0,0,0,.35),inset 0 0 0 1px rgba(35,24,15,.18)}
.bs-narrative-leaf::after{content:'';position:absolute;left:0;right:0;bottom:-6px;height:7px;background:${BK.page2};clip-path:${tornEdge(3,34,60)}}
.bs-narrative-body{padding:12px 2px 0;display:grid;gap:10px}
.bs-narrative-floor{margin:0;font:900 20px/1.4 var(--bk-display);letter-spacing:.12em;color:${BK.ink}}
.bs-narrative-meta{margin:0;font-size:13.5px;line-height:1.75;color:${BK.ink2}}
.bs-narrative-note{margin:0;font-size:12.5px;line-height:1.7;color:${BK.ink3}}
.bs-narrative-actions{position:relative;z-index:1;display:flex;justify-content:center;gap:clamp(16px,6vw,46px);max-width:640px;margin:-4px auto 0;padding:0 0 4px}
.bs-root .bs-narrative-actions .bs-button{position:relative;display:block;width:54px;min-height:150px;padding:20px 0 30px;border:0;border-radius:0;writing-mode:vertical-rl;font:900 16px/1 var(--bk-display);letter-spacing:.34em;color:#fff6ea;text-shadow:0 1px 0 rgba(0,0,0,.35);background:linear-gradient(90deg,rgba(0,0,0,.28),rgba(255,255,255,.14) 46%,rgba(0,0,0,.08) 60%,rgba(0,0,0,.3)),var(--rib);clip-path:polygon(0 0,100% 0,100% 100%,50% calc(100% - 18px),0 100%);box-shadow:none;transition:transform .2s cubic-bezier(.3,1.4,.5,1),filter .15s}
.bs-root .bs-narrative-actions .bs-button:hover:not(:disabled),.bs-root .bs-narrative-actions .bs-button:focus-visible{transform:translateY(6px);filter:brightness(1.08)}
.bs-root .bs-narrative-actions .bs-button:focus-visible{outline:2px solid ${BK.errata};outline-offset:-5px}
.bs-root .bs-narrative-actions .bs-button:disabled{filter:saturate(.25) brightness(.75);opacity:.75}
#nm-maze{--rib:${BK.ribbon}}#nm-down{--rib:${BK.marbleA}}#nm-leave{--rib:#3a2a20}
.bs-narrative .bs-player-status{margin-top:6px!important}
@media(max-width:480px){.bs-narrative-leaf{padding:10px 14px 16px}.bs-narrative-floor{font-size:18px}.bs-root .bs-narrative-actions .bs-button{width:50px;min-height:136px;font-size:15px}}`;
export function mountNarrativePanel(root:HTMLElement,globals:any,toMaze:()=>void):{dispose():void}|undefined{
 const s=narrativeState(globals);if(!s)return undefined;
 const latest=latestMessage(globals),depth=s.narrative!.depth,f=narrativeFloor(depth,s.regionSeed??s.seed);
 const party=activeParty(s).map(p=>p.name);
 root.innerHTML=`<style>${PANEL_STYLE}</style><section class="bs-portal bs-narrative"><div class="bs-narrative-leaf">${shellHeader('正文模式')}
 <div class="bs-narrative-body"><p class="bs-narrative-floor">第 ${depth} 层 · ${esc(f.themeName)} · ${esc(f.scene)}</p>
 <p class="bs-narrative-meta">本层敌怪 Lv.${f.level} · 战利品品质 ${esc(f.quality)}${f.bossFloor?' · 本层有区域守关者':''}<br>同行：${esc(party.join('、')||'—')}；迷宫进度已缓存（从第 ${s.narrative!.startDepth} 层切出）</p>
 <p id="nm-status" class="bs-player-status" role="status" aria-live="polite"></p>
 <p class="bs-narrative-note">${latest?'迷宫模式：接着缓存的进度继续游戏化游玩（层数按正文推进到的层数）。进入下一层：以正文方式继续深入。离开迷宫：结算缓存存档里的所得，结束本次探索。':'这是较早的面板；请使用最新一条消息末尾的面板。'}</p></div></div>
 <div class="bs-narrative-actions"><button id="nm-maze" class="bs-button">迷宫模式</button><button id="nm-down" class="bs-button">进入下一层</button><button id="nm-leave" class="bs-button">离开迷宫</button></div></section>`;
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
