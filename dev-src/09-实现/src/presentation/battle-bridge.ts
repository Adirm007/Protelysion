import {advanceBattle, chooseAction, resolveAction, type Battle} from '../battle/executor';
import {clockPhase} from '../battle/clock';
import {BRIDGE_VERSION, BattleView, PresentationMessage, decodeIntent, type PauseReason} from './protocol';

type Output = PresentationMessage extends infer M ? M extends PresentationMessage ? Pick<M, 'type' | 'payload'> : never : never;
export type HostBlocker = 'hidden' | 'context-lost' | 'chat-changed' | 'transport';
/** One owner per battle. Caller supplies an already validated/admitted battle, not raw MVU or a save file. */
export class BattleBridge {
  #battle: Battle;
  #ready = false;
  #closed = false;
  #inputSequence = 0;
  #outputSequence = 0;
  #pauses = new Set<PauseReason>();
  #hostBlocks = new Set<HostBlocker>();
  readonly sessionId: string;

  constructor(battle: Battle, sessionId: string) {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(sessionId)) throw Error('桥会话标识非法');
    this.sessionId = sessionId;
    this.#battle = structuredClone(battle);
    this.view(); // Fail before mounting an unrepresentable snapshot.
  }
  #message(message: Output): PresentationMessage {
    return PresentationMessage.parse({...message, protocolVersion: BRIDGE_VERSION,
      sessionId: this.sessionId, sequence: ++this.#outputSequence});
  }
  #blocked(): boolean {
    return !this.#ready || this.#closed || this.#hostBlocks.size > 0 || this.#pauses.size > 0;
  }
  view(): BattleView {
    const b = this.#battle;
    const blockers = [...this.#hostBlocks, ...this.#pauses,
      ...(!this.#ready ? ['not-ready'] : []), ...(this.#closed ? ['closed'] : []),
      ...(b.clock.paused ? ['core-paused'] : [])];
    const head = b.clock.pending[0];
    // Construct a whitelist. No source prose, full compiled cards, seed, host paths, chat or credentials.
    return BattleView.parse({timeMs: b.clock.timeMs,
      phase: b.outcome !== 'active' ? 'ended' : blockers.length ? 'paused' : clockPhase(b.clock),
      outcome: b.outcome, blockers,
      readyActorId: head?.kind === 'ready' ? head.unitId : '',
      actors: b.units.map(u => ({id: u.id, side: u.side, level: u.level,
        current: {...u.current}, max: {...u.max}, atb: b.clock.units.find(c => c.id === u.id)!.atb,
        actions: u.side === 'enemy' ? [] : Object.entries(u.actions).map(([sourceId, a]) => ({
          sourceId, target: a.target, castMs: a.castMs, used: u.used[sourceId] ?? 0,
          perBattleUses: a.perBattleUses,
          cost: {hp: Math.ceil(a.cost.hp.flat + u.max.hp * a.cost.hp.maxFraction),
            mp: Math.ceil(a.cost.mp.flat + u.max.mp * a.cost.mp.maxFraction),
            sp: Math.ceil(a.cost.sp.flat + u.max.sp * a.cost.sp.maxFraction)}
        }))}))});
  }
  snapshot(): PresentationMessage {
    return this.#message({type: 'battle_snapshot', payload: this.view()});
  }
  receive(wire: unknown): PresentationMessage[] {
    if (this.#closed) return [];
    let intent;
    try { intent = decodeIntent(wire); }
    catch { return [this.#message({type: 'error_view', payload: {code: 'INVALID_MESSAGE', message: '消息格式或协议版本不支持；未执行输入。'}})]; }
    if (intent.sessionId !== this.sessionId || intent.sequence <= this.#inputSequence) {
      return [this.#message({type: 'error_view', payload: {code: 'STALE_MESSAGE', message: '会话不匹配或消息已处理；未重复执行。'}})];
    }
    // A structurally valid rejected intent is consumed too. Retry must be a new explicit input.
    this.#inputSequence = intent.sequence;
    let error = '';
    const output: PresentationMessage[] = [];
    try {
      if (intent.type === 'ui_ready') {
        if (this.#ready) throw Error('呈现端已就绪；重建须关闭旧桥并创建新会话');
        this.#ready = true;
        output.push(this.#message({type: 'boot_config', payload: {authority: 'typescript', mode: 'battle-bridge-slice'}}));
      } else {
        if (!this.#ready) throw Error('呈现端尚未就绪');
        if (intent.type === 'request_pause') {
          if (intent.payload.state === 'on') this.#pauses.add(intent.payload.reason);
          else this.#pauses.delete(intent.payload.reason);
        } else {
          if (this.#blocked()) throw Error('规则已暂停；请先关闭菜单/目标选择或恢复页面');
          const p = intent.payload;
          if (this.#battle.units.find(u => u.id === p.actorId)?.side !== 'ally') throw Error('呈现端只能选择我方行动');
          this.#battle = chooseAction(this.#battle, p.actorId, p.sourceId, p.targetId);
        }
      }
    } catch (e) { error = e instanceof Error ? e.message.slice(0, 1000) : '输入未执行'; }
    output.push(this.#message({type: 'intent_result', payload: {requestSequence: intent.sequence,
      status: error ? 'rejected' : 'accepted', message: error}}), this.snapshot());
    return output;
  }
  /** Host driver only: no render delta, elapsed timestamp or animation-completed input is accepted. */
  advanceRules(budgetMs: number): {consumedMs: number; message: PresentationMessage} {
    if (!Number.isFinite(budgetMs) || budgetMs < 0 || budgetMs > 250) throw Error('规则步长须在0至250ms；禁止补算掉帧/后台时间');
    if (this.#blocked()) return {consumedMs: 0, message: this.snapshot()};
    const next = advanceBattle(this.#battle, budgetMs);
    this.#battle = next.battle;
    return {consumedMs: next.consumedMs, message: this.snapshot()};
  }
  /** Resolution is controlled by TS, never a Godot animation callback. */
  resolvePending(): PresentationMessage {
    if (this.#blocked()) throw Error('规则已暂停');
    this.#battle = resolveAction(this.#battle);
    return this.snapshot();
  }
  /** Explicit host AI decision; no default attack is invented and no UI can use this endpoint. */
  chooseEnemyAction(actorId: string, sourceId: string, targetId: string): PresentationMessage {
    if (this.#blocked() || this.#battle.units.find(u => u.id === actorId)?.side !== 'enemy') throw Error('敌方行动不可提交');
    this.#battle = chooseAction(this.#battle, actorId, sourceId, targetId);
    return this.snapshot();
  }
  setHostBlocked(reason: HostBlocker, blocked: boolean): PresentationMessage {
    if (blocked) this.#hostBlocks.add(reason); else this.#hostBlocks.delete(reason);
    return this.snapshot();
  }
  /** Detached authority export for a trusted save/host controller, never installed on window. */
  exportBattle(): Battle { return structuredClone(this.#battle); }
  close(): void { this.#closed = true; }
}
