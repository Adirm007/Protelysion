import {actorAt,object,type Obj,type ActorRef} from '../core/actors';
import {sourceGrowth} from './source-growth';
/** Reuses generated host algorithms, running ONLY on the selected participant. No global VARIABLE_UPDATE broadcast. */
export function growParticipant(mvu:Obj,ref:ActorRef,experience:number,lodash:unknown):Obj{
 const next=structuredClone(mvu);if(experience===0)return next;
 const actor=actorAt(next,ref),before=structuredClone(next);
 if(ref.kind==='player'){
  actor.累计经验值=Number(actor.累计经验值)+experience;
  sourceGrowth(lodash,next,before).player();
 }else{
  const date=next.date===undefined?{}:object(next.date),npcs=date.npcs===undefined?{}:object(date.npcs);
  const existing=npcs[ref.name] as Obj|undefined;
  const threshold=sourceGrowth(lodash,next,before).threshold;
  const ledger=existing?structuredClone(existing):{level:actor.等级,exp:Number(threshold(Number(actor.等级)-1)),required_exp:threshold(actor.等级)};
  ledger.exp=Math.max(Number(ledger.exp),Number(threshold(Number(actor.等级)-1)))+experience;
  const work={...next,stat_data:{...object(next.stat_data),关系列表:{[ref.name]:actor}},date:{...date,npcs:{[ref.name]:ledger}}};
  sourceGrowth(lodash,work,before).npcs();
  next.date={...date,npcs:{...npcs,...work.date.npcs},...((work.date as Obj).levelUpNpcs?{levelUpNpcs:(work.date as Obj).levelUpNpcs}:{})};
  object(object(next.stat_data).关系列表)[ref.name]=work.stat_data.关系列表[ref.name];
 }
 return next;
}
