import {ATTRIBUTES,tier,integer} from '../../core/actors';
import type {CompiledActor} from '../../compiler/engine';
import type {MonsterDesign,Build} from './catalog';
export const MONSTER_CONTENT_VERSION='booksea-monsters/0.25.0';
export const TIER_START=[1,5,9,13,17,21,25] as const;
export const ATTRIBUTE_LIMIT=[8,10,12,14,16,18,20] as const;
export const HP_MULTIPLIER=[1,2,4,10,20,40,100] as const;
export const RESOURCE_MULTIPLIER=[1,2.5,6,15,35,80,160] as const;
export const SKILL_POWER=[75,160,420,1150,3100,6500,6500] as const;
export const SKILL_COST=[25,160,450,1600,4800,11000,11000] as const;
export const SKILL_RECOVERY=[60,225,650,1600,3600,8000,8000] as const;
export const QUALITY_PERCENT=[.04,.07,.105,.145,.20,.28,.28] as const;
const BASE:Record<Build,number[]>={brute:[5,2,5,1,2],hunter:[4,5,3,1,2],caster:[1,2,3,5,4],guard:[3,1,6,2,3],swarm:[2,4,3,3,3],spirit:[1,3,2,4,5]};
/** Weighted water filling: all points are spent, neither the talent cap nor NPC cap is exceeded. */
function distribute(values:number[],points:number,cap:number,weights:number[]){
 for(let p=0;p<points;p++){
  const choices=values.map((v,i)=>({i,score:weights[i]!/(v+1)})).filter(x=>values[x.i]!<cap).sort((a,b)=>b.score-a.score||a.i-b.i);
  if(!choices.length)throw Error('NPC point budget cannot fit the host cap');
  values[choices[0]!.i]!++;
 }
 return values;
}
export function monsterNumbers(m:MonsterDesign,displayLevel:number){
 integer(displayLevel,'怪物挑战等级',1);
 const kitLevel=Math.min(25,displayLevel),lifeTier=tier(kitLevel),weights=BASE[m.build];
 const talentBudget=m.role==='Boss'?25:m.role==='精英'?20:15;
 const talent=distribute([...weights],talentBudget-15,6,weights);
 const attrs=distribute(talent.map(n=>n+lifeTier-1),kitLevel-1,ATTRIBUTE_LIMIT[lifeTier-1]!,weights);
 const attributes=Object.fromEntries(ATTRIBUTES.map((a,i)=>[a,attrs[i]!])) as CompiledActor['numeric']['attributes'];
 const [str,dex,con,int,spi]=attrs as [number,number,number,number,number],sum=attrs.reduce((s,n)=>s+n,0);
 const base={hp:con*100*HP_MULTIPLIER[lifeTier-1]!+sum,mp:(int+spi)*50*RESOURCE_MULTIPLIER[lifeTier-1]!,sp:(str+dex)*50*RESOURCE_MULTIPLIER[lifeTier-1]!};
 // Content-budget saturation prevents unsafe floats in very deep infinite runs. It is NOT an eighth tier.
 // Suppression is independently applied by the damage pipeline once, never baked into these values.
 const n=displayLevel-kitLevel,attackGrowth=Math.exp(Math.min(n*Math.log(1.05),Math.log(10000)));
 const hpGrowth=Math.exp(Math.min(n*Math.log(1.08),Math.log(1e10/base.hp)));
 const resourceGrowth=Math.exp(Math.min(n*Math.log(1.05),Math.log(1e10/Math.max(base.mp,base.sp))));
 const max={hp:Math.floor(base.hp*hpGrowth),mp:Math.floor(base.mp*resourceGrowth),sp:Math.floor(base.sp*resourceGrowth)};
 return {displayLevel,kitLevel,lifeTier,talentBudget,talent:Object.fromEntries(ATTRIBUTES.map((a,i)=>[a,talent[i]!])) as typeof attributes,extraPointBudget:kitLevel-1,base,attributes,max,challengeGrowth:{hp:hpGrowth,resource:resourceGrowth,attack:attackGrowth,saturated:n>0&&(attackGrowth>=9999.999||max.hp>=9999999999||Math.max(max.mp,max.sp)>=9999999999)}};
}
export type MonsterNumbers=ReturnType<typeof monsterNumbers>;
