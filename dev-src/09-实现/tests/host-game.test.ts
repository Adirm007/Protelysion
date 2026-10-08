import {test} from 'node:test';import assert from 'node:assert/strict';import _ from 'lodash';
import {actorAt,actorKey,object,type Obj} from '../src/core/actors';
import {fixture,partner,player} from './fixtures';
import {growParticipant} from '../src/host/growth';
import {sourceGrowth} from '../src/host/source-growth';
import {checkpointHost,redeemHostVoucher,discardDevelopmentExpedition,type SessionPort} from '../src/host/game-session';
import {startExpedition,withdraw,type State} from '../src/game/expedition';
import {playtestParty} from '../src/game/content';
import {addReward,awardVictory,exitMembers} from '../src/core/run';
function data(){const m=fixture(),a=actorAt(m,partner());a.等级=3;a.生命层级='第一层级/普通';a.属性={力量:3,敏捷:3,体质:3,智力:3,精神:3};object(m.date).npcs={测试伙伴甲:{level:3,exp:710,required_exp:720}};return m;}
function port(mvu=data()){
 let m=mvu,chat:Obj={},writes=0;const notices=new Set<string>();
 const p:SessionPort={id:()=> 'chat-A',messageId:()=>5,read:()=>structuredClone(m),write:async v=>{m=structuredClone(v);writes++;},chat:()=>structuredClone(chat),updateChat:async fn=>{chat=fn(chat);},env:{} as any,lodash:_,lock:async(_,fn)=>fn(),deliver:async s=>{notices.add(s.run.id);}};
 return {p,get m(){return m;},get chat(){return chat;},get writes(){return writes;},notices};
}
function run():State{const party=playtestParty().slice(0,1);party[0]!.ref=partner();const s=startExpedition(party,99);s.source='host';s.hostContext='chat-A';s.potions=0;s.inventory={'drug':{owner:partner(),name:'测试药剂',actorId:party[0]!.id,remaining:2,used:1}};return s;}
test('source-derived NPC growth: higher than player, absent, own XP only',()=>{
 const m=data(),original=structuredClone(m),next=growParticipant(m,partner(),20,_),a=actorAt(next,partner());
 assert.equal(a.等级,4);assert.equal(object(object(next.date).npcs).测试伙伴甲 && object(object(object(next.date).npcs).测试伙伴甲).exp,730);
 assert.equal(Object.values(object(a.属性)).reduce<number>((n,v)=>n+Number(v),0),16);
 assert.deepEqual(actorAt(next,player),actorAt(m,player));assert.deepEqual(actorAt(next,partner('测试伙伴乙')),actorAt(m,partner('测试伙伴乙')));assert.equal(object(next.date).npcLevelUpWithPlayer,true);assert.deepEqual(m,original);
});
test('source-derived player growth awards original attribute points, not NPC broadcast',()=>{
 const m=data(),a=actorAt(m,player);a.累计经验值=119;a.属性点=0;a.登神长阶={是否开启:false,要素:{},权能:{},法则:{},神位:'',神国:{名称:'',描述:''}};object(m.stat_data).任务列表={};
 const next=growParticipant(m,player,2,_);assert.equal(actorAt(next,player).等级,2);assert.equal(actorAt(next,player).属性点,1);assert.deepEqual(object(next.date).npcs,object(m.date).npcs);
});
test('source thresholds and actor-specific ascension gates retained',()=>{
 const m=data(),a=actorAt(m,player);a.等级=12;a.累计经验值=28439;a.属性点=0;a.升级所需经验=28440;a.登神长阶={是否开启:false,要素:{},权能:{},法则:{},神位:'',神国:{名称:'',描述:''}};object(m.stat_data).任务列表={};
 const next=growParticipant(m,player,100,_);assert.equal(actorAt(next,player).等级,12);assert.equal(actorAt(next,player).累计经验值,28440);assert.equal(sourceGrowth(_,next,m).threshold(25),'MAX');
});
test('host success writes individual growth, actual inventory usage, sealed rewards and restores effective post-growth resources once',async()=>{
 const h=port(),s=run();s.run=awardVictory(s.run,'fight-one',[actorKey(partner())],[{instanceId:'mob',species:'T15_N01',level:2,role:'普通',rewardEligible:true}]);s.run=addReward(s.run,{kind:'box',quality:'普通',style:'纸页天穹',contentType:'物资',count:1,source:'test'});s.run=addReward(s.run,{kind:'fp',amount:1,count:1,source:'test'});withdraw(s);
 const playerBefore=structuredClone(actorAt(h.m,player));await checkpointHost(h.p,s);const once=structuredClone(h.m),a=actorAt(h.m,partner());
 assert.equal(a.等级,4);assert.equal(object(object(a.背包).测试药剂).数量,2);assert.equal(object(a.生命值).当前,Number(object(object(a.生命值).上限)._基础)+20);assert.equal(actorAt(h.m,player).累计经验值,playerBefore.累计经验值);assert.equal(object(h.m.stat_data).命运点数,101);
 const bag=object(actorAt(h.m,player).背包);assert.equal(bag['书海·1FP兑换券'],undefined);assert.equal(object(bag['普通·纸页天穹·物资盲盒']).数量,1);assert.equal(s.writeback,'done');
 await checkpointHost(h.p,s);assert.deepEqual(h.m,once);assert.equal(h.notices.size,1);
 assert.equal(object(h.m.stat_data).命运点数,101);assert.equal(object(actorAt(h.m,player).背包)['书海·1FP兑换券'],undefined);
});
test('pauses synchronize expenditure but do not award XP; later settlement does not deduct the item again',async()=>{
 const h=port(),s=run();s.paused=true;await checkpointHost(h.p,s);assert.equal(object(object(object(h.m.date).npcs).测试伙伴甲).exp,710);assert.equal(object(object(actorAt(h.m,partner()).背包).测试药剂).数量,2);s.paused=false;withdraw(s);await checkpointHost(h.p,s);assert.equal(object(object(actorAt(h.m,partner()).背包).测试药剂).数量,2);
});
test('failure clears rewards and keeps spent original item; no experience, FP or world-time manipulation',async()=>{
 const h=port(),s=run();s.run=addReward(s.run,{kind:'voucher',faceValue:5,count:1,source:'test'});s.run=exitMembers(s.run,[{ref:partner(),reason:'downedExit'}]);s.mode='ended';await checkpointHost(h.p,s);assert.equal(s.run.status,'failed');assert.equal(object(object(object(h.m.date).npcs).测试伙伴甲).exp,710);assert.equal(object(h.m.stat_data).命运点数,100);assert.equal(object(object(h.m.stat_data).世界).时间,'不应改变');assert.equal(object(object(actorAt(h.m,partner()).背包).测试药剂).数量,2);
});
test('a member already departed is not refilled again at a later party checkpoint',async()=>{
 const h=port(),s=run();const other=playtestParty()[1]!;other.ref=partner('测试伙伴乙');s.party.push(other);s.run.participants.push({ref:other.ref,entryLevel:9,status:'active',battles:[],experience:0});s.run=exitMembers(s.run,[{ref:partner(),reason:'downedExit'}]);await checkpointHost(h.p,s);
 const m=h.p.read();object(actorAt(m,partner()).生命值).当前=7;await h.p.write(m);await checkpointHost(h.p,s);assert.equal(object(actorAt(h.m,partner()).生命值).当前,7);
});

test('explicit development reset discards Booksea run records without touching actors, inventory or settlement',async()=>{
 const h=port(),before=structuredClone(h.m);
 await h.p.updateChat(v=>({...v,otherFeature:{kept:true},booksea:{settings:{narrative:false},activeExpedition:{version:1},lastExpedition:{version:1},unlockedIds:['depth-1','anchor-5']}}));
 await discardDevelopmentExpedition(h.p,'chat-A');
 assert.deepEqual(h.m,before);assert.equal(h.writes,0);assert.equal(h.notices.size,0);
 const b=object(h.chat.booksea);assert.equal(b.activeExpedition,null);assert.equal(b.lastExpedition,null);assert.deepEqual(b.unlockedIds,['depth-1']);assert.deepEqual(b.settings,{narrative:false});assert.deepEqual(h.chat.otherFeature,{kept:true});
});
test('development reset refuses a changed chat context',async()=>{
 const h=port(),before=structuredClone(h.chat);await assert.rejects(()=>discardDevelopmentExpedition(h.p,'chat-other'),/聊天已切换/);assert.deepEqual(h.chat,before);assert.equal(h.writes,0);
});
