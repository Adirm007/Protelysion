/** 标准状态库（booksea-blueprint/1）：蓝图按名称/别名引用，降级时注入到能力 library。
 * 所有数值都是有界的通用模板；蓝图可以覆盖持续、层数、每层数值、可否驱散。
 * 百分比伤害按持有者最大生命计算，与宿主层级数值自然同尺度。 */
import type {ModifierSpec,ReactionSpec,StatusSpec,ActionSpec,EffectSpec,AmountSpec} from '../contract';

export type StdControl=NonNullable<StatusSpec['control']>;
export type StdStatus={
 name:string;aliases:string[];polarity:StatusSpec['polarity'];desc:string;
 control?:StdControl;mods?:ModifierSpec[];reactions?:ReactionSpec[];
 /** 每回合按持有者最大生命的比例造成真实伤害（每层）。 */
 dot?:number;dotChannel?:'true'|'physical'|'energy'|'mental';
 /** 每回合按持有者最大生命恢复（每层）。 */
 hot?:number;hotResource?:'hp'|'mp'|'sp';
 turns:number;stack?:'refresh'|'stack';maxStacks?:number;dispellable?:boolean;breakOnDamage?:boolean;
 /** 下一次攻击/受击后自动移除（消耗型状态）。 */
 consumeOn?:'attack'|'damaged';
 tags?:string[];
};
const m=(stat:ModifierSpec['stat'],x:{flat?:number;multiplier?:number}):ModifierSpec=>({stat,...x});
const allReduction=(mult:number):ModifierSpec[]=>(['reduction_physical','reduction_energy','reduction_mental'] as const).map(s=>m(s,{multiplier:mult}));
const allDamage=(mult:number):ModifierSpec[]=>(['damage_physical','damage_energy','damage_mental','damage_true'] as const).map(s=>m(s,{multiplier:mult}));
const checks=(flat:number):ModifierSpec[]=>(['check_strength','check_agility','check_constitution','check_intelligence','check_spirit'] as const).map(s=>m(s,{flat}));

export const STD_STATUSES:StdStatus[]=[
 // ── 控制 ──
 {name:'眩晕',aliases:['晕眩','昏迷','击晕','震慑'],polarity:'negative',control:'stun',turns:1,desc:'无法行动'},
 {name:'冻结',aliases:['冰冻','冰封','凍結'],polarity:'negative',control:'freeze',turns:1,mods:[m('vulnerability',{multiplier:1.1})],desc:'无法行动，受到伤害+10%'},
 {name:'睡眠',aliases:['沉睡','催眠','昏睡','入睡'],polarity:'negative',control:'sleep',turns:2,breakOnDamage:true,desc:'无法行动，受到伤害时醒来'},
 {name:'石化',aliases:['石化状态'],polarity:'negative',control:'petrify',turns:2,mods:allReduction(.5),desc:'无法行动，受到的物理/能量/精神伤害-50%'},
 {name:'击倒',aliases:['倒地','击飞','浮空','跌倒','摔倒'],polarity:'negative',control:'knockdown',turns:1,mods:[m('evade',{flat:-.3})],desc:'失去下一次行动，闪避-30%'},
 {name:'定身',aliases:['禁锢','禁足','定住','钉住','缠绕'],polarity:'negative',control:'bind',turns:2,mods:[m('evade',{flat:-.3}),m('speed',{multiplier:.8})],desc:'无法位移，闪避-30%，速度-20%'},
 {name:'束缚',aliases:['捆绑','锁链','拘束','缚','绑缚'],polarity:'negative',control:'bind',turns:2,mods:[m('evade',{flat:-.2}),m('speed',{multiplier:.7}),m('hit',{flat:-.1})],desc:'无法位移，速度-30%，闪避-20%，命中-10%'},
 {name:'沉默',aliases:['禁言','封口','失声'],polarity:'negative',control:'silence',turns:2,desc:'无法施放法术'},
 {name:'缴械',aliases:['卸除武装','武器封印','解除武装'],polarity:'negative',control:'disarm',turns:2,desc:'无法使用非法术攻击'},
 {name:'恐惧',aliases:['惊恐','畏惧','恐慌','害怕'],polarity:'negative',control:'fear',turns:2,mods:checks(-2),desc:'无法主动攻击敌人，检定-2'},
 {name:'混乱',aliases:['错乱','迷乱','精神错乱'],polarity:'negative',control:'confusion',turns:2,desc:'随机选择目标（可能攻击同伴）'},
 {name:'狂乱',aliases:['失控','暴走','发狂','狂暴化','理智崩溃'],polarity:'negative',control:'confusion',turns:2,mods:[...allDamage(1.25),...allReduction(1.15)],desc:'随机选择目标，造成伤害+25%，受到伤害+15%'},
 {name:'魅惑',aliases:['魅了','迷恋','心智控制','支配','洗脑','思想钢印'],polarity:'negative',control:'charm',turns:2,desc:'暂时倒戈，为施加者一方作战'},
 {name:'嘲讽',aliases:['挑衅','吸引仇恨','强制攻击'],polarity:'negative',control:'taunt',turns:2,desc:'只能以施加者为目标'},
 {name:'变形',aliases:['变羊','驴头','兽化诅咒','异形化'],polarity:'negative',control:'polymorph',turns:2,mods:[m('智力',{multiplier:.5}),m('精神',{multiplier:.5})],desc:'只能普通攻击/防御，智力与精神减半'},
 {name:'时停',aliases:['时间停止','时间静止','凝滞'],polarity:'negative',control:'time_stop',turns:1,desc:'时间被冻结，无法行动'},
 {name:'目盲',aliases:['致盲','失明','黑暗','盲目'],polarity:'negative',control:'no_action',turns:2,mods:[m('hit',{flat:-.35})],desc:'只能攻击（无法进行[动作]），命中-35%'},
 {name:'禁动',aliases:['禁止动作','无法动作','行动封锁'],polarity:'negative',control:'no_action',turns:2,desc:'无法进行[动作]，只能攻击'},
 {name:'麻痹',aliases:['麻木','瘫痪','痉挛'],polarity:'negative',turns:2,mods:[m('speed',{multiplier:.5}),m('evade',{flat:-.2})],desc:'速度-50%，闪避-20%'},
 {name:'迟缓',aliases:['减速','缓慢','迟钝','泥泞','拖慢'],polarity:'negative',turns:2,mods:[m('speed',{multiplier:.7})],desc:'速度-30%'},
 {name:'隔离',aliases:['放逐','封闭空间'],polarity:'negative',control:'isolate',turns:1,desc:'被隔离出战场'},
 // ── 持续伤害 ──
 {name:'中毒',aliases:['毒','毒素','毒性','染毒'],polarity:'negative',dot:.03,turns:3,stack:'stack',maxStacks:10,desc:'每回合受到最大生命3%真实伤害/层'},
 {name:'剧毒',aliases:['猛毒','致命毒素','神经毒素'],polarity:'negative',dot:.06,turns:3,stack:'stack',maxStacks:5,mods:[m('heal_received',{multiplier:.7})],desc:'每回合受到最大生命6%真实伤害/层，受到治疗-30%'},
 {name:'流血',aliases:['出血','失血','撕裂','割伤','血流不止'],polarity:'negative',dot:.04,turns:3,stack:'stack',maxStacks:10,desc:'每回合受到最大生命4%真实伤害/层'},
 {name:'烧伤',aliases:['灼烧','燃烧','点燃','灼伤','焚烧','火焰附着'],polarity:'negative',dot:.05,turns:2,stack:'refresh',desc:'每回合受到最大生命5%真实伤害'},
 {name:'冻伤',aliases:['霜冻','寒冷','冰寒'],polarity:'negative',dot:.03,turns:2,mods:[m('speed',{multiplier:.8})],desc:'每回合受到最大生命3%真实伤害，速度-20%'},
 {name:'感电',aliases:['电击','触电','麻电'],polarity:'negative',dot:.03,turns:2,mods:[m('evade',{flat:-.15})],desc:'每回合受到最大生命3%真实伤害，闪避-15%'},
 {name:'腐蚀',aliases:['腐化','侵蚀','溶解','酸蚀','污染'],polarity:'negative',dot:.03,turns:3,stack:'stack',maxStacks:10,mods:[m('armor_physical',{multiplier:.9}),m('heal_received',{multiplier:.8})],desc:'每回合受到最大生命3%真实伤害/层，护甲-10%/层，受到治疗-20%'},
 {name:'辐射',aliases:['辐射病','放射'],polarity:'negative',dot:.05,turns:99,stack:'stack',maxStacks:20,dispellable:false,desc:'不可驱散，每回合受到最大生命5%真实伤害/层'},
 {name:'诅咒',aliases:['咒缚','厄运','咒怨'],polarity:'negative',dot:.02,turns:3,mods:[m('heal_received',{multiplier:.5}),...checks(-1)],desc:'每回合受到最大生命2%真实伤害，受到治疗-50%，检定-1'},
 // ── 削弱 ──
 {name:'虚弱',aliases:['衰弱','乏力','无力'],polarity:'negative',turns:2,mods:allDamage(.75),desc:'造成伤害-25%'},
 {name:'易伤',aliases:['脆弱','破绽','弱点暴露','受创'],polarity:'negative',turns:2,mods:[m('vulnerability',{multiplier:1.25})],desc:'受到伤害+25%'},
 {name:'破甲',aliases:['碎甲','护甲破坏','防御下降','破防'],polarity:'negative',turns:2,mods:[m('armor_physical',{multiplier:.5}),m('armor_energy',{multiplier:.7})],desc:'物理护甲-50%，能量护甲-30%'},
 {name:'破魔',aliases:['魔抗下降','精神防御下降','心防破碎'],polarity:'negative',turns:2,mods:[m('armor_energy',{multiplier:.5}),m('armor_mental',{multiplier:.5})],desc:'能量与精神护甲-50%'},
 {name:'动摇',aliases:['心智动摇','意志动摇','精神动摇','失神'],polarity:'negative',turns:2,mods:[m('精神',{multiplier:.8}),...checks(-2)],desc:'精神-20%，检定-2'},
 {name:'焦虑',aliases:['不安','紧张'],polarity:'negative',turns:99,stack:'stack',maxStacks:10,mods:[m('hit',{flat:-.03}),m('evade',{flat:-.03}),...checks(-1)],desc:'每层命中/闪避-3%，检定-1'},
 {name:'禁疗',aliases:['无法治疗','治疗封锁','重伤','致命伤'],polarity:'negative',turns:2,mods:[m('heal_received',{multiplier:0})],desc:'无法受到治疗'},
 {name:'标记',aliases:['猎物','印记','锁定','侦破','看破','邪念'],polarity:'negative',control:'mark',turns:3,mods:[m('vulnerability',{multiplier:1.15}),m('evade',{flat:-.15})],desc:'无法隐匿，受到伤害+15%，闪避-15%'},
 {name:'幻觉',aliases:['幻象','迷幻','致幻'],polarity:'negative',turns:2,mods:[m('hit',{flat:-.25}),...checks(-1)],desc:'命中-25%，检定-1'},
 {name:'疲惫',aliases:['疲劳','精疲力竭','力竭'],polarity:'negative',turns:2,mods:[m('speed',{multiplier:.8}),m('cost_sp',{multiplier:1.3}),m('cost_mp',{multiplier:1.3})],desc:'速度-20%，能力消耗+30%'},
 {name:'发情',aliases:['情欲','魅香','催情'],polarity:'negative',turns:2,mods:[m('hit',{flat:-.2}),m('精神',{multiplier:.85}),...checks(-2)],desc:'命中-20%，精神-15%，检定-2'},
 {name:'迷雾',aliases:['雾中','视野受阻'],polarity:'negative',turns:2,mods:[m('hit',{flat:-.2})],desc:'命中-20%'},
 {name:'魔力紊乱',aliases:['魔力枯竭','法力紊乱','绝魔'],polarity:'negative',turns:2,mods:[m('cost_mp',{multiplier:2}),m('damage_energy',{multiplier:.7})],desc:'法力消耗翻倍，能量伤害-30%'},
 {name:'暴露',aliases:['衣衫破损','卸甲','装甲破损'],polarity:'negative',turns:3,mods:[m('armor_physical',{multiplier:.6}),m('armor_energy',{multiplier:.6}),m('armor_mental',{multiplier:.6})],desc:'所有护甲-40%'},
 // ── 增益 ──
 {name:'再生',aliases:['回复','持续回复','自愈','生命恢复','愈合'],polarity:'positive',hot:.05,turns:3,desc:'每回合恢复最大生命5%'},
 {name:'法力涌动',aliases:['魔力回复','法力回复','冥想'],polarity:'positive',hot:.08,hotResource:'mp',turns:3,desc:'每回合恢复最大法力8%'},
 {name:'活力',aliases:['体力回复','精力充沛'],polarity:'positive',hot:.08,hotResource:'sp',turns:3,desc:'每回合恢复最大体力8%'},
 {name:'狂暴',aliases:['狂怒','怒气','血怒','战意高昂','嗜血'],polarity:'positive',turns:3,mods:[...allDamage(1.3),...allReduction(1.1)],desc:'造成伤害+30%，受到伤害+10%'},
 {name:'强化',aliases:['增幅','鼓舞','激励','战吼','力量提升'],polarity:'positive',turns:3,mods:allDamage(1.2),desc:'造成伤害+20%'},
 {name:'加速',aliases:['急速','迅捷','疾风','神速','轻灵'],polarity:'positive',turns:3,mods:[m('speed',{multiplier:1.3})],desc:'速度+30%'},
 {name:'坚守',aliases:['固守','铁壁','防御姿态','守护姿态','不动如山'],polarity:'positive',turns:2,mods:allReduction(.6),desc:'受到的物理/能量/精神伤害-40%'},
 {name:'专注',aliases:['精准','集中','锁定目标','瞄准'],polarity:'positive',turns:3,stack:'stack',maxStacks:5,mods:[m('hit',{flat:.1}),m('crit',{flat:.05})],desc:'每层命中+10%、暴击+5%'},
 {name:'闪避',aliases:['残影','幻影','灵巧','回避'],polarity:'positive',turns:2,mods:[m('evade',{flat:.3})],desc:'闪避+30%'},
 {name:'隐身',aliases:['隐匿','潜行','隐形','透明','遁形','光学迷彩'],polarity:'positive',control:'hidden',turns:2,desc:'无法被敌人直接选中'},
 {name:'护卫',aliases:['守护','掩护','保护'],polarity:'positive',control:'guard',turns:2,desc:'替同伴承受攻击'},
 {name:'蓄力',aliases:['蓄势','聚能','充能'],polarity:'positive',turns:3,consumeOn:'attack',mods:allDamage(2),desc:'下一次攻击伤害翻倍'},
 {name:'庇护',aliases:['星光庇佑','加护','圣佑'],polarity:'positive',turns:3,consumeOn:'damaged',mods:allReduction(.3),desc:'下一次受到的伤害-70%'},
 {name:'荆棘',aliases:['反伤','尖刺','刺甲'],polarity:'positive',turns:3,reactions:[{kind:'reflect',fraction:.3,channels:['physical','energy']}],desc:'反弹30%物理/能量伤害'},
 {name:'祝福',aliases:['神恩','庇佑','圣光祝福','幸运'],polarity:'positive',turns:3,mods:[m('hit',{flat:.1}),m('evade',{flat:.1}),...checks(2)],desc:'命中/闪避+10%，检定+2'},
 {name:'心灵屏障',aliases:['精神屏障','意志坚定','冷静','镇静'],polarity:'positive',turns:3,mods:[m('reduction_mental',{multiplier:.5}),...checks(2)],desc:'精神伤害-50%，检定+2'},
 {name:'魔力护体',aliases:['法力护盾','魔法抗性','魔抗'],polarity:'positive',turns:3,mods:[m('reduction_energy',{multiplier:.6})],desc:'能量伤害-40%'},
 {name:'铁甲',aliases:['硬化','石肤','钢铁之躯','护甲强化'],polarity:'positive',turns:3,mods:[m('reduction_physical',{multiplier:.6})],desc:'物理伤害-40%'},
 {name:'洞察',aliases:['演绎','看穿','预判','直觉'],polarity:'positive',turns:3,mods:[m('hit',{flat:.2}),m('evade',{flat:.15}),m('crit',{flat:.1})],desc:'命中+20%，闪避+15%，暴击+10%'},
];

const INDEX=new Map<string,StdStatus>();
for(const s of STD_STATUSES){INDEX.set(s.name,s);for(const a of s.aliases)if(!INDEX.has(a))INDEX.set(a,s);}
const clean=(name:string)=>name.replace(/^std[:：]/i,'').replace(/[\[\]【】「」『』“”"'（）()]/g,'').replace(/(?:状态|效果|debuff|buff)$/i,'').trim();
/** 按名称或别名查找标准状态；不做模糊子串匹配，避免把自定义状态误并入标准模板。 */
export function findStd(name:string):StdStatus|undefined{const k=clean(name);return INDEX.get(k)??INDEX.get(k.replace(/^(?:陷入|施加|附加|造成)/,''));}
/** 在任意文本中找出提到的标准状态（本地解析器用），长别名优先。 */
export function mentionedStd(text:string):{std:StdStatus;word:string;index:number}[]{
 const words=[...INDEX.keys()].sort((a,b)=>b.length-a.length),out:{std:StdStatus;word:string;index:number}[]=[],taken:boolean[]=[];
 for(const w of words){let at=text.indexOf(w);while(at>=0){if(!taken.slice(at,at+w.length).some(Boolean)){out.push({std:INDEX.get(w)!,word:w,index:at});for(let i=at;i<at+w.length;i++)taken[i]=true;}at=text.indexOf(w,at+w.length);}}
 return out.sort((a,b)=>a.index-b.index);
}
export const STD_NAMES=STD_STATUSES.map(s=>s.name);
export function stdCatalogText():string{return STD_STATUSES.map(s=>`${s.name}${s.aliases.length?'('+s.aliases.slice(0,3).join('/')+')':''}:${s.desc},${s.turns>=99?'持续至战斗结束':s.turns+'回合'}`).join('；');}

const zero=():AmountSpec=>({flat:0,attribute:'none',factor:0,scale:'flat',maxResource:'none',maxFraction:0});
const bare=(effects:EffectSpec[],target:ActionSpec['target']):ActionSpec=>({target,cost:{hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}},castMs:0,recoveryFactor:1,perBattleUses:0,effects});
export type StatusOverride={turns?:number;permanent?:boolean;maxStacks?:number;stackable?:boolean;dispellable?:boolean;dot?:number;hot?:number;hotFlat?:number;mods?:ModifierSpec[];name?:string;polarity?:StatusSpec['polarity'];control?:StdControl|null;reactions?:ReactionSpec[];consumeOn?:'attack'|'damaged';tags?:string[]};
/** 生成状态定义及其依赖动作（DOT/HOT/消耗）。key 是 library 中的状态 id。 */
export function buildStatus(key:string,base:StdStatus|undefined,o:StatusOverride={}):{status:StatusSpec;actions:Record<string,ActionSpec>}{
 const name=(o.name??base?.name??key).slice(0,100),turns=o.turns??base?.turns??2,permanent=o.permanent||turns>=99;
 const stack=o.stackable===undefined?(base?.stack??'refresh'):o.stackable?'stack':'refresh';
 const actions:Record<string,ActionSpec>={};
 const control=o.control===null?undefined:o.control??base?.control;
 const status:StatusSpec={name,tags:[...new Set([name,...(base?[base.name]:[]),...(o.tags??base?.tags??[])])].slice(0,16),polarity:o.polarity??base?.polarity??'negative',
  duration:permanent?{clock:'permanent',value:0}:{clock:'round',value:Math.max(1,Math.min(99,Math.round(turns)))},stack,maxStacks:stack==='stack'?Math.max(1,Math.min(1000,o.maxStacks??base?.maxStacks??10)):1,
  scaleWithStacks:stack==='stack',priority:0,dispellable:o.dispellable??base?.dispellable??true,removeOnDeath:true,scope:'battle'};
 if(control)status.control=control;
 const mods=[...(base?.mods??[]),...(o.mods??[])];if(mods.length)status.modifiers=mods;
 const reactions=[...(o.reactions??base?.reactions??[])];if(reactions.length)status.reactions=reactions;
 if(base?.breakOnDamage)status.breakOnDamage=true;
 const dot=o.dot??base?.dot;
 if(dot&&dot>0){const id=key+':dot',amounts={physical:zero(),energy:zero(),mental:zero(),true:zero()},ch=base?.dotChannel??'true';amounts[ch]={...zero(),subject:'target',maxResource:'hp',maxFraction:Math.min(1,dot)};
  actions[id]={...bare([{op:'damage',amounts,element:'none',types:['无'],hitChance:1,hitRule:'guaranteed',critChance:0,critMultiplier:1}],'enemy'),name:name+'·持续伤害'};
  status.tick={interval:1,clock:'round',action:id,count:0};}
 // 0.38.2 原文写“每回合恢复N点”时按固定值（hotFlat），只有原文是百分比才按最大值比例。
 const hotFlat=o.hotFlat,hot=hotFlat&&hotFlat>0?undefined:o.hot??base?.hot;
 if(((hotFlat&&hotFlat>0)||(hot&&hot>0))&&!status.tick){const id=key+':hot',r=base?.hotResource??'hp';const amount=hotFlat&&hotFlat>0?{...zero(),flat:hotFlat}:{...zero(),subject:'target' as const,maxResource:r,maxFraction:Math.min(1,hot!)};actions[id]={...bare([{op:'heal',resource:r,amount}],'self'),name:name+'·持续恢复'};status.tick={interval:1,clock:'round',action:id,count:0};}
 const consume=o.consumeOn??base?.consumeOn;
 if(consume){const id=key+':consume';actions[id]={...bare([{op:'dispel',mode:'remove',polarity:'any',status:name,includeUndispellable:true,targeting:{side:'self',selection:'manual'}}],'self'),name:name+'·消耗'};
  status.triggers=[...(status.triggers??[]),{id:'consume',event:consume==='attack'?'action_end':'damage_received',scope:'self',action:id,...(consume==='attack'?{conditions:[{kind:'expression',expression:[{read:'event',key:'action_attacking'}],compare:'gt',value:0}]}:{})}];}
 return {status,actions};
}
