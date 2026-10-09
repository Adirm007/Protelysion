import {BLUEPRINT_REPLY_SCHEMA} from '../compiler/blueprint/prompt';
import type {ModelCompile} from '../compiler/engine';
import type {Obj} from '../core/actors';
import {Action,PortableReply} from '../compiler/contract';
export type CompilerTransport='full-schema'|'portable-action-json';
function portableSchema(value:unknown):unknown {if(Array.isArray(value))return value.map(portableSchema);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).filter(([k])=>!['minimum','maximum','minLength','maxLength','minItems','maxItems'].includes(k)).map(([k,v])=>[k,portableSchema(v)]));return value;}
/** Current ST provider only. No secret access, no history, no worldbook slot, no automatic retry. */
export function helperCompilerModel(api:{generateRaw(config:Obj):Promise<unknown>;stopGenerationById(id:string):unknown},timeoutMs=180000,transport:CompilerTransport='full-schema',customApi:Obj={}):ModelCompile {
 if(typeof api.generateRaw!=='function'||typeof api.stopGenerationById!=='function')throw Error('缺少独立生成或停止接口');
 return async({prompt,schema})=>{
  const id='booksea-compile-'+crypto.randomUUID();let timer:ReturnType<typeof setTimeout>|undefined;
  try{
   const blueprint=schema===BLUEPRINT_REPLY_SCHEMA;
   const wirePrompt=transport==='portable-action-json'&&!blueprint?prompt+'\n传输约定：mappings中不要输出action字段，改用actionJson字符串保存完整动作JSON；实际能力一律提供完整动作；非战斗技能先近似成探索或支援能力，无合理近似则按replacementScale替换同阶技能。active与passive都必须提供完整动作，passive不能写null。可选字段不用时直接省略，不要填null或空结构；若有library，必须同时含actions、statuses、summons、fields四个字典，没有条目写{}。解码后的action必须满足以下完整Schema，不得删除字段或省略效果：\n'+JSON.stringify(compactSchema(Action.json)):prompt;
   const wireSchema=transport==='portable-action-json'&&!blueprint?portableSchema(PortableReply.json):schema;
   const raw=await Promise.race([api.generateRaw({custom_api:{max_tokens:16384,temperature:0,...customApi},generation_id:id,should_stream:false,should_silence:false,max_chat_history:0,ordered_prompts:[{role:'user',content:wirePrompt}],json_schema:{name:blueprint?'booksea_skill_blueprint':'booksea_skill_compilation',strict:!blueprint,value:wireSchema}}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{let stopFailed=false;try{api.stopGenerationById(id);}catch{stopFailed=true;}reject(Error(stopFailed?'角色编译超时且停止接口异常；未保存新缓存，请核对未结束请求':'角色编译超时，未保存新缓存'));},timeoutMs);})]);
   if(typeof raw!=='string'||raw.length>1000000)throw Error('模型返回不是受限JSON文本');const decoded=JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));
   if(transport==='portable-action-json'&&decoded&&Array.isArray(decoded.mappings)){return {version:decoded.version,mappings:decoded.mappings.map((row:unknown)=>{if(!row||typeof row!=='object')return row;const {actionJson,...m}=row as Obj;try{return {...m,action:typeof actionJson==='string'?JSON.parse(actionJson):null};}catch{return {...m,disposition:'unsupported',action:null,reason:'此条由本地规则继续转化'};}})};}
   return decoded;
  }finally{clearTimeout(timer);}
 };
}

/** Share repeated schema definitions to keep the full mechanism contract within model context. */
export function compactSchema(root:Record<string,unknown>):Record<string,unknown>{
 const counts=new Map<string,number>();const count=(v:unknown)=>{if(!v||typeof v!=='object')return;const key=JSON.stringify(v);if(!Array.isArray(v)&&('type' in v||'anyOf' in v||'enum' in v)&&key.length>100)counts.set(key,(counts.get(key)??0)+1);for(const x of Object.values(v))count(x);};count(root);
 const keys=[...counts].filter(([,n])=>n>1).map(([s])=>s),names=new Map(keys.map((k,i)=>[k,'S'+i]));const definitions:Record<string,unknown>={};
 const walk=(v:unknown,self?:string):unknown=>{if(!v||typeof v!=='object')return v;const name=names.get(JSON.stringify(v));if(name&&name!==self)return {$ref:'#/$defs/'+name};return Array.isArray(v)?v.map(x=>walk(x)):Object.fromEntries(Object.entries(v).map(([k,x])=>[k,walk(x)]));};
 for(const key of keys){const name=names.get(key)!;definitions[name]=walk(JSON.parse(key),name);}return {...walk(root) as Record<string,unknown>,$defs:definitions};
}
