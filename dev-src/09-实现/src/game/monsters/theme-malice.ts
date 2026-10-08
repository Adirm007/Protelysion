/** 主题专属恶意机制 T01–T48（0.32.0 / 0.33.0）：每个主题一条，只给 Boss（t3 起完全体）与精英（t5 起雏形）。
 *  不占家族配额，但 seals 计入无解墙检查。全部在 booksea-effects/2 契约内表达；文案只写“它做了什么”。
 *  与计划稿不一致、按引擎原语落地的地方见 docs/mcp-theme-malice-impl-0.32.md / 0.33.md。 */
import {ROUND_MS,type ActionSpec,type ConditionSpec,type DurationSpec,type EffectSpec,type TargetSpec} from '../../compiler/contract';
import type {ThemeId} from './catalog';
import {child,condition,damage,finish,flat,minion,pct,permanent,round,self,type Ctx} from './ir';
import {ALL_ENEMIES,RANDOM_ENEMY,EVENT_SOURCE,EVENT_TARGET,ENEMY_HIGHEST_HP,active,aura,buff,dmgMods,enemyRule,hpBelow,isCrit,isSkill,lossOfControl,passive,scale,selfRule,sourceHas,status,trigger,typeless,type CounterTag} from './malice';

export type ExclusiveForm='seed'|'full';
export type ThemeExclusive={theme:ThemeId;name:string;summary:Record<ExclusiveForm,string>;seals:CounterTag[];passive:boolean;build:(c:Ctx,form:ExclusiveForm)=>ActionSpec};
const RUN={clock:'exploration_time',value:1e9} as const;// “本次迷宫内”：探索时钟，迷宫结束由 clearTemporary 整体清空
const RM=ROUND_MS;
const ENEMY_LOWEST_HP={side:'enemy',selection:'lowest_resource',resource:'hp',count:1,life:'alive'} as const;
const ANY_ALL={side:'any',selection:'all',life:'alive'} as const;
const f=<T>(form:ExclusiveForm,seed:T,full:T):T=>form==='full'?full:seed;
const targetHas=(key:string):ConditionSpec=>condition('event_target','status',key,1,'gte');
const casterHas=(key:string,n=1):ConditionSpec=>condition('caster','status',key,n,'gte');
function mark(c:Ctx,tag:string,name:string,extra:Parameters<typeof status>[3]={}):EffectSpec{return status(c,'x-'+tag,name,extra);}
const setName=(c:Ctx,a:ActionSpec,desc:string)=>{a.tags=[...(a.tags??[]),'monster:exclusive'];a.description=desc;return finish(c,a);};
function X(theme:ThemeId,name:string,summary:Record<ExclusiveForm,string>,seals:CounterTag[],passive:boolean,build:(c:Ctx,form:ExclusiveForm)=>ActionSpec):ThemeExclusive{return {theme,name,summary,seals,passive,build};}

export const THEME_EXCLUSIVE:Record<string,ThemeExclusive>={
 T01:X('T01','感染潜伏期',{seed:'命中叠加潜伏；对潜伏者施疗会让他失控1轮',full:'命中叠加潜伏；对潜伏者施疗会让他失控2轮，并把潜伏传给施疗者'},['control'],true,(c,form)=>{
  const a=passive(c,'感染潜伏期');const latent=mark(c,'latent','潜伏',{duration:round(6),dispellable:true});
  trigger(c,a,'x-latent','hit','self',[{...latent,targeting:EVENT_TARGET}]);
  const burst:EffectSpec[]=[{...lossOfControl(c,f(form,1,2)),targeting:EVENT_TARGET},{op:'dispel',mode:'remove',polarity:'negative',status:'x-latent',count:1,targeting:EVENT_TARGET}];
  if(form==='full')burst.push({...mark(c,'latent','潜伏'),targeting:EVENT_SOURCE});
  trigger(c,a,'x-latent-burst','before_heal','enemy',burst,{conditions:[targetHas('x-latent')]});
  return setName(c,a,'它的命中会在目标身上留下潜伏；潜伏者一旦接受治疗就会发作、失控。');}),
 T02:X('T02','倒悬丹理',{seed:'开战互换全体敌人的生命与法力当前值',full:'开战互换全体敌人的生命与法力当前值，之后每4轮再换一次'},[],true,(c,form)=>{
  const swap:EffectSpec={op:'resource',resource:'hp',mode:'exchange',other:'mp',amount:flat(0),lethal:false,targeting:ALL_ENEMIES};
  const a=passive(c,'倒悬丹理',[swap]);if(form==='full')trigger(c,a,'x-invert-again','round','self',[{...swap}],{cooldownMs:4*RM});
  return setName(c,a,'它把敌人的生命与法力上下倒悬。');}),
 T03:X('T03','万面替身',{seed:'致命伤不死一次，那一击的伤害完整转给随机一名敌人',full:'致命伤不死两次，那一击的伤害完整转给随机一名敌人'},['undying'],true,(c,form)=>{
  const shift=typeless(c,{...flat(0),expression:[{read:'event',key:'raw'}]},{guaranteed:true});shift.targeting=RANDOM_ENEMY(1);const pass=child(c,'x-mask:pass',[shift]);
  const a=passive(c,'万面替身',[selfRule('death_guard','*',permanent,{uses:f(form,1,2),amount:pct('hp',.3),onTrigger:pass})]);
  return setName(c,a,'它替身受死，原本落在它身上的致命一击会原样转到别人头上。');}),
 T04:X('T04','空冠加冕',{seed:'开战给攻击最高的敌人戴上王冠：伤害×1.5，但他每次出手队伍其他人各失去15%最大生命',full:'开战给攻击最高的敌人戴上王冠：伤害×1.5，他每次出手队伍其他人各失去25%最大生命；它对戴冠者伤害×2；每5轮把王冠转给下一个人'},['dispel'],true,(c,form)=>{
  const HIGHEST_ATTACK={side:'enemy',selection:'highest_attack',count:1,life:'alive'} as const;
  const crown=mark(c,'crown','空冠',{duration:permanent,dispellable:false,modifiers:[...dmgMods(1.5),...(form==='full'?[{stat:'vulnerability' as const,multiplier:2}]:[])]});
  const a=passive(c,'空冠加冕',[{...crown,targeting:HIGHEST_ATTACK}]);
  const tax=typeless(c,pct('hp',f(form,.15,.25),'target'),{guaranteed:true,bypass:['shield']});tax.targeting={...ALL_ENEMIES,excludeTags:['x-crown']};
  trigger(c,a,'x-crown-tax','action_end','enemy',[tax],{conditions:[sourceHas('x-crown')]});
  if(form==='full')trigger(c,a,'x-crown-pass','round','self',[{op:'dispel',mode:'remove',polarity:'negative',status:'x-crown',count:1,includeUndispellable:true,targeting:ALL_ENEMIES},{...mark(c,'crown','空冠'),targeting:{...HIGHEST_ATTACK,excludeTags:['x-crown']}}],{conditions:[{kind:'expression',expression:[{read:'round'},{constant:5},{operator:'mod'}],value:0,compare:'eq'}]});
  return setName(c,a,'它给攻击最高的敌人戴上摘不掉的王冠：戴冠者更强，但他每出手一次，队友都要付出生命。');}),
 T05:X('T05','零式引力',{seed:'每2轮把行动条最高的敌人拉回0',full:'每轮把行动条最高的敌人拉回0'},[],true,(c,form)=>{
  const a=passive(c,'零式引力');trigger(c,a,'x-gravity','round','self',[{op:'atb',mode:'set',value:0,targeting:{side:'enemy',selection:'highest_atb',count:1,life:'alive'}}],form==='seed'?{cooldownMs:2*RM}:{});
  return setName(c,a,'它的引力把跑得最快的人拽回起点。');}),
 T06:X('T06','空轿迎亲',{seed:'标记一人，4轮后被空轿替代：本体隔离，轿子（本体25%生命）碎了才回来',full:'标记一人，3轮后被空轿替代：本体隔离，轿子（本体40%生命）碎了才回来'},[],true,(c,form)=>{
  const a=passive(c,'空轿迎亲');const sedan=minion(c,'x-sedan',f(form,.25,.4),1);c.lib.summons['x-sedan']!.name=c.m.motif+'·空轿';c.lib.summons['x-sedan']!.duration=round(30);c.lib.summons['x-sedan']!.tags=['monster:minion','monster:sedan'];
  const carry=child(c,'x-sedan:carry',[{op:'space',mode:'isolate',value:0,duration:round(30)},{...sedan,targeting:self}]);
  const vow=mark(c,'sedan-vow','空轿之约',{duration:round(f(form,4,3)),dispellable:true,tags:['monster:status','monster:malice','monster:timer'],onExpire:carry});
  trigger(c,a,'x-sedan-mark','round','self',[{...vow,targeting:{...RANDOM_ENEMY(1),excludeTags:['x-sedan-vow']}}],{uses:2,cooldownMs:6*RM});
  trigger(c,a,'x-sedan-break','after_down','ally',[{op:'space',mode:'release',value:0,targeting:{...ALL_ENEMIES,life:'any'}}],{conditions:[condition('event_target','tag','monster:sedan',1,'gte')]});
  return setName(c,a,'空轿先下聘再迎亲：被下聘的人几轮后被请走，轿子碎裂前不能行动也不能被选中。');}),
 T07:X('T07','无归铸剑',{seed:'偷取敌人最近使用的技能并封印原版（本场，每战1把）',full:'偷取敌人最近使用的技能并封印原版（本次迷宫内，每战2把）'},['skill'],false,(c,form)=>{
  const dur:DurationSpec=form==='full'?RUN:permanent;
  const a=active(c,'无归铸剑',[{op:'copy',mode:'skill',id:'*',selection:'used_latest',duration:dur},{op:'uses',mode:'seal',skill:'*',selection:'used_latest',value:1,duration:dur}],{sp:2,cast:800,uses:f(form,1,2),tags:['ai:mimic']});
  return setName(c,a,'它夺走敌人最近用过的一招据为己有，原主人再也用不出来。');}),
 T08:X('T08','无名观测',{seed:'每轮换一人被注视：暴击率归零',full:'每轮换一人被注视：暴击率归零、承受的暴击伤害×2'},[],true,(c,form)=>{
  const a=passive(c,'无名观测');const eye=mark(c,'watched','被注视',{duration:round(1),modifiers:[{stat:'crit',flat:-1},...(form==='full'?[{stat:'crit_taken' as const,multiplier:2}]:[])]});
  trigger(c,a,'x-watch','round','self',[{...eye,targeting:RANDOM_ENEMY(1)}]);return setName(c,a,'它的目光每轮落在一个人身上，被注视者打不出暴击，却更怕暴击。');}),
 T09:X('T09','零点管理',{seed:'第5/10/15…轮宵禁：敌人1轮内只能用指令，它追加1次行动',full:'第5/10/15…轮宵禁：敌人1轮内只能用指令，它追加2次行动'},['skill'],true,(c,form)=>{
  const a=passive(c,'零点管理');trigger(c,a,'x-curfew','round','self',[enemyRule('seal_category','skill',round(1)),enemyRule('seal_category','spell',round(1)),{op:'atb',mode:'extra',value:f(form,1,2),targeting:self}],{conditions:[{kind:'expression',expression:[{read:'round'},{constant:5},{operator:'mod'}],value:0,compare:'eq'}]});
  return setName(c,a,'每到第五轮零点宵禁：敌人一轮内只剩指令可用，而它加班。');}),
 T10:X('T10','零房拓扑',{seed:'每2轮交换两名随机敌人的位置与全部状态',full:'每轮交换两名随机敌人的位置与全部状态'},['buff'],true,(c,form)=>{
  const a=passive(c,'零房拓扑');trigger(c,a,'x-topology','round','self',[{op:'space',mode:'swap_pair',value:0,targeting:RANDOM_ENEMY(2)},{op:'status_transform',mode:'swap_pair',polarity:'any',includeUndispellable:true,targeting:RANDOM_ENEMY(2)}],form==='seed'?{cooldownMs:2*RM}:{});
  return setName(c,a,'房间被折叠，两名敌人连人带状态换了个位置。');}),
 T11:X('T11','停钟工程',{seed:'时停1轮，期间封印全体敌人最近使用的技能1轮',full:'时停1轮，期间封印全体敌人最近使用的技能2轮'},['skill'],false,(c,form)=>{
  const a=active(c,'停钟工程',[{op:'time',mode:'stop',key:'x-clockstop',duration:round(1),restore:[],targeting:ALL_ENEMIES},{op:'uses',mode:'seal',skill:'*',selection:'used_latest',value:1,duration:round(f(form,1,2)),targeting:ALL_ENEMIES}],{mp:2,cast:900,uses:2,targeting:ALL_ENEMIES,tags:['ai:control']});
  return setName(c,a,'钟停了。它不攻击，只把敌人最近用过的技能一一封上。');}),
 T12:X('T12','永冬圣谕',{seed:'敌方每个增益上限2轮；它自己每个负面上限1轮',full:'敌方每个增益上限1轮；它自己每个负面上限1轮'},['buff'],true,(c,form)=>{
  const a=passive(c,'永冬圣谕',[enemyRule('buff_cap',f(form,'2','1')),selfRule('debuff_cap','1')]);
  return setName(c,a,'圣谕之下，敌人的增益和它自己的负面都活不长。');}),
 T13:X('T13','永生花床',{seed:'命中播种；4层时目标被扎根2轮：每轮行动条−50、受到的治疗一半改为治疗它',full:'命中播种；3层时目标被扎根2轮：每轮行动条−50、受到的治疗全部改为治疗它'},['no_heal'],true,(c,form)=>{
  const a=passive(c,'永生花床');const seed=mark(c,'spore','播种',{duration:round(6),stack:'stack',maxStacks:f(form,4,3),scaleWithStacks:false});
  const rooted=mark(c,'rooted','扎根',{duration:round(2),tags:['monster:status','monster:malice','monster:timer']});
  trigger(c,a,'x-sow','hit','self',[{...seed,targeting:EVENT_TARGET}]);
  trigger(c,a,'x-root','hit','self',[{...rooted,targeting:EVENT_TARGET},{op:'dispel',mode:'remove',polarity:'negative',status:'x-spore',count:1,stacks:9,targeting:EVENT_TARGET}],{conditions:[condition('event_target','status','x-spore',f(form,4,3),'gte')]});
  trigger(c,a,'x-root-hold','round','self',[{op:'atb',mode:'retreat',value:50,targeting:{...ALL_ENEMIES,tags:['x-rooted']}}]);
  trigger(c,a,'x-root-feed','before_heal','enemy',form==='full'?[{op:'alter_event',mode:'redirect',recipient:'caster'}]:[{op:'alter_event',mode:'scale',value:[{constant:.5}]},{op:'heal',resource:'hp',amount:{...flat(0),eventFraction:.5},targeting:self}],{conditions:[targetHas('x-rooted')]});
  return setName(c,a,'它每次命中都在目标身上播种；种子够多就会扎根，扎根者动弹不得，治疗也流向它。');}),
 T14:X('T14','溺冠潮誓',{seed:'水位每轮+1：≥4施法变慢，≥6每轮溺水15%最大生命，≥7倒下；对它暴击水位−2',full:'水位每轮+1：≥3施法变慢，≥5每轮溺水20%最大生命（七阶30%），≥7倒下；对它暴击水位−2'},['timer'],true,(c,form)=>{
  const a=passive(c,'溺冠潮誓');const tide=mark(c,'tide','水位',{duration:permanent,dispellable:false,stack:'stack',maxStacks:7,scaleWithStacks:false});
  const slow=mark(c,'tide-slow','潮涌迟缓',{duration:round(1),modifiers:[{stat:'cast_speed',multiplier:.5}]});
  const drown=typeless(c,pct('hp',f(form,.15,scale(c,.2,.3)),'target'),{guaranteed:true,bypass:['shield']});drown.targeting=ALL_ENEMIES;drown.conditions=[condition('target','status','x-tide',f(form,6,5),'gte')];
  const sink=typeless(c,pct('hp',1,'target'),{guaranteed:true,execute:true,bypass:['shield']});sink.targeting=ALL_ENEMIES;sink.conditions=[condition('target','status','x-tide',7,'gte')];
  trigger(c,a,'x-tide','round','self',[{...tide,targeting:ALL_ENEMIES},{...slow,targeting:ALL_ENEMIES,conditions:[condition('target','status','x-tide',f(form,4,3),'gte')]},drown,sink]);
  trigger(c,a,'x-tide-ebb','damage_received','self',[{op:'dispel',mode:'remove',polarity:'negative',status:'x-tide',count:1,stacks:2,targeting:EVENT_SOURCE}],{conditions:[isCrit]});
  return setName(c,a,'潮水每轮上涨：先是施法迟缓，然后溺水，最后没顶。');}),
 T15:X('T15','无字著述',{seed:'每2轮把一名敌人一个用过的技能改成空白页：下次使用时无效且作废本次行动',full:'每轮把一名敌人一个用过的技能改成空白页：下次使用时无效且作废本次行动'},['skill'],true,(c,form)=>{
  const a=passive(c,'无字著述');trigger(c,a,'x-blank','round','self',[{op:'rule',rule:'blank_page',key:'*',selection:'used_random',duration:round(3),uses:1,targeting:RANDOM_ENEMY(1)}],form==='seed'?{cooldownMs:2*RM}:{});
  return setName(c,a,'它把敌人的技能页涂成空白：翻到那一页时什么都不会发生，这一回合就此作废。');}),
 T16:X('T16','终章留白',{seed:'每当生命低于30%就蓄力1轮（不行动）；这一轮没被打死就回复70%生命并清除自身负面',full:'每当生命低于30%就蓄力1轮（不行动）；这一轮没被打死就回满生命并清除自身负面'},['burst'],true,(c,form)=>{
  const a=passive(c,'终章留白');const wake=child(c,'x-blank:wake',[{op:'heal',resource:'hp',amount:pct('hp',f(form,.7,1)),targeting:self},{op:'dispel',mode:'remove',polarity:'negative',count:99,targeting:self}],'self');
  const hold=buff(c,'x-blank-hold','留白',{duration:round(1),dispellable:false,priority:70,control:'stun',tags:['monster:phase','monster:timer'],onExpire:wake});
  trigger(c,a,'x-blank','damage_received','self',[hold],{conditions:[hpBelow(.3)],cooldownMs:2*RM});
  return setName(c,a,'生命见底时它停笔留白一轮；若这一轮没能把它写完，它就从头再来。');}),
 T17:X('T17','末班广播',{seed:'广播登机口：3轮后不在登机口的敌人各受25%最大生命',full:'广播登机口：3轮后不在登机口的敌人各受40%最大生命'},[],true,(c,form)=>{
  const a=passive(c,'末班广播');const hit=typeless(c,pct('hp',f(form,.25,.4),'target'),{guaranteed:true});hit.targeting={...ALL_ENEMIES,excludeTags:['x-gate']};
  const boom=child(c,'x-gate:boom',[hit]);const gate=mark(c,'gate','登机口',{duration:round(3),dispellable:false,tags:['monster:status','monster:malice','monster:timer']});
  trigger(c,a,'x-gate','round','self',[{...gate,targeting:RANDOM_ENEMY(1)},buff(c,'x-gate-clock','末班广播',{duration:round(3),dispellable:false,priority:70,tags:['monster:timer'],onExpire:boom})],{cooldownMs:6*RM});
  return setName(c,a,'广播指定了登机口；三轮后没站在登机口的人都会被末班机甩下。');}),
 T18:X('T18','无终旅程',{seed:'每轮当前与最大生命+10%、伤害+10%，无上限',full:'每轮当前与最大生命+15%、伤害+15%，无上限'},[],true,(c,form)=>{
  const a=passive(c,'无终旅程');const m=f(form,1.1,1.15);
  trigger(c,a,'x-road','round','self',[buff(c,'x-road-grow','无终',{duration:permanent,dispellable:false,stack:'stack',maxStacks:99,scaleWithStacks:true,modifiers:[{stat:'max_hp',multiplier:m},...dmgMods(m)]}),{op:'heal',resource:'hp',amount:pct('hp',m-1),targeting:self}]);
  return setName(c,a,'旅程没有终点：每过一轮它都更厚、更重。');}),
 T19:X('T19','总单归属',{seed:'敌人每失去一个护盾，它对全体造成盾值50%的伤害',full:'敌人每得到护盾它复制一份同值护盾；敌人每失去一个护盾，它对全体造成盾值50%的伤害'},['shield'],true,(c,form)=>{
  const a=passive(c,'总单归属');const claim=typeless(c,{eventFraction:.5},{guaranteed:true});claim.targeting=ALL_ENEMIES;
  trigger(c,a,'x-manifest','shield_break','enemy',[claim]);
  if(form==='full')trigger(c,a,'x-manifest-copy','shield_gained','enemy',[{op:'shield',amount:{...flat(0),eventFraction:1},channels:['physical','energy','mental','true'],duration:round(3),stack:'independent',targeting:self}]);
  return setName(c,a,'所有护盾的总单都归它：别人得盾它也得一份，护盾碎裂时全场结账。');}),
 T20:X('T20','永昼退房',{seed:'隐匿与闪避增益对它无效；敌人每回避一次闪避−10%（本场）',full:'隐匿与闪避增益对它无效；敌人每回避一次闪避−15%（本次迷宫内）'},['evade'],true,(c,form)=>{
  const a=passive(c,'永昼退房',[selfRule('guaranteed_hit','*')]);
  const fee=mark(c,'checkout','退房',{duration:f(form,permanent,RUN),scope:(form==='full'?'run':'battle') as 'battle'|'run',dispellable:false,stack:'stack',maxStacks:99,scaleWithStacks:true,modifiers:[{stat:'evade',flat:-f(form,.1,.15)}]});
  trigger(c,a,'x-checkout','miss','self',[{...fee,targeting:EVENT_TARGET}]);
  return setName(c,a,'永昼之下无处藏身；每一次躲闪都会被记账。');}),
 T21:X('T21','十三地基',{seed:'前7次敌方治疗改为等量伤害；前7次对它的暴击改为治疗它；计数公开',full:'前13次敌方治疗改为等量伤害；前13次对它的暴击改为治疗它；计数公开'},['no_heal'],true,(c,form)=>{
  const a=passive(c,'十三地基');const n=f(form,7,13);
  trigger(c,a,'x-found-heal','before_heal','enemy',[{op:'alter_event',mode:'heal_to_damage'},{op:'counter',key:'地基·治疗反转',mode:'add',value:[{constant:1}],reset:'battle',targeting:self}],{uses:n});
  trigger(c,a,'x-found-crit','before_damage','self',[{op:'alter_event',mode:'damage_to_heal'},{op:'counter',key:'地基·暴击反转',mode:'add',value:[{constant:1}],reset:'battle',targeting:self}],{uses:n,conditions:[isCrit]});
  return setName(c,a,'地基未稳时，治疗是伤害、暴击是补药；用掉几次写在它头上。');}),
 T22:X('T22','未完树稿',{seed:'它每个技能首次使用是草稿（×0.3并留下线稿）；再对带线稿者使用任一技能是定稿（×2必中）',full:'它每个技能首次使用是草稿（×0.3并留下线稿）；再对带线稿者使用任一技能是定稿（×3必中）'},[],true,(c,form)=>{
  const a=passive(c,'未完树稿',[selfRule('draft',String(f(form,2,3)))]);
  return setName(c,a,'它的每一招第一次都只是草稿；落在线稿上的下一笔才是定稿。');}),
 T23:X('T23','总务循环',{seed:'全体敌人生命链接，分摊20%',full:'全体敌人生命链接，分摊30%'},[],true,(c,form)=>{
  const a=passive(c,'总务循环',[{op:'link',mode:'life',key:'x-bureau',members:ALL_ENEMIES,minimumMembers:2,delayRounds:1,recovery:{hp:f(form,.2,.3),mp:0,sp:0},duration:permanent,targeting:ALL_ENEMIES}]);
  return setName(c,a,'总务把敌人全体编进同一份循环：一人受伤，众人分摊。');}),
 T24:X('T24','零场观众',{seed:'敌人每用一次技能它叠一层观众；10层散场：全体行动条清零并沉默1轮',full:'敌人每用一次技能它叠一层观众；8层散场：全体行动条清零并沉默1轮'},['skill'],true,(c,form)=>{
  const a=passive(c,'零场观众');const n=f(form,10,8);const seat=buff(c,'x-audience','观众',{duration:permanent,dispellable:false,stack:'stack',maxStacks:n,scaleWithStacks:false});
  trigger(c,a,'x-seat','after_cost','enemy',[seat],{conditions:[isSkill]});
  trigger(c,a,'x-curtain','after_cost','enemy',[{op:'atb',mode:'set',value:0,targeting:ALL_ENEMIES},{...mark(c,'hush','散场沉默',{duration:round(1),control:'silence'}),targeting:ALL_ENEMIES},{op:'dispel',mode:'remove',polarity:'positive',status:'x-audience',count:1,stacks:n,includeUndispellable:true,targeting:self}],{conditions:[isSkill,casterHas('x-audience',n)]});
  return setName(c,a,'每一招都是给它的表演；观众坐满就散场。');}),
 T25:X('T25','北辰熄灭',{seed:'熄灭攻击最高者的星：技能费用×2，直到他对它单次造成≥10%最大生命；然后换人',full:'熄灭攻击最高者的星：技能费用×3，直到他对它单次造成≥10%最大生命；然后换人'},[],true,(c,form)=>{
  const a=passive(c,'北辰熄灭');const m=f(form,2,3);
  trigger(c,a,'x-star','round','self',[{...mark(c,'starless','北辰熄灭',{duration:permanent,modifiers:[{stat:'cost_mp',multiplier:m},{stat:'cost_sp',multiplier:m}],breakAfterDamage:{from:'dealt_to_source',fraction:.1}}),targeting:{side:'enemy',selection:'highest_attack',count:1,life:'alive',excludeTags:['x-starless']}}]);
  return setName(c,a,'它熄灭一个人头顶的星，那人的每一招都变得昂贵，直到他给它狠狠一击。');}),
 T26:X('T26','蜂后物业',{seed:'蜂后每轮全体攻击并召1名租客（上限3）；租客攻击夺取目标10%最大生命交给蜂后并叠欠租（承伤+15%/层）；每只租客使蜂后承伤−10%',full:'蜂后每轮全体攻击并召1名租客（上限6）；租客攻击夺取目标15%最大生命交给蜂后并叠欠租（承伤+15%/层）；每只租客使蜂后承伤−10%；满员时蜂后每轮额外2动'},['ignore_adds'],true,(c,form)=>{
  const a=passive(c,'蜂后物业');const cap=f(form,3,6);
  const rent=typeless(c,pct('hp',f(form,.1,.15),'target'),{guaranteed:true});
  const arrears=mark(c,'arrears','欠租',{duration:round(6),stack:'stack',maxStacks:99,scaleWithStacks:true,modifiers:[{stat:'vulnerability',multiplier:1.15}]});
  const bite=child(c,'x-tenant:bite',[rent,arrears]);
  c.lib.summons['x-tenant']={name:c.m.motif+'·租客',level:'caster',inheritance:.2,resources:{hp:.1,mp:0,sp:0},attributes:{力量:0,敏捷:0,体质:0,智力:0,精神:0},actions:[bite],duration:round(9),ownerDeath:'despawn',limit:cap,rewardEligible:false,tags:['monster:minion','monster:tenant']};
  const sweep=damage({...c,power:c.power*.8},'physical');sweep.targeting=ALL_ENEMIES;
  const hive=buff(c,'x-hive','物业',{duration:permanent,dispellable:false,stack:'stack',maxStacks:cap,scaleWithStacks:true,modifiers:[{stat:'vulnerability',multiplier:.9}]});
  trigger(c,a,'x-queen','round','self',[sweep,{op:'summon',template:'x-tenant',count:1,mode:'summon',targeting:self},hive]);
  trigger(c,a,'x-rent','damage_dealt','ally',[{op:'heal',resource:'hp',amount:{...flat(0),eventFraction:1},targeting:self}],{conditions:[condition('event_source','tag','monster:tenant',1,'gte')]});
  trigger(c,a,'x-tenant-down','after_down','ally',[{op:'dispel',mode:'remove',polarity:'positive',status:'x-hive',count:1,stacks:1,includeUndispellable:true,targeting:self}],{conditions:[condition('event_target','tag','monster:tenant',1,'gte')]});
  if(form==='full')trigger(c,a,'x-full-house','round','self',[{op:'atb',mode:'extra',value:2,targeting:self}],{conditions:[casterHas('x-hive',cap)]});
  return setName(c,a,'蜂后每轮扫荡全场并放出租客；租客收的租全交给蜂后，欠租者越来越脆，租客越多蜂后越硬。');}),
 T27:X('T27','永不毕业',{seed:'同一技能用到第4次即被封，直到该单位用一个本场没用过的技能',full:'同一技能用到第3次即被封，直到该单位用一个本场没用过的技能'},['skill'],true,(c,form)=>{
  const a=passive(c,'永不毕业',[enemyRule('repeat_seal',String(f(form,4,3)))]);
  return setName(c,a,'同一招用多了就会被没收，换一招才能过关。');}),
 T28:X('T28','零库结算',{seed:'每轮下架一名敌人最近使用的技能1轮',full:'每轮下架一名敌人最近使用的技能2轮，并复制一份到自己货架（本场）'},['skill'],true,(c,form)=>{
  const a=passive(c,'零库结算');const fx:EffectSpec[]=[{op:'uses',mode:'seal',skill:'*',selection:'used_latest',value:1,duration:round(f(form,1,2)),targeting:RANDOM_ENEMY(1)}];
  if(form==='full')fx.unshift({op:'copy',mode:'skill',id:'*',selection:'used_latest',duration:permanent,targeting:RANDOM_ENEMY(1)});
  trigger(c,a,'x-shelf','round','self',fx);return setName(c,a,'敌人最近用过的技能被下架，货架上只剩它自己的库存。');}),
 T29:X('T29','白潮析命',{seed:'每轮结束，把每个敌人“超过半血的部分”的30%析出成它的护盾；半血以下者承受它的伤害×1.5',full:'每轮结束，把每个敌人“超过半血的部分”的50%（七阶100%）析出成它的护盾；半血以下者承受它的伤害×1.5'},['percent'],true,(c,form)=>{
  const a=passive(c,'白潮析命');const k=f(form,.3,scale(c,.5,1));
  const crystal=child(c,'x-salt:crystal',[{op:'shield',amount:{...flat(0),expression:[{read:'event',key:'actual'}]},channels:['physical','energy','mental','true'],duration:round(3),stack:'independent',targeting:self}],'self');
  const salt=typeless(c,{currentResource:'hp',currentFraction:k,maxResource:'hp',maxFraction:-k/2,subject:'target',resourceSubject:'target',minimum:0},{guaranteed:true,lethal:false,bypass:['shield']});salt.targeting=ALL_ENEMIES;salt.onHitAction=crystal;
  const brine=mark(c,'brine','盐渍',{duration:round(1),modifiers:[{stat:'vulnerability',multiplier:1.5}]});
  trigger(c,a,'x-salt','round','self',[salt,{...brine,targeting:ALL_ENEMIES,conditions:[{subject:'target',kind:'resource_ratio',key:'hp',value:.5,compare:'lte'}]}]);
  return setName(c,a,'满血的人是它最好的盐矿：高出半血的部分每轮被析出成它的盐壳；压在半血以下的人则更疼。');}),
 T30:X('T30','云层分割',{seed:'每3轮按血量分层：半血以上者承伤×1.5，半血以下者输出×0.5，持续3轮',full:'每3轮按血量分层：半血以上者承伤×1.5，半血以下者输出×0.5，持续3轮；分层时最厚与最薄两人状态互换'},[],true,(c,form)=>{
  const a=passive(c,'云层分割');const fx:EffectSpec[]=[{...mark(c,'upper','上层',{duration:round(3),modifiers:[{stat:'vulnerability',multiplier:1.5}]}),targeting:ALL_ENEMIES,conditions:[{subject:'target',kind:'resource_ratio',key:'hp',value:.5,compare:'gte'}]},{...mark(c,'lower','下层',{duration:round(3),modifiers:dmgMods(.5)}),targeting:ALL_ENEMIES,conditions:[{subject:'target',kind:'resource_ratio',key:'hp',value:.5,compare:'lt'}]}];
  if(form==='full')fx.unshift({op:'status_transform',mode:'swap_pair',polarity:'any',targeting:ENEMY_HIGHEST_HP},{op:'status_transform',mode:'swap_pair',polarity:'any',targeting:ENEMY_LOWEST_HP});
  trigger(c,a,'x-cloud','round','self',fx,{conditions:[{kind:'expression',expression:[{read:'round'},{constant:3},{operator:'mod'}],value:0,compare:'eq'}]});return setName(c,a,'云层把敌人按血线切成上下两层：上层挨打更疼，下层出手更软。');}),
 T31:X('T31','不落雨债',{seed:'敌方治疗只生效一半，另一半记为雨债；它生命低于30%时把雨债总额均摊给全体',full:'敌方治疗不生效，全部记为雨债；它生命低于30%时把雨债总额均摊给全体'},['no_heal'],true,(c,form)=>{
  const a=passive(c,'不落雨债');const k=f(form,.5,1);
  trigger(c,a,'x-rain','before_heal','enemy',[{op:'counter',key:'雨债',mode:'add',value:[{read:'event',key:'raw'},{constant:k},{operator:'mul'}],reset:'battle',targeting:self},{op:'alter_event',mode:'scale',value:[{constant:1-k}]}]);
  const pour=typeless(c,{...flat(0),expression:[{read:'counter',subject:'caster',key:'雨债'},{read:'alive_count',subject:'caster',key:'enemy'},{constant:1},{operator:'max'},{operator:'div'}]},{guaranteed:true});pour.targeting=ALL_ENEMIES;
  trigger(c,a,'x-rain-pour','damage_received','self',[pour,{op:'counter',key:'雨债',mode:'clear',value:[{constant:0}],reset:'battle',targeting:self}],{uses:1,conditions:[hpBelow(.3)]});
  return setName(c,a,'伞下的雨不落地，被记成债；等它撑不住时一并倾盆，均摊给所有人。');}),
 T32:X('T32','瓶海收藏',{seed:'击倒的敌人被装瓶（不可复活），最多1瓶；打掉它25%最大生命放出1瓶',full:'击倒的敌人被装瓶（不可复活），最多2瓶；打掉它25%最大生命放出1瓶'},['undying'],true,(c,form)=>{
  const a=passive(c,'瓶海收藏');trigger(c,a,'x-bottle','kill','self',[{op:'rule',rule:'no_revive',key:'*',duration:permanent,breakAfterDamage:{from:'source_received',fraction:.25},targeting:{side:'event_target',selection:'all',life:'any'}}],{uses:f(form,1,2)});
  return setName(c,a,'被它击倒的人会被装进瓶子里收藏；狠狠打它一顿，瓶塞才会松。');}),
 T33:X('T33','万芯神谕',{seed:'每轮公开掷骰：1=全体25%最大生命，2–3=沉默并减速1轮，4–5=它回血20%，6=它追加2动',full:'每轮公开掷骰：1=全体40%最大生命，2–3=沉默并减速1轮，4–5=它回血20%，6=它追加2动'},[],true,(c,form)=>{
  const a=passive(c,'万芯神谕');const smite=typeless(c,pct('hp',f(form,.25,.4),'target'),{guaranteed:true});smite.targeting=ALL_ENEMIES;
  const one=child(c,'x-die:1',[smite]),two=child(c,'x-die:2',[{...mark(c,'oracle-hush','神谕沉默',{duration:round(1),control:'silence',modifiers:[{stat:'speed',multiplier:.5}]}),targeting:ALL_ENEMIES}]),three=child(c,'x-die:3',[{op:'heal',resource:'hp',amount:pct('hp',.2),targeting:self}],'self'),four=child(c,'x-die:4',[{op:'atb',mode:'extra',value:2,targeting:self}],'self');
  trigger(c,a,'x-die','round','self',[{op:'choose',actions:[one,two,three,four],count:1,replace:false,weights:[1,2,2,1]}]);
  return setName(c,a,'每轮它公开掷六面骰，神谕落在哪一面，哪一面就成真。');}),
 T34:X('T34','墓园旋转',{seed:'每2轮全体敌人的行动条轮转一格',full:'每轮全体敌人的行动条轮转一格'},[],true,(c,form)=>{
  const a=passive(c,'墓园旋转');trigger(c,a,'x-carousel','round','self',[{op:'atb',mode:'rotate',value:1,targeting:ALL_ENEMIES}],form==='seed'?{cooldownMs:2*RM}:{});
  return setName(c,a,'旋转木马转起来，所有人的行动条整体挪了一格。');}),
 T35:X('T35','透明鲸梦',{seed:'对它的伤害不结算而记账；每3轮醒来：账单÷敌方存活人数结算到它身上，同时对全体造成账单20%',full:'对它的伤害不结算而记账；每3轮醒来：账单÷敌方存活人数结算到它身上，同时对全体造成账单30%'},['burst'],true,(c,form)=>{
  const a=passive(c,'透明鲸梦');
  trigger(c,a,'x-whale-book','before_damage','self',[{op:'counter',key:'鲸梦账单',mode:'add',value:[{read:'event',key:'raw'}],reset:'battle',targeting:self},{op:'alter_event',mode:'scale',value:[{constant:0}]}],{conditions:[{subject:'event_source',kind:'side',key:'ally'}]});
  const settle=typeless(c,{...flat(0),expression:[{read:'counter',subject:'caster',key:'鲸梦账单'},{read:'alive_count',subject:'caster',key:'enemy'},{constant:1},{operator:'max'},{operator:'div'}]},{guaranteed:true,bypass:['shield']});settle.targeting=self;
  const wake=typeless(c,{...flat(0),expression:[{read:'counter',subject:'caster',key:'鲸梦账单'},{constant:f(form,.2,.3)},{operator:'mul'}]},{guaranteed:true});wake.targeting=ALL_ENEMIES;
  trigger(c,a,'x-whale-wake','round','self',[settle,wake,{op:'counter',key:'鲸梦账单',mode:'clear',value:[{constant:0}],reset:'battle',targeting:self}],{conditions:[{kind:'expression',expression:[{read:'round'},{constant:3},{operator:'mod'}],value:0,compare:'eq'}]});
  return setName(c,a,'鲸在梦里挨打不痛，只记账；每三轮醒来一次结账，活着的人越少它付得越多。');}),
 T36:X('T36','黑日不落',{seed:'每2轮从全体敌人各收割1点五维（本次迷宫内）加到自己身上；累计10点丰收：全体重击×2',full:'每轮从全体敌人各收割1点五维（本次迷宫内）加到自己身上；累计10点丰收：全体重击×2'},[],true,(c,form)=>{
  const a=passive(c,'黑日不落');const attrs=['力量','敏捷','体质','智力','精神'] as const;
  const reap=mark(c,'reaped','被收割',{duration:RUN,scope:'run',dispellable:false,stack:'stack',maxStacks:99,scaleWithStacks:true,modifiers:attrs.map(stat=>({stat,flat:-1}))});
  const harvest=buff(c,'x-harvest','丰收',{duration:permanent,dispellable:false,stack:'stack',maxStacks:99,scaleWithStacks:true,modifiers:attrs.map(stat=>({stat,flat:1}))});
  trigger(c,a,'x-reap','round','self',[{...reap,targeting:ALL_ENEMIES},harvest],form==='seed'?{cooldownMs:2*RM}:{});
  const smash=damage({...c,power:c.power*2},'physical');smash.targeting=ALL_ENEMIES;
  trigger(c,a,'x-harvest-smash','round','self',[smash,{op:'dispel',mode:'remove',polarity:'positive',status:'x-harvest',count:1,stacks:10,includeUndispellable:true,targeting:self}],{conditions:[casterHas('x-harvest',10)]});
  return setName(c,a,'黑日不落，它每轮从所有人身上收割一点，攒够十点就是一场丰收重击。');}),
 T37:X('T37','地心账本',{seed:'敌方每点伤害记账；每5轮结账：它回复账本20%，账本20%作为真实伤害均摊敌方',full:'敌方每点伤害记账；每5轮结账：它回复账本30%，账本30%作为真实伤害均摊敌方'},['burst'],true,(c,form)=>{
  const a=passive(c,'地心账本');const k=f(form,.2,.3);
  trigger(c,a,'x-ledger-book','damage_received','self',[{op:'counter',key:'地心账本',mode:'add',value:[{read:'event',key:'actual'}],reset:'battle',targeting:self}]);
  const bill=typeless(c,{...flat(0),expression:[{read:'counter',subject:'caster',key:'地心账本'},{constant:k},{operator:'mul'},{read:'alive_count',subject:'caster',key:'enemy'},{constant:1},{operator:'max'},{operator:'div'}]},{guaranteed:true});bill.targeting=ALL_ENEMIES;
  trigger(c,a,'x-ledger','round','self',[{op:'heal',resource:'hp',amount:{...flat(0),expression:[{read:'counter',subject:'caster',key:'地心账本'},{constant:k},{operator:'mul'}]},targeting:self},bill,{op:'counter',key:'地心账本',mode:'clear',value:[{constant:0}],reset:'battle',targeting:self}],{conditions:[{kind:'expression',expression:[{read:'round'},{constant:5},{operator:'mod'}],value:0,compare:'eq'}]});
  return setName(c,a,'地心账本记下每一点伤害，每五轮结一次账：它收回本钱，其余人付利息。');}),
 T38:X('T38','缝隙王权',{seed:'上一轮攻击过它的单位，本轮对它的伤害×0.3',full:'上一轮攻击过它的单位，本轮无法对它造成伤害'},['burst'],true,(c,form)=>{
  const a=passive(c,'缝隙王权');trigger(c,a,'x-seen','damage_received','self',[{...mark(c,'seen','已被王权记下',{duration:round(1)}),targeting:EVENT_SOURCE}]);
  trigger(c,a,'x-crack','before_damage','self',[{op:'alter_event',mode:'scale',value:[{constant:f(form,.3,0)}]}],{conditions:[sourceHas('x-seen')]});
  return setName(c,a,'它只从缝隙里挨打：连续攻击它的人会被王权记下，下一击落空。');}),
 T39:X('T39','无始发站',{seed:'敌方技能20%概率坐过站：目标改为随机单位（含己方）',full:'敌方技能35%概率坐过站：目标改为随机单位（含己方）'},[],true,(c,form)=>{
  const a=passive(c,'无始发站');trigger(c,a,'x-overshoot','before_action','enemy',[{op:'alter_event',mode:'redirect',recipient:'random_any'}],{chance:f(form,.2,.35),conditions:[isSkill]});
  return setName(c,a,'地铁没有始发站，敌人的技能有时会坐过站，落在谁头上全凭运气。');}),
 T40:X('T40','十三潮汐',{seed:'潮汐计数每轮+1，到16处决全场；对它暴击+1（更快），被它命中−1（更慢）',full:'潮汐计数每轮+1，到13处决全场；对它暴击+1（更快），被它命中−1（更慢）'},['timer'],true,(c,form)=>{
  const a=passive(c,'十三潮汐');const n=f(form,16,13);const add=(v:number):EffectSpec=>({op:'counter',key:'x-tide13',mode:'add',value:[{constant:v}],reset:'battle',minimum:0,targeting:self});
  trigger(c,a,'x-t13-round','round','self',[add(1)]);trigger(c,a,'x-t13-crit','damage_received','self',[add(1)],{conditions:[isCrit]});trigger(c,a,'x-t13-hit','hit','self',[add(-1)]);
  const exec=typeless(c,pct('hp',1,'target'),{guaranteed:true,execute:true,bypass:['shield']});exec.targeting=ALL_ENEMIES;
  trigger(c,a,'x-t13-exec','round','self',[exec,{op:'counter',key:'x-tide13',mode:'clear',value:[{constant:0}],reset:'battle',targeting:self}],{conditions:[{kind:'expression',expression:[{read:'counter',subject:'caster',key:'x-tide13'}],value:n,compare:'gte'}]});
  return setName(c,a,'潮汐计数走到头就是全场处决；暴击催潮，挨打退潮。');}),
 T41:X('T41','黑雪投递',{seed:'投递：3轮后送达×1.4，送达时目标的增益转为易伤',full:'投递：3轮后送达×1.8，送达时目标的增益转为易伤'},[],false,(c,form)=>{
  const d=damage({...c,power:c.power*f(form,1.4,1.8)},'energy');d.hitChance=1;d.hitRule='guaranteed';
  const land=child(c,'x-mail:land',[{op:'dispel',mode:'remove',polarity:'positive',count:99},mark(c,'mail-vuln','黑雪易伤',{duration:round(2),modifiers:[{stat:'vulnerability',multiplier:1.5}]}),d]);
  const a=active(c,'黑雪投递',[{op:'time',mode:'delay',key:'x-mail',duration:round(3),action:land,restore:[]}],{mp:1,cast:600,tags:['ai:charge']});
  return setName(c,a,'黑雪邮件三轮后送达，签收时连同增益一并变成易伤。');}),
 T42:X('T42','玻璃之躯',{seed:'承伤×2，但每次受伤对攻击者反弹60%真实伤害，每轮3次',full:'承伤×2，但每次受伤对攻击者反弹等量真实伤害，每轮3次'},[],true,(c,form)=>{
  const a=passive(c,'玻璃之躯',[aura(c,'x-glass','玻璃之躯',{modifiers:[{stat:'vulnerability',multiplier:2}]})]);
  const shard=typeless(c,{eventFraction:f(form,.6,1)},{guaranteed:true,bypass:['shield']});shard.targeting=EVENT_SOURCE;
  trigger(c,a,'x-shard','damage_received','self',[shard],{uses:3,reset:'action',cooldownMs:0});
  return setName(c,a,'它是玻璃做的：打它很疼，碎片也会扎回攻击者。');}),
 T43:X('T43','节节高',{seed:'每轮+1节（上限8）：最大与当前生命+10%、伤害+10%、闪避+8%；单次受伤≥20%最大生命砍3节',full:'每轮+1节（上限12）：最大与当前生命+10%、伤害+10%、闪避+8%；单次受伤≥20%最大生命砍3节'},['evade'],true,(c,form)=>{
  const a=passive(c,'节节高');const n=f(form,8,12);
  trigger(c,a,'x-bamboo','round','self',[buff(c,'x-node','节',{duration:permanent,dispellable:false,stack:'stack',maxStacks:n,scaleWithStacks:true,modifiers:[{stat:'max_hp',multiplier:1.1},...dmgMods(1.1),{stat:'evade',flat:.08}]}),{op:'heal',resource:'hp',amount:pct('hp',.1),targeting:self}]);
  trigger(c,a,'x-bamboo-cut','damage_received','self',[{op:'dispel',mode:'remove',polarity:'positive',status:'x-node',count:1,stacks:3,includeUndispellable:true,targeting:self}],{conditions:[{kind:'expression',expression:[{read:'event',key:'actual'}],compareExpression:[{read:'max_resource',subject:'caster',key:'hp'},{constant:.2},{operator:'mul'}],compare:'gte'}]});
  return setName(c,a,'竹子每轮长一节，越长越硬越难打中；一记重击能砍掉三节。');}),
 T44:X('T44','超立方入库',{seed:'每3轮把一名敌人入库1轮（隔离，期间其状态计时暂停），出库时其增益与负面全部清空',full:'每2轮把一名敌人入库1轮（隔离，期间其状态计时暂停），出库时其增益与负面全部清空'},[],true,(c,form)=>{
  const a=passive(c,'超立方入库');trigger(c,a,'x-storage','round','self',[{op:'space',mode:'isolate',value:0,duration:round(1),freeze:true,targeting:ENEMY_HIGHEST_HP},{op:'dispel',mode:'remove',polarity:'any',count:99,targeting:ENEMY_HIGHEST_HP}],{cooldownMs:f(form,3,2)*RM});
  return setName(c,a,'超立方把一个人折进仓库一轮，出库时身上什么都不剩。');}),
 T45:X('T45','无人婚约',{seed:'两名敌人双向连命60%；一方倒下另一方生命变1；只能由它解除',full:'两名敌人双向连命100%；一方倒下另一方生命变1；只能由它解除'},['undying'],true,(c,form)=>{
  const vow=mark(c,'vow','婚约',{duration:permanent,dispellable:false});
  const a=passive(c,'无人婚约',[{...vow,targeting:RANDOM_ENEMY(2)},{op:'link',mode:'life',key:'x-vow',members:{...ALL_ENEMIES,tags:['x-vow']},minimumMembers:2,delayRounds:1,recovery:{hp:f(form,.6,1),mp:0,sp:0},duration:permanent,targeting:{...ALL_ENEMIES,tags:['x-vow']}}]);
  trigger(c,a,'x-vow-widow','after_down','enemy',[{op:'resource',resource:'hp',mode:'set',amount:{...flat(0),minimum:1},lethal:false,targeting:{...ALL_ENEMIES,tags:['x-vow']}}],{conditions:[condition('event_target','status','x-vow',1,'gte')]});
  return setName(c,a,'无人的婚宴上，两名敌人被结成连命的婚约：同伤，同死，只有它能解除。');}),
 T46:X('T46','彩噪',{seed:'每2轮随机改写一名敌人一个用过的技能的属性为随机属性（3轮）',full:'每轮随机改写一名敌人一个用过的技能的属性为随机属性（3轮）'},[],true,(c,form)=>{
  const a=passive(c,'彩噪');const types=['物','火','水','暗','光','精'] as const;
  const noise=types.map(t=>child(c,'x-noise:'+t,[{op:'rule',rule:'element_rewrite',key:t,selection:'used_random',duration:round(3)}]));
  trigger(c,a,'x-noise','round','self',[{op:'choose',actions:noise,count:1,replace:false,targeting:RANDOM_ENEMY(1)}],form==='seed'?{cooldownMs:2*RM}:{});
  return setName(c,a,'彩色噪声随机改写一个人某一招的属性频道。');}),
 T47:X('T47','低重力',{seed:'全场速度×0.5，所有推条/退条效果×2；它每轮行动条+50',full:'全场速度×0.5，所有推条/退条效果×3；它每轮行动条+50'},[],true,(c,form)=>{
  const a=passive(c,'低重力',[{op:'speed',name:c.m.motif+'·低重力',multiplier:.5,chance:1,duration:permanent,stack:'strongest',targeting:ANY_ALL},{op:'modify',name:c.m.motif+'·失重',duration:permanent,modifiers:[{stat:'atb_scale',multiplier:f(form,2,3)}],targeting:ANY_ALL}]);
  trigger(c,a,'x-lowg','round','self',[{op:'atb',mode:'push',value:50,targeting:self}]);
  return setName(c,a,'重力被调低：所有人都变慢，每一次推条退条都飘得更远，只有它每轮额外漂前一段。');}),
 T48:X('T48','幕间',{seed:'每6轮换幕：与一名随机敌人互换当前生命百分比',full:'每4轮换幕：与一名随机敌人互换当前生命百分比'},[],true,(c,form)=>{
  const a=passive(c,'幕间');const PICKED:TargetSpec={...ALL_ENEMIES,tags:['x-act-pick']};
  const fx:EffectSpec[]=[{...mark(c,'act-pick','换幕对象',{duration:round(1)}),targeting:RANDOM_ENEMY(1)},
   {op:'variable',key:'x-act-ratio',mode:'set',value:[{read:'resource_ratio',subject:'target',key:'hp'}],targeting:PICKED},
   {op:'resource',resource:'hp',mode:'set',amount:{...flat(0),expression:[{read:'resource_ratio',subject:'caster',key:'hp'},{read:'max_resource',subject:'target',key:'hp'},{operator:'mul'}],minimum:1},lethal:false,targeting:PICKED},
   {op:'resource',resource:'hp',mode:'set',amount:{...flat(0),expression:[{read:'variable',key:'x-act-ratio'},{read:'max_resource',subject:'caster',key:'hp'},{operator:'mul'}],minimum:1},lethal:false,targeting:self}];
  trigger(c,a,'x-act','round','self',fx,{conditions:[{kind:'expression',expression:[{read:'round'},{constant:f(form,6,4)},{operator:'mod'}],value:0,compare:'eq'}]});
  return setName(c,a,'换幕时它与一名随机敌人交换血线的百分比。');}),
};
export const THEME_EXCLUSIVE_IDS=Object.keys(THEME_EXCLUSIVE);
