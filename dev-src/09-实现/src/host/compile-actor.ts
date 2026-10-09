import {actorKey,type ActorRef,type Obj} from '../core/actors';
import {compileOnUserAction,type CacheStore} from '../core/cache';
import {createCompilationEngine,type Rules} from '../compiler/engine';
import {chatCacheStore} from './chat-cache';
import {helperCompilerModel,type CompilerTransport} from './compiler';
import type {HostApi} from './probe';
export type CompileEnvironment={compilerApi?:Obj;compilerTransport?:CompilerTransport;contextId():string;saveChat():Promise<unknown>;readMvu():Promise<unknown>;api:HostApi;locks:{request<T>(key:string,fn:()=>Promise<T>):Promise<T>}};
/** User-click entry point. Pins the chat and serializes this actor's compile/update, preserving other chat state. */
export async function compileActorInChat(ref:ActorRef,env:CompileEnvironment,rules:Rules){
 const chatId=env.contextId();if(!chatId)throw Error('未选择聊天');const assert=()=>{if(env.contextId()!==chatId)throw Error('编译期间切换聊天，拒绝保存到其他聊天');};
 if(!env.api.getVariables||!env.api.updateVariablesWith||!env.locks?.request)throw Error('角色数据暂时不可用，请重新打开书海');
 const get=env.api.getVariables.bind(env.api),update=env.api.updateVariablesWith.bind(env.api);
 const scoped:HostApi={...env.api,getVariables(o){assert();return get(o);},async updateVariablesWith(fn,o){assert();return update(v=>{assert();return fn(v);},o);}};
 const rawStore=chatCacheStore(scoped);const store:CacheStore={async read(k){assert();return rawStore.read(k);},async write(k,c){assert();await rawStore.write(k,c);assert();await env.saveChat();assert();},async remove(k){assert();await rawStore.remove(k);}};
 const model=env.api.generateRaw&&env.api.stopGenerationById?helperCompilerModel({generateRaw:c=>{assert();return env.api.generateRaw!(c)},stopGenerationById:id=>env.api.stopGenerationById!(id)},120000,env.compilerTransport,env.compilerApi):async()=>{throw Error('No model available; use source/rank conversion');};
 const engine=createCompilationEngine(model,rules,{blueprint:true});
 return env.locks.request(`booksea-compile:${chatId}:${actorKey(ref)}`,async()=>{
  assert();const read=async()=>{assert();const v=await env.readMvu();assert();return v;};
  return compileOnUserAction(ref,read,store,engine);
 });
}
