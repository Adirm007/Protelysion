/** 蓝图 → 合同 IR 的确定性降级。模型与本地解析器只描述语义，合法性由这里保证。 */
import {EMPTY_LIBRARY,ROUND_MS,MAX_ATTACK_BEATS,validateAction,type ActionSpec,type EffectSpec,type AmountSpec,type StatusSpec,type ModifierSpec,type ConditionSpec,type TriggerSpec,type LibrarySpec,type DurationSpec,type ReactionSpec} from '../contract';
import type {FormulaSpec} from '../formula';
import {buildStatus,findStd,type StatusOverride,type StdControl} from './statuses';
import {num,pct,chance,normMods,type Blueprint,type BPStep,type BPTarget,type BPCond,type BPMod,type BPTrigger,type BPSummon,type BPCustomStatus} from './types';

type TargetSpec=NonNullable<ActionSpec['targeting']>;
type Channel='physical'|'energy'|'mental'|'true';
type Attr='力量'|'敏捷'|'体质'|'智力'|'精神';
export type LowerContext={key:string;sourceId:string;name:string;level:number;tier:number;power:number;cost:number;attributeFactor:number;attributes:Record<Attr,number>;passive:boolean;beatCap?:number};
export type Lowered={action:ActionSpec;disposition:'active'|'passive';notes:string[];lines:string[]};

const ATTRS:Attr[]=['力量','敏捷','体质','智力','精神'];
const zero=():AmountSpec=>({flat:0,attribute:'none',factor:0,scale:'flat',maxResource:'none',maxFraction:0});
const bare=(effects:EffectSpec[],target:ActionSpec['target']='self'):ActionSpec=>({target,cost:{hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}},castMs:0,recoveryFactor:1,perBattleUses:0,effects});
const rounds=(n:number|undefined,fallback:number):DurationSpec=>n!==undefined&&n>=99?{clock:'permanent',value:0}:{clock:'round',value:Math.max(1,Math.min(99,Math.round(n??fallback)))};
const PERMANENT:DurationSpec={clock:'permanent',value:0};
const CHANNEL_WORDS:Record<string,Channel>={physical:'physical',物理:'physical',物:'physical',energy:'energy',能量:'energy',魔法:'energy',法术:'energy',魔力:'energy',元素:'energy',mental:'mental',精神:'mental',心灵:'mental',true:'true',真实:'true',真伤:'true',固定:'true'};
/** 召唤物构型：显式 role 优先，其次按名称/招式推定；缺省为近战（brute）。 */
export type SummonBuild='brute'|'hunter'|'caster'|'guard'|'swarm'|'spirit';
export function summonBuild(sm:{role?:unknown;taunt?:unknown;tags?:unknown},name:string):SummonBuild{
 const r=String(sm.role??'').toLowerCase();
 const byRole:Record<string,SummonBuild>={tank:'guard',guard:'guard',坦克:'guard',护卫:'guard',dps:'brute',melee:'brute',brute:'brute',近战:'brute',ranged:'hunter',hunter:'hunter',远程:'hunter',caster:'caster',mage:'caster',法师:'caster',support:'spirit',healer:'spirit',spirit:'spirit',辅助:'spirit',swarm:'swarm',群体:'swarm'};
 if(byRole[r])return byRole[r]!;if(sm.taunt)return 'guard';
 if(/魔像|傀儡|守卫|盾|石像|骑士|巨人|堡垒|铁卫/.test(name))return 'guard';
 if(/群|蝙蝠|虫|鼠|鸦|蜂|军团|士兵们/.test(name))return 'swarm';
 if(/弓|猎|射手|狙/.test(name))return 'hunter';
 if(/法师|术士|巫|元素/.test(name))return 'caster';
 if(/精灵|使魔|灵|天使|妖精|人偶|玩偶/.test(name))return 'spirit';
 return 'brute';
}
const TYPE_WORDS:Record<string,string>={火:'火',炎:'火',fire:'火',水:'水',冰:'水',water:'水',ice:'水',暗:'暗',dark:'暗',毒:'暗',光:'光',雷:'光',电:'光',light:'光',holy:'光',精:'精',精神:'精',物:'物',physical:'物',无:'无'};
const CONTROL_WORDS:Record<string,StdControl>={stun:'stun',眩晕:'stun',freeze:'freeze',冻结:'freeze',silence:'silence',沉默:'silence',bind:'bind',束缚:'bind',root:'bind',定身:'bind',sleep:'sleep',睡眠:'sleep',fear:'fear',恐惧:'fear',confusion:'confusion',混乱:'confusion',charm:'charm',魅惑:'charm',taunt:'taunt',嘲讽:'taunt',hidden:'hidden',隐身:'hidden',mark:'mark',标记:'mark',guard:'guard',isolate:'isolate',time_stop:'time_stop',时停:'time_stop',petrify:'petrify',石化:'petrify',knockdown:'knockdown',击倒:'knockdown',disarm:'disarm',缴械:'disarm',polymorph:'polymorph',变形:'polymorph',no_action:'no_action',禁动:'no_action'};

/** 统计名 → 合同修正。hit/evade/crit 的 add 视为 d20 点（×5%），pct 视为百分点。 */
function modifiers(list:BPMod[],notes:string[]):ModifierSpec[]{
 const out:ModifierSpec[]=[];
 const mulOf=(m:BPMod,inverse=false)=>{if(m.mul!==undefined)return m.mul;const p=m.pct??m.add??0;return inverse?Math.max(0,1-p/100):Math.max(0,1+p/100);};
 for(const m of list){
  const k=m.stat.replace(/\s/g,'').toLowerCase();
  const push=(stat:ModifierSpec['stat'],x:{flat?:number;multiplier?:number;element?:string})=>out.push({stat,...x});
  const attr=ATTRS.find(a=>k===a||k===a+'值');
  if(attr||/^(全属性|五维|所有属性|all_?attributes)$/.test(k)){for(const a of attr?[attr]:ATTRS){if(m.add!==undefined)push(a,{flat:m.add});if(m.pct!==undefined)push(a,{multiplier:1+m.pct/100});if(m.mul!==undefined)push(a,{multiplier:m.mul});}continue;}
  if(/^(命中|hit|accuracy|命中率)$/.test(k)){push('hit',{flat:m.pct!==undefined?m.pct/100:(m.add??0)*.05});continue;}
  if(/^(闪避|evade|dodge|闪避率|回避)$/.test(k)){push('evade',{flat:m.pct!==undefined?m.pct/100:(m.add??0)*.05});continue;}
  if(/^(暴击|crit|暴击率)$/.test(k)){push('crit',{flat:m.pct!==undefined?m.pct/100:(m.add??0)*.05});continue;}
  if(/^(暴击伤害|crit_?multiplier|暴伤)$/.test(k)){push('crit_multiplier',{flat:m.pct!==undefined?m.pct/100:m.mul!==undefined?m.mul-1:(m.add??0)});continue;}
  if(/^(速度|speed|行动速度|haste)$/.test(k)){push('speed',{multiplier:mulOf(m)});continue;}
  if(/^(先攻|initiative)$/.test(k)){push('initiative',{flat:m.add??m.pct??0});continue;}
  const flatOnly=m.add!==undefined&&m.pct===undefined&&m.mul===undefined;
  if(/^(伤害|造成伤害|damage|攻击力|攻击|输出|all_?damage)$/.test(k)){for(const s of (flatOnly?['damage_physical','damage_energy'] as const:['damage_physical','damage_energy','damage_mental','damage_true'] as const))push(s,flatOnly?{flat:m.add}:{multiplier:mulOf(m)});continue;}
  const dmgCh=k.match(/^(物理|能量|魔法|精神|真实|physical|energy|mental|true)(伤害|_?damage)$/);if(dmgCh){push(('damage_'+CHANNEL_WORDS[dmgCh[1]!]) as ModifierSpec['stat'],flatOnly?{flat:m.add}:{multiplier:mulOf(m)});continue;}
  if(/^(受到伤害|承受伤害|damage_?taken|易伤|vulnerability)$/.test(k)){push('vulnerability',{multiplier:mulOf(m)});continue;}
  // “受到物理伤害-50%”等分通道写法：直接作为该通道承伤倍率。
  const takenCh=k.match(/^(?:受到|承受)(?:的)?(物理|能量|魔法|精神|真实)伤害$/);if(takenCh){push(('reduction_'+CHANNEL_WORDS[takenCh[1]!]) as ModifierSpec['stat'],{multiplier:mulOf(m)});continue;}
  if(/^(减伤|伤害减免|damage_?reduction|reduction|免伤)$/.test(k)){for(const s of ['reduction_physical','reduction_energy','reduction_mental'] as const)push(s,{multiplier:mulOf(m,true)});continue;}
  const redCh=k.match(/^(物理|能量|魔法|精神|真实|physical|energy|mental|true)(减伤|伤害减免|_?reduction|抗性)$/);if(redCh){push(('reduction_'+CHANNEL_WORDS[redCh[1]!]) as ModifierSpec['stat'],{multiplier:mulOf(m,true)});continue;}
  if(/^(护甲|防御|防御力|armor|defense)$/.test(k)){for(const s of ['armor_physical','armor_energy'] as const)m.add!==undefined?push(s,{flat:m.add}):push(s,{multiplier:mulOf(m)});continue;}
  const armCh=k.match(/^(物理|能量|魔法|精神|physical|energy|mental)(护甲|防御|防御力|_?armor|_?defense)$/);if(armCh){const s=('armor_'+CHANNEL_WORDS[armCh[1]!]) as ModifierSpec['stat'];m.add!==undefined?push(s,{flat:m.add}):push(s,{multiplier:mulOf(m)});continue;}
  const res=k.match(/^(最大生命|生命上限|最大hp|max_?hp|hp上限|最大法力|法力上限|max_?mp|最大体力|体力上限|max_?sp)(值)?$/);if(res){const r=/生命|hp/.test(res[1]!)?'max_hp':/法力|mp/.test(res[1]!)?'max_mp':'max_sp';m.add!==undefined?push(r,{flat:m.add}):push(r,{multiplier:mulOf(m)});continue;}
  if(/^(治疗效果|治疗量|heal_?power|治疗强度)$/.test(k)){push('heal_power',{multiplier:mulOf(m)});continue;}
  if(/^(受到治疗|受治疗|heal_?received)$/.test(k)){push('heal_received',{multiplier:mulOf(m)});continue;}
  if(/^(消耗|cost|技能消耗)$/.test(k)){for(const s of ['cost_mp','cost_sp'] as const)push(s,{multiplier:mulOf(m)});continue;}
  const cost=k.match(/^(mp|sp|hp|法力|体力|生命)消耗$|^cost_(mp|sp|hp)$/);if(cost){const r=cost[1]??cost[2]!;push(('cost_'+(r==='法力'?'mp':r==='体力'?'sp':r==='生命'?'hp':r)) as ModifierSpec['stat'],{multiplier:mulOf(m)});continue;}
  if(/^(检定|所有检定|check|checks)$/.test(k)){for(const s of ['check_strength','check_agility','check_constitution','check_intelligence','check_spirit'] as const)push(s,{flat:m.add??(m.pct??0)/5});continue;}
  const chk=k.match(/^(力量|敏捷|体质|智力|精神)检定$/);if(chk){push(({力量:'check_strength',敏捷:'check_agility',体质:'check_constitution',智力:'check_intelligence',精神:'check_spirit'} as const)[chk[1] as Attr],{flat:m.add??(m.pct??0)/5});continue;}
  if(/^(穿透|penetration|破甲率)$/.test(k)){push('penetration',{flat:(m.pct??m.add??0)/100});continue;}
  if(/^(施法速度|吟唱速度|cast_?speed)$/.test(k)){push('cast_speed',{multiplier:mulOf(m)});continue;}
  if(/^(暴击抗性|受到暴击伤害|crit_?taken)$/.test(k)){push('crit_taken',{multiplier:mulOf(m)});continue;}
  const el=k.match(/^(火|水|冰|暗|光|雷|精|物)(属性)?(抗性|耐性|抗)$/);if(el){push('element',{element:TYPE_WORDS[el[1]!]??el[1]!,multiplier:mulOf(m,true)});continue;}
  notes.push('未识别的属性修正「'+m.stat+'」已忽略');
 }
 return out;
}

class Builder{
 lib:LibrarySpec=EMPTY_LIBRARY();notes:string[]=[];lines:string[]=[];n=0;
 constructor(public ctx:LowerContext){}
 id(label:string){return this.ctx.key+':'+label+(++this.n);}
 note(s:string){if(!this.notes.includes(s))this.notes.push(s);}
 /** 引用或创建状态，返回 library id。 */
 status(ref:unknown,o:StatusOverride={}):{id:string;name:string;desc:string}{
  let custom:BPCustomStatus|undefined;let name='';
  if(ref&&typeof ref==='object'){custom=ref as BPCustomStatus;name=String(custom.name??'');}else name=String(ref??'');
  name=name.replace(/^std[:：]/i,'').trim().slice(0,100)||'状态';
  const std=findStd(name);
  const over:StatusOverride={...o};
  if(custom){
   if(custom.polarity)over.polarity=custom.polarity;
   const ctl=custom.control?CONTROL_WORDS[String(custom.control).toLowerCase()]??CONTROL_WORDS[String(custom.control)]:undefined;if(ctl)over.control=ctl;
   const mods=modifiers(normMods(custom.mods),this.notes);if(mods.length)over.mods=[...(over.mods??[]),...mods];
   const dot=pct(custom.dotPct);if(dot)over.dot=dot/100;const hot=pct(custom.hotPct);if(hot)over.hot=hot/100;const hotFlat=num(custom.hotAmount);if(hotFlat)over.hotFlat=hotFlat;
   if(custom.stackable!==undefined)over.stackable=!!custom.stackable;const ms=num(custom.maxStacks);if(ms)over.maxStacks=ms;
   if(custom.dispellable===false)over.dispellable=false;
   const rp=pct(custom.reflectPct);if(rp)over.reactions=[...(over.reactions??[]),{kind:'reflect',fraction:Math.min(10,rp/100)}];
   const rd=pct(custom.reducePct);if(rd)over.mods=[...(over.mods??[]),...(['reduction_physical','reduction_energy','reduction_mental'] as const).map(stat=>({stat,multiplier:Math.max(0,1-rd/100)}))];
   if(custom.consumeOn==='attack'||custom.consumeOn==='damaged')over.consumeOn=custom.consumeOn;
  }
  if(std&&name!==std.name)over.name=name;
  const plain=!custom&&!Object.keys(o).some(k=>!['turns','permanent'].includes(k));
  const id=plain&&std?'std:'+std.name+(o.permanent?':p':o.turns!==undefined?':'+o.turns:''):this.id('st');
  if(!this.lib.statuses[id]){
   if(!std&&!over.polarity)over.polarity=over.mods?.every(m=>(m.multiplier??1)>=1&&(m.flat??0)>=0)?'positive':'negative';
   const built=buildStatus(id,std,{...over,name:over.name??(std?std.name:name)});
   this.lib.statuses[id]=built.status;Object.assign(this.lib.actions,built.actions);
   if(custom?.triggers?.length){const tr=this.triggers(custom.triggers);if(tr.length)built.status.triggers=[...(built.status.triggers??[]),...tr];}
   if(!std&&!built.status.modifiers&&!built.status.control&&!built.status.tick&&!built.status.reactions&&!built.status.triggers)this.note('自定义状态「'+name+'」没有可执行数值，作为条件标记使用');
  }
  const st=this.lib.statuses[id]!;
  return {id,name:st.name,desc:std?.desc??(custom?.desc?String(custom.desc):'')};
 }
 /** 蓝图目标 → 合同 targeting；inherit=true 时返回 undefined 表示沿用当前目标。 */
 target(t:BPTarget|undefined,mode:'active'|'passive'|'trigger',fallback:BPTarget):TargetSpec|undefined{
  const q=t??fallback;
  const tiers=q.belowCasterTier?{maxTier:Math.max(1,this.ctx.tier-1)}:{};
  const extra={...(q.maxTier?{maxTier:q.maxTier}:{}),...(q.minTier?{minTier:q.minTier}:{}),...tiers,...(q.excludeSelf?{excludeSelf:true}:{})};
  if(q.side==='self')return {side:'self',selection:'manual'};
  if(q.side==='attacker')return {side:'event_source',selection:'manual'};
  if(q.side==='hit_target')return {side:'event_target',selection:'manual'};
  if(q.side==='downed_ally')return {side:'ally',selection:mode==='active'?'manual':'random',count:1,life:'downed'};
  const side=q.side==='any'?'any':q.side;
  const sel=q.select??'single';
  if(sel==='all')return {side,selection:'all',life:'alive',...extra};
  if(sel==='random'||sel==='bounce')return {side,selection:sel,count:q.count??1,life:'alive',...extra};
  if(sel==='lowest_hp')return {side,selection:'lowest_resource',resource:'hp',count:q.count??1,life:'alive',...extra};
  if(sel==='highest_attack')return {side,selection:'highest_attack',count:q.count??1,life:'alive',...extra};
  if(mode!=='active')return {side,selection:'random',count:q.count??1,life:'alive',...extra};
  return {side,selection:'manual',count:q.count??1,life:'alive',...extra};
 }
 cond(c:BPCond):ConditionSpec[]{
  const v=c.value??0,st=c.status?this.statusKey(c.status):'';
  switch(c.kind){
   case 'hp_below':return [{kind:'resource_ratio',key:'hp',compare:'lt',value:v/100}];
   case 'hp_above':return [{kind:'resource_ratio',key:'hp',compare:'gte',value:v/100}];
   case 'mp_below':return [{kind:'resource_ratio',key:'mp',compare:'lt',value:v/100}];
   case 'target_hp_below':return [{subject:'target',kind:'resource_ratio',key:'hp',compare:'lt',value:v/100}];
   case 'target_hp_above':return [{subject:'target',kind:'resource_ratio',key:'hp',compare:'gte',value:v/100}];
   case 'has_status':return st?[{kind:'status',key:st,compare:'gte',value:1}]:[];
   case 'target_has_status':return st?[{subject:'target',kind:'status',key:st,compare:'gte',value:1}]:[];
   case 'lacks_status':return st?[{kind:'status',key:st,compare:'lt',value:1}]:[];
   case 'target_lacks_status':return st?[{subject:'target',kind:'status',key:st,compare:'lt',value:1}]:[];
   case 'status_stacks_at_least':return st?[{kind:'status',key:st,compare:'gte',value:v||1}]:[];
   case 'target_status_stacks_at_least':return st?[{subject:'target',kind:'status',key:st,compare:'gte',value:v||1}]:[];
   case 'target_debuffs_at_least':return [{kind:'expression',expression:[{read:'status_kinds',subject:'target',key:'negative'}],compare:'gte',value:v||1}];
   case 'allies_alive_at_least':return [{kind:'alive_count',key:'ally',compare:'gte',value:v||1}];
   case 'allies_alive_at_most':return [{kind:'alive_count',key:'ally',compare:'lte',value:v||1}];
   case 'enemies_alive_at_least':return [{kind:'alive_count',key:'enemy',compare:'gte',value:v||1}];
   case 'first_use':return [{kind:'uses',key:this.ctx.sourceId,compare:'eq',value:0}];
   case 'round_at_least':return [{kind:'expression',expression:[{read:'round'}],compare:'gte',value:v}];
   case 'kills_at_least':return [{kind:'kill_count',compare:'gte',value:v||1}];
   case 'crit':return [{kind:'critical',compare:'gte',value:1}];
   case 'target_tier_below':return [{kind:'expression',expression:[{read:'tier',subject:'target'}],compare:'lt',compareExpression:[{read:'tier',subject:'caster'}]}];
   case 'in_field':return c.status?[{kind:'field',key:c.status,compare:'gte',value:1}]:[];
   case 'target_is_enemy':return [{subject:'target',kind:'side',key:'opposite',compare:'eq',value:1}];
   case 'target_is_ally':return [{subject:'target',kind:'side',key:'same',compare:'eq',value:1}];
  }
  return [];
 }
 conds(list:BPCond[]|undefined){return (list??[]).flatMap(c=>this.cond(c));}
 /** 条件中的状态名：标准状态用标准名（状态 tags 含标准名），自定义状态用原名。 */
 statusKey(name:string){const std=findStd(name);return (std?.name??name.replace(/^std[:：]/i,'').trim()).slice(0,200);}
 child(steps:BPStep[],label:string,mode:'active'|'passive'|'trigger',fallback:BPTarget,target:ActionSpec['target']='enemy'):string{
  const id=this.id(label);const effects=this.steps(steps,mode,fallback);
  this.lib.actions[id]={...bare(effects.length?effects:[],target),name:this.ctx.name+'·'+label};return id;
 }
 triggers(list:BPTrigger[]):TriggerSpec[]{
  const out:TriggerSpec[]=[];
  for(const t of list){
   const on=t.on.replace(/[\s-]/g,'_');
   let event:TriggerSpec['event']='battle_start',scope:TriggerSpec['scope']='self',fallback:BPTarget={side:'self'};const conditions:ConditionSpec[]=[];let uses=t.uses;
   if(/^(battle_start|start|开场|战斗开始|进入战斗)$/.test(on))event='battle_start';
   else if(/^(round|round_start|each_round|每回合|回合开始)$/.test(on))event='round';
   else if(/^(turn_start|ready|my_turn|自身回合)$/.test(on))event='ready';
   else if(/^(before_action|before_cast)$/.test(on))event='before_action';
   else if(/^(after_action|action_end)$/.test(on))event='action_end';
   else if(/^(hit|on_hit|attack_hit|命中)$/.test(on)){event='hit';fallback={side:'hit_target'};}
   else if(/^(crit|critical|暴击)$/.test(on)){event='hit';fallback={side:'hit_target'};conditions.push({kind:'critical',compare:'gte',value:1});}
   else if(/^(damage_dealt|dealt_damage)$/.test(on)){event='damage_dealt';fallback={side:'hit_target'};}
   else if(/^(damaged|attacked|hit_taken|damage_received|受击|受到伤害|被攻击)$/.test(on)){event='damage_received';fallback={side:'attacker'};}
   else if(/^(before_damaged|before_damage|incoming)$/.test(on)){event='before_damage';fallback={side:'attacker'};}
   else if(/^(hp_below|low_hp|血量低于|生命低于)$/.test(on)){event='damage_received';fallback={side:'attacker'};conditions.push({kind:'resource_ratio',key:'hp',compare:'lt',value:(t.hpPct??50)/100});uses??=1;}
   else if(/^(before_down|lethal|death|fatal|致死|濒死)$/.test(on)){event='before_down';}
   else if(/^(kill|on_kill|击杀)$/.test(on)){event='kill';fallback={side:'self'};}
   else if(/^(ally_down|ally_death|队友倒下)$/.test(on)){event='after_down';scope='ally';}
   else if(/^(enemy_down|enemy_death)$/.test(on)){event='after_down';scope='enemy';}
   else if(/^(dodge|evade|evaded|闪避)$/.test(on)){event='miss';scope='enemy';fallback={side:'attacker'};this.note('“闪避后”触发按“敌方攻击未命中时”执行');}
   else if(/^(miss|missed)$/.test(on)){event='miss';fallback={side:'hit_target'};}
   else if(/^(status_applied|debuffed|after_status)$/.test(on)){event='after_status';}
   else if(/^(enemy_status|enemy_debuffed)$/.test(on)){event='after_status';scope='enemy';}
   else if(/^(healed|after_heal|heal)$/.test(on))event='after_heal';
   else if(/^(battle_end|end)$/.test(on))event='battle_end';
   else if(/^(shield_break|shield_broken)$/.test(on))event='shield_break';
   else if(/^(ally_damaged|ally_hit)$/.test(on)){event='damage_received';scope='ally';fallback={side:'attacker'};}
   else if(/^(enemy_action|enemy_before_action|enemy_cast)$/.test(on)){event='before_action';scope='enemy';fallback={side:'attacker'};}
   else if(/^(enemy_cost|enemy_after_cost|enemy_spell)$/.test(on)){event='after_cost';scope='enemy';fallback={side:'attacker'};}
   else if(/^(enemy_hit|enemy_attack)$/.test(on)){event='hit';scope='enemy';fallback={side:'attacker'};}
   else{this.note('未知触发时点「'+t.on+'」按每回合开始处理');event='round';}
   const id=this.child(t.steps,'触发',  'trigger',t.target??fallback,'self');
   conditions.push(...this.conds(t.when));
   const tr:TriggerSpec={id:'t'+(out.length+1)+'_'+this.n,event,scope,action:id,payCost:false,...(t.chance!==undefined?{chance:t.chance}:{}),...(uses?{uses}:{}),...(conditions.length?{conditions}:{})};
   if(t.perRound)tr.cooldownMs=ROUND_MS-1;
   out.push(tr);
  }
  return out;
 }
 powerOf(s:BPStep,fallbackUsed:{v:boolean}):number{
  let p=num(s.power??s.威力);
  if(p===undefined){fallbackUsed.v=true;p=this.ctx.power;}
  const mult=num(s.multiplier)??(pct(s.multiplierPct)!==undefined?pct(s.multiplierPct)!/100:undefined);
  return Math.max(0,p*(mult??1));
 }
 damage(s:BPStep,mode:'active'|'passive'|'trigger'):EffectSpec[]{
  const out:EffectSpec[]=[];
  const pctFields=['pctMaxHp','pctCurrentHp','pctLostHp','selfPctMaxHp','selfPctLostHp','selfPctCurrentHp','pctOfDamage'];
  const hasPct=pctFields.some(k=>s[k]!==undefined);
  const usedDefault={v:false};
  const explicitPower=s.power!==undefined||s.威力!==undefined;
  const power=hasPct&&!explicitPower?0:this.powerOf(s,usedDefault);
  if(usedDefault.v)this.note('原文未给出威力，按角色等级取宿主同阶威力'+this.ctx.power);
  // 通道
  let mix:Partial<Record<Channel,number>>={};
  const ch=s.channel??s.damageType;
  if(ch&&typeof ch==='object'&&!Array.isArray(ch)){for(const [k,v] of Object.entries(ch as Record<string,unknown>)){const c=CHANNEL_WORDS[k.toLowerCase()]??CHANNEL_WORDS[k];const w=num(v);if(c&&w&&w>0)mix[c]=(mix[c]??0)+w;}}
  else if(typeof ch==='string'){const parts=ch.split(/[+＋、,，/和与]/).map(x=>CHANNEL_WORDS[x.trim().toLowerCase()]??CHANNEL_WORDS[x.trim()]).filter(Boolean) as Channel[];for(const c of parts)mix[c]=(mix[c]??0)+1;}
  if(!Object.keys(mix).length)mix={physical:1};
  const total=Object.values(mix).reduce((a,b)=>a+b,0);
  const attrRaw=String(s.attr??s.attribute??'');const noScale=s.noScale===true||attrRaw==='none';
  const amounts={physical:zero(),energy:zero(),mental:zero(),true:zero()};
  const primary=(Object.entries(mix).sort((a,b)=>b[1]-a[1])[0]![0]) as Channel;
  for(const [c,w] of Object.entries(mix) as [Channel,number][]){
   const share=w/total,attr:Attr|undefined=ATTRS.find(a=>a===attrRaw)??(c==='physical'?'力量':c==='energy'?'智力':c==='mental'?'精神':undefined);
   const a:AmountSpec={...zero(),flat:Math.round(power*share)};
   if(power>0&&attr&&!noScale){a.attribute=attr;a.factor=this.ctx.attributeFactor*share;a.scale='host_tier';}
   amounts[c]=a;
  }
  const a=amounts[primary];const expr:FormulaSpec=[];
  const tp=(k:string)=>{const v=pct(s[k]);return v!==undefined?v/100:undefined;};
  const tMax=tp('pctMaxHp'),tCur=tp('pctCurrentHp'),tLost=tp('pctLostHp');
  if(tMax!==undefined||tCur!==undefined||tLost!==undefined){a.resourceSubject='target';if(tMax!==undefined){a.maxResource='hp';a.maxFraction=tMax;}if(tCur!==undefined){a.currentResource='hp';a.currentFraction=tCur;}if(tLost!==undefined){a.lostResource='hp';a.lostFraction=tLost;}}
  const sMax=tp('selfPctMaxHp'),sLost=tp('selfPctLostHp'),sCur=tp('selfPctCurrentHp');
  const addExpr=(e:FormulaSpec)=>{if(expr.length)expr.push(...e,{operator:'add'});else expr.push(...e);};
  if(sMax!==undefined)addExpr([{read:'max_resource',subject:'caster',key:'hp'},{constant:sMax},{operator:'mul'}]);
  if(sLost!==undefined)addExpr([{read:'lost_resource',subject:'caster',key:'hp'},{constant:sLost},{operator:'mul'}]);
  if(sCur!==undefined)addExpr([{read:'resource',subject:'caster',key:'hp'},{constant:sCur},{operator:'mul'}]);
  // 按状态层数/条件加成
  const bonus=s.bonusVsStatus as Record<string,unknown>|undefined;
  if(bonus&&typeof bonus==='object'&&bonus.status){const key=this.statusKey(String(bonus.status)),per=pct(bonus.perStackPct),flatP=pct(bonus.pct);const base=power||this.ctx.power;
   if(per)addExpr([{read:'status_stacks',subject:'target',key},{constant:base*per/100},{operator:'mul'}]);
   else if(flatP)addExpr([{read:'status_stacks',subject:'target',key},{constant:1},{operator:'min'},{constant:base*flatP/100},{operator:'mul'}]);}
  const sb=s.scaleBy as Record<string,unknown>|undefined;
  if(sb&&typeof sb==='object'){const per=pct(sb.perPct)??0,base=power||this.ctx.power,what=String(sb.what??'');let read:FormulaSpec|undefined;
   if(what==='self_lost_hp')read=[{constant:1},{read:'resource_ratio',subject:'caster',key:'hp'},{operator:'sub'},{constant:100},{operator:'mul'}];
   else if(what==='target_lost_hp')read=[{constant:1},{read:'resource_ratio',subject:'target',key:'hp'},{operator:'sub'},{constant:100},{operator:'mul'}];
   else if(what==='target_debuffs')read=[{read:'status_kinds',subject:'target',key:'negative'}];
   else if(what==='self_buffs')read=[{read:'status_kinds',subject:'caster',key:'positive'}];
   else if(what==='self_status'&&sb.status)read=[{read:'status_stacks',subject:'caster',key:this.statusKey(String(sb.status))}];
   else if(what==='target_status'&&sb.status)read=[{read:'status_stacks',subject:'target',key:this.statusKey(String(sb.status))}];
   else if(what==='allies_alive')read=[{read:'alive_count',subject:'caster',key:'ally'}];
   else if(what==='enemies_alive')read=[{read:'alive_count',subject:'caster',key:'enemy'}];
   else if(what==='counter'&&sb.key)read=[{read:'counter',subject:'caster',key:String(sb.key).slice(0,200)}];
   if(read&&per)addExpr([...read,{constant:base*per/100},{operator:'mul'}]);else this.note('伤害缩放「'+what+'」无法读取，已忽略');}
  if(expr.length)a.expression=expr;
  const eff:Extract<EffectSpec,{op:'damage'}>={op:'damage',amounts,element:'none',hitChance:.95,hitRule:s.sure?'guaranteed':'normal',critChance:.05,critMultiplier:1.5};
  const types=(Array.isArray(s.types)?s.types:typeof s.types==='string'?[s.types]:typeof s.element==='string'?[s.element]:[]).map(x=>TYPE_WORDS[String(x).toLowerCase()]??TYPE_WORDS[String(x)]).filter(Boolean) as NonNullable<typeof eff.types>;
  if(types.length)eff.types=[...new Set(types)].slice(0,7) as typeof eff.types;
  const crit=s.crit as Record<string,unknown>|undefined;if(crit&&typeof crit==='object'){const c=chance(crit.chance);if(c!==undefined)eff.critChance=c;const cm=num(crit.mult??crit.multiplier);if(cm&&cm>=1)eff.critMultiplier=Math.min(100,cm);}
  const pierce=pct(s.pierce??s.penetration);if(pierce)eff.penetration=Math.min(1,pierce/100);
  const ign=(Array.isArray(s.ignore)?s.ignore:typeof s.ignore==='string'?[s.ignore]:[]).map(String).flatMap(x=>/shield|护盾/.test(x)?['shield' as const]:/reduction|减伤|防御|armor/.test(x)?['reduction' as const]:/death|免死|不死/.test(x)?['death_guard' as const]:/immun|免疫|无效|必定造成/.test(x)?['immunity' as const]:[]);
  if(ign.length)eff.bypass=[...new Set(ign)];
  if(ign.includes('reduction')&&!eff.penetration)eff.penetration=1;
  const ls=pct(s.lifesteal);if(ls)eff.drain={resource:'hp',fraction:Math.min(100,ls/100),basis:'actual'};
  const mpd=pct(s.manaDrainPct);if(mpd&&!eff.drain)eff.drain={resource:'mp',fraction:Math.min(100,mpd/100),basis:'actual'};
  if(s.execute===true)eff.execute=true;
  if(s.nonLethal===true)eff.lethal=false;
  // 段数
  let hits=Math.max(1,Math.round(num(s.hits)??1));const split=s.split===true;
  const rh=s.randomHits as Record<string,unknown>|undefined;
  if(rh&&typeof rh==='object'){let lo=Math.max(1,Math.round(num(rh.min)??1)),hi=Math.max(lo,Math.round(num(rh.max)??lo));
   const cap=this.ctx.beatCap??MAX_ATTACK_BEATS;if(hi>cap){const scale=hi/cap;this.note(`随机${lo}~${hi}段压缩为${Math.max(1,Math.ceil(lo/scale))}~${cap}段，每段威力×${scale.toFixed(2)}`);for(const c of Object.values(amounts)){c.flat*=scale;c.factor*=scale;}lo=Math.max(1,Math.ceil(lo/scale));hi=cap;}
   const v=this.id('hits');out.push({op:'variable',key:v,mode:'random_int',value:[{constant:lo}],maximum:[{constant:hi}],targeting:{side:'self',selection:'manual'}});
   eff.hitCountExpression=[{read:'variable',key:v}];eff.maxHits=hi;hits=1;
  }
  {const cap=this.ctx.beatCap??MAX_ATTACK_BEATS;if(hits>cap){if(!split){const scale=hits/cap;for(const c of Object.values(amounts)){c.flat*=scale;c.factor*=scale;}}this.note(`${hits}段压缩为${cap}段${split?'（总威力不变）':'，每段威力等比提高'}`);hits=cap;}}
  if(hits>1){eff.hits=hits;if(split)eff.powerMode='split_total';}
  for(const c of Object.values(amounts)){c.flat=Math.round(c.flat);}
  const onHit=s.onHit as BPStep[]|undefined;
  if(onHit?.length){eff.onHitAction=this.child(onHit,'附效',mode==='active'?'trigger':mode,{side:'hit_target'});
   // 附效动作以当前命中目标为默认对象：去掉 child 中默认的 hit_target 显式 targeting 以免依赖事件目标
   for(const e of this.lib.actions[eff.onHitAction]!.effects)if(e.targeting?.side==='event_target')delete e.targeting;}
  out.push(eff);
  const ex=s.executeBelowPct!==undefined?pct(s.executeBelowPct):undefined;
  if(ex){out.push({op:'damage',amounts:{physical:zero(),energy:zero(),mental:zero(),true:{...zero(),resourceSubject:'target',currentResource:'hp',currentFraction:1}},element:'none',types:['无'],hitChance:1,hitRule:'guaranteed',critChance:0,critMultiplier:1,execute:true,conditions:[{subject:'target',kind:'resource_ratio',key:'hp',compare:'lt',value:ex/100}]});}
  const toShield=pct(s.toShield);if(toShield)out.push({op:'shield',amount:{...zero(),eventFraction:toShield/100},channels:['physical','energy','mental','true'],duration:rounds(num(s.shieldTurns),3),targeting:{side:'self',selection:'manual'}});
  const selfCost=pct(s.selfDamagePct);if(selfCost)out.push(this.selfDamage(selfCost));
  return out;
 }
 selfDamage(p:number):EffectSpec{return {op:'damage',amounts:{physical:zero(),energy:zero(),mental:zero(),true:{...zero(),subject:'target',maxResource:'hp',maxFraction:p/100}},element:'none',types:['无'],hitChance:1,hitRule:'guaranteed',critChance:0,critMultiplier:1,lethal:false,targeting:{side:'self',selection:'manual'}};}
 recovery(s:BPStep,resource:'hp'|'mp'|'sp'):AmountSpec{
  const a=zero();const flat=num(s.amount??s.value);if(flat)a.flat=flat;
  const p=pct(s.pct??s.pctMax);if(p){a.subject='target';a.maxResource=resource;a.maxFraction=p/100;}
  const pl=pct(s.pctLost);if(pl){a.subject='target';a.lostResource=resource;a.lostFraction=pl/100;}
  const pd=pct(s.pctOfDamage);if(pd)a.eventFraction=pd/100;
  if(s.scale===true&&!a.subject){a.attribute='精神';a.factor=this.ctx.attributeFactor;a.scale='host_tier';}
  if(!flat&&!p&&!pl&&!pd){a.flat=this.ctx.power;a.attribute='精神';a.factor=this.ctx.attributeFactor;a.scale='host_tier';this.note('原文未给出恢复量，按宿主同阶威力'+this.ctx.power+'计算');}
  return a;
 }
 /** 单个蓝图步骤 → 若干合同效果。mode 决定默认目标方式。 */
 step(s:BPStep,mode:'active'|'passive'|'trigger',fallback:BPTarget,dual=false):EffectSpec[]{
  const d=s.do.replace(/[\s-]/g,'_');
  const offensive=/^(damage|attack|hit|status|debuff|dispel|purge|steal|seal|drain|copy|steal_passive|execute|time_stop|swap)$/.test(d);
  // 0.38.1：状态/属性/驱散按对目标的利害判定（正面状态、净化、承伤降低都是增益），不再一律当成攻击。
  const statusRef=s.status??s.id??s.name;
  const nature=stepNature(s);
  const isOff=NATURE_JUDGED.test(d)?nature==='harm':offensive;
  const defaultT:BPTarget=isOff?(fallback.side==='self'||fallback.side==='ally'||fallback.side==='downed_ally'?{side:'enemy',select:mode==='passive'?'all':'single'}:fallback):(fallback.side==='ally'||fallback.side==='self'||fallback.side==='downed_ally'?fallback:{side:'self'});
  const explicit=s.target!==undefined;
  let targeting=this.target(s.target,mode,defaultT);
  // 主动技能中与主目标一致的步骤沿用主目标
  if(mode==='active'&&!explicit&&((isOff&&(fallback.side==='enemy'||fallback.side==='any'))||(!isOff&&(fallback.side==='ally'||fallback.side==='self'||fallback.side==='downed_ally'||(fallback.side==='any'&&nature==='help')))))targeting=undefined;
  if(mode==='active'&&explicit&&s.target!.side===fallback.side&&(s.target!.select??'single')===(fallback.select??'single'))targeting=undefined;
  // 0.38.1 敌我两用（主目标“任意一方”）：有害步骤只作用于所选敌人、有益步骤只作用于所选同伴；
  // 写明 target_is_enemy/target_is_ally 的按写明的。手选池天然按阵营过滤，嘲讽/守护照常改写对敌部分。
  // 0.38.1 主目标是所选敌人时，“一名同伴”已无法再手选：改为自动选生命比例最低的同伴（含自身），不再成为永远选不到人的死效果。
  if(mode==='active'&&!dual&&explicit&&fallback.side==='enemy'&&targeting&&targeting.side==='ally'&&targeting.selection==='manual'&&targeting.life!=='downed')targeting={...targeting,selection:'lowest_resource',resource:'hp'};
  if(dual&&mode==='active'){const loose=!explicit||s.target!.side==='any';const want=sideWhen(s.when)??(loose?(isOff?'enemy':nature==='help'?'ally':undefined):undefined);if(want)targeting={side:want,selection:'manual',count:fallback.count??1,life:'alive'};}
  const wrap=(effects:EffectSpec[]):EffectSpec[]=>effects.map(e=>{const x={...e} as EffectSpec;if(targeting&&!x.targeting)x.targeting=targeting;if(s.chance!==undefined&&x.op!=='variable')x.probability=s.chance;const cs=this.conds(s.when);if(cs.length)x.conditions=[...(x.conditions??[]),...cs];return x;});
  const turns=num(s.turns??s.duration);const permanent=s.permanent===true||(mode==='passive'&&turns===undefined);
  switch(d){
   case 'damage':case 'attack':case 'hit':return wrap(this.damage(s,mode));
   case 'self_damage':case 'sacrifice':return [this.selfDamage(pct(s.pct??s.pctMaxHp)??10)];
   case 'heal':case 'restore':case 'recover':{
    const r=String(s.resource??'hp').toLowerCase();
    // 0.38.1 “回复目标需要的资源”：执行时取生命/法力/体力中占比最低的一项。
    if(AUTO_RESOURCE.test(r))return wrap([{op:'heal',resource:'hp',adaptive:true,amount:this.recovery(s,'hp'),...(s.overflowShield?{overflowShield:true}:{})} as EffectSpec]);
    const list=(r==='all'?['hp','mp','sp']:r.includes('+')?r.split('+'):[r]).map(x=>x==='生命'?'hp':x==='法力'?'mp':x==='体力'?'sp':x).filter(x=>['hp','mp','sp'].includes(x)) as ('hp'|'mp'|'sp')[];
    return wrap((list.length?list:['hp' as const]).map(res=>({op:'heal',resource:res,amount:this.recovery(s,res),...(s.overflowShield?{overflowShield:true}:{})} as EffectSpec)));}
   case 'shield':case 'barrier':{
    const a=zero();const flat=num(s.amount);if(flat)a.flat=flat;const p=pct(s.pct);if(p){a.subject='target';a.maxResource='hp';a.maxFraction=p/100;}const pd=pct(s.pctOfDamage);if(pd)a.eventFraction=pd/100;
    if(!flat&&!p&&!pd){a.flat=this.ctx.power;a.attribute='体质';a.factor=this.ctx.attributeFactor;a.scale='host_tier';this.note('原文未给出护盾量，按宿主同阶威力'+this.ctx.power+'计算');}
    const charges=num(s.charges);
    return wrap([{op:'shield',amount:a,channels:['physical','energy','mental','true'],duration:permanent&&!turns?{clock:'permanent',value:0}:rounds(turns,3),...(charges?{charges:Math.round(charges)}:{})}]);}
   case 'status':case 'debuff_status':case 'apply':{
    const o:StatusOverride={};if(turns!==undefined)o.turns=turns;if(s.permanent===true)o.permanent=true;
    const dot=pct(s.dotPct);if(dot)o.dot=dot/100;const hotP=pct(s.hotPct);if(hotP)o.hot=hotP/100;const hotFlat=num(s.hotAmount);if(hotFlat)o.hotFlat=hotFlat;const ms=num(s.maxStacks);if(ms)o.maxStacks=ms;if(s.dispellable===false)o.dispellable=false;if(s.stackable!==undefined)o.stackable=!!s.stackable;
    const mods=modifiers(normMods(s.mods),this.notes);if(mods.length)o.mods=mods;
    const st=this.status(statusRef,o);const stacks=num(s.stacks);
    const e:Extract<EffectSpec,{op:'apply_status'}>={op:'apply_status',status:st.id,...(stacks&&stacks>1?{stacks:Math.min(1000,Math.round(stacks))}:{})};
    const save=s.save as Record<string,unknown>|undefined;
    if(save&&typeof save==='object'){const attr=ATTRS.find(a=>a===save.attr)??'精神';const dc=num(save.dc);e.opposedAttribute=attr;e.opposedDifficulty=dc!==undefined?55-5*dc:0;}
    return wrap([e]);}
   case 'cleanse':case 'purify':return wrap([{op:'dispel',mode:'remove',polarity:'negative',...(num(s.count)?{count:Math.round(num(s.count)!)}:{}),...(s.status?{status:this.statusKey(String(s.status))}:{})}]);
   case 'dispel':case 'purge':return wrap([{op:'dispel',mode:'remove',polarity:s.polarity==='negative'?'negative':s.polarity==='any'?'any':'positive',...(num(s.count)?{count:Math.round(num(s.count)!)}:{}),...(s.includeUndispellable?{includeUndispellable:true}:{})}]);
   case 'steal':return wrap([{op:'dispel',mode:'steal',recipient:'caster',polarity:'positive',count:Math.round(num(s.count)??1)}]);
   case 'transfer_debuff':return wrap([{op:'dispel',mode:'transfer',recipient:'selected_other',polarity:'negative',count:Math.round(num(s.count)??1)}]);
   case 'stat':case 'buff':case 'debuff':case 'modify':{
    const mods=modifiers(normMods(s.mods??s.stats),this.notes);if(!mods.length)return [];
    return wrap([{op:'modify',modifiers:mods,duration:permanent?PERMANENT:rounds(turns,3),name:String(s.name??this.ctx.name).slice(0,100)}]);}
   case 'guard':case 'reduce':case 'damage_reduction':{
    const p=pct(s.pct)??30;const chans=(Array.isArray(s.channels)?s.channels:typeof s.channels==='string'?[s.channels]:[]).map(x=>CHANNEL_WORDS[String(x).toLowerCase()]??CHANNEL_WORDS[String(x)]).filter(Boolean) as Channel[];
    const next=num(s.next??s.nextHits);
    if(next){const st=this.status({name:String(s.name??'减伤'),polarity:'positive'} as BPCustomStatus,{turns:turns??3,reactions:[{kind:'block',fraction:Math.min(1,p/100),uses:Math.round(next),...(chans.length?{channels:chans}:{})}]});return wrap([{op:'apply_status',status:st.id}]);}
    const list=(chans.length?chans:['physical','energy','mental'] as Channel[]).map(c=>({stat:('reduction_'+c) as ModifierSpec['stat'],multiplier:Math.max(0,1-p/100)}));
    return wrap([{op:'modify',modifiers:list,duration:permanent?PERMANENT:rounds(turns,2),name:String(s.name??'减伤').slice(0,100)}]);}
   case 'reflect':case 'thorns':{
    const p=pct(s.pct)??30,uses=num(s.uses),c=chance(s.reflectChance);const chans=(Array.isArray(s.channels)?s.channels:[]).map(x=>CHANNEL_WORDS[String(x).toLowerCase()]??CHANNEL_WORDS[String(x)]).filter(Boolean) as Channel[];
    const r:ReactionSpec={kind:'reflect',fraction:Math.min(10,p/100),...(uses?{uses:Math.round(uses)}:{}),...(c!==undefined?{chance:c}:{}),...(chans.length?{channels:chans}:{})};
    const st=this.status({name:String(s.name??'反射'),polarity:'positive'} as BPCustomStatus,{...(permanent?{permanent:true}:{turns:turns??3}),reactions:[r]});return wrap([{op:'apply_status',status:st.id}]);}
   case 'counter':{
    const attack:BPStep={do:'damage',...(s.power!==undefined?{power:s.power}:{}),...(s.pctOfDamage!==undefined?{}:{}),channel:s.channel??'physical',...(s.multiplier!==undefined?{multiplier:s.multiplier}:{})};
    const id=this.id('反击');const eff=this.damage(attack,'trigger');
    const pd=pct(s.pctOfDamage);if(pd){const dm=eff.find(e=>e.op==='damage') as Extract<EffectSpec,{op:'damage'}>;const ch=Object.keys(dm.amounts).find(k=>dm.amounts[k as Channel].flat) as Channel|undefined;const a=dm.amounts[ch??'physical'];a.eventFraction=pd/100;if(s.power===undefined){a.flat=0;a.factor=0;a.attribute='none';this.notes.splice(this.notes.findIndex(n=>n.startsWith('原文未给出威力')),1);}}
    this.lib.actions[id]={...bare(eff,'enemy'),name:this.ctx.name+'·反击'};
    const c=chance(s.counterChance),uses=num(s.uses);
    const st=this.status({name:String(s.name??'反击架势'),polarity:'positive'} as BPCustomStatus,{...(permanent?{permanent:true}:{turns:turns??2}),reactions:[{kind:'counter',action:id,...(c!==undefined?{chance:c}:{}),...(uses?{uses:Math.round(uses)}:{})}]});
    return wrap([{op:'apply_status',status:st.id}]);}
   case 'dodge':case 'evade':{
    const uses=num(s.uses);if(uses)return wrap([{op:'rule',rule:'guaranteed_evade',key:'*',uses:Math.round(uses),duration:permanent?PERMANENT:rounds(turns,3)}]);
    return wrap([{op:'modify',modifiers:[{stat:'evade',flat:(pct(s.pct)??30)/100}],duration:permanent?PERMANENT:rounds(turns,2),name:String(s.name??'闪避').slice(0,100)}]);}
   case 'sure_hit':case 'guaranteed_hit':return wrap([{op:'rule',rule:'guaranteed_hit',key:'*',uses:Math.round(num(s.uses)??1),duration:permanent?PERMANENT:rounds(turns,3)}]);
   case 'death_guard':case 'deathguard':case 'revive_self':case 'self_revive':{
    // uses:0 视为“无次数限制”；执行器对玩家一方的保命效果统一按层级封顶（原文次数超过层级也按层级）。未写次数按1次。
    const rawUses=Math.round(num(s.uses)??1),uses=rawUses>0?rawUses:undefined,keep=num(s.keepHp)??1,heal=pct(s.healPct??s.pct);
    let onTrigger:string|undefined;if(heal){onTrigger=this.id('复苏');this.lib.actions[onTrigger]={...bare([{op:'heal',resource:'hp',amount:{...zero(),subject:'target',maxResource:'hp',maxFraction:heal/100}}],'self'),name:this.ctx.name+'·复苏'};}
    return [{op:'rule',rule:'death_guard',key:'*',...(uses?{uses}:{}),amount:{...zero(),flat:keep},duration:permanent||!turns?PERMANENT:rounds(turns,3),...(onTrigger?{onTrigger}:{}),...(targeting?{targeting}:{})}];}
   case 'undying':return wrap([{op:'rule',rule:'undying',key:'*',duration:permanent?PERMANENT:rounds(turns,2)}]);
   case 'revive':{const p=pct(s.pct)??30;return [{op:'revive',amount:{...zero(),subject:'target',maxResource:'hp',maxFraction:p/100},targeting:targeting&&targeting.life==='downed'?targeting:{side:'ally',selection:mode==='active'?'manual':'random',count:1,life:'downed'}}];}
   case 'immune':case 'immunity':{
    const list=(Array.isArray(s.to)?s.to:[s.to??'debuffs']).map(String);const out:EffectSpec[]=[];const dur=permanent?PERMANENT:rounds(turns,2),uses=num(s.uses);
    const rule=(r:Extract<EffectSpec,{op:'rule'}>['rule'],key:string)=>{out.push({op:'rule',rule:r,key,duration:dur,...(uses?{uses:Math.round(uses)}:{})});};
    for(const x of list){const k=x.toLowerCase();
     if(/^(debuffs?|negative|负面|减益)$/.test(k))rule('immune_status','negative');
     else if(/^(control|controls|控制|硬控)$/.test(k))for(const c of ['stun','freeze','sleep','petrify','knockdown','charm','confusion','fear','silence','bind','time_stop','polymorph','disarm','no_action'])rule('immune_status',c);
     else if(/^(damage|all_damage|一切伤害|所有伤害|任何伤害|全部伤害|伤害)$/.test(k))rule('immune_channel','*');
     else if(/^(all|\*|all_status|一切)$/.test(k))rule('immune_status','*');
     else if(k.startsWith('channel:')||CHANNEL_WORDS[k.replace(/伤害$/,'')]){const c=CHANNEL_WORDS[k.replace(/^channel:/,'').replace(/伤害$/,'')];if(c)rule('immune_channel',c);}
     else if(k.startsWith('element:')||TYPE_WORDS[k.replace(/属性$/,'')]){const t=TYPE_WORDS[k.replace(/^element:/,'').replace(/属性$/,'')];if(t)rule('immune_element',t);}
     else if(/instant|即死|斩杀|execute/.test(k)){rule('death_guard','*');this.note('即死免疫按一次免死近似');}
     else{const std=findStd(x);if(std){rule('immune_concept',std.name);if(std.control)rule('immune_status',std.control);}else rule('immune_concept',x.slice(0,200));}}
    return wrap(out);}
   case 'summon':case 'clone':{
    const sm=(s.summon??s) as BPSummon;const name=String(sm.name??'召唤物').slice(0,100),count=Math.max(1,Math.min(8,Math.round(num(sm.count)??1)));
    const tplId=this.id('召唤');const inherit=(pct(sm.inheritPct)??50)/100;
    // 原文明写继承百分比时才按继承；否则（含“与自身同级”）取该等级的普通怪物面板，构型由定位/名称推定。
    const explicitInherit=pct(sm.inheritPct)!==undefined||pct(sm.hpPct)!==undefined;const build=summonBuild(sm,name);
    const actions:string[]=[];
    const custom=normStepsSafe(sm.steps);
    if(custom.length){const aid=this.id('召唤行动');const mt=inferMainTarget(custom);const eff=this.steps(custom,'active',mt);const act:ActionSpec={...bare(eff,mt.side==='enemy'||mt.side==='any'?'enemy':mt.side==='ally'||mt.side==='downed_ally'?'ally':'self'),name:name+'·行动'};const tg=this.target(mt,'active',mt);if(mt.side==='downed_ally')act.targeting={side:'ally',selection:'manual',count:1,life:'downed'};else if(tg&&tg.side!=='self'&&!(tg.selection==='manual'&&(tg.count??1)===1&&tg.life==='alive'))act.targeting=tg;this.lib.actions[aid]=act;actions.push(aid);}
    const aid=this.id('召唤攻击');const pw=num(sm.power)??Math.round(this.ctx.power*.5);const ch=CHANNEL_WORDS[String(sm.channel??'physical').toLowerCase()]??CHANNEL_WORDS[String(sm.channel)]??'physical';
    const am={physical:zero(),energy:zero(),mental:zero(),true:zero()};am[ch]={...zero(),flat:pw,attribute:ch==='physical'?'力量':ch==='mental'?'精神':ch==='true'?'none':'智力',factor:ch==='true'?0:this.ctx.attributeFactor,scale:ch==='true'?'flat':'host_tier'};
    this.lib.actions[aid]={...bare([{op:'damage',amounts:am,element:'none',hitChance:.95,hitRule:'normal',critChance:.05,critMultiplier:1.5}],'enemy'),name:name+'·攻击'};actions.push(aid);
    const hp=pct(sm.hpPct);
    this.lib.summons[tplId]={name,level:sm.level&&sm.level!=='caster'&&num(sm.level)?'fixed':'caster',...(sm.level&&sm.level!=='caster'&&num(sm.level)?{fixedLevel:Math.max(1,Math.round(num(sm.level)!))}:{}),inheritance:explicitInherit?(hp!==undefined?hp/100:inherit):0,...(explicitInherit?{}:{panel:{build}}),resources:{hp:0,mp:0,sp:0},attributes:{力量:0,敏捷:0,体质:0,智力:0,精神:0},actions,duration:num(sm.turns)?rounds(num(sm.turns),3):PERMANENT,ownerDeath:'despawn',limit:Math.max(count,Math.min(8,Math.round(num(sm.limit)??count))),rewardEligible:false,tags:[...(sm.tags??[]).map(String).slice(0,8),...(sm.taunt?['taunt']:[]),'build:'+build]};
    const out:EffectSpec[]=[{op:'summon',template:tplId,count,mode:d==='clone'?'clone':'summon',targeting:{side:'self',selection:'manual'}}];
    if(sm.taunt){const st=this.status('嘲讽',{turns:num(sm.turns)??3});out.push({op:'apply_status',status:st.id,targeting:{side:'enemy',selection:'all',life:'alive'}});}
    return out;}
   case 'field':case 'domain':case 'zone':case 'aura':{
    const name=String(s.name??'领域').slice(0,100),aff=String(s.affects??s.side??'enemy');const side=aff==='ally'||aff==='allies'?'ally':aff==='all'||aff==='any'?'any':aff==='self'?'self':'enemy';
    const o:StatusOverride={permanent:true,name:name+'·影响'};const mods=modifiers(normMods(s.mods),this.notes);if(mods.length)o.mods=mods;const dot=pct(s.dotPct);if(dot)o.dot=dot/100;const hot=pct(s.hotPct);if(hot)o.hot=hot/100;const hotFlat=num(s.hotAmount);if(hotFlat)o.hotFlat=hotFlat;
    const ctl=s.control?CONTROL_WORDS[String(s.control).toLowerCase()]??CONTROL_WORDS[String(s.control)]:undefined;if(ctl)o.control=ctl;
    o.polarity=side==='ally'||side==='self'?'positive':'negative';
    const base=s.status?String(s.status):undefined;
    const st=this.status(base&&findStd(base)?base:{name:name+'·影响',polarity:o.polarity} as BPCustomStatus,o);
    const fid=this.id('场');
    if(d==='aura'&&permanent){return [{op:'apply_status',status:st.id,targeting:{side,selection:'all',life:'alive'} as TargetSpec}];}
    this.lib.fields[fid]={name,group:name,priority:0,stack:'replace',targeting:{side,selection:'all',life:'alive'} as TargetSpec,status:st.id,duration:permanent?PERMANENT:rounds(turns,3)};
    const out:EffectSpec[]=[{op:'field',field:fid,targeting:{side:'self',selection:'manual'}}];
    const per=normStepsSafe(s.perRound);
    if(per.length){const t:BPTrigger={on:'round',steps:per};const tr=this.triggers([t]);const st2=this.lib.statuses[st.id]!;if(side==='self'||side==='ally'){st2.triggers=[...(st2.triggers??[]),...tr];}else{const holder=this.status({name:name+'·维持',polarity:'positive'} as BPCustomStatus,permanent?{permanent:true}:{turns:turns??3});this.lib.statuses[holder.id]!.triggers=tr;out.push({op:'apply_status',status:holder.id,targeting:{side:'self',selection:'manual'}});}}
    return out;}
   case 'form':case 'transform':case 'stance':{
    const f=(s.form??s) as {name?:unknown;mods?:unknown;drainPct?:unknown;turns?:unknown;permanent?:unknown};const name=String(f.name??'形态').slice(0,100);
    const o:StatusOverride={polarity:'positive',tags:[name,'形态']};const mods=modifiers(normMods(f.mods),this.notes);if(mods.length)o.mods=mods;const drain=pct(f.drainPct);if(drain)o.dot=drain/100;
    if(f.permanent===true||num(f.turns)===undefined&&mode==='passive')o.permanent=true;else o.turns=num(f.turns)??3;o.dispellable=s.dispellable===true;
    const st=this.status({name,polarity:'positive'} as BPCustomStatus,o);
    const out:EffectSpec[]=[{op:'apply_status',status:st.id,targeting:{side:'self',selection:'manual'}}];
    const extra=normStepsSafe(s.steps);if(extra.length)out.push(...this.steps(extra,mode,fallback));
    const per=normStepsSafe(s.perRound);if(per.length){this.lib.statuses[st.id]!.triggers=[...(this.lib.statuses[st.id]!.triggers??[]),...this.triggers([{on:'round',steps:per}])];}
    return out;}
   case 'atb':case 'extra_turn':case 'extra_action':case 'push':case 'delay':case 'haste_turn':{
    // 0.21 P2-2：mode 与 do 用同一套同义词——提示词写的 mode:push|delay|extra_turn|haste 分别还原为 push/retreat/extra/push。
     const said=String(s.mode??'push').toLowerCase(),alias=/^(delay|retreat|back|slow|推后|延后|推迟)$/.test(said)?'retreat':/^(extra|extra_turn|extra_action|额外回合)$/.test(said)?'extra':/^(haste|haste_turn|advance|加速|提前)$/.test(said)?'push':said;
     const m=d==='extra_turn'||d==='extra_action'?'extra':d==='delay'?'retreat':d==='push'?'push':alias;
    const mm=(['push','retreat','set','immediate','extra','end','rotate'].includes(m)?m:'push') as Extract<EffectSpec,{op:'atb'}>['mode'];
    const v=mm==='extra'?Math.max(1,Math.round(num(s.value)??1)):Math.max(-100,Math.min(1000,pct(s.value)??30));
    if((d==='delay'||d==='atb'&&mm==='retreat')&&!explicit&&mode!=='active')targeting={side:'enemy',selection:'random',count:1,life:'alive'};
    return wrap([{op:'atb',mode:mm,value:v}]);}
   case 'interrupt':return wrap([{op:'cast',mode:'interrupt',value:0}]);
   case 'seal':case 'suppress':case 'disable':{
    const what=String(s.what??'skills').toLowerCase(),dur=s.permanent===true?PERMANENT:rounds(turns,2),count=num(s.count);
    if(/last|latest|最近/.test(what))return wrap([{op:'uses',mode:'seal',skill:'*',value:1,selection:'used_latest',duration:dur}]);
    if(/spell|法术|魔法/.test(what))return wrap([{op:'apply_status',status:this.status('沉默',{turns:turns??2}).id}]);
    const kinds=/equip|装备|武器/.test(what)?['equipment' as const]:/item|道具/.test(what)?['item' as const]:/race|种族/.test(what)?['race' as const]:/ascension|登神|法则/.test(what)?['ascension' as const,'law' as const]:/passive|被动/.test(what)?undefined:/all|全部|一切/.test(what)?undefined:['skill' as const];
    return wrap([{op:'source',mode:s.remove===true?'remove':'suppress',...(kinds?{kinds}:{}),...(/passive|被动/.test(what)?{passiveOnly:true}:{}),selection:count?'random':'all',...(count?{count:Math.min(64,Math.round(count))}:{}),duration:dur.clock==='permanent'||dur.clock==='round'?dur:PERMANENT}]);}
   case 'copy':case 'mimic':{
    const what=String(s.what??'last_used');const dur=rounds(turns,3);
    if(/passive|被动/.test(what))return wrap([{op:'copy',mode:'passive',id:'*',selection:'random',duration:dur,...(s.steal?{steal:true}:{})}]);
    if(/status|状态/.test(what))return wrap([{op:'copy',mode:'status',id:'*',selection:'random',duration:dur}]);
    return wrap([{op:'copy',mode:'skill',id:'*',selection:/random|随机/.test(what)?'used_random':'used_latest',duration:s.permanent===true?PERMANENT:dur,...(s.activate?{activate:true}:{})}]);}
   case 'steal_passive':return wrap([{op:'copy',mode:'passive',id:'*',selection:'random',steal:true,duration:rounds(turns,3)}]);
   case 'swap':{
    const what=String(s.what??'statuses');
    if(/hp|生命|resource|资源/.test(what))return wrap([{op:'resource',resource:'hp',amount:zero(),mode:'swap'}]);
    if(/position|位置/.test(what))return wrap([{op:'space',mode:'swap',value:0}]);
    return wrap([{op:'status_transform',mode:'swap_pair',polarity:'any'}]);}
   case 'invert':case 'reverse_status':return wrap([{op:'status_transform',mode:'invert_numeric',polarity:s.polarity==='positive'?'positive':s.polarity==='any'?'any':'negative'}]);
   case 'drain':{
    const r=(['hp','mp','sp'].includes(String(s.resource))?s.resource:'mp') as 'hp'|'mp'|'sp';const p=pct(s.pct),flat=num(s.amount);
    const take:AmountSpec={...zero(),...(flat?{flat}:{}),...(p?{subject:'target' as const,maxResource:r,maxFraction:p/100}:{})};if(!flat&&!p)take.flat=this.ctx.cost;
    const gain:AmountSpec={...zero(),...(flat?{flat}:{}),...(p?{subject:'target' as const,maxResource:r,maxFraction:p/100}:{})};if(!flat&&!p)gain.flat=this.ctx.cost;
    if(p)this.note('汲取按双方各自最大值的同一比例结算');
    return [...wrap([{op:'resource',resource:r,amount:take,mode:'subtract'}]),{op:'heal',resource:r,amount:gain,targeting:{side:'self',selection:'manual'}}];}
   case 'burn':return wrap([{op:'resource',resource:(['mp','sp'].includes(String(s.resource))?s.resource:'mp') as 'mp'|'sp',amount:{...zero(),...(pct(s.pct)?{subject:'target' as const,maxResource:(['mp','sp'].includes(String(s.resource))?s.resource:'mp') as 'mp'|'sp',maxFraction:pct(s.pct)!/100}:{flat:num(s.amount)??this.ctx.cost})},mode:'burn'}]);
   case 'time_stop':return wrap([{op:'apply_status',status:this.status('时停',{turns:turns??1}).id}]);
   case 'link':{
    const names=(Array.isArray(s.members)?s.members:[]).map(String).filter(Boolean).slice(0,16);
    if(names.length<2){this.note('生命链接缺少成员名单，已忽略');return [];}
    return [{op:'link',mode:'life',key:this.id('链接'),members:{side:'ally',selection:'all',life:'any',names},minimumMembers:Math.min(names.length,Math.max(2,Math.round(num(s.minimum)??names.length))),duration:PERMANENT,delayRounds:Math.max(1,Math.round(num(s.delayRounds)??1)),recovery:{hp:(pct(s.hpPct)??50)/100,mp:(pct(s.mpPct)??50)/100,sp:(pct(s.spPct)??50)/100},cleanse:true}];}
   case 'consume':{const st=this.statusKey(String(s.status??''));if(!st)return [];const stacks=num(s.stacks);return [{op:'dispel',mode:'remove',polarity:'any',status:st,includeUndispellable:true,...(stacks?{stacks:Math.round(stacks)}:{}),targeting:{side:'self',selection:'manual'}}];}
   case 'counter_add':case 'charge':{const key=String(s.key??'能量').slice(0,200);return [{op:'counter',key,mode:s.mode==='set'?'set':s.mode==='clear'?'clear':'add',value:[{constant:num(s.value)??1}],reset:'battle',...(num(s.max)?{maximum:num(s.max)!}:{}),targeting:{side:'self',selection:'manual'}}];}
   case 'branch':case 'if':{
    const when=this.conds(s.when);const then=normStepsSafe(s.then),els=normStepsSafe(s.else);if(!then.length)return [];
    // 条件缺失或无法识别：按第一分支无条件执行，并记降级备注（不静默丢弃整段效果）。
    if(!when.length){this.notes.push('分支条件未给出或无法识别，按第一分支执行'+(els.length?'，另一分支未生效':''));return this.steps(then,mode,fallback);}
    const tid=this.child(then,'分支',mode==='passive'?'passive':'trigger',fallback);const eid=els.length?this.child(els,'否则',mode==='passive'?'passive':'trigger',fallback):undefined;
    // 分支内沿用当前目标：child 使用 trigger 模式会补显式 targeting，这里清掉与主目标一致的部分
    for(const id of [tid,eid])if(id)for(const e of this.lib.actions[id]!.effects)if(mode==='active'&&e.targeting?.side===(fallback.side==='enemy'?'enemy':'')&&e.targeting.selection==='random')delete e.targeting;
    const e:Extract<EffectSpec,{op:'branch'}>={op:'branch',when,then:tid,...(eid?{otherwise:eid}:{})};if(targeting)e.targeting=targeting;return [e];}
   case 'check':case 'save':{
    const attr=ATTRS.find(a=>a===s.attr)??'精神',vs=ATTRS.find(a=>a===s.vs)??attr,dc=num(s.dc);
    const succ=normStepsSafe(s.success??s.then),fail=normStepsSafe(s.failure??s.else);if(!succ.length)return [];
    const sid=this.child(succ,'检定成功','trigger',fallback),fid=fail.length?this.child(fail,'检定失败','trigger',fallback):undefined;
    for(const id of [sid,fid])if(id)for(const e of this.lib.actions[id]!.effects)if(mode==='active'&&e.targeting?.selection==='random'&&e.targeting.side==='enemy')delete e.targeting;
    const e:Extract<EffectSpec,{op:'check'}>=dc!==undefined?{op:'check',attacker:[{constant:dc}],defender:[{read:'attribute',subject:'target',key:vs}],scale:20,baseChance:.5,success:sid,...(fid?{failure:fid}:{})}:{op:'check',attacker:[{read:'attribute',subject:'caster',key:attr}],defender:[{read:'attribute',subject:'target',key:vs}],scale:20,baseChance:.5,success:sid,...(fid?{failure:fid}:{})};
    if(targeting)e.targeting=targeting;return [e];}
   case 'random':case 'choose':{
    const opts=(Array.isArray(s.options)?s.options:[]).map(o=>normStepsSafe(o)).filter(o=>o.length).slice(0,32);if(opts.length<2)return opts[0]?this.steps(opts[0],mode,fallback):[];
    const ids=opts.map((o,i)=>this.child(o,'随机'+(i+1),mode==='passive'?'passive':'trigger',fallback));
    for(const id of ids)for(const e of this.lib.actions[id]!.effects)if(mode==='active'&&e.targeting?.selection==='random'&&e.targeting.side==='enemy')delete e.targeting;
    const count=Math.max(1,Math.min(ids.length,Math.round(num(s.count)??1)));const e:Extract<EffectSpec,{op:'choose'}>={op:'choose',actions:ids,count,replace:false};if(targeting)e.targeting=targeting;return [e];}
   case 'cancel':case 'cancel_action':return [{op:'alter_event',mode:'cancel_action',...(s.chance!==undefined?{probability:s.chance}:{})}];
   case 'scale_event':case 'reduce_incoming':{const p=pct(s.pct)??50;return [{op:'alter_event',mode:'scale',value:[{constant:Math.max(0,1-p/100)}]}];}
   case 'damage_cap':{const p=pct(s.pctMaxHp??s.pct)??30;const st=this.status({name:String(s.name??'承伤上限'),polarity:'positive'} as BPCustomStatus,{permanent:permanent||!turns,...(turns?{turns}:{}),reactions:[{kind:'damage_cap',amount:{...zero(),subject:'target',maxResource:'hp',maxFraction:p/100},reset:s.reset==='battle'?'battle':s.reset==='turn'?'target_ready':'round'}]});return [{op:'apply_status',status:st.id,targeting:targeting??{side:'self',selection:'manual'}}];}
   case 'mana_shield':case 'resource_guard':{const r=s.resource==='sp'?'sp':'mp';const st=this.status({name:String(s.name??'魔力护体'),polarity:'positive'} as BPCustomStatus,{...(permanent?{permanent:true}:{turns:turns??3}),reactions:[{kind:'resource_guard',resource:r,fraction:Math.min(1,(pct(s.pct)??100)/100)}]});return [{op:'apply_status',status:st.id,targeting:targeting??{side:'self',selection:'manual'}}];}
   case 'lifesteal_passive':{const st=this.status({name:String(s.name??'吸血'),polarity:'positive'} as BPCustomStatus,{permanent:true,reactions:[{kind:'lifesteal',fraction:Math.min(100,(pct(s.pct)??10)/100),basis:'actual'}]});return [{op:'apply_status',status:st.id,targeting:{side:'self',selection:'manual'}}];}
   case 'share':case 'substitute':{const st=this.status({name:String(s.name??'分担'),polarity:'positive'} as BPCustomStatus,{...(permanent?{permanent:true}:{turns:turns??3}),reactions:[{kind:d==='substitute'?'substitute':'share',fraction:Math.min(1,(pct(s.pct)??50)/100)}]});return wrap([{op:'apply_status',status:st.id}]);}
   case 'untargetable':return wrap([{op:'rule',rule:'untargetable',key:'*',duration:rounds(turns,1)}]);
   case 'first_strike':return [{op:'rule',rule:'first_strike',key:'*',duration:permanent?PERMANENT:rounds(turns,1),targeting:{side:'self',selection:'manual'}}];
   case 'no_heal':return wrap([{op:'apply_status',status:this.status('禁疗',{turns:turns??2}).id}]);
   case 'luck':return wrap([{op:'rule',rule:'luck',key:'best',uses:Math.round(num(s.uses)??1),duration:permanent?PERMANENT:rounds(turns,3)}]);
   case 'retreat':case 'escape':return [{op:'retreat',targeting:{side:'self',selection:'manual'}}];
   case 'recall':return [{op:'recall',ownerOnly:true}];
   case 'reveal':case 'explore':return [{op:'explore',kind:s.kind==='stealth'?'stealth':s.kind==='sense_chest'?'sense_chest':s.kind==='danger_reduction'?'danger_reduction':'reveal',value:num(s.value)??2,duration:s.kind==='stealth'?{clock:'exploration_time',value:15000}:PERMANENT}];
   case 'rule':{const r=String(s.rule??'');const allowed=['immune_element','immune_channel','immune_status','immune_concept','seal_category','guaranteed_hit','guaranteed_evade','no_heal','death_guard','no_revive','luck','first_strike','undying','uninterruptible','untargetable','buff_cap','debuff_cap','dot_scale'];if(!allowed.includes(r)){this.note('规则「'+r+'」不在可用范围，已忽略');return [];}
    return wrap([{op:'rule',rule:r as Extract<EffectSpec,{op:'rule'}>['rule'],key:String(s.key??'*').slice(0,200),duration:permanent?PERMANENT:rounds(turns,2),...(num(s.uses)?{uses:Math.round(num(s.uses)!)}:{}),...(r==='death_guard'?{amount:{...zero(),flat:1}}:{})}]);}
   case 'ir':{const e=s.effect as EffectSpec|undefined;if(!e||typeof e!=='object'||!('op'in e)){this.note('ir 步骤缺少合同效果，已忽略');return [];}const lib=s.library as Partial<LibrarySpec>|undefined;if(lib&&typeof lib==='object')for(const k of ['actions','statuses','summons','fields'] as const)Object.assign(this.lib[k],lib[k]??{});return [structuredClone(e)];}
   case 'note':case 'flavor':case 'noncombat':{const t=String(s.text??s.note??'').slice(0,300);if(t)this.note('叙述性条款：'+t);return [];}
  }
  this.note('未知步骤「'+s.do+'」已忽略');return [];
 }
 steps(list:BPStep[],mode:'active'|'passive'|'trigger',fallback:BPTarget,dual=false):EffectSpec[]{return list.flatMap(s=>{try{return this.step(s,mode,fallback,dual);}catch(e){this.note('步骤「'+s.do+'」无法降级：'+(e instanceof Error?e.message:String(e)).slice(0,120));return [];}});}
}
function normStepsSafe(x:unknown):BPStep[]{return (Array.isArray(x)?x:x?[x]:[]).filter((s):s is BPStep=>!!s&&typeof s==='object'&&typeof (s as BPStep).do==='string');}

/** 0.38.1 步骤对目标的利害：harm=作用于敌方；help=可给予己方（治疗、护盾、正面状态、增益、净化、复活）；
 * stance=通常只作用于自身的姿态类（格挡、闪避、反击、免死、形态…）；neutral=其它。 */
export type StepNature='harm'|'help'|'stance'|'neutral';
const NATURE_JUDGED=/^(status|debuff_status|apply|stat|buff|debuff|modify|dispel|purge)$/;
const HARM_STEPS=/^(damage|attack|hit|debuff|debuff_status|steal|seal|suppress|disable|drain|copy|mimic|steal_passive|execute|time_stop|swap|burn|interrupt|delay|invert_enemy)$/;
const HELP_STEPS=/^(heal|restore|recover|shield|barrier|cleanse|purify|revive|buff)$/;
const STANCE_STEPS=/^(guard|reduce|damage_reduction|dodge|evade|reflect|thorns|counter|sure_hit|guaranteed_hit|undying|death_guard|deathguard|revive_self|self_revive|luck|untargetable|first_strike|form|transform|stance|immune|immunity|mana_shield|resource_guard|damage_cap|lifesteal_passive|share|substitute|scale_event|reduce_incoming|atb|extra_turn|extra_action|push|summon|clone|field|domain|zone|aura|consume|counter_add|charge|retreat|escape|self_damage|sacrifice|invert|reverse_status)$/;
/** 让对象动不了/受制于人的控制：无论自称什么极性都算有害（隐身、守护除外）。 */
const HARM_CONTROLS=new Set<string>(['stun','freeze','silence','bind','sleep','fear','confusion','charm','taunt','mark','isolate','time_stop','petrify','knockdown','disarm','polymorph','no_action']);
const AUTO_RESOURCE=/^(auto|needed|need|lowest|adaptive|any|所需|需要|最缺|缺少|自动)$/;
/** 数值越低越好的属性写法（承伤、易伤、消耗、受到暴击伤害）：它们的负向修正是增益。 */
const LOWER_IS_BETTER=/^(?:(?:受到|承受)(?:的)?(?:物理|能量|魔法|精神|真实)?伤害|damage_?taken|易伤|vulnerability|受到暴击伤害|crit_?taken|消耗|cost|技能消耗|(?:mp|sp|hp|法力|体力|生命)消耗|cost_(?:mp|sp|hp))$/i;
function modSign(m:BPMod):number{const v=m.add??m.pct??(m.mul!==undefined?m.mul-1:0);const sign=Math.sign(v);return LOWER_IS_BETTER.test(String(m.stat).replace(/\s/g,''))?-sign:sign;}
export function stepNature(s:BPStep):StepNature{
 const d=String(s.do).replace(/[\s-]/g,'_');
 if(d==='status'||d==='apply'){const ref=s.status??s.id??s.name;const std=typeof ref==='string'?findStd(ref):undefined;if(std)return std.polarity==='negative'?'harm':std.polarity==='positive'?'help':'neutral';if(ref&&typeof ref==='object'){const c=ref as BPCustomStatus;const ctl=CONTROL_WORDS[String(c.control??'')]??String(c.control??'');return c.polarity==='positive'&&!HARM_CONTROLS.has(ctl)?'help':'harm';}return 'harm';}
 if(d==='stat'||d==='buff'||d==='modify'){const signs=normMods(s.mods??s.stats).map(modSign);return signs.some(x=>x>0)?'help':signs.some(x=>x<0)?'harm':d==='buff'?'help':'neutral';}
 if(d==='dispel'||d==='purge')return s.polarity==='negative'?'help':'harm';
 if(d==='atb'){const m=String(s.mode??'');return m==='delay'||m==='retreat'?'harm':'stance';}
 if(HARM_STEPS.test(d))return 'harm';if(HELP_STEPS.test(d))return 'help';if(STANCE_STEPS.test(d))return 'stance';
 return 'neutral';
}
function sideWhen(list:BPCond[]|undefined):'enemy'|'ally'|undefined{const k=list?.find(c=>c.kind==='target_is_enemy'||c.kind==='target_is_ally')?.kind;return k==='target_is_enemy'?'enemy':k==='target_is_ally'?'ally':undefined;}
const openSide=(s:BPStep)=>!s.target||s.target.side==='enemy'||s.target.side==='any';
/** 0.38.1 主动技能的主目标：显式目标优先；有指向敌方的有害步骤（或写明对敌的步骤）→敌方；有手选一名同伴的步骤→同伴；
 * 未写目标的复活→倒地同伴；未写目标的治疗/护盾/正面状态/增益/净化且无姿态类→可选同伴（含自身）；否则自身。 */
export function inferMainTarget(steps:BPStep[],explicit?:BPTarget):BPTarget{
 if(explicit)return explicit;
 const harm=steps.find(s=>stepNature(s)==='harm'&&openSide(s))??steps.find(s=>s.target&&(s.target.side==='enemy'||s.target.side==='any'));
 if(harm)return harm.target&&(harm.target.side==='enemy'||harm.target.side==='any')?harm.target:{side:'enemy'};
 // 只有“手选一名同伴”的步骤需要主目标来选人；全体同伴等范围步骤自带目标，不改变主目标。
 const ally=steps.find(s=>s.target&&(s.target.side==='downed_ally'||s.target.side==='ally'&&(s.target.select??'single')==='single'));
 if(ally)return ally.target!;
 const loose=steps.filter(s=>!s.target);
 if(loose.some(s=>String(s.do)==='revive'))return {side:'downed_ally'};
 if(loose.some(s=>stepNature(s)==='help')&&!loose.some(s=>stepNature(s)==='stance'))return {side:'ally'};
 return {side:'self'};
}
/** 蓝图 → 合同 Action。失败抛出异常，由调用方回退到下一候选。 */
export function lowerBlueprint(bp:Blueprint,ctx:LowerContext):Lowered{
 // 整次动作最多 24 段：多个多段伤害叠加超限时，逐档降低单个伤害的压缩上限重试（压缩在备注中披露）。
 for(const cap of [MAX_ATTACK_BEATS,16,12,8,4]){
  const r=lowerOnce(bp,{...ctx,beatCap:cap});
  try{validateAction(r.action);return r;}catch(e){if(!/最多24段/.test(String((e as Error).message))||cap===4)return r;}
 }
 return lowerOnce(bp,ctx);
}
/** 战场全程可见，没有迷雾：侦查/感知类步骤在战斗中改写为对目标施加[标记]（受到伤害增加、闪避降低）。 */
export function combatize(bp:Blueprint):Blueprint{
 const isScan=(s:BPStep)=>(s.do==='reveal'||s.do==='explore')&&!['stealth','sense_chest','danger_reduction'].includes(String(s.kind??''));
 const hasMark=(xs:BPStep[])=>xs.some(x=>x.do==='status'&&(x.status==='标记'||x.status==='看破'));
 const fix=(xs:BPStep[]|undefined,target?:BPTarget):BPStep[]=>{if(!xs?.some(isScan))return xs??[];const mark=hasMark(xs);const out=xs.filter(x=>!isScan(x));if(!mark)out.push({do:'status',status:'标记',turns:3,...(xs.find(isScan)?.target?{target:xs.find(isScan)!.target}:target?{target}:{})});return out;};
 if(!JSON.stringify(bp).match(/"do":"(?:reveal|explore)"/))return bp;
 const b:Blueprint=structuredClone(bp);
 if(b.kind==='passive'&&b.steps.some(isScan)){b.steps=b.steps.filter(x=>!isScan(x));b.triggers=[...(b.triggers??[]),{on:'hit',chance:.3,steps:[{do:'status',status:'标记',turns:2,target:{side:'hit_target'}}]}];}
 else b.steps=fix(b.steps);
 for(const t of b.triggers??[])t.steps=fix(t.steps,t.target);
 return b;
}
function lowerOnce(bp:Blueprint,ctx:LowerContext):Lowered{
 bp=combatize(bp);
 // “使敌方本次行动失效”只能改写敌方行动事件：顶层 cancel 统一改为 enemy_action 反应。
 const cancels=bp.steps.filter(x=>x.do==='cancel'||x.do==='cancel_action');
 if(cancels.length){bp={...bp,steps:bp.steps.filter(x=>!cancels.includes(x)),triggers:[...(bp.triggers??[]),...cancels.map(c=>({on:'enemy_action',...(bp.kind==='active'?{uses:1}:{}),...(num(c.chance)!==undefined?{chance:chance(c.chance)}:{}),steps:[{do:'cancel'}]}))]};}
 const b=new Builder(ctx);const passive=bp.kind==='passive';
 let a:ActionSpec;
 if(passive){
  a=bare([],'self');a.activation='always';
  a.effects=b.steps(bp.steps,'passive',{side:'self'});
  if(bp.triggers?.length)a.triggers=b.triggers(bp.triggers);
 }else{
  const mainT=inferMainTarget(bp.steps,bp.target);
  // 0.38.1 敌我两用：主目标“任意一方”的单体技能里同时有有害与有益步骤（或写明了 target_is_enemy/ally），按所选目标的阵营分别生效。
  const openHarm=bp.steps.some(s=>stepNature(s)==='harm'&&openSide(s));
  const anySingle=mainT.side==='any'&&(mainT.select??'single')==='single';
  const helpish=(s:BPStep)=>stepNature(s)==='help'&&(!s.target||s.target.side==='any'||s.target.side==='ally'&&(s.target.select??'single')==='single');
  const dual=anySingle&&((openHarm&&bp.steps.some(helpish))||bp.steps.some(s=>!!sideWhen(s.when)));
  const side=mainT.side==='any'?(openHarm?'enemy':'ally'):mainT.side==='enemy'?'enemy':mainT.side==='ally'||mainT.side==='downed_ally'?'ally':'self';
  a=bare(b.steps(bp.steps,'active',mainT,dual),side);
  const tg=b.target(mainT,'active',mainT);
  if(tg&&!(tg.side==='self')&&(tg.side==='any'||!(tg.selection==='manual'&&(tg.count??1)===1&&tg.life==='alive'&&!tg.maxTier&&!tg.minTier)))a.targeting=tg;
  if(mainT.side==='downed_ally')a.targeting={side:'ally',selection:'manual',count:1,life:'downed'};
  if(bp.triggers?.length){const st=b.status({name:(bp.name??ctx.name)+'·持续效果',polarity:'positive'} as BPCustomStatus,{turns:3});b.lib.statuses[st.id]!.triggers=b.triggers(bp.triggers);a.effects.push({op:'apply_status',status:st.id,...(side==='self'?{}:{targeting:{side:'self',selection:'manual'}})});b.note('主动技能附带的触发效果在使用后持续3回合');}
  const cost=bp.cost??{};
  for(const r of ['hp','mp','sp'] as const){const flat=cost[r]??0,p=cost[(r+'Pct') as 'hpPct']??0;if(flat||p)a.cost[r]={flat,maxFraction:Math.min(1,p/100)};}
  if(bp.perBattle)a.perBattleUses=bp.perBattle;
  if(bp.perTarget&&(!a.targeting||a.targeting.selection==='manual'))a.perTargetUses=bp.perTarget;
  if(bp.cooldown)a.cooldown=Math.min(100,bp.cooldown);
  if(bp.charges){a.charges=bp.charges;}
  if(bp.castRounds)a.castMs=Math.min(600000,bp.castRounds*ROUND_MS);
  if(bp.firstStrike)a.initiative='absolute';
  const conds=b.conds(bp.requires);
  if(bp.onlyInForm)conds.push({kind:'status',key:bp.onlyInForm.slice(0,200),compare:'gte',value:1});
  if(bp.notInForm)conds.push({kind:'status',key:bp.notInForm.slice(0,200),compare:'lt',value:1});
  if(conds.length)a.conditions=conds;
  const hasDamage=a.effects.some(e=>e.op==='damage');
  const energy=a.effects.some(e=>e.op==='damage'&&(e.amounts.energy.flat>0||e.amounts.mental.flat>0));
  a.category=bp.category??(hasDamage?(energy&&(a.cost.mp.flat>0||a.cost.mp.maxFraction>0)?'spell':'skill'):(a.cost.mp.flat>0||a.cost.mp.maxFraction>0)?'spell':'skill');
 }
 if(!a.effects.length&&!a.triggers?.length)throw Error('蓝图没有可执行效果');
 const used=Object.keys(b.lib).some(k=>Object.keys(b.lib[k as keyof LibrarySpec]).length);
 if(used)a.library=b.lib;
 a.name=(bp.name??ctx.name).slice(0,200);
 return {action:a,disposition:passive?'passive':'active',notes:b.notes,lines:[]};
}
