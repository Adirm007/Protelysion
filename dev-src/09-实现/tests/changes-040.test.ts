import test from 'node:test';
import assert from 'node:assert/strict';
import {supplierSpawns} from '../src/game/supplier';
import {makeRegion} from '../src/game/region';
import {playtestParty} from '../src/game/content';
import {startExpedition,interact,supplierChoice,closeSupplier,view,restoreExpedition,eventChoice,supplierTalkSend,supplierTalkReply,supplierTalkFailed,supplierTalkBack,supplierTalkContext,
 startNarrative,narrativeDescend,exitNarrative,leaveFromNarrative,narrativeFloor,narrativeBreakpoint,canStartNarrative,type State} from '../src/game/expedition';
import {adjustFp,pendingFp,POTION_BY_ID} from '../src/game/run-hooks';
import {RELIC_CATALOG} from '../src/game/relic-catalog';
import {materializeDeal,parseSupplierReply,priceFloor,buildSupplierPrompt,SUPPLIER_AGENT,TALK_LIMITS,capTierFor,hardTierFor} from '../src/game/supplier-agent';
import {mountExpeditionRuntime} from '../src/game/runtime';
import {independentApi,withIndependentApi} from '../src/host/game-session';
import {hostReward,settleRunRewards,rewardLabel} from '../src/core/settlement';
import {NARRATIVE_REQUEST,NARRATIVE_DESCEND,narrativeExtra,narrativePromptData} from '../src/core/handoff-message';
import {narrativeChat} from '../src/host/narrative-mode';

function supplierSeed(){for(let n=1;n<10000;n++)if(supplierSpawns(1,0,n))return n;throw Error('No supplier seed');}
function talking(fp=5000):State{
 const s=startExpedition(playtestParty(),supplierSeed()),t=s.region.things.find(t=>t.kind==='supplier')!;
 s.x=t.x;s.z=t.z;s.supplierTalkReady=true;adjustFp(s,fp,'测试');interact(s);supplierChoice(s,'talk');return s;
}
const say=(text:string)=>(s:State)=>supplierTalkSend(s,text)!;
const reply=(deal:unknown,line='嗯。')=>JSON.stringify({say:line,mood:'放空',deal});

test('0.40 独立API：v2 按调用类型路由，tavern 走酒馆插头，没有 v2 时沿用 v1', () => {
 const store=new Map<string,string>(),g={localStorage:{getItem:(k:string)=>store.get(k)??null}};
 const a={id:'pa',name:'A',apiurl:'https://a.example/v1',key:'ka',model:'ma',source:'openai'},b={id:'pb',name:'B',apiurl:'https://b.example/v1',key:'',model:'mb',source:'deepseek'};
 store.set('dream_independent_api_v1',JSON.stringify({apiurl:'https://old.example/v1',key:'k',model:'old',enabled:true}));
 assert.equal(independentApi(g,'booksea_supplier')?.model,'old');
 store.set('dream_independent_api_v2',JSON.stringify({version:2,presets:[a,b],defaultId:'pa',routes:{booksea_compile:'default',booksea_supplier:'pb'}}));
 assert.deepEqual(independentApi(g,'booksea_compile'),{apiurl:'https://a.example/v1',key:'ka',model:'ma',source:'openai'});
 assert.deepEqual(independentApi(g,'booksea_supplier'),{apiurl:'https://b.example/v1',key:'',model:'mb',source:'deepseek'});
 store.set('dream_independent_api_v2',JSON.stringify({version:2,presets:[a,b],defaultId:'',routes:{booksea_compile:'default',booksea_supplier:'tavern'}}));
 assert.equal(independentApi(g,'booksea_compile'),undefined);assert.equal(independentApi(g,'booksea_supplier'),undefined);
 const base={max_tokens:1};assert.equal(withIndependentApi(g,base),base);
 store.set('dream_independent_api_v2',JSON.stringify({version:2,presets:[a],defaultId:'pa',routes:{}}));
 assert.equal((withIndependentApi({parent:g},base,'booksea_supplier').custom_api as {model:string}).model,'ma');
});

test('0.40 补给员对话：只有宿主可用 LLM 时出现“对话”，其他选项保持原样', () => {
 const s=startExpedition(playtestParty(),supplierSeed()),t=s.region.things.find(t=>t.kind==='supplier')!;s.x=t.x;s.z=t.z;interact(s);
 assert.deepEqual(view(s).supplier?.choices.map(c=>c.id),['event','bench','shop','kill']);
 supplierChoice(s,'talk');assert.equal(s.supplierState?.talk,undefined);assert.match(s.notice,/联系不上/);
 s.supplierTalkReady=true;assert.deepEqual(view(s).supplier?.choices.map(c=>c.id),['talk','event','bench','shop','kill']);
 supplierChoice(s,'talk');const v=view(s);assert.equal(v.supplier?.talk?.pending,false);assert.equal(v.supplier?.choices.length,0);assert.equal(v.supplier?.question,'嗯？想聊什么。');
 supplierTalkBack(s);assert.equal(view(s).supplier?.choices.length,5);assert.equal(t.used,false);
});

test('0.40 补给员对话：提示词含人设、局内信息、上限与价格下限；回复解析容错', () => {
 const s=talking(),req=say('给我一件遗物吧')(s);
 assert.equal(s.supplierTalks![req.thingId]!.pending,true);assert.equal(supplierTalkSend(s,'再说一句'),undefined,'等待中不能连发');
 assert.ok(req.prompt.system.startsWith(SUPPLIER_AGENT.slice(0,20)));
 for(const k of ['【局内信息】','【作者建议的强度参考】','【作者建议的价格参考】','不是硬规则','心情才是第一准则','【本次遭遇剩余额度】','第 1 层','"deal":null'])assert.ok(req.prompt.system.includes(k),k);
 assert.equal(req.prompt.messages.at(-1)!.role,'user');assert.equal(req.prompt.messages.at(-1)!.content,'给我一件遗物吧');
 assert.deepEqual(parseSupplierReply('```json\n{"say":"好","mood":"困","deal":null}\n```'),{say:'好',mood:'困',deal:null});
 assert.equal(parseSupplierReply('今天的我是素食主义').say,'今天的我是素食主义');
 const ctx=supplierTalkContext(s);assert.equal(ctx.capTier,capTierFor(ctx.floorQuality));assert.equal(ctx.fp,5000);
 assert.ok(buildSupplierPrompt(ctx,[]).messages.length===1);
});

test('0.41 补给员对话：遗物只按绝对上限（建议+2档）压回、她开多少价收多少、自动交给有空槽的成员', () => {
 const s=talking(),req=say('给我最强的遗物')(s),before=pendingFp(s.run,s.fpDebt);
 supplierTalkReply(s,req.thingId,req.serial,reply({type:'relic',price:10,quality:'神话',name:'无敌之剑无敌之剑无敌之剑',effects:[{kind:'damage',value:5},{kind:'speed',value:3},{kind:'defense',value:1}]}));
 const relic=Object.values(s.customRelics??{})[0]!;assert.ok(relic);
 assert.equal(relic.name.length<=12,true);assert.equal(hardTierFor(1),3);assert.equal(relic.rarity,2,'神话被压回绝对上限史诗');
 const mods=relic.passive!.effects.flatMap(e=>e.op==='modify'?e.modifiers:[]);
 assert.ok(mods.filter(m=>m.stat==='damage_physical').every(m=>m.multiplier!<=1.2),'史诗上限各按 70%');
 assert.ok(mods.filter(m=>m.stat==='speed').every(m=>m.multiplier!<=1.2));
 assert.equal(mods.some(m=>m.stat.startsWith('reduction_')),false,'最多两条效果');
 assert.equal(before-pendingFp(s.run,s.fpDebt),10,'价格低于建议也照她说的收');
 assert.ok(s.ownedRelics!.some(o=>o.id===relic.id));assert.equal(RELIC_CATALOG[relic.id],relic);
 const again=say('再来一件')(s);supplierTalkReply(s,again.thingId,again.serial,reply({type:'relic',price:9999,name:'第二件',effects:[{kind:'heal',value:1.1}]}));
 assert.equal(Object.keys(s.customRelics!).length,1);assert.match(s.supplierTalks![again.thingId]!.log.at(-1)!.text,/额度已经用完/);
 const restored=restoreExpedition(JSON.parse(JSON.stringify(s)));delete RELIC_CATALOG[relic.id];
 const back=restoreExpedition(JSON.parse(JSON.stringify(restored)));assert.ok(RELIC_CATALOG[relic.id],'载入时重新注册');assert.ok(back.ownedRelics!.some(o=>o.id===relic.id));
});

test('0.41 补给员对话：道具最多 2 件、价格随她、数值只按绝对上限压回、进入战斗药剂表', () => {
 const s=talking(),req=say('卖我几瓶药')(s),before=pendingFp(s.run,s.fpDebt);
 supplierTalkReply(s,req.thingId,req.serial,reply({type:'item',price:1,name:'蓝色的水',count:5,effect:{kind:'heal',resource:'mp',value:.95}}));
 const [id,spec]=Object.entries(s.customItems??{})[0]!;assert.equal(spec.kind,'heal');assert.equal(spec.resource,'mp');assert.ok(spec.value<.95,'被压回绝对上限');
 assert.equal(s.bag![id],2);assert.ok(POTION_BY_ID[id]);const action=POTION_BY_ID[id]!.build(1);assert.equal(action.category,'item');assert.equal(action.effects[0]!.op,'heal');
 assert.equal(before-pendingFp(s.run,s.fpDebt),1);assert.ok(priceFloor('item',0,1,spec,2)>1,'建议价仍在提示词里');
 const more=say('再来一瓶')(s);supplierTalkReply(s,more.thingId,more.serial,reply({type:'item',price:500,name:'红',count:1,effect:{kind:'cleanse'}}));
 assert.equal(Object.keys(s.customItems!).length,1,'道具额度 2 已用完');
 assert.ok(view(s).supplier?.talk?.remaining.item===0);
});

test('0.40 补给员对话：临时事件放在身边、互动后打开；结果被压回上限', () => {
 const s=talking(),req=say('来点刺激的')(s);
 supplierTalkReply(s,req.thingId,req.serial,reply({type:'event',price:0,title:'抽签',body:'她拿出一个签筒。',choices:[{label:'抽一支',cost:{kind:'hp',fraction:.9},result:{kind:'fp',amount:99999}},{label:'摇一摇',result:{kind:'box',amount:5,quality:'神话'}}]}));
 const thing=s.region.things.find(t=>t.customEvent)!;assert.ok(thing);assert.equal(thing.kind,'event');
 const def=thing.customEvent!;assert.equal(def.choices.at(-1)!.id,'leave');
 assert.equal(def.choices[0]!.costs[0]!.fraction,.4);assert.deepEqual(def.choices[0]!.results[0],{kind:'fp',mode:'add',amount:600});
 assert.deepEqual(def.choices[1]!.results[0],{kind:'box',count:2,quality:'史诗'});
 closeSupplier(s);s.x=thing.x;s.z=thing.z;s.region.things=s.region.things.filter(t=>t===thing||t.kind!=='supplier'||t.used);
 interact(s);assert.equal(s.mode,'event');assert.equal(view(s).event?.title,'抽签');
 const leave=view(s).event!.choices.findIndex(c=>c.id==='leave');eventChoice(s,leave);assert.equal(s.mode,'explore');assert.equal(thing.used,true);
});

test('0.40 补给员对话：可带出战利品写进主角背包；FP 不够、过期回复、离开后都不成交', () => {
 const s=talking(),req=say('给我个技能书带出去')(s);
 supplierTalkReply(s,req.thingId,req.serial,reply({type:'loot',price:1,quality:'神话',name:'技能书·星屑',itemType:'技能书',effect:'习得「星屑」',description:'封面闪闪发光'}));
 const gift=s.run.rewards.find(r=>r.kind==='gift')!;assert.ok(gift&&gift.kind==='gift');assert.equal(gift.quality,'史诗');
 assert.equal(rewardLabel(gift),'史诗·技能书·星屑');
 const h=hostReward(gift);assert.equal(h.item.类型,'技能书');assert.deepEqual((h.item.效果 as Record<string,string>).说明,'习得「星屑」');
 const mvu={stat_data:{命运点数:0,主角:{背包:{}}}};const settled=settleRunRewards(mvu as never,[gift]) as never as {stat_data:{主角:{背包:Record<string,{类型:string}>}}};
 assert.equal(settled.stat_data.主角.背包['技能书·星屑']!.类型,'技能书');
 const poor=talking(100),p=say('来个遗物')(poor);supplierTalkReply(poor,p.thingId,p.serial,reply({type:'relic',price:500,effects:[{kind:'crit',value:.01}]}));
 assert.equal(Object.keys(poor.customRelics??{}).length,0);assert.match(poor.supplierTalks![p.thingId]!.log.at(-1)!.text,/只有 100/);
 const stale=talking(),q=say('喂')(stale);supplierTalkReply(stale,q.thingId,q.serial+1,reply(null));assert.equal(stale.supplierTalks![q.thingId]!.pending,true);
 supplierTalkFailed(stale,q.thingId,q.serial,'超时');assert.equal(stale.supplierTalks![q.thingId]!.pending,false);assert.match(stale.supplierTalks![q.thingId]!.log.at(-1)!.text,/没有回应/);
 const gone=talking(),r=say('给我点东西')(gone);closeSupplier(gone);supplierTalkReply(gone,r.thingId,r.serial,reply({type:'loot',price:1,name:'x'}));
 assert.equal(gone.run.rewards.some(x=>x.kind==='gift'),false);
});

test('0.40 补给员对话：杀害次数进入知识库；额度表与杀害后对话结束', () => {
 const s=startExpedition(playtestParty(),supplierSeed()),t=s.region.things.find(t=>t.kind==='supplier')!;s.x=t.x;s.z=t.z;s.supplierTalkReady=true;
 interact(s);supplierChoice(s,'kill');assert.equal(s.supplierKills,1);
 assert.deepEqual(TALK_LIMITS,{relic:1,item:2,event:1,loot:1});
 const bad=materializeDeal({type:'weapon'},{depth:1,theme:'',themeSubtitle:'',scene:'',foes:[],floorQuality:'普通',capTier:1,party:[],fp:9999,relics:[],items:[],kills:0,encounters:[],remaining:{relic:1,item:2,event:1,loot:1},runId:'r'},1);
 assert.equal(bad.ok,false);
});

test('0.40 正文模式：只在探索中切出；层数推进、切回迷宫跳层并记账；离开迷宫照常成功结算', () => {
 const s=startExpedition(playtestParty(),12345);assert.equal(canStartNarrative(s),true);
 s.mode='battle';assert.equal(startNarrative(s),false);s.mode='explore';
 assert.equal(startNarrative(s),true);assert.equal(s.paused,true);assert.deepEqual({a:s.narrative!.active,d:s.narrative!.depth},{a:true,d:1});
 assert.equal(view(s).narrative?.active,true);assert.equal(view(s).narrativeReady,false);
 narrativeDescend(s);narrativeDescend(s);assert.equal(s.narrative!.depth,3);
 const text=narrativeBreakpoint(s);assert.match(text,/第 3 层/);assert.match(text,/同行者/);
 const f=narrativeFloor(3,s.regionSeed!),r=makeRegion(3,0,s.regionSeed!);assert.equal(f.theme,r.theme);assert.equal(f.scene,r.name);assert.equal(f.bossFloor,true);
 assert.ok(f.monsters.some(m=>m.role==='Boss'));
 exitNarrative(s);assert.equal(s.narrative,undefined);assert.equal(s.depth,3);assert.equal(s.region.depth,3);assert.equal(s.depthLog!.down,2);assert.equal(s.depthLog!.maximum,3);
 assert.deepEqual(s.narrativeSpans,[{from:1,to:3}]);
 const leave=startExpedition(playtestParty(),777);startNarrative(leave);for(let i=0;i<4;i++)narrativeDescend(leave);leaveFromNarrative(leave);
 assert.equal(leave.mode,'ended');assert.equal(leave.run.status,'success');assert.equal(leave.depth,5);assert.equal(leave.depthLog!.maximum,5);assert.equal(leave.narrative,undefined);
 assert.throws(()=>narrativeDescend(leave));
});

test('0.40 正文模式：请求消息、extra 与 EJS 用的消息变量、聊天镜像', () => {
 assert.equal(NARRATIVE_REQUEST,'普罗泰利西翁正文模式');assert.ok(!NARRATIVE_DESCEND.includes('进入普罗泰利西翁'),'不能误触入口请求');
 const extra=narrativeExtra('1:2','run-x','narrative',7,'断点');assert.deepEqual(extra.bookseaHandoff,{version:2,kind:'narrative',contextId:'1:2',runId:'run-x',depth:7,summary:'断点'});
 assert.deepEqual(narrativePromptData({stat_data:{a:1},bookseaPromptHandoff:{old:true}},extra),{stat_data:{a:1},bookseaPromptHandoff:extra.bookseaHandoff});
 const s=startExpedition(playtestParty(),4242);startNarrative(s);narrativeDescend(s);
 const chat=narrativeChat(s,'1:2');assert.equal(chat.active,true);assert.equal(chat.depth,2);assert.equal(chat.runId,s.run.id);assert.equal(chat.floor.depth,2);assert.equal(chat.party.length,s.party.length);
});

test('0.40 运行时：对话异步写回并存档；正文模式在存档写回之后才交给宿主', async () => {
 const s=startExpedition(playtestParty(),supplierSeed()),t=s.region.things.find(t=>t.kind==='supplier')!;s.x=t.x;s.z=t.z;adjustFp(s,5000,'测试');
 const storage=new Map<string,string>(),checkpoints:string[]=[],prompts:string[]=[];let narrative:State|undefined;
 const win={localStorage:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)},setInterval:()=>1,clearInterval(){},document:{hidden:false,addEventListener(){},removeEventListener(){}},addEventListener(){},removeEventListener(){}} as unknown as Window;
 const runtime=mountExpeditionRuntime({storageKey:'talk-test',initial:s,audio:false,checkpoint:async copy=>{checkpoints.push(copy.mode);},
  supplierChat:async p=>{prompts.push(p.messages.at(-1)!.content);return reply({type:'loot',price:1,name:'纪念币',itemType:'饰品',effect:'能抛',description:'一枚硬币'},'拿去');},
  onNarrative:copy=>{narrative=copy;}},win);
 runtime.attach(raw=>{const f=JSON.parse(raw);runtime.rendered(f.mode,f.region.id);});
 runtime.input({type:'interact'});runtime.input({type:'supplierChoice',payload:{choice:'talk'}});runtime.input({type:'supplierTalk',payload:{text:'你好'}});
 await new Promise(r=>setTimeout(r,0));await runtime.flush();
 const inspect=runtime.inspect() as ReturnType<typeof view>;assert.deepEqual(prompts,['你好']);
 assert.equal(inspect.supplier?.talk?.pending,false);assert.ok(inspect.loot.some(r=>r.kind==='gift'));
 assert.ok(checkpoints.length>=3);
 runtime.input({type:'supplierTalkBack'});runtime.input({type:'supplierClose'});runtime.input({type:'pause'});runtime.input({type:'narrative'});
 await runtime.flush();await new Promise(r=>setTimeout(r,0));
 assert.ok(narrative,'正文模式回调');assert.equal(narrative!.narrative?.active,true);
 assert.equal(JSON.parse(storage.get('talk-test')!).narrative.active,true);
 runtime.dispose();
});

test('0.40 补给员对话：不同补给员给的道具编号不冲突；遗物槽满时不收钱', () => {
 const s=talking(),first=say('药')(s);
 supplierTalkReply(s,first.thingId,first.serial,reply({type:'item',price:1,name:'甲',count:1,effect:{kind:'cleanse'}}));
 const t=s.region.things.find(x=>x.id===first.thingId)!;closeSupplier(s);
 const clone=structuredClone(t);clone.id=t.id+':second';s.region.things.push(clone);s.supplierState={thingId:clone.id};s.mode='supplier';supplierChoice(s,'talk');
 const second=say('药')(s);assert.equal(second.serial,1);
 supplierTalkReply(s,second.thingId,second.serial,reply({type:'item',price:1,name:'乙',count:1,effect:{kind:'shield',value:.2}}));
 assert.equal(Object.keys(s.customItems!).length,2);assert.deepEqual(Object.values(s.customItems!).map(i=>i.name).sort(),['乙','甲']);
 const full=talking();for(const p of full.party)for(let i=0;i<9;i++)(full.ownedRelics??=[]).push({id:'R00'+(i+1),owner:p.id,stacks:1});
 const fp=pendingFp(full.run,full.fpDebt),r=say('遗物')(full);supplierTalkReply(full,r.thingId,r.serial,reply({type:'relic',price:1,effects:[{kind:'crit',value:.01}]}));
 assert.equal(pendingFp(full.run,full.fpDebt),fp);assert.match(full.supplierTalks![r.thingId]!.log.at(-1)!.text,/遗物槽都满了/);
});
