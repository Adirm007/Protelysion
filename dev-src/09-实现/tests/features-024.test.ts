import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {chestSpawns,makeRegion,CHEST_APPEARANCE_RATE,MIMIC_FRACTION} from '../src/game/region';
import {roll} from '../src/battle/damage';
import {startExpedition,interact,view,flee,tick,chooseSkill,chooseTarget,enemyLevel} from '../src/game/expedition';
import {playtestParty,strike} from '../src/game/content';
import {MONSTER_ROSTER} from '../src/game/monsters/catalog';
import {MIMIC_ID,mimicKit,mimicLevel} from '../src/game/monsters/mimic';
import {TIER_START} from '../src/game/monsters/numbers';
import {validateCompiled} from '../src/compiler/engine';
import {validateAction} from '../src/compiler/contract';
import {applyBattleEffects} from '../src/battle/executor';
import {action} from '../src/game/monsters/ir';
import {enemyArtId} from '../src/presentation/monster-art';
import {EVENT_CATALOG,RELIC_CATALOG} from '../src/game/mechanism-content';
import {eventChoiceDescription,relicDescription} from '../src/game/event-text';
import {settleRunRewards} from '../src/core/settlement';
import {addReward,exitMembers,settlementProposal} from '../src/core/run';
import {fixture} from './fixtures';
import {actorAt,object} from '../src/core/actors';
import {promptTemplateChat,promptTemplateVariables} from './prompt-template-fixture';
import {exitExtra,exitPromptData,EXIT_REQUEST} from '../src/core/handoff-message';
function seedFor(chest:boolean,mimic:boolean){for(let s=1;s<100000;s++){const r=chestSpawns(1,0,s);if(r.chest===chest&&r.mimic===mimic)return s;}throw Error('No matching chest outcome');}
function mimicBattle(depth=1){
 const seed=seedFor(false,true),s=startExpedition(playtestParty().slice(0,1),seed);s.depth=depth;
 const t=s.region.things.find(t=>t.kind==='mimic')!;s.x=t.x;s.z=t.z;interact(s);return s;
}
test('0241 final 8% chest lottery splits into 4% ordinary and 4% mimic at one POI',()=>{
 assert.equal(CHEST_APPEARANCE_RATE,.08);assert.equal(MIMIC_FRACTION,.5);
 let chests=0,mimics=0,both=0;
 for(let seed=1;seed<=20000;seed++){
  const result=chestSpawns(1,0,seed),value=roll((seed+Math.imul(1,2654435761))>>>0).value;assert.equal(result.chest,value<.04);assert.equal(result.mimic,value>=.04&&value<.08);
  chests+=Number(result.chest);mimics+=Number(result.mimic);both+=Number(result.chest&&result.mimic);
 }
 assert.ok(chests/20000>.025&&chests/20000<.055);assert.ok(mimics/20000>.025&&mimics/20000<.055);assert.equal(both,0);
 for(const pair of [[false,false],[true,false],[false,true]] as const){
  const r=makeRegion(1,0,seedFor(pair[0],pair[1]));assert.equal(r.things.some(t=>t.kind==='chest'),pair[0]);assert.equal(r.things.some(t=>t.kind==='mimic'),pair[1]);
  const locations=r.things.filter(t=>t.kind==='chest'||t.kind==='mimic');assert.ok(locations.length<=1);assert.ok(locations.every(t=>t.name==='封存的宝匣'));const pad=r.layout.pois.find(p=>p.kind==='chest')!;assert.ok(locations.every(t=>t.x===pad.x&&t.z===pad.z));
 }
});
test('024 opening disguised chest starts combat with no immediate reward; level is +5 and at least 6',()=>{
 for(const depth of [1,2,10,41,50,60,150]){const s=mimicBattle(depth);assert.equal(s.mode,'battle');assert.equal(s.battle!.units.find(u=>u.side==='enemy')!.level,Math.max(6,enemyLevel(depth)+5));assert.equal(s.run.rewards.length,0);assert.equal(view(s).battle.escapeLocked,true);}
});
test('024 normal escape is blocked without RNG/action consumption but explicit retreat effects remain valid',()=>{
 const s=mimicBattle(),b=s.battle!,ally=b.units.find(u=>u.side==='ally')!;b.clock.pending=[{kind:'ready',unitId:ally.id}];
 const before=structuredClone(b);flee(s);assert.deepEqual(s.battle,before);assert.match(s.notice,/逃不掉/);
 s.battle=applyBattleEffects(b,ally.id,action([{op:'retreat'}],'self'),[ally.id]);tick(s);
 assert.equal(s.mode,'ended');assert.equal(s.run.status,'success');assert.equal(s.run.rewards.length,0);
});
test('024 actually defeating a mimic always awards exactly one unopened box, never on opening or retreat',()=>{
 for(let n=0;n<8;n++){
  const s=mimicBattle(),b=s.battle!,u=b.units.find(u=>u.side==='ally')!,hit=strike(1e9);const d=hit.effects[0]!;if(d.op==='damage'){d.hitRule='guaranteed';d.hitChance=1;d.critChance=0;}
  b.seed=(17+n*13371337)>>>0;s.seed=b.seed;u.actions.testKill=hit;b.clock.pending=[{kind:'ready',unitId:u.id}];chooseSkill(s,'testKill');chooseTarget(s,'enemy-0');
  for(let i=0;i<30&&s.mode==='battle';i++)tick(s,50);
  assert.equal(s.mode,'explore');assert.equal(s.run.rewards.filter(r=>r.kind==='box').reduce((v,r)=>v+r.count,0),1);assert.equal(s.region.things.find(t=>t.kind==='mimic')!.used,true);
 }
});
for(const level of TIER_START)test('024 mimic life-tier template '+level+' is real, executable and uses proper level rules',()=>{
 const kit=mimicKit(level);validateCompiled(kit.card);for(const skill of kit.card.skills)validateAction(skill.mapping.action!);
 assert.equal(kit.name,'宝箱怪');assert.equal(kit.numbers.lifeTier,TIER_START.indexOf(level)+1);assert.ok(kit.card.skills.every(s=>s.sourceId.includes(MIMIC_ID)));assert.ok(kit.counterplay.some(x=>x.includes('普通逃跑')));
});
test('024 challenge levels beyond 25 stay +5, not truncated to the seventh tier boundary',()=>{assert.equal(mimicLevel(25),30);const k=mimicKit(30);assert.equal(k.numbers.displayLevel,30);assert.equal(k.numbers.kitLevel,25);assert.ok(k.numbers.challengeGrowth.hp>1);});
test('024 FP is credited directly with sealed boxes, including unfinished legacy voucher rewards',()=>{
 const m=fixture(),before=structuredClone(m),n=settleRunRewards(m,[{kind:'fp',amount:50,count:2,source:'fight'},{kind:'voucher',faceValue:25,count:1,source:'legacy'},{kind:'box',quality:'普通',style:'纸页',contentType:'材料',count:1,source:'chest'}]);
 assert.deepEqual(m,before);assert.equal(object(n.stat_data).命运点数,225);const bag=object(actorAt(n,{kind:'player'}).背包);assert.ok(!Object.keys(bag).some(n=>n.includes('FP兑换券')));assert.equal(object(bag['普通·纸页·材料盲盒']).数量,1);
});
test('024 failed expedition clears FP and blind boxes together',()=>{
 const s=startExpedition(playtestParty().slice(0,1),8);s.run=addReward(s.run,{kind:'fp',amount:88,count:1,source:'battle'});s.run=exitMembers(s.run,s.run.participants.map(p=>({ref:p.ref,reason:'downedExit' as const})));assert.equal(settlementProposal(s.run).rewards.length,0);
});
test('024 every event offers explicit costs, outcomes and exact weighted risks; page editions explain their tradeoffs',()=>{
 for(const e of Object.values(EVENT_CATALOG))for(const c of e.choices){const t=eventChoiceDescription(c,[{id:'reader',name:'旅人',current:{hp:100,mp:80,sp:60}}]);assert.match(t,/代价：/);assert.match(t,/结果：/);if(c.risks?.length)assert.match(t,/风险分支：[\s\S]*%：/);}
 // 0.36：60 条声明式遗物，描述含稀有度 / 作用范围 / 词条。
 assert.match(relicDescription('R001'),/速度 ×2/);assert.match(relicDescription('R015'),/不可丢弃/);assert.match(relicDescription('R036'),/不可转移/);assert.match(relicDescription('R013'),/敌我全场/);assert.equal(Object.keys(RELIC_CATALOG).length,61);/* 0.41：60 条随机池遗物 + 商店限定「学习装置」 */
});
test('024 hostile summons and chained clones retain the owning monster portrait, without unsafe recursion',()=>{
 const units=[{id:'enemy-0'},{id:'child',owner:'enemy-0'},{id:'clone',owner:'child'}];assert.equal(enemyArtId(units[2]!,units,['T03_N01']),'T03_N01');assert.equal(enemyArtId({id:'x',owner:'x'},[{id:'x',owner:'x'}],[]),'');
});
function renderEjs(template:string,context:Record<string,unknown>){let code="let output='';";for(const chunk of template.split(/(<%[\s\S]*?%>)/g)){if(chunk.startsWith('<%')){const e=chunk.replace(/^<%[-=_]?/,'').replace(/[-_]?%>$/,'');code+=(chunk[2]==='-'||chunk[2]==='=')?'output+=('+e+');':e+';';}else code+='output+='+JSON.stringify(chunk)+';';}return vm.runInNewContext('(function(){'+code+'return output;})()',context);}
for(const status of ['success','failed'] as const)test('024 '+status+' EJS reads actual native message variables without TavernHelper or message.extra access',()=>{
 const extra=exitExtra('chat-A','run-A',status,'深度9，击败宝箱怪，FP已经结算'),data=exitPromptData(fixture(),extra),messages=[{role:'user',message:EXIT_REQUEST,data}];
 const book={booksea:{lastExpedition:{mode:'ended',hostContext:'chat-A',run:{id:'run-A',status}}},复活机制:'原核心复活规则'};
 const context={...promptTemplateChat(messages),...promptTemplateVariables(messages,book)};
 const template=readFileSync('templates/'+(status==='failed'?'failure':'success')+'-handoff.ejs','utf8'),output=renderEjs(template,context);
 assert.match(output,/深度9，击败宝箱怪，FP已经结算/);assert.match(output,/原场景/);assert.doesNotMatch(output,/<booksea-game>/);
 assert.equal(renderEjs(template,{...context,...promptTemplateChat([{role:'user',message:'继续普通剧情'}])}).trim(),'');
 const bad=exitPromptData(fixture(),exitExtra('other-chat','run-A',status,'错误上下文'));assert.equal(renderEjs(template,{...context,...promptTemplateVariables([{role:'user',message:EXIT_REQUEST,data:bad}],book)}).trim(),'');
});

test('024 all 432 runtime IDs resolve to their actual source-art design IDs; 128 legacy bindings do not go blank',()=>{
 const mismatches=MONSTER_ROSTER.filter(m=>m.id!==m.designId);assert.equal(mismatches.length,128);
 const manifest=JSON.parse(readFileSync('../16-Godot可玩区域/godot/monsters/manifest.json','utf8'));const assets=new Map(manifest.characters.map((x:any)=>[x.id,x]));
 for(const m of MONSTER_ROSTER){const id=enemyArtId({id:'enemy-0'},[{id:'enemy-0'}],[m.id]);assert.equal(id,m.designId);assert.equal((assets.get(id) as any)?.name,m.name);}
 assert.equal(enemyArtId({id:'child',owner:'enemy-0'},[{id:'enemy-0'},{id:'child',owner:'enemy-0'}],['T17_N01']),'T17_01');
});
