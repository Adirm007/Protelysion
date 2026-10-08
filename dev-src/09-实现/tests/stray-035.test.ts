import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBattle,applyBattleEffects,assertPassive,isAlive,type Battle} from '../src/battle/executor';
import {validateAction,type ActionSpec,type EffectSpec} from '../src/compiler/contract';
import {bareMitigation,contentCard,strike,playtestParty,FOES} from '../src/game/content';
import {STRAY_ID,STRAY_NAME,STRAY_THREAD,carriesTargetDamage,strayKit,strayFloor} from '../src/game/monsters/stray';
import {startExpedition,spawnStray,strayStep,flee,view,tick,tickExploration,dismissWarning,move,type State} from '../src/game/expedition';
import {walkable} from '../src/game/region';
import {ScoreDirector, validateAudioManifest} from '../src/audio/policy';
import type {AudioManifest} from '../src/audio/types';
import {flat} from '../src/game/monsters/ir';

const act=(effects:EffectSpec[],target:ActionSpec['target']='enemy'):ActionSpec=>({target,cost:{hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}},castMs:0,recoveryFactor:1,perBattleUses:0,effects});
const dmg=(amounts:Partial<Record<'physical'|'energy'|'mental'|'true',Record<string,unknown>>>,element='none'):EffectSpec=>({op:'damage',amounts:{physical:flat(0),energy:flat(0),mental:flat(0),true:flat(0),...Object.fromEntries(Object.entries(amounts).map(([k,v])=>[k,{...flat(0),...v}]))} as never,element,hitChance:1,hitRule:'guaranteed',critChance:0,critMultiplier:1} as EffectSpec);
function duel(party:Parameters<typeof strayKit>[1]=[]){
 const kit=strayKit(12,party),card=contentCard(10,5000,18,{probe:{...strike(1),castMs:0}});
 return {kit,b:createBattle([{id:'her',name:kit.name,side:'enemy',card:kit.card,combatLevel:12,current:{...kit.card.numeric.max},mitigation:kit.mitigation},{id:'p1',side:'ally',card,current:{...card.numeric.max},mitigation:bareMitigation()}],3)};
}
const unit=(b:Battle,id:string)=>b.units.find(u=>u.id===id)!;

test('「?」套件：没人携带百分比/真实伤害时只有飞刀 + 本质被动；无/精抗性为 0', ()=>{
 const kit=strayKit(9,[]);
 assert.equal(kit.name,STRAY_NAME);assert.equal(kit.copied,0);
 assert.deepEqual(kit.card.skills.map(s=>s.sourceId),['stray/nature','stray/knife']);
 for(const s of kit.card.skills){const a=s.mapping.action!;s.mapping.disposition==='passive'?assertPassive(a):validateAction(a);}
 assert.equal(kit.mitigation.elementMultipliers['无'],0);assert.equal(kit.mitigation.elementMultipliers['精'],0);
 assert.ok(FOES[STRAY_ID]&&FOES[STRAY_ID]!.name==='?');
 assert.ok(strayFloor(9)&&strayFloor(19)&&strayFloor(8339)&&!strayFloor(10)&&!strayFloor(90));
});

test('「?」复制：只复制持有百分比/真实伤害技能成员的全部主动与被动技能，且资源不低于被复制者', ()=>{
 const plain=contentCard(10,3000,18,{slash:{...strike(30),castMs:0}});
 const truer=contentCard(10,3000,18,{pierce:act([dmg({true:{flat:500}})]),bless:act([{op:'heal',resource:'hp',amount:flat(50)}],'ally')});
 truer.skills.push({sourceId:'aura',name:'光环',sourceFingerprint:'authored',mapping:{sourceId:'aura',disposition:'passive',reason:'',action:act([{op:'modify',name:'光环',duration:{clock:'permanent',value:0},modifiers:[{stat:'evade',flat:.05}]}],'self')}});
 truer.numeric.max.mp=9999;
 assert.ok(!carriesTargetDamage(plain));assert.ok(carriesTargetDamage(truer));
 const kit=strayKit(11,[plain,truer]);
 assert.equal(kit.copied,truer.skills.length);
 assert.ok(kit.card.skills.some(s=>s.sourceId.endsWith('/pierce'))&&kit.card.skills.some(s=>s.sourceId.endsWith('/aura'))&&kit.card.skills.some(s=>s.sourceId.endsWith('/bless')));
 assert.ok(!kit.card.skills.some(s=>s.sourceId.endsWith('/slash')),'没资格的人不被复制');
 assert.ok(!kit.card.skills.some(s=>s.sourceId==='stray/knife'),'有复制就不带飞刀');
 assert.equal(kit.card.numeric.max.mp,strayKit(11,[]).card.numeric.max.mp,'面板只看等级，不随被复制者放大');
});

test('「?」判定：毒 / 燃烧这类状态 tick 的真实通道、遗物与道具都不算“持有真伤 / 百分比技能”', ()=>{
 const card=contentCard(10,3000,18,{slash:{...strike(30),castMs:0}});
 // 带毒（tick 走真实通道）的技能：库里有真伤 tick，但技能本身只是物理攻击 + 上状态
 const venom={...strike(20),castMs:0} as ActionSpec;venom.effects.push({op:'apply_status',status:'poison'} as EffectSpec);venom.library={actions:{poison_tick:act([dmg({true:{flat:8}})])},statuses:{poison:{name:'中毒',tags:['poison'],polarity:'negative',duration:{clock:'round',value:3},stack:'refresh',maxStacks:1,scaleWithStacks:true,priority:0,dispellable:true,removeOnDeath:false,scope:'battle',tick:{interval:1,clock:'round',action:'poison_tick',count:3}}},summons:{},fields:{}};
 card.skills.push({sourceId:'venom',name:'毒刃',sourceFingerprint:'authored',mapping:{sourceId:'venom',disposition:'active',reason:'',action:venom}});
 card.skills.push({sourceId:'relic/R999/0',name:'遗物',sourceFingerprint:'authored',mapping:{sourceId:'relic/R999/0',disposition:'passive',reason:'',action:act([dmg({true:{flat:5}})],'enemy')}});
 assert.ok(!carriesTargetDamage(card),'毒 tick 与遗物不该让她复制全队');
 const kit=strayKit(10,[card,card]);assert.equal(kit.copied,0);assert.deepEqual(kit.card.skills.map(s=>s.sourceId),['stray/nature','stray/knife']);
});

test('「?」战斗规则：百分比伤害全额转治疗、真实伤害先于抗性全额反射、无属性无效、火属性正常、敌方效果挂不上', ()=>{
 let {b}=duel();const her=()=>unit(b,'her'),p1=()=>unit(b,'p1');
 const max=her().max.hp;her().current.hp=Math.floor(max*.4);
 b=applyBattleEffects(b,'p1',act([dmg({physical:{maxResource:'hp',maxFraction:.3,subject:'target'}})]),['her']);
 assert.ok(her().current.hp>Math.floor(max*.4),'百分比伤害应变成治疗');
 const before=her().current.hp,php=p1().current.hp;
 b=applyBattleEffects(b,'p1',act([dmg({true:{flat:1e7}})]),['her']);
 assert.equal(her().current.hp,before,'真实伤害不落在她身上');
 assert.ok(!isAlive(p1())&&php-p1().current.hp>=php,'一千万真实伤害原样弹回');
 p1().current.hp=p1().max.hp;delete (p1() as {deathEvent?:unknown}).deathEvent;(p1() as {defeated?:boolean}).defeated=false;
 b=applyBattleEffects(b,'p1',act([dmg({energy:{flat:300}})]),['her']);
 assert.equal(her().current.hp,before,'无属性（无元素的能量）攻击无效');
 b=applyBattleEffects(b,'p1',act([dmg({mental:{flat:300}})]),['her']);
 assert.equal(her().current.hp,before,'精神属性攻击无效');
 b=applyBattleEffects(b,'p1',act([dmg({physical:{flat:300}})]),['her']);
 assert.ok(her().current.hp<before,'物属性正常生效');const afterPhysical=her().current.hp;
 b=applyBattleEffects(b,'p1',act([dmg({energy:{flat:300}},'火')]),['her']);
 assert.ok(her().current.hp<afterPhysical,'火属性攻击正常生效');
 b=applyBattleEffects(b,'p1',act([{op:'modify',name:'诅咒',duration:{clock:'round',value:3},modifiers:[{stat:'evade',flat:-.5}]}]),['her']);
 assert.ok(!her().statuses?.some(s=>s.definition.name==='诅咒'),'敌方挂不上效果');
});

test('「?」遭遇：刷新在最短路径 18 格外、随玩家步伐沿最短路径追近、追上即战、普通逃跑无效、等级 = 队伍最高 + 1', ()=>{
 const s:State=startExpedition(playtestParty(),19);
 spawnStray(s);const t=s.region.things.find(t=>t.hunter)!;assert.ok(t,'应刷新');
 const bfs=(sx:number,sz:number)=>{const d=new Map<string,number>([[sx+','+sz,0]]);const q:[number,number][]=[[sx,sz]];while(q.length){const [x,z]=q.shift()!;for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]] as const){const k=(x+dx)+','+(z+dz);if(walkable(s.region,x+dx,z+dz)&&!d.has(k)){d.set(k,d.get(x+','+z)!+1);q.push([x+dx,z+dz]);}}}return d;};
 const d0=bfs(s.x,s.z).get(t.x+','+t.z)!;assert.ok(d0>=18||d0===Math.max(...bfs(s.x,s.z).values()),'距离 '+d0);
 let last=d0,steps=0;while(s.mode==='explore'&&steps<40){strayStep(s);steps++;const d=bfs(s.x,s.z).get(t.x+','+t.z)!;assert.ok(d<=last||s.mode!=='explore','不得变远');last=d;}
 assert.equal(s.mode,'battle');assert.ok(steps>=d0&&steps<=d0+6,'走 '+steps+' 步追上（起始 '+d0+'）');
 const top=Math.max(...s.party.map(p=>p.card.numeric.level));
 const her=s.battle!.units.find(u=>u.side==='enemy')!;assert.equal(her.level,top+1);assert.equal(her.name,'?');
 const v=view(s);assert.equal(v.battle.units.find(u=>u.side==='enemy')!.name,'?');
 // 轮到玩家时普通逃跑必失败且不消耗回合以外的东西
 for(let i=0;i<200&&!(view(s).battle.ready);i++)tick(s);
 if(view(s).battle.ready){const before=structuredClone(s.battle);flee(s);assert.equal(s.mode,'battle');assert.deepEqual(s.battle!.clock.pending,before!.clock.pending);}
});

test('「?」自主追击：玩家原地不动，她也按 160ms/格 沿最短路径追上来', ()=>{
 const s:State=startExpedition(playtestParty(),19);spawnStray(s);const t=s.region.things.find(t=>t.hunter)!;const x0=t.x,z0=t.z;
 assert.equal(view(s).warning,'有什么在接近…');tickExploration(s,5000);assert.ok(t.x===x0&&t.z===z0,'弹框未关：她不动');const px=s.x;move(s,1,0);move(s,-1,0);move(s,0,1);move(s,0,-1);assert.equal(s.x,px,'弹框未关：玩家也不动');dismissWarning(s);assert.equal(view(s).warning,'');
 tickExploration(s,50);assert.ok(t.x===x0&&t.z===z0,'50ms 不够一步');
 tickExploration(s,110);assert.ok(t.x!==x0||t.z!==z0,'满 160ms 走一步');
 let ms=0;while(s.mode==='explore'&&ms<20000){tickExploration(s,50);ms+=50;}
 assert.equal(s.mode,'battle','玩家没动也被追上');assert.ok(ms<=160*20,'最短路径 ≤ 20 格应在 '+ms+'ms 内追上');
});

test('「?」掉落：击败必掉符合其等级的盲盒，并可能掉「暧昧的线」', ()=>{
 const s:State=startExpedition(playtestParty(),19);spawnStray(s);
 for(let i=0;i<60&&s.mode==='explore';i++)strayStep(s);
 assert.equal(s.mode,'battle');
 const her=s.battle!.units.find(u=>u.side==='enemy')!;
 s.battle=applyBattleEffects(s.battle!,s.party[0]!.id,act([dmg({energy:{flat:1e12}},'火')]),[her.id]);
 for(let i=0;i<400&&s.mode==='battle';i++)tick(s);
 assert.notEqual(s.mode,'battle');
 const box=s.run.rewards.find(r=>r.kind==='box');assert.ok(box,'必掉盲盒');
 assert.ok(s.run.rewards.every(r=>r.kind!=='material'||r.name===STRAY_THREAD.name));
});

test('「?」实时镜像：战斗中玩家单位新得到的技能会被她同步写下', ()=>{
 const s:State=startExpedition(playtestParty(),19);spawnStray(s);
 for(let i=0;i<60&&s.mode==='explore';i++)strayStep(s);assert.equal(s.mode,'battle');
 const her=s.battle!.units.find(u=>u.side==='enemy')!,p=s.battle!.units.find(u=>u.side==='ally')!;
 const before=Object.keys(her.actions).length;
 p.actions['learned-pierce']={...act([dmg({true:{flat:120}})]),category:'skill',source:{kind:'skill',id:'learned-pierce'}} as never;p.actions['learned-heal']={...act([{op:'heal',resource:'hp',amount:flat(30)}],'ally'),category:'skill',source:{kind:'skill',id:'learned-heal'}} as never;
 tick(s);
 const now=s.battle!.units.find(u=>u.side==='enemy')!;
 assert.ok(now.actions['stray/'+p.id+'/learned-pierce'],'真实伤害新技能被镜像');assert.ok(now.actions['stray/'+p.id+'/learned-heal'],'同一人的其他新技能一并镜像');
 assert.ok(Object.keys(now.actions).length>before);
});

test('「?」战斗曲：任何遭遇只要有她就播 ToEverythingThereIsSeason', ()=>{
 const manifest=JSON.parse(readFileSync(new URL('../../21-音频制作/assets/audio-manifest.json',import.meta.url),'utf8')) as AudioManifest;
 assert.deepEqual(validateAudioManifest(manifest),[]);
 assert.ok(manifest.music['ToEverythingThereIsSeason']);
 const d=new ScoreDirector(manifest);
 const pick=d.select({mode:'battle',theme:'T01',scene:'感染街区',battleKey:'x',foeIds:[STRAY_ID],phase:false,paused:false} as never);
 assert.equal(pick?.id,'ToEverythingThereIsSeason');
});
