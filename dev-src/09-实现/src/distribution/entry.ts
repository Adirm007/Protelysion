import {mountHostGame} from '../host-game-entry';
import {ResourceStore,RESOURCE_CACHE,type ReleaseManifest} from './resource-cache';
import {mountExpeditionRuntime} from '../game/runtime';
import {playtestParty} from '../game/content';
import {startExpedition} from '../game/expedition';
import {installPlayerTheme,shellHeader,hero,modalFrame,bindModal,icons} from '../ui/theme';
import {mountNarrativePanel} from './narrative-panel';
const mb=(n:number)=>(n/1000000).toFixed(1)+' MB';
type BootConfig={base:string;manifest:ReleaseManifest;mode?:'host'|'standalone'};
export async function boot(root:HTMLElement,config:BootConfig,win:Window=window):Promise<{dispose():void;store?:ResourceStore}>{
 installPlayerTheme(root);root.parentElement?.querySelector(':scope > footer')?.remove();
 const globals=win as any;
 if(config.mode!=='standalone'&&(!globals.SillyTavern?.getContext||typeof (globals.TavernHelper??globals).getVariables!=='function'))throw Error('请从聊天中的书海入口打开。');
 // 0.40 正文模式：正文末尾的标签先显示三按钮面板；选“迷宫模式”才进入书间并自动继续。
 if(config.mode!=='standalone'){let portal:{dispose():void}|undefined;const panel=mountNarrativePanel(root,globals,()=>{void bootPortal(root,config,win,true).then(p=>{portal=p;});});if(panel)return {dispose(){panel.dispose();portal?.dispose();}};}
 return bootPortal(root,config,win,false);
}
async function bootPortal(root:HTMLElement,config:BootConfig,win:Window,autoResume:boolean){
 const base=new URL(config.base),store=await ResourceStore.open(win,base,config.manifest),globals=win as any;
 root.innerHTML=`<section id="resource-setup" class="bs-portal">${shellHeader('夜梦的书间',`<button id="resource-options" class="bs-icon-button" title="设置" aria-label="设置">${icons.gear}</button>`)}${hero('将零散的书页钉在一起，看上去乱七八糟的无限迷宫。<br>向你和命定之人开放的训练场','普罗泰利西翁',false,true)}
 <div class="bs-resource-card"><div class="bs-card-title"><div>${icons.spark}<h2>启程准备</h2></div><span id="resource-percent" class="bs-percent">0%</span></div><progress id="resource-progress" max="1" value="0" aria-label="下载进度"></progress><div class="bs-download-info"><span id="resource-status" role="status">准备中</span><span id="resource-count"></span></div><div class="bs-download-options"><button id="download-all" class="bs-option bs-primary"><span><strong>完整下载</strong><small id="all-size"></small></span>${icons.arrow}</button><button id="download-core" class="bs-option"><span><strong>轻装启程</strong><small id="core-size"></small></span>${icons.arrow}</button></div></div>
 <footer class="bs-footer"><span>ADIRM007</span><a id="resource-credits" target="_blank" rel="noopener">制作名单</a></footer></section><section id="distribution-game" hidden></section>
 ${modalFrame('resource-menu','资源管理','<div class="bs-settings-row"><span id="storage-size">已下载</span><button id="resource-clear" class="bs-button">清理下载</button></div><p id="resource-menu-status" class="bs-player-status" role="status"></p>')}`;
 const el=(id:string)=>root.querySelector<HTMLElement>('#'+id)!,status=el('resource-status'),progress=el('resource-progress') as HTMLProgressElement,game=el('distribution-game');
 (el('resource-credits') as HTMLAnchorElement).href=new URL('credits.html',base).href;
 const [all,core]=await Promise.all([store.status(),store.status(true)]),menu=bindModal(el('resource-menu'));
 el('all-size').textContent=mb(all.bytes);el('core-size').textContent=mb(core.bytes);el('resource-count').textContent=mb(all.cachedBytes)+' / '+mb(all.bytes);el('storage-size').textContent='已下载 '+mb(all.cachedBytes);
 el('resource-percent').textContent=Math.floor(all.cachedBytes/all.bytes*100)+'%';progress.value=all.cachedBytes/all.bytes;
 status.textContent=all.cachedFiles===all.files?'已准备好':'等待启程';
 Object.assign(win,{BookseaResources:{inspect:()=>store.inspect(),status:(coreOnly=false)=>store.status(coreOnly)},BookseaResourceMenu:menu});el('resource-options').onclick=menu.open;
 let busy=false,started=false;let cleanup:()=>void=()=>{};
 async function launch(coreOnly:boolean){
  if(busy||started)return;busy=true;(el('download-all') as HTMLButtonElement).disabled=true;(el('download-core') as HTMLButtonElement).disabled=true;
  try{
   try{await win.navigator.storage?.persist?.();}catch{}
   await store.prefetch(coreOnly,p=>{progress.value=p.readyBytes/p.totalBytes;el('resource-percent').textContent=Math.floor(progress.value*100)+'%';status.textContent=p.completed===p.total?'正在展开书页':'正在下载';el('resource-count').textContent=mb(p.readyBytes)+' / '+mb(p.totalBytes);el('storage-size').textContent='已下载 '+mb(p.readyBytes);});
   try{win.localStorage.setItem('protelysion-resource-mode',coreOnly?'core':'all');}catch{}
   store.installFetch();globals.BOOKSEA_ASSET_BASE=base.href;
   if(config.mode==='standalone'){
    installPlayerTheme(game);game.classList.add('bs-playing');game.innerHTML='<div class="bs-portal"><section id="stage" class="bs-stage"><canvas id="canvas" width="1280" height="720" tabindex="0"></canvas></section></div>';
    const runtime=mountExpeditionRuntime({storageKey:'booksea-expedition-random-v2',uiRoot:el('stage'),onResources:menu.open,newGame:()=>startExpedition(playtestParty(),Date.now()>>>0),audio:{baseUrl:new URL('audio/',base).href,controlsRoot:el('stage')}},win);
    cleanup=()=>runtime.dispose();
    const Engine=await store.loadEngine(),engine=new Engine({executable:new URL('game',base).href,mainPack:new URL('game.pck',base).href,canvas:el('canvas'),canvasResizePolicy:0,focusCanvas:true});cleanup=()=>{runtime.dispose();engine.requestQuit();};game.hidden=false;await engine.startGame();
   }else{const app=mountHostGame(game,globals,{loadEngine:()=>store.loadEngine(),autoResume});cleanup=app.dispose;}
   el('resource-setup').hidden=true;game.hidden=false;root.classList.add('bs-playing');started=true;
  }catch(error){cleanup();game.replaceChildren();game.hidden=true;status.textContent=/空间|quota/i.test(String(error))?'空间不足，请清理后重试。':'下载暂时中断，点击重试。';}
  finally{busy=false;(el('download-all') as HTMLButtonElement).disabled=false;(el('download-core') as HTMLButtonElement).disabled=false;}
 }
 el('download-all').onclick=()=>void launch(false);el('download-core').onclick=()=>void launch(true);
 const clear=el('resource-clear') as HTMLButtonElement;let confirmUntil=0;
 clear.onclick=()=>{if(busy){el('resource-menu-status').textContent='请等这次下载完成。';return;}if(Date.now()>confirmUntil){confirmUntil=Date.now()+10000;clear.textContent='再次点击确认';el('resource-menu-status').textContent='不会删除你的旅程。';return;}confirmUntil=0;clear.disabled=true;void win.caches.delete(RESOURCE_CACHE).then(()=>{clear.textContent='已清理';el('resource-menu-status').textContent='下次进入时重新下载。';el('storage-size').textContent='已清理下载';}).catch(()=>{clear.disabled=false;clear.textContent='清理下载';el('resource-menu-status').textContent='暂时未能清理，请再试一次。';});};
 let preferCore=false;try{preferCore=win.localStorage.getItem('protelysion-resource-mode')==='core';}catch{}
 if(all.cachedFiles===all.files)await launch(false);else if(preferCore&&core.cachedFiles===core.files)await launch(true);
 win.addEventListener('pagehide',()=>{cleanup();store.dispose();},{once:true});
 return {dispose(){cleanup();store.dispose();},store};
}
