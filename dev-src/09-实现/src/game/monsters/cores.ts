import type {ActionSpec,EffectSpec,ModifierSpec,ReactionSpec} from '../../compiler/contract';
import type {Core} from './catalog';
import {SKILL_COST} from './numbers';
import {action,child,condition,CORE_TYPES,damage,finish,flat,initiative,minion,pct,permanent,primer,reduce,round,self,shield,status,type Ctx} from './ir';
import {elementKey} from '../../battle/elements';
const NAMES:Record<Core,string>={
 fang:'撕咬/裂痕/猎物标记/血线追猎/裂命誓约/万伤归猎/噬生裁决',venom:'毒液喷射/毒伤/毒囊孵化/疫链扩散/腐败封喉/死疫诸相/万疫归源',pounce:'突袭/抢步/掠影/踏空追击/封路狩猎/猎途不返/万径归猎',guard:'护体/硬化/护壳轮替/壁垒反震/不屈堡障/伤害分期/不坠壁国',mend:'修复/再生/生机转存/伤口重编/濒死续命/生命重织/生息裁定',shot:'投射/散射/交错弹道/标定齐射/封锁射界/多线处决/天穹弹幕',spore:'孢团/感染/孢囊寄生/连殖芽床/开花倒计时/万巢同生/寄生世界',cleave:'重击/裂甲/裂隙劈斩/破势/断命审判/生界断层/裁界锋刃',frenzy:'连攻/激昂/蓄怒/伤怒转换/暴君狂势/痛楚递归/怒火君权',ram:'冲撞/震荡/破盾槌/地脉震裂/撞破封锁/冲击归零/万象碾平',exchange:'换能/调息/血能交换/守恒回路/逆价炼成/生命账本/等价创世',seal:'冲击印/滞行印/封缄/阵令/禁行敕令/来源封驳/存在禁令',ember:'火击/灼伤/余烬/连燃/焚域/薪火易命/灾火天启',chain:'连刺/追击/多线缠杀/伤痕连锁/百结杀阵/命线共振/万界连刑',curse:'恶念/虚弱/咒印/代价回声/苦难宣告/治疗税契/命数欠债',hex:'惑心/迷乱/噩梦印/心景重叠/短梦囚笼/感知剥离/万识无明',drain:'汲取/吮能/血食/寄命/生息掠夺/伤害收割/众生作粮',snare:'缠击/牵绊/结网/织场/束缚牢笼/路径剥夺/诸界结网',mirror:'反击/折闪/镜像架势/返照/反击约定/整招回返/万象还身',pledge:'共击/掩护/分担/连命誓言/替命誓壁/群命协议/共生神契',rift:'裂隙斩/错步/错位/裂隙伏线/隔离牢房/边界驱逐/离界判决',chime:'震音/迟滞/余响/共振/敲钟禁行/公共时刻/终末报时',silence:'无声击/迟咒/断句/咏唱封条/静默禁咒/术源抹声/万籁归寂',mark:'瞄准/标定/前兆/因痕追踪/审判印记/被标者无隐/真名裁定',fate:'偏斜击/好运/分岔/偶然叠合/概率赌局/一次必中/命途收束',veil:'掠击/模糊/隐迹/虚影/夜幕间隙/一次绝闪/无相行走',collect:'攫取/抽取/储蓄/征收/能量清算/护佑没收/万物入账',shock:'电击/麻痹/导电/过载/瘫痪协议/能源剥夺/雷霆裁决',clock:'钟摆击/迟滞/摆差/预约伤害/延时裁决/昨日回拨/时序法庭',sever:'切击/剥落/断续/解构/拆解护佑/能力断源/存在截断',erase:'抹击/侵蚀/擦除护佑/删改/规则校对/原稿删除/空白判决',gravity:'坠击/负重/引力井/失衡/压场/坠落之令/天体归墟',echo:'回音击/叠声/返响/余音复奏/追忆反击/借招回演/诸相重奏',swarm:'群击/援动/衍生体/巢阵/虫潮封锁/分体共生/众相化身',frost:'霜击/寒冷/凝霜/冻脉/寒狱/热量封存/永冬判决'
};
const MENTAL=new Set<Core>(['curse','hex','seal','silence','mark','fate','echo']);
const ENERGY=new Set<Core>(['venom','spore','ember','shock','clock','erase','gravity','rift','frost','exchange']);
export const coreChannel=(core:Core)=>MENTAL.has(core)?'mental' as const:ENERGY.has(core)?'energy' as const:'physical' as const;
export const coreName=(core:Core,stage:number)=>NAMES[core].split('/')[stage-1]!;
export const COUNTERPLAY:Record<Core,string>={fang:'清除裂伤，避免带伤承受引爆',venom:'及时驱散毒印，保留治疗替代方案',pounce:'防御冲锋，打断蓄势并拆除前兆',guard:'剥离护壳，按轮施压而非单轮倾泻',mend:'阻断治疗或在有限续命用尽后收割',shot:'护盾分担弹幕，多段是总威力分摊',spore:'优先清寄生与衍生体',cleave:'保留打断，躲开有施法条的破势',frenzy:'驱散蓄怒并压制治疗，不能无限积层',ram:'在冲撞前打断，勿只依赖单层盾',exchange:'封锁能量恢复，观察MP/SP代价',seal:'驱散封条或使用未被封锁的来源',ember:'驱散灼伤，利用火抗',chain:'清除命线前兆，使用减伤而非薄盾',curse:'清咒再治疗，法则转换有触发上限',hex:'精神抵抗、驱散与伤害唤醒',drain:'护盾降低实际吸血收益',snare:'清网后再用位移；硬控有公共轮期限',mirror:'普通试探消耗反射次数，再打主技能',pledge:'击破分体，避免反复喂给有限共生窗口',rift:'打断隔离，等待有限边界到期',chime:'抵抗迟滞，打断敲钟蓄势',silence:'保留物理/道具来源，净化静默',mark:'驱散前兆，破坏标定连携',fate:'消耗一次必中后反击，绝对词仍走仲裁',veil:'范围攻击与标记，消耗一次绝闪',collect:'保留无费普攻，避免同时耗尽双资源',shock:'雷抗、分散施法与净化过载',clock:'打断预约，延迟伤害有明确倒计时',sever:'轮换来源，有限封源不会永久删原卡',erase:'驱散与护佑分层，不堆单一状态',gravity:'打断重压，位移可离开有限场域',echo:'用低危技能试探；借招不支付被借原技能费用但受外层次数限制',swarm:'先清衍生体，召唤无奖励且受归属上限',frost:'冰抗、净化与等待公共轮解冻'};
function dot(c:Ctx,key:string,element:string):EffectSpec{
 const d=damage(c,'energy',1,1,[elementKey(element)]);d.amounts.energy=flat([15,65,150,330,850,1900,1900][c.stage-1]!*c.n.challengeGrowth.attack);d.hitChance=1;d.hitRule='normal';
 const tick=child(c,key+':tick',[d]);
 return status(c,key,c.m.motif+'·'+coreName(element==='火'?'ember':element==='冰'?'frost':'venom',c.stage),{tags:['monster:primer',c.m.id+':primer','dot'],duration:round(c.stage===2?2:c.stage===3?3:4),tick:{clock:'round',interval:1,count:c.stage===2?2:c.stage===3?3:4,action:tick},stack:'refresh'});
}
function suppression(c:Ctx,key:string,kind:'silence'|'bind'|'sleep'|'freeze'|'stun'):EffectSpec{
 return status(c,key,c.m.motif+'·'+key,{tags:['monster:control','monster:primer'],duration:round(c.stage>=5?1:Math.min(c.stage-1,3)),...(c.stage>=5?{control:kind,breakOnDamage:kind==='sleep'}:{modifiers:[{stat:kind==='silence'?'cost_mp':'damage_physical',multiplier:kind==='silence'?1+c.pct:1-c.pct} as ModifierSpec]})});
}
/** Family-specific transformations. Low tiers cannot accidentally reach high-tier library code. */
export function signature(c:Ctx,core:Core):ActionSpec{
 const s=c.stage,channel=coreChannel(core),a=action([damage(c,channel,1,core==='chain'?3:core==='shot'||core==='swarm'?2:1,CORE_TYPES[core])]);
 a.name=c.m.motif+'·'+coreName(core,s);a.category=channel==='physical'?'physical':'spell';a.tags=['monster:regular',core==='pounce'?'movement':'monster:'+core];
 a.description=`${c.m.name}以「${c.m.motif}」为核：${coreName(core,s)}。${COUNTERPLAY[core]}。持续与次数以效果详情为准。`;
 a.cost[channel==='physical'?'sp':'mp'].flat=SKILL_COST[s-1]!*c.n.challengeGrowth.resource;
 a.castMs=['cleave','ram','gravity','clock'].includes(core)?1000:500;
 const positive=(e:EffectSpec)=>{e.targeting=self;a.effects.push(e);};
 if(core==='guard'||core==='mend'){
  a.target='self';a.effects=[core==='guard'?shield(c):{op:'heal',resource:'hp',amount:flat(c.recovery)}];a.perBattleUses=core==='mend'?2:3;a.tags.push('ai:defence');
  if(s>=3)positive(core==='guard'?reduce(c):{op:'dispel',mode:'remove',polarity:'negative',count:1});
  if(s>=6){const e=status(c,'protection',a.name,{polarity:'positive',duration:round(2),reactions:core==='guard'?[{kind:'damage_cap',fraction:.45,reset:'round'}]:[{kind:'resource_guard',resource:'mp',fraction:.5}]});e.targeting=self;delete (e as {opposedAttribute?:string}).opposedAttribute;a.effects.push(e);}
  return finish(c,a);
 }
 if(s===1)return finish(c,a);
 let extra:EffectSpec|undefined;
 switch(core){
  case 'fang':case 'venom':case 'spore':case 'ember':extra=dot(c,'wound',core==='ember'?'火':'暗');break;
  case 'frost':extra=s>=5?suppression(c,'freeze','freeze'):dot(c,'frost','冰');break;
  case 'snare':case 'seal':extra=suppression(c,'binding','bind');break;
  case 'silence':extra=suppression(c,'silence','silence');break;
  case 'hex':extra=suppression(c,'dream','sleep');break;
  case 'shock':extra=s>=5?suppression(c,'overload','stun'):status(c,'conductive',a.name,{modifiers:[{stat:'cost_mp',multiplier:1+c.pct}]});break;
  case 'chime':case 'gravity':extra=status(c,'tempo',a.name,{duration:round(s===2?1:3),modifiers:s===2?[{stat:'cost_sp',multiplier:1+c.pct}]:[initiative(c,-[0,0,2,3,5,8,8][s-1]!)]});break;
  case 'curse':extra=status(c,'curse',a.name,{tags:['monster:primer','curse'],modifiers:[{stat:'heal_received',multiplier:1-c.pct}]});break;
  case 'mark':case 'chain':case 'cleave':extra=primer(c);break;
  case 'pounce':extra=status(c,'pursuer',a.name,{polarity:'positive',duration:round(s===2?1:3),modifiers:s===2?[{stat:'damage_physical',multiplier:1+c.pct}]:[initiative(c,[0,0,2,3,5,8,8][s-1]!)]});extra.targeting=self;break;
  case 'frenzy':extra=status(c,'rage',a.name,{polarity:'positive',duration:round(s===2?1:3),modifiers:[{stat:'damage_physical',multiplier:1+c.pct}]});extra.targeting=self;break;
  case 'drain':{if(s<6)extra={op:'heal',resource:'hp',amount:flat(c.recovery),targeting:self,requiresHit:'impact'};else{const d=a.effects[0] as Extract<EffectSpec,{op:'damage'}>;d.drain={resource:'hp',fraction:c.pct,basis:'actual'};}break;}
  case 'collect':extra={op:'resource',resource:'mp',mode:'subtract',amount:flat(c.recovery/c.n.challengeGrowth.hp*c.n.challengeGrowth.resource)};break;
  case 'exchange':extra={op:'heal',resource:'mp',amount:flat(c.recovery/c.n.challengeGrowth.hp*c.n.challengeGrowth.resource),targeting:self};a.cost.mp.flat=0;a.cost.sp.flat=SKILL_COST[s-1]!*c.n.challengeGrowth.resource;break;
  case 'erase':case 'sever':extra=s>=3?{op:'dispel',mode:'remove',polarity:'positive',count:1}:status(c,'erosion',a.name,{modifiers:[{stat:'reduction_physical',multiplier:1+c.pct}]});break;
  case 'shot':extra=primer(c);break;
  case 'ram':extra=s>=3?{op:'remove_shield',count:1}:primer(c);break;
  case 'mirror':extra=s===2?shield(c):status(c,'mirror',a.name,{polarity:'positive',modifiers:[{stat:'evade',flat:[0,0,2,4,7,9,9][s-1]!/20}]});extra.targeting=self;break;
  case 'veil':extra=s===2?reduce(c):status(c,'veil',a.name,{polarity:'positive',duration:round(3),modifiers:[{stat:'evade',flat:[0,0,2,4,7,9,9][s-1]!/20}]});extra.targeting=self;break;
  case 'fate':extra=status(c,'fortune',a.name,{polarity:'positive',duration:round(s===2?1:3),modifiers:s===2?[{stat:'damage_physical',multiplier:1+c.pct}]:[{stat:'hit',flat:[0,0,2,4,7,9,9][s-1]!/20}]});extra.targeting=self;break;
  case 'rift':extra=s>=3?{op:'space',mode:'move',value:2}:status(c,'shift',a.name,{modifiers:[{stat:'vulnerability',multiplier:1+c.pct}]});break;
  case 'clock':extra=status(c,'lag',a.name,{duration:round(s===2?1:2),modifiers:s===2?[{stat:'cost_sp',multiplier:1+c.pct}]:[initiative(c,-2)]});break;
  case 'echo':extra=primer(c);break;
  case 'swarm':extra=s>=3?minion(c,'brood'):primer(c);a.perBattleUses=s>=3?2:0;break;
  case 'pledge':extra={op:'shield',amount:flat(c.recovery),channels:['physical','energy','mental','true'],duration:round(s===2?1:3),targeting:self};break;
 }
 if(extra){if(!extra.targeting&&extra.op!=='summon')extra.requiresHit='impact';a.effects.push(extra);}
 // Epic establishes explicit conditional follow-through, not a damage multiplier renamed at each tier.
 if(s>=4&&['venom','spore','fang','mark','chain','shot','cleave'].includes(core)){
  const control=suppression(c,'pursuit','bind');control.requiresHit='impact';control.conditions=[condition('target','tag','monster:primer')];a.effects.push(control);
 }
 if(s>=4&&core==='clock'){
  const delayed=child(c,'appointment',[damage(c,channel,1,1,CORE_TYPES[core])]);a.effects=[{op:'time',mode:'delay',duration:round(1),action:delayed,key:'appointment',restore:[]}];
 }
 if(s>=5&&core==='rift')a.effects.push({op:'space',mode:'isolate',value:0,duration:round(1),requiresHit:'impact'});
 if(s>=6){
  if(['sever','erase','seal','silence','collect','shock'].includes(core))a.effects.push({op:'source',mode:'suppress',kinds:['skill'],selection:'first',count:1,duration:round(1),requiresHit:'impact'});
  if(core==='mirror'){const replay=child(c,'reflection',[{op:'replay',originalStats:true}]);positive(status(c,'reflection',a.name,{polarity:'positive',duration:round(2),triggers:[{id:'return',event:'action_resolved',scope:'self',action:replay,uses:1,conditions:[{kind:'expression',expression:[{read:'event',key:'action_attacking'}],compare:'eq',value:1}]}]}));}
  if(core==='echo'){a.effects=[{op:'copy',mode:'skill',id:'latest',selection:'used_latest',activate:true,originalStats:true,duration:round(1)}];a.perBattleUses=1;}
  if(core==='fate'){positive({op:'rule',rule:'guaranteed_hit',key:'*',uses:1,duration:round(2)});a.perBattleUses=1;}
  if(core==='veil'){positive({op:'rule',rule:'guaranteed_evade',key:'*',uses:1,duration:round(2)});a.perBattleUses=1;}
  if(core==='drain')a.effects.push({op:'resource',resource:'sp',mode:'burn',amount:pct('sp',c.pct,'target'),requiresHit:'impact'});
  if(core==='pledge'){
   positive(status(c,'shared',a.name,{polarity:'positive',duration:round(3),reactions:[{kind:'share',fraction:.28,target:'lowest_ally',basis:'actual'}]}));
  }
  if(core==='gravity')a.effects.push({op:'atb',mode:'retreat',value:25,requiresHit:'impact'});
  if(core==='frost'||core==='curse')a.effects.push({op:'rule',rule:'no_heal',key:'*',duration:round(1),requiresHit:'impact'});
  if(core==='spore')positive(minion(c,'mycelium',.18));
  if(['fang','venom','ember','chain','cleave'].includes(core))a.effects.push({op:'rule',rule:core==='ember'||core==='chain'?'no_revive':'no_heal',key:'*',duration:round(1),requiresHit:'impact'});
  if(['pounce','shot','mark','ram'].includes(core)){positive({op:'rule',rule:'guaranteed_hit',key:'*',uses:1,duration:round(2)});a.perBattleUses=1;}
  if(core==='chime')a.effects.push({op:'atb',mode:'retreat',value:20,requiresHit:'impact'});
  if(core==='exchange')positive({op:'resource',mode:'exchange',resource:'sp',other:'mp',amount:flat(8000*c.n.challengeGrowth.resource),ratio:1});
  if(core==='frenzy')positive(status(c,'retaliation',a.name,{polarity:'positive',duration:round(2),reactions:[{kind:'reflect',fraction:.28,basis:'actual',uses:1}]}));
 }
 return finish(c,a);
}
export function combination(c:Ctx):ActionSpec{
 const a=action([damage(c,coreChannel(c.m.cores[0]),1,1,CORE_TYPES[c.m.cores[0]])]);a.name=c.m.motif+'·'+(c.stage===3?'前兆引爆':c.stage===4?'条件连携':c.stage===5?'禁域连锁':c.stage===6?'神话终式':'神格终式');
 a.category='spell';a.tags=['monster:regular','ai:combo'];a.cost.mp.flat=SKILL_COST[c.stage-1]!*c.n.challengeGrowth.resource;
 const prepare=primer(c);prepare.requiresHit='impact';
 if(c.stage>=4){const e=suppression(c,'combo-control','stun');e.requiresHit='impact';e.conditions=[condition('target','tag',c.m.id+':primer')];a.effects.push(e);}
 a.effects.push(prepare);
 if(c.stage>=6)a.effects.push({op:'dispel',mode:'remove',polarity:'positive',count:1,requiresHit:'impact'});
 a.description='命中施加可驱散前兆；四阶起出招前已带该物种前兆者承受压制，五阶起有1公共轮硬控，六阶起另剥离1项护佑。多段总威力不重复。';
 return finish(c,a);
}
/** One regular passive counts as ONE skill with three disclosed clauses, not infinite free boss rules. */
export function body(c:Ctx):ActionSpec{
 const s=c.stage,a=action([],'self');a.activation='battle_start';a.name=c.m.motif+'·'+(s===2?'警觉':s===3?'战术本能':s===4?'史诗体征':s===5?'传说本体':s===6?'神话存在':'神格载体');
 const modifiers:ModifierSpec[]=s===2?[{stat:'reduction_physical',multiplier:1-c.pct}]:[{stat:'hit',flat:[0,0,2,4,7,9,9][s-1]!/20},{stat:'evade',flat:[0,0,2,4,7,9,9][s-1]!/20}];
 const reactions:ReactionSpec[]=[];
 if(s>=6){
  if(c.m.build==='guard'||c.m.build==='brute')reactions.push({kind:'damage_cap',fraction:c.m.role==='Boss'?.40:.55,reset:'round'});
  if(c.m.build==='caster')reactions.push({kind:'resource_guard',resource:'mp',fraction:.5},{kind:'damage_cap',fraction:.65,reset:'round'});
  if(c.m.build==='spirit')reactions.push({kind:'reflect',fraction:.28,basis:'actual',uses:2});
  if(c.m.build==='hunter')reactions.push({kind:'parry',fraction:.28,chance:.28,uses:2});
  if(c.m.build==='swarm')reactions.push({kind:'block',fraction:.28,uses:3});
 }
 const e=status(c,'body',a.name,{polarity:'positive',duration:round(s===2?1:s===3?3:4),dispellable:s<6,modifiers,...(reactions.length?{reactions}:{})});delete (e as {opposedAttribute?:string}).opposedAttribute;a.effects.push(e);
 if(s>=5&&['brute','guard','swarm'].includes(c.m.build))a.effects.push({op:'rule',rule:'death_guard',key:'*',uses:1,amount:flat(1),duration:permanent});
 a.description='条款一：分层检定修正（不改五维）；条款二：依本体类型提供有限承伤/资源抵伤/反应；条款三：重型与群体本体传说起每战一次留1HP。限制明确，不保证击败更高等级或更快的冲突对手。';
 return finish(c,a);
}
export function defence(c:Ctx):ActionSpec{
 const a=action([shield(c),reduce(c),status(c,'resistance',c.m.motif+'·抵抗检定',{polarity:'positive',duration:round(3),modifiers:[{stat:'check_spirit',flat:c.stage>=6?6:c.stage===5?4:2}]})],'self');a.name=c.m.motif+'·逆压防线';a.tags=['monster:regular','ai:defence'];a.cost.sp.flat=SKILL_COST[c.stage-1]!*c.n.challengeGrowth.resource;a.perBattleUses=2;
 a.description='两条：限时全通道护盾；物理/能量/精神减伤。没有额外属性点，没有无限续盾。';return finish(c,a);
}
export function purge(c:Ctx):ActionSpec{
 const haste=status(c,'initiative',c.m.motif+'·先攻检定',{polarity:'positive',duration:round(3),modifiers:[initiative(c,c.stage>=6?8:5)]});haste.targeting=self;const a=action([{op:'dispel',mode:'remove',polarity:'positive',count:1},damage(c,'mental'),haste]);a.name=c.m.motif+'·剥离护佑';a.cost.mp.flat=SKILL_COST[c.stage-1]!*c.n.challengeGrowth.resource;a.perBattleUses=2;a.tags=['monster:regular','ai:purge'];return finish(c,a);
}
export function mythicBreak(c:Ctx):ActionSpec{
 const a=action([damage(c,coreChannel(c.m.cores[1]),1,1,CORE_TYPES[c.m.cores[1]]),{op:'source',mode:'suppress',kinds:['skill'],selection:'first',count:1,duration:round(1),requiresHit:'impact'}]);a.name=c.m.motif+'·有限断源';a.cost.sp.flat=SKILL_COST[c.stage-1]!*c.n.challengeGrowth.resource;a.perBattleUses=1;a.tags=['monster:regular','ai:break'];a.description='命中后封锁一项技能来源1公共轮；不删除原卡、不封锁系统普通攻击/道具，不跨等级速度仲裁。';return finish(c,a);
}
