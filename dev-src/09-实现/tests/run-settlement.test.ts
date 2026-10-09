import test from 'node:test';
import assert from 'node:assert/strict';
import { actorAt, actorKey, RESOURCES, resourceMax, type Obj } from '../src/core/actors';
import { battleExperience, type EnemyReward } from '../src/core/experience';
import { addReward, awardVictory, exitMembers, newRun, settlementProposal } from '../src/core/run';
import { consumeItem, hostReward, redeemVoucher, restoreDeparture } from '../src/core/settlement';
import { fixture, player, partner } from './fixtures';
const enemy = (id: string, level = 2, species = '测试敌人'): EnemyReward => ({ instanceId: id, species, level, role: 'normal', rewardEligible: true });
test('三只Lv2同类=28；同类衰减仅应用一次', () => assert.equal(battleExperience(1, ['1','2','3'].map(id => enemy(id))), 28));
test('每人独立上限与层级衰减；Lv25无经验', () => {
  const enemies = [enemy('1', 10)];
  assert.equal(battleExperience(1, enemies), 100); assert.equal(battleExperience(5, enemies), 500);
  assert.equal(battleExperience(17, enemies), 0); assert.equal(battleExperience(25, enemies), 0);
});
test('超25敌人按实际等级×600，再应用本场上限', () => {
  assert.equal(battleExperience(21, [enemy('1', 30)]), 18000);
  assert.equal(battleExperience(1, [enemy('1', 30)]), 100);
  assert.equal(battleExperience(21, [enemy('1', 100)]), 50000);
});
test('分组按物种+等级+定位；召唤物明确不奖励', () => {
  assert.equal(battleExperience(5, [enemy('1', 2), enemy('2', 3)]), 50);
  assert.equal(battleExperience(5, [enemy('1'), { ...enemy('2'), role: 'elite' }]), 40);
  assert.equal(battleExperience(5, [{ ...enemy('1'), rewardEligible: false }]), 0);
});
test('重复实例拒绝；新区域同种新实例正常奖励', () => {
  assert.throws(() => battleExperience(1, [enemy('1'), enemy('1')]));
  let run = newRun('run', fixture(), [player]);
  run = awardVictory(run, 'b1', [actorKey(player)], [enemy('region1:e')]);
  run = awardVictory(run, 'b2', [actorKey(player)], [enemy('region2:e')]);
  assert.equal(run.participants[0]!.experience, 40);
  assert.throws(() => awardVictory(run, 'b3', [actorKey(player)], [enemy('region2:e')]));
});
test('十场各100=1000，不在整趟再次截100', () => {
  let r = newRun('run', fixture(), [player]);
  for (let i = 0; i < 10; i++) r = awardVictory(r, `b${i}`, [actorKey(player)], [enemy(`e${i}`, 10)]);
  assert.equal(r.participants[0]!.experience, 1000);
});
test('提前主动退场冻结E1，其余人继续E2，所有人退出前不发', () => {
  let r = newRun('run', fixture(), [player, partner()]);
  r = awardVictory(r, 'b1', [actorKey(player), actorKey(partner())], [enemy('e1')]);
  r = exitMembers(r, [{ ref: player, reason: 'voluntaryExit' }]);
  assert.throws(() => settlementProposal(r));
  r = awardVictory(r, 'b2', [actorKey(partner())], [enemy('e2')]);
  r = exitMembers(r, [{ ref: partner(), reason: 'voluntaryExit' }]);
  const p = settlementProposal(r); assert.deepEqual(p.experience.map(x => x.amount), [20, 40]); assert.equal(p.committed, false);
});
test('倒地退场个人全部清零，主角倒地不让其余队员失败', () => {
  let r = newRun('run', fixture(), [player, partner()]);
  r = awardVictory(r, 'b1', [actorKey(player), actorKey(partner())], [enemy('e1')]);
  r = exitMembers(r, [{ ref: player, reason: 'downedExit' }]);
  assert.equal(r.status, 'active'); assert.equal(r.participants[0]!.experience, 0);
  r = exitMembers(r, [{ ref: partner(), reason: 'voluntaryExit' }]);
  assert.equal(r.status, 'success'); assert.equal(r.failureSignal, null);
});
test('最后成员倒地，提前主动退场者新收益也清零，解锁保留', () => {
  let r = newRun('run', fixture(), [player, partner()]); r.unlocks.push('anchor:5');
  r = addReward(r, { kind: 'voucher', faceValue: 100, count: 1, source: 'region' });
  r = awardVictory(r, 'b1', [actorKey(player), actorKey(partner())], [enemy('e1')]);
  r = exitMembers(r, [{ ref: player, reason: 'voluntaryExit' }]);
  r = exitMembers(r, [{ ref: partner(), reason: 'downedExit' }]);
  assert.equal(r.status, 'failed'); assert.deepEqual(r.participants.map(p => p.experience), [0,0]);
  assert.deepEqual(r.rewards, []); assert.deepEqual(r.unlocks, ['anchor:5']);
  assert.deepEqual(r.failureSignal?.voluntary, [player]); assert.deepEqual(r.failureSignal?.downed, [partner()]);
  assert.throws(() => exitMembers(r, [{ ref: partner(), reason: 'downedExit' }]));
});
test('全伙伴队失败不创造主角参战/死亡；宿主数据不变化', () => {
  const m = fixture(), before = JSON.stringify(m);
  let r = newRun('run', m, [partner(), partner('测试伙伴乙')]);
  r = exitMembers(r, r.participants.map(p => ({ ref: p.ref, reason: 'downedExit' })));
  assert.equal(r.failureSignal!.downed.length, 2); assert.ok(r.failureSignal!.downed.every(p => p.kind === 'partner'));
  assert.equal(JSON.stringify(m), before);
});
test('退出成员不得再次参战或退出；战斗中不允许直接撤离', () => {
  let r = newRun('run', fixture(), [player, partner()]); r.battleActive = true;
  assert.throws(() => exitMembers(r, [{ ref: player, reason: 'voluntaryExit' }]));
  r.battleActive = false; r = exitMembers(r, [{ ref: player, reason: 'voluntaryExit' }]);
  assert.throws(() => awardVictory(r, 'b1', [actorKey(player)], [enemy('1')]));
  assert.throws(() => exitMembers(r, [{ ref: player, reason: 'voluntaryExit' }]));
});
test('辅助角色按实际参战，不要求造成伤害；未参战者不加经验', () => {
  let r = newRun('run', fixture(), [player, partner()]);
  r = awardVictory(r, 'b1', [actorKey(partner())], [enemy('1')]);
  assert.deepEqual(r.participants.map(p => p.experience), [0,20]);
});
test('三资源按宿主有效上限全满，保留非书海状态与库存', () => {
  const m = fixture(), a = actorAt(m, player);
  (a.状态效果 as Obj).书海伤势 = { 来源: '书海', 效果: '伤势' };
  const next = restoreDeparture(m, player, ['原有伤势', '书海伤势']);
  const restored = actorAt(next, player);
  for (const resource of RESOURCES) assert.equal((restored[resource] as Obj).当前, resourceMax(restored, resource));
  assert.ok((restored.状态效果 as Obj).原有伤势); assert.equal((restored.状态效果 as Obj).书海伤势, undefined);
  assert.deepEqual(restored.背包, a.背包); assert.equal((a.生命值 as Obj).当前, 30);
});
test('宿主物品从对应主人扣除，数量零移除，退出不返还', () => {
  let m = consumeItem(fixture(), partner(), '测试药剂', 3);
  assert.equal((actorAt(m, partner()).背包 as Obj).测试药剂, undefined);
  assert.equal(((actorAt(m, player).背包 as Obj).测试药剂 as Obj).数量, 3);
  m = restoreDeparture(m, partner()); assert.equal((actorAt(m, partner()).背包 as Obj).测试药剂, undefined);
  assert.throws(() => consumeItem(m, player, '测试药剂', 4));
});
test('盲盒只生成完整背包字段，不生成盒内技能或资产', () => {
  const reward = hostReward({ kind: 'box', quality: '神话', style: '科幻', contentType: '技能', count: 1, source: '轨道失落' });
  assert.equal(reward.name, '神话·科幻·技能盲盒'); assert.ok((reward.item.标签 as string[]).includes('未开启'));
  assert.deepEqual(Object.keys(reward.item).sort(), ['品质','类型','数量','标签','效果','描述'].sort());
});
test('兑换只读已有主角背包券，扣券增FP且保留其他数据', () => {
  const m = fixture(), a = actorAt(m, player), reward = hostReward({ kind: 'voucher', faceValue: 100, count: 2, source: '测试' });
  (a.背包 as Obj)[reward.name] = reward.item;
  const next = redeemVoucher(m, reward.name, 1);
  assert.equal((next.stat_data as Obj).命运点数, 200);
  assert.equal(((actorAt(next, player).背包 as Obj)[reward.name] as Obj).数量, 1);
  assert.equal((m.stat_data as Obj).命运点数, 100); assert.deepEqual(next.date, m.date);
  assert.throws(() => redeemVoucher(m, reward.name, 3));
  assert.throws(() => redeemVoucher(m, '测试药剂', 1));
});
test('负数/NaN/零/分数操作拒绝', () => {
  for (const n of [-1, NaN, 0, 0.5]) assert.throws(() => consumeItem(fixture(), player, '测试药剂', n));
});
