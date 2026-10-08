/** 0.36 事件系统重制：39 条事件。只能通过补给员「事件」选项接触。
 *  结果种类见 EventResult（mechanism-content.ts）；风险类结果按权重公开掷骰。 */
import type {EventDefinition,EventChoice,EventResult} from './mechanism-content';

const leave=(label='离开'):EventChoice=>({id:'leave',label,requirements:[],costs:[],results:[]});
const opt=(id:string,label:string,results:EventResult[],extra:Partial<EventChoice>={}):EventChoice=>({id,label,requirements:[],costs:[],results,...extra});
const fp=(mode:'add'|'scale'|'clear',amount=0):EventResult=>({kind:'fp',mode,amount});
const box=(count:number,quality:'random'|string='random'):EventResult=>({kind:'box',count,quality});
const relic=(rarity?:1|2|3):EventResult=>({kind:'relic_random',...(rarity?{rarity}:{})});
const E=(id:number,title:string,body:string,choices:EventChoice[],requirements:EventDefinition['requirements']=[]):EventDefinition=>({id:'E'+String(id).padStart(3,'0'),theme:'common',title,body,requirements,choices});

export const EVENT_LIST:EventDefinition[]=[
 E(1,'清仓','柜台后没有人，只有三个封好的盒子和一张写着“全部”的价签。',[opt('take','丢失所有待结算 FP，获得随机品质盲盒 ×3',[fp('clear'),box(3)]),leave()]),
 E(2,'采集运势','一枚硬币立在地上，正反面都刻着采集者的徽记。',[opt('flip','掷币：50% 3 场战斗内素材掉落率 +100%；50% −100%',[],{risks:[{weight:1,results:[{kind:'battle_mod',fights:3,materialRate:2}]},{weight:1,results:[{kind:'battle_mod',fights:3,materialRate:0}]}]}),leave()]),
 E(3,'转变','一个空的遗物盒，盒底刻着“换”。',[opt('transform','选择一件遗物，转变为同等级的另一件随机遗物',[{kind:'relic_transform'}],{requirements:[{kind:'relic_any',key:'',amount:1}]}),leave()]),
 E(4,'翻倍或减半','账房先生笑着推来一枚骰子。',[opt('bet','掷骰：50% 待结算 FP ×2；50% ×0.5',[],{risks:[{weight:1,results:[fp('scale',2)]},{weight:1,results:[fp('scale',.5)]}]}),leave()]),
 E(5,'错位楼梯','这段楼梯的台阶数不对。',[opt('step','踏上去：传送到 ±50 层内的随机楼层（不低于 1 层，不越过当前百位段）',[{kind:'teleport',range:50}]),leave('绕开')]),
 E(6,'有偿疗愈','一位蒙面的医师伸出手，掌心写着数字。',[opt('pay','支付 2000 FP：全队完全恢复',[{kind:'heal_all',fraction:1}],{costs:[{resource:'fp',fraction:0,flat:2000,lethal:false}]}),leave('不支付')]),
 E(7,'遭遇即遗物','擂台边挂着三块牌子。',[opt('normal','挑战普通 ×4，胜利后获得一件遗物',[{kind:'encounter_tier',tier:'normal',count:4,thenRelic:1}]),opt('elite','挑战精英 ×2，胜利后获得一件遗物',[{kind:'encounter_tier',tier:'elite',count:2,thenRelic:2}]),opt('boss','挑战 Boss ×1，胜利后获得一件高等遗物',[{kind:'encounter_tier',tier:'boss',count:1,thenRelic:3}]),leave()]),
 E(8,'传唤铃','一只黄铜小铃，铃舌上系着补给员的名牌。',[opt('take','获得迷宫道具「传唤铃」：可呼叫补给员，限用 3 次',[{kind:'item',id:'bell',count:3}]),leave()]),
 E(9,'高压训练','墙上贴着训练日程：加倍的对手，加倍的收获。',[opt('train','下一场战斗敌方伤害 ×1.5，胜利经验 ×1.5',[{kind:'battle_mod',fights:1,enemyDamage:1.5,expMul:1.5}]),leave()]),
 E(10,'封印契约','契约书上留着三个空格。',[opt('seal','选择一名成员封印 1–3 个技能（本次迷宫内不可用），每封印一个该成员全属性 +10%',[{kind:'seal_skills'}]),leave()]),
 E(11,'无人祭坛','祭坛上有一道凹槽，正好放得下一件遗物。',[opt('offer','献祭一件遗物：全队全属性 +10%（本次迷宫）',[{kind:'relic_pick',mode:'sacrifice',attrs:1.1}],{requirements:[{kind:'relic_any',key:'',amount:1}]}),leave('不献祭')]),
 E(12,'旧账','一位老人翻开账本：“旧账，可以清。”',[opt('pay','支付 500 FP：移除全队所有负面状态',[{kind:'cleanse_all'}],{costs:[{resource:'fp',fraction:0,flat:500,lethal:false}]}),leave('不支付')]),
 E(13,'黑市','布帘后的人不肯露脸，只把货摊开。',[opt('buy','用 1500 FP 换一件随机遗物',[relic()],{costs:[{resource:'fp',fraction:0,flat:1500,lethal:false}]}),opt('trade','用 1 个盲盒换一件随机遗物',[{kind:'box',count:-1},relic()],{requirements:[{kind:'box',key:'',amount:1}]}),leave()]),
 E(14,'拾荒者','一个盲盒被塞在墙缝里，旁边的地面被翻得干干净净。',[opt('take','获得 1 个盲盒；本层剩余战斗不掉素材',[box(1),{kind:'layer_mod',key:'noMaterials',value:1}]),leave()]),
 E(15,'竞技场','三名精英在场中央等着。',[opt('fight','精英 ×3 遭遇战：胜利后 FP +1500 与 1 个盲盒',[{kind:'encounter_tier',tier:'elite',count:3,thenFp:1500,thenBox:1}]),leave()]),
 E(16,'药剂师的赠礼','一只药箱敞着，里面的瓶子还在轻轻晃。',[opt('take','免费获得商店随机 3 瓶药剂',[{kind:'potions',count:3,random:true}])]),
 E(17,'遗落背包','有人把背包忘在了这里。',[opt('take','恢复药 +3',[{kind:'potions',count:3}])]),
 E(18,'磨损的护符','护符上的纹路一半清晰一半模糊。',[opt('wear','随机一名成员：50% 最大 HP +20%；50% −20%（本次迷宫）',[],{risks:[{weight:1,results:[{kind:'run_mod',member:'random',maxHp:1.2}]},{weight:1,results:[{kind:'run_mod',member:'random',maxHp:.8}]}]}),leave()]),
 E(19,'无名墓碑','墓碑前放着一件东西，碑上没有名字。',[opt('take','全队 HP −30%，获得一件遗物',[{kind:'heal_all',fraction:-.3},relic()]),leave()]),
 E(20,'岔路','一条路向下，一条路折回。',[opt('down','立即前往下一层',[{kind:'stairs'}]),opt('stay','留下：本层刷新一个新宝箱',[{kind:'chest_spawn'}])]),
 E(21,'回声井','往井里投币，井底会回应。',[opt('toss','投入 1000 FP，获得 2 个盲盒',[box(2)],{requirements:[{kind:'fp',key:'',amount:3000}],costs:[{resource:'fp',fraction:0,flat:1000,lethal:false}]}),leave('不投')]),
 E(22,'训练假人','一个木人桩，上面刻满了旧伤。',[opt('train','选择一名成员：下 3 场战斗伤害 ×1.5，速度 ×0.7',[{kind:'member_pick',mode:'train'}]),leave()]),
 E(23,'时钟匠','钟表匠调快了所有的表。',[opt('accept','全队速度 +20%（本次迷宫）；来访者「?」的追击速度 +20%',[{kind:'run_mod',member:'all',speed:1.2},{kind:'layer_mod',key:'strayHaste',value:1.2,run:true}]),leave()]),
 E(24,'贿赂','守卫伸出手。',[opt('pay','支付 800 FP：本层剩余敌人不主动追击',[{kind:'layer_mod',key:'noChase',value:1}],{costs:[{resource:'fp',fraction:0,flat:800,lethal:false}]}),leave('不支付')]),
 E(25,'血契','契约需要血。',[opt('sign','选择一名成员：最大 HP −30%（本次迷宫），FP +2500',[{kind:'member_pick',mode:'bloodpact'}]),leave()]),
 E(26,'复刻','一面能照出物件的镜子。',[opt('copy','选择一件遗物，队伍中另一人获得一件相同遗物',[{kind:'relic_pick',mode:'copy'}],{requirements:[{kind:'relic_any',key:'',amount:1}]}),leave()]),
 E(27,'弃牌','收购商只收遗物。',[opt('sell','丢弃一件遗物，获得 FP = 稀有度 ×500',[{kind:'relic_pick',mode:'sell',perRarity:500}],{requirements:[{kind:'relic_any',key:'',amount:1}]}),leave()]),
 E(28,'潮汐','水位在涨。',[opt('wait','等待：30% 立刻遭遇 Boss 战；70% 获得 1 个盲盒',[],{risks:[{weight:3,results:[{kind:'encounter_tier',tier:'boss',count:1}]},{weight:7,results:[box(1)]}]}),leave()]),
 E(29,'空椅子','桌边有一把空椅子，坐下的人就不必再走了。',[opt('sit','一名成员当场退出迷宫（按撤离结算），其余成员全属性 +15%',[{kind:'member_pick',mode:'exit',attrs:1.15}],{requirements:[{kind:'party',key:'',amount:2}]}),leave()]),
 E(30,'双生果','一颗果实，两种味道。',[opt('eat','随机成员：最大 HP 与最大 MP 互换（本次迷宫）',[{kind:'swap_hp_mp'}]),leave()]),
 E(31,'逃票','检票口没有人。',[opt('sneak','下一层免战直达楼梯（本层剩余敌人不计）',[{kind:'stairs',skipNext:true}]),leave('正常前进')]),
 E(32,'铸币机','投入盲盒，吐出硬币。',[opt('mint','用 1 个盲盒换 1200 FP',[{kind:'box',count:-1},fp('add',1200)],{requirements:[{kind:'box',key:'',amount:1}]}),opt('mint3','用 3 个盲盒换 3600 FP',[{kind:'box',count:-3},fp('add',3600)],{requirements:[{kind:'box',key:'',amount:3}]}),leave()]),
 E(33,'猎人告示','告示上只写了精英的名字。',[opt('accept','本层每击败一个精英 FP +400，普通敌人不给 FP',[{kind:'layer_mod',key:'eliteBounty',value:400}]),leave()]),
 E(34,'被遗忘的行囊','行囊里的东西还很新。',[opt('potions','恢复药 +2',[{kind:'potions',count:2}]),opt('fp','FP +600',[fp('add',600)]),opt('mp','随机一名成员本次迷宫最大 MP +20%',[{kind:'run_mod',member:'random',maxMp:1.2}])]),
 E(35,'镜厅','镜子里的敌人比外面多一倍。',[opt('enter','下一场战斗敌方数量 ×2（同种复制），胜利后额外获得一件遗物',[{kind:'battle_mod',fights:1,enemyDouble:true,thenRelic:2}]),leave('绕开')]),
 E(36,'沉睡的守卫','守卫睡着了，怀里抱着钥匙。',[opt('rest','全队恢复 50% HP；本层剩余敌人全属性 ×1.2',[{kind:'heal_all',fraction:.5},{kind:'layer_mod',key:'enemyAttrs',value:1.2}]),leave()]),
 E(37,'命运卡','四张牌背朝上：4 / 3 / 2 / 1。',[opt('draw','抽一张：FP +500 / 盲盒 ×1 / 遗物 ×1 / 待结算 FP 清零',[],{risks:[{weight:4,results:[fp('add',500)]},{weight:3,results:[box(1)]},{weight:2,results:[relic()]},{weight:1,results:[fp('clear')]}]}),leave()]),
 E(38,'蜡封信','信封里是一张借据，已经签好了你的名字。',[opt('take','获得「预支借据」（不可丢弃）',[{kind:'relic_grant',id:'R015'}]),leave()]),
 E(39,'尽头的门','门上写着：到此为止也可以。',[opt('exit','立即结算撤离，FP ×1.2',[fp('scale',1.2),{kind:'withdraw'}]),leave('继续')],[{kind:'depth',key:'',amount:50}]),
];
export const EVENT_CATALOG:Record<string,EventDefinition>=Object.fromEntries(EVENT_LIST.map(e=>[e.id,e]));
