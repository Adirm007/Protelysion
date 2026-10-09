import {mountGameAudio, type GameAudioOptions} from '../audio/mount';
import type {UIAudioFeedback} from '../audio/types';
import {BATTLE_PRESENTATION_MS} from '../audio/battle-feedback';
import {mountExpeditionUI} from '../ui/expedition-ui';
import {resolvedBattleCue,type GameView} from '../presentation/battle-cues';
import {FOES,THEMES} from './content';
import {mountLoadingVeil,veilVariantForTheme} from '../ui/loading-veil';
import {createFloorPackCache} from './floor-pack';
import {RendererFrameCodec} from './renderer-frame';
import {transferRelic,ringBell,dismissWarning,answerExit,craftSilverCross,toggleCrossWard} from './expedition';
import {registerSupplierContent,supplierTalkSend,supplierTalkReply,supplierTalkFailed,supplierTalkBack,startNarrative} from './expedition';
import type {SupplierPrompt} from './supplier-agent';
import {drainSupplierLedger,type SupplierLedgerEntry} from './supplier-ledger';
import type {SupplierTalkRequest} from './expedition';
import {assertCurrentExpedition,restoreExpedition,view,move,interact,withdraw,eventChoice,supplierChoice,closeSupplier,chooseSkill,chooseTarget,flee,tick,tickExploration,useOutsideBattle,removeRelic,type State} from './expedition';

/** 0.42 宿主的补给员长期记忆（试玩页没有）：取走事件、在每句对话前补上记忆、清空后换一任补给员。 */
export type RuntimeSupplierMemory={epoch():number;greeting():string|undefined;observe(s:State,entries:SupplierLedgerEntry[]):void;augment(req:SupplierTalkRequest):Promise<SupplierPrompt>;flush(s?:State):Promise<void>};
type GraphicsQuality='desktop'|'mobile';
type GraphicsQualityInput=GraphicsQuality|'auto';
const GRAPHICS_KEY='booksea-graphics-quality';
const isQuality=(value:unknown):value is GraphicsQualityInput=>['auto','desktop','mobile'].includes(String(value));
// Device class never lowers fidelity. The legacy auto preference now means standard.
const normalizeQuality=(value:unknown):GraphicsQuality=>value==='mobile'?'mobile':'desktop';

export function mountExpeditionRuntime(options:{storageKey:string;uiRoot?:HTMLElement;portraits?:Record<string,string>;onResources?:()=>void;audio?:GameAudioOptions|false;initial?:State;newGame?:()=>State;onLeave?:()=>void;onView?:(s:ReturnType<typeof view>|{mode:string;canContinue:boolean})=>void;checkpoint?:(s:State)=>Promise<void>;isCurrent?:(s:State)=>boolean;onInvalidated?:()=>void;supplierChat?:(prompt:SupplierPrompt)=>Promise<string>;onNarrative?:(s:State)=>void;supplierMemory?:RuntimeSupplierMemory;onMemorySettings?:()=>void},win:Window=window){
 let stale=false;
 const memory=options.supplierMemory;
 /** 把这一步里发生的补给员事件交给长期记忆，并同步“第几任”与开场白（杀害会在这里换一任）。 */
 function memorySync(){if(!memory||!state)return;try{memory.observe(state,drainSupplierLedger(state));state.supplierMemoryEpoch=memory.epoch();state.supplierGreeting=memory.greeting();}catch(e){console.warn('Booksea supplier memory skipped',e);}}
 let state=options.initial??null,renderer:((s:string)=>void)|null=null,receipt=0,lastMode='title',writes=Promise.resolve(),disposed=false;
 let rendererMetrics:Record<string,unknown>={};
 const frames=new RendererFrameCodec();
 const getStored=(key:string)=>{try{return win.localStorage.getItem(key);}catch{return null;}};
 const setStored=(key:string,value:string)=>{try{win.localStorage.setItem(key,value);}catch{/* Host message saves remain authoritative even when local storage is blocked. */}};
 const preference=getStored(GRAPHICS_KEY);
 let graphicsQuality:GraphicsQuality=normalizeQuality(preference);
 if(state){assertCurrentExpedition(state);state.settings!.graphicsQuality=graphicsQuality;registerSupplierContent(state);state.supplierTalkReady=!!options.supplierChat;state.narrativeReady=!!options.onNarrative;memorySync();}
 let audioFeedback: UIAudioFeedback | undefined;
 const ui=options.uiRoot?mountExpeditionUI(options.uiRoot,(type,payload)=>input({type,payload}),{portraits:options.portraits,onResources:options.onResources,...(options.onMemorySettings?{onMemory:options.onMemorySettings}:{}),feedback:{cue:name=>audioFeedback?.cue(name),writing:active=>audioFeedback?.writing(active)}}):undefined;
 // Map-load veil (first descent, floor transitions, renderer reattach). Presentation only, never game state.
 const veil=options.uiRoot?mountLoadingVeil(options.uiRoot,win):undefined;
 const floorPacks=createFloorPackCache();
 const now=()=>win.performance?.now?.()??Date.now();
 let heldFrame:GameView|undefined,holdUntil=0;
 const sound=mountGameAudio(win,options.audio===false?false:{...options.audio,controlsRoot:ui?.audioRoot??(options.audio||{}).controlsRoot,onLevels:levels=>input({type:'settings',payload:levels}),structuredBattle:!!ui});
 audioFeedback={cue:name=>sound.ui(name),writing:active=>sound.writing(active)};
 const saved=()=>getStored(options.storageKey);
 function snapshot(){
  if(!state)return {mode:'title',canContinue:!!saved()};
  const v=view(state);
  return {...v,region:{...v.region,things:v.region.things.map(t=>({...t,...(t.kind==='enemy'?{shape:FOES[t.foes[0]!]!.shape,tint:FOES[t.foes[0]!]!.tint}:{})}))}};
 }
 function publish(){
  if(disposed)return;
  const current=snapshot();
  // Keep the battle score/outcome until the visible last hit completes. Pause/hidden still cancels immediately.
  try{if(!heldFrame||state?.paused||win.document.hidden)sound.observe(state);}catch(e){console.warn('Booksea audio update skipped',e);}
  if(renderer)renderer(frames.encode(current));
  const presented=heldFrame?{...heldFrame,paused:state?.paused??false,settings:state?.settings}:current;
  ui?.render(presented,!!heldFrame);
  options.onView?.(current);
  updateVeil();
 }
 /** The veil covers the stage from the moment a floor is sent until the renderer acknowledges that floor. */
 function updateVeil(){
  if(!veil||disposed)return;
  const region=state?.region;
  if(!region||renderer&&frames.readyFor(region.id)){veil.update(null);return;}
  veil.update({key:region.id,variant:veilVariantForTheme(region.theme,region.id),boot:!renderer,subtitle:`第 ${region.depth} 层 · ${THEMES[region.theme]?.name??region.theme} · ${region.name}`});
 }
 function save(){if(state)setStored(options.storageKey,JSON.stringify(state));}
 function validSession(){if(stale||disposed)return false;if(state&&options.isCurrent&&!options.isCurrent(state)){stale=true;state.paused=true;save();options.onInvalidated?.();return false;}return true;}
 function checkpoint(){
  save();if(!state||!options.checkpoint)return;
  const copy=structuredClone(state);state.writeback='pending';
  writes=writes.then(async()=>{
   if(stale||options.isCurrent&&!options.isCurrent(copy))throw Error('聊天楼层已回退，旧旅程写入已取消');
   await options.checkpoint!(copy);
   if(disposed||stale)return;
   if(state?.run.id===copy.run.id){state.writeback=copy.writeback;state.hostSave=copy.hostSave;if(state.mode==='ended')state.party=copy.party;save();publish();}
  }).catch(e=>{
   if(disposed||stale)return;
   if(state){state.hostSave=copy.hostSave;state.writeback=copy.writeback==='done'?'done':'error';state.paused=state.mode!=='ended';state.notice=(copy.writeback==='done'?'宿主结算已完成，正文交接未完成：':'宿主同步未完成：')+(e as Error).message;save();publish();}
  });
 }
 function input(raw:string|{type:string;payload?:Record<string,unknown>}){
  if(!validSession())return;
  const {type,payload:p={}}=typeof raw==='string'?JSON.parse(raw):raw;
  if ((type==='target'||type==='confirmTargets') && !state?.selected) return;
  if(heldFrame&&!['pause','settings','handoff'].includes(type))return;
  if(type==='settings'&&isQuality(p.graphicsQuality)){
   graphicsQuality=normalizeQuality(p.graphicsQuality);setStored(GRAPHICS_KEY,graphicsQuality);
  }
  // Loading/failed presentation cannot advance encounters behind a frozen screen.
  if(state&&!frames.readyFor(state.region.id)&&!['new','continue','settings','pause','handoff'].includes(type))return;
  if(type==='new'){
   if(options.newGame){state=options.newGame();assertCurrentExpedition(state);state.settings!.graphicsQuality=graphicsQuality;state.supplierTalkReady=!!options.supplierChat;state.narrativeReady=!!options.onNarrative;memorySync();}
   else{options.onLeave?.();return;}
  }else if(type==='continue'){
   state=restoreExpedition(JSON.parse(saved()!));state.settings!.graphicsQuality=graphicsQuality;state.paused=false;state.supplierTalkReady=!!options.supplierChat;state.narrativeReady=!!options.onNarrative;memorySync();
  }else if(state){
   const fromMenu=state.paused&&state.mode==='explore'&&['outsideSkill','removeRelic','transferRelic','ringBell','craftCross','crossWard','withdraw'].includes(type);
   if(fromMenu)state.paused=false;
   if(type==='pause')state.paused=!state.paused;
   else if(type==='move')move(state,Number(p.dx),Number(p.dz));
   else if(type==='interact')interact(state);
   else if(type==='withdraw')withdraw(state,p.ids as string[]|undefined);
   else if(type==='event')eventChoice(state,Number(p.choice));
   else if(type==='supplierChoice')supplierChoice(state,String(p.choice));
   else if(type==='supplierClose')closeSupplier(state);
   else if(type==='supplierTalk'){const req=supplierTalkSend(state,String(p.text??''));if(req)askSupplier(req);}
   else if(type==='supplierTalkBack')supplierTalkBack(state);
   else if(type==='narrative'){if(options.onNarrative&&startNarrative(state)){checkpoint();publish();void writes.then(()=>{if(disposed||stale||!state)return;if(state.writeback==='error'||!state.narrative?.active){delete state.narrative;save();publish();return;}options.onNarrative!(structuredClone(state));});return;}}
   else if(type==='skill')chooseSkill(state,String(p.id));
   else if(type==='target')chooseTarget(state,String(p.id));
   else if(type==='confirmTargets')chooseTarget(state,state.selectedTargets?.[0]??'',true);
   else if(type==='outsideSkill')useOutsideBattle(state,String(p.actor),String(p.id),p.targets as string[]);
   else if(type==='removeRelic')removeRelic(state,String(p.id),String(p.owner));
   else if(type==='transferRelic')transferRelic(state,String(p.id),String(p.owner),String(p.to));
   else if(type==='ringBell')ringBell(state);
   else if(type==='craftCross')craftSilverCross(state);
   else if(type==='crossWard')toggleCrossWard(state);
   else if(type==='dismissWarning')dismissWarning(state);
   else if(type==='exitAnswer')answerExit(state,p.yes===true);
   else if(type==='eventOwner'&&state.eventState)state.eventState.owner=String(p.id);
   else if(type==='category'){state.actionCategory=String(p.id);state.actionPage=0;}
   else if(type==='page')state.actionPage=Math.max(0,Number(p.value));
   else if(type==='favorite'){state.favorites??=[];const id=String(p.id);state.favorites=state.favorites.includes(id)?state.favorites.filter(x=>x!==id):[...state.favorites,id];}
   else if(type==='settings')state.settings={...state.settings!,...p,graphicsQuality};
   else if(type==='cancel')state.selected=null;
   else if(type==='flee')flee(state);
   if(fromMenu&&state.mode==='explore')state.paused=true;
  }
  memorySync();
  if(['handoff','pause','interact','event','supplierChoice','supplierClose','supplierTalk','supplierTalkBack','outsideSkill','removeRelic','transferRelic','ringBell','craftCross','crossWard','dismissWarning','exitAnswer','flee','withdraw','continue'].includes(type)||(type==='target'||type==='confirmTargets')&&!state?.selected)checkpoint();else save();
  publish();sound.intent(type);
 }
 /** 0.40 补给员对话：异步等 LLM；回到同一趟、同一位补给员、同一句的序号才写回（否则丢弃）。 */
 function askSupplier(req:SupplierTalkRequest){
  const chat=options.supplierChat,runId=state?.run.id;
  const current=()=>!disposed&&!stale&&!!state&&state.run.id===runId;
  if(!chat){if(state)supplierTalkFailed(state,req.thingId,req.serial,'这里联系不上她');return;}
  // 记忆检索有自己的时限与兜底；任何失败都退回不带记忆的原提示词，对话照常进行。
  const prompt=memory?memory.augment(req).catch(()=>req.prompt):Promise.resolve(req.prompt);
  void prompt.then(p=>chat(p)).then(raw=>{if(!current())return;supplierTalkReply(state!,req.thingId,req.serial,raw);memorySync();checkpoint();publish();},error=>{if(!current())return;supplierTalkFailed(state!,req.thingId,req.serial,String((error as Error)?.message??error));save();publish();});
 }
 const api={
  attach(callback:(s:string)=>void){renderer=callback;frames.reset();publish();},
  input,inspect:()=>snapshot(),graphicsQuality:()=>graphicsQuality,
  art(id:string,png:string){if(!ui||!/^[A-Za-z0-9_:-]{1,100}$/.test(id)||typeof png!=='string'||!png.startsWith('iVBORw0KGgo')||png.length>16_000_000)return false;ui.setArt(id,'data:image/png;base64,'+png);return true;},
  presentation:()=>({holding:!!heldFrame}),
  rendered(mode:string,regionId?:string,metrics?:string){
   receipt++;lastMode=mode;
   if(regionId){frames.acknowledge(regionId);if(metrics){try{rendererMetrics=JSON.parse(metrics);}catch{/* Diagnostics are not game state. */}}}
   updateVeil();
  },
  /** P5 presentation pack for the current floor only (GLB + texture layers + meta), derived from the saved layout. */
  floorPack(id:string,quality?:string){
   const layout=state?.region.layout;
   if(disposed||!layout||layout.id!==String(id))return null;
   return floorPacks(layout,quality==='mobile'?'mobile':'desktop');
  },
  loading:()=>({visible:!!veil?.visible,variant:veil?.variant??null}),
  receipt:()=>({receipt,lastMode,ready:state?frames.readyFor(state.region.id):true,renderer:rendererMetrics}),flush:()=>writes,
 };
 Object.assign(win,{BookseaPlay:api});save();updateVeil();
 const clock=win.setInterval(()=>{
  if(!validSession())return;
  if(heldFrame&&!state?.paused&&!win.document.hidden){if(now()<holdUntil)return;heldFrame=undefined;publish();}
  if(state&&frames.readyFor(state.region.id)&&!state.paused&&!win.document.hidden&&(state.mode==='battle'||state.mode==='explore')){
   const mode=state.mode,participants=state.run.participants.map(p=>p.status).join(',');
   if(mode==='battle')tick(state,50,ui?(before,after)=>{
    const resolved=view(state!);heldFrame=resolved;holdUntil=now()+BATTLE_PRESENTATION_MS/Math.max(1,state?.settings?.animationSpeed??1);
    sound.resolved(before,after,state?.settings?.animationSpeed??1);
    ui.playCue(resolvedBattleCue(before,after,resolved),resolved);
   }:undefined);else tickExploration(state,50);
   if(state.mode!==mode||participants!==state.run.participants.map(p=>p.status).join(','))checkpoint();publish();
  }
 },50);
 const saver=win.setInterval(save,1500),hide=()=>{if(win.document.hidden&&state&&state.mode!=='ended'){state.paused=true;checkpoint();publish();}},leave=()=>{save();void memory?.flush(state??undefined);};
 win.document.addEventListener('visibilitychange',hide);win.addEventListener('pagehide',leave);
 return {...api,dispose(){save();void memory?.flush(state??undefined);disposed=true;veil?.dispose();ui?.dispose();sound.dispose();audioFeedback=undefined;win.clearInterval(clock);win.clearInterval(saver);win.document.removeEventListener('visibilitychange',hide);win.removeEventListener('pagehide',leave);renderer=null;frames.reset();}};
}
