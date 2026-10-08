import {HOST_RULES,type Rules} from './rules';
import type {QualitySpec} from './contract';
const names=['普通','优良','稀有','史诗','传说','神话'] as const;
const ids:QualitySpec[]=['common','uncommon','rare','epic','legendary','mythic'];
const short=['普','优','稀','史','传','神'];
/** Parsed from the host worldbook's 核心数值表, not a separate balance table. */
export function hostSkillScale(level:number,rules:Rules=HOST_RULES){
 const table=(rules.references??[]).find(r=>r.title.includes('核心数值表'))??HOST_RULES.references!.find(r=>r.title.includes('核心数值表'))!;
 const section=(heading:RegExp)=>{const at=table.text.search(heading);return table.text.slice(at).split('\n').slice(1).find(l=>short.every(k=>l.includes(k+':')))!;};
 const protocol=(rules.references??[]).find(r=>r.title.includes('战斗协议'))??HOST_RULES.references!.find(r=>r.title.includes('战斗协议'));
 const attributeFactor=Number(protocol?.text.match(/×\s*(\d+)\s*×\s*\[?层级/)?.[1]??10);
 const powers=section(/# (?:攻击技威力|技能威力)/),costs=section(/# 技能消耗/);
 const read=(line:string,label:string)=>{const match=line.match(new RegExp('(?:^|[|\\s])'+label+':(\\d+)-(\\d+)'));if(!match)throw Error('宿主数值表缺少'+label);return [Number(match[1]),Number(match[2])] as const;};
 const rank=Math.min(5,Math.max(0,Math.floor((level-1)/4))),fraction=level>=25?1:Math.max(0,Math.min(1,(level-(rank*4+1))/3));
 const powerRange=read(powers,short[rank]!),costRange=read(costs,short[rank]!);
 return {level,attributeFactor,tier:Math.min(7,Math.floor((level-1)/4)+1),quality:ids[rank]!,qualityName:names[rank]!,powerRange,costRange,power:Math.round(powerRange[0]+fraction*(powerRange[1]-powerRange[0])),cost:Math.round(costRange[0]+fraction*(costRange[1]-costRange[0])),ruleId:table.id,ruleTitle:table.title,level25UsesHighestDefinedQuality:level>=25};
}
