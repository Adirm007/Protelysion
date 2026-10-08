import {resolvedLogs, BATTLE_IMPACT_MS} from '../audio/battle-feedback';
import type {Battle} from '../battle/executor';
import {isAlive} from '../battle/presence';
import type {view} from '../game/expedition';
export type GameView = ReturnType<typeof view>;
export type BattleUnitView = GameView['battle']['units'][number];
export type ActionView = GameView['battle']['actions'][number];
export type BattleCue = {actorId: string; name: string; lines: string[]; side?: 'ally'|'enemy'; misses?: string[]; blocks?: string[]; affinities?: Record<string,string>; impactAt?: number; changes: {id: string; amount: number; down: boolean; critical: boolean}[]};
/** Presentation reads a completed authoritative action. It never rolls or applies damage. */
export function resolvedBattleCue(before: Battle, after: Battle, frame: GameView): BattleCue {
  const pending = before.clock.pending[0], command = pending?.kind === 'resolve' ? before.commands[pending.commandId] : undefined;
  const actorId = command?.caster ?? pending?.unitId ?? '';
  const side = before.units.find(u=>u.id===actorId)?.side ?? 'ally', logs = resolvedLogs(before,after);
  const misses = [...new Set(logs.filter(l=>l.kind==='miss').map(l=>l.unit))], blocks = [...new Set(logs.filter(l=>['absorbed','block','parry'].includes(l.kind)).map(l=>l.unit))];
  const name = (id: string) => frame.battle.units.find(u => u.id === id)?.name ?? '旅人';
  const actionName = command?.action.name ?? frame.party.find(p => p.id === actorId)?.outsideActions.find(a => a.id === command?.sourceId)?.name ?? '技能';
  const changes = after.units.flatMap(u => {
    const old = before.units.find(p => p.id === u.id); if (!old || old.current.hp === u.current.hp) return [];
    const amount = u.current.hp - old.current.hp;
    return [{id: u.id, amount, down: isAlive(old) && !isAlive(u), critical: logs.some(l=>l.kind==='damage'&&l.unit===u.id&&l.detail==='暴击')}];
  });
  const lines = [`${side === 'enemy' ? '敌方' : '我方'} · ${name(actorId)} · ${actionName}`];
  for (const c of changes) {
    lines.push(`${name(c.id)}${c.amount < 0 ? '受到' : '恢复了'} ${Math.round(Math.abs(c.amount)).toLocaleString()} 点${c.amount < 0 ? '伤害' : '生命'}${c.down ? '，倒下了！' : '。'}`);
  }
  // 属性相性：执行器写入 affinity 日志（detail=“属性·弱点/特攻/抵抗/无效”），每个目标只显示一次最新相性。
  const affinity = new Map<string, string>(); for (const l of logs.filter(l => l.kind === 'affinity' && l.detail.includes('·'))) affinity.set(l.unit, l.detail);
  for (const [id, detail] of affinity) lines.push(`${name(id)} · ${detail.replace('·', '属性')}`);
  for (const id of misses) lines.push(`${name(id)} · 未命中 / 闪避`);
  for (const id of blocks) lines.push(`${name(id)} · 护盾 / 格挡`);
  if (!changes.length && !misses.length && !blocks.length) lines.push(...frame.battle.log.slice(-2));
  return {actorId, name: actionName, lines, changes, side, misses, blocks, affinities: Object.fromEntries(affinity), impactAt: BATTLE_IMPACT_MS};
}
export function actionCost(a: ActionView): string {
  if (a.itemCount !== null) return `持有 ${a.itemCount} · 消耗 1`;
  return [a.hp ? `HP ${Math.ceil(a.hp)}` : '', a.mp ? `MP ${Math.ceil(a.mp)}` : '', a.sp ? `SP ${Math.ceil(a.sp)}` : ''].filter(Boolean).join('  ') || '无消耗';
}
export function groupActions(actions: ActionView[], category: string): ActionView[] {
  if (category === 'favorite') return actions.filter(a => a.favorite);
  if (category === 'skill') return actions.filter(a => a.category === 'skill' || a.category === 'spell');
  return actions.filter(a => a.category === category);
}

/** Browsing never commits a skill; text and cursor state belong only to the UI. */
export function actionPreviewText(a: ActionView): string {
  return [a.description, a.sourceDescription && a.sourceDescription !== a.description ? a.sourceDescription : '', a.cast > 0 ? `施放时间 ${(a.cast / 1000).toLocaleString('zh-CN')} 秒` : '', a.limit ? `本场剩余 ${Math.max(0, a.limit - a.used)} 次` : '', a.charges !== null ? `充能 ${a.charges}` : ''].filter(Boolean).join('\n');
}
export function nextActionIndex(index: number, count: number, columns: number, code: string): number | null {
  if (count < 1) return null;
  if (code === 'Home') return 0;
  if (code === 'End') return count - 1;
  const step: Record<string, number> = {ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns, PageUp: -columns * 4, PageDown: columns * 4};
  if (!(code in step)) return null;
  return ((Math.max(0, index) + step[code]!) % count + count) % count;
}

export function actionUnavailableText(reason: string, units: {id: string; name: string}[] = []): string {
  const cost = /^资源不足[:：]\s*(hp|mp|sp)\s*\/\s*(.+)$/i.exec(reason);
  if (cost) {const name = units.find(u => u.id === cost[2])?.name; return `${name ? name + '的 ' : ''}${cost[1]!.toUpperCase()} 不足`;}
  if (reason === '不存在已编译动作') return '该技能暂不可用';
  if (reason === '先手窗口仅可选择声明绝对先手的能力') return '当前只能使用先手技能';
  return reason;
}
