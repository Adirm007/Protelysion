// Isolated synthetic state + production runtime, real packed Godot and real Web Audio.
// No host helper, chat, model, microphone, account, real party, or settlement access.
import {startExpedition} from '../src/game/expedition';
import {playtestParty, contentCard, strike, heal, bareMitigation} from '../src/game/content';
import {createBattle, chooseAction} from '../src/battle/executor';
import {supplierSpawns} from '../src/game/supplier';
import {walkable} from '../src/game/region';
import {mountExpeditionRuntime} from '../src/game/runtime';
import {installPlayerTheme} from '../src/ui/theme';
import type {ActionSpec} from '../src/compiler/contract';

export async function boot() {
  const g=window as any; let seed=1;while(!supplierSpawns(1,0,seed))seed++;
  const state=startExpedition(playtestParty().slice(0,1),seed);
  let musicLevel=.35;
  function npc() {
    for(const key of Object.keys(state))delete (state as any)[key];
    Object.assign(state,startExpedition(playtestParty().slice(0,1),seed));
    for(const t of state.region.things)if(t.kind==='enemy')t.used=true;
    const girl=state.region.things.find(t=>t.kind==='supplier')!;
    const p=[[-1,0],[1,0],[0,1],[0,-1]].map(([dx,dz])=>({x:girl.x+dx!,z:girl.z+dz!})).find(p=>walkable(state.region,p.x,p.z))!;
    state.x=p.x;state.z=p.z;state.settings={...state.settings!,music:musicLevel,effects:1};state.world=undefined;
  }
  npc();
  const root=document.getElementById('app')!;installPlayerTheme(root);root.classList.add('bs-playing');
  root.innerHTML='<div class="bs-portal"><section id="stage"><canvas id="canvas" tabindex="0"></canvas></section></div>';
  const runtime=mountExpeditionRuntime({storageKey:'audio-0243-synthetic-fixture',uiRoot:document.getElementById('stage')!,initial:state,audio:{baseUrl:new URL('/audio/',location.href).href}});
  const styleAction=(name:string,element='',miss=false,critical=false):ActionSpec=>{
    const a=strike(45,element?'energy':'physical');a.name=name;a.description='隔离音频夹具：验证类型和时序，不改生产平衡。';a.category=element?'spell':'skill';a.castMs=0;
    const d=a.effects[0]!;if(d.op==='damage'){d.element=element||'none';d.hitRule=miss?'impossible':'guaranteed';d.critChance=critical?1:0;}
    return a;
  };
  const actions={slash:styleAction('斩击'),heavy:styleAction('重锤','',false,true),fire:styleAction('火焰术','火'),ice:styleAction('冰霜术','冰'),lightning:styleAction('雷击','雷'),miss:styleAction('落空测试','',true),mend:{...heal(),name:'治疗术',category:'spell',castMs:0}};
  let serial=0;
  function battle(side:'ally'|'enemy'='ally',action='slash',shield=false) {
    const actor=state.party[0]!;const card=contentCard(1,5000,10,structuredClone(actions));for(const skill of card.skills)skill.name=actions[skill.sourceId as keyof typeof actions]?.name??skill.name;actor.card=card;actor.current={hp:5000,mp:card.numeric.max.mp,sp:card.numeric.max.sp};actor.persistent=undefined;
    const encounter=state.region.things.find(t=>t.kind==='enemy')!;encounter.used=false;encounter.foes=['T15_N01'];
    state.paused=false;state.mode='battle';state.encounterId=encounter.id;state.run.battleActive=true;state.selected=null;state.selectedTargets=[];state.world=undefined;
    state.settings={...state.settings!,music:musicLevel,effects:1,animationSpeed:1,shake:true,flash:true};
    // Unique encounter stamp avoids artificial fixture resets looking like duplicate real commands.
    state.fights=++serial;
    const b=createBattle([{id:actor.id,name:'音频测试同行者',side:'ally',card,current:{...actor.current},mitigation:bareMitigation()},
      {id:'enemy-0',name:'音频测试敌人',side:'enemy',card,current:{hp:5000,mp:card.numeric.max.mp,sp:card.numeric.max.sp},mitigation:bareMitigation()}],233+serial);
    const caster=side==='enemy'?'enemy-0':actor.id,target=side==='enemy'?actor.id:'enemy-0';
    if(shield)b.units.find(u=>u.id===target)!.shields.push({id:'audio-shield',amount:5000,channels:['physical','energy','mental','true'],clock:'permanent',remaining:1});
    b.clock.pending=[{kind:'ready',unitId:caster}];for(const u of b.clock.units)u.atb=u.id===caster?100:0;
    state.battle=side==='enemy'?chooseAction(b,caster,action,target):b;
    runtime.input({type:'settings',payload:{}});
    return {caster,target};
  }
  g.FeedbackTest={state,runtime,resetNpc(){npc();runtime.input({type:'settings',payload:{}});},menu(){return battle();},enemy(action='fire',shield=false){return battle('enemy',action,shield);},ally(action='fire'){
    const ids=battle(),target=state.battle!.units.find(u=>u.id===ids.caster)!.actions[action]!.target==='enemy'?ids.target:ids.caster;
    if(action==='mend')state.battle!.units.find(u=>u.id===ids.caster)!.current.hp-=200;
    state.battle=chooseAction(state.battle!,ids.caster,action,target);runtime.input({type:'settings',payload:{}});return {...ids,target};
  },music(level:number){musicLevel=level;state.settings={...state.settings!,music:level};runtime.input({type:'settings',payload:{}});return level;},shield(){return battle('enemy','slash',true);},freeze(){state.paused=true;runtime.input({type:'settings',payload:{}});}};
  const engine=new g.Engine({executable:new URL('/game',location.href).href,mainPack:new URL('/game.pck',location.href).href,canvas:document.querySelector('canvas'),canvasResizePolicy:0,focusCanvas:true});
  await engine.startGame();g.FeedbackTest.started=true;
}
