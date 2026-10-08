import {MONSTER_BY_ID} from '../game/monsters/catalog';
export function enemyArtId(unit:{id:string;owner?:string},units:readonly {id:string;owner?:string}[],foes:readonly string[]):string {
 const seen=new Set<string>();let current:typeof unit|undefined=unit;
 while(current){
  if(seen.has(current.id))return '';seen.add(current.id);
  if(!current.owner){const match=/^enemy-(\d+)$/.exec(current.id);const runtimeId=match?foes[Number(match[1])]??'':'';return MONSTER_BY_ID[runtimeId]?.designId??runtimeId;}
  current=units.find(u=>u.id===current!.owner);
 }
 return '';
}
