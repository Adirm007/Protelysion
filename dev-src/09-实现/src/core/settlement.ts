import { actorAt, integer, object, own, RESOURCES, resourceMax, type ActorRef, type Obj } from './actors';
import type { Reward } from './run';
/** Pure proposed copy. Production commits are deliberately not exposed in stage0. */
export function restoreDeparture(mvu: unknown, ref: ActorRef, bookseaOwnedStateNames: string[] = []): Obj {
  const next = structuredClone(object(mvu));
  const actor = actorAt(next, ref), states = object(actor.状态效果, '状态效果');
  for (const name of bookseaOwnedStateNames) {
    const state = own(states, name);
    if (!state) continue;
    // Exact names are insufficient: preserve pre-existing/non-booksea states.
    if (object(state).来源 === '书海') delete states[name];
  }
  // Caller must supply host-effective post-growth limits, with local modifiers already removed.
  for (const r of RESOURCES) object(actor[r]).当前 = resourceMax(actor, r);
  return next;
}
export function consumeItem(mvu: unknown, owner: ActorRef, name: string, count: number): Obj {
  integer(count, '消耗数量', 1);
  const next = structuredClone(object(mvu));
  const bag = object(actorAt(next, owner).背包, '背包');
  const item = object(own(bag, name), `物品「${name}」`), quantity = integer(item.数量, '库存');
  if (count > quantity) throw new Error('库存不足');
  if (quantity === count) delete bag[name]; else item.数量 = quantity - count;
  return next;
}
export function hostReward(reward: Reward): { name: string; item: Obj } {
  integer(reward.count, '奖励数量', 1);
  if (reward.kind === 'fp') throw Error('FP直接结算到命运点数，不生成背包物品');
  if (reward.kind === 'voucher') {
    integer(reward.faceValue, '券面额', 1);
    return { name: `书海·${reward.faceValue}FP兑换券`, item: {
      品质: '普通', 类型: '消耗品', 数量: reward.count, 标签: ['书海', 'FP兑换券', `面额:${reward.faceValue}`],
      效果: { 兑换: `仅在读者入口由程序扣券后增加${reward.faceValue}FP；获得时不自动兑换。` }, 描述: `来自${reward.source}的未兑换券。`,
    } };
  }
  if (reward.kind === 'gift') return { name: reward.name, item: {
    品质: reward.quality, 类型: reward.itemType, 数量: reward.count, 标签: ['书海', '补给员', `来源:${reward.source}`],
    效果: { 说明: reward.effect }, 描述: reward.description,
  } };
  if (reward.kind === 'material') return { name: reward.name, item: {
    品质: reward.quality, 类型: '材料', 数量: reward.count, 标签: ['书海', '怪物素材', `主题:${reward.theme}`, `区域:${reward.region}`, `来源:${reward.monsterId}`],
    效果: { 素材: reward.effect }, 描述: reward.description,
  } };
  return { name: `${reward.quality}·${reward.style}·${reward.contentType}盲盒`, item: {
    品质: reward.quality, 类型: '消耗品', 数量: reward.count, 标签: ['书海', '盲盒', '未开启', `主题:${reward.style}`, `内容类型:${reward.contentType}`],
    效果: { 待开启: `打开后获得${reward.style}主题随机${reward.quality}${reward.contentType}*1。` }, 描述: `来自${reward.source}的密封盲盒。`,
  } };
}
export function redeemVoucher(mvu: unknown, name: string, count: number): Obj {
  integer(count, '兑换数量', 1);
  const bag = object(actorAt(mvu, { kind: 'player' }).背包);
  const item = object(own(bag, name), '兑换券');
  const match = /^书海·([1-9]\d*)FP兑换券$/.exec(name);
  if (!match || !Array.isArray(item.标签) || !['书海', 'FP兑换券', `面额:${match[1]}`].every(t => (item.标签 as unknown[]).includes(t))) throw new Error('不是可识别的书海兑换券');
  const face = integer(Number(match[1]), '面额', 1), next = consumeItem(mvu, { kind: 'player' }, name, count);
  const stat = object(next.stat_data), current = integer(stat.命运点数, '命运点数');
  stat.命运点数 = integer(current + face * count, '兑换后FP');
  return next;
}

/** Legacy uncommitted vouchers are valued here, never minted into new inventory. */
export function rewardFP(reward:Reward):number {
 if(reward.kind==='box'||reward.kind==='material'||reward.kind==='gift')return 0;
 return integer(integer(reward.kind==='fp'?reward.amount:reward.faceValue,'FP数额',1)*integer(reward.count,'奖励数量',1),'奖励FP',1);
}
/** Same name stacks only when quality/effect match; otherwise a qualified name keeps both items. */
function bagName(bag:Obj,h:{name:string;item:Obj}):string{
 const same=(o:unknown)=>!o||(typeof o==='object'&&(o as Obj).品质===h.item.品质&&JSON.stringify((o as Obj).效果)===JSON.stringify(h.item.效果));
 if(same(bag[h.name]))return h.name;
 const tags=(h.item.标签 as string[]).filter(t=>/^(主题|区域):/.test(t)).map(t=>t.split(':')[1]);
 const alt=`${h.name}（${[h.item.品质,...tags].join('·')}）`;
 if(same(bag[alt]))return alt;
 for(let i=2;;i++)if(same(bag[alt+i]))return alt+i;
}
export function rewardLabel(r:Reward):string{return r.kind==='box'?`${r.quality}·${r.style}·${r.contentType}盲盒`:r.kind==='material'||r.kind==='gift'?`${r.quality}·${r.name}`:`${rewardFP(r)} FP`;}
export function rewardDetail(r:Reward):string{return r.kind==='box'?`打开后获得${r.style}主题随机${r.quality}${r.contentType}*1。`:r.kind==='material'?`${r.effect}。${r.description}`:r.kind==='gift'?`${r.itemType}：${r.effect}。${r.description}`:'成功撤离时直接计入命运点数，无需兑换。';}
export function settleRunRewards(mvu:Obj,rewards:Reward[]):Obj {
 const next=structuredClone(mvu),bag=object(actorAt(next,{kind:'player'}).背包);let fp=0;
 for(const reward of rewards){
  if(reward.kind!=='box'&&reward.kind!=='material'&&reward.kind!=='gift'){fp=integer(fp+rewardFP(reward),'累计FP');continue;}
  const h=hostReward(reward),name=bagName(bag,h);const old=bag[name] as Obj|undefined;
  bag[name]={...h.item,数量:integer(Number(old?.数量??0)+reward.count,'物品数量',1)};
 }
 const stat=object(next.stat_data);stat.命运点数=integer(integer(stat.命运点数,'命运点数')+fp,'结算后FP');
 return next;
}

/** 0.37.6 银十字：主角背包里的「暧昧的线」可以跨趟累计，九根在迷宫里合成一枚银十字。 */
export const STRAY_THREAD_NAME='暧昧的线';
export const SILVER_CROSS_NAME='银十字';
export const SILVER_CROSS_THREADS=9;
const isThreadEntry=(name:string,item:unknown)=>name.startsWith(STRAY_THREAD_NAME)&&typeof item==='object'&&item!==null&&(item as Obj).类型==='材料';
export function bagThreadCount(mvu:unknown):number{
 const bag=object(actorAt(object(mvu),{kind:'player'}).背包??{});
 return Object.entries(bag).filter(([name,item])=>isThreadEntry(name,item)).reduce((n,[,item])=>n+Math.max(0,Math.floor(Number((item as Obj).数量)||0)),0);
}
export function bagHasSilverCross(mvu:unknown):boolean{
 const item=object(actorAt(object(mvu),{kind:'player'}).背包??{})[SILVER_CROSS_NAME] as Obj|undefined;return Number(item?.数量??0)>0;
}
/** 在同一次写回里扣掉背包里的线并放入银十字；线不足时整笔拒绝。 */
export function craftSilverCrossInBag(mvu:Obj,bagThreads:number):Obj{
 integer(bagThreads,'扣除线数');const next=structuredClone(mvu),bag=object(actorAt(next,{kind:'player'}).背包,'背包');
 if(bagThreadCount(next)<bagThreads)throw new Error('暧昧的线不足');
 let left=bagThreads;
 for(const [name,item] of Object.entries(bag)){if(!left)break;if(!isThreadEntry(name,item))continue;const have=Math.floor(Number((item as Obj).数量)||0),take=Math.min(have,left);left-=take;if(take===have)delete bag[name];else (item as Obj).数量=have-take;}
 bag[SILVER_CROSS_NAME]={品质:'神话',类型:'道具',数量:1,标签:['书海','银十字'],效果:{战斗:'队伍不足四人时使用，「?」会前来助战（每趟迷宫一次）',探索:'使用后不再遭遇「?」，再次使用则恢复'},描述:'银色的，形状似钥匙又似十字。'};
 return next;
}
