// Test-only doubles for the supplier memory: a fake chat-variable host, fake localStorage,
// a scripted extraction model and a real local HTTP server that mimics /v1/embeddings and /v1/rerank.
import {createServer, type IncomingMessage, type ServerResponse} from 'node:http';
import type {AddressInfo} from 'node:net';
import {createSupplierMemory, type MemoryPort, type MemoryLLM, type ObservedState, type SupplierMemory} from '../src/supplier-memory/service';
import {memoryVectorCache, type VectorCache} from '../src/supplier-memory/vectors';
import type {SupplierLedgerEntry} from '../src/game/supplier-ledger';
import type {TalkSession} from '../src/game/supplier-agent';
import type {FetchLike} from '../src/supplier-memory/apis';
import {defaultSettings, SETTINGS_KEY, type MemorySettings} from '../src/supplier-memory/apis';

type Obj = Record<string, unknown>;
export const rec = (v: unknown): Obj => v && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {};
export function fakeStorage() {
  const map = new Map<string, string>();
  return {map, getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => {map.set(k, String(v));}, removeItem: (k: string) => {map.delete(k);}};
}
export type FakeChat = {vars: Obj; saves: number; writes: number; failWrites: number};
export const fakeChat = (vars: Obj = {}): FakeChat => ({vars, saves: 0, writes: 0, failWrites: 0});
export const storedMemory = (chat: FakeChat) => rec(rec(chat.vars.booksea).supplierMemory);

export type Clock = {now: () => number; advanceDays(n: number): void; advance(ms: number): void};
export function clock(start = Date.UTC(2026, 9, 1, 4)): Clock {
  let t = start;
  return {now: () => t, advanceDays(n) {t += n * 86400000;}, advance(ms) {t += ms;}};
}
export function memoryPort(o: {chat: FakeChat; contextId?: string; storage?: ReturnType<typeof fakeStorage>; llm?: MemoryLLM; fetch?: FetchLike; vectors?: VectorCache; now?: () => number; ended?: MemoryPort['endedRuns']; legacy?: boolean}): MemoryPort {
  const port: MemoryPort = {
    contextId: o.contextId ?? 'char-1:chat-A',
    read: () => rec(o.chat.vars.booksea).supplierMemory,
    async write(store) {
      o.chat.writes++;
      if (o.chat.failWrites > 0) {o.chat.failWrites--; throw Error('写入失败（测试）');}
      o.chat.vars = {...o.chat.vars, booksea: {...rec(o.chat.vars.booksea), supplierMemory: structuredClone(store)}};
      o.chat.saves++;
    },
    legacyHint: () => !!o.legacy,
    vectors: o.vectors ?? memoryVectorCache(),
  };
  if (o.storage) port.storage = o.storage;
  if (o.llm) port.llm = o.llm;
  if (o.fetch) port.fetch = o.fetch;
  if (o.now) port.now = o.now;
  if (o.ended) port.endedRuns = o.ended;
  return port;
}
export function withSettings(storage: ReturnType<typeof fakeStorage>, patch: (s: MemorySettings) => void) {
  const s = defaultSettings(); patch(s); storage.setItem(SETTINGS_KEY, JSON.stringify(s)); return s;
}

/** Drives one supplier encounter through the memory service the same way the runtime does:
 *  open → talk lines appear in the session → (purchases/deals) → dialogue closes. */
let uid = 0;
export function encounter(mem: SupplierMemory, st: ObservedState, o: {run: string; thing: string; depth: number; place?: string; at: number; lines?: [('player' | 'supplier' | 'system'), string][]; buys?: [string, number][]; deals?: [string, number][]; misses?: [string, string][]; choice?: string}) {
  const e = (t: SupplierLedgerEntry['t'], extra: Partial<SupplierLedgerEntry> = {}): SupplierLedgerEntry => ({id: 'L' + (++uid), t, thing: o.thing, run: o.run, depth: o.depth, place: o.place ?? '测试之地', theme: '测试主题', at: o.at, ...extra});
  st.run = {id: o.run, status: 'active'}; st.depth = o.depth; st.depthLog = {start: st.depthLog?.start ?? 1, maximum: Math.max(st.depthLog?.maximum ?? 1, o.depth)};
  st.mode = 'supplier'; st.supplierState = {thingId: o.thing};
  mem.observe(st, [e('open'), e('choice', {choice: o.choice ?? (o.lines?.length ? 'talk' : 'shop')})]);
  if (o.lines?.length) {
    st.supplierTalks ??= {};
    const log = o.lines.map(([role, text]) => ({role, text}));
    st.supplierTalks[o.thing] = {thingId: o.thing, serial: log.filter(l => l.role === 'player').length, log, pending: false, grants: {relic: 0, item: 0, event: 0, loot: 0}, total: log.length, memo: 0} as TalkSession;
  }
  const extra: SupplierLedgerEntry[] = [];
  for (const [label, price] of o.buys ?? []) extra.push(e('buy', {label, price}));
  for (const [label, price] of o.deals ?? []) extra.push(e('deal', {label, price}));
  for (const [kind, reason] of o.misses ?? []) extra.push(e('nodeal', {kind, reason}));
  if (extra.length) mem.observe(st, extra);
  st.mode = 'explore'; delete st.supplierState;
  mem.observe(st, []);
}
export const killEntry = (o: {run: string; thing: string; depth: number; at: number}): SupplierLedgerEntry => ({id: 'K' + (++uid), t: 'kill', thing: o.thing, run: o.run, depth: o.depth, place: '血迹', theme: '测试主题', at: o.at});
export const observed = (): ObservedState => ({run: {id: 'run-1', status: 'active'}, mode: 'explore', depth: 1, depthLog: {start: 1, maximum: 1}, supplierTalks: {}});

/** Scripted extraction model: picks the answer whose trigger text appears in the request. */
export function scriptedLLM(script: [string, unknown][], calls: {system: string; user: string}[] = []): MemoryLLM {
  return async (system, user) => {
    calls.push({system, user});
    if (system.includes('只输出一个 JSON：{"ok":true}')) return '{"ok":true}';
    const hit = script.find(([needle]) => user.includes(needle));
    return JSON.stringify(hit ? hit[1] : {memories: []});
  };
}
export function makeMemory(o: Parameters<typeof memoryPort>[0], options?: Parameters<typeof createSupplierMemory>[1]) {return createSupplierMemory(memoryPort(o), options);}

/** Deterministic "semantic" vectors: concept counts (so 宠物 ≈ 猫, 全灭 ≈ 死) plus a small hashed character part. */
export const CONCEPTS: [string, string[]][] = [
  ['name', ['名字', '叫我', '我叫', '称呼', '阿青', '小青']], ['food', ['吃', '食物', '牛油果', '草莓', '蛋糕', '甜', '饭']],
  ['pet', ['猫', '狗', '宠物', '团子', '养了']], ['promise', ['答应', '约定', '下次', '说好', '带给']],
  ['death', ['死', '全灭', '败退', '倒下', '阵亡']], ['run', ['层', '远征', '一趟', '迷宫']], ['shop', ['买', '卖', '药剂', '遗物', '价', '商店', 'fp']],
  ['weather', ['雨', '天气', '晴', '雪']], ['birthday', ['生日', '出生']], ['movie', ['电影', '影片']], ['music', ['钢琴', '唱歌', '音乐', '吉他']],
  ['fear', ['怕', '恐惧', '蜘蛛']], ['home', ['住', '海边', '家乡', '老家']], ['color', ['颜色', '蓝色', '红色']], ['sport', ['篮球', '跑步', '游泳']],
  ['book', ['小说', '看书', '诗']], ['sky', ['星星', '月亮', '夜空']], ['sleep', ['睡', '熬夜', '失眠']], ['drink', ['咖啡', '茶', '奶茶']], ['travel', ['旅行', '远方', '火车']],
  ['flower', ['花', '向日葵']], ['work', ['上班', '工作', '图书馆']], ['joke', ['素食', '素食主义']],
];
export function conceptVector(text: string, withNoise = true): number[] {
  const t = text.toLowerCase(), v = CONCEPTS.map(([, words]) => words.reduce((n, w) => n + (t.split(w).length - 1), 0));
  if (withNoise) {const h = new Array(16).fill(0); for (const c of t) h[c.charCodeAt(0) % 16] += .04; v.push(...h);}
  const norm = Math.sqrt(v.reduce((a, b) => a + b * b, 0)) || 1;
  return v.map(x => x / norm);
}
export type MockApi = {url: string; calls: {embeddings: number; rerank: number; texts: number}; auth: string[]; close(): Promise<void>};
/** Real HTTP server so the clients' fetch/JSON/headers/status paths all run.
 *  Path prefixes select behaviour: /ok, /fail500, /slow, /bad, /auth (needs "Bearer test-key"). */
export async function startMockApi(): Promise<MockApi> {
  const calls = {embeddings: 0, rerank: 0, texts: 0}, auth: string[] = [];
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    let raw = ''; req.on('data', c => {raw += c;});
    req.on('end', () => {
      const url = req.url ?? '', send = (status: number, body: unknown) => {res.writeHead(status, {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'}); res.end(JSON.stringify(body));};
      auth.push(String(req.headers.authorization ?? ''));
      if (url.startsWith('/fail500')) return send(500, {error: 'boom'});
      if (url.startsWith('/auth') && req.headers.authorization !== 'Bearer test-key') return send(401, {error: 'unauthorized'});
      if (url.startsWith('/slow')) {setTimeout(() => send(200, {data: []}), 3000); return;}
      let body: Obj = {}; try {body = JSON.parse(raw);} catch {return send(400, {error: 'bad json'});}
      if (url.startsWith('/bad')) return send(200, {unexpected: true});
      if (url.endsWith('/embeddings')) {
        calls.embeddings++; const input = Array.isArray(body.input) ? body.input.map(String) : [String(body.input)]; calls.texts += input.length;
        return send(200, {object: 'list', model: body.model, data: input.map((t, index) => ({object: 'embedding', index, embedding: conceptVector(t)}))});
      }
      if (url.endsWith('/rerank')) {
        calls.rerank++; const q = conceptVector(String(body.query), false), docs = Array.isArray(body.documents) ? body.documents.map(String) : [];
        const results = docs.map((d, index) => {const v = conceptVector(d, false); return {index, relevance_score: Math.max(0, q.reduce((s, x, i) => s + x * (v[i] ?? 0), 0))};}).sort((a, b) => b.relevance_score - a.relevance_score);
        return send(200, {model: body.model, results});
      }
      send(404, {error: 'not found'});
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return {url: `http://127.0.0.1:${port}`, calls, auth, close: () => new Promise<void>(resolve => {server.closeAllConnections(); server.close(() => resolve());})};
}
export const nodeFetch: FetchLike = (url, init) => fetch(url, init) as unknown as ReturnType<FetchLike>;
