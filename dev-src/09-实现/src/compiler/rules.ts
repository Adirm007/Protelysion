import {HOST_RULE_DATA,HOST_RULE_SOURCE_SHA256} from './host-rule-data';
import type {Obj} from '../core/actors';
export type RuleReference={id:string;title:string;keys:string[];text:string};
export type Rules={numericOnlySpecies:Record<string,string>;references?:RuleReference[];sourceHash?:string};
export const HOST_RULES:Rules={numericOnlySpecies:{},references:HOST_RULE_DATA,sourceHash:HOST_RULE_SOURCE_SHA256};
export function relevantRules(source:Obj,rules:Rules):RuleReference[]{
 const species=typeof source.种族==='string'?source.种族.trim():'';if(!species)return [];const configured=rules.numericOnlySpecies[species];
 const matches=(rules.references??[]).filter(r=>r.title.includes('种族')&&(r.title.includes(species)||r.keys.includes(species))&&!/种族繁衍|种族血脉|概览|开始|结束/.test(r.title));
 if(configured)matches.push({id:'configured:'+species,title:species,keys:[species],text:configured});
 return matches;
}
export function ascensionRules(rules:Rules):RuleReference[]{return (rules.references??[]).filter(r=>r.title.includes('登神长阶'));}
