import type {ActionSpec,EffectSpec,AmountSpec,DurationSpec,StatusSpec} from '../compiler/contract';
import {elementKey,resolveDamageTypes} from '../battle/elements';
import {sideGate} from '../battle/targeting';
import type {CompiledActor} from '../compiler/engine';
const channel:Record<string,string>={physical:'物理',energy:'能量',mental:'精神',true:'真实'};
export const qualityName:Record<string,string>={common:'普通',uncommon:'优良',rare:'稀有',epic:'史诗',legendary:'传说',mythic:'神话',unique:'唯一'};
const resource:Record<string,string>={hp:'生命',mp:'法力',sp:'体力'};
const controls:Record<string,string>={stun:'眩晕',freeze:'冻结',silence:'沉默',bind:'束缚（无法使用位移类动作）',sleep:'睡眠',fear:'恐惧',confusion:'混乱',charm:'魅惑',taunt:'嘲讽',hidden:'隐匿',mark:'标记',guard:'守护',isolate:'空间隔离',time_stop:'时停'};
const stats:Record<string,string>={力量:'力量',敏捷:'敏捷',体质:'体质',智力:'智力',精神:'精神',max_hp:'生命上限',max_mp:'法力上限',max_sp:'体力上限',hit:'命中',evade:'闪避',crit:'暴击',crit_multiplier:'暴击伤害',armor_physical:'物理护甲',armor_energy:'能量护甲',armor_mental:'精神护甲',reduction_physical:'物理减伤',reduction_energy:'能量减伤',reduction_mental:'精神减伤',reduction_true:'真实减伤',damage_physical:'物理伤害',damage_energy:'能量伤害',damage_mental:'精神伤害',damage_true:'真实伤害',heal_power:'治疗效果',heal_received:'受到治疗',cost_hp:'生命消耗',cost_mp:'法力消耗',cost_sp:'体力消耗',cast_speed:'施法速度',recovery:'行动恢复时间',penetration:'穿透',vulnerability:'易伤',element:'元素抗性',speed:'速度',initiative:'先手',check_strength:'力量检定',check_agility:'敏捷检定',check_constitution:'体质检定',check_intelligence:'智力检定',check_spirit:'精神检定'};
const num=(n:number)=>Number.isInteger(n)?String(n):String(Math.round(n*100)/100);
const pct=(n:number)=>num(n*100)+'%';
export function durationText(d:DurationSpec){const n=num(d.value);return d.clock==='target_action'?n+'次行动':d.clock==='target_ready'?n+'次行动开始':d.clock==='round'?n+'轮':d.clock==='battle_time'||d.clock==='exploration_time'?num(d.value/1000)+'秒':d.clock==='field'?'领域持续期间':'持续生效';}
export function amountText(a:AmountSpec,numeric?:CompiledActor['numeric']){
 const parts:string[]=[];if(a.flat)parts.push(num(a.flat));
 if(a.attribute!=='none'&&a.factor){const tier=numeric?Math.min(7,Math.ceil(numeric.level/4)):0,coefficient=a.scale==='host_tier'&&tier?[2,2.8,4,8,15,35,80][tier-1]!:1;parts.push(a.attribute+'×'+num(a.factor*coefficient)+(a.scale==='host_tier'&&!tier?'（随层级提升）':''));}
 const who=a.resourceSubject==='target'||a.subject==='target'?'目标':'自身';
 if(a.maxResource!=='none'&&a.maxFraction)parts.push(who+'最大'+resource[a.maxResource]+'的'+pct(a.maxFraction));
 if(a.currentResource&&a.currentFraction)parts.push(who+'当前'+resource[a.currentResource]+'的'+pct(a.currentFraction));
 if(a.lostResource&&a.lostFraction)parts.push(who+'已损失'+resource[a.lostResource]+'的'+pct(a.lostFraction));
 if(a.eventFraction)parts.push('本次伤害的'+pct(a.eventFraction));
 if(a.dependency)parts.push(a.dependency.startsWith('inventory:')?'随持有的'+a.dependency.slice(10)+'数量提升':'随羁绊变化');
 if(a.expression)parts.push('依战斗状态变化的加成');
 let text=parts.join(' + ')||'0';if(a.minimum!==undefined)text+='，最低'+num(a.minimum);if(a.maximum!==undefined)text+='，上限'+num(a.maximum);return text;
}
export function targetText(a:Pick<ActionSpec,'target'|'targeting'>){const t=a.targeting;const side=t?.side??a.target;const base=side==='self'?'自身':side==='ally'?'同伴':side==='enemy'?'敌方':side==='event_target'?'命中的目标':side==='owner'?'持有者':side==='any'?'目标（敌我皆可）':'目标';if(side==='self')return base;return t?.selection==='all'?'全体'+base:t?.selection==='random'?'随机'+(t.count??1)+'名'+base:t?.selection==='bounce'?'在'+base+'之间弹射':(t?.count&&t.count>1?t.count+'名':'单体')+base;}
export function costText(a:Pick<ActionSpec,'cost'>){const parts:string[]=[];for(const [key,c]of Object.entries(a.cost)){const values=[c.flat?num(c.flat):'',c.maxFraction?'最大值的'+pct(c.maxFraction):'',c.currentFraction?'当前值的'+pct(c.currentFraction):''].filter(Boolean);if(values.length)parts.push(resource[key]+' '+values.join(' + '));}return parts.join(' · ')||'无消耗';}
const eventNames:Record<string,string>={battle_start:'战斗开始时',shield_gained:'获得护盾时',ready:'行动开始时',before_action:'发动技能前',after_cost:'支付消耗后',hit:'命中时',damage_dealt:'造成伤害时',damage_received:'受到伤害时',shield_break:'护盾破碎时',before_down:'即将倒下时',after_down:'倒下后',kill:'击败敌人时',action_end:'行动结束时',battle_end:'战斗结束时',new_region:'进入新区域时',pickup:'拾取时',open_chest:'开启宝箱时',use_item:'使用物品时',tick:'每次触发时',before_damage:'伤害结算前',before_heal:'治疗前',after_heal:'治疗后',before_status:'状态生效前',after_status:'状态生效后',before_cost:'支付消耗前',miss:'攻击落空时',blocked:'格挡时',round:'每轮',death_prevented:'抵挡致命伤害时',action_resolved:'动作完成后'};
function effectBody(e:EffectSpec,a?:ActionSpec,numeric?:CompiledActor['numeric'],depth=0):string{
 const amount=(v:AmountSpec)=>amountText(v,numeric),clock=(v:DurationSpec)=>durationText(v),lib=a?.library;
 switch(e.op){
 case 'damage':{const lines=Object.entries(e.amounts).filter(([,v])=>amount(v)!=='0').map(([k,v])=>amount(v)+'点'+channel[k]+'伤害');const typing=resolveDamageTypes(e);return '造成'+lines.join('、')+'（'+(typing.fixed==='percent'?'百分比·无属性，无视抗性':typing.fixed==='true'?'真实·无属性':typing.types.join('/')+'属性'+(typing.perType?'，各结算一次':typing.types.length>1?'，取目标最弱抗性':''))+'）'+(e.hits&&e.hits>1?'，'+e.hits+'段'+(e.powerMode==='split_total'?'分摊总威力':'连续攻击'):'')+(e.hitRule==='guaranteed'?'，必中':'')+(e.drain?'，将'+pct(e.drain.fraction)+'伤害转为'+resource[e.drain.resource]:'')+(e.lethal===false?'，保留目标至少1点生命':'');}
 case 'heal':return e.adaptive?'恢复目标最缺的一项资源（生命/法力/体力中占比最低者）：'+amount(e.amount).replace(/(最大|当前|已损失)(生命|法力|体力)/g,'$1值')+(e.overflowShield?'，溢出部分转为护盾':''):'恢复'+amount(e.amount)+'点'+resource[e.resource]+(e.overflowShield?'，溢出部分转为护盾':'');
 case 'shield':return '获得'+amount(e.amount)+'点护盾，'+clock(e.duration)+(e.charges?'，可抵挡'+e.charges+'次':'');
 case 'speed':return '速度变为'+pct(e.multiplier)+'，'+clock(e.duration);
 case 'armor':return channel[e.channel]+'护甲增加'+amount(e.amount);
 case 'reduction':return '减少'+pct(e.fraction)+'受到的'+channel[e.channel]+'伤害';
 case 'damage_bonus':return channel[e.channel]+'伤害'+(e.flat?'增加'+num(e.flat)+'，':'')+'倍率'+pct(e.multiplier);
 case 'heal_bonus':return '治疗效果变为'+pct(e.multiplier);
 case 'element_resist':return '受到的'+elementKey(e.element)+'属性伤害变为'+pct(e.multiplier)+(e.multiplier<=0?'（无效）':'');
 case 'resource':return ({add:'增加',subtract:'消耗',set:'调整至',exchange:'转化',burn:'燃烧',swap:'交换'}[e.mode])+amount(e.amount)+'点'+resource[e.resource]+(e.other?' → '+resource[e.other]:'');
 case 'modify':return e.modifiers.map(m=>(stats[m.stat]??'属性')+(m.flat?' '+(m.flat>0?'+':'')+num(m.flat):'')+(m.amount?' +'+amount(m.amount):'')+(m.multiplier!==undefined?' ×'+num(m.multiplier):'')).join('，')+'；'+clock(e.duration);
 case 'apply_status':{const status=lib?.statuses[e.status],extra:string[]=[];
  for(const m of status?.modifiers??[])extra.push((stats[m.stat]??'属性')+(m.flat?' '+(m.flat>0?'+':'')+num(m.flat):'')+(m.amount?' +'+amount(m.amount):'')+(m.multiplier!==undefined?' ×'+num(m.multiplier):''));
  if(status?.tick&&depth<3){const tick=lib?.actions[status.tick.action];if(tick)extra.push('周期触发：'+tick.effects.map(x=>effectText(x,a,numeric,depth+1)).join('；'));}
  for(const r of status?.reactions??[]){const labels:Record<string,string>={reflect:'反射伤害',block:'格挡',parry:'招架',counter:'反击',share:'分担伤害',absorb:'吸收伤害',lifesteal:'吸取生命',manasteal:'吸取法力',death_guard:'抵挡致命伤害',substitute:'代替承伤',redirect:'转移伤害',convert:'转化伤害',damage_cap:'承伤上限',resource_guard:'以资源抵挡伤害'};extra.push((labels[r.kind]??'触发防护')+(r.fraction!==undefined?' '+pct(r.fraction):'')+(r.flat?' '+num(r.flat):'')+(r.uses?'，'+r.uses+'次':''));}
  return (e.opposedAttribute&&e.opposedAttribute!=='none'?'进行'+e.opposedAttribute+'对抗，成功后':'')+'施加'+(status?.control?controls[status.control]:status?.name??'状态')+(status?'，'+clock(e.duration??status.duration):'')+(e.stacks&&e.stacks>1?'，'+e.stacks+'层':'')+(extra.length?'；'+extra.join('；'):'');}

 case 'dispel':return ({remove:'解除',steal:'夺取',transfer:'转移'}[e.mode])+(e.count??1)+'个'+({negative:'负面状态',positive:'增益状态',any:'状态'}[e.polarity]);
 case 'remove_shield':return '移除'+(e.count??1)+'层护盾';
 case 'atb':return e.mode==='end'?'终止当前行动':e.mode==='immediate'?'立即获得行动':e.mode==='extra'?'获得额外行动':'行动进度'+(e.mode==='retreat'?'-':'+')+num(Math.abs(e.value))+'%';
 case 'cast':return ({interrupt:'打断施法',accelerate:'加快施法',delay:'延缓施法',seal:'暂时封锁施法'}[e.mode])+(e.duration?'，'+clock(e.duration):'');
 case 'uses':return ({restore:'恢复',spend:'消耗',charge:'充能',seal:'封锁',unseal:'解封',reset:'重置'}[e.mode])+'技能使用次数'+(e.value?' '+e.value:'');
 case 'revive':return '使倒下的同伴返回战斗，恢复'+amount(e.amount)+'点生命';
 case 'summon':return (e.mode==='clone'?'复制':'召唤')+e.count+'名'+(lib?.summons[e.template]?.name??'助战者')+(lib?.summons[e.template]?'，'+clock(lib.summons[e.template]!.duration):'');
 case 'retreat':return '安全离开迷宫';
 case 'recall':return '召回'+(e.ownerOnly?'自身的':'')+'召唤物';
 case 'field':return (e.remove?'结束':'展开')+(lib?.fields[e.field]?.name??'领域')+(lib?.fields[e.field]?'，'+clock(lib.fields[e.field]!.duration):'');
 case 'time':if(e.mode==='delay'){const child=e.action&&lib?.actions[e.action];return (e.duration?.clock==='target_ready'?'在自身第'+e.duration.value+'次行动开始时':e.duration?'在'+clock(e.duration)+'后':'延迟发动')+(child&&depth<3?'：'+child.effects.map(x=>effectText(x,a,numeric,depth+1)).join('；'):'发动后续效果');}return ({stop:'暂停时间',snapshot:'记录当前状态',rewind:'恢复此前记录'} as Record<string,string>)[e.mode]??'改变时序';
 case 'space':return ({isolate:'隔离目标',move:'移动位置',swap:'交换位置',release:'解除隔离',swap_pair:'两名目标互换位置'}[e.mode])+(e.duration?'，'+clock(e.duration):'');
 case 'copy':return (e.steal?'暂时夺取':'借用')+({skill:'技能',status:'状态',passive:'被动能力'}[e.mode])+'，'+clock(e.duration);
 case 'rule':{const label:Record<string,string>={immune_status:'免疫'+(controls[e.key]??'指定状态'),immune_element:'免疫'+elementKey(e.key)+'属性',immune_channel:'免疫'+(channel[e.key]??'指定')+'伤害',immune_concept:'抵抗指定概念效果',immune_source:'抵抗指定类型能力',seal_category:'封锁指定类型技能',guaranteed_hit:'攻击必中',guaranteed_evade:'必定闪避',death_guard:'抵挡致命伤害',undying:'零生命时仍可行动',no_heal:'阻止治疗',no_revive:'阻止复活',substitute:'代替承受伤害',luck:'改变运势',first_strike:'获得先手',sealed:'封印目标',uninterruptible:'抵抗打断',untargetable:'无法被选为目标',causality:'施加命中或生存规则',draft:'草稿与定稿',repeat_seal:'重复使用即被封',blank_page:'空白页',buff_cap:'增益时长上限',debuff_cap:'负面时长上限',element_rewrite:'技能属性改写',percent_to_heal:'百分比伤害转为治疗',true_reflect:'真实伤害原样反射',nth_skill_scale:'首个伤害技能倍率',guard_first:'开局只能防御',nth_use_free:'第 N 次免费',blood_tax:'以血代蓝',gear_cost:'每轮首动折价',hp_gate_damage:'按血线切换攻击',hp_gate_attrs:'按血线切换属性',echo_first:'首个技能回响',type_scale:'按属性缩放输出',taken_type_scale:'按属性缩放承伤',dot_scale:'持续伤害缩放',control_tax:'免疫但付血'};return (label[e.rule]??'获得特殊规则')+(e.uses?'，'+e.uses+'次':'')+'；'+clock(e.duration);}
 case 'explore':return ({reveal:'感知当前区域的敌人',sense_chest:'感知宝箱',stealth:'在探索中隐匿',danger_reduction:'降低探索风险',event_option:'获得特殊事件选项'}[e.kind])+'；'+clock(e.duration);
 case 'sequence':case 'repeat':{const child=lib?.actions[e.action];return '连续发动'+('repeat'in e?e.repeat:e.limit)+'次'+(child&&depth<3?'：'+child.effects.map(x=>effectText(x,a,numeric,depth+1)).join('；'):'后续效果');}
 case 'branch':return '满足条件时发动'+(lib?.actions[e.then]?.name??'附加效果')+(e.otherwise?'，否则发动另一种效果':'');
 case 'check':return '进行双方对抗检定，成功后发动'+(lib?.actions[e.success]?.name??'后续效果');
 case 'variable':return '记录本次效果数值，用于后续技能';
 case 'counter':return '累积或调整本次战斗的触发次数';
 case 'alter_event':return ({cancel_action:'取消当前行动',cancel_effect:'抵消当前效果',scale:'改变本次效果倍率',set:'调整本次效果数值',damage_to_heal:'将伤害转为治疗',heal_to_damage:'将治疗转为伤害',redirect:'改变当前效果的承受者'}[e.mode]);
 case 'source':return ({suppress:'暂时压制',restore:'恢复',remove:'移除'}[e.mode])+'目标的一类能力；'+clock(e.duration);
 case 'status_transform':return e.mode==='swap'?'交换双方状态':'反转状态的数值增减';
 case 'choose':return '从'+e.actions.length+'种效果中发动'+e.count+'种';
 case 'link':return e.mode==='life'?'与同伴共享生命羁绊，满足条件时返回战斗':e.mode==='sever'?'切断生命羁绊':'解除自身羁绊';
 case 'replay':return '回放刚刚承受的整次技能';
 }
}
export function effectText(e:EffectSpec,a?:ActionSpec,numeric?:CompiledActor['numeric'],depth=0):string{
 // 0.38.1 敌我两用：只作用于所选敌人/同伴的部分分别标注。
 const gate=a?sideGate(a,e):undefined;
 const conditions=(e.conditions??[]).filter(c=>!(gate&&c.kind==='side')).map(c=>c.kind==='side'?(c.key==='opposite'?'目标为敌方':c.key==='same'?'目标为同伴':'目标阵营符合'):c.kind==='phase'?c.key==='battle'?'战斗中':c.key==='exploration'?'探索中':'特定阶段':c.kind==='resource_ratio'?(c.subject==='target'?'目标':'自身')+(resource[c.key??'']??'资源')+({lt:'低于',lte:'不高于',gt:'高于',gte:'达到',eq:'为',ne:'不为'}[c.compare??'gte'])+pct(c.value??0):c.kind==='critical'?'暴击时':c.kind==='shield'?'护盾生效时':'满足条件时');
 return (gate?(gate==='enemy'?'对敌方：':'对同伴：'):'')+(conditions.length?'【'+conditions.join('、')+'】':'')+(e.probability!==undefined&&e.probability<1?pct(e.probability)+'概率':'')+effectBody(e,a,numeric,depth);
}
export function runtimeRuleText(rule:{kind:string;key:string;uses:number}){
 const labels:Record<string,string>={immune_status:'免疫'+(controls[rule.key]??'指定状态'),immune_element:'免疫'+elementKey(rule.key)+'属性',immune_channel:'免疫'+(channel[rule.key]??'指定')+'伤害',immune_concept:'概念抗性',immune_source:'能力抗性',seal_category:'技能封锁',guaranteed_hit:'必中',guaranteed_evade:'必闪',death_guard:'致命防护',undying:'不死',no_heal:'禁疗',no_revive:'禁复活',luck:'运势改变',first_strike:'先手',sealed:'封印',uninterruptible:'不可打断',untargetable:'无法选定',causality:'因果效应',substitute:'替身',draft:'草稿定稿',repeat_seal:'重复封印',blank_page:'空白页',buff_cap:'增益上限',debuff_cap:'负面上限',element_rewrite:'属性改写',percent_to_heal:'比例反转',true_reflect:'真实反射',nth_skill_scale:'开幕倍率',guard_first:'先守',nth_use_free:'第N次免费',blood_tax:'血税',gear_cost:'齿轮',hp_gate_damage:'血线攻击',hp_gate_attrs:'血线属性',echo_first:'回响',type_scale:'属性输出',taken_type_scale:'属性承伤',dot_scale:'持续缩放',control_tax:'免疫付血'};
 return (labels[rule.kind]??'特殊效果')+(rule.uses>0?' ×'+rule.uses:'');
}
export function statusSummary(status:StatusSpec){
 const parts:string[]=[];if(status.control)parts.push(controls[status.control]??'状态限制');
 for(const m of status.modifiers??[])parts.push((stats[m.stat]??'属性')+(m.flat?' '+(m.flat>0?'+':'')+num(m.flat):'')+(m.amount?' +'+amountText(m.amount):'')+(m.multiplier!==undefined?' ×'+num(m.multiplier):''));
 if(status.tick)parts.push('周期效果');if(status.reactions?.length)parts.push('受到影响时触发附加效果');return parts.join('；')||status.name;
}
export function playerNotice(text:string){if(/(?:写回|保存|同步).*(?:失败|异常)/.test(text))return '这页暂时还没保存好，请重试。';if(/JSON|Godot|sourceId|schema|undefined|Error:|fidelity|指纹/.test(text))return '这一步暂时没能完成，请再试一次。';return /缓存|宿主|编译/.test(text)?'':text;}
export function playerBattleLog(log:{kind:string;unit:string;detail:string;value?:number}[],units:{id:string;name:string}[]){
 const kinds:Record<string,string>={damage:'受到伤害',heal:'恢复',down:'倒下了',miss:'攻击落空',shield:'获得护盾',revive:'重新站起',retreat:'离开战场',blocked:'挡住了攻击',guard:'进入防御',death_guard:'抵挡了致命伤害'};
 return log.slice(-12).flatMap(l=>l.kind==='affinity'&&l.detail.includes('·')?[`${units.find(u=>u.id===l.unit)?.name??'角色'} · ${l.detail.replace('·','属性')}`]:kinds[l.kind]?[`${units.find(u=>u.id===l.unit)?.name??'角色'} · ${kinds[l.kind]}${l.value!==undefined?' '+num(l.value):''}`]:[]).slice(-6);
}
export function describeAction(a:ActionSpec,numeric?:CompiledActor['numeric']){
 const lines=a.effects.map(e=>effectText(e,a,numeric));
 for(const t of a.triggers??[]){const action=a.library?.actions[t.action];lines.push((eventNames[t.event]??'触发时')+(t.chance!==undefined&&t.chance<1?'，'+pct(t.chance)+'概率':'')+'：'+(action?action.effects.map(e=>effectText(e,a,numeric)).join('；'):'发动附加效果')+(t.uses?'（每场'+t.uses+'次）':'')+(t.payCost&&action?'；触发消耗：'+costText(action):''));}
 for(const id of a.grantedActions??[]){const child=a.library?.actions[id];if(child)lines.push('获得主动技能「'+(child.name??'附加能力')+'」：'+child.effects.map(e=>effectText(e,a,numeric)).join('；'));}
 return lines.filter(Boolean);
}
