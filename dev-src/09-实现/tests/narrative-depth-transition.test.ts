import test from 'node:test';
import assert from 'node:assert/strict';
import {playtestParty} from '../src/game/content';
import {addReward} from '../src/core/run';
import {startExpedition,move,interact,narrativeDescend,exitNarrative,tick,type State} from '../src/game/expedition';
import {walkable} from '../src/game/region';

function encounter(mode:'battle'|'event'|'supplier'){
 const s=startExpedition(playtestParty().slice(0,1),91);
 if(mode==='battle'){
  const enemy=s.region.things.find(t=>t.kind==='enemy')!;
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]] as const)if(walkable(s.region,enemy.x-dx,enemy.z-dz)){
   s.x=enemy.x-dx;s.z=enemy.z-dz;move(s,dx,dz);break;
  }
 }else{
  const id='narrative-test-'+mode;
  s.region.things.push({id,kind:mode,x:s.x,z:s.z,name:'测试互动',used:false,foes:[]});
  // Keep the fixture interaction closest when the map has another usable object.
  for(const thing of s.region.things)if(thing.id!==id&&thing.kind!=='enemy')thing.used=true;
  interact(s);
 }
 assert.equal(s.mode,mode);
 s.narrative={active:true,startDepth:s.depth,depth:s.depth,since:1,transition:'user-message'};
 s.paused=true;
 return s;
}

for(const mode of ['battle','event','supplier'] as const)test('自动正文在'+mode+'现场连续下层后返回新层探索，保留本趟资源和记账',()=>{
 const s=encounter(mode),runId=s.run.id,party=s.party[0]!;
 const current={hp:13,mp:9,sp:5};party.current={...current};
 if(s.world)s.world.clock.timeMs=4321;
 for(const battle of [s.battle,s.world]){const unit=battle?.units.find(u=>u.id===party.id);if(unit)unit.current={...current};}
 s.inventory={drug:{owner:party.ref??{kind:'partner',name:party.id},name:'测试药剂',actorId:party.id,remaining:1,used:2}};
 s.run=addReward(s.run,{kind:'fp',amount:77,count:1,source:'已获得'});s.hostFpSpent=19;s.bag={test:2};
 const rewards=structuredClone(s.run.rewards),inventory=structuredClone(s.inventory);
 narrativeDescend(s);narrativeDescend(s);exitNarrative(s);
 assert.equal(s.depth,3);assert.equal(s.region.depth,3);assert.equal(s.mode,'explore');assert.equal(s.run.battleActive,false);
 assert.equal(s.battle,null);assert.equal(s.eventState,undefined);assert.equal(s.supplierState,undefined);assert.equal(s.eventPick,undefined);
 assert.deepEqual(party.current,current);assert.deepEqual(s.inventory,inventory);assert.deepEqual(s.run.rewards,rewards);
 assert.equal(s.run.id,runId);assert.equal(s.hostFpSpent,19);assert.deepEqual(s.bag,{test:2});
 if(mode!=='battle')assert.equal(s.world!.clock.timeMs,4321,'已有探索状态沿用原时钟');
 assert.deepEqual(s.narrativeSpans,[{from:1,to:3}]);assert.equal(s.depthLog!.down,2);
 s.paused=false;assert.doesNotThrow(()=>tick(s));assert.equal(s.mode,'explore');
});

test('同层正文返回仍保留原暂停战局，不重置时钟与已支付动作',()=>{
 const s=encounter('battle'),before=structuredClone(s.battle);exitNarrative(s);
 assert.equal(s.mode,'battle');assert.equal(s.run.battleActive,true);assert.deepEqual(s.battle,before);assert.equal(s.depth,1);
});
