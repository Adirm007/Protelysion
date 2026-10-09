import {isAlive,actionUnavailable,legalTargets,neediest,hostileTo,type Battle,type Unit} from '../battle/executor';
import {roll} from '../battle/damage';
import type {ActionSpec,EffectSpec} from '../compiler/contract';
/** Finite look-ahead into the same bound IR library, including delayed/sequence attacks.
 * This estimates utility; it never executes effects, spends resources, or rolls combat checks. */
function effectUtility(b:Battle,u:Unit,target:Unit,effects:EffectSpec[],preference:string,seen=new Set<string>(),depth=0):number {
 if(depth>5)return 0;let score=0;
 const child=(id:string)=>{if(seen.has(id))return 0;const a=u.library?.actions[id];if(!a)return 0;return effectUtility(b,u,target,a.effects,preference,new Set([...seen,id]),depth+1);};
 for(const e of effects){
  const t=e.targeting?.side==='self'?u:target;
  // 0.38.1 敌我两用：只对所选敌人/同伴生效的部分，目标阵营不符时不计分（不会“奶敌人、打队友”）。
  const foe=hostileTo(b,u,target);if(e.targeting?.selection==='manual'&&(e.targeting.side==='enemy'&&!foe||e.targeting.side==='ally'&&foe))continue;
  if(e.conditions?.some(c=>c.kind==='side'&&(c.subject??'caster')==='target'&&(c.key==='opposite'||c.key==='same')&&((c.key==='opposite')!==foe)!==!!c.invert))continue;
  if(e.conditions?.some(c=>c.kind==='tag'&&c.compare==='gte'&&!c.invert&&!t.tags?.includes(c.key??'')&&!t.statuses?.some(s=>!s.suppressed&&s.definition.tags.includes(c.key??''))))continue;
  if(e.op==='damage')score+=20+(1-t.current.hp/Math.max(1,t.max.hp))*20+(preference==='strike'?5:0);
  if(e.op==='heal'){const r=e.adaptive?neediest(t):e.resource;score+=(1-t.current[r]/Math.max(1,t.max[r]))*60+(preference==='heal'?5:0);}
  if(e.op==='revive'&&!isAlive(t))score+=100;
  if(e.op==='shield')score+=Math.max(0,15-t.shields.filter(s=>!s.suppressed).length*10)+(preference==='shield'?8:0);
  if(e.op==='apply_status')score+=(t.statuses??[]).some(s=>!s.suppressed&&s.definitionId===e.status)?1:20;
  if(e.op==='cast')score+=b.clock.units.find(c=>c.id===t.id)?.cast?50:1;
  if(e.op==='resource')score+=e.mode==='burn'?t.current[e.resource]/Math.max(1,t.max[e.resource])*25:10;
  if(e.op==='summon')score+=b.units.filter(x=>x.owner===u.id&&isAlive(x)).length<2?30:0;
  if(e.op==='field')score+=(b.fields??[]).some(f=>f.definition===e.field)?1:20;
  if(e.op==='atb'||e.op==='uses'||e.op==='speed'||e.op==='modify')score+=12;
  if(e.op==='rule'||e.op==='source'||e.op==='space')score+=18;
  if(e.op==='copy'||e.op==='replay')score+=t.history?.length?22:0;
  if(e.op==='dispel')score+=Math.min(4,t.statuses?.filter(s=>!s.suppressed&&(e.polarity==='any'||s.definition.polarity===e.polarity)).length??0)*10;
  if(e.op==='sequence'||e.op==='repeat')score+=child(e.action);
  if(e.op==='time')score+=e.action?child(e.action)+8:18;
  if(e.op==='branch')score+=Math.max(child(e.then),e.otherwise?child(e.otherwise):0)*.8;
  if(e.op==='check')score+=Math.max(child(e.success),e.failure?child(e.failure):0)*.8;
  if(e.op==='choose')score+=Math.max(0,...e.actions.map(child))*.8;
 }
 return score;
}
/** 召唤体系的集火偏好（仅对伤害类动作）：默认优先打召唤师；召唤物是坦克（高血/守卫构型）时绕过它直打召唤师；
 * 召唤物是脆皮输出时先清掉它。嘲讽由状态强制目标，不在这里处理。 */
export function summonFocus(b:Battle,t:Unit):number{
 const hasDamage=(x:Unit)=>Object.values(x.actions).some(a=>a.category!=='command'&&a.effects.some(e=>e.op==='damage'||e.op==='sequence'||e.op==='repeat'));
 const kind=(s:Unit,owner:Unit)=>{const tank=s.tags?.includes('build:guard')||s.tags?.includes('taunt')||s.max.hp>=owner.max.hp*.8;if(tank)return 'tank';return hasDamage(s)&&s.max.hp<owner.max.hp*.5?'glass':'other';};
 if(t.owner){const owner=b.units.find(x=>x.id===t.owner);if(!owner||!isAlive(owner))return 0;const k=kind(t,owner);return k==='glass'?18:k==='tank'?-15:-6;}
 const summons=b.units.filter(x=>x.owner===t.id&&isAlive(x));if(!summons.length)return 0;
 return summons.some(x=>kind(x,t)==='glass')?4:10;
}
export function decide(b:Battle,u:Unit,preference='strike'):{skill:string;targets:string[]}{
 // 失控（0.31）：被 charm 的单位由这里代打；legalTargets 已按阵营反转，这里只保证“优先用带伤害的技能打原队友，其次普攻”，不逃跑、不奶敌。
 const charmed=(u.statuses??[]).some(s=>s.definition.control==='charm'&&!s.suppressed);
 if(charmed)preference='strike';
 if(preference==='escape'&&u.current.hp/u.max.hp<.3){const r=roll(b.seed);b.seed=r.seed;if(r.value<.6)return {skill:'__flee__',targets:[]};}
 const choices:{skill:string;targets:string[];score:number}[]=[];
 // 脚本连段（0.30）：带 ai:rot:N 标签的技能按固定环出招，环位由已使用次数推出（无额外状态，跨阶段不重置）。
 const ring=Object.entries(u.actions).filter(([,a])=>a.tags?.some(t=>t.startsWith('ai:rot:')));
 let step=-1;if(ring.length){const len=Math.max(1,Number(ring[0]![1].tags!.find(t=>t.startsWith('ai:rotlen:'))?.slice(10)??ring.length));step=ring.reduce((n,[id])=>n+(u.used?.[id]??0),0)%len;}
 const foes=b.units.filter(x=>x.side!==u.side&&isAlive(x));const foeBuffs=foes.reduce((n,x)=>n+(x.statuses??[]).filter(s=>!s.suppressed&&s.definition.polarity==='positive').length,0);
 for(const [skill,a] of Object.entries(u.actions)){
  if(actionUnavailable(b,u,skill))continue;const candidates=legalTargets(b,u,a).filter(t=>(a.targeting?.side??a.target)!=='enemy'||hostileTo(b,u,t));if(!candidates.length)continue;
  for(const t of candidates){let score=skill==='booksea:wait'?.01:skill==='booksea:guard'?.5:0;
   score+=effectUtility(b,u,t,a.effects,preference);
   if(a.tags?.includes('monster:regular')||a.tags?.includes('monster:unique'))score+=7;
   const rot=a.tags?.find(t=>t.startsWith('ai:rot:'));if(rot&&step>=0)score+=Number(rot.slice(7))===step?120:-30;
   if(a.target==='enemy'&&(a.targeting?.selection==='all'||a.effects.some(e=>e.targeting?.selection==='all'&&e.targeting.side==='enemy')))score+=5*Math.max(0,foes.length-1);
   if(a.tags?.includes('ai:charge'))score+=foeBuffs>=3||foes.some(x=>x.current.hp/Math.max(1,x.max.hp)<.4)?20:0;
   if(a.tags?.includes('ai:guaranteed')&&((t.stats as {evade?:number}|undefined)?.evade??0)>=.5)score+=25;
   if(a.tags?.includes('ai:percent'))score+=t.current.hp/Math.max(1,t.max.hp)>.6?20:-10;
   if(a.tags?.includes('ai:mimic')&&!t.history?.length)score=-100;
   if(a.tags?.includes('ai:defence'))score+=u.current.hp/u.max.hp<.65?30:-12;
   if(a.tags?.includes('ai:purge'))score+=(t.statuses??[]).some(s=>s.definition.polarity==='positive'&&!s.suppressed)?25:-15;
   if(a.tags?.includes('ai:law')||a.tags?.includes('ai:authority'))score+=u.current.hp/u.max.hp<.8?35:-20;
   if(a.tags?.includes('ai:kingdom'))score+=b.units.some(x=>x.owner===u.id&&x.tags?.includes('monster:realm-anchor')&&isAlive(x))?-100:90;
   if(a.tags?.includes('ai:combo')&&t.statuses?.some(s=>!s.suppressed&&s.definition.tags.includes('monster:primer')))score+=25;
   if(t.side!==u.side&&a.effects.some(e=>e.op==='damage'||e.op==='sequence'||e.op==='repeat'))score+=summonFocus(b,t);
   if(charmed){const harmful=a.effects.some(e=>e.op==='damage'||e.op==='resource'&&['subtract','burn'].includes(e.mode));const dual=a.targeting?.side==='any';if(harmful&&a.target==='enemy'&&(!dual||hostileTo(b,u,t)))score+=a.category==='command'?20:60;else if(a.target!=='enemy'||dual)score*=.2;}
   if(a.effects.some(e=>e.op==='copy')&&!t.history?.length)score=-100;
   if(a.perBattleUses&&u.current.hp/u.max.hp>.8)score*=.8;
   if(preference==='low_health'&&a.effects.some(e=>e.op==='damage'))score+=50*(1-t.current.hp/t.max.hp);
   if(preference==='summon'&&a.effects.some(e=>e.op==='summon'))score+=25;
   if(preference==='control'&&a.effects.some(e=>e.op==='apply_status'||e.op==='cast'))score+=20;
   if(preference==='burn'&&a.effects.some(e=>e.op==='resource'&&e.mode==='burn'))score+=25;
   if(preference==='suicide'&&a.suicideCost)score+=u.current.hp/u.max.hp<.3?100:-100;
   if(preference==='combo'&&t.statuses?.length&&a.effects.some(e=>e.op==='damage'))score+=20;
   if(preference==='ranged'&&a.targeting?.range)score+=15;
   if(preference==='charge'&&a.castMs>0)score+=12;
   if(preference==='counter'&&a.effects.some(e=>e.op==='apply_status'||e.op==='shield'))score+=15;
   if(score>0)choices.push({skill,targets:a.targeting?.selection==='manual'&&a.targeting.count&&a.targeting.count>1?candidates.slice(0,a.targeting.count).map(t=>t.id):[t.id],score});
  }
 }
 choices.sort((a,z)=>z.score-a.score);const best=choices.filter(x=>x.score>=((choices[0]?.score??0)*.9));const r=roll(b.seed);b.seed=r.seed;return best[Math.floor(r.value*best.length)]??{skill:'booksea:wait',targets:[u.id]};
}
/** Legacy numeric-only helper; production monsters now use the full monsterKit library. */
export function scaleEnemyAction(a:ActionSpec,level:number):ActionSpec{
 const result=structuredClone(a),n=Math.max(0,level-25),attack=Math.exp(Math.min(n*Math.log(1.05),Math.log(1e12))),hp=Math.exp(Math.min(n*Math.log(1.08),Math.log(1e12)));
 for(const r of ['hp','mp','sp'] as const)result.cost[r].flat*=r==='hp'?hp:attack;
 for(const e of result.effects){if(e.op==='damage')for(const value of Object.values(e.amounts))value.flat*=attack;else if(e.op==='heal'||e.op==='shield')e.amount.flat*=e.op==='heal'&&e.resource!=='hp'?attack:hp;}
 return result;
}

export const AI_TEMPLATES=['strike','ranged','heal','control','summon','charge','counter','low_health','burn','suicide','escape','combo'] as const;
