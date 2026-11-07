/** 0.45：装备编译还原（效果名与多条常驻词条不丢）、补给员战利品按世界书细则写属性、玩家可见文案去掉开发者口吻。 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sourceEntries} from '../src/compiler/engine';
import {localBlueprint} from '../src/compiler/blueprint/compile';
import {HOST_RULES} from '../src/compiler/rules';
import {describeAction} from '../src/ui/ability-text';
import {materializeDeal,lootDraftOf,buildSupplierPrompt,type SupplierContext} from '../src/game/supplier-agent';
import {parseLootSpec,lootSpecPrompt,readSpecEntries,specEntryNames,needsLootSpec,DEFAULT_SPEC_ENTRIES} from '../src/game/supplier-loot-spec';
import {hostReward,rewardDetail} from '../src/core/settlement';
import {addReward} from '../src/core/run';
import {monsterKit} from '../src/game/monsters/kits';
import {MONSTER_ROSTER} from '../src/game/monsters/catalog';

const SPEAR={品质:'神话',类型:'长柄武器',位置:'双手',标签:['命运抽卡','物品','原主:欧提努斯','攻击: 2500','有效距离: 超距(15)','徽记: 格雷姆林'],
 效果:{'微弱法则[相位涂抹]':'全伤害增幅+30%，穿透+20%，额外固定伤害+1200（真实伤害）','必中之果':'命中+10；每场战斗1次，使下一次攻击获得绝对命中','终焉投掷':'消耗: [攻击: 8000 MP] 投掷长枪粉碎目标区域相位，造成12000点真实伤害，令目标单位进行一次精神属性检定，初始DC=30+0+0.5×施加者精神属性，失败则获得[相位崩解]，无法行动（强控），持续4回合'},
 描述:'北欧神话的至高神枪。'};
const SOURCE:any={姓名:'测试',等级:25,种族:'人类',属性:{力量:300,敏捷:300,体质:300,智力:300,精神:300},生命值:{_基础:50000,额外:0,当前:50000},法力值:{_基础:50000,额外:0,当前:50000},体力值:{_基础:50000,额外:0,当前:50000},技能:{},装备:{主神之枪:SPEAR}};

test('045 装备逐条还原：面板攻击、增伤、穿透、命中、必中、额外固伤都在，主动以效果名命名', () => {
  const entry=sourceEntries(SOURCE,HOST_RULES).find(e=>e.sourceId==='/装备/主神之枪')!;
  const m=localBlueprint(entry,SOURCE,HOST_RULES)!;
  const numeric={level:25,attributes:SOURCE.属性,max:{hp:50000,mp:50000,sp:50000}} as any;
  const passive=describeAction(m.mapping.action!,numeric).join('\n');
  for(const want of ['物理伤害 +2500','穿透 +20%','真实伤害 ×1.3','命中 +50%','攻击必中','1200点真实伤害'])assert.ok(passive.includes(want),want+' 缺失：\n'+passive);
  const active=m.mapping.actions?.[0];assert.ok(active);assert.equal(active!.name,'终焉投掷');
  assert.equal(active!.cost.mp.flat,8000);
  const lines=describeAction(active!,numeric).join('\n');
  assert.match(lines,/12000点真实伤害/);assert.match(lines,/精神对抗/);assert.match(lines,/相位崩解/);assert.match(lines,/无法行动/);
  assert.doesNotMatch(lines,/自身：施加相位崩解/);assert.doesNotMatch(lines,/禁动/);
});

const ctx:SupplierContext={depth:3,theme:'书街',themeSubtitle:'纸页',scene:'旧书街',foes:[],floorQuality:'稀有',capTier:3,party:[],fp:99999,relics:[],items:[],kills:0,encounters:[],remaining:{relic:1,item:2,event:1,loot:1},runId:'run-045'};
const weapon={type:'loot',price:500,quality:'稀有',name:'旧书街的裁纸刀',itemType:'武器',effect:'锋利，能切开纸做的怪物',description:'刀柄缠着胶带'};

test('045 补给员：武器等战利品先出草稿，写好属性后带着格式化标签与效果进背包', () => {
  assert.equal(needsLootSpec('技能书'),false);assert.equal(needsLootSpec('武器'),true);assert.equal(needsLootSpec('资产'),true);
  assert.equal(lootDraftOf({...weapon,itemType:'技能书'},ctx,1),undefined);
  assert.equal(lootDraftOf(weapon,{...ctx,fp:1},1),undefined,'买不起就不去写属性');
  const draft=lootDraftOf(weapon,ctx,1)!;assert.equal(draft.name,'旧书街的裁纸刀');assert.equal(draft.quality,'稀有');assert.equal(draft.itemType,'武器');
  const prompt=lootSpecPrompt([{name:'技能装备道具生成规则',content:'# 装备生成格式\n标签: [攻击/防御: XXX]'}],draft);
  assert.match(prompt.user,/装备生成格式/);assert.match(prompt.user,/旧书街的裁纸刀/);
  const spec=parseLootSpec('```json\n{"name":"旧书街的裁纸刀","type":"短刀","tags":["攻击: 320"],"effects":{"裁切":"对纸质敌人伤害+20%"}}\n```','旧书街的裁纸刀')!;
  assert.deepEqual(spec,{type:'短刀',tags:['攻击: 320'],effects:{裁切:'对纸质敌人伤害+20%'}});
  const built=materializeDeal(weapon,ctx,1,spec);assert.ok(built.ok&&built.deal.loot?.spec);
  const loot=(built as any).deal.loot;const item=hostReward(loot).item as any;
  assert.equal(item.类型,'短刀');assert.ok(item.标签.includes('攻击: 320'));assert.deepEqual(item.效果,{裁切:'对纸质敌人伤害+20%'});assert.match(item.描述,/刀柄缠着胶带/);
  assert.match(rewardDetail(loot),/攻击: 320/);
  const skill=materializeDeal({...weapon,itemType:'技能书'},ctx,1,spec);assert.ok(skill.ok&&!skill.deal.loot?.spec,'技能书不带属性');
  assert.throws(()=>addReward({id:'r',status:'active',battleActive:false,participants:[],battleIds:[],defeatedIds:[],rewards:[],unlocks:[],failureSignal:null} as any,{...loot,spec:{tags:[],effects:{}}}),/属性不完整/);
  assert.match(buildSupplierPrompt(ctx,[]).system,/世界书里的物品生成细则/);
});

test('045 细则条目名与命运抽卡共用；世界书按名称读取，启用的优先', async () => {
  assert.deepEqual(specEntryNames(undefined),[...DEFAULT_SPEC_ENTRIES]);
  assert.deepEqual(specEntryNames({itemSpec:{enabled:true,entries:['我的规则','我的规则']}}),['我的规则']);
  assert.equal(specEntryNames({itemSpec:{enabled:false,entries:['x']}}),undefined);
  const h={getCharWorldbookNames:()=>({primary:'卡',additional:[]}),getChatWorldbookName:()=>null,getGlobalWorldbookNames:()=>['全局'],
    getWorldbook:async(name:string)=>name==='卡'?[{name:'技能装备道具生成规则（旧）',content:'旧',enabled:false},{name:'技能装备道具生成规则',content:'新<%= x %>',enabled:true}]:[{name:'品质效果限定',content:'品质'}]};
  const entries=await readSpecEntries(h,['技能装备道具生成规则','品质效果限定','不存在']);
  assert.deepEqual(entries,[{name:'技能装备道具生成规则',content:'新'},{name:'品质效果限定',content:'品质'}]);
});

test('045 怪物技能文案不带开发者口吻', () => {
  const banned=/条款[一二三]|仲裁|种子随机|公共轮|不保证|编译失败|品质词条投影|唯一解|短战检查|反读取|限制明确|结构化技能详情|持续与次数以效果详情为准/;
  for(const m of MONSTER_ROSTER.slice(0,60))for(const tier of [2,5,7]){
    const kit=monsterKit(m.id,[1,10,25,40,60,80,99][tier-1]!);if(!kit)continue;
    for(const s of kit.card.skills){const d=s.mapping.action?.description??'';assert.doesNotMatch(d,banned,m.id+' '+s.name+'：'+d);}
  }
});
