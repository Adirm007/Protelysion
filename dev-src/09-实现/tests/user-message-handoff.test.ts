import test from 'node:test';
import assert from 'node:assert/strict';
import _ from 'lodash';
import {mountUserMessageHandoff} from '../src/host/user-message-handoff';
import {sessionPort,checkpointHost} from '../src/host/game-session';
import {userNarrativeBreakpoint,resumeFromNarrative,descendNarrativeMode} from '../src/host/narrative-mode';
import {mountExpeditionRuntime} from '../src/game/runtime';
import {playtestParty,strike} from '../src/game/content';
import {startExpedition,move,interact,view,leaveFromNarrative,type State} from '../src/game/expedition';
import {walkable} from '../src/game/region';
import {supplierSpawns} from '../src/game/supplier';
import {chooseAction} from '../src/battle/executor';
import {addReward} from '../src/core/run';
import {object,actorAt,type Obj} from '../src/core/actors';
import {fixture,partner} from './fixtures';

class Events {
 listeners=new Map<string,((...args:any[])=>unknown)[]>();
 makeFirst(name:string,fn:(...args:any[])=>unknown){this.listeners.set(name,[fn,...this.listeners.get(name)??[]]);}
 on(name:string,fn:(...args:any[])=>unknown){this.listeners.set(name,[...this.listeners.get(name)??[],fn]);}
 removeListener(name:string,fn:(...args:any[])=>unknown){this.listeners.set(name,(this.listeners.get(name)??[]).filter(f=>f!==fn));}
 async emit(name:string,...args:any[]){for(const fn of [...this.listeners.get(name)??[]])await fn(...args);}
}
async function harness(mode:State['mode']='explore'){
 let vars:Obj={},chatId='chat',text='我先举起手，向她说明眼前的情况。',invalidated=0,handed=0,stopped=0;
 const messages:any[]=[{is_user:false,role:'assistant',mes:'原场景',message:'原场景',data:fixture(),extra:{other:'kept'}}];
 const source=new Events(),events={GENERATION_AFTER_COMMANDS:'before',MESSAGE_SENT:'sent',CHAT_CHANGED:'chat',GENERATION_ENDED:'ended',GENERATION_STOPPED:'stopped'};
 const context={characterId:'card',getCurrentChatId:()=>chatId,chat:messages,eventSource:source,eventTypes:events,saveChat:async()=>{},stopGeneration:()=>{stopped++;return true;}};
 const h={getLastMessageId:()=>messages.length-1,getChatMessages:(id:string|number)=>typeof id==='number'?(messages[id===-1?messages.length-1:id]?[{...structuredClone(messages[id===-1?messages.length-1:id]),message_id:id===-1?messages.length-1:id}]:[]):messages.map((m,i)=>({...structuredClone(m),message_id:i})),
  getVariables:(o:Obj)=>structuredClone(o.type==='chat'?vars:messages[Number(o.message_id??messages.length-1)]?.data??{}),
  updateVariablesWith:async(fn:(v:Obj)=>Obj,o:Obj)=>{if(o.type==='chat')vars=fn(structuredClone(vars));else{const m=messages[Number(o.message_id??messages.length-1)];m.data=fn(structuredClone(m.data));}},
  createChatMessages:async()=>{throw Error('Automatic prose must retain the original message');},triggerSlash:async()=>{throw Error('Automatic prose must not trigger another generation');}};
 const globals={TavernHelper:h,SillyTavern:{getContext:()=>context},_:_,navigator:{locks:{request:async(_name:string,fn:()=>Promise<unknown>)=>fn()}}};
 const port=sessionPort(globals);await port.prepare!();
 const party=playtestParty().slice(0,1);party[0]!.ref=partner();let seed=91;if(mode==='supplier')for(seed=1;seed<10000&&!supplierSpawns(1,0,seed);seed++);const state=startExpedition(party,seed);state.source='host';state.hostContext='card:chat';port.bind!(state);
 if(mode==='battle'){const enemy=state.region.things.find(t=>t.kind==='enemy')!;for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]] as const)if(walkable(state.region,enemy.x-dx,enemy.z-dz)){state.x=enemy.x-dx;state.z=enemy.z-dz;move(state,dx,dz);break;}assert.equal(state.mode,'battle');state.battle!.units.find(u=>u.side==='enemy')!.current.hp=37;}
 else if(mode==='event'||mode==='supplier'){
  if(mode==='event'&&!state.region.things.some(t=>t.kind==='event'))state.region.things.push({id:'test-event',kind:'event',x:state.x+3,z:state.z,name:'测试事件',used:false,foes:[]});
  const thing=state.region.things.find(t=>t.kind===mode)!;assert.ok(thing);state.x=thing.x;state.z=thing.z;interact(state);assert.equal(state.mode,mode);
 }
 state.run=addReward(state.run,{kind:'fp',amount:77,count:1,source:'测试现场'});await checkpointHost(port,state);
 const timers:(()=>void)[]=[],stored=new Map<string,string>();
 const win={localStorage:{getItem:(key:string)=>stored.get(key)??null,setItem:(key:string,value:string)=>stored.set(key,value)},setInterval:(fn:()=>void)=>{timers.push(fn);return timers.length;},clearInterval(){},document:{hidden:false,addEventListener(){},removeEventListener(){}},addEventListener(){},removeEventListener(){}} as unknown as Window;
 const runtime=mountExpeditionRuntime({storageKey:'run',initial:state,audio:false,isCurrent:s=>port.saveCurrent!(s),checkpoint:s=>checkpointHost(port,s),onInvalidated:()=>{invalidated++;}},win);
 runtime.attach(raw=>{const f=JSON.parse(raw);runtime.rendered(f.mode,f.region?.id);});
 const controller=mountUserMessageHandoff(globals,port,{runtime:()=>runtime,readDraft:()=>text,onHandoff:()=>{handed++;}});
 async function append(role='user',extra:Obj={}){const row={is_user:role==='user',role,mes:text,message:text,data:h.getVariables({type:'message',message_id:messages.length-1}),extra};messages.push(row);for(const tick of timers)tick();await source.emit('sent',messages.length-1);return row;}
 return {port,runtime,state,messages,source,controller,stored,timers,append,get vars(){return vars;},get invalidated(){return invalidated;},get handed(){return handed;},get stopped(){return stopped;},setText(value:string){text=value;},setProcessor(value:unknown){(context as any).streamingProcessor=value;},switchChat(value='other'){chatId=value;}};
}

for(const mode of ['explore','battle','event','supplier'] as const)test('原用户发言在'+mode+'现场切正文，发送与EJS均等待完整提交',async()=>{
 const f=await harness(mode),beforeText='这条原消息不包含专用触发词。';f.setText(beforeText);
 let early='',after='';f.source.on('before',()=>{early=String(object(object(f.vars.booksea).narrativeMode).breakpoint);});
 f.source.on('sent',()=>{after=String(object(f.messages.at(-1).data.bookseaPromptHandoff).summary);});
 await f.source.emit('before','normal',{},false);
 assert.match(JSON.parse(early).journey,/当前位置：第 1 层/);assert.equal(JSON.parse(early).phase,mode);assert.equal(f.runtime.isPlaying(),false);
 assert.equal((f.messages[0].extra.bookseaCheckpointV1.progress.activeExpedition as State).narrative,undefined,'旧楼层保留发言前的游戏模式');
 const sent=await f.append();assert.equal(sent.mes,beforeText);assert.equal(sent.message,beforeText);assert.equal(f.messages.length,2);assert.equal(f.invalidated,0);
 assert.deepEqual(JSON.parse(after).position,JSON.parse(early).position);assert.equal(f.handed,1);assert.equal(object(sent.extra.bookseaHandoff).kind,'narrative');assert.equal(object(sent.extra.bookseaHandoff).summary,after);
 assert.equal(object(sent.extra.bookseaHandoff).messageId,1);assert.deepEqual(sent.data.bookseaPromptHandoff,sent.extra.bookseaHandoff);
 const saved=object(object(f.vars.booksea).activeExpedition) as unknown as State;
 assert.equal(saved.mode,mode);assert.equal(saved.narrative?.active,true);assert.equal(saved.paused,true);assert.equal(saved.run.rewards[0]?.kind,'fp');
 if(mode==='battle'){assert.equal(saved.battle!.units.find(u=>u.side==='enemy')!.current.hp,37);assert.match(after,/"hp":37/);}
 assert.equal(f.messages[0].extra.other,'kept');assert.deepEqual(object(f.port.read().stat_data).命运点数,100,'待结算收益不提前发放');
 f.controller.dispose();f.runtime.dispose();
});

test('删掉用户发言后恢复旧战局，未来正文缓存不能覆盖旧帧',async()=>{
 const f=await harness('battle');await f.source.emit('before','normal',{},false);await f.append();const future=JSON.parse(f.stored.get('run')!);
 f.messages.pop();await f.port.prepare!();const old=object(object(f.vars.booksea).activeExpedition) as unknown as State;
 assert.equal(old.mode,'battle');assert.equal(old.narrative,undefined);assert.equal(object(f.vars.booksea).narrativeMode,null);assert.notEqual(old.hostSave!.frame,future.hostSave.frame);
 assert.equal(old.battle!.units.find(u=>u.side==='enemy')!.current.hp,37);
 f.controller.dispose();f.runtime.dispose();
});

for(const [type,option,dry] of [['swipe',{},false],['regenerate',{},false],['continue',{},false],['quiet',{},false],['normal',{automatic_trigger:true},false],['normal',{},true]] as const)test('非原用户发送不切正文 '+type+JSON.stringify(option)+dry,async()=>{
 const f=await harness();await f.source.emit('before',type,option,dry);assert.equal(f.runtime.isPlaying(),true);assert.equal(f.handed,0);assert.equal(object(f.vars.booksea).narrativeMode,null);f.controller.dispose();f.runtime.dispose();
});

for(const text of ['', '/trigger'])test('无新文本与斜杠命令不触发 '+text,async()=>{
 const f=await harness();f.setText(text);await f.source.emit('before','normal',{},false);assert.equal(f.runtime.isPlaying(),true);assert.equal(f.handed,0);f.controller.dispose();f.runtime.dispose();
});

test('真实用户输入即使与系统触发词相同也按原消息交接',async()=>{
 const f=await harness('battle');f.setText('离开普罗泰利西翁');await f.source.emit('before','normal',{},false);await f.append();assert.equal(f.handed,1);assert.equal(f.messages.at(-1).mes,'离开普罗泰利西翁');assert.equal(f.messages.at(-1).extra.bookseaHandoff.kind,'narrative');f.controller.dispose();f.runtime.dispose();
});

test('助手追加与带系统交接extra的消息不能占用待交接用户现场',async()=>{
 const f=await harness();await f.source.emit('before','normal',{},false);await f.append('assistant');assert.equal(f.handed,0);assert.equal(f.messages.at(-1).extra.bookseaHandoff,undefined);f.controller.dispose();f.runtime.dispose();
 const g=await harness();await g.source.emit('before','normal',{},false);const marker={version:2,kind:'exit',runId:'other'};await g.append('user',{bookseaHandoff:marker});assert.equal(g.handed,0);assert.deepEqual(g.messages.at(-1).extra.bookseaHandoff,marker);g.controller.dispose();g.runtime.dispose();
});

test('冻结期间切聊天或替换候选不把现场写入新上下文',async()=>{
 const f=await harness();await f.source.emit('before','normal',{},false);f.switchChat();await f.append();assert.equal(f.handed,0);assert.equal(f.messages.at(-1).extra.bookseaHandoff,undefined);f.controller.dispose();f.runtime.dispose();
 const g=await harness();await g.source.emit('before','normal',{},false);g.messages[0].swipe_id=1;await assert.rejects(()=>g.append(),/候选|回退/);assert.equal(g.messages.at(-1).extra.bookseaHandoff,undefined);assert.equal(g.stopped,1,'无法安全提交时通过公开接口停止当前生成');g.controller.dispose();g.runtime.dispose();
});

test('同楼层返回迷宫保留战斗与未结算现场',async()=>{
 const f=await harness('battle');await f.source.emit('before','normal',{},false);await f.append();const s=structuredClone(object(f.vars.booksea).activeExpedition) as State;
 await resumeFromNarrative(f.port,s);assert.equal(s.narrative,undefined);assert.equal(s.mode,'battle');assert.equal(s.battle!.units.find(u=>u.side==='enemy')!.current.hp,37);assert.equal(s.run.rewards.length,1);f.controller.dispose();f.runtime.dispose();
});

test('正文现场中的EJS分隔符作为数据转义，不执行或污染模板',async()=>{
 const f=await harness();f.state.party[0]!.name='<% throw Error("unsafe") %>';const summary=userNarrativeBreakpoint(f.state);assert.doesNotMatch(summary,/<%|%>/);assert.match(summary,/u003c/);f.controller.dispose();f.runtime.dispose();
});

test('隐藏不推进规则/播放，恢复可见仍保持暂停并立即通知新Godot桥',async()=>{
 const f=await harness(),seen:boolean[]=[];f.runtime.registerVisibility(v=>seen.push(v));f.runtime.setVisible(false);const old=f.runtime.inspect() as ReturnType<typeof view>;
 for(let i=0;i<10;i++)f.timers[0]!();assert.deepEqual(f.runtime.inspect(),old);f.runtime.registerVisibility(v=>seen.push(v));f.runtime.setVisible(true);
 assert.equal((f.runtime.inspect() as ReturnType<typeof view>).paused,true);assert.deepEqual(seen,[true,false,false,true]);f.controller.dispose();f.runtime.dispose();
});

test('用户事件重送不重复结算，卸载移除全部监听',async()=>{
 const f=await harness();await f.source.emit('before','normal',{},false);await f.append();const saved=structuredClone(f.messages.at(-1));
 await f.source.emit('sent',1);assert.deepEqual(f.messages.at(-1),saved);assert.equal(f.handed,1);
 f.controller.dispose();assert.equal([...f.source.listeners.values()].flat().length,0);f.runtime.dispose();
});

test('关闭宿主会话后即使返回相同聊天，旧读写与编译回调仍失效',async()=>{
 const f=await harness(),before=structuredClone(f.messages);f.port.close!();f.switchChat();f.switchChat('chat');
 assert.throws(()=>f.port.read(),/已关闭/);assert.throws(()=>f.port.chat(),/已关闭/);assert.equal(f.port.saveCurrent!(f.state),false);
 await assert.rejects(()=>f.port.prepare!(),/已关闭/);await assert.rejects(()=>f.port.updateChat(v=>v),/已关闭/);
 assert.throws(()=>f.port.env.api.getVariables!({type:'chat'}),/已关闭/);
 assert.throws(()=>f.port.env.api.updateVariablesWith!(v=>v,{type:'chat'}),/已关闭/);
 assert.deepEqual(f.messages,before);f.controller.dispose();f.runtime.dispose();
});

test('发送取消时预览不进入旧快照，重新准备恢复原游戏分支',async()=>{
 const f=await harness('battle');await f.source.emit('before','normal',{},false);await f.source.emit('stopped');await f.port.prepare!();
 assert.equal(object(f.vars.booksea).narrativeMode,null);assert.equal((object(f.vars.booksea).activeExpedition as State).narrative,undefined);assert.equal(f.messages.length,1);f.controller.dispose();f.runtime.dispose();
});

test('取消发送后不必重开窗口，下一条原消息仍自动衔接现场',async()=>{
 const f=await harness('battle');await f.source.emit('before','normal',{},false);await f.source.emit('stopped');
 assert.equal(f.runtime.isPlaying(),true);assert.equal(object(f.vars.booksea).narrativeMode,null);assert.equal(f.handed,0);
 assert.equal((f.runtime.inspect() as ReturnType<typeof view>).paused,true);
 f.setText('这次我先说明来意。');await f.source.emit('before','normal',{},false);await f.append();
 assert.equal(f.handed,1);assert.equal(f.messages.at(-1).mes,'这次我先说明来意。');assert.match(f.messages.at(-1).extra.bookseaHandoff.summary,/"hp":37/);
 f.controller.dispose();f.runtime.dispose();
});

test('生成前交接失败后取消可恢复捕获，不把失败预览留给下一轮',async()=>{
 const f=await harness(),preview=f.port.previewNarrative;f.port.previewNarrative=async()=>{throw Error('模拟保存失败');};
 await assert.rejects(()=>f.source.emit('before','normal',{},false),/模拟保存失败/);
 await f.source.emit('stopped');assert.equal(f.runtime.isPlaying(),true);assert.equal(object(f.vars.booksea).narrativeMode,null);
 f.port.previewNarrative=preview;await f.source.emit('before','normal',{},false);await f.append();assert.equal(f.handed,1);
 f.controller.dispose();f.runtime.dispose();
});

test('返回保留已支付施法与时钟，并采用正文的资源/原背包余量',async()=>{
 const f=await harness('battle'),b=f.state.battle!,ally=b.units.find(u=>u.side==='ally')!,enemy=b.units.find(u=>u.side==='enemy')!;
 ally.actions['held-cast']={...strike(10,'physical',7,900),name:'蓄力试验'};ally.dependencies={'inventory:测试药剂':3};b.clock.pending=[{kind:'ready',unitId:ally.id}];
 f.state.battle=chooseAction(b,ally.id,'held-cast',enemy.id);
 f.state.inventory={drug:{owner:partner(),name:'测试药剂',actorId:ally.id,remaining:2,used:1}};
 const clock=structuredClone(f.state.battle.clock),commands=structuredClone(f.state.battle.commands);
 await f.source.emit('before','normal',{},false);await f.append();
 const native=f.messages.at(-1),actor=actorAt(native.data,partner());object(actor.生命值).当前=13;object(actor.法力值).当前=9;object(actor.体力值).当前=5;object(object(actor.背包).测试药剂).数量=1;
 clock.units.find(u=>u.id===ally.id)!.agility=Number(object(actor.属性).敏捷);
 const restored=structuredClone(object(f.vars.booksea).activeExpedition) as State;await resumeFromNarrative(f.port,restored);await checkpointHost(f.port,restored);
 assert.deepEqual(restored.battle!.clock,clock);assert.deepEqual(restored.battle!.commands,commands);assert.deepEqual(restored.battle!.units.find(u=>u.id===ally.id)!.current,{hp:13,mp:9,sp:5});
 assert.equal(restored.inventory!.drug!.remaining,1);assert.equal(restored.inventory!.drug!.used,1);assert.equal(restored.battle!.units.find(u=>u.id===ally.id)!.dependencies!['inventory:测试药剂'],1);
 assert.equal(object(object(actorAt(f.port.read(),partner()).背包).测试药剂).数量,1);assert.equal(object(actorAt(f.port.read(),partner()).体力值).当前,5);assert.equal(object(f.port.read().stat_data).命运点数,100);
 f.controller.dispose();f.runtime.dispose();
});

test('正文下行保存也尊重正文的资源，不用冻结缓存覆盖新消耗',async()=>{
 const f=await harness('battle');await f.source.emit('before','normal',{},false);await f.append();
 const native=f.messages.at(-1),actor=actorAt(native.data,partner());object(actor.生命值).当前=11;object(actor.法力值).当前=8;object(actor.体力值).当前=3;
 let calls=0;f.port.postNarrative=async()=>{calls++;};await descendNarrativeMode(f.port,()=>null);
 assert.equal(calls,1);assert.equal(object(actorAt(f.port.read(),partner()).生命值).当前,11);assert.equal(object(actorAt(f.port.read(),partner()).法力值).当前,8);assert.equal(object(actorAt(f.port.read(),partner()).体力值).当前,3);
 assert.equal((object(f.vars.booksea).activeExpedition as State).narrative!.depth,2);
 f.controller.dispose();f.runtime.dispose();
});

test('正文资源缺失或非法时拒绝恢复，不静默转成零生命写回',async()=>{
 const f=await harness('battle');await f.source.emit('before','normal',{},false);await f.append();
 const actor=actorAt(f.messages.at(-1).data,partner());object(actor.生命值).当前='invalid';
 const original=structuredClone(f.messages.at(-1).data),s=structuredClone(object(f.vars.booksea).activeExpedition) as State;
 await assert.rejects(()=>resumeFromNarrative(f.port,s),/有限数值/);assert.equal(s.narrative!.active,true);assert.deepEqual(f.messages.at(-1).data,original);
 f.controller.dispose();f.runtime.dispose();
});

test('自动正文未提前结算FP，离场重试只发一次待结算收益',async()=>{
 const f=await harness();await f.source.emit('before','normal',{},false);await f.append();
 const s=structuredClone(object(f.vars.booksea).activeExpedition) as State;f.port.deliver=async()=>{};leaveFromNarrative(s);
 await checkpointHost(f.port,s);const once=structuredClone(f.port.read());await checkpointHost(f.port,s);
 assert.equal(object(once.stat_data).命运点数,177);assert.deepEqual(f.port.read(),once);f.controller.dispose();f.runtime.dispose();
});

test('切正文取消未完成补给员响应，不产生交易或把pending锁带回缓存',async()=>{
 const f=await harness('supplier');f.state.supplierTalks={npc:{thingId:'npc',serial:3,log:[],pending:true,grants:{relic:0,item:0,event:0,loot:0}}};
 await f.source.emit('before','normal',{},false);await f.append();const s=object(f.vars.booksea).activeExpedition as State;
 assert.equal(s.supplierTalks!.npc!.pending,false);assert.equal(s.supplierTalks!.npc!.serial,4);assert.match(f.messages.at(-1).extra.bookseaHandoff.summary,/回复尚未完成/);assert.equal(s.run.rewards.length,1);f.controller.dispose();f.runtime.dispose();
});

for(const event of ['stopped','ended'])test('自动交接后'+event+'记录流式中止，部分正文不能移交旧战局',async()=>{
 const f=await harness('battle');await f.source.emit('before','normal',{},false);await f.append();
 f.messages.push({is_user:false,role:'assistant',mes:'只生成到一半的正文。',gen_finished:1,data:structuredClone(f.messages.at(-1).data),extra:{}});
 f.setProcessor({messageId:2,isFinished:true,isStopped:event==='ended',abortController:{signal:{aborted:true}}});
 await f.source.emit(event);assert.equal(f.messages[2].extra.bookseaNarrativeReply.status,'interrupted');
 await f.port.prepare!();const s=structuredClone(object(f.vars.booksea).activeExpedition) as State;f.port.bind!(s);await resumeFromNarrative(f.port,s);assert.equal(s.mode,'battle');
 f.controller.dispose();f.runtime.dispose();
});

for(const retry of ['regenerate','swipe'])test('中止后'+retry+'成功只更新当前候选，随后可将遭遇交给正文',async()=>{
 const f=await harness('battle');await f.source.emit('before','normal',{},false);await f.append();
 const row={is_user:false,role:'assistant',mes:'生成到一半。',gen_finished:1,data:structuredClone(f.messages.at(-1).data),extra:{}} as any;f.messages.push(row);
 await f.source.emit('stopped');assert.equal(row.extra.bookseaNarrativeReply.status,'interrupted');
 await f.source.emit('before',retry,{},false);
 assert.equal(row.extra.bookseaNarrativeReply.status,'interrupted','重试尚未完成不能提前解除中止标记');
 if(retry==='swipe'){row.swipe_id=1;row.swipe_info[1]={extra:{...row.extra}};}
 row.mes='这一候选的正文正常继续了。';row.gen_finished=2;
 f.setProcessor({messageId:2,isFinished:true,isStopped:false,abortController:{signal:{aborted:false}}});await f.source.emit('ended');
 assert.equal(row.extra.bookseaNarrativeReply.status,'completed');if(retry==='swipe')assert.equal(row.swipe_info[0].extra.bookseaNarrativeReply.status,'interrupted','另一候选仍保留中止记录');
 await f.port.prepare!();const s=structuredClone(object(f.vars.booksea).activeExpedition) as State;f.port.bind!(s);await resumeFromNarrative(f.port,s);assert.equal(s.mode,'explore');assert.equal(s.battle,null);
 f.controller.dispose();f.runtime.dispose();
});

test('中止后重生成失败未产生新完成时间，不能解除中止标记',async()=>{
 const f=await harness('battle');await f.source.emit('before','normal',{},false);await f.append();
 f.messages.push({is_user:false,role:'assistant',mes:'上次的部分正文。',gen_finished:1,data:structuredClone(f.messages.at(-1).data),extra:{}});
 await f.source.emit('stopped');await f.source.emit('before','regenerate',{},false);f.setProcessor(null);await f.source.emit('ended');
 assert.equal(f.messages[2].extra.bookseaNarrativeReply.status,'interrupted');f.controller.dispose();f.runtime.dispose();
});
