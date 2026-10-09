import {createRosterReader,rosterHostFromGlobals} from './host/roster';
import {assetBase,createGodotLoader,type GodotEngine} from './host/godot-loader';
import {RosterBridge} from './presentation/roster-bridge';
import {mountSamePageBridge} from './presentation/same-page';
import type {RosterView} from './presentation/roster-contract';

export function mountHostViewer(root:HTMLElement,globals:any=globalThis,resourcePath='/booksea-godot-host/'){
  root.innerHTML=`<header><span>书海 · GODOT / 宿主接入</span><b>只读角色面板</b></header>
  <h1>从真实角色，进入书海。</h1><p>本页连接酒馆并启动 Godot。当前只验证角色展示，不进入战斗、不调用模型、不写入资源或奖励。</p>
  <div class="actions"><button id="read-host">读取 / 刷新角色</button><button id="show-godot" disabled>在 Godot 中查看所选角色</button></div>
  <p id="host-status" role="status" aria-live="polite">尚未读取。请先打开宿主聊天；可选择1–4人，主角可不参加。</p>
  <div id="host-roster"></div><p class="note">“来源匹配”只说明缓存来源未变化，不等于技能与规则已验收。此页面不会使用缓存直接开启游戏。</p>
  <section id="godot-stage" hidden><canvas id="host-canvas" width="960" height="540" tabindex="0"></canvas></section>`;
  const el=<T extends HTMLElement=HTMLElement>(id:string)=>root.querySelector<T>('#'+id)!;
  const status=(text:string)=>{el('host-status').textContent=text;};
  const canvas=el<HTMLCanvasElement>('host-canvas');
  const base=assetBase(resourcePath,document.baseURI),loadEngine=createGodotLoader(window,document,base);
  let reader:ReturnType<typeof createRosterReader>|undefined,view:RosterView|undefined;
  let bridge:RosterBridge|undefined,mounted:ReturnType<typeof mountSamePageBridge>|undefined,engine:GodotEngine|undefined;
  let busy=false,disposed=false,epoch=0;
  const selected=new Set<string>();
  const labels={missing:'未编译','source-matches':'来源匹配 · 入场未校验',stale:'战斗来源已变化',incompatible:'编译格式需更新',invalid:'缓存无效'};
  const stop=()=>{mounted?.dispose();mounted=undefined;bridge=undefined;engine?.requestQuit();engine=undefined;el('godot-stage').hidden=true;};
  const invalidated=()=>{epoch++;reader?.close();reader=undefined;view=undefined;selected.clear();el('host-roster').replaceChildren();stop();status('聊天已切换，旧角色展示已关闭；请重新读取。');buttons();};
  function buttons(){el<HTMLButtonElement>('read-host').disabled=busy||disposed;el<HTMLButtonElement>('show-godot').disabled=busy||disposed||selected.size<1||selected.size>4;}
  function draw(){
    el('host-roster').replaceChildren();
    for(const actor of view?.actors??[]){
      const row=document.createElement('label');row.className='actor';
      const box=document.createElement('input');box.type='checkbox';box.value=actor.id;box.disabled=actor.eligibility==='blocked';box.checked=selected.has(actor.id);
      box.onchange=()=>{if(box.checked)selected.add(actor.id);else selected.delete(actor.id);buttons();};
      const body=document.createElement('div'),name=document.createElement('strong'),detail=document.createElement('p');
      name.textContent=`${actor.name} · Lv${actor.level??'?'}`;
      detail.textContent=actor.current&&actor.max?`HP ${actor.current.hp}/${actor.max.hp} · MP ${actor.current.mp}/${actor.max.mp} · SP ${actor.current.sp}/${actor.max.sp}`:'资源数据不完整';
      const note=document.createElement('small');note.textContent=`${actor.reason} · ${labels[actor.cache]}`;
      body.append(name,detail,note);row.append(box,body);el('host-roster').append(row);
    }
    buttons();
  }
  async function task(fn:()=>Promise<void>){if(busy||disposed)return;busy=true;buttons();try{await fn();}catch(e){if(!disposed)status('未完成：'+(e as Error).message);}finally{busy=false;buttons();}}
  el('read-host').onclick=()=>void task(async()=>{
    status('正在读取最新消息MVU与聊天缓存……');
    reader??=createRosterReader(rosterHostFromGlobals(globals),invalidated);
    const next=await reader.read();if(disposed)return;
    view=next;selected.clear();draw();
    if(bridge)mounted?.publish(bridge.update({...next,actors:[],selectedIds:[]}));
    status(`已读取 ${next.actors.length} 名角色（第 ${next.messageId} 楼）。请选择1–4人；没有自动编译或宿主写回。`);
  });
  el('show-godot').onclick=()=>void task(async()=>{
    if(!reader)throw Error('请先读取角色');
    const token=epoch,next=await reader.select([...selected]);reader.assertCurrent();
    if(disposed||token!==epoch)return;
    view=next;selected.clear();next.selectedIds.forEach(id=>selected.add(id));draw();
    const projected={...next,actors:next.actors.filter(a=>selected.has(a.id))};
    if(bridge){mounted!.publish(bridge.update(projected));status('Godot角色快照已刷新；未进入游戏。');return;}
    status('正在加载Godot运行时与角色显示包，首次下载可能稍久……');
    const Engine=await loadEngine();reader.assertCurrent();if(disposed||token!==epoch)return;
    bridge=new RosterBridge(projected,crypto.randomUUID());mounted=mountSamePageBridge(window as any,bridge,(sequence,count)=>{canvas.dataset.godotSequence=String(sequence);canvas.dataset.godotActorCount=String(count);});
    el('godot-stage').hidden=false;
    engine=new Engine({executable:new URL('game',base).href,canvas,canvasResizePolicy:0,focusCanvas:false});
    try{await engine.startGame();reader?.assertCurrent();if(disposed||token!==epoch)return;status('Godot已启动，正在显示真实宿主只读快照；尚未进入游戏。');}
    catch(e){stop();throw e;}
  });
  const lost=(e:Event)=>{e.preventDefault();epoch++;stop();status('WebGL上下文丢失，请重新打开查看器。');};
  canvas.addEventListener('webglcontextlost',lost);
  const dispose=()=>{if(disposed)return;disposed=true;epoch++;reader?.close();stop();selected.clear();view=undefined;canvas.removeEventListener('webglcontextlost',lost);window.removeEventListener('pagehide',dispose);};
  window.addEventListener('pagehide',dispose,{once:true});
  return {dispose};
}
