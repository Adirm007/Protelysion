import {array,enumeration,literal,number,object,text,union,type Infer} from '../compiler/schema';

import {RosterView} from './roster-contract';
export const BRIDGE_VERSION = 'booksea-bridge/1';
export const MAX_INTENT_CHARS = 16384;
const sequence = number(1, Number.MAX_SAFE_INTEGER, true);
const envelope = {protocolVersion: literal(BRIDGE_VERSION), sessionId: text(80), sequence};
const resources = object({hp: number(), mp: number(), sp: number()});
export const PauseReason = enumeration(['user', 'menu', 'target'] as const);
export type PauseReason = Infer<typeof PauseReason>;
export const Intent = union(
  object({...envelope, type: literal('ui_ready'), payload: object({})}),
  object({...envelope, type: literal('request_pause'), payload: object({reason: PauseReason, state: enumeration(['on', 'off'] as const)})}),
  object({...envelope, type: literal('choose_action'), payload: object({actorId: text(80), sourceId: text(4000), targetId: text(80)})})
);
export type Intent = Infer<typeof Intent>;
const actor = object({
  id: text(80), side: enumeration(['ally', 'enemy'] as const), level: number(1, 1e9, true),
  current: resources, max: resources, atb: number(0, 100),
  actions: array(object({sourceId: text(4000), target: enumeration(['self', 'ally', 'enemy'] as const),
    cost: resources, castMs: number(), used: number(0, 1e12, true), perBattleUses: number(0, 1e12, true)}), 0, 512)
});
export const BattleView = object({
  timeMs: number(), phase: enumeration(['ended', 'paused', 'menu', 'resolving', 'flowing'] as const),
  outcome: enumeration(['active', 'victory', 'defeat'] as const),
  blockers: array(text(80), 0, 16), readyActorId: text(80, 0), actors: array(actor, 2, 128)
});
export type BattleView = Infer<typeof BattleView>;
export const PresentationMessage = union(
  object({...envelope, type: literal('boot_config'), payload: object({authority: literal('typescript'), mode: enumeration(['battle-bridge-slice','host-readonly-roster'] as const)})}),
  object({...envelope, type: literal('actor_snapshot'), payload: RosterView}),
  object({...envelope, type: literal('battle_snapshot'), payload: BattleView}),
  object({...envelope, type: literal('intent_result'), payload: object({requestSequence: sequence, status: enumeration(['accepted', 'rejected'] as const), message: text(1000, 0)})}),
  object({...envelope, type: literal('error_view'), payload: object({code: text(80), message: text(1000)})})
);
export type PresentationMessage = Infer<typeof PresentationMessage>;
/** JSON text is the Web boundary; arbitrary objects/accessors never enter the domain. */
export function decodeIntent(wire: unknown): Intent {
  if (typeof wire !== 'string' || wire.length > MAX_INTENT_CHARS) throw Error('输入必须是有界JSON文本');
  return Intent.parse(JSON.parse(wire));
}
