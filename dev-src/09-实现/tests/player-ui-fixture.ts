// Synthetic reproduction of the reported UI/compiler failures. Never reads a real chat.
import {fixture,partner} from './fixtures';import {actorAt,object,type Obj} from '../src/core/actors';
import {EFFECT_VERSION} from '../src/compiler/contract';import {action,amount} from '../src/compiler/adaptive';
export function playerUiFixture(core:string){
 const mvu=fixture(),main=object(object(mvu.stat_data).主角),companion=structuredClone(actorAt(mvu,partner())),name='福尔摩斯探案集';
 function setup(a:Obj,level:number,hp:number){a.等级=level;a.生命层级=level===10?'第三层级/稀有':'第四层级/史诗';a.种族='联调无特性测试体';a.性别='女';a.属性={力量:48,敏捷:55,体质:51,智力:68,精神:90};for(const key of ['装备','状态效果','背包'])a[key]={};a.登神长阶={是否开启:false};for(const [key,max]of [['生命值',hp],['法力值',8000],['体力值',8000]]as const)a[key]={当前:max,上限:{_基础:max,额外:0}};a.命定契约=true;a.好感度=90;}
 setup(main,10,2444);setup(companion,16,7051);
 const rest=core.split(/\r?\n/).find(l=>l.includes('开局为<user>添加间章:小憩技能'))!,guard=core.split(/\r?\n/).find(l=>l.includes('开局为<user>添加故事的主人被动技能'))!;
 main.技能={'间章:小憩':{品质:'唯一',类型:'主动',消耗:'MP:0',描述:rest},故事的主人:{品质:'唯一',类型:'被动',消耗:'无',描述:guard}};
 companion.技能={逻辑丝线:{品质:'史诗',类型:'主动',消耗:'MP:800',描述:'将精神力编织为丝线，对目标造成精神伤害。'},侦探直觉:{品质:'史诗',类型:'主动',描述:'在日常调查中发现被忽略的线索。'},未定型的故事:{品质:'唯一',类型:'主动',描述:'将一个尚不存在的叙事意象付诸实践。'}};
 companion.登神长阶={是否开启:true,要素:{秩序禁锢:{描述:'命中后进行精神对抗，成功使目标束缚，持续2回合。'}}};object(mvu.stat_data).关系列表={[name]:companion};object(mvu.stat_data).命运点数=11674;
 const a=action([{op:'damage',amounts:{physical:amount(),energy:amount(),mental:amount(900,'精神',10),true:amount()},element:'none',hitChance:.9,hitRule:'normal',critChance:0,critMultiplier:1.5}],'enemy');a.cost.mp.flat=800;
 const reply={version:EFFECT_VERSION,mappings:[{sourceId:'/技能/逻辑丝线',disposition:'active',reason:'按原文映射',fidelity:{mode:'exact',summary:'保留效果',clauses:[{original:'微弱要素[秩序禁锢]:目标需进行精神对抗检定，失败则附加束缚，持续2回合',implementation:'精神伤害'}],changes:[]},actionJson:JSON.stringify(a)},{sourceId:'/技能/侦探直觉',disposition:'noncombat',reason:'非战斗能力',actionJson:'null'},{sourceId:'/技能/未定型的故事',disposition:'unsupported',reason:'无法直接表达',actionJson:'null'}]};
 return {mvu,chat:{booksea:{settings:{narrative:false}}},messages:[{role:'assistant',message:'隔离的界面测试'}],modelCalls:0,reply,offline:false,writes:0};
}
