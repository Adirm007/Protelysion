/** Small compiler teaching programs, never granted to actors. Executed by semantic-expansion tests. */
import {EMPTY_LIBRARY,type ActionSpec,type EffectSpec,type AmountSpec,type MappingSpec,type StatusSpec} from './contract';
const zero=():AmountSpec=>({flat:0,attribute:'none',factor:0,scale:'flat',maxResource:'none',maxFraction:0});
const flat=(n:number):AmountSpec=>({...zero(),flat:n});
const action=(effects:EffectSpec[],target:ActionSpec['target']='self'):ActionSpec=>({target,cost:{hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}},castMs:0,recoveryFactor:1,perBattleUses:0,effects});
const status=(name:string):StatusSpec=>({name,tags:[name],polarity:'positive',duration:{clock:'permanent',value:0},stack:'refresh',maxStacks:24,scaleWithStacks:true,priority:0,dispellable:true,removeOnDeath:false,scope:'battle'});
const hit=(n:number):Extract<EffectSpec,{op:'damage'}>=>({op:'damage',amounts:{physical:flat(n),energy:zero(),mental:zero(),true:zero()},element:'none',hitChance:1,hitRule:'guaranteed',critChance:0,critMultiplier:1});
function example(name:string,original:string,program:ActionSpec,disposition:'active'|'passive',summary:string,changes:NonNullable<MappingSpec['fidelity']>['changes']=[]){return {name,original,mapping:{sourceId:'/技能/'+name,disposition,reason:summary,action:program,fidelity:{mode:changes.length?'approximate':'exact',summary,clauses:[{original,implementation:summary}],changes}} satisfies MappingSpec};}
const needles=action([{op:'variable',key:'volley',mode:'random_int',value:[{constant:3}],maximum:[{constant:8}],targeting:{side:'self',selection:'manual'}},{...hit(5),hitCountExpression:[{read:'variable',key:'volley'}],maxHits:8,onHitAction:'poison'}],'enemy');
needles.library={...EMPTY_LIBRARY(),actions:{poison:action([{op:'apply_status',status:'poison'}],'enemy'),dot:action([{...hit(0),amounts:{physical:zero(),energy:zero(),mental:zero(),true:{...zero(),subject:'target',maxResource:'hp',maxFraction:.01}}}],'enemy')},statuses:{poison:{...status('毒'),polarity:'negative',stack:'stack',duration:{clock:'round',value:2},tick:{clock:'round',interval:1,count:0,action:'dot'}}}};
const tax=action([]);tax.triggers=[{id:'tax',event:'after_cost',scope:'enemy',action:'tax',conditions:[{kind:'expression',expression:[{read:'event',key:'paid_mp'}],value:0,compare:'gt'}]}];tax.library={...EMPTY_LIBRARY(),actions:{tax:action([{op:'heal',resource:'mp',amount:{...zero(),expression:[{read:'event',key:'paid_mp'}]}},{op:'alter_event',mode:'cancel_action'}])}};
const reverse=action([{op:'field',field:'reverse'}]);reverse.library={...EMPTY_LIBRARY(),fields:{reverse:{name:'伤疗反转域',group:'reverse',priority:50,stack:'replace',targeting:{side:'any',selection:'all',life:'alive'},status:'law',duration:{clock:'round',value:2}}},statuses:{law:{...status('伤疗反转'),triggers:[{id:'d',event:'before_damage',scope:'self',action:'d'},{id:'h',event:'before_heal',scope:'self',action:'h',conditions:[{kind:'event_resource',key:'hp'}]}]}},actions:{d:action([{op:'alter_event',mode:'damage_to_heal'}]),h:action([{op:'alter_event',mode:'heal_to_damage'}])}};
const fate=action([{op:'rule',rule:'luck',key:'best',uses:1,duration:{clock:'round',value:2}},{op:'rule',rule:'death_guard',key:'*',uses:1,amount:flat(1),duration:{clock:'round',value:2}}]);fate.perBattleUses=1;
const life=action([{op:'link',mode:'life',key:'bond',members:{side:'ally',selection:'all',life:'any',names:['成员甲','成员乙','成员丙']},minimumMembers:3,duration:{clock:'permanent',value:0},delayRounds:1,recovery:{hp:.5,mp:.5,sp:.5},cleanse:true}]);
const lastSong=action([{op:'dispel',mode:'remove',polarity:'negative'},{op:'apply_status',status:'song'},{op:'rule',rule:'undying',key:'*',duration:{clock:'round',value:2}}],'ally');lastSong.library={...EMPTY_LIBRARY(),statuses:{song:{...status('终曲'),duration:{clock:'round',value:2},onExpire:'return'}},actions:{return:action([{op:'heal',resource:'hp',amount:{...zero(),maxResource:'hp',maxFraction:.5,subject:'target'}}])}};
const borrow=action([{op:'copy',mode:'skill',id:'*',selection:'used_random',activate:true,originalStats:true,duration:{clock:'battle_time',value:1}}],'enemy');
const manaMirror=action([{op:'apply_status',status:'mirror'}]);manaMirror.library={...EMPTY_LIBRARY(),statuses:{mirror:{...status('魔力镜'),reactions:[{kind:'resource_guard',resource:'mp',fraction:1,reflect:1}]}}};
const passiveLease=action([{op:'copy',mode:'passive',id:'*',selection:'random',steal:true,duration:{clock:'round',value:1}}],'enemy');
const sourceWard=action([{op:'rule',rule:'immune_source',key:'*',filter:{kinds:['skill','item'],maxQuality:'legendary',delivery:'targeted'},duration:{clock:'permanent',value:0}}]);
const fullMirror=action([{op:'apply_status',status:'mirror'}]);fullMirror.library={...EMPTY_LIBRARY(),statuses:{mirror:{...status('整招镜'),triggers:[{id:'mirror',event:'action_resolved',scope:'self',action:'bounce',uses:1}]}},actions:{bounce:action([{op:'replay',originalStats:true,targeting:{side:'event_source',selection:'manual'}}])}};
const opener={...action([hit(10)],'enemy'),initiative:'absolute' as const,perBattleUses:1};
export const ADVANCED_EXAMPLES=[
 example('赌博毒针','无消耗，随机发射3到8针；每针以5点物理基础伤害结算，必中且不暴击。每个有效命中叠1层毒，毒持续2公共轮、每轮每层以目标最大HP的1%为基础结算真实伤害。',needles,'active','单次随机结果复用，动态段数，逐段命中附效，叠层公共轮DOT。'),
 example('魔力税','无消耗常驻：敌方动作实际支付MP后，我恢复等量MP但不超过自身上限；该动作失效，包括瞬发，已支付的费用不退。',tax,'passive','after_cost读取真实已支付MP，恢复自身MP并取消当前命令；不是隐藏敌方按钮。'),
 example('有限现实反转','无消耗，随意扭曲现实：让领域内伤害变成治疗、治疗变成伤害。',reverse,'active','全场伤害/HP治疗双向替换；持续2公共轮，MP/SP恢复不反转。',[
  {original:'随意扭曲现实',implemented:'仅支持明确的伤害/HP治疗替换；不改物理常数、地图或剧情。',reason:'用户授权无边界概念采用有限近似。'},
  {original:'让领域内伤害变成治疗、治疗变成伤害',implemented:'持续2公共轮；命中和防御后、护盾前的伤害转HP恢复；治疗在增益前转HP伤害。遵守资源上限，转换不无限往返。',reason:'固定可执行时长和事件顺序是本示例的游戏化参数，不能宣称宇宙级原样还原。'}
 ]),
 example('有限命运偏爱','无消耗，命运绝对必胜。',fate,'active','每战1次，2公共轮内下一次复合检定必成，并有1次保留1HP的免死；不保证整场必胜。',[
  {original:'命运绝对必胜',implemented:'有限的一次检定成功＋一次1HP免死；2公共轮到期、每战1次；仍按施加者等级、有效速度、种子随机处理冲突，不保证整场胜利。',reason:'用户允许绝对必胜近似化；次数、时长与效果都显式披露。'}
 ]),
 example('三方生命契约','无消耗被动，仅成员甲、成员乙、成员丙结成生命链接，至少三人在场才建立；只要另一人存活，倒地成员在下一公共轮清除负面并恢复50%HP、MP、SP；三人全灭则失效。',life,'passive','实名生命链接，不混淆任意三个盟友；来源封锁与封印冲突走统一规则。'),
 example('有尽终曲','无消耗，为单一盟友净化负面，随后2公共轮内HP归零不死亡；到期恢复50%最大HP。',lastSong,'active','净化、零血不死与到期动作；不误译为保1HP或立即复活。'),
 example('借用往事','无消耗，从选定敌人本战已使用的许可技能中随机挑选一个立刻使用，威力基础沿用该敌人当前数值，不另付原技能费用。',borrow,'active','即时历史技能借用，非永久学习，不额外占下一次行动。'),
 example('魔力镜','无消耗被动，以1MP抵消1点本应结算的伤害，等额反弹实际抵消部分；MP不足的部分照常承伤。',manaMirror,'passive','MP实际扣除与等额反弹一体结算，不凭空吸收溢出伤害。'),
 example('短期借权','无消耗，随机窃取选定敌人的一项许可被动，持续1公共轮，到期恢复原主原实例。',passiveLease,'active','整包被动租约；来源独立锁，不刷新剩余次数，不窃取系统指令。'),
 example('品质护佑','无消耗被动，免疫传说及以下品质的单体指向技能和道具；不覆盖范围效果、未知品质或神话品质。',sourceWard,'passive','真实来源元数据筛选，冲突仍遵守施加者等级、速度、随机。'),
 example('一次整招镜','无消耗被动，下一次对自己结算的攻击完成后，将整招伤害与附效按原施放者数值基础回放给施放者，不重复原招费用，不无限互反。',fullMirror,'passive','完整Action trace回放，最多一层，整个反应树有共享预算。'),
 example('抢先一击','无消耗，每战1次开场绝对先手，造成10点物理基础伤害，必中且无暴击；双方都有先手时比较等级、速度，仍相同随机。',opener,'active','先手资格与普通技能分离，priority不越级。')
];
