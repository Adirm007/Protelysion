import {describeAction} from '../ui/ability-text';
import {type EventChoice,type EventResult} from './mechanism-content';
import {RELIC_CATALOG,RELIC_RARITY_LABEL} from './relic-catalog';
const resources={hp:'生命',mp:'法力',sp:'体力',fp:'待结算 FP'};
export function relicDescription(id:string):string {
 const r=RELIC_CATALOG[id];if(!r)return '遗物资料暂不可用';
 const tags=[...(r.transferable?[]:['不可转移']),...(r.droppable?[]:['不可丢弃'])];
 return `稀有度：${RELIC_RARITY_LABEL[r.rarity]}；作用于${r.scope==='holder'?'持有者':r.scope==='team'?'全队':'敌我全场'}${tags.length?'；'+tags.join('、'):''}。${r.description}${r.passive?'\n战斗效果：'+describeAction(r.passive).join('；'):''}`;
}
export function eventResultDescription(r:EventResult):string {
 if(r.kind==='relic')return '选择1件临时遗物：'+r.choices.map(id=>RELIC_CATALOG[id]?.name??id).join(' / ');
 if(r.kind==='reward')return r.reward==='box'?`获得${r.amount}个${r.quality??'普通'}未开启盲盒（成功撤离结算）`:`获得${r.amount} FP（成功撤离结算）`;
 if(r.kind==='encounter')return `进入事件战斗，至多${r.strength}名敌人；后续奖励在战斗结束后继续处理`;
 if(r.kind==='effect')return describeAction(r.action).join('；');
 if(r.kind==='next')return '继续下一段事件，接下来的代价会再次展示';
 if(r.kind==='flag')return r.id.startsWith('passed:')?'离开此事件，不扣除资源':r.id.startsWith('scouted:')?'记录本区域的探索线索':'记录本次事件结果';
 if(r.kind==='fp')return r.mode==='clear'?'待结算 FP 清零':r.mode==='scale'?`待结算 FP ×${r.amount}`:`FP ${r.amount>=0?'+':''}${r.amount}`;
 if(r.kind==='box')return r.count<0?`消耗 ${-r.count} 个盲盒`:`获得 ${r.count} 个${r.quality==='random'||!r.quality?'随机品质':r.quality}盲盒`;
 if(r.kind==='heal_all')return r.fraction>=0?`全队回复 ${Math.round(r.fraction*100)}% 最大 HP${r.fraction>=1?' / MP / SP':''}`:`全队失去 ${Math.round(-r.fraction*100)}% 最大 HP`;
 if(r.kind==='cleanse_all')return '清除全队全部负面状态';
 if(r.kind==='teleport')return `传送到 ±${r.range} 层内的随机楼层`;
 if(r.kind==='relic_random')return '获得一件随机遗物'+(r.rarity?`（${RELIC_RARITY_LABEL[r.rarity]}）`:'');
 if(r.kind==='relic_grant')return '获得「'+(RELIC_CATALOG[r.id]?.name??r.id)+'」';
 if(r.kind==='relic_transform')return '选择一件遗物转变为同稀有度的另一件';
 if(r.kind==='relic_pick')return r.mode==='sacrifice'?'献祭一件遗物':r.mode==='copy'?'复刻一件遗物给队友':'出售一件遗物';
 if(r.kind==='encounter_tier')return `遭遇战：${r.tier==='boss'?'Boss':r.tier==='elite'?'精英':'普通'} ×${r.count}`+(r.thenRelic?'，胜利后获得遗物':'')+(r.thenFp?`，胜利后 FP +${r.thenFp}`:'')+(r.thenBox?`，胜利后盲盒 ×${r.thenBox}`:'');
 if(r.kind==='item')return `获得传唤铃 ×${r.count}`;
 if(r.kind==='battle_mod')return `接下来 ${r.fights} 场战斗：`+[r.enemyDamage?`敌方伤害 ×${r.enemyDamage}`:'',r.expMul?`经验 ×${r.expMul}`:'',r.materialRate!==undefined?`素材掉率 ×${r.materialRate}`:'',r.enemyDouble?'敌方数量 ×2':'',r.thenRelic?'胜利后获得遗物':''].filter(Boolean).join('、');
 if(r.kind==='seal_skills')return '选择成员并封印 1–3 个技能，每个 +10% 全属性';
 if(r.kind==='member_pick')return r.mode==='train'?'选择成员：下 3 场伤害 ×1.5、速度 ×0.7':r.mode==='bloodpact'?'选择成员：最大 HP −30%，FP +2500':'选择一名成员退出迷宫';
 if(r.kind==='run_mod')return `${r.member==='all'?'全队':'随机一名成员'}：`+[r.maxHp?`最大 HP ×${r.maxHp}`:'',r.maxMp?`最大 MP ×${r.maxMp}`:'',r.speed?`速度 ×${r.speed}`:''].filter(Boolean).join('、')+'（本次迷宫）';
 if(r.kind==='layer_mod')return ({noMaterials:'本层剩余战斗不掉素材',noChase:'本层剩余敌人不主动追击',eliteBounty:`本层精英 +${r.value} FP，普通敌人不给 FP`,enemyAttrs:`本层剩余敌人全属性 ×${r.value}`,strayHaste:`「?」追击速度 ×${r.value}`} as Record<string,string>)[r.key]??r.key;
 if(r.kind==='potions')return r.random?`随机药剂 ×${r.count}`:`恢复药 +${r.count}`;
 if(r.kind==='swap_hp_mp')return '随机成员最大 HP 与最大 MP 互换';
 if(r.kind==='stairs')return r.skipNext?'下一层直达楼梯':'立即前往下一层';
 if(r.kind==='chest_spawn')return '本层刷新一个新宝箱';
 return '立即结算撤离';
}
export function eventChoiceDescription(c:EventChoice,units:readonly {id:string;name?:string;current:{hp:number;mp:number;sp:number}}[]):string {
 const fpCosts=c.costs.filter(p=>p.resource==='fp').map(p=>`待结算 FP −${p.flat}`),unitCosts=c.costs.filter((p):p is typeof p&{resource:'hp'|'mp'|'sp'}=>p.resource!=='fp');
 const costs=[...fpCosts,...(unitCosts.length?units.map(u=>`${u.name??u.id}：`+unitCosts.map(p=>`${resources[p.resource]}-${Math.ceil(u.current[p.resource]*p.fraction+p.flat)}${p.resource==='hp'&&!p.lethal?'（不得致死）':''}`).join('、')):[])].join('；')||'无消耗';
 const results=c.results.map(eventResultDescription).join('；')||'按下列概率决定结果';
 const total=c.risks?.reduce((n,r)=>n+r.weight,0)??0;
 const risk=c.risks?.map(r=>`${Math.round(r.weight/total*1000)/10}%：${r.results.map(eventResultDescription).join('；')}`).join('\n')??'';
 const requirements=c.requirements.map(r=>r.kind==='exploration'?'需要可解锁额外事件选项的探索能力':r.kind==='resource'?`需要${resources[r.key as keyof typeof resources]??r.key}至少${r.amount}`:r.kind==='relic'?'需要持有指定遗物':r.kind==='relic_any'?'需要至少持有一件遗物':r.kind==='fp'?`需要待结算 FP ≥ ${r.amount}`:r.kind==='box'?`需要至少 ${r.amount} 个盲盒`:r.kind==='depth'?`需要到达 ${r.amount} 层以深`:r.kind==='party'?`需要至少 ${r.amount} 名在场成员`:'需要先完成相关事件').join('；');
 return [`代价：${costs}`,`结果：${results}`,risk?'风险分支：\n'+risk:'',requirements?'条件：'+requirements:''].filter(Boolean).join('\n');
}
