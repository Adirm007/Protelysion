import test from 'node:test';
import assert from 'node:assert/strict';
import {RendererFrameCodec} from '../src/game/renderer-frame';
import {startExpedition,restoreExpedition,view} from '../src/game/expedition';
import {playtestParty} from '../src/game/content';
import {mountExpeditionRuntime} from '../src/game/runtime';

function environment(){
 const storage=new Map<string,string>(),timers:(()=>void)[]=[];
 const win={localStorage:{getItem:(key:string)=>storage.get(key)??null,setItem:(key:string,value:string)=>storage.set(key,value)},setInterval:(fn:()=>void)=>{timers.push(fn);return timers.length},clearInterval:()=>{},document:{hidden:false,addEventListener:()=>{},removeEventListener:()=>{}},addEventListener:()=>{},removeEventListener:()=>{}} as unknown as Window;
 return {win,storage,timers};
}
test('Random presentation sends immutable layout once, resets on attach, and never strips saved state',()=>{
 const codec=new RendererFrameCodec(),state=startExpedition(playtestParty(),8912),snapshot=view(state),before=JSON.stringify(snapshot);
 const first=JSON.parse(codec.encode(snapshot)),second=JSON.parse(codec.encode(snapshot));
 assert.deepEqual(first.region.layout,state.region.layout);assert.ok(first.region.tiles);
 assert.equal(second.region.layout,undefined);assert.equal(second.region.tiles,undefined);assert.deepEqual(second.region.things,snapshot.region.things);
 assert.equal(JSON.stringify(snapshot),before);assert.equal(codec.readyFor(state.region.id),false);
 codec.acknowledge('stale-region');assert.equal(codec.readyFor(state.region.id),false);codec.acknowledge(state.region.id);assert.equal(codec.readyFor(state.region.id),true);
 codec.reset();assert.ok(JSON.parse(codec.encode(snapshot)).region.layout);
 const next=view(startExpedition(playtestParty(),8913));assert.ok(JSON.parse(codec.encode(next)).region.layout);assert.equal(codec.readyFor(next.region.id),false);
});
test('No encounter time or movement before the current floor renderer acknowledges readiness',()=>{
 const e=environment(),state=startExpedition(playtestParty(),193),runtime=mountExpeditionRuntime({storageKey:'test',initial:state,audio:false},e.win);
 const x=state.x,z=state.z;
 e.timers[0]!();runtime.input({type:'move',payload:{dx:1,dz:0}});assert.equal(state.explorationMs,0);assert.equal(state.x,x);assert.equal(state.z,z);
 let first:any;runtime.attach(raw=>{first=JSON.parse(raw)});e.timers[0]!();assert.equal(state.explorationMs,0);
 runtime.rendered(first.mode,'stale');e.timers[0]!();assert.equal(state.explorationMs,0);
 runtime.rendered(first.mode,first.region.id);e.timers[0]!();assert.equal(state.explorationMs,50);
 runtime.dispose();const saved=JSON.parse(e.storage.get('test')!);assert.deepEqual(saved.region.layout,state.region.layout);assert.equal(saved.version,2);
});
test('Graphics preference can be set on title, is saved on new run, and never regenerates a floor',()=>{
 const e=environment(),runtime=mountExpeditionRuntime({storageKey:'test',audio:false,newGame:()=>startExpedition(playtestParty(),281)},e.win);
 runtime.input({type:'settings',payload:{graphicsQuality:'mobile'}});assert.equal(runtime.graphicsQuality(),'mobile');
 runtime.input({type:'new'});const before=runtime.inspect() as ReturnType<typeof view>;assert.equal(before.settings?.graphicsQuality,'mobile');
 runtime.attach(raw=>{const f=JSON.parse(raw);runtime.rendered(f.mode,f.region?.id)});
 runtime.input({type:'settings',payload:{graphicsQuality:'desktop'}});const after=runtime.inspect() as ReturnType<typeof view>;
 assert.deepEqual(after.region,before.region);assert.equal(after.settings?.graphicsQuality,'desktop');runtime.dispose();
});
test('Current random save resumes exactly while obsolete save versions are rejected without mutation',()=>{
 const current=startExpedition(playtestParty(),291),saved=JSON.parse(JSON.stringify(current));assert.deepEqual(restoreExpedition(saved).region,current.region);
 saved.version=1;const before=JSON.stringify(saved);assert.throws(()=>restoreExpedition(saved),/不迁移旧档/);assert.equal(JSON.stringify(saved),before);
});
