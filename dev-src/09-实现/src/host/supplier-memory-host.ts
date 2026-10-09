/** 宿主侧接线：补给员长期记忆存在当前聊天的聊天变量 booksea.supplierMemory 里（按聊天＝按存档），
 *  不写消息楼层快照，所以读档回退不会把记忆（尤其是被杀害清空后的记忆）带回来。
 *  整理模型默认走补给员对话同一条独立API路由（booksea_supplier）；读者“独立API”里单独设了 booksea_memory 时用它；
 *  在记忆设置里填了独立接口时，经 generateRaw 的 custom_api 发出（请求由酒馆后端转发，不受浏览器跨域限制）。 */
import {INDEPENDENT_API_V2_KEY, withIndependentApi} from './game-session';
import {MEMORY_KEY} from '../supplier-memory/schema';
import {createSupplierMemory, type MemoryPort, type SupplierMemory} from '../supplier-memory/service';
import {idbVectorCache} from '../supplier-memory/vectors';
import type {FetchLike} from '../supplier-memory/apis';

type Obj = Record<string, unknown>;
const rec = (v: unknown): Obj => v && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {};
function storageOf(globals: any): MemoryPort['storage'] {
  try {const s = globals.localStorage; return s && typeof s.getItem === 'function' ? s : undefined;} catch {return undefined;}
}
/** 读者独立API v2 里是否明确给“补给员记忆整理”设了路由。 */
function routedMemory(globals: any): boolean {
  for (const w of [globals, globals?.parent]) {
    try {const v = JSON.parse(w?.localStorage?.getItem(INDEPENDENT_API_V2_KEY) ?? 'null'); if (v && typeof v === 'object') return !!rec(v.routes).booksea_memory;} catch {/* 另一个源的父页面读不到就算了 */}
  }
  return false;
}
type Run = {run?: {id?: string; status?: string}; mode?: string; depth?: number; depthLog?: {start?: number; maximum?: number}};
export function hostMemoryPort(globals: any, progress?: () => Obj): MemoryPort {
  const h = globals.TavernHelper ?? globals, c = () => globals.SillyTavern.getContext();
  const id = () => `${c().characterId}:${c().getCurrentChatId()}`, pinned = id();
  const assert = () => {if (id() !== pinned) throw Error('聊天已切换，记忆没有写入');};
  const raw = () => rec(rec(h.getVariables({type: 'chat'})).booksea);
  const book = () => {try {return rec((progress?.() ?? {}).booksea);} catch {return raw();}};
  const port: MemoryPort = {
    contextId: pinned,
    read() {assert(); return raw()[MEMORY_KEY];},
    async write(store) {
      assert();
      await h.updateVariablesWith((v: Obj) => {assert(); return {...v, booksea: {...rec(v.booksea), [MEMORY_KEY]: store}};}, {type: 'chat'});
      assert(); await c().saveChat();
    },
    legacyHint() {const b = {...raw(), ...book()}; return !!b.lastExpedition || !!b.activeExpedition || Object.keys(rec(b.exitDeliveries)).length > 0;},
    endedRuns() {
      const b = {...raw(), ...book()};
      return [b.lastExpedition, b.activeExpedition].map(x => rec(x) as Run).filter(s => s.mode === 'ended' && s.run?.id)
        .map(s => ({id: String(s.run!.id), status: String(s.run!.status), startDepth: Number(s.depthLog?.start) || 1, maxDepth: Math.max(Number(s.depthLog?.maximum) || 1, Number(s.depth) || 1)}));
    },
    async llm(system, user, {custom, timeoutMs}) {
      assert(); if (typeof h.generateRaw !== 'function') throw Error('当前酒馆助手不支持独立生成');
      const gid = 'booksea-memory-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      const base: Obj = {generation_id: gid, should_stream: false, should_silence: true, max_chat_history: 0, ordered_prompts: [{role: 'system', content: system}, {role: 'user', content: user}]};
      const config = custom ? {...base, custom_api: {apiurl: custom.apiurl, key: custom.key, model: custom.model, source: 'openai'}} : withIndependentApi(globals, base, routedMemory(globals) ? 'booksea_memory' : 'booksea_supplier');
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return String(await Promise.race([h.generateRaw(config), new Promise<never>((_, reject) => {timer = setTimeout(() => {try {h.stopGenerationById?.(gid);} catch {/* best effort */} reject(Error('整理超时'));}, timeoutMs);})]) ?? '');
      } finally {if (timer) clearTimeout(timer);}
    },
    storage: storageOf(globals),
    vectors: idbVectorCache((() => {try {return globals.indexedDB as IDBFactory | undefined;} catch {return undefined;}})()),
    ...(typeof globals.fetch === 'function' ? {fetch: ((url, init) => globals.fetch(url, init)) as FetchLike} : {}),
  };
  if (globals.navigator?.locks?.request) port.lock = fn => globals.navigator.locks.request(`booksea-supplier-memory:${pinned}`, fn);
  return port;
}
export function mountHostSupplierMemory(globals: any, progress?: () => Obj): SupplierMemory {
  return createSupplierMemory(hostMemoryPort(globals, progress));
}
