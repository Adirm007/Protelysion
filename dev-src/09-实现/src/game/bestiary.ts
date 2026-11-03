/** 0.44 敌役图鉴：遭遇即解锁。
 *  规则在开战 / 战后把「见到了谁、几级、在第几层、打倒了几只」记进账本（State.bestiaryLedger），
 *  运行时取走后并入图鉴存档（宿主：当前聊天的聊天变量 booksea.bestiary；试玩页：本机 localStorage）。
 *  解锁单位是「物种 × 生命层级」：第一次在某一阶遇到它，就能查看这一阶的设定、战斗数值与全部技能。
 *  图鉴只读取名录与模板（与战斗用的是同一份 monsterKit），不改变任何战斗、掉落或结算。 */
import {MONSTER_ROSTER,MONSTER_THEMES,MONSTER_BY_ID,MONSTER_THEME_BY_ID,type Build,type MonsterDesign,type ThemeDesign} from './monsters/catalog';
import {monsterKit,type MonsterKit} from './monsters/kits';
import {MIMIC_ID,MIMIC_DESIGN,MIMIC_THEME,mimicKit} from './monsters/mimic';
import {STRAY_ID,STRAY_DESIGN,STRAY_THEME,STRAY_THREAD,strayKit} from './monsters/stray';
import {coreName} from './monsters/cores';
import {MONSTER_MATERIALS,VALUE_CRYSTAL,levelQuality,lifeTierOf,type MaterialVoice} from './monsters/materials';
import {TIER_START} from './monsters/numbers';
import {describeAction,costText,qualityName} from '../ui/ability-text';
import type {ActionSpec} from '../compiler/contract';

export const BESTIARY_KEY = 'bestiary';
export const BESTIARY_VERSION = 1;
/** 账本只是“还没交给图鉴的事实”，正常每一步都会被取走；上限只防异常累积。 */
export const BESTIARY_LEDGER_LIMIT = 160;
/** 已并入图鉴的账本编号，留最近这些用来防止重复计数（重试 / 读档）。 */
export const BESTIARY_APPLIED_LIMIT = 240;
export const TIER_LABELS = ['一阶', '二阶', '三阶', '四阶', '五阶', '六阶', '七阶'] as const;

export type BestiaryEvent = 'seen' | 'defeat';
/** 一条事实：e 事件、m 物种、lv 实际等级、d 层数、n 数量（击败只数）。 */
export type BestiaryLedgerEntry = {id: string; e: BestiaryEvent; m: string; lv: number; d: number; at: number; n?: number};
/** 每一阶：见过的最低 / 最高等级、遭遇场数、击败只数。 */
export type TierRecord = {lo: number; hi: number; n: number; k: number};
/** 每个物种：首次 / 最近、遭遇场数、击败只数、出现层数范围、各阶记录。 */
export type BestiaryRecord = {f: number; l: number; n: number; k: number; d0: number; d1: number; t: Partial<Record<string, TierRecord>>};
export type BestiaryStore = {version: 1; entries: Record<string, BestiaryRecord>; applied: string[]; updated: number};

const rec = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const int = (v: unknown, min = 0) => {const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(min, n) : min;};

/** 图鉴里的全部物种：48 主题 × 9 种，加上宝箱怪与「?」。 */
export type DexSpecies = {id: string; designId: string; name: string; theme: string; role: MonsterDesign['role']; order: number; special?: 'mimic' | 'stray'};
export const DEX_SPECIES: readonly DexSpecies[] = [
  ...MONSTER_ROSTER.map((m, order) => ({id: m.id, designId: m.designId, name: m.name, theme: m.theme, role: m.role, order})),
  {id: MIMIC_ID, designId: MIMIC_DESIGN.designId, name: MIMIC_DESIGN.name, theme: 'special', role: MIMIC_DESIGN.role, order: MONSTER_ROSTER.length, special: 'mimic'},
  {id: STRAY_ID, designId: STRAY_DESIGN.designId, name: '「?」', theme: 'special', role: STRAY_DESIGN.role, order: MONSTER_ROSTER.length + 1, special: 'stray'},
];
export const DEX_BY_ID: Readonly<Record<string, DexSpecies>> = Object.fromEntries(DEX_SPECIES.map(s => [s.id, s]));
const DEX_BY_DESIGN: Readonly<Record<string, string>> = Object.fromEntries(DEX_SPECIES.map(s => [s.designId, s.id]));
/** 战斗立绘用的是 designId（个别与物种 id 不同）；图鉴入口按它找回物种。 */
export const dexIdForArt = (artId: string): string | undefined => DEX_BY_ID[artId] ? artId : DEX_BY_DESIGN[artId];
export type DexGroup = {id: string; name: string; subtitle: string; element: string; species: DexSpecies[]};
export const DEX_GROUPS: readonly DexGroup[] = [
  ...MONSTER_THEMES.map(t => ({id: t.id, name: t.name, subtitle: t.subtitle, element: t.element, species: DEX_SPECIES.filter(s => s.theme === t.id)})),
  {id: 'special', name: '异客', subtitle: '不属于任何一页的来访者', element: '', species: DEX_SPECIES.filter(s => s.theme === 'special')},
];

export function emptyBestiary(): BestiaryStore {return {version: 1, entries: {}, applied: [], updated: 0};}
function tierRecord(v: unknown): TierRecord | undefined {
  const r = rec(v), lo = int(r.lo, 1), hi = Math.max(lo, int(r.hi, 1));
  return r.lo === undefined && r.hi === undefined ? undefined : {lo, hi, n: int(r.n), k: int(r.k)};
}
/** 读进来的存档一律重新整理：未知物种、坏字段、越界数字都不会进入界面。 */
export function normalizeBestiary(raw: unknown): BestiaryStore {
  const v = rec(raw), out = emptyBestiary();
  if (v.version !== undefined && v.version !== BESTIARY_VERSION) return {...out, updated: int(v.updated)};
  for (const [id, value] of Object.entries(rec(v.entries))) {
    if (!DEX_BY_ID[id]) continue;
    const r = rec(value), t: BestiaryRecord['t'] = {};
    for (const [tier, tr] of Object.entries(rec(r.t))) {const n = int(tier); const x = n >= 1 && n <= 7 ? tierRecord(tr) : undefined; if (x) t[String(n)] = x;}
    const d0 = int(r.d0, 1), d1 = Math.max(d0, int(r.d1, 1));
    out.entries[id] = {f: int(r.f), l: Math.max(int(r.f), int(r.l)), n: int(r.n), k: int(r.k), d0, d1, t};
  }
  out.applied = (Array.isArray(v.applied) ? v.applied : []).filter((x): x is string => typeof x === 'string' && x.length <= 40).slice(-BESTIARY_APPLIED_LIMIT);
  out.updated = int(v.updated);
  return out;
}

type LedgerHost = {bestiaryLedger?: BestiaryLedgerEntry[]; depth: number};
/** 规则侧记一笔：只记事实，不读写任何存档。 */
export function recordBestiary(s: LedgerHost, e: BestiaryEvent, monster: string, level: number, count = 1, at = Date.now()) {
  if (!DEX_BY_ID[monster] || !(level >= 1) || !(count >= 1)) return;
  const list = s.bestiaryLedger ??= [];
  list.push({id: at.toString(36) + '-' + Math.random().toString(36).slice(2, 8), e, m: monster, lv: Math.floor(level), d: Math.max(1, Math.floor(s.depth || 1)), at, ...(count > 1 ? {n: Math.floor(count)} : {})});
  if (list.length > BESTIARY_LEDGER_LIMIT) list.splice(0, list.length - BESTIARY_LEDGER_LIMIT);
}
/** 取走全部未处理的事实（运行时专用）。 */
export function drainBestiaryLedger(s: {bestiaryLedger?: BestiaryLedgerEntry[]}): BestiaryLedgerEntry[] {
  const out = s.bestiaryLedger ?? []; if (out.length) s.bestiaryLedger = []; return out;
}
/** 把事实并入图鉴；已并入过的编号跳过，所以重试、读档都不会重复计数。返回新对象。 */
export function applyBestiary(store: BestiaryStore, entries: readonly BestiaryLedgerEntry[]): BestiaryStore {
  const next: BestiaryStore = structuredClone(store), applied = new Set(next.applied);
  for (const x of entries) {
    if (!x || typeof x.id !== 'string' || applied.has(x.id) || !DEX_BY_ID[x.m] || (x.e !== 'seen' && x.e !== 'defeat')) continue;
    const lv = int(x.lv, 1), depth = int(x.d, 1), at = int(x.at), count = x.e === 'defeat' ? int(x.n ?? 1, 1) : 1, tier = String(lifeTierOf(lv));
    const r = next.entries[x.m] ??= {f: at, l: at, n: 0, k: 0, d0: depth, d1: depth, t: {}};
    r.f = Math.min(r.f || at, at); r.l = Math.max(r.l, at); r.d0 = Math.min(r.d0, depth); r.d1 = Math.max(r.d1, depth);
    const t = r.t[tier] ??= {lo: lv, hi: lv, n: 0, k: 0};
    t.lo = Math.min(t.lo, lv); t.hi = Math.max(t.hi, lv);
    if (x.e === 'seen') {r.n++; t.n++;} else {r.k += count; t.k += count;}
    applied.add(x.id); next.applied.push(x.id); next.updated = Math.max(next.updated, at);
  }
  if (next.applied.length > BESTIARY_APPLIED_LIMIT) next.applied = next.applied.slice(-BESTIARY_APPLIED_LIMIT);
  return next;
}
/** 0.44 之前的旅程只在 unlockedIds 里留下 enemy:物种（击败过、没有等级）。只读合并：解锁设定，不解锁任何一阶。 */
export function legacyBestiaryIds(unlockedIds: unknown): Set<string> {
  const out = new Set<string>();
  for (const id of Array.isArray(unlockedIds) ? unlockedIds : []) {const m = /^enemy:(.+)$/.exec(String(id)); if (m && DEX_BY_ID[m[1]!]) out.add(m[1]!);}
  return out;
}

export type DexState = {known: boolean; legacy: boolean; record?: BestiaryRecord; tiers: number[]};
export function dexState(store: BestiaryStore, legacy: ReadonlySet<string>, id: string): DexState {
  const record = store.entries[id], tiers = record ? Object.keys(record.t).map(Number).filter(n => n >= 1 && n <= 7).sort((a, b) => a - b) : [];
  return {known: !!record || legacy.has(id), legacy: !record && legacy.has(id), ...(record ? {record} : {}), tiers};
}
export type DexSummary = {total: number; known: number; defeated: number; tiers: number; tierTotal: number; groups: Record<string, {known: number; total: number}>};
export function dexSummary(store: BestiaryStore, legacy: ReadonlySet<string>): DexSummary {
  const groups: DexSummary['groups'] = {};
  let known = 0, defeated = 0, tiers = 0;
  for (const g of DEX_GROUPS) {
    let k = 0;
    for (const s of g.species) {const st = dexState(store, legacy, s.id); if (st.known) {k++; known++;} if ((st.record?.k ?? 0) > 0 || st.legacy) defeated++; tiers += st.tiers.length;}
    groups[g.id] = {known: k, total: g.species.length};
  }
  return {total: DEX_SPECIES.length, known, defeated, tiers, tierTotal: DEX_SPECIES.length * 7, groups};
}

/* ---------- 详情：完全由名录与模板生成，与实战同一份数据 ---------- */
export const BUILD_LABEL: Record<Build, string> = {brute: '蛮力', hunter: '猎手', caster: '术者', guard: '守卫', swarm: '群集', spirit: '灵体'};
export const VOICE_LABEL: Record<MaterialVoice, string> = {读者: '读者', 阳角少女: '阳角少女', 心爱的少女: '心爱的少女', 怪人: '怪人', 黑幕: '黑幕'};
export const DEX_ELEMENTS = ['物', '火', '水', '暗', '光', '精'] as const;
export type DexSkillKind = '普攻' | '主动' | '被动' | '登神' | '法则' | '领域' | '阶段' | '专属';
export type DexSkill = {key: string; name: string; kind: DexSkillKind; quality: string; cost: string; cast: string; uses: string; summary: string; effects: string[]};
export type DexTier = {tier: number; label: string; range: string; unlocked: boolean; lo?: number; hi?: number; seen?: number; defeated?: number};
export type DexLore = {
  motif: string; build: string; cores: string[]; element: string; scenes: string[]; realm: string; laws: string[];
  theme: {id: string; name: string; subtitle: string};
  note?: {voice: string; text: string}; drop?: {name: string; quality: string; text: string}; rules?: string[];
};
export type DexStats = {level: number; templateLevel: number; quality: string; attributes: Record<string, number>; max: {hp: number; mp: number; sp: number}; resistance: {element: string; value: number; label: string}[]; phase: string};
export type DexDetail = {
  id: string; designId: string; name: string; role: MonsterDesign['role']; special?: 'mimic' | 'stray';
  known: boolean; legacy: boolean; record?: BestiaryRecord; lore?: DexLore;
  tiers: DexTier[]; tier?: number; stats?: DexStats; skills: DexSkill[];
};
export const tierRange = (tier: number) => tier >= 7 ? 'Lv 25+' : `Lv ${TIER_START[tier - 1]}–${TIER_START[tier]! - 1}`;
export const resistanceLabel = (v: number) => v <= 0 ? '无效' : v < 1 ? '抵抗' : v >= 2 ? '特攻' : v > 1 ? '弱点' : '—';

function themeOf(s: DexSpecies): ThemeDesign {return s.special === 'mimic' ? MIMIC_THEME : s.special === 'stray' ? STRAY_THEME : MONSTER_THEME_BY_ID[s.theme as `T${string}`]!;}
function designOf(s: DexSpecies): MonsterDesign {return s.special === 'mimic' ? MIMIC_DESIGN : s.special === 'stray' ? STRAY_DESIGN : MONSTER_BY_ID[s.id]!;}
function kitOf(s: DexSpecies, level: number): MonsterKit {return s.special === 'mimic' ? mimicKit(level) : s.special === 'stray' ? strayKit(level, []) as MonsterKit : monsterKit(s.id, level);}
/** 去掉面向开发者的固定句式（品质投影说明、恶意家族编码、仲裁说明），保留它“做了什么”。 */
export function playerSkillText(text: string): string {
  return String(text ?? '')
    .replace(/(微弱要素|微弱权能|微弱法则)\[[^\]]*\]：下列有限效果是品质词条投影，不是完整登神能力。/g, '')
    .replace(/宿主普攻威力20\+关联属性×10×生命层级系数；零费用，不是编译失败的代替技能。/g, '零消耗的普通攻击。')
    .replace(/登神来源：不使用普通技能品质。法则\/权能遵守显式最大资源费用与每战次数；仲裁仍为等级→有效速度→种子随机。/g, '')
    .replace(/登神来源·独有法则：/g, '独有法则：')
    .replace(/持续与次数以效果详情为准。/g, '')
    .replace(/效果与期限见结构化技能详情。/g, '')
    .replace(/【[FG]\d+·(?:seed|full|unbound)】/g, '')
    .replace(/【主题专属·(完全体|雏形)】/g, '（主题专属·$1）')
    .replace(/\s+/g, ' ').trim();
}
function skillKind(sourceId: string, a: ActionSpec, passive: boolean): DexSkillKind {
  if (a.source?.kind === 'system') return '普攻';
  if (a.tags?.includes('monster:arena')) return '领域';
  if (/:phase$/.test(sourceId)) return '阶段';
  if (/:exclusive$/.test(sourceId)) return '专属';
  if (a.source?.kind === 'law') return '法则';
  if (a.source?.kind === 'ascension') return '登神';
  return passive ? '被动' : '主动';
}
const KIND_ORDER: Record<DexSkillKind, number> = {普攻: 0, 主动: 1, 专属: 2, 被动: 3, 阶段: 4, 领域: 5, 登神: 6, 法则: 7};
function dexSkills(kit: MonsterKit): DexSkill[] {
  return kit.card.skills.map((s, i) => {
    const a = s.mapping.action;
    if (!a) return undefined;
    const kind = skillKind(s.sourceId, a, s.mapping.disposition === 'passive');
    let effects: string[] = [];
    try {effects = describeAction({...a, library: a.library}, kit.card.numeric);} catch {effects = [];}
    return {key: s.sourceId + '#' + i, name: a.name ?? s.name, kind, quality: a.source?.quality ? qualityName[a.source.quality] ?? '' : '',
      cost: s.mapping.disposition === 'passive' ? '' : costText(a),
      cast: a.castMs > 0 ? `读条 ${Math.round(a.castMs / 100) / 10} 秒` : '', uses: a.perBattleUses > 0 ? `每战 ${a.perBattleUses} 次` : '',
      summary: playerSkillText(a.description ?? ''), effects};
  }).filter((x): x is DexSkill => !!x).sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
}
function dexStats(kit: MonsterKit, special?: DexSpecies['special']): DexStats {
  const table = kit.mitigation?.elementMultipliers ?? kit.resistance ?? {};
  const resistance: DexStats['resistance'] = DEX_ELEMENTS.map(element => {const value = Number(table[element] ?? 1); return {element, value, label: resistanceLabel(value)};});
  if (special === 'stray') resistance.push({element: '无', value: 0, label: '无效'});
  const phase = kit.phase === 'red' ? '生命降至一半时进入血色形态' : kit.phase === 'afterimage' ? '生命降至一半时进入重影形态' : '';
  return {level: kit.numbers.displayLevel, templateLevel: kit.numbers.kitLevel, quality: kit.quality, attributes: {...kit.numbers.attributes}, max: {...kit.numbers.max}, resistance, phase};
}
function dexLore(s: DexSpecies, kit: MonsterKit | undefined, tier: number): DexLore {
  const t = themeOf(s), m = designOf(s), stage = Math.max(1, Math.min(7, tier || 1));
  const lore: DexLore = {
    motif: m.motif, build: BUILD_LABEL[m.build], cores: m.cores.map(c => coreName(c, stage)), element: t.element,
    scenes: [...new Set(t.scenes)], realm: t.realm, laws: [...t.lawNames], theme: {id: t.id, name: t.name, subtitle: t.subtitle},
  };
  const level = kit?.numbers.displayLevel ?? TIER_START[stage - 1]!;
  if (s.special === 'mimic') {
    lore.drop = {name: '未开启的盲盒', quality: levelQuality(level), text: `实际击败必定掉落；神话级宝箱怪另有机会掉落「${VALUE_CRYSTAL.name}」。`};
    lore.rules = ['藏在宝箱的位置，外观与真宝箱相同', '普通逃跑无效，间章等专门离场技能仍可脱身', '等级比本层其他怪物高 5 级，最低 6 级'];
  } else if (s.special === 'stray') {
    lore.drop = {name: STRAY_THREAD.name, quality: STRAY_THREAD.quality, text: STRAY_THREAD.description};
    lore.note = {voice: '', text: '尚未成字的笔画。她从你走过的路上出现，一言不发地追来。'};
    lore.rules = ['只在个位数为 9 的楼层出现，从你身后追来', '面板比队伍最高等级高 1 级', '无属性与精神属性伤害对她无效', '百分比伤害会治疗她，真实伤害会原样弹回攻击者', '敌方无法在她身上留下任何效果', '复制队伍里持有百分比 / 真实伤害技能成员的全部技能；没人持有时只会投掷飞刀', '普通逃跑无效，只有间章等专门离场技能能脱身'];
  } else {
    const material = MONSTER_MATERIALS[m.designId];
    if (material) {
      lore.note = {voice: VOICE_LABEL[material.voice] ?? material.voice, text: material.description};
      lore.drop = {name: material.name, quality: levelQuality(level, m.role === 'Boss'), text: `于${t.name}掉落的${material.name}，可用做素材。`};
    }
  }
  return lore;
}
export function dexTiers(record?: BestiaryRecord): DexTier[] {
  return TIER_LABELS.map((label, i) => {
    const tier = i + 1, r = record?.t[String(tier)];
    return {tier, label, range: tierRange(tier), unlocked: !!r, ...(r ? {lo: r.lo, hi: r.hi, seen: r.n, defeated: r.k} : {})};
  });
}
/** 一个物种的图鉴页。未解锁：只给出位置（所属主题与定位都不透露）；已知但没有等级记录（旧旅程）：只有设定。 */
export function dexDetail(id: string, store: BestiaryStore, legacy: ReadonlySet<string>, wantTier?: number): DexDetail {
  const s = DEX_BY_ID[id];
  if (!s) throw Error('图鉴里没有这个物种：' + id);
  const st = dexState(store, legacy, id), tiers = dexTiers(st.record);
  const base: DexDetail = {id, designId: s.designId, name: st.known ? s.name : '？？？', role: s.role, ...(s.special ? {special: s.special} : {}), known: st.known, legacy: st.legacy, ...(st.record ? {record: st.record} : {}), tiers, skills: []};
  if (!st.known) return base;
  const tier = st.tiers.includes(Number(wantTier)) ? Number(wantTier) : st.tiers.at(-1);
  if (!tier) return {...base, lore: dexLore(s, undefined, 1)};
  const level = st.record!.t[String(tier)]!.hi, kit = kitOf(s, level);
  return {...base, tier, lore: dexLore(s, kit, tier), stats: dexStats(kit, s.special), skills: dexSkills(kit)};
}

/* ---------- 服务：账本 → 图鉴存档（去抖写入、失败重试、跨窗口重读合并） ---------- */
export type BestiaryPort = {contextId: string; read(): unknown; write(store: BestiaryStore): Promise<void>; legacy?(): unknown};
export type BestiaryStatus = {pending: number; error?: string; lastWrite?: number; local: boolean};
export type BestiaryService = {
  readonly contextId: string;
  store(): BestiaryStore; legacy(): Set<string>; summary(): DexSummary; detail(id: string, tier?: number): DexDetail;
  observe(entries: readonly BestiaryLedgerEntry[]): void; refresh(): void; flush(): Promise<void>;
  subscribe(fn: () => void): () => void; status(): BestiaryStatus; dispose(): void;
};
type Timers = {set(fn: () => void, ms: number): unknown; clear(id: unknown): void};
export function createBestiary(port: BestiaryPort, options: {delayMs?: number; timers?: Timers; local?: boolean} = {}): BestiaryService {
  const timers: Timers = options.timers ?? {set: (fn, ms) => setTimeout(fn, ms), clear: id => clearTimeout(id as ReturnType<typeof setTimeout>)};
  const delay = options.delayMs ?? 1500, listeners = new Set<() => void>();
  const safeRead = () => {try {return normalizeBestiary(port.read());} catch {return emptyBestiary();}};
  const safeLegacy = () => {try {return legacyBestiaryIds(port.legacy?.());} catch {return new Set<string>();}};
  let store = safeRead(), legacy = safeLegacy(), pending: BestiaryLedgerEntry[] = [], timer: unknown, writing: Promise<void> | undefined, failures = 0, disposed = false;
  const status: BestiaryStatus = {pending: 0, local: !!options.local};
  const notify = () => {for (const fn of [...listeners]) {try {fn();} catch {/* 界面刷新失败不影响记录 */}}};
  const schedule = (ms = delay) => {if (disposed || timer !== undefined || !pending.length) return; timer = timers.set(() => {timer = undefined; void flush();}, ms);};
  async function flush(): Promise<void> {
    if (timer !== undefined) {timers.clear(timer); timer = undefined;}
    if (writing) {await writing; if (pending.length) return flush(); return;}
    if (!pending.length) return;
    const batch = pending.slice();
    writing = (async () => {
      try {
        // 先重读再合并：另一个窗口（或另一次读档）写过的记录不会被覆盖。
        const merged = applyBestiary(safeRead(), batch);
        await port.write(merged);
        pending = pending.filter(x => !batch.includes(x));
        store = applyBestiary(merged, pending); failures = 0;
        status.pending = pending.length; status.lastWrite = Date.now(); delete status.error;
      } catch (e) {
        failures++; status.error = String((e as Error)?.message ?? e).slice(0, 120);
        if (!disposed && failures < 6) {const wait = Math.min(30000, delay * 2 ** failures); timer = timers.set(() => {timer = undefined; void flush();}, wait);}
      } finally {writing = undefined; notify();}
    })();
    await writing;
  }
  return {
    contextId: port.contextId,
    store: () => store, legacy: () => legacy,
    summary: () => dexSummary(store, legacy),
    detail: (id, tier) => dexDetail(id, store, legacy, tier),
    observe(entries) {
      if (disposed || !entries.length) return;
      pending.push(...entries); store = applyBestiary(store, entries); status.pending = pending.length; notify(); schedule();
    },
    refresh() {store = applyBestiary(safeRead(), pending); legacy = safeLegacy(); notify();},
    flush,
    subscribe(fn) {listeners.add(fn); return () => {listeners.delete(fn);};},
    status: () => ({...status}),
    dispose() {disposed = true; if (timer !== undefined) {timers.clear(timer); timer = undefined;} listeners.clear();},
  };
}
/** 试玩页 / 没有宿主时：图鉴存在这台设备的浏览器里。 */
export function localBestiaryPort(storage: Pick<Storage, 'getItem' | 'setItem'> | undefined, key = 'booksea-bestiary-v1'): BestiaryPort {
  return {
    contextId: 'local:' + key,
    read() {try {const raw = storage?.getItem(key); return raw ? JSON.parse(raw) : undefined;} catch {return undefined;}},
    async write(store) {if (!storage) throw Error('这台设备不能保存图鉴'); storage.setItem(key, JSON.stringify(store));},
  };
}
