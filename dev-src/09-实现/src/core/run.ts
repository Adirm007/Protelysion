import { actorAt, actorKey, hostLevel, validateTeam, integer, type ActorRef } from './actors';
import { battleExperience, type EnemyReward } from './experience';
export type Exit = 'active' | 'voluntaryExit' | 'downedExit';
export type Participant = { ref: ActorRef; entryLevel: number; status: Exit; battles: { id: string; experience: number }[]; experience: number };
export type Reward = { kind: 'box'; quality: string; style: string; contentType: string; count: number; source: string }
  | { kind: 'fp'; amount: number; count: number; source: string }
  /** 0.26 怪物独特素材（含神话宝箱怪的「价值的结晶」）；成功撤离时写入背包，失败清零。 */
  | { kind: 'material'; name: string; quality: string; theme: string; region: string; effect: string; description: string; monsterId: string; count: number; source: string }
  /** 0.40 补给员给的可带出战利品：成功撤离时写入主角背包，由正文演绎；失败清零（买了死亡不掉落则保留）。 */
  | { kind: 'gift'; name: string; itemType: string; quality: string; effect: string; description: string; count: number; source: string }
  /** Read-only compatibility for pre-0.24 unfinished expedition rewards; credited as FP on success. */
  | { kind: 'voucher'; faceValue: number; count: number; source: string };
/** keepOnDefeat（0.39 商店「死亡不掉落」）：本趟全灭时照常失败离场（复活交接不变），但逐人经验与全部掉落照成功结算保留。 */
export type Run = { id: string; status: 'active' | 'success' | 'failed'; keepOnDefeat?: boolean; battleActive: boolean; participants: Participant[]; battleIds: string[]; defeatedIds: string[]; rewards: Reward[]; unlocks: string[]; failureSignal: { runId: string; downed: ActorRef[]; finalDowned: ActorRef[]; voluntary: ActorRef[] } | null };
export function newRun(id: string, mvu: unknown, refs: ActorRef[]): Run {
  validateTeam(mvu, refs);
  if (!id) throw new Error('本趟ID缺失');
  return { id, status: 'active', battleActive: false, participants: refs.map(ref => ({ ref: structuredClone(ref), entryLevel: hostLevel(actorAt(mvu, ref)), status: 'active', battles: [], experience: 0 })), battleIds: [], defeatedIds: [], rewards: [], unlocks: [], failureSignal: null };
}
function active(run: Run): void { if (run.status !== 'active') throw new Error('本趟已结束'); }
export function awardVictory(run: Run, battleId: string, participantKeys: string[], enemies: EnemyReward[]): Run {
  active(run);
  if (!battleId || run.battleIds.includes(battleId)) throw new Error('战斗ID为空或已结算');
  if (!participantKeys.length || new Set(participantKeys).size !== participantKeys.length) throw new Error('参战名单为空或重复');
  for (const key of participantKeys) {
    if (!run.participants.some(p => actorKey(p.ref) === key && p.status === 'active')) throw new Error('参战者不存在或已退场');
  }
  for (const e of enemies) if (run.defeatedIds.includes(e.instanceId)) throw new Error('敌人实例已奖励');
  const next = structuredClone(run);
  for (const p of next.participants) if (participantKeys.includes(actorKey(p.ref))) {
    const experience = battleExperience(p.entryLevel, enemies);
    p.battles.push({ id: battleId, experience }); p.experience += experience;
  }
  next.battleIds.push(battleId); next.defeatedIds.push(...enemies.map(e => e.instanceId));
  return next;
}
/** Call after combat resolves revival/death exemptions and leaves combat. Batch exits avoid false success on simultaneous downs. */
export function exitMembers(run: Run, exits: { ref: ActorRef; reason: Exclude<Exit, 'active'> }[]): Run {
  active(run);
  if (run.battleActive) throw new Error('战斗中不能退场：先结束或成功逃跑');
  if (!exits.length || new Set(exits.map(e => actorKey(e.ref))).size !== exits.length) throw new Error('退出名单为空或重复');
  const next = structuredClone(run);
  for (const exit of exits) {
    if (!['voluntaryExit', 'downedExit'].includes(exit.reason)) throw new Error('退出原因非法');
    const p = next.participants.find(p => actorKey(p.ref) === actorKey(exit.ref));
    if (!p || p.status !== 'active') throw new Error('成员不存在或已退场，不可重新加入');
    p.status = exit.reason;
    if (exit.reason === 'downedExit' && !next.keepOnDefeat) p.experience = 0;
  }
  if (!next.participants.some(p => p.status === 'active')) {
    // Downed members resolve before voluntary exits; a surviving voluntary final departure is success.
    const successfulFinal = exits.some(e => e.reason === 'voluntaryExit');
    next.status = successfulFinal ? 'success' : 'failed';
    if (!successfulFinal) {
      if (!next.keepOnDefeat) {
        for (const p of next.participants) p.experience = 0;
        next.rewards = [];
      }
      next.failureSignal = { runId: next.id, finalDowned: exits.filter(e => e.reason === 'downedExit').map(e => structuredClone(e.ref)), downed: next.participants.filter(p => p.status === 'downedExit').map(p => p.ref), voluntary: next.participants.filter(p => p.status === 'voluntaryExit').map(p => p.ref) };
    }
  }
  return next;
}
export function addReward(run: Run, reward: Reward): Run {
  active(run); integer(reward.count, '掉落数量', 1);
  if (reward.kind === 'fp') integer(reward.amount, 'FP数额', 1);
  else if (reward.kind === 'voucher') integer(reward.faceValue, '旧奖励数额', 1);
  else if (reward.kind === 'gift') { if (!reward.name || !reward.itemType || !reward.quality || !reward.effect || !reward.description) throw new Error('战利品字段缺失'); }
  else if (reward.kind === 'material') { if (!reward.name || !reward.quality || !reward.theme || !reward.region || !reward.effect || !reward.description || !reward.monsterId) throw new Error('素材字段缺失'); }
  else if (!reward.quality || !reward.style || !reward.contentType) throw new Error('盲盒标签缺失');
  const next = structuredClone(run); next.rewards.push(structuredClone(reward)); return next;
}
/** A proposal only. It does not claim host growth, writes, revival or message delivery succeeded. */
/** 本趟所得是否结算：成功撤离，或买了「死亡不掉落」的失败。 */
export const keepsGains = (run: Run) => run.status === 'success' || run.status === 'failed' && !!run.keepOnDefeat;
export function settlementProposal(run: Run) {
  if (run.status === 'active') throw new Error('全体退出前禁止结算');
  const keep = keepsGains(run);
  return {
    runId: run.id, outcome: run.status, keptOnDefeat: run.status === 'failed' && keep,
    experience: run.participants.map(p => ({ ref: p.ref, amount: keep ? p.experience : 0 })),
    rewards: keep ? structuredClone(run.rewards) : [],
    restore: run.participants.map(p => p.ref), failureSignal: run.failureSignal,
    unlocks: [...run.unlocks], committed: false as const,
  };
}
