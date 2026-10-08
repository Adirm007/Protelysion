import type {Unit,StateInstance} from './executor';
export function activeRule(u:Unit,kind:string):StateInstance|undefined {
 return u.statuses?.find(s=>!s.suppressed&&s.rule?.kind===kind&&s.rule.uses!==0&&(s.clock==='permanent'||s.clock==='field'||s.remaining>1e-7));
}
/** 0 HP is not automatically a corpse; sealing and escaping are not ordinary HP loss. */
export function isAlive(u:Unit):boolean {
 return !u.escaped&&!activeRule(u,'sealed')&&(u.current.hp>0||!!u.zeroHpProtected&&!!activeRule(u,'undying'));
}
