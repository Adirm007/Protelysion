/** 可选的外部接口：OpenAI 兼容的 /v1/embeddings、Jina / Cohere / 硅基流动 / BGE 同形的 /v1/rerank。
 *  密钥只存在这台设备浏览器的 localStorage（与读者“独立API”同一做法），不进聊天变量、存档或导出。
 *  任何失败（超时、401、跨域、格式不对）都只让检索退回“关键词＋时间＋重要度”，不会影响对话和游戏。 */
import type {Budget} from './retrieve';

export type ApiSlot = {enabled: boolean; url: string; model: string; key: string};
export type ExtractionMode = 'dialogue' | 'custom' | 'off';
export type TestResult = {ok: boolean; at: number; ms: number; note: string; dims?: number};
export type MemorySettings = {
  version: 1; enabled: boolean; budget: Budget;
  embedding: ApiSlot; rerank: ApiSlot;
  extraction: {mode: ExtractionMode; url: string; model: string; key: string};
  tests?: Partial<Record<'embedding' | 'rerank' | 'extraction', TestResult>>;
};
export const SETTINGS_KEY = 'booksea-supplier-memory-settings-v1';
export const PRESETS = {
  siliconflow: {label: '硅基流动', url: 'https://api.siliconflow.cn/v1', embedding: 'BAAI/bge-m3', rerank: 'BAAI/bge-reranker-v2-m3'},
  jina: {label: 'Jina', url: 'https://api.jina.ai/v1', embedding: 'jina-embeddings-v3', rerank: 'jina-reranker-v2-base-multilingual'},
  openai: {label: 'OpenAI', url: 'https://api.openai.com/v1', embedding: 'text-embedding-3-small', rerank: ''},
} as const;
export function defaultSettings(): MemorySettings {
  return {version: 1, enabled: true, budget: 'standard',
    embedding: {enabled: false, url: '', model: '', key: ''}, rerank: {enabled: false, url: '', model: '', key: ''},
    extraction: {mode: 'dialogue', url: '', model: '', key: ''}};
}
type Store = Pick<Storage, 'getItem' | 'setItem'>;
const rec = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const str = (v: unknown, max = 300) => String(v ?? '').trim().slice(0, max);
function slot(v: unknown): ApiSlot {const s = rec(v); return {enabled: s.enabled === true, url: str(s.url), model: str(s.model, 120), key: str(s.key, 400)};}
function result(v: unknown): TestResult | undefined {const r = rec(v); return typeof r.at === 'number' ? {ok: r.ok === true, at: r.at, ms: Number(r.ms) || 0, note: str(r.note, 120), ...(typeof r.dims === 'number' ? {dims: r.dims} : {})} : undefined;}
export function normalizeSettings(raw: unknown): MemorySettings {
  const v = rec(raw), d = defaultSettings(), x = rec(v.extraction), tests = rec(v.tests);
  const out: MemorySettings = {version: 1, enabled: v.enabled !== false, budget: (['compact', 'standard', 'generous'] as const).find(b => b === v.budget) ?? d.budget,
    embedding: slot(v.embedding), rerank: slot(v.rerank),
    extraction: {mode: (['dialogue', 'custom', 'off'] as const).find(m => m === x.mode) ?? 'dialogue', url: str(x.url), model: str(x.model, 120), key: str(x.key, 400)}};
  const t: MemorySettings['tests'] = {};
  for (const k of ['embedding', 'rerank', 'extraction'] as const) {const r = result(tests[k]); if (r) t[k] = r;}
  if (Object.keys(t).length) out.tests = t;
  return out;
}
export function loadSettings(storage?: Store): MemorySettings {
  try {const raw = storage?.getItem(SETTINGS_KEY); return normalizeSettings(raw ? JSON.parse(raw) : undefined);} catch {return defaultSettings();}
}
export function saveSettings(storage: Store | undefined, s: MemorySettings): boolean {
  try {storage?.setItem(SETTINGS_KEY, JSON.stringify(normalizeSettings(s))); return !!storage;} catch {return false;}
}
export const usable = (s: ApiSlot) => s.enabled && /^https?:\/\/\S+$/i.test(s.url) && !!s.model;
/** 填基地址（…/v1）或完整地址（…/v1/embeddings）都可以。 */
export function endpoint(url: string, path: 'embeddings' | 'rerank'): string {
  const u = url.trim().replace(/\/+$/, '');
  return new RegExp('/' + path + '$', 'i').test(u) ? u : u + '/' + path;
}

export type FetchLike = (url: string, init: {method: string; headers: Record<string, string>; body: string; signal?: AbortSignal}) => Promise<{ok: boolean; status: number; json(): Promise<unknown>}>;
export class ApiError extends Error {}
async function post(fetcher: FetchLike, s: ApiSlot, path: 'embeddings' | 'rerank', body: unknown, timeoutMs: number): Promise<unknown> {
  const ctrl = typeof AbortController === 'function' ? new AbortController() : undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const headers: Record<string, string> = {'Content-Type': 'application/json'};
  if (s.key) headers.Authorization = 'Bearer ' + s.key;
  try {
    const res = await Promise.race([
      fetcher(endpoint(s.url, path), {method: 'POST', headers, body: JSON.stringify(body), ...(ctrl ? {signal: ctrl.signal} : {})}),
      new Promise<never>((_, reject) => {timer = setTimeout(() => {ctrl?.abort(); reject(new ApiError(`超时（${Math.round(timeoutMs / 1000)} 秒）`));}, timeoutMs);}),
    ]);
    if (!res.ok) throw new ApiError(`HTTP ${res.status}${res.status === 401 || res.status === 403 ? '（密钥不对或没有权限）' : res.status === 404 ? '（地址或模型不对）' : res.status === 429 ? '（请求太频繁或额度用完）' : ''}`);
    return await res.json();
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(/abort/i.test(String((e as Error)?.name ?? e)) ? '超时' : '连不上（网络不通，或被浏览器跨域拦截）');
  } finally {if (timer) clearTimeout(timer);}
}
/** 返回与 texts 一一对应的向量；格式不对直接报错（由调用方退回关键词检索）。 */
export async function embed(fetcher: FetchLike, s: ApiSlot, texts: string[], timeoutMs = 8000): Promise<number[][]> {
  if (!texts.length) return [];
  const body = rec(await post(fetcher, s, 'embeddings', {model: s.model, input: texts, encoding_format: 'float'}, timeoutMs));
  const data = Array.isArray(body.data) ? body.data.map(rec) : [];
  const out: (number[] | undefined)[] = Array.from({length: texts.length}, () => undefined);
  data.forEach((d, i) => {const at = Number.isInteger(d.index) ? Number(d.index) : i; if (Array.isArray(d.embedding) && d.embedding.length && d.embedding.every(x => typeof x === 'number' && Number.isFinite(x))) out[at] = d.embedding as number[];});
  if (out.length !== texts.length || out.some(x => !x)) throw new ApiError('返回格式不对：缺少 data[].embedding');
  const dims = out[0]!.length; if (out.some(x => x!.length !== dims)) throw new ApiError('返回的向量维度不一致');
  return out as number[][];
}
/** 返回与 documents 一一对应的相关度（0～1；没返回的为 0）。兼容 relevance_score / score 两种字段名。 */
export async function rerank(fetcher: FetchLike, s: ApiSlot, query: string, documents: string[], timeoutMs = 6000): Promise<number[]> {
  if (!documents.length) return [];
  const body = rec(await post(fetcher, s, 'rerank', {model: s.model, query, documents, top_n: documents.length, return_documents: false}, timeoutMs));
  const results = Array.isArray(body.results) ? body.results.map(rec) : [];
  if (!results.length) throw new ApiError('返回格式不对：缺少 results');
  const out = documents.map(() => 0);
  for (const r of results) {const i = Number(r.index), v = Number(r.relevance_score ?? r.score); if (Number.isInteger(i) && i >= 0 && i < out.length && Number.isFinite(v)) out[i] = Math.max(0, Math.min(1, v));}
  return out;
}
export async function testEmbedding(fetcher: FetchLike, s: ApiSlot, now = Date.now): Promise<TestResult> {
  const t0 = now();
  try {const [a] = await embed(fetcher, {...s, enabled: true}, ['补给员记得玩家最喜欢牛油果', '测试连接'], 10000); return {ok: true, at: now(), ms: now() - t0, dims: a!.length, note: `已连接 · ${a!.length} 维`};}
  catch (e) {return {ok: false, at: now(), ms: now() - t0, note: String((e as Error).message ?? e).slice(0, 100)};}
}
export async function testRerank(fetcher: FetchLike, s: ApiSlot, now = Date.now): Promise<TestResult> {
  const t0 = now();
  try {
    const [hit, miss] = await rerank(fetcher, {...s, enabled: true}, '玩家最喜欢吃什么', ['玩家说他最喜欢吃牛油果', '第 3 层的楼梯在东边'], 10000);
    return {ok: true, at: now(), ms: now() - t0, note: (hit ?? 0) > (miss ?? 0) ? '已连接 · 排序正常' : '已连接 · 但排序看起来不对，请确认模型是重排模型'};
  } catch (e) {return {ok: false, at: now(), ms: now() - t0, note: String((e as Error).message ?? e).slice(0, 100)};}
}
/** 连续失败后暂停调用一段时间，免得每句话都白等超时。 */
export class Breaker {
  private until = 0; private failures = 0;
  constructor(private readonly coolMs = 60000) {}
  open(now: number): boolean {return now < this.until;}
  ok(): void {this.failures = 0; this.until = 0;}
  fail(now: number): void {this.failures++; this.until = now + this.coolMs * Math.min(4, this.failures);}
}
