// Embedded in the imported regex: neither this bootstrap nor its root hash floats with main.
export function validateMetadata(value){
 if(!value||value.schema!==1||value.repository!=='Adirm007/Protelysion'||!/^\d{1,8}(?:\.\d{1,8}){1,5}$/.test(value.version)||!/^[a-f0-9]{40}$/.test(value.sourceCommit)||!/^[a-f0-9]{64}$/.test(value.manifestSha256))throw Error('固定版发布信息无效');
 return value;
}

/** Self-contained browser function, serialized by makeFixedRegex. */
export async function bootFixedRelease(version,embedded){
 const status=document.getElementById('loader-status'),retry=document.getElementById('loader-retry'),root=document.getElementById('booksea-game');
 let busy=false;
 async function start(){
  if(busy)return;busy=true;retry.hidden=true;
  try{
   if(!window.DreamFixedReleaseClient?.sha256||!window.DreamFixedCacheStorage)throw Error('缺少固定版校验与缓存模块。');
   if(!/^\d{1,8}(?:\.\d{1,8}){1,5}$/.test(version))throw Error('请填写完整数字版本号，例如 0.42.1。');
   status.textContent='正在核验固定版本 '+version+'……';
   const release=version===embedded.version?embedded:(await window.DreamFixedReleaseClient.resolve(embedded.repository,version)).metadata;
   if(release.schema!==1||release.repository!=='Adirm007/Protelysion'||release.version!==version||!/^[a-f0-9]{40}$/.test(release.sourceCommit)||!/^[a-f0-9]{64}$/.test(release.manifestSha256))throw Error('此版本的固定加载协议不兼容，请重新导入该版本正则。');
   const scope='protelysion-fixed-v1:'+release.repository+':'+release.version+':'+release.manifestSha256;
   const bases=[
    'https://raw.githubusercontent.com/'+release.repository+'/'+release.sourceCommit+'/site/',
    'https://cdn.jsdelivr.net/gh/'+release.repository+'@'+release.sourceCommit+'/site/',
    'https://fastly.jsdelivr.net/gh/'+release.repository+'@'+release.sourceCommit+'/site/',
   ];
   const cache=await window.DreamFixedCacheStorage.open(scope+':bootstrap');
   const digest=bytes=>window.DreamFixedReleaseClient.sha256(bytes);
   async function verified(name,expected,maxBytes){
    const key='https://protelysion-fixed-cache.invalid/'+expected.sha256;
    async function check(response){
     const length=Number(response.headers.get('Content-Length'));
     if(length>maxBytes)throw Error('文件超过固定版大小限制：'+name);
     const bytes=await response.arrayBuffer();
     if(bytes.byteLength>maxBytes||(expected.bytes!==undefined&&bytes.byteLength!==expected.bytes)||await digest(bytes)!==expected.sha256)throw Error('固定版校验失败，拒绝执行：'+name);
     return bytes;
    }
    const saved=await cache.match(key);
    if(saved){try{return await check(saved);}catch{await cache.delete(key);}}
    let failure;
    for(const base of bases){
     try{
      const response=await fetch(new URL(name,base),{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(60000)});
      if(!response.ok)throw Error('HTTP '+response.status);
      const bytes=await check(response);
      await cache.put(key,new Response(bytes));return bytes;
     }catch(error){failure=error;}
    }
    throw Error('固定版 '+version+' 加载失败；不会改用最新版。'+String(failure?.message??failure));
   }
   const manifestBytes=await verified('release-manifest.json',{sha256:release.manifestSha256},2000000);
   const manifest=JSON.parse(new TextDecoder().decode(manifestBytes)),info=manifest.files?.['distribution.js'];
   if(!info||!Number.isSafeInteger(info.bytes)||info.bytes<=0||info.bytes>20000000||!/^[a-f0-9]{64}$/.test(info.sha256))throw Error('固定版清单缺少有效启动器。');
   const bytes=await verified('distribution.js',info,20000000);
   // Always execute the verified bundle; a stale global from another version cannot satisfy this boot.
   window.BookseaDistribution=undefined;
   await new Promise((resolve,reject)=>{
    const script=document.createElement('script'),url=URL.createObjectURL(new Blob([bytes],{type:'application/javascript'}));
    script.src=url;let done=false;
    const finish=error=>{if(done)return;done=true;clearTimeout(timer);script.onload=null;script.onerror=null;URL.revokeObjectURL(url);script.remove();error?reject(error):resolve();};
    const timer=setTimeout(()=>finish(Error('固定版启动器执行超时')),30000);
    script.onload=()=>finish();script.onerror=()=>finish(Error('固定版启动器执行失败'));document.head.append(script);
   });
   if(typeof window.BookseaDistribution?.boot!=='function')throw Error('此版本不是有效的书海运行包。');
   await window.BookseaDistribution.boot(root,{base:bases[0],manifest,mode:'host',fixedRelease:release});
   status.textContent='';
  }catch(error){status.textContent=String(error?.message??error);retry.hidden=false;}
  finally{busy=false;}
 }
 retry.onclick=start;
 await start();
}

export const FIXED_REGEX_ID='cfc0375e-3c5c-4ea1-8b7b-2093c7df0a12';
export function makeFixedRegex({metadata,template,css='',releaseClientSource,cacheSource}){
 validateMetadata(metadata);
 if(typeof releaseClientSource!=='string'||!releaseClientSource.includes('DreamFixedReleaseClient'))throw Error('缺少固定版发布核验客户端。');
 if(typeof cacheSource!=='string'||!cacheSource.includes('DreamFixedCacheStorage'))throw Error('缺少固定版缓存模块。');
 const escapeScript=source=>source.replace(/<\/script/gi,'<\\/script');
 const html='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<!-- FIXED_RELEASE:'+JSON.stringify(metadata)+' -->'+
  '<title>普罗泰利西翁 · 固定版 '+metadata.version+'</title><style>'+css+'</style><main><p id="loader-status" role="status"></p><button id="loader-retry" hidden>重试此版本</button><div id="booksea-game"></div></main><script>'+escapeScript(releaseClientSource+'\n'+cacheSource)+
  '\n// 只修改 VERSION 的数字即可切换到已发布的固定版本；此操作会核验对应不可变 Release。\nconst VERSION = '+JSON.stringify(metadata.version)+';\nconst PIN = '+JSON.stringify(metadata)+';\n('+bootFixedRelease.toString()+')(VERSION,PIN);</script></html>';
 const item={...template,id:FIXED_REGEX_ID,scriptName:'普罗泰利西翁-书海迷宫-固定版 v'+metadata.version,disabled:false,replaceString:'```html\n'+html+'\n```'};
 delete item.fixedRelease;
 return item;
}
