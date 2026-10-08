/** 敌方“恶意”机制家族（0.29/0.30）：参考 BLACK SOULS II DLC3 与『アルミオシオンの医術師』的整体设计语言。
 *  每个家族有三档形态：seed（雏形，窗口全开）→ full（完全体）→ unbound（拿掉一部分反制）。
 *  每条机制都声明 counter（玩家可用的解）与 seals（它封掉的解），分配器据此做“无解墙检查”。
 *  全部在 booksea-effects/2 契约内表达，不改五维、不越过 24 段上限。 */
import type {ActionSpec,ConditionSpec,EffectSpec,ModifierSpec,StatusSpec,TriggerSpec} from '../../compiler/contract';
import {SKILL_COST} from './numbers';
import {action,child,condition,damage,finish,flat,minion,pct,permanent,round,self,themeType,type Ctx} from './ir';

export type Form='seed'|'full'|'unbound';
export type CounterTag='evade'|'guard'|'shield'|'break'|'hard_break'|'dispel'|'no_heal'|'percent'|'guaranteed'|'burst'|'ignore_adds'|'kill_order'|'timer'|'undying'|'fear'|'control'|'dot'|'command'|'skill'|'buff';
export type Family='F1'|'F2'|'F3'|'F4'|'F5'|'F6'|'F7'|'F8'|'F9'|'F10'|'F11'|'F12'|'F13'|'F14'|'G1'|'G2'|'G3'|'G4'|'G5'|'G6'|'G7'|'G8'|'G9'|'G10'|'G11'|'G12';
export const familyOrigin=(f:Family):'F'|'G'=>f.startsWith('G')?'G':'F';
export type Malice={family:Family;name:string;summary:Record<Form,string>;counter:Record<Form,CounterTag[]>;seals:Record<Form,CounterTag[]>;passive:boolean|Partial<Record<Form,boolean>>;build:(c:Ctx,form:Form)=>ActionSpec};
export const isPassive=(x:Malice,form:Form):boolean=>typeof x.passive==='boolean'?x.passive:!!x.passive[form];

export const ALL_ENEMIES={side:'enemy',selection:'all',life:'alive'} as const;
export const RANDOM_ENEMY=(count:number)=>({side:'enemy',selection:'random',count,life:'alive'} as const);
export const EVENT_TARGET={side:'event_target',selection:'all',life:'alive'} as const;
const FORM_INDEX:Record<Form,number>={seed:0,full:1,unbound:2};
export const pick=<T>(form:Form,seed:T,full:T,unbound:T):T=>[seed,full,unbound][FORM_INDEX[form]]!;
export const dmgMods=(m:number):ModifierSpec[]=>[{stat:'damage_physical',multiplier:m},{stat:'damage_energy',multiplier:m},{stat:'damage_mental',multiplier:m}];
export const hpBelow=(ratio:number,subject:ConditionSpec['subject']='caster'):ConditionSpec=>condition(subject,'resource_ratio','hp',ratio,'lte');
export const hpAbove=(ratio:number):ConditionSpec=>condition('caster','resource_ratio','hp',ratio,'gte');
export function passive(c:Ctx,name:string,effects:EffectSpec[]=[]):ActionSpec{const a=action(effects,'self');a.activation='battle_start';a.name=c.m.motif+'·'+name;a.castMs=0;a.tags=['monster:malice'];return finish(c,a);}
export function active(c:Ctx,name:string,effects:EffectSpec[],opts:{mp?:number;sp?:number;cast?:number;uses?:number;target?:ActionSpec['target'];targeting?:ActionSpec['targeting'];tags?:string[]}={}):ActionSpec{
 const a=action(effects,opts.target??'enemy');a.name=c.m.motif+'·'+name;a.category='spell';a.tags=['monster:unique','monster:malice','ai:unique',...(opts.tags??[])];
 const costUnit=SKILL_COST[c.stage-1]!*c.n.challengeGrowth.resource;a.cost.mp.flat=costUnit*(opts.mp??0);a.cost.sp.flat=costUnit*(opts.sp??0);
 a.castMs=opts.cast??500;if(opts.uses)a.perBattleUses=opts.uses;if(opts.targeting)a.targeting=opts.targeting;return finish(c,a);
}
export function trigger(c:Ctx,a:ActionSpec,id:string,event:TriggerSpec['event'],scope:TriggerSpec['scope'],effects:EffectSpec[],options:Partial<TriggerSpec>={}){
 const key=child(c,id,effects,'self');a.triggers??=[];a.triggers.push({id,event,scope,action:key,uses:0,cooldownMs:0,...options});return key;
}
export function buff(c:Ctx,key:string,name:string,extra:Partial<StatusSpec>):EffectSpec{const e=status(c,key,name,{polarity:'positive',...extra});delete (e as {opposedAttribute?:string}).opposedAttribute;e.targeting=self;return e;}
export function status(c:Ctx,key:string,name:string,extra:Partial<StatusSpec>={}):EffectSpec{
 c.lib.statuses[key]={name:c.m.motif+'·'+name,tags:['monster:status','monster:malice'],polarity:'negative',duration:round(2),stack:'refresh',maxStacks:1,scaleWithStacks:false,priority:0,dispellable:true,removeOnDeath:true,scope:'battle',...extra};
 return {op:'apply_status',status:key,...(c.lib.statuses[key]!.polarity==='negative'?{opposedAttribute:'精神' as const,opposedDifficulty:0}:{})};
}
export const aura=(c:Ctx,key:string,name:string,extra:Partial<StatusSpec>)=>buff(c,key,name,{duration:permanent,dispellable:false,...extra});
/** 无属性伤害（百分比/固定/真实）：类型“无”，所有单位倍率恒为 1。 */
export function typeless(c:Ctx,amount:Partial<ReturnType<typeof flat>>,opts:{guaranteed?:boolean;hits?:number;lethal?:boolean;bypass?:('shield'|'reduction'|'death_guard')[];execute?:boolean}={}):Extract<EffectSpec,{op:'damage'}>{
 const d=damage(c,'true',0,opts.hits??1,['无']);d.amounts.true={...flat(0),...amount};d.hitChance=1;if(opts.guaranteed)d.hitRule='guaranteed';if(opts.hits&&opts.hits>1)d.powerMode='per_hit';
 if(opts.lethal===false)d.lethal=false;if(opts.bypass)d.bypass=opts.bypass;if(opts.execute)d.execute=true;return d;
}
export const enemyRule=(rule:Extract<EffectSpec,{op:'rule'}>['rule'],key:string,duration=permanent):EffectSpec=>({op:'rule',rule,key,duration,targeting:ALL_ENEMIES});
export const selfRule=(rule:Extract<EffectSpec,{op:'rule'}>['rule'],key:string,duration=permanent,extra:Partial<Extract<EffectSpec,{op:'rule'}>>={}):EffectSpec=>({op:'rule',rule,key,duration,targeting:self,...extra});

/* ───────────── F1 真多段：每段全额，段数随形态增加 ───────────── */
const multihit:Malice={family:'F1',name:'连击',passive:false,
 summary:{seed:'2段真多段（每段60%）',full:'4段真多段（每段55%），逐段可闪避',unbound:'8段真多段（每段45%），每段命中叠加流血'},
 counter:{seed:['evade','shield'],full:['evade','shield','guard'],unbound:['shield','guard','control']},seals:{seed:[],full:[],unbound:[]},
 build:(c,form)=>{
  const hits=pick(form,2,4,8),factor=pick(form,.6,.55,.45);const d=damage({...c,power:c.power*factor},'physical',1,hits);d.powerMode='per_hit';
  if(form==='unbound'){const bleed=child(c,'m-multihit:bleed',[status(c,'m-bleed','流血',{tags:['dot','monster:malice'],duration:round(3),stack:'stack',maxStacks:5,scaleWithStacks:true,tick:{clock:'round',interval:1,count:3,action:child(c,'m-bleed:tick',[typeless(c,pct('hp',.02,'target'))])}})]);d.onHitAction=bleed;d.hitChance=.95;}
  return active(c,pick(form,'双击','连斩','乱舞'),[d],{sp:1,cast:pick(form,500,700,900),tags:['ai:multihit']});
 }};

/* ───────────── F2 多次行动 ───────────── */
const extraAction:Malice={family:'F2',name:'多动',passive:true,
 summary:{seed:'生命过半后每公共轮追加一次行动',full:'每公共轮追加一次行动',unbound:'每公共轮追加两次行动，残血时三次'},
 counter:{seed:['control','burst'],full:['control','burst'],unbound:['control','burst','timer']},seals:{seed:[],full:[],unbound:[]},
 build:(c,form)=>{
  const a=passive(c,pick(form,'残喘多动','多动','狂动'));
  trigger(c,a,'m-extra','round','self',[{op:'atb',mode:'extra',value:pick(form,1,1,2),targeting:self}],form==='seed'?{conditions:[hpBelow(.5)]}:{});
  if(form==='unbound')trigger(c,a,'m-extra-low','round','self',[{op:'atb',mode:'extra',value:1,targeting:self}],{conditions:[hpBelow(.3)]});
  a.description='每公共轮开始时追加行动次数；眩晕/冻结会吃掉整轮，速攻可在残血加动前结束。';return finish(c,a);
 }};

/* ───────────── F3 必中三档：必中≠穿防，穿防单独发放 ───────────── */
const truestrike:Malice={family:'F3',name:'必中',passive:false,
 summary:{seed:'一记必中但威力偏低的攻击',full:'锁定：先把目标闪避压到零，再以必中重击',unbound:'全体必中三连，无视防御状态'},
 counter:{seed:['guard','shield'],full:['guard','break','shield'],unbound:['shield','no_heal','burst']},seals:{seed:['evade'],full:['evade'],unbound:['evade','guard']},
 build:(c,form)=>{
  if(form==='seed'){const d=damage({...c,power:c.power*.7},'physical');d.hitRule='guaranteed';d.hitChance=1;return active(c,'必中一击',[d],{sp:1,tags:['ai:guaranteed']});}
  if(form==='full'){const mark=status(c,'m-lockon','锁定',{duration:round(2),modifiers:[{stat:'evade',flat:-10}]});const d=damage({...c,power:c.power*1.4},'physical');d.hitRule='guaranteed';d.hitChance=1;return active(c,'锁定射击',[mark,d],{sp:2,cast:1500,tags:['ai:guaranteed','ai:charge']});}
  const d=damage({...c,power:c.power*.6},'energy',1,3);d.powerMode='per_hit';d.hitRule='guaranteed';d.hitChance=1;d.bypass=['reduction'];d.targeting=ALL_ENEMIES;
  return active(c,'裁决之矢',[d],{mp:2,cast:1200,targeting:ALL_ENEMIES,tags:['ai:guaranteed','ai:aoe']});
 }};

/* ───────────── F4 百分比 / 固定 / 定血 ───────────── */
const percent:Malice={family:'F4',name:'削减',passive:false,
 summary:{seed:'造成目标当前生命5%的无属性伤害',full:'必中，造成目标最大生命25%的无属性伤害（每战两次）',unbound:'肉体破坏：必中，目标最大生命50%（每战一次）；开战时全体定血至1%（不致死）'},
 counter:{seed:['shield','no_heal'],full:['shield','burst'],unbound:['shield','undying','burst']},seals:{seed:[],full:[],unbound:['evade']},
 build:(c,form)=>{
  if(form==='seed')return active(c,'削减',[typeless(c,{currentResource:'hp',currentFraction:.05,subject:'target'})],{sp:1,tags:['ai:percent']});
  if(form==='full')return active(c,'重削',[typeless(c,pct('hp',.25,'target'),{guaranteed:true})],{sp:2,uses:2,cast:800,tags:['ai:percent','ai:guaranteed']});
  const a=active(c,'肉体破坏',[typeless(c,pct('hp',.5,'target'),{guaranteed:true})],{sp:3,uses:1,cast:1000,tags:['ai:percent','ai:guaranteed']});
  if(c.m.role==='Boss'&&c.stage>=7){const open=typeless(c,{currentResource:'hp',currentFraction:.99,subject:'target'},{guaranteed:true,lethal:false});open.targeting=ALL_ENEMIES;a.triggers=[{id:'m-whiteshock',event:'battle_start',scope:'self',action:child(c,'m-whiteshock',[open]),uses:1,cooldownMs:0}];a.description='开战时“白之冲击”：全体当前生命削至1%（不致死，可被护盾吸收），随后正常行动。';}
  return finish(c,a);
 }};

/* ───────────── F6 蓄力→大招：读条即窗口，形态越高窗口越窄 ───────────── */
const charge:Malice={family:'F6',name:'蓄力',passive:false,
 summary:{seed:'长读条后全体重击；读条可被打断，被打断后自身易伤一轮',full:'中读条后全体必中重击；仅重击/控制类能打断',unbound:'短读条后全体必中重击，且读条不可打断'},
 counter:{seed:['break','guard','shield'],full:['hard_break','guard','shield'],unbound:['guard','shield','burst']},seals:{seed:[],full:['break'],unbound:['break']},
 build:(c,form)=>{
  const d=damage({...c,power:c.power*pick(form,2.2,2.6,3)},'physical');d.targeting=ALL_ENEMIES;if(form!=='seed'){d.hitRule='guaranteed';d.hitChance=1;}
  const a=active(c,pick(form,'蓄力·重压','蓄力·霸王','蓄力·灭岚'),[d],{sp:2,cast:pick(form,3500,2200,1500),targeting:ALL_ENEMIES,tags:['ai:charge','ai:aoe']});
  a.refundOnInterrupt=0;a.recoveryFactor=1.5;
  if(form==='unbound')a.triggers=[{id:'m-charge-armor',event:'battle_start',scope:'self',action:child(c,'m-charge-armor',[selfRule('uninterruptible','*')],'self'),uses:1,cooldownMs:0}];
  a.description=pick(form,'长读条（3.5秒）全体重击；读条期间任何打断都能取消它。','读条（2.2秒）全体必中重击；只有重击/控制类打断有效。','短读条（1.5秒）全体必中重击，读条不可打断：只能防御、护盾或在读条完成前打空。');
  return finish(c,a);
 }};

/* ───────────── F8 复活 / 死守 / 羞辱线 ───────────── */
const undying:Malice={family:'F8',name:'不死',passive:true,
 summary:{seed:'倒下时以30%生命站起（每战一次）',full:'倒下时以50%生命复活并清除负面、强化一阶（每战一次）；濒死时死守两轮不倒，伤害翻倍并追加行动，两轮后必然倒下',unbound:'复活两次，每次强化；最后一次复活后把全体敌人生命打到1'},
 counter:{seed:['burst','dot'],full:['timer','burst','control'],unbound:['timer','burst','control']},seals:{seed:[],full:[],unbound:['undying']},
 build:(c,form)=>{
  const a=passive(c,pick(form,'不倒','再起','三度再起'));
  const rise:EffectSpec[]=[{op:'dispel',mode:'remove',polarity:'negative',count:99,targeting:self}];
  if(form!=='seed')rise.push(buff(c,'m-risen','再起',{duration:permanent,dispellable:false,stack:'stack',maxStacks:3,scaleWithStacks:true,modifiers:[...dmgMods(1.2),{stat:'speed',multiplier:1.1}]}));
  const riseKey=child(c,'m-rise',rise,'self');
  a.effects.push(selfRule('death_guard','*',permanent,{uses:1,amount:pct('hp',pick(form,.3,.5,.5)),onTrigger:riseKey}));
  if(form==='unbound'){const humble:EffectSpec={op:'resource',resource:'hp',mode:'set',amount:flat(1),lethal:false,targeting:ALL_ENEMIES};a.effects.push(selfRule('death_guard','*',permanent,{uses:1,amount:pct('hp',.5),onTrigger:child(c,'m-rise-last',[...rise,humble],'self'),priority:-3}));}
  if(form!=='seed'){
   const doom=child(c,'m-laststand:end',[typeless(c,pct('hp',10),{bypass:['death_guard','shield'],guaranteed:true})],'self');
   const stand=buff(c,'m-laststand','死守',{duration:round(2),dispellable:false,priority:60,tags:['monster:phase','visual:red'],onExpire:doom,modifiers:dmgMods(2),triggers:[{id:'m-laststand-extra',event:'round',scope:'self',action:child(c,'m-laststand:extra',[{op:'atb',mode:'extra',value:1,targeting:self}],'self'),uses:0,cooldownMs:0}]});
   const standKey=child(c,'m-laststand',[selfRule('undying','*',round(2)),stand],'self');
   a.effects.push(selfRule('death_guard','*',permanent,{uses:1,amount:flat(1),onTrigger:standKey,priority:-5}));
  }
  a.description='免死与复活按顺序消耗；死守期间头顶倒计时两轮，倒计时结束必然倒下。速攻可在触发前打空，控制可吃掉死守的追加行动。';return finish(c,a);
 }};

/* ───────────── F9 回血 ───────────── */
const regen:Malice={family:'F9',name:'再生',passive:true,
 summary:{seed:'每公共轮回复5%最大生命',full:'每公共轮回复10%最大生命',unbound:'每公共轮回复20%最大生命；生命过半时改为回满'},
 counter:{seed:['no_heal','dot'],full:['no_heal','dot','burst'],unbound:['no_heal','burst']},seals:{seed:[],full:[],unbound:[]},
 build:(c,form)=>{
  const a=passive(c,pick(form,'再生','强再生','不朽再生'));
  trigger(c,a,'m-regen','round','self',[{op:'heal',resource:'hp',amount:pct('hp',pick(form,.05,.1,.2)),targeting:self}]);
  if(form==='unbound')trigger(c,a,'m-regen-full','round','self',[{op:'heal',resource:'hp',amount:pct('hp',1),targeting:self}],{conditions:[hpAbove(.5)]});
  a.description='上半管只有爆发算数；虚弱/禁疗/持续伤害压回复。';return finish(c,a);
 }};

/* ───────────── F10 限伤 ───────────── */
const cap:Malice={family:'F10',name:'限伤',passive:true,
 summary:{seed:'每公共轮承伤不超过最大生命50%',full:'每公共轮承伤不超过35%',unbound:'每公共轮承伤不超过25%，且暴击无效'},
 counter:{seed:['dot','percent'],full:['dot','percent'],unbound:['dot','percent','timer']},seals:{seed:['burst'],full:['burst'],unbound:['burst']},
 build:(c,form)=>{
  const mods:ModifierSpec[]=form==='unbound'?[{stat:'crit',flat:-1}]:[];
  const a=passive(c,pick(form,'限伤','厚限伤','铁限伤'),[aura(c,'m-cap','限伤',{reactions:[{kind:'damage_cap',fraction:pick(form,.5,.35,.25),reset:'round',channels:['physical','energy','mental','true']}],...(mods.length?{modifiers:mods}:{})})]);
  a.description='限伤按公共轮结算：多段小额与持续伤害绕不过上限，但能把每轮打满；拖长回合会撞上倒计时类机制。';return finish(c,a);
 }};

/* ───────────── F5 领域：改写玩家能按哪个键（不可驱散、开战即放） ───────────── */
type Arena={id:string;name:string;summary:string;counter:CounterTag[];seals:CounterTag[];build:(c:Ctx)=>EffectSpec[]};
export const ARENAS:Arena[]=[
 {id:'windless',name:'无风领域',summary:'敌人不能使用指令（普攻/防御），闪避归零',counter:['skill','dot','percent'],seals:['command','evade'],build:c=>[enemyRule('seal_category','command'),{...status(c,'m-arena-windless','无风',{duration:permanent,dispellable:false,modifiers:[{stat:'evade',flat:-1}]}),targeting:ALL_ENEMIES}]},
 {id:'lion',name:'狮子奋迅',summary:'敌人不能使用技能与法术，每轮防御与闪避递减',counter:['command','guard'],seals:['skill'],build:c=>[enemyRule('seal_category','skill'),enemyRule('seal_category','spell'),{...status(c,'m-arena-lion','奋迅',{duration:permanent,dispellable:false,stack:'stack',maxStacks:8,scaleWithStacks:true,modifiers:[{stat:'evade',flat:-.1},{stat:'reduction_physical',multiplier:.92},{stat:'reduction_energy',multiplier:.92}]}),targeting:ALL_ENEMIES}]},
 {id:'sanctum',name:'圣域',summary:'敌人每轮失去10%最大生命，且不能使用道具',counter:['no_heal','burst','dot'],seals:['timer'],build:c=>[enemyRule('seal_category','item'),{...status(c,'m-arena-sanctum','圣域侵蚀',{duration:permanent,dispellable:false,tick:{clock:'round',interval:1,count:99,action:child(c,'m-arena-sanctum:tick',[typeless(c,pct('hp',.1,'target'),{bypass:['shield']})])}}),targeting:ALL_ENEMIES}]},
 {id:'unseen',name:'不可视领域',summary:'自身闪避大幅提升，敌人每轮增益被剥除',counter:['guaranteed','dot','fear'],seals:['dispel'],build:c=>{const a=aura(c,'m-arena-unseen','不可视',{modifiers:[{stat:'evade',flat:.6}],triggers:[{id:'m-arena-unseen-strip',event:'round',scope:'self',action:child(c,'m-arena-unseen:strip',[{op:'dispel',mode:'remove',polarity:'positive',count:99,targeting:ALL_ENEMIES}],'self'),uses:0,cooldownMs:0}]});return [a];}},
 {id:'hymn',name:'唱声领域',summary:'敌人攻击力近乎归零且治疗无效',counter:['percent','dot'],seals:['no_heal'],build:c=>[enemyRule('no_heal','*'),{...status(c,'m-arena-hymn','失声',{duration:permanent,dispellable:false,modifiers:dmgMods(.1)}),targeting:ALL_ENEMIES}]},
 {id:'meltdown',name:'熔毁领域',summary:'敌人最大生命减半，暴击无效',counter:['shield','guard'],seals:['burst'],build:c=>[{...status(c,'m-arena-meltdown','熔毁',{duration:permanent,dispellable:false,modifiers:[{stat:'max_hp',multiplier:.5},{stat:'crit',flat:-1}]}),targeting:ALL_ENEMIES}]},
 {id:'blackwolf',name:'罪裁领域',summary:'敌人对本怪主题属性的抗性被改写为弱点，闪避下降',counter:['guard','shield'],seals:['evade'],build:c=>{const t=themeType(c.t)==='无'?'暗':themeType(c.t);return [{...status(c,'m-arena-blackwolf','罪裁',{duration:permanent,dispellable:false,modifiers:[{stat:'element',element:t,multiplier:1.5},{stat:'evade',flat:-.3}]}),targeting:ALL_ENEMIES}];}},
];
export const arenaAction=(c:Ctx,arena:Arena):ActionSpec=>{const a=passive(c,arena.name,arena.build(c));a.tags=['monster:malice','monster:arena'];a.description='领域：'+arena.summary+'。开战即展开，不可驱散、不可解除。';return finish(c,a);};

/* ───────────── F7 阶段=新规则包 ───────────── */
export function phasePack(c:Ctx,style:'red'|'afterimage'):ActionSpec{
 const boss=style==='red';const a=passive(c,boss?'第二阶段·血色':'第二阶段·重影');
 const form=buff(c,'phase-2',boss?'血色形态':'重影形态',{duration:permanent,dispellable:false,priority:50,tags:['monster:phase','visual:'+style],modifiers:boss?[...dmgMods(1.15),{stat:'check_spirit',flat:4}]:[{stat:'evade',flat:.15},...dmgMods(1.1)]});
 const effects:EffectSpec[]=[form,{op:'dispel',mode:'remove',polarity:'negative',count:99,targeting:self},{op:'dispel',mode:'remove',polarity:'positive',count:99,targeting:ALL_ENEMIES},selfRule('immune_status','*',round(2)),{op:'atb',mode:'push',value:50,targeting:self}];
 const notes=['清除自身负面','剥除敌人全部增益','两轮免疫状态'];
 if(c.stage>=4){effects.push({op:'atb',mode:'extra',value:1,targeting:self});notes.push('立即追加一次行动');}
 if(c.stage>=5){effects.push(minion(c,'phase-adds',.3,2));notes.push('召唤两名衍生体');}
 if(c.stage>=6){effects.push({op:'heal',resource:'hp',amount:pct('hp',boss?1:.5),targeting:self});notes.push(boss?'生命回满（仅此一次，虚弱可挡）':'回复50%生命');}
 trigger(c,a,'phase-shift','damage_received','self',effects,{uses:1,cooldownMs:0,conditions:[hpBelow(.5)]});
 a.description='生命降至50%时进入'+(boss?'血色形态（立绘蒙红）':'重影形态')+'：'+notes.join('、')+'。每战一次，不可驱散；在血线前一口气打空可跳过。';
 return finish(c,a);
}

/* ───────────── F11 杂兵关系 ───────────── */
const adds:Malice={family:'F11',name:'衍生',passive:true,
 summary:{seed:'开战召唤两名衍生体，衍生体倒下后会再次出现',full:'衍生体倒下时增殖为两名（上限六）',unbound:'衍生体倒下时本体追加行动并强化'},
 counter:{seed:['ignore_adds','burst'],full:['ignore_adds','burst'],unbound:['ignore_adds','control']},seals:{seed:[],full:[],unbound:[]},
 build:(c,form)=>{
  const a=passive(c,pick(form,'衍生','增殖','逆援'),[minion(c,'m-adds',.25,2)]);
  c.lib.summons['m-adds']!.limit=pick(form,2,6,3);c.lib.summons['m-adds']!.duration=round(9);
  trigger(c,a,'m-adds-respawn','after_down','ally',[minion(c,'m-adds',.25,pick(form,1,2,1))],{uses:pick(form,3,3,4),cooldownMs:0});
  if(form==='unbound')trigger(c,a,'m-adds-avenge','after_down','ally',[{op:'atb',mode:'extra',value:1,targeting:self},buff(c,'m-adds-rage','逆援',{duration:round(3),stack:'stack',maxStacks:3,scaleWithStacks:true,modifiers:dmgMods(1.15)})],{uses:4,cooldownMs:0});
  a.description='衍生体在本体倒下时一并消失；打杂兵会被增殖/逆援惩罚，优先打本体。';return finish(c,a);
 }};

/* ───────────── F12 倒计时 / 短战检查 ───────────── */
const timer:Malice={family:'F12',name:'倒计时',passive:false,
 summary:{seed:'粘着炸弹：五轮后爆炸，造成目标最大生命60%的伤害（防御可减）',full:'原型：开战起八轮倒计时，到期对全体处决；生命降至75%以下时倒计时重置一次',unbound:'第三轮起，本怪的每次命中都会处决目标'},
 counter:{seed:['timer','guard','shield'],full:['burst','undying','timer'],unbound:['burst','evade','undying']},seals:{seed:[],full:['timer'],unbound:['timer']},
 build:(c,form)=>{
  if(form==='seed'){const bd=damage(c,'physical',0);bd.amounts.physical=pct('hp',.6,'target');bd.hitChance=1;bd.hitRule='guaranteed';const boom=child(c,'m-bomb:boom',[bd]);return active(c,'粘着炸弹',[status(c,'m-bomb','粘着炸弹',{duration:round(5),dispellable:true,onExpire:boom})],{sp:1,uses:2,tags:['ai:timer']});}
  const a=passive(c,form==='full'?'倒计时·原型':'倒计时·坠落');
  if(form==='full'){
   const exec=typeless(c,pct('hp',1,'target'),{guaranteed:true,execute:true,bypass:['shield']});exec.targeting=ALL_ENEMIES;const doom=child(c,'m-doom:exec',[exec]);
   const clock=buff(c,'m-doom','倒计时',{duration:round(8),dispellable:false,priority:70,tags:['monster:timer'],onExpire:doom});
   a.effects.push(clock);trigger(c,a,'m-doom-reset','damage_received','self',[clock],{uses:1,cooldownMs:0,conditions:[hpBelow(.75)]});
   a.description='头顶倒计时八轮，到期全体处决（无视免死以外的保护）；生命降至75%以下时重置一次。唯一解：在到期前打空，或以不死类效果硬接。';
  }else{
   const exec=typeless(c,pct('hp',1,'target'),{guaranteed:true,execute:true});exec.targeting=EVENT_TARGET;
   const lethal=buff(c,'m-fall-lethal','坠落判决',{duration:permanent,dispellable:false,priority:70,tags:['monster:timer'],triggers:[{id:'m-fall-hit',event:'hit',scope:'self',action:child(c,'m-fall:exec',[exec]),uses:0,cooldownMs:0}]});
   const arm=buff(c,'m-fall-arm','坠落倒计时',{duration:round(3),dispellable:false,priority:70,tags:['monster:timer'],onExpire:child(c,'m-fall:arm',[lethal],'self')});
   a.effects.push(arm);a.description='三轮后进入坠落判决：本怪的每次命中都会处决目标。这是短战检查：三轮内打空，或全程闪避。';
  }
  return finish(c,a);
 }};

/* ───────────── F14 读取与反读取 ───────────── */
const reader:Malice={family:'F14',name:'读取',passive:{full:true},
 summary:{seed:'一种控制不在“全异常免疫”之内：麻痹会拆掉目标的防御与闪避',full:'反魂：敌人出现不死/免死类增益时，本怪下一动必然剥除它（这会占用它整轮）',unbound:'模仿：复制敌人上一次使用的技能并立即使用'},
 counter:{seed:['dispel','burst'],full:['timer','burst'],unbound:['control','burst']},seals:{seed:[],full:['undying'],unbound:[]},
 build:(c,form)=>{
  if(form==='seed'){const numb=status(c,'m-paralyze','麻痹',{duration:round(1),control:'stun',tags:['monster:status','monster:malice','malice:paralyze'],modifiers:[{stat:'evade',flat:-1},{stat:'reduction_physical',multiplier:1.3}]});const d=damage({...c,power:c.power*.8},'energy');return active(c,'电击五芒星',[d,numb],{mp:1,cast:700,tags:['ai:control']});}
  if(form==='full'){const a=passive(c,'反魂');trigger(c,a,'m-unsong','round','self',[{op:'dispel',mode:'remove',polarity:'positive',count:1,includeUndispellable:true,targeting:ALL_ENEMIES}]);a.description='读取：每公共轮剥除全体敌人最强的一项增益（含不可驱散的保命类）。反读取：它只剥一项，用低价值增益垫在前面。';return finish(c,a);}
  return active(c,'模仿',[{op:'copy',mode:'skill',id:'*',selection:'used_latest',activate:true,duration:round(1),targeting:RANDOM_ENEMY(1)}],{mp:2,cast:600,tags:['ai:mimic']});
 }};

/* ═════════════════ 0.31 通用原创家族 G1–G12 ═════════════════
 *  与 F 系同构：三档形态、counter/seals、build(c,form)。数值全部是 scale(tier) 函数（§0.5 铁律：百分比按最大 HP，≥15% 起步，随层级线性增长）。
 *  对玩家的持续效应只用 battle 作用域（本场）或 run 作用域（本次迷宫），不写 permanent。 */
export const ENEMY_HIGHEST_HP={side:'enemy',selection:'highest_resource',resource:'hp',count:1,life:'alive'} as const;
export const EVENT_SOURCE={side:'event_source',selection:'all',life:'alive'} as const;
/** 线性层级缩放：t3 取 lo，t7 取 hi，两端夹紧。 */
export const scale=(c:Ctx,lo:number,hi:number)=>lo+(hi-lo)*Math.max(0,Math.min(1,(c.stage-3)/4));
export const sourceHas=(statusKey:string):ConditionSpec=>condition('event_source','status',statusKey,1,'gte');
export const isCrit:ConditionSpec={kind:'critical',value:1,compare:'gte'};
export const isSkill:ConditionSpec={kind:'category',key:'command',value:1,compare:'gte',invert:true};
/** 失控（§2.3）：控制类 charm，阵营临时反转并由怪物 AI 代打；1–2 轮，刷新不叠加。T01/G10 共用。 */
export function lossOfControl(c:Ctx,rounds:number):EffectSpec{return status(c,'m-charm','失控',{tags:['monster:status','monster:malice','control:charm'],control:'charm',duration:round(rounds),stack:'refresh',maxStacks:1,priority:40});}

/* ───────────── G1 回声债：受到的伤害按比例回声打向攻击者 ───────────── */
const echo:Malice={family:'G1',name:'回声债',passive:true,
 summary:{seed:'它受到的伤害有25%回声打向攻击者',full:'它受到的伤害有50%回声打向攻击者',unbound:'它受到的伤害有75%回声打向攻击者，回声必中且无视护盾'},
 counter:{seed:['dot','percent'],full:['dot','percent','guard'],unbound:['dot','percent','undying']},seals:{seed:['burst'],full:['burst'],unbound:['burst']},
 build:(c,form)=>{
  const a=passive(c,pick(form,'回声','回声债','回声审判'));
  // 0.34：真正的“2 轮后回声”——把这次伤害量记入变量，延迟动作随变量一起排期，2 轮后按变量结算。
  const back=typeless(c,{...flat(0),expression:[{read:'variable',key:'g1-echo'}]},form==='unbound'?{guaranteed:true,bypass:['shield']}:{guaranteed:true});
  const echoHit=child(c,'m-echo:hit',[back]);
  trigger(c,a,'m-echo','damage_received','self',[{op:'variable',key:'g1-echo',mode:'set',value:[{read:'event',key:'actual'},{constant:pick(form,.25,.5,.75)},{operator:'mul'}]},{op:'time',mode:'delay',key:'m-echo',duration:round(2),action:echoHit,restore:[],targeting:EVENT_SOURCE}]);
  a.description='它每次受到伤害，都会在两轮之后以回声形式打回攻击者。';return finish(c,a);
 }};

/* ───────────── G2 贪食护盾：吞掉敌人的护盾，转为自身生命 ───────────── */
const devour:Malice={family:'G2',name:'贪食护盾',passive:true,
 summary:{seed:'每轮吞掉一名敌人的护盾，并回复自身最大生命的一部分',full:'每轮吞掉全体敌人的护盾并回血',unbound:'敌人每次行动后其护盾立即被吞'},
 counter:{seed:['guard','evade'],full:['guard','evade','burst'],unbound:['guard','burst','dot']},seals:{seed:['shield'],full:['shield'],unbound:['shield']},
 build:(c,form)=>{
  const a=passive(c,pick(form,'贪食','贪食护盾','饕餮'));const heal=pct('hp',scale(c,.15,.25));
  const eat=(t:typeof ALL_ENEMIES|ReturnType<typeof RANDOM_ENEMY>|typeof EVENT_SOURCE):EffectSpec[]=>[{op:'remove_shield',count:99,targeting:t},{op:'heal',resource:'hp',amount:heal,targeting:self,conditions:[condition('target','shield','*',1,'gte')]}];
  trigger(c,a,'m-devour','round','self',eat(form==='seed'?RANDOM_ENEMY(1):ALL_ENEMIES));
  if(form==='unbound')trigger(c,a,'m-devour-now','action_end','enemy',eat(EVENT_SOURCE));
  a.description='它会吞掉敌人身上的护盾，并把吞掉的部分化为自己的生命。';return finish(c,a);
 }};

/* ───────────── G3 代价转嫁：敌方用技能要额外付最大生命 ───────────── */
const toll:Malice={family:'G3',name:'代价转嫁',passive:true,
 summary:{seed:'敌人每次使用技能，额外失去最大生命的15%',full:'额外失去最大生命的25%，且法力费用加倍',unbound:'额外失去最大生命的35%，法力费用加倍，代价可致死'},
 counter:{seed:['command','shield'],full:['command','shield','no_heal'],unbound:['command','shield']},seals:{seed:['burst'],full:['burst'],unbound:['burst']},
 build:(c,form)=>{
  const a=passive(c,pick(form,'代价','代价转嫁','血税'));
  const bite=typeless(c,pct('hp',pick(form,scale(c,.15,.2),scale(c,.2,.3),scale(c,.3,.4)),'target'),{guaranteed:true,lethal:form==='unbound',bypass:['shield']});bite.targeting=EVENT_SOURCE;
  trigger(c,a,'m-toll','after_cost','enemy',[bite],{conditions:[isSkill]});
  if(form!=='seed')a.effects.push({...status(c,'m-toll-mp','代价',{duration:permanent,dispellable:false,modifiers:[{stat:'cost_mp',multiplier:2}]}),targeting:ALL_ENEMIES});
  a.description='敌人每使用一次技能（指令除外），就要以最大生命的一部分作为代价。';return finish(c,a);
 }};

/* ───────────── G4 逆位：反转敌人的增益 ───────────── */
const invert:Malice={family:'G4',name:'逆位',passive:true,
 summary:{seed:'每轮反转一名敌人身上的一个增益',full:'每轮反转全体敌人的一个增益',unbound:'敌人新获得的增益会立即被反转'},
 counter:{seed:['dispel','burst'],full:['dispel','burst','command'],unbound:['burst','command']},seals:{seed:['buff'],full:['buff'],unbound:['buff']},
 build:(c,form)=>{
  const a=passive(c,pick(form,'倒影','逆位','逆位法庭'));
  const flip=(t:typeof ALL_ENEMIES|ReturnType<typeof RANDOM_ENEMY>|typeof EVENT_TARGET):EffectSpec=>({op:'status_transform',mode:'invert_numeric',polarity:'positive',targeting:t});
  trigger(c,a,'m-invert','round','self',[flip(form==='seed'?RANDOM_ENEMY(1):ALL_ENEMIES)]);
  if(form==='unbound')trigger(c,a,'m-invert-now','after_status','enemy',[flip(EVENT_TARGET)]);
  a.description='敌人的数值型增益会被它翻成反向。';return finish(c,a);
 }};

/* ───────────── G5 封印税：封印敌人最近使用的技能 ───────────── */
const sealTax:Malice={family:'G5',name:'封印税',passive:true,
 summary:{seed:'每轮封印一名敌人最近使用的技能1轮',full:'每轮封印两名敌人最近使用的技能2轮',unbound:'每被暴击一次，额外封印全体敌人最近使用的技能1轮'},
 counter:{seed:['command','burst'],full:['command','burst'],unbound:['command','burst','guaranteed']},seals:{seed:['skill'],full:['skill'],unbound:['skill']},
 build:(c,form)=>{
  const a=passive(c,pick(form,'征税','封印税','重税'));
  const tax=(t:typeof ALL_ENEMIES|ReturnType<typeof RANDOM_ENEMY>,rounds:number):EffectSpec=>({op:'uses',mode:'seal',skill:'*',selection:'used_latest',value:1,duration:round(rounds),targeting:t});
  trigger(c,a,'m-sealtax','round','self',[tax(RANDOM_ENEMY(form==='seed'?1:2),form==='seed'?1:2)]);
  if(form==='unbound')trigger(c,a,'m-sealtax-crit','damage_received','self',[tax(ALL_ENEMIES,1)],{conditions:[isCrit]});
  a.description='敌人最近用过的技能会被它封上一段时间。';return finish(c,a);
 }};

/* ───────────── G6 拖延判决：伤害延迟结算，倍率更高 ───────────── */
const verdict:Malice={family:'G6',name:'拖延判决',passive:false,
 summary:{seed:'一记延迟1轮结算的重击（×1.6）',full:'延迟2轮结算（×2.4）',unbound:'延迟2轮结算，无视护盾与减伤，结算时目标的增益被剥除并转为易伤'},
 counter:{seed:['guard','shield','burst'],full:['guard','shield','burst'],unbound:['burst','undying','evade']},seals:{seed:[],full:[],unbound:[]},
 build:(c,form)=>{
  const d=damage({...c,power:c.power*pick(form,1.6,2.4,2.4)},'physical');d.hitChance=1;d.hitRule='guaranteed';
  const effects:EffectSpec[]=[d];
  if(form==='unbound'){d.bypass=['shield','reduction'];effects.unshift({op:'dispel',mode:'remove',polarity:'positive',count:99},status(c,'m-verdict-vuln','判决易伤',{duration:round(2),modifiers:[{stat:'vulnerability',multiplier:1.5}]}));}
  const land=child(c,'m-verdict:land',effects);
  const a=active(c,pick(form,'延迟判决','拖延判决','终局判决'),[{op:'time',mode:'delay',key:'m-verdict',duration:round(pick(form,1,2,2)),action:land,restore:[]}],{sp:1,cast:600,tags:['ai:charge']});
  a.description='它的这一击不会立刻落下，而是在几轮之后以更高的倍率结算。';return finish(c,a);
 }};

/* ───────────── G7 双生：分裂分身 ───────────── */
const twin:Malice={family:'G7',name:'双生',passive:true,
 summary:{seed:'开战分裂出一个30%生命的分身；分身倒下时本体失去10%最大生命',full:'分身倒下时本体回复30%最大生命',unbound:'每4轮再分裂一次，分身最多3个'},
 counter:{seed:['kill_order','burst'],full:['kill_order','burst','ignore_adds'],unbound:['burst','ignore_adds','dot']},seals:{seed:[],full:['ignore_adds'],unbound:['ignore_adds']},
 build:(c,form)=>{
  const a=passive(c,pick(form,'分身','双生','千面'));
  const strike=child(c,'m-twin:attack',[damage({...c,power:c.power*.5},'physical')]);
  c.lib.summons['m-twin']={name:c.m.motif+'·分身',level:'caster',inheritance:1,resources:{hp:1,mp:1,sp:1},attributes:{力量:0,敏捷:0,体质:0,智力:0,精神:0},actions:[strike],duration:round(12),ownerDeath:'despawn',limit:pick(form,1,1,3),rewardEligible:false,cloneResources:{hp:.3,mp:.3,sp:.3},tags:['monster:minion','monster:twin']};
  const split:EffectSpec={op:'summon',template:'m-twin',count:1,mode:'clone',targeting:self};a.effects.push(split);
  const onDown:EffectSpec=form==='seed'?{...typeless(c,pct('hp',.1),{bypass:['shield','death_guard'],lethal:false}),targeting:self}:{op:'heal',resource:'hp',amount:pct('hp',scale(c,.3,.4)),targeting:self};
  trigger(c,a,'m-twin-down','after_down','ally',[onDown],{conditions:[condition('event_target','tag','monster:twin',1,'gte')]});
  // 0.34：每 4 公共轮再分裂（round mod 4 == 0）。不与顶层共用同一个效果对象（bindLibrary 会就地改写 template 键）。
  if(form==='unbound')trigger(c,a,'m-twin-again','round','self',[{...split}],{conditions:[{kind:'expression',expression:[{read:'round'},{constant:4},{operator:'mod'}],value:0,compare:'eq'}]});
  a.description='它会分裂出与自己同形的分身；分身倒下时会影响本体。';return finish(c,a);
 }};

/* ───────────── G8 恐惧点名：被点名者攻击它会挨等量反伤 ───────────── */
const dread:Malice={family:'G8',name:'恐惧点名',passive:true,
 summary:{seed:'每轮点名一人：该单位本轮攻击它就会受到等量反伤',full:'每轮点名两人',unbound:'点名者受到反伤时，其全队同受一半'},
 counter:{seed:['kill_order','dot'],full:['kill_order','dot','shield'],unbound:['dot','shield','undying']},seals:{seed:['burst'],full:['burst'],unbound:['burst']},
 build:(c,form)=>{
  const a=passive(c,pick(form,'点名','恐惧点名','连坐'));
  const mark=status(c,'m-dread','被点名',{duration:round(1),tags:['monster:status','monster:malice','malice:dread']});
  trigger(c,a,'m-dread-call','round','self',[{...mark,targeting:RANDOM_ENEMY(form==='seed'?1:2)}]);
  const back=typeless(c,{eventFraction:1},{guaranteed:true});back.targeting=EVENT_SOURCE;const effects:EffectSpec[]=[back];
  if(form==='unbound'){const all=typeless(c,{eventFraction:.5},{guaranteed:true});all.targeting=ALL_ENEMIES;effects.push(all);}
  trigger(c,a,'m-dread-back','damage_received','self',effects,{conditions:[sourceHas('m-dread')]});
  a.description='被它点到名字的人，这一轮对它造成的伤害会原样落回自己身上。';return finish(c,a);
 }};

/* ───────────── G9 饥渴：敌方的治疗被它截走 ───────────── */
const thirst:Malice={family:'G9',name:'饥渴',passive:true,
 summary:{seed:'敌人每次受到治疗，它获得等于治疗量一半的护盾',full:'敌人的治疗有一半改为治疗它',unbound:'敌人的治疗全部改为治疗它'},
 counter:{seed:['burst','shield'],full:['burst','dot'],unbound:['burst','dot','percent']},seals:{seed:[],full:['no_heal'],unbound:['no_heal']},
 build:(c,form)=>{
  const a=passive(c,pick(form,'渴','饥渴','吸食'));
  if(form==='seed')trigger(c,a,'m-thirst','after_heal','enemy',[{op:'shield',amount:{...flat(0),eventFraction:.5},channels:['physical','energy','mental','true'],duration:round(3),stack:'refresh',targeting:self}]);
  else if(form==='full')trigger(c,a,'m-thirst','before_heal','enemy',[{op:'alter_event',mode:'scale',value:[{constant:.5}]},{op:'heal',resource:'hp',amount:{...flat(0),eventFraction:.5},targeting:self}]);
  else trigger(c,a,'m-thirst','before_heal','enemy',[{op:'alter_event',mode:'redirect',recipient:'caster'}]);
  a.description='敌人的治疗会被它截走一部分甚至全部。';return finish(c,a);
 }};

/* ───────────── G10 凝视：被凝视者施法变慢、行动后退条、乃至失控 ───────────── */
const gaze:Malice={family:'G10',name:'凝视',passive:true,
 summary:{seed:'每轮凝视一人：其施法时间加倍',full:'凝视者每轮更换，行动后行动条退30',unbound:'被凝视者使用技能后失控1轮'},
 counter:{seed:['command','burst'],full:['command','burst','dispel'],unbound:['command','burst']},seals:{seed:[],full:[],unbound:['control']},
 build:(c,form)=>{
  const a=passive(c,pick(form,'注视','凝视','深渊凝视'));
  const eye=status(c,'m-gaze','被凝视',{duration:round(1),tags:['monster:status','monster:malice','malice:gaze'],modifiers:[{stat:'cast_speed',multiplier:.5}]});
  trigger(c,a,'m-gaze-pick','round','self',[{...eye,targeting:RANDOM_ENEMY(1)}]);
  if(form!=='seed')trigger(c,a,'m-gaze-drag','action_end','enemy',[{op:'atb',mode:'retreat',value:30,targeting:EVENT_SOURCE}],{conditions:[sourceHas('m-gaze')]});
  if(form==='unbound')trigger(c,a,'m-gaze-charm','action_end','enemy',[{...lossOfControl(c,1),targeting:EVENT_SOURCE}],{conditions:[sourceHas('m-gaze'),isSkill]});
  a.description='被它凝视的人施法迟缓；形态越高，凝视带来的后果越重。';return finish(c,a);
 }};

/* ───────────── G11 同归：倒下时拉人垫背 ───────────── */
const mutual:Malice={family:'G11',name:'同归',passive:true,
 summary:{seed:'倒下时对击杀者造成其最大生命30%的伤害',full:'倒下时对全体敌人造成最大生命30%的伤害',unbound:'倒下时对全体敌人造成最大生命60%的伤害并眩晕1轮'},
 counter:{seed:['shield','guard'],full:['shield','guard','undying'],unbound:['shield','undying']},seals:{seed:[],full:[],unbound:[]},
 build:(c,form)=>{
  const a=passive(c,pick(form,'同归','同归于尽','葬礼'));
  const blast=typeless(c,pct('hp',pick(form,scale(c,.3,.4),scale(c,.3,.45),scale(c,.5,.6)),'target'),{guaranteed:true});blast.targeting=form==='seed'?EVENT_SOURCE:ALL_ENEMIES;
  const effects:EffectSpec[]=[blast];
  if(form==='unbound')effects.push({...status(c,'m-mutual-stun','葬礼眩晕',{duration:round(1),control:'stun'}),targeting:ALL_ENEMIES});
  trigger(c,a,'m-mutual','before_down','self',effects,{uses:1});
  a.description='它倒下的瞬间会把敌人一并拖进去。';return finish(c,a);
 }};

/* ───────────── G12 借命：残血时从最厚血的敌人身上夺命 ───────────── */
const borrow:Malice={family:'G12',name:'借命',passive:true,
 summary:{seed:'生命低于30%时，从生命最高的敌人处夺取其最大生命30%（等量回复自己）',full:'之后每轮再夺取一名敌人最大生命的20%',unbound:'每轮夺取全体敌人最大生命的20%，夺来的部分叠为自己的最大生命'},
 counter:{seed:['burst','shield'],full:['burst','shield','no_heal'],unbound:['burst','no_heal']},seals:{seed:['burst'],full:['burst'],unbound:['burst']},
 build:(c,form)=>{
  const a=passive(c,pick(form,'借命','续命','夺命'));
  const drain=(fraction:number,t:typeof ALL_ENEMIES|typeof ENEMY_HIGHEST_HP|ReturnType<typeof RANDOM_ENEMY>)=>{const d=typeless(c,pct('hp',fraction,'target'),{guaranteed:true,bypass:['shield']});d.drain={resource:'hp',fraction:1,basis:'actual'};d.targeting=t;return d;};
  const first:EffectSpec[]=[drain(scale(c,.3,.4),ENEMY_HIGHEST_HP)];
  if(form!=='seed'){
   const grow:EffectSpec[]=form==='unbound'?[buff(c,'m-borrow-grow','夺命累积',{duration:permanent,dispellable:false,stack:'stack',maxStacks:99,scaleWithStacks:true,modifiers:[{stat:'max_hp',multiplier:1.1}]})]:[];
   const per=child(c,'m-borrow:tick',[drain(scale(c,.2,.25),form==='unbound'?ALL_ENEMIES:RANDOM_ENEMY(1)),...grow]);
   first.push(buff(c,'m-borrow-mode','借命',{duration:permanent,dispellable:false,priority:30,triggers:[{id:'m-borrow-round',event:'round',scope:'self',action:per,uses:0,cooldownMs:0}]}));
  }
  trigger(c,a,'m-borrow','damage_received','self',first,{uses:1,conditions:[hpBelow(.3)]});
  a.description='血线被压低时，它会从敌人身上直接夺走生命补回自己。';return finish(c,a);
 }};

export const MALICE:Record<string,Malice>={multihit,extra:extraAction,truestrike,percent,charge,undying,regen,cap,adds,timer,reader,echo,devour,toll,invert,sealTax,verdict,twin,dread,thirst,gaze,mutual,borrow};
export const MALICE_BY_FAMILY:Partial<Record<Family,string>>={F1:'multihit',F2:'extra',F3:'truestrike',F4:'percent',F6:'charge',F8:'undying',F9:'regen',F10:'cap',F11:'adds',F12:'timer',F14:'reader',G1:'echo',G2:'devour',G3:'toll',G4:'invert',G5:'sealTax',G6:'verdict',G7:'twin',G8:'dread',G9:'thirst',G10:'gaze',G11:'mutual',G12:'borrow'};
