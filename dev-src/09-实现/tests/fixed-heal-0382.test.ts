/** 0.38.2 治疗量保真：宿主卡原文是固定值的治疗（“恢复300HP”“每回合恢复200点生命”）照原值编译，
 * 只有原文写了百分比才编成百分比。覆盖模型蓝图路径（finalize 按原文纠正）、本地解析、持续恢复、旧缓存重编与兜底修复。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {lowerBlueprint} from '../src/compiler/blueprint/lower';
import {finalizeModelBlueprint} from '../src/compiler/blueprint/compile';
import {parseEntry} from '../src/compiler/blueprint/parse';
import {fixedHeals,hasPercentHeal,needsHealRefresh,repairFixedHealMapping} from '../src/compiler/blueprint/heal-text';
import {normalizeBlueprint,BLUEPRINT_VERSION,type Blueprint} from '../src/compiler/blueprint/types';
import {blueprintPrompt} from '../src/compiler/blueprint/prompt';
import {validateAction,type ActionSpec,type EffectSpec} from '../src/compiler/contract';
import {createCompilationEngine,validateCompiled,type CompiledActor} from '../src/compiler/engine';
import {COMPILE_POLICY} from '../src/compiler/adaptive';
import {HOST_RULES} from '../src/compiler/rules';
import {combatProjection} from '../src/core/cache';
import type {Obj} from '../src/core/actors';

const attrs={力量:40,敏捷:40,体质:40,智力:40,精神:40};
const actor={level:20,tier:5,power:3000,cost:4000,attributeFactor:1,attributes:attrs};
const ctx=(sourceId:string,name:string,passive=false)=>({key:sourceId+'#0',sourceId,name,level:20,tier:5,power:3000,cost:4000,attributeFactor:1,attributes:attrs,passive});
function lowerModel(raw:Obj,text:string):ActionSpec{
 const name=String(raw.name??'测试'),sourceId='/技能/'+name;
 const bp=finalizeModelBlueprint(normalizeBlueprint(raw)!,{sourceId,name,raw:{描述:text}},actor);
 return validateAction(lowerBlueprint(bp,ctx(sourceId,name,bp.kind==='passive')).action) as ActionSpec;
}
function lowerLocal(name:string,text:string,type='主动'):ActionSpec{
 const sourceId='/技能/'+name,parsed=parseEntry({sourceId,name,raw:{类型:type,描述:text}},{...ctx(sourceId,name),sourceId} as never)!;
 const bp=(parsed as {main:Blueprint}).main;
 return validateAction(lowerBlueprint(bp,ctx(sourceId,name,bp.kind==='passive')).action) as ActionSpec;
}
const heals=(a:ActionSpec):EffectSpec[]=>{const out:EffectSpec[]=[];const walk=(v:unknown)=>{if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object'){if((v as Obj).op==='heal')out.push(v as EffectSpec);Object.values(v).forEach(walk);}};walk(a);return out;};
const amountOf=(e:EffectSpec)=>(e as Extract<EffectSpec,{op:'heal'}>).amount;

test('原文识别：固定值与百分比分开，“恢复3回合 / 受到伤害”不算治疗量', ()=>{
 assert.deepEqual(fixedHeals('为一名同伴恢复300点HP').map(f=>[f.amount,f.resource,f.perRound]),[[300,'hp',false]]);
 assert.deepEqual(fixedHeals('每回合恢复200HP，持续3回合').map(f=>[f.amount,f.perRound]),[[200,true]]);
 assert.deepEqual(fixedHeals('恢复10000点HP/MP/SP中最少的一项').map(f=>f.resource),['auto']);
 assert.deepEqual(fixedHeals('治疗全体友方1,200点生命').map(f=>f.amount),[1200]);
 assert.deepEqual(fixedHeals('回复MP 300点').map(f=>f.resource),['mp']);
 assert.deepEqual(fixedHeals('恢复3回合'),[]);assert.deepEqual(fixedHeals('恢复自身20%最大HP'),[]);
 assert.ok(hasPercentHeal('恢复自身20%最大HP'));assert.ok(!hasPercentHeal('为一名同伴恢复300点HP'));
});

test('模型路径：原文固定值、模型写成 pct → 按原文固定值；原文就是百分比 → 保持百分比', ()=>{
 const fixed=lowerModel({name:'急救',kind:'active',target:{side:'ally'},steps:[{do:'heal',resource:'hp',pct:5}],fidelity:'exact'},'为一名同伴恢复3000点HP');
 const [h]=heals(fixed);assert.ok(h);assert.equal(amountOf(h!).flat,3000);assert.equal(amountOf(h!).maxFraction,0,'不再是百分比');
 const pct=lowerModel({name:'圣光',kind:'active',target:{side:'ally'},steps:[{do:'heal',resource:'hp',pct:20}],fidelity:'exact'},'恢复一名同伴20%最大HP');
 assert.equal(amountOf(heals(pct)[0]!).maxFraction,.2);assert.equal(amountOf(heals(pct)[0]!).flat,0);
 const omitted=lowerModel({name:'包扎',kind:'active',steps:[{do:'heal'}],fidelity:'exact'},'为同伴包扎伤口，恢复800点生命值');
 assert.equal(amountOf(heals(omitted)[0]!).flat,800,'模型漏写数值时也按原文，而不是同阶威力');
 const mp=lowerModel({name:'冥想',kind:'active',target:{side:'self'},steps:[{do:'heal',resource:'mp',pct:3}],fidelity:'exact'},'冥想片刻，回复自身500点法力');
 assert.equal((heals(mp)[0] as Extract<EffectSpec,{op:'heal'}>).resource,'mp');assert.equal(amountOf(heals(mp)[0]!).flat,500);
});

test('持续恢复：“每回合恢复N点”编成固定值 HoT（自定义状态 / 标准“再生” / 领域 / 回合触发器）', ()=>{
 const custom=lowerModel({name:'生命之泉',kind:'active',target:{side:'ally'},steps:[{do:'status',status:{name:'泉涌',polarity:'positive',hotPct:2},turns:3}],fidelity:'exact'},'使一名同伴获得[泉涌]：每回合恢复400点HP，持续3回合');
 const tick=heals(custom);assert.equal(tick.length,1);assert.equal(amountOf(tick[0]!).flat,400);assert.equal(amountOf(tick[0]!).maxFraction,0);
 const std=lowerModel({name:'再生术',kind:'active',target:{side:'ally'},steps:[{do:'status',status:'再生',turns:3}],fidelity:'exact'},'每回合恢复250HP，持续3回合');
 assert.equal(amountOf(heals(std)[0]!).flat,250,'标准“再生”按原文固定值，不是 5%');
 const field=lowerModel({name:'圣域',kind:'active',steps:[{do:'field',name:'圣域',affects:'ally',hotPct:3,turns:3}],fidelity:'exact'},'展开圣域，己方全体每回合恢复300点生命，持续3回合');
 assert.equal(amountOf(heals(field)[0]!).flat,300);
 const passive=lowerModel({name:'自愈',kind:'passive',triggers:[{on:'round',steps:[{do:'heal',resource:'hp',pct:2,target:{side:'self'}}]}],fidelity:'exact'},'每回合开始时恢复自身150点HP');
 assert.equal(amountOf(heals(passive)[0]!).flat,150);
 const stdPct=lowerModel({name:'再生术',kind:'active',target:{side:'ally'},steps:[{do:'status',status:'再生',turns:3}],fidelity:'exact'},'每回合恢复5%最大HP，持续3回合');
 assert.equal(amountOf(heals(stdPct)[0]!).maxFraction,.05,'原文就是百分比：保持');
});

test('本地解析（模型连不上时）：固定值治疗照原值', ()=>{
 const a=lowerLocal('急救','为一名同伴恢复300点HP');
 const h=heals(a);assert.ok(h.length>=1);assert.equal(amountOf(h[0]!).flat,300);assert.equal(amountOf(h[0]!).maxFraction,0);
 const hot=lowerLocal('再生之歌','每回合恢复200点生命，持续3回合');
 assert.ok(heals(hot).some(e=>amountOf(e).flat===200),'每回合固定恢复');
 const pct=lowerLocal('圣光','恢复自身20%最大HP');assert.equal(amountOf(heals(pct)[0]!).maxFraction,.2,'百分比照旧');
});

test('提示词：固定值写 amount / hotAmount，禁止换算成百分比', ()=>{
 const p=blueprintPrompt([{sourceId:'/技能/x',name:'x',text:'恢复300HP'}] as never,{level:20} as never);
 assert.match(p,/amount:300照抄，禁止换算成pct/);assert.match(p,/hotAmount/);
});

const noCost={hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}};
const pctHealAction=(f:number):ActionSpec=>validateAction({name:'急救',target:'ally',cost:noCost,castMs:0,recoveryFactor:1,perBattleUses:0,effects:[{op:'heal',resource:'hp',amount:{flat:0,attribute:'none',factor:0,scale:'flat',maxResource:'hp',maxFraction:f,subject:'target'}}]}) as ActionSpec;

test('旧缓存：兜底修复把百分比改回原文固定值；原文百分比、按属性缩放的不动', ()=>{
 const m={sourceId:'/技能/急救',disposition:'active' as const,reason:'为目标恢复5%最大生命',action:pctHealAction(.05)};
 assert.ok(needsHealRefresh(m,'为一名同伴恢复300点HP'));
 assert.equal(needsHealRefresh(m,'恢复一名同伴5%最大HP'),false);
 const r=repairFixedHealMapping(structuredClone(m),'为一名同伴恢复300点HP');
 assert.ok(r.changed);assert.equal(amountOf(r.mapping.action.effects[0]!).flat,300);assert.equal(amountOf(r.mapping.action.effects[0]!).maxFraction,0);
 assert.equal(r.mapping.reason,'为目标恢复300点生命');
 assert.equal(repairFixedHealMapping(structuredClone(m),'恢复一名同伴5%最大HP').changed,false);
});

const corpus=JSON.parse(readFileSync(new URL('./blueprint-corpus.fixture.json',import.meta.url),'utf8')) as {name:string;source:Obj}[];
function holmesWithAid():Obj{const s=structuredClone(corpus.find(c=>c.name==='福尔摩斯探案集')!.source) as Obj;(s.技能 as Obj)['急救']={品质:'稀有',类型:'主动',标签:['治疗'],描述:'为一名同伴包扎伤口，恢复600点HP'};return s;}

test('重新整备：旧策略把固定值治疗编成百分比的条目交给模型重编；模型不可用时保留按原文修好的旧结果',async()=>{
 const source=combatProjection(holmesWithAid());
 const reply=(prompt:string,build:(id:string)=>Obj|undefined)=>{const list=JSON.parse(prompt.slice(prompt.lastIndexOf('条目：')+3)) as {sourceId:string}[];return {version:BLUEPRINT_VERSION,entries:list.flatMap(x=>{const m=build(x.sourceId);return m?[{sourceId:x.sourceId,main:m}]:[];})};};
 const aid={name:'急救',kind:'active',target:{side:'ally'},steps:[{do:'heal',resource:'hp',amount:600}],fidelity:'exact'};
 const first=createCompilationEngine(async({prompt})=>reply(prompt,id=>id==='/技能/急救'?aid:{name:'模型',kind:'active',steps:[{do:'damage'}],fidelity:'exact'}),HOST_RULES,{blueprint:true});
 const fresh=validateCompiled((await first.compile(source,undefined,[])).actor);
 const now=fresh.skills.find(s=>s.sourceId==='/技能/急救')!;assert.equal(now.adaptation?.policy,COMPILE_POLICY);
 assert.equal(amountOf(heals(now.mapping.action!)[0]!).flat,600);
 // 造一份 0.38.1 的旧缓存：急救被编成 5% 最大生命。
 const legacy=structuredClone(fresh) as CompiledActor;const old=legacy.skills.find(s=>s.sourceId==='/技能/急救')!;
 old.mapping.action=pctHealAction(.05);old.adaptation={...old.adaptation!,policy:2};
 const asked:string[]=[];
 const second=createCompilationEngine(async({prompt})=>reply(prompt,id=>{asked.push(id);return id==='/技能/急救'?aid:undefined;}),HOST_RULES,{blueprint:true});
 const redone=validateCompiled((await second.compile(source,legacy,[])).actor);
 assert.deepEqual(asked,['/技能/急救'],'只重编治疗量有问题的旧条目');
 assert.equal(amountOf(heals(redone.skills.find(s=>s.sourceId==='/技能/急救')!.mapping.action!)[0]!).flat,600);
 const offline=createCompilationEngine(async()=>{throw Error('offline');},HOST_RULES,{blueprint:true});
 const kept=validateCompiled((await offline.compile(source,legacy,[])).actor).skills.find(s=>s.sourceId==='/技能/急救')!;
 assert.equal(kept.adaptation?.method,'model');
 const h=amountOf(heals(kept.mapping.action!)[0]!);assert.equal(h.flat,600,'兜底：按原文固定值修好');assert.equal(h.maxFraction,0);
});
