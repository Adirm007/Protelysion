import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,applyBattleEffects,actionUnavailable,advanceBattle,type Battle} from '../src/battle/executor';
import {validateAction,type ActionSpec,type EffectSpec} from '../src/compiler/contract';
import {bareMitigation,contentCard,strike} from '../src/game/content';
import {fire} from '../scripts/audit-monsters';
import {flat} from '../src/game/monsters/ir';

/** 0.34 新原语的行为测试：mod / round 读取、ATB 与攻击目标筛选、crit_taken、按累计伤害解除、atb rotate / atb_scale、repeat_seal、blank_page、buff_cap。 */
const act=(effects:EffectSpec[],target:ActionSpec['target']='enemy'):ActionSpec=>({target,cost:{hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}},castMs:0,recoveryFactor:1,perBattleUses:0,effects});
const trueHit=(amount:Partial<ReturnType<typeof flat>>&Record<string,unknown>,extra:Partial<Extract<EffectSpec,{op:'damage'}>>={}):EffectSpec=>({op:'damage',amounts:{physical:flat(0),energy:flat(0),mental:flat(0),true:{...flat(0),...amount} as never},element:'none',hitChance:1,hitRule:'guaranteed',critChance:0,critMultiplier:1,...extra} as EffectSpec);
function arena(agility:number[]=[18,18,18]){
 const mk=(id:string,side:'ally'|'enemy',ag:number)=>{const card=contentCard(10,1000,ag,{probe:{...strike(1),castMs:0}});return {id,side,card,current:{...card.numeric.max},mitigation:bareMitigation()};};
 return createBattle([mk('a','enemy',agility[0]!),mk('p1','ally',agility[1]!),mk('p2','ally',agility[2]!)],7);
}
const unit=(b:Battle,id:string)=>b.units.find(u=>u.id===id)!;
const cu=(b:Battle,id:string)=>b.clock.units.find(u=>u.id===id)!;

test('公式：mod 运算与 round 读取', ()=>{
 let b=arena();b.round=7;const before=unit(b,'p1').current.hp;
 b=applyBattleEffects(b,'a',act([trueHit({expression:[{read:'round'},{constant:4},{operator:'mod'}]})]),['p1']);
 assert.equal(before-unit(b,'p1').current.hp,3);
});

test('目标筛选：highest_atb 拉行动条最高者，highest_attack 打五维最强者', ()=>{
 // 0.21：行动条归零是强控，对同级可当场抵抗；这里只验证目标筛选，施放者高1级（必定生效）。
 let b=arena();unit(b,'a').level+=1;cu(b,'p1').atb=80;cu(b,'p2').atb=20;
 b=applyBattleEffects(b,'a',act([{op:'modify',name:'壮',duration:{clock:'permanent',value:0},modifiers:[{stat:'力量',flat:20}]}]),['p2']);
 b=applyBattleEffects(b,'a',act([{op:'atb',mode:'set',value:0,targeting:{side:'enemy',selection:'highest_atb',count:1,life:'alive'}}]),[]);
 assert.equal(cu(b,'p1').atb,0);assert.equal(cu(b,'p2').atb,20);
 const hp=unit(b,'p2').current.hp;
 b=applyBattleEffects(b,'a',act([trueHit({flat:10},{targeting:{side:'enemy',selection:'highest_attack',count:1,life:'alive'}})]),[]);
 assert.equal(hp-unit(b,'p2').current.hp,10);assert.equal(unit(b,'p1').current.hp,1000);
});

test('crit_taken：承受暴击伤害倍率', ()=>{
 let b=arena();b=applyBattleEffects(b,'a',act([{op:'modify',name:'脆',duration:{clock:'permanent',value:0},modifiers:[{stat:'crit_taken',multiplier:2}]}]),['p1']);
 const before=unit(b,'p1').current.hp;
 b=applyBattleEffects(b,'a',act([trueHit({flat:100},{critChance:1,critMultiplier:2})]),['p1']);
 assert.equal(before-unit(b,'p1').current.hp,400);
});

test('按累计伤害解除：source_received 与 dealt_to_source', ()=>{
 let b=arena();
 b=applyBattleEffects(b,'a',act([{op:'rule',rule:'no_heal',key:'*',duration:{clock:'permanent',value:0},breakAfterDamage:{from:'source_received',fraction:.25}}]),['p1']);
 assert.ok(unit(b,'p1').statuses?.some(s=>s.rule?.kind==='no_heal'));
 b=applyBattleEffects(b,'p2',act([trueHit({flat:200})]),['a']);assert.ok(unit(b,'p1').statuses?.some(s=>s.rule?.kind==='no_heal'),'20% 还不够');
 b=applyBattleEffects(b,'p2',act([trueHit({flat:60})]),['a']);assert.ok(!unit(b,'p1').statuses?.some(s=>s.rule?.kind==='no_heal'),'累计 26% 后解除');
 b=applyBattleEffects(b,'a',act([{op:'rule',rule:'no_heal',key:'*',duration:{clock:'permanent',value:0},breakAfterDamage:{from:'dealt_to_source',fraction:.1}}]),['p1']);
 b=applyBattleEffects(b,'p2',act([trueHit({flat:500})]),['a']);assert.ok(unit(b,'p1').statuses?.some(s=>s.rule?.kind==='no_heal'),'别人打的不算');
 b=applyBattleEffects(b,'p1',act([trueHit({flat:120})]),['a']);assert.ok(!unit(b,'p1').statuses?.some(s=>s.rule?.kind==='no_heal'),'持有者自己打够 10% 才解除');
});

test('atb rotate 整体轮转一格；atb_scale 放大推条退条', ()=>{
 let b=arena();cu(b,'p1').atb=10;cu(b,'p2').atb=50;
 b=applyBattleEffects(b,'a',act([{op:'atb',mode:'rotate',value:1,targeting:{side:'enemy',selection:'all',life:'alive'}}]),[]);
 assert.deepEqual([cu(b,'p1').atb,cu(b,'p2').atb],[50,10]);
 b=applyBattleEffects(b,'a',act([{op:'modify',name:'失重',duration:{clock:'permanent',value:0},modifiers:[{stat:'atb_scale',multiplier:3}]}]),['p1']);
 b=applyBattleEffects(b,'a',act([{op:'atb',mode:'push',value:10}]),['p1']);
 assert.equal(cu(b,'p1').atb,80);
});

test('buff_cap：敌方增益时长被压到上限', ()=>{
 let b=arena();b=applyBattleEffects(b,'a',act([{op:'rule',rule:'buff_cap',key:'1',duration:{clock:'permanent',value:0}}]),['p1']);
 b=applyBattleEffects(b,'p1',act([{op:'modify',name:'长效增益',duration:{clock:'round',value:9},modifiers:[{stat:'evade',flat:.1}]}],'self'),['p1']);
 const s=unit(b,'p1').statuses!.find(x=>x.definition.name==='长效增益')!;assert.ok(s);assert.equal(s.remaining,1);
});

test('repeat_seal（T27 永不毕业）：同一技能用到第 3 次即被封，直到换新技能', ()=>{
 let b=arena();b=applyBattleEffects(b,'a',act([{op:'rule',rule:'repeat_seal',key:'3',duration:{clock:'permanent',value:0}}]),['p1']);
 for(let i=0;i<3;i++)b=fire(b,'p1','probe',['a']);
 assert.ok(actionUnavailable(b,unit(b,'p1'),'probe'),'第 3 次后应被封');
 assert.ok(!actionUnavailable(b,unit(b,'p2'),'probe'),'别人不受影响');
});

test('blank_page（T15 无字著述）：被涂白的技能下次使用作废，之后恢复', ()=>{
 let b=arena();b=fire(b,'p1','probe',['a']);
 b=applyBattleEffects(b,'a',act([{op:'rule',rule:'blank_page',key:'*',selection:'used_random',duration:{clock:'round',value:3},uses:1}]),['p1']);
 assert.ok(unit(b,'p1').statuses?.some(s=>s.rule?.kind==='blank_page'&&s.rule.key==='probe'),'按使用记录选中 probe');
 const hp=unit(b,'a').current.hp;
 b=fire(b,'p1','probe',['a']);
 assert.equal(unit(b,'a').current.hp,hp,'空白页：这一击应作废');
 assert.ok(!unit(b,'p1').statuses?.some(s=>s.rule?.kind==='blank_page'),'用掉后恢复');
 b=fire(b,'p1','probe',['a']);assert.ok(unit(b,'a').current.hp<hp,'之后照常命中');
});

test('draft（T22 未完树稿）：首次是草稿 ×0.3 并留线稿，落在线稿上的下一击 ×3', ()=>{
 let b=arena();b=applyBattleEffects(b,'a',act([{op:'rule',rule:'draft',key:'3',duration:{clock:'permanent',value:0}}]),['p1']);
 const base=(()=>{let x=arena();const hp=unit(x,'a').current.hp;x=fire(x,'p1','probe',['a']);return hp-unit(x,'a').current.hp;})();
 assert.ok(base>0);
 let hp=unit(b,'a').current.hp;b=fire(b,'p1','probe',['a']);const first=hp-unit(b,'a').current.hp;
 assert.ok(Math.abs(first-base*.3)<=1,'草稿 '+first+' vs '+base);assert.ok(unit(b,'a').statuses?.some(s=>s.definition.name==='线稿'),'留下线稿');
 hp=unit(b,'a').current.hp;b=fire(b,'p1','probe',['a']);const second=hp-unit(b,'a').current.hp;
 assert.ok(Math.abs(second-base*3)<=3,'定稿 '+second+' vs '+base);assert.ok(!unit(b,'a').statuses?.some(s=>s.definition.name==='线稿'),'线稿被用掉');
});

test('space isolate freeze（T44 入库）：隔离期间被隔离者的状态计时暂停，出库后照常走', ()=>{
 const idle=(x:Battle,ms:number)=>{x=structuredClone(x);for(let t=0;t<ms;t+=500){x.clock.pending=[];for(const c of x.clock.units)c.active=false;x=advanceBattle(x,Math.min(500,ms-t)).battle;}return x;};
 let b=arena();
 b=applyBattleEffects(b,'p1',act([{op:'modify',name:'长效',duration:{clock:'round',value:6},modifiers:[{stat:'evade',flat:.1}]}],'self'),['p1']);
 b=applyBattleEffects(b,'p2',act([{op:'modify',name:'对照',duration:{clock:'round',value:6},modifiers:[{stat:'evade',flat:.1}]}],'self'),['p2']);
 b=applyBattleEffects(b,'a',act([{op:'space',mode:'isolate',value:0,duration:{clock:'round',value:2},freeze:true}]),['p1']);
 const st=(x:Battle,id:string,name:string)=>x.units.find(u=>u.id===id)!.statuses!.find(s=>s.definition.name===name);
 b=idle(b,4000);
 assert.equal(st(b,'p2','对照')!.remaining,5,'对照组正常走一轮');
 assert.equal(st(b,'p1','长效')!.remaining,6,'入库者计时冻结');
 b=idle(b,8000);
 assert.ok(!st(b,'p1','空间隔离'),'隔离到期');
 assert.ok(st(b,'p1','长效')!.remaining<6,'出库后照常走');
});

test('契约：新增枚举都能通过 validateAction', ()=>{
 validateAction({...act([{op:'choose',actions:['x'],count:1,replace:false,weights:[2]}]),library:{actions:{x:act([])},statuses:{},summons:{},fields:{}}});
 validateAction(act([{op:'alter_event',mode:'redirect',recipient:'random_any'}]));
 validateAction(act([{op:'space',mode:'swap_pair',value:0},{op:'space',mode:'release',value:0},{op:'status_transform',mode:'swap_pair',polarity:'any'}]));
 validateAction(act([{op:'rule',rule:'element_rewrite',key:'火',selection:'used_random',duration:{clock:'round',value:3}},{op:'rule',rule:'draft',key:'3',duration:{clock:'permanent',value:0}}]));
});
