import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,applyBattleEffects,costFor,advanceBattle,type Battle} from '../src/battle/executor';
import type {ActionSpec,EffectSpec} from '../src/compiler/contract';
import {bareMitigation,contentCard,strike} from '../src/game/content';
import {fire} from '../scripts/audit-monsters';
import {flat} from '../src/game/monsters/ir';

/** 0.36.1：为 R20/R27/R30/R31/R32/R42/R44/R46/R47/R56 补的原语，逐条行为验证。 */
const zero={hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}};
const act=(effects:EffectSpec[],target:ActionSpec['target']='self'):ActionSpec=>({target,cost:zero,castMs:0,recoveryFactor:1,perBattleUses:0,effects});
const rule=(r:string,key:string):EffectSpec=>({op:'rule',rule:r,key,duration:{clock:'permanent',value:0},priority:90,absolute:true} as EffectSpec);
const skill=(power:number,mp=30):ActionSpec=>({...strike(power),castMs:0,cost:{hp:{flat:0,maxFraction:0},mp:{flat:mp,maxFraction:0},sp:{flat:0,maxFraction:0}}});
const dmg=(n:number,element='none',channel:'physical'|'energy'|'true'='physical'):EffectSpec=>({op:'damage',amounts:{physical:flat(channel==='physical'?n:0),energy:flat(channel==='energy'?n:0),mental:flat(0),true:flat(channel==='true'?n:0)},element,hitChance:1,hitRule:'guaranteed',critChance:0,critMultiplier:1} as EffectSpec);
function arena(){const mk=(id:string,side:'ally'|'enemy')=>{const card=contentCard(10,5000,18,{probe:skill(50),poke:skill(50)});card.numeric.max.mp=500;return {id,side,card,current:{...card.numeric.max},mitigation:bareMitigation()};};return createBattle([mk('a','enemy'),mk('p','ally')],3);}
const U=(b:Battle,id:string)=>b.units.find(u=>u.id===id)!;
const idle=(x:Battle,ms:number)=>{x=structuredClone(x);for(let t=0;t<ms;t+=500){x.clock.pending=[];for(const c of x.clock.units)c.active=false;x=advanceBattle(x,Math.min(500,ms-t)).battle;}return x;};

test('nth_use_free（回响之弦）：同一技能第 3 次费用为 0，第 4 次恢复', ()=>{
 let b=arena();b=applyBattleEffects(b,'p',act([rule('nth_use_free','3')]),['p']);
 const p=()=>U(b,'p');const mp0=p().current.mp;
 b=fire(b,'p','probe',['a']);b=fire(b,'p','probe',['a']);const mp2=p().current.mp;assert.equal(mp0-mp2,60);
 assert.deepEqual(costFor(p(),p().actions['probe']!,'probe'),{hp:0,mp:0,sp:0});
 b=fire(b,'p','probe',['a']);assert.equal(p().current.mp,mp2,'第 3 次免费');
 b=fire(b,'p','probe',['a']);assert.equal(p().current.mp,mp2-30,'第 4 次照常');
});

test('blood_tax（血税印）：MP 费用改为等量 HP，不可致死', ()=>{
 let b=arena();b=applyBattleEffects(b,'p',act([rule('blood_tax','*')]),['p']);
 const p=()=>U(b,'p');const hp0=p().current.hp,mp0=p().current.mp;
 b=fire(b,'p','probe',['a']);assert.equal(p().current.mp,mp0);assert.equal(hp0-p().current.hp,30);
 p().current.hp=10;assert.deepEqual(costFor(p(),p().actions['probe']!,'probe'),{hp:9,mp:0,sp:0},'封顶在当前 HP−1');
});

test('hp_gate_damage（空腹）：血线低于 50% 攻击 ×1.5，高于 ×0.8', ()=>{
 let b=arena();b=applyBattleEffects(b,'p',act([rule('hp_gate_damage','1.5|0.8|0.5')]),['p']);
 let hp=U(b,'a').current.hp;b=fire(b,'p','probe',['a']);const high=hp-U(b,'a').current.hp;
 U(b,'p').current.hp=Math.floor(U(b,'p').max.hp*.3);hp=U(b,'a').current.hp;b=fire(b,'p','poke',['a']);const low=hp-U(b,'a').current.hp;
 assert.ok(Math.abs(low/high-1.5/.8)<.05,`low ${low} high ${high}`);
});

test('hp_gate_attrs（满腹）：血线随伤害 / 治疗实时切换全属性', ()=>{
 let b=arena();b=applyBattleEffects(b,'p',act([rule('hp_gate_attrs','1.2|0.9|0.8')]),['p']);
 const base=U(b,'p').base!.attributes.力量;assert.ok(Math.abs(U(b,'p').attributes.力量-base*1.2)<1e-6,'满血 ×1.2');
 b=applyBattleEffects(b,'a',act([dmg(3000,'none','true')],'enemy'),['p']);assert.ok(Math.abs(U(b,'p').attributes.力量-base*.9)<1e-6,'受伤后 ×0.9');
 b=applyBattleEffects(b,'p',act([{op:'heal',resource:'hp',amount:{...flat(0),subject:'target',maxResource:'hp',maxFraction:1}}]),['p']);assert.ok(Math.abs(U(b,'p').attributes.力量-base*1.2)<1e-6,'治疗回满后 ×1.2');
});

test('echo_first（复读机）：第一次使用的技能在下一轮免费再放一次，目标不变', ()=>{
 let b=arena();b=applyBattleEffects(b,'p',act([rule('echo_first','*')]),['p']);
 const hp0=U(b,'a').current.hp;b=fire(b,'p','probe',['a']);const once=hp0-U(b,'a').current.hp;const mp=U(b,'p').current.mp;
 assert.equal(U(b,'p').echoQueue?.length,1);
 b=idle(b,4000);
 assert.equal(U(b,'p').echoQueue?.length??0,0,'已回响');assert.ok(hp0-U(b,'a').current.hp>=once*1.9,'第二发落地');assert.equal(U(b,'p').current.mp,mp,'回响免费');
 b=fire(b,'p','poke',['a']);assert.equal(U(b,'p').echoQueue?.length??0,0,'只回响每战第一个');
});

test('gear_cost（惰性齿轮）：每轮首动 ×0.5，之后 ×2，换轮重置', ()=>{
 let b=arena();b=applyBattleEffects(b,'p',act([rule('gear_cost','0.5|2')]),['p']);
 assert.equal(costFor(U(b,'p'),U(b,'p').actions['probe']!,'probe').mp,15);
 b=fire(b,'p','probe',['a']);assert.equal(costFor(U(b,'p'),U(b,'p').actions['probe']!,'probe').mp,60);
 b=idle(b,4000);assert.equal(costFor(U(b,'p'),U(b,'p').actions['probe']!,'probe').mp,15);
});

test('type_scale（白纸）/ taken_type_scale（棱镜）：按伤害属性缩放输出 / 承伤', ()=>{
 let b=arena();b=applyBattleEffects(b,'p',act([rule('type_scale','无|1.5|0.8')]),['p']);
 let hp=U(b,'a').current.hp;b=applyBattleEffects(b,'p',act([dmg(100,'none','energy')],'enemy'),['a']);const none=hp-U(b,'a').current.hp;
 hp=U(b,'a').current.hp;b=applyBattleEffects(b,'p',act([dmg(100,'火','energy')],'enemy'),['a']);const fire_=hp-U(b,'a').current.hp;
 assert.ok(Math.abs(none/fire_-1.5/.8)<.05,`${none} ${fire_}`);
 let c=arena();c=applyBattleEffects(c,'a',act([rule('taken_type_scale','无|1.5|0.7')]),['a']);
 hp=U(c,'a').current.hp;c=applyBattleEffects(c,'p',act([dmg(100,'none','energy')],'enemy'),['a']);const n2=hp-U(c,'a').current.hp;
 hp=U(c,'a').current.hp;c=applyBattleEffects(c,'p',act([dmg(100,'火','energy')],'enemy'),['a']);const f2=hp-U(c,'a').current.hp;
 assert.ok(Math.abs(n2/f2-1.5/.7)<.05,`${n2} ${f2}`);
});

test('dot_scale（忍耐之环）：状态 tick 的伤害 ×0.5，直接伤害 ×1.1', ()=>{
 const poison:ActionSpec={...act([{op:'apply_status',status:'venom'}],'enemy'),library:{actions:{tick:act([dmg(100,'none','true')],'enemy')},statuses:{venom:{name:'毒',tags:['poison'],polarity:'negative',duration:{clock:'round',value:3},stack:'refresh',maxStacks:1,scaleWithStacks:false,priority:0,dispellable:true,removeOnDeath:false,scope:'battle',tick:{interval:1,clock:'round',action:'tick',count:3}}},summons:{},fields:{}}};
 const run=(withRing:boolean)=>{let b=arena();if(withRing)b=applyBattleEffects(b,'a',act([rule('dot_scale','0.5|1.1')]),['a']);b=applyBattleEffects(b,'p',poison,['a']);const hp=U(b,'a').current.hp;b=idle(b,4000);return hp-U(b,'a').current.hp;};
 const plain=run(false),ring=run(true);assert.ok(plain>0);assert.ok(Math.abs(ring/plain-.5)<.05,`${ring} ${plain}`);
 let b=arena();b=applyBattleEffects(b,'a',act([rule('dot_scale','0.5|1.1')]),['a']);let hp=U(b,'a').current.hp;b=applyBattleEffects(b,'p',act([dmg(100,'none','true')],'enemy'),['a']);assert.equal(hp-U(b,'a').current.hp,110);
});

test('control_tax（破戒）：免疫控制 / 负面，但每次被命中失去当前 HP 10%', ()=>{
 // 0.21：absolute 只认遗物来源（relic/<id>/<i>），这里按遗物来源挂上。
 let b=arena();b=applyBattleEffects(b,'p',act([rule('immune_status','negative'),rule('control_tax','0.1')]),['p'],'effect','relic/r56/0');
 const stun:ActionSpec={...act([{op:'apply_status',status:'stun'}],'enemy'),library:{actions:{},statuses:{stun:{name:'眩晕',tags:['stun'],polarity:'negative',control:'stun',duration:{clock:'round',value:1},stack:'refresh',maxStacks:1,scaleWithStacks:false,priority:0,dispellable:true,removeOnDeath:false,scope:'battle'}},summons:{},fields:{}}};
 const hp=U(b,'p').current.hp;b=applyBattleEffects(b,'a',stun,['p']);
 assert.ok(!U(b,'p').statuses?.some(s=>s.definition.control==='stun'),'免疫');assert.equal(U(b,'p').current.hp,hp-Math.round(hp*.1),'付血');
});
