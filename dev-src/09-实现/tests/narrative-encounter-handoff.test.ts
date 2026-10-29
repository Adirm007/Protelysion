import test from 'node:test';
import assert from 'node:assert/strict';
import _ from 'lodash';
import {sessionPort,checkpointHost} from '../src/host/game-session';
import {prepareUserNarrative,attachUserNarrative,resumeFromNarrative} from '../src/host/narrative-mode';
import {resumeHostExpedition} from '../src/host/resume';
import {startExpedition,move,interact,hostFpAvailable,type State} from '../src/game/expedition';
import {playtestParty} from '../src/game/content';
import {walkable} from '../src/game/region';
import {addReward} from '../src/core/run';
import {actorAt,object,type Obj} from '../src/core/actors';
import {fixture,partner} from './fixtures';

async function host(mode:'battle'|'event'|'supplier'='battle',native=true){
 let chat:Obj={};const messages:any[]=[{is_user:false,mes:'此前的场景。',data:fixture(),extra:{}}];
 const context:any={characterId:'card',getCurrentChatId:()=> 'encounter',...(native?{chat:messages}:{}),saveChat:async()=>{}};
 const api={getLastMessageId:()=>messages.length-1,
  getChatMessages:(id:number|string)=>typeof id==='number'?[{...structuredClone(messages[id===-1?messages.length-1:id]),role:messages[id===-1?messages.length-1:id].is_user?'user':'assistant',message:messages[id===-1?messages.length-1:id].mes,message_id:id===-1?messages.length-1:id}]:messages.map((m,i)=>({...structuredClone(m),role:m.is_system?'system':m.is_user?'user':'assistant',message:m.mes,message_id:i})),
  getVariables:(o:Obj)=>structuredClone(o.type==='chat'?chat:messages[Number(o.message_id??messages.length-1)].data),
  setChatMessages:async(rows:any[])=>{for(const row of rows)Object.assign(messages[row.message_id],row);},
  updateVariablesWith:async(fn:(v:Obj)=>Obj,o:Obj)=>{if(o.type==='chat')chat=fn(structuredClone(chat));else{const m=messages[Number(o.message_id??messages.length-1)];m.data=fn(structuredClone(m.data));}}};
 const port=sessionPort({TavernHelper:api,SillyTavern:{getContext:()=>context},_:_,navigator:{locks:{request:async(_key:string,fn:()=>Promise<unknown>)=>fn()}}});await port.prepare!();
 const party=playtestParty().slice(0,1);party[0]!.ref=partner();
 for(const key of ['力量','敏捷','体质','智力','精神'] as const)party[0]!.card.numeric.attributes[key]=Number(object(actorAt(messages[0].data,partner()).属性)[key]);
 const s=startExpedition(party,91);s.source='host';s.hostContext=port.id();s.hostFp=100;s.hostFpSpent=10;
 if(mode==='battle'){
  const enemy=s.region.things.find(t=>t.kind==='enemy')!;
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]] as const)if(walkable(s.region,enemy.x-dx,enemy.z-dz)){s.x=enemy.x-dx;s.z=enemy.z-dz;move(s,dx,dz);break;}
 }else{
  const id='narrative-test-'+mode;s.region.things.push({id,kind:mode,x:s.x,z:s.z,name:'测试互动',used:false,foes:[]});
  for(const t of s.region.things)if(t.id!==id&&t.kind!=='enemy')t.used=true;interact(s);
 }
 assert.equal(s.mode,mode);const thingId=mode==='battle'?s.encounterId:mode==='event'?s.eventState!.thingId:s.supplierState!.thingId;
 s.inventory={drug:{owner:partner(),name:'测试药剂',actorId:party[0]!.id,remaining:2,used:1}};s.run=addReward(s.run,{kind:'fp',amount:77,count:1,source:'此前所得'});
 port.bind!(s);await checkpointHost(port,s);const meta=await prepareUserNarrative(port,s);
 messages.push({is_user:true,mes:'我接着说明来意。',data:structuredClone(messages.at(-1).data),extra:{}});await attachUserNarrative(port,s,meta);
 async function append(message:string,extra:Obj={},flags:Obj={}){const data=structuredClone(messages.at(-1).data),a=actorAt(data,partner());object(a.生命值).当前=13;object(a.法力值).当前=9;object(a.体力值).当前=5;object(object(a.背包).测试药剂).数量=1;object(data.stat_data).命运点数=61;messages.push({is_user:false,mes:message,gen_finished:1,data,extra,...flags});await port.prepare!();}
 const saved=()=>{const state=resumeHostExpedition(object(port.chat().booksea).activeExpedition,()=>null,port.id(),port.authorizedFrames!());port.bind!(state);return state;};
 return {port,s,messages,context,thingId,append,saved};
}

for(const mode of ['battle','event','supplier'] as const)test(mode+'交给有效正文后同层返回，不重播遭遇、不自动发奖且保留地图资源',async()=>{
 const f=await host(mode);await f.append('她收起武器，与你继续沿着走廊前行。');
 const s=f.saved(),before=structuredClone(s),receipts=structuredClone(f.port.read().bookseaSessionReceipts);await resumeFromNarrative(f.port,s);
 assert.equal(s.mode,'explore');assert.equal(s.battle,null);assert.equal(s.run.battleActive,false);assert.equal(s.eventState,undefined);assert.equal(s.supplierState,undefined);
 assert.equal(s.region.things.find(t=>t.id===f.thingId)!.used,true);assert.deepEqual(s.region.tiles,before.region.tiles);assert.deepEqual(s.region.layout,before.region.layout);assert.equal(s.region.id,before.region.id);assert.deepEqual([s.depth,s.x,s.z],[before.depth,before.x,before.z]);
 assert.deepEqual(s.party[0]!.current,{hp:13,mp:9,sp:5});assert.equal(s.inventory!.drug!.remaining,1);assert.equal(s.inventory!.drug!.used,1);assert.equal(s.hostFpSpent,10);assert.equal(hostFpAvailable(s),61);
 assert.equal(s.run.id,before.run.id);assert.deepEqual(s.run.rewards,before.run.rewards);assert.deepEqual(s.run.participants,before.run.participants);assert.deepEqual(f.port.read().bookseaSessionReceipts,receipts);
 await checkpointHost(f.port,s);assert.equal(object(f.port.read().stat_data).命运点数,61);assert.deepEqual(f.port.read().bookseaSessionReceipts,receipts);
});

for(const [name,text,extra,flags] of [
 ['空回复','',{},{}],['仅控制标签','<booksea-game>迷宫模式</booksea-game>',{},{}],
 ['仅变量更新','<UpdateVariable><JSONPatch>[]</JSONPatch></UpdateVariable>',{},{}],
 ['仅思考','<think>这场战斗如何继续</think>',{},{}],['没有完成字段','故事只写了半句。',{},{gen_finished:undefined}],
 ['系统消息','系统通知',{},{is_system:true}],['报错消息','请求暂时失败。',{error:'timeout'},{}],
] as [string,string,Obj,Obj][])test(name+'不接管原暂停战局',async()=>{
 const f=await host();await f.append(text,extra,flags);const s=f.saved(),battle=structuredClone(s.battle);await resumeFromNarrative(f.port,s);
 assert.equal(s.mode,'battle');assert.equal(s.region.things.find(t=>t.id===f.thingId)!.used,false);assert.deepEqual(s.battle!.clock,battle!.clock);assert.deepEqual(s.battle!.commands,battle!.commands);
});

test('没有正文立即返回不会因较早的助手场景跳过当前遭遇',async()=>{
 const f=await host(),s=f.saved();await resumeFromNarrative(f.port,s);assert.equal(s.mode,'battle');assert.equal(s.region.things.find(t=>t.id===f.thingId)!.used,false);
});

test('原用户候选的交接身份变化后不能用另一候选正文结束旧战局',async()=>{
 const f=await host();await f.append('这一候选的故事已经继续。');const s=f.saved();
 const owner=f.messages[1];owner.swipe_id=1;owner.swipe_info=[{extra:owner.extra},{extra:{bookseaHandoff:{...owner.extra.bookseaHandoff,runId:'other-run'}}}];
 await resumeFromNarrative(f.port,s);assert.equal(s.mode,'battle');assert.equal(s.region.things.find(t=>t.id===f.thingId)!.used,false);
});

test('没有原生chat数组时通过酒馆助手消息读取正文交接',async()=>{
 const f=await host('battle',false);await f.append('对手退开后，你们重新踏上走廊。');const s=f.saved();await resumeFromNarrative(f.port,s);assert.equal(s.mode,'explore');assert.equal(s.region.things.find(t=>t.id===f.thingId)!.used,true);
});

test('流式chunk虽有gen_finished，生成仍在进行时不得接管遭遇',async()=>{
 const f=await host();await f.append('她刚准备开口。');f.context.streamingProcessor={messageId:2,isFinished:false,isStopped:false};
 const s=f.saved();await resumeFromNarrative(f.port,s);assert.equal(s.mode,'battle');assert.equal(s.region.things.find(t=>t.id===f.thingId)!.used,false);
});

test('已写回的中止标记跨重新读取后仍保留原暂停战局',async()=>{
 const f=await host();await f.append('只生成了一部分正文。');await f.port.markNarrativeInterrupted!(1,f.s.run.id);
 assert.equal(f.messages[2].extra.bookseaNarrativeReply.status,'interrupted');
 const s=f.saved();await resumeFromNarrative(f.port,s);assert.equal(s.mode,'battle');assert.equal(s.region.things.find(t=>t.id===f.thingId)!.used,false);
});

test('助手重抽后的有效候选不继承另一候选的中止标记',async()=>{
 const f=await host();await f.append('这一候选已正常写完。');const row=f.messages[2];
 row.extra.bookseaNarrativeReply={status:'interrupted'};row.swipe_id=1;row.swipe_info=[{extra:structuredClone(row.extra)},{extra:{},gen_finished:1}];
 await f.port.prepare!();const s=f.saved();await resumeFromNarrative(f.port,s);assert.equal(s.mode,'explore');assert.equal(s.region.things.find(t=>t.id===f.thingId)!.used,true);
});
