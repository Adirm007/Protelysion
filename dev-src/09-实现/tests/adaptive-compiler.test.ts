import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCompilationEngine,validateCompiled,sourceEntries} from '../src/compiler/engine';
import {hostSkillScale} from '../src/compiler/host-skill-scale';
import {EFFECT_VERSION,validateAction,type ActionSpec} from '../src/compiler/contract';
import {cleanSource,rules,mapping,damageAction,card,mitigation} from './compiler-fixtures';
import {createBattle,chooseAction,resolveAction,applyBattleEffects,actionUnavailable} from '../src/battle/executor';
import type {Obj} from '../src/core/actors';
const unavailable=async()=>{throw Error('test offline');};
const compile=async(source:Obj,model:Parameters<typeof createCompilationEngine>[0]=unavailable)=>validateCompiled((await createCompilationEngine(model,rules).compile(source,undefined,[])).actor);
function source(level=10){const s=cleanSource();s.等级=level;s.技能={未定型的故事:{品质:'唯一',类型:'主动',描述:'将一个尚未存在的叙事意象付诸实践。'}};for(const name of ['生命值','法力值','体力值'])s[name]={_基础:50000,额外:0};return s;}
test('host quality and numbers are read from the actual worldbook bands',()=>{
 const expected=[[1,'普通',50,10],[4,'普通',100,100],[5,'优良',120,50],[8,'优良',200,500],[9,'稀有',250,200],[12,'稀有',600,1000],[13,'史诗',800,800],[16,'史诗',1500,4000],[17,'传说',2000,2400],[20,'传说',4000,10000],[21,'神话',5000,7200],[24,'神话',8000,25000],[25,'神话',8000,25000]] as const;
 for(const [level,quality,power,cost]of expected){const s=hostSkillScale(level);assert.equal(s.qualityName,quality);assert.equal(s.power,power);assert.equal(s.cost,cost);assert.equal(s.attributeFactor,10);}
});
test('小憩 and 故事的主人 from the actual reader compile without a model or invented source quotes',async()=>{
 const raw=readFileSync('../02-宿主参考-只读/读者核心本体 (new).txt','utf8'),s=source(),rest=raw.split(/\r?\n/).find(l=>l.includes('开局为<user>添加间章:小憩技能'))!,guard=raw.split(/\r?\n/).find(l=>l.includes('开局为<user>添加故事的主人被动技能'))!;
 assert.ok(rest&&guard);s.技能={'间章:小憩':{类型:'主动',品质:'唯一',消耗:'[动作: 1] [MP: 0]',描述:rest},故事的主人:{类型:'被动',品质:'唯一',描述:guard}};let calls=0;const c=await compile(s,async()=>{calls++;throw Error('not needed');});assert.equal(calls,0);assert.equal(c.skills.length,2);const a=c.skills.find(x=>x.name==='间章:小憩')!.mapping.action!;assert.equal(a.cost.mp.flat,0);assert.ok(a.tags?.includes('booksea:interlude'),'0.37.6 固定编译');assert.ok(!a.effects.some(e=>e.op==='time'),'不再走可被打断的延迟任务');assert.ok(a.effects.some(e=>e.op==='retreat'));assert.equal(c.skills.find(x=>x.name==='故事的主人')!.mapping.disposition,'passive');
});
test('a paraphrased fidelity quote cannot discard an otherwise valid action',async()=>{
 const s=cleanSource(),m=mapping();m.fidelity!.clauses[0]!.original='此效果对一个目标造成40物理伤害';const c=await compile(s,async()=>({version:EFFECT_VERSION,mappings:[m]}));assert.deepEqual(c.skills[0]!.mapping.action!.effects,damageAction().effects);assert.equal(c.skills[0]!.adaptation?.mode,'approximate');
});
test('good rows survive a malformed sibling; every actual skill still becomes executable',async()=>{
 const s=source();s.技能={定量打击:{描述:'对单个敌人造成40物理伤害，必中，不暴击'},未定型的故事:{类型:'主动',描述:'改写无法度量的叙事意象'}};
 const c=await compile(s,async()=>({version:EFFECT_VERSION,mappings:[mapping(),{sourceId:'/技能/未定型的故事',disposition:'active',reason:'broken',action:{effects:[{op:'unknown'}]}}]}));assert.equal(c.skills.length,2);assert.deepEqual(c.skills[0]!.mapping.action!.effects,damageAction().effects);for(const row of c.skills)assert.doesNotThrow(()=>validateAction(row.mapping.action));assert.equal(c.skills[1]!.adaptation?.mode,'replacement');
});
test('noncombat skills try an exploration approximation before rank replacement',async()=>{
 const s=source();s.技能={侦探直觉:{类型:'主动',描述:'在日常探案中发现线索'}};const c=await compile(s,async()=>({version:EFFECT_VERSION,mappings:[{sourceId:'/技能/侦探直觉',disposition:'noncombat',reason:'生活技能',action:null}]}));assert.equal(c.skills[0]!.adaptation?.mode,'approximate');assert.ok(c.skills[0]!.mapping.action!.effects.some(e=>e.op==='explore'));
});
test('separate elements retain separate executable passive abilities',async()=>{
 const s=source(16);s.技能={};s.登神长阶={是否开启:true,要素:{秩序禁锢:{描述:'目标精神对抗失败则束缚，持续2回合'},未定义意象:{描述:'尚无法表达的故事概念'}}};const c=await compile(s);assert.equal(sourceEntries(s,rules).length,2);assert.equal(c.skills.length,2);assert.ok(c.skills.every(x=>x.mapping.disposition==='passive'));const bind=c.skills.find(x=>x.name==='秩序禁锢')!;assert.ok(Object.values(bind.mapping.action!.library!.statuses).some(s=>s.control==='bind'&&s.duration.value===2));assert.equal(c.skills.find(x=>x.name==='未定义意象')!.adaptation?.quality,'史诗');
});
test('missing model, invalid envelope, omitted or duplicated rows never block ability conversion',async()=>{
 for(const model of [unavailable,async()=>({}),async()=>({version:'bad',mappings:[]}),async()=>({version:EFFECT_VERSION,mappings:[]}),async()=>({version:EFFECT_VERSION,mappings:[{sourceId:'/技能/虚构',action:null},{sourceId:'/技能/虚构',action:null}]})]){const c=await compile(source(),model);assert.equal(c.skills[0]!.mapping.disposition,'active');assert.equal(c.skills[0]!.adaptation?.mode,'replacement');}
});
for(const level of [1,4,5,8,9,10,12,13,16,17,20,21,24,25])test(`Lv${level} replacement follows its owner's host quality, power and cost`,async()=>{
 const c=await compile(source(level)),scale=hostSkillScale(level),row=c.skills[0]!,a=row.mapping.action!,hit=a.effects.find(e=>e.op==='damage')!;assert.equal(row.adaptation?.basisLevel,level);assert.equal(row.adaptation?.quality,scale.qualityName);assert.equal(a.source?.quality,scale.quality);assert.equal(hit.op,'damage');if(hit.op==='damage'){const nonzero=Object.values(hit.amounts).find(n=>n.flat)!;assert.equal(nonzero.flat,scale.power);assert.equal(nonzero.factor,10);}assert.equal(a.cost.mp.flat+a.cost.sp.flat,scale.cost);assert.doesNotThrow(()=>validateAction(a));
});
test('a substituted skill is usable in the real battle executor and actually deals damage',async()=>{
 const c=await compile(source(16)),enemy=card(damageAction(1));enemy.numeric.max.hp=1000000;let b=createBattle([{id:'hero',side:'ally',card:c,current:{...c.numeric.max},mitigation:mitigation()},{id:'foe',side:'enemy',card:enemy,current:{hp:1000000,mp:80,sp:100},mitigation:mitigation()}],19);const before=b.units[1]!.current.hp;b.clock.pending=[{kind:'ready',unitId:'hero'}];b.clock.units.find(x=>x.id==='hero')!.atb=100;b=resolveAction(chooseAction(b,'hero',c.skills[0]!.sourceId,'foe'));assert.ok(b.units[1]!.current.hp<before);assert.ok(b.units[0]!.current.mp<c.numeric.max.mp||b.units[0]!.current.sp<c.numeric.max.sp);
});
test('replacement strength updates on level change without a model call',async()=>{
 let calls=0;const engine=createCompilationEngine(async()=>{calls++;throw Error('offline');},rules),s=source(10),a=await engine.compile(s,undefined,[]);s.等级=16;const b=validateCompiled((await engine.compile(s,a.actor,['/等级'])).actor);assert.equal(calls,1);assert.equal(b.skills[0]!.adaptation?.quality,'史诗');assert.equal(b.skills[0]!.adaptation?.basisLevel,16);
});
test('one missing default does not replace a valid control effect with unrelated damage',async()=>{
 const s=source(),base=damageAction();delete (base as unknown as Obj).castMs;const c=await compile(s,async()=>({version:EFFECT_VERSION,mappings:[{...mapping(base),sourceId:'/技能/未定型的故事'}]}));assert.equal(c.skills[0]!.mapping.action!.castMs,0);assert.equal(c.skills[0]!.adaptation?.mode,'approximate');assert.deepEqual(c.skills[0]!.mapping.action!.effects,damageAction().effects);
});

test('converted element triggers on an actual hit and restricts movement actions',async()=>{
 const s=source(16);s.技能={};s.登神长阶={是否开启:true,要素:{秩序禁锢:{描述:'命中后进行精神对抗，成功束缚目标，持续2回合'}}};(s.属性 as Obj).精神=100;
 const c=await compile(s),enemy=card(damageAction(1));enemy.numeric.attributes.精神=0;enemy.numeric.max.hp=100000;
 let b=createBattle([{id:'hero',side:'ally',card:c,current:{...c.numeric.max},mitigation:mitigation()},{id:'foe',side:'enemy',card:enemy,current:{hp:100000,mp:80,sp:100},mitigation:mitigation()}],17);
 b.units[1]!.actions.step={...damageAction(1),tags:['movement']};b=applyBattleEffects(b,'hero',damageAction(1),['foe']);
 assert.ok(b.units[1]!.statuses?.some(s=>s.definition.control==='bind'));assert.match(actionUnavailable(b,b.units[1]!,'step'),/束缚/);
});
