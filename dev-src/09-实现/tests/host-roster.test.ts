import test from 'node:test';import assert from 'node:assert/strict';
import {fixture,actor,player,partner} from './fixtures';
import {actorAt,actorKey,type Obj} from '../src/core/actors';
import {canonical,combatProjection,COMPILER_VERSION,EFFECT_SCHEMA_VERSION} from '../src/core/cache';
import {createRosterReader,projectRoster,selectRoster,rosterHostFromGlobals,type RosterHost} from '../src/host/roster';
import {RosterBridge} from '../src/presentation/roster-bridge';
import {BRIDGE_VERSION,PresentationMessage} from '../src/presentation/protocol';
import {assetBase} from '../src/host/godot-loader';
function setup(){let id='chat-a',listener=()=>{},off=0,reads=0,mvu=fixture(),messageId=4;
  const host:RosterHost={getVariables(o){reads++;return o.type==='chat'?{}:mvu;},getLastMessageId:()=>messageId,waitGlobalInitialized:async()=>{},context:()=>({chatId:id,characterId:1}),onChatChanged(fn){listener=fn;return()=>{off++;};}};
  return{host,get reads(){return reads},get off(){return off},get mvu(){return mvu},set mvu(v){mvu=v},change(next:string){id=next;listener();},setMessageId(n:number){messageId=n}};
}
test('只读列表保留真实等级与当前资源，字段投影不含原文/物品/属性',()=>{
  const mvu=fixture(),before=JSON.stringify(mvu);const view=projectRoster(mvu,{},4);
  assert.equal(view.actors.length,5);assert.deepEqual(view.actors[0]!.current,{hp:30,mp:15,sp:10});assert.deepEqual(view.actors[0]!.max,{hp:120,mp:80,sp:55});
  assert.equal(JSON.stringify(mvu),before);for(const secret of ['测试效果','测试药剂','命运点数','力量'])assert.equal(JSON.stringify(view).includes(secret),false);
});
test('伙伴69不符合，70符合；不在场及高于主角不阻止，只看真实资格',()=>{
  const mvu=fixture();actorAt(mvu,partner()).好感度=69;const view=projectRoster(mvu,{},1);assert.equal(view.actors[1]!.eligibility,'blocked');assert.equal(view.actors[4]!.eligibility,'eligible');
  actorAt(mvu,partner()).好感度=70;assert.equal(projectRoster(mvu,{},1).actors[1]!.eligibility,'eligible');
});
test('四伙伴可查看，不要求主角；空队、重复、五人、未知人不能确认',()=>{
  const view=projectRoster(fixture(),{},0);assert.equal(selectRoster(view,['roster-1','roster-2','roster-3','roster-4']).selectedIds.length,4);
  for(const ids of [[],['roster-1','roster-1'],['roster-0','roster-1','roster-2','roster-3','roster-4'],['no']])assert.throws(()=>selectRoster(view,ids));
});
test('来源匹配不标为入场可用，装备变化变stale，当前HP变化不使来源失效',()=>{
  const mvu=fixture(),a=actorAt(mvu,player),source=combatProjection(a);
  const cache={actorRef:player,compilerVersion:COMPILER_VERSION,effectSchemaVersion:EFFECT_SCHEMA_VERSION,combatSourceSnapshot:source,combatFingerprint:canonical(source),compiledActor:{unsupported:true}};
  const chat={booksea:{actorCache:{[actorKey(player)]:cache}}};
  assert.equal(projectRoster(mvu,chat,1).actors[0]!.cache,'source-matches');object(a.生命值).当前=0;
  assert.equal(projectRoster(mvu,chat,1).actors[0]!.cache,'source-matches');a.装备={test:'changed'};assert.equal(projectRoster(mvu,chat,1).actors[0]!.cache,'stale');
});
const object=(x:unknown)=>x as Obj;
test('破损缓存与不完整资源会显示问题，不创建替补角色',()=>{
  const mvu=fixture();delete actorAt(mvu,player).生命值;
  const view=projectRoster(mvu,{booksea:{actorCache:{[actorKey(player)]:{}}}},1);
  assert.equal(view.actors[0]!.eligibility,'blocked');assert.equal(view.actors[0]!.current,null);assert.equal(view.actors[0]!.cache,'incompatible');
});
test('读取器导入与创建不读取MVU，显式read只用读取接口，close解绑',async()=>{
  const env=setup(),reader=createRosterReader(env.host,()=>{});assert.equal(env.reads,0);await reader.read();assert.equal(env.reads,2);reader.close();assert.equal(env.off,1);await assert.rejects(reader.read());
});
test('等待MVU时切聊天，晚到结果不发布；A-B-A同样失效',async()=>{
  const env=setup();let done!:()=>void;env.host.waitGlobalInitialized=()=>new Promise<void>(r=>{done=r});let invalidated=0;
  const reader=createRosterReader(env.host,()=>{invalidated++}),pending=reader.read();env.change('b');env.change('chat-a');done();await assert.rejects(pending);assert.equal(env.reads,0);assert.equal(invalidated,1);reader.close();
});
test('初始化超时可重试，未将超时标成功',async()=>{
  const env=setup();env.host.waitGlobalInitialized=()=>new Promise(()=>{});const reader=createRosterReader(env.host,()=>{},5);await assert.rejects(reader.read(),/超时/);env.host.waitGlobalInitialized=async()=>{};assert.equal((await reader.read()).actors.length,5);reader.close();
});
test('确认前重新读取资格，降低好感阻断',async()=>{
  const env=setup(),reader=createRosterReader(env.host,()=>{});await reader.read();actorAt(env.mvu,partner()).好感度=69;await assert.rejects(reader.select(['roster-1']),/资格/);reader.close();
});
test('列表重排按完整角色身份重新映射，不误选相同索引',async()=>{
  const env=setup(),reader=createRosterReader(env.host,()=>{});await reader.read();
  const stat=object(env.mvu.stat_data),relations=object(stat.关系列表);stat.关系列表={新增人物:actor(),...relations};
  const selected=await reader.select(['roster-1']);assert.deepEqual(selected.selectedIds,['roster-2']);assert.equal(selected.actors[2]!.name,'测试伙伴甲');reader.close();
});
test('没有宿主或未选聊天给出明确提示；不会扫描父页面',()=>{
  assert.throws(()=>rosterHostFromGlobals({}),/缺少/);const env=setup();env.host.context=()=>({chatId:'',characterId:1});assert.throws(()=>createRosterReader(env.host,()=>{}),/聊天/);
});
test('Godot只读桥握手返回actor_snapshot，战斗输入被拒绝且快照是副本',()=>{
  const view=selectRoster(projectRoster(fixture(),{},1),['roster-0']),bridge=new RosterBridge(view,'session');
  const wire=(sequence:number,type:string,payload:object)=>JSON.stringify({protocolVersion:BRIDGE_VERSION,sessionId:'session',sequence,type,payload});
  const messages=bridge.receive(wire(1,'ui_ready',{}));assert.equal(messages[1]!.type,'actor_snapshot');messages.forEach(m=>PresentationMessage.parse(m));
  assert.equal(bridge.receive(wire(2,'choose_action',{actorId:'a',sourceId:'skill',targetId:'e'}))[0]!.type,'error_view');
  view.actors[0]!.current!.hp=0;const snapshot=bridge.snapshot();assert.equal(snapshot.type==='actor_snapshot'&&snapshot.payload.actors[0]!.current!.hp,30);
  bridge.close();assert.deepEqual(bridge.receive(wire(3,'ui_ready',{})),[]);
});
test('同源资源目录正确解析，跨源或非HTTP地址不用于宿主内执行',()=>{
  assert.equal(assetBase('/booksea-godot-host','http://127.0.0.1:8017/').href,'http://127.0.0.1:8017/booksea-godot-host/');
  for(const path of ['https://another.test/','javascript:alert(1)','data:text/html,x'])assert.throws(()=>assetBase(path,'http://127.0.0.1:8017/'));
});
