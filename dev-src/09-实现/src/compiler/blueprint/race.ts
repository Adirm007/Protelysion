/** 种族条目（世界书种族设定）→ 战斗效果。
 * 种族设定大多是生理、寿命、社会等叙事，这些没有战斗意义的内容不编成战斗技能；
 * 只保留种族之间的抗性差异（element_resist 倍率 0/0.5/1.5/2）与原文明写的状态免疫。
 * 什么都推不出时返回非战斗条目（种族条目允许 noncombat）。结果只由种族原文决定，同种族角色一致。 */
import {mappingFromParsed,blueprintActor} from './compile';
import {sourceCitation,sourceText} from '../source-text';
import type {Blueprint,BPStep} from './types';
import type {AbilityEntry,AdaptedMapping} from '../adaptive';
import type {Rules} from '../rules';
import type {Obj} from '../../core/actors';

type Element='物'|'火'|'水'|'暗'|'光'|'精';
const EL:Record<string,Element>={物理:'物',物:'物',火焰:'火',火:'火',炎:'火',水:'水',冰:'水',寒冷:'水',暗影:'暗',黑暗:'暗',暗:'暗',亡灵:'暗',光明:'光',神圣:'光',圣光:'光',光:'光',雷电:'光',雷:'光',闪电:'光',精神:'精',心灵:'精'};
const ELW=Object.keys(EL).sort((a,b)=>b.length-a.length).join('|');
/** 原型：由种族本质推定的抗性倾向（原文明写的抗性优先）。 */
const ARCHETYPES:{re:RegExp;set:Partial<Record<Element,number>>;why:string}[]=[
 {re:/灵体|灵基|器灵|物灵|幽灵|魂体/,set:{物:.5,精:1.5},why:'灵体：物理伤害减半，惧精神冲击'},
 {re:/血族|吸血鬼|不死族|骷髅|僵尸/,set:{暗:.5,光:1.5},why:'不死/血族：耐暗，惧神圣'},
 {re:/魔族|恶魔|魔鬼|深渊生物/,set:{暗:.5,光:1.5},why:'魔性：耐暗，惧神圣'},
 {re:/法则与能量的集合体|古龙/,set:{物:.5},why:'古龙：本质为法则能量，物理伤害减半'},
 {re:/巨龙血脉/,set:{火:.5},why:'巨龙血脉：耐火'},
 {re:/神龙血脉/,set:{水:.5},why:'神龙血脉：耐水'},
 {re:/深海|人鱼|水母|海妖|鱼尾|半人半鱼/,set:{水:.5,光:1.5},why:'水栖：耐水，惧雷电'},
 {re:/亡灵法术专家/,set:{暗:.5},why:'亡灵法术亲和：耐暗'},
 {re:/神性|神明碎片|神祇|神圣感|圣都/,set:{光:.5},why:'神性：耐光'},
 {re:/植物|树精|花妖/,set:{火:1.5},why:'植物：惧火'},
];
const CONTROL_WORDS:Record<string,string[]>={幻术:['混乱'],惑术:['魅惑'],魅惑:['魅惑'],精神控制:['魅惑','混乱'],恐惧:['恐惧'],睡眠:['睡眠'],石化:['石化'],冰冻:['冻结'],中毒:['中毒'],毒素:['中毒']};

export type RaceTraits={resist:Partial<Record<Element,number>>;immune:string[];reasons:string[]};
/** 只看“种族本质/特质/定义”层面的原文；“例子/伪弱点”这类列举与辟谣段落不参与推定。 */
function essence(text:string):string{
 return text.replace(/例子:[\s\S]*?(?=\n\S|$)/g,'').replace(/伪弱点:[\s\S]*?(?=\n {0,2}\S|$)/g,'').replace(/(?:^|\n)[^\n]*(?:NOTE|凡俗误信)[^\n]*/g,'');
}
export function raceTraits(entry:AbilityEntry):RaceTraits{
 // 原型只看名称与开头的定义/特质段，避免把正文里顺带提到的其他生物当成本种族。
 const text=essence(sourceText(entry.raw)),head=entry.name+'\n'+text.slice(0,500);
 const resist:Partial<Record<Element,number>>={},explicit=new Set<Element>(),immune=new Set<string>(),reasons:string[]=[];
 const set=(e:Element,v:number,why:string,force=false)=>{if(!force&&explicit.has(e))return;if(force)explicit.add(e);resist[e]=v;reasons.push(why);};
 // 原文明写：免疫/无效 → 0；抗性/耐性 → 0.5；弱点/惧/畏/克制 → 1.5（“致命/极度”→2）
 for(const m of text.matchAll(new RegExp(`(?:免疫|无效化?)(?:一切|所有)?(${ELW})(?:属性|系)?(?:伤害|攻击|魔法)`,'g')))set(EL[m[1]!]!,0,`原文：${m[0]}`,true);
 for(const m of text.matchAll(new RegExp(`(${ELW})(?:属性|系)?(?:伤害)?(?:抗性|耐性|抵抗)`,'g')))if(!/弱|低|差/.test(text.slice(m.index!+m[0].length,m.index!+m[0].length+2)))set(EL[m[1]!]!,.5,`原文：${m[0]}`,true);
 for(const m of text.matchAll(new RegExp(`(?:惧怕?|畏惧?|害怕|怕)(${ELW})|(${ELW})(?:属性|系)?[^，。；\\n]{0,8}(?:克制|弱点|瓦解|致命)`,'g'))){const e=EL[(m[1]??m[2])!]!;set(e,/致命|极度/.test(m[0])?2:1.5,`原文：${m[0]}`,true);}
 if(/免疫[^。；\n]{0,12}(?:多数|大部分)?物理/.test(text))set('物',.5,'原文：免疫多数物理攻击（按减半）',true);
 for(const m of text.matchAll(/(?:免疫|不受)([^。；\n]{1,20})/g))for(const [w,list] of Object.entries(CONTROL_WORDS))if(m[1]!.includes(w))for(const s of list)immune.add(s);
 if(immune.size)reasons.push('原文状态免疫：'+[...immune].join('、'));
 for(const a of ARCHETYPES)if(a.re.test(head)){let used=false;for(const [e,v] of Object.entries(a.set) as [Element,number][])if(!explicit.has(e)&&resist[e]===undefined){resist[e]=v;used=true;}if(used)reasons.push(a.why);}
 for(const [e,v] of Object.entries(resist) as [Element,number][])if(v===1)delete resist[e];
 return {resist,immune:[...immune],reasons};
}
const MUL_TEXT=(v:number)=>v===0?'免疫':v<1?'减半':v>=2?'双倍':'1.5倍';
/** 种族条目的确定性转换；非种族条目返回 undefined。 */
export function raceAbility(entry:AbilityEntry,source:Obj,rules:Rules):AdaptedMapping|undefined{
 if(!entry.sourceId.startsWith('/种族/'))return undefined;
 const t=raceTraits(entry),citation=sourceCitation(entry.raw)||sourceText(entry.raw).slice(0,200)||entry.name;
 const mods=(Object.entries(t.resist) as [Element,number][]).map(([e,v])=>({stat:e+'抗性',mul:v}));
 if(!mods.length&&!t.immune.length){
  const summary='种族设定为生理、寿命与社会等叙事，没有战斗加成，不生成战斗技能；该种族抗性为默认值。';
  return {mapping:{sourceId:entry.sourceId,disposition:'noncombat',reason:summary,action:null,fidelity:{mode:'exact',summary,clauses:[{original:citation.slice(0,3900),implementation:summary}],changes:[]}},adaptation:{mode:'original',summary,method:'local'}};
 }
 const steps:BPStep[]=[];if(mods.length)steps.push({do:'stat',target:{side:'self'},mods});if(t.immune.length)steps.push({do:'immune',target:{side:'self'},to:t.immune});
 const bp:Blueprint={kind:'passive',name:'种族抗性',steps};
 const out=mappingFromParsed(entry,blueprintActor(source,rules),{main:bp,extra:[],notes:[]},'local');
 const summary=[...(Object.entries(t.resist) as [Element,number][]).map(([e,v])=>`${e}属性伤害${MUL_TEXT(v)}`),...(t.immune.length?['免疫'+t.immune.join('、')]:[])].join('；');
 const changes=[{original:citation.slice(0,3900),implemented:('只保留种族抗性差异：'+summary+'（依据：'+t.reasons.join('；')+'）').slice(0,3900),reason:'种族设定中没有战斗加成的生理与社会叙事不编成战斗技能'}];
 out.mapping.reason=('种族抗性：'+summary).slice(0,8000);
 out.mapping.fidelity={mode:'approximate',summary,clauses:[{original:citation.slice(0,3900),implementation:summary}],changes};
 out.adaptation={mode:'approximate',summary,method:'local'};
 return out;
}
