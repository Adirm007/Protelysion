import test from 'node:test';
import assert from 'node:assert/strict';
import {hostReward} from '../src/core/settlement';
import {avatarKey, resolveAvatar, safeAvatarUrl, readAvatarRecords} from '../src/host/avatars';
import {startExpedition, interact, tickExploration, move, view, chooseSkill, chooseTarget, tick} from '../src/game/expedition';
import {playtestParty, strike} from '../src/game/content';
import {groupActions, resolvedBattleCue, nextActionIndex, actionPreviewText, actionUnavailableText} from '../src/presentation/battle-cues';
import {mountExpeditionRuntime} from '../src/game/runtime';

for (const count of [1, 4]) test(`盲盒只说明开启结果，堆叠${count}盒仍每盒一个产物`, () => {
  const reward = hostReward({kind: 'box', quality: '稀有', style: '轨道失落', contentType: '消耗品', count, source: '第20层宝箱'});
  assert.equal(reward.name, '稀有·轨道失落·消耗品盲盒');
  assert.equal((reward.item.效果 as Record<string,string>).待开启, '打开后获得轨道失落主题随机稀有消耗品*1。');
  assert.equal(reward.item.数量, count); assert.ok((reward.item.标签 as string[]).includes('未开启'));
  assert.doesNotMatch(JSON.stringify(reward.item.效果), /正文|裁定|本次|生成产物/);
});
test('空地交互打开菜单，并冻结巡逻与规则时间', () => {
  const s = startExpedition(playtestParty(), 22341); s.region.things = [];
  interact(s); assert.equal(s.paused, true); const before = JSON.stringify(s);
  tickExploration(s, 30000); move(s, 1, 0); assert.equal(JSON.stringify(s), before);
});
test('角色头像键完全匹配状态栏，伙伴不会读取主角头像', () => {
  assert.equal(avatarKey('命定之诗', {kind: 'player'}), 'status:命定之诗::player::主角');
  assert.equal(avatarKey('命定之诗', {kind: 'partner', name: '福尔摩斯探案集'}), 'status:命定之诗::partner::福尔摩斯探案集');
  assert.notEqual(avatarKey('另一角色', {kind: 'player'}), avatarKey('命定之诗', {kind: 'player'}));
});
test('上传头像优先，删除标记不会被默认头像复活', () => {
  const png = 'data:image/png;base64,iVBORw0KGgo=';
  assert.equal(resolveAvatar({source_type: 'upload', value: png}, 'https://example.test/default.png', 'https://tavern.test/'), png);
  assert.equal(resolveAvatar({source_type: 'removed', value: ''}, 'https://example.test/default.png', 'https://tavern.test/'), '');
  assert.equal(resolveAvatar(undefined, '/User Avatars/a.png', 'https://tavern.test/chat'), 'https://tavern.test/User%20Avatars/a.png');
});
for (const value of ['javascript:alert(1)', 'file:///secret.png', 'data:text/html,hello', 'data:image/svg+xml,<svg/>', '{{userAvatarPath}}']) test('头像URL拒绝非图片脚本或未展开宏：' + value, () => {
  assert.equal(safeAvatarUrl(value, 'https://tavern.test/'), '');
});
test('头像存储不可用时安全返回，不影响角色与存档', async () => {
  assert.deepEqual(await readAvatarRecords(undefined, ['one']), new Map());
  assert.deepEqual(await readAvatarRecords({open(){throw Error('denied');}} as unknown as IDBFactory, ['one']), new Map());
});
function encounter() {
  const s = startExpedition(playtestParty(), 22342), enemy = s.region.things.find(t => t.kind === 'enemy')!;
  enemy.foes = ['T01_N01']; s.x = enemy.x - 1; s.z = enemy.z; move(s, 1, 0);
  const b = s.battle!, u = b.units.find(u => u.side === 'ally')!;
  b.clock.pending = [{kind: 'ready', unitId: u.id}];
  return {s, b, u};
}
test('技能、物品分类独立；旧存档分类不隐藏主菜单的其他指令', () => {
  const {s} = encounter(); s.actionCategory = 'item'; const v = view(s);
  const item = v.battle.allActions.find(a => a.id === '恢复药')!;
  assert.equal(item.category, 'item'); assert.equal(item.itemCount, s.potions);
  assert.ok(v.battle.allActions.length > v.battle.actions.length);
  assert.ok(groupActions(v.battle.allActions, 'item').every(a => a.category === 'item'));
  assert.ok(groupActions(v.battle.allActions, 'skill').every(a => ['spell', 'skill'].includes(a.category)));
  assert.equal(v.battle.units.find(u => u.id === 'enemy-0')!.artId, 'T01_N01');
});
test('结算前捕获最后一击，演出读取实际伤害且不会再次支付或结算', () => {
  const {s, b, u} = encounter(), action = strike(100000); action.name = '终页斩';
  const effect = action.effects[0]!; if (effect.op === 'damage') {effect.hitChance = 1; effect.critChance = 0;}
  u.actions.finisher = action; const enemy = b.units.find(u => u.side === 'enemy')!; enemy.current.hp = 1;
  chooseSkill(s, 'finisher'); chooseTarget(s, enemy.id);
  let calls = 0;
  tick(s, 50, (before, after) => {
    calls++; const copy = JSON.stringify(after), v = view(s), cue = resolvedBattleCue(before, after, v);
    assert.equal(v.mode, 'battle'); assert.equal(cue.name, '终页斩'); assert.equal(cue.actorId, u.id);
    assert.equal(cue.changes.find(c => c.id === enemy.id)?.amount, -1);
    assert.equal(cue.changes.find(c => c.id === enemy.id)?.down, true);
    assert.equal(JSON.stringify(after), copy, 'presentation is read-only');
  });
  assert.equal(calls, 1); assert.equal(s.mode, 'explore'); assert.equal(s.fights, 1);
});
test('暂停菜单的单次战外操作可用，执行完仍暂停且不会推进巡逻', () => {
  const s = startExpedition(playtestParty(), 22343); s.paused = true;
  const storage = new Map<string,string>();
  const win = {localStorage:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v)},setInterval:()=>1,clearInterval(){},document:{hidden:false,addEventListener(){},removeEventListener(){}},addEventListener(){},removeEventListener(){}} as unknown as Window;
  const runtime = mountExpeditionRuntime({storageKey:'isolated',initial:s,audio:false},win); runtime.attach(raw=>{const v=JSON.parse(raw);runtime.rendered(v.mode,v.region.id);});
  const before=s.explorationMs; runtime.input({type:'outsideSkill',payload:{actor:s.party[1]!.id,id:'疗愈',targets:[s.party[0]!.id]}});
  assert.equal(s.paused,true); assert.equal(s.explorationMs,before); runtime.dispose();
});

test('双列技能光标按实际列数导航，支持首尾定位及循环', () => {
  assert.equal(nextActionIndex(0, 9, 2, 'ArrowRight'), 1);
  assert.equal(nextActionIndex(1, 9, 2, 'ArrowDown'), 3);
  assert.equal(nextActionIndex(3, 9, 2, 'ArrowUp'), 1);
  assert.equal(nextActionIndex(0, 9, 2, 'ArrowLeft'), 8);
  assert.equal(nextActionIndex(5, 9, 2, 'Home'), 0);
  assert.equal(nextActionIndex(0, 9, 2, 'End'), 8);
  assert.equal(nextActionIndex(0, 0, 2, 'ArrowDown'), null);
  assert.equal(nextActionIndex(0, 9, 2, 'Enter'), null);
});
test('技能上方介绍保留实际效果与原描述，不为预览扣费', () => {
  const {s, u} = encounter(); const a = strike(18); a.name = '回响'; a.description = '书页在指间汇拢。\n愿这份力量照亮归途。'; u.actions.echo = a;
  const row = view(s).battle.allActions.find(x => x.id === 'echo')!, before = JSON.stringify(s);
  assert.equal(row.sourceDescription, a.description);
  assert.ok(actionPreviewText(row).includes(row.description));
  assert.ok(actionPreviewText(row).includes(a.description));
  assert.equal(JSON.stringify(s), before);
});

test('技能不可用原因显示角色姓名与资源，不泄漏内部编号或编译术语', () => {
  assert.equal(actionUnavailableText('资源不足: sp / test-actor-0', [{id:'test-actor-0',name:'守卷者'}]), '守卷者的 SP 不足');
  assert.equal(actionUnavailableText('资源不足: hp / /private/id'), 'HP 不足');
  assert.equal(actionUnavailableText('不存在已编译动作'), '该技能暂不可用');
  assert.equal(actionUnavailableText('物品耗尽'), '物品耗尽');
});
