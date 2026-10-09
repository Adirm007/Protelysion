// 0.37.5: the descent door is a camera-facing sprite (~2.1 m) that leans ~1.6 cells back at the 50° interior camera.
// Indoors it must never sit right in front of a wall: two open rows behind it, one in front, one to each side.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateFloor,MAP_THEMES} from '../src/game/maps/generator';
import {DOOR_BOX} from '../src/game/maps/draft';
import type {FloorLayout} from '../src/game/maps/types';

function blocked(L:FloorLayout){
 const W=L.width,d=L.down,h0=L.heights[d.z*W+d.x]!;
 return DOOR_BOX.filter(([dx,dz])=>{const x=d.x+dx,z=d.z+dz;if(x<0||z<0||x>=W||z>=L.height)return true;
  return L.tiles[z]![x]!=='.'||Math.abs(L.heights[z*W+x]!-h0)>0.05||L.surface[z]![x]==='S';});
}

test('Indoor descent doors keep an open box (walls never cut the door) on every interior theme',()=>{
 assert.equal(DOOR_BOX.length,11);
 let interiors=0;
 for(const t of MAP_THEMES as {id:string}[])for(const seed of [3,1207,58321]){
  const L=generateFloor({seed,depth:seed%17+1,visit:1,theme:t.id,anomalyMode:'normal'});
  if(!L.interior)continue;interiors++;
  assert.deepEqual(blocked(L),[],`${t.id} ${L.archetype} seed ${seed} door at ${L.down.x},${L.down.z}`);
 }
 assert.ok(interiors>=40,'enough interior floors sampled: '+interiors);
});

test('Indoor anomalies (backrooms / poolrooms) also keep the door box open',()=>{
 for(const kind of ['backrooms','poolrooms'] as const)for(const seed of [11,4242,90001]){
  const L=generateFloor({seed,depth:5,visit:1,theme:'T15',anomalyMode:'forced',anomalyKind:kind});
  assert.ok(L.interior);assert.deepEqual(blocked(L),[],`${kind} seed ${seed}`);
 }
});
