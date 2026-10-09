// Two-origin external-loader test, actual WebGL/Godot and latest-reader UI.
// Uses a fresh browser and synthetic host API only. Never reads real host settings, chats or credentials.
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {readFile,writeFile,mkdir,stat,readdir,link,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {build} from 'esbuild';
import {makeExternalRegex} from './public-loader.mjs';
const project=fileURLToPath(new URL('../../',import.meta.url)),impl=path.join(project,'09-实现');
const verification=path.resolve(impl,process.argv.find(a=>a.startsWith('--output='))?.slice(9)??'verification/changes-024/release-browser'),repo=path.join(project,'22-发布/booksea-github');
const publicRoot=path.join(repo,'site');await mkdir(verification,{recursive:true});
const release=JSON.parse(await readFile(path.join(publicRoot,'release-manifest.json'),'utf8'));
const require=createRequire(path.join(project,'10-联调环境/package.json')),{chromium}=require('playwright');
const bundled=await build({entryPoints:[path.join(impl,'tests/release-browser-fixture.ts')],bundle:true,format:'esm',write:false,platform:'node',target:'es2022'});
const {releaseFixture}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const fixture=releaseFixture(),template=JSON.parse(await readFile(path.join(project,'17-宿主可玩联调/entry-template.json'),'utf8'));
const hostHtml=await readFile(path.join(project,'17-宿主可玩联调/web/index.html'),'utf8'),css=hostHtml.match(/<style>([\s\S]*?)<\/style>/)[1];
const rawReader=JSON.parse(await readFile(path.join(project,'02-宿主参考-只读/读者对话渲染0917 (new).json'),'utf8')).replaceString;
const strip=s=>s.replace(/^```html\s*/,'').replace(/\s*```\s*$/,'');
const mime={'.html':'text/html; charset=utf-8','.js':'application/javascript','.json':'application/json','.wasm':'application/wasm','.ogg':'audio/ogg','.mp3':'audio/mpeg','.wav':'audio/wav','.txt':'text/plain','.png':'image/png'};
const checks=[],errors=[],requests=[];let browser,assetServer,hostServer,activePage,activeFrame;const consoleMessages=[];
const check=(name,pass,detail)=>{checks.push({name,passed:!!pass,detail});console.log(name,!!pass);if(!pass)throw Error(name);};
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve('http://127.0.0.1:'+server.address().port)));
const serve=async(file,res,cors=false)=>{const info=await stat(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]??'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-store',...(cors?{'Access-Control-Allow-Origin':'*','Cross-Origin-Resource-Policy':'cross-origin'}:{})});createReadStream(file).pipe(res);};
const shim=`Object.assign(window,window.parent.__hostShim);`;
try{
 assetServer=createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname),file=path.resolve(publicRoot,pathname.replace(/^\/assets\//,''));if(!pathname.startsWith('/assets/')||!file.startsWith(publicRoot+path.sep)){res.writeHead(404);res.end();return;}await serve(file,res,true);}catch{res.writeHead(404);res.end();}});
 const assetOrigin=await listen(assetServer),external=makeExternalRegex(assetOrigin+'/assets/',template,css);
 new Function(strip(external.replaceString).match(/<script>([\s\S]*?)<\/script>/)[1]);
 const entryHtml=strip(external.replaceString).replace('<script>','<script>'+shim+'</script><script>');
 const readerHtml=strip(rawReader).replace('$1','书海入口已接入。').replace('function openDreamLobby(){','window.__bookseaUITest={open:openDreamLobby,go:dlbGo};function openDreamLobby(){').replace('<head>','<head><script>'+shim+'</script>');
 const harness=which=>`<!doctype html><meta charset="utf-8"><script src="/lodash.js"></script><textarea id="send_textarea"></textarea><button id="send_but">发送</button><button id="mes_stop" style="display:none">停止</button><script>
window.__audit=${JSON.stringify(fixture).replace(/</g,'\\u003c')};
const store=window.__audit;
store.messages[0].data=structuredClone(store.mvu);store.messages[0].extra??={};
Object.defineProperty(store,'mvu',{enumerable:true,configurable:true,get:()=>store.messages.at(-1).data,set:v=>{store.messages.at(-1).data=v;}});
const messageIndex=o=>typeof o.message_id==='number'&&o.message_id>=0?o.message_id:store.messages.length-1;
const h={getLastMessageId:()=>store.messages.length-1,getChatMessages:range=>typeof range==='number'?[{...structuredClone(store.messages[range<0?store.messages.length-1:range]),message_id:range<0?store.messages.length-1:range}]:store.messages.map((m,i)=>({...structuredClone(m),message_id:i})),
getVariables:o=>structuredClone(o.type==='chat'?store.chat:store.messages[messageIndex(o)]?.data??{}),updateVariablesWith:async(fn,o)=>{if(o.type==='chat')store.chat=fn(structuredClone(store.chat));else{const m=store.messages[messageIndex(o)];m.data=fn(structuredClone(m.data));}store.writes++;},replaceVariables:async(v,o)=>{if(o.type==='chat')store.chat=structuredClone(v);else store.messages[messageIndex(o)].data=structuredClone(v);store.writes++;},createChatMessages:async ms=>{for(const m of ms)store.messages.push({...structuredClone(m),data:structuredClone(m.data??store.mvu),extra:structuredClone(m.extra??{})});},generateRaw:async()=>{store.modelCalls++;throw Error('Model calls forbidden in browser fixture');},stopGenerationById(){}};
const SillyTavern={getContext:()=>({characterId:'release-card',getCurrentChatId:()=> 'release-chat',chat:store.messages,onlineStatus:'connected',saveChat:async()=>{}})};
window.__hostShim={TavernHelper:h,SillyTavern,_:window._};window.TavernHelper=h;window.SillyTavern=SillyTavern;
document.getElementById('send_but').onclick=()=>{store.sends.push(document.getElementById('send_textarea').value);document.getElementById('send_textarea').value='';};
</script><iframe id="test-frame" src="/${which}.html" style="display:block;width:100%;height:950px;border:0" sandbox="allow-scripts allow-same-origin"></iframe>`;
 hostServer=createServer(async(req,res)=>{try{const p=new URL(req.url,'http://local').pathname;if(p==='/favicon.ico'){res.writeHead(204);res.end();return;}if(p==='/lodash.js'){await serve(path.join(impl,'node_modules/lodash/lodash.min.js'),res);return;}
  const routes={'/entry.html':entryHtml,'/reader.html':readerHtml,'/host':harness('entry'),'/reader-host':harness('reader')};if(!routes[p]){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});res.end(routes[p]);
 }catch(e){res.writeHead(500);res.end(String(e));}});
 const hostOrigin=await listen(hostServer);check('Public assets use a different origin from the host',assetOrigin!==hostOrigin,{hostOrigin,assetOrigin});
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--no-first-run','--disable-background-networking']});
 const readerContext=await browser.newContext({viewport:{width:1400,height:1000}}),readerPage=await readerContext.newPage();
 const readerErrors=[];readerPage.on('pageerror',e=>readerErrors.push(String(e)));
 await readerPage.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname==='127.0.0.1')return route.continue();return route.abort();});
 await readerPage.goto(hostOrigin+'/reader-host');const rf=readerPage.frames().find(f=>f.url().endsWith('/reader.html'));
 await rf.waitForFunction(()=>window.__bookseaUITest,null,{timeout:30000});await rf.evaluate(()=>{window.__bookseaUITest.open();window.__bookseaUITest.go('eggs');});
 const entryButton=readerPage.locator('button[data-dlb="eggbooksea"]');await entryButton.waitFor({state:'visible'});check('Latest reader shows Booksea on the actual easter-egg page',await entryButton.isVisible());
 await readerPage.waitForTimeout(1600);await readerPage.screenshot({path:path.join(verification,'reader-easter-egg.png'),fullPage:false});
 await readerPage.locator('#send_textarea').fill('保留草稿');await entryButton.click();check('Actual browser protects the unsent draft',await readerPage.locator('#send_textarea').inputValue()==='保留草稿'&&await readerPage.evaluate(()=>__audit.sends.length)===0);
 await readerPage.locator('#send_textarea').fill('');await entryButton.click();const sent=await readerPage.evaluate(()=>__audit.sends);check('Actual browser sends only the plain entry trigger',sent.length===1&&sent[0]==='进入普罗泰利西翁');
 check('Reader integration causes no uncaught browser errors',readerErrors.length===0,readerErrors);await readerContext.close();
 const context=await browser.newContext({viewport:{width:1440,height:1100}}),page=await context.newPage();
 page.on('pageerror',e=>errors.push(String(e)));page.on('response',r=>{if(r.url().startsWith(assetOrigin))requests.push({url:r.url().slice(assetOrigin.length),status:r.status()});});
 activePage=page;page.on('console',m=>{consoleMessages.push(m.type()+': '+m.text());if(/SCRIPT ERROR|Parse Error|Assertion failed/.test(m.text()))errors.push(m.text());});
 await page.goto(hostOrigin+'/host');let frame=page.frames().find(f=>f.url().endsWith('/entry.html'));activeFrame=frame;
 await frame.locator('#download-all').waitFor({state:'visible',timeout:30000});await frame.locator('#download-all').click();
 await frame.locator('#read').waitFor({state:'visible',timeout:180000});const cold=await frame.evaluate(()=>BookseaResources.inspect());check('Cold entry verifies and persistently caches the complete game including encoded audio',cold.networkRequests>300&&cold.downloadedBytes>300*1024*1024,cold);check('External script keeps the Helper iframe on the host origin',await frame.evaluate(()=>location.origin)===hostOrigin);
 await frame.locator('#read').click();check('External host entry reads the synthetic party through real DOM controls',await frame.locator('#roster .actor').count()>=2);
 await frame.locator('#resume').click();await frame.waitForFunction(()=>window.BookseaPlay?.receipt().ready&&window.BookseaPlay.receipt().renderer.fingerprint,null,{timeout:90000});
 await frame.waitForFunction(()=>window.BookseaPlay?.inspect().paused===false,null,{timeout:30000});
 const viewportFits=await frame.evaluate(()=>{const s=document.querySelector('#stage').getBoundingClientRect();return Math.abs(s.width-innerWidth)<2&&Math.abs(s.height-innerHeight)<2&&document.documentElement.scrollHeight<=innerHeight+2;});check('Published host game fills its iframe without lobby padding or extra scroll space',viewportFits);
 const initial=await frame.evaluate(()=>({view:BookseaPlay.inspect(),receipt:BookseaPlay.receipt()}));check('Public package uses supplied sprite and one map actor',initial.receipt.renderer.mapPlayerCount===1&&initial.receipt.renderer.playerCell.join(',')==='192,304');check('Actual Godot renders a current randomly generated theme',initial.view.region.layout.theme===initial.view.region.theme&&initial.receipt.renderer.revision==='p5-hd2d-2'&&initial.receipt.renderer.source==='kernel'&&initial.receipt.renderer.triangles>5000,{theme:initial.view.region.theme,fingerprint:initial.view.region.layout.fingerprint});
 await frame.locator('.rpg-menu-button').click();await frame.getByRole('button',{name:'设置',exact:true}).click();await frame.locator('[data-enable]').click();await frame.getByRole('button',{name:'继续远征',exact:true}).click();await frame.waitForFunction(()=>BookseaAudio.inspect().playing&&BookseaAudio.inspect().contextState==='running',null,{timeout:60000});
 const audio=await frame.evaluate(()=>BookseaAudio.inspect());check('Cross-origin audio manifest and real BGM decode work',audio.catalog.themes===48&&audio.catalog.monsters===433&&audio.errors.length===0,{playing:audio.playing,catalog:audio.catalog});
 const direction=await frame.evaluate(()=>{const v=BookseaPlay.inspect();return [[1,0,'ArrowRight'],[-1,0,'ArrowLeft'],[0,1,'ArrowDown'],[0,-1,'ArrowUp']].find(([dx,dz])=>v.region.tiles[v.z+dz]?.[v.x+dx]==='.'&&!v.region.things.some(t=>t.kind==='enemy'&&t.x===v.x+dx&&t.z===v.z+dz));});
 if(!direction)throw Error('Fixture spawn has no empty walkable neighbor');await frame.locator('canvas').focus();await frame.locator('canvas').press(direction[2],{delay:180});
 await frame.evaluate(()=>{if(!BookseaPlay.inspect().paused)BookseaPlay.input({type:'pause'});});
 const walked=await frame.evaluate(()=>BookseaPlay.inspect());check('Keyboard movement reaches the real authoritative runtime',walked.x!==initial.view.x||walked.z!==initial.view.z,{before:[initial.view.x,initial.view.z],after:[walked.x,walked.z]});
 const fingerprint=walked.region.layout.fingerprint;await frame.evaluate(()=>BookseaPlay.flush());await frame.evaluate(()=>{if(BookseaPlay.inspect().paused)BookseaPlay.input({type:'pause'});});await page.waitForTimeout(200);await page.screenshot({path:path.join(verification,'external-game-chibi.png'),fullPage:false});await frame.evaluate(()=>{if(!BookseaPlay.inspect().paused)BookseaPlay.input({type:'pause'});return BookseaPlay.flush();});
 const warmRequestStart=requests.length;await frame.evaluate(()=>location.reload());await page.waitForTimeout(200);frame=page.frames().find(f=>f.url().endsWith('/entry.html'));activeFrame=frame;await frame.locator('#resume').waitFor({state:'visible',timeout:30000});await frame.locator('#resume').click();await frame.waitForFunction(()=>window.BookseaPlay?.receipt().ready&&window.BookseaPlay.receipt().renderer.fingerprint,null,{timeout:90000});
 const restored=await frame.evaluate(()=>BookseaPlay.inspect());check('Iframe reload resumes the same floor and position',restored.region.layout.fingerprint===fingerprint&&restored.x===walked.x&&restored.z===walked.z);
 const warm=await frame.evaluate(()=>BookseaResources.inspect()),warmRequests=requests.slice(warmRequestStart);check('Second entry downloads zero large resources',warm.networkRequests===0&&warm.downloadedBytes===0&&warmRequests.every(r=>r.url.startsWith('/assets/release-manifest.json')),{warm,warmRequests});
 await page.route(assetOrigin+'/**',route=>route.abort());await frame.evaluate(()=>location.reload());await page.waitForTimeout(200);frame=page.frames().find(f=>f.url().endsWith('/entry.html'));activeFrame=frame;await frame.locator('#resume').waitFor({state:'visible',timeout:30000});await frame.locator('#resume').click();await frame.waitForFunction(()=>window.BookseaPlay?.receipt().ready&&window.BookseaPlay.receipt().renderer.fingerprint,null,{timeout:90000});
 const offline=await frame.evaluate(()=>({cache:BookseaResources.inspect(),view:BookseaPlay.inspect()}));check('Previously downloaded game still starts when the external asset origin is offline',offline.cache.networkRequests===0&&offline.view.region.layout.fingerprint===fingerprint,{cache:offline.cache,theme:offline.view.region.theme});await page.unroute(assetOrigin+'/**');
 // Simulate an authenticated later-message checkpoint, then delete that message.
 // This only edits the isolated fixture; production globals contain no test hook.
 await frame.evaluate(()=>{if(!BookseaPlay.inspect().paused)BookseaPlay.input({type:'pause'});return BookseaPlay.flush();});
 const beforeRollback=await frame.evaluate(()=>({depth:BookseaPlay.inspect().depth,x:BookseaPlay.inspect().x,z:BookseaPlay.inspect().z,steps:BookseaPlay.inspect().steps}));
 const fpBefore=await page.evaluate(()=>__audit.mvu.stat_data.命运点数);
 await page.evaluate(()=>{const store=__audit,old=store.messages.at(-1),snapshot=structuredClone(old.extra.bookseaCheckpointV1),token='future-'+crypto.randomUUID(),id=store.messages.length;
  snapshot.token=token;snapshot.revision=1;snapshot.progress.activeExpedition.depth=40;snapshot.progress.activeExpedition.steps+=400;snapshot.progress.activeExpedition.run.unlocks.push('anchor-40');snapshot.progress.activeExpedition.hostSave={frame:token,revision:1};snapshot.progress.unlockedIds.push('anchor-40');
  const data=structuredClone(store.mvu);data.bookseaProgressRef={version:1,contextId:snapshot.contextId,token};data.stat_data.命运点数+=77;
  store.messages.push({role:'assistant',message:'隔离测试的后续楼层',data,extra:{bookseaFrameV1:token,bookseaCheckpointV1:snapshot}});
  store.chat.booksea={...store.chat.booksea,...structuredClone(snapshot.progress),timelineIndex:[...store.chat.booksea.timelineIndex,{messageId:id,token}]};
 });
 await frame.locator('#resume').waitFor({state:'visible',timeout:20000});check('Later-message checkpoint exposes its own depth-40 anchor',await frame.locator('#anchor option[value="40"]').count()===1);await frame.locator('#resume').click();await frame.waitForFunction(()=>BookseaPlay.receipt().ready&&BookseaPlay.inspect().depth===40,null,{timeout:90000});
 await frame.evaluate(()=>{window.__obsoleteBooksea=BookseaPlay;});await page.evaluate(()=>__audit.messages.pop());await frame.evaluate(()=>{__obsoleteBooksea.input({type:'handoff'});return __obsoleteBooksea.flush();});
 await frame.locator('#resume').waitFor({state:'visible',timeout:20000});check('Deleting that message removes its high-floor starting anchor',await frame.locator('#anchor option[value="40"]').count()===0);check('Rolled-back message keeps its own MVU resources',await page.evaluate(()=>__audit.mvu.stat_data.命运点数)===fpBefore);
 await frame.locator('#resume').click();await frame.waitForFunction(()=>BookseaPlay.receipt().ready&&BookseaPlay.inspect().depth===1,null,{timeout:90000});
 check('Future same-run local cache and obsolete writes do not undo chat rollback',await frame.evaluate(p=>{const v=BookseaPlay.inspect();return v.depth===p.depth&&v.x===p.x&&v.z===p.z;},beforeRollback));await page.screenshot({path:path.join(verification,'message-rollback.png'),fullPage:false});
 // Explicit withdrawal and writeback only within the synthetic host store.
 await frame.evaluate(()=>{if(BookseaPlay.inspect().paused)BookseaPlay.input({type:'pause'});BookseaPlay.input({type:'withdraw'});});await frame.evaluate(()=>BookseaPlay.flush());
 const done=await page.evaluate(()=>({active:__audit.chat.booksea.activeExpedition,last:__audit.chat.booksea.lastExpedition,messages:__audit.messages,modelCalls:__audit.modelCalls,mvu:__audit.mvu}));
 check('Synthetic host exit settles and emits exactly one success handoff',done.active===null&&done.last?.run.status==='success'&&done.messages.filter(m=>m.role==='user'&&m.message==='离开普罗泰利西翁'&&m.extra?.bookseaHandoff?.runId===done.last.run.id&&m.extra?.bookseaHandoff?.status==='success').length===1);
 const exit=done.messages.find(m=>m.role==='user'&&m.extra?.bookseaHandoff?.runId===done.last.run.id);
 check('Exit bubble contains only the trigger, with facts in metadata',exit.message==='离开普罗泰利西翁'&&typeof exit.extra.bookseaHandoff.summary==='string'&&exit.extra.bookseaHandoff.summary.includes('已结算'));
 check('Exit creation carries the already-settled MVU atomically',JSON.stringify(exit.data)===JSON.stringify(done.mvu));
 const once=JSON.stringify(done.mvu);await frame.evaluate(()=>{BookseaPlay.input({type:'handoff'});return BookseaPlay.flush();});check('Repeated end handoff does not repeat host rewards',await page.evaluate(()=>JSON.stringify(__audit.mvu))===once);
 check('No real model was called',await page.evaluate(()=>__audit.modelCalls)===0);
 for(const name of ['distribution.js','game.js',...release.wasmParts,...release.pckParts,'audio/audio-manifest.json'])check('First-download external request '+name,requests.some(r=>r.url.startsWith('/assets/'+name)&&r.status===200));
 check('Raw PCK and WASM are not downloaded; verified compressed chunks are used',!requests.some(r=>['/assets/game.pck','/assets/game.wasm'].includes(r.url.split('?')[0])));
 const hostBeforeClear=await page.evaluate(()=>JSON.stringify({mvu:__audit.mvu,chat:__audit.chat,messages:__audit.messages}));await frame.getByRole('button',{name:'回到书间',exact:true}).click();await frame.locator('#open-settings').click();await frame.locator('#host-resource-open').click();await frame.locator('#resource-clear').click();check('Cache deletion requires an explicit second click, without sandbox-blocked modal dialogs',await frame.locator('#resource-clear').innerText()==='再次点击确认');await frame.locator('#resource-clear').click();await frame.waitForFunction(async()=>!(await caches.keys()).includes('protelysion-resources-v1'));check('Clearing resources does not touch host characters, chat or saves',await page.evaluate(()=>JSON.stringify({mvu:__audit.mvu,chat:__audit.chat,messages:__audit.messages}))===hostBeforeClear);
 check('No uncaught game or Godot script errors',errors.length===0,errors);await context.close();
 const independentContext=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36'}),independent=await independentContext.newPage();const independentErrors=[];
 independent.on('pageerror',e=>independentErrors.push(String(e)));activePage=independent;activeFrame=independent;
 await independent.goto(assetOrigin+'/assets/index.html');await independent.locator('#download-core').waitFor({state:'visible',timeout:30000});await independent.locator('#download-core').click();await independent.waitForFunction(()=>window.BookseaPlay?.inspect().mode==='title'&&document.getElementById('resource-setup')?.hidden,null,{timeout:90000});await independent.evaluate(()=>BookseaPlay.input({type:'new'}));await independent.waitForFunction(()=>window.BookseaPlay?.receipt().ready&&window.BookseaPlay.receipt().renderer.fingerprint,null,{timeout:90000});
 const separate=await independent.evaluate(()=>({source:BookseaPlay.inspect().source,quality:BookseaPlay.inspect().settings.graphicsQuality,overflow:document.documentElement.scrollWidth>innerWidth+2,extraHeight:document.documentElement.scrollHeight>innerHeight+2,helper:typeof window.TavernHelper}));
 check('Independent Pages game works without the host or a model',separate.helper==='undefined'&&separate.source!=='host',separate);
 check('Mobile-emulated startup retains standard quality by default',separate.quality==='desktop');
 check('Landscape phone viewport has no horizontal overflow or blank area below the game',!separate.overflow&&!separate.extraHeight);
 const p5={};
 // P5: the map-load veil covers first entry and every floor change until Godot acknowledges the floor.
 await independent.waitForFunction(()=>BookseaPlay.loading().visible===false,null,{timeout:15000});
 p5.first=await independent.evaluate(()=>({renderer:BookseaPlay.receipt().renderer,fingerprint:BookseaPlay.inspect().region.layout.fingerprint}));
 check('P5 kernel floor pack is rendered by Godot for the current layout',p5.first.renderer.revision==='p5-hd2d-2'&&p5.first.renderer.source==='kernel'&&p5.first.renderer.fingerprint===p5.first.fingerprint&&p5.first.renderer.triangles>5000&&p5.first.renderer.textureLayers>8,p5.first.renderer);
 p5.descent=await independent.evaluate(()=>{
  const v=BookseaPlay.inspect(),r=v.region,stairs=r.things.find(t=>t.kind==='stairs'),key=(x,z)=>x+','+z;
  const blocked=(x,z)=>r.things.some(t=>t.kind==='enemy'&&!t.used&&t.x===x&&t.z===z),prev=new Map([[key(v.x,v.z),null]]),queue=[[v.x,v.z]];
  for(const [x,z] of queue){if(x===stairs.x&&z===stairs.z)break;for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,nz=z+dz,k=key(nx,nz);if(prev.has(k)||r.tiles[nz]?.[nx]!=='.'||blocked(nx,nz))continue;prev.set(k,[x,z,dx,dz]);queue.push([nx,nz]);}}
  const steps=[];for(let k=key(stairs.x,stairs.z);prev.get(k);){const [x,z,dx,dz]=prev.get(k);steps.unshift([dx,dz]);k=key(x,z);}
  for(const [dx,dz] of steps)BookseaPlay.input({type:'move',payload:{dx,dz}});
  const at=BookseaPlay.inspect();BookseaPlay.input({type:'interact'});const after=BookseaPlay.inspect();
  return {steps:steps.length,reached:at.x===stairs.x&&at.z===stairs.z,from:r.id,to:after.region.id,depth:after.depth,fingerprint:after.region.layout.fingerprint,veil:BookseaPlay.loading(),ready:BookseaPlay.receipt().ready};
 });
 check('Walking down the stairs starts a new floor behind the loading veil',p5.descent.reached&&p5.descent.to!==p5.descent.from&&p5.descent.veil.visible&&['library','fairytale','marionette'].includes(p5.descent.veil.variant)&&!p5.descent.ready,p5.descent);
 await independent.waitForTimeout(450);await independent.screenshot({path:path.join(verification,'p5-loading-veil.png'),fullPage:false});
 p5.veilShownDuringBuild=await independent.evaluate(()=>BookseaPlay.loading().visible);
 await independent.waitForFunction(fp=>BookseaPlay.receipt().ready&&BookseaPlay.receipt().renderer.fingerprint===fp,p5.descent.fingerprint,{timeout:90000});
 await independent.waitForFunction(()=>BookseaPlay.loading().visible===false,null,{timeout:15000});
 p5.second=await independent.evaluate(()=>BookseaPlay.receipt().renderer);
 check('Veil stays up while the next floor builds and clears once Godot renders it',p5.veilShownDuringBuild&&p5.second.revision==='p5-hd2d-2'&&p5.second.source==='kernel'&&p5.second.serial>p5.first.renderer.serial,{kernelMs:p5.second.kernelMs,packMs:p5.second.packMs,importMs:p5.second.importMs,buildMs:p5.second.buildMs,triangles:p5.second.triangles});
 await independent.waitForTimeout(600);await independent.screenshot({path:path.join(verification,'p5-second-floor.png'),fullPage:false});
 await independent.locator('.rpg-menu-button').click();await independent.getByRole('button',{name:'设置',exact:true}).click();await independent.getByRole('button',{name:'轻量画质',exact:true}).click();await independent.getByRole('button',{name:'继续远征',exact:true}).click();await independent.waitForFunction(()=>BookseaPlay.inspect().settings.graphicsQuality==='mobile');check('Low quality is a working explicit user choice',true);
 await independent.screenshot({path:path.join(verification,'independent-mobile-emulation.png'),fullPage:true});check('Independent startup has no uncaught browser errors',independentErrors.length===0,independentErrors);await independentContext.close();

 const pck=release.pck;
 const report={passed:true,p5,publicDistributionBundleSha256:createHash('sha256').update(await readFile(path.join(publicRoot,'distribution.js'))).digest('hex'),checks,errors,requests,pck,cold,warm,offline:{cache:offline.cache},player:'User-provided 4x4 sprite, one map walker; packed resource dimensions checked separately',scope:'Actual latest-reader menu plus two-origin cached scripts, WebGL/Godot, BGM decode, keyboard movement, warm/offline reload, resource-only cache clear and synthetic-host settlement. Not a real LLM or real player-card acceptance, nor a physical-phone test.'};
 await writeFile(path.join(verification,'release-browser.json'),JSON.stringify(report,null,2)+'\n');console.log('RELEASE_BROWSER_PASS',checks.length);
}catch(e){let diagnostic;try{diagnostic=await activeFrame?.evaluate(()=>({status:document.getElementById('status')?.textContent,loader:document.getElementById('loader-status')?.textContent,resources:document.getElementById('resource-status')?.textContent,cache:window.BookseaResources?.inspect(),receipt:window.BookseaPlay?.receipt(),view:window.BookseaPlay?.inspect()?.mode}));await activePage?.screenshot({path:path.join(verification,'external-failure.png')});}catch{};console.error('DIAGNOSTIC',diagnostic,consoleMessages.slice(-20));await writeFile(path.join(verification,'release-browser.json'),JSON.stringify({passed:false,error:String(e),stack:e.stack,checks,errors,requests,diagnostic,consoleMessages},null,2)+'\n');console.error(e);process.exitCode=1;
}finally{await browser?.close();for(const server of [hostServer,assetServer])if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}
