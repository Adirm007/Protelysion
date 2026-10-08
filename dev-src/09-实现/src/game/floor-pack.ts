import {buildFloorMesh,type Quality} from './maps/render/kernel';
import {packFloor,type FloorPack} from './maps/render/pack';
import type {FloorLayout} from './maps/types';

export type TimedFloorPack=FloorPack&{ms:number;quality:Quality};

/** Presentation-only P5 floor packs (GLB + texture layers + meta) for the Godot renderer.
 * Derived deterministically from the saved layout on demand; never saved, never part of game state.
 * A tiny cache avoids rebuilding when the renderer re-requests the same floor (reattach / quality flip). */
export function createFloorPackCache(limit=2){
 const cache=new Map<string,TimedFloorPack>();
 return (layout:FloorLayout,quality:Quality):TimedFloorPack=>{
  const key=layout.id+'|'+layout.fingerprint+'|'+quality;
  let hit=cache.get(key);
  if(hit){cache.delete(key);cache.set(key,hit);return hit;}
  const now=()=>typeof performance!=='undefined'?performance.now():Date.now(),began=now();
  hit={...packFloor(buildFloorMesh(layout,quality)),ms:0,quality};hit.ms=Math.round(now()-began);
  cache.set(key,hit);
  while(cache.size>limit)cache.delete(cache.keys().next().value!);
  return hit;
 };
}
