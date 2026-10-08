import {speedFactor} from '../src/battle/clock';
import test from 'node:test';
import assert from 'node:assert/strict';
import {MONSTER_ROSTER,MONSTER_THEMES,MONSTER_BY_ID} from '../src/game/monsters/catalog';
import {monsterKit} from '../src/game/monsters/kits';
import {monsterNumbers,ATTRIBUTE_LIMIT,HP_MULTIPLIER,RESOURCE_MULTIPLIER,TIER_START} from '../src/game/monsters/numbers';
import {validateCompiled} from '../src/compiler/engine';
import {validateAction,type ActionSpec,type EffectSpec} from '../src/compiler/contract';
import {createBattle,applyBattleEffects,advanceBattle,actionUnavailable,isAlive,type Battle} from '../src/battle/executor';
import {suppression,calculateDamage} from '../src/battle/damage';
import {bareMitigation,contentCard,strike,FOES,THEME_ORDER,playtestParty} from '../src/game/content';
import {themeFor,makeRegion} from '../src/game/region';
import {startExpedition,restoreExpedition,view} from '../src/game/expedition';
import {action,flat} from '../src/game/monsters/ir';
import {fire,makeProbe,mechanicsHash} from '../scripts/audit-monsters';
const unit=(b:Battle,id='npc')=>b.units.find(x=>x.id===id)!;
const key=(b:Battle,tag:string,id='npc')=>Object.entries(unit(b,id).actions).find(([,a])=>a.tags?.includes(tag))![0];
const hit=(amount:number):ActionSpec=>{const a=strike(amount);a.effects=a.effects.map(e=>e.op==='damage'?{...e,hitRule:'guaranteed' as const,critChance:0}:e);return a;};
// 闲置：分步推进并在每步前停用全部时钟单位（含途中新出现的召唤物），保证公共时间真的在走。
const idle=(b:Battle,ms:number)=>{b=structuredClone(b);for(let t=0;t<ms;t+=500){b.clock.pending=[];for(const c of b.clock.units)c.active=false;b=advanceBattle(b,Math.min(500,ms-t)).battle;}return b;};
for(const t of MONSTER_THEMES)test(`MK ${t.id} ${t.name}: nine species × seven valid, mechanically distinct tiers`,()=>{
 const monsters=MONSTER_ROSTER.filter(m=>m.theme===t.id);assert.equal(monsters.length,9);assert.deepEqual(monsters.map(m=>m.role),['普通','普通','普通','普通','普通','精英','精英','精英','Boss']);
 for(const m of monsters){const hashes=new Set<string>();for(const lv of TIER_START){const k=monsterKit(m.id,lv);validateCompiled(k.card);hashes.add(mechanicsHash(k.card.skills.map(s=>s.mapping)));assert.equal(k.regular.length,Math.min(7,k.numbers.lifeTier+1));}assert.equal(hashes.size,7,m.id);}
});
test('MK formal roster is connected: 48 themes, 432 species, no missing N05 or art-derived statistics',()=>{
 assert.equal(MONSTER_ROSTER.length,432);assert.equal(Object.keys(FOES).length,434);assert.equal(THEME_ORDER.length,48);
 for(const t of MONSTER_THEMES)assert.equal(FOES[t.id+'_N05']!.name,MONSTER_BY_ID[t.id+'_N05']!.name);
});
test('MK host point budgets, NPC caps and resource equations: all 10,800 species-level cases',()=>{
 for(const m of MONSTER_ROSTER)for(let lv=1;lv<=25;lv++){
  const n=monsterNumbers(m,lv),a=n.attributes,s=Object.values(a).reduce((x,y)=>x+y,0),r=RESOURCE_MULTIPLIER[n.lifeTier-1]!;
  assert.equal(s,n.talentBudget+5*(n.lifeTier-1)+lv-1);assert.ok(Object.values(n.talent).every(x=>x<=6));assert.ok(Object.values(a).every(x=>Number.isInteger(x)&&x<=ATTRIBUTE_LIMIT[n.lifeTier-1]!));
  assert.equal(n.base.hp,a.体质*100*HP_MULTIPLIER[n.lifeTier-1]!+s);assert.equal(n.base.mp,(a.智力+a.精神)*50*r);assert.equal(n.base.sp,(a.力量+a.敏捷)*50*r);
  assert.deepEqual(n.base,n.max);
 }
});
test('MK T1 normal species are ordinary: no debuff, proc, law, authority or passive inflation (elites/bosses may carry one authored passive)',()=>{
 for(const m of MONSTER_ROSTER.filter(m=>m.role==='普通')){const k=monsterKit(m.id,1);assert.equal(k.ascended.length,0);for(const s of k.card.skills){const a=s.mapping.action!;assert.equal(s.mapping.disposition,'active');assert.ok(a.effects.every(e=>['damage','shield','heal'].includes(e.op)));assert.equal(a.library,undefined);}}
});
test('MK T2 core skills do not grant forbidden hit/evade/initiative bonuses; statuses and DOT stay short (authored passives are a separate, disclosed budget)',()=>{
 for(const m of MONSTER_ROSTER){const k=monsterKit(m.id,5);for(const skill of k.card.skills.filter(s=>!/:(passive|unique)-|:phase$/.test(s.sourceId))){const a=skill.mapping.action!;for(const s of Object.values(a.library?.statuses??{})){assert.ok(s.duration.value<=2);assert.ok(!s.control);assert.ok(!(s.modifiers??[]).some(x=>['hit','evade','speed','check_spirit'].includes(x.stat)));}for(const e of a.effects)if(e.op==='modify')assert.ok(!e.modifiers.some(x=>['hit','evade','speed'].includes(x.stat)));}}
});
test('MK ascension is consumed, never stacked across element/authority/law; normal skills have actual quality',()=>{
 for(const m of MONSTER_ROSTER)for(const lv of TIER_START){const k=monsterKit(m.id,lv),s=k.numbers.lifeTier;
  assert.equal(k.elements,s===4?2:0);assert.equal(k.authorities,s===5?1:0);assert.equal(k.laws,s===6?1:s===7?(m.role==='Boss'?3:2):0);
  for(const skill of k.card.skills){const a=skill.mapping.action!;if(a.source!.kind==='skill')assert.equal(a.source!.quality,['common','uncommon','rare','epic','legendary','mythic','mythic'][s-1]);else assert.equal(a.source!.quality,undefined);}
 }
});
test('MK authority MP/SP each 25%; every law declaration MP/SP each 50%, once per battle',()=>{
 for(const m of MONSTER_ROSTER){
  const authority=monsterKit(m.id,17).card.skills.find(s=>s.sourceId.endsWith(':authority'))!.mapping.action!;assert.equal(authority.cost.mp.maxFraction,.25);assert.equal(authority.cost.sp.maxFraction,.25);
  for(const lv of [21,25])for(const skill of monsterKit(m.id,lv).card.skills.filter(s=>s.mapping.action?.source?.kind==='law')){const a=skill.mapping.action!;assert.equal(a.grantedActions?.length,1);const d=a.library!.actions[a.grantedActions![0]!]!;assert.equal(d.cost.mp.maxFraction,.5);assert.equal(d.cost.sp.maxFraction,.5);assert.equal(d.perBattleUses,1);}
 }
});
test('MK rank is not life tier: non-boss gods have two laws + divine position but no kingdom',()=>{
 for(const m of MONSTER_ROSTER){const k=monsterKit(m.id,25);assert.equal(k.divinePosition,true);assert.equal(k.divineKingdom,m.role==='Boss');assert.equal(k.laws,m.role==='Boss'?3:2);}
});
test('MK mythic zombie is not a scaled bite: cost, finite damage budget, forbidden healing and law are real',()=>{
 const low=monsterKit('T01_N01',1),myth=monsterKit('T01_N01',24);assert.equal(low.laws,0);assert.equal(myth.laws,1);assert.ok(myth.card.skills.some(s=>s.mapping.action?.effects.some(e=>e.op==='rule'&&e.rule==='no_heal')));
 let b=makeProbe('T01_N01',24),hp=unit(b).current.hp;b=applyBattleEffects(b,'dummy',hit(1e8),['npc']);assert.ok(unit(b).current.hp>=hp*.44);assert.ok(isAlive(unit(b)));
});
test('MK law actually pays both maximum-resource costs and cannot cast twice',()=>{
 let b=makeProbe('T01_N01',24),k=key(b,'ai:law'),before={...unit(b).current},max={...unit(b).max};b=fire(b,'npc',k,['dummy']);
 assert.equal(unit(b).current.mp,before.mp-Math.ceil(max.mp*.5));assert.equal(unit(b).current.sp,before.sp-Math.ceil(max.sp*.5));assert.ok(actionUnavailable(b,unit(b),k));
});
test('MK peak kingdom summons an attackable owner-bound anchor and really affects the enemy',()=>{
 let b=makeProbe('T01_B01',25);b=fire(b,'npc',key(b,'ai:kingdom'),['npc']);
 const anchor=b.units.find(x=>x.owner==='npc'&&x.tags?.includes('monster:realm-anchor'))!;assert.ok(anchor&&isAlive(anchor));assert.equal(anchor.summon?.rewardEligible,false);assert.equal(b.fields?.length,1);assert.ok(unit(b,'dummy').statuses?.some(s=>s.definition.tags.includes('monster:realm')));
 b=applyBattleEffects(b,'dummy',hit(1e9),[anchor.id]);assert.equal(isAlive(unit(b,anchor.id)),false);assert.equal(b.fields?.length,0);assert.ok(!unit(b,'dummy').statuses?.some(s=>s.definition.tags.includes('monster:realm')));
});
test('MK same-species domains compete by level; someone else’s anchor cannot sustain the winner',()=>{
 const a=monsterKit('T01_B01',25),b=monsterKit('T01_B01',26),dummy=contentCard(25,1e9,20,{probe:hit(1)});
 let battle=createBattle([{id:'a',side:'enemy',card:a.card,combatLevel:25,current:{...a.card.numeric.max},mitigation:a.mitigation},{id:'b',side:'enemy',card:b.card,combatLevel:26,current:{...b.card.numeric.max},mitigation:b.mitigation},{id:'dummy',side:'ally',card:dummy,current:{...dummy.numeric.max},mitigation:bareMitigation()}],1);
 battle=fire(battle,'a',key(battle,'ai:kingdom','a'),['a']);battle=fire(battle,'b',key(battle,'ai:kingdom','b'),['b']);assert.equal(battle.fields?.[0]?.owner,'b');
 const anchor=battle.units.find(x=>x.owner==='b'&&x.tags?.includes('monster:realm-anchor'))!;
 battle=applyBattleEffects(battle,'dummy',hit(1e9),[anchor.id]);assert.equal(battle.fields?.length,0);assert.ok(battle.units.some(x=>x.owner==='a'&&x.tags?.includes('monster:realm-anchor')&&isAlive(x)));
});
test('MK domain expires on public time even if nobody acts; save/restore does not reset declaration uses',()=>{
 let b=makeProbe('T01_B01',25),k=key(b,'ai:kingdom');b=fire(b,'npc',k,['npc']);const restored=JSON.parse(JSON.stringify(b)) as Battle;assert.ok(actionUnavailable(restored,unit(restored),k));assert.deepEqual(idle(restored,16000),idle(b,16000));assert.equal(idle(restored,16000).fields?.length,0);
});
test('MK summons are finite and rewardless, not new formal species or copied boss passives',()=>{
 let b=makeProbe('T01_N04',9),k=Object.entries(unit(b).actions).find(([,a])=>a.effects.some(e=>e.op==='summon'))![0];b=fire(b,'npc',k);
 const minion=b.units.find(x=>x.owner==='npc')!;assert.equal(minion.summon?.rewardEligible,false);assert.equal(minion.summon?.clock,'round');assert.ok(!minion.passives||Object.keys(minion.passives).length===0);b=idle(b,8000);assert.equal(isAlive(unit(b,minion.id)),false);
});
test('MK all 48 themes available at level one over seeds; full cycle includes each theme once',()=>{
 const seen=new Set<string>();for(let seed=0;seed<5000;seed++)seen.add(themeFor(1,seed));assert.equal(seen.size,48);
 const cycle=new Set<string>();for(let d=1;d<=144;d+=3){cycle.add(themeFor(d,17));assert.equal(themeFor(d,17),themeFor(d+2,17));}assert.equal(cycle.size,48);
});
test('MK every regular N01–N05 and every elite/boss is reachable, not merely in an unused library',()=>{
 const found=new Set<string>();for(let visit=0;visit<2;visit++)for(let depth=1;depth<=144;depth++){const r=makeRegion(depth,visit,17);for(const t of r.things)for(const id of t.foes){assert.ok(FOES[id]);found.add(id);}}
 assert.equal(found.size,433);
});
test('MK kit level stays 25 above 25, challenge level is real and numeric overflow is bounded',()=>{
 for(const level of [26,100,1000,1000000]){const k=monsterKit('T01_B01',level);validateCompiled(k.card);assert.equal(k.numbers.kitLevel,25);assert.equal(k.numbers.lifeTier,7);assert.ok(Object.values(k.numbers.max).every(Number.isFinite));const b=makeProbe('T01_B01',level);assert.equal(unit(b).level,level);assert.deepEqual(k.numbers.attributes,monsterKit('T01_B01',25).numbers.attributes);}
 const p=suppression(1000000,25);assert.ok(Number.isFinite(p.damageMultiplier));assert.equal(p.damageMultiplier*suppression(25,1000000).damageMultiplier,1);
});
test('MK playable payload offers source-aware enemy ability details; restore preserves region seed',()=>{
 const s=startExpedition(playtestParty(),17);assert.equal(s.regionSeed,17);const restored=restoreExpedition(JSON.parse(JSON.stringify(s)));assert.equal(restored.regionSeed,17);assert.equal(view(s).themeName,MONSTER_THEMES.find(t=>t.id===s.region.theme)!.name);
});

test('MK whole-action reflection listens to being attacked, never reflects its owner’s outgoing action',()=>{
 let b=makeProbe('T02_N01',25);const r=(x:Battle)=>unit(x).statuses!.find(s=>s.definition.triggers?.some(t=>t.id==='return-whole'))!;
 const basic=Object.entries(unit(b).actions).find(([k])=>k.endsWith(':attack'))![0];b=fire(b,'npc',basic,['dummy']);assert.equal(r(b).used['return-whole']??0,0);
 for(const e of unit(b,'dummy').actions.probe!.effects)if(e.op==='damage'){e.hitRule='guaranteed';e.amounts.physical.flat=1000;}
 b=fire(b,'dummy','probe',['npc']);assert.equal(r(b).used['return-whole'],1);
});
test('MK delayed retribution captures actual damage and the original attacker, not a zero/new event',()=>{
 let b=makeProbe('T11_N01',21);for(const e of unit(b,'dummy').actions.probe!.effects)if(e.op==='damage'){e.hitRule='guaranteed';e.amounts.physical.flat=1000;}
 b=fire(b,'dummy','probe',['npc']);assert.ok(b.scheduled?.length);const hp=unit(b,'dummy').current.hp;b=idle(b,4000);assert.ok(unit(b,'dummy').current.hp<hp);
});
test('MK initiative points do not become ninefold haste or negative speed; next clock tick is valid',()=>{
 let b=makeProbe('T12_N04',9),k=Object.entries(unit(b).actions).find(([id])=>id.endsWith(':primary'))![0];for(const e of unit(b).actions[k]!.effects)if(e.op==='damage')e.hitRule='guaranteed';
 for(let seed=1;seed<30;seed++){const attempt=structuredClone(b);attempt.seed=seed;const r=fire(attempt,'npc',k,['dummy']);if(r.clock.units.find(x=>x.id==='dummy')!.speedBonus===-2){b=r;break;}}assert.equal(b.clock.units.find(x=>x.id==='dummy')!.speedBonus,-2);assert.ok(speedFactor(b.clock.units.find(x=>x.id==='dummy')!)>0);b.clock.pending=[];advanceBattle(b,100);
 b=makeProbe('T01_N01',21);b=fire(b,'npc',key(b,'ai:purge'),['dummy']);assert.equal(b.clock.units.find(x=>x.id==='npc')!.speedBonus,8);assert.ok(speedFactor(b.clock.units.find(x=>x.id==='npc')!)<3);
});
test('MK combo control checks a pre-existing species mark, not the mark added later by the same cast',()=>{
 const a=monsterKit('T01_N01',17).card.skills.find(s=>s.sourceId.endsWith(':combination'))!.mapping.action!,effects=a.effects;
 const controlled=effects.findIndex(e=>e.op==='apply_status'&&e.conditions?.length),marked=effects.findIndex(e=>e.op==='apply_status'&&!e.conditions?.length);assert.ok(controlled>=0&&marked>controlled);
});

test('MK host hit/evade checks take the strongest independent source, while stacks of one source remain meaningful',()=>{
 let b=makeProbe('T01_N01',21);
 const modifier=(n:number)=>action([{op:'modify',name:'独立检定',duration:{clock:'round',value:3},modifiers:[{stat:'hit',flat:n},{stat:'evade',flat:n}]}],'self');
 b=applyBattleEffects(b,'npc',modifier(.30),['npc'],'effect','independent-a');assert.equal(unit(b).stats!.hit,.45);assert.equal(unit(b).stats!.evade,.45);
 b=applyBattleEffects(b,'npc',modifier(-.20),['npc'],'effect','independent-negative');assert.equal(unit(b).stats!.hit,.25);
});

test('MK an infection kingdom has a real local rule, not only a renamed slow aura',()=>{
 let b=makeProbe('T01_B01',26);b=fire(b,'npc',key(b,'ai:kingdom'),['npc']);unit(b,'dummy').current.hp-=1000;
 const before=unit(b,'dummy').current.hp;b=applyBattleEffects(b,'dummy',action([{op:'heal',resource:'hp',amount:flat(100)}],'self'),['dummy']);assert.ok(unit(b,'dummy').current.hp<before);
 const anchor=b.units.find(x=>x.owner==='npc'&&x.tags?.includes('monster:realm-anchor'))!;b=applyBattleEffects(b,'dummy',hit(1e9),[anchor.id]);const hp=unit(b,'dummy').current.hp;b=applyBattleEffects(b,'dummy',action([{op:'heal',resource:'hp',amount:flat(100)}],'self'),['dummy']);assert.ok(unit(b,'dummy').current.hp>hp);
});
test('MK full laws declare across the current battlefield; no hidden eighth-tier quality',()=>{
 const k=monsterKit('T01_N01',24),law=k.card.skills.find(s=>s.mapping.action?.source?.kind==='law')!.mapping.action!,a=law.library!.actions[law.grantedActions![0]!]!;
 assert.equal(a.targeting?.selection,'all');assert.equal(a.targeting?.side,'enemy');assert.ok(a.effects.some(e=>e.op==='damage'&&e.amounts.true.maxFraction===.25));
});
