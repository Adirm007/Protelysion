/** 蓝图编译：动词降级、本地解析语义、整卡离线编译（本地蓝图，非真实模型）与模型蓝图协议。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {lowerBlueprint} from '../src/compiler/blueprint/lower';
import {parseEntry} from '../src/compiler/blueprint/parse';
import {normalizeBlueprint,type Blueprint,type BPStep} from '../src/compiler/blueprint/types';
import {BLUEPRINT_BATCH} from '../src/compiler/blueprint/compile';
import {validateAction,type ActionSpec} from '../src/compiler/contract';
import {assertExecutable,assertPassive,createBattle,applyBattleEffects,actionUnavailable,advanceBattle,chooseAction,resolveAction} from '../src/battle/executor';
import {createCompilationEngine,sourceEntries,validateCompiled,type CompiledActor} from '../src/compiler/engine';
import {HOST_RULES} from '../src/compiler/rules';
import {hostSkillScale} from '../src/compiler/host-skill-scale';
import {card,mitigation,damageAction} from './compiler-fixtures';
import type {Obj} from '../src/core/actors';
import {combatProjection} from '../src/core/cache';

const attrs={力量:40,敏捷:40,体质:40,智力:40,精神:40};
const ctx=(passive:boolean,key='t')=>({key,sourceId:'/技能/'+key,name:key,level:20,tier:5,power:3000,cost:4000,attributeFactor:1,attributes:attrs,passive});
const bp=(steps:BPStep[],extra:Partial<Blueprint>={}):Blueprint=>({kind:'active',steps,...extra});
const lowerOk=(b:Blueprint,key:string)=>{const low=lowerBlueprint(b,ctx(b.kind==='passive',key));const a=validateAction(low.action) as ActionSpec;if(low.disposition==='passive')assertPassive(a);else assertExecutable(a);return {low,a};};
const duel=(a:ActionSpec,passive:boolean)=>{const me=card(passive?undefined:a);me.numeric.max={hp:1e6,mp:1e6,sp:1e6};const foe=card();foe.numeric.max={hp:1e6,mp:1e6,sp:1e6};
 return createBattle([{id:'u0',side:'ally',card:me,current:{...me.numeric.max},mitigation:mitigation()},{id:'u1',side:'enemy',card:foe,current:{...foe.numeric.max},mitigation:mitigation()}],7);};

const SAMPLES:[string,Blueprint][]=[
 ['damage',bp([{do:'damage',power:1200,channel:'physical+mental',hits:3,crit:{chance:.3,mult:2},pierce:20,lifesteal:30,onHit:[{do:'status',status:'流血',turns:2}]}])],
 ['damage-pct',bp([{do:'damage',pctMaxHp:10,channel:'true',executeBelowPct:15,ignore:['shield']}])],
 ['damage-random',bp([{do:'damage',power:10,randomHits:{min:1,max:10000},sure:true}])],
 ['heal',bp([{do:'heal',pct:30,resource:'mp+sp'},{do:'heal',pct:20,resource:'hp',target:{side:'ally',select:'all'}}])],
 ['shield',bp([{do:'shield',pct:25,turns:3}])],
 ['status-std',bp([{do:'status',status:'眩晕',turns:1,save:{attr:'体质',dc:25}}])],
 ['status-custom',bp([{do:'status',status:{name:'破绽',polarity:'negative',mods:[{stat:'受到伤害',pct:80}],control:'no_action',consumeOn:'damaged',stackable:true},turns:1}])],
 ['status-dot',bp([{do:'status',status:{name:'腐蚀',polarity:'negative',dotPct:3,dispellable:false,stackable:true,maxStacks:5},turns:3}])],
 ['stat',bp([{do:'stat',mods:[{stat:'伤害',pct:30},{stat:'闪避',add:5}],target:{side:'self'},turns:3}])],
 ['guard-reflect-counter',bp([{do:'guard',pct:40,channels:['physical','energy']},{do:'reflect',pct:50,uses:1},{do:'counter',pctOfDamage:200,turns:2}])],
 ['dodge-sure',bp([{do:'dodge',uses:1},{do:'sure_hit',uses:2}])],
 ['death-undying',bp([{do:'death_guard',uses:1,keepHp:1,healPct:50},{do:'undying',turns:2}])],
 ['revive-immune',bp([{do:'revive',pct:30},{do:'immune',to:'stun',uses:1}])],
 ['cleanse-dispel-steal',bp([{do:'cleanse'},{do:'dispel',count:2},{do:'steal',count:1}])],
 ['summon',bp([{do:'summon',summon:{name:'影子',count:2,level:'caster',inheritPct:50,power:800,turns:3}}])],
 ['field',bp([{do:'field',name:'禁域',affects:'enemy',mods:[{stat:'速度',pct:-20}],dotPct:2,turns:3}])],
 ['form',bp([{do:'form',form:{name:'血魔形态',turns:4,mods:[{stat:'全属性',add:3}],drainPct:5}}])],
 ['atb',bp([{do:'atb',mode:'push',value:30,target:{side:'self'}},{do:'atb',mode:'delay',value:20}])],
 ['interrupt-seal',bp([{do:'interrupt'},{do:'seal',what:'item',turns:2}])],
 ['copy-swap',bp([{do:'copy',what:'last'},{do:'swap',what:'hp'}])],
 ['invert-drain-burn',bp([{do:'invert',polarity:'negative',target:{side:'self'}},{do:'drain',resource:'mp',pct:10},{do:'burn',resource:'sp',pct:10}])],
 ['time-stop-consume',bp([{do:'time_stop',turns:1},{do:'consume',status:'血矢待发'}])],
 ['check',bp([{do:'damage',power:800},{do:'check',attr:'力量',vs:'体质',success:[{do:'status',status:'眩晕',turns:1}],failure:[{do:'damage',power:1200,ignore:['reduction']}]}])],
 ['branch-random',bp([{do:'branch',when:[{kind:'target_hp_below',value:30}],then:[{do:'damage',power:2000}],else:[{do:'damage',power:500}]},{do:'random',options:[[{do:'damage',power:700,hits:3}],[{do:'damage',power:700,target:{side:'enemy',select:'all'}}]]}])],
 ['cancel-untargetable',bp([{do:'cancel',chance:.3},{do:'untargetable',turns:1}])],
 ['no-heal-luck-reveal',bp([{do:'no_heal',turns:2},{do:'luck',uses:1},{do:'reveal'}])],
 ['passive-caps',bp([{do:'damage_cap',pctMaxHp:33},{do:'mana_shield',pct:50,resource:'mp'},{do:'lifesteal_passive',pct:10},{do:'share',pct:20}],{kind:'passive'})],
 ['passive-triggers',bp([{do:'stat',mods:[{stat:'物理伤害',add:2000}]}],{kind:'passive',triggers:[{on:'hit',chance:.25,steps:[{do:'status',status:'流血',turns:3}]},{on:'kill',steps:[{do:'atb',mode:'extra_turn'}]},{on:'hp_below',hpPct:50,uses:1,steps:[{do:'summon',summon:{name:'分身',count:1}}]},{on:'dodge',steps:[{do:'status',status:{name:'破绽',polarity:'negative',control:'no_action'},turns:1}]},{on:'round',steps:[{do:'heal',pct:10,target:{side:'ally',select:'all'}}]}]})],
 ['costs',bp([{do:'damage',power:3000}],{cost:{hpPct:10,mpPct:50},perBattle:1,cooldown:3,castRounds:1,firstStrike:true,requires:[{kind:'allies_alive_at_least',value:3}]})],
];
for(const [name,b] of SAMPLES)test('蓝图动词降级并可在战斗中执行：'+name,()=>{
 const {low,a}=lowerOk(b,name);let battle=duel(a,low.disposition==='passive');
 if(low.disposition==='active')battle=applyBattleEffects(battle,'u0',a,[a.target==='enemy'?'u1':'u0'],'effect','/技能/'+name);
 assert.deepEqual(JSON.parse(JSON.stringify(battle)),battle);
});

test('宽松规范化：模型常见写法可归一',()=>{
 const b=normalizeBlueprint({name:'x',kind:'主动',steps:[{do:'damage',power:'8000',channel:'物理',target:{side:'敌人',select:'全体'}},{do:'status',status:'眩晕',turns:'1回合',chance:'30%'}]})!;
 assert.equal(b.kind,'active');assert.equal(b.steps[0]!.power,8000);assert.deepEqual(b.steps[0]!.target,{side:'enemy',select:'all'});assert.equal(b.steps[1]!.chance,.3);
 lowerOk(b,'norm');
});

const pctx={name:'x',sourceId:'/技能/x',level:24,tier:6,power:8000,cost:25000};
const parse=(sourceId:string,raw:unknown)=>parseEntry({sourceId,name:sourceId.split('/').pop()!,raw},{...pctx,sourceId})!;
test('本地解析：标签中的威力、对抗检定与原文自定义状态',()=>{
 const r=parse('/技能/大上段',{品质:'神话',类型:'主动',标签:['威力: 8000'],描述:'效果: 1. 本次攻击无视对方所有闪避加成。2. 命中后进行对抗检定(自身力量vs敌方体质)：成功则为对方附加[崩势]，对方力量检定－6、敏捷检定－6、体质检定-6，持续2回合；失败则额外追加一段无视防御的150%威力剑气斩击'});
 const [dmg,check]=r.main.steps;assert.equal(dmg!.do,'damage');assert.equal(dmg!.power,8000);assert.equal(check!.do,'check');
 const succ=(check!.success as BPStep[])[0]!;assert.equal((succ.status as {name:string}).name,'崩势');
 assert.equal((check!.failure as BPStep[])[0]!.power,12000);
});
test('本地解析：“无法解除”的状态仍会施加，括号定义的状态以原文命名',()=>{
 const r=parse('/技能/力比多源流',{品质:'神话',类型:'主动',标签:['控制','精神'],描述:'强行使低于自己层级的目标陷入不通过性行为就无法解除的[发情]状态，对同层级目标需进行精神检定(DC25)'});
 assert.ok(r.main.steps.some(s=>s.do==='status'&&s.status==='发情'));
 const f=parse('/登神长阶/法则/一闪',{阶段:'法则',原文:{描述:'被动: 有刀之位\n遭受[任何]攻击时，均可进行一次及时对抗判定（己方[力量+敏捷]vs敌方[力量+敏捷]）。成功则将攻击[弹开]，完全无视本次攻击伤害和特效，并使对方陷入[破绽]状态(1回合内无法使用[动作]，下次受到伤害+80%)，该状态可叠加多层，敌方受击后全部消耗'}});
 const all=[...f.main.steps,...(f.main.triggers??[]).flatMap(t=>t.steps)];
 const st=all.find(s=>s.do==='status')!;assert.equal((st.status as {name:string}).name,'破绽');assert.equal((st.status as {control:string}).control,'no_action');
 assert.ok(!f.main.steps.some(s=>s.do==='stat'&&JSON.stringify(s).includes('受到伤害')),'敌方易伤只能来自具名状态，不能变成常驻光环');
});
test('本地解析：共计N次攻击与同目标追加条款不会抬高每段威力',()=>{
 const r=parse('/技能/火力压制',{品质:'神话',类型:'主动',标签:['威力: 每段1000'],描述:'向范围内所有敌人发射弹幕，共计15次攻击，若15次均对同一目标发动，最后一次攻击造成500%伤害'});
 const d=r.main.steps.find(s=>s.do==='damage')!;assert.equal(d.power,1000);assert.equal(d.hits,15);
});

// ---- 整卡：语料卡（由两份只读参考结构化得到的 MVU 角色数据），离线模型 → 本地蓝图
type Card={uid:number;corpus:string;name:string;disabled:boolean;source:Obj};
const corpus=JSON.parse(readFileSync(new URL('./blueprint-corpus.fixture.json',import.meta.url),'utf8')) as Card[];
const EMPTY=/^[口\s]*(?:受不知名信号干扰，?暂不可见)?[口\s]*$/;
for(const c of corpus)test(`整卡本地蓝图编译（离线，非真实模型）：${c.corpus} ${c.uid} ${c.name}`,async()=>{
 const engine=createCompilationEngine(async()=>{throw Error('offline');},HOST_RULES);
 const source=combatProjection(structuredClone(c.source));const result=await engine.compile(source,undefined,[]);const actor=validateCompiled(result.actor);
 const entries=sourceEntries(source,HOST_RULES).filter(e=>!e.sourceId.startsWith('/种族/'));
 const replaced=actor.skills.filter(s=>entries.some(e=>e.sourceId===s.sourceId)&&s.adaptation?.mode==='replacement'&&!EMPTY.test(JSON.stringify(entries.find(e=>e.sourceId===s.sourceId)!.raw).replace(/[{}":,\[\]]|描述|效果|品质|类型|标签|消耗|主动|被动|普通|优良|稀有|史诗|传说|神话|唯一|阶段|原文|要素|权能|法则/g,'')));
 assert.deepEqual(replaced.map(s=>s.sourceId),[],'非空原文不应落到同阶替换');
 const errors=runAll(actor);assert.deepEqual(errors,[]);
});
function runAll(actor:CompiledActor):string[]{
 const foe=card();foe.numeric.max={hp:1e9,mp:1e9,sp:1e9};const me=structuredClone(actor);me.numeric.max={hp:1e8,mp:1e8,sp:1e8};const errors:string[]=[];
 const mk=()=>createBattle([{id:'u0',side:'ally',card:me,current:{...me.numeric.max},mitigation:mitigation()},{id:'u1',side:'enemy',card:foe,current:{...foe.numeric.max},mitigation:mitigation()}],11);
 let battle;try{battle=mk();}catch(err){return ['createBattle: '+(err as Error).message];}
 for(const s of me.skills){const list=[...(s.mapping.disposition==='active'&&s.mapping.action?[s.mapping.action]:[]),...(s.mapping.actions??[])];
  list.forEach((a,i)=>{try{battle=applyBattleEffects(battle!,'u0',a,[a.target==='enemy'?'u1':'u0'],'effect',i?`${s.sourceId}:${i}`:s.sourceId);}catch(err){errors.push(`${s.sourceId}#${i}: ${(err as Error).message.slice(0,160)}`);battle=mk();}});}
 return errors;
}

test('模型蓝图协议：按每批至多6条分批请求，坏条目按条回退本地蓝图',async()=>{
 const c=corpus.find(x=>sourceEntries(combatProjection(structuredClone(x.source)),HOST_RULES).filter(e=>!e.sourceId.startsWith('/种族/')).length>BLUEPRINT_BATCH)!;
 const want=sourceEntries(combatProjection(structuredClone(c.source)),HOST_RULES).filter(e=>!e.sourceId.startsWith('/种族/')&&!e.sourceId.startsWith('/道具定义/'));
 const sizes:number[]=[];
 const engine=createCompilationEngine(async({prompt})=>{const list=JSON.parse(prompt.slice(prompt.lastIndexOf('条目：')+3)) as {sourceId:string}[];sizes.push(list.length);
  return {version:'booksea-blueprint/1',entries:list.map((e,i)=>i===0?{sourceId:e.sourceId,main:'不是蓝图'}:{sourceId:e.sourceId,main:{name:'模型',kind:'active',steps:[{do:'damage',power:hostSkillScale(20,HOST_RULES).power,channel:'energy'}],fidelity:'exact'}})};},HOST_RULES,{blueprint:true});
 const result=await engine.compile(combatProjection(structuredClone(c.source)),undefined,[]);const actor=validateCompiled(result.actor);
 assert.ok(sizes.every(n=>n<=BLUEPRINT_BATCH)&&sizes.reduce((a,b)=>a+b,0)>=want.length-1);
 const methods=actor.skills.filter(s=>want.some(e=>e.sourceId===s.sourceId)).map(s=>s.adaptation?.method);
 assert.ok(methods.includes('model')&&methods.includes('local'),'合法蓝图采用模型结果，非法蓝图回退本地');
});

// ---- 执行器：新控制类型与冷却的实际语义
const ATTACK='/技能/定量打击';
function controlled(control:string,extra?:ActionSpec){
 const me=card();if(extra)me.skills.push({...structuredClone(me.skills[0]!),sourceId:'/技能/辅助',name:'辅助',mapping:{...structuredClone(me.skills[0]!.mapping),sourceId:'/技能/辅助',action:extra}});
 me.numeric.max={hp:1e5,mp:1e5,sp:1e5};const foe=card();foe.numeric.max={hp:1e5,mp:1e5,sp:1e5};
 let b=createBattle([{id:'u0',side:'ally',card:me,current:{...me.numeric.max},mitigation:mitigation()},{id:'u1',side:'enemy',card:foe,current:{...foe.numeric.max},mitigation:mitigation()}],5);
 const {a}=lowerOk(bp([{do:'status',status:{name:'受控',polarity:'negative',control},turns:2,target:{side:'self'}}]),'ctl-'+control);
 b=applyBattleEffects(b,'u0',a,['u0'],'effect','/技能/ctl');return b;
}
const buff=():ActionSpec=>lowerOk(bp([{do:'stat',mods:[{stat:'伤害',pct:10}],target:{side:'self'},turns:2}]),'buff').a;
test('石化/击倒为硬控：任何能力都不可选',()=>{
 for(const [c,msg] of [['petrify','石化'],['knockdown','击倒']] as const){const b=controlled(c);assert.match(actionUnavailable(b,b.units[0]!,ATTACK,['u1']),new RegExp(msg));}
});
test('缴械禁止武器攻击但允许非攻击能力；禁止[动作]恰好相反',()=>{
 let b=controlled('disarm',buff());assert.match(actionUnavailable(b,b.units[0]!,ATTACK,['u1']),/缴械/);assert.equal(actionUnavailable(b,b.units[0]!,'/技能/辅助',['u0']),'');
 b=controlled('no_action',buff());assert.equal(actionUnavailable(b,b.units[0]!,ATTACK,['u1']),'');assert.match(actionUnavailable(b,b.units[0]!,'/技能/辅助',['u0']),/动作/);
});
test('变形只允许指令类动作',()=>{const b=controlled('polymorph');assert.match(actionUnavailable(b,b.units[0]!,ATTACK,['u1']),/变形/);});
test('冷却：使用后按自身行动计数，期间显示剩余次数',()=>{
 const a={...damageAction(),cooldown:2};const me=card(a);const foe=card();
 let b=createBattle([{id:'a',side:'ally',card:me,current:{hp:100,mp:80,sp:100},mitigation:mitigation()},{id:'e',side:'enemy',card:foe,current:{hp:1e4,mp:80,sp:100},mitigation:mitigation()}],3);
 b=advanceBattle(b,100000).battle;b=resolveAction(chooseAction(b,'a',ATTACK,'e'));
 assert.match(actionUnavailable(b,b.units[0]!,ATTACK,['e']),/^冷却中（剩余\d+次行动）$/);
});

// ---- 战斗化：战场全程可见、没有迷雾，侦查/创造类能力必须转成实际战斗效果
const ops=(a:ActionSpec):string[]=>[...a.effects.map(e=>e.op),...(a.triggers??[]).map(()=>'trigger'),...Object.values(a.library?.actions??{}).flatMap(x=>x.effects.map(e=>e.op))];
test('蓝图 reveal 在战斗中降级为[标记]，不产生探索侦查效果',()=>{
 const {a}=lowerOk(bp([{do:'reveal'}]),'scan');assert.ok(!ops(a).includes('explore'));assert.ok(ops(a).includes('apply_status'));
 const p=lowerOk({kind:'passive',steps:[{do:'reveal'}]},'scan-p');assert.ok(!ops(p.a).includes('explore'));assert.ok(p.a.triggers?.length);
});
test('创造/炼金类原文编成多属性伤害，执行时按目标最弱属性结算',()=>{
 const r=parse('/技能/调配',{品质:'稀有',类型:'主动',标签:['创造'],描述:'当场调配各种性质的试剂'});
 const d=r.main.steps.find(s=>s.do==='damage')!;assert.ok(Array.isArray(d.types)&&(d.types as string[]).length>1);
 const {a}=lowerOk({...r.main,steps:[d]},'alchemy');
 const hit=(weak:Record<string,number>)=>{const me=card(),foe=card();foe.numeric.max={hp:1e7,mp:1e5,sp:1e5};
  let b=createBattle([{id:'u0',side:'ally',card:me,current:{...me.numeric.max},mitigation:mitigation()},{id:'u1',side:'enemy',card:foe,current:{...foe.numeric.max},mitigation:{...mitigation(),elementMultipliers:weak}}],9);
  b=applyBattleEffects(b,'u0',a,['u1'],'effect','/技能/alchemy');return 1e7-b.units[1]!.current.hp;};
 const neutral=hit({}),weak=hit({水:2});assert.ok(neutral>0);assert.ok(weak>neutral*1.8,`弱点属性应被选中：${weak} vs ${neutral}`);
});
test('整卡：本地编译的非种族能力不产生只有侦查、没有战斗效果的技能',async()=>{
 const bad:string[]=[];
 for(const c of corpus){const engine=createCompilationEngine(async()=>{throw Error('offline');},HOST_RULES);
  const result=await engine.compile(combatProjection(structuredClone(c.source)),undefined,[]);const actor=validateCompiled(result.actor);
  for(const s of actor.skills.filter(x=>!x.sourceId.startsWith('/种族/'))){const list=[s.mapping.action,...(s.mapping.actions??[])].filter(Boolean) as ActionSpec[];for(const a of list){const o=ops(a);if(o.length&&o.every(x=>x==='explore'))bad.push(`${c.name}${s.sourceId}`);}}}
 assert.deepEqual(bad,[]);
});
