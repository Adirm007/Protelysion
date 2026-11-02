import assert from 'node:assert/strict';
import {move,spawnStray,type State} from '../src/game/expedition';

/** A single corridor: escaping means continuing forward, with no side route. */
export function installStrayCorridor(s:State,length=48){
 const width=length+2,tiles=['#'.repeat(width),'#'+'.'.repeat(length)+'#','#'.repeat(width)];
 s.region={...s.region,id:s.region.id+'-corridor',width,height:3,tiles,spawn:{x:1,z:1},things:[
  {id:'entry',kind:'exit',x:1,z:1,name:'返回书海入口',used:false,foes:[]},
  {id:'down',kind:'stairs',x:length,z:1,name:'继续下潜',used:false,foes:[]},
 ]};
 s.x=1;s.z=1;
 return s;
}

/** Exercise actual successful movement rather than manufacturing a saved trail. */
export function spawnTrailingStray(s:State){
 installStrayCorridor(s);spawnStray(s);
 for(let i=0;i<40&&!s.region.things.some(t=>t.hunter);i++)move(s,1,0);
 const hunter=s.region.things.find(t=>t.hunter);assert.ok(hunter,'追兵应从已走过的后方登场');
 return hunter;
}
