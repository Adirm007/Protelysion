export type GodotEngine={startGame():Promise<void>;requestQuit():void};
export type GodotConstructor=new(config:Record<string,unknown>)=>GodotEngine;
export function assetBase(value:string,documentBase:string,allowRemote=false):URL {
  const url=new URL(value,documentBase),page=new URL(documentBase);
  const loopback=(host:string)=>['localhost','127.0.0.1','[::1]'].includes(host);
  const remoteAllowed=allowRemote&&(url.protocol==='https:'||(loopback(url.hostname)&&loopback(page.hostname)));
  if(!['http:','https:'].includes(url.protocol)||(!remoteAllowed&&url.origin!==page.origin)||url.username||url.password||url.search||url.hash)throw Error('资源目录须为同源HTTP(S)，或显式配置的HTTPS外链目录');
  if(!url.pathname.endsWith('/'))url.pathname+='/';return url;
}
/** One runtime per iframe. Every failed attempt is reset, including timeout/invalid script. */
export function createGodotLoader(win:Window,doc:Document,base:URL){
  let scriptPromise:Promise<GodotConstructor>|undefined;
  return ()=>{
    if(scriptPromise)return scriptPromise;
    const promise=new Promise<GodotConstructor>((resolve,reject)=>{
      const script=doc.createElement('script');script.src=new URL('game.js',base).href;
      let finished=false;
      const fail=(message:string)=>{if(finished)return;finished=true;win.clearTimeout(timer);script.onload=null;script.onerror=null;script.remove();reject(Error(message));};
      const timer=win.setTimeout(()=>fail('引擎脚本加载超时，请检查网络后点击继续本趟重试'),30000);
      script.onload=()=>{if(finished)return;const Engine=(win as unknown as {Engine?:GodotConstructor}).Engine;
        if(typeof Engine!=='function'){fail('没有有效Godot启动器，请检查资源目录后重试');return;}
        finished=true;win.clearTimeout(timer);script.onload=null;script.onerror=null;resolve(Engine);
      };
      script.onerror=()=>fail('引擎脚本下载失败，请检查资源目录后重试');
      doc.head.append(script);
    });
    scriptPromise=promise;
    void promise.catch(()=>{if(scriptPromise===promise)scriptPromise=undefined;});
    return promise;
  };
}
