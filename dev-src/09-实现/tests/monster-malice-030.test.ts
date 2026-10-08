import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAction} from '../src/compiler/contract';
import {assertPassive} from '../src/battle/executor';
import {MONSTER_ROSTER as MONSTERS,MONSTER_THEME_BY_ID} from '../src/game/monsters/catalog';
import {authoredMonsterKit} from '../src/game/monsters/kits';
import {context} from '../src/game/monsters/ir';
import {monsterNumbers,TIER_START as LEVEL_BY_TIER} from '../src/game/monsters/numbers';
import {ARENAS,MALICE,arenaAction,isPassive,phasePack,type Form} from '../src/game/monsters/malice';
import {malicePlan,hardSeals} from '../src/game/monsters/malice-plan';

const FORMS:Form[]=['seed','full','unbound'];
const sample=(role:'普通'|'精英'|'Boss')=>MONSTERS.find(m=>m.role===role)!;

test('恶意家族：三档形态在七个层级下都能通过契约校验', ()=>{
 for(const m of [sample('普通'),sample('精英'),sample('Boss')])for(let tier=1;tier<=7;tier++){
  const n=monsterNumbers(m,LEVEL_BY_TIER[tier-1]!),t=MONSTER_THEME_BY_ID[m.theme]!;
  for(const [id,x] of Object.entries(MALICE))for(const form of FORMS){const a=x.build(context(m,t,n),form);isPassive(x,form)?assertPassive(a):validateAction(a);assert.ok(a.name,id+':'+form);}
  for(const ar of ARENAS)assertPassive(arenaAction(context(m,t,n),ar));
  assertPassive(phasePack(context(m,t,n),'red'));assertPassive(phasePack(context(m,t,n),'afterimage'));
 }
});

test('真多段是每段全额，不再是分摊总伤', ()=>{
 const m=sample('Boss'),n=monsterNumbers(m,LEVEL_BY_TIER[6]!),t=MONSTER_THEME_BY_ID[m.theme]!;
 for(const form of FORMS){const a=MALICE.multihit!.build(context(m,t,n),form);const d=a.effects.find(e=>e.op==='damage')!;assert.equal(d.op==='damage'&&d.powerMode,'per_hit');assert.ok(d.op==='damage'&&(d.hits??1)>=2);}
});

test('分配器：家族数随层级单调不减，低层没有领域/多动/复活/倒计时，无解墙检查生效', ()=>{
 for(const m of MONSTERS){
  let last=-1;
  for(let tier=1;tier<=7;tier++){
   const p=malicePlan(m,tier);
   assert.ok(p.slots.length>=last,m.id+' t'+tier+' 家族数下降');last=p.slots.length;
   if(tier>1)for(const id of malicePlan(m,tier-1).slots.map(x=>x.id))assert.ok(p.slots.some(x=>x.id===id),m.id+' t'+tier+' 丢失 '+id);
   if(tier<=2){assert.equal(p.arenas.length,0);for(const s of p.slots)assert.ok(!['extra','undying','timer','adds','reader'].includes(s.id),m.id+' t'+tier+' 提前拿到 '+s.id);for(const s of p.slots)assert.notEqual(s.form,'unbound');}
   if(m.role==='普通')assert.equal(p.arenas.length,0);
   assert.ok(hardSeals(p.seals).length<4,m.id+' t'+tier+' 硬解法封锁≥4');assert.ok(!(['evade','guard','break'] as const).every(x=>p.seals.includes(x)));
   assert.ok(!(p.seals.includes('command')&&p.seals.includes('skill')));
   if(tier>=3&&m.role!=='普通')assert.ok(p.rotation);
  }
  const top=malicePlan(m,7);
  if(m.role==='Boss'){assert.ok(top.slots.length>=7,m.id+' 七阶 Boss 家族不足');assert.equal(top.arenas.length,2);assert.ok(top.slots.some(s=>s.id==='reader'));}
  if(m.role==='精英')assert.ok(top.slots.length>=5&&top.arenas.length===1,m.id+' '+top.slots.length);
  if(m.role==='普通')assert.ok(top.slots.length>=4);
 }
});

test('一阶普通怪保留约两成负向样本（不拿恶意家族）', ()=>{
 const normals=MONSTERS.filter(m=>m.role==='普通');const idle=normals.filter(m=>malicePlan(m,1).idle).length;
 assert.ok(idle/normals.length>.12&&idle/normals.length<.3,String(idle/normals.length));
});

test('套件：恶意技能已挂入，面板有对策行，精英/Boss 三阶起有脚本环标签', ()=>{
 for(const role of ['普通','精英','Boss'] as const){
  const m=sample(role),t=MONSTER_THEME_BY_ID[m.theme]!;
  for(let tier=1;tier<=7;tier++){
   const kit=authoredMonsterKit(m,t,LEVEL_BY_TIER[tier-1]!);
   const malice=kit.card.skills.filter(s=>s.sourceId.includes(':malice-'));
   assert.equal(malice.length,kit.malice.slots.length,m.id+' t'+tier);
   for(const s of kit.card.skills){const a=s.mapping.action!;s.mapping.disposition==='passive'?assertPassive(a):validateAction(a);}
   assert.ok(!kit.counterplay.some(x=>x.startsWith('对策：')),m.id+' t'+tier+' 面板仍有对策行');
   for(const s of kit.card.skills)assert.ok(!(s.mapping.action!.description??'').includes('对策：'),s.sourceId+' 文案含对策');
   const ring=kit.card.skills.filter(s=>s.mapping.action!.tags?.some(x=>x.startsWith('ai:rot:')));
   if(kit.malice.rotation)assert.ok(ring.length>=3,m.id+' t'+tier+' 脚本环过短');else assert.equal(ring.length,0);
   if(tier===7&&role==='Boss')assert.ok(kit.card.skills.some(s=>s.sourceId.includes(':arena-2')));
  }
 }
});
