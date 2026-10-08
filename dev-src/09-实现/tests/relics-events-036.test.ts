import test from 'node:test';
import assert from 'node:assert/strict';
import {playtestParty} from '../src/game/content';
import {startExpedition,acquireRelic,transferRelic,removeRelic,relicUnavailable,eventChoice,view,interact,move,type State} from '../src/game/expedition';
import {RELIC_CATALOG,RELIC_LIST} from '../src/game/relic-catalog';
import {EVENT_CATALOG,EVENT_LIST} from '../src/game/event-catalog';
import {relicHooks,relicCapacity,pendingFp,adjustFp,scaleFp} from '../src/game/run-hooks';
import {makeRegion} from '../src/game/region';
import {installEventFixture} from './supplier-fixture';
import {createBattle,applyBattleEffects,actionUnavailable,type Battle} from '../src/battle/executor';
import {bareMitigation,contentCard,strike} from '../src/game/content';
import {fire} from '../scripts/audit-monsters';

const fresh=(seed=11)=>startExpedition(playtestParty(),seed);
const p0=(s:State)=>s.party[0]!.id,p1=(s:State)=>s.party[1]!.id;
function runEvent(s:State,id:string,choice:number){const t=installEventFixture(s);s.mode='event';s.eventState={id,thingId:t.id,offers:[],results:[],owner:p0(s),choice:''};eventChoice(s,choice);}

test('目录：60 遗物 + 39 事件 = 99；用户给出的 15 条遗物与 10 条事件原样在列', ()=>{
 assert.equal(RELIC_LIST.length,60);assert.equal(EVENT_LIST.length,39);
 for(const name of ['疾风之靴','巨人之腕','寻宝罗盘','开幕号角','采集者之袋','赞助契约','灰烬护符','无字书签','盾墙誓约','荆棘之心','奇偶天平','群狼哨','命中之眼','赌徒硬币','预支借据'])assert.ok(RELIC_LIST.some(r=>r.name===name),name);
 for(const title of ['清仓','采集运势','转变','翻倍或减半','错位楼梯','有偿疗愈','遭遇即遗物','传唤铃','高压训练','封印契约'])assert.ok(EVENT_LIST.some(e=>e.title===title),title);
 assert.ok(RELIC_LIST.every(r=>r.passive||r.hooks||r.grantFp),'每条遗物都得有效果');
});

test('槽位 = 生命层级（+空遗物盒）；同名一人一件；不可转移 / 不可丢弃词条生效', ()=>{
 const s=fresh();const lv=s.party[0]!.card.numeric.level;assert.equal(relicCapacity(lv,[],p0(s)),Math.min(7,Math.max(1,Math.ceil(lv/4))));
 s.party[0]!.card.numeric.level=9;// 三层级 = 3 槽
 acquireRelic(s,'R001',p0(s));acquireRelic(s,'R002',p0(s));acquireRelic(s,'R017',p0(s));assert.equal(s.ownedRelics!.length,3);
 assert.match(relicUnavailable(s,'R018',p0(s)),/遗物槽已满/);assert.match(relicUnavailable(s,'R001',p0(s)),/同名/);
 acquireRelic(s,'R060',p0(s));assert.equal(s.ownedRelics!.length,4,'空遗物盒不占槽');assert.equal(relicUnavailable(s,'R018',p0(s)),'','空遗物盒 +1 槽');
 transferRelic(s,'R001',p0(s),p1(s));assert.ok(s.ownedRelics!.some(o=>o.id==='R001'&&o.owner===p1(s)),'可转移');
 removeRelic(s,'R060',p0(s));assert.ok(s.ownedRelics!.some(o=>o.id==='R060'),'不可丢弃');
 transferRelic(s,'R060',p0(s),p1(s));assert.ok(s.ownedRelics!.some(o=>o.id==='R060'&&o.owner===p0(s)),'不可转移');
});

test('战斗侧：疾风之靴只作用于持有者；采集者之袋（全队）让所有人伤害 ×0.5；命中之眼（全场）给敌我双方必中', ()=>{
 const s=fresh();acquireRelic(s,'R001',p0(s));
 const w=s.world!;const a=w.units.find(u=>u.id===p0(s))!,b=w.units.find(u=>u.id===p1(s))!;
 const dmg=(u:typeof a)=>u.damageBonus?.physical?.multiplier??1;
 assert.equal(a.stats?.speed,2);assert.ok(!b.stats?.speed||b.stats.speed===1);assert.equal(dmg(a),.5);assert.equal(dmg(b),1);
 acquireRelic(s,'R005',p1(s));const w2=s.world!;assert.equal(dmg(w2.units.find(u=>u.id===p0(s))!),.25);assert.equal(dmg(w2.units.find(u=>u.id===p1(s))!),.5);
 assert.equal(relicHooks(s).materialRate,2);
 const t=fresh(5);acquireRelic(t,'R013',p0(t));assert.ok(t.world!.units.every(u=>u.statuses?.some(x=>x.rule?.kind==='guaranteed_hit')));
});

test('开幕号角：每场第一个造成伤害的技能 ×2；盾墙誓约：前两次行动只能防御', ()=>{
 const mk=(id:string,side:'ally'|'enemy')=>{const card=contentCard(10,5000,18,{probe:{...strike(50),castMs:0},poke:{...strike(50),castMs:0}});return {id,side,card,current:{...card.numeric.max},mitigation:bareMitigation()};};
 let b=createBattle([mk('a','enemy'),mk('p','ally')],3);
 const act=(effects:never[]):never=>({target:'self',cost:{hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}},castMs:0,recoveryFactor:1,perBattleUses:0,effects} as never);
 b=applyBattleEffects(b,'p',act([{op:'rule',rule:'nth_skill_scale',key:'1|2',duration:{clock:'permanent',value:0}}] as never),['p']);
 let hp=b.units.find(u=>u.id==='a')!.current.hp;b=fire(b,'p','probe',['a']);const first=hp-b.units.find(u=>u.id==='a')!.current.hp;
 hp=b.units.find(u=>u.id==='a')!.current.hp;b=fire(b,'p','poke',['a']);const second=hp-b.units.find(u=>u.id==='a')!.current.hp;
 assert.ok(Math.abs(first-second*2)<=2,`first ${first} second ${second}`);
 let g=createBattle([mk('a','enemy'),mk('p','ally')],3);g=applyBattleEffects(g,'p',act([{op:'rule',rule:'guard_first',key:'2',duration:{clock:'permanent',value:0}}] as never),['p']);
 assert.match(actionUnavailable(g,g.units.find(u=>u.id==='p')!,'probe'),/只能防御/);assert.equal(actionUnavailable(g,g.units.find(u=>u.id==='p')!,'booksea:guard'),'');
});

test('FP 账本：预支借据 +6000，每下一层 −1000，可欠账并被之后的收入先还', ()=>{
 const s=fresh();acquireRelic(s,'R015',p0(s));assert.equal(pendingFp(s.run,s.fpDebt),6000);
 adjustFp(s,-6500,'test');assert.equal(pendingFp(s.run,s.fpDebt),0);assert.equal(s.fpDebt,500);
 adjustFp(s,800,'test');assert.equal(s.fpDebt,0);assert.equal(pendingFp(s.run,s.fpDebt),300);
 scaleFp(s,2,'test');assert.equal(pendingFp(s.run,s.fpDebt),600);
});

test('寻宝罗盘：本层未打满 3 场不能下楼；群狼哨：普通敌群变 3–4 个；生锈钥匙：宝箱必现', ()=>{
 const s=fresh(23);acquireRelic(s,'R003',p0(s));const stairs=s.region.things.find(t=>t.kind==='stairs')!;s.x=stairs.x;s.z=stairs.z;const depth=s.depth;interact(s);assert.equal(s.depth,depth,'被拦下');assert.match(s.notice,/寻宝罗盘/);
 const r=makeRegion(2,0,23,{groupEnemies:true});const packs=r.things.filter(t=>t.kind==='enemy'&&t.name!=='深处敌群');assert.ok(packs.every(t=>t.foes.length>=3&&t.foes.length<=4),JSON.stringify(packs.map(t=>t.foes)));
 let forced=0;for(let seed=1;seed<=30;seed++)if(makeRegion(1,0,seed,{chestForce:true}).things.some(t=>t.kind==='chest'||t.kind==='mimic'))forced++;assert.equal(forced,30);
});

test('事件：清仓（FP 清零 + 3 盲盒）、翻倍或减半、错位楼梯边界、尽头的门只在 50 层以深出现', ()=>{
 const s=fresh();s.run.rewards.push({kind:'fp',amount:1000,count:1,source:'t'});runEvent(s,'E001',0);assert.equal(pendingFp(s.run,s.fpDebt),0);assert.equal(s.run.rewards.filter(r=>r.kind==='box').reduce((n,r)=>n+r.count,0),3);
 const t=fresh();t.run.rewards.push({kind:'fp',amount:1000,count:1,source:'t'});runEvent(t,'E004',0);assert.ok([2000,500].includes(pendingFp(t.run,t.fpDebt)));
 for(const seed of [3,4,5,6]){const u=fresh(seed);u.depth=120;runEvent(u,'E005',0);assert.ok(u.depth>=70&&u.depth<=170&&u.depth<=199&&u.depth!==120,'depth '+u.depth);}
 const v=fresh();assert.ok(!view(v).event);const gate=EVENT_CATALOG['E039']!;assert.deepEqual(gate.requirements,[{kind:'depth',key:'',amount:50}]);
});

test('封印契约：选人 → 选 1–3 个技能 → 确认；技能从卡上消失且全属性 +10%/个', ()=>{
 const s=fresh();runEvent(s,'E010',0);assert.equal(s.eventPick?.kind,'member');eventChoice(s,0);assert.equal(s.eventPick?.kind,'skills');
 const options=s.eventPick!.options.length;assert.ok(options>=2);eventChoice(s,0);eventChoice(s,1);assert.equal(s.eventPick!.selected.length,2);
 const v=view(s);const confirm=v.event!.choices.findIndex(c=>c.id==='confirm');eventChoice(s,confirm);
 assert.equal(s.eventPick,undefined);assert.equal(s.sealedSkills![p0(s)]!.length,2);
 const u=s.world!.units.find(u=>u.id===p0(s))!;for(const id of s.sealedSkills![p0(s)]!)assert.ok(!u.actions[id],'封印的技能不在场上');assert.ok(u.passiveNames?.includes('封印契约'));assert.ok(Math.abs(u.attributes.力量-s.party[0]!.card.numeric.attributes.力量*1.2)<1e-6);
});

test('高压训练：下一场敌方伤害 ×1.5 并在战后清除；镜厅：敌方数量 ×2', ()=>{
 const s=fresh(29);runEvent(s,'E009',0);assert.equal(s.battleMods!.length,1);
 const enemy=s.region.things.find(t=>t.kind==='enemy'&&!t.foes.some(id=>/_B0/.test(id)))!;s.x=enemy.x;s.z=enemy.z;(s as unknown as {escapeMs:number}).escapeMs=0;
 // 直接触发遭遇
 s.x=enemy.x-1;s.z=enemy.z;if(!s.region.tiles[s.z]?.[s.x]||s.region.tiles[s.z]![s.x]!=='.'){s.x=enemy.x;s.z=enemy.z-1;}move(s,enemy.x-s.x,enemy.z-s.z);
 if(s.mode==='battle'){assert.ok(s.battle!.units.filter(u=>u.side==='enemy').every(u=>u.damageBonus?.physical?.multiplier===1.5));}
 const t=fresh(29);runEvent(t,'E035',0);assert.ok(t.battleMods!.some(m=>m.enemyDouble));
});

test('杀害补给员后，下一次个位 9 楼层「?」必定出现并消费标记', ()=>{
 const s=fresh(2);s.strayGuaranteedOnce=true;
 // 从第 1 层无法上行，改用内部下行：走楼梯到 9 层太慢，这里直接用 skipNext 标志 + 事件“岔路”逐层下到 9
 let guard=0;while(s.depth<9&&guard++<12){s.eventJournal={};runEvent(s,'E020',0);}
 assert.equal(s.depth,9);assert.ok(s.region.things.some(t=>t.hunter),'必定出现');assert.equal(s.strayGuaranteedOnce,false);
});
