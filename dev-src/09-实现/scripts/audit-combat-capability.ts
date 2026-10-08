/** Current executable evidence. The earlier 11 gap witnesses remain archived under combat-audit-20260922. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {CAPABILITIES,MAX_ATTACK_BEATS,ROUND_MS,EFFECT_VERSION,TriggerPoint} from '../src/compiler/contract';
import {COMPILER_ID} from '../src/compiler/engine';
import {ADVANCED_EXAMPLES} from '../src/compiler/advanced-examples';
const root=fileURLToPath(new URL('../',import.meta.url)),folder=new URL('../verification/mechanics-expansion-20260922/',import.meta.url);mkdirSync(folder,{recursive:true});
const run=spawnSync(process.execPath,['--import','tsx','--test','tests/semantic-expansion.test.ts'],{cwd:root,encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});
writeFileSync(new URL('semantic-tests.log',folder),(run.stdout??'')+(run.stderr??''));assert.equal(run.status,0,'新增语义用例未通过，不能生成通过报告');
const tests=Number(run.stdout.match(/# tests (\d+)/)?.[1]),passes=Number(run.stdout.match(/# pass (\d+)/)?.[1]);assert.ok(tests>0&&tests===passes);assert.match(run.stdout,/# fail 0/);
const source=readFileSync(new URL('../../02-宿主参考-只读/反派角色.json',import.meta.url)),hash=createHash('sha256').update(source).digest('hex');assert.equal(hash,'7686bf1972d3847ef50c70053452884b53786339a70d2c85f6e872a02e86fb36');
const report={date:'2026-09-22',compiler:COMPILER_ID,effects:EFFECT_VERSION,implementedSampleSuitePassed:true,tests,passes,operations:Object.keys(CAPABILITIES),triggerPoints:TriggerPoint.json.enum,limits:{maxAttackBeats:MAX_ATTACK_BEATS,expressionTokens:48,effectSteps:1024,roundMs:ROUND_MS},sourceWorldbookUnchanged:true,sourceSha256:hash,cases:[...run.stdout.matchAll(/# Subtest: (.+)/g)].map(m=>m[1]),teachingExamples:ADVANCED_EXAMPLES,scope:'人工编写声明式程序＋模拟模型返回的编译管线测试；真实模型请求0，真实玩家卡/聊天/资源/结算操作0。教学例子不自动授予角色。不是整本世界书已完成真实模型保真编译。',formalThemes:48,formalMonsterCatalog:432,formalTemplateAcceptance:'not_run'};
writeFileSync(new URL('capability-report.json',folder),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({tests,passes,operations:report.operations.length,maxAttackBeats:MAX_ATTACK_BEATS,compiler:COMPILER_ID,sourceWorldbookUnchanged:true,externalModelRequests:0}));
