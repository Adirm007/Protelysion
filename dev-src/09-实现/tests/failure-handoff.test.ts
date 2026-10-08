import test from 'node:test';import assert from 'node:assert/strict';
import {actorAt,actorKey,RESOURCES,resourceMax,type Obj} from '../src/core/actors';
import {failureNotice} from '../src/core/failure';
import {EXIT_REQUEST,type HandoffMessage} from '../src/core/handoff-message';
import {handoffFailure,type HandoffPort,type FailureRequest} from '../src/host/failure-handoff';
import {newRun,exitMembers} from '../src/core/run';
import {fixture,player,partner} from './fixtures';
const facts={depth:3,encounter:'测试敌群',consumed:[{owner:partner(),name:'已消耗药剂',count:1}]};
function request(id="test-run"):FailureRequest {
 let run=newRun(id,fixture(),[partner(),partner('测试伙伴乙')]);run.unlocks=['anchor:3'];
 run=exitMembers(run,run.participants.map(p=>({ref:p.ref,reason:'downedExit' as const})));
 return {run,facts,ownedStateNames:{},localModifiersRemoved:true};
}
function fake(){
 let chat:Obj={untouched:1,booksea:{actorCache:{keep:true},unlockedIds:['anchor:1']}},mvu=fixture(),ctx='one',messages:HandoffMessage[]=[],writes=0,sends=0,tail=Promise.resolve();
 const port:HandoffPort={contextId:()=>ctx,latestMessageId:()=>0,readChat:()=>structuredClone(chat),
  async updateChat(fn){chat=fn(structuredClone(chat));},readMvu:()=>structuredClone(mvu),async writeMvu(_i,v){mvu=structuredClone(v);writes++;},
  userMessages:()=>[...messages],async sendUser(s,extra){messages.push({role:'user',message:s,extra:structuredClone(extra)});sends++;},
  async lock(_key,fn){const before=tail;let done!:()=>void;tail=new Promise<void>(r=>done=r);await before;try{return await fn()}finally{done()}}
 };
 return {port,stats:()=>({chat,mvu,messages,writes,sends}),setContext:(s:string)=>ctx=s,clearMessages:()=>messages=[],mutate:(fn:(m:Obj)=>void)=>fn(mvu)};
}
test('全伙伴失败摘要仅携带局内零生命事实，不伪造主角死亡且不包含经验数字',()=>{
 const n=failureNotice(request().run,facts);assert.equal(n.message,EXIT_REQUEST);assert.match(n.directive,/主角未参战/);assert.match(n.directive,/宿主离场数值已按约定补满/);assert.doesNotMatch(n.directive,/不自行发放|不要代玩|经验\s*[:：=]\s*\d/);
});
test('分批倒地：此前倒地并已恢复者不属于最终失败批次',()=>{
 let r=newRun('batch',fixture(),[player,partner()]);r=exitMembers(r,[{ref:player,reason:'downedExit'}]);r=exitMembers(r,[{ref:partner(),reason:'downedExit'}]);
 const n=failureNotice(r,facts);assert.deepEqual(n.finalDowned,[partner()]);assert.deepEqual(n.previouslyDowned,[player]);assert.deepEqual(n.safelyExited,[player]);
});
test('旧失败信号没有最终批次不得猜测',()=>{const r=request().run;delete (r.failureSignal as unknown as Obj).finalDowned;assert.throws(()=>failureNotice(r,facts),/旧存档/);});
test('未失败、未清零、伪造名单与危险runId均被拒绝',()=>{
 const base=request();for(const mutate of [(r:typeof base.run)=>{r.status='active'},(r:typeof base.run)=>{r.participants[0]!.experience=1},(r:typeof base.run)=>{r.id='<%oops'},(r:typeof base.run)=>{r.failureSignal!.finalDowned=[player]}]){const r=structuredClone(base.run);mutate(r);assert.throws(()=>failureNotice(r,facts));}
});
test('姓名或遭遇中的EJS/HTML符号不会进入可执行模板',()=>{const n=failureNotice(request().run,{...facts,encounter:'<% throw Error("bad") %>'});assert.ok(!n.directive.includes('<%'));assert.equal(n.message,EXIT_REQUEST);});
test('真实写回范围：最终成员三资源全满，未参战主角/经验/物品/时间/FP不变',async()=>{
 const f=fake(),before=structuredClone(f.stats().mvu);const result=await handoffFailure(f.port,request());assert.equal(result.phase,'delivered');
 assert.deepEqual(actorAt(f.stats().mvu,player),actorAt(before,player));assert.deepEqual(f.stats().mvu.date,before.date);
 for(const ref of [partner(),partner('测试伙伴乙')]){const a=actorAt(f.stats().mvu,ref);for(const r of RESOURCES)assert.equal((a[r] as Obj).当前,resourceMax(a,r));assert.deepEqual(a.背包,actorAt(before,ref).背包);assert.equal(a.累计经验值,actorAt(before,ref).累计经验值);}
 assert.deepEqual((f.stats().mvu.stat_data as Obj).世界,(before.stat_data as Obj).世界);assert.equal((f.stats().mvu.stat_data as Obj).命运点数,100);
 const b=f.stats().chat.booksea as Obj;assert.deepEqual(b.actorCache,{keep:true});assert.deepEqual(b.unlockedIds,['anchor:1','anchor:3']);assert.equal(b.activeRun,null);
});
test('提前离场成员不二次补满或重复清伤',async()=>{
 const q=request();let r=newRun('earlier',fixture(),[player,partner()]);r=exitMembers(r,[{ref:player,reason:'voluntaryExit'}]);r=exitMembers(r,[{ref:partner(),reason:'downedExit'}]);q.run=r;
 const f=fake(),before=structuredClone(actorAt(f.stats().mvu,player));await handoffFailure(f.port,q);assert.deepEqual(actorAt(f.stats().mvu,player),before);
});
test('只清本趟登记且来源为书海的状态，旧伤保留',async()=>{
 const f=fake(),q=request();f.mutate(m=>{(actorAt(m,partner()).状态效果 as Obj).书海伤势={来源:'书海'};});q.ownedStateNames[actorKey(partner())]=['书海伤势','原有伤势'];await handoffFailure(f.port,q);
 const states=actorAt(f.stats().mvu,partner()).状态效果 as Obj;assert.ok(states.原有伤势);assert.equal(states.书海伤势,undefined);
});
test('同趟并发结束与刷新重试：只写一次、只发一次',async()=>{
 const f=fake();await Promise.all([handoffFailure(f.port,request()),handoffFailure(f.port,request())]);await handoffFailure(f.port,request());assert.equal(f.stats().writes,1);assert.equal(f.stats().sends,1);
});
test('写入已成功但回包丢失：回执防止重试再次回血',async()=>{
 const f=fake(),write=f.port.writeMvu;let first=true;f.port.writeMvu=async(i,v)=>{await write(i,v);if(first){first=false;throw Error('lost ack')}};
 await assert.rejects(handoffFailure(f.port,request()));f.mutate(m=>{(actorAt(m,partner()).生命值 as Obj).当前=9});await handoffFailure(f.port,request());
 assert.equal(f.stats().writes,1);assert.equal((actorAt(f.stats().mvu,partner()).生命值 as Obj).当前,9);assert.equal(f.stats().sends,1);
});
test('消息已送达但确认失败：查询隐藏元数据恢复，不重复发送',async()=>{
 const f=fake(),send=f.port.sendUser;let first=true;f.port.sendUser=async(s,extra)=>{await send(s,extra);if(first){first=false;throw Error('lost ack')}};
 await assert.rejects(handoffFailure(f.port,request()));await handoffFailure(f.port,request());assert.equal(f.stats().sends,1);
});
test('已完成摘要被用户删除后不擅自重发',async()=>{const f=fake();await handoffFailure(f.port,request());f.clearMessages();await handoffFailure(f.port,request());assert.equal(f.stats().sends,1);});
test('相同runId改变事实不得重结算',async()=>{const f=fake();await handoffFailure(f.port,request());const q=request();q.facts.depth=4;await assert.rejects(handoffFailure(f.port,q),/不同事实/);});
test('聊天切换在写入前阻断，缺失角色不造默认值',async()=>{
 const f=fake(),lock=f.port.lock;f.port.lock=async(k,fn)=>{f.setContext('two');return lock(k,fn)};await assert.rejects(handoffFailure(f.port,request()),/聊天已切换/);assert.equal(f.stats().writes,0);
 const g=fake();g.mutate(m=>{delete ((m.stat_data as Obj).关系列表 as Obj).测试伙伴甲});await assert.rejects(handoffFailure(g.port,request()));assert.equal(g.stats().writes,0);
});

test('相同出口短句按runId隔离，每一趟各发一次，摘要不混入用户文本',async()=>{
 const f=fake();await handoffFailure(f.port,request());const second=request('another-run');await handoffFailure(f.port,second);await handoffFailure(f.port,second);
 assert.equal(f.stats().sends,2);assert.deepEqual(f.stats().messages.map(m=>m.message),[EXIT_REQUEST,EXIT_REQUEST]);
 assert.deepEqual(f.stats().messages.map(m=>(m.extra!.bookseaHandoff as Obj).runId),['test-run','another-run']);
 for(const m of f.stats().messages){const extra=m.extra!.bookseaHandoff as Obj;assert.equal(extra.contextId,'one');assert.match(String(extra.summary),/最终在局内倒下/);}
});
