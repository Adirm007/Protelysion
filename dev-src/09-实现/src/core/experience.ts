import { hostLevel, integer, tier } from './actors';
export const EXPERIENCE_COEFFICIENTS = [0, 10, 20, 50, 100, 250, 600, 600] as const;
export const BATTLE_CAPS = [0, 100, 1000, 4000, 10000, 25000, 50000, 0] as const;
export type EnemyReward = { instanceId: string; species: string; level: number; role: string; rewardEligible: boolean };
export function battleExperience(entryLevel: number, enemies: EnemyReward[]): number {
  hostLevel({ 等级: entryLevel });
  const groups = new Map<string, { enemy: EnemyReward; count: number }>();
  const seen = new Set<string>();
  for (const enemy of enemies) {
    integer(enemy.level, '敌人挑战等级', 1);
    if (!enemy.instanceId || !enemy.species || !enemy.role) throw new Error('敌人奖励身份缺失');
    if (seen.has(enemy.instanceId)) throw new Error('同一敌人实例重复计入');
    seen.add(enemy.instanceId);
    if (!enemy.rewardEligible) continue;
    const key = JSON.stringify([enemy.species, enemy.level, enemy.role]);
    const group = groups.get(key);
    groups.set(key, { enemy, count: (group?.count ?? 0) + 1 });
  }
  if (entryLevel === 25) return 0;
  let total = 0;
  for (const { enemy, count } of groups.values()) {
    if (tier(entryLevel) > tier(enemy.level) + 1) continue;
    const coefficient = EXPERIENCE_COEFFICIENTS[tier(enemy.level)]!;
    total += enemy.level * coefficient * (1 + (count - 1) * 0.2);
  }
  // Only round after summation, then cap this battle, not the whole run.
  return Math.min(BATTLE_CAPS[tier(entryLevel)]!, Math.floor(total + 1e-9));
}
