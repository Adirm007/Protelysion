/** 向量缓存：向量可以随时从文字重算，所以只放在这台设备的 IndexedDB（没有就放内存），不进聊天存档。
 *  键里带聊天与 epoch：换了一任补给员，旧 epoch 的向量永远查不到，并在清空时整批删除。 */
import {hash} from './text';

export type Vector = ArrayLike<number>;
export type VectorCache = {
  get(keys: string[]): Promise<Map<string, Vector>>;
  put(entries: [string, Vector][]): Promise<void>;
  /** 删掉这个聊天的全部向量（所有 epoch）。 */
  purge(chat: string): Promise<void>;
  /** 只保留这个聊天里仍在使用的键。 */
  keep(chat: string, live: Set<string>): Promise<void>;
  size(chat: string): Promise<number>;
};
const chatTag = (chat: string) => 'c' + hash(chat) + '.' + chat.length;
export const vectorKey = (chat: string, epoch: number, model: string, text: string) => `${chatTag(chat)}|${epoch}|${hash(model)}|${hash(text)}.${text.length}`;
const chatOf = (key: string) => key.slice(0, key.indexOf('|'));

export function memoryVectorCache(): VectorCache {
  const map = new Map<string, Vector>();
  return {
    async get(keys) {const out = new Map<string, Vector>(); for (const k of keys) {const v = map.get(k); if (v) out.set(k, v);} return out;},
    async put(entries) {for (const [k, v] of entries) map.set(k, v);},
    async purge(chat) {const tag = chatTag(chat); for (const k of [...map.keys()]) if (chatOf(k) === tag) map.delete(k);},
    async keep(chat, live) {const tag = chatTag(chat); for (const k of [...map.keys()]) if (chatOf(k) === tag && !live.has(k)) map.delete(k);},
    async size(chat) {const tag = chatTag(chat); let n = 0; for (const k of map.keys()) if (chatOf(k) === tag) n++; return n;},
  };
}
const DB = 'booksea-supplier-memory', STORE = 'vectors';
/** IndexedDB 版；打开失败（隐私模式、被禁用）时自动退回内存版。 */
export function idbVectorCache(factory: IDBFactory | undefined): VectorCache {
  const fallback = memoryVectorCache();
  let opening: Promise<IDBDatabase | undefined> | undefined;
  const open = () => opening ??= new Promise<IDBDatabase | undefined>(resolve => {
    if (!factory) {resolve(undefined); return;}
    try {
      const req = factory.open(DB, 1);
      req.onupgradeneeded = () => {const db = req.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, {keyPath: 'k'}).createIndex('c', 'c');};
      req.onsuccess = () => resolve(req.result); req.onerror = () => resolve(undefined); req.onblocked = () => resolve(undefined);
    } catch {resolve(undefined);}
  });
  const tx = async <T>(mode: IDBTransactionMode, run: (s: IDBObjectStore, done: (v: T) => void) => void, otherwise: () => Promise<T>): Promise<T> => {
    const db = await open(); if (!db) return otherwise();
    return new Promise<T>(resolve => {
      try {const t = db.transaction(STORE, mode); let value: T | undefined; run(t.objectStore(STORE), v => {value = v;}); t.oncomplete = () => resolve(value as T); t.onerror = () => {void otherwise().then(resolve);}; t.onabort = () => {void otherwise().then(resolve);};}
      catch {void otherwise().then(resolve);}
    });
  };
  const eachOfChat = (s: IDBObjectStore, chat: string, fn: (cursor: IDBCursorWithValue) => void) => {
    const req = s.index('c').openCursor(IDBKeyRange.only(chatTag(chat)));
    req.onsuccess = () => {const c = req.result; if (c) {fn(c); c.continue();}};
  };
  return {
    get: keys => tx<Map<string, Vector>>('readonly', (s, done) => {const out = new Map<string, Vector>(); done(out); for (const k of keys) {const r = s.get(k); r.onsuccess = () => {const v = r.result?.v; if (v) out.set(k, v);};}}, () => fallback.get(keys)),
    put: entries => tx<void>('readwrite', s => {for (const [k, v] of entries) s.put({k, c: chatOf(k), v: Float32Array.from(Array.from(v)), at: Date.now()});}, () => fallback.put(entries)),
    purge: chat => tx<void>('readwrite', s => eachOfChat(s, chat, c => c.delete()), () => fallback.purge(chat)).then(() => fallback.purge(chat)),
    keep: (chat, live) => tx<void>('readwrite', s => eachOfChat(s, chat, c => {if (!live.has(String(c.primaryKey))) c.delete();}), () => fallback.keep(chat, live)),
    size: chat => tx<number>('readonly', (s, done) => {const r = s.index('c').count(IDBKeyRange.only(chatTag(chat))); done(0); r.onsuccess = () => done(r.result);}, () => fallback.size(chat)),
  };
}
