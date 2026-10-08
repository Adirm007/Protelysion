import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle, advanceBattle} from '../src/battle/executor';
import {card, damageAction, mitigation} from './compiler-fixtures';
import {BattleBridge} from '../src/presentation/battle-bridge';
import {BRIDGE_VERSION, decodeIntent, PresentationMessage} from '../src/presentation/protocol';
import {mountSamePageBridge, bindBridgeLifecycle} from '../src/presentation/same-page';
const sourceId = '/技能/定量打击';
function battle(ready = true) {
  const b = createBattle([
    {id:'a',side:'ally',card:card(damageAction()),current:{hp:100,mp:80,sp:100},mitigation:mitigation()},
    {id:'e',side:'enemy',card:card(damageAction()),current:{hp:100,mp:80,sp:100},mitigation:mitigation()}
  ],123);
  return ready ? advanceBattle(b,4000).battle : b;
}
function wire(sequence: number, type = 'ui_ready', payload: object = {}, sessionId = 'test-session') {
  return JSON.stringify({protocolVersion:BRIDGE_VERSION,sessionId,sequence,type,payload});
}
function setup(ready = true) {
  const b = new BattleBridge(battle(ready),'test-session'); b.receive(wire(1)); return b;
}
function accepted(messages: PresentationMessage[]) {
  const result = messages.find(m => m.type === 'intent_result');
  return result?.type === 'intent_result' && result.payload.status === 'accepted';
}
const action = {actorId:'a',sourceId,targetId:'e'};
test('桥合同：拒绝版本/未知消息/字段/非JSON/超长/非安全序号，不接受时间或HP写入',()=>{
  for(const input of [null,{},'x',' '.repeat(16385), wire(0),wire(1.5),wire(Number.MAX_SAFE_INTEGER+1),wire(1,'advance_time',{delta:1000}),wire(1,'choose_action',{...action,hp:99}),wire(1).replace(BRIDGE_VERSION,'old')]) assert.throws(()=>decodeIntent(input));
});
test('ready握手前不推进时间、不接受动作；握手包含权威标识及可校验快照',()=>{
  const b=new BattleBridge(battle(false),'test-session');assert.equal(b.advanceRules(50).consumedMs,0);
  assert.equal(accepted(b.receive(wire(1,'choose_action',action))),false);
  const messages=b.receive(wire(2));messages.forEach(m=>PresentationMessage.parse(m));
  assert.equal(messages[0]!.type,'boot_config');assert.equal(b.advanceRules(50).consumedMs,50);
});
test('白名单快照与存档副本不能改变权威；没有随机种子/DSL/宿主私有字段',()=>{
  const original=battle();(original as unknown as Record<string,unknown>).privateChat='private sentinel';
  const b=new BattleBridge(original,'test-session');b.receive(wire(1));
  const view=b.view();view.actors[0]!.current.hp=0;original.units[0]!.current.hp=0;b.exportBattle().units[0]!.current.hp=0;
  assert.equal(b.view().actors[0]!.current.hp,100);
  const serialized=JSON.stringify(b.snapshot());for(const key of ['seed','private sentinel','effects','mitigation','attributes'])assert.equal(serialized.includes(key),false);
});
test('我方意图由现有执行器扣SP，TS结算造成40伤害；快照本身不推进规则',()=>{
  const b=setup();assert.ok(accepted(b.receive(wire(2,'choose_action',action))));
  assert.equal(b.view().actors[0]!.current.sp,90);assert.equal(b.view().actors[1]!.current.hp,100);
  assert.equal(b.advanceRules(50).consumedMs,0);b.resolvePending();assert.equal(b.view().actors[1]!.current.hp,60);
  assert.equal(b.view().timeMs,4000);
});
test('重复/乱序/其他会话不会二次扣费，错误会话不占用有效序号',()=>{
  const b=setup();const w=wire(2,'choose_action',action);b.receive(w);b.receive(w);b.receive(wire(1));
  assert.equal(b.view().actors[0]!.current.sp,90);
  assert.equal(b.receive(wire(999,'request_pause',{reason:'user',state:'on'},'old'))[0]!.type,'error_view');
  assert.ok(accepted(b.receive(wire(3,'request_pause',{reason:'user',state:'on'}))));
});
test('语义失败不修改战斗，重发须新序号；无默认攻击',()=>{
  const b=setup(),before=b.exportBattle();assert.equal(accepted(b.receive(wire(2,'choose_action',{...action,sourceId:'missing'}))),false);
  assert.deepEqual(b.exportBattle(),before);assert.equal(accepted(b.receive(wire(2,'choose_action',action))),false);
  assert.ok(accepted(b.receive(wire(3,'choose_action',action))));
});
test('呈现端不能代替敌方行动，宿主显式AI端点可接现有执行器',()=>{
  const b=setup();b.receive(wire(2,'choose_action',action));b.resolvePending();
  assert.equal(accepted(b.receive(wire(3,'choose_action',{actorId:'e',sourceId,targetId:'a'}))),false);
  b.chooseEnemyAction('e',sourceId,'a');b.resolvePending();assert.equal(b.view().actors[0]!.current.hp,60);
});
for (const reason of ['user','menu','target'] as const) test(`暂停原因${reason}冻结规则/提交/结算`,()=>{
  const b=setup(false);b.receive(wire(2,'request_pause',{reason,state:'on'}));const before=b.exportBattle();
  for(let i=0;i<100;i++)assert.equal(b.advanceRules(250).consumedMs,0);
  assert.equal(accepted(b.receive(wire(3,'choose_action',action))),false);assert.throws(()=>b.resolvePending());assert.deepEqual(b.exportBattle(),before);
  b.receive(wire(4,'request_pause',{reason,state:'off'}));assert.equal(b.advanceRules(50).consumedMs,50);
});
test('关闭一个菜单不解除其他暂停；UI恢复不解除hidden/context-lost/chat-changed',()=>{
  const b=setup(false);b.receive(wire(2,'request_pause',{reason:'menu',state:'on'}));b.receive(wire(3,'request_pause',{reason:'target',state:'on'}));
  b.receive(wire(4,'request_pause',{reason:'menu',state:'off'}));assert.equal(b.advanceRules(50).consumedMs,0);
  for(const reason of ['hidden','context-lost','chat-changed'] as const)b.setHostBlocked(reason,true);
  b.receive(wire(5,'request_pause',{reason:'target',state:'off'}));assert.equal(b.advanceRules(50).consumedMs,0);
  for(const reason of ['hidden','context-lost','chat-changed'] as const)b.setHostBlocked(reason,false);
  assert.equal(b.advanceRules(50).consumedMs,50);
});
test('Wait ATB就绪菜单不推进时间，目标选择快照不扣资源',()=>{
  const b=setup();assert.equal(b.view().phase,'menu');for(let i=0;i<100;i++)b.snapshot();
  assert.equal(b.advanceRules(250).consumedMs,0);assert.equal(b.view().actors[0]!.current.sp,100);
});
test('掉帧/后台时间不能传入桥；恢复后只走一个显式规则步',()=>{
  const b=setup(false);for(const dt of [-1,NaN,Infinity,251,60000])assert.throws(()=>b.advanceRules(dt));
  b.setHostBlocked('hidden',true);for(let i=0;i<20;i++)b.advanceRules(50);b.setHostBlocked('hidden',false);
  assert.equal(b.advanceRules(50).consumedMs,50);assert.equal(b.view().timeMs,50);
});
test('输入快照频率不影响相同TS规则步的确定性',()=>{
  const a=setup(false),b=setup(false);for(let i=0;i<80;i++){a.advanceRules(50);b.advanceRules(50);for(let j=0;j<7;j++)b.snapshot();}
  assert.deepEqual(a.exportBattle(),b.exportBattle());
});
test('重复ready不重置暂停/序号；close后所有输入失效且不推进',()=>{
  const b=setup(false);b.setHostBlocked('hidden',true);assert.equal(accepted(b.receive(wire(2))),false);
  assert.equal(b.advanceRules(50).consumedMs,0);b.close();assert.deepEqual(b.receive(wire(3)),[]);assert.equal(b.advanceRules(50).consumedMs,0);
});
test('既有内核暂停不被UI恢复覆盖',()=>{
  const state=battle(false);state.clock.paused=true;const b=new BattleBridge(state,'test-session');b.receive(wire(1));
  b.receive(wire(2,'request_pause',{reason:'user',state:'off'}));assert.equal(b.advanceRules(50).consumedMs,0);assert.ok(b.view().blockers.includes('core-paused'));
});
test('同页桥独占挂载，只暴露JSON输入/输出；卸载后旧回调不可执行',()=>{
  const b=new BattleBridge(battle(),'test-session'),target:{BookseaBridge?:unknown}={};const mount=mountSamePageBridge(target,b);
  assert.throws(()=>mountSamePageBridge(target,setup()));
  const api=target.BookseaBridge as {attachRenderer:(fn:(s:string)=>void)=>void;send:(s:string)=>void};
  const messages:PresentationMessage[]=[];api.attachRenderer(s=>messages.push(PresentationMessage.parse(JSON.parse(s))));assert.throws(()=>api.attachRenderer(()=>{}));
  api.send(wire(1));api.send(wire(2,'choose_action',action));assert.equal(b.view().actors[0]!.current.sp,90);
  assert.ok(messages.every((m,i)=>i===0||m.sequence>messages[i-1]!.sequence));
  mount.dispose();mount.dispose();assert.equal(target.BookseaBridge,undefined);api.send(wire(3));assert.equal(b.advanceRules(50).consumedMs,0);
});
test('呈现回调异常暂停权威，不能悄悄继续战斗',()=>{
  const b=new BattleBridge(battle(false),'test-session'),target:{BookseaBridge?:unknown}={};mountSamePageBridge(target,b);
  const api=target.BookseaBridge as {attachRenderer:(fn:()=>void)=>void;send:(s:string)=>void};api.attachRenderer(()=>{throw Error('gone')});
  assert.throws(()=>api.send(wire(1)));assert.ok(b.view().blockers.includes('transport'));assert.equal(b.advanceRules(50).consumedMs,0);
});
test('生命周期监听：隐藏停止，恢复无追帧，WebGL恢复不自动解锁，解绑保持暂停',()=>{
  const b=setup(false);const doc=Object.assign(new EventTarget(),{hidden:false});const canvas=new EventTarget();
  const cleanup=bindBridgeLifecycle(b,()=>{},doc as unknown as Document,canvas as unknown as HTMLCanvasElement);
  doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));assert.equal(b.advanceRules(50).consumedMs,0);
  doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));assert.equal(b.advanceRules(50).consumedMs,50);
  canvas.dispatchEvent(new Event('webglcontextlost',{cancelable:true}));canvas.dispatchEvent(new Event('webglcontextrestored'));
  assert.equal(b.advanceRules(50).consumedMs,0);cleanup();assert.ok(b.view().blockers.includes('transport'));
});
