// 补给员记忆 · 长期陪伴：约定会了结、雷区优先、存档永远有界、旧账合并不丢数、感想不随压缩消失、
// 排队太多不丢对话、日期感（生日 / 纪念日 / 好久不见）、关系里程碑、“想起”只算相关的、玩家可以让她记牢。
import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyStore, migrateStore, MEMORY_LIMITS, MEMORY_SCHEMA, type MemoryStore, type Fact} from '../src/supplier-memory/schema';
import {recordEncounter, applyExtraction, compactStore, activeFacts, callName, setKeep, endRun, type EncounterInput} from '../src/supplier-memory/store';
import {memoryItems, scoreItems, renderMemory, calendarNotes, parseMonthDay, consolidationContext} from '../src/supplier-memory/retrieve';
import {buildExtractionPrompt} from '../src/supplier-memory/extract';
import {isPinned} from '../src/supplier-memory/decay';
import {fakeChat, fakeStorage, makeMemory, observed, encounter, storedMemory, scriptedLLM, clock} from './supplier-memory-fixture';

const DAY = 86400000, T0 = new Date(2026, 9, 1, 12).getTime();
const lines = (...l: [('player' | 'supplier' | 'system'), string][]) => l.map(([role, text]) => ({role, text}));
function meet(store: MemoryStore, l: ReturnType<typeof lines>, o: Partial<EncounterInput> = {}) {
  const n = store.n + 1, enc: EncounterInput = {key: 'run-1|t' + n, run: 'run-1', thing: 't' + n, depth: 3, place: '旧书街', theme: '书街', at: T0 + n * DAY, choices: ['talk'], buys: [], deals: [], gifts: [], misses: [], lines: l, ...o};
  const out = recordEncounter(store, enc, {extract: true}); assert.ok(out.job, 'talk creates an extraction job'); return out.job!;
}
const section = (s: MemoryStore, query: string, now: number, budget: 'compact' | 'standard' | 'generous' = 'standard') => renderMemory(s, scoreItems(s, memoryItems(s, now), query, now), now, budget);
const plain = (id: number, o: Partial<Fact> = {}): Fact => ({id: 'f' + id, kind: 'story', text: `玩家的第 ${id} 件事`, source: 'player', evidence: [], importance: 4, confidence: .9, n: 1, at: T0, status: 'active', ...o});

test('约定会了结：兑现要有这次对话的原话（玩家或她说的都行）；了结的不再挂在“约定”里，被问起时作为“已了结”想起来', () => {
  const s = emptyStore('c', 1, T0);
  applyExtraction(s, meet(s, lines(['player', '下次我带蛋糕给你，还会带朋友来'], ['supplier', '那我下次送你一瓶红药。'])), {memories: [
    {kind: 'promise', text: '玩家答应下次带蛋糕给补给员', source: 'player', quote: '下次我带蛋糕给你', importance: 7},
    {kind: 'promise', text: '玩家说下次会带朋友来', source: 'player', quote: '还会带朋友来', importance: 6},
    {kind: 'promise', text: '补给员说下次送玩家一瓶红药', source: 'self', quote: '那我下次送你一瓶红药', importance: 6},
    {kind: 'preference', text: '玩家喜欢甜食', source: 'player', quote: '下次我带蛋糕给你', importance: 4}]}, T0);
  const find = (needle: string, kind = 'promise') => activeFacts(s).find(f => f.kind === kind && f.text.includes(needle))!;
  const cake = find('蛋糕'), friend = find('朋友'), potion = find('红药'), sweet = find('甜食', 'preference');
  assert.match(section(s, '你好', T0 + 2 * DAY).text, /约定：\n[^\n]*蛋糕/);
  const job = meet(s, lines(['player', '蛋糕我带来啦，给你！'], ['supplier', '说好的红药，拿去。']));
  const ctx = consolidationContext(s, ['蛋糕我带来啦'], T0 + 2 * DAY, false).map(m => m.id);
  assert.ok([cake, friend, potion].every(f => ctx.includes(f.id)), '整理模型看得到所有还没了结的约定');
  assert.match(buildExtractionPrompt(s, job, T0).user, new RegExp(cake.id + ' \\| - \\| player/promise \\| '));
  const r = applyExtraction(s, job, {memories: [
    {op: 'resolve', id: cake.id, outcome: 'kept', quote: '蛋糕我带来啦'},
    {op: 'kept', id: potion.id, quote: '说好的红药，拿去'},
    {op: 'resolve', id: friend.id, outcome: 'kept', quote: '朋友也来了'},
    {op: 'resolve', id: sweet.id, outcome: 'kept', quote: '蛋糕我带来啦'},
    {op: 'broken', id: cake.id, quote: '蛋糕我带来啦'}]}, T0 + 2 * DAY);
  assert.deepEqual(r.resolved.sort(), [cake.id, potion.id].sort());
  assert.deepEqual(r.rejected.map(x => x.reason), ['了结约定没有原话佐证', '要了结的约定不存在', '要了结的约定不存在']);
  assert.equal(cake.status, 'resolved'); assert.equal(cake.outcome, 'kept'); assert.equal(potion.outcome, 'kept'); assert.equal(cake.pinned, undefined);
  assert.equal(friend.status, 'active', '没有原话撑腰的约定照旧挂着');
  const later = section(s, '你好', T0 + 3 * DAY).text;
  assert.match(later, /约定：\n[^\n]*朋友/); assert.doesNotMatch(later.split('约定：')[1]!.split('\n')[1]!, /蛋糕/, '了结的约定不再挂在约定里');
  assert.match(section(s, '你还记得我答应带蛋糕的约定吗', T0 + 3 * DAY).text, /已了结的约定：已兑现）玩家答应下次带蛋糕/);
  const back = migrateStore(JSON.parse(JSON.stringify(s)), 'c').store;
  assert.equal(back.facts.find(f => f.id === cake.id)!.outcome, 'kept', '了结的方式随存档保留');
});

test('雷区优先进核心、不会被挤掉：再多别的记忆、再紧的预算，也先放雷区', () => {
  const s = emptyStore('c', 1, T0);
  applyExtraction(s, meet(s, lines(['player', '别再问我考试的事了，我不想提'])), {memories: [{kind: 'boundary', text: '玩家不想被问考试的事', source: 'player', quote: '别再问我考试的事了', importance: 3}]}, T0);
  for (let i = 0; i < 90; i++) applyExtraction(s, meet(s, lines(['player', `我喜欢第${i}号星星`])), {memories: [{kind: 'preference', value: `第${i}号星星`, text: `玩家喜欢第${i}号星星，这句话写得很长很长用来占用预算`, source: 'player', quote: `我喜欢第${i}号星星`, importance: 5}]}, T0);
  assert.equal(activeFacts(s).length, MEMORY_LIMITS.facts);
  assert.ok(activeFacts(s).some(f => f.kind === 'boundary'), '雷区没有因为记忆太多被挤掉');
  const out = section(s, '今天去哪层', T0 + 100 * DAY, 'compact');
  assert.match(out.text, /雷区（玩家不喜欢、不想被提起的事，一定避开）：\n· 玩家不想被问考试的事/);
});

test('自动置顶有上限：模型把什么都标成很重要时，最久没被想起的降回普通记忆照常衰减；玩家“记牢”的不降级、不被挤掉', () => {
  const s = emptyStore('c', 1, T0); s.n = 300;
  for (let i = 1; i <= 60; i++) s.facts.push(plain(i, {importance: 9, n: i}));
  for (let i = 101; i <= 103; i++) s.facts.push(plain(i, {importance: 2, keep: true}));
  for (let i = 201; i <= 240; i++) s.facts.push(plain(i, {importance: 3, n: i}));
  compactStore(s, T0 + 400 * DAY);
  assert.ok(activeFacts(s).filter(f => isPinned(f) && !f.keep).length <= MEMORY_LIMITS.pinned);
  assert.equal(activeFacts(s).filter(f => f.keep).length, 3, '记牢的一条都没少');
  assert.equal(activeFacts(s).length, MEMORY_LIMITS.facts);
  assert.equal(activeFacts(s).filter(f => !isPinned(f) && f.importance === 7).length, 36, '降级的回到普通记忆（重要度 7），之后照常衰减');
  assert.ok(s.facts.find(f => f.id === 'f60')!.pinned !== undefined || isPinned(s.facts.find(f => f.id === 'f60')!), '最近记下的高显著记忆仍置顶');

  const t = emptyStore('c', 1, T0);
  for (let i = 1; i <= 25; i++) t.facts.push(plain(i));
  for (let i = 1; i <= MEMORY_LIMITS.keep; i++) assert.equal(setKeep(t, 'f' + i, true), true);
  assert.equal(setKeep(t, 'f25', true), 'full', '记牢有上限');
  assert.equal(setKeep(t, 'f1', false), true); assert.equal(setKeep(t, 'f25', true), true);
  assert.equal(setKeep(t, 'f404', true), false);

  const u = emptyStore('c', 1, T0);
  applyExtraction(u, meet(u, lines(['player', '我最喜欢吃草莓'])), {memories: [{slot: 'favorite:food', value: '草莓', text: '玩家最喜欢吃草莓', source: 'player', quote: '我最喜欢吃草莓', kind: 'preference'}]}, T0);
  setKeep(u, activeFacts(u)[0]!.id, true);
  applyExtraction(u, meet(u, lines(['player', '我现在最喜欢吃牛油果'])), {memories: [{slot: 'favorite:food', value: '牛油果', text: '玩家最喜欢吃牛油果', source: 'player', quote: '我现在最喜欢吃牛油果', kind: 'preference'}]}, T0);
  assert.equal(activeFacts(u).find(f => f.value === '牛油果')!.keep, true, '改口后“记牢”跟着新说法走');
  assert.equal(u.facts.find(f => f.value === '草莓')!.keep, undefined);
});

test('存档永远有界：往事全是重要的也照样封顶；旧账按统计合并，见面次数和成交金额一分不差、文字不截断；原话和感想都留得住', () => {
  const s = emptyStore('c', 1, T0);
  let total = 0, fp = 0;
  for (let i = 0; i < 400; i++) {
    const out = recordEncounter(s, {key: 'k' + i, run: 'run-' + Math.floor(i / 5), thing: 't' + i, depth: 1 + (i % 50), place: '第' + i + '处', theme: 't', at: T0 + i * DAY, choices: ['shop'], buys: [], deals: [{label: '旧书', price: 100 + i}], gifts: [], misses: [], lines: []}, {extract: false});
    out.episode.importance = 8; if (i === 3) out.episode.quote = '我会一直来找你的';
    total++; fp += 100 + i;
    if (i === 10) s.reflections.push({id: 'r9001', text: '玩家每次都来买旧书', evidence: [s.episodes[2]!.id, s.episodes[5]!.id], importance: 5, n: 10, at: T0, status: 'active'});
    compactStore(s, T0 + i * DAY);
  }
  assert.ok(s.episodes.length <= MEMORY_LIMITS.episodes, String(s.episodes.length));
  assert.ok(s.digests.length <= MEMORY_LIMITS.digests, String(s.digests.length));
  const encounters = s.digests.reduce((n, d) => n + (d.stats?.encounters ?? 0), 0) + s.episodes.filter(e => e.kind === 'encounter').length;
  assert.equal(encounters, total, '旧账加上近事，见面次数一次不少');
  const dealFp = s.digests.reduce((n, d) => n + (d.stats?.dealFp ?? 0), 0) + s.episodes.flatMap(e => e.meta?.deals ?? []).reduce((n, d) => n + d.price, 0);
  assert.equal(dealFp, fp, '成交金额一分不差');
  for (const d of s.digests) assert.match(d.text, /。$/, '旧账文字由统计生成，不会截成半句：' + d.text);
  assert.match(s.digests[0]!.text, /第 1～\d+ 趟前后/);
  assert.ok(s.digests.some(d => d.quotes?.includes('我会一直来找你的')), '压进旧账的往事里，玩家的原话留了下来');
  assert.ok(memoryItems(s, T0 + 500 * DAY).some(i => i.type === 'digest' && i.text.includes('『我会一直来找你的』')));
  const r = s.reflections.find(x => x.id === 'r9001');
  assert.ok(r, '感想没有因为依据被压进旧账而消失'); assert.ok(r!.evidence.every(x => /^d\d+$/.test(x)), r!.evidence.join());
  assert.ok(JSON.stringify(s).length < 200_000, '存档有界');
  assert.deepEqual(migrateStore(JSON.parse(JSON.stringify(s)), 'c').store.digests, s.digests, '旧账的统计和原话随存档保留');
});

test('否认一条事实时，只靠它撑着的感想一起作废；感想也可以引用旧账', () => {
  const s = emptyStore('c', 1, T0);
  const job = meet(s, lines(['player', '我养了一只猫']));
  applyExtraction(s, job, {memories: [{kind: 'story', text: '玩家养了一只猫', source: 'player', quote: '我养了一只猫'}]}, T0);
  const cat = activeFacts(s)[0]!;
  s.reflections.push({id: 'r50', text: '玩家是个爱猫的人', evidence: [cat.id], importance: 5, n: 1, at: T0, status: 'active'}, {id: 'r51', text: '玩家常来', evidence: [cat.id, job.episode], importance: 4, n: 1, at: T0, status: 'active'});
  applyExtraction(s, meet(s, lines(['player', '其实我没养猫，那是骗你的'])), {memories: [{op: 'retract', id: cat.id, quote: '其实我没养猫'}]}, T0);
  assert.deepEqual(s.reflections.map(r => [r.id, r.evidence]), [['r51', [job.episode]]]);
  const v1 = migrateStore({schema: MEMORY_SCHEMA, epoch: 1, reflections: [{id: 'r1', text: '玩家很守信', evidence: ['d5', 'x9'], importance: 5, n: 1, at: T0}]}, 'c').store;
  assert.deepEqual(v1.reflections[0]!.evidence, ['d5']);
});

test('整理模型一直连不上：排队超过上限的见面先用兜底记下名字和原话，不会整段丢掉', () => {
  const s = emptyStore('c', 1, T0);
  meet(s, lines(['player', '我叫阿青，我从海边来']));
  for (let i = 0; i < 5; i++) meet(s, lines(['player', `今天是第${i}次随便聊聊，我小时候养过一只狗`]));
  assert.equal(s.pending.length, MEMORY_LIMITS.pending);
  assert.equal(callName(s), '阿青', '最早那次见面里的名字靠兜底记下了');
  assert.match(s.episodes.find(e => e.n === 1)!.quote ?? '', /我叫阿青/, '兜底逐字记下了玩家的原话');
});

test('日期感：生日、认识纪念日、好久不见都由程序按日期算，开场白也跟着变', async () => {
  for (const [v, m, d] of [['11月7日', 11, 7], ['11.7', 11, 7], ['2001-11-07', 11, 7], ['十一月七号', 11, 7], ['3/15', 3, 15], ['二月二十九日', 2, 29]] as const) assert.deepEqual(parseMonthDay(v), {m, d}, v);
  assert.equal(parseMonthDay('冬天出生'), undefined); assert.equal(parseMonthDay('13月40日'), undefined);
  const c = clock(new Date(2026, 9, 20, 12).getTime()), chat = fakeChat();
  const llm = scriptedLLM([['我生日是11月7日', {memories: [
    {kind: 'identity', slot: 'birthday', value: '11月7日', text: '玩家的生日是11月7日', source: 'player', quote: '我生日是11月7日', importance: 7},
    {kind: 'identity', slot: 'name', value: '阿青', text: '玩家的名字是阿青', source: 'player', quote: '我叫阿青', importance: 8}]}]]);
  const mem = makeMemory({chat, storage: fakeStorage(), llm, now: c.now});
  encounter(mem, observed(), {run: 'run-1', thing: 'sup-1', depth: 2, at: c.now(), lines: [['player', '我叫阿青，我生日是11月7日']]});
  await mem.idle();
  assert.equal(mem.greeting(), '嗯？阿青，想聊什么。');
  assert.match((await mem.section('你好')).text, /今天是 10月20日。/);
  c.advanceDays(18);
  assert.equal(mem.greeting(), '嗯？阿青……今天是你生日吧。想聊什么。');
  assert.match((await mem.section('你好')).text, /今天是 11月7日：今天是玩家的生日（玩家说过生日是「11月7日」）/);
  c.advanceDays(10);
  assert.equal(mem.greeting(), '嗯？阿青……好久不见。想聊什么。');
  assert.match((await mem.section('你好')).text, /距离上次见面已经过了 28 天，好久不见/);
  mem.dispose();
  const s = emptyStore('c', 1, T0); s.relationship.firstMet = {n: 1, at: new Date(2025, 9, 1, 9).getTime(), depth: 1, place: 'x'};
  assert.ok(calendarNotes(s, new Date(2026, 9, 1, 20).getTime()).some(n => n.includes('认识满 1 年')));
  s.relationship.firstMet.at = new Date(2026, 6, 23, 9).getTime();
  assert.ok(calendarNotes(s, new Date(2026, 9, 31, 8).getTime()).some(n => n.includes('认识满 100 天')));
  assert.deepEqual(calendarNotes(s, new Date(2026, 9, 30, 8).getTime()), []);
});

test('关系里程碑：第一次聊天、第一次成交、成了熟客、第 10 次见面、第一次平安撤离……每种只记一次，进核心档案', () => {
  const s = emptyStore('c', 1, T0);
  for (let i = 0; i < 12; i++) recordEncounter(s, {key: 'k' + i, run: 'run-1', thing: 't' + i, depth: 2, place: 'p', theme: 't', at: T0 + i * DAY, choices: ['talk'], buys: [], deals: i === 2 ? [{label: '旧书', price: 300}] : [], gifts: i === 4 ? [{label: '糖', price: 0}] : [], misses: [], lines: i === 1 || i === 6 ? lines(['player', '你好呀']) : []}, {extract: false});
  const keys = (s.relationship.milestones ?? []).map(m => m.key);
  for (const k of ['first:talk', 'first:deal', 'first:gift', 'meet:10', 'closeness:熟客']) assert.ok(keys.includes(k), k);
  assert.equal(new Set(keys).size, keys.length, '每种只记一次');
  assert.equal(s.relationship.milestones!.find(m => m.key === 'meet:10')!.n, 10);
  assert.equal(s.relationship.milestones!.find(m => m.key === 'first:talk')!.n, 2);
  endRun(s, {id: 'run-1', outcome: 'success', startDepth: 1, maxDepth: 5, at: T0 + 13 * DAY});
  assert.ok(s.relationship.milestones!.some(m => m.key === 'first:success'));
  assert.match(section(s, '你好', T0 + 14 * DAY).text, /你们之间的里程碑：\n· [^\n]*第 \d+ 次见面，/);
  assert.deepEqual(migrateStore(JSON.parse(JSON.stringify(s)), 'c').store.relationship.milestones, s.relationship.milestones);
});

test('“想起”只算真的相关的：每句都带上的核心档案不会因此永不淡去', async () => {
  const chat = fakeChat(), c = clock(T0);
  const llm = scriptedLLM([['我养了一只猫', {memories: [
    {kind: 'story', value: '团子', text: '玩家养了一只叫团子的猫', source: 'player', quote: '我养了一只猫叫团子', importance: 5},
    {kind: 'preference', text: '玩家喜欢下雨天', source: 'player', quote: '我喜欢下雨天', importance: 5}]}]]);
  const mem = makeMemory({chat, storage: fakeStorage(), llm, now: c.now});
  encounter(mem, observed(), {run: 'run-1', thing: 'sup-1', depth: 2, at: T0, lines: [['player', '我养了一只猫叫团子，我喜欢下雨天']]});
  await mem.idle();
  const ids = Object.fromEntries(mem.view().facts.map(f => [f.text.includes('猫') ? 'cat' : 'rain', f.id]));
  const out = await mem.section('我的猫团子');
  assert.ok(out.core.includes(ids.cat!) && out.core.includes(ids.rain!), '两条都在核心档案里');
  await mem.flush();
  const saved = (storedMemory(chat).facts as Fact[]);
  assert.ok(saved.find(f => f.id === ids.cat)!.lastRecall, '相关的那条算想起');
  assert.equal(saved.find(f => f.id === ids.rain)!.lastRecall, undefined, '只是带上、并不相关的不算想起');
  mem.dispose();
});

test('第 1 版存档自动升级：内容不丢，感想可以引用旧账，旧版游戏之后只读不覆盖', async () => {
  const v1 = {schema: 1, epoch: 2, chat: 'char-1:chat-A', n: 3, seq: 9,
    facts: [{id: 'f1', kind: 'promise', text: '玩家答应下次带蛋糕', source: 'player', status: 'active', evidence: [{ep: 'e2'}], importance: 7, confidence: .9, n: 2, at: T0}],
    episodes: [{id: 'e2', kind: 'encounter', text: '第 1 层「x」：聊了天', n: 2, at: T0}],
    digests: [{id: 'd5', text: '更早（10月1日—10月2日）：见过 2 次面。', fromN: 1, toN: 2, fromAt: T0, toAt: T0, count: 2}],
    reflections: [{id: 'r6', text: '玩家很守信', evidence: ['f1', 'd5'], importance: 5, n: 2, at: T0, status: 'active'}],
    relationship: {talks: 1, deals: 0, gifts: 0, misses: 0, buys: 0, closeness: 30}};
  const chat = fakeChat({booksea: {supplierMemory: v1}}), mem = makeMemory({chat, storage: fakeStorage()});
  await mem.idle();
  assert.equal(mem.status().load, 'repaired');
  const saved = storedMemory(chat);
  assert.equal(saved.schema, MEMORY_SCHEMA); assert.equal(saved.epoch, 2); assert.equal(saved.n, 3);
  assert.equal((saved.facts as unknown[]).length, 1); assert.equal((saved.digests as unknown[]).length, 1);
  assert.deepEqual((saved.reflections as {evidence: string[]}[])[0]!.evidence, ['f1', 'd5']);
  mem.dispose();
});

test('记牢：面板里点“记牢”的那条写进存档、排在最前；里程碑和了结的约定在面板里看得到', async () => {
  const chat = fakeChat(), c = clock(T0);
  const llm = scriptedLLM([['我叫阿青', {memories: [
    {kind: 'identity', slot: 'name', value: '阿青', text: '玩家的名字是阿青', source: 'player', quote: '我叫阿青', importance: 8},
    {kind: 'preference', text: '玩家喜欢下雨天', source: 'player', quote: '我喜欢下雨天', importance: 3}]}]]);
  const mem = makeMemory({chat, storage: fakeStorage(), llm, now: c.now});
  encounter(mem, observed(), {run: 'run-1', thing: 'sup-1', depth: 2, at: T0, lines: [['player', '我叫阿青，我喜欢下雨天']]});
  await mem.idle();
  const rain = mem.view().facts.find(f => f.text.includes('下雨'))!;
  assert.equal(rain.keep, false);
  assert.equal(await mem.keep(rain.id, true), true);
  assert.equal(mem.view().facts[0]!.id, rain.id, '记牢的排在最前'); assert.equal(mem.view().facts[0]!.keep, true);
  assert.equal((storedMemory(chat).facts as Fact[]).find(f => f.id === rain.id)!.keep, true, '写进了存档');
  assert.equal(await mem.keep(rain.id, false), true);
  assert.equal((storedMemory(chat).facts as Fact[]).find(f => f.id === rain.id)!.keep, undefined);
  assert.ok(mem.view().milestones.some(m => m.text === '第一次聊天'));
  assert.deepEqual(mem.view().resolved, []);
  mem.dispose();
});
