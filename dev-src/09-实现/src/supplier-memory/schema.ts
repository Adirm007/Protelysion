/** 补给员长期记忆：数据模型与版本迁移。
 *  权威存档在聊天变量 booksea.supplierMemory（按聊天 = 按存档），不进消息楼层快照；
 *  epoch 是“第几任补给员”：每次被杀害清空记忆时 +1，旧 epoch 的任何副本都不能再用。 */
import {safeText} from './text';

export const MEMORY_SCHEMA = 1;
export const MEMORY_KEY = 'supplierMemory';
export const MEMORY_LIMITS = {
  facts: 80, history: 40, forgotten: 60, episodes: 120, recentEpisodes: 40, digests: 30, reflections: 16, runs: 30,
  consumed: 400, kills: 60, pending: 3, factText: 60, value: 24, quote: 80, episodeText: 120, reflectionText: 80, digestText: 200,
  stance: 16, keywords: 5, keyword: 12, evidence: 4,
} as const;

export type MemorySource = 'player' | 'observed' | 'inferred' | 'self';
export const FACT_KINDS = ['identity', 'preference', 'story', 'promise', 'request', 'boundary', 'relationship', 'joke', 'other'] as const;
export type FactKind = typeof FACT_KINDS[number];
export type Moment = {n: number; at: number};
export type Evidence = {ep: string; quote?: string};
export type Fact = {
  id: string; kind: FactKind; slot?: string; text: string; value?: string; source: MemorySource;
  evidence: Evidence[]; keywords?: string[]; importance: number; confidence: number;
  n: number; at: number; run?: string; status: 'active' | 'superseded' | 'retracted';
  validTo?: Moment; supersededBy?: string; pinned?: boolean; recalls?: number; lastRecall?: Moment;
};
export type DealNote = {label: string; price: number};
export type EpisodeMeta = {visits?: number; talks?: number; lines?: number; choice?: string; deals?: DealNote[]; gifts?: DealNote[]; buys?: DealNote[]; misses?: string[]; outcome?: 'success' | 'failed' | 'unknown'; maxDepth?: number; startDepth?: number};
export type Episode = {
  id: string; kind: 'encounter' | 'run' | 'quote'; key?: string; n: number; at: number; run?: string; runNo?: number;
  depth?: number; place?: string; text: string; quote?: string; keywords?: string[]; importance: number;
  meta?: EpisodeMeta; recalls?: number; lastRecall?: Moment; pinned?: boolean; summarized?: boolean;
};
export type Reflection = {id: string; text: string; evidence: string[]; importance: number; n: number; at: number; status: 'active' | 'stale'};
export type Digest = {id: string; fromN: number; toN: number; fromAt: number; toAt: number; text: string; count: number};
export type RunNote = {id: string; no: number; startedAt: number; startDepth: number; maxDepth: number; outcome?: 'success' | 'failed' | 'unknown'; endedAt?: number; met: number};
export type Relationship = {
  firstMet?: {n: number; at: number; depth: number; place: string};
  lastSeen?: {n: number; at: number; depth: number; place: string; run: string};
  talks: number; deals: number; gifts: number; misses: number; buys: number; closeness: number; stance?: string; stanceAt?: number;
};
export type PendingLine = {role: 'player' | 'supplier' | 'system'; text: string};
export type PendingJob = {key: string; episode: string; n: number; at: number; run: string; depth: number; place: string; lines: PendingLine[]; tries: number; reflect?: boolean};
export type MemoryStore = {
  schema: typeof MEMORY_SCHEMA; epoch: number; chat: string; createdAt: number; updatedAt: number;
  /** 记忆功能上线前，这个存档里已经有过书海旅程（她那时没有记忆）。 */
  legacy?: boolean;
  /** 前任是怎么没的：被玩家杀害，或玩家在设置里手动清空。只用于新补给员的开场白。 */
  wipedBy?: 'kill' | 'manual';
  seq: number; n: number; runNo: number;
  facts: Fact[]; forgotten: string[]; episodes: Episode[]; reflections: Reflection[]; digests: Digest[]; runs: RunNote[];
  relationship: Relationship; consumed: string[];
  /** 已经处理过的“杀害”事件编号：跨 epoch 保留（只有编号，没有内容），防止同一次杀害被重复清空。 */
  kills: string[];
  pending: PendingJob[]; reflectAcc: number; lastReflectN: number;
  lastExtract?: {at: number; ok: boolean; note: string};
};

export function emptyStore(chat: string, epoch = 1, now = Date.now(), carry?: Pick<MemoryStore, 'kills'>): MemoryStore {
  return {schema: MEMORY_SCHEMA, epoch: Math.max(1, Math.floor(epoch)), chat, createdAt: now, updatedAt: now, seq: 0, n: 0, runNo: 0,
    facts: [], forgotten: [], episodes: [], reflections: [], digests: [], runs: [],
    relationship: {talks: 0, deals: 0, gifts: 0, misses: 0, buys: 0, closeness: 20}, consumed: [],
    kills: [...(carry?.kills ?? [])].slice(-MEMORY_LIMITS.kills), pending: [], reflectAcc: 0, lastReflectN: 0};
}
export const isEmptyStore = (s: MemoryStore) => !s.facts.length && !s.episodes.length && !s.reflections.length && !s.digests.length && !s.runs.length && !s.n;

export type LoadResult = {store: MemoryStore; status: 'fresh' | 'ok' | 'repaired' | 'newer' | 'adopted'};
/** 读入任意来源的存档值：缺失=全新；当前版本=逐项清洗；更新的版本=只读不写，避免旧版游戏覆盖新格式；
 *  来自别的聊天（酒馆“分支”会复制聊天变量）=同一存档分出来的岔路，照单继承并改记到当前聊天名下。 */
export function migrateStore(raw: unknown, chat: string, now = Date.now()): LoadResult {
  if (raw === undefined || raw === null) return {store: emptyStore(chat, 1, now), status: 'fresh'};
  const v = rec(raw);
  const schema = Number(v.schema);
  if (Number.isFinite(schema) && schema > MEMORY_SCHEMA) return {store: emptyStore(chat, num(v.epoch, 1, 1, 1e6), now), status: 'newer'};
  const adopted = typeof v.chat === 'string' && !!v.chat && v.chat !== chat;
  const store = emptyStore(chat, num(v.epoch, 1, 1, 1e6), num(v.createdAt, now, 0, 9e15));
  store.updatedAt = num(v.updatedAt, now, 0, 9e15); store.seq = num(v.seq, 0, 0, 1e9); store.n = num(v.n, 0, 0, 1e9); store.runNo = num(v.runNo, 0, 0, 1e9);
  if (v.legacy === true) store.legacy = true;
  if (v.wipedBy === 'kill' || v.wipedBy === 'manual') store.wipedBy = v.wipedBy;
  store.facts = list(v.facts).map(fact).filter(isSome).slice(-MEMORY_LIMITS.facts - MEMORY_LIMITS.history);
  store.forgotten = strings(v.forgotten, 24).slice(-MEMORY_LIMITS.forgotten);
  store.episodes = list(v.episodes).map(episode).filter(isSome).slice(-MEMORY_LIMITS.episodes);
  store.reflections = list(v.reflections).map(reflection).filter(isSome).slice(-MEMORY_LIMITS.reflections);
  store.digests = list(v.digests).map(digest).filter(isSome).slice(-MEMORY_LIMITS.digests);
  store.runs = list(v.runs).map(runNote).filter(isSome).slice(-MEMORY_LIMITS.runs);
  store.relationship = relationship(v.relationship);
  store.consumed = strings(v.consumed, 80).slice(-MEMORY_LIMITS.consumed);
  store.kills = strings(v.kills, 80).slice(-MEMORY_LIMITS.kills);
  store.pending = list(v.pending).map(pending).filter(isSome).slice(-MEMORY_LIMITS.pending);
  store.reflectAcc = num(v.reflectAcc, 0, 0, 1e6); store.lastReflectN = num(v.lastReflectN, 0, 0, 1e9);
  const last = rec(v.lastExtract); if (Object.keys(last).length) store.lastExtract = {at: num(last.at, 0, 0, 9e15), ok: last.ok === true, note: safeText(last.note, 60)};
  const ids = [store.facts, store.episodes, store.reflections, store.digests].flat().map(x => Number(x.id.slice(1))).filter(Number.isFinite);
  store.seq = Math.max(store.seq, ...ids, 0);
  return {store, status: adopted ? 'adopted' : schema === MEMORY_SCHEMA ? 'ok' : 'repaired'};
}

type Obj = Record<string, unknown>;
const rec = (v: unknown): Obj => v && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {};
const list = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const isSome = <T>(v: T | undefined): v is T => v !== undefined;
export function num(v: unknown, fallback: number, lo: number, hi: number): number {const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;}
const strings = (v: unknown, max: number) => list(v).filter((x): x is string => typeof x === 'string' && !!x).map(x => x.slice(0, max));
const id = (v: unknown, prefix: string) => typeof v === 'string' && new RegExp('^' + prefix + '\\d{1,9}$').test(v) ? v : undefined;
const moment = (v: unknown): Moment | undefined => {const m = rec(v); return Object.keys(m).length ? {n: num(m.n, 0, 0, 1e9), at: num(m.at, 0, 0, 9e15)} : undefined;};
const keywords = (v: unknown) => {const k = strings(v, MEMORY_LIMITS.keyword).map(x => safeText(x, MEMORY_LIMITS.keyword)).filter(Boolean).slice(0, MEMORY_LIMITS.keywords); return k.length ? k : undefined;};
export const SLOT = /^[a-z_]{2,16}(?::[a-z_\u4e00-\u9fff]{1,12})?$/;
function fact(raw: unknown): Fact | undefined {
  const v = rec(raw), fid = id(v.id, 'f'), text = safeText(v.text, MEMORY_LIMITS.factText);
  if (!fid || !text) return undefined;
  const kind = (FACT_KINDS as readonly string[]).includes(String(v.kind)) ? v.kind as FactKind : 'other';
  const source = (['player', 'observed', 'inferred', 'self'] as const).find(s => s === v.source) ?? 'inferred';
  const status = (['active', 'superseded', 'retracted'] as const).find(s => s === v.status) ?? 'active';
  const out: Fact = {id: fid, kind, text, source, status, evidence: list(v.evidence).map(e => {const x = rec(e), ep = id(x.ep, 'e'); return ep ? {ep, ...(x.quote ? {quote: safeText(x.quote, MEMORY_LIMITS.quote)} : {})} : undefined;}).filter(isSome).slice(-MEMORY_LIMITS.evidence),
    importance: num(v.importance, 3, 1, 10), confidence: num(v.confidence, .5, 0, 1), n: num(v.n, 0, 0, 1e9), at: num(v.at, 0, 0, 9e15)};
  if (typeof v.slot === 'string' && SLOT.test(v.slot)) out.slot = v.slot;
  const value = safeText(v.value, MEMORY_LIMITS.value); if (value) out.value = value;
  const k = keywords(v.keywords); if (k) out.keywords = k;
  if (typeof v.run === 'string') out.run = v.run.slice(0, 80);
  const to = moment(v.validTo); if (to) out.validTo = to;
  const by = id(v.supersededBy, 'f'); if (by) out.supersededBy = by;
  if (v.pinned === true) out.pinned = true;
  if (v.recalls !== undefined) out.recalls = num(v.recalls, 0, 0, 1e6);
  const lr = moment(v.lastRecall); if (lr) out.lastRecall = lr;
  return out;
}
const META_OUTCOMES = ['success', 'failed', 'unknown'] as const;
function notes(v: unknown) {const out = list(v).map(x => {const d = rec(x), label = safeText(d.label, 40); return label ? {label, price: num(d.price, 0, 0, 1e7)} : undefined;}).filter(isSome).slice(0, 8); return out.length ? out : undefined;}
function meta(raw: unknown): EpisodeMeta | undefined {
  const v = rec(raw); if (!Object.keys(v).length) return undefined;
  const out: EpisodeMeta = {};
  for (const k of ['visits', 'talks', 'lines', 'maxDepth', 'startDepth'] as const) if (v[k] !== undefined) out[k] = num(v[k], 0, 0, 1e6);
  if (typeof v.choice === 'string') out.choice = safeText(v.choice, 12);
  for (const k of ['deals', 'gifts', 'buys'] as const) {const n = notes(v[k]); if (n) out[k] = n;}
  const misses = strings(v.misses, 40).map(x => safeText(x, 40)).slice(0, 6); if (misses.length) out.misses = misses;
  const outcome = META_OUTCOMES.find(o => o === v.outcome); if (outcome) out.outcome = outcome;
  return out;
}
function episode(raw: unknown): Episode | undefined {
  const v = rec(raw), eid = id(v.id, 'e'), text = safeText(v.text, MEMORY_LIMITS.episodeText);
  if (!eid || !text) return undefined;
  const kind = (['encounter', 'run', 'quote'] as const).find(k => k === v.kind) ?? 'encounter';
  const out: Episode = {id: eid, kind, n: num(v.n, 0, 0, 1e9), at: num(v.at, 0, 0, 9e15), text, importance: num(v.importance, 2, 1, 10)};
  if (typeof v.key === 'string') out.key = v.key.slice(0, 120);
  if (typeof v.run === 'string') out.run = v.run.slice(0, 80);
  if (v.runNo !== undefined) out.runNo = num(v.runNo, 0, 0, 1e9);
  if (v.depth !== undefined) out.depth = num(v.depth, 1, 1, 1e6);
  const place = safeText(v.place, 24); if (place) out.place = place;
  const quote = safeText(v.quote, MEMORY_LIMITS.quote); if (quote) out.quote = quote;
  const k = keywords(v.keywords); if (k) out.keywords = k;
  const m = meta(v.meta); if (m) out.meta = m;
  if (v.recalls !== undefined) out.recalls = num(v.recalls, 0, 0, 1e6);
  const lr = moment(v.lastRecall); if (lr) out.lastRecall = lr;
  if (v.pinned === true) out.pinned = true;
  if (v.summarized === true) out.summarized = true;
  return out;
}
function reflection(raw: unknown): Reflection | undefined {
  const v = rec(raw), rid = id(v.id, 'r'), text = safeText(v.text, MEMORY_LIMITS.reflectionText);
  if (!rid || !text) return undefined;
  const evidence = strings(v.evidence, 12).filter(x => /^[fe]\d{1,9}$/.test(x)).slice(0, 6);
  if (!evidence.length) return undefined;
  return {id: rid, text, evidence, importance: num(v.importance, 4, 1, 10), n: num(v.n, 0, 0, 1e9), at: num(v.at, 0, 0, 9e15), status: v.status === 'stale' ? 'stale' : 'active'};
}
function digest(raw: unknown): Digest | undefined {
  const v = rec(raw), did = id(v.id, 'd'), text = safeText(v.text, MEMORY_LIMITS.digestText);
  if (!did || !text) return undefined;
  return {id: did, text, fromN: num(v.fromN, 0, 0, 1e9), toN: num(v.toN, 0, 0, 1e9), fromAt: num(v.fromAt, 0, 0, 9e15), toAt: num(v.toAt, 0, 0, 9e15), count: num(v.count, 1, 1, 1e6)};
}
function runNote(raw: unknown): RunNote | undefined {
  const v = rec(raw); if (typeof v.id !== 'string' || !v.id) return undefined;
  const out: RunNote = {id: v.id.slice(0, 80), no: num(v.no, 1, 1, 1e9), startedAt: num(v.startedAt, 0, 0, 9e15), startDepth: num(v.startDepth, 1, 1, 1e6), maxDepth: num(v.maxDepth, 1, 1, 1e6), met: num(v.met, 0, 0, 1e6)};
  const outcome = META_OUTCOMES.find(o => o === v.outcome); if (outcome) out.outcome = outcome;
  if (v.endedAt !== undefined) out.endedAt = num(v.endedAt, 0, 0, 9e15);
  return out;
}
function relationship(raw: unknown): Relationship {
  const v = rec(raw), first = rec(v.firstMet), last = rec(v.lastSeen);
  const out: Relationship = {talks: num(v.talks, 0, 0, 1e6), deals: num(v.deals, 0, 0, 1e6), gifts: num(v.gifts, 0, 0, 1e6), misses: num(v.misses, 0, 0, 1e6), buys: num(v.buys, 0, 0, 1e6), closeness: num(v.closeness, 20, 0, 100)};
  if (Object.keys(first).length) out.firstMet = {n: num(first.n, 1, 0, 1e9), at: num(first.at, 0, 0, 9e15), depth: num(first.depth, 1, 1, 1e6), place: safeText(first.place, 24)};
  if (Object.keys(last).length) out.lastSeen = {n: num(last.n, 1, 0, 1e9), at: num(last.at, 0, 0, 9e15), depth: num(last.depth, 1, 1, 1e6), place: safeText(last.place, 24), run: String(last.run ?? '').slice(0, 80)};
  const stance = safeText(v.stance, MEMORY_LIMITS.stance); if (stance) {out.stance = stance; out.stanceAt = num(v.stanceAt, 0, 0, 9e15);}
  return out;
}
function pending(raw: unknown): PendingJob | undefined {
  const v = rec(raw); if (typeof v.key !== 'string' || !id(v.episode, 'e')) return undefined;
  const lines = list(v.lines).map(l => {const x = rec(l), role = (['player', 'supplier', 'system'] as const).find(r => r === x.role), text = safeText(x.text, 300); return role && text ? {role, text} : undefined;}).filter(isSome).slice(-24);
  if (!lines.length) return undefined;
  return {key: v.key.slice(0, 120), episode: String(v.episode), n: num(v.n, 0, 0, 1e9), at: num(v.at, 0, 0, 9e15), run: String(v.run ?? '').slice(0, 80), depth: num(v.depth, 1, 1, 1e6), place: safeText(v.place, 24), lines, tries: num(v.tries, 0, 0, 9), ...(v.reflect === true ? {reflect: true} : {})};
}
