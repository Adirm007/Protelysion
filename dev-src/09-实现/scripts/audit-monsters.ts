import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {MONSTER_ROSTER,MONSTER_THEMES} from '../src/game/monsters/catalog';
import {monsterKit} from '../src/game/monsters/kits';
import {ATTRIBUTE_LIMIT,MONSTER_CONTENT_VERSION,monsterNumbers,TIER_START} from '../src/game/monsters/numbers';
import {validateCompiled} from '../src/compiler/engine';
import {createBattle,chooseAction,resolveAction,advanceBattle,legalTargets,actionUnavailable,type Battle} from '../src/battle/executor';
import {bareMitigation,contentCard,strike} from '../src/game/content';
import {decide} from '../src/game/combat-ai';
import type {ActionSpec} from '../src/compiler/contract';
export function mechanicsHash(value:unknown):string{
 const ignore=new Set(['name','description','source','sourceId','sourceFingerprint','rulesFingerprint','version','effectVersion','quality','reason','motif']);
 const prune=(v:unknown):unknown=>typeof v==='number'?'#':typeof v==='string'?v.replace(/T\d{2}_[NEB]\d{2}/g,'SPECIES').replace(/monster:SPECIES:t\d+:/g,'monster:SPECIES:'):Array.isArray(v)?v.filter(x=>typeof x!=='string'||!/^monster:(fang|venom|pounce|guard|mend|shot|spore|cleave|frenzy|ram|exchange|seal|ember|chain|curse|hex|drain|snare|mirror|pledge|rift|chime|silence|mark|fate|veil|collect|shock|clock|sever|erase|gravity|echo|swarm|frost)$/.test(x)).map(prune):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>!ignore.has(k)).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,prune(x)])):v;
 return createHash('sha256').update(JSON.stringify(prune(value))).digest('hex');
}
export function makeProbe(id:string,level:number){
 const k=monsterKit(id,level),dummy=contentCard(Math.min(level,25),1e9,18,{probe:{...strike(1),castMs:0,copyable:true}});
 dummy.numeric.max.mp=1e9;dummy.numeric.max.sp=1e9;
 return createBattle([{id:'npc',name:k.name,side:'enemy',card:k.card,combatLevel:level,current:{...k.card.numeric.max},mitigation:k.mitigation},{id:'dummy',side:'ally',card:dummy,current:{...dummy.numeric.max},mitigation:bareMitigation()}],17);
}
/** Uses real submit/cast/resolve. No zeroing of costs, per-battle limits or authored cast times. */
export function fire(b:Battle,id:string,key:string,targetIds?:string[]):Battle{
 b=structuredClone(b);const u=b.units.find(x=>x.id===id)!,a=u.actions[key]!;
 for(const c of b.clock.units){c.atb=0;c.recoveryMs=0;c.cast=null;}
 b.clock.ended=false;b.clock.paused=false;b.clock.units.find(x=>x.id===id)!.atb=100;b.clock.pending=[{kind:'ready',unitId:id}];
 const targets=targetIds??legalTargets(b,u,a).slice(0,a.targeting?.count??1).map(x=>x.id);
 const reason=actionUnavailable(b,u,key,targets);if(reason)throw Error(key+': '+reason);
 b=chooseAction(b,id,key,targets);
 if(b.clock.pending[0]?.kind!=='resolve')b=advanceBattle(b,Math.ceil(a.castMs*4+100)).battle;
 if(b.clock.pending[0]?.kind!=='resolve')throw Error('Authored cast failed to reach resolve: '+key+' '+JSON.stringify(b.clock.pending));
 return resolveAction(b);
}
function csvCell(x:unknown){return '"'+String(x??'').replaceAll('"','""')+'"';}
export function audit(fullExecution=true){
 const output='verification/monster-kits-017';mkdirSync(output,{recursive:true});
 const formal=readFileSync('../01-计划与制作清单/怪物设计名录.csv','utf8').trim().split(/\r?\n/).slice(1);
 assert.equal(formal.length,432);assert.equal(MONSTER_ROSTER.length,432);assert.equal(MONSTER_THEMES.length,48);
 MONSTER_ROSTER.forEach((m,i)=>{const cells=formal[i]!.split(',');assert.equal(m.designId,cells[0]);assert.equal(m.name,cells[3]);});
 const rows:Record<string,unknown>[]=[],executionFailures:{id:string;level:number;action:string;error:string}[]=[],csv:string[]=[],compiled:string[]=[];
 csv.push(['物种ID','原名录ID','主题','名称','定位','层级','模板等级','品质','力量','敏捷','体质','智力','精神','HP','MP','SP','常规技能','要素数','权能数','法则数','神位','神国','登神能力','物种机制核','反制','技能费用与说明JSON'].map(csvCell).join(','));
 let numericCases=0,executed=0,unavailable=0,aiDecisions=0;
 const fingerprints=new Map<string,Set<string>>(),structureByTier=Array.from({length:7},()=>new Set<string>());
 for(const m of MONSTER_ROSTER){
  for(let lv=1;lv<=25;lv++){
   const n=monsterNumbers(m,lv),attrs=Object.values(n.attributes),talent=Object.values(n.talent);
   assert.equal(talent.reduce((a,b)=>a+b,0),n.talentBudget);assert.ok(talent.every(x=>x>=0&&x<=6));
   assert.equal(attrs.reduce((a,b)=>a+b,0),n.talentBudget+5*(n.lifeTier-1)+lv-1);
   assert.ok(attrs.every(x=>Number.isInteger(x)&&x<=ATTRIBUTE_LIMIT[n.lifeTier-1]!));numericCases++;
  }
  for(const level of TIER_START){
   const k=monsterKit(m.id,level);try{validateCompiled(k.card);}catch(e){throw Error(m.id+' Lv'+level+' '+String(e));}
   assert.equal(k.regular.length,Math.min(7,k.numbers.lifeTier+1));
   const hash=mechanicsHash(k.card.skills.map(x=>x.mapping)),set=fingerprints.get(m.id)??new Set<string>();set.add(hash);fingerprints.set(m.id,set);structureByTier[k.numbers.lifeTier-1]!.add(hash);
   let actions=0;
   if(fullExecution){
    // A real prior attack gives copy/replay something legal to copy. Any triggered law response is itself exercised.
    let initial=makeProbe(m.id,level);initial=fire(initial,'dummy','probe',['npc']);
    const brain=structuredClone(initial),decision=decide(brain,brain.units.find(x=>x.id==='npc')!);assert.notEqual(decision.skill,'booksea:wait');fire(brain,'npc',decision.skill,decision.targets);aiDecisions++;
    const dry=structuredClone(initial),actor=dry.units.find(x=>x.id==='npc')!;actor.current.mp=actor.current.sp=0;const fallback=decide(dry,actor);assert.ok(actor.actions[fallback.skill]!.effects.some(e=>e.op==='damage'));fire(dry,'npc',fallback.skill,fallback.targets);aiDecisions++;
    for(const [key,a] of Object.entries(initial.units.find(x=>x.id==='npc')!.actions)){
     if(key.startsWith('booksea:'))continue;
     const u=initial.units.find(x=>x.id==='npc')!;
     if(actionUnavailable(initial,u,key)){unavailable++;continue;}
     try{
      const result=fire(initial,'npc',key);assert.equal(result.units.find(v=>v.id==='npc')!.used[key],(u.used[key]??0)+1);
      for(const v of result.units)for(const value of Object.values(v.current))assert.ok(Number.isFinite(value)&&value>=0);
      const ticking=structuredClone(result);ticking.clock.pending=[];advanceBattle(ticking,100);
      actions++;executed++;
     }catch(e){executionFailures.push({id:m.id,level,action:key,error:String(e)});}
    }
   }
   compiled.push(JSON.stringify({id:m.id,level,card:k.card}));
   const skillDetails=k.card.skills.map(x=>({name:x.name,kind:x.mapping.action?.source?.kind,quality:x.mapping.action?.source?.quality,disposition:x.mapping.disposition,cost:x.mapping.action?.cost,uses:x.mapping.action?.perBattleUses,description:x.mapping.action?.description}));
   rows.push({id:m.id,level,lifeTier:k.numbers.lifeTier,regular:k.regular.length,laws:k.laws,kingdom:k.divineKingdom,hash,executedActions:actions});
   csv.push([m.id,m.designId,m.theme,m.name,m.role,k.numbers.lifeTier,level,k.quality,...Object.values(k.numbers.attributes),...Object.values(k.numbers.max),k.regular.join(' / '),k.elements,k.authorities,k.laws,k.divinePosition,k.divineKingdom,k.ascended.join(' / '),m.cores.join('+'),k.counterplay.join('；'),JSON.stringify(skillDetails)].map(csvCell).join(','));
  }
  assert.equal(fingerprints.get(m.id)!.size,7,'Cross-tier mechanics collapsed: '+m.id);
  if(m.id.endsWith('B01'))console.log('THEME',m.theme,'templates',rows.length,'executed',executed,'failures',executionFailures.length);
 }
 const summary={version:MONSTER_CONTENT_VERSION,themes:48,species:432,templates:rows.length,numericCases,aiDecisions,executedActions:executed,unavailableActions:unavailable,failures:executionFailures.length,distinctMechanicsByTier:structureByTier.map(x=>x.size),crossTierDistinctSpecies:fingerprints.size,realModelFullCharacterAcceptance:0,fullExecution};
 writeFileSync(output+'/coverage.json',JSON.stringify({summary,executionFailures,rows},null,2)+'\n');
 writeFileSync('../01-计划与制作清单/48主题怪物七层级战斗模板.csv','\ufeff'+csv.join('\n')+'\n');
 writeFileSync(output+'/compiled-templates.jsonl.gz',gzipSync(compiled.join('\n')+'\n'));
 writeFileSync(output+'/summary.json',JSON.stringify(summary,null,2)+'\n');
 console.log(JSON.stringify(summary));if(executionFailures.length)throw Error('Template execution failures: '+executionFailures.length+' (see coverage.json)');return summary;
}
if(process.argv[1]?.endsWith('audit-monsters.ts'))audit(!process.argv.includes('--structure-only'));
