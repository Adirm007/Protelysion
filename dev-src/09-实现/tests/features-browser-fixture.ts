// Isolated synthetic party and encounters. No host profile, chat, model or settlement writes.
import {startExpedition,move} from '../src/game/expedition';
import {playtestParty} from '../src/game/content';
import {chestSpawns} from '../src/game/region';
import {MONSTER_ROSTER} from '../src/game/monsters/catalog';
import {MIMIC_ID} from '../src/game/monsters/mimic';
import {mountExpeditionRuntime} from '../src/game/runtime';
import {installPlayerTheme} from '../src/ui/theme';
export async function boot(){
 const g=window as any;let seed=1;while(!chestSpawns(1,0,seed).mimic)seed++;
 const state=startExpedition(playtestParty().slice(0,1),seed);state.paused=true;
 // Art-only fixture deliberately displays both types. Production's one POI lottery is exclusive.
 const spare=state.region.layout.pois.filter(p=>p.kind==='encounter')[1]!;
 state.region.things.push({id:'art-fixture-extra-chest',kind:'chest',x:spare.x,z:spare.z,name:'封存的宝匣',used:false,foes:[]});
 // Deliberate art gallery: camp/event are now revealed rewards, never guaranteed production spawns.
 for(const [index,kind] of (['camp','event'] as const).entries()){const p=state.region.layout.pois.filter(p=>p.kind==='encounter')[index+2]!;state.region.things.push({id:'art-fixture-'+kind,kind,x:p.x,z:p.z,name:kind==='camp'?'长椅':'事件',used:false,foes:[]});}
 const root=document.getElementById('app')!;installPlayerTheme(root);root.classList.add('bs-playing');root.innerHTML='<div class="bs-portal"><section id="stage"><canvas id="canvas" tabindex="0"></canvas></section></div>';
 const runtime=mountExpeditionRuntime({storageKey:'feature-024-isolated-fixture',uiRoot:document.getElementById('stage')!,initial:state,audio:false});
 function publish(){runtime.input({type:'settings',payload:{}});}
 function show(ids:string[]){
  state.mode='explore';state.paused=false;state.battle=null;state.world=undefined;state.run.battleActive=false;state.selected=null;
  for(const p of state.party){p.current={...p.card.numeric.max};p.persistent=undefined;}
  const target=state.region.things.find(t=>t.kind==='enemy')!;target.foes=[...ids];target.used=false;state.x=target.x-1;state.z=target.z;move(state,1,0);state.paused=true;publish();
 }
 g.FeatureTest={state,runtime,roster:[...MONSTER_ROSTER.map(m=>({id:m.id,name:m.name})),{id:MIMIC_ID,name:'宝箱怪'}],show,
  summon(){show(['T03_N01']);const b=state.battle!,parent=b.units.find(u=>u.id==='enemy-0')!,child=structuredClone(parent);child.id='hostile-projection';child.name='骨面猎手·衍生体';child.owner=parent.id;b.units.push(child);b.clock.units.push({...structuredClone(b.clock.units.find(u=>u.id===parent.id)!),id:child.id});publish();},
  event(){state.mode='event';state.battle=null;state.run.battleActive=false;state.paused=false;state.world=undefined;state.eventState={id:'E001',thingId:state.region.things.find(t=>t.kind==='event')!.id,offers:['R001','R002','R003'],results:[],owner:state.party[0]!.id,choice:''};publish();},
  choices(){state.mode='event';state.paused=false;state.eventState!.offers=[];publish();},
  explore(){state.mode='explore';state.battle=null;state.run.battleActive=false;state.eventState=undefined;state.paused=false;publish();},
 };
 const engine=new g.Engine({executable:new URL('/game',location.href).href,mainPack:new URL('/game.pck',location.href).href,canvas:document.querySelector('canvas'),canvasResizePolicy:0,focusCanvas:true});await engine.startGame();g.FeatureTest.started=true;
}
