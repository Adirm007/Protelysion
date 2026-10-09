import test from 'node:test';
import assert from 'node:assert/strict';
import { actorAt, actorKey, eligibility, validateTeam, type Obj } from '../src/core/actors';
import { canonical, combatProjection, compileOnUserAction, inspectCache, assertEntry, type CompilationEngine } from '../src/core/cache';
import { chatCacheStore } from '../src/host/chat-cache';
import { fixture, player, partner } from './fixtures';
function setup() {
  let mvu = fixture(), variables: Obj = { other: { keep: 1 }, booksea: { progression: [5], appearance: { custom: 'keep' } } };
  const store = chatCacheStore({ getVariables: () => structuredClone(variables), updateVariablesWith: fn => variables = fn(variables) });
  const engine: CompilationEngine = { async compile(source) { return { actor: { syntheticTestOnly: true, level: source.等级 }, notes: ['仅用于单元测试'] }; }, validate(value) { assert.equal((value as Obj).syntheticTestOnly, true); } };
  return { mvu, store, engine, read: async () => mvu, getVariables: () => variables };
}
for (const [affinity, contract, expected] of [[69, true, false], [70, true, true], [100, false, false], [100, true, true]] as const) {
  test(`伙伴门槛 affinity=${affinity}, contract=${contract}`, () => {
    const m = fixture(), a = actorAt(m, partner()); a.好感度 = affinity; a.命定契约 = contract;
    assert.equal(eligibility(m, partner()).allowed, expected);
  });
}
test('允许全四伙伴、超过主角、不在场；拒绝空队、五人、重复人', () => {
  const m = fixture(), team = ['甲', '乙', '丙', '丁'].map(n => partner(`测试伙伴${n}`));
  assert.doesNotThrow(() => validateTeam(m, team));
  for (const t of [[], [...team, player], [player, player]]) assert.throws(() => validateTeam(m, t));
});
test('姓名含点或原型属性不被路径解析或自动补人', () => {
  const m = fixture(), stat = m.stat_data as Obj, relationships = stat.关系列表 as Obj;
  relationships['甲.乙'] = structuredClone(actorAt(m, player));
  assert.equal(eligibility(m, partner('甲.乙')).allowed, true);
  assert.equal(eligibility(m, partner('__proto__')).allowed, false);
  assert.equal(eligibility(m, partner('不存在')).allowed, false);
});
test('缺少五维或资源报错，不注入模板', () => {
  const m = fixture(); delete actorAt(m, player).属性;
  assert.equal(eligibility(m, player).allowed, false);
});
test('canonical 对象键序不影响结果，数组顺序保留', () => {
  assert.equal(canonical({ a: 1, b: 2 }), canonical({ b: 2, a: 1 }));
  assert.notEqual(canonical([1, 2]), canonical([2, 1]));
  assert.throws(() => canonical({ invalid: NaN }));
});
test('首次编译成功自动保存；同聊天重新建store可读', async () => {
  const x = setup(); const cache = await compileOnUserAction(player, x.read, x.store, x.engine);
  assert.equal(inspectCache(cache, actorAt(x.mvu, player), player).status, 'ready');
  assert.deepEqual(await x.store.read(actorKey(player)), cache);
  await assertEntry(x.mvu, [player], x.store, x.engine);
});
for (const field of ['好感度', '头像', '当前资源', '库存', '状态层数', '状态时长', '标签顺序', '隐藏']) {
  test(`动态或显示变化不使缓存失效：${field}`, async () => {
    const x = setup(); const cache = await compileOnUserAction(player, x.read, x.store, x.engine), a = actorAt(x.mvu, player);
    if (field === '好感度') a.好感度 = 69;
    if (field === '头像') a.头像 = 'local-only';
    if (field === '当前资源') (a.生命值 as Obj).当前 = 1;
    if (field === '库存') ((a.背包 as Obj).测试药剂 as Obj).数量 = 1;
    if (field === '状态层数') ((a.状态效果 as Obj).原有伤势 as Obj).层数 = 4;
    if (field === '状态时长') ((a.状态效果 as Obj).原有伤势 as Obj).剩余时间 = '30分钟';
    if (field === '标签顺序') (((a.技能 as Obj).测试技能 as Obj).标签 as string[]).reverse();
    if (field === '隐藏') ((a.技能 as Obj).测试技能 as Obj)._隐藏 = true;
    assert.equal(inspectCache(cache, a, player).status, 'ready');
  });
}
for (const field of ['等级', '属性', '上限', '技能', '装备', '状态效果']) {
  test(`战斗配置改变禁止入场：${field}`, async () => {
    const x = setup(), cache = await compileOnUserAction(player, x.read, x.store, x.engine), a = actorAt(x.mvu, player);
    if (field === '等级') a.等级 = 2;
    if (field === '属性') (a.属性 as Obj).力量 = 11;
    if (field === '上限') ((a.生命值 as Obj).上限 as Obj).额外 = 10;
    if (field === '技能') ((a.技能 as Obj).测试技能 as Obj).描述 = '新的效果';
    if (field === '装备') (a.装备 as Obj).新武器 = { 位置: '左手', 效果: '新效果' };
    if (field === '状态效果') (a.状态效果 as Obj).未知 = { 效果: '未知效果', 层数: 1 };
    assert.equal(inspectCache(cache, a, player).status, 'stale');
    await assert.rejects(assertEntry(x.mvu, [player], x.store, x.engine), /不可入场/);
  });
}
test('已知状态移除不重编；同名效果定义变更重编', async () => {
  const x = setup(), cache = await compileOnUserAction(player, x.read, x.store, x.engine), a = actorAt(x.mvu, player);
  delete (a.状态效果 as Obj).原有伤势;
  assert.equal(inspectCache(cache, a, player).status, 'ready');
  (a.状态效果 as Obj).原有伤势 = { 类型: '减益', 效果: '不同定义', 层数: 1, 剩余时间: '1小时', 来源: '宿主' };
  assert.equal(inspectCache(cache, a, player).status, 'stale');
});
test('伙伴资格降低不删缓存，但最终资格复查阻止入场', async () => {
  const x = setup(), ref = partner(), cache = await compileOnUserAction(ref, x.read, x.store, x.engine);
  actorAt(x.mvu, ref).好感度 = 69;
  assert.equal(inspectCache(cache, actorAt(x.mvu, ref), ref).status, 'ready');
  await assert.rejects(assertEntry(x.mvu, [ref], x.store, x.engine), /70/);
  assert.ok(await x.store.read(actorKey(ref)));
});
test('格式升级单独提示，不伪装字段变更', async () => {
  const x = setup(), cache = await compileOnUserAction(player, x.read, x.store, x.engine);
  cache.effectSchemaVersion = 'future';
  assert.equal(inspectCache(cache, actorAt(x.mvu, player), player).status, 'incompatible');
});
test('编译失败保留旧卡且过期；没有默认替补', async () => {
  const x = setup(), old = await compileOnUserAction(player, x.read, x.store, x.engine);
  actorAt(x.mvu, player).等级 = 2;
  x.engine.compile = async () => { throw new Error('unsupported ability'); };
  await assert.rejects(compileOnUserAction(player, x.read, x.store, x.engine));
  assert.deepEqual(await x.store.read(actorKey(player)), old);
  assert.equal(inspectCache(old, actorAt(x.mvu, player), player).status, 'stale');
});
test('编译期间字段变化不保存新卡', async () => {
  const x = setup(); x.engine.compile = async source => { actorAt(x.mvu, player).等级 = 2; return { actor: { syntheticTestOnly: true }, notes: [] }; };
  await assert.rejects(compileOnUserAction(player, x.read, x.store, x.engine), /编译期间/);
  assert.equal(await x.store.read(actorKey(player)), undefined);
});
test('执行器拒绝非法输出，不保存缓存', async () => {
  const x = setup(); x.engine.validate = () => { throw new Error('未实现效果'); };
  await assert.rejects(compileOnUserAction(player, x.read, x.store, x.engine));
  assert.equal(await x.store.read(actorKey(player)), undefined);
});
test('删除只影响对应缓存，保留外观/进度/其他聊天数据', async () => {
  const x = setup(); await compileOnUserAction(player, x.read, x.store, x.engine);
  await x.store.remove(actorKey(player));
  assert.equal(await x.store.read(actorKey(player)), undefined);
  assert.deepEqual((x.getVariables().booksea as Obj).appearance, { custom: 'keep' });
  assert.deepEqual(x.getVariables().other, { keep: 1 });
});
test('投影包含道具定义但不含剧情和当前库存数量', () => {
  const m = fixture(), a = actorAt(m, player); a.心里话 = 'secret';
  assert.doesNotMatch(canonical(combatProjection(a)), /secret|当前|数量/);
});

test('不同聊天的缓存存储不混用', async () => {
  const a = setup(), b = setup();
  await compileOnUserAction(player, a.read, a.store, a.engine);
  assert.equal(await b.store.read(actorKey(player)), undefined);
});
