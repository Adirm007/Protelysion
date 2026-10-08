import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mountExpeditionRuntime} from '../src/game/runtime';
import {startExpedition,view} from '../src/game/expedition';
import {playtestParty} from '../src/game/content';

function environment(width=1440,coarse=false){
 const storage=new Map<string,string>();
 const win={innerWidth:width,matchMedia:()=>({matches:coarse}),localStorage:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)},setInterval:()=>1,clearInterval:()=>{},document:{hidden:false,addEventListener:()=>{},removeEventListener:()=>{}},addEventListener:()=>{},removeEventListener:()=>{}} as unknown as Window;
 return {win,storage};
}
const key='booksea-graphics-quality';

test('All device widths and touch modes default to the same standard quality',()=>{
 for(const [width,coarse] of [[1440,false],[390,true],[760,true],[600,false]] as const){
  const e=environment(width,coarse),state=startExpedition(playtestParty(),9022);
  const runtime=mountExpeditionRuntime({storageKey:'quality-test',initial:state,audio:false},e.win);
  assert.equal(runtime.graphicsQuality(),'desktop');assert.equal(state.settings?.graphicsQuality,'desktop');
  assert.equal(e.storage.has(key),false,'default is not a fabricated manual preference');runtime.dispose();
 }
});
test('Legacy auto and malformed preferences never opt a phone into low quality',()=>{
 for(const preference of ['auto','invalid','', 'null']){
  const e=environment(390,true);e.storage.set(key,preference);
  const runtime=mountExpeditionRuntime({storageKey:'quality-test',audio:false,newGame:()=>startExpedition(playtestParty(),9033)},e.win);
  assert.equal(runtime.graphicsQuality(),'desktop');runtime.input({type:'new'});
  assert.equal((runtime.inspect() as ReturnType<typeof view>).settings?.graphicsQuality,'desktop');runtime.dispose();
 }
});
test('Low quality is explicit, persists across reload, and standard can be restored',()=>{
 const e=environment(390,true),make=()=>mountExpeditionRuntime({storageKey:'quality-test',audio:false,newGame:()=>startExpedition(playtestParty(),9044)},e.win);
 let runtime=make();runtime.input({type:'settings',payload:{graphicsQuality:'mobile'}});runtime.input({type:'new'});
 const before=runtime.inspect() as ReturnType<typeof view>;runtime.dispose();
 runtime=make();assert.equal(runtime.graphicsQuality(),'mobile');runtime.input({type:'continue'});
 assert.equal((runtime.inspect() as ReturnType<typeof view>).settings?.graphicsQuality,'mobile');
 runtime.input({type:'settings',payload:{graphicsQuality:'desktop'}});
 const after=runtime.inspect() as ReturnType<typeof view>;assert.equal(after.settings?.graphicsQuality,'desktop');assert.deepEqual(after.region,before.region);
 assert.equal(e.storage.get(key),'desktop');runtime.dispose();runtime=make();assert.equal(runtime.graphicsQuality(),'desktop');runtime.dispose();
});
test('Explicit legacy auto resolves to standard without changing map or game resources',()=>{
 const e=environment(390,true),state=startExpedition(playtestParty(),9055),runtime=mountExpeditionRuntime({storageKey:'quality-test',initial:state,audio:false},e.win);
 const before={region:structuredClone(state.region),party:structuredClone(state.party),seed:state.seed,steps:state.steps};
 runtime.input({type:'settings',payload:{graphicsQuality:'mobile'}});runtime.input({type:'settings',payload:{graphicsQuality:'auto'}});
 assert.equal(runtime.graphicsQuality(),'desktop');assert.equal(e.storage.get(key),'desktop');
 assert.deepEqual({region:state.region,party:state.party,seed:state.seed,steps:state.steps},before);runtime.dispose();
});
test('Actual Godot selector and both entry menus have no device-driven downgrade',()=>{
 const godot=readFileSync('../16-Godot可玩区域/godot/game.gd','utf8');
 const selector=godot.slice(godot.indexOf('func _graphics_quality()'),godot.indexOf('func _world_pos('));
 assert.match(selector,/return "mobile" if requested=="mobile" else "desktop"/);
 assert.doesNotMatch(selector,/matchMedia|innerWidth|pointer:coarse|OS\.has_feature/);
 const menu=readFileSync('src/ui/expedition-ui.ts','utf8');
 assert.match(menu,/\['desktop', '标准画质'\]/);assert.match(menu,/\['mobile', '轻量画质'\]/);
 assert.doesNotMatch(menu,/\['auto',/);
 for(const p of ['src/host-game-entry.ts','src/distribution/entry.ts'])assert.match(readFileSync(p,'utf8'),/uiRoot:el\('stage'\)/);
});
