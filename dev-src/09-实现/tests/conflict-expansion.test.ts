import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattle,applyBattleEffects,advanceBattle,chooseAction,resolveAction,actionUnavailable,isAlive,type Battle} from '../src/battle/executor';
import {winsConflict,orderClaims} from '../src/battle/conflict';
import {validateAction,EMPTY_LIBRARY,ROUND_MS,type ActionSpec,type EffectSpec,type StatusSpec} from '../src/compiler/contract';
import {card,flat,zero,mitigation} from './compiler-fixtures';
const C=(constant:number)=>[{constant}];
const expression=(tokens:any[])=>({...zero(),expression:tokens});
const duration={clock:'permanent' as const,value:0};
const rounds=(value:number)=>({clock:'round' as const,value});
const self={side:'self' as const,selection:'manual' as const,life:'any' as const};
const action=(effects:EffectSpec[],target:ActionSpec['target']='enemy'):ActionSpec=>({target,cost:{hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}},castMs:0,recoveryFactor:1,perBattleUses:0,effects});
const hit=(n:number):Extract<EffectSpec,{op:'damage'}>=>({op:'damage',amounts:{physical:zero(),energy:zero(),mental:zero(),true:flat(n)},element:'none',hitChance:1,hitRule:'guaranteed',critChance:0,critMultiplier:1});
const status=(name:string,extra:Partial<StatusSpec>={}):StatusSpec=>({name,tags:[name],polarity:'positive',duration,stack:'refresh',maxStacks:32,scaleWithStacks:true,priority:0,dispellable:true,removeOnDeath:false,scope:'battle',...extra});
function initial(levels=[10,10],allies=1):Battle{
 return createBattle(levels.map((level,i)=>{const c=card();c.numeric.level=level;c.numeric.max={hp:1000,mp:1000,sp:1000};return {id:'u'+i,name:'member'+i,side:i<allies?'ally' as const:'enemy' as const,card:c,current:{hp:1000,mp:1000,sp:1000},mitigation:mitigation()};}),17);
}
function apply(b:Battle,a:ActionSpec,caster='u0',targets=['u1'],key='test'){return applyBattleEffects(b,caster,validateAction(a),targets,'effect',key);}
function grant(b:Battle,d:StatusSpec,owner='u1',actions:Record<string,ActionSpec>={},caster=owner){const a=action([{op:'apply_status',status:d.name}]);a.targeting={side:'any',selection:'manual',life:'any'};a.library={...EMPTY_LIBRARY(),statuses:{[d.name]:d},actions};return apply(b,a,caster,[owner],d.name);}
function cast(b:Battle,a:ActionSpec,caster='u0',target='u1',key='spell'){
 b=structuredClone(b);const u=b.units.find(x=>x.id===caster)!;u.actions[key]=validateAction(a);if(a.library)Object.assign(u.library!.actions,a.library.actions),Object.assign(u.library!.statuses,a.library.statuses);
 b.clock.units.find(x=>x.id===caster)!.atb=100;b.clock.pending=[{kind:'ready',unitId:caster}];return resolveAction(chooseAction(b,caster,key,target));
}
function idle(b:Battle,ms:number){b=structuredClone(b);b.clock.pending=[];for(const u of b.clock.units)u.active=false;return advanceBattle(b,ms).battle;}
function rule(b:Battle,kind:Extract<EffectSpec,{op:'rule'}>['rule'],owner='u1',extra:Partial<Extract<EffectSpec,{op:'rule'}>>={},caster=owner){const a=action([{op:'rule',rule:kind,key:'*',duration,...extra}]);a.targeting={side:'any',selection:'manual',life:'any'};return apply(b,a,caster,[owner],kind);}

for(const [higher,lower] of [[24,23],[2,1],[25,5]] as const)test(`仲裁 等级${higher}压过${lower}，数值priority不能越级`,()=>{
 let b=rule(initial([higher,lower]),'death_guard','u1',{priority:1000000,amount:flat(1)});
 b=apply(b,action([{...hit(10000),execute:true,priority:-1000000}]));assert.equal(b.units[1]!.current.hp,0);assert.ok(b.units[1]!.deathSeal);
});
test('仲裁 高等级免死保1HP并触发一轮无敌，低等级绝杀不会留下复活封锁',()=>{
 let b=initial([9,10]);const a=action([{op:'rule',rule:'death_guard',key:'*',duration,uses:1,amount:flat(1),onTrigger:'safe'}],'self');a.library={...EMPTY_LIBRARY(),actions:{safe:action([{op:'rule',rule:'immune_channel',key:'*',duration:rounds(1)}],'self')}};
 b=apply(b,a,'u1',['u1'],'protect');b=apply(b,action([{...hit(50000),execute:true,priority:1000000}]));assert.equal(b.units[1]!.current.hp,1);assert.equal(b.units[1]!.deathSeal,undefined);
 b=apply(b,action([hit(10000)]));assert.equal(b.units[1]!.current.hp,1);assert.ok(b.log.some(x=>x.kind==='death_guard'));
});
test('仲裁 同级使用有效速度，不用敏捷裸值或旧priority',()=>{
 let b=initial();b=apply(b,action([{op:'speed',name:'haste',multiplier:2,chance:1,duration,stack:'refresh'}],'self'),'u1',['u1']);b=rule(b,'death_guard','u1',{amount:flat(1),priority:-1000000});
 b=apply(b,action([{...hit(10000),execute:true,priority:1000000}]));assert.equal(b.units[1]!.current.hp,1);
});
test('仲裁 同级同速随机双方都有机会，保存/恢复不重掷且名册顺序不偏向',()=>{
 const wins=new Set<string>();for(let seed=0;seed<60;seed++){
  const b=initial();b.seed=seed;const claims=[{owner:'u0',priority:1000000},{owner:'u1',priority:-1000000}];const first=orderClaims(b,'same',claims)[0]!.owner;wins.add(first);const after=JSON.parse(JSON.stringify(b)) as Battle;
  assert.equal(orderClaims(after,'same',[...claims].reverse())[0]!.owner,first);assert.equal(after.seed,b.seed);
  const reordered=initial();reordered.seed=seed;reordered.units.reverse();reordered.clock.units.reverse();assert.equal(orderClaims(reordered,'same',claims)[0]!.owner,first);
 }assert.deepEqual([...wins].sort(),['u0','u1']);
});
test('仲裁 三方全序不会因随机比较产生循环',()=>{
 const b=initial([10,10,10]);const claims=['u0','u1','u2'].map(owner=>({owner})),ordered=orderClaims(b,'triple',claims);
 for(let i=0;i<ordered.length;i++)for(let j=i+1;j<ordered.length;j++)assert.ok(winsConflict(b,'triple',ordered[i]!,ordered[j]!));
});
test('仲裁 盟友授予的护佑按真实施加者等级，而不是受护者等级',()=>{
 let b=rule(initial([20,2,24],2),'death_guard','u1',{amount:flat(1)},'u2');b=apply(b,{...action([{...hit(10000),execute:true}]),targeting:{side:'any',selection:'manual'}},'u0',['u1']);assert.equal(b.units[1]!.current.hp,1);
});
for(const [a,d,hitExpected] of [[11,10,true],[10,11,false]] as const)test(`仲裁 必中${a}/必闪${d}`,()=>{
 let b=rule(initial([a,d]),'guaranteed_evade','u1',{uses:1,priority:1000000});b=apply(b,action([hit(100)]));assert.equal(b.units[1]!.current.hp<1000,hitExpected);
});
test('仲裁 低级巨priority复活和回溯不能绕过高级处决',()=>{
 let b=initial([20,10]);b=apply(b,action([{op:'time',mode:'snapshot',key:'life',restore:['resources']}],'self'),'u1',['u1']);b=apply(b,action([{...hit(10000),execute:true}]));
 const r=action([{op:'revive',amount:flat(500),priority:1000000}],'self');r.targeting=self;b=apply(b,r,'u1',['u1']);assert.equal(b.units[1]!.current.hp,0);
 const rewind=action([{op:'time',mode:'rewind',key:'life',restore:['resources'],priority:1000000}],'self');rewind.targeting=self;b=apply(b,rewind,'u1',['u1']);assert.equal(b.units[1]!.current.hp,0);
});
test('仲裁 低级强制状态不能越过高级免疫；高级强制状态可突破',()=>{
 const curse=action([{op:'apply_status',status:'curse',priority:1000000}]);curse.library={...EMPTY_LIBRARY(),statuses:{curse:status('curse',{polarity:'negative'})}};
 let b=rule(initial([10,20]),'immune_status','u1',{key:'negative',priority:-1000000});b=apply(b,curse);assert.equal(b.units[1]!.statuses!.some(x=>x.definition.name==='curse'),false);
 b=rule(initial([20,10]),'immune_status','u1',{key:'negative',priority:1000000});b=apply(b,curse);assert.equal(b.units[1]!.statuses!.some(x=>x.definition.name==='curse'),true);
});
test('仲裁 不可驱散状态与强制净化仍按等级；普通净化不碰无许可状态',()=>{
 let b=grant(initial([10,20]),status('immutable',{dispellable:false,priority:-1000000}));b=apply(b,action([{op:'dispel',mode:'remove',polarity:'any',includeUndispellable:true,priority:1000000}]));assert.ok(b.units[1]!.statuses!.some(s=>s.definition.name==='immutable'));
 b=grant(initial([20,10]),status('immutable',{dispellable:false,priority:1000000}));b=apply(b,action([{op:'dispel',mode:'remove',polarity:'any'}]));assert.ok(b.units[1]!.statuses!.length);b=apply(b,action([{op:'dispel',mode:'remove',polarity:'any',includeUndispellable:true,priority:-1000000}]));assert.equal(b.units[1]!.statuses!.length,0);
});
test('先手 双方绝对先手按等级/速度裁定，未选择先手招不能偷用窗口',()=>{
 const open=action([hit(1)]);open.initiative='absolute';const cards=[card(open,'open'),card(open,'open')];cards[0]!.numeric.level=10;cards[1]!.numeric.level=20;
 const b=createBattle(cards.map((c,i)=>({id:'u'+i,side:i===0?'ally' as const:'enemy' as const,card:c,current:{hp:100,mp:80,sp:100},mitigation:mitigation()})),1);
 assert.equal(b.clock.timeMs,0);assert.equal(b.clock.pending[0]!.unitId,'u1');assert.match(actionUnavailable(b,b.units[1]!,'booksea:wait',['u1']),/先手窗口/);
 const next=resolveAction(chooseAction(b,'u1','open','u0'));assert.equal(next.clock.pending[0]!.unitId,'u0');
});
test('先手 随机平手结果随种子可重放，不恒定偏向盟友',()=>{
 const winners=new Set<string>();for(let seed=0;seed<30;seed++){const a=action([{op:'rule',rule:'first_strike',key:'*',duration}],'self'),cards=[card(a),card(a)];for(const c of cards)c.skills[0]!.mapping.disposition='passive';const entries=cards.map((c,i)=>({id:'u'+i,side:i===0?'ally' as const:'enemy' as const,card:c,current:{hp:100,mp:80,sp:100},mitigation:mitigation()}));const b=createBattle(entries,seed);winners.add(b.clock.pending[0]!.unitId);assert.deepEqual(b,createBattle(entries,seed));}assert.equal(winners.size,2);
});
test('随机候选 不重复选择保留实际状态定义，坏图和24段预算继续阻断',()=>{
 const a=action([{op:'choose',actions:['a','b','c'],count:2,replace:false}]);a.library={...EMPTY_LIBRARY(),actions:Object.fromEntries(['a','b','c'].map(name=>[name,action([{op:'apply_status',status:name}])])),statuses:Object.fromEntries(['a','b','c'].map(name=>[name,status(name,{polarity:'negative'})]))};
 const initialBattle=initial(),b=apply(initialBattle,a);assert.equal(new Set(b.units[1]!.statuses!.map(s=>s.definition.name)).size,2);assert.deepEqual(b,apply(initialBattle,a));
 assert.throws(()=>validateAction({...a,effects:[{op:'choose',actions:['a'],count:2,replace:false}]}),/超过/);
 const huge=action([{op:'choose',actions:['x','y'],count:2,replace:false}]);huge.library={...EMPTY_LIBRARY(),actions:{x:action([{...hit(1),hits:13}]),y:action([{...hit(1),hits:13}])}};assert.throws(()=>validateAction(huge),/24段/);
});
function linked(){let b=initial([10,10,10,10],3);const a=action([{op:'link',mode:'life',key:'trio',members:{side:'ally',selection:'all',names:['member0','member1','member2'],life:'any'},minimumMembers:3,delayRounds:1,recovery:{hp:.5,mp:.5,sp:.5},cleanse:true,duration}],'self');return apply(b,a,'u0',['u0'],'trio');}
test('生命链接 成员之一倒地时下个公共轮清负面并恢复三资源各50%',()=>{
 let b=linked();b=grant(b,status('poison',{polarity:'negative'}),'u1');b=apply(b,action([hit(2000)]),'u3',['u1']);assert.equal(b.units[1]!.current.hp,0);b=idle(b,ROUND_MS);assert.deepEqual(b.units[1]!.current,{hp:500,mp:500,sp:500});assert.ok(!b.units[1]!.statuses!.some(s=>s.definition.name==='poison'));
});
test('生命链接 全员同时倒地不无限等待复活，结算为失败',()=>{
 let b=linked();const a=action([hit(2000)]);a.targeting={side:'enemy',selection:'all'};b=apply(b,a,'u3',['u0']);b=idle(b,ROUND_MS);assert.equal(b.outcome,'defeat');assert.deepEqual(b.lifeLinks![0]!.pending,{});
});
test('生命链接 暂停/存档不推进；拆链接后不残留复活任务',()=>{
 let b=linked();b=apply(b,action([hit(2000)]),'u3',['u1']);const saved=JSON.parse(JSON.stringify(b));saved.clock.paused=true;assert.equal(advanceBattle(saved,ROUND_MS).consumedMs,0);assert.deepEqual(idle(b,ROUND_MS),idle(JSON.parse(JSON.stringify(b)),ROUND_MS));
 b.units[3]!.level=25;b=apply(b,{...action([{op:'link',mode:'sever',key:'*',duration}]),targeting:{side:'enemy',selection:'manual',life:'any'}},'u3',['u1']);assert.equal(b.lifeLinks!.length,0);b=idle(b,ROUND_MS);assert.equal(b.units[1]!.current.hp,0);
});
test('零血不死 0HP仍存活/能作为存活目标，不提前结算或触发死亡',()=>{
 let b=rule(initial(),'undying','u1',{duration:rounds(2)});b=apply(b,action([hit(5000)]));assert.equal(b.units[1]!.current.hp,0);assert.equal(isAlive(b.units[1]!),true);assert.equal(b.units[1]!.deadHandled,undefined);assert.equal(actionUnavailable(b,b.units[1]!,'booksea:wait',['u1']),'');
 b=idle(b,ROUND_MS);assert.equal(b.outcome,'active');b=idle(b,ROUND_MS);assert.equal(b.outcome,'victory');
});
test('零血不死 到期动作先恢复50%HP，再进行最终死亡判定',()=>{
 let b=initial();b=grant(b,status('song',{duration:rounds(2),onExpire:'recover'}),'u1',{recover:action([{op:'heal',resource:'hp',amount:{...zero(),maxResource:'hp',maxFraction:.5,subject:'target'}}],'self')});b=rule(b,'undying','u1',{duration:rounds(2)});b=apply(b,action([hit(5000)]));b=idle(b,2*ROUND_MS);assert.equal(b.units[1]!.current.hp,500);assert.equal(b.outcome,'active');assert.equal(b.log.some(x=>x.kind==='down'),false);
});
test('零血不死 高等级绝杀可压过不死规则，不能残留伪存活标记',()=>{
 let b=rule(initial([20,10]),'undying','u1',{duration:rounds(2)});b=apply(b,action([{...hit(5000),execute:true}]));assert.equal(isAlive(b.units[1]!),false);assert.equal(b.units[1]!.zeroHpProtected,false);
});
test('整动作回放 二段伤害和命中附效都回放，不再次扣原招MP，双反射不递归',()=>{
 let b=initial();const listener=status('mirror',{triggers:[{id:'mirror',event:'action_resolved',scope:'self',action:'bounce',uses:1}]});const mirror=action([{op:'replay',originalStats:true,targeting:{side:'event_source',selection:'manual',life:'alive'}}]);
 b=grant(b,listener,'u1',{bounce:mirror});b=grant(b,listener,'u0',{bounce:mirror});
 const a=action([{...hit(10),hits:2},{op:'apply_status',status:'burn',requiresHit:'attack'}]);a.cost.mp.flat=10;a.library={...EMPTY_LIBRARY(),statuses:{burn:status('burn',{polarity:'negative'})}};
 b=cast(b,a);assert.equal(b.units[1]!.current.hp,980);assert.equal(b.units[0]!.current.hp,980);assert.equal(b.units[0]!.current.mp,990);assert.equal(b.units[1]!.current.mp,1000);assert.ok(b.units[0]!.statuses!.some(s=>s.definition.name==='burn'));assert.ok(b.log.some(x=>x.kind==='replay_guard'));
});
function passiveBattle(){const p=action([{op:'modify',name:'innate',duration,modifiers:[{stat:'力量',flat:25}]},{op:'shield',amount:flat(70),channels:['physical'],duration}],'self');p.name='innate';p.source={id:'innate',kind:'skill',quality:'mythic'};p.grantedActions=['gift'];p.library={...EMPTY_LIBRARY(),actions:{gift:action([hit(3)])}};const cards=[card(),card(p,'innate')];cards[0]!.numeric.level=20;cards[1]!.skills[0]!.mapping.disposition='passive';return createBattle(cards.map((c,i)=>({id:'u'+i,side:i===0?'ally' as const:'enemy' as const,card:c,current:{hp:100,mp:80,sp:100},mitigation:mitigation()})),2);}
test('被动窃取 整包属性/护盾/授予动作迁移，期限到后原实例恢复不重造',()=>{
 let b=passiveBattle();assert.equal(b.units[1]!.attributes.力量,35);const steal=action([{op:'copy',mode:'passive',id:'innate',selection:'named',steal:true,duration:rounds(1)}]);b=apply(b,steal);assert.equal(b.units[1]!.attributes.力量,10);assert.equal(b.units[0]!.attributes.力量,35);assert.ok(b.units[1]!.shields[0]!.suppressed);assert.ok(Object.values(b.units[0]!.actions).some(a=>a.source?.id?.startsWith('passive-copy:')));
 const copy=Object.keys(b.units[0]!.passiveCopies!)[0]!;b=apply(b,steal);assert.equal(Object.keys(b.units[0]!.passiveCopies!).length,1);b=idle(b,ROUND_MS);assert.equal(b.units[1]!.attributes.力量,35);assert.equal(b.units[0]!.attributes.力量,10);assert.equal(b.units[1]!.shields[0]!.amount,70);assert.equal(b.units[0]!.sources![copy],undefined);
});
test('被动租约 自己到期不能误删第三方后来的封锁，也不刷新原反应次数',()=>{
 let b=passiveBattle();b=apply(b,action([{op:'copy',mode:'passive',id:'innate',steal:true,duration:rounds(1)}]));b=apply(b,action([{op:'source',mode:'suppress',id:'innate',selection:'all',duration:rounds(2)}]),'u0',['u1'],'other-lock');b=idle(b,ROUND_MS);assert.equal(b.units[1]!.attributes.力量,10);b=idle(b,ROUND_MS);assert.equal(b.units[1]!.attributes.力量,35);
});
test('克隆 指定一半HP且继承整套被动，不重复计算属性加成',()=>{
 let b=passiveBattle();const a=action([{op:'summon',mode:'clone',template:'shade',count:1}],'self');a.library={...EMPTY_LIBRARY(),actions:{poke:action([hit(1)])},summons:{shade:{name:'shade',level:'caster',inheritance:0,resources:{hp:0,mp:0,sp:0},attributes:{力量:0,敏捷:0,体质:0,智力:0,精神:0},actions:['poke'],duration,ownerDeath:'despawn',limit:1,rewardEligible:false,inheritPassives:true,cloneResources:{hp:.5,mp:1,sp:1}}}};
 b=apply(b,a,'u1',['u1']);const clone=b.units.find(x=>x.owner==='u1')!;assert.equal(clone.current.hp,50);assert.equal(clone.attributes.力量,35);assert.ok(Object.keys(clone.passives!).length);assert.ok(Object.values(clone.actions).some(a=>a.effects.some(e=>e.op==='damage')));assert.deepEqual(JSON.parse(JSON.stringify(b)),b);
});
test('品质筛选 仅拦低于神话的指向技能，范围技能/未说明品质不冒充低品质',()=>{
 const immunity={filter:{kinds:['skill' as const],maxQuality:'legendary' as const,delivery:'targeted' as const}};
 const original=rule(initial([10,20]),'immune_source','u1',immunity);const a=action([hit(100)]);a.source={id:'attack',kind:'skill',quality:'legendary'};
 let b=apply(original,a);assert.equal(b.units[1]!.current.hp,1000);b=apply(original,{...a,source:{...a.source!,quality:'mythic'}});assert.ok(b.units[1]!.current.hp<1000);
 b=apply(original,{...a,targeting:{side:'enemy',selection:'all'}});assert.ok(b.units[1]!.current.hp<1000);b=apply(original,{...a,source:{id:'attack',kind:'skill'}});assert.ok(b.units[1]!.current.hp<1000);
});
test('强制回合结束 受击后终止敌人当前多段和尾随效果，不是仅退ATB',()=>{
 let b=grant(initial(),status('stop',{triggers:[{id:'end',event:'damage_received',scope:'self',action:'end',uses:1}]}),'u1',{end:action([{op:'atb',mode:'end',value:0,targeting:{side:'event_source',selection:'manual'}}])});
 b=cast(b,action([{...hit(10),hits:3},{op:'resource',resource:'mp',mode:'subtract',amount:flat(90)}]));assert.equal(b.units[1]!.current.hp,990);assert.equal(b.units[1]!.current.mp,1000);
});
test('不可打断 高等级保证优先于低等级强制终止',()=>{
 let b=rule(initial([20,10]),'uninterruptible','u0');b=grant(b,status('stop',{triggers:[{id:'end',event:'damage_received',scope:'self',action:'end'}]}),'u1',{end:action([{op:'atb',mode:'end',value:0,priority:1000000,targeting:{side:'event_source',selection:'manual'}}])});b=cast(b,action([{...hit(10),hits:3}]));assert.equal(b.log.filter(x=>x.kind==='damage'&&x.unit==='u1').length,3);
});
test('目标锚点 邻近溅射以主目标为中心，不按施法者位置找最近敌人',()=>{
 let b=initial([10,10,10,10]);b.units[0]!.position=0;b.units[1]!.position=100;b.units[2]!.position=101;b.units[3]!.position=1;const a=action([hit(1),{...hit(7),targeting:{side:'enemy',selection:'nearest',anchor:'target',excludeSelf:true,count:1}}]);b=apply(b,a);assert.equal(b.units[2]!.current.hp,993);assert.equal(b.units[3]!.current.hp,1000);
});
test('成员查询 使用实名/标签和生存条件，不把三名特定队友变成任意三人',()=>{
 let b=initial([10,10,10],2);const a=action([{op:'counter',key:'named',mode:'set',value:[{read:'member_count',names:['member0','member1','missing'],life:'alive'}],reset:'battle'}],'self');b=apply(b,a,'u0',['u0']);assert.equal(b.units[0]!.counters!.named!.value,2);
});

test('资源抵伤 原文等额反弹只反实际消耗MP承接的部分，资源耗尽不能凭空抵伤',()=>{
 let b=grant(initial(),status('mana mirror',{reactions:[{kind:'resource_guard',resource:'mp',fraction:1,reflect:1}]}));b.units[1]!.current.mp=30;
 b=apply(b,action([hit(50)]));assert.equal(b.units[1]!.current.mp,0);assert.equal(b.units[1]!.current.hp,980);assert.equal(b.units[0]!.current.hp,970);
});
test('真实减伤 只由显式true减伤影响真实通道，普通护甲不冒充全通道减伤',()=>{
 let b=apply(initial(),action([{op:'reduction',channel:'true',fraction:.25}],'self'),'u1',['u1']);b=apply(b,action([hit(100)]));assert.equal(b.units[1]!.current.hp,925);
});
test('类型化逆状态 已声明相反模板才可翻转控制；层数、剩余时间和已用次数不重置',()=>{
 const a=action([{op:'apply_status',status:'fear'}],'self');a.library={...EMPTY_LIBRARY(),statuses:{fear:status('fear',{inverse:'courage',control:'fear',polarity:'negative',duration:rounds(3)}),courage:status('courage',{inverse:'fear',duration:rounds(3),modifiers:[{stat:'力量',flat:4}]})}};
 let b=apply(initial([20,10]),a,'u1',['u1']);b.units[1]!.statuses![0]!.remaining=2;b.units[1]!.statuses![0]!.used.once=1;
 b=apply(b,action([{op:'status_transform',mode:'invert_numeric',polarity:'negative'}]));const s=b.units[1]!.statuses![0]!;assert.equal(s.definition.name,'courage');assert.equal(s.definition.control,undefined);assert.equal(s.remaining,2);assert.equal(s.used.once,1);assert.equal(b.units[1]!.attributes.力量,14);
});
test('限定净化 只去除技能来源不死，不触碰法则来源的不死',()=>{
 let b=initial([20,10]);for(const kind of ['skill','law'] as const){const a=action([{op:'rule',rule:'undying',key:'*',duration}],'self');a.source={id:kind,kind};b=apply(b,a,'u1',['u1'],kind);}
 b=apply(b,action([{op:'dispel',mode:'remove',status:'undying:*',polarity:'any',includeUndispellable:true,filter:{kinds:['skill']}}]));assert.equal(b.units[1]!.statuses!.filter(x=>x.rule?.kind==='undying').length,1);assert.equal(b.units[1]!.statuses![0]!.sourceRoot,'law');
});
test('冲突后加入的召唤者可比较，已有双方全序不被重排',()=>{
 const b=initial();const claims=[{owner:'u0'},{owner:'u1'}];const first=orderClaims(b,'late',claims).map(x=>x.owner);const added=structuredClone(b.units[1]!);added.id='later';added.level=25;b.units.push(added);const cu=structuredClone(b.clock.units[1]!);cu.id='later';b.clock.units.push(cu);
 const order=orderClaims(b,'late',[...claims,{owner:'later'}]).map(x=>x.owner);assert.equal(order[0],'later');assert.deepEqual(order.slice(1),first);
});
test('绝杀仲裁 缓存淘汰后绝杀仍保有来源依据；低等级复活不能靠读档越级',()=>{
 let b=initial([20,10,10]);b=apply(b,action([{...hit(5000),execute:true}]));assert.ok(b.units[1]!.deathSeal?.ranking,'绝杀应保存仲裁快照');
 for(let i=0;i<260;i++)orderClaims(b,'other-'+i,[{owner:'u0'},{owner:'u2'}]);assert.equal(b.conflicts!.some(x=>x.key===String(b.units[1]!.deathSeal!.root)),false);
 const revive=action([{op:'revive',amount:flat(100),targeting:{side:'any',selection:'manual',life:'downed'}}]);revive.targeting={side:'any',selection:'manual',life:'downed'};
 const next=apply(b,revive,'u2',['u1']);assert.equal(next.units[1]!.current.hp,0);assert.deepEqual(next,apply(JSON.parse(JSON.stringify(b)),revive,'u2',['u1']));
});
test('来源封锁 已付款施法被封锁也不能在读条结束偷放，仍不自动退费',()=>{
 let b=initial([10,20]);const a=action([hit(10)]);a.cost.mp.flat=10;a.castMs=500;a.source={id:'spell',kind:'skill'};b.units[0]!.actions.spell=validateAction(a);b.units[0]!.sources!.spell={kind:'skill'};b.clock.pending=[{kind:'ready',unitId:'u0'}];b.clock.units[0]!.atb=100;b=chooseAction(b,'u0','spell','u1');
 b=apply(b,action([{op:'source',mode:'suppress',id:'spell',selection:'all',duration:rounds(1)}]),'u1',['u0']);b=advanceBattle(b,500).battle;b=resolveAction(b);assert.equal(b.units[1]!.current.hp,1000);assert.equal(b.units[0]!.current.mp,990);
});
test('生命链接 来源被封锁时不安排幽灵复活，解封后才能重新等待公共轮',()=>{
 let b=initial([10,10,20],2);const a=action([{op:'link',mode:'life',key:'group',members:{side:'ally',selection:'all',life:'any'},minimumMembers:2,duration,delayRounds:1,recovery:{hp:.5,mp:.5,sp:.5},cleanse:true}],'self');a.source={id:'link-source',kind:'skill'};b=apply(b,a,'u0',['u0']);
 b=apply(b,action([{op:'source',mode:'suppress',id:'link-source',selection:'all',duration:rounds(2)}]),'u2',['u0']);b=apply(b,action([hit(2000)]),'u2',['u1']);assert.deepEqual(b.lifeLinks![0]!.pending,{});b=idle(b,ROUND_MS);assert.equal(b.units[1]!.current.hp,0);
});
test('十五连射 前14次向同一目标发动才将最后一发升为5倍；不合并成一发',()=>{
 const a=action([{op:'repeat',action:'choose-shot',count:C(15),limit:15}]);a.library={...EMPTY_LIBRARY(),actions:{'choose-shot':action([{op:'branch',when:[{kind:'expression',expression:[{read:'event',key:'pair_attempts'}],compare:'eq',value:14}],then:'big',otherwise:'normal',targeting:{side:'enemy',selection:'random',count:1}}]),big:action([hit(50)]),normal:action([hit(10)])}};
 const b=apply(initial(),a);assert.equal(b.log.filter(x=>x.kind==='damage'&&x.unit==='u1').length,15);assert.equal(b.units[1]!.current.hp,810);
});
test('整动作反射 24段原招的回放仍完整24段，但整个反应树共享1024步预算',()=>{
 let b=grant(initial(),status('full mirror',{triggers:[{id:'m',event:'action_resolved',scope:'self',action:'bounce',uses:1}]}),'u1',{bounce:action([{op:'replay',originalStats:true,targeting:{side:'event_source',selection:'manual'}}])});b=cast(b,action([{...hit(1),hits:24}]));assert.equal(b.units[1]!.current.hp,976);assert.equal(b.units[0]!.current.hp,976);assert.equal(b.log.filter(x=>x.kind==='damage').length,48);
});
test('编译来源 性别/种族标签仅来自宿主字段，非模型捏造；改标签缓存验证失败',async()=>{
 const {createCompilationEngine}=await import('../src/compiler/engine');const {cleanSource,rules,damageAction,mapping}=await import('./compiler-fixtures');const source=cleanSource();source.性别='女';const engine=createCompilationEngine(async()=>({version:'booksea-effects/2',mappings:[mapping(damageAction())]}),rules);const result=await engine.compile(source,undefined,[]);const actor=result.actor as import('../src/compiler/engine').CompiledActor;assert.ok(actor.traits!.tags.includes('性别:女'),'宿主性别应投影成战斗标签');engine.validateSource!(actor,source);const forged=structuredClone(actor);forged.traits!.tags=['性别:男'];assert.throws(()=>engine.validateSource!(forged,source));
});
test('探索零血不死 不得退出远征，保存与重新构建世界后仍保有存活身份',async()=>{
 const {startExpedition,tickExploration,activeParty}=await import('../src/game/expedition');const {playtestParty}=await import('../src/game/content');const {persistentUnit}=await import('../src/battle/executor');const s=startExpedition(playtestParty().slice(0,1),17),id=s.party[0]!.id;let b=s.world!;
 const a=action([{op:'rule',rule:'undying',key:'*',duration:{clock:'exploration_time',value:1000},scope:'run'}],'self');b=apply(b,a,id,[id]);const damage=action([hit(50000)],'self');b=apply(b,damage,id,[id]);s.world=b;tickExploration(s,50);assert.equal(s.run.status,'active');assert.equal(activeParty(s).length,1);assert.equal(isAlive(s.world!.units[0]!),true);
 const u=s.world!.units[0]!,next=createBattle([{id,side:'ally',card:s.party[0]!.card,current:{...u.current},mitigation:mitigation(),persistent:persistentUnit(u)}],17,{exploration:true});assert.equal(isAlive(next.units[0]!),true);
});

 test('历史整技能即时借用 保留原施放者数值基础，不变成另一个回合的学习按钮',()=>{
  let b=initial();b.units[1]!.base!.attributes.力量=60;b.units[1]!.attributes.力量=60;const old=action([{...hit(0),amounts:{physical:zero(),energy:zero(),mental:zero(),true:{...zero(),attribute:'力量',factor:1}}}]);old.name='old skill';b=cast(b,old,'u1','u0','old');
  const use=action([{op:'copy',mode:'skill',id:'*',selection:'used_latest',activate:true,originalStats:true,duration:{clock:'battle_time',value:1}}]);b=cast(b,use);assert.equal(b.units[1]!.current.hp,940);assert.equal(Object.keys(b.units[0]!.copied??{}).length,0);
 });
 test('十五连射瞄准计数 不把未命中误当作没有对该目标发动',()=>{
  const a=action([{op:'repeat',action:'choose-shot',count:C(15),limit:15}]);a.library={...EMPTY_LIBRARY(),actions:{'choose-shot':action([{op:'branch',when:[{kind:'expression',expression:[{read:'event',key:'pair_attempts'}],compare:'eq',value:14}],then:'big',otherwise:'normal'}]),big:action([hit(50)]),normal:action([{...hit(10),hitRule:'impossible'}])}};
  const b=apply(initial(),a);assert.equal(b.log.filter(x=>x.kind==='miss').length,14);assert.equal(b.units[1]!.current.hp,950);
 });

 test('品质不等于品阶以下 非神话包含已知唯一品质，但未知品质不冒充非神话',()=>{
  const original=rule(initial([10,20]),'immune_source','u1',{filter:{excludeQualities:['mythic'],kinds:['skill']}});const a=action([hit(100)]);a.source={id:'unique',kind:'skill',quality:'unique'};assert.equal(apply(original,a).units[1]!.current.hp,1000);delete a.source.quality;assert.ok(apply(original,a).units[1]!.current.hp<1000,'未知品质不应自动满足否定品质条件');
 });
 test('宿主品质自动绑定：模型漏写或谎报品质都恢复真实来源而不阻断角色',async()=>{
  const {createCompilationEngine}=await import('../src/compiler/engine');const {cleanSource,rules,damageAction,mapping}=await import('./compiler-fixtures');const m=mapping(damageAction());const engine=createCompilationEngine(async()=>({version:'booksea-effects/2',mappings:[m]}),rules);const result=await engine.compile(cleanSource(),undefined,[]);const actor=result.actor as import('../src/compiler/engine').CompiledActor;assert.equal(actor.skills[0]!.mapping.action!.source!.quality,'common');m.action!.source={id:m.sourceId,kind:'skill',quality:'mythic'};const repaired=(await engine.compile(cleanSource(),undefined,[])).actor as import('../src/compiler/engine').CompiledActor;assert.equal(repaired.skills[0]!.mapping.action!.source!.quality,'common');
 });

 test('多方嘲讽 同时拉向不同目标时比较施加者等级，不看最大priority',()=>{
  let b=initial([10,20,21]);b=grant(b,status('weak',{control:'taunt',priority:1000000}),'u0',{},'u1');b=grant(b,status('strong',{control:'taunt',priority:-1000000}),'u0',{},'u2');b=apply(b,action([hit(100)]));assert.equal(b.units[1]!.current.hp,1000);assert.ok(b.units[2]!.current.hp<1000,'高等级嘲讽者应成为实际目标');
 });
 test('多方命运 不能先用priority挑弱祝福，再让它错误输给诅咒',()=>{
  let b=initial([10,20,21,22]);b=rule(b,'luck','u0',{key:'best',priority:1000000},'u1');b=rule(b,'luck','u0',{key:'worst',priority:0},'u2');b=rule(b,'luck','u0',{key:'best',priority:-1000000},'u3');
  const a=action([{op:'check',attacker:C(0),defender:C(1000),scale:1,baseChance:0,minimumChance:0,maximumChance:0,success:'win',failure:'lose'}],'self');a.library={...EMPTY_LIBRARY(),actions:{win:action([{op:'counter',key:'verdict',mode:'set',value:C(1),reset:'battle'}],'self'),lose:action([{op:'counter',key:'verdict',mode:'set',value:C(0),reset:'battle'}],'self')}};b=apply(b,a,'u0',['u0']);assert.equal(b.units[0]!.counters!.verdict!.value,1);
 });
 test('争夺控制权 不同阵营控制者冲突仍按等级，新数组位置和高priority不能覆盖',()=>{
  let b=initial([10,21,20],2);b=grant(b,status('master high',{control:'charm',priority:-1000000}),'u0',{},'u1');b=grant(b,status('master low',{control:'charm',priority:1000000}),'u0',{},'u2');assert.equal(b.clock.units[0]!.side,'ally');assert.equal(b.units[0]!.statuses!.filter(x=>x.definition.control==='charm').length,1);assert.equal(b.units[0]!.statuses![0]!.source,'u1');
 });
 test('盟友授予免死的后继自保护 保护持有者获一轮无敌，不误发给授予者',()=>{
  let b=initial([10,20,9],2);const a=action([{op:'rule',rule:'death_guard',key:'*',uses:1,amount:flat(1),duration,onTrigger:'safe'}],'ally');a.library={...EMPTY_LIBRARY(),actions:{safe:action([{op:'rule',rule:'immune_channel',key:'*',duration:rounds(1)}],'self')}};b=apply(b,a,'u1',['u0'],'blessing');b=apply(b,action([{...hit(1e8),execute:true}]),'u2',['u0']);assert.equal(b.units[0]!.current.hp,1);assert.ok(b.units[0]!.statuses!.some(x=>x.rule?.kind==='immune_channel'&&x.source==='u1'),'护佑应保留授予者归属且作用于受护者');assert.equal(b.units[1]!.statuses!.some(x=>x.rule?.kind==='immune_channel'),false);
 });

 test('召唤物零血不死 有效寿命仍推进；到期是移出战场，不被不死规则复原',()=>{
  let b=initial();const a=action([{op:'summon',mode:'clone',template:'shade',count:1}],'self');a.library={...EMPTY_LIBRARY(),actions:{wait:action([{op:'atb',mode:'set',value:0}],'self')},summons:{shade:{name:'shade',level:'caster',inheritance:0,resources:{hp:0,mp:0,sp:0},attributes:{力量:0,敏捷:0,体质:0,智力:0,精神:0},actions:['wait'],duration:{clock:'battle_time',value:50},ownerDeath:'despawn',limit:1,rewardEligible:false,cloneResources:{hp:.5,mp:1,sp:1}}}};b=apply(b,a,'u1',['u1']);const id=b.units.find(x=>x.owner==='u1')!.id;b=rule(b,'undying',id);b=apply(b,action([hit(5000)]),'u0',[id]);assert.equal(isAlive(b.units.find(x=>x.id===id)!),true);b=idle(b,50);assert.equal(isAlive(b.units.find(x=>x.id===id)!),false);assert.equal(b.units.find(x=>x.id===id)!.escaped,true);
 });

 test('后续新冲突 复活者后来速度反超，必须按新动作时的速度裁定而非永久锁死旧快照',()=>{
  let b=initial([10,9,10]);const speed=(n:number)=>action([{op:'speed',name:'haste',multiplier:n,chance:1,duration,stack:'refresh'}],'self');b=apply(b,speed(2),'u0',['u0']);b=apply(b,action([{...hit(10000),execute:true}]));b=apply(b,speed(3),'u2',['u2']);const a=action([{op:'revive',amount:flat(100),targeting:{side:'any',selection:'manual',life:'downed'}}]);a.targeting={side:'any',selection:'manual',life:'downed'};b=apply(b,a,'u2',['u1']);assert.equal(b.units[1]!.current.hp,100);
 });
