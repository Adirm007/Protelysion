import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {readFile,mkdtemp,mkdir,writeFile,rm,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {bootFixedRelease,makeFixedRegex,FIXED_REGEX_ID} from '../fixed-loader.mjs';
import {buildFixedRelease} from '../build-fixed-release.mjs';
import {makeExternalRegex} from '../../dev-src/09-实现/scripts/public-loader.mjs';
const require=createRequire(new URL('../../dev-src/09-实现/package.json',import.meta.url));
const {IDBFactory}=require('fake-indexeddb');
const clientSource=await readFile(new URL('../fixed-release-client.js',import.meta.url),'utf8');
const cacheSource=await readFile(new URL('../fixed-cache.js',import.meta.url),'utf8');
const EXPECTED_BOOKSEA_REGEX=String.raw`/<booksea-game>「?((?:[^<]|<(?!booksea-game\b|/booksea-game>))*?)」?</booksea-game>/g`;
test('published installers and both generators use the author-specified complete booksea expression',async()=>{
 const installed=JSON.parse(await readFile(new URL('../../install/普罗泰利西翁-书海外链加载正则.json',import.meta.url),'utf8'));
 assert.equal(installed.findRegex,EXPECTED_BOOKSEA_REGEX);
 const external=makeExternalRegex('https://adirm007.github.io/Protelysion/',{findRegex:'/old/g'});
 assert.equal(external.findRegex,EXPECTED_BOOKSEA_REGEX);
 const f=fixture(),fixed=makeFixedRegex({metadata:f.metadata,template:{findRegex:'/old/g'},releaseClientSource:clientSource,cacheSource});
 assert.equal(fixed.findRegex,EXPECTED_BOOKSEA_REGEX);
 const page=await readFile(new URL('../../site/loader.html',import.meta.url),'utf8');
 const generator=page.slice(page.indexOf('<script>')+8,page.indexOf('\nconst template='));
 const context=vm.createContext({URL});vm.runInContext(generator,context);
 assert.equal(context.makeExternalRegex('https://adirm007.github.io/Protelysion/',{findRegex:'/old/g'}).findRegex,EXPECTED_BOOKSEA_REGEX);
 const last=EXPECTED_BOOKSEA_REGEX.lastIndexOf('/'),compile=()=>new RegExp(EXPECTED_BOOKSEA_REGEX.slice(1,last),EXPECTED_BOOKSEA_REGEX.slice(last+1));
 for(const body of ['进入','「进入」','正文\n<a>其他标签</a>\n换行']){
  const found=[...('<booksea-game>'+body+'</booksea-game>').matchAll(compile())];assert.equal(found.length,1);assert.equal(found[0][1],body==='「进入」'?'进入':body);
 }
 const two=[...'<booksea-game>第一段</booksea-game>之间<booksea-game>「第二段」</booksea-game>'.matchAll(compile())];
 assert.deepEqual(two.map(m=>m[1]),['第一段','第二段']);
 assert.equal([...'<booksea-gamex>错误标签</booksea-gamex>'.matchAll(compile())].length,0);
});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
class MemoryCache {
 data=new Map();
 async match(key){return this.data.get(String(key))?.clone();}
 async put(key,response){this.data.set(String(key),response.clone());}
 async delete(key){return this.data.delete(String(key));}
}
function fixture({offline=false,insecure=false,cacheMap=new Map(),mutate,firstMirrorFails=false}={}){
 const code='window.BookseaDistribution={boot:async function(root,config){window.boots.push(config);}};';
 const codeBytes=Buffer.from(code),manifestBytes=Buffer.from(JSON.stringify({revision:'test',files:{'distribution.js':{bytes:codeBytes.length,sha256:hash(codeBytes)}}}));
 const metadata={schema:1,repository:'Adirm007/Protelysion',version:'0.42.1',sourceCommit:'a'.repeat(40),manifestSha256:hash(manifestBytes)};
 const elements=Object.fromEntries(['loader-status','loader-retry','booksea-game'].map(id=>[id,{hidden:false,textContent:''}]));
 const requests=[],cacheNames=[],boots=[],resolutions=[];
 const state={offline,mutate};
 const document={getElementById:id=>elements[id],createElement:()=>({remove(){}}),head:{append(script){
  void globalThis.fetch(script.src).then(r=>r.text()).then(source=>{vm.runInContext(source,context);script.onload?.();},()=>script.onerror?.());
 }}};
 const sandbox={document,console,boots,crypto:insecure?undefined:globalThis.crypto,indexedDB:new IDBFactory(),TextDecoder,TextEncoder,URL,Request,Response,Blob,ArrayBuffer,Uint8Array,Uint32Array,DataView,AbortController,AbortSignal,setTimeout,clearTimeout,Map,
  fetch:async input=>{
   const url=String(input);requests.push(url);
   if(state.offline||firstMirrorFails&&url.startsWith('https://raw.'))throw Error('offline');
   const name=new URL(url).pathname.split('/').at(-1),bytes=name==='release-manifest.json'?manifestBytes:codeBytes;
   return new Response(state.mutate?state.mutate(name,bytes):bytes);
  },
  caches:insecure?undefined:{open:async name=>{cacheNames.push(name);if(!cacheMap.has(name))cacheMap.set(name,new MemoryCache());return cacheMap.get(name);}},
 };
 sandbox.window=sandbox;
 const context=vm.createContext(sandbox);
 vm.runInContext(clientSource+'\n'+cacheSource,context);
 const original=sandbox.DreamFixedReleaseClient;
 sandbox.DreamFixedReleaseClient={...original,resolve:async(repo,version)=>{resolutions.push({repo,version});return {metadata:{...metadata,version}};}};
 return {metadata,requests,cacheMap,cacheNames,boots,resolutions,elements,sandbox,context,state,client:original,
  run:(version=metadata.version,pin=metadata)=>vm.runInContext('('+bootFixedRelease.toString()+')('+JSON.stringify(version)+','+JSON.stringify(pin)+')',context)};
}

test('embedded pin loads without release discovery, and scopes cache to repository/version/root digest',async()=>{
 const f=fixture();await f.run();assert.equal(f.boots.length,1);assert.equal(f.resolutions.length,0);assert.ok(f.requests.every(url=>url.includes('a'.repeat(40))));assert.ok(f.requests.every(url=>!url.includes('/main/')));
 assert.equal(f.boots[0].fixedRelease.manifestSha256,f.metadata.manifestSha256);
 assert.ok(f.cacheNames[0].includes('Adirm007/Protelysion:0.42.1:'+f.metadata.manifestSha256));
});
test('equal-size altered root and equal-size altered script never execute',async()=>{
 for(const target of ['release-manifest.json','distribution.js']){
  const f=fixture({mutate:(name,bytes)=>{if(name!==target)return bytes;const bad=Buffer.from(bytes);bad[5]^=1;return bad;}});
  await f.run();assert.equal(f.boots.length,0);assert.equal(f.elements['loader-status'].textContent,'书页暂时没能展开，请重试。');assert.equal(f.elements['loader-retry'].hidden,false);
 }
});
test('mirror retries remain at the same complete commit',async()=>{
 const f=fixture({firstMirrorFails:true});await f.run();assert.equal(f.boots.length,1);assert.ok(f.requests.some(url=>url.startsWith('https://cdn.jsdelivr.net/')));assert.ok(f.requests.every(url=>url.includes(f.metadata.sourceCommit)));
});
test('verified offline cache is usable; poisoned cached root is rejected',async()=>{
 const f=fixture();await f.run();const network=f.requests.length;f.state.offline=true;await f.run();assert.equal(f.boots.length,2);assert.equal(f.requests.length,network);
 const cache=[...f.cacheMap.values()][0];await cache.put('https://protelysion-fixed-cache.invalid/'+f.metadata.manifestSha256,new Response('poison'));
 await f.run();assert.equal(f.boots.length,2);assert.equal(f.elements['loader-status'].textContent,'书页暂时没能展开，请重试。');
});
test('changing only the numeric VERSION resolves that exact immutable version and changes cache namespace',async()=>{
 const f=fixture();await f.run('0.43.0');assert.equal(f.resolutions.length,1);assert.equal(f.resolutions[0].version,'0.43.0');assert.equal(f.boots[0].fixedRelease.version,'0.43.0');assert.ok(f.cacheNames[0].includes(':0.43.0:'));
});
test('LAN HTTP uses full software SHA-256 and persistent IndexedDB bytes, including corruption rejection',async()=>{
 const f=fixture({insecure:true});await f.run();assert.equal(f.boots.length,1);assert.equal(await f.client.sha256(Buffer.from('abc')),hash('abc'));
 f.state.offline=true;await f.run();assert.equal(f.boots.length,2);
 const storage=await f.sandbox.DreamFixedCacheStorage.open('protelysion-fixed-v1:'+f.metadata.repository+':'+f.metadata.version+':'+f.metadata.manifestSha256+':bootstrap');
 await storage.put('https://protelysion-fixed-cache.invalid/'+f.metadata.manifestSha256,new Response('poison'));
 await f.run();assert.equal(f.boots.length,2);assert.equal(f.elements['loader-status'].textContent,'书页暂时没能展开，请重试。');
 assert.ok((await storage.keys()).every(request=>request instanceof Request));
});
test('generated regex has one portable marker, a dedicated id, editable VERSION, and both local helper modules',()=>{
 const f=fixture(),regex=makeFixedRegex({metadata:f.metadata,template:{id:'legacy',findRegex:'/x/g'},releaseClientSource:clientSource,cacheSource});
 assert.equal(regex.id,FIXED_REGEX_ID);assert.equal(regex.findRegex,EXPECTED_BOOKSEA_REGEX);assert.equal((regex.replaceString.match(/<!-- FIXED_RELEASE:\{[^\r\n]*?\} -->/g)||[]).length,1);assert.ok(regex.replaceString.includes('const VERSION = "0.42.1";'));
 assert.equal(Object.hasOwn(regex,'fixedRelease'),false);
 assert.equal(f.client.metadata(regex,'Adirm007/Protelysion').sourceCommit,f.metadata.sourceCommit);
 const edited={replaceString:regex.replaceString.replace('const VERSION = "0.42.1"','const VERSION = "0.43.0"')};
 assert.equal(f.client.fromInstalled(edited,'Adirm007/Protelysion').version,'0.43.0');
 assert.throws(()=>makeFixedRegex({metadata:{...f.metadata,sourceCommit:'main'},template:{},releaseClientSource:clientSource,cacheSource}));
});
test('builder reads committed root and runtime bytes, ignores dirty files, and refuses mutable refs and unpatched runtimes',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'protelysion-fixed-test-'));
 try{
  const git=(...args)=>execFileSync('git',['-C',root,...args],{stdio:'pipe'});
  git('init','-q');git('config','user.name','Fixed test');git('config','user.email','fixed-test@example.invalid');
  await mkdir(path.join(root,'site'));await mkdir(path.join(root,'install'));
  const runtime=Buffer.from('/* protelysion-fixed-v1: */ window.BookseaDistribution={};');
  const manifest={files:{'distribution.js':{bytes:runtime.length,sha256:hash(runtime)}}};
  await writeFile(path.join(root,'site/distribution.js'),runtime);await writeFile(path.join(root,'site/release-manifest.json'),JSON.stringify(manifest));await writeFile(path.join(root,'install/普罗泰利西翁-书海外链加载正则.json'),JSON.stringify({replaceString:'<style>body{color:red}</style>'}));
  git('add','.');git('commit','-qm','fixture');
  const sourceCommit=git('rev-parse','HEAD').toString().trim();await writeFile(path.join(root,'site/release-manifest.json'),'dirty main');
  const output=path.join(root,'artifacts/fixed-release');
  const result=await buildFixedRelease({version:'0.42.1',root,output,releaseClientSource:clientSource,cacheSource});
  assert.equal(result.metadata.sourceCommit,sourceCommit);assert.equal(result.metadata.manifestSha256,hash(JSON.stringify(manifest)));assert.equal(result.regex.id,FIXED_REGEX_ID);
  await assert.rejects(()=>buildFixedRelease({version:'latest',root}));await assert.rejects(()=>buildFixedRelease({version:'0.42.1',commit:'main',root}));
  await mkdir(path.join(root,'tools'));await copyFile(new URL('../publish-fixed-release.py',import.meta.url),path.join(root,'tools/publish-fixed-release.py'));
  const plan=JSON.parse(execFileSync(process.env.PYTHON??'python',[path.join(root,'tools/publish-fixed-release.py'),'--version','0.42.1'],{encoding:'utf8'}));
  assert.equal(plan.publish,false);assert.equal(plan.sourceCommitC,sourceCommit);assert.equal(git('tag','--list').toString(),'');assert.equal(git('rev-parse','HEAD').toString().trim(),sourceCommit);
  await writeFile(path.join(output,'protelysion-fixed.regex.json'),'tampered');
  assert.throws(()=>execFileSync(process.env.PYTHON??'python',[path.join(root,'tools/publish-fixed-release.py'),'--version','0.42.1'],{stdio:'pipe'}),/Command failed/);
 }finally{assert.equal(path.dirname(path.resolve(root)),path.resolve(tmpdir()));assert.ok(path.basename(root).startsWith('protelysion-fixed-test-'));await rm(root,{recursive:true,force:true});}
});
