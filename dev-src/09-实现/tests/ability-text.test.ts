import test from 'node:test';
import assert from 'node:assert/strict';
import {lowerBlueprint} from '../src/compiler/blueprint/lower';
import type {Blueprint} from '../src/compiler/blueprint/types';
import {validateAction,type ActionSpec,type StatusSpec} from '../src/compiler/contract';
import {describeAction,effectText,statusSummary} from '../src/ui/ability-text';

const lower=(steps:Blueprint['steps'])=>validateAction(lowerBlueprint({kind:'active',steps},{key:'description',sourceId:'/技能/description',name:'技能',level:20,tier:5,power:3000,cost:4000,attributeFactor:1,attributes:{力量:40,敏捷:40,体质:40,智力:40,精神:40},passive:false}).action) as ActionSpec;
const blank=():ActionSpec=>({target:'self',cost:{hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}},castMs:0,recoveryFactor:1,perBattleUses:0,effects:[],library:{actions:{},statuses:{},fields:{},summons:{}}});
const status=(name:string):StatusSpec=>({name,tags:[],polarity:'negative',duration:{clock:'round',value:3},stack:'refresh',maxStacks:1,scaleWithStacks:false,priority:0,dispellable:true,removeOnDeath:true,scope:'battle'});

test('领域说明展示实际覆盖阵营、控制、属性与每轮效果',()=>{
 const a=lower([{do:'field',name:'沉默寒域',affects:'all',control:'silence',mods:[{stat:'速度',pct:-30}],dotPct:5,turns:4}]);
 const text=describeAction(a).join('；');
 assert.match(text,/展开沉默寒域，4轮/);
 assert.match(text,/全体目标（敌我皆可）/);
 assert.match(text,/无法施放法术/);
 assert.match(text,/速度 ×0.7/);
 assert.match(text,/每1轮/);
 assert.match(text,/目标最大生命的5%/);
 assert.doesNotMatch(text,/Unknown|undefined/);
 const field=a.effects.find(e=>e.op==='field')!;
 assert.doesNotMatch(effectText({...field,remove:true},a),/速度|无法施放|每1轮/,'结束领域时不应描述为再次施加效果');
});

test('领域和形态附带的状态触发器展示事件、次数和实际后续效果',()=>{
 const a=lower([{do:'field',name:'治疗圣域',affects:'ally',turns:3,perRound:[{do:'heal',amount:120,target:{side:'ally',select:'all'}}]},{do:'form',name:'烈焰化身',turns:3,perRound:[{do:'damage',power:500,channel:'energy',target:{side:'enemy',select:'all'}}]}]);
 const text=describeAction(a).join('；');
 assert.match(text,/每轮/);
 assert.match(text,/恢复120点生命/);
 assert.match(text,/造成500.*点能量伤害/);
 assert.match(text,/全体同伴/);
 assert.match(text,/全体敌方/);
});

test('召唤说明展示等级、面板继承与召唤物的实际技能',()=>{
 const a=lower([{do:'summon',summon:{name:'冰灵',count:2,turns:3,inheritPct:40,steps:[{do:'heal',amount:200,target:{side:'ally'}}]}}]);
 const text=describeAction(a).join('；');
 assert.match(text,/召唤2名冰灵/);
 assert.match(text,/同级/);
 assert.match(text,/40%/);
 assert.match(text,/恢复200点生命/);
});

test('条件、检定与随机技能展开每一个实际分支',()=>{
 const a=lower([{do:'branch',when:[{kind:'hp_below',value:50}],then:[{do:'heal',amount:100}],else:[{do:'shield',amount:200}]},{do:'check',attr:'精神',success:[{do:'status',status:'沉默',turns:2}],failure:[{do:'damage',power:300,channel:'mental'}]},{do:'random',options:[[{do:'heal',amount:400}],[{do:'shield',amount:500}]]}]);
 const text=describeAction(a).join('；');
 for(const pattern of [/自身生命低于50%/,/恢复100点生命/,/200点护盾/,/施加沉默/,/300.*点精神伤害/,/恢复400点生命/,/500点护盾/])assert.match(text,pattern);
});

test('具名控制状态保留原状态名，并显示全部合同控制的实际限制',()=>{
 const a=blank();
 const impacts={petrify:'无法行动',knockdown:'无法行动',disarm:'无法使用非法术攻击',polymorph:'只能普通攻击、防御或待机',no_action:'无法进行动作'};
 for(const [control,impact]of Object.entries(impacts)){
  a.library!.statuses.custom={...status('破绽'),control:control as StatusSpec['control']};
  const text=effectText({op:'apply_status',status:'custom'},a);
  assert.match(text,/施加破绽/);assert.ok(text.includes(impact),text);assert.doesNotMatch(text,/Unknown|undefined/);
 }
});

test('长动作链完整展开，状态异步循环引用显示名称而不无限展开',()=>{
 const a=blank(),lib=a.library!;
 for(let i=0;i<6;i++)lib.actions['a'+i]={...blank(),name:'阶段'+i,effects:i<5?[{op:'sequence',action:'a'+(i+1),repeat:1}]:[{op:'heal',resource:'hp',amount:{flat:777,attribute:'none',factor:0,scale:'flat',maxResource:'none',maxFraction:0}}]};
 a.effects=[{op:'sequence',action:'a0',repeat:1}];
 assert.match(describeAction(a).join('；'),/恢复777点生命/);
 lib.statuses.loop={...status('复燃'),tick:{interval:1,clock:'round',count:0,action:'loop'}};
 lib.actions.loop={...blank(),effects:[{op:'apply_status',status:'loop'}]};
 a.effects=[{op:'apply_status',status:'loop'}];
 assert.match(describeAction(a).join('；'),/每1轮.*施加复燃/);
 assert.ok(describeAction(a).join('；').length<200);
});

test('状态详情展示触发、反击和到期动作，周期条件使用子动作的目标上下文',()=>{
 const a=blank(),lib=a.library!;
 lib.actions.heal={...blank(),name:'回春',target:'ally',effects:[{op:'heal',resource:'hp',amount:{flat:88,attribute:'none',factor:0,scale:'flat',maxResource:'none',maxFraction:0},targeting:{side:'ally',selection:'manual'}}]};
 lib.statuses.custom={...status('回春守护'),tick:{interval:2,clock:'round',count:3,action:'heal'},triggers:[{id:'t',event:'round',scope:'self',action:'heal',chance:.5,uses:2}],reactions:[{kind:'counter',action:'heal',uses:1}],onExpire:'heal',breakOnDamage:true};
 a.targeting={side:'any',selection:'manual'};a.effects=[{op:'apply_status',status:'custom'}];
 const text=describeAction(a).join('；');
 assert.match(text,/每2轮.*最多3次/);assert.match(text,/每轮.*50%概率.*恢复88点生命.*每场2次/);
 assert.match(text,/反击.*恢复88点生命/);assert.match(text,/结束时.*恢复88点生命/);
 assert.match(text,/受伤后解除/);assert.doesNotMatch(text,/对同伴：/,'嵌套技能自己的目标不应被父级敌我两用规则污染');
 assert.match(statusSummary(lib.statuses.custom,lib),/恢复88点生命/);
});

test('逐段命中附带状态与反击动作完整展示伤害和状态效果',()=>{
 const a=lower([{do:'damage',power:3000,hits:2,onHit:[{do:'status',status:'流血',turns:2}]},{do:'counter',power:800,turns:2}]);
 const text=describeAction(a).join('；');
 assert.match(text,/每段命中.*施加流血/);
 assert.match(text,/反击.*造成800.*点物理伤害/);
});

test('分身按执行器复制自身面板与技能，不冒称使用召唤模板招式',()=>{
 const a=lower([{do:'clone',summon:{name:'镜像',turns:2,inheritPct:10,steps:[{do:'heal',amount:999}]}}]);
 const text=describeAction(a).join('；');
 assert.match(text,/复制自身基础属性、资源上限、主动技能及其使用次数/);
 assert.doesNotMatch(text,/继承自身10%|恢复999点生命/);
});
