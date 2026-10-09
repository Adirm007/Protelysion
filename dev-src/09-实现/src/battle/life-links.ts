import type {DurationSpec} from '../compiler/contract';
import type {Battle,Unit,Resources} from './executor';
import {isAlive} from './presence';
export type LifeLink={suppressed?:boolean;id:string;key:string;owner:string;sourceRoot:string;members:string[];clock:DurationSpec['clock'];remaining:number;delayRounds:number;recovery:Resources;cleanse:boolean;pending:Record<string,number>;failed:Record<string,boolean>};
export function linkLive(link:LifeLink):boolean{return link.clock==='permanent'||link.remaining>1e-7;}
/** Schedule only if a DIFFERENT linked member can keep the group alive. No immortal corpse loops. */
export function reconcileLifeLinks(b:Battle,revive?:(link:LifeLink,u:Unit)=>boolean):void {
 b.lifeLinks=(b.lifeLinks??[]).filter(linkLive);
 for(const link of b.lifeLinks){const members=link.members.map(id=>b.units.find(u=>u.id===id)).filter((u):u is Unit=>!!u);
  if(link.suppressed||members.length!==link.members.length||!members.some(isAlive)){link.pending={};continue;}
  for(const u of members){
   if(isAlive(u)){delete link.pending[u.id];delete link.failed[u.id];continue;}
   if(u.escaped||link.failed[u.id])continue;
   link.pending[u.id]??=(b.round??0)+link.delayRounds;
   if(revive&&link.pending[u.id]!<=(b.round??0)){
    delete link.pending[u.id];if(!revive(link,u))link.failed[u.id]=true;
   }
  }
 }
}
export function hasLinkedReturn(b:Battle,side:Unit['side']):boolean {
 return (b.lifeLinks??[]).some(l=>linkLive(l)&&!l.suppressed&&Object.keys(l.pending).some(id=>b.units.some(u=>u.id===id&&u.side===side)));
}
