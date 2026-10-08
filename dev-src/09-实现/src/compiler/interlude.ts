import type {ActionSpec} from './contract';
import {INTERLUDE_REST,INTERLUDE_TAG} from './examples';

/** 主角固定技能「间章:小憩」。旧缓存里的近似编译（延迟任务）在读取时统一替换，不改编译版本、不要求重新整备。 */
export const INTERLUDE_SUMMARY='战斗中使用后，在使用回合的下下回合开始时，我方所有存活成员必定撤离，不会被打断或失败；战斗外立即离开。';
export const isInterludeName=(name:string)=>/^\s*间章\s*[:：]\s*小憩\s*$/.test(name);
export const isInterludeAction=(a:ActionSpec|null|undefined)=>!!a?.tags?.includes(INTERLUDE_TAG);
export function interludeAction(name:string,old?:ActionSpec|null):ActionSpec{
 const a=structuredClone(INTERLUDE_REST);a.name=old?.name??name;if(old?.cost)a.cost=structuredClone(old.cost);if(old?.source)a.source=structuredClone(old.source);a.description=INTERLUDE_SUMMARY;return a;
}
type Skill={sourceId:string;name:string;mapping:{disposition:string;action?:ActionSpec|null;reason:string;fidelity?:{mode:string;summary:string;clauses:{original:string;implementation:string}[];changes:{implemented:string}[]}};adaptation?:{summary?:string}};
export function normalizeInterlude<T extends Skill>(skill:T):T{
 if(!isInterludeName(skill.name)||skill.mapping.disposition!=='active'||isInterludeAction(skill.mapping.action))return skill;
 skill.mapping.action=interludeAction(skill.name,skill.mapping.action);skill.mapping.reason=INTERLUDE_SUMMARY;
 if(skill.mapping.fidelity){skill.mapping.fidelity.summary=INTERLUDE_SUMMARY;for(const c of skill.mapping.fidelity.clauses)c.implementation=INTERLUDE_SUMMARY;for(const c of skill.mapping.fidelity.changes)c.implemented=INTERLUDE_SUMMARY;}
 if(skill.adaptation)skill.adaptation.summary=INTERLUDE_SUMMARY;
 return skill;
}
