import test from 'node:test';import assert from 'node:assert/strict';
import {MONSTER_ROSTER} from '../src/game/monsters/catalog';
import {monsterKit} from '../src/game/monsters/kits';
import {MONSTER_MECHANICS} from '../src/game/monsters/designs';
import {ACTIVES,AUTHORITIES,KINGDOMS,LAWS,PASSIVES} from '../src/game/monsters/mechanics';
import {TIER_START} from '../src/game/monsters/numbers';
import {mimicKit} from '../src/game/monsters/mimic';
import {validateCompiled} from '../src/compiler/engine';
import {applyBattleEffects,isAlive,type Battle} from '../src/battle/executor';
import {strike} from '../src/game/content';
import {fire,makeProbe} from '../scripts/audit-monsters';
const unit=(b:Battle,id='npc')=>b.units.find(x=>x.id===id)!;
const shape=(id:string,lv:number)=>JSON.stringify(monsterKit(id,lv).card.skills.map(s=>s.sourceId.split(':').slice(3).join(':')+'='+(s.mapping.action?.name??'').replace(/^[^·]+·/,'')));

test('设计表覆盖 432 种怪物 + 宝箱怪；引用的机制 id 全部存在；同主题内首被动/首主动/权能互不相同',()=>{
 for(const m of MONSTER_ROSTER){const d=MONSTER_MECHANICS[m.id];assert.ok(d,m.id);assert.ok(d.passives.length>=2&&d.actives.length===2);for(const p of d.passives)assert.ok(PASSIVES[p],p);for(const a of d.actives)assert.ok(ACTIVES[a],a);assert.ok(AUTHORITIES[d.authority],d.authority);assert.ok(LAWS[d.law],d.law);if(m.role==='Boss')assert.ok(d.kingdom&&KINGDOMS[d.kingdom],m.id);else assert.equal(d.kingdom,undefined);}
 assert.ok(MONSTER_MECHANICS.COMMON_MIMIC);
 const byTheme=new Map<string,typeof MONSTER_ROSTER>();for(const m of MONSTER_ROSTER)byTheme.set(m.theme,[...(byTheme.get(m.theme)??[]),m]);
 for(const [theme,list] of byTheme){for(const key of ['p','a','u'] as const){const values=list.map(m=>{const d=MONSTER_MECHANICS[m.id]!;return key==='p'?d.passives[0]:key==='a'?d.actives[0]:d.authority;});assert.equal(new Set(values).size,values.length,theme+key);}}
});
test('全局机制四元组唯一：没有两只怪物在核心对、首被动、首主动、权能上完全相同',()=>{
 const seen=new Set<string>();for(const m of MONSTER_ROSTER){const d=MONSTER_MECHANICS[m.id]!;const k=[[...m.cores].sort().join('+'),d.passives[0],d.actives[0],d.authority].join('|');assert.ok(!seen.has(k),k);seen.add(k);}
});
test('层级越高手段越多：主动与被动数量都随层级单调不减，七阶普通怪≥15项、Boss≥20项，且每层结构不同',()=>{
 for(const m of MONSTER_ROSTER){let lastActive=-1,lastPassive=-1;const shapes=new Set<string>();
  for(const lv of TIER_START){const k=monsterKit(m.id,lv);validateCompiled(k.card);const active=k.card.skills.filter(s=>s.mapping.disposition==='active').length,passive=k.card.skills.filter(s=>s.mapping.disposition==='passive').length;
   assert.ok(active>=lastActive&&passive>=lastPassive,m.id+'@'+lv);lastActive=active;lastPassive=passive;shapes.add(shape(m.id,lv));}
  assert.equal(shapes.size,7,m.id);const top=monsterKit(m.id,25).card.skills.length;assert.ok(top>=(m.role==='Boss'?20:15),m.id+' '+top);}
});
test('七阶全量 432 套件两两不同；一阶普通怪仍是“普通”（无被动），精英/Boss 一阶已带一项被动',()=>{
 const seven=new Set<string>();for(const m of MONSTER_ROSTER)seven.add(shape(m.id,25));assert.equal(seven.size,432);
 for(const m of MONSTER_ROSTER){const k=monsterKit(m.id,1);const passives=k.card.skills.filter(s=>s.mapping.disposition==='passive').length;if(m.role==='普通')assert.equal(passives,0,m.id);else assert.equal(passives,1,m.id);}
 const early=MONSTER_ROSTER.filter(m=>m.role==='普通'&&monsterKit(m.id,5).card.skills.some(s=>s.sourceId.includes(':passive-1'))).length;assert.ok(early>140&&early<175,'240 只普通怪中约 65% 二阶获得被动: '+early);
});
test('阶段转换：Boss 三阶起生命过半进入血色形态（visual:red），精英五阶起重影；转换后伤害提升且只触发一次',()=>{
 let b=makeProbe('T01_B01',13);const hp=unit(b).max.hp;assert.ok(!unit(b).statuses?.some(s=>s.definition.tags.includes('visual:red')));
 const h=strike(Math.round(hp*.55));h.effects=h.effects.map(e=>e.op==='damage'?{...e,hitRule:'guaranteed' as const,critChance:0}:e);
 b=applyBattleEffects(b,'dummy',h,['npc']);assert.ok(isAlive(unit(b)));const phase=unit(b).statuses?.find(s=>s.definition.tags.includes('visual:red'));assert.ok(phase,'应进入血色形态');assert.ok(phase!.definition.modifiers?.some(m=>m.stat==='damage_physical'&&m.multiplier===1.15));
 b=applyBattleEffects(b,'dummy',strike(1),['npc']);assert.equal(unit(b).statuses?.filter(s=>s.definition.tags.includes('visual:red')).length,1);
 assert.equal(monsterKit('T01_B01',5).phase,null);assert.equal(monsterKit('T01_E01',17).phase,'afterimage');assert.equal(monsterKit('T01_E01',13).phase,null);assert.equal(monsterKit('T01_N01',25).phase,null);
});
test('独有法则宣告对双方生效：熔炉律使施法者自身也承受 ×1.3',()=>{
 const id=Object.keys(MONSTER_MECHANICS).find(k=>MONSTER_MECHANICS[k]!.law==='furnace_law'&&k!=='COMMON_MIMIC')!;
 let b=makeProbe(id,25);const k=Object.entries(unit(b).actions).find(([key,a])=>key.includes('declare-l-furnace')&&a.tags?.includes('ai:law'))![0];
 b=fire(b,'npc',k,['npc']);assert.ok(unit(b).statuses?.some(s=>s.definition.tags.includes('monster:law-field')),'施法者也在场内');assert.ok(unit(b,'dummy').statuses?.some(s=>s.definition.tags.includes('monster:law-field')),'敌人也在场内');
});
test('宝箱怪同样接入机制表并在七阶带重影',()=>{
 const k=mimicKit(30);validateCompiled(k.card);assert.ok(k.card.skills.some(s=>s.sourceId.includes(':unique-1')));assert.equal(k.phase,'afterimage');
});
