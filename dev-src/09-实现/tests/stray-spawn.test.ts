import test from 'node:test';
import assert from 'node:assert/strict';
import {playtestParty,THEME_ORDER} from '../src/game/content';
import {generateFloor} from '../src/game/maps/generator';
import {walkable} from '../src/game/region';
import {STRAY_STEP_MS} from '../src/game/monsters/stray';
import {startExpedition,spawnStray,move,dismissWarning,tickExploration,strayStep,restoreExpedition,toggleCrossWard,interact,type State} from '../src/game/expedition';
import {installStrayCorridor,spawnTrailingStray} from './stray-fixture';

const corridor=(length=48)=>installStrayCorridor(startExpedition(playtestParty(),19),length);
const hunter=(s:State)=>s.region.things.find(t=>t.hunter&&!t.used);

test('入层先等待；从实际走过的后方 5 格登场，前往楼梯的通道保持畅通',()=>{
 const s=corridor();spawnStray(s);
 assert.equal(hunter(s),undefined,'刚入层没有后方足迹，不能随机刷到前面');
 for(let i=0;i<5;i++)move(s,1,0);
 assert.equal(hunter(s),undefined,'入口本身占用，等待下一处合格位置');
 move(s,1,0);const t=hunter(s)!;assert.ok(t);
 assert.equal(s.x-t.x,5);assert.equal(t.z,s.z);assert.equal(s.strayWarning,true);
 const stairs=s.region.things.find(t=>t.kind==='stairs')!;assert.ok(t.x<s.x&&s.x<stairs.x);
 dismissWarning(s);
 for(let i=0;i<20;i++){move(s,1,0);tickExploration(s,STRAY_STEP_MS);assert.equal(s.mode,'explore');assert.equal(s.x-t.x,5,'持续前进可维持距离');}
});

test('原地绕步不会伪造 5 格距离；短地图没有合格位置时一直延后',()=>{
 const s=corridor(5);spawnStray(s);
 for(let i=0;i<15;i++){move(s,1,0);move(s,-1,0);}
 assert.equal(s.steps,30);assert.equal(hunter(s),undefined);
 for(let i=0;i<4;i++)move(s,1,0);
 tickExploration(s,5000);assert.equal(hunter(s),undefined);assert.equal(s.mode,'explore');
});

test('探索远离楼梯的死路时不登场；返回后只从背离楼梯的一侧登场',()=>{
 const s=corridor(20);s.x=3;
 const stairs=s.region.things.find(t=>t.kind==='stairs')!;stairs.x=1;
 const entry=s.region.things.find(t=>t.kind==='exit')!;entry.x=3;
 spawnStray(s);for(let i=0;i<8;i++)move(s,1,0);
 assert.equal(s.x,11);assert.equal(hunter(s),undefined,'走过的位置在逃生必经路上，不可拿来刷新');
 for(let i=0;i<6&&!hunter(s);i++)move(s,-1,0);
 const t=hunter(s)!;assert.ok(t);assert.equal(t.x-s.x,5);assert.ok(stairs.x<s.x&&s.x<t.x);
});

test('沿足迹选出生点，登场后仍走最短路，可以抄环路近道',()=>{
 const s=corridor();s.region={...s.region,id:'stray-ring',width:10,height:5,
  tiles:['##########','#........#','#.######.#','#........#','##########'],spawn:{x:2,z:1},things:[
   {id:'entry',kind:'exit',x:2,z:1,name:'入口',used:false,foes:[]},
   {id:'down',kind:'stairs',x:8,z:3,name:'楼梯',used:false,foes:[]},
  ]};s.x=2;s.z=1;spawnStray(s);
 for(let i=0;i<6;i++)move(s,1,0);
 const t=hunter(s)!;assert.ok(t);assert.deepEqual({x:t.x,z:t.z},{x:3,z:1});dismissWarning(s);
 move(s,0,1);move(s,0,1);for(let i=0;i<6;i++)move(s,-1,0);
 assert.deepEqual({x:s.x,z:s.z},{x:2,z:3});strayStep(s);
 assert.deepEqual({x:t.x,z:t.z},{x:2,z:1},'向左走最短路；不沿玩家曾经向右走的脚印绕远');
});

test('真实挡路、占用、无效移动均不产生足迹，也不挤占交互点刷新',()=>{
 const s=corridor();s.region.things.push({id:'obstacle',kind:'chest',x:2,z:1,name:'宝箱',used:false,foes:[]});
 spawnStray(s);move(s,0,1);move(s,0,-1);assert.equal(s.steps,0);
 for(let i=0;i<6;i++)move(s,1,0);
 assert.equal(hunter(s),undefined,'5 格后方的宝箱位置仍被占用');
 move(s,1,0);assert.equal(s.x-hunter(s)!.x,5);assert.equal(hunter(s)!.x,3);
});

test('弹框、暂停、入口确认和非探索期间不追击；站着不动仍被追上',()=>{
 const s=corridor(),t=spawnTrailingStray(s),position={x:t.x,z:t.z};
 tickExploration(s,10000);move(s,1,0);assert.deepEqual({x:t.x,z:t.z},position);assert.equal(s.x,7);
 dismissWarning(s);s.paused=true;tickExploration(s,10000);s.paused=false;
 s.exitAsk=true;tickExploration(s,10000);s.exitAsk=false;
 s.mode='event';tickExploration(s,10000);s.mode='explore';
 assert.deepEqual({x:t.x,z:t.z},position);
 tickExploration(s,STRAY_STEP_MS*4);assert.equal(s.mode,'explore');
 tickExploration(s,STRAY_STEP_MS);assert.equal(s.mode,'battle');
});

test('等待登场的足迹随存档保存；恢复后不重抽、不重置、不重复刷出',()=>{
 const s=corridor();spawnStray(s);for(let i=0;i<4;i++)move(s,1,0);
 const seed=s.seed,resumed=restoreExpedition(JSON.parse(JSON.stringify(s)));resumed.paused=false;
 move(resumed,1,0);move(resumed,1,0);const t=hunter(resumed)!;assert.ok(t);assert.equal(resumed.x-t.x,5);
 assert.equal(resumed.seed,seed,'等待和落点选择不再次抽签');
 spawnStray(resumed);assert.equal(resumed.region.things.filter(t=>t.hunter).length,1);
 const active=restoreExpedition(JSON.parse(JSON.stringify(resumed)));active.paused=false;dismissWarning(active);
 move(active,1,0);assert.equal(active.region.things.filter(t=>t.hunter).length,1);
});

test('银十字取消待登场；放下后不会把已经取消的追兵重新刷出来',()=>{
 const s=corridor();s.crossHeld=true;spawnStray(s);for(let i=0;i<3;i++)move(s,1,0);
 toggleCrossWard(s);toggleCrossWard(s);for(let i=0;i<12;i++)move(s,1,0);
 assert.equal(hunter(s),undefined);
});

test('无字书签按 10 格（普通距离两倍）和四分之一速度生效',()=>{
 const s=corridor(64);s.ownedRelics=[{id:'R008',owner:s.party[0]!.id,stacks:1}];spawnStray(s);
 for(let i=0;i<10;i++)move(s,1,0);assert.equal(hunter(s),undefined);
 move(s,1,0);const t=hunter(s)!;assert.ok(t);assert.equal(s.x-t.x,10);dismissWarning(s);
 const x=t.x;tickExploration(s,STRAY_STEP_MS*4-1);assert.equal(t.x,x);
 tickExploration(s,1);assert.equal(t.x,x+1);
});

test('进入第 9 层只抽一次登场资格，并清除上层足迹',()=>{
 const s=corridor();s.depth=8;s.strayGuaranteedOnce=true;
 for(let i=0;i<46;i++)move(s,1,0);interact(s);
 assert.equal(s.depth,9);assert.equal(s.strayGuaranteedOnce,false);assert.equal(hunter(s),undefined);
 assert.equal(s.strayTrail?.pending,true);assert.deepEqual(s.strayTrail?.cells,[{x:s.x,z:s.z}]);
 s.region.things=s.region.things.filter(t=>t.kind!=='enemy'); // 单独观察待登场状态，排除普通巡逻敌群的随机步伐。
 const seed=s.seed;tickExploration(s,1000);tickExploration(s,1000);assert.equal(s.seed,seed);
});

test('48 个正式主题：沿实际楼梯路线前进时从后方登场，同速追击可跑到下一层入口',()=>{
 for(const theme of THEME_ORDER){
  const s=startExpedition(playtestParty(),19),layout=generateFloor({seed:20261102,depth:9,visit:1,theme});
  s.region={...s.region,id:'stray-'+theme,theme,width:layout.width,height:layout.height,tiles:layout.tiles,spawn:layout.spawn,layout,things:[
   {id:'entry',kind:'exit',...layout.spawn,name:'入口',used:false,foes:[]},
   {id:'down',kind:'stairs',...layout.down,name:'楼梯',used:false,foes:[]},
  ]};s.x=layout.spawn.x;s.z=layout.spawn.z;
  const queue=[{x:s.x,z:s.z,path:[] as {dx:number;dz:number}[]}],seen=new Set([s.x+','+s.z]);
  let route:{dx:number;dz:number}[]|undefined;
  for(const p of queue){
   if(p.x===layout.down.x&&p.z===layout.down.z){route=p.path;break;}
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]] as const){
    const x=p.x+dx,z=p.z+dz,key=x+','+z;if(seen.has(key)||!walkable(s.region,x,z))continue;
    seen.add(key);queue.push({x,z,path:[...p.path,{dx,dz}]});
   }
  }
  assert.ok(route,theme+' 楼梯可达');const visited=new Set([s.x+','+s.z]);let appeared=false;spawnStray(s);
  for(const step of route){
   const chasing=!!hunter(s);move(s,step.dx,step.dz);const t=hunter(s);
   if(t&&!appeared){assert.ok(visited.has(t.x+','+t.z),theme+' 出生点确实走过');appeared=true;dismissWarning(s);}
   else if(chasing)tickExploration(s,STRAY_STEP_MS);
   visited.add(s.x+','+s.z);assert.equal(s.mode,'explore',theme+' 持续前进未被迎面堵住');
  }
  if(route.length>=6)assert.ok(appeared,theme+' 有足够后方空间时应登场');
  else assert.equal(appeared,false,theme+' 极短路线不足 5 格后方空间时应延后');
  assert.equal(s.x,layout.down.x);assert.equal(s.z,layout.down.z);
 }
});
