import test from 'node:test';import assert from 'node:assert/strict';
import {createBattle,advanceBattle,chooseAction,resolveAction,type Battle} from '../src/battle/executor';
import {card,damageAction,flat,zero,mitigation} from './compiler-fixtures';
import {DAMAGE_TYPES,elementKey,resolveDamageTypes,bestType} from '../src/battle/elements';
import {MONSTER_RESISTANCE,monsterResistance} from '../src/game/monsters/resistances';
import {MONSTER_BY_ID,MONSTER_ROSTER as MONSTERS} from '../src/game/monsters/catalog';
import {monsterKit} from '../src/game/monsters/kits';
import {mimicKit,MIMIC_ID} from '../src/game/monsters/mimic';
import {repairAction} from '../src/compiler/repair-action';
import {inferDamageTypes} from '../src/compiler/adaptive';
import {STORY_MASTER} from '../src/compiler/examples';
import {effectText as describeEffect} from '../src/ui/ability-text';
import type {ActionSpec,EffectSpec} from '../src/compiler/contract';
import {hostMitigation,raceResistance} from '../src/game/content';
const id='/技能/定量打击';
type Dmg=Extract<EffectSpec,{op:'damage'}>;
function typed(types:Dmg['types'],extra:Partial<Dmg>={},amount=20):ActionSpec{const a=damageAction(amount);const e=a.effects[0] as Dmg;e.types=types;Object.assign(e,extra);return a;}
function fight(ally:ActionSpec,enemyTable:Record<string,number>,allyTable:Record<string,number>={}):Battle{return createBattle([{id:'a',side:'ally',card:card(ally),current:{hp:100,mp:80,sp:100},mitigation:{...mitigation(),elementMultipliers:allyTable}},{id:'e',side:'enemy',card:card(damageAction()),current:{hp:100,mp:80,sp:100},mitigation:{...mitigation(),elementMultipliers:enemyTable}}],123);}
function strike(b:Battle):Battle{return resolveAction(chooseAction(advanceBattle(b,100000).battle,'a',id,'e'));}
const hpLoss=(b:Battle)=>100-b.units[1]!.current.hp;

test('六属性固定：旧元素名归并（雷/电→光，冰→水，风/土→物，毒→暗），未知名→无',()=>{
 assert.deepEqual([...DAMAGE_TYPES],['物','火','水','暗','光','精','无']);
 assert.equal(elementKey('雷'),'光');assert.equal(elementKey('电'),'光');assert.equal(elementKey('冰'),'水');assert.equal(elementKey('风'),'物');assert.equal(elementKey('土'),'物');assert.equal(elementKey('毒'),'暗');assert.equal(elementKey('lightning'),'光');assert.equal(elementKey('自定义元素'),'无');assert.equal(elementKey('none'),'无');
});
test('单属性：弱点×2、耐性×0.5、无效×0；无属性对任何抗性表恒为1',()=>{
 assert.equal(hpLoss(strike(fight(typed(['火']),{火:2}))),40);
 assert.equal(hpLoss(strike(fight(typed(['火']),{火:.5}))),10);
 assert.equal(hpLoss(strike(fight(typed(['火']),{火:0}))),0);
 assert.equal(hpLoss(strike(fight(typed(['无']),{无:0,火:0,物:0}))),20);
 const b=strike(fight(typed(['火']),{火:0}));assert.ok(b.log.some(l=>l.kind==='affinity'&&l.detail==='火·无效'));
});
test('多属性默认按目标最弱抗性（倍率最高）的属性结算一次',()=>{
 assert.equal(hpLoss(strike(fight(typed(['火','水']),{火:0,水:2}))),40);
 assert.equal(hpLoss(strike(fight(typed(['火','水']),{火:.5,水:.5}))),10);
 assert.deepEqual(bestType({火:0,水:1.5},['火','水']),{type:'水',multiplier:1.5});
});
test('perType：每个属性各以全额威力独立结算一次',()=>{
 assert.equal(hpLoss(strike(fight(typed(['火','水'],{perType:true}),{火:0,水:2}))),40+0);
 assert.equal(hpLoss(strike(fight(typed(['火','水','物'],{perType:true}),{}))),60);
});
test('百分比伤害视为无属性且无视抗性；真实通道亦为无属性',()=>{
 const pct=damageAction(0);const e=pct.effects[0] as Dmg;e.types=['火'];e.amounts.physical={...flat(0),maxResource:'hp',maxFraction:.1,subject:'target'};
 assert.deepEqual(resolveDamageTypes(e),{types:['无'],perType:false,fixed:'percent'});
 assert.equal(hpLoss(strike(fight(pct,{火:0}))),10);
 const tru=damageAction(0);(tru.effects[0] as Dmg).amounts.true=flat(30);(tru.effects[0] as Dmg).types=['暗'];
 assert.deepEqual(resolveDamageTypes(tru.effects[0] as Dmg).types,['无']);assert.equal(hpLoss(strike(fight(tru,{暗:0}))),30);
});
test('缺失标签按通道推导：物理→物，精神→精，能量/真实→无；旧element字段仍可归并',()=>{
 const e={...(damageAction().effects[0] as Dmg),types:undefined};assert.deepEqual(resolveDamageTypes(e).types,['物']);
 const m={...e,amounts:{...e.amounts,physical:zero(),mental:flat(10)}};assert.deepEqual(resolveDamageTypes(m).types,['精']);
 const en={...e,amounts:{...e.amounts,physical:zero(),energy:flat(10)}};assert.deepEqual(resolveDamageTypes(en).types,['无']);
 assert.deepEqual(resolveDamageTypes({...en,element:'冰'}).types,['水']);
 const repaired=repairAction({target:'enemy',effects:[{op:'damage',amounts:{physical:{flat:5}},element:'雷电'}]}).value as {effects:Dmg[]};
 assert.deepEqual(repaired.effects[0]!.types,['光']);assert.equal(repaired.effects[0]!.element,'none');
});
test('降级编译的属性推断遵守分类表',()=>{
 assert.deepEqual(inferDamageTypes('爆炸箭矢','physical'),['火']);assert.deepEqual(inferDamageTypes('激光切割','energy'),['光']);assert.deepEqual(inferDamageTypes('剧毒匕首','physical'),['暗']);
 assert.deepEqual(inferDamageTypes('魔力弹','energy'),['无']);assert.deepEqual(inferDamageTypes('重剑横斩','physical'),['物']);assert.deepEqual(inferDamageTypes('心灵冲击','mental'),['精']);assert.deepEqual(inferDamageTypes('未知术式','energy'),['无']);
});
test('抗性修正与免疫规则使用同一张表：element_resist 冰 归并为水；玩家默认全1.0',()=>{
 const resist:ActionSpec={...damageAction(),target:'self',effects:[{op:'element_resist',element:'冰',multiplier:.5}]};
 const b=createBattle([{id:'a',side:'ally',card:card(resist,'/技能/霜衣'),current:{hp:100,mp:80,sp:100},mitigation:mitigation()},{id:'e',side:'enemy',card:card(typed(['水'])),current:{hp:100,mp:80,sp:100},mitigation:mitigation()}],5);
 const ready=advanceBattle(b,100000).battle;const after=resolveAction(chooseAction(ready,'a','/技能/霜衣','a'));
 assert.equal(after.units[0]!.mitigation.elementMultipliers['水'],.5);
 assert.deepEqual(mitigation().elementMultipliers,{});
});
test('故事的主人：精神属性伤害归零并免疫失格类控制',()=>{
 const e=STORY_MASTER.effects.find(x=>x.op==='element_resist') as Extract<EffectSpec,{op:'element_resist'}>;assert.equal(e.element,'精');assert.equal(e.multiplier,0);
 assert.equal(STORY_MASTER.effects.filter(x=>x.op==='rule').length,4);
});
test('433种怪物全部有抗性条目；倍率只在五档内；普通怪不因层级新增无效档；Boss/精英高层级主要耐性升为无效',()=>{
 const ids=[...MONSTERS.map(m=>m.id),MIMIC_ID];assert.equal(ids.length,433);
 const steps=new Set([0,.5,1,1.5,2]);let distinct=new Set<string>(),withAffinity=0,immuneNormal=0;
 for(const m of MONSTERS){assert.ok(MONSTER_RESISTANCE[m.id],m.id);const base=monsterResistance(m.id,1,m.role);for(let tier=1;tier<=7;tier++){const t=monsterResistance(m.id,tier,m.role);for(const [k,v] of Object.entries(t)){assert.ok(steps.has(v),m.id+k+v);assert.notEqual(k,'无');if(m.role==='普通'&&v===0&&base[k]!==0)immuneNormal++;}}
  if(Object.keys(base).length)withAffinity++;distinct.add(JSON.stringify(base));}
 assert.equal(immuneNormal,0);assert.ok(withAffinity>=425,'无相性怪物应极少: '+withAffinity);assert.ok(distinct.size>=150);
 assert.equal(monsterResistance('T05_B01',1,'Boss')['精'],0);assert.equal(monsterResistance('T05_B01',1,'Boss')['光'],2);
 assert.equal(monsterResistance('T02_N03',1,'普通')['火'],.5);assert.equal(monsterResistance('T02_N03',7,'普通')['火'],.5);
 assert.equal(monsterResistance('T02_E02',4,'精英')['火'],.5);assert.equal(monsterResistance('T02_E02',5,'精英')['火'],0);assert.equal(monsterResistance('T02_E02',7,'精英')['水'],1.5);
});
test('怪物套件接入抗性表，且每个伤害效果都带属性标签；宝箱怪不因层级获得无效',()=>{
 const kit=monsterKit('T05_B01',25);assert.equal(kit.mitigation.elementMultipliers['精'],0);assert.ok(kit.counterplay.some(x=>x.startsWith('属性：')&&x.includes('精无效')));
 const walk=(effects:EffectSpec[],visit:(d:Dmg)=>void)=>{for(const e of effects){if(e.op==='damage')visit(e);}};
 let count=0;for(const id of ['T05_B01','T12_N03','T03_B01','T16_B01',MIMIC_ID]){const k=id===MIMIC_ID?mimicKit(30):monsterKit(id,25);for(const s of k.card.skills){const a=s.mapping.action;if(!a)continue;const all=[a,...Object.values(a.library?.actions??{})];for(const x of all)walk(x.effects,d=>{count++;assert.ok(d.types&&d.types.length>=1,id+':'+s.name);assert.equal(d.element,'none');});}}
 assert.ok(count>20);
 const chime=monsterKit('T03_B01',10).card.skills.find(s=>s.name.includes('鼓'))?.mapping.action?.effects.find(e=>e.op==='damage') as Dmg|undefined;if(chime)assert.deepEqual(chime.types,['物','精']);
 for(const tier of [1,5,7])for(const v of Object.values(mimicKit(tier*4).mitigation.elementMultipliers))assert.notEqual(v,0);
 assert.ok(MONSTER_BY_ID.T02_N03);
});
test('能力说明展示属性与结算方式',()=>{
 assert.match(describeEffect(typed(['火','水']).effects[0]!),/火\/水属性，取目标最弱抗性/);
 assert.match(describeEffect(typed(['火','水'],{perType:true}).effects[0]!),/各结算一次/);
 const pct=damageAction(0).effects[0] as Dmg;pct.amounts.physical={...flat(0),maxResource:'hp',maxFraction:.1,subject:'target'};assert.match(describeEffect(pct),/百分比·无属性/);
});
test('玩家抗性表：默认六属性全1.0；种族特例（花灵弱火）叠加在默认表上',()=>{
 const base=hostMitigation(card());assert.deepEqual(base.elementMultipliers,{物:1,火:1,水:1,暗:1,光:1,精:1});
 const flower={...card(),traits:{tags:['性别:女','种族:花灵']}};assert.equal(hostMitigation(flower).elementMultipliers['火'],1.5);assert.equal(hostMitigation(flower).elementMultipliers['物'],1);
 assert.deepEqual(raceResistance({traits:{tags:['种族:人类']}}),{});
});
