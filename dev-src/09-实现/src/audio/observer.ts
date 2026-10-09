import type {ActionSpec} from '../compiler/contract';
import type {State} from '../game/expedition';
import type {AudioFrame, AudioManifest} from './types';

export type SoundSink = {frame(frame: AudioFrame): void; cue(name: string): void; manifest(): AudioManifest | undefined};
type Log = {kind: string; unit: string; detail: string; value: number};
type UnitSound = {id: string; side: string; hp: number; maxHp: number; shield: number; statuses: number};
type CommandSound = {id: string; caster: string; action: ActionSpec};
type Sample = {
  run: string; frame: AudioFrame; region: string; x: number; z: number; fights: number;
  used: Set<string>; chests: Set<string>; rewards: number;
  units: Map<string, UnitSound>; commands: Map<string, CommandSound>; resolving: string;
  logs: Log[]; logCount: number;
};
const titleFrame = (): AudioFrame => ({mode: 'title', theme: '', scene: '', battleKey: '', foeIds: [], phase: false, paused: false, outcome: ''});
const stamp = (log: Log) => JSON.stringify([log.kind, log.unit, log.detail, log.value]);
/** Align the rolling log by suffix; identical snapshots must never replay effects. */
export function newLogs(before: Log[], beforeCount: number, after: Log[], afterCount: number): Log[] {
  if (afterCount < beforeCount && afterCount < 1000) return [];
  if (afterCount < 1000 && afterCount >= beforeCount) return after.slice(Math.max(0, after.length - (afterCount - beforeCount)));
  const a = before.map(stamp), b = after.map(stamp);
  for (let overlap = Math.min(a.length, b.length); overlap > 0; overlap--) {
    if (a.slice(-overlap).every((v, i) => v === b[i])) return after.slice(overlap);
  }
  // A discontinuous restored/reset log is not a queue of historical sounds.
  return [];
}
function capture(s: State): Sample {
  const b = s.battle, encounter = s.region.things.find(t => t.id === s.encounterId);
  const frame: AudioFrame = {mode: s.mode, theme: s.region.theme, scene: s.region.name,
    battleKey: [s.run.id, s.depth, s.visit, s.encounterId, s.fights].join('/'),
    foeIds: encounter?.foes ?? [], phase: !!s.bossPhases?.length, paused: s.paused, outcome: s.run.status};
  const head = b?.clock.pending[0];
  return {run: s.run.id, frame, region: [s.depth, s.visit, s.region.theme, s.region.name].join('/'),
    x: s.x, z: s.z, fights: s.fights,
    used: new Set(s.region.things.filter(t => t.used).map(t => t.id)),
    chests: new Set(s.region.things.filter(t => t.kind === 'chest').map(t => t.id)),
    rewards: s.run.rewards.reduce((n, r) => n + r.count, 0),
    units: new Map((b?.units ?? s.world?.units ?? []).map(u => [u.id, {id: u.id, side: u.side, hp: u.current.hp, maxHp: u.max.hp,
      shield: u.shields.reduce((n, x) => n + x.amount, 0), statuses: u.statuses?.length ?? 0}])),
    commands: new Map(Object.entries(b?.commands ?? {}).map(([id, c]) => [id, {id, caster: c.caster, action: c.action}])),
    resolving: head?.kind === 'resolve' ? head.commandId : '',
    logs: b?.log.slice(-64).map(l => ({...l})) ?? [], logCount: b?.log.length ?? 0};
}
function paletteFor(sample: Sample, unit: string, m?: AudioManifest) {
  const index = /^enemy-(\d+)$/.exec(unit);
  const id = index ? sample.frame.foeIds[Number(index[1])] : undefined;
  return id ? m?.monsters[id]?.palette ?? 'flesh' : 'flesh';
}
const elementCues: Record<string, string> = {'火': 'fire', '冰': 'ice', '雷': 'lightning', '电': 'lightning', '水': 'water', '风': 'wind', '土': 'earth', '地': 'earth', '光': 'light', '暗': 'dark', '毒': 'dark'};
export function actionCue(action: ActionSpec, palette: string, m?: AudioManifest): string {
  const damage = action.effects.find(e => e.op === 'damage');
  if (damage?.op === 'damage') {
    const element = elementCues[damage.element];
    if (element) return 'magic.' + element;
    if (damage.amounts.energy.flat || damage.amounts.energy.factor || damage.amounts.mental.flat || damage.amounts.mental.factor) return 'magic.energy';
    return m?.palettes[palette]?.attack ?? 'attack.slash';
  }
  if (action.effects.some(e => e.op === 'heal' || e.op === 'resource')) return 'heal';
  if (action.effects.some(e => e.op === 'shield')) return 'shield';
  if (action.effects.some(e => e.op === 'summon' || e.op === 'retreat')) return 'portal';
  return 'status';
}

/** Observes copied presentation facts only; does not mutate State, Battle, seeds or storage. */
export class ExpeditionSoundObserver {
  private previous?: Sample;
  constructor(private sink: SoundSink, private structuredBattle = false) {}
  observe(state: State | null): void {
    if (!state) {this.previous = undefined; this.sink.frame(titleFrame()); return;}
    const now = capture(state), old = this.previous, m = this.sink.manifest();
    this.previous = now;
    this.sink.frame(now.frame);
    if (!old || old.run !== now.run || now.frame.paused || old.frame.paused) return;
    const cue = (name: string) => this.sink.cue(name);
    if (now.region !== old.region) cue('portal');
    else if (now.frame.mode === 'explore' && old.frame.mode === 'explore' && (now.x !== old.x || now.z !== old.z)) {
      const surface = m?.themes[now.frame.theme]?.surface;
      if (surface) cue('step.' + surface);
    }
    if (now.frame.mode === 'battle' && old.frame.mode !== 'battle') {
      cue(now.frame.foeIds.some(id => /_B\d+$/.test(id)) ? 'boss.enter' : 'encounter');
    }
    if (now.frame.phase && !old.frame.phase && now.frame.mode === 'battle') cue('boss.phase');
    if (now.frame.mode === 'event' && old.frame.mode !== 'event') cue('book.open');
    if (now.frame.mode === 'explore' && old.frame.mode === 'event') cue('book.close');
    if (now.region === old.region) for (const id of now.used) if (!old.used.has(id) && now.chests.has(id)) cue('chest.open');
    if (now.rewards > old.rewards) cue('reward');
    if (old.frame.mode === 'battle' && now.frame.mode !== 'battle') {
      cue(now.frame.outcome === 'failed' ? 'defeat' : now.fights > old.fights ? 'victory' : 'flee');
    } else if (now.frame.mode === 'ended' && old.frame.mode !== 'ended' && now.frame.outcome === 'failed') cue('defeat');
    // The playable runtime owns resolved beats; never replay their damage on the next snapshot.
    if (this.structuredBattle && (now.frame.mode === 'battle' || old.frame.mode === 'battle')) {
      if (now.frame.mode === 'battle' && old.frame.mode === 'battle') for (const [id, command] of now.commands)
        if (!old.commands.has(id) && command.action.castMs > 0) cue('cast.channel');
      if (now.frame.mode !== old.frame.mode || now.frame.battleKey !== old.frame.battleKey || old.resolving && !now.commands.has(old.resolving)) return;
      // Other frames may contain poison/field/counter ticks, not a just-presented action.
    }
    // Play the release when the actual queued command resolves, including the final hit
    // whose Battle object is removed by the rules in the same tick.
    if (!this.structuredBattle && old.resolving && !now.commands.has(old.resolving)) {
      const c = old.commands.get(old.resolving);
      if (c && (now.units.get(c.caster)?.hp ?? old.units.get(c.caster)?.hp ?? 0) > 0) {
        cue(actionCue(c.action, old.units.get(c.caster)?.side === 'ally' ? 'metal' : paletteFor(old, c.caster, m), m));
      }
    }
    const sameBattle = now.frame.mode === 'battle' && old.frame.mode === 'battle' && now.frame.battleKey === old.frame.battleKey;
    if (!sameBattle) {
      const outside = ['explore', 'event', 'supplier'].includes(now.frame.mode) && ['explore', 'event', 'supplier'].includes(old.frame.mode) && now.region === old.region;
      if (outside) for (const [id, u] of now.units) {
        const was = old.units.get(id); if (!was) continue;
        if (u.hp > was.hp + .01) cue('heal');
        if (u.hp < was.hp - .01) cue('hit.flesh');
        if (u.shield > was.shield + .01) cue('shield');
        if (u.statuses > was.statuses) cue('status');
      }
      return;
    }
    if (!this.structuredBattle) for (const [id, command] of now.commands) if (!old.commands.has(id) && command.action.castMs > 0) cue('status');
    const logs = newLogs(old.logs, old.logCount, now.logs, now.logCount).slice(-16);
    const hitUnits = new Set<string>(), payingUnits = new Set([...now.commands].filter(([id])=>!old.commands.has(id)).map(([,c])=>c.caster));
    for (const log of logs) {
      if (log.kind === 'damage' && log.value > 0) {
        const palette = paletteFor(now, log.unit, m);
        cue(m?.palettes[palette]?.hit ?? 'hit.flesh'); hitUnits.add(log.unit);
        if (log.detail === '暴击') cue('critical');
      } else if (log.kind === 'absorbed') cue('shield');
      else if (log.kind === 'shield_break') cue('shield.break');
      else if (log.kind === 'miss') cue('miss');
      else if (log.kind === 'down') cue('down');
      else if (log.kind === 'fizzle') cue('ui.error');
    }
    for (const [id, u] of now.units) {
      const was = old.units.get(id); if (!was) {cue('portal'); continue;}
      if (u.hp > was.hp + .01) cue('heal');
      if (u.hp < was.hp - .01 && !hitUnits.has(id) && !payingUnits.has(id)) cue(m?.palettes[paletteFor(now, id, m)]?.hit ?? 'hit.flesh');
      if (u.shield > was.shield + .01) cue('shield');
      if (u.statuses > was.statuses) cue('status');
      if (u.side === 'ally' && u.hp > 0 && u.hp / u.maxHp < .25 && was.hp / was.maxHp >= .25) cue('low.hp');
    }
  }
  intent(type: string): void {
    if (this.structuredBattle && ['category','favorite','skill','target','confirmTargets','cancel'].includes(type)) return;
    if (['category', 'favorite', 'skill', 'target', 'eventOwner'].includes(type)) this.sink.cue('ui.select');
    else if (['new', 'continue', 'confirmTargets', 'event', 'settings'].includes(type)) this.sink.cue('ui.confirm');
    else if (['cancel', 'pause'].includes(type)) this.sink.cue('ui.cancel');
    else if (type === 'page') this.sink.cue('book.flip');
  }
}
