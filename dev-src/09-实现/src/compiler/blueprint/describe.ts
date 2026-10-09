/** 蓝图 → 面向玩家的中文效果说明（界面展示最终实际效果）。 */
import {findStd} from './statuses';
import {num,pct,chance,normMods,type Blueprint,type BPStep,type BPTarget,type BPTrigger,type BPCond} from './types';

const CH:Record<string,string>={physical:'物理',energy:'能量',mental:'精神',true:'真实',物理:'物理',能量:'能量',精神:'精神',真实:'真实',魔法:'能量',法术:'能量'};
function who(t:BPTarget|undefined,fallback='目标'):string{
 if(!t)return fallback;
 const base=t.side==='self'?'自身':t.side==='ally'?'同伴':t.side==='enemy'?'敌人':t.side==='attacker'?'攻击者':t.side==='hit_target'?'被命中者':t.side==='downed_ally'?'倒地同伴':'任意单位（敌我皆可）';
 const tier=t.belowCasterTier?'（层级低于自身）':t.maxTier?`（层级≤${t.maxTier}）`:'';
 if(t.side==='self')return '自身';
 if(t.select==='all')return (t.side==='ally'?'全体同伴':t.side==='enemy'?'全体敌人':'全场')+tier;
 if(t.select==='random')return `随机${t.count??1}名${base}`+tier;
 if(t.select==='lowest_hp')return `生命最低的${t.count&&t.count>1?t.count+'名':''}${base}`+tier;
 if(t.select==='highest_attack')return `攻击最高的${base}`+tier;
 return (t.count&&t.count>1?`至多${t.count}名`:'单个')+base+tier;
}
let PASSIVE=false;
function turnsText(s:BPStep,def?:number){const t=num(s.turns??s.duration);if(s.permanent===true||t!==undefined&&t>=99||PASSIVE&&t===undefined)return PASSIVE&&t===undefined?'（常驻）':'（持续至战斗结束）';return t!==undefined?`（${t}回合）`:def?`（${def}回合）`:'';}
function condText(c:BPCond):string{
 const v=c.value??0,st=c.status??'';
 const m:Record<string,string>={hp_below:`自身生命低于${v}%`,hp_above:`自身生命不低于${v}%`,target_hp_below:`目标生命低于${v}%`,target_hp_above:`目标生命不低于${v}%`,mp_below:`自身法力低于${v}%`,has_status:`自身处于[${st}]`,target_has_status:`目标处于[${st}]`,lacks_status:`自身不处于[${st}]`,target_lacks_status:`目标不处于[${st}]`,status_stacks_at_least:`自身[${st}]达到${v}层`,target_status_stacks_at_least:`目标[${st}]达到${v}层`,target_debuffs_at_least:`目标负面状态≥${v}种`,allies_alive_at_least:`己方存活≥${v}人`,enemies_alive_at_least:`敌方存活≥${v}人`,allies_alive_at_most:`己方存活≤${v}人`,first_use:'本场首次使用',round_at_least:`第${v}回合起`,kills_at_least:`击杀≥${v}`,crit:'暴击时',target_tier_below:'目标层级低于自身',in_field:`处于[${st}]中`,target_is_enemy:'对敌人使用',target_is_ally:'对同伴使用'};
 return m[c.kind]??c.kind;
}
function modsText(x:unknown):string{return normMods(x).map(m=>`${m.stat}${m.pct!==undefined?(m.pct>=0?'+':'')+m.pct+'%':m.mul!==undefined?'×'+m.mul:(m.add??0)>=0?'+'+m.add:String(m.add)}`).join('、');}
const CTRL:Record<string,string>={stun:'无法行动',no_action:'无法进行[动作]',root:'无法位移',silence:'无法施法',disarm:'无法攻击',petrify:'石化',knockdown:'倒地',polymorph:'变形',sleep:'沉睡',freeze:'冻结',fear:'恐惧',charm:'魅惑',confuse:'混乱',taunt:'嘲讽',blind:'目盲'};
function customText(c:Record<string,unknown>):string{const parts:string[]=[];if(typeof c.desc==='string'&&c.desc)parts.push(c.desc);const ms=Array.isArray(c.mods)?c.mods:[];if(ms.length)parts.push(modsText(ms).replace(/^[，、]/,''));
 if(typeof c.control==='string')parts.push(CTRL[c.control]??c.control);const dot=pct(c.dotPct),hot=pct(c.hotPct),hotAmount=num(c.hotAmount);if(dot)parts.push(`每回合受到最大生命${dot}%伤害`);if(hotAmount)parts.push(`每回合恢复${hotAmount}点生命`);else if(hot)parts.push(`每回合恢复${hot}%最大生命`);
 if(c.consumeOn==='damaged')parts.push('受击后消耗');if(c.consumeOn==='attack')parts.push('攻击后消耗');if(c.stackable)parts.push('可叠加');if(c.dispellable===false)parts.push('不可驱散');return parts.length?'：'+parts.join('，'):'';}
export function describeStep(s:BPStep,depth=0):string{
 const d=s.do,t=s.target?who(s.target):'',pre=(s.when?.length?'若'+s.when.map(condText).join('且')+'，':'')+(s.chance!==undefined?`${Math.round(s.chance*100)}%概率`:'');
 const inner=(x:unknown)=>Array.isArray(x)?(x as BPStep[]).map(y=>describeStep(y,depth+1)).filter(Boolean).join('；'):'';
 let body='';
 switch(d){
  case 'damage':case 'attack':case 'hit':{
   const parts:string[]=[];const p=num(s.power);if(p!==undefined&&p>0)parts.push(`威力${Math.round(p*(num(s.multiplier)??1))}`);
   for(const [k,label] of [['pctMaxHp','目标最大生命'],['pctCurrentHp','目标当前生命'],['pctLostHp','目标已损生命'],['selfPctMaxHp','自身最大生命'],['selfPctLostHp','自身已损生命']] as const){const v=pct(s[k]);if(v)parts.push(`${label}${v}%`);}
   const ch=typeof s.channel==='string'?s.channel.split(/[+＋、,，/]/).map(x=>CH[x.trim()]??x).join('+'):s.channel&&typeof s.channel==='object'?Object.keys(s.channel).map(x=>CH[x]??x).join('+'):'物理';
   const rh=s.randomHits as {min?:unknown;max?:unknown}|undefined;const hits=rh?`随机${num(rh.min)}~${num(rh.max)}段`:num(s.hits)&&num(s.hits)!>1?`${num(s.hits)}段${s.split?'（总威力分摊）':''}`:'';
   const ext:string[]=[];if(s.sure)ext.push('必中');const pr=pct(s.pierce);if(pr)ext.push(`穿透${pr}%`);if(Array.isArray(s.ignore)&&s.ignore.length)ext.push('无视'+s.ignore.map(x=>String(x).replace('shield','护盾').replace('reduction','减伤').replace('death_guard','免死')).join('/'));
   const ls=pct(s.lifesteal);if(ls)ext.push(`吸血${ls}%`);const ts=pct(s.toShield);if(ts)ext.push(`伤害${ts}%转为护盾`);const ex=pct(s.executeBelowPct);if(ex)ext.push(`目标生命低于${ex}%时斩杀`);
   const b=s.bonusVsStatus as {status?:unknown;perStackPct?:unknown;pct?:unknown}|undefined;if(b?.status)ext.push(pct(b.perStackPct)?`目标每层[${b.status}]伤害+${pct(b.perStackPct)}%`:`对[${b.status}]目标伤害+${pct(b.pct)}%`);
   const sd=pct(s.selfDamagePct);if(sd)ext.push(`自身失去${sd}%最大生命`);
   const ty=Array.isArray(s.types)?s.types.map(String):typeof s.types==='string'?[s.types]:[];if(ty.length>1)ext.push(`${ty.join('/')}多属性，自动取目标最弱的属性结算`);else if(ty.length===1)ext.push(`${ty[0]}属性`);
   const cr=s.crit as {chance?:unknown;mult?:unknown}|undefined;if(cr&&typeof cr==='object'){const c=chance(cr.chance);if(c)ext.push(`暴击率+${Math.round(c*100)}%${num(cr.mult)?`，暴击×${num(cr.mult)}`:''}`);}
   body=`对${t||'目标'}造成${parts.join('+')||'同阶威力'}的${ch}伤害${hits?'×'+hits:''}${ext.length?'（'+ext.join('，')+'）':''}`;
   const on=inner(s.onHit);if(on)body+=`；每段命中：${on}`;break;}
  case 'heal':case 'restore':case 'recover':{const r=String(s.resource??'hp');const label=r==='mp'?'法力':r==='sp'?'体力':r==='all'?'生命/法力/体力':/^(auto|needed|need|lowest|adaptive|any|所需|需要|最缺|缺少|自动)$/i.test(r)?'资源（生命/法力/体力中最缺的一项）':'生命';const a=num(s.amount),p=pct(s.pct),pl=pct(s.pctLost),pd=pct(s.pctOfDamage);body=`为${t||'目标'}恢复${[a?String(a):'',p?`${p}%最大${label}`:'',pl?`${pl}%已损${label}`:'',pd?`造成伤害的${pd}%`:''].filter(Boolean).join('+')||'同阶数值的'}${a||p||pl||pd?'':label}${a&&!p&&!pl&&!pd?'点'+label:''}`;break;}
  case 'shield':case 'barrier':{const a=num(s.amount),p=pct(s.pct),pd=pct(s.pctOfDamage);body=`为${t||'自身'}提供${a?a+'点':p?`${p}%最大生命的`:pd?`等同伤害${pd}%的`:'同阶数值的'}护盾${turnsText(s,3)}`;break;}
  case 'status':case 'apply':{const ref=s.status??s.id??s.name;const name=typeof ref==='object'&&ref?String((ref as {name?:unknown}).name??'状态'):String(ref??'状态');const custom=typeof ref==='object'&&ref?ref as Record<string,unknown>:undefined;const std=custom?undefined:findStd(name);const st=num(s.stacks);const save=s.save as {attr?:unknown;dc?:unknown}|undefined;
   body=`${save?`目标进行${String(save.attr??'精神')}检定${num(save.dc)!==undefined?'(DC'+num(save.dc)+')':''}，失败则`:''}使${t||'目标'}陷入[${name}]${st&&st>1?st+'层':''}${turnsText(s,std?.turns)}${std?'：'+std.desc:custom?customText(custom):''}`;break;}
  case 'cleanse':case 'purify':body=`解除${t||'目标'}${num(s.count)?num(s.count)+'个':'全部'}负面状态`;break;
  case 'dispel':case 'purge':body=`驱散${t||'目标'}${num(s.count)?num(s.count)+'个':'全部'}增益`;break;
  case 'steal':body=`窃取${t||'目标'}${num(s.count)??1}个增益`;break;
  case 'stat':case 'buff':case 'debuff':case 'modify':body=`${t||(PASSIVE?'自身':'目标')}${modsText(s.mods??s.stats)}${turnsText(s,3)}`;break;
  case 'guard':case 'reduce':case 'damage_reduction':{const chs=(Array.isArray(s.channels)?s.channels:[]).map(c=>({physical:'物理',energy:'能量',mental:'精神',true:'真实'} as Record<string,string>)[String(c)]??String(c)).join('/');body=num(s.next)?`${t||'自身'}接下来${num(s.next)}次受到的${chs}伤害-${pct(s.pct)??30}%`:`${t||'自身'}受到的${chs}伤害-${pct(s.pct)??30}%${turnsText(s,2)}`;};break;
  case 'reflect':case 'thorns':body=`${t||'自身'}反弹${pct(s.pct)??30}%受到的伤害${num(s.uses)?'（'+num(s.uses)+'次）':''}${turnsText(s,3)}`;break;
  case 'counter':body=`${t||'自身'}受到攻击时反击${pct(s.pctOfDamage)?'（受到伤害的'+pct(s.pctOfDamage)+'%）':num(s.power)?'（威力'+num(s.power)+'）':''}${chance(s.counterChance)!==undefined?'，概率'+Math.round(chance(s.counterChance)!*100)+'%':''}${turnsText(s,2)}`;break;
  case 'dodge':case 'evade':body=num(s.uses)?`${t||'自身'}必定闪避接下来${num(s.uses)}次攻击`:`${t||'自身'}闪避+${pct(s.pct)??30}%${turnsText(s,2)}`;break;
  case 'sure_hit':case 'guaranteed_hit':body=`接下来${num(s.uses)??1}次攻击必中`;break;
  case 'death_guard':case 'deathguard':case 'revive_self':case 'self_revive':body=`受到致命伤害时保留${num(s.keepHp)??1}点生命${pct(s.healPct??s.pct)?`并恢复${pct(s.healPct??s.pct)}%最大生命`:''}（${num(s.uses)??1}次）`;break;
  case 'undying':body=`${t||'自身'}获得[不死]${turnsText(s,2)}：生命不会降到0以下`;break;
  case 'revive':body=`复活${t||'一名倒地同伴'}并恢复${pct(s.pct)??30}%最大生命`;break;
  case 'immune':case 'immunity':body=`${t||'自身'}免疫${(Array.isArray(s.to)?s.to:[s.to??'负面状态']).map(String).join('、')}${turnsText(s)}`;break;
  case 'summon':case 'clone':{const sm=(s.summon??s) as {name?:unknown;count?:unknown;turns?:unknown;level?:unknown;inheritPct?:unknown;hpPct?:unknown;steps?:unknown;taunt?:unknown};
   const lv=sm.level&&sm.level!=='caster'&&num(sm.level)?`${num(sm.level)}级`:'与自身同级';const inh=pct(sm.hpPct)??pct(sm.inheritPct);const t=num(sm.turns);const acts=inner(sm.steps);
   body=`召唤${num(sm.count)??1}个「${String(sm.name??'召唤物')}」（${lv}，${inh!==undefined?`继承自身${inh}%属性与资源`:'属性与资源取该等级普通怪物面板'}，${t&&t<99?t+'回合':'持续整场'}，由己方操控；招式：${acts?acts+'；':''}基础攻击${sm.taunt?'；嘲讽敌人':''}）`;break;}
  case 'field':case 'domain':case 'zone':case 'aura':{const m=modsText(s.mods);const dot=pct(s.dotPct),hotP=pct(s.hotPct),hotA=num(s.hotAmount);const st=s.status?`[${String(s.status)}]`:'';body=`展开「${String(s.name??'领域')}」${turnsText(s,3)}：${String(s.affects??'enemy')==='ally'?'己方全体':String(s.affects)==='self'?'自身':'敌方全体'}${[m,dot?`每回合受到${dot}%最大生命伤害`:'',hotA?`每回合恢复${hotA}点生命`:hotP?`每回合恢复${hotP}%最大生命`:'',st].filter(Boolean).join('，')||'受到影响'}`;const per=inner(s.perRound);if(per)body+=`；每回合：${per}`;break;}
  case 'form':case 'transform':case 'stance':{const f=(s.form??s) as {name?:unknown;mods?:unknown;drainPct?:unknown;turns?:unknown};body=`进入「${String(f.name??'形态')}」${num(f.turns)?'（'+num(f.turns)+'回合）':''}${f.mods?'：'+modsText(f.mods):''}${pct(f.drainPct)?`，每回合失去${pct(f.drainPct)}%最大生命`:''}`;const x=inner(s.steps);if(x)body+='；'+x;break;}
  case 'atb':case 'extra_turn':case 'extra_action':case 'push':case 'delay':body=d==='extra_turn'||d==='extra_action'?'立即获得一次额外行动':d==='delay'?`${t||'目标'}行动条后退${pct(s.value)??30}%`:`${t||'自身'}行动条前进${pct(s.value)??30}%`;break;
  case 'interrupt':body=`打断${t||'目标'}的吟唱`;break;
  case 'seal':case 'suppress':case 'disable':{const W:Record<string,string>={item:'道具',items:'道具',skill:'技能',skills:'技能',passive:'被动技能',equipment:'装备',all:'被动技能或装备',active:'主动技能'};body=`${s.remove===true?'永久移除':'封锁'}${t||'目标'}的${num(s.count)?num(s.count)+'项':''}${W[String(s.what??'skill')]??String(s.what)}${s.remove===true?'':turnsText(s,2)}`;}break;
  case 'copy':case 'mimic':body=`复制${t||'目标'}${/passive|被动/.test(String(s.what))?'的被动':'最近使用的技能'}${turnsText(s,3)}`;break;
  case 'steal_passive':body=`窃取${t||'目标'}的一项被动${turnsText(s,3)}`;break;
  case 'swap':body=`与${t||'目标'}交换${/hp|生命/.test(String(s.what))?'生命值':/position|位置/.test(String(s.what))?'位置':'全部状态'}`;break;
  case 'invert':case 'reverse_status':body=`将${t||'目标'}的${s.polarity==='positive'?'增益':'负面'}状态数值反转`;break;
  case 'drain':body=`汲取${t||'目标'}的${String(s.resource??'mp').toUpperCase()}`;break;
  case 'burn':body=`燃烧${t||'目标'}的${String(s.resource??'mp').toUpperCase()}`;break;
  case 'time_stop':body=`使${t||'目标'}时间停止${turnsText(s,1)}`;break;
  case 'link':body=`与${(Array.isArray(s.members)?s.members:[]).join('、')}建立生命链接`;break;
  case 'consume':body=`消耗自身[${String(s.status)}]${num(s.stacks)?num(s.stacks)+'层':'全部层数'}`;break;
  case 'branch':case 'if':body=`若${(s.when??[]).map(condText).join('且')}：${inner(s.then)}${Array.isArray(s.else)&&s.else.length?`；否则：${inner(s.else)}`:''}`;return body;
  case 'check':case 'save':body=`${String(s.vs??s.attr??'精神')}检定${num(s.dc)!==undefined?'(DC'+num(s.dc)+')':'（对抗）'}：成功则${inner(s.success??s.then)}${Array.isArray(s.failure??s.else)?`；失败则${inner(s.failure??s.else)}`:''}`;break;
  case 'random':case 'choose':body=`随机发动以下${num(s.count)??1}项：`+(Array.isArray(s.options)?s.options.map((o,i)=>`(${i+1})${inner(o)}`).join(' '):'');break;
  case 'cancel':case 'cancel_action':body='使该行动失效';break;
  case 'scale_event':case 'reduce_incoming':body=`本次伤害降低${pct(s.pct)??50}%`;break;
  case 'damage_cap':body=`每${s.reset==='battle'?'场':'回合'}承受的伤害不超过最大生命的${pct(s.pctMaxHp??s.pct)??30}%`;break;
  case 'mana_shield':case 'resource_guard':body=`以${s.resource==='sp'?'体力':'法力'}抵消受到的伤害`;break;
  case 'untargetable':body=`${t||'自身'}无法被选中${turnsText(s,1)}`;break;
  case 'first_strike':body='获得绝对先手';break;
  case 'self_damage':case 'sacrifice':body=`自身失去${pct(s.pct??s.pctMaxHp)??10}%最大生命`;break;
  case 'share':case 'substitute':body=`${t||'目标'}受到的伤害${pct(s.pct)??50}%由自身承担`;break;
  case 'luck':body=`${t||'自身'}的检定取最佳结果（${num(s.uses)??1}次）${turnsText(s,3)}`;break;
  case 'lifesteal_passive':body=`造成伤害的${pct(s.pct)??10}%转为生命`;break;
  case 'counter_add':case 'charge':body=`累积[${String(s.key??'能量')}]+${num(s.value)??1}`;break;
  case 'retreat':case 'escape':body='脱离战斗';break;
  case 'reveal':case 'explore':body='侦查周围的敌人与宝物';break;
  case 'ir':body=String(s.summary??'特殊程序效果');break;
  case 'note':case 'flavor':case 'noncombat':return '';
  default:body=String(s.summary??d);
 }
 return pre+body;
}
const TRIGGER_TEXT:Record<string,string>={battle_start:'战斗开始时',round:'每回合开始时',round_start:'每回合开始时',turn_start:'自身回合开始时',ready:'自身回合开始时',hit:'攻击命中时',crit:'暴击时',damage_dealt:'造成伤害时',damaged:'受到伤害时',attacked:'受到攻击时',hp_below:'生命首次低于阈值时',lethal:'受到致命伤害时',before_down:'即将倒下时',kill:'击杀敌人后',ally_down:'同伴倒下时',enemy_down:'敌人倒下时',dodge:'闪避攻击后',miss:'攻击未命中时',status_applied:'被施加状态时',battle_end:'战斗结束时',before_action:'行动前',after_action:'行动后',enemy_action:'敌人行动前',enemy_cost:'敌人支付费用后',before_damaged:'即将受到伤害时',ally_damaged:'同伴受到伤害时',shield_break:'护盾破碎时'};
function triggerText(t:BPTrigger){const head=(TRIGGER_TEXT[t.on]??t.on)+(t.on==='hp_below'?`（${t.hpPct??50}%）`:'')+(t.chance!==undefined?`，${Math.round(t.chance*100)}%概率`:'')+(t.uses?`（每场${t.uses}次）`:'')+(t.perRound?'（每回合限一次）':'')+(t.when?.length?'，若'+t.when.map(condText).join('且'):'');return head+'：'+t.steps.map(s=>describeStep(s)).filter(Boolean).join('；');}
export function describeBlueprint(bp:Blueprint):string{
 const head:string[]=[];
 if(bp.kind==='passive')head.push('被动');
 const c=bp.cost;if(c){const parts=(['hp','mp','sp'] as const).flatMap(r=>[c[r]?`${c[r]}${r.toUpperCase()}`:'',c[(r+'Pct') as 'hpPct']?`${c[(r+'Pct') as 'hpPct']}%最大${r.toUpperCase()}`:'']).filter(Boolean);if(parts.length)head.push('消耗'+parts.join('+'));}
 if(bp.cooldown)head.push(`冷却${bp.cooldown}回合`);if(bp.perBattle)head.push(`每场${bp.perBattle}次`);if(bp.perTarget)head.push(`每个目标${bp.perTarget}次`);if(bp.castRounds)head.push(`吟唱${bp.castRounds}回合`);if(bp.firstStrike)head.push('绝对先手');
 if(bp.kind==='active'&&bp.target?.side==='any'&&(bp.target.select??'single')==='single')head.push('敌我皆可选');
 if(bp.onlyInForm)head.push(`仅限[${bp.onlyInForm}]`);if(bp.notInForm)head.push(`[${bp.notInForm}]中不可用`);
 if(bp.requires?.length)head.push('条件：'+bp.requires.map(condText).join('且'));
 PASSIVE=bp.kind==='passive';const steps=bp.steps.map(s=>describeStep(s)).filter(Boolean);PASSIVE=false;
 const body=[...steps,...(bp.triggers??[]).map(triggerText)];
 return ((head.length?'【'+head.join('｜')+'】':'')+body.join('。')).slice(0,3900)||'保留原能力效果';
}
