/** 真实模型蓝图基线（探针，不进 docs）：逐卡按蓝图协议分批请求模型，与本地蓝图逐条对照。
 * npx tsx scripts/blueprint-model-baseline.ts <sources.json> <out.json> <uid,uid,...> [model] [timeoutSec]
 * 模型调用经环境变量 LLM_CALL 指定的脚本（stdin {prompt,max_tokens,timeout,model} → stdout {content|error}），须自行限流 ≤3次/分钟。 */
import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {sourceEntries} from '../src/compiler/engine';
import {HOST_RULES} from '../src/compiler/rules';
import {combatProjection} from '../src/core/cache';
import {modelBlueprints,modelBlueprintMapping,localBlueprint,type BlueprintModel} from '../src/compiler/blueprint/compile';
import {sourceText} from '../src/compiler/source-text';

const [srcPath,outPath,uidArg,model='gemini-3-flash-preview',timeoutArg='150']=process.argv.slice(2);
const uids=new Set(uidArg!.split(',').map(Number));
const cards=(JSON.parse(readFileSync(srcPath!,'utf8')) as {uid:number;name:string;source:Record<string,unknown>}[]).filter(c=>uids.has(c.uid));
const calls:{uid:number;elapsed:number;error?:string;entries:number}[]=[];
const rows:unknown[]=[];
for(const c of cards){
 const source=combatProjection(structuredClone(c.source) as never);
 const entries=sourceEntries(source,HOST_RULES).filter(e=>!e.sourceId.startsWith('/种族/')&&!e.sourceId.startsWith('/状态定义/'));
 const ask:BlueprintModel=async({prompt})=>{
  const r=spawnSync('python3',[process.env.LLM_CALL??'/home/user/work/lib/llm_call.py'],{input:JSON.stringify({prompt,max_tokens:32000,timeout:Number(timeoutArg),model,retries:1}),encoding:'utf8',maxBuffer:64<<20});
  const out=JSON.parse(r.stdout||'{}') as {content?:string;elapsed?:number;error?:string};
  const n=(prompt.slice(prompt.lastIndexOf('条目：')+3).match(/"sourceId"/g)??[]).length;
  calls.push({uid:c.uid,elapsed:Math.round(out.elapsed??0),entries:n,...(out.error?{error:out.error.slice(0,300)}:{})});
  process.stderr.write(`[${c.uid} ${c.name}] batch ${n} → ${out.error?'ERR '+out.error.slice(0,120):Math.round(out.elapsed??0)+'s'}\n`);
  if(out.error)throw Error(out.error);return out.content??'';
 };
 const parsed=await modelBlueprints(entries,source,HOST_RULES,ask);
 for(const e of entries){
  const p=parsed.get(e.sourceId);const m=p?modelBlueprintMapping(e,source,HOST_RULES,p):undefined;const l=localBlueprint(e,source,HOST_RULES);
  rows.push({uid:c.uid,card:c.name,sourceId:e.sourceId,text:sourceText(e.raw).slice(0,600),
   model:p?{ok:!!m,summary:m?.mapping.fidelity?.summary,mode:m?.adaptation.mode,changes:m?.mapping.fidelity?.changes.map(x=>x.implemented),blueprint:[p.main,...p.extra]}:null,
   local:l?{summary:l.mapping.fidelity?.summary,mode:l.adaptation.mode,changes:l.mapping.fidelity?.changes.map(x=>x.implemented)}:null});
 }
 writeFileSync(outPath!,JSON.stringify({model,calls,rows},null,1));
}
const r=rows as {model:{ok:boolean}|null;local:unknown}[];
console.log(JSON.stringify({model,cards:cards.length,entries:r.length,calls:calls.length,callErrors:calls.filter(x=>x.error).length,modelReturned:r.filter(x=>x.model).length,modelLowered:r.filter(x=>x.model?.ok).length,local:r.filter(x=>x.local).length,avgElapsed:Math.round(calls.reduce((a,b)=>a+b.elapsed,0)/Math.max(1,calls.length))}));
