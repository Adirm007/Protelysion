/** 特殊单位「?」（0.35；0.39 起刷新率 33%、去掉检定必成功）：个位为 9 的楼层 33% 出现在玩家 18 格外，按最短路径与玩家同速追逐。
 *  面板比队伍最高等级高 1 级；无 / 精属性对她无效；百分比伤害全额反转为治疗、真实伤害全额反射（先于抗性）；
 *  敌方无法给她挂任何效果；检定按常规掷骰（0.39 去掉了“检定默认成功”）；复制队伍里所有持有“百分比伤害 / 真实伤害”技能成员的全部主动与被动技能，
 *  没人持有则只有投掷飞刀。击败必掉盲盒与经验，小概率掉「暧昧的线」。 */
import type {ActionSpec,EffectSpec} from '../../compiler/contract';
import type {CompiledActor} from '../../compiler/engine';
import type {MonsterDesign,ThemeDesign} from './catalog';
import {authoredMonsterKit} from './kits';
import {isAlive,mergeLibrary,auditInvulnerability,type Battle} from '../../battle/executor';
import {action,flat} from './ir';
import type {MaterialQuality} from './materials';

export const STRAY_ID='COMMON_STRAY';
export const STRAY_NAME='?';
export const STRAY_DESIGN:MonsterDesign={id:STRAY_ID,designId:STRAY_ID,theme:'T15',name:STRAY_NAME,role:'精英',cores:['shot','mirror'],motif:'未成之笔',build:'hunter'};
const STRAY_THEME:ThemeDesign={id:'T15',name:'纸页天穹·留白',scenes:['未写的页','未写的页','未写的页'],subtitle:'尚未成字的笔画',lawNames:['无字','留白'],laws:['equivalence','reflection'],realm:'无字之页',element:'无'};
/** 专属素材：神话级消耗品，可带出迷宫；转化方式交给读者/宿主。 */
export const STRAY_THREAD={name:'暧昧的线',quality:'神话' as MaterialQuality,effect:'可以转为任何想要的素材，也许就连源质也……',description:'尚未成型，排布成字的笔画，因此，也有可以成为任何名作的可能性。如果收集九个的话…'};
export const STRAY_THREAD_CHANCE=.06;
export const STRAY_SPAWN_CHANCE=.33;
export const STRAY_SPAWN_DISTANCE=18;
/** 她的步频 = 玩家按住方向键时的步频（Godot 侧 walk_timer 0.16s/格）：玩家站着不动她也照追。 */
export const STRAY_STEP_MS=160;
export const strayFloor=(depth:number)=>depth%10===9;

const amounts=(e:EffectSpec)=>e.op==='damage'?Object.entries(e.amounts) as [string,{flat:number;factor:number;attribute:string;maxFraction:number;currentFraction?:number;expression?:unknown}][]:[];
export const isPercentDamage=(e:EffectSpec)=>amounts(e).some(([,a])=>(a.maxFraction??0)!==0||(a.currentFraction??0)!==0);
export const isTrueDamage=(e:EffectSpec)=>amounts(e).some(([ch,a])=>ch==='true'&&((a.flat??0)>0||((a.attribute??'none')!=='none'&&(a.factor??0)>0)||(a.maxFraction??0)!==0||(a.currentFraction??0)!==0||!!a.expression));
/** 只看技能自己直接造成的伤害：状态的持续伤害（毒 / 燃烧的 tick 在引擎里走真实通道）、触发器子动作不算“这个技能是百分比 / 真伤技能”。 */
function directEffects(a:ActionSpec):EffectSpec[]{const out=[...a.effects];for(const e of a.effects){if((e.op==='sequence'||e.op==='repeat')&&a.library?.actions[e.action])out.push(...a.library.actions[e.action]!.effects);if(e.op==='choose')for(const k of e.actions)if(a.library?.actions[k])out.push(...a.library.actions[k]!.effects);}return out;}
/** 遗物 / 道具 / 系统指令不是角色自己的技能：既不参与判定，也不被复制。 */
export const isOwnSkill=(sourceId:string)=>!/^(relic\/|item-|booksea:|\/道具)/.test(sourceId);
type Library=NonNullable<ActionSpec['library']>;
const targetDamage=(effects:EffectSpec[])=>effects.some(e=>isPercentDamage(e)||isTrueDamage(e));
/** 召唤模板里召唤物自己的招式（不论是否已经召唤出来），各自带上所在库以便解析连段。 */
export function summonActions(lib:Library|undefined):[string,ActionSpec][]{
 if(!lib)return [];const out:[string,ActionSpec][]=[];
 for(const tpl of Object.values(lib.summons??{}))for(const id of tpl.actions){const a=lib.actions[id];if(a&&!out.some(([k])=>k===id))out.push([id,{...a,library:lib}]);}
 return out;
}
const skillActions=(s:CompiledActor['skills'][number])=>[s.mapping.action,...(s.mapping.actions??[])].filter((a):a is ActionSpec=>!!a);
/** 召唤物招式里带百分比/真实伤害。 */
const summonCarries=(a:ActionSpec)=>summonActions(a.library).some(([,x])=>targetDamage(directEffects(x)));
/** 该角色是否携带“百分比伤害”或“真实伤害”技能：看自己的主动 / 被动技能直接造成的伤害，也看其召唤物（含尚未召唤的模板）的招式。 */
export function carriesTargetDamage(card:CompiledActor):boolean{
 return card.skills.some(s=>isOwnSkill(s.sourceId)&&skillActions(s).some(a=>targetDamage(directEffects(a))||summonCarries(a)));
}
function knife(power:number):ActionSpec{
 const a=action([{op:'damage',amounts:{physical:flat(power),energy:flat(0),mental:flat(0),true:flat(0)},element:'none',hitChance:.95,hitRule:'normal',critChance:.15,critMultiplier:1.5}],'enemy');
 a.name='投掷飞刀';a.description='她从袖中甩出一柄薄刃。';a.targeting={side:'enemy',selection:'manual',count:1,life:'alive',range:6};a.tags=['monster:regular','ai:ranged'];a.category='skill';return a;
}
/** 她的本质：不是技能，所以不会被复制也不会被剥夺。 */
function nature():ActionSpec{
 const forever={clock:'permanent' as const,value:0};
 const a=action([
  {op:'rule',rule:'immune_element',key:'无',duration:forever},{op:'rule',rule:'immune_element',key:'精',duration:forever},
  {op:'rule',rule:'percent_to_heal',key:'*',duration:forever},{op:'rule',rule:'true_reflect',key:'*',duration:forever},
  {op:'rule',rule:'immune_status',key:'*',duration:forever},
 ],'self');
 a.name='未成之字';a.description='无属性与精神属性对她无效；按比例计算的伤害会全额变成她的治疗，真实伤害会原样弹回攻击者；敌人无法在她身上留下任何东西。';a.tags=['monster:passive','monster:nature'];return a;
}
/** 战斗中实时镜像（0.35.1）：玩家单位在战斗里新获得的技能（复制 / 授予 / 借用留下的），只要该单位持有百分比或真实伤害技能，就同步给她。 */
export function mirrorStrayLive(b:Battle):number{
 const her=b.units.find(u=>u.side==='enemy'&&!u.owner&&u.tags?.includes(STRAY_ID));if(!her||!isAlive(her))return 0;let added=0;
 for(const u of b.units){if(u.side!=='ally'||u.owner||u.tags?.includes(STRAY_ID))continue;const actions=Object.entries(u.actions).filter(([id,a])=>a.category!=='command'&&a.category!=='item'&&a.source?.kind!=='system'&&a.source?.kind!=='item'&&isOwnSkill(id));
  const minions=summonActions(u.library);
  if(!actions.some(([,a])=>targetDamage(directEffects(a)))&&!minions.some(([,a])=>targetDamage(directEffects(a))))continue;
  // 召唤物带百分比/真伤时，连同召唤物自己的招式一起复制（召唤技能本身也在 actions 里）。
  for(const [id,a] of minions){const key='stray/'+u.id+'/summon/'+id;if(her.actions[key]||a.copyable===false)continue;mergeLibrary(her.library!,u.library);const copy=structuredClone(a);delete copy.library;copy.source={...(a.source??{kind:'skill'}),id:key,kind:a.source?.kind??'skill'};her.actions[key]=copy;her.sources??={};her.sources[key]={kind:copy.source.kind} as never;added++;}
  for(const [id,a] of actions){const key='stray/'+u.id+'/'+id;if(her.actions[key]||a.copyable===false)continue;mergeLibrary(her.library!,u.library);const copy=structuredClone(a);copy.source={...(a.source??{kind:'skill'}),id:key,kind:a.source?.kind??'skill'};her.actions[key]=copy;her.sources??={};her.sources[key]={kind:copy.source.kind} as never;added++;}
 }
 // 复制来的技能并入她的技能组后重新审查无敌类效果（整体看技能组）。
 if(added)auditInvulnerability(her);
 return added;
}
export function strayKit(level:number,party:readonly CompiledActor[]){
 const kit=authoredMonsterKit(STRAY_DESIGN,STRAY_THEME,Math.max(1,level));
 const donors=party.filter(carriesTargetDamage);
 const copied=donors.flatMap((card,i)=>card.skills.filter(s=>isOwnSkill(s.sourceId)).flatMap(s=>{const c=structuredClone(s);c.sourceId='stray/'+i+'/'+s.sourceId;c.mapping={...c.mapping,sourceId:c.sourceId};
  // 召唤物的招式也作为她自己的主动技能复制（即便该召唤物尚未被召唤）。
  const minions=skillActions(s).flatMap(a=>summonActions(a.library)).filter(([,a])=>a.copyable!==false&&a.effects.length);
  const extra=minions.map(([id,a]):CompiledActor['skills'][number]=>{const sid=c.sourceId+'/summon/'+id;return {sourceId:sid,name:(a.name??id).slice(0,300),sourceFingerprint:s.sourceFingerprint,mapping:{sourceId:sid,disposition:'active',reason:'复制召唤物招式：'+(a.name??id),action:structuredClone(a)}};});
  return [c,...extra];}));
 const power=kit.card.skills.map(s=>s.mapping.action).filter(Boolean).flatMap(a=>a!.effects).filter(e=>e.op==='damage').flatMap(e=>e.op==='damage'?Object.values(e.amounts).map(x=>x.flat):[]);
 const basePower=Math.max(1,...power);
 type Skill=CompiledActor['skills'][number];
 const natureSkill:Skill={sourceId:'stray/nature',name:'未成之字',sourceFingerprint:'authored',mapping:{sourceId:'stray/nature',disposition:'passive',reason:'她的本质',action:nature()}};
 const knifeSkill:Skill={sourceId:'stray/knife',name:'投掷飞刀',sourceFingerprint:'authored',mapping:{sourceId:'stray/knife',disposition:'active',reason:'没有可复制的技能',action:knife(basePower)}};
 kit.card.skills=[natureSkill,...(copied.length?copied:[knifeSkill])];
 // 面板 = 该等级（队伍最高 +1）的常规怪物面板，不再按被复制者放大。
 kit.mitigation.elementMultipliers={...kit.mitigation.elementMultipliers,无:0,精:0};
 kit.counterplay=['普通逃跑无效；只有间章等专门离场技能能脱身','无属性 / 精神属性伤害无效','百分比伤害会治疗她，真实伤害会原样反弹','敌方无法给她挂任何效果',...(copied.length?['她复制了队伍里持有百分比 / 真实伤害技能成员的全部技能']:['队伍里没人持有百分比 / 真实伤害技能：她只会投掷飞刀'])];
 return {...kit,donors:donors.map(d=>d.skills.length),copied:copied.length};
}
