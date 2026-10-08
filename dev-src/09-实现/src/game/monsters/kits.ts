import {EFFECT_VERSION,type ActionSpec,type QualitySpec} from '../../compiler/contract';
import {COMPILER_ID,type CompiledActor} from '../../compiler/engine';
import {MONSTER_BY_ID,MONSTER_THEME_BY_ID,type Doctrine,type MonsterDesign,type ThemeDesign} from './catalog';
import {MONSTER_CONTENT_VERSION,monsterNumbers} from './numbers';
import {action,context,damage} from './ir';
import {body,combination,coreChannel,COUNTERPLAY,defence,mythicBreak,purge,signature} from './cores';
import {authority,divinity,elements,kingdom,law} from './ascension';
import {monsterResistance} from './resistances';
import {MONSTER_MECHANICS,type MonsterMechanics} from './designs';
import {ACTIVES,AUTHORITIES,KINGDOMS,LAWS,PASSIVES} from './mechanics';
import {ARENAS,MALICE,arenaAction,isPassive,phasePack} from './malice';
import {malicePlan} from './malice-plan';
import {THEME_EXCLUSIVE} from './theme-malice';
import {CORE_TYPES} from './ir';
const QUALITY:QualitySpec[]=['common','uncommon','rare','epic','legendary','mythic','mythic'];
const LABEL=['普通','优良','稀有','史诗','传说','神话','神话'];
export function monsterKit(id:string,displayLevel:number){
 const m=MONSTER_BY_ID[id];if(!m)throw Error('未知正式怪物ID: '+id);
 return authoredMonsterKit(m,MONSTER_THEME_BY_ID[m.theme]!,displayLevel);
}
export function authoredMonsterKit(m:MonsterDesign,t:ThemeDesign,displayLevel:number){
 const id=m.id,n=monsterNumbers(m,displayLevel),s=n.lifeTier;
 const skills:CompiledActor['skills']=[],regular:string[]=[],ascended:string[]=[];
 const add=(key:string,a:ActionSpec,kind:'skill'|'system'|'ascension'|'law',passive=false)=>{
  const sourceId=`monster:${id}:t${s}:${key}`;a.source={id:sourceId,kind,...(kind==='skill'?{quality:QUALITY[s-1]!}:{}),tags:['monster:authored',id,m.theme,key]};
  const name=a.name??key;
  const mechanic=key.startsWith('passive-')||key.startsWith('unique-')||key.startsWith('malice-')||key.startsWith('arena-')||key==='phase'||key==='exclusive';
  if(kind==='skill'&&s>=4&&!mechanic)a.description=(s===4?'微弱要素':s===5?'微弱权能':'微弱法则')+'['+m.motif+']：下列有限效果是品质词条投影，不是完整登神能力。'+(a.description??'效果与期限见结构化技能详情。');
  skills.push({sourceId,name,sourceFingerprint:MONSTER_CONTENT_VERSION+':'+sourceId,mapping:{sourceId,disposition:passive?'passive':'active',reason:'名录内显式设计；非模型运行中生成。'+(a.description??''),action:a}});
  if(kind==='skill'&&!mechanic)regular.push(name);else if(kind!=='system'&&kind!=='skill')ascended.push(name);
 };
 const basicContext=context(m,t,n);basicContext.power=20*n.challengeGrowth.attack;
 const basic=action([damage(basicContext,coreChannel(m.cores[0]),1,1,CORE_TYPES[m.cores[0]])]);basic.name=m.motif+'·普通攻击';basic.category='command';basic.copyable=false;basic.castMs=0;basic.description='宿主普攻威力20+关联属性×10×生命层级系数；零费用，不是编译失败的代替技能。';
 add('attack',basic,'system');
 // 独有机制表：每只怪物的被动 / 独有主动 / 权能 / 独有法则 / 神国原型，层级越高手段越多（主动与被动同时增加）。
 const d:MonsterMechanics=MONSTER_MECHANICS[id]??{passives:[],actives:[],authority:'',law:'',earlyPassive:false};
 const unique:string[]=[];
 const mech=(key:string,table:Record<string,{build:(c:ReturnType<typeof context>)=>ActionSpec;summary:string}>,mid:string,kind:'skill'|'ascension'|'law',passive:boolean)=>{const x=table[mid];if(!x)return;const a=x.build(context(m,t,n));a.description=(a.description??'')+(a.description?'':x.summary+'。');add(key,a,kind,passive);unique.push((a.name??key)+'：'+x.summary);};
 const passiveTier=(i:number)=>i===0?(m.role!=='普通'?1:d.earlyPassive?2:4):i===1?4:6;
 add('primary',signature(context(m,t,n),m.cores[0]),'skill');add('secondary',signature(context(m,t,n),m.cores[1]),'skill');
 d.passives.forEach((pid,i)=>{if(s>=passiveTier(i))mech('passive-'+(i+1),PASSIVES,pid,'skill',true);});
 if(s>=2)add('body',body(context(m,t,n)),'skill',true);
 if(s>=3){if(d.actives[0])mech('unique-1',ACTIVES,d.actives[0],'skill',false);add('combination',combination(context(m,t,n)),'skill');}
 if(s>=4)add('defence',defence(context(m,t,n)),'skill');
 if(s>=5){add('purge',purge(context(m,t,n)),'skill');mech('authority-unique',AUTHORITIES,d.authority,'ascension',true);}
 if(s>=6){add('break',mythicBreak(context(m,t,n)),'skill');if(d.actives[1])mech('unique-2',ACTIVES,d.actives[1],'skill',false);}
 if(s===4)add('elements',elements(context(m,t,n)),'ascension',true);
 if(s===5)add('authority',authority(context(m,t,n)),'ascension');
 if(s>=6)add('law-1',law(context(m,t,n),t.laws[0],t.lawNames[0]),'law',true);
 if(s===7){
  add('law-2',law(context(m,t,n),t.laws[1],t.lawNames[1]),'law',true);mech('law-unique',LAWS,d.law,'law',true);
  add('divinity',divinity(context(m,t,n)),'ascension',true);
  if(m.role==='Boss'){
   const pools:Doctrine[]=m.build==='brute'?['judgment','sacrifice','hunger']:m.build==='guard'?['reflection','inheritance','binding']:m.build==='hunter'?['observation','uncertainty','judgment']:m.build==='swarm'?['growth','inheritance','infection']:m.build==='spirit'?['echo','boundary','winter']:['equivalence','censorship','growth'];
   const third=pools.find(x=>!t.laws.includes(x))!;
   add('law-3',law(context(m,t,n),third,'本源终律'),'law',true);add('kingdom',kingdom(context(m,t,n)),'ascension',true);
   if(d.kingdom)mech('kingdom-archetype',KINGDOMS,d.kingdom,'ascension',true);
  }
 }
 // 恶意家族（0.29/0.30/0.31）：按层级×职能分配家族、形态与领域；分配器已做无解墙检查。文案只写“它做了什么”，不写解法（0.30.1）。
 const plan=malicePlan(m,s);
 plan.slots.forEach((slot,i)=>{const x=MALICE[slot.id]!;const a=x.build(context(m,t,n),slot.form);a.description=(a.description??'')+'【'+x.family+'·'+slot.form+'】'+x.summary[slot.form]+'。';add('malice-'+(i+1),a,'skill',isPassive(x,slot.form));unique.push((a.name??slot.id)+'：'+x.summary[slot.form]);});
 plan.arenas.forEach((id,i)=>{const ar=ARENAS.find(a=>a.id===id)!;const a=arenaAction(context(m,t,n),ar);add('arena-'+(i+1),a,'ascension',true);unique.push(a.name+'：'+ar.summary+'（领域，不可解除）');});
 // 主题专属机制（0.32/0.33）：Boss t3 起完全体，精英 t5 起雏形；不占配额，单独一个槽位。
 if(plan.exclusive){const x=THEME_EXCLUSIVE[plan.exclusive.id]!,form=plan.exclusive.form;const a=x.build(context(m,t,n),form);a.description=(a.description??'')+'【主题专属·'+(form==='full'?'完全体':'雏形')+'】'+x.summary[form]+'。';add('exclusive',a,'skill',x.passive);unique.push((a.name??x.name)+'：'+x.summary[form]);}
 // 阶段转换 = 规则包：Boss 三阶起（血色蒙版），精英五阶起（重影）。
 const phase=m.role==='Boss'&&s>=3?'red':m.role==='精英'&&s>=5?'afterimage':null;
 if(phase){const a=phasePack(context(m,t,n),phase);add('phase',a,'skill',true);unique.push('第二阶段：'+(a.description??''));}
 // 脚本连段：精英/Boss 三阶起按固定环出招（AI 读取 ai:rot 标签），七阶跨阶段计数不重置。
 if(plan.rotation){const order=['primary',...plan.slots.map((x,i)=>isPassive(MALICE[x.id]!,x.form)?'':'malice-'+(i+1)).filter(Boolean),...(plan.exclusive&&!THEME_EXCLUSIVE[plan.exclusive.id]!.passive?['exclusive']:[]),'combination','secondary'];const ring=order.map(k=>skills.find(x=>x.sourceId.endsWith(':'+k)&&x.mapping.disposition==='active')).filter(Boolean);ring.forEach((x,i)=>{const a=x!.mapping.action!;a.tags=[...(a.tags??[]),'ai:rot:'+i,'ai:rotlen:'+ring.length];});}
 const card:CompiledActor={version:COMPILER_ID,effectVersion:EFFECT_VERSION,sourceFingerprint:MONSTER_CONTENT_VERSION+':'+id+':'+displayLevel,rulesFingerprint:'host-v4.3-monster-npc-rules',traits:{tags:['monster',id,m.theme,'monster:'+m.role,...(s===7?['divine']:[])]},numeric:{level:n.kitLevel,attributes:n.attributes,max:n.max},skills};
 const {力量:str,敏捷:dex,体质:con,智力:int,精神:spi}=n.attributes;
 const mitigation={armor:{physical:0,energy:0,mental:0},attributeReduction:{physical:(con+str+dex)*.0025,energy:(spi+int)*.004,mental:spi*.008},elementMultipliers:monsterResistance(id,s,m.role)};
 return {version:MONSTER_CONTENT_VERSION,id,name:m.name,theme:m.theme,role:m.role,cores:m.cores,motif:m.motif,quality:LABEL[s-1]!,numbers:n,regular,ascended,elements:s===4?2:0,authorities:s===5?1:0,laws:s===6?1:s===7?(m.role==='Boss'?3:2):0,divinePosition:s===7,divineKingdom:s===7&&m.role==='Boss',resistance:mitigation.elementMultipliers,mechanics:unique,phase,malice:{slots:plan.slots,arenas:plan.arenas,rotation:plan.rotation,idle:plan.idle,seals:plan.seals,counters:plan.counters},counterplay:[...m.cores.map(k=>COUNTERPLAY[k]),...resistanceHints(mitigation.elementMultipliers),...unique,...(s===7&&m.role==='Boss'?['优先击碎所属神国界碑，或离开距离3的领域；4公共轮后失效']:[])],card,mitigation};
}
/** 玩家可读的抗性提示，只写有变化的属性。 */
export function resistanceHints(table:Record<string,number>):string[]{const parts=Object.entries(table).filter(([,v])=>v!==1).map(([k,v])=>k+(v<=0?'无效':v<1?'抵抗':v>=2?'特攻':'弱点'));return parts.length?['属性：'+parts.join('、')]:[];}
export type MonsterKit=ReturnType<typeof monsterKit>;
