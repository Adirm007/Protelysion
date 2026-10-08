import {isBattleConsumable} from './battle-items';
import {remainingDuration} from '../host/initial-states';
import { actorAt, actorKey, object, RESOURCES, validateCombatSource, validateTeam, type ActorRef, type Obj } from './actors';

export const COMPILER_VERSION = '0.23.0';
export const EFFECT_SCHEMA_VERSION = 'booksea-effects/2';
/** Canonical JSON; rejects non-JSON values rather than silently changing them. */
export function canonical(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const o = object(value, '可序列化字段');
  return `{${Object.keys(o).sort().map(k => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`;
}
function normalize(value: unknown, key = ''): unknown {
  if (value === undefined) return null;
  if (typeof value === 'string') return value.replace(/\r\n/g, '\n').trim();
  if (Array.isArray(value)) {
    const values = value.map(v => normalize(v));
    return key === '标签' ? values.sort((a, b) => canonical(a).localeCompare(canonical(b))) : values;
  }
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([k]) => k !== '_隐藏').map(([k, v]) => [k, normalize(v, k)]));
  return value;
}
export function stateDefinitions(actor: Obj): Obj {
  return Object.fromEntries(Object.entries(object(actor.状态效果, '状态效果')).map(([name, state]) => {
    const s = object(state, name);
    // Remaining time and stacks are live values, not compile dependencies.
    return [name, normalize({...Object.fromEntries(Object.entries(s).filter(([k]) => !['层数', '剩余时间', '当前冷却'].includes(k))),时钟语义:remainingDuration(String(s.剩余时间??''))?.clock??String(s.剩余时间??'由效果说明确定').replace(/[\d.]+/g,'#')})];
  }));
}
export function combatProjection(actor: Obj): Obj {
  validateCombatSource(actor);
  const data: Obj = {};
  for (const key of ['等级', '生命层级', '属性', '性别', '种族', '种族特性', '装备', '技能', '登神长阶']) {
    if (actor[key] !== undefined) data[key] = normalize(actor[key]);
  }
  for (const r of RESOURCES) data[r] = normalize(object(actor[r]).上限);
  data.状态定义 = stateDefinitions(actor);
  data.道具定义 = Object.fromEntries(Object.entries(object(actor.背包 ?? {})).filter(([,v])=>isBattleConsumable(v)).map(([name,v])=>[name,normalize(Object.fromEntries(Object.entries(object(v)).filter(([k])=>k!=='数量')))]));
  return data;
}
export function difference(before: unknown, after: unknown, prefix = ''): string[] {
  if (canonical(before) === canonical(after)) return [];
  if (before && after && typeof before === 'object' && typeof after === 'object' && !Array.isArray(before) && !Array.isArray(after)) {
    const a = before as Obj, b = after as Obj;
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().flatMap(k => {
      const p = `${prefix}/${k.replace(/~/g, '~0').replace(/\//g, '~1')}`;
      return !Object.hasOwn(a, k) || !Object.hasOwn(b, k) ? [p] : difference(a[k], b[k], p);
    });
  }
  return [prefix || '/'];
}
export type Cache = {
  actorRef: ActorRef; compilerVersion: string; effectSchemaVersion: string;
  compiledAt: string; combatSourceSnapshot: Obj; combatFingerprint: string;
  compiledActor: unknown; mappingNotes: string[];
};
export type CacheStatus = { status: 'missing' | 'ready' | 'stale' | 'incompatible' | 'invalid'; differences: string[]; reason?: string };
export function inspectCache(cache: Cache | undefined, actor: Obj, ref: ActorRef): CacheStatus {
  if (!cache) return { status: 'missing', differences: [] };
  if (cache.compilerVersion !== COMPILER_VERSION || cache.effectSchemaVersion !== EFFECT_SCHEMA_VERSION) return { status: 'incompatible', differences: [], reason: '编译格式不兼容，请重建' };
  if (actorKey(cache.actorRef) !== actorKey(ref)) return { status: 'invalid', differences: [], reason: '来源身份不匹配' };
  try {
    if (cache.combatFingerprint !== canonical(cache.combatSourceSnapshot)) throw new Error('快照校验失败');
    const current = combatProjection(actor);
    // Expired known states need no recompile; a new/changed definition does.
    current.状态定义 = { ...object(cache.combatSourceSnapshot.状态定义), ...object(current.状态定义) };
    const bag=object(actor.背包??{});
    const priorItems=Object.fromEntries(Object.entries(object(cache.combatSourceSnapshot.道具定义??{})).filter(([name])=>!Object.hasOwn(bag,name)||isBattleConsumable(bag[name])));
    current.道具定义 = { ...priorItems, ...object(current.道具定义??{}) };
    const changes = difference(cache.combatSourceSnapshot, current);
    return { status: changes.length ? 'stale' : 'ready', differences: changes };
  } catch (e) { return { status: 'invalid', differences: [], reason: (e as Error).message }; }
}
export interface CompilationEngine {
  compile(source: Obj, previous: unknown, changes: string[]): Promise<{ actor: unknown; notes: string[] }>;
  validateSource?(actor: unknown, source: Obj): void;
  validate(actor: unknown): void; // Must use the actual effect executor registry; never a permissive fallback.
}
export interface CacheStore {
  read(key: string): Promise<Cache | undefined>;
  write(key: string, cache: Cache): Promise<void>;
  remove(key: string): Promise<void>;
}
/** Only call from an explicit user compile/update action. No background recompilation. */
export async function compileOnUserAction(ref: ActorRef, readMvu: () => Promise<unknown>, store: CacheStore, engine: CompilationEngine): Promise<Cache> {
  const key = actorKey(ref), previous = await store.read(key);
  const source = combatProjection(actorAt(await readMvu(), ref));
  const changes = previous ? inspectCache(previous, actorAt(await readMvu(), ref), ref).differences : ['/'];
  const result = await engine.compile(source, previous?.compiledActor, changes);
  engine.validate(result.actor);
  engine.validateSource?.(result.actor, source);
  canonical(result.actor);
  const latest = combatProjection(actorAt(await readMvu(), ref));
  if (canonical(source) !== canonical(latest)) throw new Error('编译期间战斗来源已改变，旧缓存保留，请重新更新');
  const cache: Cache = { actorRef: ref, compilerVersion: COMPILER_VERSION, effectSchemaVersion: EFFECT_SCHEMA_VERSION, compiledAt: new Date().toISOString(), combatSourceSnapshot: source, combatFingerprint: canonical(source), compiledActor: result.actor, mappingNotes: result.notes };
  await store.write(key, cache);
  return cache;
}
export async function assertEntry(mvu: unknown, refs: ActorRef[], store: CacheStore, engine: CompilationEngine): Promise<void> {
  validateTeam(mvu, refs);
  for (const ref of refs) {
    const cache = await store.read(actorKey(ref));
    if (inspectCache(cache, actorAt(mvu, ref), ref).status !== 'ready') throw new Error('角色缓存不可入场');
    engine.validate(cache!.compiledActor);
    engine.validateSource?.(cache!.compiledActor, cache!.combatSourceSnapshot);
  }
}
