/** Authored IR clause witnesses, NOT live-model or full-character compilation. */
import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createCompilationEngine,validateCompiled,CompilationBlocked} from '../src/compiler/engine';
import {EFFECT_VERSION,EMPTY_LIBRARY,type ActionSpec,type EffectSpec,type StatusSpec,type MappingSpec} from '../src/compiler/contract';
import {createBattle,applyBattleEffects,type Battle} from '../src/battle/executor';
import {ADVANCED_EXAMPLES} from '../src/compiler/advanced-examples';
import {cleanSource,rules,card,zero,flat,mitigation} from './compiler-fixtures';
const corpusUrl=new URL('../../02-宿主参考-只读/反派角色.json',import.meta.url);
const raw=readFileSync(corpusUrl),sha256=createHash('sha256').update(raw).digest('hex');
const corpus=JSON.parse(raw.toString('utf8')) as {entries:Record<string,{comment:string;content:string}>};
const duration={clock:'permanent' as const,value:0};
const action=(effects:EffectSpec[],target:ActionSpec['target']='self'):ActionSpec=>({target,cost:{hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}},castMs:0,recoveryFactor:1,perBattleUses:0,effects});
const status=(name:string,extra:Partial<StatusSpec>={}):StatusSpec=>({name,tags:[name],polarity:'positive',duration,stack:'refresh',maxStacks:1,scaleWithStacks:true,priority:0,dispellable:true,removeOnDeath:false,scope:'battle',...extra});
const hit=(n:number):Extract<EffectSpec,{op:'damage'}>=>({op:'damage',amounts:{physical:zero(),energy:zero(),mental:zero(),true:flat(n)},element:'none',hitChance:1,hitRule:'guaranteed',critChance:0,critMultiplier:1});
const grant=(d:StatusSpec)=>({...action([{op:'apply_status',status:d.name}]),library:{...EMPTY_LIBRARY(),statuses:{[d.name]:d}}});
const example=(name:string)=>structuredClone(ADVANCED_EXAMPLES.find(x=>x.name===name)!.mapping.action);
const names=['NDL-KM-DOLL001-BLADE','NDL-KM-DOLL002-LIGHT','NDL-KM-DOLL003-GUN'];
const life=()=>action([{op:'link',mode:'life',key:'bond',members:{side:'ally',selection:'all',life:'any',names},minimumMembers:3,duration,delayRounds:1,recovery:{hp:.5,mp:.5,sp:.5},cleanse:true}]);
const volley=action([{op:'repeat',action:'aim',count:[{constant:15}],limit:15}],'enemy');volley.library={...EMPTY_LIBRARY(),actions:{aim:action([{op:'branch',when:[{kind:'expression',expression:[{read:'event',key:'pair_attempts'}],compare:'eq',value:14}],then:'big',otherwise:'shot',targeting:{side:'enemy',selection:'random',count:1}}],'enemy'),big:action([hit(5000)],'enemy'),shot:action([hit(1000)],'enemy')}};
const charm=action([{op:'apply_status',status:'control',targeting:{side:'enemy',selection:'all',range:1000},conditions:[{kind:'expression',expression:[{read:'tier',subject:'target'}],compare:'lt',compareExpression:[{read:'tier',subject:'caster'}]}]}],'enemy');charm.library={...EMPTY_LIBRARY(),statuses:{control:status('control',{control:'charm',duration:{clock:'round',value:3},polarity:'negative'})}};
const clone=action([{op:'summon',mode:'clone',template:'shadow',count:1}]);clone.library={...EMPTY_LIBRARY(),actions:{wait:action([{op:'atb',mode:'set',value:0}])},summons:{shadow:{name:'shadow',level:'caster',inheritance:0,resources:{hp:0,mp:0,sp:0},attributes:{力量:0,敏捷:0,体质:0,智力:0,精神:0},actions:['wait'],duration,ownerDeath:'despawn',limit:1,rewardEligible:false,inheritPassives:true}}};
const aura=action([{op:'modify',name:'independent guard',modifiers:(['physical','energy','mental'] as const).map(c=>({stat:`reduction_${c}` as const,multiplier:.8})),duration,targeting:{side:'ally',selection:'all'}}]);
const twins=action([{...hit(0),amounts:{physical:zero(),energy:zero(),mental:zero(),true:{...zero(),maxResource:'hp',maxFraction:.5,subject:'target'}},bypass:['shield','reduction']},{...hit(50000),bypass:['shield','reduction']}],'enemy');
type Witness={entry:number;name:string;quote:string;program:ActionSpec;passive?:boolean;round?:boolean;check:(b:Battle)=>void};
const witnesses:Witness[]=[
 {entry:0,name:'荣枯古龙／受到治疗倍率',quote:'受到治疗效果提升50%',program:action([{op:'modify',name:'received healing',modifiers:[{stat:'heal_received',multiplier:1.5}],duration}]),passive:true,check:b=>assert.equal(b.units[0]!.stats!.heal_received,1.5)},
 {entry:1,name:'塞尔塞特／一次绝对闪避',quote:'赋予[绝对闪避]效果(1次/战斗)',program:action([{op:'rule',rule:'guaranteed_evade',key:'*',uses:1,duration}]),passive:true,check:b=>assert.equal(b.units[0]!.statuses!.find(x=>x.rule?.kind==='guaranteed_evade')!.rule!.uses,1)},
 {entry:2,name:'格罗姆／三次保1HP',quote:'受到致死伤害时保留1点HP(每场战斗3次)',program:action([{op:'rule',rule:'death_guard',key:'*',uses:3,amount:flat(1),duration}]),passive:true,check:b=>assert.equal(b.units[0]!.statuses!.find(x=>x.rule?.kind==='death_guard')!.rule!.uses,3)},
 {entry:3,name:'阿莫尔／按层级过滤控制',quote:'强行控制半径一公里内所有层级低于自己的目标3回合',program:charm,round:true,check:b=>assert.equal(b.units[3]!.statuses!.find(x=>x.definition.control==='charm')!.remaining,3)},
 {entry:4,name:'扎托克斯／真实通道减伤',quote:'受到的真实伤害-50%',program:action([{op:'reduction',channel:'true',fraction:.5}]),passive:true,check:b=>assert.equal(b.units[0]!.stats!.reduction_true,.5)},
 {entry:5,name:'DOLL001／实名生命链接',quote:'仅当自己与 NDL-KM-DOLL002-LIGHT 和 NDL-KM-DOLL003-GUN 三人同时死亡/被封印时才会真的死亡/被封印，否则在下回合时自动驱散所有负面效果以50%HP+MP+SP状态复活',program:life(),passive:true,round:true,check:b=>assert.equal(b.lifeLinks![0]!.members.length,3)},
 {entry:6,name:'DOLL002／实名生命链接',quote:'仅当自己与 NDL-KM-DOLL001-BLADE 和 NDL-KM-DOLL003-GUN 三人同时死亡/被封印时才会真的死亡/被封印，否则在下回合时自动驱散所有负面效果以50%HP+MP+SP状态复活',program:life(),passive:true,round:true,check:b=>assert.deepEqual(b.lifeLinks![0]!.recovery,{hp:.5,mp:.5,sp:.5})},
 {entry:7,name:'DOLL003／十五次发动与末击倍率',quote:'多段攻击，威力: 每段1000。对范围内所有敌人进行共计15次攻击。若15次均对同一目标发动，最后一次攻击造成500%伤害',program:volley,check:b=>assert.equal(b.log.filter(x=>x.kind==='damage'&&x.unit==='u3').length,15)},
 {entry:8,name:'爱丽儿／不死与到期恢复',quote:'通过歌声清除单一目标身上所有负面状态，并进入2回合的[不死]状态(HP归零也不会死亡)；2回合后为目标恢复50%最大HP',program:example('有尽终曲'),round:true,check:b=>assert.ok(b.units[0]!.statuses!.some(x=>x.rule?.kind==='undying'),'夜莺条款必须生成零血不死而非保1HP')},
 {entry:9,name:'凯伊／易伤倍率',quote:'受到伤害增加25%',program:action([{op:'modify',name:'vulnerable',modifiers:[{stat:'vulnerability',multiplier:1.25}],duration,targeting:{side:'enemy',selection:'all'}}],'enemy'),check:b=>assert.equal(b.units[3]!.stats!.vulnerability,1.25)},
 {entry:10,name:'诺西娅／非神话指向来源免疫',quote:'免疫所有非神话级的指向性技能或道具效果',program:action([{op:'rule',rule:'immune_source',key:'*',duration,filter:{kinds:['skill','item'],excludeQualities:['mythic'],delivery:'targeted'}}]),passive:true,check:b=>assert.deepEqual(b.units[0]!.statuses!.find(x=>x.rule?.kind==='immune_source')!.rule!.filter!.excludeQualities,['mythic'])},
 {entry:12,name:'芬／克隆技能继承',quote:'分身拥有自身全部技能',program:clone,check:b=>{const u=b.units.find(x=>x.owner==='u0')!;assert.deepEqual(Object.keys(u.actions).sort(),Object.keys(b.units[0]!.actions).sort());}},
 {entry:15,name:'神秘战士Z／泽尼娅／独立减伤光环',quote:'为范围内所有友军提供20%减伤效果(独立加成)',program:aura,passive:true,check:b=>assert.equal(b.units[1]!.mitigation.attributeReduction.physical,1-.8)},
 {entry:16,name:'卡戎号／累计承伤上限',quote:'自身每回合最多受到33%最大HP伤害',program:grant(status('cap',{reactions:[{kind:'damage_cap',reset:'round',amount:{...zero(),maxResource:'hp',maxFraction:.33,subject:'target'}}]})),passive:true,round:true,check:b=>assert.equal(b.units[0]!.statuses!.find(x=>x.definition.name==='cap')!.definition.reactions![0]!.reset,'round')},
 {entry:17,name:'伊瑟利亚／MP抵伤及反弹',quote:'当伊瑟利亚受击时，将自动消耗 MP 100% 减免伤害并等额反弹给攻击方',program:example('魔力镜'),passive:true,check:b=>assert.equal(b.units[0]!.statuses!.find(x=>x.definition.name==='魔力镜')!.definition.reactions![0]!.reflect,1)},
 {entry:18,name:'柳生宗一郎／双刀不可减免',quote:'第一刀将造成不可被减免的敌方50%最大HP固定伤害，第二刀将造成不可被减免的50000点固定伤害',program:twins,check:b=>assert.equal(b.log.filter(x=>x.kind==='damage'&&x.unit==='u3').length,2)}
];
const rows:{entry:number;character:string;quote:string;status:string}[]=[];
for(const w of witnesses)test('只读原文条款编译管线（人工IR，非整卡） '+w.name,async()=>{
 assert.ok(corpus.entries[w.entry]!.content.includes(w.quote),'引用必须逐字来自反派角色原文：'+w.name);
 const source=cleanSource(),id='/技能/clause';source.等级=23;source.生命层级=6;source.技能={clause:{效果:w.quote}};
 const mapping:MappingSpec={sourceId:id,disposition:w.passive?'passive':'active',reason:'只验证摘录条款，使用合成面板，不代表整角色可发布。',action:w.program,fidelity:{mode:w.round?'equivalent':'exact',summary:'人工IR的单条款管线见证；真实模型调用0。',clauses:[{original:w.quote,implementation:'通用效果合同 → 来源绑定 → 战斗运行器'}],changes:w.round?[{original:w.quote,implemented:'回合转换为4000有效战斗毫秒的公共轮；合成面板只用于隔离验证。',reason:'采用现有ATB公共轮等效，非宿主日历时间。'}]:[]}};
 const engine=createCompilationEngine(async()=>({version:EFFECT_VERSION,mappings:[mapping]}),rules),result=await engine.compile(source,undefined,[]),actor=validateCompiled(result.actor);engine.validateSource!(actor,source);
 const entries=Array.from({length:4},(_,i)=>{const c=i===0?actor:card();c.numeric.level=i===3&&w.entry===3?1:actor.numeric.level;c.numeric.max={hp:1e8,mp:100000,sp:100000};return {id:'u'+i,name:names[i]??'enemy',side:i<3?'ally' as const:'enemy' as const,card:c,current:{...c.numeric.max},mitigation:mitigation()};});
 let b=createBattle(entries,17);if(!w.passive)b=applyBattleEffects(b,'u0',b.units[0]!.actions[id]!,[w.program.target==='enemy'?'u3':'u0'],'effect',id);w.check(b);assert.deepEqual(JSON.parse(JSON.stringify(b)),b);
 rows.push({entry:w.entry,character:w.name,quote:w.quote,status:'authored-clause-compiled-and-executed'});
});
test('原文缺项与跨日机制转为明确的近似或同阶替代，不假装精确实现',async()=>{const {validateAction}=await import('../src/compiler/contract');
 for(const [id,quote,reason] of [[15,'受不知名信号干扰，暂不可见','缺少实际技能内容'],[0,'技能生成指导: 包含两个神话级被动技能、两个治疗技能与一个攻击技能','只有生成要求，不得自动捏造技能'],[1,'冷却：7天','没有宿主日历时钟，不能改成本战七回合']] as const){assert.ok(corpus.entries[id]!.content.includes(quote),'负例须来自实际原文');const source=cleanSource();source.技能={missing:{效果:quote}};const engine=createCompilationEngine(async()=>({version:EFFECT_VERSION,mappings:[{sourceId:'/技能/missing',disposition:'unsupported',reason,action:null}]}),rules);const result=validateCompiled((await engine.compile(source,undefined,[])).actor);assert.equal(result.skills.length,1);assert.notEqual(result.skills[0]!.mapping.disposition,'unsupported');assert.notEqual(result.skills[0]!.mapping.fidelity?.mode,'exact');validateAction(result.skills[0]!.mapping.action);}
});
test('原文错名保真：GUN联合技保留DOLL002-BLADE，不默认为DOLL002-LIGHT',()=>{
 const text=corpus.entries[7]!.content;assert.ok(text.includes('仅 NDL-KM-DOLL001-BLADE 和 NDL-KM-DOLL002-BLADE 在场时可使用'),'错名必须保留为待确认项');assert.equal(names.includes('NDL-KM-DOLL002-BLADE'),false);
});
after(()=>{
 assert.equal(createHash('sha256').update(readFileSync(corpusUrl)).digest('hex'),sha256,'原始资料不得被测试修改');const dir=new URL('../verification/compiler-016/',import.meta.url);mkdirSync(dir,{recursive:true});writeFileSync(new URL('corpus-clause-audit.json',dir),JSON.stringify({evidence:'authored IR clause witnesses, NOT live-model or full-card compilation',source:'02-宿主参考-只读/反派角色.json',sha256,worldbookEntries:Object.keys(corpus.entries).length,expectedCharacterClauses:16,passedClauses:rows.length,liveModelRequests:0,fullCardsAccepted:0,rows},null,2)+'\n');
});
