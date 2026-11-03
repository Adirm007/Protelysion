import {test} from 'node:test';
import assert from 'node:assert/strict';
import {playtestParty} from '../src/game/content';
import {startExpedition,move,tick,chooseSkill,chooseTarget,view,type State} from '../src/game/expedition';
import {walkable,type Thing} from '../src/game/region';
import {monsterKit} from '../src/game/monsters/kits';
import {MONSTER_ROSTER} from '../src/game/monsters/catalog';
import {MIMIC_ID} from '../src/game/monsters/mimic';
import {STRAY_ID} from '../src/game/monsters/stray';
import {mountExpeditionRuntime} from '../src/game/runtime';
import {
  DEX_SPECIES,DEX_GROUPS,applyBestiary,createBestiary,dexDetail,dexIdForArt,dexState,dexSummary,drainBestiaryLedger,emptyBestiary,
  legacyBestiaryIds,localBestiaryPort,normalizeBestiary,playerSkillText,recordBestiary,type BestiaryLedgerEntry,type BestiaryStore,
} from '../src/game/bestiary';
import {hostBestiaryPort} from '../src/host/bestiary-host';

const entry = (id: string, e: 'seen' | 'defeat', m: string, lv: number, d = 3, n?: number): BestiaryLedgerEntry => ({id, e, m, lv, d, at: 1000 + lv, ...(n ? {n} : {})});
function pathTo(s: State, x: number, z: number) {
  const q = [{x: s.x, z: s.z, path: [] as {dx: number; dz: number}[]}], seen = new Set([`${s.x},${s.z}`]);
  for (const p of q) {
    if (p.x === x && p.z === z) return p.path;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = p.x + dx, nz = p.z + dz, key = `${nx},${nz}`;
      if (seen.has(key) || !walkable(s.region, nx, nz)) continue;
      if (s.region.things.some(t => t.kind === 'enemy' && !t.used && t.x === nx && t.z === nz) && !(nx === x && nz === z)) continue;
      seen.add(key); q.push({x: nx, z: nz, path: [...p.path, {dx, dz}]});
    }
  }
  throw Error('no route');
}
function engage(s: State): Thing {
  const t = s.region.things.find(t => t.kind === 'enemy' && !t.used)!;
  for (const d of pathTo(s, t.x, t.z)) {if (s.mode !== 'explore') break; move(s, d.dx, d.dz);}
  return t;
}
function win(s: State) {
  for (let i = 0; s.mode === 'battle' && i < 20000; i++) {
    const v = view(s);
    if (v.battle.ready) {
      const b = s.battle!, u = b.units.find(u => u.id === b.clock.pending[0]!.unitId)!;
      const skill = Object.keys(u.actions).find(k => u.actions[k]!.target === 'enemy' && u.actions[k]!.cost.mp.flat === 0)!;
      const target = b.units.filter(u => u.side === 'enemy' && u.current.hp > 0).sort((a, b) => a.current.hp - b.current.hp)[0]!.id;
      chooseSkill(s, skill); chooseTarget(s, target);
    }
    tick(s, 200);
  }
}
function strongParty() {
  const party = playtestParty();
  for (const p of party) {p.card.numeric.max.hp = 900000; p.current.hp = 900000; for (const sk of p.card.skills) for (const e of sk.mapping.action?.effects ?? []) if (e.op === 'damage') e.amounts.physical = {...e.amounts.physical, flat: 2_000_000};}
  return party;
}

test('044 图鉴物种：432 正式怪物 + 宝箱怪 + 「?」，按 48 主题与异客分组', () => {
  assert.equal(DEX_SPECIES.length, 434);
  assert.equal(DEX_GROUPS.length, 49);
  assert.equal(DEX_GROUPS.slice(0, 48).every(g => g.species.length === 9), true);
  assert.deepEqual(DEX_GROUPS.at(-1)!.species.map(s => s.id), [MIMIC_ID, STRAY_ID]);
  for (const m of MONSTER_ROSTER) assert.equal(dexIdForArt(m.designId), m.id, m.id);
});
test('044 账本：只记已知物种；并入按物种 × 生命层级累计，编号去重', () => {
  const s = {depth: 9} as {depth: number; bestiaryLedger?: BestiaryLedgerEntry[]};
  recordBestiary(s, 'seen', 'T01_N01', 5); recordBestiary(s, 'seen', 'NOT_A_MONSTER', 5); recordBestiary(s, 'defeat', 'T01_N01', 6, 3);
  assert.equal(s.bestiaryLedger!.length, 2);
  const ledger = drainBestiaryLedger(s);
  assert.equal(s.bestiaryLedger!.length, 0);
  let store = applyBestiary(emptyBestiary(), ledger);
  const r = store.entries.T01_N01!;
  assert.equal(r.n, 1); assert.equal(r.k, 3); assert.deepEqual([r.d0, r.d1], [9, 9]);
  assert.deepEqual(Object.keys(r.t), ['2']);
  assert.deepEqual(r.t['2'], {lo: 5, hi: 6, n: 1, k: 3});
  store = applyBestiary(store, ledger);
  assert.equal(store.entries.T01_N01!.n, 1, '同一条账本不会重复计数');
  store = applyBestiary(store, [entry('b1', 'seen', 'T01_N01', 25, 49), entry('b2', 'seen', 'T01_N01', 31, 62)]);
  assert.deepEqual(store.entries.T01_N01!.t['7'], {lo: 25, hi: 31, n: 2, k: 0});
  assert.deepEqual([store.entries.T01_N01!.d0, store.entries.T01_N01!.d1], [9, 62]);
});
test('044 读档整理：未知物种、坏字段、越界层级都被丢弃', () => {
  const raw = {version: 1, entries: {T01_N01: {f: 5, l: 3, n: -4, k: 'x', d0: 0, d1: 2, t: {'1': {lo: 2, hi: 1, n: 2, k: 1}, '9': {lo: 1, hi: 1}, bad: 3}}, ghost: {n: 1}}, applied: ['a', 3, 'b'], updated: 7};
  const s = normalizeBestiary(raw);
  assert.deepEqual(Object.keys(s.entries), ['T01_N01']);
  assert.deepEqual(s.entries.T01_N01, {f: 5, l: 5, n: 0, k: 0, d0: 1, d1: 2, t: {'1': {lo: 2, hi: 2, n: 2, k: 1}}});
  assert.deepEqual(s.applied, ['a', 'b']);
  assert.deepEqual(normalizeBestiary({version: 99, entries: {T01_N01: {}}}).entries, {});
  assert.deepEqual(normalizeBestiary('garbage'), emptyBestiary());
});
test('044 详情：未遭遇不透露名字；旧旅程只有设定；解锁的阶与实战模板一致', () => {
  const store: BestiaryStore = applyBestiary(emptyBestiary(), [entry('a', 'seen', 'T01_B01', 14, 27), entry('b', 'seen', 'T01_B01', 3, 5)]);
  const legacy = legacyBestiaryIds(['depth-1', 'enemy:T02_N01', 'enemy:ghost', 'anchor-11']);
  assert.deepEqual([...legacy], ['T02_N01']);
  const unknown = dexDetail('T03_N01', store, legacy);
  assert.equal(unknown.known, false); assert.equal(unknown.name, '？？？'); assert.equal(unknown.lore, undefined); assert.equal(unknown.stats, undefined);
  const old = dexDetail('T02_N01', store, legacy);
  assert.equal(old.known, true); assert.equal(old.legacy, true); assert.ok(old.lore?.note?.text); assert.equal(old.stats, undefined); assert.equal(old.skills.length, 0);
  const boss = dexDetail('T01_B01', store, legacy);
  assert.equal(boss.tier, 4, '默认翻到最高的已解锁层级');
  const kit = monsterKit('T01_B01', 14);
  assert.deepEqual(boss.stats!.max, kit.numbers.max);
  assert.deepEqual(boss.stats!.attributes, kit.numbers.attributes);
  assert.equal(boss.skills.length, kit.card.skills.length);
  assert.equal(boss.stats!.resistance.find(r => r.element === '暗')!.label, '无效');
  assert.equal(boss.stats!.resistance.find(r => r.element === '光')!.label, '特攻');
  assert.ok(boss.stats!.phase.includes('血色'));
  assert.deepEqual(boss.tiers.filter(t => t.unlocked).map(t => t.tier), [1, 4]);
  const low = dexDetail('T01_B01', store, legacy, 1);
  assert.equal(low.tier, 1); assert.deepEqual(low.stats!.max, monsterKit('T01_B01', 3).numbers.max);
  assert.equal(dexDetail('T01_B01', store, legacy, 6).tier, 4, '没解锁的层级不能翻看');
  assert.ok(boss.lore!.note!.text.length > 6 && boss.lore!.drop!.name.includes('零号病患'));
  for (const k of boss.skills) {assert.doesNotMatch(k.summary, /品质词条投影|【[FG]\d+·|编译失败|仲裁仍为/); assert.ok(k.name);}
  const sum = dexSummary(store, legacy);
  assert.equal(sum.known, 2); assert.equal(sum.defeated, 1); assert.equal(sum.tiers, 2); assert.equal(sum.groups.T01!.known, 1);
});
test('044 宝箱怪与「?」有专属规则说明', () => {
  const store = applyBestiary(emptyBestiary(), [entry('m', 'seen', MIMIC_ID, 11), entry('s', 'seen', STRAY_ID, 6)]);
  const mimic = dexDetail(MIMIC_ID, store, new Set()), stray = dexDetail(STRAY_ID, store, new Set());
  assert.ok(mimic.lore!.rules!.some(r => r.includes('逃跑')));
  assert.ok(stray.lore!.rules!.some(r => r.includes('百分比伤害')));
  assert.equal(stray.stats!.resistance.find(r => r.element === '精')!.label, '无效');
  assert.equal(stray.stats!.resistance.find(r => r.element === '无')!.label, '无效');
  assert.ok(stray.skills.some(s => s.name === '未成之字'));
});
test('044 技能文案去掉开发者用语，保留它做了什么', () => {
  assert.equal(playerSkillText('微弱要素[零号感染]：下列有限效果是品质词条投影，不是完整登神能力。零号病患以「零号感染」为核：疫链扩散。持续与次数以效果详情为准。'), '零号病患以「零号感染」为核：疫链扩散。');
  assert.equal(playerSkillText('【F1·full】4段真多段（每段55%），逐段可闪避。'), '4段真多段（每段55%），逐段可闪避。');
  assert.equal(playerSkillText('它夺走敌人最近用过的一招。【主题专属·雏形】偷取技能。'), '它夺走敌人最近用过的一招。（主题专属·雏形）偷取技能。');
});
test('044 实战：开战记下“遭遇”，胜利记下“击败”只数与等级', () => {
  const s = startExpedition(strongParty(), 4242);
  const thing = engage(s);
  assert.equal(s.mode, 'battle');
  const seen = s.bestiaryLedger!.filter(x => x.e === 'seen');
  assert.deepEqual([...new Set(seen.map(x => x.m))].sort(), [...new Set(thing.foes)].sort());
  assert.ok(seen.every(x => x.lv === s.lastFight!.foes.find(f => f.id === x.m)!.level));
  win(s);
  assert.equal(s.mode, 'explore');
  const defeats = s.bestiaryLedger!.filter(x => x.e === 'defeat');
  assert.equal(defeats.reduce((n, x) => n + (x.n ?? 1), 0), thing.foes.length);
  const store = applyBestiary(emptyBestiary(), drainBestiaryLedger(s));
  for (const id of new Set(thing.foes)) {const st = dexState(store, new Set(), id); assert.ok(st.known && st.tiers.length === 1 && st.record!.k >= 1, id);}
});
test('044 服务：去抖写入、先重读再合并、失败退避重试、读档不重复计数', async () => {
  let saved: unknown = {version: 1, entries: {T05_N01: {f: 1, l: 1, n: 4, k: 0, d0: 2, d1: 2, t: {'1': {lo: 1, hi: 1, n: 4, k: 0}}}}, applied: [], updated: 1};
  const timers: {fn: () => void; ms: number}[] = [];
  let fail = 1, writes = 0;
  const service = createBestiary({contextId: 'c', read: () => saved, async write(store) {writes++; if (fail-- > 0) throw Error('写入失败'); saved = structuredClone(store);}}, {delayMs: 100, timers: {set: (fn, ms) => {timers.push({fn, ms}); return timers.length;}, clear: () => {}}});
  let notified = 0; service.subscribe(() => notified++);
  service.observe([entry('x1', 'seen', 'T05_N02', 2, 1)]);
  assert.equal(service.summary().known, 2, '界面立刻看到新记录');
  assert.equal(timers.length, 1); assert.equal(timers[0]!.ms, 100);
  timers.shift()!.fn(); await new Promise(r => setTimeout(r, 0));
  assert.equal(writes, 1); assert.ok(service.status().error); assert.equal(timers.length, 1, '失败后退避重试'); assert.ok(timers[0]!.ms > 100);
  // 另一个窗口同时写了一条：重试时先重读再合并，不会覆盖。
  saved = applyBestiary(normalizeBestiary(saved), [entry('y1', 'seen', 'T06_N01', 2, 1)]);
  timers.shift()!.fn(); await new Promise(r => setTimeout(r, 0));
  assert.equal(writes, 2); assert.equal(service.status().pending, 0); assert.equal(service.status().error, undefined);
  const s = normalizeBestiary(saved);
  assert.deepEqual(Object.keys(s.entries).sort(), ['T05_N01', 'T05_N02', 'T06_N01']);
  service.observe([entry('x1', 'seen', 'T05_N02', 2, 1)]);
  await service.flush();
  assert.equal(normalizeBestiary(saved).entries.T05_N02!.n, 1, '同一编号再次到达不重复计数');
  assert.ok(notified >= 3);
  service.dispose();
});
test('044 本机端口：没有存储时写入报错、读出空图鉴；宿主端口按聊天写 booksea.bestiary 并读旧 unlockedIds', async () => {
  const missing = localBestiaryPort(undefined);
  assert.equal(missing.read(), undefined); await assert.rejects(missing.write(emptyBestiary()));
  const mem = new Map<string, string>(), local = localBestiaryPort({getItem: k => mem.get(k) ?? null, setItem: (k, v) => {mem.set(k, v);}});
  await local.write(applyBestiary(emptyBestiary(), [entry('a', 'seen', 'T01_N01', 1)]));
  assert.ok(normalizeBestiary(local.read()).entries.T01_N01);
  let chat: Record<string, unknown> = {booksea: {unlockedIds: ['enemy:T09_N01'], supplierMemory: {keep: true}}}, saves = 0, chatId = 'c1';
  const globals = {TavernHelper: {getVariables: () => structuredClone(chat), updateVariablesWith: async (fn: (v: Record<string, unknown>) => Record<string, unknown>) => {chat = fn(structuredClone(chat));}}, SillyTavern: {getContext: () => ({characterId: 'x', getCurrentChatId: () => chatId, saveChat: async () => {saves++;}})}};
  const port = hostBestiaryPort(globals, () => ({booksea: {unlockedIds: ['enemy:T10_N02']}}));
  assert.deepEqual([...legacyBestiaryIds(port.legacy!())].sort(), ['T09_N01', 'T10_N02']);
  await port.write(applyBestiary(emptyBestiary(), [entry('a', 'seen', 'T01_N01', 1)]));
  assert.equal(saves, 1);
  assert.deepEqual((chat.booksea as Record<string, unknown>).supplierMemory, {keep: true}, '不碰 booksea 里的其他键');
  assert.ok(normalizeBestiary(port.read()).entries.T01_N01);
  chatId = 'c2';
  await assert.rejects(port.write(emptyBestiary()), /聊天已切换/);
});
test('044 运行时：存档前把账本交给图鉴服务；没有服务时账本留着', async () => {
  const values = new Map<string, string>(), timers: Function[] = [];
  const win = {localStorage: {getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => {values.set(k, v);}}, setInterval: (fn: Function) => {timers.push(fn); return timers.length;}, clearInterval() {}, document: {hidden: false, addEventListener() {}, removeEventListener() {}}, addEventListener() {}, removeEventListener() {}, performance: {now: () => 0}} as unknown as Window;
  const observed: BestiaryLedgerEntry[] = [];
  const bestiary = createBestiary({contextId: 't', read: () => undefined, async write() {}}, {timers: {set: () => 0, clear() {}}});
  const origObserve = bestiary.observe; bestiary.observe = e => {observed.push(...e); origObserve(e);};
  const s = startExpedition(strongParty(), 4242);
  recordBestiary(s, 'seen', 'T01_N01', 2);
  const checkpoints: State[] = [];
  const runtime = mountExpeditionRuntime({storageKey: 'dex', initial: s, audio: false, bestiary, checkpoint: async copy => {checkpoints.push(copy);}}, win);
  runtime.input({type: 'pause'});
  await runtime.flush();
  assert.equal(observed.length, 1);
  assert.ok(checkpoints.length && checkpoints.every(c => !c.bestiaryLedger?.length), '交给图鉴后再存档，存档里不留账本');
  runtime.dispose();
  const s2 = startExpedition(strongParty(), 4243); recordBestiary(s2, 'seen', 'T01_N02', 2);
  const bare = mountExpeditionRuntime({storageKey: 'dex2', initial: s2, audio: false}, win);
  bare.input({type: 'pause'});
  assert.equal(JSON.parse(values.get('dex2')!).bestiaryLedger.length, 1);
  bare.dispose();
});
