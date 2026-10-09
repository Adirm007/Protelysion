/** 0.38.1 目标方式回归：增益技能/增益道具可选同伴，敌我两用技能按所选目标的阵营分别生效，
 * 旧缓存里的“选敌人、效果却只作用于同伴”死效果按结构修复，AI 不会用两用技能打队友或奶敌人，
 * “重新整备”只把旧策略下有目标问题的条目交给模型重编。合成夹具与福尔摩斯卡的本地编译，走真实指令管线；不代表整卡通过。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {lowerBlueprint} from '../src/compiler/blueprint/lower';
import {finalizeModelBlueprint} from '../src/compiler/blueprint/compile';
import {normalizeBlueprint,BLUEPRINT_VERSION} from '../src/compiler/blueprint/types';
import {validateAction,type ActionSpec,type EffectSpec,type StatusSpec} from '../src/compiler/contract';
import {createBattle,legalTargets,chooseAction,resolveAction,advanceBattle,actionUnavailable,type Battle,type Unit} from '../src/battle/executor';
import {repairLegacyTargeting} from '../src/battle/targeting';
import {decide} from '../src/game/combat-ai';
import {createCompilationEngine,validateCompiled,needsTargetRefresh,type CompiledActor} from '../src/compiler/engine';
import {HOST_RULES} from '../src/compiler/rules';
import {combatProjection} from '../src/core/cache';
import {describeAction,targetText} from '../src/ui/ability-text';
import type {Obj} from '../src/core/actors';
import {card,mitigation,damageAction,flat,zero} from './compiler-fixtures';

const attrs={力量:40,敏捷:40,体质:40,智力:40,精神:40};
const actor={level:20,tier:5,power:3000,cost:4000,attributeFactor:1,attributes:attrs};
/** 模型蓝图路径：finalizeModelBlueprint（按原文补目标缺省）→ lowerBlueprint → 合同校验。 */
function lower(raw:Obj,opts:{text?:string;item?:boolean}={}):ActionSpec{
 const name=String(raw.name??'测试'),sourceId=(opts.item?'/道具定义/':'/技能/')+name;
 const bp=finalizeModelBlueprint(normalizeBlueprint(raw)!,{sourceId,name,raw:{描述:opts.text??''}},actor);
 const a=validateAction(lowerBlueprint(bp,{key:sourceId+'#0',sourceId,name,level:20,tier:5,power:3000,cost:4000,attributeFactor:1,attributes:attrs,passive:bp.kind==='passive'}).action) as ActionSpec;
 if(opts.item){a.category='item';a.copyable=false;}
 return a;
}
const main=(a:ActionSpec)=>a.targeting?.side??a.target;
function kit(skills:{id:string;action:ActionSpec}[],max={hp:10000,mp:10000,sp:10000}):CompiledActor{
 const c=card(skills[0]!.action,skills[0]!.id);
 c.skills=skills.map(x=>({sourceId:x.id,name:x.id.replace(/^\/[^/]+\//,''),sourceFingerprint:'{}',mapping:{sourceId:x.id,disposition:'active',reason:'test',action:x.action}})) as typeof c.skills;
 c.numeric.level=20;c.numeric.max={...max};return c;
}
/** u0=施放者，u2=同伴，u1=敌人。 */
function party(caster:CompiledActor,buddy:Partial<Record<'hp'|'mp'|'sp',number>>={}):Battle{
 const filler=()=>kit([{id:'/技能/占位',action:damageAction(10)}]);
 const e=(id:string,side:'ally'|'enemy',c:CompiledActor,current:Partial<Record<'hp'|'mp'|'sp',number>>={})=>({id,side,card:c,current:{...c.numeric.max,...current},mitigation:mitigation()});
 return createBattle([e('u0','ally',caster),e('u2','ally',filler(),buddy),e('u1','enemy',filler())],7);
}
const U=(b:Battle,id:string)=>b.units.find(x=>x.id===id)!;
/** 真实指令管线：推进时钟，别人待机，轮到施放者时 chooseAction → resolveAction。 */
function cast(b0:Battle,skill:string,targets:string[],who='u0'):Battle{
 let b=b0;
 for(let i=0;i<60;i++){
  b=advanceBattle(b,1e6).battle;const p=b.clock.pending[0];if(!p)continue;
  if(p.kind==='resolve'){b=resolveAction(b);continue;}
  const pick:[string,string[]]=p.unitId===who?[skill,targets]:['booksea:wait',[p.unitId]];
  b=chooseAction(b,p.unitId,pick[0],pick[1]);while(b.clock.pending[0]?.kind==='resolve')b=resolveAction(b);
  if(p.unitId===who)return b;
 }
 throw Error('没有轮到 '+who);
}
const has=(u:Unit,name:string)=>(u.statuses??[]).some(s=>!s.suppressed&&s.definition.name===name);
const positive=(name:string):StatusSpec=>({name,tags:[],polarity:'positive',duration:{clock:'round',value:3},stack:'refresh',maxStacks:1,scaleWithStacks:true,priority:0,dispellable:true,removeOnDeath:true,scope:'battle',modifiers:[{stat:'精神',multiplier:1.2}]});
const noCost={hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}};
const healPct=(p:number,targeting?:EffectSpec['targeting']):EffectSpec=>({op:'heal',resource:'hp',amount:{...zero(),subject:'target',maxResource:'hp',maxFraction:p},...(targeting?{targeting}:{})});
const allyManual={side:'ally',selection:'manual',count:1,life:'alive'} as const;

test('增益状态/增益道具/净化不再被当成攻击：主目标是同伴，攻击附带的增益仍给自己',()=>{
 const buff={name:'薄荷提神',polarity:'positive',mods:[{stat:'精神',pct:20}]};
 assert.equal(main(lower({name:'提神',kind:'active',steps:[{do:'status',status:buff,turns:3}]})),'ally','自定义正面状态，未写目标');
 assert.equal(main(lower({name:'提神2',kind:'active',steps:[{do:'status',status:buff,turns:3,target:{side:'ally'}}]})),'ally','自定义正面状态，写明同伴');
 assert.equal(main(lower({name:'加速术',kind:'active',steps:[{do:'status',status:'加速',turns:3}]})),'ally','标准正面状态');
 assert.equal(main(lower({name:'薄荷烟草',kind:'active',steps:[{do:'status',status:buff,turns:3,target:{side:'ally'}}]},{item:true})),'ally','增益道具');
 assert.equal(main(lower({name:'净化',kind:'active',steps:[{do:'dispel',polarity:'negative',count:1}]})),'ally','写成驱散负面的净化');
 assert.equal(main(lower({name:'坚守',kind:'active',steps:[{do:'stat',mods:[{stat:'受到伤害',pct:-20}],turns:3}]})),'ally','承伤降低是增益');
 assert.equal(main(lower({name:'破绽',kind:'active',steps:[{do:'stat',mods:[{stat:'受到伤害',pct:30}],turns:3}]})),'enemy','承伤提高是减益');
 const roar=lower({name:'战吼',kind:'active',steps:[{do:'damage'},{do:'stat',mods:[{stat:'力量',pct:20}],turns:3}]});
 assert.equal(main(roar),'enemy');assert.equal(roar.effects.find(e=>e.op==='modify')?.targeting?.side,'self','攻击附带的增益仍作用于自身');
 // 实战：可选自己和同伴，不能选敌人；对同伴施放后同伴获得状态。
 const a=lower({name:'提神',kind:'active',steps:[{do:'status',status:buff,turns:3}]});
 const b=party(kit([{id:'/技能/提神',action:a}]));
 assert.deepEqual(legalTargets(b,U(b,'u0'),U(b,'u0').actions['/技能/提神']!).map(u=>u.id).sort(),['u0','u2']);
 assert.ok(actionUnavailable(b,U(b,'u0'),'/技能/提神',['u1']),'不能对敌人使用');
 assert.ok(has(U(cast(b,'/技能/提神',['u2']),'u2'),'薄荷提神'));
});

test('纯辅助按原文补目标：写明自身才只给自己，姿态默认自身，道具用在谁身上就作用于谁',()=>{
 assert.equal(main(lower({name:'治疗',kind:'active',steps:[{do:'heal',pct:20}]},{text:'恢复20%生命'})),'ally');
 assert.equal(main(lower({name:'自愈',kind:'active',steps:[{do:'heal',pct:20}]},{text:'恢复自身20%生命'})),'self');
 assert.equal(main(lower({name:'举盾',kind:'active',steps:[{do:'guard',pct:40,turns:2}]},{text:'举盾格挡'})),'self');
 assert.equal(main(lower({name:'援护',kind:'active',steps:[{do:'guard',pct:40,turns:2}]},{text:'为一名同伴格挡40%伤害'})),'ally');
 assert.equal(main(lower({name:'闪避药水',kind:'active',steps:[{do:'dodge',pct:30,turns:2}]},{item:true,text:'饮用后自身闪避提升'})),'ally','道具里的“自身”指服用者');
 assert.equal(main(lower({name:'回城卷轴',kind:'active',steps:[{do:'retreat'}]},{item:true})),'self','撤离类道具仍只作用于使用者');
 const revive=lower({name:'复苏',kind:'active',steps:[{do:'revive',pct:30}]});
 assert.deepEqual([revive.targeting?.side,revive.targeting?.life],['ally','downed'],'未写目标的复活选倒地同伴');
 const pet=lower({name:'召唤治疗精灵',kind:'active',steps:[{do:'summon',summon:{name:'治疗精灵',role:'support',steps:[{do:'heal',pct:15}]}}]});
 const petAction=Object.values(pet.library!.actions).find(x=>(x.name??'').includes('·行动'))!;
 assert.equal(petAction.target,'ally','辅助型召唤物的治疗招式可选同伴');
 const drummer=lower({name:'召唤鼓手',kind:'active',steps:[{do:'summon',summon:{name:'鼓手',steps:[{do:'status',status:'加速',turns:2,target:{side:'ally'}}]}}]});
 assert.equal(Object.values(drummer.library!.actions).find(x=>(x.name??'').includes('·行动'))!.target,'ally','召唤物的增益招式不再只能选敌人');
});

const potion={name:'快速调配药剂',kind:'active',target:{side:'any'},steps:[{do:'damage',channel:'energy',types:['火','水','光','暗']},{do:'heal',resource:'auto',pct:20}]};
test('敌我两用：同一技能可选敌我，对敌人只造成伤害，对同伴只回复其最缺的资源',()=>{
 const a=lower(potion);
 assert.deepEqual(a.targeting,{side:'any',selection:'manual',count:1,life:'alive'});
 assert.deepEqual(a.effects.map(e=>[e.op,e.targeting?.side]),[['damage','enemy'],['heal','ally']]);
 assert.equal((a.effects[1] as Extract<EffectSpec,{op:'heal'}>).adaptive,true);
 const text=describeAction(a).join('；');assert.match(text,/对敌方：造成/);assert.match(text,/对同伴：恢复目标最缺的一项资源/);
 assert.equal(targetText(a),'单体目标（敌我皆可）');
 const b=party(kit([{id:'/技能/药剂',action:a}]),{hp:9000,mp:2000});
 assert.deepEqual(legalTargets(b,U(b,'u0'),U(b,'u0').actions['/技能/药剂']!).map(u=>u.id).sort(),['u0','u1','u2']);
 const onFoe=cast(b,'/技能/药剂',['u1']);
 assert.ok(U(onFoe,'u1').current.hp<U(b,'u1').current.hp,'对敌人：造成伤害');
 assert.equal(U(onFoe,'u2').current.mp,U(b,'u2').current.mp,'对敌人施放不会回复同伴');
 const onAlly=cast(b,'/技能/药剂',['u2']);
 assert.equal(U(onAlly,'u2').current.hp,9000,'对同伴：不造成伤害，生命不是最缺的');
 assert.equal(U(onAlly,'u2').current.mp,4000,'对同伴：回复最缺的法力（最大值的20%）');
 assert.equal(U(onAlly,'u1').current.hp,U(b,'u1').current.hp,'对同伴施放不会伤到敌人');
 // 只写 when 条件、未写 target 的模型蓝图同样成为两用。
 const when=lower({name:'调配试剂',kind:'active',steps:[{do:'damage',types:['火','光'],when:[{kind:'target_is_enemy'}]},{do:'cleanse',count:1,when:[{kind:'target_is_ally'}]}]});
 assert.equal(when.targeting?.side,'any');assert.deepEqual(when.effects.map(e=>e.targeting?.side),['enemy','ally']);
});

test('主目标是所选敌人时，“一名同伴”的效果自动给生命比例最低的同伴，不再是选不到人的死效果',()=>{
 const a=lower({name:'吸血斩',kind:'active',steps:[{do:'damage'},{do:'heal',pct:10,target:{side:'ally'}}]});
 assert.equal(a.target,'enemy');assert.deepEqual([a.effects[1]!.targeting?.side,a.effects[1]!.targeting?.selection],['ally','lowest_resource']);
 const b=party(kit([{id:'/技能/吸血斩',action:a}]),{hp:3000});
 const after=cast(b,'/技能/吸血斩',['u1']);
 assert.equal(U(after,'u2').current.hp,4000,'生命最低的同伴回复10%');
});

test('旧缓存修复：选敌人却只作用于同伴的死效果改为选同伴；攻击+同伴效果改为敌我两用；只作用于自身的改为自身',()=>{
 const legacyBuff:ActionSpec={name:'薄荷烟草',target:'enemy',cost:noCost,castMs:0,recoveryFactor:1,perBattleUses:0,category:'item',copyable:false,effects:[{op:'apply_status',status:'清醒',targeting:allyManual}],library:{actions:{},statuses:{清醒:positive('清醒')},summons:{},fields:{}}};
 const fixed=repairLegacyTargeting(validateAction(legacyBuff) as ActionSpec);
 assert.ok(fixed.changed);assert.equal(fixed.action.target,'ally');assert.equal(fixed.action.effects[0]!.targeting,undefined);
 const legacyDual=validateAction({...damageAction(500),name:'快速调配药剂',cost:noCost,effects:[...damageAction(500).effects,healPct(.2,allyManual)]}) as ActionSpec;
 const dual=repairLegacyTargeting(legacyDual).action;
 assert.equal(dual.targeting?.side,'any');assert.deepEqual(dual.effects.map(e=>e.targeting?.side),['enemy','ally']);
 const legacySelf=validateAction({...legacyBuff,category:'skill',effects:[{op:'apply_status',status:'清醒',targeting:{side:'self',selection:'manual'}}]}) as ActionSpec;
 assert.equal(repairLegacyTargeting(legacySelf).action.target,'self');
 const plain=validateAction(damageAction(10)) as ActionSpec;assert.equal(repairLegacyTargeting(plain).action,plain,'正常攻击原样返回');
 // 开战时修复旧缓存：道具可对同伴使用并生效；两用技能对同伴回复、对敌人伤害。
 const b=party(kit([{id:'/道具定义/薄荷烟草',action:legacyBuff},{id:'/技能/药剂',action:legacyDual}]),{hp:5000});
 assert.equal(U(b,'u0').actions['/道具定义/薄荷烟草']!.target,'ally');
 assert.ok(has(U(cast(b,'/道具定义/薄荷烟草',['u2']),'u2'),'清醒'),'旧缓存的增益道具对同伴生效');
 const healed=cast(b,'/技能/药剂',['u2']);assert.equal(U(healed,'u2').current.hp,7000);assert.equal(U(healed,'u1').current.hp,U(b,'u1').current.hp);
 const hurt=cast(b,'/技能/药剂',['u1']);assert.ok(U(hurt,'u1').current.hp<U(b,'u1').current.hp);assert.equal(U(hurt,'u2').current.hp,5000);
});

test('AI：两用技能不会打队友、不会奶敌人；同伴残血时才对同伴使用',()=>{
 const a=lower(potion);
 const full=party(kit([{id:'/技能/药剂',action:a}]));
 for(let seed=1;seed<=6;seed++){const b={...full,seed};const d=decide(b,U(b,'u0'),'heal');assert.equal(d.targets[0],'u1','同伴满状态时只会对敌人出手：'+JSON.stringify(d));}
 const hurt=party(kit([{id:'/技能/药剂',action:a}]),{hp:1000});
 const d=decide(hurt,U(hurt,'u0'),'heal');assert.deepEqual([d.skill,d.targets[0]],['/技能/药剂','u2']);
});

const corpus=JSON.parse(readFileSync(new URL('./blueprint-corpus.fixture.json',import.meta.url),'utf8')) as {name:string;source:Obj}[];
function holmes():Obj{
 const s=structuredClone(corpus.find(c=>c.name==='福尔摩斯探案集')!.source) as Obj;
 (s.背包 as Obj)['薄荷烟草']={类型:'消耗品',数量:3,效果:'吸上一口头脑清醒：精神提升15%，持续3回合'};
 return s;
}
test('福尔摩斯（本地编译）：工具组编成敌我两用，薄荷烟草可对同伴使用',async()=>{
 const engine=createCompilationEngine(async()=>{throw Error('offline');},HOST_RULES);
 const actorCard=validateCompiled((await engine.compile(combatProjection(holmes()),undefined,[])).actor);
 const kitAction=actorCard.skills.find(s=>s.sourceId==='/技能/工具组')!.mapping.action!;
 assert.equal(kitAction.targeting?.side,'any','工具组：敌我皆可选');
 assert.ok(kitAction.effects.some(e=>e.op==='damage'&&e.targeting?.side==='enemy')&&kitAction.effects.some(e=>e.op==='heal'&&e.adaptive&&e.targeting?.side==='ally'));
 const tobacco=actorCard.skills.find(s=>s.sourceId==='/道具定义/薄荷烟草')!.mapping.action!;
 assert.equal(tobacco.target,'ally','增益道具默认可选同伴');
 const e=(id:string,side:'ally'|'enemy',c:CompiledActor,current?:Partial<Record<'hp'|'mp'|'sp',number>>)=>({id,side,card:c,current:{...c.numeric.max,...current},mitigation:mitigation()});
 const b=createBattle([e('u0','ally',actorCard),e('u2','ally',kit([{id:'/技能/占位',action:damageAction(10)}]),{mp:1000}),e('u1','enemy',kit([{id:'/技能/占位',action:damageAction(10)}]))],3);
 assert.deepEqual(legalTargets(b,U(b,'u0'),U(b,'u0').actions['/道具定义/薄荷烟草']!).map(u=>u.id).sort(),['u0','u2']);
 const potionOnAlly=cast(b,'/技能/工具组',['u2']);assert.ok(U(potionOnAlly,'u2').current.mp>1000,'对同伴：补法力（最缺）');
 const potionOnFoe=cast(b,'/技能/工具组',['u1']);assert.ok(U(potionOnFoe,'u1').current.hp<U(b,'u1').current.hp,'对敌人：伤害');
});

test('重新整备：旧策略下有目标问题的模型条目交给模型重编，模型失败时保留修复后的旧结果',async()=>{
 const source=combatProjection(holmes());
 const reply=(prompt:string,build:(id:string)=>Obj|undefined)=>{const list=JSON.parse(prompt.slice(prompt.lastIndexOf('条目：')+3)) as {sourceId:string}[];return {version:BLUEPRINT_VERSION,entries:list.flatMap(x=>{const m=build(x.sourceId);return m?[{sourceId:x.sourceId,main:m}]:[];})};};
 const first=createCompilationEngine(async({prompt})=>reply(prompt,()=>({name:'模型',kind:'active',steps:[{do:'damage'}],fidelity:'exact'})),HOST_RULES,{blueprint:true});
 const fresh=validateCompiled((await first.compile(source,undefined,[])).actor);
 const tool=fresh.skills.find(s=>s.sourceId==='/技能/工具组')!;
 assert.equal(tool.adaptation?.method,'model');assert.equal(tool.adaptation?.policy,3,'新编译结果带策略修订号');
 // 造一份 0.38.0 的旧缓存：工具组是“选敌人、效果只作用于同伴”的死效果，且没有策略修订号。
 const legacy=structuredClone(fresh) as CompiledActor;const old=legacy.skills.find(s=>s.sourceId==='/技能/工具组')!;
 old.mapping.action=validateAction({name:'工具组',target:'enemy',cost:noCost,castMs:0,recoveryFactor:1,perBattleUses:0,effects:[{op:'apply_status',status:'清醒',targeting:allyManual}],library:{actions:{},statuses:{清醒:positive('清醒')},summons:{},fields:{}}}) as ActionSpec;
 delete old.adaptation!.policy;
 assert.ok(needsTargetRefresh(old.mapping,{描述:'创造调查需要的试剂和小道具的能力'}));
 const asked:string[]=[];
 const second=createCompilationEngine(async({prompt})=>reply(prompt,id=>{asked.push(id);return id==='/技能/工具组'?potion:undefined;}),HOST_RULES,{blueprint:true});
 const redone=validateCompiled((await second.compile(source,legacy,[])).actor);
 assert.deepEqual(asked,['/技能/工具组'],'只重编有目标问题的旧条目');
 const now=redone.skills.find(s=>s.sourceId==='/技能/工具组')!;
 assert.equal(now.mapping.action!.targeting?.side,'any');assert.equal(now.adaptation?.policy,3);
 const offline=createCompilationEngine(async()=>{throw Error('offline');},HOST_RULES,{blueprint:true});
 const kept=validateCompiled((await offline.compile(source,legacy,[])).actor).skills.find(s=>s.sourceId==='/技能/工具组')!;
 assert.equal(kept.adaptation?.method,'model','模型不可用：保留旧的模型结果，不退回本地解析');
 assert.equal(kept.mapping.action!.target,'ally','保留的旧结果已按结构修复');
 // 普通攻击、写明“自身”的纯辅助不重编。
 const plain={sourceId:'/技能/x',disposition:'active' as const,reason:'x',action:validateAction(damageAction(10)) as ActionSpec};
 assert.equal(needsTargetRefresh(plain,{描述:'攻击'}),false);
 const selfHeal={...plain,action:validateAction({...damageAction(10),target:'self',effects:[healPct(.2)]}) as ActionSpec};
 assert.equal(needsTargetRefresh(selfHeal,{描述:'恢复自身20%生命'}),false);
 assert.equal(needsTargetRefresh(selfHeal,{描述:'恢复20%生命'}),true);
 // 0.38.0 提示词把创造类能力拆成“攻击型/恢复型”两个主动：重编为一个敌我两用技能。
 const ally=validateAction({...damageAction(10),target:'ally',effects:[healPct(.15)]}) as ActionSpec;
 assert.equal(needsTargetRefresh({...plain,actions:[ally]},{描述:'当场调配各种性质的试剂'}),true);
 assert.equal(needsTargetRefresh({...plain,actions:[validateAction(damageAction(20)) as ActionSpec]},{描述:'连续攻击'}),false);
});

test('闭环复审：可以施加给同伴的不可选中/无敌同样受完全抵消预算与等级规则限制',()=>{
 const strike=()=>{const a=damageAction(20000);a.cost=noCost;return a;};
 const play=(shield:ActionSpec,foeLevel:number)=>{
  const big=(skills:{id:string;action:ActionSpec}[],level=20)=>{const c=kit(skills,{hp:1e5,mp:1e6,sp:1e6});c.numeric.level=level;return c;};
  const e=(id:string,side:'ally'|'enemy',c:CompiledActor)=>({id,side,card:c,current:{...c.numeric.max},mitigation:mitigation()});
  let b=createBattle([e('u0','ally',big([{id:'/技能/圣盾',action:shield}])),e('u2','ally',big([{id:'/技能/占位',action:strike()}])),e('u1','enemy',big([{id:'/技能/重击',action:strike()}],foeLevel))],5);
  const plans:Record<string,[string,string[]][]>={u0:[['/技能/圣盾',['u2']]],u1:[['/技能/重击',['u2']]]};let taken=0;
  for(let i=0;i<80&&b.outcome==='active';i++){b=advanceBattle(b,1e6).battle;const p=b.clock.pending[0];if(!p)break;if(p.kind==='resolve'){b=resolveAction(b);continue;}
   for(const [s,t] of [...(plans[p.unitId]??[]),['booksea:wait',[p.unitId]] as [string,string[]]]){if(actionUnavailable(b,U(b,p.unitId),s,t))continue;const hp=U(b,'u2').current.hp;b=chooseAction(b,p.unitId,s,t);while(b.clock.pending[0]?.kind==='resolve')b=resolveAction(b);taken+=Math.max(0,hp-U(b,'u2').current.hp);break;}}
  return {taken,budget:b.log.filter(l=>l.kind==='negation_budget'&&l.unit==='u2').length};
 };
 const hide=lower({name:'圣盾',kind:'active',steps:[{do:'untargetable',turns:1}]},{text:'使一名同伴1回合内无法被选中'});
 assert.equal(hide.target,'ally');
 const same=play(hide,20);assert.equal(same.budget,5,'同级敌人面前，同伴每回合被施加的不可选中也只顶满5个回合（Lv20）');assert.ok(same.taken>0);
 const immune=lower({name:'圣盾',kind:'active',steps:[{do:'immune',to:['damage'],turns:1}]},{text:'为一名同伴施加1回合伤害免疫'});
 assert.equal(immune.target,'ally');
 assert.ok(play(immune,20).taken>0,'资源撑得住的“每回合给同伴无敌”属于变相常驻：对同级无效');
 assert.equal(play(immune,15).taken,0,'对低等级照常生效');
});
