/** 怪物独有机制词表：被动 / 独有主动 / 权能（改自身规则） / 新法则（改战场规则） / 神国原型（改胜负条件级规则） / 阶段转换。
 *  每个机制都是一个受限的 ActionSpec 生成器，数值随生命层级缩放；不改五维、不越过契约上限。 */
import type {ActionSpec,ConditionSpec,EffectSpec,ModifierSpec,ReactionSpec,StatusSpec,TriggerSpec} from '../../compiler/contract';
import {SKILL_COST} from './numbers';
import {action,child,condition,damage,finish,flat,minion,pct,permanent,round,self,shield,status,themeType,type Ctx} from './ir';
import {elementKey,type DamageType} from '../../battle/elements';

export type MechanicKind='passive'|'active'|'authority'|'law'|'kingdom';
export type Mechanic={name:string;kind:MechanicKind;summary:string;build:(c:Ctx)=>ActionSpec};
const ALL_ENEMIES={side:'enemy',selection:'all',life:'alive'} as const;
const RANDOM_ENEMY=(count:number)=>({side:'enemy',selection:'random',count,life:'alive'} as const);
const ALL_ALLIES={side:'ally',selection:'all',life:'alive'} as const;
const EVENT_SOURCE={side:'event_source',selection:'all',life:'alive'} as const;
const EVENT_TARGET={side:'event_target',selection:'all',life:'alive'} as const;
const ANY={side:'any',selection:'all',life:'alive'} as const;
const grow=(c:Ctx,base:number,step:number,cap=1)=>Math.min(cap,base+step*(c.stage-1));
function passive(c:Ctx,name:string,effects:EffectSpec[]=[]):ActionSpec{const a=action(effects,'self');a.activation='battle_start';a.name=c.m.motif+'·'+name;a.castMs=0;return finish(c,a);}
function active(c:Ctx,name:string,effects:EffectSpec[],opts:{mp?:number;sp?:number;hp?:number;cast?:number;uses?:number;target?:ActionSpec['target'];category?:string;targeting?:ActionSpec['targeting']}={}):ActionSpec{
 const a=action(effects,opts.target??'enemy');a.name=c.m.motif+'·'+name;a.category=opts.category??'spell';a.tags=['monster:unique','ai:unique'];
 const costUnit=SKILL_COST[c.stage-1]!*c.n.challengeGrowth.resource;a.cost.mp.flat=costUnit*(opts.mp??0);a.cost.sp.flat=costUnit*(opts.sp??0);if(opts.hp)a.cost.hp.maxFraction=opts.hp;
 a.castMs=opts.cast??500;if(opts.uses)a.perBattleUses=opts.uses;if(opts.targeting)a.targeting=opts.targeting;return finish(c,a);
}
function trigger(c:Ctx,a:ActionSpec,id:string,event:TriggerSpec['event'],scope:TriggerSpec['scope'],effects:EffectSpec[],options:Partial<TriggerSpec>={}){
 const key=child(c,id,effects,'self');a.triggers??=[];a.triggers.push({id,event,scope,action:key,uses:3,cooldownMs:2000,...options});
}
function buff(c:Ctx,key:string,name:string,extra:Parameters<typeof status>[3]):EffectSpec{const e=status(c,key,name,{polarity:'positive',...extra});delete (e as {opposedAttribute?:string}).opposedAttribute;e.targeting=self;return e;}
function aura(c:Ctx,key:string,name:string,duration:number,extra:Parameters<typeof status>[3]):EffectSpec{return buff(c,key,name,{duration:round(duration),dispellable:false,...extra});}
const dmgMods=(m:number):ModifierSpec[]=>[{stat:'damage_physical',multiplier:m},{stat:'damage_energy',multiplier:m},{stat:'damage_mental',multiplier:m}];
const hpBelow=(ratio:number,subject:ConditionSpec['subject']='caster'):ConditionSpec=>condition(subject,'resource_ratio','hp',ratio,'lte');
function control(c:Ctx,key:string,name:string,kind:NonNullable<StatusSpec['control']>,rounds=1):EffectSpec{return status(c,key,c.m.motif+'·'+name,{tags:['monster:control'],duration:round(rounds),control:kind,breakOnDamage:kind==='sleep'});}
function dot(c:Ctx,key:string,name:string,type:DamageType,factor=.3,rounds=3):EffectSpec{
 const d=damage(c,'energy',factor,1,[type]);d.hitChance=1;const tick=child(c,key+':tick',[d]);
 return status(c,key,c.m.motif+'·'+name,{tags:['dot','monster:primer'],duration:round(rounds),tick:{clock:'round',interval:1,count:rounds,action:tick},stack:'refresh'});
}
const themeDot=(c:Ctx)=>themeType(c.t)==='无'?'暗':themeType(c.t);

/* ───────────── 被动（“可以有的不能没有”：按怪物设计表决定有无与数量） ───────────── */
export const PASSIVES:Record<string,Mechanic>={
 thorns:{name:'荆棘之躯',kind:'passive',summary:'受击时反弹一部分实际伤害，每轮有限次数',build:c=>passive(c,'荆棘之躯',[aura(c,'p-thorns','荆棘之躯',99,{reactions:[{kind:'reflect',fraction:grow(c,.12,.03,.30),basis:'actual',uses:3,reset:'round'}]})])},
 bloodfeast:{name:'血饮',kind:'passive',summary:'造成伤害时按比例回复生命',build:c=>passive(c,'血饮',[aura(c,'p-bloodfeast','血饮',99,{reactions:[{kind:'lifesteal',fraction:grow(c,.08,.02,.22),direction:'outgoing',basis:'actual'}]})])},
 carapace:{name:'硬壳',kind:'passive',summary:'每轮前两次受击减免一部分伤害',build:c=>passive(c,'硬壳',[aura(c,'p-carapace','硬壳',99,{reactions:[{kind:'block',fraction:grow(c,.25,.03,.45),uses:2,reset:'round'}]})])},
 swift:{name:'迅影',kind:'passive',summary:'有概率招架，闪避提升',build:c=>passive(c,'迅影',[aura(c,'p-swift','迅影',99,{modifiers:[{stat:'evade',flat:grow(c,.05,.02,.2)}],reactions:[{kind:'parry',fraction:.5,chance:grow(c,.15,.03,.35),uses:2,reset:'round'}]})])},
 riposte:{name:'应激反击',kind:'passive',summary:'受到伤害后立刻对来源反击一次',build:c=>{const a=passive(c,'应激反击');const d=damage({...c,power:c.power*.45},'physical');d.targeting=EVENT_SOURCE;trigger(c,a,'p-riposte','damage_received','self',[d],{uses:4});return finish(c,a);}},
 regrowth:{name:'再生',kind:'passive',summary:'每公共轮回复少量最大生命',build:c=>{const heal=child(c,'p-regrowth:tick',[{op:'heal',resource:'hp',amount:pct('hp',grow(c,.03,.005,.06)),targeting:self}],'self');return finish(c,passive(c,'再生',[aura(c,'p-regrowth','再生',99,{tick:{clock:'round',interval:1,count:99,action:heal}})]));}},
 vengeance:{name:'同族之怒',kind:'passive',summary:'同伴倒下时进入狂怒，伤害提升',build:c=>{const a=passive(c,'同族之怒');trigger(c,a,'p-vengeance','after_down','ally',[buff(c,'p-vengeance-rage','同族之怒',{duration:round(3),modifiers:dmgMods(1+grow(c,.15,.03,.35))})],{uses:2});return finish(c,a);}},
 crystallize:{name:'结晶',kind:'passive',summary:'受击时有概率凝出护盾',build:c=>{const a=passive(c,'结晶');const s=shield({...c,recovery:c.recovery*.5});s.targeting=self;trigger(c,a,'p-crystallize','damage_received','self',[s],{uses:4,chance:.4});return finish(c,a);}},
 lurker:{name:'潜伏',kind:'passive',summary:'开战时潜伏一轮并提升首击（五阶起完全隐匿，不可被选中）',build:c=>{const hidden=buff(c,'p-lurker','潜伏',{duration:round(1),...(c.stage>=5?{control:'hidden' as const}:{}),modifiers:[...dmgMods(1+grow(c,.2,.04,.5)),...(c.stage>=5?[]:[{stat:'evade' as const,flat:.3}])]});return finish(c,passive(c,'潜伏',[hidden]));}},
 warden:{name:'卫护',kind:'passive',summary:'同伴即将倒下时为其回复生命',build:c=>{const a=passive(c,'卫护');trigger(c,a,'p-warden','before_down','ally',[{op:'heal',resource:'hp',amount:pct('hp',.2,'target'),targeting:EVENT_TARGET}],{uses:c.stage>=5?2:1});return finish(c,a);}},
 corrode:{name:'蚀甲',kind:'passive',summary:'每次命中叠加易伤，可叠5层',build:c=>{const a=passive(c,'蚀甲');const e=status(c,'p-corrode-mark',c.m.motif+'·蚀甲',{duration:round(3),stack:'stack',maxStacks:5,scaleWithStacks:true,modifiers:[{stat:'vulnerability',multiplier:1+grow(c,.03,.005,.06)}]});e.targeting=EVENT_TARGET;trigger(c,a,'p-corrode','hit','self',[e],{uses:0,cooldownMs:0});return finish(c,a);}},
 firststrike:{name:'先手',kind:'passive',summary:'战斗开始时先行动',build:c=>passive(c,'先手',[{op:'rule',rule:'first_strike',key:'*',duration:permanent,targeting:self}])},
 unyielding:{name:'不屈',kind:'passive',summary:'每战一次抵挡致命伤害',build:c=>passive(c,'不屈',[{op:'rule',rule:'death_guard',key:'*',uses:1,amount:flat(1),duration:permanent,targeting:self}])},
 siphon:{name:'汲能',kind:'passive',summary:'造成伤害时回复法力',build:c=>{const a=passive(c,'汲能');trigger(c,a,'p-siphon','damage_dealt','self',[{op:'heal',resource:'mp',amount:pct('mp',.04),targeting:self}],{uses:0,cooldownMs:0});return finish(c,a);}},
 plaguebearer:{name:'尸疫',kind:'passive',summary:'击倒敌人时向随机敌人散播腐蚀',build:c=>{const a=passive(c,'尸疫');const d=dot(c,'p-plague','尸疫','暗',.25,3);d.targeting=RANDOM_ENEMY(1);trigger(c,a,'p-plaguebearer','kill','self',[d],{uses:3});return finish(c,a);}},
 dread:{name:'威压',kind:'passive',summary:'开战时压制全体敌人的速度',build:c=>{const e=status(c,'p-dread',c.m.motif+'·威压',{duration:round(2),modifiers:[{stat:'speed',multiplier:1-grow(c,.06,.01,.15)}]});e.targeting=ALL_ENEMIES;return finish(c,passive(c,'威压',[e]));}},
 roar:{name:'咆哮',kind:'passive',summary:'开战时嘲讽敌人一轮并获得减伤',build:c=>{const t=control(c,'p-roar-taunt','咆哮',"taunt",1);t.targeting=ALL_ENEMIES;const r=buff(c,'p-roar-guard','咆哮·坚守',{duration:round(1),modifiers:[{stat:'reduction_physical',multiplier:1-c.pct},{stat:'reduction_energy',multiplier:1-c.pct}]});return finish(c,passive(c,'咆哮',[t,r]));}},
 attunement:{name:'元素亲和',kind:'passive',summary:'主题属性伤害提升，同属性承伤下降',build:c=>{const t=themeType(c.t);return passive(c,'元素亲和',[{op:'element_resist',element:t,multiplier:.5,targeting:self},buff(c,'p-attune','元素亲和',{duration:round(99),modifiers:[{stat:'damage_energy',multiplier:1+grow(c,.08,.02,.24)}]})]);}},
 nullshell:{name:'虚壳',kind:'passive',summary:'吸收一部分能量与精神伤害',build:c=>passive(c,'虚壳',[aura(c,'p-nullshell','虚壳',99,{reactions:[{kind:'absorb',fraction:grow(c,.12,.02,.3),channels:['energy','mental'],uses:3,reset:'round'}]})])},
};

/* ───────────── 独有主动 ───────────── */
export const ACTIVES:Record<string,Mechanic>={
 flurry:{name:'连环斩',kind:'active',summary:'三段物理连击并施加裂伤',build:c=>{const a=active(c,'连环斩',[damage(c,'physical',1.1,3,['物']),dot(c,'u-flurry-bleed','裂伤','无',.15,2)],{sp:1,category:'physical'});return finish(c,a);}},
 shockwave:{name:'震荡波',kind:'active',summary:'全体物+精双属性伤害并减速',build:c=>{const d=damage(c,'physical',.7,1,['物','精']);d.targeting=ALL_ENEMIES;const slow=status(c,'u-shock-slow',c.m.motif+'·震荡',{duration:round(2),modifiers:[{stat:'speed',multiplier:.85}]});slow.targeting=ALL_ENEMIES;slow.requiresHit='impact';return finish(c,active(c,'震荡波',[d,slow],{sp:1.2,cast:800,category:'physical'}));}},
 execute:{name:'处决',kind:'active',summary:'对低生命目标造成大幅额外伤害',build:c=>{const heavy=child(c,'u-execute:heavy',[damage(c,'physical',2,1)]),light=child(c,'u-execute:light',[damage(c,'physical',.8,1)]);return finish(c,active(c,'处决',[{op:'branch',when:[hpBelow(.35,'target')],then:heavy,otherwise:light}],{sp:1.2,category:'physical'}));}},
 shieldbreak:{name:'破盾击',kind:'active',summary:'先击碎护盾再造成伤害',build:c=>finish(c,active(c,'破盾击',[{op:'remove_shield',count:2},damage(c,'physical',1.1)],{sp:1,category:'physical'}))},
 split:{name:'分裂',kind:'active',summary:'分裂出两个衍生体',build:c=>finish(c,active(c,'分裂',[minion(c,'u-split',.22,2)],{mp:.8,target:'self',uses:2}))},
 stagger:{name:'迟滞',kind:'active',summary:'伤害并推后目标的行动',build:c=>finish(c,active(c,'迟滞',[damage(c,'energy',.6),{op:'atb',mode:'retreat',value:30,requiresHit:'impact'}],{mp:1}))},
 sealskill:{name:'封技',kind:'active',summary:'封锁目标一个技能两轮',build:c=>finish(c,active(c,'封技',[damage(c,'mental',.5,1,['精']),{op:'source',mode:'suppress',kinds:['skill'],selection:'first',count:1,duration:round(2),requiresHit:'impact'}],{mp:1}))},
 plunder:{name:'夺取',kind:'active',summary:'偷取目标一项增益',build:c=>finish(c,active(c,'夺取',[{op:'dispel',mode:'steal',polarity:'positive',count:1,recipient:'caster'},damage(c,'physical',.8)],{sp:.8,category:'physical'}))},
 mimicry:{name:'拟态',kind:'active',summary:'复制目标最近使用的技能',build:c=>finish(c,active(c,'拟态',[{op:'copy',mode:'skill',id:'*',selection:'used_latest',duration:round(2),activate:true}],{mp:1,uses:2}))},
 deathmark:{name:'死标',kind:'active',summary:'标记目标使其承受更多伤害',build:c=>{const m=status(c,'u-deathmark',c.m.motif+'·死标',{duration:round(3),control:'mark',modifiers:[{stat:'vulnerability',multiplier:1+grow(c,.12,.03,.3)}]});return finish(c,active(c,'死标',[m,damage(c,'mental',.5,1,['精'])],{mp:.8}));}},
 zone:{name:'领域残迹',kind:'active',summary:'布下两轮持续伤害的场地',build:c=>{const t=themeDot(c);const tick=child(c,'u-zone:tick',[{...damage(c,'energy',.25,1,[t]),hitChance:1}]);status(c,'u-zone-burn',c.m.motif+'·领域残迹',{duration:{clock:'field',value:0},tags:['monster:field'],tick:{clock:'round',interval:1,count:9,action:tick}});c.lib.fields['u-zone']={name:c.m.motif+'·领域残迹',group:'monster:zone',priority:0,stack:'strongest',targeting:ALL_ENEMIES,status:'u-zone-burn',duration:round(2),element:c.t.element};return finish(c,active(c,'领域残迹',[{op:'field',field:'u-zone'}],{mp:1.2,target:'self',cast:800}));}},
 detonate:{name:'自燃冲击',kind:'active',summary:'牺牲自身生命对全体造成火焰伤害',build:c=>{const d=damage(c,'energy',1.6,1,['火']);d.targeting=ALL_ENEMIES;return finish(c,active(c,'自燃冲击',[d],{hp:.1,cast:800,uses:2}));}},
 mend:{name:'群体修复',kind:'active',summary:'治疗全体同伴并驱散一项负面',build:c=>finish(c,active(c,'群体修复',[{op:'heal',resource:'hp',amount:pct('hp',.15,'target'),targeting:ALL_ALLIES},{op:'dispel',mode:'remove',polarity:'negative',count:1,targeting:ALL_ALLIES}],{mp:1,target:'ally',uses:3}))},
 taunt:{name:'挑衅',kind:'active',summary:'嘲讽全体敌人并获得护盾',build:c=>{const t=control(c,'u-taunt','挑衅','taunt',1);t.targeting=ALL_ENEMIES;const s=shield(c);s.targeting=self;return finish(c,active(c,'挑衅',[t,s],{sp:.8,target:'self',category:'physical'}));}},
 vanish:{name:'隐身',kind:'active',summary:'隐匿一轮并强化下一击（五阶起完全隐匿）',build:c=>finish(c,active(c,'隐身',[buff(c,'u-vanish','隐身',{duration:round(1),...(c.stage>=5?{control:'hidden' as const}:{}),modifiers:[...dmgMods(1.4),...(c.stage>=5?[]:[{stat:'evade' as const,flat:.35}])]})],{sp:.6,target:'self',uses:3}))},
 counterstance:{name:'反击架势',kind:'active',summary:'两轮内受击必反击',build:c=>{const d=damage({...c,power:c.power*.6},'physical');d.targeting=EVENT_SOURCE;const ct=child(c,'u-counter:hit',[d],'self');return finish(c,active(c,'反击架势',[buff(c,'u-counter','反击架势',{duration:round(2),reactions:[{kind:'counter',action:ct,uses:3,chance:1}]})],{sp:.8,target:'self',category:'physical'}));}},
 hex:{name:'衰咒',kind:'active',summary:'降低目标受疗与伤害',build:c=>finish(c,active(c,'衰咒',[status(c,'u-hex',c.m.motif+'·衰咒',{duration:round(3),modifiers:[{stat:'heal_received',multiplier:.5},...dmgMods(.85)]}),damage(c,'mental',.6,1,['暗'])],{mp:1}))},
 terror:{name:'惊惧',kind:'active',summary:'令两名敌人恐惧一轮',build:c=>{const f=control(c,'u-terror','惊惧','fear',1);f.targeting=RANDOM_ENEMY(2);return finish(c,active(c,'惊惧',[f,{...damage(c,'mental',.4,1,['精']),targeting:RANDOM_ENEMY(2)}],{mp:1,uses:3}));}},
 bewilder:{name:'迷乱',kind:'active',summary:'令目标混乱一轮',build:c=>finish(c,active(c,'迷乱',[control(c,'u-bewilder','迷乱','confusion',1),damage(c,'mental',.5,1,['精'])],{mp:1,uses:3}))},
 freeze:{name:'封冻',kind:'active',summary:'水属性伤害并冻结目标',build:c=>finish(c,active(c,'封冻',[damage(c,'energy',.8,1,['水']),{...control(c,'u-freeze','封冻','freeze',1),requiresHit:'impact'}],{mp:1.2,uses:3}))},
 pull:{name:'牵引',kind:'active',summary:'把目标拉入攻击节奏，提前自身行动',build:c=>finish(c,active(c,'牵引',[damage(c,'energy',.7,1,['物','无']),{op:'atb',mode:'push',value:25,targeting:self}],{mp:.8}))},
 slowfield:{name:'凝滞',kind:'active',summary:'全体减速两轮',build:c=>{const s=status(c,'u-slowfield',c.m.motif+'·凝滞',{duration:round(2),modifiers:[{stat:'speed',multiplier:.8}]});s.targeting=ALL_ENEMIES;return finish(c,active(c,'凝滞',[s,{...damage(c,'energy',.4),targeting:ALL_ENEMIES}],{mp:1.2,cast:800}));}},
 leech:{name:'汲取',kind:'active',summary:'暗属性伤害并吸取生命',build:c=>{const d=damage(c,'energy',.9,1,['暗']);d.drain={resource:'hp',fraction:.5,basis:'actual'};return finish(c,active(c,'汲取',[d],{mp:1}));}},
 charge:{name:'蓄力重击',kind:'active',summary:'长施法的高威力一击',build:c=>finish(c,active(c,'蓄力重击',[damage(c,'physical',2.2)],{sp:1.4,cast:2000,category:'physical'}))},
 firebomb:{name:'燃烧弹',kind:'active',summary:'全体火焰伤害并灼烧',build:c=>{const d=damage(c,'energy',.6,1,['火']);d.targeting=ALL_ENEMIES;const b=dot(c,'u-firebomb-burn','灼烧','火',.25,3);b.targeting=ALL_ENEMIES;b.requiresHit='impact';return finish(c,active(c,'燃烧弹',[d,b],{mp:1.2,cast:800}));}},
 cleanse:{name:'净化加速',kind:'active',summary:'驱散自身负面并提前行动',build:c=>finish(c,active(c,'净化加速',[{op:'dispel',mode:'remove',polarity:'negative',count:2,targeting:self},{op:'atb',mode:'push',value:35,targeting:self}],{mp:.6,target:'self',uses:3}))},
 lightlance:{name:'光矛',kind:'active',summary:'必中的光属性穿刺',build:c=>{const d=damage(c,'energy',1.2,1,['光']);d.hitRule='guaranteed';d.penetration=.3;return finish(c,active(c,'光矛',[d],{mp:1.2}));}},
 tidal:{name:'潮涌',kind:'active',summary:'全体水属性伤害并推后行动',build:c=>{const d=damage(c,'energy',.6,1,['水']);d.targeting=ALL_ENEMIES;return finish(c,active(c,'潮涌',[d,{op:'atb',mode:'retreat',value:15,targeting:ALL_ENEMIES,requiresHit:'impact'}],{mp:1.2,cast:800}));}},
 voidcut:{name:'虚空切割',kind:'active',summary:'无属性斩击，无视抗性',build:c=>finish(c,active(c,'虚空切割',[damage(c,'energy',1.1,1,['无'])],{mp:1,category:'physical'}))},
 sacrifice:{name:'献祭同伴',kind:'active',summary:'牺牲一名衍生体回复自身',build:c=>finish(c,active(c,'献祭同伴',[{op:'recall',ownerOnly:true},{op:'heal',resource:'hp',amount:pct('hp',.2),targeting:self}],{mp:.5,target:'self',uses:2}))},
};

/* ───────────── 权能：改变“自己”的规则（五阶起） ───────────── */
export const AUTHORITIES:Record<string,Mechanic>={
 immortal_shell:{name:'不朽躯壳',kind:'authority',summary:'单轮承伤上限并持续再生',build:c=>{const heal=child(c,'a-shell:tick',[{op:'heal',resource:'hp',amount:pct('hp',.03),targeting:self}],'self');return finish(c,passive(c,'不朽躯壳',[aura(c,'a-shell','不朽躯壳',99,{reactions:[{kind:'damage_cap',fraction:c.m.role==='Boss'?.3:.4,reset:'round'}],tick:{clock:'round',interval:1,count:99,action:heal}})]));}},
 twin:{name:'双生',kind:'authority',summary:'生命过半时分裂出一具分身',build:c=>{const a=passive(c,'双生');trigger(c,a,'a-twin','damage_received','self',[minion(c,'a-twin-body',.5,1)],{uses:1,conditions:[hpBelow(.5)]});return finish(c,a);}},
 plunderer:{name:'掠夺者',kind:'authority',summary:'每次命中偷取目标一项增益',build:c=>{const a=passive(c,'掠夺者');trigger(c,a,'a-plunderer','hit','self',[{op:'dispel',mode:'steal',polarity:'positive',count:1,recipient:'caster',targeting:EVENT_TARGET}],{uses:0,cooldownMs:3000});return finish(c,a);}},
 formless:{name:'无形',kind:'authority',summary:'每轮必然闪避一次攻击',build:c=>{const a=passive(c,'无形');trigger(c,a,'a-formless','round','self',[{op:'rule',rule:'guaranteed_evade',key:'*',uses:1,duration:round(1),targeting:self}],{uses:0,cooldownMs:0});return finish(c,a);}},
 sovereign:{name:'王者威压',kind:'authority',summary:'敌人技能费用提高',build:c=>{const e=status(c,'a-sovereign',c.m.motif+'·王者威压',{duration:round(4),dispellable:false,modifiers:[{stat:'cost_mp',multiplier:1.25},{stat:'cost_sp',multiplier:1.25}]});e.targeting=ALL_ENEMIES;return finish(c,passive(c,'王者威压',[e]));}},
 fortune:{name:'概率支配',kind:'authority',summary:'幸运规则与暴击提升',build:c=>passive(c,'概率支配',[{op:'rule',rule:'luck',key:'*',duration:permanent,targeting:self},aura(c,'a-fortune','概率支配',99,{modifiers:[{stat:'crit',flat:.15},{stat:'crit_multiplier',flat:.3}]})])},
 causality:{name:'因果护佑',kind:'authority',summary:'两次致命伤害免死，施法不可打断',build:c=>passive(c,'因果护佑',[{op:'rule',rule:'death_guard',key:'*',uses:2,amount:flat(1),duration:permanent,targeting:self},{op:'rule',rule:'uninterruptible',key:'*',duration:permanent,targeting:self}])},
 mirrorwall:{name:'返照壁',kind:'authority',summary:'反射大量伤害',build:c=>passive(c,'返照壁',[aura(c,'a-mirrorwall','返照壁',99,{reactions:[{kind:'reflect',fraction:.35,basis:'actual',uses:3,reset:'round'}]})])},
 transmute:{name:'资源转化',kind:'authority',summary:'支付费用的一部分转为生命',build:c=>{const a=passive(c,'资源转化');trigger(c,a,'a-transmute','after_cost','self',[{op:'heal',resource:'hp',amount:{...flat(0),expression:[{read:'event',key:'paid_mp'},{read:'event',key:'paid_sp'},{operator:'add'},{constant:.2},{operator:'mul'}],maximum:c.n.max.hp*.08},targeting:self}],{uses:0,cooldownMs:0});return finish(c,a);}},
 bloodrage:{name:'血怒',kind:'authority',summary:'每次受伤叠加伤害提升',build:c=>{const a=passive(c,'血怒');trigger(c,a,'a-bloodrage','damage_received','self',[buff(c,'a-bloodrage-stack','血怒',{duration:round(99),stack:'stack',maxStacks:8,scaleWithStacks:true,modifiers:dmgMods(1.06)})],{uses:0,cooldownMs:0});return finish(c,a);}},
 tempo:{name:'先攻主宰',kind:'authority',summary:'每轮额外推进自身行动',build:c=>{const a=passive(c,'先攻主宰');trigger(c,a,'a-tempo','round','self',[{op:'atb',mode:'push',value:40,targeting:self}],{uses:0,cooldownMs:0});return finish(c,a);}},
 rebirth:{name:'不灭再临',kind:'authority',summary:'一次致命伤后回复三成生命',build:c=>{const heal=child(c,'a-rebirth:heal',[{op:'heal',resource:'hp',amount:pct('hp',.3),targeting:self},{op:'dispel',mode:'remove',polarity:'negative',count:3,targeting:self}],'self');return finish(c,passive(c,'不灭再临',[{op:'rule',rule:'death_guard',key:'*',uses:1,amount:flat(1),duration:permanent,targeting:self,onTrigger:heal}]));}},
 contagion:{name:'蔓延',kind:'authority',summary:'造成伤害时有概率附加腐蚀',build:c=>{const a=passive(c,'蔓延');const d=dot(c,'a-contagion-dot','蔓延','暗',.3,3);d.targeting=EVENT_TARGET;trigger(c,a,'a-contagion','damage_dealt','self',[d],{uses:0,cooldownMs:0,chance:.5});return finish(c,a);}},
 broodlord:{name:'巢母',kind:'authority',summary:'开战召唤衍生体，衍生体倒下时回复自身',build:c=>{const a=passive(c,'巢母',[minion(c,'a-brood',.25,2)]);trigger(c,a,'a-broodlord','after_down','ally',[{op:'heal',resource:'hp',amount:pct('hp',.1),targeting:self}],{uses:4,cooldownMs:0});return finish(c,a);}},
 timeskew:{name:'时间偏差',kind:'authority',summary:'受击时有概率推后攻击者行动',build:c=>{const a=passive(c,'时间偏差');trigger(c,a,'a-timeskew','damage_received','self',[{op:'atb',mode:'retreat',value:20,targeting:EVENT_SOURCE}],{uses:0,cooldownMs:0,chance:.3});return finish(c,a);}},
 voidcloak:{name:'虚空外衣',kind:'authority',summary:'吸收能量与精神伤害',build:c=>passive(c,'虚空外衣',[aura(c,'a-voidcloak','虚空外衣',99,{reactions:[{kind:'absorb',fraction:.3,channels:['energy','mental'],uses:4,reset:'round'}]})])},
 warlord:{name:'军团号令',kind:'authority',summary:'全体同伴伤害与速度提升',build:c=>{const e=status(c,'a-warlord',c.m.motif+'·军团号令',{polarity:'positive',duration:round(99),dispellable:false,modifiers:[...dmgMods(1.15),{stat:'speed',multiplier:1.1}]});delete (e as {opposedAttribute?:string}).opposedAttribute;e.targeting=ALL_ALLIES;return finish(c,passive(c,'军团号令',[e]));}},
 phasewalk:{name:'相位游走',kind:'authority',summary:'受击后短暂不可被选中',build:c=>{const a=passive(c,'相位游走');trigger(c,a,'a-phasewalk','damage_received','self',[{op:'rule',rule:'untargetable',key:'*',duration:{clock:'battle_time',value:1500},targeting:self}],{uses:3,cooldownMs:6000});return finish(c,a);}},
};

/* ───────────── 新法则：改变“战场”的规则，对双方同时生效（六阶起） ───────────── */
function battlefield(c:Ctx,key:string,name:string,summary:string,extra:Parameters<typeof status>[3]):ActionSpec{
 status(c,key,c.m.motif+'·'+name,{polarity:'neutral',duration:{clock:'field',value:0},tags:['monster:law-field'],dispellable:false,priority:30,...extra});
 c.lib.fields[key]={name:c.m.motif+'·'+name,group:'monster:law',priority:10,stack:'strongest',targeting:ANY,status:key,duration:round(3),element:c.t.element};
 const declare=action([{op:'field',field:key}],'self');declare.name=c.m.motif+'·'+name+'·宣告';declare.category='law';declare.castMs=1000;declare.perBattleUses=1;declare.cost.mp.maxFraction=.5;declare.cost.sp.maxFraction=.5;declare.tags=['monster:law','ai:law'];
 declare.description='法则宣告：'+summary+'。对战场上双方所有单位生效（含施法者），3公共轮；最大MP和SP各50%，每战一次。';
 c.lib.actions['declare-'+key]=declare;const a=passive(c,name);a.grantedActions=['declare-'+key];a.description='登神来源·独有法则：'+summary+'。宣告后改写整个战场的规则，不区分敌我。';return finish(c,a);
}
export const LAWS:Record<string,Mechanic>={
 silence_law:{name:'静默律',kind:'law',summary:'全场法术费用提高五成',build:c=>battlefield(c,'l-silence','静默律','全场法力费用×1.5',{modifiers:[{stat:'cost_mp',multiplier:1.5}]})},
 bloodtax_law:{name:'血税律',kind:'law',summary:'全场每次支付费用都要付出生命',build:c=>{const pay=child(c,'l-bloodtax:pay',[{op:'resource',resource:'hp',mode:'subtract',amount:pct('hp',.03),targeting:self}],'self');return battlefield(c,'l-bloodtax','血税律','任何单位支付技能费用后再失去3%最大生命',{triggers:[{id:'l-bloodtax',event:'after_cost',scope:'self',action:pay,uses:0,cooldownMs:0}]});}},
 slowtime_law:{name:'缓时律',kind:'law',summary:'全场速度下降',build:c=>battlefield(c,'l-slowtime','缓时律','全场速度×0.75',{modifiers:[{stat:'speed',multiplier:.75}]})},
 truename_law:{name:'真名律',kind:'law',summary:'全场攻击难以落空',build:c=>battlefield(c,'l-truename','真名律','全场命中+50%、闪避归零',{modifiers:[{stat:'hit',flat:.5},{stat:'evade',flat:-1}]})},
 balance_law:{name:'均衡律',kind:'law',summary:'全场单轮承伤设上限',build:c=>battlefield(c,'l-balance','均衡律','任何单位每轮承受伤害不超过最大生命的30%',{reactions:[{kind:'damage_cap',fraction:.3,reset:'round'}]})},
 echo_law:{name:'回响律',kind:'law',summary:'全场受击都会反弹',build:c=>battlefield(c,'l-echo','回响律','任何单位受击反弹20%实际伤害',{reactions:[{kind:'reflect',fraction:.2,basis:'actual',uses:2,reset:'round'}]})},
 frostland_law:{name:'冻土律',kind:'law',summary:'全场减速且治疗减半',build:c=>battlefield(c,'l-frostland','冻土律','全场速度×0.85、受疗×0.5',{modifiers:[{stat:'speed',multiplier:.85},{stat:'heal_received',multiplier:.5}]})},
 furnace_law:{name:'熔炉律',kind:'law',summary:'全场伤害放大',build:c=>battlefield(c,'l-furnace','熔炉律','全场承受伤害×1.3',{modifiers:[{stat:'vulnerability',multiplier:1.3}]})},
 toll_law:{name:'通行律',kind:'law',summary:'全场每轮都被抽取法力',build:c=>{const toll=child(c,'l-toll:tick',[{op:'resource',resource:'mp',mode:'burn',amount:pct('mp',.06),targeting:self}],'self');return battlefield(c,'l-toll','通行律','任何单位每公共轮失去6%最大法力',{tick:{clock:'round',interval:1,count:9,action:toll}});}},
 element_law:{name:'元素律',kind:'law',summary:'全场对主题属性的抗性被改写为弱点',build:c=>{const t=themeType(c.t)==='无'?'暗':themeType(c.t);return battlefield(c,'l-element','元素律','全场'+t+'属性承伤×1.5（含施法者自身）',{modifiers:[{stat:'element',element:t,multiplier:1.5}]});}},
};

/* ───────────── 神国原型：改变胜负条件级规则（七阶 Boss，叠加在通用神国界碑之上） ───────────── */
export const KINGDOMS:Record<string,Mechanic>={
 furnace:{name:'熔炉神国',kind:'kingdom',summary:'界内敌人承伤放大，每轮灼烧',build:c=>{const tick=child(c,'k-furnace:tick',[{...damage(c,'energy',.2,1,['火']),hitChance:1}]);const e=status(c,'k-furnace',c.m.motif+'·熔炉',{duration:round(4),dispellable:false,modifiers:[{stat:'vulnerability',multiplier:1.25}],tick:{clock:'round',interval:1,count:4,action:tick}});e.targeting=ALL_ENEMIES;return finish(c,passive(c,'熔炉神国',[e]));}},
 glacier:{name:'冰封神国',kind:'kingdom',summary:'界内敌人速度大减，每轮有概率冻结',build:c=>{const f=control(c,'k-glacier-freeze','神国冻结','freeze',1);f.targeting=RANDOM_ENEMY(1);const tick=child(c,'k-glacier:tick',[f]);const e=status(c,'k-glacier',c.m.motif+'·冰封',{duration:round(4),dispellable:false,modifiers:[{stat:'speed',multiplier:.65}],tick:{clock:'round',interval:1,count:4,action:tick}});e.targeting=ALL_ENEMIES;return finish(c,passive(c,'冰封神国',[e]));}},
 elemental:{name:'属性神国',kind:'kingdom',summary:'界内敌人对主题属性的抗性被改写为特攻',build:c=>{const t=themeType(c.t)==='无'?'暗':themeType(c.t);const e=status(c,'k-elemental',c.m.motif+'·属性改写',{duration:round(4),dispellable:false,modifiers:[{stat:'element',element:t,multiplier:2}]});e.targeting=ALL_ENEMIES;return finish(c,passive(c,'属性神国',[e,buff(c,'k-elemental-self','属性主宰',{duration:round(4),modifiers:[{stat:'damage_energy',multiplier:1.2}]})]));}},
 tithe:{name:'献祭神国',kind:'kingdom',summary:'界内敌人每次施法都要献出生命',build:c=>{const pay=child(c,'k-tithe:pay',[{op:'resource',resource:'hp',mode:'subtract',amount:pct('hp',.06),targeting:self}],'self');const e=status(c,'k-tithe',c.m.motif+'·献祭',{duration:round(4),dispellable:false,triggers:[{id:'k-tithe',event:'after_cost',scope:'self',action:pay,uses:0,cooldownMs:0}]});e.targeting=ALL_ENEMIES;return finish(c,passive(c,'献祭神国',[e]));}},
 hush:{name:'静默神国',kind:'kingdom',summary:'界内敌人法术费用翻倍且施法变慢',build:c=>{const e=status(c,'k-hush',c.m.motif+'·静默',{duration:round(4),dispellable:false,modifiers:[{stat:'cost_mp',multiplier:2},{stat:'cast_speed',multiplier:.6}]});e.targeting=ALL_ENEMIES;return finish(c,passive(c,'静默神国',[e]));}},
 gravity:{name:'引力神国',kind:'kingdom',summary:'界内敌人每轮被拖回行动条',build:c=>{const drag=child(c,'k-gravity:tick',[{op:'atb',mode:'retreat',value:25,targeting:self}],'self');const e=status(c,'k-gravity',c.m.motif+'·引力',{duration:round(4),dispellable:false,modifiers:[{stat:'initiative',flat:-8}],tick:{clock:'round',interval:1,count:4,action:drag}});e.targeting=ALL_ENEMIES;return finish(c,passive(c,'引力神国',[e]));}},
 plague:{name:'疫病神国',kind:'kingdom',summary:'界内敌人持续腐蚀且无法被治疗',build:c=>{const tick=child(c,'k-plague:tick',[{...damage(c,'energy',.15,1,['暗']),hitChance:1}]);const e=status(c,'k-plague',c.m.motif+'·疫病',{duration:round(4),dispellable:false,modifiers:[{stat:'heal_received',multiplier:0}],tick:{clock:'round',interval:1,count:4,action:tick}});e.targeting=ALL_ENEMIES;return finish(c,passive(c,'疫病神国',[e]));}},
 judgment:{name:'审判神国',kind:'kingdom',summary:'界内敌人每次出手都会被裁决反噬',build:c=>{const d=damage({...c,power:c.power*.3},'true');d.targeting=EVENT_SOURCE;const verdict=child(c,'k-judgment:verdict',[d],'self');const e=status(c,'k-judgment',c.m.motif+'·审判',{duration:round(4),dispellable:false,triggers:[{id:'k-judgment',event:'action_end',scope:'self',action:verdict,uses:0,cooldownMs:0}]});e.targeting=ALL_ENEMIES;return finish(c,passive(c,'审判神国',[e]));}},
 mirror:{name:'镜像神国',kind:'kingdom',summary:'界内敌人造成的伤害有一部分返还',build:c=>{const e=status(c,'k-mirror',c.m.motif+'·镜像',{duration:round(4),dispellable:false,reactions:[{kind:'reflect',fraction:.3,basis:'actual',uses:0}]});e.targeting=ALL_ALLIES;return finish(c,passive(c,'镜像神国',[e]));}},
 dominion:{name:'王权神国',kind:'kingdom',summary:'界内敌人被压制而同伴被强化',build:c=>{const e=status(c,'k-dominion',c.m.motif+'·王权',{duration:round(4),dispellable:false,modifiers:[...dmgMods(.8),{stat:'evade',flat:-.1}]});e.targeting=ALL_ENEMIES;const b=status(c,'k-dominion-ally',c.m.motif+'·王权庇护',{polarity:'positive',duration:round(4),dispellable:false,modifiers:[...dmgMods(1.2),{stat:'hit',flat:.1}]});delete (b as {opposedAttribute?:string}).opposedAttribute;b.targeting=ALL_ALLIES;return finish(c,passive(c,'王权神国',[e,b]));}},
};

/* ───────────── 阶段转换：真正的特殊单位未登场前，只用红色蒙版 / 重影表现 ───────────── */
export function phaseShift(c:Ctx,style:'red'|'afterimage'):ActionSpec{
 const boss=style==='red';const a=passive(c,boss?'第二阶段·血色':'第二阶段·重影');
 const form=buff(c,'phase-2',boss?'血色形态':'重影形态',{duration:permanent,dispellable:false,priority:50,tags:['monster:phase','visual:'+style],modifiers:boss?[...dmgMods(1.25),{stat:'speed',multiplier:1.15},{stat:'check_spirit',flat:4}]:[{stat:'evade',flat:.15},...dmgMods(1.1)],...(boss?{}:{reactions:[{kind:'parry',fraction:.5,chance:.3,uses:2,reset:'round'} as ReactionSpec]})});
 const s=shield(c);s.targeting=self;
 trigger(c,a,'phase-shift','damage_received','self',[form,s,{op:'dispel',mode:'remove',polarity:'negative',count:2,targeting:self},{op:'atb',mode:'push',value:50,targeting:self}],{uses:1,cooldownMs:0,conditions:[hpBelow(.5)]});
 a.description=(boss?'生命降至50%时进入血色形态（立绘蒙红）：伤害×1.25、速度×1.15、获得护盾、驱散2项负面并立即推进行动。':'生命降至50%时进入重影形态：闪避+15%、伤害×1.1、每轮两次招架机会，并获得护盾。')+'每战一次，不可驱散。';
 return finish(c,a);
}
export const MECHANICS={passive:PASSIVES,active:ACTIVES,authority:AUTHORITIES,law:LAWS,kingdom:KINGDOMS} as const;
export const mechanicSummary=(kind:MechanicKind,id:string)=>MECHANICS[kind][id]?.summary??'';
export {elementKey};
