/** Only the host fields required by this milestone; never rebuild the full host schema. */
export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Obj = Record<string, unknown>;
export type ActorRef = { kind: 'player' } | { kind: 'partner'; name: string };
export const RESOURCES = ['生命值', '法力值', '体力值'] as const;
export const ATTRIBUTES = ['力量', '敏捷', '体质', '智力', '精神'] as const;
export function object(value: unknown, label = '对象'): Obj {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}缺失或不是对象`);
  return value as Obj;
}
export function finite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label}必须是有限数值`);
  return value;
}
export function integer(value: unknown, label: string, min = 0): number {
  const n = finite(value, label);
  if (!Number.isSafeInteger(n) || n < min) throw new Error(`${label}必须是 ≥${min} 的安全整数`);
  return n;
}
export function own(o: Obj, key: string): unknown { return Object.hasOwn(o, key) ? o[key] : undefined; }
export function actorKey(ref: ActorRef): string {
  return JSON.stringify(ref.kind === 'player' ? ['stat_data', '主角'] : ['stat_data', '关系列表', ref.name]);
}
export function actorAt(mvu: unknown, ref: ActorRef): Obj {
  const stat = object(own(object(mvu, 'MVU'), 'stat_data'), 'stat_data');
  return ref.kind === 'player' ? object(own(stat, '主角'), '主角')
    : object(own(object(own(stat, '关系列表'), '关系列表'), ref.name), `伙伴「${ref.name}」`);
}
export function tier(level: number): number {
  integer(level, '等级', 1);
  return Math.min(7, Math.ceil(level / 4));
}
export function hostLevel(actor: Obj): number {
  const level = integer(actor.等级, '宿主等级', 1);
  if (level > 25) throw new Error('宿主等级不得超过25');
  return level;
}
export function resourceMax(actor: Obj, name: typeof RESOURCES[number]): number {
  const max = object(object(actor[name], name).上限, `${name}.上限`);
  return Math.max(0, finite(max._基础, `${name}基础上限`) + finite(max.额外, `${name}额外上限`));
}
export function validateCombatSource(actor: Obj): void {
  hostLevel(actor);
  if (typeof actor.生命层级 !== 'string' || !actor.生命层级.trim()) throw new Error('生命层级缺失');
  const attrs = object(actor.属性, '五维');
  for (const key of ATTRIBUTES) finite(attrs[key], key);
  for (const r of RESOURCES) {
    const current = finite(object(actor[r], r).当前, `${r}.当前`);
    if (current < 0 || current > resourceMax(actor, r)) throw new Error(`${r}.当前超出范围`);
  }
  for (const key of ['技能', '装备', '状态效果', '背包']) object(actor[key], key);
}
export function eligibility(mvu: unknown, ref: ActorRef): { allowed: boolean; reason: string } {
  try {
    const actor = actorAt(mvu, ref);
    if (ref.kind === 'partner') {
      if (actor.命定契约 !== true) return { allowed: false, reason: '尚未命定契约' };
      if (finite(actor.好感度, '好感度') < 70) return { allowed: false, reason: '好感度需达到70' };
    }
    validateCombatSource(actor);
    return { allowed: true, reason: '资格符合；编译与联通仍需独立校验' };
  } catch (e) { return { allowed: false, reason: (e as Error).message }; }
}
export function validateTeam(mvu: unknown, refs: ActorRef[]): void {
  if (refs.length < 1 || refs.length > 4) throw new Error('队伍必须为1–4人');
  if (new Set(refs.map(actorKey)).size !== refs.length) throw new Error('队伍成员重复');
  for (const ref of refs) {
    const result = eligibility(mvu, ref);
    if (!result.allowed) throw new Error(`${actorKey(ref)}：${result.reason}`);
  }
}
export function listActors(mvu: unknown): ActorRef[] {
  const stat = object(object(mvu, 'MVU').stat_data, 'stat_data');
  const refs: ActorRef[] = [];
  if (Object.hasOwn(stat, '主角')) refs.push({ kind: 'player' });
  for (const name of Object.keys(object(stat.关系列表, '关系列表'))) refs.push({ kind: 'partner', name });
  return refs;
}
