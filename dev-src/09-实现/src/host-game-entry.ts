import {resumeHostExpedition} from './host/resume';
import {loadHostPortraits} from './host/avatars';
import {sessionPort,hostRoster,compileHostMember,enterHostExpedition,checkpointHost,redeemHostVoucher} from './host/game-session';
import {object,actorKey,type ActorRef} from './core/actors';
import {assetBase,createGodotLoader,type GodotEngine} from './host/godot-loader';
import {mountExpeditionRuntime} from './game/runtime';
import {assertCurrentExpedition,type State} from './game/expedition';
import {installPlayerTheme,shellHeader,hero,modalFrame,bindModal,icons,escapeHtml as esc} from './ui/theme';
import {characterData,executableCount,renderCharacterSheet} from './ui/character-sheet';
import {enterNarrativeMode,resumeFromNarrative} from './host/narrative-mode';
import {mountHostSupplierMemory} from './host/supplier-memory-host';
import {mountSupplierMemoryPanel} from './ui/supplier-memory-panel';

export function mountHostGame(root:HTMLElement,globals:any=globalThis,options:{loadEngine?:()=>Promise<import('./host/godot-loader').GodotConstructor>;autoResume?:boolean}={}){
 installPlayerTheme(root);
 root.innerHTML=`<div class="bs-portal">${shellHeader('启程之前',`<button id="read" class="bs-icon-button" title="刷新角色" aria-label="刷新角色">${icons.refresh}</button><button id="open-settings" class="bs-icon-button" title="设置" aria-label="设置">${icons.gear}</button>`)}
 <section id="setup">${hero('选择同行者','下一页 · 由你书写',true)}<div class="bs-lobby-body"><div class="bs-party-heading"><h2>同行名册</h2><span id="party-count" class="bs-party-count">0 / 4</span></div><div id="roster" class="bs-roster"></div>
 <div class="bs-bottom-bar"><div class="bs-anchor"><label for="anchor">启程之页</label><select id="anchor"><option value="1">第 1 层</option></select></div><div id="wallet" class="bs-wallet"></div><div class="bs-party-actions"><button id="compile" class="bs-button">${icons.spark}整备队伍</button><button id="enter" class="bs-button bs-primary">进入书海 ${icons.arrow}</button><button id="resume" class="bs-button bs-primary" hidden>继续旅程 ${icons.arrow}</button></div></div></div></section>
 <p id="status" class="bs-player-status" role="status" aria-live="polite"></p>
 <section id="stage" class="bs-stage" hidden><canvas id="host-play-canvas" width="1280" height="720" tabindex="0"></canvas></section>
 <footer class="bs-footer"><span>ADIRM007</span><a id="credits" target="_blank" rel="noopener">制作名单</a></footer>
 ${modalFrame('character-sheet','同行者档案','<div id="character-content"></div>')}
 ${modalFrame('player-settings','书间设置','<div class="bs-settings-row"><span>资源管理</span><button id="host-resource-open" class="bs-button">管理下载</button></div><div class="bs-settings-row"><span>补给员的记忆</span><button id="memory-open" class="bs-button">记忆与接口</button></div>')}
 </div>`;
 const el=(id:string)=>root.querySelector<HTMLElement>('#'+id)!,status=(s:string)=>{el('status').textContent=s;};
 const port=sessionPort(globals),contextId=port.id(),key='booksea-host-run:random-v2:'+contextId,selected=new Map<string,ActorRef>();
 // 0.42 补给员长期记忆：按聊天（存档）一份；大厅和游戏里共用同一个设置面板。
 const memory=mountHostSupplierMemory(globals,()=>port.chat()),memoryPanel=mountSupplierMemoryPanel(document,memory);
 const host=globals.parent??globals;host.BookseaActiveViews??={};const owners=host.BookseaActiveViews as Record<string,()=>Promise<void>>;
 const retireOther=async()=>{if(owners[key])await owners[key]!();};
 const base=assetBase(globals.BOOKSEA_ASSET_BASE??'/booksea-play/',document.baseURI,typeof globals.BOOKSEA_ASSET_BASE==='string'),load=options.loadEngine??createGodotLoader(window,document,base);
 (el('credits') as HTMLAnchorElement).href=new URL('credits.html',base).href;
 const sheet=bindModal(el('character-sheet')),settings=bindModal(el('player-settings'));let sheetRef:ActorRef|undefined;
 let engine:GodotEngine|undefined,runtime:ReturnType<typeof mountExpeditionRuntime>|undefined,busy=false,initialized=false,lastPaused=true;
 const selection=()=>[...selected.values()];
 const message=(error:unknown)=>{const s=String((error as Error)?.message??error);return /聊天.*切换|所属聊天|另一聊天/.test(s)?'聊天已切换，请重新打开书海。':/1–4|1—4|队伍|勾选成员/.test(s)?'先选择一至四位同行者。':/远征|已结束|已经结算/.test(s)?'还有一段未完的旅程，先继续它吧。':/未连接|生成|正文|模型/.test(s)?'故事暂时没能续上，稍后再试。':/读取|MVU|stat_data|主角|生命值|字段|对象/.test(s)?'还没有读到完整角色资料，请回到聊天后刷新。':'这次没能完成，请再试一次。';};
 function updateSelection(){
  el('party-count').textContent=selected.size+' / 4';
  for(const label of Array.from(el('roster').querySelectorAll<HTMLElement>('[data-actor-key]'))){const checked=selected.has(label.dataset.actorKey!);label.classList.toggle('is-selected',checked);const input=label.querySelector<HTMLInputElement>('input');if(input)input.checked=checked;}
  const ready=selection().every(ref=>{try{return characterData(port,ref).ready;}catch{return false;}}),active=object(port.chat().booksea??{}).activeExpedition;
  (el('compile') as HTMLButtonElement).disabled=busy||!selected.size;el('compile').innerHTML=icons.spark+(ready&&selected.size?'重新整备':'整备队伍');
  (el('enter') as HTMLButtonElement).disabled=busy||!selected.size;el('enter').hidden=!!active;el('resume').hidden=!active;(el('resume') as HTMLButtonElement).disabled=busy;
 }
 function showSheet(ref:ActorRef){sheetRef=ref;renderCharacterSheet(el('character-content'),port,ref,()=>void task(async()=>{await prepare([ref]);await draw();showSheet(ref);}));(el('character-sheet').querySelector('.bs-modal-body') as HTMLElement).scrollTop=0;sheet.open();}
 async function draw(){
  await port.prepare?.();
  const roster=hostRoster(port).filter(a=>a.ref.kind==='player'||a.allowed),allowed=new Set(roster.filter(a=>a.allowed).map(a=>actorKey(a.ref)));
  for(const k of selected.keys())if(!allowed.has(k))selected.delete(k);
  if(!initialized){const first=roster.find(a=>a.allowed);if(first)selected.set(actorKey(first.ref),first.ref);initialized=true;}
  const b=object(port.chat().booksea??{}),anchors=[...new Set(['depth-1',...(b.unlockedIds as string[]??[])])].filter(id=>id==='depth-1'||/^anchor-\d+$/.test(id));
  const priorAnchor=(el('anchor') as HTMLSelectElement).value;el('anchor').replaceChildren();for(const id of anchors){const option=document.createElement('option');option.value=id.split('-')[1]!;option.textContent='第 '+option.value+' 层';el('anchor').append(option);}if(anchors.some(a=>a.split('-')[1]===priorAnchor))(el('anchor') as HTMLSelectElement).value=priorAnchor;
  const rosterPortraits=await loadHostPortraits(globals,roster.map(a=>({id:actorKey(a.ref),ref:a.ref})));port.id();
  el('roster').replaceChildren();
  if(!roster.length)el('roster').innerHTML='<div class="bs-empty">'+icons.book+'<p>还没有找到同行者</p></div>';
  for(const a of roster){
   const id=actorKey(a.ref),card=document.createElement('article');card.className='actor bs-actor'+(!a.allowed?' is-disabled':'');card.dataset.actorKey=id;
   let ready=false,count=a.skills.length;try{const info=characterData(port,a.ref);ready=info.ready;if(info.card)count=executableCount(info.card);}catch{}
   const hp=Number(a.hp)||0,max=Math.max(1,Number(a.maxHp)||1),availability=!a.allowed?'暂不可出战':ready?'已就绪 · '+count+'项能力':'待整备';
   card.innerHTML=`<label class="bs-actor-label"><input type="checkbox" aria-label="选择${esc(a.name)}" ${a.allowed?'':'disabled'}><span class="bs-actor-seal">${esc([...a.name][0]??'旅')}</span><span class="bs-actor-info"><strong class="bs-actor-name">${esc(a.name)}</strong><span class="bs-actor-level">Lv.${Number(a.level)||'—'} · ${a.ref.kind==='player'?'故事的主人':'命定同伴'}</span><span class="bs-hp"><span class="bs-hp-track"><i style="width:${Math.max(0,Math.min(100,hp/max*100))}%"></i></span>${Math.round(hp).toLocaleString()} / ${Math.round(max).toLocaleString()}</span></span></label><div class="bs-actor-bottom"><span class="bs-actor-state ${ready?'ready':''}">${availability}</span><button class="bs-detail-button" ${a.allowed?'':'disabled'}>角色详情 <span>↗</span></button></div>`;
   if(rosterPortraits[id]){const img=document.createElement('img');img.src=rosterPortraits[id]!;img.alt=a.name;img.referrerPolicy='no-referrer';img.style.cssText='width:100%;height:100%;object-fit:cover;border-radius:inherit';const seal=card.querySelector<HTMLElement>('.bs-actor-seal')!,letter=seal.textContent??'';img.onerror=()=>{seal.classList.remove('has-portrait');seal.textContent=letter;};seal.classList.add('has-portrait');seal.replaceChildren(img);}
   const input=card.querySelector<HTMLInputElement>('input')!;input.onchange=()=>{if(input.checked){if(selected.size>=4){input.checked=false;status('最多四位同行者。');return;}selected.set(id,a.ref);}else selected.delete(id);status('');updateSelection();};
   card.querySelector<HTMLButtonElement>('button')!.onclick=()=>{try{showSheet(a.ref);}catch(error){status(message(error));}};el('roster').append(card);
  }
  const m=port.read(),stat=object(m.stat_data),bag=object(object(stat.主角).背包);el('wallet').innerHTML=icons.spark+'<span>命运点</span><b>'+esc(Number(stat.命运点数??0).toLocaleString('zh-CN'))+'</b>';
  updateSelection();
 }
 async function redeemem(name:string){await redeemHostVoucher(port,name,1);await draw();status('兑换完成。');}
 async function task(fn:()=>Promise<void>){if(busy)return;busy=true;updateSelection();(el('read') as HTMLButtonElement).disabled=true;try{await fn();}catch(error){console.warn('[Protelysion]',error);status(message(error));}finally{busy=false;(el('read') as HTMLButtonElement).disabled=false;updateSelection();}}
 async function prepare(refs:ActorRef[]){
  if(!refs.length)throw Error('请先勾选成员');
  for(const [index,ref]of refs.entries()){status('正在整备 '+(ref.kind==='player'?'主角':ref.name)+' · '+(index+1)+' / '+refs.length);await compileHostMember(port,ref);await draw();}
  status('准备好了。下一页，出发。');
 }
 el('read').onclick=()=>void task(async()=>{await draw();status('');});
 el('compile').onclick=()=>void task(async()=>{await prepare(selection());await draw();if(sheetRef&&!el('character-sheet').hidden)showSheet(sheetRef);});
 el('open-settings').onclick=settings.open;
 el('memory-open').onclick=()=>{settings.close();memoryPanel.show(root);};
 el('host-resource-open').onclick=()=>{settings.close();const opener=(window as any).BookseaResourceMenu?.open;if(opener)opener();else status('下载已经准备好。');};
 const stop=()=>{if(owners[key]===retire)delete owners[key];runtime?.dispose();engine?.requestQuit();runtime=undefined;engine=undefined;el('stage').hidden=true;el('setup').hidden=false;root.classList.remove('bs-playing');};
 const retire=async()=>{const prior=runtime;prior?.input({type:'handoff'});stop();await prior?.flush();};
 async function launch(s:State){
  assertCurrentExpedition(s);await retireOther();await port.prepare?.();port.bind?.(s);owners[key]=retire;sheet.close();settings.close();
  const playAfterLoad=s.mode!=='ended'&&!s.paused;s.paused=true;lastPaused=true;el('setup').hidden=true;el('stage').hidden=false;root.classList.add('bs-playing');status('书页正在展开……');
  const portraits=await loadHostPortraits(globals,s.party);port.id();
  runtime=mountExpeditionRuntime({storageKey:key,uiRoot:el('stage'),portraits,onResources:()=>{(window as any).BookseaResourceMenu?.open();},audio:{baseUrl:new URL('audio/',base).href,controlsRoot:el('stage')},initial:s,isCurrent:copy=>(copy.mode==='ended'&&copy.writeback==='pending')||port.saveCurrent?.(copy)!==false,onInvalidated:()=>{stop();void task(async()=>{await draw();status('聊天楼层已变化，已恢复当前楼层的旅程记录。');});},onView:v=>{if('settings'in v)lastPaused=v.paused;},onLeave:()=>{void task(async()=>{await runtime?.flush();stop();await draw();status('');});},checkpoint:async copy=>{await checkpointHost(port,copy);if(copy.mode==='ended')status('这一页，已经珍藏。');},supplierChat:port.supplierChat?prompt=>port.supplierChat!(prompt):undefined,supplierMemory:memory,onMemorySettings:()=>memoryPanel.show(el('stage')),onNarrative:port.postNarrative?copy=>{void task(async()=>{await runtime?.flush();stop();await draw();status('正在切换到正文模式……');await enterNarrativeMode(port,copy);await draw();status('已切换到正文模式：聊天里会接着往下写；正文末尾的面板可以随时切回迷宫。');});}:undefined});
  try{const Engine=await load();engine=new Engine({executable:new URL('game',base).href,mainPack:new URL('game.pck',base).href,canvas:root.querySelector('canvas'),canvasResizePolicy:0,focusCanvas:true});await engine.startGame();if(playAfterLoad)runtime.input({type:'pause'});status('');}catch(error){stop();throw error;}
 }
 el('enter').onclick=()=>void task(async()=>{const refs=selection();if(!refs.length)throw Error('请先勾选成员');const unready=refs.filter(ref=>!characterData(port,ref).ready);if(unready.length){await prepare(unready);await draw();}const s=await enterHostExpedition(port,refs,Number((el('anchor') as HTMLSelectElement).value),{narrateEntry:false});await launch(s);});
 el('resume').onclick=()=>void task(async()=>{await retireOther();await port.prepare?.();const restored=resumeHostExpedition(object(port.chat().booksea??{}).activeExpedition,()=>localStorage.getItem(key),contextId,port.authorizedFrames?.());port.bind?.(restored);await resumeFromNarrative(port,restored);restored.paused=false;await checkpointHost(port,restored);if(restored.writeback==='done'&&restored.mode!=='ended')throw Error('这趟旅程已经结束');await launch(restored);});
 const dispose=()=>{stop();memory.dispose();memoryPanel.dispose();};window.addEventListener('pagehide',dispose,{once:true});
 Object.assign(window,{BookseaHostGame:{read:draw,contextId:port.id,selection,memory}});
 void task(async()=>{await draw();status('');}).then(()=>{if(options.autoResume&&!el('resume').hidden&&!(el('resume') as HTMLButtonElement).disabled)el('resume').click();});
 return {dispose};
}
