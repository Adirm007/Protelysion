/** 战斗规则（种族抗性 / 控制挣脱 / 决定性效果等级门槛 / 召唤物面板·时长·胜负·AI·「?」扫描）。合成夹具，不代表整卡通过。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {lowerBlueprint} from '../src/compiler/blueprint/lower';
import {parseEntry} from '../src/compiler/blueprint/parse';
import {raceAbility,raceTraits} from '../src/compiler/blueprint/race';
import {validateAction,type ActionSpec} from '../src/compiler/contract';
import {createBattle,applyBattleEffects,advanceBattle,escapeChance,lastStandLimit,auditInvulnerability,type Battle} from '../src/battle/executor';
import {monsterNumbers} from '../src/game/monsters/numbers';
import type {MonsterDesign} from '../src/game/monsters/catalog';
import {summonFocus} from '../src/game/combat-ai';
import {carriesTargetDamage,strayKit} from '../src/game/monsters/stray';
import {HOST_RULES} from '../src/compiler/rules';
import type {Blueprint,BPStep} from '../src/compiler/blueprint/types';
import type {CompiledActor} from '../src/compiler/engine';
import {card,mitigation} from './compiler-fixtures';

const attrs={力量:40,敏捷:40,体质:40,智力:40,精神:40};
const lower=(steps:BPStep[],key:string,kind:'active'|'passive'='active'):ActionSpec=>{const b:Blueprint={kind,steps};return validateAction(lowerBlueprint(b,{key,sourceId:'/技能/'+key,name:key,level:20,tier:5,power:3000,cost:4000,attributeFactor:1,attributes:attrs,passive:kind==='passive'}).action) as ActionSpec;};
function duel(allyLevel:number,enemyLevel:number,hp=1e5):Battle{
 const me=card(),foe=card();me.numeric.level=allyLevel;foe.numeric.level=enemyLevel;me.numeric.max={hp,mp:1e6,sp:1e6};foe.numeric.max={hp,mp:1e6,sp:1e6};
 return createBattle([{id:'u0',side:'ally',card:me,current:{...me.numeric.max},mitigation:mitigation()},{id:'u1',side:'enemy',card:foe,current:{...foe.numeric.max},mitigation:mitigation()}],11);
}
const u=(b:Battle,id:string)=>b.units.find(x=>x.id===id)!;
const hasStatus=(b:Battle,id:string,name:string)=>(u(b,id).statuses??[]).some(s=>!s.suppressed&&s.definition.name===name&&(s.clock==='permanent'||s.remaining>0));

test('种族：无战斗加成的种族不编成技能；抗性差异来自种族本质或原文', ()=>{
 const human={sourceId:'/种族/1',name:'人类',raw:'[本体][种族][智慧生物]人类 --- # 人类 生理: 短寿(60-70年)、适应力极强、高繁殖力 本质: 欲望驱动 分布: 遍布世界'};
 const h=raceAbility(human,{等级:5,属性:{力量:5,敏捷:5,体质:5,智力:5,精神:5}},HOST_RULES)!;
 assert.equal(h.mapping.disposition,'noncombat');assert.equal(h.mapping.action,null);
 const vamp={sourceId:'/种族/2',name:'血族',raw:'血族: 定义: 以血液为食 真实弱点: 法则克制: 高阶神圣/净化神术可瓦解其生命架构 伪弱点: 阳光 NOTE: 凡俗误信有效，实际完全免疫'};
 const t=raceTraits(vamp);assert.equal(t.resist.光,1.5);assert.equal(t.resist.暗,.5);
 const v=raceAbility(vamp,{等级:5,属性:{力量:5,敏捷:5,体质:5,智力:5,精神:5}},HOST_RULES)!;
 assert.equal(v.mapping.disposition,'passive');
 const els=JSON.stringify(v.mapping.action);assert.match(els,/"element":"光"/);
 // 原文明写的状态免疫
 assert.deepEqual(raceTraits({sourceId:'/种族/3',name:'泰坦',raw:'神性之躯: 免疫幻术、惑术及多数物理/魔法攻击'}).immune.sort(),['混乱','魅惑'].sort());
 // 列举的“例子”不当成本种族特征
 assert.deepEqual(raceTraits({sourceId:'/种族/4',name:'异域生物',raw:'定义: 泛指来自其它位面的生物\n例子:\n - 天使\n - 魔鬼(九层地狱)'}).resist,{});
});

test('控制挣脱：概率随等级差变化，限定5%~95%', ()=>{
 assert.equal(escapeChance(10,10),.2);assert.equal(escapeChance(30,10),.95);assert.equal(escapeChance(1,10),.05);
 assert.ok(Math.abs(escapeChance(15,10)-.6)<1e-9);
});

test('控制挣脱：无持续上限的敌方硬控，被控者每回合免费判定并最终挣脱', ()=>{
 let b=duel(20,12);
 const stun=lower([{do:'status',status:{name:'永固',polarity:'negative',control:'stun'},permanent:true}],'perma-stun');
 b=applyBattleEffects(b,'u1',stun,['u0'],'effect','/技能/永固');
 assert.ok(hasStatus(b,'u0','永固'),'高等级目标也能被控（可挣脱的控制照常生效）');
 for(let i=0;i<12&&hasStatus(b,'u0','永固');i++)b=advanceBattle(b,4000).battle;
 assert.ok(!hasStatus(b,'u0','永固'),'等级高8级时每回合约84%挣脱');
 assert.ok(b.log.some(l=>l.kind==='escape'));
});

test('控制挣脱：自身施加的控制不做挣脱判定', ()=>{
 let b=duel(20,12);
 const self=lower([{do:'status',status:{name:'蓄力',polarity:'negative',control:'stun'},turns:3,target:{side:'self'}}],'self-stun');
 b=applyBattleEffects(b,'u0',self,['u0'],'effect','/技能/蓄力');
 b=advanceBattle(b,4000).battle;assert.ok(!b.log.some(l=>l.kind==='escape'));
});

test('决定性：不可对同级及以上目标续控；对低等级目标可以续', ()=>{
 const stun=lower([{do:'status',status:{name:'禁锢',polarity:'negative',control:'stun'},turns:3}],'lock');
 let b=duel(10,10);b=applyBattleEffects(b,'u1',stun,['u0'],'effect','/技能/a');
 const again=lower([{do:'status',status:{name:'禁锢2',polarity:'negative',control:'freeze'},turns:3}],'lock2');
 b=applyBattleEffects(b,'u1',again,['u0'],'effect','/技能/b');
 assert.ok(hasStatus(b,'u0','禁锢'));assert.ok(!hasStatus(b,'u0','禁锢2'),'同级目标已被同一来源禁止行动时不能叠控续控');
 let low=duel(5,10);low=applyBattleEffects(low,'u1',stun,['u0'],'effect','/技能/a');low=applyBattleEffects(low,'u1',again,['u0'],'effect','/技能/b');
 assert.ok(hasStatus(low,'u0','禁锢2'),'低等级目标可以被续控');
});

test('决定性：斩杀/秒杀只对低等级目标生效，否则按普通伤害', ()=>{
 const execute=lower([{do:'damage',power:10,channel:'physical',executeBelowPct:50}],'exec');
 let b=duel(10,10,1000);u(b,'u0').current.hp=400;
 b=applyBattleEffects(b,'u1',execute,['u0'],'effect','/技能/斩');
 assert.ok(u(b,'u0').current.hp>0,'同级：斩杀线不生效');
 assert.ok(b.log.some(l=>l.kind==='decisive_blocked'));
 let low=duel(5,10,1000);u(low,'u0').current.hp=400;
 low=applyBattleEffects(low,'u1',execute,['u0'],'effect','/技能/斩');
 assert.ok(u(low,'u0').current.hp<=0,'低等级：斩杀生效');
 // 无条件秒杀（按目标当前生命100%）：对高等级按一次普通伤害
 const kill=lower([{do:'damage',channel:'true',pctCurrentHp:100,execute:true}],'kill');
 let hi=duel(20,10,1e5);hi=applyBattleEffects(hi,'u1',kill,['u0'],'effect','/技能/秒');
 assert.ok(u(hi,'u0').current.hp>0&&u(hi,'u0').current.hp<1e5,'高等级：只受普通伤害');
 let lo=duel(5,10,1e5);lo=applyBattleEffects(lo,'u1',kill,['u0'],'effect','/技能/秒');
 assert.ok(u(lo,'u0').current.hp<=0,'低等级：秒杀生效');
});

test('决定性：免疫一切只挡等级低于自己的来源', ()=>{
 const immune=lower([{do:'immune',to:['*'],permanent:true,target:{side:'self'}}],'imm','passive');
 const debuff=lower([{do:'status',status:'虚弱',turns:2}],'weak');
 for(const [enemyLevel,blocked] of [[5,true],[10,false],[15,false]] as const){
  let b=duel(10,enemyLevel);b=applyBattleEffects(b,'u0',immune,['u0'],'effect','/技能/免疫');
  b=applyBattleEffects(b,'u1',debuff,['u0'],'effect','/技能/弱化');
  assert.equal(hasStatus(b,'u0','虚弱'),!blocked,`敌方${enemyLevel}级`);
 }
});

test('召唤：同级=普通怪物面板，不复制召唤者属性；原文明写继承%才继承；未写时长伴随整场', ()=>{
 const a=lower([{do:'summon',summon:{name:'魔像',level:'caster'}}],'golem');
 const tpl=Object.values(a.library!.summons)[0]!;
 assert.deepEqual(tpl.panel,{build:'guard'});assert.equal(tpl.inheritance,0);assert.equal(tpl.duration.clock,'permanent');
 const timed=lower([{do:'summon',summon:{name:'狼',level:'caster',turns:3,inheritPct:40}}],'wolf');
 const t2=Object.values(timed.library!.summons)[0]!;assert.equal(t2.panel,undefined);assert.equal(t2.inheritance,.4);assert.notEqual(t2.duration.clock,'permanent');
 let b=duel(12,12);u(b,'u0').attributes={力量:99,敏捷:99,体质:99,智力:99,精神:99};
 b=applyBattleEffects(b,'u0',a,['u0'],'effect','/技能/召唤');
 const s=b.units.find(x=>x.owner==='u0')!;const n=monsterNumbers({build:'guard',role:'普通'} as MonsterDesign,12);
 assert.equal(s.level,12);assert.deepEqual(s.attributes,n.attributes);assert.equal(s.max.hp,n.max.hp);
});

test('召唤：本地解析只采用原文写明的持续时间', ()=>{
 const ctx={name:'x',sourceId:'/技能/x',level:12,tier:3,power:400,cost:400};
 const p1=parseEntry({sourceId:'/技能/x',name:'x',raw:{品质:'稀有',类型:'主动',效果:'召唤一个与自身等级相同的魔像协助作战'}},ctx)!;
 const sm1=JSON.stringify(p1.main);assert.match(sm1,/"summon"/);assert.doesNotMatch(sm1,/"turns"/);assert.doesNotMatch(sm1,/inheritPct/);
 const p2=parseEntry({sourceId:'/技能/x',name:'x',raw:{品质:'稀有',类型:'主动',效果:'召唤一个魔像协助作战，持续3回合'}},ctx)!;
 assert.match(JSON.stringify(p2.main),/"turns":3/);
});

test('胜负：我方召唤物不计入，真人全灭即失败；敌方召唤物照常计入', ()=>{
 const summon=lower([{do:'summon',summon:{name:'魔像',level:'caster'}}],'golem2');
 let b=duel(10,10,1000);b=applyBattleEffects(b,'u0',summon,['u0'],'effect','/技能/召唤');
 u(b,'u0').current.hp=0;b=advanceBattle(b,10).battle;
 assert.equal(b.outcome,'defeat');
 // 召唤者死亡时召唤物默认消散；这里用“召唤者死亡后仍留场”的模板验证敌方召唤物计入胜负。
 const persist=structuredClone(summon);for(const t of Object.values(persist.library!.summons))t.ownerDeath='persist';
 let e=duel(10,10,1000);e=applyBattleEffects(e,'u1',persist,['u1'],'effect','/技能/召唤');
 u(e,'u1').current.hp=0;e=advanceBattle(e,10).battle;
 assert.notEqual(e.outcome,'victory','敌方召唤物仍存活时战斗继续');
});

test('AI：默认打召唤师；坦克召唤物绕过；脆皮输出召唤物先清', ()=>{
 const tank=lower([{do:'summon',summon:{name:'魔像',level:'caster'}}],'t');
 let b=duel(10,10,1000);b=applyBattleEffects(b,'u0',tank,['u0'],'effect','/技能/召唤');
 const golem=b.units.find(x=>x.owner==='u0')!;
 assert.ok(summonFocus(b,u(b,'u0'))>summonFocus(b,golem),'坦克召唤物：打召唤师');
 golem.tags=['summon'];golem.max.hp=100;golem.current.hp=100;
 assert.ok(summonFocus(b,golem)>summonFocus(b,u(b,'u0')),'脆皮输出召唤物：先清召唤物');
});

test('「?」：召唤物（含尚未召唤的模板）带百分比/真实伤害时也被扫描，并复制召唤师与召唤物的招式', ()=>{
 const summoner=lower([{do:'summon',summon:{name:'影刃',level:'caster',steps:[{do:'damage',channel:'true',pctMaxHp:5}]}}],'shadow');
 const c=card(summoner,'/技能/影刃召唤');
 const plain:CompiledActor=card();
 assert.equal(carriesTargetDamage(plain),false);assert.equal(carriesTargetDamage(c),true);
 const kit=strayKit(10,[c]);
 const ids=kit.card.skills.map(s=>s.sourceId);
 assert.ok(ids.some(x=>x.endsWith('/技能/影刃召唤')),'复制召唤师的技能');
 assert.ok(ids.some(x=>x.includes('/summon/')),'复制召唤物的招式');
});

// ---- 己方保命效果上限（锁血 / 免死 / 不死 / 倒地复活）与“一切伤害无效”的等级门槛
const nuke=()=>lower([{do:'damage',channel:'true',power:400}],'nuke');
function hitUntilDown(b:Battle,max=12):{battle:Battle;saves:number}{
 let saves=0;for(let i=0;i<max;i++){b=applyBattleEffects(b,'u1',nuke(),['u0'],'effect','/技能/nuke');if(!u(b,'u0').defeated)saves++;else break;}
 return {battle:b,saves};
}

test('保命上限：无次数限制的锁血，单场最多发动 = 层级 次', ()=>{
 assert.equal(lastStandLimit(20),5);assert.equal(lastStandLimit(12),3);
 let b=duel(20,20,300);
 b=applyBattleEffects(b,'u0',lower([{do:'death_guard',uses:0,keepHp:1}],'lock'),['u0'],'effect','/技能/锁血');
 const r=hitUntilDown(b);
 assert.equal(r.saves,5,'20级=第5层，锁血最多挡5次');
 assert.ok(u(r.battle,'u0').defeated,'第6次致命伤害照常倒下');
 assert.ok(r.battle.log.some(l=>l.kind==='last_stand_capped'));
});

test('保命上限：原文写明次数的按原文（每场1次）', ()=>{
 let b=duel(20,20,300);
 b=applyBattleEffects(b,'u0',lower([{do:'death_guard',uses:1,keepHp:1}],'once'),['u0'],'effect','/技能/一次');
 const r=hitUntilDown(b);
 assert.equal(r.saves,1);assert.ok(u(r.battle,'u0').defeated);
});

test('保命上限：常驻不死每挡一次致命都计数', ()=>{
 let b=duel(12,12,300);
 b=applyBattleEffects(b,'u0',lower([{do:'undying',permanent:true}],'undying'),['u0'],'effect','/技能/不死');
 const r=hitUntilDown(b);
 assert.equal(r.saves,3,'12级=第3层');assert.ok(u(r.battle,'u0').defeated);
});

test('保命上限：“每当HP归零时复活”的被动触发，按层级封顶', ()=>{
 const passive=lowerBlueprint({kind:'passive',steps:[],triggers:[{on:'lethal',steps:[{do:'revive',pct:50,target:{side:'self',life:'downed'}}]}]} as unknown as Blueprint,{key:'phoenix',sourceId:'/技能/不灭',name:'不灭',level:12,tier:3,power:3000,cost:4000,attributeFactor:1,attributes:attrs,passive:true}).action;
 const me=card(validateAction(passive) as ActionSpec,'/技能/不灭'),foe=card();(me.skills[0]!.mapping as {disposition:string}).disposition='passive';me.numeric.level=12;foe.numeric.level=12;me.numeric.max={hp:300,mp:1e6,sp:1e6};foe.numeric.max={hp:300,mp:1e6,sp:1e6};
 const b=createBattle([{id:'u0',side:'ally',card:me,current:{...me.numeric.max},mitigation:mitigation()},{id:'u1',side:'enemy',card:foe,current:{...foe.numeric.max},mitigation:mitigation()}],11);
 const r=hitUntilDown(b);
 assert.equal(r.saves,3,'第3层：最多靠触发复活站起来3次');assert.ok(r.battle.log.some(l=>l.kind==='last_stand_capped'));
 assert.ok(u(r.battle,'u0').defeated);
});

test('一切伤害无效：写成全抗性0的常驻修正，只挡低等级攻击者', ()=>{
 const els=['物','火','水','暗','光','精'];
 const sanctum={...nuke(),target:'self',effects:[{op:'modify',name:'圣域',duration:{clock:'permanent',value:0},modifiers:els.map(element=>({stat:'element',element,multiplier:0}))}]} as unknown as ActionSpec;
 const fire=lower([{do:'damage',channel:'energy',element:'火',power:5}],'fire');
 const hit=(foeLevel:number)=>{let b=duel(20,foeLevel);b=applyBattleEffects(b,'u0',validateAction(sanctum) as ActionSpec,['u0'],'effect','/技能/圣域');const before=u(b,'u0').current.hp;b=applyBattleEffects(b,'u1',fire,['u0'],'effect','/技能/火');return before-u(b,'u0').current.hp;};
 assert.equal(hit(10),0,'低等级攻击者完全无效');
 assert.ok(hit(20)>0,'同级攻击者按正常抗性结算');
 assert.ok(hit(25)>0,'高等级攻击者按正常抗性结算');
});

test('一切伤害无效：immune:["damage"] 降级为 immune_channel "*"，同样受等级门槛', ()=>{
 const a=lower([{do:'immune',to:['damage'],permanent:true,target:{side:'self'}}],'nullify');
 assert.match(JSON.stringify(a.effects),/"rule":"immune_channel","key":"\*"/);
 const hit=(foeLevel:number)=>{let b=duel(20,foeLevel);b=applyBattleEffects(b,'u0',a,['u0'],'effect','/技能/无效');const before=u(b,'u0').current.hp;b=applyBattleEffects(b,'u1',lower([{do:'damage',channel:'physical',power:5}],'hit'),['u0'],'effect','/技能/打');return before-u(b,'u0').current.hp;};
 assert.equal(hit(10),0);assert.ok(hit(20)>0);
});

test('解析：“每当HP归零时复活”不写成1次，交给层级上限', ()=>{
 const s=parseEntry({sourceId:'/技能/9',name:'不朽',raw:{品质:'稀有',类型:'被动',效果:'每当HP归零时，以30%HP复活。'}},{name:'不朽',sourceId:'/技能/9',level:12,tier:3,power:400,cost:400})!;
 const dg=JSON.stringify(s);assert.match(dg,/death_guard/);assert.match(dg,/"uses":0/);
 const once=JSON.stringify(parseEntry({sourceId:'/技能/8',name:'复苏',raw:{品质:'稀有',类型:'被动',效果:'HP归零时以30%HP复活(每场1次)。'}},{name:'复苏',sourceId:'/技能/8',level:12,tier:3,power:400,cost:400}));assert.match(once,/"uses":1/);
});

test('保命上限：原文次数超过层级（可复活99次）按层级封顶', ()=>{
 let b=duel(12,12,300);
 b=applyBattleEffects(b,'u0',lower([{do:'death_guard',uses:99,keepHp:1}],'many'),['u0'],'effect','/技能/九十九');
 const r=hitUntilDown(b);assert.equal(r.saves,3);assert.ok(u(r.battle,'u0').defeated);
});

test('保命上限：只限制玩家一方；「？」复制走的技能同样受限', ()=>{
 const foeHits=(key:string)=>{let b=duel(12,12,300);b=applyBattleEffects(b,'u1',lower([{do:'death_guard',uses:0,keepHp:1}],'lock'),['u1'],'effect',key);let saves=0;
  for(let i=0;i<8;i++){b=applyBattleEffects(b,'u0',nuke(),['u1'],'effect','/技能/nuke');if(!u(b,'u1').defeated)saves++;else break;}return saves;};
 assert.equal(foeHits('/怪物/锁血'),8,'手工设计的敌方机制不受层级上限');
 assert.equal(foeHits('stray/0//技能/锁血'),3,'「？」复制的玩家技能按层级封顶');
});

test('HP归零时恢复生命 = 先复活再回血（倒地触发里的治疗）', ()=>{
 const passive=lowerBlueprint({kind:'passive',steps:[],triggers:[{on:'lethal',steps:[{do:'heal',resource:'hp',pct:40,target:{side:'self'}}]}]} as Blueprint,{key:'rise',sourceId:'/技能/归零回复',name:'归零回复',level:12,tier:3,power:3000,cost:4000,attributeFactor:1,attributes:attrs,passive:true}).action;
 const me=card(validateAction(passive) as ActionSpec,'/技能/归零回复'),foe=card();(me.skills[0]!.mapping as {disposition:string}).disposition='passive';me.numeric.level=12;foe.numeric.level=12;me.numeric.max={hp:300,mp:1e6,sp:1e6};foe.numeric.max={hp:300,mp:1e6,sp:1e6};
 const b=createBattle([{id:'u0',side:'ally',card:me,current:{...me.numeric.max},mitigation:mitigation()},{id:'u1',side:'enemy',card:foe,current:{...foe.numeric.max},mitigation:mitigation()}],11);
 const first=applyBattleEffects(b,'u1',nuke(),['u0'],'effect','/技能/nuke');
 assert.equal(u(first,'u0').current.hp,120,'复活后回复40%');assert.ok(first.log.some(l=>l.kind==='revive'));
 const r=hitUntilDown(b);assert.equal(r.saves,3,'同样受层级上限');
});

// ---- 技能组整体审查：变相常驻的无敌只对低等级生效
function kit(level:number,skills:{id:string;action:ActionSpec;passive?:boolean}[]){
 const c=card(skills[0]!.action,skills[0]!.id);c.skills=skills.map(x=>({sourceId:x.id,name:x.id.slice(4),sourceFingerprint:'{}',mapping:{sourceId:x.id,disposition:x.passive?'passive':'active',reason:'test',action:x.action}})) as typeof c.skills;
 c.numeric.level=level;c.numeric.max={hp:1e5,mp:1000,sp:1000};return c;
}
const aegis=()=>{const a=lower([{do:'immune',to:['damage'],turns:1,target:{side:'ally',select:'all'}}],'aegis');a.cost={...a.cost,mp:{flat:0,maxFraction:1}};return a;};
const manaWell=()=>validateAction(lowerBlueprint({kind:'passive',steps:[],triggers:[{on:'round',steps:[{do:'heal',resource:'mp',pct:100,target:{side:'self'}}]}]} as Blueprint,{key:'well',sourceId:'/技能/回魔',name:'回魔',level:20,tier:5,power:3000,cost:4000,attributeFactor:1,attributes:attrs,passive:true}).action) as ActionSpec;
function shielded(skills:{id:string;action:ActionSpec;passive?:boolean}[],foeLevel:number,strike=lower([{do:'damage',channel:'physical',power:5}],'hit')){
 const me=kit(20,skills),foe=card();foe.numeric.level=foeLevel;foe.numeric.max={hp:1e5,mp:1e6,sp:1e6};
 let b=createBattle([{id:'u0',side:'ally',card:me,current:{...me.numeric.max},mitigation:mitigation()},{id:'u1',side:'enemy',card:foe,current:{...foe.numeric.max},mitigation:mitigation()}],11);
 b=applyBattleEffects(b,'u0',u(b,'u0').actions['/技能/圣盾']!,['u0'],'effect','/技能/圣盾');
 const before=u(b,'u0').current.hp;b=applyBattleEffects(b,'u1',strike,['u0'],'effect','/技能/打');return {taken:before-u(b,'u0').current.hp,battle:b};
}

test('技能组审查：消耗100%MP、一回合全队免疫伤害——正常技能，对高等级也生效', ()=>{
 const r=shielded([{id:'/技能/圣盾',action:aegis()}],25);
 assert.equal(u(r.battle,'u0').invuln?.['/技能/圣盾'],'bounded');
 assert.equal(r.taken,0,'高5级的攻击者也被挡住');
});

test('技能组审查：再配一个“每回合回复100%MP”的被动，就成了变相常驻，对同级/高等级无效', ()=>{
 const skills=[{id:'/技能/圣盾',action:aegis()},{id:'/技能/回魔',action:manaWell(),passive:true}];
 const high=shielded(skills,25);
 assert.equal(u(high.battle,'u0').invuln?.['/技能/圣盾'],'perpetual');
 assert.ok(high.taken>0,'高等级攻击者照常造成伤害');
 assert.equal(shielded(skills,12).taken,0,'对低等级仍然有效');
});

test('技能组审查：免费无冷却、可以每回合续的无敌也是变相常驻', ()=>{
 const free=lower([{do:'immune',to:['damage'],turns:1,target:{side:'self'}}],'free');
 assert.equal(auditInvulnerability({actions:{'/技能/圣盾':free},passives:{},library:free.library,max:{hp:1e5,mp:1000,sp:1000},current:{hp:1e5,mp:1000,sp:1000},stats:{}} as never)['/技能/圣盾'],'perpetual');
 const limited={...free,perBattleUses:3};
 assert.equal(auditInvulnerability({actions:{'/技能/圣盾':limited},passives:{},library:free.library,max:{hp:1e5,mp:1000,sp:1000},current:{hp:1e5,mp:1000,sp:1000},stats:{}} as never)['/技能/圣盾'],'bounded','每场3次、每次1回合');
});

test('免疫一切 vs 必定造成伤害：等级>速度>随机', ()=>{
 const sure=(lvl:number)=>shielded([{id:'/技能/圣盾',action:aegis()}],lvl,lower([{do:'damage',channel:'physical',power:5,ignore:['immunity']}],'sure')).taken;
 assert.ok(sure(25)>0,'高等级的必定伤害压过正常免疫');
 assert.equal(sure(15),0,'低等级的必定伤害压不过');
 assert.equal(shielded([{id:'/技能/圣盾',action:aegis()}],25).taken,0,'不带必定伤害时正常免疫照挡');
});
