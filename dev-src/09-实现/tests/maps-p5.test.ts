// P5 map module (p5-hd2d-2 / hd2d-architecture-3): replaces maps-p4 and buildings-p4.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {generateFloor,chooseFloorMode,GENERATOR_VERSION,DEFAULT_ANOMALY_CHANCE,MAP_THEMES} from '../src/game/maps/generator';
import {validateFloor} from '../src/game/maps/validate';
import {BUILDING_VERSION,BUILDING_RENDER_BUDGET} from '../src/game/maps/buildings';
import {THEME_KITS} from '../src/game/maps/kits';
import {THEME_DESIGN,isInterior} from '../src/game/maps/themes';
import {buildFloorMesh,KERNEL_VERSION} from '../src/game/maps/render/kernel';
import {packFloor,PACK_VERSION} from '../src/game/maps/render/pack';
import {makeRegion,walkable,type Region} from '../src/game/region';
import {startExpedition,restoreExpedition} from '../src/game/expedition';
import {playtestParty,THEME_ORDER} from '../src/game/content';

const SEEDS=[11,4242,90001,777777];
const sha=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');

test('P5 versions and all 48 playable themes are covered',()=>{
 assert.equal(GENERATOR_VERSION,'p5-hd2d-2');assert.equal(BUILDING_VERSION,'hd2d-architecture-3');
 assert.equal(KERNEL_VERSION,'p5-kernel-1');assert.equal(PACK_VERSION,'p5-pack-1');
 assert.equal(MAP_THEMES.length,48);
 for(const theme of THEME_ORDER){assert.ok(THEME_DESIGN[theme],theme);assert.ok(THEME_KITS[theme],theme);}
});

test('48 themes x 3 scenes x 2 seeds: every floor passes all acceptance rules and is deterministic',()=>{
 const issues:string[]=[];
 for(const seed of SEEDS.slice(0,2))for(const p of MAP_THEMES)for(let depth=1;depth<=3;depth++){
  const g=generateFloor({seed,depth,visit:depth,theme:p.id,anomalyMode:'normal'});
  assert.equal(g.version,'p5-hd2d-2');assert.equal(g.anomaly.active,false);
  for(const i of validateFloor(g))issues.push(`${p.id}/${depth}/${seed} ${g.scheme}: ${i.rule} ${i.detail}`);
  if(depth===1&&seed===SEEDS[0]){const again=generateFloor({seed,depth,visit:depth,theme:p.id,anomalyMode:'normal'});assert.equal(again.id,g.id);assert.deepEqual(again.tiles,g.tiles);}
 }
 assert.deepEqual(issues.slice(0,10),[]);
});

test('Anomaly floors: default 2% independent roll, four kinds, all connected with at least eight intrusions',()=>{
 assert.equal(DEFAULT_ANOMALY_CHANCE,.02);
 let active=0;const n=4000;
 for(let i=0;i<n;i++)if(chooseFloorMode({seed:1000+i,depth:1+i%40,visit:i%3,theme:THEME_ORDER[i%48]!}).active)active++;
 assert.ok(active/n>.01&&active/n<.03,String(active/n));
 for(const kind of ['backrooms','poolrooms','collage','misregistered'] as const)for(const theme of ['T04','T15','T34']){
  const g=generateFloor({seed:4242,depth:5,visit:1,theme,anomalyMode:'forced',anomalyKind:kind});
  assert.equal(g.anomaly.active,true);assert.ok(g.anomaly.intrusions.length>=8,kind);
  assert.deepEqual(validateFloor(g).map(i=>i.rule),[],`${kind}/${theme}`);
 }
});

function reachable(r:Region,tx:number,tz:number){
 const seen=new Set([`${r.spawn.x},${r.spawn.z}`]),q=[[r.spawn.x,r.spawn.z]];
 for(const [x,z] of q){
  if(x===tx&&z===tz)return true;
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const nx=x!+dx!,nz=z!+dz!,k=`${nx},${nz}`;
   if(seen.has(k)||!walkable(r,nx,nz))continue;
   if(r.things.some(t=>t.kind==='enemy'&&!t.used&&t.x===nx&&t.z===nz)&&!(nx===tx&&nz===tz))continue;
   seen.add(k);q.push([nx,nz]);
  }
 }
 return false;
}

test('Runtime regions: every point reachable on foot, and undefeated encounters never seal the only route',()=>{
 for(let seed=1;seed<=24;seed++)for(let depth=1;depth<=15;depth++){
  const r=makeRegion(depth,depth-1,seed);
  assert.equal(r.layout.version,'p5-hd2d-2');assert.ok(walkable(r,r.spawn.x,r.spawn.z));
  for(const t of r.things){assert.ok(walkable(r,t.x,t.z),`${seed}/${depth} ${t.kind}`);assert.ok(reachable(r,t.x,t.z),`${seed}/${depth} ${t.kind} blocked`);}
 }
});

test('Outdoor floors build each theme in its own architectural language, with signature landmarks',()=>{
 let outdoorThemes=0,withSignature=0;
 for(const p of MAP_THEMES){
  const scenes=[0,1,2].filter(s=>!isInterior(THEME_DESIGN[p.id]!.scenes[s]!));
  if(!scenes.length)continue;outdoorThemes++;
  const kinds=new Set<string>();let signature=false;
  for(const seed of SEEDS)for(const s of scenes){
   const g=generateFloor({seed,depth:s+1,visit:1,theme:p.id,anomalyMode:'normal'});
   for(const b of g.buildings){
    kinds.add(b.kind);if(THEME_KITS[p.id]!.sig.includes(b.kind))signature=true;
    assert.ok(b.floors<=BUILDING_RENDER_BUDGET.maxFloors&&Math.max(b.w,b.d)<=BUILDING_RENDER_BUDGET.maxFootprint,`${p.id} ${b.kind}`);
   }
  }
  assert.ok(kinds.size>=4,`${p.id} only ${[...kinds]}`);
  if(signature)withSignature++;
 }
 assert.ok(outdoorThemes>=30,String(outdoorThemes));
 assert.ok(withSignature>=outdoorThemes-2,`${withSignature}/${outdoorThemes}`);
});

test('Render kernel: budgets, material layers and byte-identical deterministic floor packs',()=>{
 const cases=[
  {g:generateFloor({seed:11,depth:1,visit:1,theme:'T04',anomalyMode:'normal'}),collage:false},
  {g:generateFloor({seed:90001,depth:2,visit:2,theme:'T15',anomalyMode:'normal'}),collage:false},
  {g:generateFloor({seed:4242,depth:5,visit:1,theme:'T34',anomalyMode:'forced',anomalyKind:'collage'}),collage:true},
  {g:generateFloor({seed:4242,depth:5,visit:1,theme:'T10',anomalyMode:'forced',anomalyKind:'backrooms'}),collage:false},
 ];
 for(const [i,{g,collage}] of cases.entries()){
  const out=buildFloorMesh(g,'desktop');
  assert.equal(out.version,KERNEL_VERSION);
  assert.ok(out.stats.triangles>5000&&out.stats.triangles<=450_000,`${g.theme} ${out.stats.triangles}`);
  assert.ok(out.stats.layers<=(collage?127:64),`${g.theme} layers ${out.stats.layers}`);
  assert.ok(out.chunks.length>0&&out.textures.layers.length===out.stats.layers);
  const pack=packFloor(out),dv=new DataView(pack.glb.buffer,pack.glb.byteOffset,pack.glb.byteLength);
  assert.equal(dv.getUint32(0,true),0x46546c67);assert.equal(dv.getUint32(4,true),2);assert.equal(dv.getUint32(8,true),pack.glb.byteLength);
  const jsonLength=dv.getUint32(12,true),gltf=JSON.parse(new TextDecoder().decode(pack.glb.subarray(20,20+jsonLength)));
  const meta=JSON.parse(pack.meta);
  assert.equal(meta.version,PACK_VERSION);assert.equal(meta.kernel,KERNEL_VERSION);assert.equal(meta.quality,'desktop');
  assert.equal(gltf.meshes.length,meta.chunks.length);
  assert.equal(pack.tex.byteLength,meta.textures.size*meta.textures.size*4*meta.textures.count);
  if(i===0){
   assert.equal(sha(packFloor(buildFloorMesh(g,'desktop')).glb),sha(pack.glb),'deterministic GLB');
   const mobile=buildFloorMesh(g,'mobile');
   assert.ok(mobile.stats.triangles<=180_000&&mobile.stats.triangles<out.stats.triangles,String(mobile.stats.triangles));
  }
 }
});

test('P4 saves are rejected instead of migrated; P5 saves restore',()=>{
 const s=startExpedition(playtestParty(),31337);
 const restored=restoreExpedition(JSON.parse(JSON.stringify(s)));assert.equal(restored.region.layout.id,s.region.layout.id);
 const old=JSON.parse(JSON.stringify(s));old.region.layout.version='p4-roads-2';
 assert.throws(()=>restoreExpedition(old),/新开随机地图远征/);
});
