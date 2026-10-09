/** The declarations are shared by types, the compiler wire contract and its single input parse. */
export type Schema<T>={json:Record<string,unknown>;optional?:boolean;parse(value:unknown,path?:string):T};
export type Infer<S>=S extends Schema<infer T>?T:never;
type Shape<T extends Record<string,Schema<unknown>>>={-readonly [K in keyof T as undefined extends Infer<T[K]>?never:K]:Infer<T[K]>}&{-readonly [K in keyof T as undefined extends Infer<T[K]>?K:never]?:Infer<T[K]>};
const fail=(p:string,m:string):never=>{throw Error(`${p}: ${m}`)};
export const text=(max=4000,min=1):Schema<string>=>({json:{type:'string',minLength:min,maxLength:max},parse(v,p='$'){if(typeof v!=='string'||v.length<min||v.length>max)return fail(p,'字符串长度非法');return v;}});
export const number=(min=0,max=Number.MAX_VALUE,integer=false):Schema<number>=>({json:{type:integer?'integer':'number',minimum:min,maximum:max},parse(v,p='$'){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||(integer&&!Number.isSafeInteger(v)))return fail(p,'数值非法');return v;}});
export const boolean=():Schema<boolean>=>({json:{type:'boolean'},parse(v,p='$'){if(typeof v!=='boolean')return fail(p,'需要布尔值');return v;}});
export const enumeration=<const T extends readonly string[]>(values:T):Schema<T[number]>=>({json:{type:'string',enum:values},parse(v,p='$'){if(typeof v!=='string'||!values.includes(v))return fail(p,`未知枚举 ${String(v)}`);return v as T[number];}});
export const literal=<T extends string>(v:T)=>enumeration([v] as const);
export const nullable=<T>(s:Schema<T>):Schema<T|null>=>({json:{anyOf:[s.json,{type:'null'}]},parse:(v,p)=>v===null?null:s.parse(v,p)});
export const optional=<T>(s:Schema<T>):Schema<T|undefined>=>({json:s.json,optional:true,parse:(v,p)=>v===undefined?undefined:s.parse(v,p)});
export const array=<T>(s:Schema<T>,min=0,max=256):Schema<T[]>=>({json:{type:'array',items:s.json,minItems:min,maxItems:max},parse(v,p='$'){if(!Array.isArray(v)||v.length<min||v.length>max)return fail(p,'数组长度非法');return v.map((x,i)=>s.parse(x,`${p}[${i}]`));}});
export function object<const T extends Record<string,Schema<unknown>>>(shape:T):Schema<Shape<T>> {
 return {json:{type:'object',properties:Object.fromEntries(Object.entries(shape).map(([k,v])=>[k,v.json])),required:Object.keys(shape).filter(k=>!shape[k]!.optional),additionalProperties:false},parse(v,p='$'){
  if(!v||typeof v!=='object'||Array.isArray(v))return fail(p,'需要普通对象');
  const proto=Object.getPrototypeOf(v);if(proto!==null&&Object.getPrototypeOf(proto)!==null)return fail(p,'需要普通对象');
  if(Object.values(Object.getOwnPropertyDescriptors(v)).some(d=>d.get||d.set))return fail(p,'不允许访问器字段');
  const data=v as Record<string,unknown>;if(Object.keys(data).some(k=>!Object.hasOwn(shape,k))||Object.keys(shape).some(k=>!shape[k]!.optional&&!Object.hasOwn(data,k)))return fail(p,'缺少字段或包含未知字段：缺少 '+Object.keys(shape).filter(k=>!shape[k]!.optional&&!Object.hasOwn(data,k)).join(',')+'；未知 '+Object.keys(data).filter(k=>!Object.hasOwn(shape,k)).join(','));
  return Object.fromEntries(Object.entries(shape).filter(([k])=>Object.hasOwn(data,k)).map(([k,s])=>[k,s.parse(data[k],`${p}.${k}`)])) as Shape<T>;
 }};
}
export function record<T>(schema:Schema<T>):Schema<Record<string,T>> {return {json:{type:'object',additionalProperties:schema.json},parse(v,p='$'){if(!v||typeof v!=='object'||Array.isArray(v))return fail(p,'需要字典');return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,schema.parse(x,p+'.'+k)]));}};}
export function union<const T extends readonly Schema<unknown>[]>(...choices:T):Schema<Infer<T[number]>> {return {json:{anyOf:choices.map(c=>c.json)},parse(v,p='$'){for(const c of choices){try{return c.parse(v,p) as Infer<T[number]>}catch{}}return fail(p,'不符合效果合同分支');}};}
