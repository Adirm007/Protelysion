// Executes the installed Prompt Template implementation, not a reimplementation of its API.
// Only the host chat and regex/macro processing dependencies are synthetic. No private chat is read.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync('../10-联调环境/SillyTavern/public/scripts/extensions/third-party/ST-Prompt-Template/src/function/chat.ts','utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
type NativeChat={getChatMessages:(...args:unknown[])=>string[];getChatMessage:(index:number,role?:string)=>string;matchChatMessages:(pattern:RegExp|string,options:{start:number;role:string})=>boolean};
export function promptTemplateChat(messages:{role:string;message:string}[]):NativeChat{
 const module={exports:{}};
 const host={chat:messages.map(m=>({is_user:m.role==='user',is_system:m.role==='system',name:m.role,mes:m.message})),substituteParams:(s:string)=>s};
 vm.runInNewContext(compiled,{module,exports:module.exports,require:(id:string)=>{
  if(id.endsWith('/script.js'))return host;
  if(id.endsWith('/regex/engine.js'))return {getRegexedString:(s:string)=>s,regex_placement:{USER_INPUT:1,AI_OUTPUT:2}};
  throw Error('Unexpected Prompt Template dependency: '+id);
 }},{filename:'installed-prompt-template-chat.cjs'});
 return module.exports as NativeChat;
}

import _ from 'lodash';
const variableSource=readFileSync('../10-联调环境/SillyTavern/public/scripts/extensions/third-party/ST-Prompt-Template/src/function/variables.ts','utf8');
const variableCode=ts.transpileModule(variableSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
export function promptTemplateVariables(messages:{role:string;message:string;data?:Record<string,unknown>;extra?:Record<string,unknown>}[],chatVariables:Record<string,unknown>={}){
 const module={exports:{} as any};
 const host={chat:messages.map(m=>({is_user:m.role==='user',is_system:m.role==='system',mes:m.message,extra:m.extra??{},swipe_id:0,variables:[m.data??{}],variables_initialized:[true]})),chat_metadata:{variables:chatVariables},saveChatConditional(){throw Error('Prompt reading must not save');}};
 vm.runInNewContext(variableCode,{module,exports:module.exports,_,console:{debug(){}},require:(id:string)=>{
  if(id.endsWith('/script.js'))return host;
  if(id.endsWith('/lib.js'))return {yaml:{}};
  if(id.endsWith('/extensions.js'))return {extension_settings:{variables:{global:{}}}};
  if(id.endsWith('/ui'))return {settings:{debug_enabled:false}};
  if(id==='zod')return {z:{}};
  if(id.endsWith('/zodutl'))return {deepMergeZod:()=>{throw Error('No schema write allowed');}};
  throw Error('Unexpected variable dependency: '+id);
 }},{filename:'installed-prompt-template-variables.cjs'});
 const api=module.exports,context={runID:'isolated-native-variable-test',message_id:messages.length-1,swipe_id:0};
 return {SillyTavern:{chat:host.chat},getvar:(key:string,options:unknown={})=>api.getVariable.call(context,key,options),getLocalVar:(key:string)=>api.getVariable.call(context,key,{scope:'local'})};
}
