import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {ResourceStore,validateManifest,cacheKey,type ReleaseManifest} from '../src/distribution/resource-cache';
const hash=(b:Uint8Array)=>createHash('sha256').update(b).digest('hex');
class MemoryCache {
 data=new Map<string,Response>();fail=false;
 async put(k:RequestInfo|URL,r:Response){if(this.fail)throw Error('quota');this.data.set(String(k),r.clone());}
 async match(k:RequestInfo|URL){return this.data.get(String(k))?.clone();}
 async delete(k:RequestInfo|URL){return this.data.delete(String(k));}
 async keys(){return [...this.data.keys()].map(k=>new Request(k));}
}
function setup(){
 const pack=new TextEncoder().encode('verified complete game, not a downloaded ZIP placeholder'),compressed=gzipSync(pack),half=Math.floor(compressed.byteLength/2);
 const assets:Record<string,Uint8Array>={'game.js':new TextEncoder().encode('var Engine=function(){};'),'game.wasm':new Uint8Array([0,97,115,109]),'game.pck.gz.001':compressed.subarray(0,half),'game.pck.gz.002':compressed.subarray(half),'audio/music/theme.ogg':new Uint8Array([79,103,103,83,1,2,3]),'.nojekyll':new Uint8Array()};
 const manifest:ReleaseManifest={revision:'test-0.20.0',scope:{themes:48,species:432,tierTemplates:3024},files:Object.fromEntries(Object.entries(assets).map(([k,v])=>[k,{bytes:v.byteLength,sha256:hash(v)}])),pck:{bytes:pack.byteLength,sha256:hash(pack)},pckParts:['game.pck.gz.001','game.pck.gz.002']};
 const requests:{url:string;init?:RequestInit}[]=[],cache=new MemoryCache();let bad=false;
 const win:any={document:{baseURI:'http://localhost:8000/chat'},setTimeout,clearTimeout,fetch:async(input:any,init?:RequestInit)=>{const url=String(input);requests.push({url,init});const key=new URL(url).pathname.replace(/^\/game\//,'');return new Response(bad?new Uint8Array([99]):assets[key]?new Uint8Array(assets[key]):new Uint8Array([42]),{status:200});}};
 const store=new ResourceStore(win,new URL('https://assets.example/game/'),manifest,cache as unknown as Cache);
 return {store,win,cache,manifest,assets,pack,requests,set bad(v:boolean){bad=v;}};
}
test('release manifest validates complete scope, paths, sizes and every hash; empty .nojekyll is allowed',()=>{
 const a=setup();a.manifest.files["audio/music/Don'tPrayToIt.ogg"]=a.manifest.files['game.js']!;a.manifest.files['audio/music/月光.ogg']=a.manifest.files['game.js']!;assert.equal(validateManifest(a.manifest).scope.species,432);
 for(const mutate of [(m:ReleaseManifest)=>{m.scope.themes=5;},(m:ReleaseManifest)=>{m.files['../secrets.json']=m.files['game.js']!;},(m:ReleaseManifest)=>{m.files['https://evil/a']=m.files['game.js']!;},(m:ReleaseManifest)=>{m.files['game.js']!.sha256='bad';},(m:ReleaseManifest)=>{m.pckParts.push('missing');},(m:ReleaseManifest)=>{m.pck.bytes=900*1024*1024;}]){const m=structuredClone(a.manifest);mutate(m);assert.throws(()=>validateManifest(m));}
});
test('simultaneous reads share one verified download and later reads use Cache Storage',async()=>{
 const a=setup();const values=await Promise.all(Array.from({length:5},()=>a.store.read('game.wasm')));assert.equal(a.requests.length,1);assert.ok(values.every(v=>v.length===4));await a.store.read('game.wasm');assert.equal(a.requests.length,1);assert.equal(a.requests[0]!.init!.credentials,'omit');assert.equal(a.store.inspect().inflight,0);
});
test('corrupt cached bytes are rejected even if cache metadata lies; only that asset is repaired',async()=>{
 const a=setup();await a.store.read('game.js');await a.cache.put(cacheKey(a.manifest.files['game.js']!),new Response('corrupt',{headers:{'X-Protelysion-SHA256':a.manifest.files['game.js']!.sha256}}));assert.deepEqual(await a.store.read('game.js'),a.assets['game.js']);assert.equal(a.requests.length,2);
});
test('bad downloads never become valid cache entries and can be retried',async()=>{
 const a=setup();a.bad=true;await assert.rejects(()=>a.store.read('game.wasm'),/校验失败/);assert.equal(a.cache.data.size,0);assert.equal(a.store.inspect().inflight,0);a.bad=false;await a.store.read('game.wasm');assert.equal(a.cache.data.size,1);
});
test('quota errors are visible rather than falsely claiming persistent download completion',async()=>{
 const a=setup();a.cache.fail=true;await assert.rejects(()=>a.store.read('game.wasm'),/空间不足/);assert.equal(a.cache.data.size,0);a.cache.fail=false;await a.store.read('game.wasm');assert.equal((await a.store.status(true)).cachedFiles,1);
});
test('core-only and complete predownload work; retry and second entry download zero existing large assets',async()=>{
 const a=setup();await a.store.prefetch(true);assert.ok(a.requests.every(r=>!r.url.includes('/audio/')));const first=a.requests.length;await a.store.prefetch(true);assert.equal(a.requests.length,first);await a.store.prefetch();assert.equal(a.requests.length,first+1);const full=await a.store.status();assert.equal(full.files,full.cachedFiles);await a.store.prefetch();assert.equal(a.requests.length,first+1);
});
test('compressed PCK chunks are reconstructed without loss and without a raw game.pck download',async()=>{
 const a=setup();await a.store.prefetch(true);const n=a.requests.length;assert.deepEqual(await a.store.pack(),a.pack);assert.equal(a.requests.length,n);assert.ok(a.requests.every(r=>!r.url.endsWith('/game.pck')));
});
test('fetch adapter serves version-query assets but never intercepts the host or unrelated origins',async()=>{
 const a=setup();a.store.installFetch();const r=await a.win.fetch('https://assets.example/game/game.pck?build=release');assert.deepEqual(new Uint8Array(await r.arrayBuffer()),a.pack);assert.equal(r.headers.get('X-Protelysion-Cache'),'verified');const count=a.requests.length;
 await a.win.fetch('http://localhost:8000/api/characters',{method:'POST',body:'host data'});assert.equal(a.requests.length,count+1);assert.equal(a.requests.at(-1)!.init!.method,'POST');assert.equal(a.requests.at(-1)!.init!.body,'host data');a.store.dispose();assert.equal((await a.win.fetch('https://assets.example/game/game.pck')).headers.get('X-Protelysion-Cache'),null);
});
test('aborted requests do not start asset downloads',async()=>{const a=setup();a.store.installFetch();const ctl=new AbortController();ctl.abort();await assert.rejects(()=>a.win.fetch('https://assets.example/game/game.wasm',{signal:ctl.signal}),{name:'AbortError'});assert.equal(a.requests.length,0);});
test('host entry after the EJS placeholder does not generate a second entry narrative',()=>{
 const ui=readFileSync('src/host-game-entry.ts','utf8'),session=readFileSync('src/host/game-session.ts','utf8');assert.match(ui,/\{narrateEntry:false\}/);assert.match(session,/options\.narrateEntry!==false/);
});

test('gzip WASM parts restore the exact engine and are served with the WebAssembly MIME type',async()=>{
 const a=setup(),raw=a.assets['game.wasm']!,gz=gzipSync(raw),name='game.wasm.gz.001';a.assets[name]=gz;a.manifest.wasm=a.manifest.files['game.wasm']!;a.manifest.wasmParts=[name];a.manifest.files[name]={bytes:gz.byteLength,sha256:hash(gz)};delete a.manifest.files['game.wasm'];validateManifest(a.manifest);a.store.installFetch();
 const r=await a.win.fetch('https://assets.example/game/game.wasm');assert.equal(r.headers.get('Content-Type'),'application/wasm');assert.deepEqual(new Uint8Array(await r.arrayBuffer()),raw);assert.ok(a.requests.every(r=>r.url.endsWith('.gz.001')));
});
test('download progress includes bytes inside a file, not just completed file counts',async()=>{const a=setup(),seen:number[]=[];await a.store.read('game.js',n=>seen.push(n));assert.ok(seen.length>0);assert.equal(seen.at(-1),a.assets['game.js']!.byteLength);});

test('hidden hosting markers are not runtime downloads (real static servers may return 404)',async()=>{const a=setup();await a.store.prefetch();assert.ok(!a.store.names().includes('.nojekyll'));assert.ok(a.requests.every(r=>!r.url.endsWith('/.nojekyll')));assert.equal((await a.store.status()).cachedFiles,a.store.names().length);});
