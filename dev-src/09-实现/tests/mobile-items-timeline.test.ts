import test from 'node:test';
import assert from 'node:assert/strict';
import {joystickDirection} from '../src/ui/mobile-controls';
import {isBattleConsumable} from '../src/core/battle-items';
import {compileBattleItem} from '../src/compiler/items';
import {combatProjection} from '../src/core/cache';
import {createCompilationEngine,validateCompiled} from '../src/compiler/engine';
import {HOST_RULES} from '../src/compiler/rules';
import {assertExecutable} from '../src/battle/executor';
import {createMessageTimeline} from '../src/host/message-timeline';
import {resumeHostExpedition} from '../src/host/resume';
import {startExpedition} from '../src/game/expedition';
import {playtestParty} from '../src/game/content';
import {actor} from './fixtures';

for(const [x,y,expected]of [[0,0,[0,0]],[5,3,[0,0]],[80,5,[1,0]],[-80,2,[-1,0]],[5,80,[0,1]],[5,-80,[0,-1]]] as const)test('摇杆死区/四向 '+x+','+y,()=>{
 const actual=joystickDirection(x,y,50);assert.deepEqual([actual.dx,actual.dz],expected);
});
const item=(效果:unknown,extra:Record<string,unknown>={})=>({类型:'消耗品',品质:'普通',数量:3,效果,...extra});
for(const raw of [item('无'),item('仅供剧情中阅读'),item('仅用于打造武器',{标签:['制作素材']}),item('打开后随机获得消耗品',{标签:['未开启','盲盒']}),item('使用后获得10FP',{标签:['兑换券']}),item('永久增加生命值上限10点'),item('获得100经验值'),item('仅可在战斗外恢复50点生命'),item('展示角色的过往故事'),item('回复一封信件，联络联系人'),item('恢复过往记忆'),item('没有战斗效果，只是仿制的HP药瓶'),item('无任何战斗效力，不产生伤害或护盾'),{类型:'材料',效果:'恢复20点生命'}])test('非战斗物品不进入编译 '+JSON.stringify(raw),()=>assert.equal(isBattleConsumable(raw),false));
for(const [label,resource]of [['生命值','hp'],['法力值','mp'],['体力','sp']] as const)for(const n of [10,25,50,100])for(const percent of [false,true])test(`物品本地编译 ${label} ${n}${percent?'%':''}`,()=>{
 const raw=item(`恢复${n}${percent?'%':'点'}${label}`),a=compileBattleItem('/道具定义/药剂','药剂',raw)!;assert.ok(a);assertExecutable(a);
 const e=a.effects[0]!;assert.equal(e.op,'heal');if(e.op==='heal'){assert.equal(e.resource,resource);assert.equal(e.amount.subject,'target');assert.equal(e.amount.flat,percent?0:n);assert.equal(e.amount.maxFraction,percent?n/100:0);}
 assert.equal(a.cost.mp.flat,0);assert.equal(a.cost.sp.flat,0);assert.equal(a.copyable,false);
});
for(const channel of ['物理','能量','精神','真实','火焰','冰霜','雷电'])for(const n of [20,75])test(`投掷物本地编译 ${channel} ${n}`,()=>{
 const a=compileBattleItem('/道具定义/投掷物','投掷物',item(`对敌人造成${n}点${channel}伤害`))!;assert.ok(a);assertExecutable(a);assert.equal(a.target,'enemy');assert.equal(a.effects[0]!.op,'damage');
});
for(const [effect,op]of [['复活同伴并恢复30%生命值','revive'],['为全体同伴恢复50点生命值','heal'],['获得80点护盾，持续3回合','shield'],['解除所有负面状态','dispel'],['解除中毒','dispel'],['力量提升20%，持续3回合','modify'],['行动速度提高30%，持续2回合','modify'],['物理防御降低25%，持续2回合','modify'],['立即退出当前远征','retreat']] as const)test('物品执行族 '+effect,()=>{
 const a=compileBattleItem('/道具定义/物品','物品',item(effect))!;assert.ok(a);assertExecutable(a);assert.equal(a.effects[0]!.op,op);
 if(op==='revive')assert.equal(a.targeting?.life,'downed');if(effect.includes('全体'))assert.equal(a.targeting?.selection,'all');
});
test('条件和复杂组合交给完整编译器，不偷偷丢失条款',()=>{
 assert.equal(compileBattleItem('/道具定义/a','a',item('如果生命低于30%则恢复100点生命值')),undefined);
 assert.equal(compileBattleItem('/道具定义/a','a',item('恢复100点生命值并免疫中毒3回合')),undefined);
 assert.equal(compileBattleItem('/道具定义/a','a',item('对敌人造成20点火焰伤害并恢复自身30点生命')),undefined);
});
test('无战斗效力道具既不发给模型，也不获得通用替代攻击',async()=>{
 const a=actor();a.种族='人类';a.技能={};a.装备={};a.状态效果={};a.登神长阶={};a.背包={信件:item('仅供阅读，寄托思念'),钥匙:item('打开旧屋的门'),蓝药:item('恢复25点法力值')};
 const source=combatProjection(a);assert.deepEqual(Object.keys(source.道具定义 as object),['蓝药']);
 let calls=0;const rules={...HOST_RULES,numericOnlySpecies:{...HOST_RULES.numericOnlySpecies,人类:'仅测试纯数值'}};
 const engine=createCompilationEngine(async()=>{calls++;throw Error('No model expected');},rules),compiled=validateCompiled((await engine.compile(source,undefined,['/'])).actor);
 assert.equal(calls,0);assert.equal(compiled.skills.length,1);assert.equal(compiled.skills[0]!.name,'蓝药');assert.equal(compiled.skills[0]!.mapping.action?.effects[0]?.op,'heal');
});

function harness(legacy:Record<string,unknown>={}){
 let chat:any={unrelated:{preserved:true},booksea:{settings:{narrative:false},actorCache:{unchanged:{value:1}},...legacy}},chatId='chat';
 const messages:any[]=[{role:'assistant',message:'earlier',data:{gold:10},extra:{unrelated:'kept'}},{role:'assistant',message:'current',data:{gold:10},extra:{unrelated:'kept'}}];
 let variableReads=0,messageReads=0,writes=0;
 const h:any={getLastMessageId:()=>messages.length-1,getChatMessages:(id:any)=>{messageReads++;if(typeof id==='number'){const index=id===-1?messages.length-1:id;return messages[index]?[{...structuredClone(messages[index]),message_id:index}]:[];}return messages.map((m,i)=>({...structuredClone(m),message_id:i}));},getVariables:(o:any)=>{variableReads++;return structuredClone(o.type==='chat'?chat:messages[o.message_id??messages.length-1]?.data??{});},updateVariablesWith:async(fn:any,o:any)=>{if(o.type==='chat')chat=fn(structuredClone(chat));else{const id=o.message_id??messages.length-1;messages[id].data=fn(structuredClone(messages[id].data));}writes++;},createChatMessages:async(rows:any[])=>{for(const row of rows)messages.push({...row,data:structuredClone(row.data??messages.at(-1).data),extra:structuredClone(row.extra??{})});}};
 const globals:any={TavernHelper:h,SillyTavern:{getContext:()=>({characterId:'test',getCurrentChatId:()=>chatId,chat:messages,saveChat:async()=>{}})}};
 const timeline=createMessageTimeline(globals);
 const run=()=>{const s=startExpedition(playtestParty(),741);s.source='host';s.hostContext='test:chat';s.hostSave=timeline.stamp();return s;};
 const save=async(s:ReturnType<typeof run>,gold=10)=>{s.hostSave=await timeline.commit({gold,bookseaSessionReceipts:{[s.run.id]:{items:{},settled:false}}},v=>({...v,booksea:{...(v.booksea as any),activeExpedition:s,unlockedIds:s.run.unlocks}}),s.hostSave);};
 return {timeline,messages,h,globals,run,save,get chat(){return chat;},get reads(){return {variableReads,messageReads};},get writes(){return writes;},switchChat(){chatId='other';}};
}
test('聊天回退恢复原层数、解锁、资源；未来同run本地缓存不能覆盖',async()=>{
 const h=harness(),t=h.timeline;await t.prepare();const s=h.run();await h.save(s,10);const before=structuredClone(h.messages[1]);
 await h.h.createChatMessages([{role:'assistant',message:'later'}]);await t.prepare();s.hostSave=t.stamp();s.depth=40;s.steps=400;s.run.unlocks.push('anchor-40');await h.save(s,90);const future=JSON.stringify(s);
 h.messages.pop();assert.equal(t.valid(s.hostSave),false);await t.prepare();const restored=(t.chat().booksea as any).activeExpedition;
 assert.equal(restored.depth,1);assert.deepEqual((t.chat().booksea as any).unlockedIds,['depth-1']);assert.equal(t.readVars().gold,10);
 assert.equal(resumeHostExpedition(restored,()=>future,'test:chat',t.authorizedFrames()).depth,1);
 assert.deepEqual(h.messages[1],before);assert.deepEqual(h.chat.unrelated,{preserved:true});assert.deepEqual(h.chat.booksea.actorCache,{unchanged:{value:1}});
});
test('正常续档接受当前/继承楼层的较新本地位置',async()=>{
 const h=harness(),t=h.timeline;await t.prepare();const s=h.run();await h.save(s);s.steps+=12;
 let saved=(t.chat().booksea as any).activeExpedition;assert.equal(resumeHostExpedition(saved,()=>JSON.stringify(s),'test:chat',t.authorizedFrames()).steps,s.steps);
 await h.h.createChatMessages([{role:'assistant',message:'next'}]);await t.prepare();saved=(t.chat().booksea as any).activeExpedition;
 assert.equal(resumeHostExpedition(saved,()=>JSON.stringify(s),'test:chat',t.authorizedFrames()).steps,s.steps);
});
test('删到首次绑定以前不回填旧全局的几十层起点',async()=>{
 const h=harness({unlockedIds:['depth-1','anchor-40']});await h.timeline.prepare();assert.ok((h.timeline.chat().booksea as any).unlockedIds.includes('anchor-40'));
 assert.equal(h.messages[0].extra.bookseaCheckpointV1,undefined);h.messages.pop();await h.timeline.prepare();assert.deepEqual((h.timeline.chat().booksea as any).unlockedIds,['depth-1']);
});
test('删除后新增同编号楼层也不能复活旧缓存',async()=>{
 const h=harness(),t=h.timeline;await t.prepare();const s=h.run();await h.save(s);const future=JSON.stringify(s),oldFrame=s.hostSave!.frame;
 h.messages.pop();await h.h.createChatMessages([{role:'assistant',message:'replacement'}]);assert.equal(t.valid(s.hostSave),false);await t.prepare();assert.notEqual(t.stamp().frame,oldFrame);assert.equal((t.chat().booksea as any).activeExpedition,null);assert.ok(!t.authorizedFrames().includes(oldFrame));assert.ok(future);
});
test('排队中的旧写入在删楼后拒绝，不能重写当前MVU',async()=>{
 const h=harness(),t=h.timeline;await t.prepare();const s=h.run();await h.save(s);const oldStamp={...s.hostSave!};
 h.messages.pop();const before=structuredClone(h.messages[0].data),writes=h.writes;
 await assert.rejects(()=>t.commit({gold:999},v=>v,oldStamp),/楼层/);assert.deepEqual(h.messages[0].data,before);assert.equal(h.writes,writes);
});
test('轻量引用随普通消息继承，大存档不会被复制到每条MVU',async()=>{
 const h=harness(),t=h.timeline;await t.prepare();const s=h.run();await h.save(s);await h.h.createChatMessages([{role:'assistant',message:'next'}]);await t.prepare();
 assert.ok(JSON.stringify(h.messages.at(-1).data.bookseaProgressRef).length<180);assert.equal(h.messages.at(-1).extra.bookseaCheckpointV1,undefined);assert.ok(JSON.stringify(h.messages[1].extra.bookseaCheckpointV1).length>1000);
});
test('MVU未继承自定义引用时，以有效楼层索引恢复，不扫历史正文',async()=>{
 const h=harness(),t=h.timeline;await t.prepare();const s=h.run();s.run.unlocks.push('anchor-5');await h.save(s);await h.h.createChatMessages([{role:'assistant',message:'next',data:{gold:10}}]);await t.prepare();
 assert.ok((t.chat().booksea as any).unlockedIds.includes('anchor-5'));assert.ok(t.readVars().bookseaSessionReceipts);
});
test('逐帧守卫不读取变量、不扫描历史、不保存聊天',async()=>{
 const h=harness();await h.timeline.prepare();const stamp=h.timeline.stamp(),before={...h.reads},writes=h.writes;
 for(let i=0;i<1000;i++)assert.equal(h.timeline.valid(stamp),true);
 assert.deepEqual(h.reads,before);assert.equal(h.writes,writes);
});
test('聊天切换后拒绝访问或写入旧绑定',async()=>{
 const h=harness();await h.timeline.prepare();const stamp=h.timeline.stamp();h.switchChat();assert.equal(h.timeline.valid(stamp),false);await assert.rejects(()=>h.timeline.commit({gold:900},v=>v,stamp),/聊天/);
});
