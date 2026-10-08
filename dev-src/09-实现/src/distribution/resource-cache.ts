import type {GodotConstructor} from '../host/godot-loader';
export const RESOURCE_CACHE='protelysion-resources-v1';
export type FileInfo={bytes:number;sha256:string};
export type ReleaseManifest={revision:string;scope:{themes:number;species:number;tierTemplates:number};files:Record<string,FileInfo>;pck:FileInfo;pckParts:string[];wasm?:FileInfo;wasmParts?:string[]};
export type DownloadProgress={completed:number;total:number;readyBytes:number;totalBytes:number;file:string};
const MAX_TOTAL=950*1024*1024;
export function validateManifest(value:unknown):ReleaseManifest {
 if(!value||typeof value!=='object')throw Error('资源清单格式无效');
 const m=value as ReleaseManifest,entries=Object.entries(m.files??{});
 const valid=(v:FileInfo)=>v&&Number.isSafeInteger(v.bytes)&&v.bytes>=0&&/^[a-f0-9]{64}$/.test(v.sha256);
 if(!/^[a-zA-Z0-9._-]{1,100}$/.test(m.revision)||entries.length<3||entries.length>2000||!valid(m.pck)||m.pck.bytes===0||m.pck.bytes>400*1024*1024)throw Error('资源清单版本或大小无效');
 let size=0;
 for(const [name,info]of entries){
  if(name.length>600||/[\\\x00-\x1f\x7f:#?%]/.test(name)||name.startsWith('/')||name.split('/').some(p=>!p||p==='.'||p==='..')||!valid(info)||info.bytes>100*1024*1024)throw Error('资源清单路径或校验值无效：'+name);
  size+=info.bytes;
 }
 if(size>MAX_TOTAL||!Array.isArray(m.pckParts)||!m.pckParts.length||new Set(m.pckParts).size!==m.pckParts.length||m.pckParts.some(p=>!m.files[p]||!/^game\.pck\.gz\.\d+$/.test(p))||!m.files['game.js'])throw Error('资源清单缺少完整游戏或超过大小限制');
 if(m.wasmParts){if(!valid(m.wasm!)||m.wasm!.bytes>100*1024*1024||!m.wasmParts.length||new Set(m.wasmParts).size!==m.wasmParts.length||m.wasmParts.some(p=>!m.files[p]||!/^game\.wasm\.gz\.\d+$/.test(p)))throw Error('WASM分片清单无效');}else if(!m.files['game.wasm'])throw Error('清单缺少WASM引擎');
 if(m.scope?.themes!==48||!((m.scope.species===432&&m.scope.tierTemplates===3024)||(m.scope.species===433&&m.scope.tierTemplates===3031)))throw Error('资源清单不是完整48主题发布版');
 return m;
}
export async function digest(data:ArrayBuffer|Uint8Array):Promise<string>{
 const bytes=data instanceof Uint8Array?data:new Uint8Array(data);
 // Copy to an ArrayBuffer-owned view; SharedArrayBuffer is intentionally not accepted by SubtleCrypto.
 const result=await crypto.subtle.digest('SHA-256',new Uint8Array(bytes));
 return Array.from(new Uint8Array(result),v=>v.toString(16).padStart(2,'0')).join('');
}
export function cacheKey(info:FileInfo):string{return 'https://protelysion-cache.invalid/sha256/'+info.sha256;}
function mime(name:string){return name.endsWith('.wasm')?'application/wasm':name.endsWith('.js')?'application/javascript':name.endsWith('.json')?'application/json':name.endsWith('.ogg')?'audio/ogg':name.endsWith('.mp3')?'audio/mpeg':name.endsWith('.wav')?'audio/wav':name.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream';}
function abortError(){return new DOMException('请求已取消','AbortError');}
async function abortable<T>(promise:Promise<T>,signal?:AbortSignal|null):Promise<T>{
 if(!signal)return promise;if(signal.aborted)throw abortError();
 return new Promise((resolve,reject)=>{const abort=()=>{cleanup();reject(abortError());};const cleanup=()=>signal.removeEventListener('abort',abort);signal.addEventListener('abort',abort,{once:true});promise.then(v=>{cleanup();resolve(v);},e=>{cleanup();reject(e);});});
}
/** Cache Storage holds verified compressed game chunks and original encoded audio, never decoded PCM or saves. */
export class ResourceStore {
 readonly manifest:ReleaseManifest;
 private inflight=new Map<string,Promise<Uint8Array>>();
 private originalFetch:typeof fetch;
 private installed?:typeof fetch;
 private engine?:Promise<GodotConstructor>;
 private urls:string[]=[];
 private cachedBytes=0;
 private downloadedBytes=0;
 private requests=0;
 private cacheHits=0;
 constructor(private win:Window,readonly base:URL,manifest:ReleaseManifest,private cache:Cache){this.manifest=validateManifest(manifest);this.originalFetch=win.fetch.bind(win);}
 static async open(win:Window,base:URL,manifest:ReleaseManifest){
  if(!win.isSecureContext||!globalThis.crypto?.subtle||!win.caches)throw Error('资源缓存需要HTTPS或本机localhost，并允许此站点使用浏览器存储。');
  let cache:Cache;try{cache=await win.caches.open(RESOURCE_CACHE);}catch{throw Error('浏览器拒绝资源缓存，请允许此站点存储，或退出限制存储的隐私模式后重试。');}
  return new ResourceStore(win,base,manifest,cache);
 }
 names(coreOnly=false){return Object.keys(this.manifest.files).filter(n=>!n.startsWith('.')&&(!coreOnly||!n.startsWith('audio/')));}
 async status(coreOnly=false){const keys=new Set((await this.cache.keys()).map(k=>k.url));const names=this.names(coreOnly);return {files:names.length,bytes:names.reduce((n,k)=>n+this.manifest.files[k]!.bytes,0),cachedFiles:names.filter(n=>keys.has(cacheKey(this.manifest.files[n]!))).length,cachedBytes:names.filter(n=>keys.has(cacheKey(this.manifest.files[n]!))).reduce((n,k)=>n+this.manifest.files[k]!.bytes,0)};}
 private async download(name:string,info:FileInfo,onBytes?:(n:number)=>void):Promise<Uint8Array>{
  const controller=new AbortController(),timer=this.win.setTimeout(()=>controller.abort(),Math.min(900000,Math.max(180000,info.bytes/(64*1024)*1000)));
  try{
   this.requests++;
   const response=await this.originalFetch(new URL(name,this.base),{credentials:'omit',cache:'no-store',signal:controller.signal});
   if(!response.ok)throw Error('资源下载失败 HTTP '+response.status+'：'+name);
   const bytes=new Uint8Array(info.bytes),reader=response.body?.getReader();let received=0;
   if(reader)try{for(;;){const chunk=await reader.read();if(chunk.done)break;if(received+chunk.value.byteLength>info.bytes){await reader.cancel();throw Error('资源超过清单声明大小：'+name);}bytes.set(chunk.value,received);received+=chunk.value.byteLength;this.downloadedBytes+=chunk.value.byteLength;onBytes?.(received);}}finally{reader.releaseLock();}
   if(received!==info.bytes)throw Error('资源校验失败（下载不完整），未写入缓存：'+name);
   if(bytes.byteLength!==info.bytes||await digest(bytes)!==info.sha256)throw Error('资源校验失败，未写入缓存：'+name);
   try{await this.cache.put(cacheKey(info),new Response(bytes,{headers:{'Content-Type':mime(name),'Content-Length':String(bytes.byteLength),'X-Protelysion-SHA256':info.sha256}}));}
   catch{throw Error('资源缓存写入失败（可能空间不足）。已校验完成的部分保留，释放空间后可继续下载。');}
   return bytes;
  }finally{this.win.clearTimeout(timer);}
 }
 async read(name:string,onBytes?:(n:number)=>void):Promise<Uint8Array>{
  const info=this.manifest.files[name];if(!info)throw Error('不在发布清单中：'+name);
  const prior=this.inflight.get(name);if(prior)return prior;
  const pending=(async()=>{
   const cached=await this.cache.match(cacheKey(info));
   if(cached){const bytes=new Uint8Array(await cached.arrayBuffer());if(bytes.byteLength===info.bytes&&await digest(bytes)===info.sha256){this.cacheHits++;this.cachedBytes+=bytes.byteLength;return bytes;}await this.cache.delete(cacheKey(info));}
   return this.download(name,info,onBytes);
  })();this.inflight.set(name,pending);
  try{return await pending;}finally{if(this.inflight.get(name)===pending)this.inflight.delete(name);}
 }
 async prefetch(coreOnly=false,onProgress?:(p:DownloadProgress)=>void){
  const names=this.names(coreOnly),keys=new Set((await this.cache.keys()).map(k=>k.url));let cursor=0,completed=0,readyBytes=0;
  const totalBytes=names.reduce((n,k)=>n+this.manifest.files[k]!.bytes,0),active=new Map<string,number>();let lastProgress=0;
  const report=(file:string,force=false)=>{if(!force&&Date.now()-lastProgress<100)return;lastProgress=Date.now();onProgress?.({completed,total:names.length,readyBytes:readyBytes+[...active.values()].reduce((a,b)=>a+b,0),totalBytes,file});};
  const worker=async()=>{while(cursor<names.length){const name=names[cursor++]!,info=this.manifest.files[name]!;if(!keys.has(cacheKey(info)))try{await this.read(name,n=>{active.set(name,n);report(name);});}finally{active.delete(name);}completed++;readyBytes+=info.bytes;report(name,true);}};
  // Finish in-flight workers before returning failure: a second click never starts another overlapping batch.
  const results=await Promise.allSettled(Array.from({length:3},worker));const failure=results.find((r):r is PromiseRejectedResult=>r.status==='rejected');if(failure)throw failure.reason;
 }
 private async inflate(names:string[],info:FileInfo,label:string):Promise<Uint8Array>{
  const parts:Uint8Array[]=[];for(const name of names)parts.push(await this.read(name));
  if(typeof DecompressionStream!=='function')throw Error('当前浏览器缺少资源包解压能力，请升级Chrome、Edge、Firefox或Safari。');
  const stream=new Blob(parts.map(p=>new Uint8Array(p))).stream().pipeThrough(new DecompressionStream('gzip'));
  const bytes=new Uint8Array(await new Response(stream).arrayBuffer());
  if(bytes.byteLength!==info.bytes||await digest(bytes)!==info.sha256)throw Error(label+'解压校验失败，请清理资源缓存后重新下载。');
  return bytes;
 }
 pack(){return this.inflate(this.manifest.pckParts,this.manifest.pck,'完整游戏包');}
 wasm(){return this.manifest.wasmParts?this.inflate(this.manifest.wasmParts,this.manifest.wasm!,'WASM引擎'):this.read('game.wasm');}
 installFetch(){
  if(this.installed)return;
  const owner=this;
  this.installed=async function(input:RequestInfo|URL,init?:RequestInit){
   const value=typeof input==='string'?input:input instanceof URL?input.href:input.url;
   let url:URL;try{url=new URL(value,owner.win.document.baseURI);}catch{return owner.originalFetch(input,init);}
   const method=(init?.method??(typeof input==='object'&&'method'in input?input.method:'GET')).toUpperCase();
   if(method!=='GET'||url.origin!==owner.base.origin||!url.pathname.startsWith(owner.base.pathname))return owner.originalFetch(input,init);
   const name=decodeURIComponent(url.pathname.slice(owner.base.pathname.length));
   if(name!=='game.pck'&&name!=='game.wasm'&&!owner.manifest.files[name])return owner.originalFetch(input,init);
   const signal=init?.signal??(typeof input==='object'&&'signal'in input?input.signal:undefined);
   if(signal?.aborted)throw abortError();
   const bytes=await abortable(name==='game.pck'?owner.pack():name==='game.wasm'?owner.wasm():owner.read(name),signal);
   return new Response(new Uint8Array(bytes),{headers:{'Content-Type':mime(name),'Content-Length':String(bytes.byteLength),'X-Protelysion-Cache':'verified'}});
  } as typeof fetch;
  this.win.fetch=this.installed;
 }
 async loadEngine():Promise<GodotConstructor>{
  if(this.engine)return this.engine;
  const pending=(async()=>{
   let code=new TextDecoder().decode(await this.read('game.js'));
   // AudioWorklet.addModule does not use window.fetch; give the two native modules verified blob URLs.
   for(const name of ['game.audio.worklet.js','game.audio.position.worklet.js'])if(this.manifest.files[name]){
    const url=URL.createObjectURL(new Blob([new Uint8Array(await this.read(name))],{type:'application/javascript'}));this.urls.push(url);
    const token='`${loadPath}.'+name.slice(5)+'`';if(!code.includes(token))throw Error('Godot音频模块路径改变，拒绝混用未知引擎版本');code=code.replaceAll(token,JSON.stringify(url));
   }
   const url=URL.createObjectURL(new Blob([code],{type:'application/javascript'}));this.urls.push(url);
   return new Promise<GodotConstructor>((resolve,reject)=>{
    const script=this.win.document.createElement('script');script.src=url;let done=false;
    const fail=()=>{if(done)return;done=true;this.win.clearTimeout(timer);script.remove();reject(Error('缓存中的Godot引擎启动失败，请重试'));};
    const timer=this.win.setTimeout(fail,30000);script.onerror=fail;script.onload=()=>{if(done)return;const Engine=(this.win as unknown as {Engine?:GodotConstructor}).Engine;if(typeof Engine!=='function'){fail();return;}done=true;this.win.clearTimeout(timer);resolve(Engine);};this.win.document.head.append(script);
   });
  })();this.engine=pending;try{return await pending;}catch(error){if(this.engine===pending)this.engine=undefined;throw error;}
 }
 inspect(){return {revision:this.manifest.revision,networkRequests:this.requests,downloadedBytes:this.downloadedBytes,cacheHits:this.cacheHits,cachedBytesRead:this.cachedBytes,inflight:this.inflight.size};}
 dispose(){if(this.win.fetch===this.installed)this.win.fetch=this.originalFetch;for(const url of this.urls)URL.revokeObjectURL(url);this.urls=[];}
}
