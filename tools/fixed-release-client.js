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
      if (!r.ok) throw Error(r.status===403||r.status===429 ? 'GitHub 暂时限流，无法确认更新，请稍后重试' : '下载失败（HTTP '+r.status+'）');
      var length=Number(r.headers&&r.headers.get('content-length'));
      if (length>limit) throw Error('下载内容超出大小限制');
      var bytes=await r.arrayBuffer(); if(bytes.byteLength>limit) throw Error('下载内容超出大小限制');
      return {bytes:bytes, response:r};
    } finally { if(timer)clearTimeout(timer); }
  }
  async function api(path) {
    var result=await get('https://api.github.com/'+path,6000000);
    return {value:JSON.parse(new TextDecoder().decode(result.bytes)),response:result.response};
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
  function checkRelease(repository, release, version) {
    var p=project(repository), tag=release&&release.tag_name;
    if(!release||release.immutable!==true||release.draft||release.prerelease||typeof tag!=='string'||tag.charAt(0)!=='v'||!VERSION.test(tag.slice(1))||version&&tag!=='v'+version)throw Error('该版本尚未成为 GitHub 不可变正式发布');
    var assets=(release.assets||[]).filter(function(a){return a.name===p.asset;});
    if(assets.length!==1||!/^sha256:[a-f0-9]{64}$/.test(assets[0].digest||'')||!Number.isSafeInteger(assets[0].size)||assets[0].size<=0||assets[0].size>4000000)throw Error('正式发布缺少可验证的固定版附件');
    var expected='https://github.com/'+repository+'/releases/download/'+tag+'/'+p.asset;
    if(assets[0].browser_download_url!==expected)throw Error('发布附件地址不属于指定仓库');
    return {release:release,asset:assets[0],version:tag.slice(1),repository:repository};
  }
  async function latest(repository) {
    project(repository);var candidates=[];
    for(var page=1;page<=10;page++) {
      var result=await api('repos/'+repository+'/releases?per_page=100&page='+page), list=result.value;
      if(!Array.isArray(list))throw Error('GitHub 发布列表格式异常');
      list.forEach(function(r){
        if(r&&r.immutable===true&&!r.draft&&!r.prerelease&&typeof r.tag_name==='string'&&r.tag_name.charAt(0)==='v'&&VERSION.test(r.tag_name.slice(1))) candidates.push(checkRelease(repository,r));
      });
      var link=result.response.headers&&result.response.headers.get('link');
      if(!link||!/<[^>]+>; rel="next"/.test(link)) break;
      if(page===10)throw Error('发布列表过长，无法完整确认最新版本');
    }
    candidates.sort(function(a,b){return compare(b.version,a.version);});
    return candidates[0]||null;
  }
  async function download(selected) {
    var p=project(selected.repository), checked=checkRelease(selected.repository,selected.release,selected.version);
    var repo=checked.repository, tag='v'+checked.version, artifact=checked.asset;
    var urls=[artifact.browser_download_url,'https://raw.githubusercontent.com/'+repo+'/'+tag+'/'+p.path,'https://cdn.jsdelivr.net/gh/'+repo+'@'+tag+'/'+p.path];
    var failures=[];
    for(var i=0;i<urls.length;i++) {
      try {
        var file=await get(urls[i],4000000);
        if(file.bytes.byteLength!==artifact.size||await sha256(file.bytes)!==artifact.digest.slice(7))throw Error('固定版附件 SHA-256 校验失败');
        var regex=JSON.parse(new TextDecoder().decode(file.bytes)), m=metadata(regex,repo,checked.version);
        return {metadata:m,regex:regex,release:checked.release,bytes:file.bytes};
      }catch(e){failures.push(String(e&&e.message||e));}
    }
    throw Error('无法取得已校验的固定版正则：'+failures.join('；'));
  }
  async function resolve(repository, version) {
    project(repository);
    if(version!=null&&!VERSION.test(version))throw Error('版本号格式无效');
    var selected;
    if(version!=null)selected=checkRelease(repository,(await api('repos/'+repository+'/releases/tags/v'+version)).value,version);
    else selected=await latest(repository);
    if(!selected)throw Error('仓库尚未发布不可变固定版');
    return download(selected);
  }
  root.DreamFixedReleaseClient=Object.freeze({compare:compare,sha256:sha256,metadata:metadata,fromInstalled:fromInstalled,latest:latest,download:download,resolve:resolve});
})(window);
/* DREAM_FIXED_RELEASE_CLIENT_END */
