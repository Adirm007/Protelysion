import { actorKey, integer, type ActorRef } from './actors';
import { canonical } from './cache';
import type { Run } from './run';
import {EXIT_REQUEST} from './handoff-message';

export type FailureNotice = {
  version: 1; runId: string; participants: ActorRef[]; finalDowned: ActorRef[];
  safelyExited: ActorRef[]; voluntary: ActorRef[]; previouslyDowned: ActorRef[];
  depth: number; encounter: string; knockouts?: string[]; consumed: { owner: ActorRef; name: string; count: number }[];
  resourcePolicy: 'host-full-narrative-zero'; message: string; directive: string;
};
export type FailureFacts = Pick<FailureNotice, 'depth' | 'encounter' | 'consumed'> & { knockouts?: string[] };
const safeId = (id: string) => { if (!/^[A-Za-z0-9_-]{1,100}$/.test(id)) throw Error('本趟ID须为安全且非空的稳定标识'); };
const same = (a: ActorRef[], b: ActorRef[]) => canonical(a.map(actorKey).sort()) === canonical(b.map(actorKey).sort());
const quoted = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
const label = (r: ActorRef) => r.kind === 'player' ? '主角' : r.name;
const labels = (rs: ActorRef[]) => quoted(rs.map(label));

/** Only concluded failure facts. The zero belongs to combat history, never to a host death write. */
export function failureNotice(run: Run, facts: FailureFacts): FailureNotice {
  safeId(run.id); integer(facts.depth, '深度', 1);
  if (run.status !== 'failed' || run.battleActive || !run.failureSignal || run.failureSignal.runId !== run.id) throw Error('本趟失败尚未确定');
  if (!run.participants.length || run.participants.length > 4 || new Set(run.participants.map(p => actorKey(p.ref))).size !== run.participants.length) throw Error('失败队伍非法');
  if (run.participants.some(p => !['voluntaryExit','downedExit'].includes(p.status) || !run.keepOnDefeat && p.experience !== 0) || !run.keepOnDefeat && run.rewards.length) throw Error('失败账本未清零');
  const sig = run.failureSignal;
  if (!same(sig.downed, run.participants.filter(p => p.status === 'downedExit').map(p => p.ref)) || !same(sig.voluntary, run.participants.filter(p => p.status === 'voluntaryExit').map(p => p.ref))) throw Error('失败名单与结束状态不一致');
  if (!sig.finalDowned?.length || new Set(sig.finalDowned.map(actorKey)).size !== sig.finalDowned.length || sig.finalDowned.some(r => !sig.downed.some(d => actorKey(d) === actorKey(r)))) throw Error('缺少最后倒下批次，旧存档须显式迁移，不能猜测');
  if (typeof facts.encounter !== 'string' || !facts.encounter.trim() || facts.encounter.length > 2000) throw Error('致命遭遇事实缺失或过长');
  if (facts.knockouts && (facts.knockouts.length > 12 || facts.knockouts.some(l => typeof l !== 'string' || !l.trim() || l.length > 3000))) throw Error('倒下经过记录非法');
  for (const item of facts.consumed) {
    integer(item.count, '已消耗数量', 1);
    if (!item.name || item.name.length > 300 || !run.participants.some(p => actorKey(p.ref) === actorKey(item.owner))) throw Error('消耗记录非法');
  }
  const finalKeys = new Set(sig.finalDowned.map(actorKey));
  const previouslyDowned = sig.downed.filter(r => !finalKeys.has(actorKey(r)));
  const safelyExited = run.participants.filter(p => !finalKeys.has(actorKey(p.ref))).map(p => p.ref);
  // Facts only. Narrative rules belong to the triggered EJS, not the user message.
  const directive = [
    `本趟参战名单：${labels(run.participants.map(p=>p.ref))}。`,
    run.participants.some(p=>p.ref.kind==='player') ? '主角参战；最终倒下者以以下名单为准。' : '主角未参战。',
    `最终在局内倒下、战斗生命为零的成员：${labels(sig.finalDowned)}。`,
    `此前已安全离场的成员：${labels(safelyExited)}；其中先前单独倒下并已恢复者：${labels(previouslyDowned)}。`,
    `抵达深度：${facts.depth}；遭遇与过程记录：${quoted(facts.encounter)}。`,
    ...(facts.knockouts ?? []),
    `已实际消耗的原物品：${quoted(facts.consumed.map(x=>({owner:label(x.owner),name:x.name,count:x.count})))}。`,
    '宿主离场数值已按约定补满三资源，书海伤势已清理；宿主原有状态及其剩余时间保留。',
    ...(run.keepOnDefeat ? [
      '本趟已购买「死亡不掉落」：虽然败退离场，逐人经验与全部新掉落仍照常结算保留；永久发现和解锁保留，已消耗原物品维持已扣除记录。',
      `已保留并结算的逐人经验：${quoted(run.participants.map(p=>({actor:label(p.ref),experience:p.experience})))}；已保留并结算的未开启盲盒、怪物素材、FP及来源：${quoted(run.rewards)}。`,
    ] : ['本趟经验与新掉落已按失败规则清空；永久发现和解锁保留，已消耗原物品维持已扣除记录。']),
  ].join('\n');
  const message = EXIT_REQUEST;
  return structuredClone({version:1, runId:run.id, participants:run.participants.map(p => p.ref), finalDowned:sig.finalDowned, safelyExited, voluntary:sig.voluntary, previouslyDowned, ...facts, resourcePolicy:'host-full-narrative-zero', message, directive});
}
