/** 补给员记忆：文本工具（规范化、中文分词、BM25、余弦、哈希、token 估算、注入防护、相对时间）。
 *  全部自研、无依赖：要在酒馆 iframe 里跑，也要在 node 测试里跑。 */

const CJK_CHAR = /[\u3400-\u9fff\uf900-\ufaff]/;
const RUN = /[\u3400-\u9fff\uf900-\ufaff]+|[a-z0-9]+(?:['-][a-z0-9]+)*/g;
/** 单字停用词：只影响单字 token；双字 token 照常保留，IDF 会把高频词压下去。 */
const STOP_CHARS = new Set(Array.from('的了吗呢吧啊呀哦嗯哈嘛啦是在有和与及或也都就还很太又再才把被给让对向从到于之而并且但却这那哪个些么什怎样你我他她它们咱您自己一不没无要会能可以想说看来去上下里中多好吧呐哇喂嘿诶'));
const STOP_BIGRAMS = new Set(['什么','怎么','这个','那个','一个','我们','你们','他们','她们','就是','还是','可以','没有','不是','是不','知道','觉得','时候','一下','一点','真的','这样','那样','还有','然后','所以','因为','但是','如果','我的','你的','她的','他的','是什','么呢','么吗','了吗','的吗','你还','我还','吗我']);

export function normalize(text: unknown): string {
  return String(text ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}
/** 只留文字与数字，用来做“原话核对”。 */
export function compact(text: unknown): string {
  return normalize(text).replace(/[^\p{L}\p{N}]+/gu, '');
}
/** 中文按单字（去停用字）+ 相邻双字切分；拉丁字母与数字按词。 */
export function tokenize(text: unknown): string[] {
  const out: string[] = [];
  for (const m of normalize(text).matchAll(RUN)) {
    const run = m[0];
    if (!CJK_CHAR.test(run[0]!)) {out.push(run); continue;}
    const chars = Array.from(run);
    for (const c of chars) if (!STOP_CHARS.has(c)) out.push(c);
    for (let i = 0; i + 1 < chars.length; i++) {const bg = chars[i]! + chars[i + 1]!; if (!STOP_BIGRAMS.has(bg)) out.push(bg);}
  }
  return out;
}
export function bigrams(text: unknown): Set<string> {
  const chars = Array.from(compact(text)), out = new Set<string>();
  if (chars.length === 1) out.add(chars[0]!);
  for (let i = 0; i + 1 < chars.length; i++) out.add(chars[i]! + chars[i + 1]!);
  return out;
}
export function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let both = 0; for (const x of a) if (b.has(x)) both++;
  return both / (a.size + b.size - both);
}
/** a 的双字有多少落在 b 里（用来容忍模型给原话加了个标点、少了个字）。 */
export function containment(a: unknown, b: unknown): number {
  const x = bigrams(a), y = bigrams(b); if (!x.size) return 0;
  let hit = 0; for (const g of x) if (y.has(g)) hit++;
  return hit / x.size;
}

/** Okapi BM25（Lucene 的非负 IDF）；k1=1.2、b=0.75。 */
export class Bm25 {
  private readonly tf: Map<string, number>[];
  private readonly len: number[];
  private readonly df = new Map<string, number>();
  private readonly avg: number;
  constructor(docs: string[][], private readonly k1 = 1.2, private readonly b = .75) {
    this.tf = docs.map(d => {const m = new Map<string, number>(); for (const t of d) m.set(t, (m.get(t) ?? 0) + 1); return m;});
    this.len = docs.map(d => d.length);
    for (const m of this.tf) for (const t of m.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1);
    this.avg = this.len.reduce((a, b) => a + b, 0) / Math.max(1, docs.length) || 1;
  }
  get size(): number {return this.tf.length;}
  idf(term: string): number {const n = this.df.get(term) ?? 0; return Math.log(1 + (this.tf.length - n + .5) / (n + .5));}
  score(query: string[], i: number): number {
    const tf = this.tf[i], len = this.len[i] ?? 0; if (!tf) return 0;
    let s = 0;
    for (const t of new Set(query)) {
      const f = tf.get(t) ?? 0; if (!f) continue;
      s += this.idf(t) * f * (this.k1 + 1) / (f + this.k1 * (1 - this.b + this.b * len / this.avg));
    }
    return s;
  }
  /** 查询里的信息量（按 IDF 加权）有多少被文档覆盖：0～1，用来判断“到底相不相关”。 */
  coverage(query: string[], i: number): number {
    const tf = this.tf[i]; if (!tf) return 0;
    let all = 0, hit = 0;
    for (const t of new Set(query)) {const w = this.idf(t); all += w; if (tf.has(t)) hit += w;}
    return all > 0 ? hit / all : 0;
  }
}

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  const n = Math.min(a.length, b.length); if (!n || a.length !== b.length) return 0;
  let dot = 0, x = 0, y = 0;
  for (let i = 0; i < n; i++) {const p = a[i]!, q = b[i]!; dot += p * q; x += p * p; y += q * q;}
  return x > 0 && y > 0 ? dot / Math.sqrt(x * y) : 0;
}
/** Reciprocal Rank Fusion（Cormack 等，k=60）。 */
export function rrf(ranks: (number | undefined)[], k = 60): number {
  let s = 0; for (const r of ranks) if (r !== undefined) s += 1 / (k + r + 1); return s;
}

/** FNV-1a 32 位；只做缓存键，不做安全用途。 */
export function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193);}
  return (h >>> 0).toString(36);
}
/** 保守估算：中日韩字符按 1 token，其余按 3.5 字符 1 token。 */
export function estimateTokens(text: string): number {
  let cjk = 0, other = 0;
  for (const c of text) {if (CJK_CHAR.test(c) || /[\u3000-\u303f\uff00-\uffef]/.test(c)) cjk++; else other++;}
  return Math.ceil(cjk + other / 3.5);
}

/** 记忆里的文字都来自玩家输入或模型输出，是“资料”而不是指令：
 *  去掉控制字符和 <>{}`（与 supplier-agent 的 clean 同一风格），
 *  把【】换成「」免得伪造提示词小节，压成单行免得伪造新段落，去掉行首的角色前缀，最后截断。 */
export function safeText(value: unknown, max: number): string {
  const text = String(value ?? '')
    .replace(/[\u0000-\u001f\u007f\u2028\u2029<>`{}]/g, ' ')
    .replace(/[【〖\[]/g, '「').replace(/[】〗\]]/g, '」')
    .replace(/^\s*(?:system|assistant|user|developer|系统|助手)\s*[:：]\s*/i, '')
    .replace(/\s+/g, ' ').trim();
  return Array.from(text).slice(0, max).join('');
}
/** 放进『』里的玩家原话：内部的『』改成「」，不让它提前闭合。 */
export function quoteText(value: unknown, max: number): string {
  return safeText(value, max).replace(/[『]/g, '「').replace(/[』]/g, '」');
}

const DAY = 86400000;
export function relativeDay(at: number, now: number): string {
  const days = Math.floor(startOfDay(now) / DAY) - Math.floor(startOfDay(at) / DAY);
  if (days <= 0) return '今天';
  if (days === 1) return '昨天';
  if (days === 2) return '前天';
  if (days < 7) return days + ' 天前';
  if (days < 30) return Math.floor(days / 7) + ' 周前';
  if (days < 365) return Math.floor(days / 30) + ' 个月前';
  return '很久以前';
}
function startOfDay(at: number): number {const d = new Date(at); d.setHours(0, 0, 0, 0); return d.getTime();}
export function monthDay(at: number): string {const d = new Date(at); return `${d.getMonth() + 1}月${d.getDate()}日`;}
