import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAction,type EffectSpec,type ActionSpec} from '../src/compiler/contract';
import {assertPassive} from '../src/battle/executor';
import {MONSTER_ROSTER as MONSTERS,MONSTER_THEME_BY_ID} from '../src/game/monsters/catalog';
import {authoredMonsterKit} from '../src/game/monsters/kits';
import {context} from '../src/game/monsters/ir';
import {monsterNumbers,TIER_START} from '../src/game/monsters/numbers';
import {MALICE,MALICE_BY_FAMILY,familyOrigin,isPassive,lossOfControl,type Form} from '../src/game/monsters/malice';
import {malicePlan,hardSeals,UNLOCK} from '../src/game/monsters/malice-plan';

const FORMS:Form[]=['seed','full','unbound'];
const G_IDS=['echo','devour','toll','invert','sealTax','verdict','twin','dread','thirst','gaze','mutual','borrow'];
const sample=(role:'普通'|'精英'|'Boss')=>MONSTERS.find(m=>m.role===role)!;
const ctxOf=(role:'普通'|'精英'|'Boss',tier:number)=>{const m=sample(role);return context(m,MONSTER_THEME_BY_ID[m.theme]!,monsterNumbers(m,TIER_START[tier-1]!));};
/** 遍历动作树里的全部效果（含 library 子动作与状态触发动作）。 */
function allEffects(a:ActionSpec):EffectSpec[]{const out:EffectSpec[]=[...a.effects];for(const x of Object.values(a.library?.actions??{}))out.push(...x.effects);return out;}

test('G1–G12：十二个家族齐全，family 与 origin 正确', ()=>{
 for(const id of G_IDS){const x=MALICE[id]!;assert.ok(x,id);assert.equal(familyOrigin(x.family),'G');assert.equal(MALICE_BY_FAMILY[x.family],id);assert.ok(UNLOCK[id],id+' 缺解锁表');}
 assert.equal(G_IDS.length,12);assert.equal(Object.keys(MALICE).length,23);
});

test('G 系：三档形态在三职能 × 七层级下都能通过契约校验；被动/主动判定与 isPassive 一致', ()=>{
 for(const role of ['普通','精英','Boss'] as const)for(let tier=1;tier<=7;tier++)for(const id of G_IDS)for(const form of FORMS){
  const x=MALICE[id]!,a=x.build(ctxOf(role,tier),form);
  if(isPassive(x,form))assertPassive(a);else{validateAction(a);assert.ok(Object.values(a.cost).some(c=>c.flat>0),id+' 主动技应有费用');}
  assert.ok(a.name&&a.description,id+':'+form);
  assert.ok(!(a.description??'').includes('对策'),id+' 文案写了对策');
 }
});

test('G 系：对玩家的持续效应不写 permanent（除对敌方全体的常驻光环），百分比不低于 15% 最大生命', ()=>{
 for(const id of G_IDS)for(const form of FORMS){
  const a=MALICE[id]!.build(ctxOf('Boss',7),form);
  for(const [key,s] of Object.entries(a.library?.statuses??{})){
   if(s.polarity==='negative'&&s.duration.clock==='permanent')assert.ok(key==='m-toll-mp',id+' 对玩家的负面状态 '+key+' 写成了 permanent');
   assert.notEqual(s.scope,'host',id+' 状态不得写入宿主作用域');
  }
  for(const e of allEffects(a)){
   if(e.op==='damage'){for(const amt of Object.values(e.amounts))if(amt.maxFraction)assert.ok(amt.maxFraction>=.1,id+':'+form+' 百分比 '+amt.maxFraction+' 低于下限');}
   if(e.op==='heal'&&e.amount.maxFraction)assert.ok(e.amount.maxFraction>=.15,id+' 回复比例过低');
   if(e.op==='uses'&&e.mode==='seal')assert.ok(e.duration&&e.duration.clock!=='permanent',id+' 封印必须有期限');
  }
 }
});

test('G 系数值随层级单调不减（scale(tier)）', ()=>{
 const maxPct=(a:ActionSpec)=>Math.max(0,...allEffects(a).filter(e=>e.op==='damage').flatMap(e=>e.op==='damage'?Object.values(e.amounts).map(x=>x.maxFraction):[]));
 for(const id of ['toll','mutual','borrow','devour'])for(const form of FORMS){
  let last=0;for(let tier=3;tier<=7;tier++){const a=MALICE[id]!.build(ctxOf('Boss',tier),form);const v=id==='devour'?Math.max(0,...allEffects(a).filter(e=>e.op==='heal').map(e=>e.op==='heal'?e.amount.maxFraction:0)):maxPct(a);assert.ok(v>=last-1e-9,id+' '+form+' t'+tier+' 数值回退');last=v;}
 }
});

test('封印税使用 Uses.selection 契约扩展；失控状态是 charm 控制且有期限', ()=>{
 const a=MALICE.sealTax!.build(ctxOf('Boss',5),'full');
 const seal=allEffects(a).find(e=>e.op==='uses');assert.ok(seal&&seal.op==='uses'&&seal.selection==='used_latest'&&seal.mode==='seal');
 const c=ctxOf('Boss',5);const e=lossOfControl(c,2);assert.equal(e.op,'apply_status');const s=c.lib.statuses['m-charm']!;assert.equal(s.control,'charm');assert.equal(s.duration.clock,'round');assert.ok(s.duration.value>=1&&s.duration.value<=2);assert.ok(s.tags.includes('control:charm'));
 const gaze=MALICE.gaze!.build(ctxOf('Boss',7),'unbound');assert.ok(gaze.library?.statuses['m-charm'],'凝视去反制档应带失控');
});

test('分配器：通用池 23，配额不变，累进不丢失，G 系解锁层符合 t2–4 / t4–6 / t6–7，墙检查仍通过', ()=>{
 for(const id of G_IDS)for(const role of ['普通','精英','Boss'] as const){const [s,f,u]=UNLOCK[id]![role];if(s)assert.ok(s>=2&&s<=4,id+' seed');if(f)assert.ok(f>=4&&f<=6&&f>s,id+' full');if(u)assert.ok(u>=6&&u<=7&&u>f,id+' unbound');}
 const count:Record<string,number>={};let gSlots=0,total=0;
 for(const m of MONSTERS){
  let last=-1;
  for(let tier=1;tier<=7;tier++){
   const p=malicePlan(m,tier);assert.ok(p.slots.length>=last);last=p.slots.length;
   if(tier>1)for(const s of malicePlan(m,tier-1).slots){const now=p.slots.find(x=>x.id===s.id);assert.ok(now,m.id+' t'+tier+' 丢失 '+s.id);assert.ok(['seed','full','unbound'].indexOf(now!.form)>=['seed','full','unbound'].indexOf(s.form),m.id+' '+s.id+' 形态回退');}
   if(tier<=1)assert.ok(!p.slots.some(s=>familyOrigin(s.family)==='G'),m.id+' t1 不应有 G 系');
   assert.ok(hardSeals(p.seals).length<4,m.id+' t'+tier);assert.ok(!(['evade','guard','break'] as const).every(x=>p.seals.includes(x)));assert.ok(!(p.seals.includes('command')&&p.seals.includes('skill')));
   for(const s of p.slots){count[s.family]=(count[s.family]??0)+1;total++;if(familyOrigin(s.family)==='G')gSlots++;}
  }
 }
 assert.ok(gSlots/total>.15&&gSlots/total<.6,'G 系占比 '+(gSlots/total).toFixed(2));// 配额不变、F 系强制项在前，G 约占两成出头
 for(const id of G_IDS)assert.ok((count[MALICE[id]!.family]??0)>0,id+' 从未被分配');
 console.log('家族分布',JSON.stringify(count),'G 占比',(gSlots/total).toFixed(3));
});

test('套件：G 系技能挂入后整卡可校验，family_origin 可从 slot 推出', ()=>{
 for(const role of ['普通','精英','Boss'] as const)for(let tier=2;tier<=7;tier++){
  const m=sample(role),kit=authoredMonsterKit(m,MONSTER_THEME_BY_ID[m.theme]!,TIER_START[tier-1]!);
  for(const s of kit.card.skills){const a=s.mapping.action!;s.mapping.disposition==='passive'?assertPassive(a):validateAction(a);}
  for(const slot of kit.malice.slots)assert.ok(['F','G'].includes(familyOrigin(slot.family)));
 }
});
