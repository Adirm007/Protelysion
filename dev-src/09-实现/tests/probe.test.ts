import test from 'node:test';
import assert from 'node:assert/strict';
import { probeReadOnly, probeChatRoundTrip, probeModel, sendProbeMessage, summarizeMvu, withTimeout, type HostApi } from '../src/host/probe';
import type { Obj } from '../src/core/actors';
import { fixture } from './fixtures';
test('普通浏览器不伪报宿主可用', async () => {
  const { report, mvu } = await probeReadOnly({});
  assert.equal(mvu, undefined); assert.equal(report.liveAcceptance, 'pending');
  assert.ok(report.checks.some(c => c.id === 'read-mvu' && c.status === 'fail'));
});
test('只读探测无写入/模型/消息；报告不含个人原文', async () => {
  const m = fixture(); let writes = 0;
  const api: HostApi = { getVariables: () => m, getLastMessageId: () => 42, waitGlobalInitialized: async () => {},
    updateVariablesWith: () => { writes++; return {}; }, generateRaw: async () => { writes++; }, createChatMessages: async () => { writes++; } };
  const { report, mvu } = await probeReadOnly(api);
  assert.equal(writes, 0); assert.notEqual(mvu, m); assert.equal(report.counts?.actors, 5);
  assert.doesNotMatch(JSON.stringify(report), /测试伙伴|测试药剂|不应改变|累计经验/);
  assert.equal(report.liveAcceptance, 'pending'); assert.equal(report.hostMutationEnabled, false);
});
test('聊天写读清理只触碰唯一探测键，保留其他数据', async () => {
  const original: Obj = { booksea: { actorCache: {} }, unrelated: 1 }; let variables = structuredClone(original), count = 0;
  await probeChatRoundTrip({ getVariables: () => structuredClone(variables), updateVariablesWith: (fn, option) => { assert.equal(option.type, 'chat'); count++; return variables = fn(variables); } }, 'unique');
  assert.equal(count, 2); assert.deepEqual(variables, original);
});
test('探测键冲突不覆盖', async () => {
  let writes = 0;
  await assert.rejects(probeChatRoundTrip({ getVariables: () => ({ bookseaStage0Probe_unique: 'existing' }), updateVariablesWith: () => { writes++; return {}; } }, 'unique'), /冲突/);
  assert.equal(writes, 0);
});
test('独立模型请求不携带MVU/聊天/世界书且使用真实schema字段', async () => {
  await probeModel({ generateRaw: async config => {
    assert.equal(config.max_chat_history, 0); assert.equal(config.tools, undefined); assert.equal((config.json_schema as Obj).strict, true);
    assert.doesNotMatch(JSON.stringify(config), /测试伙伴|world_info|chat_history"\]/);
    return '{"booksea_probe":"ok"}';
  } });
});
test('模型非JSON或不符合合同明确失败，不生成默认角色', async () => {
  for (const value of ['not-json', '{"booksea_probe":"no"}', '{"booksea_probe":"ok","extra":1}', {}]) await assert.rejects(probeModel({ generateRaw: async () => value }));
});
test('用户消息正确使用message字段，不触发生成', async () => {
  let calls = 0;
  await sendProbeMessage({ createChatMessages: async messages => { calls++; assert.equal(messages[0]!.role, 'user'); assert.match(messages[0]!.message, /接口验证/); assert.equal((messages[0] as unknown as Obj).content, undefined); }, triggerSlash: async () => { throw new Error('不应触发'); } });
  assert.equal(calls, 1);
});
test('超时可终止等待并调用取消，不无限挂起', async () => {
  let cancelled = false;
  await assert.rejects(withTimeout(new Promise(() => {}), 10, () => cancelled = true), /超时/);
  assert.equal(cancelled, true);
});
test('不把世界书/其他JSON误认为MVU', () => {
  assert.throws(() => summarizeMvu({ entries: [] }));
});
