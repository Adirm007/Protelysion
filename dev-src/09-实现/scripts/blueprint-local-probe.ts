/** 探针：对语料卡的每个来源条目运行 本地解析 → 降级 → 合同校验，输出覆盖统计。
 * npx tsx scripts/blueprint-local-probe.ts <sources.json> <out.txt> */
import {readFileSync,writeFileSync} from 'node:fs';
import {sourceEntries} from '../src/compiler/engine';
import {HOST_RULES} from '../src/compiler/rules';
import {hostSkillScale} from '../src/compiler/host-skill-scale';
import {parseEntry} from '../src/compiler/blueprint/parse';
import {lowerBlueprint} from '../src/compiler/blueprint/lower';
import {describeBlueprint} from '../src/compiler/blueprint/describe';
import {validateAction} from '../src/compiler/contract';
import {assertExecutable,assertPassive} from '../src/battle/executor';
import {sourceText} from '../src/compiler/source-text';
const list=JSON.parse(readFileSync(process.argv[2]!,'utf8')) as {uid:number;name:string;source:Record<string,unknown>}[];
const out:string[]=[];const stat={entries:0,parsed:0,none:0,failed:0,qualitative:0,race:0};
for(const c of list){
 const es=sourceEntries(c.source as never,HOST_RULES);const level=Number(c.source.等级)||1;const sc=hostSkillScale(level,HOST_RULES);
 const attrs=Object.fromEntries(['力量','敏捷','体质','智力','精神'].map(k=>[k,Number((c.source.属性 as Record<string,unknown>|undefined)?.[k])||10])) as never;
 out.push(`##### ${c.uid} ${c.name} Lv${level} T${sc.tier} power=${sc.power} cost=${sc.cost}`);
 for(const e of es){
  stat.entries++;if(e.sourceId.startsWith('/种族/')){stat.race++;continue;}
  const ctx={name:e.name,sourceId:e.sourceId,level,tier:sc.tier,power:sc.power,cost:sc.cost};
  let r;try{r=parseEntry(e as never,ctx);}catch(err){stat.failed++;out.push(`!!! ${e.sourceId} PARSE ${(err as Error).stack?.split('\n').slice(0,3).join(' | ')}`);continue;}
  if(!r){stat.none++;out.push(`--- ${e.sourceId}  [无解析]\n    ${sourceText(e.raw).replace(/\n/g,' ').slice(0,300)}`);continue;}
  if(r.notes.some(n=>n.startsWith('原文没有可定量')))stat.qualitative++;
  const lines:string[]=[];let ok=true;
  for(const [i,bp] of [r.main,...r.extra].entries()){
   try{const low=lowerBlueprint(bp,{key:'k'+i,sourceId:e.sourceId,name:bp.name??e.name,level,tier:sc.tier,power:sc.power,cost:sc.cost,attributeFactor:sc.attributeFactor,attributes:attrs,passive:bp.kind==='passive'});
    const a=validateAction(low.action);if(low.disposition==='passive')assertPassive(a);else assertExecutable(a);
    lines.push(`  ${bp.kind} ${describeBlueprint(bp).replace(/\n/g,' / ').slice(0,400)}${low.notes.length?'  {'+low.notes.join('；').slice(0,200)+'}':''}`);
   }catch(err){ok=false;lines.push(`  !!! ${bp.kind} ${(err as Error).message.slice(0,300)}  BP=${JSON.stringify(bp).slice(0,400)}`);}
  }
  if(ok)stat.parsed++;else stat.failed++;
  out.push(`--- ${e.sourceId}${r.notes.length?'  <'+r.notes.join('；')+'>':''}\n    ${sourceText(e.raw).replace(/\n/g,' ').slice(0,260)}\n${lines.join('\n')}`);
 }
}
writeFileSync(process.argv[3]!,out.join('\n'));console.log(JSON.stringify(stat));
