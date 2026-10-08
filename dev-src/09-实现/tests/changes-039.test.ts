/** 0.39 四项修改：攻击可选被魅惑敌人/任意单体、群体攻击命中被魅惑敌人；迷宫内共享背包；「?」去掉检定必成功并降刷新率；商店「死亡不掉落」。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {withIndependentApi} from '../src/host/game-session';
import {EMPTY_LIBRARY,type ActionSpec,type EffectSpec,type StatusSpec} from '../src/compiler/contract';
import {createBattle,applyBattleEffects,legalTargets,type Battle} from '../src/battle/executor';
import {decide} from '../src/game/combat-ai';
import {card,zero,flat,mitigation} from './compiler-fixtures';
import {STRAY_SPAWN_CHANCE,strayKit} from '../src/game/monsters/stray';
import {playtestParty} from '../src/game/content';
import {startExpedition,supplierChoice,view,useOutsideBattle,type State} from '../src/game/expedition';
import {exitMembers,addReward,settlementProposal,keepsGains,type Run} from '../src/core/run';
import {failureNotice} from '../src/core/failure';
import {INSURANCE} from '../src/game/run-hooks';
import {supplierSpawns} from '../src/game/supplier';

const duration={clock:'permanent' as const,value:0};
const zeroCost={hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}};
const action=(effects:EffectSpec[],target:ActionSpec['target']='self',targeting?:ActionSpec['targeting']):ActionSpec=>({target,cost:zeroCost,castMs:0,recoveryFactor:1,perBattleUses:0,effects,...(targeting?{targeting}:{})});
const hit=(n:number,targeting?:Extract<EffectSpec,{op:'damage'}>['targeting']):Extract<EffectSpec,{op:'damage'}>=>({op:'damage',amounts:{physical:zero(),energy:zero(),mental:zero(),true:flat(n)},element:'none',hitChance:1,hitRule:'guaranteed',critChance:0,critMultiplier:1,...(targeting?{targeting}:{})});
const status=(name:string,extra:Partial<StatusSpec>={}):StatusSpec=>({name,tags:[name],polarity:'negative',duration,stack:'refresh',maxStacks:1,scaleWithStacks:true,priority:0,dispellable:true,removeOnDeath:false,scope:'battle',...extra});
const charmAct=()=>({...action([{op:'apply_status',status:'charm'}],'enemy'),library:{...EMPTY_LIBRARY(),statuses:{charm:status('charm',{control:'charm',duration:{clock:'round',value:3}})}}});
const single=()=>action([hit(100)],'enemy',{side:'enemy',selection:'manual',count:1,life:'alive'});
const group=()=>action([hit(100,{side:'enemy',selection:'all',life:'alive'})],'enemy',{side:'enemy',selection:'all',life:'alive'});
const heal=()=>action([{op:'heal',resource:'hp',amount:{...flat(10),subject:'target'}} as EffectSpec],'ally',{side:'ally',selection:'manual',count:1,life:'alive'});
function battle():Battle{
 const e=(id:string,side:'ally'|'enemy')=>{const c=card();c.numeric.level=20;c.numeric.max={hp:1e5,mp:1e3,sp:1e3};return {id,side,card:c,current:{...c.numeric.max},mitigation:mitigation()};};
 const b=createBattle([e('p0','ally'),e('p1','ally'),e('e0','enemy'),e('e1','enemy')],7);
 return applyBattleEffects(b,'p0',charmAct(),['e0']);
}
const unit=(b:Battle,id:string)=>b.units.find(u=>u.id===id)!;
const ids=(units:{id:string}[])=>units.map(u=>u.id).sort();

test('0.39 单体攻击：可以选任意单体（被魅惑的敌人、友方），不含自己；非攻击的同伴技能不变',()=>{
 const b=battle();
 assert.ok(unit(b,'e0').statuses!.some(s=>s.definition.control==='charm'),'夹具：e0 已被魅惑');
 assert.deepEqual(ids(legalTargets(b,unit(b,'p0'),single())),['e0','e1','p1']);
 assert.deepEqual(ids(legalTargets(b,unit(b,'p0'),heal())),['e0','p0','p1'],'治疗仍按当前阵营（被魅惑者暂属我方）');
 // 实际打到被魅惑的敌人。
 const before=unit(b,'e0').current.hp;const after=applyBattleEffects(b,'p0',single(),['e0']);
 assert.ok(unit(after,'e0').current.hp<before,'被魅惑的敌人吃到单体攻击');
 // 友方同样可以被单体攻击选中并命中。
 const ff=applyBattleEffects(b,'p0',single(),['p1']);assert.ok(unit(ff,'p1').current.hp<unit(b,'p1').current.hp,'友方被单体攻击命中');
});

test('0.39 群体攻击：同样命中被暂时魅惑的敌方单位，不打自己人',()=>{
 const b=battle();
 const after=applyBattleEffects(b,'p0',group(),[]);
 assert.ok(unit(after,'e0').current.hp<unit(b,'e0').current.hp,'被魅惑的敌人吃到群体攻击');
 assert.ok(unit(after,'e1').current.hp<unit(b,'e1').current.hp);
 assert.equal(unit(after,'p0').current.hp,unit(b,'p0').current.hp);
 assert.equal(unit(after,'p1').current.hp,unit(b,'p1').current.hp);
});

test('0.39 AI 不会因为“单体可选任意目标”去打自己的队友',()=>{
 const b=battle();const u=unit(b,'e1');u.actions={strike:single()};
 for(let i=0;i<20;i++){const d=decide(b,u);if(d.skill==='strike')assert.ok(['p0','p1','e0'].includes(d.targets[0]!),'只打敌对目标（含被魅惑过去的 e0）');}
});

test('0.39「?」：刷新率 33%，本质里不再有“检定必成功”',()=>{
 assert.equal(STRAY_SPAWN_CHANCE,.33);
 const s=startExpedition(playtestParty(),5);const kit=strayKit(20,s.party.map(p=>p.card));
 const rules=Object.values(kit.card.skills).flatMap((k:any)=>[k.mapping?.action,...(k.mapping?.actions??[])]).filter(Boolean).flatMap((a:ActionSpec)=>a.effects);
 assert.equal(rules.some((e:EffectSpec)=>e.op==='rule'&&e.rule==='luck'),false);
 assert.ok(rules.some((e:EffectSpec)=>e.op==='rule'&&e.rule==='immune_status'),'其余本质保留');
});

function hostRun():State{
 // 与宿主入场相同：道具技能先装到携带者卡上（item-序号-序号），startExpedition 之后才写 inventory。
 const party=playtestParty().slice(0,2);const owner=party[0]!;const src=owner.card.skills.find(k=>k.mapping.disposition==='active'&&k.mapping.action)!;
 const item=structuredClone(src);item.sourceId='item-0-0';item.mapping.sourceId='item-0-0';item.name='测试药剂';item.mapping.action=heal();
 owner.card.skills.push(item);const s=startExpedition(party,99);
 s.inventory={'item-0-0':{owner:{kind:'partner',name:owner.id},name:'测试药剂',actorId:owner.id,remaining:2,used:0}};
 return s;
}
test('0.39 迷宫内共享背包：别人携带的道具也出现在每名成员的道具里，名称正确、数量共用',()=>{
 const s=hostRun();const user=s.party[1]!.id;
 useOutsideBattle(s,user,'item-0-0',[user]);
 assert.equal(s.inventory!['item-0-0']!.remaining,1,'非携带者使用后共用数量减少');assert.equal(s.inventory!['item-0-0']!.used,1,'消耗记在携带者条目上');
 const v=view(s);
 for(const p of v.party){const a=p.outsideActions.find(x=>x.id==='item-0-0');assert.ok(a,p.id+' 能用共享道具');assert.equal(a!.name,'测试药剂');}
});

function shopState(){
 let seed=1;for(;seed<10000;seed++)if(supplierSpawns(1,0,seed))break;
 const s=startExpedition(playtestParty(),seed);const t=s.region.things.find(t=>t.kind==='supplier')!;s.x=t.x;s.z=t.z;s.mode='supplier';s.supplierState={thingId:t.id};s.shopPage=true;return s;
}
test('0.39 商店「死亡不掉落」：3000 FP、限购一次、FP 不足买不了',()=>{
 const s=shopState();assert.equal(INSURANCE.price,3000);
 const label=view(s).supplier!.choices.find(c=>c.id==='buy:'+INSURANCE.id)!;assert.ok(label.label.includes('3000 FP'));
 supplierChoice(s,'buy:'+INSURANCE.id);assert.equal(s.run.keepOnDefeat,undefined,'FP 不足');
 s.run.rewards.push({kind:'fp',amount:3500,count:1,source:'测试'});
 supplierChoice(s,'buy:'+INSURANCE.id);assert.equal(s.run.keepOnDefeat,true);
 const fp=s.run.rewards.reduce((n,r)=>n+(r.kind==='fp'?r.amount*r.count:0),0)-(s.fpDebt??0);assert.equal(fp,500);
 supplierChoice(s,'buy:'+INSURANCE.id);assert.equal(s.run.rewards.reduce((n,r)=>n+(r.kind==='fp'?r.amount*r.count:0),0)-(s.fpDebt??0),500,'不重复扣');
 assert.ok(view(s).supplier!.choices.find(c=>c.id==='buy:'+INSURANCE.id)!.label.includes('已购买'));
});

function wiped(keep:boolean):Run{
 const ref=(name:string)=>({kind:'partner' as const,name});
 let run:Run={id:'run-x',status:'active',battleActive:false,participants:[{ref:ref('A'),entryLevel:3,status:'active',battles:[],experience:40},{ref:ref('B'),entryLevel:3,status:'active',battles:[],experience:30}],battleIds:[],defeatedIds:[],rewards:[],unlocks:[],failureSignal:null,...(keep?{keepOnDefeat:true}:{})};
 run=addReward(run,{kind:'fp',amount:120,count:1,source:'战斗'});
 run=exitMembers(run,[{ref:ref('A'),reason:'downedExit'}]);
 return exitMembers(run,[{ref:ref('B'),reason:'downedExit'}]);
}
test('0.39 买了「死亡不掉落」：全灭仍是失败离场（复活交接不变），但经验与掉落全部保留结算',()=>{
 const plain=wiped(false);assert.equal(plain.status,'failed');assert.equal(plain.rewards.length,0);assert.equal(keepsGains(plain),false);
 const kept=wiped(true);assert.equal(kept.status,'failed');assert.ok(kept.failureSignal);
 assert.deepEqual(kept.participants.map(p=>p.experience),[40,30]);assert.equal(kept.rewards.length,1);assert.equal(keepsGains(kept),true);
 const proposal=settlementProposal(kept);assert.equal(proposal.keptOnDefeat,true);assert.deepEqual(proposal.experience.map(x=>x.amount),[40,30]);assert.equal(proposal.rewards.length,1);
 const notice=failureNotice(kept,{depth:3,encounter:'测试',consumed:[]});assert.ok(notice.directive.includes('死亡不掉落'));assert.ok(!notice.directive.includes('按失败规则清空'));
 assert.ok(failureNotice(plain,{depth:3,encounter:'测试',consumed:[]}).directive.includes('按失败规则清空'));
});

test('0.39 独立API：读者独立API启用时合并 custom_api，未设置或停用时保持原请求', () => {
  const store = new Map<string, string>();
  const g = {localStorage: {getItem: (k: string) => store.get(k) ?? null}};
  const base = {custom_api: {max_tokens: 16384, temperature: 0}, should_stream: false};
  assert.equal(withIndependentApi(g, base), base);
  store.set('dream_independent_api_v1', JSON.stringify({apiurl: 'https://x.example/v1', key: 'k', model: 'm', source: 'openai', enabled: true}));
  assert.deepEqual(withIndependentApi(g, base), {...base, custom_api: {max_tokens: 16384, temperature: 0, apiurl: 'https://x.example/v1', key: 'k', model: 'm', source: 'openai'}});
  assert.deepEqual(withIndependentApi({parent: g}, base).custom_api, {max_tokens: 16384, temperature: 0, apiurl: 'https://x.example/v1', key: 'k', model: 'm', source: 'openai'});
  store.set('dream_independent_api_v1', JSON.stringify({apiurl: 'https://x.example/v1', model: 'm', enabled: false}));
  assert.equal(withIndependentApi(g, base), base);
  store.set('dream_independent_api_v1', JSON.stringify({apiurl: '', model: 'm'}));
  assert.equal(withIndependentApi(g, base), base);
});
