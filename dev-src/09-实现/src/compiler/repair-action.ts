import type {Obj} from '../core/actors';
import {amount} from './adaptive';
import {elementKey,resolveDamageTypes} from '../battle/elements';
/** Fill contract defaults only; unknown effects/fields still face the real validator. */
export function repairAction(input:unknown):{value:unknown;changed:boolean}{
 let changed=false;
 const clone=(v:unknown):unknown=>{if(v===null||typeof v!=='object')return v;if(Array.isArray(v))return v.map(clone);const proto=Object.getPrototypeOf(v);if(proto!==null&&Object.getPrototypeOf(proto)!==null)throw Error('Not JSON data');const descriptors=Object.getOwnPropertyDescriptors(v);if(Object.values(descriptors).some(d=>d.get||d.set))throw Error('Not JSON data');return Object.fromEntries(Object.entries(descriptors).map(([k,d])=>[k,clone(d.value)]));};
 const value=clone(input),record=(v:unknown):v is Obj=>!!v&&typeof v==='object'&&!Array.isArray(v);
 const defaults=(v:Obj,shape:Obj)=>{for(const [k,x]of Object.entries(shape))if(v[k]===undefined){v[k]=structuredClone(x);changed=true;}};
 const fraction=(v:Obj,key:string)=>{const n=v[key];if(typeof n==='number'&&n>1&&n<=100){v[key]=n/100;changed=true;}};
 const amounts=(v:unknown)=>{if(!record(v))return;defaults(v,amount());};
 const effect=(v:unknown)=>{if(!record(v))return;if(v.op==='damage'){
   defaults(v,{hitChance:.9,hitRule:'normal',critChance:0,critMultiplier:1.5,element:'none'});fraction(v,'hitChance');fraction(v,'critChance');
   if(record(v.amounts)){defaults(v.amounts,{physical:amount(),energy:amount(),mental:amount(),true:amount()});for(const a of Object.values(v.amounts))amounts(a);}
   // 模型把属性写在element或写了旧元素名时归并为六属性；完全缺失时按通道推导，保证每个伤害效果都有属性标签。
   if(Array.isArray(v.types)){const t=[...new Set(v.types.filter(x=>typeof x==='string').map(x=>elementKey(String(x))))];if(!t.length)delete v.types;else if(JSON.stringify(t)!==JSON.stringify(v.types)){v.types=t;changed=true;}}
   if(!Array.isArray(v.types)&&record(v.amounts)){const legacy=typeof v.element==='string'?v.element:'none';v.types=resolveDamageTypes({amounts:v.amounts as never,element:legacy}).types;changed=true;}
   if(typeof v.element==='string'&&v.element!=='none'){v.element='none';changed=true;}
  }if(v.amount)amounts(v.amount);if(Array.isArray(v.modifiers))for(const m of v.modifiers)if(record(m)&&m.amount)amounts(m.amount);
 };
 const action=(v:unknown)=>{if(!record(v))return;defaults(v,{castMs:0,recoveryFactor:1,perBattleUses:0,cost:{},effects:[]});if(record(v.cost)){defaults(v.cost,{hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}});for(const c of Object.values(v.cost))if(record(c)){defaults(c,{flat:0,maxFraction:0});fraction(c,'maxFraction');fraction(c,'currentFraction');}}if(Array.isArray(v.effects))v.effects.forEach(effect);};
 action(value);
 if(record(value)&&record(value.library)){
  defaults(value.library,{actions:{},statuses:{},summons:{},fields:{}});
  if(record(value.library.actions))Object.values(value.library.actions).forEach(action);
  if(record(value.library.statuses))for(const [key,v]of Object.entries(value.library.statuses))if(record(v))defaults(v,{name:key.slice(-100),tags:[],polarity:'neutral',duration:{clock:'target_action',value:2},stack:'refresh',maxStacks:1,scaleWithStacks:false,priority:0,dispellable:true,removeOnDeath:false,scope:'battle'});
 }
 return {value,changed};
}
