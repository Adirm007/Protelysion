/** 补给员长期记忆服务（宿主侧）：读写聊天变量里的记忆、观察游戏事件、在每句对话前检索并注入、
 *  见面结束后异步整理、被杀害时清空。所有网络与写入失败都留在这里：游戏和对话照常进行。 */
import {buildSupplierPrompt, type SupplierPrompt, type SupplierContext, type TalkLine, type TalkSession} from '../game/supplier-agent';
import {takeSupplierTalk, type SupplierLedgerEntry} from '../game/supplier-ledger';
import {migrateStore, emptyStore, type MemoryStore, type LoadResult} from './schema';
import {recordEncounter, applyExtraction, fallbackExtraction, forgetFact, noteRun, endRun, wipeStore, activeFacts, callName, type EncounterInput, type ApplyReport} from './store';
import {memoryItems, scoreItems, renderMemory, episodeLine, MEMORY_RULES, type RetrievalSignals, type MemoryItem, type MemorySection} from './retrieve';
import {buildExtractionPrompt, parseExtraction} from './extract';
import {loadSettings, saveSettings, normalizeSettings, usable, embed, rerank, testEmbedding, testRerank, Breaker, type MemorySettings, type FetchLike, type TestResult} from './apis';
import {memoryVectorCache, vectorKey, type VectorCache, type Vector} from './vectors';
import {cosine, safeText} from './text';

export type MemoryLLM = (system: string, user: string, opts: {custom?: {apiurl: string; key: string; model: string}; timeoutMs: number}) => Promise<string>;
export type MemoryPort = {
  /** `${characterId}:${chatId}`，与书海存档同一身份。 */
  contextId: string;
  read(): unknown;
  /** 写入聊天变量并保存聊天；聊天已切换时必须抛错。 */
  write(store: MemoryStore): Promise<void>;
  /** 这个聊天在记忆上线前就有过书海旅程。 */
  legacyHint?(): boolean;
  /** 聊天存档里已结束的远征（正文模式里离开迷宫时，记忆服务不在场，靠它补记）。 */
  endedRuns?(): {id: string; status: string; startDepth: number; maxDepth: number}[];
  llm?: MemoryLLM;
  lock?<T>(fn: () => Promise<T>): Promise<T>;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  vectors?: VectorCache;
  fetch?: FetchLike;
  now?(): number;
};
export type ObservedState = {run: {id: string; status: string}; mode: string; depth: number; depthLog?: {start: number; maximum: number}; supplierState?: {thingId: string; talk?: boolean}; supplierTalks?: Record<string, TalkSession>};
export type AugmentRequest = {prompt: SupplierPrompt; context: SupplierContext; log: TalkLine[]};
export type RetrievalMode = 'lexical' | 'hybrid' | 'lexical+rerank' | 'hybrid+rerank';
export type MemoryStatus = {
  load: LoadResult['status'] | 'error'; readOnly: boolean; enabled: boolean; epoch: number; retrieval: RetrievalMode; bytes: number;
  counts: {facts: number; guesses: number; history: number; episodes: number; reflections: number; digests: number; runs: number; pending: number; encounters: number};
  last?: {at: number; ms: number; mode: RetrievalMode; core: number; retrieved: number; tokens: number; note: string};
  extract?: {at: number; ok: boolean; note: string}; write?: {at: number; ok: boolean; note: string};
};
export type MemoryView = {
  epoch: number; wipedBy?: string; callName?: string; encounters: number; talks: number; closeness: number; stance?: string;
  facts: {id: string; text: string; source: string; kind: string; n: number; history: string[]}[];
  episodes: {id: string; line: string}[]; reflections: {id: string; text: string}[]; digests: string[];
};
export type SupplierMemory = {
  ready: Promise<void>;
  epoch(): number; enabled(): boolean; greeting(): string | undefined;
  observe(state: ObservedState, entries: SupplierLedgerEntry[]): void;
  augment(req: AugmentRequest): Promise<SupplierPrompt>;
  section(query: string): Promise<MemorySection & {mode: RetrievalMode}>;
  flush(state?: ObservedState): Promise<void>;
  wipe(reason: 'kill' | 'manual', killId?: string): Promise<void>;
  forget(id: string): Promise<boolean>;
  settings(): MemorySettings; saveSettings(next: MemorySettings): void;
  test(kind: 'embedding' | 'rerank' | 'extraction', draft?: MemorySettings): Promise<TestResult>;
  status(): MemoryStatus; view(): MemoryView; subscribe(fn: () => void): () => void;
  /** 等后台的写入和整理都做完（测试与“离开前保存”用）。 */
  idle(): Promise<void>;
  dispose(): void;
};
export const DISABLED_SECTION = '【你对玩家的记忆】\n（玩家关掉了你的长期记忆：这次你不记得以前的任何事。被问起往事就说记不清，不要编。）';
export const tombstoneKey = (contextId: string) => 'booksea-supplier-memory-wipe:' + contextId;
type Buffer = Omit<EncounterInput, 'lines'>;
const message = (e: unknown) => safeText((e as Error)?.message ?? e, 80) || '未知错误';
function deadline<T>(work: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([work, new Promise<never>((_, reject) => {timer = setTimeout(() => reject(Error(what + '超时')), Math.max(0, ms));})]).finally(() => {if (timer) clearTimeout(timer);});
}

export function createSupplierMemory(port: MemoryPort, options: {retrievalMs?: number; extractMs?: number} = {}): SupplierMemory {
  const now = () => port.now?.() ?? Date.now();
  const vectors = port.vectors ?? memoryVectorCache(), fetcher = port.fetch;
  const embedBreaker = new Breaker(), rerankBreaker = new Breaker(), listeners = new Set<() => void>();
  let settings = loadSettings(port.storage);
  let store: MemoryStore = emptyStore(port.contextId, 1, now()), load: MemoryStatus['load'] = 'fresh', readOnly = false, disposed = false, loaded = false;
  let current: Buffer | undefined, last: MemoryStatus['last'], wrote: MemoryStatus['write'];
  let chain: Promise<void> = Promise.resolve(), jobs: Promise<void> = Promise.resolve(), dirty = false, retry: ReturnType<typeof setTimeout> | undefined, retries = 0;
  const notify = () => {for (const fn of listeners) try {fn();} catch {/* 界面回调出错不影响记忆 */}};
  const tomb = (): {epoch: number; reason?: 'kill' | 'manual'} | undefined => {
    try {const v = JSON.parse(port.storage?.getItem(tombstoneKey(port.contextId)) ?? 'null'); return v && Number.isFinite(v.epoch) ? {epoch: Number(v.epoch), ...(v.reason === 'kill' || v.reason === 'manual' ? {reason: v.reason} : {})} : undefined;} catch {return undefined;}
  };
  const mode = (): RetrievalMode => ((usable(settings.embedding) && fetcher ? 'hybrid' : 'lexical') + (usable(settings.rerank) && fetcher ? '+rerank' : '')) as RetrievalMode;
  const extracting = () => settings.extraction.mode !== 'off' && !!port.llm && (settings.extraction.mode !== 'custom' || /^https?:\/\//i.test(settings.extraction.url) && !!settings.extraction.model);

  /** 整份写回（记忆不大，整写最不容易出错）；同一时间只有一个写入，失败就退避重试。 */
  function persist(): Promise<void> {
    if (readOnly) return chain;
    dirty = true;
    chain = chain.then(async () => {
      if (!dirty) return; dirty = false;
      const snapshot = structuredClone(store); snapshot.updatedAt = now();
      const write = async () => {
        // 别的页面已经换了一任补给员：认它的，绝不拿旧的覆盖回去。
        const theirs = migrateStore(port.read(), port.contextId, now());
        if (theirs.status !== 'fresh' && theirs.status !== 'newer' && theirs.store.epoch > snapshot.epoch) {store = theirs.store; current = undefined; return;}
        await port.write(snapshot);
      };
      try {await (port.lock ? port.lock(write) : write()); wrote = {at: now(), ok: true, note: ''}; retries = 0;}
      catch (e) {
        wrote = {at: now(), ok: false, note: message(e)}; dirty = true;
        if (!disposed && !retry && retries < 5) retry = setTimeout(() => {retry = undefined; retries++; void persist();}, 2000 * 2 ** retries);
      }
      notify();
    });
    return chain;
  }
  function reconcileRuns() {
    if (!settings.enabled || readOnly) return false;
    let changed = false;
    for (const r of port.endedRuns?.() ?? []) if ((r.status === 'success' || r.status === 'failed') && endRun(store, {id: r.id, outcome: r.status, startDepth: r.startDepth, maxDepth: r.maxDepth, at: now()})) changed = true;
    return changed;
  }
  const ready = (async () => {
    try {
      const read = migrateStore(port.read(), port.contextId, now());
      store = read.store; load = read.status; readOnly = read.status === 'newer';
      const t = tomb();
      // 本机墓碑比存档新：说明清空没写进聊天（或聊天被换回了旧文件）。旧记忆作废。
      if (t && t.epoch > store.epoch && !readOnly) {store = emptyStore(port.contextId, t.epoch, now(), {kills: store.kills}); if (t.reason) store.wipedBy = t.reason; load = 'repaired';}
      if (read.status === 'fresh' && port.legacyHint?.()) store.legacy = true;
      loaded = true;
      const changed = reconcileRuns();
      if (load === 'repaired' || load === 'adopted' || changed) await persist();
      if (store.pending.length) scheduleJobs();
    } catch (e) {load = 'error'; loaded = true; wrote = {at: now(), ok: false, note: message(e)};}
    notify();
  })();

  function flushBuffer(state: ObservedState | undefined, buf: Buffer) {
    const lines = state ? takeSupplierTalk(state, buf.thing).filter(l => l.text).map(l => ({role: l.role, text: l.text})) : [];
    const {job} = recordEncounter(store, {...buf, lines}, {extract: extracting()});
    if (job) scheduleJobs();
  }
  function scheduleJobs() {
    jobs = jobs.then(async () => {
      while (!disposed) {
        const job = store.pending[0]; if (!job) return;
        const epoch = store.epoch;
        if (!extracting() || job.tries >= 2) {fallbackExtraction(store, job); await persist(); continue;}
        job.tries++;
        let raw = '', note = '';
        try {
          const {system, user} = buildExtractionPrompt(store, job, now());
          const custom = settings.extraction.mode === 'custom' ? {apiurl: settings.extraction.url, key: settings.extraction.key, model: settings.extraction.model} : undefined;
          raw = await deadline(port.llm!(system, user, {...(custom ? {custom} : {}), timeoutMs: options.extractMs ?? 60000}), (options.extractMs ?? 60000) + 1000, '整理');
        } catch (e) {note = message(e);}
        // 整理期间她被杀害了：结果属于上一任，丢掉。
        if (disposed || store.epoch !== epoch) return;
        const live = store.pending.find(p => p.key === job.key); if (!live) continue;
        const ex = raw ? parseExtraction(raw) : undefined;
        if (ex) {applyExtraction(store, live, ex, now()); void embedFresh();}
        else {
          store.lastExtract = {at: now(), ok: false, note: note || '整理结果不是 JSON'};
          if (live.tries >= 2) fallbackExtraction(store, live);
          else {await persist(); notify(); return;}
        }
        await persist(); notify();
      }
    }).catch(() => {/* 整理失败只记在状态里 */});
  }

  async function vectorsFor(items: MemoryItem[], until: number): Promise<Map<string, Vector>> {
    const model = settings.embedding.model, keys = items.map(i => vectorKey(port.contextId, store.epoch, model, i.index));
    const cached = await vectors.get(keys), out = new Map<string, Vector>();
    const missing: number[] = [];
    items.forEach((it, k) => {const v = cached.get(keys[k]!); if (v) out.set(it.id, v); else missing.push(k);});
    for (let i = 0; i < missing.length && now() < until; i += 32) {
      const batch = missing.slice(i, i + 32), got = await deadline(embed(fetcher!, settings.embedding, batch.map(k => items[k]!.index)), until - now(), '向量');
      await vectors.put(batch.map((k, j) => [keys[k]!, got[j]!]));
      batch.forEach((k, j) => out.set(items[k]!.id, got[j]!));
    }
    return out;
  }
  /** 后台给新记忆算向量，下一句话检索时就不用等。 */
  async function embedFresh() {
    if (!usable(settings.embedding) || !fetcher || embedBreaker.open(now())) return;
    try {await vectorsFor(memoryItems(store, now()), now() + 20000); embedBreaker.ok();} catch {embedBreaker.fail(now());}
  }
  const queryOf = (log: TalkLine[]) => {
    const player = [...log].reverse().find(l => l.role === 'player')?.text ?? '';
    const before = Array.from(player).length < 8 ? [...log].reverse().find(l => l.role === 'supplier')?.text ?? '' : '';
    return safeText(`${player} ${Array.from(before).slice(0, 40).join('')}`, 360);
  };
  async function section(query: string): Promise<MemorySection & {mode: RetrievalMode}> {
    const t0 = now(), until = t0 + (options.retrievalMs ?? 4500), items = memoryItems(store, t0), signals: RetrievalSignals = {};
    let used: RetrievalMode = 'lexical', note = '';
    if (items.length && query && usable(settings.embedding) && fetcher && !embedBreaker.open(t0)) {
      try {
        const [vecs, [q]] = await Promise.all([vectorsFor(items, until), deadline(embed(fetcher, settings.embedding, [query]), until - now(), '向量')]);
        signals.dense = new Map([...vecs].map(([id, v]) => [id, cosine(q!, v)]));
        embedBreaker.ok(); used = 'hybrid';
      } catch (e) {embedBreaker.fail(now()); note = '向量：' + message(e);}
    }
    let scored = scoreItems(store, items, query, now(), signals);
    if (items.length && query && usable(settings.rerank) && fetcher && !rerankBreaker.open(now())) {
      const top = [...scored].sort((a, b) => (b.score || .35 * b.recency + .35 * b.salience - 1) - (a.score || .35 * a.recency + .35 * a.salience - 1)).slice(0, 20);
      try {
        const rr = await deadline(rerank(fetcher, settings.rerank, query, top.map(s => s.item.text)), until - now(), '重排');
        signals.rerank = new Map(top.map((s, i) => [s.item.id, rr[i] ?? 0]));
        scored = scoreItems(store, items, query, now(), signals); rerankBreaker.ok(); used = (used + '+rerank') as RetrievalMode;
      } catch (e) {rerankBreaker.fail(now()); note += (note ? '；' : '') + '重排：' + message(e);}
    }
    const out = renderMemory(store, scored, now(), settings.budget);
    const at = now();
    for (const id of [...out.core, ...out.retrieved]) {
      const hit = store.facts.find(f => f.id === id) ?? store.episodes.find(e => e.id === id);
      if (hit) {hit.lastRecall = {n: store.n, at}; hit.recalls = (hit.recalls ?? 0) + 1;}
    }
    last = {at, ms: at - t0, mode: used, core: out.core.length, retrieved: out.retrieved.length, tokens: out.tokens, note};
    notify();
    return {...out, mode: used};
  }
  /** 存档在创建时就同步读好了，所以清空也是同步生效的：返回之前 epoch() 已经是新的一任。 */
  async function wipe(reason: 'kill' | 'manual', killId?: string) {
    if (!loaded) await ready;
    if (killId && store.kills.includes(killId)) return;
    const next = wipeStore({...store, epoch: Math.max(store.epoch, tomb()?.epoch ?? 0)}, now(), reason, killId);
    // 先写本机墓碑（同步），再写聊天：哪怕这页马上被关掉，旧记忆也回不来。
    try {port.storage?.setItem(tombstoneKey(port.contextId), JSON.stringify({epoch: next.epoch, at: now(), reason}));} catch {/* 被禁用的存储只能靠聊天变量 */}
    store = next; current = undefined; last = undefined; readOnly = false;
    notify();
    await Promise.all([vectors.purge(port.contextId).catch(() => {}), persist()]);
  }

  const api: SupplierMemory = {
    ready,
    epoch: () => store.epoch,
    enabled: () => settings.enabled && !readOnly,
    greeting() {
      if (!api.enabled()) return undefined;
      const name = callName(store);
      if (name) return `嗯？${safeText(name, 12)}，想聊什么。`;
      if (store.n > 0) return '嗯？又是你。想聊什么。';
      return store.epoch > 1 ? '嗯？……新面孔。想聊什么。' : undefined;
    },
    observe(state, entries) {
      if (disposed) return;
      let changed = false;
      for (const e of entries) {
        if (e.t === 'kill') {if (!store.kills.includes(e.id)) {current = undefined; void wipe('kill', e.id);} continue;}
        if (!api.enabled() || store.consumed.includes(e.id)) continue;
        store.consumed.push(e.id); changed = true;
        const key = e.run + '|' + e.thing;
        if (current && current.key !== key) {flushBuffer(state, current); current = undefined;}
        current ??= {key, run: e.run, thing: e.thing, depth: e.depth, place: e.place, theme: e.theme, at: e.at, choices: [], buys: [], deals: [], gifts: [], misses: []};
        current.at = e.at;
        if (e.t === 'choice' && e.choice) current.choices.push(e.choice);
        else if (e.t === 'buy') current.buys.push({label: safeText(e.label, 40), price: e.price ?? 0});
        else if (e.t === 'deal') (e.price ? current.deals : current.gifts).push({label: safeText(e.label, 40), price: e.price ?? 0});
        else if (e.t === 'nodeal') current.misses.push(safeText(`${e.kind ?? ''}（${e.reason ?? ''}）`, 40));
      }
      if (api.enabled()) {
        if (current && (state.mode !== 'supplier' || state.supplierState?.thingId !== current.thing || state.run.id !== current.run)) {flushBuffer(state, current); current = undefined; changed = true;}
        if (state.run?.id) {
          const depth = Math.max(state.depth, state.depthLog?.maximum ?? 0), note = store.runs.find(r => r.id === state.run.id);
          if (!note || note.maxDepth < depth) noteRun(store, {id: state.run.id, startDepth: state.depthLog?.start ?? state.depth, depth, at: now()});
          if (!note) changed = true;
          if (state.mode === 'ended' && (state.run.status === 'success' || state.run.status === 'failed') && endRun(store, {id: state.run.id, outcome: state.run.status, startDepth: state.depthLog?.start ?? 1, maxDepth: depth, at: now()})) changed = true;
        }
      }
      if (changed) {void persist(); notify();}
    },
    async augment(req) {
      try {
        await ready;
        if (!api.enabled()) return buildSupplierPrompt(req.context, req.log, DISABLED_SECTION);
        return buildSupplierPrompt(req.context, req.log, (await section(queryOf(req.log))).text);
      } catch {return req.prompt;}
    },
    section: async query => {await ready; return section(query);},
    async flush(state) {
      if (current && api.enabled()) {flushBuffer(state, current); current = undefined;}
      await persist();
    },
    wipe,
    async forget(id) {
      await ready;
      if (!forgetFact(store, id)) return false;
      await persist(); notify();
      void vectors.keep(port.contextId, new Set(memoryItems(store, now()).map(i => vectorKey(port.contextId, store.epoch, settings.embedding.model, i.index)))).catch(() => {});
      return true;
    },
    settings: () => structuredClone(settings),
    saveSettings(next) {settings = normalizeSettings(next); saveSettings(port.storage, settings); notify(); if (store.pending.length) scheduleJobs(); void embedFresh();},
    async test(kind, draft) {
      const s = draft ? normalizeSettings(draft) : settings, t0 = now();
      let result: TestResult;
      if (kind === 'embedding') result = fetcher ? await testEmbedding(fetcher, s.embedding, now) : {ok: false, at: now(), ms: 0, note: '这里不能发网络请求'};
      else if (kind === 'rerank') result = fetcher ? await testRerank(fetcher, s.rerank, now) : {ok: false, at: now(), ms: 0, note: '这里不能发网络请求'};
      else if (!port.llm) result = {ok: false, at: now(), ms: 0, note: '需要在酒馆里打开'};
      else try {
        const custom = s.extraction.mode === 'custom' ? {apiurl: s.extraction.url, key: s.extraction.key, model: s.extraction.model} : undefined;
        const raw = await deadline(port.llm('只输出一个 JSON：{"ok":true}', '测试连接。', {...(custom ? {custom} : {}), timeoutMs: 30000}), 31000, '整理模型');
        result = {ok: /"ok"\s*:\s*true/.test(raw), at: now(), ms: now() - t0, note: /"ok"\s*:\s*true/.test(raw) ? '已连接 · 能按格式回复' : '连上了，但回复不是要求的 JSON'};
      } catch (e) {result = {ok: false, at: now(), ms: now() - t0, note: message(e)};}
      settings = {...settings, tests: {...settings.tests, [kind]: result}}; saveSettings(port.storage, settings); notify();
      return result;
    },
    status: () => ({load, readOnly, enabled: api.enabled(), epoch: store.epoch, retrieval: mode(), bytes: JSON.stringify(store).length,
      counts: {facts: activeFacts(store).filter(f => f.source !== 'inferred').length, guesses: activeFacts(store).filter(f => f.source === 'inferred').length, history: store.facts.filter(f => f.status !== 'active').length,
        episodes: store.episodes.length, reflections: store.reflections.length, digests: store.digests.length, runs: store.runs.length, pending: store.pending.length, encounters: store.n},
      ...(last ? {last} : {}), ...(store.lastExtract ? {extract: store.lastExtract} : {}), ...(wrote ? {write: wrote} : {})}),
    view() {
      const t = now(), rel = store.relationship, name = callName(store);
      return {epoch: store.epoch, ...(store.wipedBy ? {wipedBy: store.wipedBy} : {}), ...(name ? {callName: name} : {}), encounters: store.n, talks: rel.talks, closeness: rel.closeness, ...(rel.stance ? {stance: rel.stance} : {}),
        facts: activeFacts(store).sort((a, b) => b.importance - a.importance || b.n - a.n).map(f => ({id: f.id, text: f.text, source: f.source, kind: f.kind, n: f.n,
          history: store.facts.filter(x => x.status === 'superseded' && x.supersededBy === f.id).map(x => x.value ?? x.text)})),
        episodes: [...store.episodes].sort((a, b) => b.at - a.at).slice(0, 12).map(e => ({id: e.id, line: episodeLine(e, t)})),
        reflections: store.reflections.filter(r => r.status === 'active').map(r => ({id: r.id, text: r.text})), digests: store.digests.map(d => d.text)};
    },
    subscribe(fn) {listeners.add(fn); return () => listeners.delete(fn);},
    async idle() {await ready; for (let i = 0; i < 4; i++) {await jobs; await chain;}},
    dispose() {disposed = true; if (retry) clearTimeout(retry); listeners.clear();},
  };
  return api;
}
export {MEMORY_RULES};
export type {ApplyReport};
