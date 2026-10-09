import {roll} from './damage';
import {speedFactor} from './clock';

export type Claim = {owner:string; priority?:number; profile?:{level:number;speed:number}};
type Profile = {level:number; speed:number};
export type ConflictLedger = {key:string; profiles:Record<string,Profile>; order:string[]}[];
type World = {
 seed:number;
 conflicts?:ConflictLedger;
 units:{id:string;level:number;attributes:{敏捷:number}}[];
 clock:{units:{id:string;agility:number;speedBonus:number;haste:number}[]};
};

/** Character level > effective speed > one seeded, serializable lottery per event.
 * Numeric priority is ONLY an ordering within one issuer, never a cross-actor rank.
 * Build a total ordering once; never call RNG from a sort comparator (A>B>C>A).
 */
export function orderClaims<T extends Claim>(world:World,key:string,claims:readonly T[]):T[] {
 if(claims.length<2)return [...claims];
 const owners=new Set(claims.map(c=>c.owner));
 if(owners.size===1)return [...claims].sort((a,b)=>(b.priority??0)-(a.priority??0));
 world.conflicts??=[];
 let record=world.conflicts.find(x=>x.key===key);
 if(!record){
  const profiles:Record<string,Profile>={};
  for(const u of world.units){const clock=world.clock.units.find(x=>x.id===u.id);
   profiles[u.id]={level:u.level,speed:clock?speedFactor(clock):Math.sqrt(Math.max(u.attributes.敏捷,1)/10)};
  }
  for(const claim of claims)if(!profiles[claim.owner]&&claim.profile)profiles[claim.owner]={...claim.profile};
  for(const id of owners)if(!profiles[id])throw Error('冲突来源不存在: '+id);
  const order=Object.keys(profiles).sort((a,b)=>profiles[b]!.level-profiles[a]!.level||profiles[b]!.speed-profiles[a]!.speed||a.localeCompare(b));
  for(let i=0;i<order.length;){let end=i+1;const p=profiles[order[i]!]!;
   while(end<order.length&&profiles[order[end]!]!.level===p.level&&profiles[order[end]!]!.speed===p.speed)end++;
   for(let j=end-1;j>i;j--){const r=roll(world.seed);world.seed=r.seed;const at=i+Math.floor(r.value*(j-i+1));[order[j],order[at]]=[order[at]!,order[j]!];}
   i=end;
  }
  record={key,profiles,order};world.conflicts.push(record);
  // Bounded event cache. Active event comparisons occur before a later event can evict it.
  if(world.conflicts.length>256)world.conflicts.splice(0,world.conflicts.length-256);
 }
 // Summons or transferred, archived sources can join after the event began.
 for(const c of claims)if(!record.profiles[c.owner]){
  const u=world.units.find(x=>x.id===c.owner),clock=world.clock.units.find(x=>x.id===c.owner);
  const profile=u?{level:u.level,speed:clock?speedFactor(clock):Math.sqrt(Math.max(u.attributes.敏捷,1)/10)}:c.profile;
  if(!profile)throw Error('冲突来源不存在: '+c.owner);record.profiles[c.owner]={...profile};
  let start=record.order.findIndex(id=>{const p=record!.profiles[id]!;return p.level<profile.level||p.level===profile.level&&p.speed<=profile.speed;});if(start<0)start=record.order.length;
  let end=start;while(end<record.order.length){const p=record.profiles[record.order[end]!]!;if(p.level!==profile.level||p.speed!==profile.speed)break;end++;}
  let at=start;if(end>start){const r=roll(world.seed);world.seed=r.seed;at+=Math.floor(r.value*(end-start+1));}record.order.splice(at,0,c.owner);
 }
 return [...claims].sort((a,b)=>a.owner===b.owner?(b.priority??0)-(a.priority??0):record!.order.indexOf(a.owner)-record!.order.indexOf(b.owner));
}
export function winsConflict(world:World,key:string,attempt:Claim,defense:Claim):boolean {
 if(attempt.owner===defense.owner)return (attempt.priority??0)>=(defense.priority??0);
 return orderClaims(world,key,[attempt,defense])[0]===attempt;
}
