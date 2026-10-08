/** 衰减：参考 Generative Agents 的“近因”指数衰减，但时间轴换成“见面次数”与真实天数两条
 *  （迷宫里见面稀疏，按游戏小时衰减会太快）。重要度随年龄慢慢变淡，置顶的高显著记忆不衰减、不被挤掉。 */
import type {MemoryStore, Moment} from './schema';

export const DECAY = {encounterHalfLife: 8, dayHalfLife: 45, importanceHalfLife: 60, importanceFloor: .4, pinImportance: 8} as const;
const DAY = 86400000;
type Aging = {n: number; at: number; importance: number; pinned?: boolean; lastRecall?: Moment};

export const isPinned = (item: Aging) => !!item.pinned || item.importance >= DECAY.pinImportance;
/** 0～1：距离上次被想起（没想起过就从记下那次算）过了多少次见面、多少天。 */
export function recency(item: Aging, store: Pick<MemoryStore, 'n'>, now: number): number {
  const ref = item.lastRecall && item.lastRecall.n >= item.n ? item.lastRecall : item;
  const dn = Math.max(0, store.n - ref.n), dd = Math.max(0, (now - ref.at) / DAY);
  return Math.pow(.5, dn / DECAY.encounterHalfLife) * Math.pow(.5, dd / DECAY.dayHalfLife);
}
/** 1～10：置顶的保持原值；其余按记下以来的见面次数减半，最低保留 40%。 */
export function salience(item: Aging, store: Pick<MemoryStore, 'n'>): number {
  if (isPinned(item)) return item.importance;
  const age = Math.max(0, store.n - item.n);
  return item.importance * Math.max(DECAY.importanceFloor, Math.pow(.5, age / DECAY.importanceHalfLife));
}
/** 超出上限时淘汰分数最低的：显著度为主，近因为辅。 */
export function retention(item: Aging, store: Pick<MemoryStore, 'n'>, now: number): number {
  return salience(item, store) / 10 * (.35 + .65 * recency(item, store, now));
}
