/* DREAM_FIXED_RELEASE_CLIENT_BEGIN */
(function (root) {
  'use strict';
  var PROJECTS = Object.freeze({
    'Adirm007/reader': { asset: 'reader-fixed.regex.json', path: 'regex/reader-fixed.regex.json' },
    'Adirm007/Protelysion': { asset: 'protelysion-fixed.regex.json', path: 'install/protelysion-fixed.regex.json' }
  });
  var VERSION = /^\d{1,8}(?:\.\d{1,8}){1,5}$/;
  var HEX40 = /^[a-f0-9]{40}$/, HEX64 = /^[a-f0-9]{64}$/;
  function compare(a, b) {
    if (!VERSION.test(a) || !VERSION.test(b)) throw Error('版本号格式无效');
    var x = a.split('.').map(Number), y = b.split('.').map(Number);
    for (var i = 0; i < Math.max(x.length, y.length); i++) {
      var d = (x[i] || 0) - (y[i] || 0); if (d) return d < 0 ? -1 : 1;
    }
    return 0;
  }
  // Local SHA-256 keeps LAN HTTP installations verifiable too; never reduce verification to byte counts.
  function softwareSHA256(input) {
    var src = input instanceof Uint8Array ? input : new Uint8Array(input);
    var size = Math.ceil((src.length + 9) / 64) * 64, bytes = new Uint8Array(size);
    bytes.set(src); bytes[src.length] = 128;
    var view = new DataView(bytes.buffer), bits = src.length * 8;
    view.setUint32(size - 8, Math.floor(bits / 4294967296)); view.setUint32(size - 4, bits >>> 0);
    var h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    var k = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    function rotr(x,n) { return (x >>> n) | (x << (32-n)); }
    var w = new Uint32Array(64);
    for (var off = 0; off < size; off += 64) {
      for (var j=0;j<16;j++) w[j]=view.getUint32(off+j*4);
      for (j=16;j<64;j++) { var p=w[j-15],q=w[j-2]; w[j]=(w[j-16]+(rotr(p,7)^rotr(p,18)^(p>>>3))+w[j-7]+(rotr(q,17)^rotr(q,19)^(q>>>10)))>>>0; }
      var a=h[0],b=h[1],c=h[2],d=h[3],e=h[4],f=h[5],g=h[6],hh=h[7];
      for (j=0;j<64;j++) {
        var t1=(hh+(rotr(e,6)^rotr(e,11)^rotr(e,25))+((e&f)^(~e&g))+k[j]+w[j])>>>0;
        var t2=((rotr(a,2)^rotr(a,13)^rotr(a,22))+((a&b)^(a&c)^(b&c)))>>>0;
        hh=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;
      }
      var state=[a,b,c,d,e,f,g,hh]; for(j=0;j<8;j++) h[j]=(h[j]+state[j])>>>0;
    }
    return h.map(function(n){return n.toString(16).padStart(8,'0');}).join('');
  }
  async function sha256(bytes) {
    if (root.crypto && root.crypto.subtle) {
      var hash = await root.crypto.subtle.digest('SHA-256',bytes);
      return Array.from(new Uint8Array(hash),function(n){return n.toString(16).padStart(2,'0');}).join('');
    }
    return softwareSHA256(bytes);
  }
  async function get(url, limit) {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function(){ctl.abort();},20000) : 0;
    try {
      var r = await fetch(url,{credentials:'omit',cache:'no-store',signal:ctl?ctl.signal:undefined});
      if (!r.ok) throw Error('下载失败（HTTP '+r.status+'）');
      var length=Number(r.headers&&r.headers.get('content-length'));
      if (length>limit) throw Error('下载内容超出大小限制');
      var bytes;
      if(r.body&&typeof r.body.getReader==='function') {
        var reader=r.body.getReader(),chunks=[],total=0;
        for(;;) {
          var part=await reader.read();if(part.done)break;
          total+=part.value.byteLength;
          if(total>limit){await reader.cancel();throw Error('下载内容超出大小限制');}
          chunks.push(part.value);
        }
        var joined=new Uint8Array(total),offset=0;
        chunks.forEach(function(chunk){joined.set(chunk,offset);offset+=chunk.byteLength;});bytes=joined.buffer;
      }else bytes=await r.arrayBuffer();
      if(bytes.byteLength>limit) throw Error('下载内容超出大小限制');
      return {bytes:bytes, response:r};
    } finally { if(timer)clearTimeout(timer); }
  }
  function project(repository) { if(typeof repository!=='string'||!Object.prototype.hasOwnProperty.call(PROJECTS,repository))throw Error('不支持的更新仓库');return PROJECTS[repository]; }
  function metadata(regex, repository, version) {
    project(repository);
    if(!regex||typeof regex.replaceString!=='string'||regex.replaceString.length>4000000)throw Error('固定版正则格式无效');
    var markers=regex.replaceString.match(/<!-- FIXED_RELEASE:\{[^\r\n]*?\} -->/g)||[];
    if(markers.length!==1)throw Error('固定版标记缺失或重复');
    var m=JSON.parse(markers[0].slice('<!-- FIXED_RELEASE:'.length,-' -->'.length));
    if(m.schema!==1||m.repository!==repository||typeof m.version!=='string'||!VERSION.test(m.version)||typeof m.sourceCommit!=='string'||!HEX40.test(m.sourceCommit)||typeof m.manifestSha256!=='string'||!HEX64.test(m.manifestSha256)||version&&m.version!==version)throw Error('固定版标记与发布版本不一致');
    return Object.freeze({schema:1,repository:m.repository,version:m.version,sourceCommit:m.sourceCommit,manifestSha256:m.manifestSha256});
  }
  function fromInstalled(regex, repository) {
    var text=regex.replace_string||regex.replaceString, m=metadata({replaceString:text},repository);
    var selected=text.match(/\bconst VERSION\s*=\s*["'](\d{1,8}(?:\.\d{1,8}){1,5})["']/g)||[];
    if(selected.length!==1)throw Error('固定版 VERSION 设置缺失或重复');
    var version=selected[0].match(/["']([^"']+)["']/)[1];
    return Object.freeze(Object.assign({},m,{version:version}));
  }
  function versionNumber(version) {
    if(typeof version!=='string'||!VERSION.test(version))throw Error('版本号格式无效');
    return version;
  }
  async function staticJSON(repository,path,limit) {
    project(repository);
    var urls=['https://raw.githubusercontent.com/'+repository+'/fixed-updates/'+path,
      'https://cdn.jsdelivr.net/gh/'+repository+'@fixed-updates/'+path];
    var file,failures=[];
    for(var i=0;i<urls.length;i++) {
      try{file=await get(urls[i],limit);break;}catch(e){failures.push(String(e&&e.message||e));}
    }
    if(!file)throw Error('无法读取更新清单或发布证明：'+failures.join('；'));
    // A malformed response is a failed check, not permission to select an older catalog.
    return JSON.parse(new TextDecoder().decode(file.bytes));
  }
  async function catalog(repository) {
    var list=await staticJSON(repository,'index.json',1000000);
    if(!list||list.schema!==1||list.repository!==repository||!Array.isArray(list.versions)||list.versions.length>10000)throw Error('更新清单格式异常');
    var seen=Object.create(null),versions=list.versions.map(function(version){
      versionNumber(version);
      if(seen[version])throw Error('更新清单版本重复');seen[version]=true;return version;
    });
    versions.sort(function(a,b){return compare(b,a);});
    // Treat semantically equal numeric spellings as ambiguous too (1.2 and 1.2.0).
    for(var i=1;i<versions.length;i++)if(compare(versions[i-1],versions[i])===0)throw Error('更新清单版本重复');
    return versions;
  }
  /* GITHUB_RELEASE_VERIFY_BEGIN */
  // Only these immutable dependency bytes can execute. The mutable branch supplies JSON only.
  var VERIFIER = {"bases":["https://raw.githubusercontent.com/Adirm007/reader/ce0105dbe1754500425aaeaf61bb25721ff482f8/tools/release-verifier/","https://cdn.jsdelivr.net/gh/Adirm007/reader@ce0105dbe1754500425aaeaf61bb25721ff482f8/tools/release-verifier/"],"runtime":{"bytes":16992,"sha256":"0c949f4996f9a89698e4b5c586de32249c3b69b7baadb64d220073cc04acba14"},"gzip":{"bytes":7287396,"sha256":"634cd8a21d7cbfa67f92860129e6618f06999b5a20f973dbbe1b1ca9d8d7e4d4"},"wasm":{"bytes":35497677,"sha256":"cf8345dc9208c65af1fae77cad364332ccb809358b2f745abbaf2c9c8df897d8"}};
  var verifierJob=null, verifierSequence=0;
  function proofWorker(config, softwareHash) {
    'use strict';
    var database;
    async function db() {
      if(!self.indexedDB)return null;
      if(!database)database=new Promise(function(resolve,reject){
        var request=indexedDB.open('dream-release-verifier-v1',1);
        request.onupgradeneeded=function(){request.result.createObjectStore('assets');};
        request.onsuccess=function(){resolve(request.result);};request.onerror=function(){reject(request.error);};
      });
      return database;
    }
    async function cached(key,value) {
      try {
        var store=await db();if(!store)return null;
        return await new Promise(function(resolve,reject){
          var tx=store.transaction('assets',value?'readwrite':'readonly'),table=tx.objectStore('assets');
          var request=value?table.put(value,key):table.get(key);
          request.onsuccess=function(){if(!value)resolve(request.result);};
          tx.oncomplete=function(){if(value)resolve(value);};tx.onerror=function(){reject(tx.error);};
        });
      }catch(e){return null;}
    }
    async function hash(bytes) {
      if(self.crypto&&self.crypto.subtle){var value=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(value),function(n){return n.toString(16).padStart(2,'0');}).join('');}
      return softwareHash(bytes);
    }
    async function read(stream,limit) {
      var reader=stream.getReader(),chunks=[],total=0;
      for(;;){var next=await reader.read();if(next.done)break;total+=next.value.byteLength;if(total>limit){await reader.cancel();throw Error('下载内容超出大小限制');}chunks.push(next.value);}
      var out=new Uint8Array(total),offset=0;chunks.forEach(function(chunk){out.set(chunk,offset);offset+=chunk.byteLength;});return out;
    }
    async function wasmBytes() {
      var old=await cached(config.gzip.sha256);
      if(old&&old.byteLength===config.gzip.bytes&&await hash(old)===config.gzip.sha256)return old;
      var failure;
      for(var i=0;i<config.bases.length;i++) {
        var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},60000);
        try {
          var response=await fetch(config.bases[i]+'verifier.wasm.gz',{credentials:'omit',signal:controller.signal});
          if(!response.ok)throw Error('HTTP '+response.status);
          var content=Number(response.headers.get('content-length'));if(content>config.gzip.bytes)throw Error('下载内容超出大小限制');
          var bytes=await read(response.body,config.gzip.bytes);
          if(bytes.byteLength!==config.gzip.bytes||await hash(bytes)!==config.gzip.sha256)throw Error('更新校验模块 SHA-256 校验失败');
          await cached(config.gzip.sha256,bytes);return bytes;
        }catch(e){failure=e;}finally{clearTimeout(timer);}
      }
      throw Error('无法加载更新校验模块：'+String(failure&&failure.message||failure));
    }
    async function start() {
      if(typeof DecompressionStream!=='function')throw Error('当前浏览器不支持更新校验，请升级浏览器或手动导入固定版');
      var compressed=await wasmBytes();
      var inflated=await read(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip')),config.wasm.bytes);
      if(inflated.byteLength!==config.wasm.bytes||await hash(inflated)!==config.wasm.sha256)throw Error('更新校验模块 SHA-256 校验失败');
      var go=new Go(),module=await WebAssembly.instantiate(inflated,go.importObject);
      go.run(module.instance).catch(function(){self.postMessage({fatal:'更新校验模块已停止'});});
      if(typeof self.DreamReleaseAttestationVerify!=='function')throw Error('更新校验模块初始化失败');
      self.onmessage=function(event){
        try{self.postMessage({id:event.data.id,result:JSON.parse(self.DreamReleaseAttestationVerify(event.data.input))});}
        catch(e){self.postMessage({id:event.data.id,result:{ok:false,error:String(e&&e.message||e)}});}
      };
      self.postMessage({ready:true});
    }
    start().catch(function(e){self.postMessage({fatal:String(e&&e.message||e)});});
  }
  async function loadVerifier() {
    if(!verifierJob)verifierJob=(async function(){
      if(typeof Worker!=='function')throw Error('当前浏览器不支持更新校验，请升级浏览器或手动导入固定版');
      var runtime;
      for(var i=0;i<VERIFIER.bases.length;i++) {
        try {
          var file=await get(VERIFIER.bases[i]+'wasm_exec.js',VERIFIER.runtime.bytes);
          if(file.bytes.byteLength!==VERIFIER.runtime.bytes||await sha256(file.bytes)!==VERIFIER.runtime.sha256)throw Error('更新校验模块 SHA-256 校验失败');
          runtime=new TextDecoder().decode(file.bytes);break;
        }catch(e){if(i===VERIFIER.bases.length-1)throw e;}
      }
      var code=runtime+'\n('+proofWorker.toString()+')('+JSON.stringify(VERIFIER)+','+softwareSHA256.toString()+');';
      var url=URL.createObjectURL(new Blob([code],{type:'text/javascript'})),worker;
      try{worker=new Worker(url);}finally{URL.revokeObjectURL(url);}
      var waiting=new Map(),readyResolve,readyReject;
      var ready=new Promise(function(resolve,reject){readyResolve=resolve;readyReject=reject;});
      var timer=setTimeout(function(){stop('更新校验模块加载超时');},150000);
      function stop(message){clearTimeout(timer);worker.terminate();readyReject(Error(message));waiting.forEach(function(job){clearTimeout(job.timer);job.reject(Error(message));});waiting.clear();verifierJob=null;}
      worker.onerror=function(){stop('更新校验模块运行失败');};
      worker.onmessage=function(event){
        var value=event.data;
        if(value.fatal){stop(value.fatal);return;}
        if(value.ready){clearTimeout(timer);readyResolve();return;}
        var job=waiting.get(value.id);if(job){clearTimeout(job.timer);waiting.delete(value.id);job.resolve(value.result);}
      };
      await ready;
      return function(request){return new Promise(function(resolve,reject){
        var id=++verifierSequence;
        var job={resolve:resolve,reject:reject,timer:setTimeout(function(){stop('发布证明校验超时');},30000)};
        waiting.set(id,job);worker.postMessage({id:id,input:JSON.stringify(request)});
      });};
    })().catch(function(e){verifierJob=null;throw e;});
    return verifierJob;
  }
  async function verifyBundle(bundle,repository,version) {
    var values=await Promise.all([loadVerifier(),staticJSON(repository,'trust.json',2000000)]);
    var verified=await values[0]({bundle:bundle,trust:values[1],repository:repository,version:version});
    if(!verified||verified.ok!==true)throw Error('GitHub 发布证明校验失败：'+String(verified&&verified.error||'无法读取证明'));
    return verified;
  }
  /* GITHUB_RELEASE_VERIFY_END */
  async function proof(repository,version) {
    project(repository);versionNumber(version);
    var bundle=await staticJSON(repository,'releases/v'+version+'.json',2000000);
    var verified=await verifyBundle(bundle,repository,version);
    if(!verified||verified.repository!==repository||verified.version!==version||typeof verified.distributionCommit!=='string'||!HEX40.test(verified.distributionCommit)||typeof verified.digest!=='string'||!HEX64.test(verified.digest))throw Error('发布证明与指定版本不一致');
    return Object.freeze({repository:repository,version:version,distributionCommit:verified.distributionCommit,digest:verified.digest});
  }
  function rememberLatest(repository,version) {
    var key='dream_fixed_latest_v1:'+repository;
    try {
      var previous=root.localStorage&&root.localStorage.getItem(key);
      if(typeof previous==='string'&&VERSION.test(previous)&&(!version||compare(previous,version)>0))throw Error('更新清单版本早于已验证版本，请稍后重试');
    }catch(e){if(e&&e.message==='更新清单版本早于已验证版本，请稍后重试')throw e;}
    if(version)try{if(root.localStorage)root.localStorage.setItem(key,version);}catch(e){}
  }
  async function latest(repository) {
    project(repository);var versions=await catalog(repository);
    if(!versions.length){rememberLatest(repository,null);return null;}
    var selected=await proof(repository,versions[0]);
    rememberLatest(repository,selected.version);
    return selected;
  }
  async function download(selected) {
    var p=project(selected&&selected.repository),repo=selected.repository,version=versionNumber(selected.version);
    // Recheck the signed proof before applying; never trust fields supplied by a catalog or a previous UI snapshot.
    var checked=await proof(repo,version),tag='v'+version;
    var urls=['https://github.com/'+repo+'/releases/download/'+tag+'/'+p.asset,
      'https://raw.githubusercontent.com/'+repo+'/'+checked.distributionCommit+'/'+p.path,
      'https://cdn.jsdelivr.net/gh/'+repo+'@'+checked.distributionCommit+'/'+p.path];
    var failures=[];
    for(var i=0;i<urls.length;i++) {
      try {
        var file=await get(urls[i],4000000);
        if(await sha256(file.bytes)!==checked.digest)throw Error('固定版附件 SHA-256 校验失败');
        var regex=JSON.parse(new TextDecoder().decode(file.bytes)),m=metadata(regex,repo,version);
        return {metadata:m,regex:regex,release:checked,bytes:file.bytes};
      }catch(e){failures.push(String(e&&e.message||e));}
    }
    throw Error('无法取得已校验的固定版正则：'+failures.join('；'));
  }
  async function resolve(repository,version) {
    project(repository);
    if(version!=null) {
      versionNumber(version);
      var versions=await catalog(repository);
      if(versions.indexOf(version)<0)throw Error('更新清单中没有该版本');
      return download({repository:repository,version:version});
    }
    var selected=await latest(repository);
    if(!selected)throw Error('仓库尚未发布不可变固定版');
    return download(selected);
  }
  root.DreamFixedReleaseClient=Object.freeze({compare:compare,sha256:sha256,metadata:metadata,fromInstalled:fromInstalled,latest:latest,download:download,resolve:resolve});
})(window);
/* DREAM_FIXED_RELEASE_CLIENT_END */
