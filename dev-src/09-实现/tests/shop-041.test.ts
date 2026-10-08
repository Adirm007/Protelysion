/** 0.41 商店：学习装置（离场分经验、限购 1、3000 FP）、宿主总 FP 支付（先扣待结算）、每位补给员一件随机遗物。 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import _ from 'lodash';
import {playtestParty} from '../src/game/content';
import {startExpedition,supplierChoice,view,move,tick,acquireRelic,fighters,type State} from '../src/game/expedition';
import {pendingFp,INSURANCE} from '../src/game/run-hooks';
import {supplierSpawns} from '../src/game/supplier';
import {walkable} from '../src/game/region';
import {LEARNING_DEVICE,LEARNING_DEVICE_PRICE,RELIC_LIST,RELIC_CATALOG} from '../src/game/relic-catalog';
import {checkpointHost,type SessionPort} from '../src/host/game-session';
import {object,type Obj} from '../src/core/actors';
import {fixture,partner} from './fixtures';

function shopState(host=false){
 let seed=1;for(;seed<10000;seed++)if(supplierSpawns(1,0,seed))break;
 const s=startExpedition(playtestParty(),seed);const t=s.region.things.find(t=>t.kind==='supplier')!;s.x=t.x;s.z=t.z;s.mode='supplier';s.supplierState={thingId:t.id};
 if(host){s.source='host';s.hostFp=5000;}
 supplierChoice(s,'shop');return {s,t};
}
const fp=(s:State,n:number)=>s.run.rewards.push({kind:'fp',amount:n,count:1,source:'测试'});
const ids=(s:State)=>view(s).supplier!.choices.map(c=>c.id);

test('商店末尾依次是死亡不掉落、学习装置、随机遗物、返回',()=>{
 const {s}=shopState(),list=ids(s);
 assert.deepEqual(list.slice(-4),['buy:'+INSURANCE.id,'buy:'+LEARNING_DEVICE.id,'buy:shop-relic','back']);
 assert.ok(view(s).supplier!.choices.find(c=>c.id==='buy:'+LEARNING_DEVICE.id)!.label.includes('3000 FP'));
 assert.ok(!RELIC_LIST.some(r=>r.id===LEARNING_DEVICE.id),'学习装置不进随机遗物池');
});
test('学习装置：3000 FP、限购一次、FP 不足买不了',()=>{
 const {s}=shopState();assert.equal(LEARNING_DEVICE_PRICE,3000);
 supplierChoice(s,'buy:'+LEARNING_DEVICE.id);assert.equal(s.learningBought,undefined);
 fp(s,3200);supplierChoice(s,'buy:'+LEARNING_DEVICE.id);
 assert.equal(s.learningBought,true);assert.equal(pendingFp(s.run,s.fpDebt),200);assert.ok(s.ownedRelics!.some(o=>o.id===LEARNING_DEVICE.id));
 fp(s,5000);supplierChoice(s,'buy:'+LEARNING_DEVICE.id);assert.equal(s.ownedRelics!.filter(o=>o.id===LEARNING_DEVICE.id).length,1);assert.equal(pendingFp(s.run,s.fpDebt),5200);
});
test('宿主总 FP 可用于购物，扣款先扣待结算再扣总 FP；试玩模式不计总 FP',()=>{
 const {s}=shopState(true);fp(s,1000);
 assert.ok(view(s).supplier!.question.includes('总 FP 5000'));
 supplierChoice(s,'buy:'+LEARNING_DEVICE.id);
 assert.equal(s.learningBought,true);assert.equal(pendingFp(s.run,s.fpDebt),0);assert.equal(s.hostFpSpent,2000);assert.equal(s.fpDebt??0,0);
 supplierChoice(s,'buy:'+INSURANCE.id);assert.equal(s.run.keepOnDefeat,true);assert.equal(s.hostFpSpent,5000);
 supplierChoice(s,'buy:red');assert.equal(s.bag?.red,undefined,'总额不足不扣');assert.equal(s.hostFpSpent,5000);
 const {s:play}=shopState();play.hostFp=99999;supplierChoice(play,'buy:'+LEARNING_DEVICE.id);assert.equal(play.learningBought,undefined);
});
test('随机遗物：每位补给员不同、固定不变、只能买一次',()=>{
 const {s,t}=shopState();const first=s.shopRelics![t.id]!;assert.ok(RELIC_CATALOG[first]);
 supplierChoice(s,'back');supplierChoice(s,'shop');assert.equal(s.shopRelics![t.id],first,'同一位补给员不重抽');
 const other={...t,id:t.id+'-b'};s.region.things.push(other);s.supplierState={thingId:other.id};supplierChoice(s,'shop');
 assert.notEqual(s.shopRelics![other.id],first);
 s.supplierState={thingId:t.id};fp(s,99999);const before=s.ownedRelics?.length??0;
 supplierChoice(s,'buy:shop-relic');assert.equal(s.ownedRelics!.length,before+1);assert.ok(s.ownedRelics!.some(o=>o.id===first));
 supplierChoice(s,'buy:shop-relic');assert.equal(s.ownedRelics!.length,before+1);
 assert.ok(view(s).supplier!.choices.find(c=>c.id==='buy:shop-relic')!.label.includes('已售出'));
});
test('学习装置佩戴者不上场但照常分经验；全员佩戴时仍上场',()=>{
 const s=startExpedition(playtestParty(),7);const [a,b]=s.party;acquireRelic(s,LEARNING_DEVICE.id,b!.id);s.mode='explore';s.eventState=undefined;
 assert.deepEqual(fighters(s).map(p=>p.id),[a!.id]);
 const t=s.region.things.find(t=>t.kind==='enemy'&&!t.used)!;
 for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]] as const)if(walkable(s.region,t.x-dx,t.z-dz)){s.x=t.x-dx;s.z=t.z-dz;move(s,dx,dz);break;}
 assert.equal(s.mode,'battle');assert.ok(!s.battle!.units.some(u=>u.id===b!.id),'佩戴者不在战场');
 // 直接让敌人全倒后结算
 for(const u of s.battle!.units)if(u.side==='enemy'){u.current.hp=0;}
 s.battle!.outcome='victory';s.battle!.clock.ended=true;s.battle!.clock.pending=[];
 tick(s,50);
 assert.equal(s.mode,'explore');
 const exp=Object.fromEntries(s.run.participants.map(p=>[p.ref.kind==='player'?'player':(p.ref as {name:string}).name,p.experience]));
 assert.ok(s.run.participants.every(p=>p.experience>0),'两人都拿到经验 '+JSON.stringify(exp));
 acquireRelic(s,LEARNING_DEVICE.id,a!.id);assert.equal(fighters(s).length,2,'全员佩戴仍上场');
});
test('宿主写回：商店花掉的总 FP 按回执只扣一次',async()=>{
 let m:Obj=fixture();object(m.stat_data).命运点数=5000;let chat:Obj={};
 const p:SessionPort={id:()=>'chat-A',messageId:()=>5,read:()=>structuredClone(m),write:async v=>{m=structuredClone(v);},chat:()=>structuredClone(chat),updateChat:async fn=>{chat=fn(chat);},env:{} as never,lodash:_,lock:async(_k,fn)=>fn(),deliver:async()=>{}};
 const party=playtestParty().slice(0,1);party[0]!.ref=partner();const s=startExpedition(party,999);s.source='host';s.hostContext='chat-A';s.potions=0;s.hostFp=5000;s.hostFpSpent=1200;
 await checkpointHost(p,s);assert.equal(object(m.stat_data).命运点数,3800);
 await checkpointHost(p,s);assert.equal(object(m.stat_data).命运点数,3800,'不重复扣');
 s.hostFpSpent=1500;await checkpointHost(p,s);assert.equal(object(m.stat_data).命运点数,3500);
});
