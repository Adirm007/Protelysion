import test from 'node:test';
import assert from 'node:assert/strict';
import {playtestParty,bareMitigation,contentCard,strike} from '../src/game/content';
import {startExpedition,acquireRelic,removeRelic,type State} from '../src/game/expedition';
import {createBattle,applyBattleEffects,derivedResources,type Battle} from '../src/battle/executor';
import type {ActionSpec,EffectSpec} from '../src/compiler/contract';

/** 0.38.2：迷宫里的遗物 / 事件改动五维时，HP / MP / SP 上限按宿主卡世界书《角色生成》公式随之增减。 */
const zero={hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}};
const act=(effects:EffectSpec[]):ActionSpec=>({target:'self',cost:zero,castMs:0,recoveryFactor:1,perBattleUses:0,effects});
const ATTRS=['力量','敏捷','体质','智力','精神'] as const;
const allAttrs=(m:number):EffectSpec=>({op:'modify',name:'全属性',duration:{clock:'permanent',value:0},modifiers:ATTRS.map(stat=>({stat,multiplier:m}))} as EffectSpec);
const W=(s:State,id:string)=>s.world!.units.find(u=>u.id===id)!;
const U=(b:Battle,id:string)=>b.units.find(u=>u.id===id)!;
const near=(a:number,b:number)=>Math.abs(a-b)<=1;

test('公式与层级乘数：HP = 体×100×HP乘数 + 五维和；MP = (智+精)×50×乘数；SP = (力+敏)×50×乘数', ()=>{
 const a={力量:6,敏捷:8,体质:6,智力:2,精神:5};
 assert.deepEqual(derivedResources(3,a),{hp:627,mp:350,sp:700},'一层');
 assert.deepEqual(derivedResources(5,a),{hp:1227,mp:875,sp:1750},'二层 HP×2 MP/SP×2.5');
 assert.deepEqual(derivedResources(9,a),{hp:2427,mp:2100,sp:4200},'三层 HP×4 MP/SP×6');
 assert.deepEqual(derivedResources(25,a),{hp:60027,mp:56000,sp:112000},'七层 HP×100 MP/SP×160');
});

test('哑铃（全属性 +20%）抬高持有者上限；生锈钥匙（全队 ×0.9）压低；丢掉后回落并夹住当前值', ()=>{
 const s=startExpedition(playtestParty(),11);const id=s.party[0]!.id,other=s.party[1]!.id;
 const u0=W(s,id),base={...u0.max},attrs={...u0.attributes},lv=u0.level;
 const expect=(m:number)=>{const scaled=Object.fromEntries(ATTRS.map(k=>[k,attrs[k]*m])) as typeof attrs;const b=derivedResources(lv,attrs),a=derivedResources(lv,scaled);return {hp:Math.round(base.hp+a.hp-b.hp),mp:Math.round(base.mp+a.mp-b.mp),sp:Math.round(base.sp+a.sp-b.sp)};};
 acquireRelic(s,'R057',id);
 assert.deepEqual(W(s,id).max,expect(1.2),'哑铃：上限随五维上涨');
 assert.ok(W(s,id).max.hp>base.hp&&W(s,id).max.mp>base.mp&&W(s,id).max.sp>base.sp);
 assert.deepEqual(W(s,other).max,W(s,other).base!.max,'不是持有者，上限不变');
 acquireRelic(s,'R039',other);
 assert.deepEqual(W(s,id).max,expect(1.2*.9),'哑铃 × 生锈钥匙');
 assert.ok(W(s,other).max.hp<W(s,other).base!.max.hp,'生锈钥匙压低全队上限');
 assert.ok(W(s,other).current.hp<=W(s,other).max.hp,'当前值不超上限');
 removeRelic(s,'R057',id);
 assert.deepEqual(W(s,id).max,expect(.9),'丢掉哑铃后回落');
 assert.ok(W(s,id).current.hp<=W(s,id).max.hp&&W(s,id).current.mp<=W(s,id).max.mp&&W(s,id).current.sp<=W(s,id).max.sp);
});

test('满血带着加属性遗物重建世界 / 进战斗：当前值不被中途重算吃掉', ()=>{
 const s=startExpedition(playtestParty(),11);const id=s.party[0]!.id;
 acquireRelic(s,'R039',id);acquireRelic(s,'R057',id);
 const u=W(s,id);u.current={...u.max};const full={...u.max};
 acquireRelic(s,'R001',id);// 触发重建
 assert.deepEqual(W(s,id).max,full);assert.deepEqual(W(s,id).current,full,'重建后仍是满的');
});

test('只有迷宫来源（遗物 / 开战修正 / 迷宫事件）改上限；战斗内技能增减益不改上限；max_* 修正叠在推演之后', ()=>{
 const mk=()=>{const card=contentCard(10,5000,18,{poke:strike(50)});card.numeric.max.mp=500;card.numeric.max.sp=500;const foe=contentCard(10,5000,18,{poke:strike(50)});foe.numeric.max.mp=0;return createBattle([{id:'p',side:'ally',card,current:{...card.numeric.max},mitigation:bareMitigation()},{id:'e',side:'enemy',card:foe,current:{hp:5000,mp:0,sp:0},mitigation:bareMitigation()}],3);};
 let b=mk();const base={...U(b,'p').max};
 b=applyBattleEffects(b,'p',act([allAttrs(1.5)]),['p']);
 assert.deepEqual(U(b,'p').max,base,'战斗内技能增益：只改五维');
 assert.ok(U(b,'p').attributes.体质>U(b,'p').base!.attributes.体质);
 for(const key of ['event:无人祭坛:0','opener:奇偶天平·奇']){
  let x=mk();x=applyBattleEffects(x,'p',act([allAttrs(1.3)]),['p'],'effect',key);
  const u=U(x,'p'),a=u.base!.attributes,scaled=Object.fromEntries(ATTRS.map(k=>[k,a[k]*1.3])) as typeof a,d0=derivedResources(u.level,a),d1=derivedResources(u.level,scaled);
  assert.ok(near(u.max.hp,base.hp+d1.hp-d0.hp)&&near(u.max.mp,base.mp+d1.mp-d0.mp)&&near(u.max.sp,base.sp+d1.sp-d0.sp),key);
  x=applyBattleEffects(x,'p',act([{op:'modify',name:'血契',duration:{clock:'permanent',value:0},modifiers:[{stat:'max_hp',multiplier:.5}]} as EffectSpec]),['p'],'effect','event:血契:0');
  assert.ok(near(U(x,'p').max.hp,(base.hp+d1.hp-d0.hp)*.5),key+' + 血契 max_hp ×0.5');
 }
 let x=mk();x=applyBattleEffects(x,'p',act([allAttrs(1.3)]),['p'],'effect','opener:沉睡的守卫');
 assert.ok(U(x,'p').max.hp>base.hp,'沉睡的守卫同样按公式');
 const noMp=U(mk(),'e');assert.equal(noMp.max.mp,0);
 let y=mk();y=applyBattleEffects(y,'e',act([allAttrs(1.5)]),['e'],'effect','opener:沉睡的守卫');
 assert.equal(U(y,'e').max.mp,0,'原本没有 MP 的单位不会凭空长出 MP');
});
