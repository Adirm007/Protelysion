/** 0.21 技能组闭环收口回归（路线A：完全抵消预算 / 80%减伤上限 / 强控 / 保命计数 / 审查修正）。
 * 对应 docs/mcp-combat-loop-audit-20260929.md 的 L01–L21、P2-1、P2-2、R-1，以及复审补上的同类写法（docs/mcp-combat-budget-0210.md §8）。合成夹具，走真实指令管线，不代表整卡通过。 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {lowerBlueprint} from '../src/compiler/blueprint/lower';
import {validateAction,type ActionSpec,type EffectSpec} from '../src/compiler/contract';
import {createBattle,advanceBattle,chooseAction,resolveAction,actionUnavailable,applyBattleEffects,auditInvulnerability,lastStandLimit,NEGATION_CAP,passTurn,costFor,type Battle} from '../src/battle/executor';
import type {Blueprint} from '../src/compiler/blueprint/types';
import type {CompiledActor} from '../src/compiler/engine';
import {card,mitigation,damageAction,flat,zero} from './compiler-fixtures';

const attrs={力量:40,敏捷:40,体质:40,智力:40,精神:40};
const bp=(b:Blueprint,key:string):ActionSpec=>validateAction(lowerBlueprint(b,{key,sourceId:'/技能/'+key,name:key,level:20,tier:5,power:3000,cost:4000,attributeFactor:1,attributes:attrs,passive:b.kind==='passive'}).action) as ActionSpec;
type Skill={id:string;action:ActionSpec;passive?:boolean};
const passive=(b:Omit<Blueprint,'kind'>,key:string):Skill=>({id:'/技能/'+key,action:bp({kind:'passive',...b} as Blueprint,key),passive:true});
const active=(b:Omit<Blueprint,'kind'>,key:string):Skill=>({id:'/技能/'+key,action:bp({kind:'active',...b} as Blueprint,key)});
function kit(level:number,skills:Skill[],max={hp:1e5,mp:1000,sp:1000},agility=10):CompiledActor{
 const c=card(skills[0]!.action,skills[0]!.id);
 c.skills=skills.map(x=>({sourceId:x.id,name:x.id.replace(/^\/[^/]+\//,''),sourceFingerprint:'{}',mapping:{sourceId:x.id,disposition:x.passive?'passive':'active',reason:'test',action:x.action}})) as typeof c.skills;
 c.numeric.level=level;c.numeric.max={...max};c.numeric.attributes={...c.numeric.attributes,敏捷:agility};return c;
}
function strike(n=20000,opts:{channel?:'physical'|'true';element?:string;normal?:boolean}={}):ActionSpec{
 const a=damageAction(n);const d=a.effects[0] as Extract<EffectSpec,{op:'damage'}>;
 if(opts.channel==='true'){d.amounts={physical:zero(),energy:zero(),mental:zero(),true:flat(n)};}
 if(opts.element){d.element=opts.element;d.types=[opts.element as NonNullable<typeof d.types>[number]];}if(opts.normal){d.hitRule='normal';d.hitChance=1;}
 a.cost={hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}};return a;
}
const foeKit=(level:number,agility=10)=>kit(level,[{id:'/技能/重击',action:strike()},{id:'/技能/真伤',action:strike(20000,{channel:'true'})},{id:'/技能/火击',action:strike(20000,{element:'火'})},{id:'/技能/普通',action:strike(20000,{normal:true})}],{hp:1e6,mp:1e6,sp:1e6},agility);
/** 占位技能（不含任何防御），让 kit 至少有一个技能。 */
const blank=():Skill=>({id:'/技能/占位',action:strike(10)});
function duel(ally:CompiledActor,foe:CompiledActor,seed=11):Battle{
 const e=(id:string,side:'ally'|'enemy',c:CompiledActor)=>({id,side,card:c,current:{...c.numeric.max},mitigation:mitigation()});
 return createBattle([e('u0','ally',ally),e('u1','enemy',foe)],seed);
}
const U=(b:Battle,id:string)=>b.units.find(x=>x.id===id)!;
type Plan=[string,string[]][];
/** 真实指令管线：advanceBattle → chooseAction → resolveAction；计划里的动作都不可用时防御/待机。 */
function run(b0:Battle,turns:number,plans:Record<string,Plan>){
 let b=b0;const acted:Record<string,number>={},taken:Record<string,number>={};let cancelled=0;
 const track=(before:Battle,after:Battle)=>{for(const u of after.units){const p=before.units.find(x=>x.id===u.id);if(p&&p.current.hp>u.current.hp)taken[u.id]=(taken[u.id]??0)+p.current.hp-u.current.hp;}};
 for(let i=0;i<turns&&b.outcome==='active';i++){
  const before=b;b=advanceBattle(b,1e6).battle;track(before,b);if(b.outcome!=='active')break;
  const p=b.clock.pending[0];if(!p)break;
  if(p.kind==='resolve'){const pre=b;b=resolveAction(b);track(pre,b);continue;}
  const actor=p.unitId;const plan:Plan=[...(plans[actor]??[]),['booksea:guard',[actor]],['booksea:wait',[actor]]];
  let done=false;
  for(const [skill,targets] of plan){const me=U(b,actor);if(!me.actions[skill]||actionUnavailable(b,me,skill,targets))continue;
   const pre=b;b=chooseAction(b,actor,skill,targets);if(Object.values(b.commands).find(c=>c.caster===actor)?.cancelled)cancelled++;
   while(b.clock.pending[0]?.kind==='resolve')b=resolveAction(b);track(pre,b);done=true;if(!skill.startsWith('booksea:'))acted[actor]=(acted[actor]??0)+1;break;}
  assert.ok(done,'有人无路可走：'+actor);
 }
 const count=(kind:string,id='u0')=>b.log.filter(l=>l.kind===kind&&l.unit===id).length;
 return {b,acted,taken,cancelled,count};
}
const hit=(foe='/技能/重击'):Record<string,Plan>=>({u1:[[foe,['u0']]]});
/** 单次结算：让 u1 对 u0 打一下，返回 u0 实际掉的血。 */
function once(b:Battle,action=strike()):{b:Battle;loss:number}{const hp=U(b,'u0').current.hp;const next=applyBattleEffects(b,'u1',action,['u0'],'effect','/技能/打');return {b:next,loss:hp-U(next,'u0').current.hp};}

test('常量：80%减伤上限；预算=层级（Lv20=5回合）',()=>{
 assert.equal(NEGATION_CAP,.8);assert.equal(lastStandLimit(20),5);assert.equal(lastStandLimit(4),1);assert.equal(lastStandLimit(25),7);
});

test('L04/L20 伤前归零：对同级敌人只能完全抵消5个回合，之后每下至少吃20%；对低等级不受限',()=>{
 const k=kit(20,[passive({steps:[],triggers:[{on:'before_damage',steps:[{do:'reduce_incoming',pct:100}]}]} as never,'伤前归零')]);
 const same=run(duel(k,foeKit(20)),40,hit());
 assert.equal(same.count('negation_budget'),5,'正好扣满5个回合');
 assert.ok(same.count('negation_exhausted')>=1);
 assert.ok((same.taken.u0??0)>0,'预算用完后吃到伤害');
 const low=run(duel(k,foeKit(15)),40,hit());
 assert.equal(low.taken.u0??0,0,'低等级攻击者：完全抵消照常');assert.equal(low.count('negation_budget'),0);
});

test('L01 格挡100% / L02 承伤上限0 / ir 伤转疗：同级敌人面前都不再永久无伤',()=>{
 const block=kit(20,[passive({steps:[{do:'guard',pct:100,next:9999,turns:999}]},'万次格挡')]);
 const cap0=kit(20,[passive({steps:[{do:'damage_cap',pct:0}]},'承伤归零')]);
 const heal=kit(20,[passive({steps:[],triggers:[{on:'before_damage',steps:[{do:'ir',effect:{op:'alter_event',mode:'damage_to_heal'}}]}]} as never,'伤转疗')]);
 for(const k of [block,cap0,heal]){const r=run(duel(k,foeKit(20)),40,hit());assert.ok((r.taken.u0??0)>0);assert.equal(r.count('negation_budget'),5);}
});

test('L05 高减伤：一切伤害类型都减到80%以上时按80%结算；真实伤害没被减的不算（单一类型抗性照旧）',()=>{
 const wall=(withTrue:boolean):EffectSpec=>({op:'modify',name:'铁壁',duration:{clock:'permanent',value:0},modifiers:[{stat:'reduction_physical',flat:.999},{stat:'reduction_energy',flat:.999},{stat:'reduction_mental',flat:.999},...(withTrue?[{stat:'reduction_true',flat:.999}]:[])]} as EffectSpec);
 const setup=(lv:number,withTrue:boolean)=>{const b=duel(kit(20,[blank()]),foeKit(lv));return applyBattleEffects(b,'u0',{target:'self',cost:{hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}},castMs:0,recoveryFactor:1,perBattleUses:0,effects:[wall(withTrue)]},['u0']);};
 const full=once(setup(20,true));assert.ok(full.loss>=20000*.2-1&&full.loss<=20000*.2+1,'同级：至少吃原始伤害的20%（'+full.loss+'）');
 assert.ok(full.b.log.some(l=>l.kind==='negation_capped'));
 assert.ok(once(setup(15,true)).loss<100,'低等级：99.9%照常');
 assert.ok(once(setup(20,false)).loss<100,'真实伤害没被减：不算全覆盖，不受上限');
});

test('单一属性免疫不算完全抵消：免疫火挡住同级（更慢）敌人的火属性攻击，不扣预算',()=>{
 const k=kit(20,[passive({steps:[{do:'ir',effect:{op:'rule',rule:'immune_element',key:'火',duration:{clock:'permanent',value:0}}}]} as never,'火免')],{hp:1e5,mp:1000,sp:1000},40);
 const r=run(duel(k,foeKit(20)),40,hit('/技能/火击'));
 assert.equal(r.taken.u0??0,0);assert.equal(r.count('negation_budget'),0);
});

test('承伤上限：正常的“每回合最多掉30%”第一下不被抬高；同回合额度用完后再挨的命中走预算',()=>{
 const k=kit(20,[passive({steps:[{do:'damage_cap',pct:30}]},'三成上限')]);
 const first=once(duel(k,foeKit(20)),strike(1e7));assert.equal(first.loss,30000);
 const second=once(first.b,strike(1e7));assert.equal(second.loss,0,'预算内：同回合第二下被上限挡住');
 assert.ok(second.b.log.some(l=>l.kind==='negation_budget'&&l.unit==='u0'));
});

test('L06 不可选中 / L03 自我隔离：每回合扣预算，用完后同级敌人可以选中；遗物的不可选中不受影响',()=>{
 const hide=kit(20,[passive({steps:[{do:'untargetable',turns:99}]},'隐匿')]);
 const iso=kit(20,[passive({steps:[{do:'status',status:'隔离',permanent:true,target:{side:'self'}}]},'自隔离')]);
 for(const k of [hide,iso]){
  const r=run(duel(k,foeKit(20)),60,hit());assert.ok((r.acted.u1??0)>0,'预算用完后敌人能出手');assert.equal(r.count('negation_budget'),5);
  const low=run(duel(k,foeKit(15)),40,hit());assert.equal(low.acted.u1??0,0,'低等级敌人始终选不中');
 }
 let b=duel(kit(20,[blank()]),foeKit(20));
 b=applyBattleEffects(b,'u0',{target:'self',cost:{hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}},castMs:0,recoveryFactor:1,perBattleUses:0,effects:[{op:'rule',rule:'untargetable',key:'*',duration:{clock:'permanent',value:0},priority:90,absolute:true} as EffectSpec]},['u0'],'effect','relic/r50/0');
 const relic=run(b,40,hit());assert.equal(relic.acted.u1??0,0,'遗物来源不计预算');assert.equal(relic.count('negation_budget'),0);
});

test('自我封印（ir sealed 自身）：谁也碰不到也算完全抵消，预算用完后封印失效',()=>{
 const k=kit(20,[passive({steps:[{do:'ir',effect:{op:'rule',rule:'sealed',key:'*',duration:{clock:'permanent',value:0}},target:{side:'self'}}]} as never,'自封')]);
 // 只剩自己时封印=全灭；带一名队友撑场，敌人只打自封者。
 const trio=(lv:number)=>{const e=(id:string,side:'ally'|'enemy',c:CompiledActor)=>({id,side,card:c,current:{...c.numeric.max},mitigation:mitigation()});return createBattle([e('u0','ally',k),e('u1','enemy',foeKit(lv)),e('u2','ally',kit(20,[blank()],{hp:1e7,mp:1000,sp:1000}))],11);};
 const r=run(trio(20),80,hit());assert.ok((r.acted.u1??0)>0,'预算用完后敌人能出手');assert.equal(r.count('negation_budget'),5);assert.ok(r.b.log.some(l=>l.kind==='decisive_blocked'&&l.detail.includes('自我封印失效')));
 const low=run(trio(15),40,hit());assert.equal(low.acted.u1??0,0,'低等级敌人始终碰不到');
});

test('恐惧/魅惑/变形也算强控：同一来源不能连续施加，同级敌人总能自己行动',()=>{
 for(const control of ['fear','charm','polymorph']){
  const k=kit(20,[active({steps:[{do:'status',status:{name:'控'+control,control,polarity:'negative'},permanent:true,target:{side:'enemy'}}]} as never,'控'+control)],{hp:1e5,mp:1e6,sp:1e6},40);
  const r=run(duel(k,foeKit(20)),60,{u0:[['/技能/控'+control,['u1']]],...hit()});
  assert.ok((r.acted.u1??0)>0,control+'：同级敌人能自己出手');
 }
});

test('永久隐身（自身 hidden）同样按回合扣预算；被标记照常可选',()=>{
 const k=kit(20,[passive({steps:[{do:'status',status:{name:'潜影',control:'hidden',polarity:'positive'},permanent:true,target:{side:'self'}}]} as never,'潜影')]);
 const r=run(duel(k,foeKit(20)),60,hit());assert.ok((r.acted.u1??0)>0,'预算用完后敌人能选中');assert.equal(r.count('negation_budget'),5);
 const low=run(duel(k,foeKit(15)),40,hit());assert.equal(low.acted.u1??0,0,'低等级敌人始终选不中');
});

test('必定闪避（ir 任意 key、永久）同样走预算',()=>{
 const k=kit(20,[passive({steps:[{do:'ir',effect:{op:'rule',rule:'guaranteed_evade',key:'x',duration:{clock:'permanent',value:0}}}]} as never,'永闪')]);
 const r=run(duel(k,foeKit(20)),40,hit('/技能/普通'));assert.ok((r.taken.u0??0)>0);assert.equal(r.count('negation_budget'),5);
});

test('吸收成生命（absorb→hp 100%）：预算用完后不再“挨打回血”',()=>{
 const lib={statuses:{'st:w':{name:'绝对吸收',polarity:'positive',duration:{clock:'permanent',value:0},stack:'refresh',maxStacks:1,dispellable:false,priority:0,tags:[],scaleWithStacks:false,removeOnDeath:true,scope:'battle',reactions:[{kind:'absorb',fraction:1}]}}};
 const k=kit(20,[passive({steps:[{do:'ir',effect:{op:'apply_status',status:'st:w'},library:lib}]} as never,'吸收')]);
 const r=run(duel(k,foeKit(25)),40,hit());assert.ok((r.taken.u0??0)>0);assert.equal(r.b.outcome,'defeat');
});

test('L12 限时不死：之后每个回合再挡致命都计入保命上限；L13 回溯复活计入保命上限',()=>{
 const und=run(duel(kit(20,[passive({steps:[{do:'undying',turns:20}]},'不死二十')]),foeKit(25)),40,hit());
 assert.equal(und.b.outcome,'defeat');assert.ok(und.count('last_stand_capped')>=1);
 const rewind=kit(20,[passive({steps:[],triggers:[{on:'battle_start',steps:[{do:'ir',effect:{op:'time',mode:'snapshot',key:'k',restore:[]}}]},{on:'lethal',steps:[{do:'ir',effect:{op:'time',mode:'rewind',key:'k',restore:['resources']}}]}]} as never,'回溯')]);
 const rw=run(duel(rewind,foeKit(25)),60,hit());assert.equal(rw.b.outcome,'defeat');
 assert.ok(rw.b.log.filter(l=>l.kind==='rewind'&&l.unit==='u0').length<=lastStandLimit(20));
});

test('L14 自定义成正面极性的眩晕：来自敌方时同样可挣脱',()=>{
 const k=kit(20,[active({steps:[{do:'status',status:{name:'圣缚',control:'stun',polarity:'positive'},permanent:true,target:{side:'enemy'}}]} as never,'圣缚')]);
 const r=run(duel(k,foeKit(20)),40,{u0:[['/技能/圣缚',['u1']]],...hit()});
 assert.ok((r.acted.u1??0)>0);assert.ok(r.count('escape','u1')>=1);
});

test('L15 推条：每回合归零/推后100%不再锁死同级敌人；同一来源连续推条被拦下',()=>{
 const reset=kit(20,[passive({steps:[],triggers:[{on:'round',steps:[{do:'atb',mode:'set',value:0,target:{side:'enemy',select:'all'}}]}]} as never,'时滞')]);
 const delay=kit(20,[passive({steps:[],triggers:[{on:'round',steps:[{do:'delay',value:100,target:{side:'enemy',select:'all'}}]}]} as never,'时滞b')]);
 for(const k of [reset,delay]){const r=run(duel(k,foeKit(20)),40,hit());assert.ok((r.acted.u1??0)>0);}
 const low=run(duel(reset,foeKit(15)),40,hit());assert.equal(low.acted.u1??0,0,'低等级：必定生效');
 let b=duel(kit(20,[blank()]),foeKit(20),3);b=advanceBattle(b,1500).battle;
 const push:ActionSpec={target:'enemy',cost:{hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}},castMs:0,recoveryFactor:1,perBattleUses:0,effects:[{op:'atb',mode:'retreat',value:20}]};
 b=applyBattleEffects(b,'u0',push,['u1']);b=applyBattleEffects(b,'u0',push,['u1']);
 assert.ok(b.log.some(l=>l.kind==='decisive_blocked'&&l.unit==='u1'&&l.detail.includes('同一来源不能连续控制')));
});

test('几种部分控制叠加（沉默+缴械、敌对隔离）：同一来源在对方行动一次之前不能再上控制',()=>{
 const st=(name:string,control:string):ActionSpec=>({target:'enemy',cost:{hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}},castMs:0,recoveryFactor:1,perBattleUses:0,effects:[{op:'apply_status',status:name}],library:{actions:{},statuses:{[name]:{name,tags:[name],polarity:'negative',control,duration:{clock:'round',value:3},stack:'refresh',maxStacks:1,scaleWithStacks:false,priority:0,dispellable:true,removeOnDeath:false,scope:'battle'}},summons:{},fields:{}}} as unknown as ActionSpec);
 const has=(b:Battle,name:string)=>(U(b,'u1').statuses??[]).some(s=>!s.suppressed&&s.definition.name===name);
 let b=duel(kit(20,[blank()]),foeKit(20));b=applyBattleEffects(b,'u0',st('沉默甲','silence'),['u1']);b=applyBattleEffects(b,'u0',st('缴械乙','disarm'),['u1']);
 assert.ok(has(b,'沉默甲'));assert.ok(!has(b,'缴械乙'),'同一来源连续第二个控制无效');
 let low=duel(kit(20,[blank()]),foeKit(15));low=applyBattleEffects(low,'u0',st('沉默甲','silence'),['u1']);low=applyBattleEffects(low,'u0',st('缴械乙','disarm'),['u1']);
 assert.ok(has(low,'缴械乙'),'低等级目标不受限');
 let iso=duel(kit(20,[blank()]),foeKit(20));iso=applyBattleEffects(iso,'u0',{target:'enemy',cost:{hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}},castMs:0,recoveryFactor:1,perBattleUses:0,effects:[{op:'space',mode:'isolate',value:0,duration:{clock:'round',value:3}}]} as unknown as ActionSpec,['u1']);
 iso=applyBattleEffects(iso,'u0',st('眩晕丙','stun'),['u1']);assert.ok(!has(iso,'眩晕丙'),'敌对隔离之后，同一来源不能紧接着再控');
});

const selfFx=(effects:EffectSpec[]):ActionSpec=>({target:'self',cost:{hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}},castMs:0,recoveryFactor:1,perBattleUses:0,effects} as unknown as ActionSpec);
const forever=(rule:string,key:string,extra:Record<string,unknown>={})=>({op:'rule',rule,key,duration:{clock:'permanent',value:0},...extra} as EffectSpec);
const dr999=(withTrue=false)=>({op:'modify',name:'铁壁',duration:{clock:'permanent',value:0},modifiers:[{stat:'reduction_physical',flat:.999},{stat:'reduction_energy',flat:.999},{stat:'reduction_mental',flat:.999},...(withTrue?[{stat:'reduction_true',flat:.999}]:[])]} as EffectSpec);
/** 给 u0 挂上一组常驻效果（key 以 relic/ 开头时按遗物来源）。 */
const armed=(lv:number,effects:EffectSpec[],key?:string,agility=10)=>applyBattleEffects(duel(kit(20,[blank()],{hp:1e5,mp:1000,sp:1000},agility),foeKit(lv)),'u0',selfFx(effects),['u0'],'effect',key);
const reactLib=(name:string,event:string,scope:string,effect:EffectSpec)=>({actions:{['act:'+name]:selfFx([effect])},statuses:{['st:'+name]:{name,polarity:'positive',duration:{clock:'permanent',value:0},stack:'refresh',maxStacks:1,dispellable:false,priority:0,tags:[],scaleWithStacks:false,removeOnDeath:true,scope:'battle',triggers:[{id:name,event,scope,action:'act:'+name}]}}});

test('转移伤害：把整下伤害反弹给攻击者也算完全抵消，走预算；转给队友不算',()=>{
 const k=kit(20,[passive({steps:[],triggers:[{on:'before_damage',steps:[{do:'ir',effect:{op:'alter_event',mode:'redirect',recipient:'event_source'}}]}]} as never,'移花接木')]);
 const r=run(duel(k,foeKit(20)),40,hit());assert.equal(r.count('negation_budget'),5);assert.ok((r.taken.u0??0)>0,'预算用完后伤害留在自己身上');
 const low=run(duel(k,foeKit(15)),40,hit());assert.equal(low.taken.u0??0,0,'低等级攻击者：照常全部反弹');assert.ok((low.taken.u1??0)>0);
 const guard=kit(20,[passive({steps:[{do:'ir',effect:{op:'apply_status',status:'st:护卫'},library:reactLib('护卫','before_damage','ally',{op:'alter_event',mode:'redirect',recipient:'caster'} as EffectSpec)}]} as never,'护卫')],{hp:1e7,mp:1000,sp:1000});
 const e=(id:string,side:'ally'|'enemy',c:CompiledActor)=>({id,side,card:c,current:{...c.numeric.max},mitigation:mitigation()});
 const ally=run(createBattle([e('u0','ally',kit(20,[blank()])),e('u1','enemy',foeKit(20)),e('u2','ally',guard)],11),20,hit());
 assert.equal(ally.taken.u0??0,0);assert.ok((ally.taken.u2??0)>0,'队友替她挨打');assert.equal(ally.count('negation_budget'),0,'转给队友不是抵消');
});

test('反射状态：被反射回去的眩晕算反射者施加的，同级敌人可以挣脱',()=>{
 const refl=kit(20,[passive({steps:[{do:'ir',effect:{op:'apply_status',status:'st:镜返'},library:reactLib('镜返','before_status','self',{op:'alter_event',mode:'redirect',recipient:'event_source'} as EffectSpec)}]} as never,'镜返')]);
 const foe=kit(20,[active({steps:[{do:'status',status:{name:'石化咒',control:'stun',polarity:'negative'},permanent:true,target:{side:'enemy'}}]} as never,'石化咒'),{id:'/技能/重击',action:strike()}],{hp:1e6,mp:1e6,sp:1e6},40);
 let b=duel(refl,foe);b=applyBattleEffects(b,'u1',U(b,'u1').actions['/技能/石化咒']!,['u0'],'effect','/技能/石化咒');
 const stun=(U(b,'u1').statuses??[]).find(s=>s.definition.name==='石化咒');assert.equal(stun?.source,'u0','反射回去的状态来源是反射者');
 const r=run(duel(refl,foe),60,{u1:[['/技能/石化咒',['u0']],['/技能/重击',['u0']]]});
 assert.ok((r.acted.u1??0)>1,'同级敌人没有被永久定住');assert.ok(r.count('escape','u1')>=1);
});

test('真实反射、承伤缩放同样计入覆盖：配合高减伤不再近乎无伤；单独持有、遗物来源照旧',()=>{
 const near=(n:number,v:number)=>Math.abs(n-v)<=2;
 const tr=armed(20,[forever('true_reflect','*'),dr999()]);
 assert.ok(near(once(tr).loss,4000),'物理：按80%上限（'+once(tr).loss+'）');
 const trT=run(tr,40,{u1:[['/技能/真伤',['u0']]]});assert.equal(trT.count('negation_budget'),5);assert.ok((trT.taken.u0??0)>0,'真伤全弹回只在预算内');
 assert.ok(once(armed(15,[forever('true_reflect','*'),dr999()])).loss<100,'低等级：照旧');
 const only=armed(20,[forever('true_reflect','*')]);const o=once(only,strike(20000,{channel:'true'}));
 assert.equal(o.loss,0,'只有真实反射（单一类型）：照旧全部弹回');assert.ok(!o.b.log.some(l=>l.kind==='negation_budget'));
 for(const [rule,key] of [['taken_type_scale','物|0.001|0.001'],['dot_scale','0.001|0.001']] as const){
  const hurt=once(armed(20,[forever(rule,key)]));assert.ok(hurt.loss>=3990,rule+' '+key+'：同级至少吃20%（'+hurt.loss+'）');
  assert.ok(once(armed(20,[forever(rule,key)],'relic/r9/0')).loss<=20,'遗物来源照旧');
 }
 const zeroed=run(armed(20,[forever('taken_type_scale','物|-1|-1')]),40,hit());assert.equal(zeroed.count('negation_budget'),5,'缩放成0：完全抵消走预算');assert.ok((zeroed.taken.u0??0)>0);
 assert.equal(once(armed(20,[forever('taken_type_scale','火|0.001|1')])).loss,once(duel(kit(20,[blank()]),foeKit(20))).loss,'只缩一种属性：不算覆盖');
});

test('能力抗性挡住攻击者全部伤害手段时走预算；还有别的伤害进得来的不算（同单一属性免疫）',()=>{
 const wide=run(armed(20,[forever('immune_source','*',{filter:{delivery:'any'}})],undefined,40),40,hit());
 assert.equal(wide.count('negation_budget'),5);assert.ok((wide.taken.u0??0)>0);
 const melee=strike();melee.tags=['近战'];
 const foe=kit(20,[{id:'/技能/近战',action:melee},{id:'/技能/真伤',action:strike(20000,{channel:'true'})}],{hp:1e6,mp:1e6,sp:1e6});
 const b=applyBattleEffects(duel(kit(20,[blank()],{hp:1e5,mp:1000,sp:1000},40),foe),'u0',selfFx([forever('immune_source','*',{filter:{tags:['近战']}})]),['u0']);
 const part=run(b,40,{u1:[['/技能/近战',['u0']]]});assert.equal(part.taken.u0??0,0,'只挡近战：近战照旧无效');assert.equal(part.count('negation_budget'),0);
});

test('比例反转：对一切伤害都覆盖时走预算，用完后按上限结算；单独持有照旧（「?」的本质）',()=>{
 const pct=damageAction(0);const d=pct.effects[0] as Extract<EffectSpec,{op:'damage'}>;d.amounts={physical:{...zero(),maxResource:'hp',maxFraction:.3,resourceSubject:'target'},energy:zero(),mental:zero(),true:zero()} as typeof d.amounts;pct.cost={hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}};
 const foe=kit(20,[{id:'/技能/百分比',action:pct}],{hp:1e6,mp:1e6,sp:1e6});
 const setup=(effects:EffectSpec[])=>applyBattleEffects(duel(kit(20,[blank()]),foe),'u0',selfFx(effects),['u0']);
 const covered=run(setup([forever('percent_to_heal','*'),dr999(true)]),40,{u1:[['/技能/百分比',['u0']]]});
 assert.equal(covered.count('negation_budget'),5);assert.ok((covered.taken.u0??0)>0);
 const plain=run(setup([forever('percent_to_heal','*')]),40,{u1:[['/技能/百分比',['u0']]]});
 assert.equal(plain.taken.u0??0,0);assert.equal(plain.count('negation_budget'),0);
});

test('拼出来的全覆盖：四个单通道格挡、按次数整下吸收的护盾、把伤害转成自己免疫的通道，都走预算',()=>{
 const g=(ch:string)=>({do:'guard',pct:100,next:9999,turns:999,channels:[ch]});
 const four=kit(20,[passive({steps:[g('physical'),g('energy'),g('mental'),g('true')]} as never,'四向格挡')]);
 for(const k of [four,kit(20,[passive({steps:[{do:'shield',amount:1,charges:9999,permanent:true}]} as never,'万次护盾')]),kit(20,[passive({steps:[],triggers:[{on:'round',steps:[{do:'shield',amount:1,charges:1,turns:1,target:{side:'self'}}]}]} as never,'每回合一挡')])]){
  const r=run(duel(k,foeKit(20)),40,hit());assert.equal(r.count('negation_budget'),5);assert.ok((r.taken.u0??0)>0);
 }
 const one=run(duel(kit(20,[passive({steps:[g('physical')]} as never,'物理格挡')]),foeKit(20)),20,hit());assert.equal(one.taken.u0??0,0,'只挡物理：照旧（单一类型）');assert.equal(one.count('negation_budget'),0);
 const three=run(duel(kit(20,[passive({steps:[{do:'shield',amount:1,charges:3,permanent:true}]} as never,'三次护盾')]),foeKit(15)),20,hit());assert.equal(three.count('negation_budget'),0,'低等级来源：照旧');
 const conv={actions:{},statuses:{'st:化心':{name:'化心',polarity:'positive',duration:{clock:'permanent',value:0},stack:'refresh',maxStacks:1,dispellable:false,priority:0,tags:[],scaleWithStacks:false,removeOnDeath:true,scope:'battle',reactions:['physical','energy','true'].map(ch=>({kind:'convert',direction:'incoming',fromChannel:ch,toChannel:'mental',fraction:1}))}}};
 const b=applyBattleEffects(duel(kit(20,[passive({steps:[{do:'ir',effect:{op:'apply_status',status:'st:化心'},library:conv}]} as never,'化心')],{hp:1e5,mp:1000,sp:1000},40),foeKit(20)),'u0',selfFx([forever('immune_channel','mental')]),['u0']);
 const r=run(b,40,hit());assert.equal(r.count('negation_budget'),5);assert.ok((r.taken.u0??0)>0);
});

test('敌方强加的时间压制：减速、加后摇、推条附带后摇最多让同级敌人的行动频率减半；速度-100%不再报错',()=>{
 const imposing=(steps:unknown[])=>kit(20,[active({steps,target:{side:'enemy'}} as never,'压制')]);
 const cases:unknown[][]=[[{do:'debuff',mods:{速度:{mul:.001}},permanent:true,target:{side:'enemy'}}],[{do:'debuff',mods:{速度:{pct:-100}},permanent:true,target:{side:'enemy'}}],
  [{do:'ir',effect:{op:'modify',name:'迟缓',duration:{clock:'permanent',value:0},modifiers:[{stat:'recovery',multiplier:1000}]}}],[{do:'ir',effect:{op:'modify',name:'迟缓',duration:{clock:'permanent',value:0},modifiers:[{stat:'speed',flat:-1}]}}]];
 for(const steps of cases){const r=run(duel(imposing(steps),foeKit(20)),60,{u0:[['/技能/压制',['u1']]],u1:[['/技能/重击',['u0']]]});assert.ok((r.acted.u1??0)>=3,'同级敌人仍能行动：'+JSON.stringify(steps).slice(0,60)+' '+JSON.stringify(r.acted));}
 const slowLow=run(duel(imposing(cases[0]!),foeKit(15)),30,{u0:[['/技能/压制',['u1']]],u1:[['/技能/重击',['u0']]]});assert.ok((slowLow.acted.u1??0)<=1,'低等级：照旧几乎不能动');
 const wait=kit(20,[active({steps:[{do:'ir',effect:{op:'atb',mode:'push',value:0,recoveryFactor:100}}],target:{side:'enemy'}} as never,'凝滞')],{hp:1e5,mp:1000,sp:1000},40);
 const w=run(duel(wait,foeKit(20)),60,{u0:[['/技能/凝滞',['u1']]],u1:[['/技能/重击',['u0']]]});assert.ok((w.acted.u1??0)>=3,'推条附带的后摇：'+JSON.stringify(w.acted));
});

test('敌方强加的输出削弱：全通道削到0算覆盖走预算；只削一个通道照旧；固定值削弱不再报错；强加的属性改写/输出转换不生效',()=>{
 const weak=(mods:object)=>kit(20,[active({steps:[{do:'debuff',mods,permanent:true,target:{side:'enemy'}}]} as never,'削弱')]);
 const plan={u0:[['/技能/削弱',['u1']]],u1:[['/技能/重击',['u0']]]} as Record<string,Plan>;
 const all=run(duel(weak({伤害:{pct:-100}}),foeKit(20)),40,plan);assert.equal(all.count('negation_budget'),5);assert.ok((all.taken.u0??0)>0);
 const phys=run(duel(weak({物理伤害:{pct:-100}}),foeKit(20)),20,plan);assert.equal(phys.taken.u0??0,0,'只削物理：敌人还能换真实伤害，照旧');assert.equal(phys.count('negation_budget'),0);
 assert.doesNotThrow(()=>run(duel(weak({伤害:{add:-1e6}}),foeKit(20)),10,plan),'固定值削弱超过伤害：按0算，不报错');
 const low=run(duel(weak({伤害:{pct:-100}}),foeKit(15)),20,plan);assert.equal(low.taken.u0??0,0,'低等级攻击者：照旧');
 const rw=kit(20,[active({steps:[{do:'ir',effect:{op:'rule',rule:'element_rewrite',key:'*|火',duration:{clock:'permanent',value:0}}}],target:{side:'enemy'}} as never,'改写')],{hp:1e5,mp:1000,sp:1000},40);
 const b=applyBattleEffects(duel(rw,foeKit(20)),'u0',selfFx([forever('immune_element','火')]),['u0']);
 const r=run(b,30,{u0:[['/技能/改写',['u1']]],u1:[['/技能/重击',['u0']]]});assert.ok((r.taken.u0??0)>0,'强加的属性改写对同级不生效');
});

test('敌方加税：零消耗的行动和系统指令不受影响，同级敌人不会无路可走',()=>{
 const tax=kit(20,[active({steps:[{do:'ir',effect:{op:'modify',name:'重税',duration:{clock:'permanent',value:0},modifiers:[{stat:'cost_mp',flat:1e7},{stat:'cost_sp',flat:1e7},{stat:'cost_hp',flat:1e7}]}}],target:{side:'enemy'}} as never,'重税')]);
 const r=run(duel(tax,foeKit(20)),30,{u0:[['/技能/重税',['u1']]],u1:[['/技能/重击',['u0']]]});assert.ok((r.acted.u1??0)>=3);
 let b=duel(tax,foeKit(20));b=applyBattleEffects(b,'u0',U(b,'u0').actions['/技能/重税']!,['u1'],'effect','/技能/重税');
 assert.equal(costFor(U(b,'u1'),U(b,'u1').actions['booksea:wait']!,'booksea:wait').mp,0,'系统指令不受消耗修正');
});

test('时间回溯：对同级敌人回溯行动条是强控（同一来源不能连续），把生命退回更低只对低等级有效',()=>{
 const tk=kit(20,[active({steps:[{do:'ir',effect:{op:'time',mode:'snapshot',key:'k',restore:[]}}],target:{side:'enemy'}} as never,'定格'),active({steps:[{do:'ir',effect:{op:'time',mode:'rewind',key:'k',restore:['atb']}}],target:{side:'enemy'}} as never,'倒带'),active({steps:[{do:'ir',effect:{op:'time',mode:'rewind',key:'k',restore:['resources']}}],target:{side:'enemy'}} as never,'回血')]);
 let b=duel(tk,foeKit(20));const act=(id:string)=>{b=applyBattleEffects(b,'u0',U(b,'u0').actions[id]!,['u1'],'effect',id);};
 act('/技能/定格');b=advanceBattle(b,2000).battle;act('/技能/倒带');act('/技能/倒带');
 assert.ok(b.log.some(l=>(l.kind==='decisive_blocked'||l.kind==='escape')&&l.unit==='u1'&&String(l.detail).includes('时间回溯')),'连续回溯行动条：挣脱或被挡');
 const u1=()=>U(b,'u1'),hp=u1().max.hp;
 u1().current.hp=hp;act('/技能/定格');u1().current.hp=hp/2;act('/技能/回血');assert.equal(u1().current.hp,hp,'把生命退回更高：可以');
 u1().current.hp=hp/2;act('/技能/定格');u1().current.hp=hp;act('/技能/回血');assert.equal(u1().current.hp,hp,'把生命退回更低：同级无效');
});

test('L16 99% / 万次取消行动：同级敌人仍能行动',()=>{
 const k=kit(20,[passive({steps:[],triggers:[{on:'enemy_action',steps:[{do:'cancel',chance:0.99}]}]} as never,'预言')]);
 const r=run(duel(k,foeKit(20)),40,hit());assert.ok((r.taken.u0??0)>0);assert.ok(r.cancelled<(r.acted.u1??0));
 const k3=kit(20,[passive({steps:[],triggers:[{on:'enemy_action',uses:10000,steps:[{do:'cancel'}]}]} as never,'预言万次')]);
 assert.ok((run(duel(k3,foeKit(25)),40,hit()).taken.u0??0)>0);
});

test('L17/R-1 封锁全部：待机/防御永远可用；同级敌人能挣脱并出手；AI 兜底让过本回合',()=>{
 const seal=kit(20,[active({steps:[{do:'seal',what:'all',permanent:true}],target:{side:'enemy'}} as never,'万法封禁')],{hp:1e5,mp:1e6,sp:1e6},40);
 let b=duel(seal,foeKit(20));b=advanceBattle(b,1e6).battle;
 b=resolveAction(chooseAction(b,'u0','/技能/万法封禁',['u1']));
 assert.equal(actionUnavailable(b,U(b,'u1'),'booksea:wait',['u1']),'');assert.equal(actionUnavailable(b,U(b,'u1'),'booksea:guard',['u1']),'');
 const r=run(duel(seal,foeKit(20)),40,{u0:[['/技能/万法封禁',['u1']]],...hit()});assert.ok((r.acted.u1??0)>0,'同级敌人能挣脱并出手');
 const low=run(duel(seal,foeKit(15)),40,{u0:[['/技能/万法封禁',['u1']]],...hit()});assert.equal(low.acted.u1??0,0,'低等级：封锁必定生效');
 let c=duel(seal,foeKit(20),5);for(let i=0;i<6&&c.clock.pending[0]?.unitId!=='u1';i++){c=advanceBattle(c,1e6).battle;if(c.clock.pending[0]?.kind==='resolve')c=resolveAction(c);else if(c.clock.pending[0]?.unitId==='u0'){c=chooseAction(c,'u0','booksea:wait',['u0']);while(c.clock.pending[0]?.kind==='resolve')c=resolveAction(c);}}
 if(c.clock.pending[0]?.kind==='ready'&&c.clock.pending[0].unitId==='u1')assert.doesNotThrow(()=>passTurn(c,'u1'));
});

test('L18 交换生命只对低等级目标生效',()=>{
 const k=kit(20,[active({steps:[{do:'swap',what:'hp'}],target:{side:'enemy'}} as never,'换命')],{hp:1e5,mp:1e6,sp:1e6});
 for(const [lv,swapped] of [[20,false],[25,false],[15,true]] as const){
  const b=duel(k,foeKit(lv));U(b,'u0').current.hp=1;
  const r=run(b,2,{u0:[['/技能/换命',['u1']]],u1:[['/技能/重击',['u0']]]});
  assert.equal(U(r.b,'u1').current.hp<=1,swapped,'敌方'+lv+'级');
 }
});

test('L19 absolute 只认遗物：能力里写的 absolute 永久免疫对同级无效，遗物的照常',()=>{
 const k=kit(20,[passive({steps:[{do:'ir',effect:{op:'rule',rule:'immune_channel',key:'*',absolute:true,duration:{clock:'permanent',value:0}}}]} as never,'绝对免疫')]);
 assert.ok((run(duel(k,foeKit(20)),40,hit()).taken.u0??0)>0);
 let b=duel(kit(20,[blank()]),foeKit(25));
 b=applyBattleEffects(b,'u0',{target:'self',cost:{hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}},castMs:0,recoveryFactor:1,perBattleUses:0,effects:[{op:'rule',rule:'immune_element',key:'火',duration:{clock:'permanent',value:0},priority:90,absolute:true} as EffectSpec]},['u0'],'effect','relic/r7/0');
 assert.equal(once(b,strike(20000,{element:'火'})).loss,0,'遗物 absolute 照常直接生效');
});

test('P2-2 atb 的 mode 同义词：delay→retreat，extra_turn→extra，haste→push',()=>{
 const mode=(s:Record<string,unknown>)=>{const a=bp({kind:'active',steps:[s],target:{side:'enemy'}} as unknown as Blueprint,'atb');const e=JSON.stringify(a).match(/"op":"atb","mode":"(\w+)"/);return e?.[1];};
 assert.equal(mode({do:'atb',mode:'delay',value:100}),'retreat');
 assert.equal(mode({do:'atb',mode:'extra_turn'}),'extra');
 assert.equal(mode({do:'atb',mode:'haste',value:30}),'push');
 assert.equal(mode({do:'delay',value:100}),'retreat');
});

test('审查：领域型有界无敌登记为有界（P2-1）；反应式/次数型续期、冷却轮换、敌方行动回蓝判为变相常驻（L07–L10）',()=>{
 const field=active({cooldown:5,steps:[{do:'field',name:'圣域',affects:'ally',mods:[{stat:'受到伤害',mul:0}],turns:3}]} as never,'圣域');
 field.action.cost={...field.action.cost,mp:{flat:0,maxFraction:1}};
 const fb=duel(kit(20,[field]),foeKit(20));assert.equal(U(fb,'u0').invuln?.['/技能/圣域'],'bounded');
 const immune1=(extra:Record<string,unknown>={})=>({do:'immune',to:['damage'],turns:1,target:{side:'self'},...extra});
 const audit=(skills:Skill[],max={hp:1e5,mp:1e6,sp:1e6})=>U(duel(kit(20,skills,max),foeKit(20)),'u0').invuln??{};
 assert.equal(audit([passive({steps:[],triggers:[{on:'enemy_action',steps:[immune1()]}]} as never,'预判圣盾')])['/技能/预判圣盾'],'perpetual');
 assert.equal(audit([passive({steps:[],triggers:[{on:'round',steps:[immune1({uses:9})]}]} as never,'九次圣盾')])['/技能/九次圣盾'],'perpetual');
 const three=['甲','乙','丙'].map(n=>active({cost:{mp:1},cooldown:2,steps:[immune1()]} as never,'短盾'+n));
 const rot=audit(three);for(const n of ['甲','乙','丙'])assert.equal(rot['/技能/短盾'+n],'perpetual','三个“冷却2持续1”轮换覆盖100%');
 const two=audit(three.slice(0,2));for(const n of ['甲','乙'])assert.equal(two['/技能/短盾'+n],'bounded','两个只覆盖2/3');
 const aegis=active({steps:[{do:'immune',to:['damage'],turns:1,target:{side:'ally',select:'all'}}]} as never,'圣盾');aegis.action.cost={...aegis.action.cost,mp:{flat:0,maxFraction:1}};
 assert.equal(audit([aegis],{hp:1e5,mp:1000,sp:1000})['/技能/圣盾'],'bounded');
 assert.equal(audit([aegis,passive({steps:[],triggers:[{on:'enemy_action',steps:[{do:'heal',resource:'mp',pct:100,target:{side:'self'}}]}]} as never,'以彼之力')],{hp:1e5,mp:1000,sp:1000})['/技能/圣盾'],'perpetual');
});

test('审查不看迷宫遗物：遗物被动不登记',()=>{
 const perm:ActionSpec={target:'self',cost:{hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}},castMs:0,recoveryFactor:1,perBattleUses:0,effects:[{op:'rule',rule:'immune_channel',key:'*',duration:{clock:'permanent',value:0}} as EffectSpec]};
 const u={actions:{},passives:{'relic/r9/0':perm,'/技能/常驻':perm},library:undefined,max:{hp:1e5,mp:1000,sp:1000},current:{hp:1e5,mp:1000,sp:1000},stats:{}} as never;
 const r=auditInvulnerability(u);assert.equal(r['relic/r9/0'],undefined);assert.equal(r['/技能/常驻'],'perpetual');
});
