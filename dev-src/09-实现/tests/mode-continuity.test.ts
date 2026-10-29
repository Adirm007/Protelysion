import test from 'node:test';
import assert from 'node:assert/strict';
import _ from 'lodash';
import {sessionPort,checkpointHost} from '../src/host/game-session';
import {descendNarrativeMode,enterNarrativeMode,leaveNarrativeMode,prepareUserNarrative,attachUserNarrative,resumeFromNarrative} from '../src/host/narrative-mode';
import {resumeHostExpedition} from '../src/host/resume';
import {startExpedition,startNarrative,interact,hostFpAvailable,type State} from '../src/game/expedition';
import {playtestParty} from '../src/game/content';
import {actorAt,object,resourceMax,type Obj} from '../src/core/actors';
import {addReward} from '../src/core/run';
import {fixture,partner} from './fixtures';

/** Uses the real message timeline: every prose response inherits MVU/reference,
 * while only its original owning message carries the full checkpoint. */
async function host(){
 let chat:Obj={};const messages:any[]=[{is_user:false,mes:'入场',data:fixture(),extra:{}}];
 const context={characterId:'card',getCurrentChatId:()=> 'continuity',chat:messages,saveChat:async()=>{}};
 const api={getLastMessageId:()=>messages.length-1,
  getChatMessages:(id:number|string)=>typeof id==='number'?[{...structuredClone(messages[id===-1?messages.length-1:id]),message_id:id===-1?messages.length-1:id}]:messages.map((m,i)=>({...structuredClone(m),message_id:i})),
  getVariables:(o:Obj)=>structuredClone(o.type==='chat'?chat:messages[Number(o.message_id??messages.length-1)].data),
  updateVariablesWith:async(fn:(v:Obj)=>Obj,o:Obj)=>{if(o.type==='chat')chat=fn(structuredClone(chat));else{const m=messages[Number(o.message_id??messages.length-1)];m.data=fn(structuredClone(m.data));}}};
 const port=sessionPort({TavernHelper:api,SillyTavern:{getContext:()=>context},_:_,navigator:{locks:{request:async(_key:string,fn:()=>Promise<unknown>)=>fn()}}});
 await port.prepare!();
 const party=playtestParty().slice(0,1);party[0]!.ref=partner();const state=startExpedition(party,91);state.source='host';state.hostContext=port.id();state.hostFp=100;state.hostFpSpent=10;
 state.inventory={drug:{owner:partner(),name:'测试药剂',actorId:party[0]!.id,remaining:2,used:1}};
 state.run=addReward(state.run,{kind:'fp',amount:77,count:1,source:'待结算'});
 port.bind!(state);await checkpointHost(port,state);
 async function append(role:'user'|'assistant',edit?:(data:Obj)=>void){const data=structuredClone(messages.at(-1).data);edit?.(data);messages.push({is_user:role==='user',mes:role==='user'?'继续':'正文',data,extra:{}});await port.prepare!();}
 port.postNarrative=async()=>{await append('user');await append('assistant');};port.deliver=async()=>{};
 const saved=()=>{const s=resumeHostExpedition(object(port.chat().booksea).activeExpedition,()=>null,port.id(),port.authorizedFrames!());port.bind!(s);return s;};
 const resources=(v:Obj,hp:number,mp:number,sp:number,count:number,fp:number)=>{const a=actorAt(v,partner());object(a.生命值).当前=hp;object(a.法力值).当前=mp;object(a.体力值).当前=sp;object(object(a.背包).测试药剂).数量=count;object(v.stat_data).命运点数=fp;};
 return {port,state,messages,append,saved,resources};
}

test('手动正文跨多楼层下行、游戏下行、再切正文沿用同一趟与最新资源',async()=>{
 const f=await host(),runId=f.state.run.id;
 assert.equal(startNarrative(f.state),true);await checkpointHost(f.port,f.state);await enterNarrativeMode(f.port,f.state);
 await f.append('user');await f.append('assistant',v=>f.resources(v,23,12,7,1,69));
 for(let i=0;i<3;i++)await descendNarrativeMode(f.port,()=>null);
 let s=f.saved();assert.equal(s.narrative!.depth,4);assert.equal(s.run.id,runId);assert.equal(s.run.rewards.length,1);
 await resumeFromNarrative(f.port,s);assert.equal(s.depth,4);assert.equal(s.region.depth,4);
 assert.deepEqual(s.party[0]!.current,{hp:23,mp:12,sp:7});assert.equal(s.inventory!.drug!.remaining,1);assert.equal(s.inventory!.drug!.used,1);
 assert.equal(hostFpAvailable(s),69);await checkpointHost(f.port,s);assert.equal(object(f.port.read().stat_data).命运点数,69);
 for(let i=0;i<2;i++){s.paused=false;s.strayWarning=false;s.exitAsk=false;const stairs=s.region.things.find(t=>t.kind==='stairs')!;assert.ok(stairs);for(const t of s.region.things)if(t.kind==='enemy')t.used=true;s.x=stairs.x;s.z=stairs.z;interact(s);}
 assert.equal(s.depth,6);await checkpointHost(f.port,s);
 const meta=await prepareUserNarrative(f.port,s);await f.append('user');await attachUserNarrative(f.port,s,meta);
 await f.append('assistant',v=>f.resources(v,17,8,4,0,41));await f.append('user');await f.append('assistant');
 s=f.saved();await resumeFromNarrative(f.port,s);await checkpointHost(f.port,s);
 assert.equal(s.run.id,runId);assert.equal(s.depth,6);assert.deepEqual(s.party[0]!.current,{hp:17,mp:8,sp:4});assert.equal(s.inventory!.drug!.remaining,0);assert.equal(s.inventory!.drug!.used,1);
 assert.equal(hostFpAvailable(s),41);assert.equal(object(f.port.read().stat_data).命运点数,41);assert.equal(s.run.rewards.length,1);
 assert.deepEqual(s.narrativeSpans,[{from:1,to:4},{from:6,to:6}]);
 assert.ok(f.messages.length>12);assert.equal(object(object(f.port.read().bookseaSessionReceipts)[runId]).hostFpSpent,10);
});

for(const automatic of [false,true])test((automatic?'自动':'手动')+'正文离场保留原恢复规则，背包不回滚且结算只做一次',async()=>{
 const f=await host();
 if(automatic){const meta=await prepareUserNarrative(f.port,f.state);await f.append('user');await attachUserNarrative(f.port,f.state,meta);}
 else{startNarrative(f.state);await checkpointHost(f.port,f.state);await enterNarrativeMode(f.port,f.state);}
 await f.append('assistant',v=>f.resources(v,9,5,2,0,31));
 await leaveNarrativeMode(f.port,()=>null);const once=structuredClone(f.port.read());
 const a=actorAt(once,partner());for(const resource of ['生命值','法力值','体力值'] as const)assert.equal(object(a[resource]).当前,resourceMax(a,resource),'真正离场仍按既有规则恢复三资源');
 assert.equal(object(object(actorAt(once,partner()).背包).测试药剂).数量,0);assert.equal(object(once.stat_data).命运点数,108);
 const ended=object(f.port.chat().booksea).lastExpedition as State;await checkpointHost(f.port,ended);assert.deepEqual(f.port.read(),once);
});

test('正文资源格式错误时保留完整缓存，不能只接受前半个资源字段',async()=>{
 const f=await host();startNarrative(f.state);await checkpointHost(f.port,f.state);await enterNarrativeMode(f.port,f.state);
 await f.append('assistant',v=>{const a=actorAt(v,partner());object(a.生命值).当前=7;object(a.法力值).当前='错误值';});
 const s=f.saved(),before=structuredClone(s),mvu=structuredClone(f.port.read());
 await assert.rejects(()=>resumeFromNarrative(f.port,s),/有限数值/);assert.deepEqual(s,before);assert.deepEqual(f.port.read(),mvu);
});
