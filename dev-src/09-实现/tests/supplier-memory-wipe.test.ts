// 杀害 / 手动清空补给员记忆：清空必须彻底，而且读档、回退楼层、换回旧聊天文件都不能把上一任的记忆带回来。
import test from 'node:test';
import assert from 'node:assert/strict';
import {createSupplierMemory, tombstoneKey, type MemoryLLM} from '../src/supplier-memory/service';
import {memoryVectorCache, vectorKey} from '../src/supplier-memory/vectors';
import {hostMemoryPort} from '../src/host/supplier-memory-host';
import {createMessageTimeline} from '../src/host/message-timeline';
import {drainSupplierLedger} from '../src/game/supplier-ledger';
import {startExpedition, interact, supplierChoice} from '../src/game/expedition';
import {supplierSpawns} from '../src/game/supplier';
import {playtestParty} from '../src/game/content';
import type {TalkSession} from '../src/game/supplier-agent';
import {fakeChat, fakeStorage, makeMemory, observed, encounter, killEntry, storedMemory, rec, clock, scriptedLLM, withSettings} from './supplier-memory-fixture';

const T0 = Date.UTC(2026, 9, 1, 4), NEW_FACE = '嗯？……新面孔。想聊什么。';
const ME: [('player' | 'supplier'), string][] = [['player', '你好，我叫阿青。'], ['supplier', '嗯，记住了。'], ['player', '我养了一只猫，叫团子。']];
const remembersMe = (v: unknown) => /阿青|团子/.test(JSON.stringify(v));

function supplierSeed() {for (let n = 1; n < 10000; n++) if (supplierSpawns(1, 0, n)) return n; throw Error('No supplier seed');}
function atSupplier() {
  const s = startExpedition(playtestParty(), supplierSeed()), t = s.region.things.find(t => t.kind === 'supplier')!;
  assert.ok(t); s.x = t.x; s.z = t.z; return {s, t};
}
/** 先让第一任补给员认识玩家（名字 + 猫），确认记忆真的存进了聊天变量。 */
async function acquainted(o: {contextId?: string; storage?: ReturnType<typeof fakeStorage>; llm?: MemoryLLM} = {}) {
  const chat = fakeChat(), storage = o.storage ?? fakeStorage(), vectors = memoryVectorCache(), c = clock(T0);
  const mem = makeMemory({chat, storage, vectors, now: c.now, ...(o.contextId ? {contextId: o.contextId} : {}), ...(o.llm ? {llm: o.llm} : {})});
  const st = observed();
  encounter(mem, st, {run: 'run-1', thing: 'sup-1', depth: 3, at: T0, lines: ME, buys: [['红色药剂', 120]]});
  await mem.idle();
  assert.ok(remembersMe(storedMemory(chat).facts), '第一任记住了玩家');
  assert.equal(mem.greeting(), '嗯？阿青，想聊什么。');
  return {chat, storage, vectors, mem, st, c};
}

test('杀害（游戏规则→账本→记忆）：同步换成新一任，epoch+1、wipedBy=kill、记下杀害编号；聊天变量、对话会话、本聊天向量全部清空，别的聊天不受影响', async () => {
  const {chat, storage, vectors, mem} = await acquainted();
  const contextId = 'char-1:chat-A', other = 'char-1:chat-B';
  await vectors.put([[vectorKey(contextId, 1, 'm', '玩家的名字是阿青'), [1, 0]], [vectorKey(contextId, 1, 'm', '团子'), [0, 1]], [vectorKey(other, 1, 'm', '别的存档'), [1, 1]]]);

  const {s, t} = atSupplier();
  s.supplierTalks = {[t.id]: {thingId: t.id, serial: 1, log: [{role: 'supplier', text: '嗯？阿青。'}, {role: 'player', text: '再见了。'}], pending: true, grants: {relic: 0, item: 0, event: 0, loot: 0}, total: 2, memo: 0, mood: '平静'} as TalkSession};
  interact(s); supplierChoice(s, 'kill');
  const dead = s.supplierTalks[t.id]!;
  assert.deepEqual(dead.log, [], '杀害时对话记录当场清空'); assert.equal(dead.pending, false); assert.equal(dead.memo, dead.total, '没交给记忆的几行也不再交'); assert.equal(dead.mood, undefined);
  const entries = drainSupplierLedger(s), kill = entries.find(e => e.t === 'kill')!;
  assert.ok(kill, '杀害写进确定性账本'); assert.equal(kill.thing, t.id);

  mem.observe(s, entries);
  assert.equal(mem.epoch(), 2, 'observe 返回前就已经是第 2 任');
  assert.equal(mem.greeting(), NEW_FACE);
  assert.equal(JSON.parse(storage.getItem(tombstoneKey(contextId))!).epoch, 2, '本机墓碑同步写下');
  await mem.idle();

  const saved = storedMemory(chat);
  assert.equal(saved.epoch, 2); assert.equal(saved.wipedBy, 'kill'); assert.deepEqual(saved.kills, [kill.id]);
  assert.equal(remembersMe(saved), false, '聊天变量里不留上一任的任何事');
  for (const k of ['facts', 'episodes', 'reflections', 'digests', 'pending']) assert.deepEqual(saved[k], [], k + ' 已清空');
  assert.equal(saved.n, 0);
  assert.ok((saved.runs as {id: string}[]).every(r => r.id === s.run.id), '旧趟一条不留（新一任只从这趟远征开始记）');
  assert.equal(await vectors.size(contextId), 0, '这个聊天的向量（所有 epoch）整批删除');
  assert.equal(await vectors.size(other), 1, '别的聊天的向量不动');
  const view = mem.view(); assert.equal(view.epoch, 2); assert.equal(view.wipedBy, 'kill'); assert.deepEqual(view.facts, []); assert.equal(view.encounters, 0);

  // 同一个杀害事件重放（读档回退后账本又交了一次）不会再换一任。
  const writes = chat.writes;
  mem.observe(s, [kill]); await mem.idle();
  assert.equal(mem.epoch(), 2); assert.equal(chat.writes, writes, '重复的杀害编号不触发写入');
  assert.deepEqual(drainSupplierLedger(s), [], '账本只交一次');
  mem.dispose();
});

test('杀害后：楼层回退 / 读回旧存档点不会复活记忆；聊天被换回杀害前的旧文件时，本机墓碑让旧记忆作废并写回', async () => {
  // 与 mobile-items-timeline.test.ts 同款的假酒馆助手：聊天变量 + 楼层变量 + 楼层 extra（存档点）。
  let chat: any = {unrelated: {preserved: true}, booksea: {settings: {narrative: false}}};
  const messages: any[] = [{role: 'assistant', message: 'earlier', data: {gold: 10}, extra: {}}, {role: 'assistant', message: 'current', data: {gold: 10}, extra: {}}];
  const storage = fakeStorage();
  const h: any = {
    getLastMessageId: () => messages.length - 1,
    getChatMessages: (id: any) => {if (typeof id === 'number') {const i = id === -1 ? messages.length - 1 : id; return messages[i] ? [{...structuredClone(messages[i]), message_id: i}] : [];} return messages.map((m, i) => ({...structuredClone(m), message_id: i}));},
    getVariables: (o: any) => structuredClone(o.type === 'chat' ? chat : messages[o.message_id ?? messages.length - 1]?.data ?? {}),
    updateVariablesWith: async (fn: any, o: any) => {if (o.type === 'chat') chat = fn(structuredClone(chat)); else {const id = o.message_id ?? messages.length - 1; messages[id].data = fn(structuredClone(messages[id].data));}},
    createChatMessages: async (rows: any[]) => {for (const row of rows) messages.push({...row, data: structuredClone(row.data ?? messages.at(-1).data), extra: structuredClone(row.extra ?? {})});},
  };
  let saves = 0;
  const globals: any = {TavernHelper: h, localStorage: storage, SillyTavern: {getContext: () => ({characterId: 'test', getCurrentChatId: () => 'chat', chat: messages, saveChat: async () => {saves++;}})}};
  const timeline = createMessageTimeline(globals);
  const memoryOf = () => rec(rec(chat.booksea).supplierMemory);
  const open = () => createSupplierMemory(hostMemoryPort(globals));
  withSettings(storage, s => {s.extraction.mode = 'off';});

  await timeline.prepare();
  const s = startExpedition(playtestParty(), 741); s.source = 'host'; s.hostContext = 'test:chat'; s.hostSave = timeline.stamp();
  const save = async () => {s.hostSave = await timeline.commit({gold: 10}, v => ({...v, booksea: {...(v.booksea as any), activeExpedition: s, unlockedIds: s.run.unlocks}}), s.hostSave);};
  await save();

  const mem = open(), st = observed();
  encounter(mem, st, {run: 'run-1', thing: 'sup-1', depth: 2, at: T0, lines: ME});
  await mem.idle();
  assert.ok(remembersMe(memoryOf().facts), '记忆写进了聊天变量 booksea.supplierMemory');
  assert.ok(saves > 0, '写入后保存聊天');
  const beforeKill = structuredClone(chat);

  // 在第二个楼层再存一次档：存档点里只有进度字段，不含记忆。
  await h.createChatMessages([{role: 'assistant', message: 'later'}]); await timeline.prepare(); s.hostSave = timeline.stamp(); s.depth = 7; await save();
  assert.equal(remembersMe(messages.map(m => [m.data, m.extra])), false, '楼层变量/存档点从不携带补给员记忆');
  assert.ok(remembersMe(memoryOf()), '存档后记忆还在聊天变量里');

  mem.observe(st, [killEntry({run: 'run-1', thing: 'sup-1', depth: 7, at: T0 + 1000})]);
  await mem.idle();
  assert.equal(memoryOf().epoch, 2); assert.equal(remembersMe(memoryOf()), false);

  // 删掉最新楼层 → 回到杀害之前的存档点：进度回退，记忆不回退。
  messages.pop(); await timeline.prepare();
  assert.equal((timeline.chat().booksea as any).activeExpedition.depth, 1, '确实回到了旧存档点');
  assert.equal(memoryOf().epoch, 2, '回退楼层不会把记忆带回杀害之前'); assert.equal(remembersMe(chat), false);
  await timeline.updateChat(v => ({...v, booksea: {...(v.booksea as any), settings: {narrative: true}}}));
  assert.equal(memoryOf().epoch, 2, '之后整份写回聊天变量也保留新一任的记忆'); assert.deepEqual(chat.unrelated, {preserved: true});

  const reopened = open(); await reopened.idle();
  assert.equal(reopened.epoch(), 2); assert.deepEqual(reopened.view().facts, []); assert.equal(reopened.greeting(), NEW_FACE);
  reopened.dispose();

  // 聊天文件被换回杀害之前的副本：聊天变量里又是第 1 任，但这台设备记得她已经被杀了。
  chat = beforeKill;
  assert.ok(remembersMe(memoryOf()));
  const restored = open(); await restored.idle();
  assert.equal(restored.status().load, 'repaired'); assert.equal(restored.epoch(), 2); assert.equal(restored.view().wipedBy, 'kill');
  assert.deepEqual(restored.view().facts, []); assert.equal(restored.greeting(), NEW_FACE);
  assert.equal(memoryOf().epoch, 2, '修复结果写回聊天'); assert.equal(remembersMe(memoryOf()), false);
  restored.dispose(); mem.dispose();
});

test('杀害是先写墓碑再写聊天：聊天写入失败（或页面马上关掉）时，下次打开照样是新一任', async () => {
  const {chat, storage, mem} = await acquainted();
  chat.failWrites = 99;
  const pending = mem.wipe('kill', 'K-close');
  assert.equal(mem.epoch(), 2, 'wipe 一调用 epoch 就换了');
  assert.deepEqual(JSON.parse(storage.getItem(tombstoneKey('char-1:chat-A'))!).reason, 'kill');
  await pending;
  assert.equal(storedMemory(chat).epoch, 1, '聊天变量还没写进去'); assert.ok(remembersMe(storedMemory(chat)));
  mem.dispose();
  chat.failWrites = 0;
  const next = makeMemory({chat, storage}); await next.idle();
  assert.equal(next.epoch(), 2); assert.equal(next.view().wipedBy, 'kill'); assert.deepEqual(next.view().facts, []);
  assert.equal(storedMemory(chat).epoch, 2); assert.equal(remembersMe(storedMemory(chat)), false);
  next.dispose();
  // 墓碑按聊天隔离：同一设备上别的聊天的补给员不受影响。
  const elsewhere = await acquainted({contextId: 'char-1:chat-B', storage});
  assert.equal(elsewhere.mem.epoch(), 1); elsewhere.mem.dispose();
});

test('手动清空 vs 杀害：wipedBy 决定新一任怎么说前任；开场白变成“新面孔”；连续清空 epoch 递增', async () => {
  const {chat, storage, mem} = await acquainted();
  await mem.wipe('manual'); await mem.idle();
  assert.equal(mem.epoch(), 2); assert.equal(mem.view().wipedBy, 'manual'); assert.equal(storedMemory(chat).wipedBy, 'manual');
  assert.equal(JSON.parse(storage.getItem(tombstoneKey('char-1:chat-A'))!).reason, 'manual');
  assert.deepEqual(storedMemory(chat).kills, [], '手动清空不记杀害编号');
  assert.equal(mem.greeting(), NEW_FACE);
  let section = (await mem.section('你还记得我叫什么吗')).text;
  assert.match(section, /第 2 任补给员。前任的记忆被清空了/); assert.doesNotMatch(section, /杀害/); assert.equal(remembersMe(section), false);
  assert.match(section, /从你上任到现在，你们还没见过面/);

  mem.observe(observed(), [killEntry({run: 'run-2', thing: 'sup-2', depth: 4, at: T0 + 5000})]);
  await mem.idle();
  assert.equal(mem.epoch(), 3); assert.equal(mem.view().wipedBy, 'kill');
  section = (await mem.section('你还记得我叫什么吗')).text;
  assert.match(section, /第 3 任补给员。前任被玩家杀害了，她的记忆没有留下来/);

  // 新一任认识玩家以后，开场白跟着新的记忆走，不会冒出前任知道的名字。
  encounter(mem, observed(), {run: 'run-2', thing: 'sup-3', depth: 5, at: T0 + 9000, lines: [['player', '我叫小林。']]});
  await mem.idle();
  assert.equal(mem.greeting(), '嗯？小林，想聊什么。'); assert.equal(remembersMe(storedMemory(chat)), false);
  mem.dispose();
});

test('杀害发生时正在整理的上一任对话：整理结果回来也直接丢掉，不会写进新一任', async () => {
  let release!: (raw: string) => void, started!: () => void;
  const calling = new Promise<void>(r => {started = r;});
  const answer = JSON.stringify({memories: [{op: 'add', kind: 'identity', slot: 'name', value: '阿青', text: '玩家的名字是阿青', source: 'player', quote: '我叫阿青', importance: 8}]});
  const llm: MemoryLLM = (system, user) => system.includes('只输出一个 JSON：{"ok":true}') ? scriptedLLM([])(system, user, {timeoutMs: 1}) : new Promise<string>(r => {release = r; started();});
  const chat = fakeChat(), storage = fakeStorage(), mem = makeMemory({chat, storage, llm});
  const st = observed();
  encounter(mem, st, {run: 'run-1', thing: 'sup-1', depth: 3, at: T0, lines: [['player', '你好，我叫阿青。']]});
  await calling;
  mem.observe(st, [killEntry({run: 'run-1', thing: 'sup-1', depth: 3, at: T0 + 1})]);
  assert.equal(mem.epoch(), 2);
  release(answer);
  await mem.idle();
  assert.equal(storedMemory(chat).epoch, 2); assert.equal(remembersMe(storedMemory(chat)), false, '上一任的整理结果被丢弃');
  assert.deepEqual(storedMemory(chat).pending, []); assert.deepEqual(mem.view().facts, []);
  mem.dispose();
});

test('读回杀害之前的旅程存档：上一任的对话会话按 epoch 作废，新一任用新面孔开场', () => {
  const {s, t} = atSupplier();
  s.supplierTalkReady = true; s.supplierMemoryEpoch = 2; s.supplierGreeting = NEW_FACE;
  s.supplierTalks = {[t.id]: {thingId: t.id, serial: 3, log: [{role: 'supplier', text: '嗯？阿青。'}, {role: 'player', text: '我养了一只猫，叫团子。'}], pending: true, grants: {relic: 1, item: 0, event: 0, loot: 0}, epoch: 1, total: 2, memo: 2, mood: '开心'} as TalkSession};
  interact(s); supplierChoice(s, 'talk');
  const talk = s.supplierTalks[t.id]!;
  assert.equal(talk.epoch, 2); assert.equal(talk.pending, false); assert.equal(talk.mood, undefined);
  assert.deepEqual(talk.log, [{role: 'supplier', text: NEW_FACE}], '旧对话不再出现，只剩新一任的开场白');
  assert.equal(remembersMe(talk), false);
  assert.deepEqual(talk.grants, {relic: 1, item: 0, event: 0, loot: 0}, '本次遭遇已用掉的额度保留');
});
