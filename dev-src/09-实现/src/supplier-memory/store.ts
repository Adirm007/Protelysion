/** 补给员记忆：写入路径。
 *  - 确定性事件（见面、成交、购买、远征结局）直接记账，不经 LLM；
 *  - 对话里的“关于玩家的事”由整理模型抽取，再按 Mem0 式的 ADD / UPDATE / RETRACT / FORGET / NOOP 合并；
 *  - 合并前逐条核对：玩家亲口说的必须能在玩家原话里找到，补给员自己的玩笑只能记成“她自己说的”，
 *    同一槽位（名字、最喜欢的食物……）新值到来时旧值转为“已过时”（Zep 式有效期），永远不覆盖历史。 */
import {MEMORY_LIMITS, FACT_KINDS, SLOT, emptyStore, type MemoryStore, type Fact, type FactKind, type MemorySource, type Episode, type EpisodeMeta, type DealNote, type PendingJob, type PendingLine, type RunNote, type Reflection, type Digest} from './schema';
import {safeText, compact, containment, bigrams, jaccard, monthDay} from './text';
import {retention, isPinned} from './decay';

export type EncounterInput = {
  key: string; run: string; thing: string; depth: number; place: string; theme: string; at: number;
  choices: string[]; buys: DealNote[]; deals: DealNote[]; gifts: DealNote[]; misses: string[]; lines: PendingLine[];
};
export type ExtractedMemory = {op?: string; id?: string; kind?: string; slot?: string; text?: string; value?: string; source?: string; quote?: string; importance?: number; confidence?: number; keywords?: string[]};
export type Extraction = {
  memories?: ExtractedMemory[];
  episode?: {summary?: string; quote?: string; importance?: number; keywords?: string[]};
  relationship?: {stance?: string; closeness?: number};
  reflections?: {text?: string; evidence?: string[]; importance?: number}[];
};
export type ApplyReport = {added: string[]; superseded: string[]; retracted: string[]; forgotten: string[]; merged: string[]; reflections: string[]; rejected: {text: string; reason: string}[]; summary: boolean};

export const activeFacts = (s: Pick<MemoryStore, 'facts'>) => s.facts.filter(f => f.status === 'active');
export function nextId(store: MemoryStore, prefix: 'f' | 'e' | 'r' | 'd'): string {store.seq++; return prefix + store.seq;}
/** 她该怎么称呼玩家：玩家指定的称呼优先，其次是名字；都不知道就不叫名字。 */
export function callName(store: Pick<MemoryStore, 'facts'>): string | undefined {
  const facts = activeFacts(store);
  return facts.find(f => f.slot === 'nickname' && f.value)?.value ?? facts.find(f => f.slot === 'name' && f.value)?.value;
}

const SINGLE = new Set(['name', 'nickname', 'age', 'birthday', 'job', 'home', 'pronoun', 'gender']);
export const singleValued = (slot?: string) => !!slot && (SINGLE.has(slot) || slot.startsWith('favorite:') || slot.startsWith('current:'));
const SLOT_ALIASES: Record<string, string> = {名字: 'name', 姓名: 'name', real_name: 'name', player_name: 'name', 称呼: 'nickname', call: 'nickname', call_name: 'nickname', callname: 'nickname', 昵称: 'nickname', 外号: 'nickname', 生日: 'birthday', 年龄: 'age', 职业: 'job', 工作: 'job', 家乡: 'home', hometown: 'home'};
export function normalizeSlot(raw: unknown): string | undefined {
  let s = String(raw ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/：/g, ':');
  if (!s) return undefined;
  s = SLOT_ALIASES[s] ?? s;
  const fav = /^(favorite|favourite|fav|最喜欢的?|喜欢的)[_:]?(.+)$/.exec(s); if (fav) s = 'favorite:' + fav[2]!.replace(/^[_:]+/, '');
  const dis = /^(dislike|hate|讨厌的?|不喜欢的?)[_:]?(.+)$/.exec(s); if (dis) s = 'dislike:' + dis[2]!.replace(/^[_:]+/, '');
  return SLOT.test(s) ? s : undefined;
}
const NEGATIVE = /讨厌|不喜欢|不爱|受不了|恶心|难吃|最烦|不想要|不要再|烦死/;
const POSITIVE = /(?<!不)(?:最喜欢|最爱|喜欢|爱吃|爱喝)/;
/** 槽位方向和原话方向相反（“最喜欢的食物=牛油果”，原话却是“我讨厌牛油果”）。 */
export function polarityConflict(slot: string | undefined, line: string): boolean {
  if (!slot) return false;
  if (slot.startsWith('favorite:')) return NEGATIVE.test(line);
  if (slot.startsWith('dislike:')) return POSITIVE.test(line) && !NEGATIVE.test(line);
  return false;
}
/** 原话核对：去标点后是某句原话的子串，或双字覆盖率达到阈值；返回可以存进记忆的真实原话片段。 */
export function verifyQuote(quote: unknown, lines: string[], threshold = .8): string | undefined {
  const q = compact(quote); if (q.length < 2) return undefined;
  for (const line of lines) if (compact(line).includes(q)) return safeText(quote, MEMORY_LIMITS.quote);
  let best: {line: string; c: number} | undefined;
  for (const line of lines) {const c = containment(quote, line); if (c >= threshold && (!best || c > best.c)) best = {line, c};}
  return best ? safeText(best.line, MEMORY_LIMITS.quote) : undefined;
}
const lineWith = (lines: string[], needle: string) => lines.find(l => compact(l).includes(compact(needle)));

export function noteRun(store: MemoryStore, run: {id: string; startDepth: number; depth: number; at: number}): RunNote {
  let note = store.runs.find(r => r.id === run.id);
  if (!note) {
    for (const r of store.runs) if (!r.outcome) r.outcome = 'unknown';
    note = {id: run.id, no: ++store.runNo, startedAt: run.at, startDepth: Math.max(1, run.startDepth), maxDepth: Math.max(1, run.depth), met: 0};
    store.runs.push(note);
  }
  note.maxDepth = Math.max(note.maxDepth, run.depth);
  return note;
}
const OUTCOME_TEXT = {success: '平安撤离', failed: '队伍全灭败退', unknown: '后来怎么样了，她不知道'} as const;
const OUTCOME_WORDS = {success: ['撤离', '回来', '成功'], failed: ['全灭', '败退', '倒下', '死'], unknown: []} as const;
/** 一趟远征结束：记一条“远征”往事（她是 meta 角色，知道玩家每一趟的结局）。同一趟只记一次。 */
export function endRun(store: MemoryStore, run: {id: string; outcome: 'success' | 'failed'; startDepth: number; maxDepth: number; at: number}): Episode | undefined {
  const note = noteRun(store, {id: run.id, startDepth: run.startDepth, depth: run.maxDepth, at: run.at});
  if (note.outcome === 'success' || note.outcome === 'failed') return undefined;
  note.outcome = run.outcome; note.endedAt = run.at; note.maxDepth = Math.max(note.maxDepth, run.maxDepth);
  const importance = Math.min(9, (run.outcome === 'failed' ? 6 : 4) + (note.maxDepth >= 30 ? 1 : 0));
  const ep: Episode = {id: nextId(store, 'e'), kind: 'run', key: 'run|' + run.id, n: store.n, at: run.at, run: run.id, runNo: note.no, depth: note.maxDepth,
    text: `第 ${note.no} 趟远征：从第 ${note.startDepth} 层出发，最深到第 ${note.maxDepth} 层，${OUTCOME_TEXT[run.outcome]}${note.met ? `（这一趟见过你 ${note.met} 次）` : ''}`,
    keywords: [...OUTCOME_WORDS[run.outcome]], importance, meta: {outcome: run.outcome, maxDepth: note.maxDepth, startDepth: note.startDepth}};
  store.episodes.push(ep); store.reflectAcc += importance;
  return ep;
}

const CHOICE_TEXT: Record<string, string> = {event: '选了「事件」', bench: '选了「长椅」', shop: '逛了商店', talk: '聊了天'};
const list = (notes: DealNote[] | undefined) => (notes ?? []).map(d => `${d.label}（${d.price} FP）`).join('、');
export function describeEncounter(ep: Episode): string {
  const m = ep.meta ?? {}, parts: string[] = [];
  if (m.choice && CHOICE_TEXT[m.choice] && !(m.choice === 'talk' && m.talks)) parts.push(CHOICE_TEXT[m.choice]!);
  if (m.talks) parts.push('聊了天');
  if (m.buys?.length) parts.push('买了' + list(m.buys));
  if (m.deals?.length) parts.push('谈成了' + list(m.deals));
  if (m.gifts?.length) parts.push('她白送了' + m.gifts.map(g => g.label).join('、'));
  if (m.misses?.length) parts.push('没谈成：' + m.misses.join('、'));
  if (!parts.length) parts.push('打了个照面');
  return `第 ${ep.depth ?? '?'} 层「${ep.place ?? ''}」：${parts.join('；')}`;
}
function encounterImportance(m: EpisodeMeta): number {
  return Math.min(8, 2 + (m.talks ? 1 : 0) + (m.deals?.length ? 2 : 0) + (m.gifts?.length ? 3 : 0) + (m.misses?.length ? 1 : 0) + (m.buys?.length ? 1 : 0));
}
const push = <T>(a: T[] | undefined, b: T[]) => {const out = [...(a ?? []), ...b].slice(-8); return out.length ? out : undefined;};
/** 一次见面（同一个补给员实例）的确定性记账；关掉对话框再打开仍算同一次。 */
export function recordEncounter(store: MemoryStore, enc: EncounterInput, opts: {extract: boolean}): {episode: Episode; job?: PendingJob; created: boolean} {
  const rel = store.relationship, run = noteRun(store, {id: enc.run, startDepth: enc.depth, depth: enc.depth, at: enc.at});
  let ep = store.episodes.find(e => e.kind === 'encounter' && e.key === enc.key);
  const created = !ep;
  if (!ep) {
    store.n++; run.met++;
    ep = {id: nextId(store, 'e'), kind: 'encounter', key: enc.key, n: store.n, at: enc.at, run: enc.run, runNo: run.no, depth: enc.depth, place: safeText(enc.place, 24), text: '', importance: 2, meta: {visits: 1, talks: 0, lines: 0}};
    store.episodes.push(ep);
    rel.firstMet ??= {n: ep.n, at: enc.at, depth: enc.depth, place: ep.place ?? ''};
    rel.closeness += 1;
  }
  const m = ep.meta ??= {};
  const talked = enc.lines.some(l => l.role === 'player');
  if (enc.choices.length) m.choice = enc.choices.at(-1);
  m.buys = push(m.buys, enc.buys); m.deals = push(m.deals, enc.deals); m.gifts = push(m.gifts, enc.gifts);
  const misses = [...(m.misses ?? []), ...enc.misses.map(x => safeText(x, 40))].slice(-6); if (misses.length) m.misses = misses;
  m.lines = (m.lines ?? 0) + enc.lines.length;
  if (talked && !m.talks) {m.talks = 1; rel.talks++; rel.closeness += 2;}
  rel.deals += enc.deals.length; rel.gifts += enc.gifts.length; rel.buys += enc.buys.length; rel.misses += enc.misses.length;
  rel.closeness = Math.min(100, rel.closeness + 2 * enc.deals.length + 3 * enc.gifts.length);
  rel.lastSeen = {n: ep.n, at: enc.at, depth: enc.depth, place: ep.place ?? '', run: enc.run};
  if (!ep.summarized) ep.text = describeEncounter(ep);
  const before = ep.importance; ep.importance = Math.max(ep.importance, encounterImportance(m));
  store.reflectAcc += Math.max(0, ep.importance - (created ? 0 : before));
  let job: PendingJob | undefined;
  if (talked) {
    if (opts.extract) {
      job = store.pending.find(p => p.key === enc.key);
      if (job) {job.lines = [...job.lines, ...enc.lines].slice(-24); job.tries = 0; job.at = enc.at;}
      else {job = {key: enc.key, episode: ep.id, n: ep.n, at: enc.at, run: enc.run, depth: enc.depth, place: ep.place ?? '', lines: enc.lines.slice(-24), tries: 0}; store.pending.push(job);}
      if (store.pending.length > MEMORY_LIMITS.pending) store.pending.splice(0, store.pending.length - MEMORY_LIMITS.pending);
      job.reflect = reflectionDue(store);
    } else fallbackExtraction(store, {key: enc.key, episode: ep.id, n: ep.n, at: enc.at, run: enc.run, depth: enc.depth, place: ep.place ?? '', lines: enc.lines, tries: 0});
  }
  return {episode: ep, ...(job ? {job} : {}), created};
}
export const reflectionDue = (store: MemoryStore) => store.reflectAcc >= 30 && store.n - store.lastReflectN >= 3;

function emptyReport(): ApplyReport {return {added: [], superseded: [], retracted: [], forgotten: [], merged: [], reflections: [], rejected: [], summary: false};}
function addFact(store: MemoryStore, job: PendingJob, report: ApplyReport, f: Omit<Fact, 'id' | 'n' | 'at' | 'status' | 'run'>): Fact {
  const active = activeFacts(store), norm = compact(f.value ?? '');
  const twin = active.find(x => f.slot && x.slot === f.slot && singleValued(f.slot) && norm && compact(x.value ?? '') === norm)
    ?? active.find(x => x.kind === f.kind && x.source === f.source && (!f.slot || x.slot === f.slot) && jaccard(bigrams(x.text), bigrams(f.text)) >= .75);
  if (twin) {
    twin.importance = Math.max(twin.importance, f.importance); twin.confidence = Math.max(twin.confidence, f.confidence);
    for (const e of f.evidence) if (!twin.evidence.some(x => x.ep === e.ep && x.quote === e.quote)) twin.evidence.push(e);
    twin.evidence = twin.evidence.slice(-MEMORY_LIMITS.evidence);
    if (f.pinned) twin.pinned = true;
    report.merged.push(twin.id); return twin;
  }
  const fact: Fact = {...f, id: nextId(store, 'f'), n: job.n, at: job.at, run: job.run, status: 'active'};
  if (singleValued(fact.slot)) for (const old of active.filter(x => x.slot === fact.slot)) supersede(old, fact, job, report);
  store.facts.push(fact); report.added.push(fact.id); store.reflectAcc += fact.importance;
  return fact;
}
function supersede(old: Fact, by: Fact, job: PendingJob, report: ApplyReport) {
  old.status = 'superseded'; old.validTo = {n: job.n, at: job.at}; old.supersededBy = by.id; old.pinned = undefined;
  report.superseded.push(old.id);
}
const kindOf = (v: unknown): FactKind => (FACT_KINDS as readonly string[]).includes(String(v)) ? v as FactKind : 'other';
const sourceOf = (v: unknown): MemorySource => v === 'player' || v === 'self' ? v : 'inferred';
const clamp = (v: unknown, lo: number, hi: number, d: number) => {const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;};
const keywordsOf = (v: unknown) => {const k = (Array.isArray(v) ? v : []).map(x => safeText(x, MEMORY_LIMITS.keyword)).filter(Boolean).slice(0, MEMORY_LIMITS.keywords); return k.length ? k : undefined;};
const NUMBER = /\d+(?:\.\d+)?/g;

/** 把整理模型的输出并进记忆。模型可能出错：编造原话、把她的玩笑安到玩家头上、乱删记忆、写错价格——这里逐条拦下。 */
export function applyExtraction(store: MemoryStore, job: PendingJob, ex: Extraction, now: number): ApplyReport {
  const report = emptyReport();
  const player = job.lines.filter(l => l.role === 'player').map(l => l.text), supplier = job.lines.filter(l => l.role === 'supplier').map(l => l.text);
  const reject = (text: unknown, reason: string) => {report.rejected.push({text: safeText(text, 40), reason});};
  let inferred = 0;
  for (const raw of (Array.isArray(ex.memories) ? ex.memories : []).slice(0, 10)) {
    const op = String(raw?.op ?? 'add').toLowerCase();
    if (op === 'noop' || op === 'none') continue;
    const target = raw.id ? store.facts.find(f => f.id === raw.id && f.status === 'active') : undefined;
    if (op === 'retract' || op === 'delete' || op === 'forget') {
      // 删改旧记忆必须有玩家这次的原话撑腰，模型不能自己决定“玩家其实不喜欢了”。
      const quote = verifyQuote(raw.quote, player);
      if (!target) {reject(raw.id, '要删改的记忆不存在'); continue;}
      if (!quote) {reject(target.text, '删改没有玩家原话佐证'); continue;}
      if (op === 'forget') {forgetFact(store, target.id); report.forgotten.push(target.id);}
      else {target.status = 'retracted'; target.validTo = {n: job.n, at: job.at}; target.pinned = undefined; report.retracted.push(target.id);}
      continue;
    }
    const text = safeText(raw.text, MEMORY_LIMITS.factText); if (!text) {reject(raw.text, '空的记忆'); continue;}
    let source = sourceOf(raw.source);
    const kind = kindOf(raw.kind ?? target?.kind), slot = normalizeSlot(raw.slot) ?? target?.slot, value = safeText(raw.value, MEMORY_LIMITS.value) || undefined;
    let confidence = clamp(raw.confidence, 0, 1, source === 'player' ? .9 : .5), importance = Math.round(clamp(raw.importance, 1, 10, 4));
    let quote: string | undefined;
    if (source === 'player') {
      quote = verifyQuote(raw.quote, player) ?? (value ? lineWith(player, value) : undefined);
      const line = quote ? lineWith(player, quote) ?? quote : undefined;
      const valueOk = !value || (!!line && compact(line).includes(compact(value)));
      const identity = slot === 'name' || slot === 'nickname';
      if (!quote || !valueOk || (line && polarityConflict(slot, line))) {
        if (identity) {reject(text, quote ? '名字和原话对不上' : '名字没有原话佐证'); continue;}
        if (line && polarityConflict(slot, line)) {reject(text, '喜恶方向和原话相反'); continue;}
        source = 'inferred'; quote = undefined; confidence = Math.min(confidence, .4);
      }
      if (quote) quote = safeText(quote, MEMORY_LIMITS.quote);
    } else if (source === 'self') {
      quote = verifyQuote(raw.quote, supplier, .6);
      if (!quote) {reject(text, '她自己的话在对话里找不到'); continue;}
      importance = Math.min(importance, 7);
    }
    if (source === 'inferred') {
      if (++inferred > 2) {reject(text, '猜测太多'); continue;}
      confidence = Math.min(confidence, .5); importance = Math.min(importance, 6);
      if (slot === 'name' || slot === 'nickname') {reject(text, '名字不能靠猜'); continue;}
    }
    const pinned = slot === 'name' || slot === 'nickname' || (kind === 'promise' && importance >= 6) || importance >= 8;
    const fact = addFact(store, job, report, {kind, text, source, evidence: [{ep: job.episode, ...(quote ? {quote} : {})}], importance, confidence,
      ...(slot ? {slot} : {}), ...(value ? {value} : {}), ...(keywordsOf(raw.keywords) ? {keywords: keywordsOf(raw.keywords)} : {}), ...(pinned ? {pinned: true} : {})});
    if ((op === 'update' || op === 'replace') && target && target !== fact && target.status === 'active') supersede(target, fact, job, report);
  }
  const ep = store.episodes.find(e => e.id === job.episode);
  if (ep && ex.episode) {
    const summary = safeText(ex.episode.summary, MEMORY_LIMITS.episodeText - 20);
    // 摘要里的数字（价格、层数）必须在对话或账本里出现过，否则宁可用程序记的那条。
    const allowed = new Set([...job.lines.flatMap(l => l.text.match(NUMBER) ?? []), ...JSON.stringify(ep.meta ?? {}).match(NUMBER) ?? [], String(ep.depth ?? '')]);
    if (summary && (summary.match(NUMBER) ?? []).every(x => allowed.has(x))) {ep.text = summary; ep.summarized = true; report.summary = true;}
    else if (summary) reject(summary, '摘要里的数字对不上');
    const quote = verifyQuote(ex.episode.quote, player); if (quote) ep.quote = quote;
    ep.importance = Math.max(ep.importance, Math.round(clamp(ex.episode.importance, 1, 9, ep.importance)));
    const k = keywordsOf(ex.episode.keywords); if (k) ep.keywords = k;
  }
  if (ex.relationship) {
    const rel = store.relationship, stance = safeText(ex.relationship.stance, MEMORY_LIMITS.stance);
    if (stance) {rel.stance = stance; rel.stanceAt = job.at;}
    rel.closeness = Math.max(0, Math.min(100, rel.closeness + Math.round(clamp(ex.relationship.closeness, -3, 5, 0))));
  }
  if (job.reflect) {
    const known = new Set([...store.facts.filter(f => f.status === 'active').map(f => f.id), ...store.episodes.map(e => e.id)]);
    for (const r of (Array.isArray(ex.reflections) ? ex.reflections : []).slice(0, 2)) {
      const text = safeText(r?.text, MEMORY_LIMITS.reflectionText), evidence = (Array.isArray(r?.evidence) ? r.evidence : []).map(String).filter(x => known.has(x)).slice(0, 6);
      if (!text || !evidence.length) {reject(r?.text, '感想没有可核对的依据'); continue;}
      const ref: Reflection = {id: nextId(store, 'r'), text, evidence, importance: Math.round(clamp(r.importance, 1, 7, 4)), n: job.n, at: job.at, status: 'active'};
      store.reflections.push(ref); report.reflections.push(ref.id);
    }
    store.reflectAcc = 0; store.lastReflectN = store.n;
  }
  store.pending = store.pending.filter(p => p.key !== job.key);
  store.lastExtract = {at: now, ok: true, note: `新记 ${report.added.length}、过时 ${report.superseded.length}、拦下 ${report.rejected.length}`};
  compactStore(store, now);
  return report;
}

const NAME_RULES: [RegExp, 'name' | 'nickname'][] = [
  [/我叫([\p{Script=Han}A-Za-z0-9_·]{1,6}?)(?=[，。,.!！?？~～\s]|$|吧|呀|啦|哦|就行|就好)/u, 'name'],
  [/我的名字(?:是|叫)([\p{Script=Han}A-Za-z0-9_·]{1,6}?)(?=[，。,.!！?？~～\s]|$|吧|呀|啦|哦)/u, 'name'],
  [/叫我([\p{Script=Han}A-Za-z0-9_·]{1,6}?)(?=就行|就好|就可以|吧|好了|[，。,.!！?？~～\s]|$)/u, 'nickname'],
];
const NOT_NAME = /^(?:补给员|老板|主人|玩家|宝宝|什么|干嘛|啥)$|[你我他她它了的吗呢么着过来去起醒别不在]/;
const DISCLOSURE = /我(?:叫|是|的|喜欢|讨厌|最|养|住|有|想|要|会|怕|爱|觉得|从来|以前|小时候)|答应|约定|说好|下次|以后|记住|别忘|生日|名字/g;
/** 没有整理模型（或它失败两次）时的保守兜底：只认“我叫 X / 叫我 X”这种句式记名字，
 *  其余只把玩家最有信息量的一句原话逐字记进这次见面——逐字原话不会是假记忆。 */
export function fallbackExtraction(store: MemoryStore, job: PendingJob): ApplyReport {
  const report = emptyReport(), player = job.lines.filter(l => l.role === 'player').map(l => l.text);
  for (const line of player) for (const [rule, slot] of NAME_RULES) {
    const m = rule.exec(line), value = m?.[1];
    if (!value || NOT_NAME.test(value)) continue;
    addFact(store, job, report, {kind: 'identity', slot, value, text: slot === 'name' ? `玩家的名字是「${value}」` : `玩家希望被叫作「${value}」`, source: 'player',
      evidence: [{ep: job.episode, quote: safeText(line, MEMORY_LIMITS.quote)}], importance: 8, confidence: .7, pinned: true});
  }
  const ep = store.episodes.find(e => e.id === job.episode);
  if (ep && !ep.quote) {
    const scored = player.map(l => ({l, s: (l.match(DISCLOSURE) ?? []).length + Math.min(1, Array.from(l).length / 40)})).filter(x => x.s >= 1 && Array.from(x.l).length >= 5).sort((a, b) => b.s - a.s);
    if (scored[0]) ep.quote = safeText(scored[0].l, MEMORY_LIMITS.quote);
  }
  store.pending = store.pending.filter(p => p.key !== job.key);
  compactStore(store, job.at);
  return report;
}

/** 彻底忘掉一条：正文、原话、相关感想的引用一起删，只留编号作墓碑。 */
export function forgetFact(store: MemoryStore, id: string): boolean {
  const fact = store.facts.find(f => f.id === id); if (!fact) return false;
  const quotes = new Set(fact.evidence.map(e => compact(e.quote ?? '')).filter(q => q.length >= 2));
  if (fact.value && compact(fact.value).length >= 2) quotes.add(compact(fact.value));
  store.facts = store.facts.filter(f => f.id !== id);
  for (const f of store.facts) if (f.supersededBy === id) delete f.supersededBy;
  for (const e of store.episodes) if (e.quote && [...quotes].some(q => compact(e.quote).includes(q))) delete e.quote;
  for (const r of store.reflections) r.evidence = r.evidence.filter(x => x !== id);
  store.reflections = store.reflections.filter(r => r.evidence.length);
  store.forgotten = [...store.forgotten, id].slice(-MEMORY_LIMITS.forgotten);
  return true;
}

/** 有界存储：超出上限时淘汰保留分最低的未置顶记忆；旧往事按远征分组压成确定性的“旧账”摘要（不经 LLM，不会编）。 */
export function compactStore(store: MemoryStore, now: number): void {
  const L = MEMORY_LIMITS;
  const active = activeFacts(store);
  if (active.length > L.facts) {
    const drop = new Set(active.filter(f => !isPinned(f)).sort((a, b) => retention(a, store, now) - retention(b, store, now)).slice(0, active.length - L.facts).map(f => f.id));
    store.facts = store.facts.filter(f => !drop.has(f.id));
  }
  const history = store.facts.filter(f => f.status !== 'active');
  if (history.length > L.history) {
    const drop = new Set(history.sort((a, b) => (a.validTo?.at ?? a.at) - (b.validTo?.at ?? b.at)).slice(0, history.length - L.history).map(f => f.id));
    store.facts = store.facts.filter(f => !drop.has(f.id));
  }
  if (store.episodes.length > L.episodes) {
    const recent = new Set([...store.episodes].sort((a, b) => b.n - a.n || b.at - a.at).slice(0, L.recentEpisodes).map(e => e.id));
    const old = store.episodes.filter(e => !recent.has(e.id) && !isPinned(e) && e.importance < 7).sort((a, b) => a.n - b.n || a.at - b.at);
    const batch = old.slice(0, Math.max(store.episodes.length - L.episodes + 10, 0));
    const groups = new Map<number, Episode[]>();
    for (const e of batch) {const k = e.runNo ?? 0; groups.set(k, [...(groups.get(k) ?? []), e]);}
    for (const group of groups.values()) store.digests.push(digestOf(store, group));
    const gone = new Set(batch.map(e => e.id));
    store.episodes = store.episodes.filter(e => !gone.has(e.id));
    for (const r of store.reflections) if (r.evidence.every(x => gone.has(x) || !x.startsWith('e') && !store.facts.some(f => f.id === x && f.status === 'active'))) r.status = 'stale';
  }
  while (store.digests.length > L.digests) {
    const [a, b] = store.digests.splice(0, 2);
    if (a && b) store.digests.unshift({id: a.id, fromN: a.fromN, toN: b.toN, fromAt: a.fromAt, toAt: b.toAt, count: a.count + b.count, text: safeText(`${a.text} ${b.text}`, L.digestText)});
  }
  store.reflections = store.reflections.filter(r => r.status === 'active');
  if (store.reflections.length > L.reflections) store.reflections = store.reflections.sort((a, b) => b.importance - a.importance || b.n - a.n).slice(0, L.reflections).sort((a, b) => a.n - b.n);
  if (store.runs.length > L.runs) store.runs = store.runs.slice(-L.runs);
  if (store.consumed.length > L.consumed) store.consumed = store.consumed.slice(-L.consumed);
}
function digestOf(store: MemoryStore, group: Episode[]): Digest {
  const enc = group.filter(e => e.kind === 'encounter'), runs = group.filter(e => e.kind === 'run');
  const all = (k: 'deals' | 'buys' | 'gifts') => enc.flatMap(e => e.meta?.[k] ?? []);
  const sum = (d: DealNote[]) => d.reduce((a, b) => a + b.price, 0);
  const fromAt = Math.min(...group.map(e => e.at)), toAt = Math.max(...group.map(e => e.at));
  const parts = [enc.length ? `见过 ${enc.length} 次面` : '', enc.filter(e => e.meta?.talks).length ? `聊过 ${enc.filter(e => e.meta?.talks).length} 次` : '',
    all('deals').length ? `谈成 ${all('deals').length} 笔（共 ${sum(all('deals'))} FP）` : '', all('buys').length ? `在商店买过 ${all('buys').length} 样` : '',
    all('gifts').length ? `她白送过 ${all('gifts').length} 次` : '', runs.filter(r => r.meta?.outcome === 'failed').length ? `全灭过 ${runs.filter(r => r.meta?.outcome === 'failed').length} 次` : '',
    runs.filter(r => r.meta?.outcome === 'success').length ? `平安撤离过 ${runs.filter(r => r.meta?.outcome === 'success').length} 次` : ''].filter(Boolean);
  const runNo = group[0]?.runNo;
  return {id: nextId(store, 'd'), fromN: Math.min(...group.map(e => e.n)), toN: Math.max(...group.map(e => e.n)), fromAt, toAt, count: group.length,
    text: safeText(`${runNo ? `第 ${runNo} 趟前后` : '更早'}（${monthDay(fromAt)}—${monthDay(toAt)}）：${parts.join('，') || '一些零碎的见面'}。`, MEMORY_LIMITS.digestText)};
}

/** 杀害（或玩家手动清空）：换一任新的补给员。只带走“哪些杀害已经处理过”的编号，其余全部清空。 */
export function wipeStore(store: MemoryStore, now: number, reason: 'kill' | 'manual', killId?: string): MemoryStore {
  const next = emptyStore(store.chat, store.epoch + 1, now, {kills: killId ? [...store.kills, killId] : store.kills});
  next.wipedBy = reason;
  return next;
}
