/** Synthetic test fixture only; never bundled into release and never a production fallback. */
import type { ActorRef, Obj } from '../src/core/actors';
export const player: ActorRef = { kind: 'player' };
export const partner = (name = '测试伙伴甲'): ActorRef => ({ kind: 'partner', name });
export function actor(level = 1): Obj {
  return { 等级: level, 生命层级: '测试层级', 种族: '测试种族', 命定契约: true, 好感度: 70, 在场: false,
    属性: { 力量: 10, 敏捷: 10, 体质: 10, 智力: 10, 精神: 10 },
    生命值: { 当前: 30, 上限: { _基础: 100, 额外: 20 } }, 法力值: { 当前: 15, 上限: { _基础: 80, 额外: 0 } }, 体力值: { 当前: 10, 上限: { _基础: 60, 额外: -5 } },
    装备: {}, 技能: { 测试技能: { 品质: '普通', 类型: '主动', 消耗: '10SP', 标签: ['测试', '物理'], 效果: { 伤害: '测试效果' }, 描述: '仅测试' } },
    状态效果: { 原有伤势: { 类型: '减益', 效果: '测试减益', 层数: 1, 剩余时间: '1小时', 来源: '宿主' } },
    背包: { 测试药剂: { 品质: '普通', 类型: '消耗品', 数量: 3, 标签: [], 效果: { 恢复: '测试' }, 描述: '测试' } },
    登神长阶: { 是否开启: false, 要素: {}, 权能: {}, 法则: {} }, 累计经验值: 7 };
}
export function fixture(): Obj {
  return { stat_data: { 主角: actor(1), 关系列表: { 测试伙伴甲: actor(5), 测试伙伴乙: actor(9), 测试伙伴丙: actor(21), 测试伙伴丁: actor(25) }, 命运点数: 100, 世界: { 时间: '不应改变' } },
    date: { npcLevelUpWithPlayer: true, npcs: { 测试伙伴甲: { level: 5, exp: 123, required_exp: 1000 } } } };
}
