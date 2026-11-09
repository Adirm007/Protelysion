import {mountHostGame} from '../host-game-entry';
import {ResourceStore,type ReleaseManifest} from './resource-cache';
import type {FixedRelease} from './fixed-release';
import {mountExpeditionRuntime} from '../game/runtime';
import {playtestParty} from '../game/content';
import {startExpedition} from '../game/expedition';
import {installPlayerTheme,hero,modalFrame,bindModal} from '../ui/theme';
import {registerUiAssets} from '../ui/ui-art';
import {BINDING_ART} from '../ui/art-binding';
import {mountNarrativePanel} from './narrative-panel';
import {narrativeState} from './narrative-panel';
import {createBestiary,localBestiaryPort} from '../game/bestiary';
import {bestiaryArtCache} from '../ui/bestiary-art';
import {mountBestiaryPanel} from '../ui/bestiary-panel';
const mb=(n:number)=>(n/1000000).toFixed(1)+' MB';
const localStore=(win:Window)=>{try{return win.localStorage;}catch{return undefined;}};
export type BootConfig={base:string;manifest:ReleaseManifest;mode?:'host'|'standalone';fixedRelease?:FixedRelease};
type PersistentOptions={onUserNarrative?:()=>void};
/** One reader-owned view, independent of the <booksea-game> message that opened it. */
export async function bootPersistent(root:HTMLElement,config:BootConfig,win:Window=window,options:PersistentOptions={}){
 if(config.mode==='standalone')throw Error('常驻窗口需要连接当前角色聊天');
 installPlayerTheme(root);
 const portal=await bootPortal(root,config,win,false,options);
 let disposed=false,panel:ReturnType<typeof mountNarrativePanel>,panelRoot:HTMLElement|undefined;
 const clearPanel=()=>{panel?.dispose();panel=undefined;panelRoot?.remove();panelRoot=undefined;};
 return {
  setVisible:async(visible:boolean)=>{if(!disposed)await portal.setVisible(visible);},
  async action(kind='maze'){
   if(disposed)return;
   if(!['maze','narrative','descend','leave'].includes(kind))throw Error('未知的书海操作');
   clearPanel();
   if(kind==='maze'){
    if(narrativeState(win))await portal.resume();
    await portal.setVisible(true);return;
   }
   await portal.setVisible(false);
   panelRoot=win.document.createElement('section');panelRoot.className='bs-root';
   panelRoot.style.cssText='position:fixed;inset:0;overflow:auto;background:#1a100c;padding:12px;z-index:2000';
   root.append(panelRoot);
   panel=mountNarrativePanel(panelRoot,win,()=>{clearPanel();void portal.resume().then(()=>portal.setVisible(true));});
   if(!panel){clearPanel();await portal.setVisible(true);return;}
   // Leaving retains the existing two-click confirmation in the narrative panel.
   if(kind==='descend'||kind==='leave')panelRoot.querySelector<HTMLButtonElement>(kind==='descend'?'#nm-down':'#nm-leave')?.click();
  },
  dispose(){if(disposed)return;disposed=true;clearPanel();portal.dispose();},
  inspect:()=>({disposed,hasNarrativePanel:!!panel,resources:portal.store.inspect()})
 };
}
export async function boot(root:HTMLElement,config:BootConfig,win:Window=window):Promise<{dispose():void;store?:ResourceStore}>{
 installPlayerTheme(root);root.parentElement?.querySelector(':scope > footer')?.remove();
 const globals=win as any;
 if(config.mode!=='standalone'&&(!globals.SillyTavern?.getContext||typeof (globals.TavernHelper??globals).getVariables!=='function'))throw Error('请从聊天中的书海入口打开。');
 // 0.40 正文模式：正文末尾的标签先显示三按钮面板；选“迷宫模式”才进入书间并自动继续。
 if(config.mode!=='standalone'){let portal:{dispose():void}|undefined;const panel=mountNarrativePanel(root,globals,()=>{void bootPortal(root,config,win,true).then(p=>{portal=p;});});if(panel)return {dispose(){panel.dispose();portal?.dispose();}};}
 return bootPortal(root,config,win,false);
}
async function bootPortal(root:HTMLElement,config:BootConfig,win:Window,autoResume:boolean,options:PersistentOptions={}){
 const base=new URL(config.base),store=await ResourceStore.open(win,base,config.manifest,config.fixedRelease),globals=win as any;
 const binding=(f1:string,f2:string)=>f1?`<span class="bs-option-art" aria-hidden="true"><img alt="" src="${f1}"><img alt="" src="${f2||f1}"></span>`:'<span class="bs-option-art" aria-hidden="true"></span>';
 root.innerHTML=`<section id="resource-setup" class="bs-portal bs-endpaper"><div class="bs-book"><span class="bs-ribbon-mark" aria-hidden="true"></span><div class="bs-spread">
 <div class="bs-page bs-page-l bs-pastedown">${hero('将零散的书页钉在一起，看上去乱七八糟的无限迷宫。<br>向你和命定之人开放的训练场','普罗泰利西翁',false,true).replace('</h1>','</h1><span class="bs-hero-rule" aria-hidden="true"></span><span class="bs-exlibris">Ex Libris · 夜梦的书间</span>')}</div>
 <div class="bs-page bs-page-r bs-flyleaf"><div class="bs-running"><span>夜梦的书间</span><button id="resource-options" class="bs-icon-button" title="资源管理" aria-label="资源管理">装订工具</button></div>
 <div class="bs-resource-card"><div class="bs-card-title"><h2>启程准备</h2><span id="resource-percent" class="bs-percent">0%</span></div>
 <div id="resource-signatures" class="bs-signatures" aria-hidden="true">${'<i></i>'.repeat(12)}</div><progress id="resource-progress" max="1" value="0" aria-label="下载进度"></progress>
 <div class="bs-download-info"><span id="resource-status" role="status">准备中</span><span id="resource-count"></span></div>
 <div class="bs-download-options"><button id="download-all" class="bs-option bs-primary">${binding(BINDING_ART.hardcover1,BINDING_ART.hardcover2)}<span><strong>完整下载</strong><small id="all-size"></small><em>精装：音乐与音效一并装订进来</em></span></button><button id="download-core" class="bs-option">${binding(BINDING_ART.paperback1,BINDING_ART.paperback2)}<span><strong>轻装启程</strong><small id="core-size"></small><em>平装：声音等用到时再取</em></span></button></div></div>
 <footer class="bs-footer"><span>Adirm007</span><a id="resource-credits" target="_blank" rel="noopener">制作名单</a></footer></div></div></div></section><section id="distribution-game" hidden></section>
 ${modalFrame('resource-menu','资源管理','<div class="bs-settings-row"><span id="storage-size">已下载</span><button id="resource-clear" class="bs-button">清理下载</button></div><p id="resource-menu-status" class="bs-player-status" role="status"></p>','colophon')}`;
 const el=(id:string)=>root.querySelector<HTMLElement>('#'+id)!,status=el('resource-status'),progress=el('resource-progress') as HTMLProgressElement,game=el('distribution-game');
 // Progress is drawn as twelve signatures being sewn onto the spine, one per twelfth of the bytes.
 const sew=(p:number)=>{root.querySelectorAll('#resource-signatures i').forEach((sig,i)=>sig.classList.toggle('is-sewn',p>=(i+1)/12-1e-9));};
 registerUiAssets({read:name=>store.read(name),base});
 (el('resource-credits') as HTMLAnchorElement).href=new URL('credits.html',base).href;
 const [all,core]=await Promise.all([store.status(),store.status(true)]),menu=bindModal(el('resource-menu'));
 el('all-size').textContent=mb(all.bytes);el('core-size').textContent=mb(core.bytes);el('resource-count').textContent=mb(all.cachedBytes)+' / '+mb(all.bytes);el('storage-size').textContent='已下载 '+mb(all.cachedBytes);
 el('resource-percent').textContent=Math.floor(all.cachedBytes/all.bytes*100)+'%';progress.value=all.cachedBytes/all.bytes;sew(progress.value);
 status.textContent=all.cachedFiles===all.files?'已准备好':'等待启程';
 Object.assign(win,{BookseaResources:{inspect:()=>store.inspect(),status:(coreOnly=false)=>store.status(coreOnly)},BookseaResourceMenu:menu});el('resource-options').onclick=menu.open;
 let busy=false,started=false,disposed=false,visible=true;let cleanup:()=>void=()=>{};
 let app:ReturnType<typeof mountHostGame>|undefined;
 async function launch(coreOnly:boolean){
  if(busy||started||disposed)return;busy=true;(el('download-all') as HTMLButtonElement).disabled=true;(el('download-core') as HTMLButtonElement).disabled=true;
  try{
   try{await win.navigator.storage?.persist?.();}catch{}
   await store.prefetch(coreOnly,p=>{progress.value=p.readyBytes/p.totalBytes;sew(progress.value);el('resource-percent').textContent=Math.floor(progress.value*100)+'%';status.textContent=p.completed===p.total?'正在展开书页':'正在下载';el('resource-count').textContent=mb(p.readyBytes)+' / '+mb(p.totalBytes);el('storage-size').textContent='已下载 '+mb(p.readyBytes);});
    if(disposed)return;
   try{win.localStorage.setItem('protelysion-resource-mode',coreOnly?'core':'all');}catch{}
   store.installFetch();globals.BOOKSEA_ASSET_BASE=base.href;
   if(config.mode==='standalone'){
    installPlayerTheme(game);game.classList.add('bs-playing');game.innerHTML='<div class="bs-portal"><section id="stage" class="bs-stage"><canvas id="canvas" width="1280" height="720" tabindex="0"></canvas></section></div>';
    // 0.44 敌役图鉴：试玩页存在这台设备（localStorage），立绘缩略图同样存在本机。
    const dex=createBestiary(localBestiaryPort(localStore(win)),{local:true}),dexArt=bestiaryArtCache(win),dexPanel=mountBestiaryPanel(win.document,dex,dexArt);
    const runtime=mountExpeditionRuntime({storageKey:'booksea-expedition-random-v2',uiRoot:el('stage'),onResources:menu.open,newGame:()=>startExpedition(playtestParty(),Date.now()>>>0),audio:{baseUrl:new URL('audio/',base).href,controlsRoot:el('stage')},bestiary:dex,onBestiary:id=>dexPanel.show(el('stage'),id),onArt:(id,url)=>dexArt.capture(id,url)},win);
    const closeDex=()=>{dexPanel.dispose();void dex.flush().finally(()=>dex.dispose());};
    cleanup=()=>{runtime.dispose();closeDex();};
    const Engine=await store.loadEngine(),engine=new Engine({executable:new URL('game',base).href,mainPack:new URL('game.pck',base).href,canvas:el('canvas'),canvasResizePolicy:0,focusCanvas:true});cleanup=()=>{runtime.dispose();engine.requestQuit();closeDex();};game.hidden=false;await engine.startGame();
   }else{app=mountHostGame(game,globals,{loadEngine:()=>store.loadEngine(),autoResume,onUserNarrative:options.onUserNarrative});cleanup=app.dispose;if(!visible)await app.setVisible(false);}
   el('resource-setup').hidden=true;game.hidden=false;root.classList.add('bs-playing');started=true;
  }catch(error){cleanup();game.replaceChildren();game.hidden=true;status.textContent=/空间|quota/i.test(String(error))?'空间不足，请清理后重试。':'下载暂时中断，点击重试。';}
  finally{busy=false;(el('download-all') as HTMLButtonElement).disabled=false;(el('download-core') as HTMLButtonElement).disabled=false;}
 }
 el('download-all').onclick=()=>void launch(false);el('download-core').onclick=()=>void launch(true);
 const clear=el('resource-clear') as HTMLButtonElement;let confirmUntil=0;
 clear.onclick=()=>{if(busy){el('resource-menu-status').textContent='请等这次下载完成。';return;}if(Date.now()>confirmUntil){confirmUntil=Date.now()+10000;clear.textContent='再次点击确认';el('resource-menu-status').textContent='不会删除你的旅程。';return;}confirmUntil=0;clear.disabled=true;void store.cacheStorage.delete(store.cacheName).then(()=>{clear.textContent='已清理';el('resource-menu-status').textContent='下次进入时重新下载。';el('storage-size').textContent='已清理下载';}).catch(()=>{clear.disabled=false;clear.textContent='清理下载';el('resource-menu-status').textContent='暂时未能清理，请再试一次。';});};
 let preferCore=false;try{preferCore=win.localStorage.getItem('protelysion-resource-mode')==='core';}catch{}
 if(all.cachedFiles===all.files)await launch(false);else if(preferCore&&core.cachedFiles===core.files)await launch(true);
 const dispose=()=>{if(disposed)return;disposed=true;cleanup();store.dispose();win.removeEventListener('pagehide',dispose);};
 win.addEventListener('pagehide',dispose,{once:true});
 return {dispose,store,async setVisible(value:boolean){visible=value;if(app)await app.setVisible(value);},async resume(){autoResume=true;if(app){await app.refresh();await app.resume();}}};
}
