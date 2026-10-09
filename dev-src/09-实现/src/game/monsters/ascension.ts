import type {ActionSpec,ConditionSpec,EffectSpec,TriggerSpec} from '../../compiler/contract';
import type {Doctrine} from './catalog';
import {action,child,condition,damage,finish,flat,minion,pct,permanent,round,self,status,themeType,type Ctx} from './ir';
const TARGET={side:'event_source',selection:'all',life:'alive'} as const;
const VICTIM={side:'event_target',selection:'all',life:'any'} as const;
function named(c:Ctx,name:string,a:ActionSpec){a.name=name;a.description='登神来源：不使用普通技能品质。法则/权能遵守显式最大资源费用与每战次数；仲裁仍为等级→有效速度→种子随机。';return finish(c,a);}
export function elements(c:Ctx):ActionSpec{
 const a=action([{op:'modify',name:c.m.motif+'·要素适性',duration:permanent,modifiers:[{stat:'check_spirit',flat:2}]}],'self');a.activation='battle_start';a.description='要素适性只提高精神检定；对主题属性的耐性由该怪物的分层抗性表承担，不再叠加隐藏倍率。';
 return named(c,c.m.motif+'·'+c.t.element+'与形态要素',a);
}
export function authority(c:Ctx):ActionSpec{
 const e=status(c,'authority',c.m.motif+'·权能显现',{polarity:'positive',duration:round(3),modifiers:[{stat:'damage_physical',multiplier:1.20},{stat:'damage_energy',multiplier:1.20},{stat:'damage_mental',multiplier:1.20}]});e.targeting=self;
 const a=action([e,damage(c,c.t.element==='暗'?'mental':'energy',1,1,[themeType(c.t)])]);
 switch(c.t.laws[0]){
  case 'infection':a.effects.push(status(c,'authority-infection',c.m.motif+'·伤口闭锁',{duration:round(2),modifiers:[{stat:'heal_received',multiplier:.5}]}));break;
  case 'hunger':case 'tax':a.effects.push({op:'resource',mode:'burn',resource:c.t.laws[0]==='tax'?'mp':'sp',amount:pct(c.t.laws[0]==='tax'?'mp':'sp',.20,'target')});break;
  case 'equivalence':a.effects.push({op:'resource',mode:'exchange',resource:'sp',other:'mp',amount:pct('sp',.10),ratio:1,targeting:self});break;
  case 'reflection':{const r=status(c,'authority-reflect',c.m.motif+'·局部返照',{polarity:'positive',duration:round(2),reactions:[{kind:'reflect',fraction:.30,basis:'actual',uses:1}]});r.targeting=self;a.effects.push(r);break;}
  case 'inheritance':case 'growth':a.effects.push(minion(c,'authority-body',.25));break;
  case 'sacrifice':a.cost.hp.maxFraction=.10;a.effects.push({op:'shield',amount:pct('hp',.30),channels:['physical','energy','mental','true'],duration:round(2),targeting:self});break;
  case 'judgment':a.effects.push(status(c,'authority-verdict',c.m.motif+'·裁断',{duration:round(2),modifiers:[{stat:'vulnerability',multiplier:1.30}]}));break;
  case 'gravity':a.effects.push({op:'atb',mode:'retreat',value:25});break;
  case 'binding':a.effects.push(status(c,'authority-bind',c.m.motif+'·禁行',{control:'bind',duration:round(1)}));break;
  case 'observation':a.effects.push({op:'rule',rule:'guaranteed_hit',key:'*',uses:1,duration:round(2),targeting:self});break;
  case 'boundary':a.effects.push({op:'space',mode:'isolate',value:0,duration:round(1)});break;
  case 'clock':a.effects.push({op:'time',mode:'stop',duration:{clock:'battle_time',value:600},key:'authority-stop',restore:[]});break;
  case 'winter':a.effects.push(status(c,'authority-winter',c.m.motif+'·凝时',{control:'freeze',duration:round(1)}));break;
  case 'censorship':a.effects.push({op:'dispel',mode:'remove',polarity:'positive',count:2});break;
  case 'uncertainty':a.effects.push({op:'rule',rule:'guaranteed_evade',key:'*',uses:1,duration:round(2),targeting:self});break;
  case 'echo':{const d=damage(c,'energy',.25,1,['精']),echo=child(c,'authority-echo',[d]);a.effects.push({op:'time',mode:'delay',duration:round(1),action:echo,key:'authority-echo',restore:[]});break;}
 }
 a.name=c.m.motif+'·'+c.t.lawNames[0]+'之权能';a.cost.mp.maxFraction=.25;a.cost.sp.maxFraction=.25;a.perBattleUses=1;a.castMs=1000;a.tags=['monster:authority','ai:authority'];
 return named(c,a.name,a);
}
function trigger(c:Ctx,a:ActionSpec,id:string,event:TriggerSpec['event'],scope:TriggerSpec['scope'],effects:EffectSpec[],options:Partial<TriggerSpec>={}){
 const key=child(c,id,effects,'self');a.triggers??=[];a.triggers.push({id,event,scope,action:key,uses:3,cooldownMs:4000,...options});
}
function eventDamage(c:Ctx,fraction:number):EffectSpec{
 const d=damage(c,'true');d.amounts.true={...flat(0),eventFraction:fraction};d.targeting=TARGET;return d;
}
const ATTACKING:ConditionSpec={kind:'expression',expression:[{read:'event',key:'action_attacking'}],compare:'eq',value:1};
/** Each law is ONE ascension source, with a passive clause and a separately charged active clause. */
export function law(c:Ctx,doctrine:Doctrine,label:string):ActionSpec{
 const a=action([],'self');a.activation='battle_start';a.name=c.m.motif+'·'+label;
 const active=action([]);active.name=a.name+'·宣告';active.category='law';active.targeting={side:'enemy',selection:'all',life:'alive'};active.tags=['monster:law','ai:law'];active.cost.mp.maxFraction=.5;active.cost.sp.maxFraction=.5;active.perBattleUses=1;active.castMs=1100;
 active.description='最大MP和SP各50%，每战1次；当前战场全体敌人、公共轮期限；宣告冲击为各目标最大HP的25%，不是普通技能威力。';
 const mark=status(c,'law-mark',a.name+'·法则前兆',{tags:['monster:primer',c.m.id+':law-mark'],duration:round(3),modifiers:[{stat:'vulnerability',multiplier:1.20}]});
 active.effects.push(mark);
 const selfRule=(rule:'immune_concept'|'guaranteed_hit'|'guaranteed_evade'|'death_guard',key='*',uses=1):EffectSpec=>({op:'rule',rule,key,uses,duration:permanent,targeting:self,...(rule==='death_guard'?{amount:flat(1)}:{})});
 switch(doctrine){
  case 'infection':
   trigger(c,a,'sick-heal','before_heal','enemy',[{op:'alter_event',mode:'heal_to_damage'}],{uses:2,conditions:[condition('event_target','tag',c.m.id+':law-mark'),condition(undefined,'event_resource','hp')]});
   active.effects.push({op:'rule',rule:'no_heal',key:'*',duration:round(1)});break;
  case 'hunger':
   trigger(c,a,'hungry','damage_dealt','self',[{op:'heal',resource:'hp',amount:{...flat(0),eventFraction:.20},targeting:self}],{uses:4});
   active.effects.push({op:'resource',mode:'burn',resource:'mp',amount:pct('mp',.25,'target')},{op:'resource',mode:'burn',resource:'sp',amount:pct('sp',.25,'target')});break;
  case 'equivalence':
   trigger(c,a,'rebate','after_cost','self',[{op:'heal',resource:'hp',amount:{...flat(0),expression:[{read:'event',key:'paid_mp'},{read:'event',key:'paid_sp'},{operator:'add'},{constant:.15},{operator:'mul'}],maximum:c.n.max.hp*.08},targeting:self}],{uses:4});
   active.effects.push({op:'heal',resource:'hp',amount:pct('hp',.20),targeting:self},{op:'resource',mode:'subtract',resource:'sp',amount:pct('sp',.20,'target')});break;
  case 'reflection':
   trigger(c,a,'return-whole','action_resolved','self',[{op:'replay',originalStats:true}],{uses:1,conditions:[ATTACKING]});
   active.effects.push({op:'shield',amount:pct('hp',.20),channels:['physical','energy','mental','true'],duration:round(2),targeting:self});break;
  case 'inheritance':{
   const rebirth=child(c,'return-life',[{op:'revive',amount:pct('hp',.20,'target'),targeting:VICTIM}],'self');
   trigger(c,a,'ancestor','after_down','ally',[{op:'time',mode:'delay',duration:round(1),action:rebirth,key:'ancestor-return',restore:[],targeting:VICTIM}],{uses:1});
   active.effects.push(minion(c,'ancestor',.25));break;
  }
  case 'sacrifice':
   a.effects.push(selfRule('death_guard'));
   active.effects.push({op:'heal',resource:'hp',amount:pct('hp',.25),targeting:self});break;
  case 'tax':
   trigger(c,a,'tithe','after_cost','enemy',[{op:'resource',mode:'subtract',resource:'sp',amount:{...flat(0),expression:[{read:'event',key:'paid_mp'},{constant:.20},{operator:'mul'}]},targeting:TARGET}],{uses:4});
   active.effects.push({op:'resource',mode:'burn',resource:'mp',amount:pct('mp',.28,'target')});break;
  case 'judgment':
   trigger(c,a,'retribution','damage_received','self',[eventDamage(c,.20)],{uses:3});
   active.effects.push({op:'rule',rule:'no_revive',key:'*',duration:round(2)});break;
  case 'gravity':
   trigger(c,a,'gravity-pulse','round','enemy',[{op:'atb',mode:'retreat',value:10,targeting:TARGET}],{uses:4});
   active.effects.push({op:'space',mode:'move',value:2},{op:'atb',mode:'retreat',value:25});break;
  case 'binding':
   trigger(c,a,'halt-movement','before_action','enemy',[{op:'alter_event',mode:'cancel_action'}],{uses:1,conditions:[condition(undefined,'category','movement')]});
   active.effects.push(status(c,'bound',a.name+'·禁行',{control:'bind',duration:round(2),tags:['monster:control','bind']}));break;
  case 'observation':
   a.effects.push(selfRule('guaranteed_hit'));
   active.effects.push(status(c,'observed',a.name+'·显形',{control:'mark',duration:round(2),modifiers:[{stat:'evade',flat:-.28}]}));break;
  case 'boundary':
   a.effects.push(selfRule('immune_concept','space',0));
   active.effects.push({op:'space',mode:'isolate',value:0,duration:round(1)});break;
  case 'clock':{
   const d=damage(c,'true');d.amounts.true={...flat(0),expression:[{read:'variable',key:'recorded-hit'},{constant:.20},{operator:'mul'}]};const echo=child(c,'echo-hit',[d]);
   trigger(c,a,'deferred-hit','damage_received','self',[{op:'variable',mode:'set',key:'recorded-hit',value:[{read:'event',key:'actual'}]},{op:'time',mode:'delay',duration:round(1),action:echo,key:'deferred-hit',restore:[],targeting:TARGET}],{uses:2});
   active.effects.push({op:'time',mode:'stop',duration:{clock:'battle_time',value:1000},key:'time-stop',restore:[]});break;
  }
  case 'winter':
   trigger(c,a,'cold-heal','before_heal','enemy',[{op:'alter_event',mode:'scale',value:[{constant:.5}]}],{uses:3,conditions:[condition(undefined,'event_resource','hp')]});
   active.effects.push(status(c,'winter',a.name+'·冻结',{control:'freeze',duration:round(1)}));break;
  case 'growth':
   trigger(c,a,'growth','damage_dealt','self',[{op:'heal',resource:'hp',amount:{...flat(0),eventFraction:.15},targeting:self}],{uses:4});
   active.effects.push(minion(c,'shoots',.18,2));break;
  case 'censorship':
   trigger(c,a,'proofread','before_status','self',[{op:'alter_event',mode:'cancel_effect'}],{uses:2,conditions:[{kind:'expression',expression:[{read:'event',key:'status_negative'}],compare:'eq',value:1}]});
   active.effects.push({op:'source',mode:'suppress',kinds:['skill'],selection:'first',count:1,duration:round(2)});break;
  case 'uncertainty':{
   a.effects.push(selfRule('guaranteed_evade'));
   const first=child(c,'possibility-a',[{op:'rule',rule:'no_heal',key:'*',duration:round(1)}]),second=child(c,'possibility-b',[{op:'dispel',mode:'remove',polarity:'positive',count:2}]);
   active.effects.push({op:'choose',actions:[first,second],count:1,replace:false});break;
  }
  case 'echo':
   trigger(c,a,'echo-record','action_resolved','self',[{op:'replay',originalStats:true}],{uses:1,conditions:[ATTACKING]});
   active.effects.push({op:'copy',mode:'skill',id:'latest',selection:'used_latest',activate:true,originalStats:true,duration:round(1)});break;
 }
 // Declarative, bounded law impact; it is not ordinary-skill power and has no quality label.
 const impact=damage(c,'true');impact.amounts.true=pct('hp',.25,'target');active.effects.push(impact);
 c.lib.actions['declaration']=active;a.grantedActions=['declaration'];return named(c,a.name!,a);
}
export function divinity(c:Ctx):ActionSpec{
 const immunity=c.t.element==='冰'?'freeze':c.t.element==='火'?'fear':c.t.element==='暗'?'charm':'confusion';
 const a=action([{op:'rule',rule:'immune_status',key:immunity,duration:permanent},{op:'rule',rule:'death_guard',key:'*',uses:1,amount:flat(1),duration:permanent}],'self');a.activation='battle_start';a.name=c.m.motif+'·神位';
 trigger(c,a,'divine-circulation','round','self',[{op:'heal',resource:'mp',amount:pct('mp',.04),targeting:self},{op:'heal',resource:'sp',amount:pct('sp',.04),targeting:self}],{uses:5});
 a.description=`神位仅免疫${immunity}这一控制概念；每战一次留1HP，前5公共轮各恢复最大MP/SP的4%。不是全状态免疫；不改五维、不免仲裁。`;return finish(c,a);
}
/** Only explicitly peak seventh-tier bosses receive this source. The breakable anchor belongs to THIS caster. */
export function kingdom(c:Ctx):ActionSpec{
 const a=action([],'self');a.activation='battle_start';a.name=c.t.realm+'·'+c.m.motif;
 const anchorAttack=child(c,'anchor-idle',[{op:'atb',mode:'set',value:0}],'self');
 c.lib.summons.anchor={name:c.m.motif+'·神国界碑',level:'caster',inheritance:.25,resources:{hp:1,mp:0,sp:0},attributes:{力量:0,敏捷:0,体质:0,智力:0,精神:0},actions:[anchorAttack],duration:round(4),ownerDeath:'despawn',limit:1,rewardEligible:false,tags:['monster:realm-anchor']};
 const reversal=['infection','winter','reflection','echo'].includes(c.t.laws[0]),censor=['censorship','observation','boundary'].includes(c.t.laws[0]);
 let edict:string,edictEvent:TriggerSpec['event'],edictConditions:ConditionSpec[];
 if(reversal){edict=child(c,'realm-edict',[{op:'alter_event',mode:'heal_to_damage'}],'self');edictEvent='before_heal';edictConditions=[condition(undefined,'event_resource','hp')];}
 else if(censor){edict=child(c,'realm-edict',[{op:'alter_event',mode:'cancel_effect'}],'self');edictEvent='before_status';edictConditions=[{kind:'expression',expression:[{read:'event',key:'status_negative'}],compare:'eq',value:0}];}
 else{
  const paid=child(c,'realm-tax',[{op:'resource',resource:'mp',mode:'subtract',amount:pct('mp',.05),targeting:self}],'self'),denied=child(c,'realm-denied',[{op:'alter_event',mode:'cancel_action'}],'self');
  edict=child(c,'realm-edict',[{op:'branch',when:[condition('caster','resource_ratio','mp',.05)],then:paid,otherwise:denied}],'self');edictEvent='before_action';edictConditions=[condition(undefined,'category','command',1,'ne'),condition(undefined,'category','item',1,'ne')];
 }
 status(c,'realm-burden',a.name+'·界内负担',{duration:{clock:'field',value:0},tags:['monster:realm','monster:primer'],dispellable:true,priority:40,modifiers:[{stat:'speed',multiplier:.80},{stat:'heal_received',multiplier:.75}],triggers:[{id:'sovereign-edict',event:edictEvent,scope:'self',action:edict,uses:0,priority:40,conditions:edictConditions}]});
 c.lib.fields.realm={name:a.name,group:'monster:divine-boundary',priority:0,stack:'strongest',targeting:{side:'enemy',selection:'all',life:'alive',range:3},status:'realm-burden',duration:round(4),element:c.t.element};
 const open=action([{op:'summon',template:'anchor',count:1,mode:'summon'},{op:'field',field:'realm',conditions:[{kind:'expression',expression:[{read:'member_count',key:'owned',tags:['monster:realm-anchor'],life:'alive'}],compare:'gt',value:0}]}],'self');open.name=a.name+'·展开';open.category='divine-domain';open.castMs=1500;open.perBattleUses=1;open.tags=['monster:kingdom','ai:kingdom'];open.cost.mp.maxFraction=.10;open.cost.sp.maxFraction=.10;
 open.description='明确巅峰模板；神国需三法则和神位。最大MP/SP各10%，每战一次，4公共轮、抽象距离3以内。'+(reversal?'界内HP恢复反转为伤害。':censor?'界内新增非负面状态会被裁除；既有状态不凭空删除。':'除系统指令与道具外，界内行动另缴最大MP的5%，不足则中断。')+'规则仍走等级、速度、随机仲裁。击碎本体所属界碑即崩解；他者界碑不能续命。';
 c.lib.actions.open=open;a.grantedActions=['open'];
 const empty:ConditionSpec={kind:'expression',expression:[{read:'member_count',key:'owned',tags:['monster:realm-anchor'],life:'alive'}],compare:'eq',value:0};
 // Closing a bound field uses its owner-namespaced definition. Repeating an empty close is harmless.
 trigger(c,a,'anchor-broken','after_down','any',[{op:'field',field:'realm',remove:true}],{uses:0,cooldownMs:0,conditions:[empty]});
 trigger(c,a,'anchor-expired','round','self',[{op:'field',field:'realm',remove:true}],{uses:0,conditions:[empty]});
 return named(c,a.name,a);
}
