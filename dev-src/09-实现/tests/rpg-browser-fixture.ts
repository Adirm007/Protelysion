// Isolated render fixture only. Never imported by a production entry or publisher.
import {startExpedition,move} from '../src/game/expedition';
import {playtestParty,strike} from '../src/game/content';
import {mountExpeditionRuntime} from '../src/game/runtime';
import {loadHostPortraits,avatarKey} from '../src/host/avatars';
import {installPlayerTheme,AVATAR_ART,PORTRAIT_ART} from '../src/ui/theme';
export async function boot(){
 const g=window as any,query=new URL(location.href).searchParams,mode=query.get('mode')??'battle',count=Number(query.get('count')??4),base=playtestParty();
 const party=Array.from({length:count},(_,i)=>{const p=structuredClone(base[i%base.length]!);p.id='test-actor-'+i;p.name=['主角','福尔摩斯探案集','守卷者','旅灯'][i]!;p.ref=i===0?{kind:'player' as const}:{kind:'partner' as const,name:p.name};return p;});
 await new Promise<void>((resolve,reject)=>{const request=indexedDB.open('status-avatar-db',1);request.onupgradeneeded=()=>request.result.createObjectStore('avatars',{keyPath:'key'});request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('avatars','readwrite');for(const [i,p]of party.entries())tx.objectStore('avatars').put({key:avatarKey('隔离渲染测试',p.ref!),scope_key:'status:隔离渲染测试',owner_type:p.ref!.kind,owner_name:p.name,source_type:'upload',value:i%2?PORTRAIT_ART:AVATAR_ART});tx.oncomplete=()=>{db.close();resolve();};};});
 const globals={getCurrentCharacterName:()=> '隔离渲染测试',getVariables:()=>({}),SillyTavern:{substituteParams:()=>'/unused-default.png'}};
 const portraits=await loadHostPortraits(globals,party),state=startExpedition(party,22567);
 if(mode==='battle'){
  const foe=state.region.things.find(t=>t.kind==='enemy')!;foe.foes=['T15_N01','T15_N02'];state.x=foe.x-1;state.z=foe.z;move(state,1,0);
  const b=state.battle!,u=b.units.find(u=>u.side==='ally')!;
  const multi=strike(8,'physical',5);multi.name='纸页齐射';multi.targeting={side:'enemy',selection:'manual',count:2,life:'alive'};u.actions['test-multi']=multi;
  for(let n=0;n<32;n++){const a=strike(18,'physical',7);if(n===0)a.description='将散落的书页汇成一道锋芒，攻向前方的敌人。\n翻过这一页，旅程还会继续。';if(n===2)a.cost.sp=structuredClone(strike(18,'physical',9999).cost.sp);a.name=n===31?'一项非常非常长的技能名称用于检查换行与费用显示':'书页术式 '+(n+1);u.actions['test-'+n]=a;}
  const hit=strike(60);hit.name='裂页冲击';const damage=hit.effects[0]!;if(damage.op==='damage'){damage.hitChance=1;damage.critChance=0;}
  const enemy=b.units.find(u=>u.side==='enemy')!;enemy.actions={hit};b.clock.pending=[{kind:'ready',unitId:u.id}];
 }
 const root=document.getElementById('app')!;installPlayerTheme(root);root.classList.add('bs-playing');root.innerHTML='<div class="bs-portal"><section id="stage"><canvas id="canvas" tabindex="0"></canvas></section></div>';
 const runtime=mountExpeditionRuntime({storageKey:'rpg-isolated-fixture',uiRoot:document.getElementById('stage')!,portraits,initial:state,audio:false});
 g.RPGTest={state,portraits,runtime,playerTurn(){const b=state.battle!,ally=b.units.find(u=>u.side==='ally')!;for(const cu of b.clock.units){cu.atb=0;cu.cast=null;}b.clock.pending=[{kind:'ready',unitId:ally.id}];state.selected=null;runtime.input({type:'cancel'});},enemyTurn(){const b=state.battle!,enemy=b.units.find(u=>u.side==='enemy')!;for(const cu of b.clock.units){cu.atb=0;cu.cast=null;}b.clock.pending=[{kind:'ready',unitId:enemy.id}];state.selected=null;runtime.input({type:'cancel'});},clearThings(){state.region.things=[];},emptyGround(){state.region.things=[];runtime.input({type:'interact'});}};
 const engine=new g.Engine({executable:new URL('/game',location.href).href,mainPack:new URL('/game.pck',location.href).href,canvas:document.querySelector('canvas'),canvasResizePolicy:0,focusCanvas:true});await engine.startGame();g.RPGTest.started=true;
}
