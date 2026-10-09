import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBattle,chooseAction,resolveAction,advanceBattle,applyBattleEffects,type Battle} from '../src/battle/executor';
import {clockPhase} from '../src/battle/clock';
import {bareMitigation,contentCard,strike,playtestParty} from '../src/game/content';
import {INTERLUDE_TAG,DELAYED_RETURN} from '../src/compiler/examples';
import {interludeAction,normalizeInterlude,isInterludeName} from '../src/compiler/interlude';
import {nativeAbility} from '../src/compiler/adaptive';
import {validateCompiled} from '../src/compiler/engine';
import {STRAY_ID,STRAY_SPAWN_DISTANCE,STRAY_THREAD} from '../src/game/monsters/stray';
import {RELIC_CATALOG} from '../src/game/relic-catalog';
import {startExpedition,spawnStray,strayStep,view,tick,chooseSkill,chooseTarget,craftSilverCross,toggleCrossWard,threadsAvailable,CROSS_KEY,CROSS_ALLY_ID,type State} from '../src/game/expedition';
import {addReward} from '../src/core/run';
import {bagThreadCount,bagHasSilverCross,craftSilverCrossInBag,settleRunRewards} from '../src/core/settlement';
import {knockoutLines,foeInfo} from '../src/game/defeat-report';

const unit=(b:Battle,id:string)=>b.units.find(u=>u.id===id)!;

test('「?」刷新距离 18 格；无字书签改为 36 格；暧昧的线只多一句', ()=>{
 assert.equal(STRAY_SPAWN_DISTANCE,18);
 const bookmark=Object.values(RELIC_CATALOG).find(r=>r.name==='无字书签')!;
 assert.match(bookmark.description,/36 格/);assert.equal((bookmark as unknown as {hooks:{strayDistance:number}}).hooks.strayDistance,36);
 assert.ok(STRAY_THREAD.description.endsWith('如果收集九个的话…'));
});

/** 同一场战斗：p1 用小憩，p2 旁观，敌人只是站着。返回小憩结算时的回合与撤离时的回合。 */
function interludeBattle(opts:{blank?:boolean}={}){
 const rest=interludeAction('间章:小憩'),a=contentCard(10,5000,20,{rest}),b2=contentCard(10,5000,14,{}),foe=contentCard(10,50000,6,{hit:{...strike(1),castMs:0}});
 let b:Battle=createBattle([{id:'p1',side:'ally',card:a,current:{...a.numeric.max},mitigation:bareMitigation()},{id:'p2',side:'ally',card:b2,current:{...b2.numeric.max},mitigation:bareMitigation()},{id:'e',side:'enemy',card:foe,current:{...foe.numeric.max},mitigation:bareMitigation()}],7);
 if(opts.blank)b=applyBattleEffects(b,'e',{target:'enemy',cost:{hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}},castMs:0,recoveryFactor:1,perBattleUses:0,effects:[{op:'rule',rule:'blank_page',key:'rest',duration:{clock:'permanent',value:0}} as never]},['p1'],'effect','test');
 let used=-1,left=-1,rounds:number[]=[];
 for(let i=0;i<4000&&left<0;i++){
  const head=b.clock.pending[0];
  if(head?.kind==='ready'){const id=head.unitId;b=chooseAction(b,id,id==='p1'&&used<0?'rest':'booksea:wait',id);continue;}
  if(head?.kind==='resolve'){const cmd=b.commands[head.commandId];const was=cmd?.sourceId;b=resolveAction(b);if(was==='rest'&&used<0){used=b.round??Math.floor(b.clock.timeMs/4000);}continue;}
  if(clockPhase(b.clock)!=='flowing')break;
  b=advanceBattle(b,100).battle;rounds.push(b.round??0);
  if(used>=0&&unit(b,'p1').escaped&&unit(b,'p2').escaped)left=b.round??0;
 }
 return {b,used,left};
}

test('间章:小憩：使用回合的下下回合开始时，全体存活我方必定撤离', ()=>{
 const {b,used,left}=interludeBattle();
 assert.ok(used>=0,'小憩已结算');assert.equal(left,used+2,'撤离发生在第 '+left+' 回合，使用于第 '+used+' 回合');
 for(const id of ['p1','p2']){assert.ok(unit(b,id).retreatRequested,id+' 撤离');assert.ok(unit(b,id).current.hp>0,id+' 未倒下');}
 assert.ok(!unit(b,'e').escaped,'敌人不受影响');
});

test('间章:小憩：空白页也无法让它作废', ()=>{
 const {b,used,left}=interludeBattle({blank:true});
 assert.ok(used>=0);assert.equal(left,used+2);assert.ok(unit(b,'p2').retreatRequested);
 assert.ok(b.log.some(l=>l.kind==='fizzle'),'空白页确实生效（这一招本身作废）');
});

test('间章:小憩：固定编译优先于通用正则，旧缓存读取时替换', ()=>{
 assert.ok(isInterludeName('间章:小憩')&&isInterludeName('间章：小憩')&&!isInterludeName('小憩'));
 const raw={名称:'间章:小憩',效果:{叙事抽离:'将使用者转移至不明次元。若战斗中使用，将在下下回合开始时生效'}};
 const mapped=nativeAbility({sourceId:'/技能/间章:小憩',name:'间章:小憩',raw} as never)!;
 assert.ok(mapped.mapping.action!.tags!.includes(INTERLUDE_TAG));
 const old={sourceId:'/技能/间章:小憩',name:'间章:小憩',sourceFingerprint:'x',mapping:{sourceId:'/技能/间章:小憩',disposition:'active',reason:'旧',action:structuredClone(DELAYED_RETURN),fidelity:{mode:'approximate',summary:'旧',clauses:[{original:'a',implementation:'旧'}],changes:[{original:'a',implemented:'旧',reason:'旧'}]}}};
 const fixed=normalizeInterlude(structuredClone(old));assert.ok(fixed.mapping.action!.tags!.includes(INTERLUDE_TAG));assert.ok(!fixed.mapping.action!.effects.some(e=>e.op==='time'));
 const party=playtestParty(),card=structuredClone(party[0]!.card);card.skills.push(old as never);
 const loaded=validateCompiled(card);assert.ok(loaded.skills.find(s=>s.name==='间章:小憩')!.mapping.action!.tags!.includes(INTERLUDE_TAG),'validateCompiled 统一替换');
});

function withThreads(s:State,run:number){for(let i=0;i<run;i++)s.run=addReward(s.run,{kind:'material',name:STRAY_THREAD.name,quality:STRAY_THREAD.quality,theme:'t',region:'r'+i,effect:STRAY_THREAD.effect,description:STRAY_THREAD.description,monsterId:STRAY_ID,count:1,source:'r·?'});}

test('银十字：本趟的线 + 背包里的线满九根即可合成，先扣本趟', ()=>{
 const s:State=startExpedition(playtestParty(),1);s.paused=false;withThreads(s,3);s.threadsHeld=5;
 assert.equal(threadsAvailable(s),8);craftSilverCross(s);assert.ok(!s.crossHeld,'八根不够');
 s.threadsHeld=6;craftSilverCross(s);assert.ok(s.crossHeld);
 assert.equal(threadsAvailable(s),0);assert.deepEqual(s.crossCrafted,{bagThreads:6});
 assert.ok(!s.run.rewards.some(r=>r.kind==='material'&&r.monsterId===STRAY_ID));
 assert.equal(view(s).cross.held,true);
});

test('银十字：宿主背包扣线并放入银十字，跨趟累计的线能被识别', ()=>{
 const mvu={stat_data:{命运点数:0,主角:{背包:{} as Record<string,unknown>}}} as Record<string,unknown>;
 const s:State=startExpedition(playtestParty(),1);withThreads(s,3);
 let m=settleRunRewards(mvu as never,s.run.rewards);assert.equal(bagThreadCount(m),3);
 m=settleRunRewards(m,[{...s.run.rewards[0]!,count:6,region:'别处'} as never]);assert.equal(bagThreadCount(m),9);
 assert.throws(()=>craftSilverCrossInBag(m,10));
 const after=craftSilverCrossInBag(m,9);assert.equal(bagThreadCount(after),0);assert.ok(bagHasSilverCross(after));
});

function strayFight(s:State){spawnStray(s);for(let i=0;i<80&&s.mode==='explore';i++)strayStep(s);assert.equal(s.mode,'battle');}
function toAllyMenu(s:State){for(let i=0;i<400&&!view(s).battle.ready;i++)tick(s);assert.ok(view(s).battle.ready);}

test('银十字（战斗）：不足四人时召来「?」助战，每趟一次；满四人不可用', ()=>{
 const s:State=startExpedition(playtestParty().slice(0,2),19);s.paused=false;s.crossHeld=true;strayFight(s);
 const caster=s.battle!.clock.pending[0]?.unitId;toAllyMenu(s);
 const actor=s.battle!.clock.pending[0]!.unitId;assert.ok(s.battle!.units.find(u=>u.id===actor)!.actions[CROSS_KEY],'战斗中出现银十字');void caster;
 chooseSkill(s,CROSS_KEY);
 const ally=s.battle!.units.find(u=>u.id===CROSS_ALLY_ID);assert.ok(ally,'「?」加入');assert.equal(ally!.side,'ally');assert.equal(ally!.name,'?');
 assert.ok(ally!.passiveNames?.includes('未成之字'),'带着她的本质');assert.ok(s.crossUsed);
 assert.ok(!s.battle!.units.some(u=>u.actions[CROSS_KEY]),'用过即收回');
 assert.ok(view(s).battle.units.some(u=>u.id===CROSS_ALLY_ID&&u.side==='ally'));
 const her=s.battle!.units.find(u=>u.side==='enemy')!;s.battle=applyBattleEffects(s.battle!,s.party[0]!.id,{target:'enemy',cost:{hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}},castMs:0,recoveryFactor:1,perBattleUses:0,effects:[{op:'damage',amounts:{physical:{flat:0,attribute:'none',factor:0,scale:'flat',maxResource:'none',maxFraction:0},energy:{flat:1e12,attribute:'none',factor:0,scale:'flat',maxResource:'none',maxFraction:0},mental:{flat:0,attribute:'none',factor:0,scale:'flat',maxResource:'none',maxFraction:0},true:{flat:0,attribute:'none',factor:0,scale:'flat',maxResource:'none',maxFraction:0}},element:'火',hitChance:1,hitRule:'guaranteed',critChance:0,critMultiplier:1} as never]},[her.id]);
 for(let i=0;i<400&&s.mode==='battle';i++)tick(s);assert.equal(s.mode,'explore','有「?」助战的战斗能正常结束');assert.equal(s.run.status,'active');
 const base=playtestParty(),four=[...base,...base.map(p=>({...structuredClone(p),id:p.id+'-b',name:p.name+'乙'}))];
 const full:State=startExpedition(four,19);full.crossHeld=true;
 assert.ok(full.party.length>=4,'测试队伍应有四人');{strayFight(full);toAllyMenu(full);chooseSkill(full,CROSS_KEY);assert.ok(!full.battle!.units.some(u=>u.id===CROSS_ALLY_ID),'满四人不召唤');}
});

test('银十字（探索）：举起后不再遭遇「?」，放下后恢复；当前的追兵立即消失', ()=>{
 const s:State=startExpedition(playtestParty(),19);s.paused=false;s.crossHeld=true;spawnStray(s);s.strayWarning=false;
 assert.ok(s.region.things.some(t=>t.hunter&&!t.used));
 toggleCrossWard(s);assert.ok(s.crossWard);assert.ok(!s.region.things.some(t=>t.hunter&&!t.used),'追兵消失');
 toggleCrossWard(s);assert.ok(!s.crossWard);
 const src=readFileSync(new URL('../src/game/expedition.ts',import.meta.url),'utf8');assert.match(src,/strayFloor\(depth\)&&!s\.crossWard/);
});

test('败退交接：写明每人在哪、被谁击倒，以及最后一战败给了谁', ()=>{
 const s:State=startExpedition(playtestParty(),19);
 s.knockouts=[
  {member:'a',name:'艾拉',depth:18,region:'旧书廊',theme:'书库',cause:'exploration',foes:[]},
  {member:'p',name:'主角',depth:19,region:'灰塔',theme:'钟楼',cause:'battle',foes:[{id:STRAY_ID,name:'?',level:21}]},
 ];
 const lines=knockoutLines(s,['p']).join('\n');
 assert.match(lines,/艾拉：第18层「旧书廊」（书库），在探索途中倒下/);
 assert.match(lines,/主角：第19层「灰塔」（钟楼），在与「\?」的战斗中被击倒/);
 assert.match(lines,/最后一战：第19层「灰塔」（钟楼），队伍败给了「\?」/);
 assert.match(lines,/资料见【「\?」】/);
 assert.match(foeInfo({id:STRAY_ID,name:'?',level:3}),/^「\?」/);
});

test('间章:小憩（整趟）：对「?」使用后，下下回合全队成功撤离、本趟成功结算', ()=>{
 const party=playtestParty();party[0]!.card.skills.push({sourceId:'/技能/间章:小憩',name:'间章:小憩',sourceFingerprint:'t',mapping:{sourceId:'/技能/间章:小憩',disposition:'active',reason:'t',action:interludeAction('间章:小憩')}} as never);
 const s:State=startExpedition(party,19);s.paused=false;strayFight(s);
 let used=false;
 for(let i=0;i<6000&&s.mode==='battle';i++){
  const v=view(s);
  if(v.battle.ready){const actor=s.battle!.clock.pending[0]!.unitId;if(!used&&actor===party[0]!.id){chooseSkill(s,'/技能/间章:小憩');used=true;}else chooseSkill(s,'booksea:wait');if(s.selected)chooseTarget(s,actor,true);continue;}
  tick(s);
 }
 assert.ok(used,'小憩已使用');assert.equal(s.selected,null,'小憩一键发动，无需再选对象');assert.equal(s.mode,'ended');assert.equal(s.run.status,'success');
 assert.ok(s.run.participants.every(p=>p.status==='voluntaryExit'),'全员主动离场');
});
