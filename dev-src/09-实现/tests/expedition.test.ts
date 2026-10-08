import {monsterNumbers} from '../src/game/monsters/numbers';
import {MONSTER_BY_ID} from '../src/game/monsters/catalog';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {FOES,playtestParty,TOTAL_DEPTH} from '../src/game/content';
import {costFor,assertExecutable} from '../src/battle/executor';
import {acquireRelic,startExpedition,restoreExpedition,move,interact,withdraw,eventChoice,supplierChoice,tick,chooseSkill,chooseTarget,flee,view,dismissWarning,type State} from '../src/game/expedition';
import {makeRegion,walkable,type Thing} from '../src/game/region';
import {installEventFixture} from './supplier-fixture';
function pathTo(s:State,x:number,z:number){
 const q=[{x:s.x,z:s.z,path:[] as {dx:number;dz:number}[]}],seen=new Set([`${s.x},${s.z}`]);
 for(const p of q){if(p.x===x&&p.z===z)return p.path;for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=p.x+dx!,nz=p.z+dz!,key=`${nx},${nz}`;if(seen.has(key)||!walkable(s.region,nx,nz))continue;if(s.region.things.some(t=>t.kind==='enemy'&&!t.used&&t.x===nx&&t.z===nz)&&!(nx===x&&nz===z))continue;seen.add(key);q.push({x:nx,z:nz,path:[...p.path,{dx:dx!,dz:dz!}]});}}
 throw Error(`No route to ${x},${z}`);
}
function go(s:State,t:Pick<Thing,'x'|'z'>){for(const d of pathTo(s,t.x,t.z))move(s,d.dx,d.dz);}
function use(s:State,kind:Thing['kind']){
 let t=s.region.things.find(t=>t.kind===kind&&!t.used);
 if(!t&&(kind==='event'||kind==='camp')){
  const supplier=s.region.things.find(t=>t.kind==='supplier'&&!t.used);
  if(supplier){go(s,supplier);interact(s);supplierChoice(s,kind==='event'?'event':'bench');t=s.region.things.find(t=>t.kind===kind&&!t.used);}
 }
 if(!t&&['chest','event','camp'].includes(kind))return;
 assert.ok(t,kind);go(s,t);interact(s);
}
function seedWithChest(start:number){for(let seed=start;;seed++)if(makeRegion(1,0,seed).things.some(t=>t.kind==='chest'))return seed;}
function event(s:State){use(s,'event');eventChoice(s,0);if(s.mode==='event'&&s.eventState?.offers.length)eventChoice(s,0);}
function fight(s:State,defend=false){
 let decisions=0;
 for(let i=0;s.mode==='battle'&&i<20000;i++){
  const v=view(s);
  if(v.battle.ready){
   const b=s.battle!,u=b.units.find(u=>u.id===b.clock.pending[0]!.unitId)!;
   const ally=b.units.filter(u=>u.side==='ally'&&u.current.hp>0).sort((a,b)=>a.current.hp/a.max.hp-b.current.hp/b.max.hp)[0]!;
   let skill=Object.keys(u.actions).find(k=>u.actions[k]!.target==='enemy'&&u.actions[k]!.cost.mp.flat===0)!;
   let target=b.units.filter(u=>u.side==='enemy'&&u.current.hp>0).sort((a,b)=>a.current.hp-b.current.hp)[0]!.id;
   if(defend){skill=u.id==='reader'?'格挡':'杖击';}
   else if(u.id==='keeper'&&ally.current.hp<ally.max.hp*.7&&u.current.mp>=10){skill='疗愈';target=ally.id;}
   else if(ally.current.hp<ally.max.hp*.25&&s.potions>0){skill='恢复药';target=ally.id;}
   else if(u.id==='reader'&&u.current.sp>=14){skill='贯穿斩';}
    else if(u.id==='keeper'&&u.current.mp>=10){skill='墨矢';}
   if(u.actions[skill]!.target==='self')target=u.id;
   chooseSkill(s,skill);chooseTarget(s,target);decisions++;
  }
  tick(s,200);
 }
 assert.notEqual(s.mode,'battle','battle must finish, not stall after mana depletion');return decisions;
}
for(const f of Object.values(FOES))test(`content: ${f.name} has executable abilities and an authored sustainable attack`,()=>{
 Object.values(f.skills).forEach(assertExecutable);assert.ok(Object.values(f.skills).some(a=>a.target==='enemy'&&a.cost.mp.flat===0&&a.cost.sp.flat===0));
});
test('six connected layouts: every interactive point and authored encounter reachable',()=>{
 const names=new Set();for(let depth=1;depth<=6;depth++){
  const s=startExpedition(playtestParty(),17);s.region=makeRegion(depth,depth-1,17);s.x=s.region.spawn.x;s.z=s.region.spawn.z;names.add(s.region.name);
  for(const t of s.region.things)assert.ok(pathTo(s,t.x,t.z));
 }assert.equal(names.size,6);
});
test('six-depth routing with a durable synthetic party: optional supplies, bosses and settlement proposal',()=>{
 // This is a routing/settlement regression, not a balance guarantee for the default party.
 // A 9% supplier deliberately removes the former guaranteed heal on every floor.
 const party=playtestParty();
 // Keep the original level/experience rules; only this isolated fixture has a larger resource budget.
 for(const p of party){for(const key of ['hp','mp','sp'] as const)p.card.numeric.max[key]*=3;p.current={...p.card.numeric.max};}
 const s=startExpedition(party,17),species=new Set<string>(),depths=[];let decisions=0;
 for(let depth=1;depth<=6;depth++){
  assert.equal(s.depth,depth);assert.equal(s.mode,'explore');
  use(s,'chest');event(s);
  for(const t of s.region.things.filter(t=>t.kind==='enemy')){
   t.foes.forEach(id=>species.add(id));go(s,t);assert.equal(s.mode,'battle');decisions+=fight(s);assert.equal(s.mode,'explore',`party survives ${t.name} depth ${depth}`);
   if(s.party.some(p=>p.current.hp<p.card.numeric.max.hp*.55)&&s.region.things.some(t=>t.kind==='camp'&&!t.used))use(s,'camp');
  }
  if(s.region.things.some(t=>t.kind==='camp'&&!t.used))use(s,'camp');
  depths.push({depth,name:s.region.name,hp:s.party.map(p=>p.current.hp),experience:s.run.participants.map(p=>p.experience)});
  use(s,'stairs');
 }
 withdraw(s);assert.equal(s.mode,'ended');assert.equal(s.run.status,'success');assert.equal(s.fights,18);assert.equal(species.size,18);assert.ok(view(s).materials>0);/* 0.26: fights drop monster materials; boxes only from chests/mimics */assert.ok(view(s).vouchers>0);assert.equal(view(s).settlement?.committed,false);assert.ok(s.run.participants.every(p=>p.experience>0));
 mkdirSync('../16-Godot可玩区域/verification',{recursive:true});writeFileSync('../16-Godot可玩区域/verification/campaign.json',JSON.stringify({passed:true,seed:17,depths,species:[...species],decisions,fights:s.fights,settlement:view(s).settlement},null,2)+'\n');
});
test('exploration: collect once, pause/resume preserves region, re-entry regenerates without duplicate reward IDs',()=>{
 const s=startExpedition(playtestParty(),seedWithChest(19));use(s,'chest');assert.equal(view(s).boxes,1);interact(s);assert.equal(view(s).boxes,1);if(s.paused)s.paused=false;
 const restored=restoreExpedition(JSON.parse(JSON.stringify(s)));assert.deepEqual(restored.region,s.region);assert.equal(restored.paused,true);move(restored,1,0);assert.equal(restored.x,s.x);
 use(s,'stairs');const id=s.region.id;use(s,'stairs');assert.notEqual(s.region.id,id);/* 2026-09-28：已移除返回浅层，只验证下潜生成新区域 */
});
test('battle menu and explicit pause freeze time; flee retains expenditure and leaves encounter alive',()=>{
 const s=startExpedition(playtestParty(),19);const t=s.region.things.find(t=>t.kind==='enemy')!;go(s,t);
 for(let i=0;i<500&&!view(s).battle.ready;i++)tick(s,100);
 const before=JSON.stringify(s.battle);tick(s,5000);assert.equal(JSON.stringify(s.battle),before);
 chooseSkill(s,'贯穿斩');chooseTarget(s,'enemy-0');assert.equal(s.battle!.units.find(u=>u.id==='reader')!.current.sp,s.party[0]!.card.numeric.max.sp-14);
 s.paused=true;const paused=JSON.stringify(s.battle);tick(s,5000);assert.equal(JSON.stringify(s.battle),paused);s.paused=false;
 for(let i=0;i<500&&!view(s).battle.ready;i++)tick(s,100);s.battle!.seed=7;flee(s);assert.equal(s.mode,'explore');assert.equal(s.party[0]!.current.sp,s.party[0]!.card.numeric.max.sp-14);assert.equal(t.used,false);
 withdraw(s);assert.equal(s.run.status,'success');assert.equal(s.party[0]!.current.sp,s.party[0]!.card.numeric.max.sp);
});
test('party defeat clears earlier box and XP, restores resources and ends the run',()=>{
 const party=playtestParty();party.forEach(p=>{p.current.hp=1;p.card.numeric.attributes.敏捷=1;});
 const s=startExpedition(party,seedWithChest(23));use(s,'chest');go(s,s.region.things.find(t=>t.kind==='enemy')!);
 for(let i=0;i<1000&&s.mode==='battle';i++)tick(s,500);
 assert.equal(s.mode,'ended');assert.equal(s.run.status,'failed');assert.equal(view(s).boxes,0);assert.ok(s.run.participants.every(p=>p.experience===0&&p.status==='downedExit'));assert.ok(s.party.every(p=>p.current.hp===p.card.numeric.max.hp));
});
test('boss blocks descent until actually defeated',()=>{
 const s=startExpedition(playtestParty(),27);s.depth=3;s.region=makeRegion(3,2,27);s.x=s.region.spawn.x;s.z=s.region.spawn.z;use(s,'stairs');assert.equal(s.depth,3);assert.match(s.notice,/守关敌群/);
 const boss=s.region.things.find(t=>t.foes.some(id=>id.endsWith('_B01')))!;go(s,boss);fight(s);use(s,'stairs');assert.equal(s.depth,4);
});
test('15 distinct connected maps, including three new themes',()=>{
 const layouts=new Set<string>();for(let depth=1;depth<=TOTAL_DEPTH;depth++){
  const s=startExpedition(playtestParty(),17);s.region=makeRegion(depth,depth-1,17);s.x=s.region.spawn.x;s.z=s.region.spawn.z;layouts.add(JSON.stringify(s.region.tiles));
  for(const t of s.region.things)assert.ok(pathTo(s,t.x,t.z));
 }assert.equal(layouts.size,15);assert.equal(Object.keys(FOES).length,434);
});
test('fifteen-floor host-scaled integration squad: 45 encounters, 45 foes, five bosses, relics and immutable cards',()=>{
 const party=[...playtestParty(),...playtestParty().map((p,i)=>({...p,id:'extra-'+i,name:'扩展测试员'+i}))];
 // Integration fixture, not a balance benchmark: a host-valid level-9 four-person squad.
 for(const [i,p] of party.entries()){const n=monsterNumbers({...MONSTER_BY_ID[i%2?'T12_N03':'T15_N01']!,role:'Boss'},9);p.card.numeric={level:9,attributes:n.attributes,max:n.max};p.current={...n.max};}
 const originalCards=structuredClone(party.map(p=>p.card));const s=startExpedition(party,17),species=new Set<string>(),phases:string[]=[],depths=[];let strays=0;acquireRelic(s,'R001',party[0]!.id);
 for(let depth=1;depth<=TOTAL_DEPTH;depth++){
  assert.equal(s.depth,depth);if(s.strayWarning)dismissWarning(s);use(s,'chest');event(s);
  for(const t of s.region.things.filter(t=>t.kind==='enemy')){if(t.hunter)strays++;t.foes.forEach(id=>species.add(id));go(s,t);fight(s);assert.equal(s.mode,'explore',`survives ${depth}/${t.name}`);phases.push(...t.foes.filter(id=>id.endsWith('_B01')));}
  use(s,'camp');depths.push({depth,theme:s.region.theme,name:s.region.name,hp:s.party.map(p=>p.current.hp)});use(s,'stairs');
 }
 assert.equal(s.depth,16);assert.equal(s.run.status,'active');const relicsBefore=s.relics!.length;withdraw(s);assert.equal(s.run.status,'success');assert.equal(s.fights,45+strays);assert.equal(species.size,45+Math.min(1,strays));assert.ok(view(s).boxes>0);assert.ok(view(s).vouchers>0);assert.equal(new Set(phases).size,5);assert.ok(relicsBefore>0);assert.equal(s.relics!.length,0);assert.deepEqual(s.party.map(p=>p.card),originalCards);
 writeFileSync('../16-Godot可玩区域/verification/campaign-expanded.json',JSON.stringify({passed:true,depths,species:[...species],phases,relics:s.relics,fights:s.fights,settlement:view(s).settlement},null,2));
});
test('显式持有的遗物保留费用取舍而不改原卡；事件付费仅一次',()=>{
 const s=startExpedition(playtestParty(),17);s.ownedRelics=[{id:'overload',owner:'team',stacks:1}];s.relics=['overload'];s.world=undefined;go(s,s.region.things.find(t=>t.kind==='enemy')!);
 const keeper=s.battle!.units.find(u=>u.id==='keeper')!;assert.equal(costFor(keeper,keeper.actions['墨矢']!).mp,13);assert.equal(s.party[1]!.card.skills.find(k=>k.sourceId==='墨矢')!.mapping.action!.cost.mp.flat,10);
 const fresh=startExpedition(playtestParty(),17);assert.deepEqual(fresh.relics,[]);installEventFixture(fresh);event(fresh);const saved=JSON.stringify(fresh.run.rewards);eventChoice(fresh,0);assert.equal(JSON.stringify(fresh.run.rewards),saved);
});
