/** 离线重降级（探针，不进 docs）：把 blueprint-model-baseline 保存的原始模型蓝图用当前代码重新降级，不发任何模型请求。
 * npx tsx scripts/blueprint-model-relower.ts <sources.json> <out.json> <baseline.json>...
 * 用于验证降级器/宿主规则补全修复对真实模型输出的效果。 */
import {readFileSync,writeFileSync} from 'node:fs';
import {sourceEntries} from '../src/compiler/engine';
import {HOST_RULES} from '../src/compiler/rules';
import {combatProjection} from '../src/core/cache';
import {modelBlueprintMapping,localBlueprint} from '../src/compiler/blueprint/compile';
import type {Blueprint} from '../src/compiler/blueprint/types';

type Row={uid:number;card:string;sourceId:string;text:string;model:{blueprint:Blueprint[]}|null};
const [srcPath,outPath,...inputs]=process.argv.slice(2);
const cards=new Map((JSON.parse(readFileSync(srcPath!,'utf8')) as {uid:number;source:Record<string,unknown>}[]).map(c=>[c.uid,c.source]));
const rows:unknown[]=[];let returned=0,lowered=0,original=0,approximate=0,fellBack=0;
for(const file of inputs){
 for(const r of (JSON.parse(readFileSync(file,'utf8')) as {rows:Row[]}).rows){
  const source=combatProjection(structuredClone(cards.get(r.uid)) as never);
  const e=sourceEntries(source,HOST_RULES).find(x=>x.sourceId===r.sourceId);if(!e)continue;
  const bps=r.model?.blueprint??[];
  const m=bps.length?modelBlueprintMapping(e,source,HOST_RULES,{main:bps[0]!,extra:bps.slice(1),notes:[]}):undefined;
  const l=localBlueprint(e,source,HOST_RULES);
  if(bps.length)returned++;if(m){lowered++;if(m.adaptation.mode==='original')original++;else approximate++;}else if(bps.length&&l)fellBack++;
  rows.push({uid:r.uid,card:r.card,sourceId:r.sourceId,text:r.text,
   model:m?{mode:m.adaptation.mode,summary:m.mapping.fidelity?.summary,changes:m.mapping.fidelity?.changes.map(x=>x.implemented)}:null,
   local:l?{mode:l.adaptation.mode,summary:l.mapping.fidelity?.summary}:null});
 }
}
writeFileSync(outPath!,JSON.stringify(rows,null,1));
console.log(JSON.stringify({entries:rows.length,modelReturned:returned,modelLowered:lowered,modelOriginal:original,modelApproximate:approximate,fellBackToLocal:fellBack}));
