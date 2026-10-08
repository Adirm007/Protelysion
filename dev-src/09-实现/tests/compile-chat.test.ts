import test from 'node:test';import assert from 'node:assert/strict';
import {compileActorInChat,type CompileEnvironment} from '../src/host/compile-actor';
import {actorAt,type Obj} from '../src/core/actors';import {fixture,player} from './fixtures';
import {rules,cleanSource,mapping} from './compiler-fixtures';import {EFFECT_VERSION} from '../src/compiler/contract';
function env(){let vars:Obj={keep:true},context='a',calls=0,tail=Promise.resolve();const m=fixture(),a=actorAt(m,player),s=cleanSource();a.种族=s.种族;a.技能=s.技能;a.装备={};a.背包={};a.状态效果={};a.登神长阶={是否开启:false};
 const api:CompileEnvironment['api']={getVariables:()=>structuredClone(vars),async updateVariablesWith(fn){vars=fn(structuredClone(vars));return vars},async generateRaw(){calls++;return JSON.stringify({version:EFFECT_VERSION,mappings:[mapping()]})},stopGenerationById:()=>true};
 const e:CompileEnvironment={contextId:()=>context,saveChat:async()=>{},readMvu:async()=>structuredClone(m),api,locks:{async request(_k,fn){const old=tail;let done!:()=>void;tail=new Promise<void>(r=>done=r);await old;try{return await fn()}finally{done()}}}};
 return {e,switch:()=>{context='b'},vars:()=>vars,calls:()=>calls};
}
test('同角色并发编译只做一次模型请求，不覆盖其他聊天字段',async()=>{const x=env();await Promise.all([compileActorInChat(player,x.e,rules),compileActorInChat(player,x.e,rules)]);assert.equal(x.calls(),1);assert.equal(x.vars().keep,true);});
test('模型等待中切换聊天，不把结果写入新聊天',async()=>{const x=env();x.e.api.generateRaw=async()=>{x.switch();return JSON.stringify({version:EFFECT_VERSION,mappings:[mapping()]})};await assert.rejects(compileActorInChat(player,x.e,rules),/切换聊天/);assert.equal(x.vars().booksea,undefined);});
