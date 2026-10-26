// Cache Storage is unavailable on LAN HTTP; IndexedDB retains the same verified bytes and namespace.
(function(root){
 'use strict';
 var databases=new Map();
 function key(input){return typeof input==='string'?input:input.url||String(input);}
 async function database(name){
  if(databases.has(name))return databases.get(name);
  if(!root.indexedDB)throw Error('浏览器未开放固定版缓存，请允许站点存储。');
  var pending=new Promise(function(resolve,reject){
   var request=root.indexedDB.open('dream-fixed-cache:'+name,1);
   request.onupgradeneeded=function(){request.result.createObjectStore('entries');};
   request.onerror=function(){reject(request.error);};
   request.onsuccess=function(){resolve(request.result);};
  });databases.set(name,pending);
  try{return await pending;}catch(error){databases.delete(name);throw error;}
 }
 async function transaction(name,mode,operation){
  var db=await database(name);
  return new Promise(function(resolve,reject){
   var tx=db.transaction('entries',mode),result,request=operation(tx.objectStore('entries'));
   request.onsuccess=function(){result=request.result;};
   tx.oncomplete=function(){resolve(result);};
   tx.onerror=tx.onabort=function(){reject(tx.error||request.error||Error('缓存操作失败'));};
  });
 }
 async function open(name){
  if(root.caches)return root.caches.open(name);
  await database(name);
  return {
   match:async function(input){var record=await transaction(name,'readonly',function(store){return store.get(key(input));});return record?new Response(record.bytes,{headers:record.headers}):undefined;},
   put:async function(input,response){var bytes=await response.arrayBuffer(),headers=Array.from(response.headers.entries());await transaction(name,'readwrite',function(store){return store.put({bytes:bytes,headers:headers},key(input));});},
   delete:async function(input){var found=await this.match(input);await transaction(name,'readwrite',function(store){return store.delete(key(input));});return !!found;},
   keys:async function(){var keys=await transaction(name,'readonly',function(store){return store.getAllKeys();});return keys.map(function(url){return new Request(String(url));});}
  };
 }
 async function remove(name){
  if(root.caches)return root.caches.delete(name);
  var pending=databases.get(name);if(pending){(await pending).close();databases.delete(name);}
  return new Promise(function(resolve,reject){var request=root.indexedDB.deleteDatabase('dream-fixed-cache:'+name);request.onsuccess=function(){resolve(true);};request.onerror=function(){reject(request.error);};request.onblocked=function(){reject(Error('请关闭正在使用此固定版本的其他窗口后重试。'));};});
 }
 root.DreamFixedCacheStorage=Object.freeze({open:open,delete:remove});
})(window);
