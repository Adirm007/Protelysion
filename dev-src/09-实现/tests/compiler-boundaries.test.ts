import test from 'node:test';
import assert from 'node:assert/strict';
import {createCompilationEngine,validateCompiled} from '../src/compiler/engine';
import {EFFECT_VERSION,validateAction} from '../src/compiler/contract';
import {COMPILATION_BOUNDARY_GUIDE} from '../src/compiler/capability-guide';
import {cleanSource,rules,damageAction,mapping} from './compiler-fixtures';

test('Compiler prompt distinguishes an effect-family name from complete source semantics',async()=>{
 let prompt='';const source=cleanSource();source.技能={枯荣:{描述:'领域中所有伤害与治疗双向转换'}};
 const engine=createCompilationEngine(async request=>{prompt=request.prompt;return {version:EFFECT_VERSION,mappings:[{sourceId:'/技能/枯荣',disposition:'unsupported',reason:'缺少可取消的伤害/治疗替换事件，无法完整执行枯荣',action:null}]};},rules);
 const card=validateCompiled((await engine.compile(source,undefined,[])).actor);assert.doesNotThrow(()=>validateAction(card.skills[0]!.mapping.action));assert.notEqual(card.skills[0]!.mapping.disposition,'unsupported');
 assert.ok(prompt.includes(COMPILATION_BOUNDARY_GUIDE));
 assert.doesNotMatch(prompt,/不得以这些族“未实现”为由unsupported/);
 assert.doesNotMatch(prompt,/整个来源标为unsupported/);assert.match(prompt,/同阶|同等级/);
 assert.match(prompt,/JSON合法只说明结构通过/);
});

test('Boundary guidance retains supported compilation and never requests arbitrary code',async()=>{
 let prompt='';const engine=createCompilationEngine(async request=>{prompt=request.prompt;return {version:EFFECT_VERSION,mappings:[mapping(damageAction())]};},rules);
 const result=await engine.compile(cleanSource(),undefined,[]);assert.ok(result.actor);
 assert.match(prompt,/输出合同JSON，不输出代码/);assert.match(prompt,/ATB\/概率等效/);
});
