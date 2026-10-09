/** 蓝图 → Mapping：本地解析与模型蓝图共用同一条降级与合同校验路径。 */
import {parseEntry,type ParsedEntry} from './parse';
import {combatize,lowerBlueprint,stepNature,type Lowered} from './lower';
import {describeBlueprint} from './describe';
import {normalizeBlueprint,type Blueprint,type BPStep} from './types';
import {blueprintPrompt,BLUEPRINT_REPLY_SCHEMA,type PromptEntry} from './prompt';
import {hostSkillScale} from '../host-skill-scale';
import {validateAction,type MappingSpec,type ActionSpec} from '../contract';
import {assertExecutable,assertPassive} from '../../battle/executor';
import {sourceCitation,sourceText} from '../source-text';
import {fixedHeals,hasPercentHeal,type FixedHeal} from './heal-text';
import {findStd} from './statuses';
import {hostLevel,object,type Obj} from '../../core/actors';
import {COMPILE_POLICY,type AbilityEntry,type AdaptedMapping} from '../adaptive';
import type {Rules} from '../rules';

const ATTRS=['力量','敏捷','体质','智力','精神'] as const;
export type BlueprintActor={level:number;tier:number;power:number;cost:number;attributeFactor:number;attributes:Record<(typeof ATTRS)[number],number>};
export function blueprintActor(source:Obj,rules:Rules):BlueprintActor{
 const level=hostLevel(source),sc=hostSkillScale(level,rules),a=object(source.属性??{});
 return {level,tier:sc.tier,power:sc.power,cost:sc.cost,attributeFactor:sc.attributeFactor,attributes:Object.fromEntries(ATTRS.map(k=>[k,Number(a[k])||0])) as BlueprintActor['attributes']};
}
function lowerOne(bp:Blueprint,i:number,entry:AbilityEntry,actor:BlueprintActor):Lowered{
 const low=lowerBlueprint(bp,{key:entry.sourceId+'#'+i,sourceId:entry.sourceId,name:bp.name??entry.name,level:actor.level,tier:actor.tier,power:actor.power,cost:actor.cost,attributeFactor:actor.attributeFactor,attributes:actor.attributes,passive:bp.kind==='passive'});
 if(entry.sourceId.startsWith('/道具定义/')){low.action.copyable=false;low.action.category='item';low.action.perBattleUses=0;}
 const a=validateAction(low.action) as ActionSpec;low.action=a;if(low.disposition==='passive')assertPassive(a);else assertExecutable(a);return low;
}
/** 把一组蓝图降级为单个 Mapping：至多一个被动作为主体，其余主动进入 actions。任何一步失败即抛出，由调用方回退。 */
export function mappingFromParsed(entry:AbilityEntry,actor:BlueprintActor,parsed:ParsedEntry,method:'local'|'model'):AdaptedMapping{
 const all=[parsed.main,...parsed.extra].map(combatize);const lowered:{bp:Blueprint;low:Lowered}[]=[];const dropped:string[]=[];
 for(const [i,bp] of all.entries()){try{lowered.push({bp,low:lowerOne(bp,i,entry,actor)});}catch(err){if(i===0)throw err;dropped.push(`${bp.name??entry.name}：${(err as Error).message.slice(0,120)}`);}}
 const passives=lowered.filter(x=>x.low.disposition==='passive'),actives=lowered.filter(x=>x.low.disposition==='active');
 const head=passives[0]??actives[0];if(!head)throw Error('蓝图没有可执行动作');
 for(const extra of passives.slice(1))dropped.push(`${extra.bp.name??entry.name}：额外被动未合并`);
 const rest=actives.filter(x=>x!==head);
 const notes=[...parsed.notes,...lowered.flatMap(x=>x.low.notes),...dropped.map(d=>'未能执行的分项：'+d)].filter((x,i,l)=>x&&l.indexOf(x)===i);
 const described=lowered.map(x=>describeBlueprint(x.bp)).join('\n').slice(0,3900)||'按原文效果执行';
 const citation=sourceCitation(entry.raw)||sourceText(entry.raw).slice(0,200)||entry.name;
 const modelChanges=lowered.flatMap(x=>(x.bp.changes??[]).map(c=>({original:(c.original||citation).slice(0,3900),implemented:c.implemented.slice(0,3900),reason:(c.reason||'游戏化转换').slice(0,1900)})));
 const changes=[...notes.map(n=>({original:citation.slice(0,3900),implemented:n.slice(0,3900),reason:'原文条款按执行器可表达的边界近似'})),...modelChanges];
 // 本地解析可能漏掉未识别的叙事条款，不自称原效；模型自报近似但未列差异时补一条通用说明。
 if(method==='local')changes.unshift({original:citation.slice(0,3900),implemented:'本地条款解析结果（未经模型复核），未识别的叙事性条款不生效',reason:'模型不可用或模型蓝图无效时，由本地解析器按原文条款生成'});
 else if(!changes.length&&lowered.some(x=>x.bp.fidelity&&x.bp.fidelity!=='exact'))changes.push({original:citation.slice(0,3900),implemented:described.slice(0,3900),reason:'模型标注为近似转换'});
 changes.splice(32);
 const exact=!changes.length;
 const mapping:MappingSpec={sourceId:entry.sourceId,disposition:head.low.disposition,reason:(method==='model'?'模型蓝图':'本地蓝图')+'还原：'+described.slice(0,7000),action:head.low.action,
  ...(rest.length?{actions:rest.map(x=>x.low.action)}:{}),
  fidelity:{mode:exact?'exact':'approximate',summary:described,clauses:[{original:citation.slice(0,3900),implementation:described}],changes}};
 return {mapping,adaptation:{mode:exact?'original':'approximate',summary:described.slice(0,3900),method,policy:COMPILE_POLICY}};
}
/** 本地解析蓝图；无法解析或降级失败时返回 undefined。 */
export function localBlueprint(entry:AbilityEntry,source:Obj,rules:Rules):AdaptedMapping|undefined{
 if(entry.sourceId.startsWith('/种族/')||entry.sourceId.startsWith('/状态定义/'))return undefined;
 const actor=blueprintActor(source,rules);
 let parsed:ParsedEntry|undefined;try{parsed=parseEntry(entry,{name:entry.name,sourceId:entry.sourceId,level:actor.level,tier:actor.tier,power:actor.power,cost:actor.cost});}catch{return undefined;}
 if(!parsed)return undefined;
 try{return mappingFromParsed(entry,actor,parsed,'local');}catch{return undefined;}
}
export type BlueprintModel=(request:{prompt:string;schema:unknown})=>Promise<unknown>;
export const BLUEPRINT_BATCH=6;
/** 模型蓝图：按至多 6 条分批请求；返回每个来源的解析结果（未返回或不合法的来源缺省）。 */
export async function modelBlueprints(entries:AbilityEntry[],source:Obj,rules:Rules,model:BlueprintModel,batch=BLUEPRINT_BATCH,legacy:unknown[]=[]):Promise<Map<string,ParsedEntry>>{
 const actor=blueprintActor(source,rules),out=new Map<string,ParsedEntry>();
 for(let i=0;i<entries.length;i+=batch){
  const group=entries.slice(i,i+batch),pe:PromptEntry[]=group.map(e=>({sourceId:e.sourceId,name:e.name,text:sourceText(e.raw)}));
  let reply:unknown;try{reply=await model({prompt:blueprintPrompt(pe,{name:String(source.姓名??''),...actor}),schema:BLUEPRINT_REPLY_SCHEMA});}catch{continue;}
  // 兼容旧协议回复：mappings 信封交给调用方按原合同路径处理
  if(reply&&typeof reply==='object'&&!Array.isArray(reply)&&Array.isArray((reply as Obj).mappings)&&!Array.isArray((reply as Obj).entries)){legacy.push(...((reply as Obj).mappings as unknown[]));continue;}
  for(const item of replyEntries(reply)){
   const id=typeof item.sourceId==='string'?item.sourceId:'';if(!group.some(e=>e.sourceId===id)||out.has(id))continue;
   const main=normalizeBlueprint(item.main);if(!main)continue;
   const extra=(Array.isArray(item.extra)?item.extra:[]).map(normalizeBlueprint).filter((x):x is Blueprint=>!!x);
   out.set(id,{main,extra,notes:[]});
  }
 }
 return out;
}
function replyEntries(reply:unknown):Obj[]{
 let r=reply;if(typeof r==='string'){try{r=JSON.parse(r.replace(/^```(?:json)?\s*|\s*```$/g,''));}catch{return [];}}
 if(Array.isArray(r))r=r.length===1&&r[0]&&typeof r[0]==='object'&&!Array.isArray(r[0])&&'entries' in (r[0] as Obj)?r[0]:{entries:r};
 const o=r&&typeof r==='object'?r as Obj:{};const list=Array.isArray(o.entries)?o.entries:Array.isArray(o.mappings)?o.mappings:[];
 return list.filter((x):x is Obj=>!!x&&typeof x==='object'&&!Array.isArray(x));
}
/** 宿主规则由程序补全，不交给模型：登神阶段费用/次数、缺省同阶费用、增益默认作用于自身。 */
/** 原文里“只作用于自己”的说法与“可以给别人”的说法（0.38.1 目标缺省用）。 */
const SELF_CUE=/自身|自己|本人|自我|己身|施术者|使用者自身|化身|变身|进入[^，。；]{0,8}(?:状态|形态|姿态|架势)/;
const ALLY_CUE=/同伴|队友|友方|友军|己方|我方|伙伴|盟友|他人|其他人|全队|团队|目标|一名(?:角色|成员|单位)|指定(?:角色|单位|对象)|任意(?:角色|单位|一人)/;
/** 道具可以用在同伴身上的姿态类（格挡、闪避、免死…）；撤离、召唤、领域、形态等仍只作用于使用者。 */
const ITEM_STANCE=/^(guard|reduce|damage_reduction|dodge|evade|reflect|thorns|counter|sure_hit|guaranteed_hit|undying|death_guard|deathguard|luck|untargetable|immune|immunity|mana_shield|resource_guard|damage_cap|atb|push|extra_turn|extra_action)$/;
export function finalizeModelBlueprint(bp:Blueprint,entry:AbilityEntry,actor:BlueprintActor):Blueprint{
 const b:Blueprint=structuredClone(bp);const id=entry.sourceId;const item=id.startsWith('/道具定义/'),equipment=id.startsWith('/装备/');
 restoreFixedHeals(b,sourceText(entry.raw));
 if(b.kind==='active'){
  if(/^\/登神长阶\/权能\//.test(id))b.cost={mpPct:25,spPct:25};
  else if(/^\/登神长阶\/法则\//.test(id)){b.cost={mpPct:50,spPct:50};b.perBattle=1;}
  else if(item){delete b.cost;b.category='item';}
  // 装备附带的主动：原文未写费用/次数时按冷却3回合限制，避免免费连发
  else if(equipment&&!b.cooldown&&!b.perBattle&&!b.charges&&(!b.cost||!Object.values(b.cost).some(v=>typeof v==='number'&&v>0)))b.cooldown=3;
  else if(!equipment&&(!b.cost||!Object.values(b.cost).some(v=>typeof v==='number'&&v>0))){const physical=b.steps.some(x=>x.do==='damage'&&/physical|物理/.test(String(x.channel??'')));b.cost=physical?{sp:actor.cost}:{mp:actor.cost};}
 }
 const selfBuff=(x:BPStep)=>{if(x.target)return;if(x.do==='stat'){const ms=Array.isArray(x.mods)?x.mods as {stat?:string;add?:number;pct?:number}[]:[];if(ms.length&&ms.every(m=>!/受到/.test(String(m.stat))&&(m.add??m.pct??0)>0))x.target={side:'self'};}
  else if(['guard','dodge','reflect','counter','sure_hit','undying','death_guard','luck','untargetable','heal','shield','cleanse'].includes(x.do))x.target={side:'self'};};
 // 0.38.1 目标缺省（主动）：原规则“增益一律作用于自身”只保留给攻击附带的增益和原文只写自身的技能；
 // 敌我两用(target any)不补目标，由降级器按所选目标的阵营分派；纯辅助的治疗/护盾/正面状态/增益/净化默认可选同伴（含自身）；
 // 格挡/闪避/免死这类姿态仍作用于自身，原文写明同伴时除外；道具用在谁身上就作用于谁（默认可选同伴，含自身）。
 if(b.kind==='active'){
  const text=sourceText(entry.raw),allyCue=ALLY_CUE.test(text),selfOnly=SELF_CUE.test(text)&&!allyCue;
  if(!b.target&&b.steps.some(x=>x.when?.some(c=>c.kind==='target_is_enemy'||c.kind==='target_is_ally')))b.target={side:'any'};
  const harmful=b.steps.some(x=>stepNature(x)==='harm'&&(!x.target||x.target.side==='enemy'||x.target.side==='any'));
  if(b.target?.side==='any'){/* 两用：保持原样 */}
  else if(harmful||(selfOnly&&!item))for(const x of b.steps)selfBuff(x);
  else{
   for(const x of b.steps)if(!x.target&&stepNature(x)==='stance'&&!(item?ITEM_STANCE.test(x.do):allyCue))x.target={side:'self'};
   if(!b.target&&!b.steps.some(x=>!x.target&&x.do==='revive')&&b.steps.some(x=>!x.target&&(stepNature(x)==='help'||stepNature(x)==='stance')))b.target={side:'ally'};
  }
 }else for(const x of b.steps)selfBuff(x);
 // 常驻被动（非触发）的顶层属性修正作用于自身，包括“受到伤害-X%”这类减益型写法。
 if(b.kind==='passive')for(const x of b.steps)if(!x.target&&x.do==='stat')x.target={side:'self'};
 // 原文写明每场限用一次而模型漏写时补上（仅主动；被动的次数由触发器 uses 表达）。
 if(b.kind==='active'&&!b.perBattle&&/每场(?:战斗)?(?:限|仅限?|只能)?(?:使用)?(?:一|1)次|(?:一|1)次\/战斗|每战(?:限)?(?:一|1)次/.test(sourceText(entry.raw)))b.perBattle=1;
 return b;
}
const HEAL_DO=/^(heal|restore|recover)$/;
const sameResource=(step:unknown,f:FixedHeal)=>{const r=String(step??'hp').toLowerCase();return r===f.resource||(f.resource==='auto'&&/^(auto|needed|need|lowest|adaptive|any)$/.test(r))||(f.resource==='hp'&&/^(hp|生命)$/.test(r))||(f.resource==='mp'&&/^(mp|法力)$/.test(r))||(f.resource==='sp'&&/^(sp|体力)$/.test(r));};
/** 0.38.2 原文是固定值治疗（且全文没有百分比治疗）时，模型写成的 pct / hotPct / 标准“再生”一律改回原文固定值。 */
export function restoreFixedHeals(b:Blueprint,text:string){
 const fixed=fixedHeals(text);if(!fixed.length||hasPercentHeal(text))return;
 const direct=fixed.filter(f=>!f.perRound),ticking=fixed.filter(f=>f.perRound);
 const pick=(pool:FixedHeal[],resource:unknown)=>pool.find(f=>sameResource(resource,f))??pool[0];
 const hotOf=()=>(ticking[0]??fixed[0])!.amount;
 const fixStatus=(x:Record<string,unknown>)=>{if(typeof x.hotPct==='number'&&x.hotAmount===undefined){x.hotAmount=hotOf();delete x.hotPct;}};
 const visit=(v:unknown,round:boolean):void=>{
  if(Array.isArray(v)){for(const x of v)visit(x,round);return;}
  if(!v||typeof v!=='object')return;const x=v as Record<string,unknown>;
  const inRound=round||x.on==='round';
  if(typeof x.do==='string'&&HEAL_DO.test(x.do)&&x.amount===undefined&&x.value===undefined&&x.pctLost===undefined&&x.pctOfDamage===undefined){
   const f=pick(inRound&&ticking.length?ticking:direct.length?direct:fixed,x.resource);if(f){x.amount=f.amount;delete x.pct;delete x.pctMax;}}
  if(x.do==='field'||x.do==='domain'||x.do==='zone'||x.do==='aura')fixStatus(x);
  if(x.do==='status'||x.do==='apply'){
   if(x.status&&typeof x.status==='object')fixStatus(x.status as Record<string,unknown>);
   else if(typeof x.status==='string'&&findStd(x.status)?.hot&&x.hotAmount===undefined&&(ticking.length||x.hotPct!==undefined)){x.hotAmount=hotOf();delete x.hotPct;}
   else fixStatus(x);}
  for(const [k,c] of Object.entries(x))if(k!=='when'&&c&&typeof c==='object')visit(c,inRound);
 };
 visit(b,false);
}
/** 模型蓝图直接降级；失败返回 undefined，由调用方回退到本地蓝图。 */
export function modelBlueprintMapping(entry:AbilityEntry,source:Obj,rules:Rules,parsed:ParsedEntry):AdaptedMapping|undefined{
 const actor=blueprintActor(source,rules);
 // 只含叙事 note 的蓝图不可执行：若同条目还有可执行蓝图则丢弃它（记为差异），否则整条交回本地解析。
 const all=[parsed.main,...parsed.extra],narrative=(x:Blueprint)=>![...x.steps,...(x.triggers??[]).flatMap(t=>t.steps??[])].some(s=>s.do!=='note');
 const kept=all.filter(x=>!narrative(x));if(!kept.length)return undefined;
 const dropped=all.filter(narrative);
 const main=finalizeModelBlueprint(kept[0]!,entry,actor);
 if(dropped.length)main.changes=[...(main.changes??[]),...dropped.map(d=>({original:d.steps.map(s=>String(s.text??'')).join('；').slice(0,500)||d.name||'叙事条款',implemented:'不生成战斗效果',reason:'纯叙事或非战斗条款'}))];
 try{return mappingFromParsed(entry,actor,{...parsed,main,extra:kept.slice(1).map(x=>finalizeModelBlueprint(x,entry,actor))},'model');}catch{return undefined;}
}
