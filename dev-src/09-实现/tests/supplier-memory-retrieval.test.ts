import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyStore, type MemoryStore} from '../src/supplier-memory/schema';
import {recordEncounter, applyExtraction} from '../src/supplier-memory/store';
import {endpoint, SETTINGS_KEY, embed, rerank, type MemorySettings} from '../src/supplier-memory/apis';
import {fakeChat, fakeStorage, makeMemory, startMockApi, nodeFetch, withSettings, storedMemory} from './supplier-memory-fixture';
import {memoryVectorCache} from '../src/supplier-memory/vectors';

const DAY = 86400000, T0 = Date.UTC(2026, 9, 1, 4);
type Seed = [kind: string, value: string, text: string, quote: string, importance: number];
const FILLER: Seed[] = [
  ['story', '蜘蛛', '玩家很怕蜘蛛', '我超级怕蜘蛛', 5], ['story', '海边', '玩家小时候住在海边', '我小时候住在海边', 5], ['story', '钢琴', '玩家会弹钢琴', '我会弹钢琴', 5],
  ['preference', '蓝色', '玩家最喜欢蓝色', '我最喜欢的颜色是蓝色', 5], ['story', '篮球', '玩家周末会打篮球', '我周末打篮球', 5], ['preference', '咖啡', '玩家每天要喝咖啡', '我每天都要喝咖啡', 5],
  ['story', '火车', '玩家喜欢坐火车去旅行', '我喜欢坐火车旅行', 5], ['preference', '向日葵', '玩家喜欢向日葵', '我喜欢向日葵', 5], ['story', '熬夜', '玩家经常熬夜', '我经常熬夜', 5],
  ['preference', '星星', '玩家喜欢看星星', '我喜欢看星星', 5], ['story', '小说', '玩家在写一本小说', '我在写一本小说', 5],
];
const CAT: Seed = ['story', '团子', '玩家养了一只叫团子的猫', '我养了一只猫，叫团子', 3];
function seed(facts: Seed[]): MemoryStore {
  const s = emptyStore('char-1:chat-A', 1, T0);
  facts.forEach(([kind, value, text, quote, importance], i) => {
    const out = recordEncounter(s, {key: 'run-1|t' + i, run: 'run-1', thing: 't' + i, depth: i + 1, place: '第' + (i + 1) + '层', theme: 't', at: T0 + i * DAY, choices: ['talk'], buys: [], deals: [], gifts: [], misses: [], lines: [{role: 'player', text: quote}]}, {extract: true});
    applyExtraction(s, out.job!, {memories: [{kind, value, text, source: 'player', quote, importance}]}, T0 + i * DAY);
  });
  return s;
}
function memoryWith(settings: (s: MemorySettings) => void, store = seed([...FILLER, CAT]), retrievalMs = 4500) {
  const chat = fakeChat({booksea: {supplierMemory: structuredClone(store)}}), storage = fakeStorage();
  withSettings(storage, s => {s.budget = 'compact'; settings(s);});
  const vectors = memoryVectorCache();
  return {chat, storage, vectors, mem: makeMemory({chat, storage, fetch: nodeFetch, vectors, now: () => T0 + 30 * DAY}, {retrievalMs})};
}
const hasCat = (text: string) => text.includes('团子');

test('关键词检索（什么接口都不配）：原话里有的说法能找到；换了说法（宠物↔猫）找不到时宁可不提；无关问题什么都不检索出来', async () => {
  const {mem} = memoryWith(() => {});
  const direct = await mem.section('我的猫叫什么来着？');
  assert.equal(direct.mode, 'lexical'); assert.ok(hasCat(direct.text), '直接说“猫”能找到');
  const paraphrase = await mem.section('我的宠物叫什么名字？');
  assert.equal(hasCat(paraphrase.text), false, '只靠关键词时，换了说法就找不到——不会乱塞');
  const none = await mem.section('今天的天空是什么颜色的海');
  assert.ok(none.retrieved.length <= 2, String(none.retrieved));
  const unrelated = await mem.section('你觉得迷宫的出口在哪');
  assert.equal(unrelated.retrieved.length, 0, '完全无关的问题不检索任何往事');
});

test('向量检索（模拟 /v1/embeddings，经真实 HTTP）：能接住换了说法的问题；记忆的向量按聊天+第几任缓存，第二次只算问题本身', async () => {
  const api = await startMockApi();
  try {
    const {mem} = memoryWith(s => {s.embedding = {enabled: true, url: api.url + '/ok/v1', model: 'mock-embed', key: 'test-key'};});
    const first = await mem.section('我的宠物叫什么名字？');
    assert.equal(first.mode, 'hybrid'); assert.ok(hasCat(first.text), '宠物 ≈ 猫：' + first.text);
    const memories = api.calls.texts;
    const second = await mem.section('我家那只宠物最近胖了没');
    assert.ok(hasCat(second.text), '第二次也找得到：' + second.text);
    assert.equal(api.calls.texts - memories, 1, '第二次只向量化问题本身');
    assert.ok(api.auth.every(a => a === 'Bearer test-key'));
    assert.deepEqual((await embed(nodeFetch, {enabled: true, url: api.url + '/ok/v1/embeddings', model: 'm', key: ''}, ['a', 'b'])).length, 2, '完整地址也能用');
  } finally {await api.close();}
});

test('重排（模拟 /v1/rerank）：在关键词召回之上精排，换了说法也能找到；分数低于门槛的候选不放进去', async () => {
  const api = await startMockApi();
  try {
    const {mem} = memoryWith(s => {s.rerank = {enabled: true, url: api.url + '/ok/v1', model: 'mock-rerank', key: ''};});
    const out = await mem.section('我的宠物叫什么名字？');
    assert.equal(out.mode, 'lexical+rerank'); assert.ok(hasCat(out.text));
    assert.ok(out.retrieved.length <= 2, '只放过门槛的');
    const scores = await rerank(nodeFetch, {enabled: true, url: api.url + '/ok/v1', model: 'm', key: ''}, '玩家怕什么', ['玩家很怕蜘蛛', '第 3 层的楼梯']);
    assert.ok(scores[0]! > scores[1]!);
    const both = memoryWith(s => {s.embedding = {enabled: true, url: api.url + '/ok/v1', model: 'e', key: ''}; s.rerank = {enabled: true, url: api.url + '/ok/v1', model: 'r', key: ''};});
    const fused = await both.mem.section('我的宠物叫什么名字？');
    assert.equal(fused.mode, 'hybrid+rerank'); assert.ok(hasCat(fused.text));
  } finally {await api.close();}
});

test('接口出错从不打断对话：500 / 401 / 超时 / 格式不对都退回关键词检索；连续失败后暂停调用，不会每句话都白等', async () => {
  const api = await startMockApi();
  try {
    for (const [path, note, key] of [['/fail500', /HTTP 500/, ''], ['/auth', /HTTP 401（密钥不对或没有权限）/, 'wrong'], ['/bad', /返回格式不对/, ''], ['/slow', /超时/, '']] as const) {
      const {mem} = memoryWith(s => {s.embedding = {enabled: true, url: api.url + path + '/v1', model: 'e', key};}, undefined, 600);
      const t0 = Date.now(), out = await mem.section('我的猫叫什么来着？');
      assert.equal(out.mode, 'lexical', path); assert.ok(hasCat(out.text), path + ' 关键词兜底照常');
      assert.match(mem.status().last!.note, note, path); assert.ok(Date.now() - t0 < 2500, path + ' 不久等');
      const before = api.calls.embeddings + api.auth.length;
      await mem.section('再问一句');
      assert.equal(api.calls.embeddings + api.auth.length, before, path + ' 熔断：冷却期内不再请求');
    }
    const ok = memoryWith(s => {s.embedding = {enabled: true, url: api.url + '/auth/v1', model: 'e', key: 'test-key'};});
    assert.equal((await ok.mem.section('我的宠物叫什么名字？')).mode, 'hybrid', '密钥对了就能用');
    const offline = memoryWith(s => {s.embedding = {enabled: true, url: 'http://127.0.0.1:9/v1', model: 'e', key: ''}; s.rerank = {enabled: true, url: 'http://127.0.0.1:9/v1', model: 'r', key: ''};});
    const prompt = await offline.mem.augment({prompt: {system: 'ORIGINAL', messages: []}, context: {depth: 1, theme: '', themeSubtitle: '', scene: '', foes: [], floorQuality: '普通', capTier: 1, party: [], fp: 0, relics: [], items: [], kills: 0, encounters: [], remaining: {relic: 1, item: 2, event: 1, loot: 1}, runId: 'r'}, log: [{role: 'player', text: '我的猫叫什么'}]});
    assert.ok(prompt.system.includes('【你对玩家的记忆】') && hasCat(prompt.system), '连不上也照样带着关键词检索出的记忆');
  } finally {await api.close();}
});

test('密钥只在这台设备：设置存在 localStorage，聊天变量、记忆存档、状态里都没有密钥；测试连接的结果也不含密钥', async () => {
  const api = await startMockApi();
  try {
    const {mem, chat, storage} = memoryWith(() => {});
    const secret = 'sk-test-' + 'x'.repeat(24);
    mem.saveSettings({...mem.settings(), embedding: {enabled: true, url: api.url + '/ok/v1', model: 'e', key: secret}, rerank: {enabled: true, url: api.url + '/ok/v1/rerank', model: 'r', key: secret}});
    const r = await mem.test('embedding'); assert.equal(r.ok, true); assert.match(r.note, /已连接 · \d+ 维/);
    const rr = await mem.test('rerank'); assert.equal(rr.ok, true); assert.match(rr.note, /排序正常/);
    await mem.section('我的猫'); await mem.flush(); await mem.idle();
    assert.ok(storage.getItem(SETTINGS_KEY)!.includes(secret));
    for (const where of [JSON.stringify(chat.vars), JSON.stringify(storedMemory(chat)), JSON.stringify(mem.status()), JSON.stringify(mem.view()), r.note, rr.note]) assert.equal(where.includes(secret), false);
    assert.equal(endpoint('https://api.x.cn/v1/', 'embeddings'), 'https://api.x.cn/v1/embeddings');
    assert.equal(endpoint('https://api.x.cn/v1/rerank', 'rerank'), 'https://api.x.cn/v1/rerank');
    const bad = await mem.test('rerank', {...mem.settings(), rerank: {enabled: true, url: api.url + '/fail500/v1', model: 'r', key: secret}});
    assert.equal(bad.ok, false); assert.equal(bad.note.includes(secret), false);
  } finally {await api.close();}
});
