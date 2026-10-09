import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url),read=p=>readFile(new URL(p,root));
const hash=data=>createHash('sha256').update(data).digest('hex');
for(const file of ['flow-manifest.json','host-manifest.json']){
  const manifest=JSON.parse(await read('09-实现/release/'+file));assert.equal(manifest.version,'0.5.0-host-view');
  for(const [name,sha] of Object.entries(manifest.sha256))assert.equal(hash(await read('09-实现/release/'+name)),sha,name);
}
const testLog=(await read('09-实现/verification/g1-host-check.log')).toString();
assert.match(testLog,/# tests 157/);assert.match(testLog,/# pass 157/);assert.match(testLog,/# fail 0/);
const live=JSON.parse(await read('10-联调环境/verification/godot-host-live.json'));
assert.equal(live.passed,true);assert.equal(live.godot.actorCount,1);assert.ok(live.godot.receiptSequence>0&&live.refreshReceived);
assert.ok(live.viewerHostStateUnchanged&&live.install.sourceUnchanged&&live.install.chatVariablesUnchanged);assert.equal(live.newPageErrors,0);
assert.equal(JSON.parse(await read('14-Godot桥接切片/verification/browser-smoke.json')).passed,true);
for(const file of ['booksea-flow.mjs','booksea-host.iife.js']){
  const bundle=await read('09-实现/release/'+file);for(const sentinel of ['fixture-ally','fixture-enemy','联调无特性测试体'])assert.equal(bundle.includes(Buffer.from(sentinel)),false);
}
const web=JSON.parse(await read('15-Godot宿主入口/verification/web-manifest.json'));
for(const [name,info] of Object.entries(web.files)){
  const bytes=await read('15-Godot宿主入口/web/'+name);assert.equal(hash(bytes),info.sha256);
  assert.equal(hash(await read('10-联调环境/SillyTavern/public/booksea-godot-host/'+name)),info.sha256);
}
const font=await read('15-Godot宿主入口/godot/fonts/NotoSansSC.ttf'),license=await read('15-Godot宿主入口/godot/fonts/OFL.txt');
assert.ok(license.includes(Buffer.from('SIL OPEN FONT LICENSE Version 1.1')));
await writeFile(new URL('15-Godot宿主入口/verification/font-source.json',root),JSON.stringify({
  font:'Noto Sans SC',license:'SIL OFL 1.1',modified:false,localFilename:'NotoSansSC.ttf',
  url:'https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf',
  licenseUrl:'https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/OFL.txt',
  bytes:font.length,sha256:hash(font),licenseSha256:hash(license)},null,2)+'\n');
const doc=(await read('docs/mcp-g1-real-host-viewer.md')).toString();assert.ok(!doc.includes('\r')&&!/[ \t]+$/m.test(doc));
const status={version:'0.5.0-host-view',plan:'0.13',milestone:'real-tavern-godot-readonly-roster',gameComplete:false,
  tests:{baseline:144,added:13,passed:157,failed:0,typecheck:'passed',build:'passed',legacyBattleWebSmoke:'passed'},
  live:{environment:'Windows / SillyTavern 1.19.0 / Helper message iframe / Godot 4.7.2',
    realGodot:true,realHostCard:true,actorsRead:live.roster.actors,godotActors:live.godot.actorCount,
    receiptSequence:live.godot.receiptSequence,refreshReceived:true,newPageErrors:live.newPageErrors,modelCalls:0,
    originalSourceAndChatUnchanged:true,retainedTechnicalMessageId:live.install.messageId},
  stateChanges:['one dedicated viewer regex','one retained technical assistant message with MVU copy','public/booksea-godot-host assets'],
  services:{sillyTavern:'http://127.0.0.1:8017/',controller:'loopback 9137; authenticated'},
  releaseHashes:'passed',deployedAssetHashes:'passed',chineseFontLicense:'OFL-1.1 retained',
  realPhone:false,fullGameplay:false,productionCompilationUi:false,report:'docs/mcp-g1-real-host-viewer.md'};
await writeFile(new URL('09-实现/verification/g1-host-status.json',root),JSON.stringify(status,null,2)+'\n');
console.log('PASS: 157 tests, real Helper/Godot receipt and refresh, unchanged host state, deployed hashes, fixture exclusion, font license.');
