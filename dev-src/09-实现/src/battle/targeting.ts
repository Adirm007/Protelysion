/** 目标方式的结构判定与旧编译结果修复（0.38.1）。执行器不认角色名，只看效果结构。 */
import type {ActionSpec,EffectSpec,LibrarySpec,ModifierSpec,TargetSpec} from '../compiler/contract';

/** harm=作用于敌方（伤害、减益、驱散增益…）；help=可以给予己方（治疗、护盾、增益、净化…）；
 * stance=通常只作用于自身的姿态/规则类；neutral=无法判断利害。 */
export type EffectNature='harm'|'help'|'stance'|'neutral';
/** 数值越低越好的属性：承伤、消耗、受到暴击伤害、属性承伤倍率、行动恢复时间。 */
const LOWER_IS_BETTER=new Set<string>(['vulnerability','cost_hp','cost_mp','cost_sp','crit_taken','element','recovery']);
/** 让对象动不了/受制于人的控制：无论自称什么极性都算有害（隐身、守护除外）。 */
const HARM_CONTROLS=new Set<string>(['stun','freeze','silence','bind','sleep','fear','confusion','charm','taunt','mark','isolate','time_stop','petrify','knockdown','disarm','polymorph','no_action']);
const HARM_RULES=new Set<string>(['sealed','no_heal','no_revive','seal_category','repeat_seal','control_tax','blood_tax']);
export function modifierSign(m:Pick<ModifierSpec,'stat'|'flat'|'multiplier'|'amount'>):number{
 if(m.stat.startsWith('reduction_'))return m.flat?Math.sign(m.flat):m.multiplier!==undefined?-Math.sign(m.multiplier-1):0;
 const v=m.flat?m.flat:m.multiplier!==undefined?m.multiplier-1:m.amount?1:0;const sign=Math.sign(v);
 return LOWER_IS_BETTER.has(m.stat)?-sign:sign;
}
export function modifierNature(mods:readonly Pick<ModifierSpec,'stat'|'flat'|'multiplier'|'amount'>[]|undefined):EffectNature{
 const signs=(mods??[]).map(modifierSign);return signs.some(x=>x>0)?'help':signs.some(x=>x<0)?'harm':'neutral';
}
export function effectNature(e:EffectSpec,lib?:LibrarySpec):EffectNature{
 switch(e.op){
  case 'damage':return 'harm';
  case 'heal':case 'shield':case 'revive':return 'help';
  case 'dispel':return e.polarity==='negative'&&e.mode==='remove'?'help':'harm';
  case 'apply_status':{const st=lib?.statuses[e.status];if(!st)return 'neutral';
   if(st.polarity==='negative'||(st.control&&(st.polarity!=='positive'||HARM_CONTROLS.has(st.control))))return 'harm';
   if(st.polarity==='positive')return st.reactions?.length||st.control?'stance':'help';
   return modifierNature(st.modifiers)==='harm'?'harm':'neutral';}
  case 'modify':return modifierNature(e.modifiers);
  case 'resource':return e.mode==='add'||e.mode==='set'?'help':e.mode==='subtract'||e.mode==='burn'?'harm':'neutral';
  case 'rule':return HARM_RULES.has(e.rule)?'harm':'stance';
  case 'atb':return e.mode==='retreat'||e.mode==='end'?'harm':'stance';
  case 'cast':return e.mode==='accelerate'?'stance':'harm';
  case 'uses':return e.mode==='spend'||e.mode==='seal'?'harm':'stance';
  case 'source':return e.mode==='restore'?'help':'harm';
  case 'speed':return e.multiplier>1?'help':e.multiplier<1?'harm':'neutral';
  case 'armor':return e.amount.flat<0?'harm':'help';
  case 'reduction':return e.fraction>0?'help':'neutral';
  case 'damage_bonus':return e.multiplier<1||e.flat<0?'harm':'help';
  case 'heal_bonus':return e.multiplier>1?'help':e.multiplier<1?'harm':'neutral';
  case 'element_resist':return e.multiplier<1?'help':e.multiplier>1?'harm':'neutral';
  default:return 'neutral';
 }
}
const manualSingle=(t:TargetSpec|undefined,side:TargetSpec['side'])=>!!t&&t.side===side&&t.selection==='manual'&&(t.count??1)===1&&(t.life??'alive')==='alive';
/** 旧降级器把正面状态、净化、敌我两用一律当成对敌动作：主目标是敌方，效果却单独“手选同伴”——
 * 选中的敌人永远不在同伴池里，这些效果从来不会生效（死效果）。按结构修复：
 * 1. 有死效果、主目标效果全部有益（或没有）→ 整个动作改为选同伴（含自身），死效果沿用主目标；
 * 2. 有死效果、主目标效果里有有害的 → 敌我皆可选：原主目标效果只作用于所选敌人，原同伴效果只作用于所选同伴；
 * 3. 没有死效果、主目标效果全部有益（如被当成驱散的净化）→ 改为选同伴；
 * 4. 没有任何效果作用于所选敌人、只作用于自身 → 改为自身（不再要求点一个敌人）。
 * 其它动作原样返回。 */
export function repairLegacyTargeting(a:ActionSpec):{action:ActionSpec;changed:boolean}{
 let changed=false;let x=a;
 const summons=a.library?.summons;
 if(summons&&a.library){for(const tpl of Object.values(summons))for(const id of tpl.actions){const inner=a.library.actions[id];if(!inner)continue;const r=repairOne({...inner,library:a.library} as ActionSpec);if(r.changed){if(!changed){x=structuredClone(a);changed=true;}const {library:_drop,...rest}=r.action;x.library!.actions[id]=rest as typeof inner;}}}
 const r=repairOne(x);
 return r.changed?{action:r.action,changed:true}:{action:x,changed};
}
function repairOne(a:ActionSpec):{action:ActionSpec;changed:boolean}{
 if(a.target!=='enemy'||a.category==='command'||a.activation)return {action:a,changed:false};
 if(a.targeting&&!manualSingle(a.targeting,'enemy'))return {action:a,changed:false};
 if(!a.effects.length)return {action:a,changed:false};
 const lib=a.library,dead=(e:EffectSpec)=>manualSingle(e.targeting,'ally');
 const main=a.effects.filter(e=>!e.targeting||manualSingle(e.targeting,'enemy'));
 const deadCount=a.effects.filter(dead).length;
 const others=a.effects.filter(e=>!main.includes(e)&&!dead(e));
 const selfish=others.every(e=>e.targeting?.side==='self'||e.targeting?.side==='owner');
 const x=structuredClone(a);
 if(deadCount){
  if(main.every(e=>effectNature(e,lib)==='help')){
   x.target='ally';delete x.targeting;for(const e of x.effects)if(dead(e)||manualSingle(e.targeting,'enemy'))delete e.targeting;
   return {action:x,changed:true};
  }
  x.targeting={side:'any',selection:'manual',count:1,life:'alive'};
  for(const e of x.effects)if(!e.targeting)e.targeting={side:'enemy',selection:'manual',count:1,life:'alive'};
  return {action:x,changed:true};
 }
 if(main.length&&selfish&&main.every(e=>effectNature(e,lib)==='help')){
  x.target='ally';delete x.targeting;for(const e of x.effects)if(manualSingle(e.targeting,'enemy'))delete e.targeting;
  return {action:x,changed:true};
 }
 if(!main.length&&selfish){x.target='self';delete x.targeting;return {action:x,changed:true};}
 return {action:a,changed:false};
}
/** 敌我两用：主目标“任意一方”的动作里，只作用于敌方/同伴的效果各自的标签。 */
export function sideGate(a:Pick<ActionSpec,'targeting'>,e:EffectSpec):'enemy'|'ally'|undefined{
 if(a.targeting?.side!=='any')return;const t=e.targeting;
 if(t&&t.selection==='manual'&&(t.side==='enemy'||t.side==='ally'))return t.side;
 const c=e.conditions?.find(c=>c.kind==='side'&&(c.key==='opposite'||c.key==='same')&&(c.subject??'caster')==='target');
 return c?(c.key==='opposite')!==!!c.invert?'enemy':'ally':undefined;
}
