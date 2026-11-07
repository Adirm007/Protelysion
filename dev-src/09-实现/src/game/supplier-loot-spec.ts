/** 0.45 补给员的可带出战利品：按世界书里的物品生成细则写属性（与读者「命运抽卡」同一套做法）。
 *  补给员谈成一件技能书以外的战利品（装备、武器、消耗品、资产……）后，先读世界书里的细则条目，再让模型照细则写出
 *  类型、标签与效果，结算时带着这些属性放进主角背包，出了迷宫就能直接用。细则不内置在程序里：玩家改了世界书的条目，
 *  补给员给的东西也跟着变。技能书不走这一步，仍由正文在研读时按规则生成。 */

type Obj = Record<string, unknown>;
const rec = (v: unknown): Obj => v && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {};
const clean = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/** 写好的物品属性：类型、标签（如 "攻击: 320"）与“效果名: 效果”。 */
export type LootSpec = {type?: string; tags: string[]; effects: Record<string, string>};
/** 要写属性的那件战利品（补给员已经定好名字、品质与类型）。 */
export type LootDraft = {name: string; quality: string; itemType: string; effect: string; description: string; theme: string; depth: number};
export type SpecEntry = {name: string; content: string};

/** 默认去读的条目，与命运抽卡相同（命定之诗世界书「额外设定」里的这几条）。 */
export const DEFAULT_SPEC_ENTRIES: readonly string[] = ['技能装备道具生成规则', '品质效果限定', '核心数值表', '状态规则'];
/** 读者「命运抽卡」的设置（同源存储）：玩家在那里改过的细则条目名，补给员也照用。 */
export const GACHA_SETTINGS_KEY = 'dream_gacha_settings_v1';
export const SPEC_TEXT_LIMIT = 24000;

/** 技能书只写大概，研读时由正文生成；其余可带出战利品都按细则写属性。 */
export const needsLootSpec = (itemType: string) => !/技能书|技能页|秘籍/.test(itemType);

/** 从命运抽卡的设置里取细则条目名；没设置过就用默认条目，关掉了就返回 undefined。 */
export function specEntryNames(raw: unknown): string[] | undefined {
  const spec = rec(rec(raw).itemSpec);
  if (!Object.keys(spec).length) return [...DEFAULT_SPEC_ENTRIES];
  if (spec.enabled === false) return undefined;
  const names = (Array.isArray(spec.entries) ? spec.entries : []).map(v => clean(v, 40)).filter(Boolean);
  return names.length ? [...new Set(names)].slice(0, 12) : undefined;
}

/** 世界书条目原文里的模板语法（EJS 之类）不交给模型。 */
export function cleanSpecText(content: unknown): string {
  return String(content ?? '').replace(/<%[\s\S]*?%>/g, '').replace(/\{\{[^{}]*\}\}/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
export function specText(entries: readonly SpecEntry[], limit = SPEC_TEXT_LIMIT): string {
  const out: string[] = [];
  let used = 0;
  for (const e of entries) {
    const block = `【${e.name}】\n${e.content}`;
    if (used + block.length > limit) {if (!out.length) out.push(block.slice(0, limit)); break;}
    out.push(block); used += block.length;
  }
  return out.join('\n\n');
}

export function lootSpecPrompt(entries: readonly SpecEntry[], loot: LootDraft): {system: string; user: string} {
  const row = {name: loot.name, quality: loot.quality, type: loot.itemType, use: loot.effect, description: loot.description};
  return {
    system: '你是《书海》补给员交易的物品规格编纂人。补给员给出的这件东西会在玩家离开迷宫后直接放进主角的背包，拿到就能用，所以它要有能直接结算的属性。下面给出世界书里的生成细则：严格照它的格式、品质区间与数值范围写；细则里与物品无关的部分（技能、角色、战斗流程等）忽略。只输出一个 JSON 对象，不要解释、不要 Markdown 代码块。',
    user: [
      '【世界书细则】',
      specText(entries),
      '',
      `【来处】书海迷宫第 ${loot.depth} 层（${loot.theme}），补给员交给玩家的东西`,
      '【要写属性的物品】品质已经定好，不得更改；词条数与数值必须落在这个品质的区间内。',
      JSON.stringify(row),
      '',
      '要求：',
      '- 按细则判断它是装备、道具还是资产，用对应的格式；type 照细则的写法写具体类型（如单手剑、长柄武器、重甲、戒指、消耗品、住宅、载具），不要写成技能。',
      '- tags 是标签数组（如 "攻击: 320"、"防御: 180"、"速度: 300km/天"）；effects 是“效果名: 效果”对象，一条一个效果。资产把总空间、结算、位置也写进 effects。',
      '- 效果要贴合这件东西的名字、用途与来历，不要写成无关的泛用属性。',
      '- name 照抄，不要改名。',
      'JSON 格式：{"name":"","type":"","tags":[""],"effects":{"效果名":"效果"}}',
    ].join('\n'),
  };
}

export function normalizeLootSpec(raw: unknown): LootSpec | undefined {
  const r = rec(raw), type = clean(r.type ?? r.类型, 12);
  const list = r.tags ?? r.标签;
  const tags = (Array.isArray(list) ? list as unknown[] : []).map(t => clean(t, 60)).filter(Boolean).slice(0, 12);
  const effects: Record<string, string> = {};
  for (const [k, v] of Object.entries(rec(r.effects ?? r.效果)).slice(0, 16)) {
    const key = clean(k, 24), value = clean(typeof v === 'string' || typeof v === 'number' ? v : JSON.stringify(v), 400);
    if (key && value) effects[key] = value;
  }
  return Object.keys(effects).length ? {...(type ? {type} : {}), tags, effects} : undefined;
}

/** 读模型回复：容忍代码块与前后闲话；回复成数组或 {items:[…]} 时按名字取这一件。 */
export function parseLootSpec(raw: unknown, name: string): LootSpec | undefined {
  let v: unknown = raw;
  if (typeof v === 'string') {
    const text = v.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim(), a = text.indexOf('{'), b = text.lastIndexOf('}');
    if (a < 0 || b <= a) return undefined;
    try {v = JSON.parse(text.slice(a, b + 1));} catch {return undefined;}
  }
  const o = rec(v), list = Array.isArray(v) ? v : Array.isArray(o.items) ? o.items : undefined;
  if (list) {const rows = list.map(rec); v = rows.find(r => clean(r.name, 40) === name) ?? (rows.length === 1 ? rows[0] : undefined);}
  return normalizeLootSpec(v);
}

/** 写进背包时的属性一行（界面上的战利品说明用）。 */
export const lootSpecText = (spec: LootSpec) => [...spec.tags, ...Object.entries(spec.effects).map(([k, v]) => `${k}：${v}`)].join('；');

/* ---------- 读世界书（酒馆助手，新旧两套接口都认） ---------- */
type WbEntry = {name?: unknown; comment?: unknown; content?: unknown; enabled?: unknown; disable?: unknown};
export type WorldbookHelper = {
  getCharWorldbookNames?: (c: 'current') => {primary?: string | null; additional?: string[]} | null | undefined;
  getChatWorldbookName?: (c: 'current') => string | null | undefined;
  getGlobalWorldbookNames?: () => string[] | null | undefined;
  getWorldbook?: (name: string) => Promise<WbEntry[]> | WbEntry[];
  getCharLorebooks?: (o?: {type?: string}) => {primary?: string | null; additional?: string[]} | null | undefined;
  getChatLorebook?: () => string | null | undefined;
  getLorebookSettings?: () => {selected_global_lorebooks?: string[]} | null | undefined;
  getLorebookEntries?: (name: string) => Promise<WbEntry[]> | WbEntry[];
};
const tryCall = <T>(fn: () => T): T | undefined => {try {return fn();} catch {return undefined;}};
/** 当前角色卡（主、附加）→ 聊天 → 全局 的世界书名。 */
export function worldbookNames(h: WorldbookHelper): string[] {
  const char = tryCall(() => h.getCharWorldbookNames?.('current')) ?? tryCall(() => h.getCharLorebooks?.({type: 'all'}));
  const chat = tryCall(() => h.getChatWorldbookName?.('current')) ?? tryCall(() => h.getChatLorebook?.());
  const global = tryCall(() => h.getGlobalWorldbookNames?.()) ?? tryCall(() => h.getLorebookSettings?.()?.selected_global_lorebooks);
  const all = [char?.primary, ...(char?.additional ?? []), chat, ...(global ?? [])].filter((n): n is string => typeof n === 'string' && !!n.trim());
  return [...new Set(all)];
}
/** 按条目名读细则：每个名字取第一条名称包含它的条目（启用的优先，角色卡的世界书优先）。读不到就返回空数组。 */
export async function readSpecEntries(h: WorldbookHelper | undefined, wanted: readonly string[]): Promise<SpecEntry[]> {
  if (!h || !wanted.length) return [];
  const books: WbEntry[][] = [];
  for (const book of worldbookNames(h)) {
    let entries: unknown;
    try {entries = h.getWorldbook ? await h.getWorldbook(book) : h.getLorebookEntries ? await h.getLorebookEntries(book) : undefined;} catch {entries = undefined;}
    if (Array.isArray(entries)) books.push(entries as WbEntry[]);
  }
  const out: SpecEntry[] = [], used = new Set<WbEntry>();
  const nameOf = (e: WbEntry) => String(e.name ?? e.comment ?? '');
  const on = (e: WbEntry) => e.enabled !== false && e.disable !== true;
  for (const want of wanted) {
    const hits = books.flatMap(b => b.filter(e => !used.has(e) && nameOf(e).includes(want)));
    const pick = hits.find(on) ?? hits[0];
    if (!pick) continue;
    const content = cleanSpecText(pick.content);
    if (!content) continue;
    used.add(pick); out.push({name: nameOf(pick).slice(0, 80), content});
  }
  return out;
}
