/** 恶意分配器：按层级 × 职能决定每只怪拿到哪些家族、哪一档形态、哪条领域，并做“无解墙检查”。
 *  低层级弱、高层级强由三个旋钮实现：家族数量、形态档位（窗口宽窄）、是否脚本化。数值曲线不变。 */
import type {MonsterDesign} from './catalog';
import {ARENAS,MALICE,type CounterTag,type Family,type Form} from './malice';
import {THEME_EXCLUSIVE,type ExclusiveForm} from './theme-malice';

type Role=MonsterDesign['role'];
type Unlock=[number,number,number];// seed/full/unbound 最早层级；0=永不
const NEVER:Unlock=[0,0,0];
/** §5.1 家族解锁层级。 */
export const UNLOCK:Record<string,Record<Role,Unlock>>={
 multihit:{普通:[1,4,6],精英:[1,3,5],Boss:[1,3,5]},
 extra:{普通:[5,7,0],精英:[4,6,0],Boss:[3,5,7]},
 truestrike:{普通:[2,4,6],精英:[2,4,6],Boss:[2,3,5]},
 percent:{普通:[1,3,6],精英:[1,3,5],Boss:[1,3,5]},
 charge:{普通:[2,4,7],精英:[2,4,6],Boss:[2,3,5]},
 undying:{普通:[6,0,0],精英:[5,7,0],Boss:[3,5,7]},
 regen:{普通:[3,5,0],精英:[3,5,7],Boss:[3,5,7]},
 cap:{普通:[5,0,0],精英:[4,6,0],Boss:[3,5,7]},
 adds:{普通:NEVER,精英:[5,6,7],Boss:[4,5,6]},
 timer:{普通:NEVER,精英:[5,0,0],Boss:[3,5,7]},
 reader:{普通:NEVER,精英:[6,0,0],Boss:[5,6,7]},
 // 0.31 通用原创家族 G1–G12：雏形 t2–4、完全体 t4–6、去反制 t6–7，与 F 系同表、同配额。
 echo:{普通:[3,5,7],精英:[2,4,6],Boss:[2,4,6]},
 devour:{普通:[4,6,0],精英:[3,5,7],Boss:[3,4,6]},
 toll:{普通:[3,5,0],精英:[3,5,7],Boss:[2,4,6]},
 invert:{普通:[4,6,0],精英:[3,5,7],Boss:[3,5,7]},
 sealTax:{普通:[4,6,0],精英:[3,5,7],Boss:[3,5,6]},
 verdict:{普通:[2,4,6],精英:[2,4,6],Boss:[2,4,6]},
 twin:{普通:NEVER,精英:[4,6,7],Boss:[3,5,7]},
 dread:{普通:[3,5,7],精英:[3,5,7],Boss:[2,4,6]},
 thirst:{普通:[4,6,0],精英:[3,5,7],Boss:[3,5,7]},
 gaze:{普通:[3,5,0],精英:[3,5,7],Boss:[2,4,7]},
 mutual:{普通:[2,4,6],精英:[2,4,6],Boss:[3,5,7]},
 borrow:{普通:[4,6,0],精英:[3,5,7],Boss:[3,5,7]},
};
/** §5.2 每只怪的家族配额（不含领域与阶段）。 */
const QUOTA:Record<Role,number[]>={普通:[1,1,2,2,3,4,5],精英:[1,2,3,4,5,6,7],Boss:[1,2,4,5,6,8,10]};
const ARENA_SLOTS:Record<Role,number[]>={普通:[0,0,0,0,0,0,0],精英:[0,0,0,0,1,1,1],Boss:[0,0,0,0,1,1,2]};
const LIGHT_ARENAS=['windless','sanctum','blackwolf'];
export type Slot={id:string;form:Form;family:Family};
export type Exclusive={id:string;form:ExclusiveForm};
export type MalicePlan={slots:Slot[];arenas:string[];exclusive?:Exclusive;rotation:boolean;phaseCarry:boolean;idle:boolean;seals:CounterTag[];counters:CounterTag[];walled:string[]};
/** 主题专属机制已发布到第几个主题：0.32.0 = 24（T01–T24），0.33.0 = 48。 */
export const EXCLUSIVE_THEMES_UPTO=48;
/** 主题专属：Boss t3 起完全体，精英 t5 起雏形，普通怪不拿；不占家族配额，但 seals 计入无解墙检查。 */
export function exclusiveFor(m:MonsterDesign,tier:number):Exclusive|undefined{
 if(!THEME_EXCLUSIVE[m.theme]||Number(m.theme.slice(1))>EXCLUSIVE_THEMES_UPTO)return undefined;
 if(m.role==='Boss'&&tier>=3)return {id:m.theme,form:'full'};
 if(m.role==='精英'&&tier>=5)return {id:m.theme,form:'seed'};
 return undefined;
}
export function hash(s:string):number{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h>>>0;}
const formAt=(u:Unlock,s:number):Form|null=>u[2]&&s>=u[2]?'unbound':u[1]&&s>=u[1]?'full':u[0]&&s>=u[0]?'seed':null;
/** 硬解法：被封掉就少一条“可操作”的路；timer/burst/undying 属于软约束（要求速攻或特定资源），不计入上限。 */
export const HARD_SEALS:CounterTag[]=['evade','guard','break','shield','dispel','command','skill','no_heal','percent'];
const WALL_LIMIT=4,WALL_TRIAD:CounterTag[]=['evade','guard','break'];
export const hardSeals=(seals:Iterable<CounterTag>)=>[...seals].filter(t=>HARD_SEALS.includes(t));
function walled(seals:Set<CounterTag>):string[]{const out:string[]=[];if(hardSeals(seals).length>=WALL_LIMIT)out.push('硬解法封锁≥'+WALL_LIMIT);if(WALL_TRIAD.every(t=>seals.has(t)))out.push('闪避/防御/打断同时被封');if(seals.has('command')&&seals.has('skill'))out.push('指令与技能同时被封');return out;}
const PLAN_CACHE=new Map<string,MalicePlan>();
/** 逐层累加：第 s 层的家族集合包含第 s-1 层的全部家族（形态可升级），保证“层级越高手段越多”严格单调。 */
export function malicePlan(m:MonsterDesign,s:number):MalicePlan{
 const tier=Math.max(1,Math.min(7,s)),key=m.id+'@'+tier;const hit=PLAN_CACHE.get(key);if(hit)return hit;
 const prior=tier>1?malicePlan(m,tier-1):null;const plan=buildPlan(m,tier,prior);PLAN_CACHE.set(key,plan);return plan;
}
function buildPlan(m:MonsterDesign,tier:number,prior:MalicePlan|null):MalicePlan{
 const role=m.role,quota=QUOTA[role][tier-1]!;
 const seed=hash(m.id);
 // t1 普通怪保留 20% “负向样本”：只有空过/回复药式的单一花招（不拿恶意家族）。
 const idle=role==='普通'&&tier===1&&seed%5===0;
 const inherited=(prior?.slots??[]).map(x=>x.id);
 const eligible=Object.entries(UNLOCK).map(([id,u])=>({id,form:formAt(u[role],tier)})).filter((x):x is {id:string;form:Form}=>!!x.form);
 const order=(ids:string[])=>[...ids].sort((a,b)=>hash(m.id+':'+a)-hash(m.id+':'+b));
 const mandatory:string[]=[...inherited];
 const has=(id:string)=>eligible.some(x=>x.id===id);
 const want=(id:string)=>{if(has(id)&&!mandatory.includes(id))mandatory.push(id);};
 if(tier>=2){const pref=order(['charge','truestrike']).find(has);if(pref)want(pref);}
 if(role==='Boss'&&tier>=3)want('undying');
 if(tier>=4)want('multihit');
 if(tier>=5){const pref=order(['undying','timer']).find(has);if(pref)want(pref);}
 if(tier>=7)want('reader');
 if(tier>=6){const unbound=order(eligible.filter(x=>x.form==='unbound').map(x=>x.id)).find(id=>!mandatory.includes(id));if(unbound)mandatory.push(unbound);}
 const rest=order(eligible.map(x=>x.id).filter(id=>!mandatory.includes(id)));
 const chosen:string[]=[];const seals=new Set<CounterTag>();const wall:string[]=[];
 for(const x of prior?.slots??[])MALICE[x.id]!.seals[x.form].forEach(t=>seals.add(t));
 const exclusive=exclusiveFor(m,tier);if(exclusive)THEME_EXCLUSIVE[exclusive.id]!.seals.forEach(t=>seals.add(t));
 const arenas:string[]=[...(prior?.arenas??[])];const arenaCount=ARENA_SLOTS[role][tier-1]!;
 for(const id of arenas)ARENAS.find(a=>a.id===id)!.seals.forEach(t=>seals.add(t));
 if(arenaCount>arenas.length){const pool=tier===5&&role==='精英'?LIGHT_ARENAS:ARENAS.map(a=>a.id);const ordered=order(pool).filter(id=>!arenas.includes(id));for(const id of ordered){if(arenas.length>=arenaCount)break;const a=ARENAS.find(x=>x.id===id)!;const next=new Set([...seals,...a.seals]);if(walled(next).length)continue;arenas.push(id);a.seals.forEach(t=>seals.add(t));}
  // 领域是五阶以上精英/Boss 的招牌：若全部候选都撞墙，则取新增封锁最少、且不触发三连封/指令技能双封的那一条。
  while(arenas.length<arenaCount){const cands=ordered.filter(id=>!arenas.includes(id)).map(id=>({id,a:ARENAS.find(x=>x.id===id)!})).filter(({a})=>{const next=new Set([...seals,...a.seals]);return !walled(next).some(w=>w.includes('同时'));}).sort((x,y)=>x.a.seals.filter(t=>!seals.has(t)).length-y.a.seals.filter(t=>!seals.has(t)).length);const best=cands[0];if(!best)break;arenas.push(best.id);best.a.seals.forEach(t=>seals.add(t));wall.push(best.id+':领域越过封锁上限');}}
 const forms=new Map<string,Form>();
 const tryAdd=(id:string,force:boolean)=>{
  if(idle||chosen.length>=quota)return;let form=eligible.find(x=>x.id===id)!.form;let next=new Set([...seals,...MALICE[id]!.seals[form]]);
  let problems=walled(next);const priorForm=prior?.slots.find(x=>x.id===id)?.form;
  // 继承自低层的家族不得丢失：若升档后撞墙（含硬解法封锁≥4），则保留低层形态（窗口不收窄）。0.31 池扩到 23 后此分支更常触发。
  if(problems.length&&priorForm&&priorForm!==form){wall.push(id+':升档撞墙，保留'+priorForm);form=priorForm;next=new Set([...seals,...MALICE[id]!.seals[form]]);problems=walled(next);}
  // 新增项（无论是否强制）只要撞墙就不进：强制项只保证“优先挑选”，不保证越过无解墙。已继承项永远保留。
  if(problems.length&&!priorForm){wall.push(id+':'+problems.join('，')+(force?'（强制项让位）':''));return;}
  chosen.push(id);forms.set(id,form);MALICE[id]!.seals[form].forEach(t=>seals.add(t));
 };
 for(const id of mandatory)tryAdd(id,true);
 for(const id of rest)tryAdd(id,false);
 const slots:Slot[]=chosen.map(id=>({id,form:forms.get(id)!,family:MALICE[id]!.family}));
 const counters=new Set<CounterTag>();for(const x of slots)MALICE[x.id]!.counter[x.form].forEach(t=>counters.add(t));for(const id of arenas)ARENAS.find(a=>a.id===id)!.counter.forEach(t=>counters.add(t));
 // 最终保险：即使强制项叠出墙，也必须留下至少两种解；否则去掉最后一个非强制项。
 while(walled(seals).length&&slots.length>mandatory.length){const dropped=slots.pop()!;wall.push(dropped.id+':最终保险移除');seals.clear();for(const x of slots)MALICE[x.id]!.seals[x.form].forEach(t=>seals.add(t));for(const id of arenas)ARENAS.find(a=>a.id===id)!.seals.forEach(t=>seals.add(t));}
 return {slots,arenas,...(exclusive?{exclusive}:{}),rotation:role!=='普通'&&tier>=3,phaseCarry:tier>=7,idle,seals:[...seals],counters:[...counters],walled:wall};
}
/** 解法标签的中文名：只用于导出配置表与设计侧统计；游戏内文案不再写“对策”。 */
export const COUNTER_LABEL:Record<CounterTag,string>={evade:'高闪避',guard:'防御/减伤',shield:'护盾吃段',break:'打断读条',hard_break:'重击/控制打断',dispel:'驱散前置',no_heal:'禁疗/持续伤害压回复',percent:'比例伤害',guaranteed:'必中',burst:'血线前爆发',ignore_adds:'无视杂兵打本体',kill_order:'击杀顺序',timer:'倒计时内解决',undying:'不死类效果硬接',fear:'恐惧封其闪避',control:'控制吃掉多动',dot:'持续伤害',command:'指令仍可用',skill:'技能仍可用',buff:'增益可用'};
