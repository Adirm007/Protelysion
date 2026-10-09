import type {ActionSpec, EffectSpec} from '../compiler/contract';
import type {Battle} from '../battle/executor';
import {isAlive} from '../battle/presence';
import {newLogs} from './observer';
import type {AudioManifest} from './types';
import type {EffectBeat} from './effect-sequence';

export const BATTLE_IMPACT_MS = 240;
export const BATTLE_PRESENTATION_MS = 1100;
export type ActionStyle = 'slash' | 'pierce' | 'heavy' | 'fire' | 'ice' | 'lightning' | 'water' | 'wind' | 'earth' | 'light' | 'dark' | 'energy' | 'mental' | 'paper' | 'machine' | 'beast' | 'stone' | 'wood' | 'glass' | 'slime' | 'spirit' | 'insect' | 'heal' | 'guard' | 'status' | 'buff' | 'debuff' | 'summon';
const elements: Record<string, ActionStyle> = {'火':'fire','炎':'fire','火焰':'fire','fire':'fire','冰':'ice','冰霜':'ice','ice':'ice','雷':'lightning','电':'lightning','雷电':'lightning','lightning':'lightning','electric':'lightning','水':'water','water':'water','风':'wind','wind':'wind','土':'earth','地':'earth','earth':'earth','光':'light','圣':'light','light':'light','holy':'light','暗':'dark','黑暗':'dark','毒':'dark','dark':'dark','poison':'dark'};
const physicalPalettes = new Set<ActionStyle>(['paper','machine','beast','stone','wood','glass','slime','spirit','insect']);
/** Follow only executable references, never unrelated library entries. Bounded and read-only. */
export function actionEffects(action: ActionSpec): EffectSpec[] {
  const effects: EffectSpec[] = [], seen = new Set<string>();
  function visit(list: readonly EffectSpec[], depth: number) {
    if (depth > 8 || effects.length > 512) return;
    for (const e of list) {
      effects.push(e);
      const ids = e.op === 'sequence' || e.op === 'repeat' ? [e.action] : e.op === 'branch' ? [e.then, e.otherwise] : e.op === 'check' ? [e.success, e.failure] : e.op === 'choose' ? e.actions : [];
      for (const id of ids) if (id && !seen.has(id)) {seen.add(id); const next = action.library?.actions[id]; if (next) visit(next.effects, depth + 1);}
    }
  }
  visit(action.effects, 0); return effects;
}
export function actionStyle(action: ActionSpec, palette = 'metal'): ActionStyle {
  const all = actionEffects(action), damages = all.filter((e): e is Extract<EffectSpec, {op:'damage'}> => e.op === 'damage');
  if (damages.length) {
    // 六属性标签优先（火/水/光/暗有专属音色；物/精/无回落到下方通道与动词判定），旧element仅作兼容。
    const typed: Record<string, ActionStyle> = {'火':'fire','水':'water','光':'light','暗':'dark'};
    const elemental = new Set(damages.flatMap(e => (e.types ?? []).map(t => typed[t])).concat(damages.map(e => elements[(e.element ?? 'none').trim().toLowerCase()])).filter((s): s is ActionStyle => !!s));
    if (elemental.size === 1) return [...elemental][0]!;
    // Multiple possible branches/elements are not falsely described as one known element.
    if (elemental.size > 1) return 'energy';
    const nonzero = (amount: (typeof damages)[number]['amounts']['energy']) => !!(amount.flat || amount.factor || amount.maxFraction || amount.currentFraction || amount.lostFraction || amount.eventFraction || amount.dependency || amount.expression);
    if (damages.some(e => nonzero(e.amounts.mental))) return 'mental';
    if (damages.some(e => nonzero(e.amounts.energy))) return 'energy';
    const words = [action.name, ...(action.tags ?? []), ...(action.source?.tags ?? [])].join(' ').toLowerCase();
    if (/刺|矛|枪|箭|弓|needle|pierc|spear|arrow|bow|stab|贯穿/.test(words)) return 'pierce';
    if (/锤|砸|踏|重击|撞|拳|hammer|slam|crush|punch|bash|blunt|肘|踢/.test(words)) return 'heavy';
    if (/咬|撕|利爪|bite|claw/.test(words)) return 'beast';
    if (/斩|刀|剑|劈|割|slash|sword|blade|cut/.test(words)) return 'slash';
    return physicalPalettes.has(palette as ActionStyle) ? palette as ActionStyle : 'slash';
  }
  if (all.some(e => e.op === 'heal' || e.op === 'revive' || e.op === 'resource' && e.mode === 'add')) return 'heal';
  if (all.some(e => e.op === 'shield') || /防御|格挡|guard|defend/.test(action.name ?? '')) return 'guard';
  if (all.some(e => ['summon','recall','retreat','space'].includes(e.op))) return 'summon';
  const polarities = all.filter((e): e is Extract<EffectSpec,{op:'apply_status'}> => e.op==='apply_status').map(e=>action.library?.statuses[e.status]?.polarity);
  if (polarities.includes('negative') || action.target==='enemy' && all.some(e=>['apply_status','dispel','modify','cast','rule','resource','source','time'].includes(e.op))) return 'debuff';
  if (polarities.includes('positive') || all.some(e=>['modify','armor','reduction','speed','rule','damage_bonus','heal_bonus','element_resist'].includes(e.op))) return 'buff';
  return 'status';
}
export function resolvedLogs(before: Battle, after: Battle) {
  return newLogs(before.log.slice(-256), before.log.length, after.log.slice(-256), after.log.length);
}
export function unitPalette(b: Battle, id: string, foeIds: readonly string[], manifest?: AudioManifest): string {
  const u = b.units.find(u => u.id === id);
  if (u?.side === 'ally') return 'flesh';
  const owner = u?.owner ?? id, index = /^enemy-(\d+)$/.exec(owner);
  return index ? manifest?.monsters[foeIds[Number(index[1])] ?? '']?.palette ?? 'flesh' : 'flesh';
}
export function styleCues(style: ActionStyle): string[] {
  return ['heal','guard','status','buff','debuff','summon'].includes(style)
    ? [style === 'guard' ? 'shield' : style === 'summon' ? 'portal' : style]
    : ['release.' + style, 'impact.' + style];
}
/** Actual completed command -> bounded acoustic beats. Never resolves an action or uses battle RNG. */
export function battleAudioPlan(before: Battle, after: Battle, foeIds: readonly string[] = [], manifest?: AudioManifest) {
  const pending = before.clock.pending[0], command = pending?.kind === 'resolve' ? before.commands[pending.commandId] : undefined;
  if (!command) return null;
  const actor = before.units.find(u => u.id === command.caster), logs = resolvedLogs(before, after);
  const side = actor?.side ?? 'ally', palette = side === 'ally' ? 'metal' : unitPalette(before, command.caster, foeIds, manifest);
  const style = actionStyle({...command.action,library:actor?.library ?? command.action.library}, palette), events: EffectBeat[] = [];
  const add = (cue: string, at: number, pan = 0, gainDb = 0) => events.push({cue, at, pan, gainDb});
  const panFor = (id: string) => after.units.find(u => u.id === id)?.side === 'ally' ? -.18 : .18;
  const valid = !command.cancelled && !!actor && (isAlive(actor) || !!command.action.suicideCost && !!command.paid?.hp);
  if (!valid || logs.some(l => l.kind === 'fizzle')) {
    add('cast.fail', 0); return {key: command.id + '@' + before.clock.timeMs, side, style, events, impactAt: BATTLE_IMPACT_MS};
  }
  if (side === 'enemy') add(manifest?.cues['enemy.' + palette] ? 'enemy.' + palette : 'enemy.intent', 0, .15, -2);
  const release = styleCues(style)[0]!;
  add(release, side === 'enemy' ? 90 : 20, side === 'enemy' ? .1 : -.1);
  const hits = logs.filter(l => l.kind === 'damage' && l.value > 0), misses = logs.filter(l => l.kind === 'miss');
  const blocks = logs.filter(l => l.kind === 'absorbed' || l.kind === 'block' || l.kind === 'parry');
  const healed = after.units.filter(u => u.current.hp > (before.units.find(p => p.id === u.id)?.current.hp ?? u.current.hp));
  // A lethal last hit remains here even if the expedition immediately clears its Battle object.
  if (!hits.length) for (const u of after.units) {
    const old = before.units.find(p => p.id === u.id);
    if (old && u.current.hp < old.current.hp && (command.targets ?? [command.target]).includes(u.id) && !misses.some(l => l.unit === u.id) && !blocks.some(l => l.unit === u.id))
      hits.push({kind:'damage',unit:u.id,detail:'命中',value:old.current.hp-u.current.hp});
  }
  for (const [i, hit] of hits.slice(0, 4).entries()) {
    const at = BATTLE_IMPACT_MS + i * 90, pan = panFor(hit.unit);
    const impact = styleCues(style)[1] ?? 'impact.energy';
    add(impact, at, pan, i ? -2 : 0);
    const material = unitPalette(after, hit.unit, foeIds, manifest);
    const materialCue = manifest?.palettes[material]?.hit ?? 'hit.flesh';
    add(materialCue, at + 14, pan, -7);
  }
  for (const [i, miss] of misses.slice(0, 2).entries()) add('miss', BATTLE_IMPACT_MS + i * 90, panFor(miss.unit));
  if (blocks.length) add('guard.block', BATTLE_IMPACT_MS, panFor(blocks[0]!.unit));
  if (logs.some(l => l.kind === 'shield_break')) add('shield.break', BATTLE_IMPACT_MS + 90);
  if (hits.some(l => unitPalette(after,l.unit,foeIds,manifest)==='beast')) add('reaction.beast',BATTLE_IMPACT_MS+45,.15,-3);
  if (hits.some(l => l.detail === '暴击')) add('critical', BATTLE_IMPACT_MS + 35);
  if (hits.some(l => after.units.find(u => u.id === l.unit)?.side === 'ally')) add('party.hurt', BATTLE_IMPACT_MS + 35, -.12, -4);
  if (healed.length && style !== 'heal') add('heal', BATTLE_IMPACT_MS + 60, panFor(healed[0]!.id), -3);
  if (after.units.some(u => !isAlive(u) && !!before.units.find(p => p.id === u.id && isAlive(p)))) add('down', BATTLE_IMPACT_MS + 260);
  if (after.units.some(u => u.side === 'ally' && u.current.hp > 0 && u.current.hp / u.max.hp < .25 && (before.units.find(p => p.id === u.id)?.current.hp ?? 0) / u.max.hp >= .25)) add('low.hp', BATTLE_IMPACT_MS + 370, -.15, -4);
  return {key: command.id + '@' + before.clock.timeMs, side, style, events: events.slice(0,18), impactAt: BATTLE_IMPACT_MS};
}
