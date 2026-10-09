import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url);
const read=p=>readFile(new URL(p,root));
const sha=data=>createHash('sha256').update(data).digest('hex');
const manifest=JSON.parse(await read('09-实现/release/flow-manifest.json'));
assert.equal(manifest.version,'0.4.0-bridge');
for(const [path,hash] of Object.entries(manifest.sha256))assert.equal(sha(await read('09-实现/release/'+path)),hash,path);
const library=await read('09-实现/release/booksea-flow.mjs');
for(const text of ['fixture-ally','fixture-enemy','联调无特性测试体'])assert.equal(library.includes(Buffer.from(text)),false);
const schema=JSON.parse(await read('09-实现/release/booksea-bridge-schema.json'));
assert.equal(schema.version,'booksea-bridge/1');
const tests=(await read('09-实现/verification/g1-bridge-check.log')).toString();
assert.match(tests,/# tests 144/);assert.match(tests,/# pass 144/);assert.match(tests,/# fail 0/);
const browser=JSON.parse(await read('14-Godot桥接切片/verification/browser-smoke.json'));
assert.equal(browser.passed,true);assert.deepEqual(browser.errors,[]);
for(const path of ['docs/mcp-g1-godot-bridge.md','14-Godot桥接切片/README.md']){
  const text=(await read(path)).toString();assert.equal(text.includes('\r'),false,path);assert.equal(/[ \t]+$/m.test(text),false,path);
}
const status={milestone:'G1-02-minimal-battle-bridge-slice',planVersion:'0.13',implementationVersion:'0.4.0-bridge',
  gameComplete:false,fullG1Complete:false,bridgeVersion:schema.version,transport:'same-page-only',
  validation:{environment:'Windows host / Node 22.17.0 / Godot 4.7.2 / Edge headless',
    baselineTests:125,addedBridgeTests:19,totalTests:144,failedTests:0,typecheck:'passed',build:'passed',
    godotImport:'passed',godotWebBuild:'export-pack plus unchanged project-isolated runtime',
    fullExportReleaseTemplateDiscovery:'failed; retained godot-export.log; no global installation',
    actualGodotCanvasButtons:'passed',browserChecks:browser.checks.length,browserErrors:browser.errors,
    releaseHashes:'passed',syntheticFixturesExcludedFromProductionLibrary:true,realTavernGodotTested:false,
    realPhoneTested:false,performanceAcceptance:false,referenceTreeCheckRerun:false,auditRerun:false},
  hostWrites:0,modelRequests:0,privateRuntimeOpened:false,unrelatedProjectReadOrWritten:false,
  historicalStatus:'09-实现/verification/status.json is previous 0.3.0 evidence; not this milestone',
  report:'docs/mcp-g1-godot-bridge.md',
  next:['real-regex-page Godot startup and admitted host snapshots','region/input bridge and production lifecycle',
    'sprite metadata and persistent assets','base/theme pack loading','HD-2D style board and real phone validation']};
await writeFile(new URL('09-实现/verification/g1-bridge-status.json',root),JSON.stringify(status,null,2)+'\n');
const paths=['00-交接包说明-先读.md','09-实现/README.md','09-实现/src/flow.ts','09-实现/scripts/build-flow.mjs',
  '09-实现/scripts/verify-g1.mjs','09-实现/src/presentation/protocol.ts','09-实现/src/presentation/battle-bridge.ts',
  '09-实现/src/presentation/same-page.ts','09-实现/tests/bridge.test.ts','09-实现/tests/bridge-browser-fixture.ts',
  '09-实现/verification/g1-bridge-status.json','docs/mcp-g1-godot-bridge.md','14-Godot桥接切片/README.md',
  '14-Godot桥接切片/godot/project.godot','14-Godot桥接切片/godot/bridge.gd','14-Godot桥接切片/godot/bridge.tscn',
  '14-Godot桥接切片/godot/export_presets.cfg','14-Godot桥接切片/tools/build-web.mjs',
  '14-Godot桥接切片/tools/build-harness.mjs','14-Godot桥接切片/tools/extract-runtime.py','14-Godot桥接切片/tools/browser-smoke.mjs'];
const changes=[];for(const path of paths){const data=await read(path);changes.push({path,bytes:data.length,sha256:sha(data)});}
await writeFile(new URL('09-实现/verification/g1-bridge-change-manifest.json',root),JSON.stringify({
  scope:'explicit current-source paths only; historical release/reference SHA lists retained',files:changes},null,2)+'\n');
console.log('PASS: 144 tests, browser proof, release hashes, fixture exclusion, LF docs; wrote current status and scoped source hashes.');
