import assert from 'node:assert/strict';
import {validateAction,type ActionSpec,type EffectSpec} from '../src/compiler/contract';
import {assertPassive,createBattle,advanceBattle} from '../src/battle/executor';
import {MONSTER_ROSTER as MONSTERS,MONSTER_THEME_BY_ID} from '../src/game/monsters/catalog';
import {authoredMonsterKit} from '../src/game/monsters/kits';
import {context} from '../src/game/monsters/ir';
import {monsterNumbers,TIER_START} from '../src/game/monsters/numbers';
import {THEME_EXCLUSIVE,type ExclusiveForm} from '../src/game/monsters/theme-malice';
import {malicePlan,hardSeals,exclusiveFor} from '../src/game/monsters/malice-plan';
import {bareMitigation,contentCard,strike} from '../src/game/content';

export const FORMS:ExclusiveForm[]=['seed','full'];
export function allEffects(a:ActionSpec):EffectSpec[]{const out:EffectSpec[]=[...a.effects];for(const x of Object.values(a.library?.actions??{}))out.push(...x.effects);return out;}
const themeIds=(from:number,to:number)=>Array.from({length:to-from+1},(_,i)=>'T'+String(from+i).padStart(2,'0'));

/** 对 [from,to] 范围内的主题跑完整自检清单（§5）。 */
export function checkThemeRange(from:number,to:number){
 const ids=themeIds(from,to);
 for(const id of ids){
  const x=THEME_EXCLUSIVE[id];assert.ok(x,id+' 缺少主题专属');assert.equal(x!.theme,id);
  const boss=MONSTERS.find(m=>m.theme===id&&m.role==='Boss')!,elite=MONSTERS.find(m=>m.theme===id&&m.role==='精英')!;
  for(const m of [boss,elite])for(let tier=3;tier<=7;tier++)for(const form of FORMS){
   const c=context(m,MONSTER_THEME_BY_ID[m.theme]!,monsterNumbers(m,TIER_START[tier-1]!));const a=x!.build(c,form);
   x!.passive?assertPassive(a):validateAction(a);
   assert.ok(a.name&&a.description&&a.tags?.includes('monster:exclusive'),id+':'+form);
   assert.ok(!(a.description??'').includes('对策'),id+' 文案写了对策');
   // 对玩家的“永久”只允许两种：本场（scope battle + permanent，战斗结束即清）或本次迷宫（scope run + 探索时钟）；宿主作用域禁止。
   for(const s of Object.values(a.library?.statuses??{})){assert.notEqual(s.scope,'host');if(s.scope==='run')assert.equal(s.duration.clock,'exploration_time',id+' run 作用域必须走探索时钟');if(s.polarity==='negative'&&s.duration.clock==='permanent')assert.equal(s.scope,'battle',id+' 对玩家的永久负面 '+s.name+' 必须是本场作用域');}
   for(const e of allEffects(a)){
    // 隔离要么 1–3 轮，要么同一动作里带解除条件（如轿子碎裂 → space release）。
    if(e.op==='space'&&e.mode==='isolate')assert.ok(e.duration&&e.duration.value>=1&&(e.duration.value<=3||allEffects(a).some(x=>x.op==='space'&&x.mode==='release')),id+' 隔离必须 1–3 轮或可被解除');
    if(e.op==='time'&&e.mode==='stop')assert.ok(e.duration&&e.duration.value<=1,id+' 时停最多 1 轮');
    if(e.op==='uses'&&e.mode==='seal')assert.ok(e.duration&&(e.duration.clock==='round'||e.duration.clock==='exploration_time'||e.duration.clock==='permanent'),id);
    if(e.op==='apply_status'&&a.library?.statuses[e.status]?.control==='charm')assert.ok(a.library!.statuses[e.status]!.duration.value<=2,id+' 失控最多 2 轮');
    if(e.op==='damage')for(const amt of Object.values(e.amounts))if(amt.maxFraction>0)assert.ok(amt.maxFraction>=.1,id+':'+form+' 百分比 '+amt.maxFraction+' 低于下限');
   }
  }
 }
}

/** 分配：Boss t3+ 100% 完全体、精英 t5+ 100% 雏形、普通怪与低层 0；墙检查照旧。 */
export function checkAssignment(from:number,to:number){
 const ids=new Set(themeIds(from,to));
 for(const m of MONSTERS)for(let tier=1;tier<=7;tier++){
  const p=malicePlan(m,tier),want=exclusiveFor(m,tier);
  if(!ids.has(m.theme)){continue;}
  if(m.role==='Boss'&&tier>=3){assert.ok(p.exclusive&&p.exclusive.form==='full',m.id+' t'+tier+' Boss 缺专属完全体');}
  else if(m.role==='精英'&&tier>=5){assert.ok(p.exclusive&&p.exclusive.form==='seed',m.id+' t'+tier+' 精英缺专属雏形');}
  else assert.equal(p.exclusive,undefined,m.id+' t'+tier+' 不应有专属');
  assert.deepEqual(p.exclusive,want);
  assert.ok(hardSeals(p.seals).length<4,m.id+' t'+tier+' 硬解法封锁≥4');assert.ok(!(['evade','guard','break'] as const).every(x=>p.seals.includes(x)));assert.ok(!(p.seals.includes('command')&&p.seals.includes('skill')));
  if(tier>1)for(const s of malicePlan(m,tier-1).slots)assert.ok(p.slots.some(x=>x.id===s.id),m.id+' t'+tier+' 丢失 '+s.id);
 }
}

/** 套件挂载 + 真实战斗冒烟：开战 + 闲置若干轮不抛错、不卡死、玩家侧始终留下合法目标（隔离/装瓶/失控都有期限）。 */
export function checkKitsAndSmoke(from:number,to:number,rounds=6){
 const ids=themeIds(from,to);
 for(const id of ids)for(const role of ['Boss','精英'] as const){
  const m=MONSTERS.find(x=>x.theme===id&&x.role===role)!,tier=role==='Boss'?7:7;
  const kit=authoredMonsterKit(m,MONSTER_THEME_BY_ID[m.theme]!,TIER_START[tier-1]!);
  const ex=kit.card.skills.find(s=>s.sourceId.endsWith(':exclusive'));assert.ok(ex,m.id+' 套件未挂专属');
  for(const s of kit.card.skills){const a=s.mapping.action!;s.mapping.disposition==='passive'?assertPassive(a):validateAction(a);}
  const dummy=(pid:string)=>{const card=contentCard(25,1e9,18,{probe:{...strike(1),castMs:0}});return {id:pid,side:'ally' as const,card,current:{...card.numeric.max},mitigation:bareMitigation()};};
  let b=createBattle([{id:'npc',name:kit.name,side:'enemy',card:kit.card,combatLevel:25,current:{...kit.card.numeric.max},mitigation:kit.mitigation},dummy('p1'),dummy('p2'),dummy('p3')],17);
  for(let i=0;i<rounds;i++){b.clock.pending=[];for(const c of b.clock.units)c.active=false;b=advanceBattle(b,4000).battle;}
  assert.ok(b.units.filter(u=>u.side==='ally').some(u=>u.current.hp>0),m.id+' 闲置几轮后玩家侧全灭');
 }
}
