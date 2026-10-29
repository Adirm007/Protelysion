// Real Chromium/WebGL/Godot with the persistent reader, against synthetic host
// state only. No running Tavern, private chat, credential, or model is accessed.
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {build} from 'esbuild';

const impl=fileURLToPath(new URL('../',import.meta.url));
const project=path.dirname(impl),workspace=path.dirname(project);
const reader=path.join(workspace,'reader'),publicRoot=path.join(project,'22-发布/booksea-github/site');
const output=path.join(impl,'verification/script-runtime-20261028/reader-godot-browser');
await mkdir(output,{recursive:true});
const require=createRequire(path.join(project,'10-联调环境/package.json'));
const {chromium}=require('playwright');
const {build:buildReader}=await import(pathToFileURL(path.join(reader,'tools/build_core.mjs')).href);
const {runtime}=await buildReader();
const bundle=await build({entryPoints:[path.join(impl,'tests/release-browser-fixture.ts')],bundle:true,format:'esm',write:false,platform:'node',target:'es2022'});
const {releaseFixture}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const fixture=releaseFixture();
const checks=[],errors=[],consoleMessages=[],requests=[];
const check=(name,passed,detail)=>{checks.push({name,passed:!!passed,...(detail===undefined?{}:{detail})});console.log(name,!!passed);if(!passed)throw Error(name);};
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve('http://127.0.0.1:'+server.address().port)));
const mime={'.js':'application/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.html':'text/html; charset=utf-8','.wasm':'application/wasm','.ogg':'audio/ogg','.mp3':'audio/mpeg','.wav':'audio/wav','.txt':'text/plain; charset=utf-8','.png':'image/png'};
async function serve(file,res,cors=false){const info=await stat(file);res.writeHead(200,{'Content-Type':mime[path.extname(file)]??'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-store',...(cors?{'Access-Control-Allow-Origin':'*','Cross-Origin-Resource-Policy':'cross-origin'}:{})});createReadStream(file).pipe(res);}
let assetServer,hostServer,browser,page,frame;
try{
 assetServer=createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url,'http://local').pathname);if(!name.startsWith('/assets/')){res.writeHead(404);res.end();return;}const file=path.resolve(publicRoot,name.slice('/assets/'.length));if(!file.startsWith(publicRoot+path.sep)){res.writeHead(404);res.end();return;}await serve(file,res,true);}catch{res.writeHead(404);res.end();}});
 const assetOrigin=await listen(assetServer);
 const harness=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>body{margin:0;min-height:100vh;background:#2a2831;color:#eee}#form_sheld{position:fixed;bottom:0;left:0;right:0;height:88px;padding:8px;background:#35313c}textarea{width:75%;height:60px}button{min-height:36px}</style><script src="/lodash.js"></script><div id="chat"></div><form id="form_sheld"><textarea id="send_textarea"></textarea><button id="send_but" type="button">发送</button></form><script>
window.__audit=${JSON.stringify(fixture).replace(/</g,'\\u003c')};
const store=window.__audit;store.messages[0].mes=store.messages[0].message;store.messages[0].is_user=false;store.messages[0].swipe_id=0;store.messages[0].data=structuredClone(store.mvu);store.messages[0].extra={};
Object.defineProperty(store,'mvu',{enumerable:true,configurable:true,get:()=>store.messages.at(-1).data,set:v=>{store.messages.at(-1).data=v;}});
store.generationCalls=0;store.metadataSaves=0;store.chatSaves=0;
const events=Object.fromEntries(['CHAT_CHANGED','MESSAGE_RECEIVED','MESSAGE_UPDATED','MESSAGE_SWIPED','MESSAGE_DELETED','GENERATION_ENDED','GENERATION_STOPPED','GENERATION_AFTER_COMMANDS','MESSAGE_SENT'].map(name=>[name,name]));
const listeners=new Map();const source={on(name,fn){listeners.set(name,[...(listeners.get(name)||[]),fn]);},makeFirst(name,fn){listeners.set(name,[fn,...(listeners.get(name)||[])]);},removeListener(name,fn){listeners.set(name,(listeners.get(name)||[]).filter(x=>x!==fn));},async emit(name,...args){for(const fn of [...(listeners.get(name)||[])])await fn(...args);}};
const metadata={get variables(){return store.chat;},set variables(value){store.chat=value;}};
const ctx={characterId:'release-card',name1:'测试作家',name2:'九十九夜梦',chat:store.messages,chatMetadata:metadata,getCurrentChatId:()=> 'release-chat',onlineStatus:'connected',eventSource:source,eventTypes:events,saveChat:async()=>{store.chatSaves++;},saveMetadata:async()=>{store.metadataSaves++;},stopGeneration:()=>{store.stopped=true;void source.emit(events.GENERATION_STOPPED);return true;}};
const index=o=>typeof o?.message_id==='number'&&o.message_id>=0?o.message_id:store.messages.length-1;
const helper={getLastMessageId:()=>store.messages.length-1,getChatMessages:range=>typeof range==='number'?(store.messages[range<0?store.messages.length-1:range]?[{...structuredClone(store.messages[range<0?store.messages.length-1:range]),message_id:range<0?store.messages.length-1:range}]:[]):store.messages.map((m,i)=>({...structuredClone(m),message_id:i})),
getVariables:o=>structuredClone(o?.type==='chat'?store.chat:store.messages[index(o)]?.data??{}),updateVariablesWith:async(fn,o)=>{if(o.type==='chat')store.chat=fn(structuredClone(store.chat));else{const m=store.messages[index(o)];m.data=fn(structuredClone(m.data));}store.writes++;},replaceVariables:async(value,o)=>{if(o.type==='chat')store.chat=structuredClone(value);else store.messages[index(o)].data=structuredClone(value);store.writes++;},insertOrAssignVariables:async(patch,o)=>{if(o.type==='chat')Object.assign(store.chat,patch);else Object.assign(store.messages[index(o)].data,patch);store.writes++;},
getCharWorldbookNames:()=>({primary:null,additional:[]}),getChatWorldbookName:()=>null,getGlobalWorldbookNames:()=>[],getWorldbook:()=>[],waitGlobalInitialized:async()=>{},
createChatMessages:async items=>{for(const item of items)store.messages.push({...structuredClone(item),is_user:item.role==='user',mes:item.message,data:structuredClone(item.data??store.mvu),extra:structuredClone(item.extra??{}),swipe_id:0});},
generateRaw:async()=>{store.modelCalls++;throw Error('Model calls forbidden in browser fixture');},triggerSlash:async()=>{store.generationCalls++;throw Error('Automatic handoff must not trigger generation');},stopGenerationById(){}};
window.SillyTavern={getContext:()=>ctx};window.TavernHelper=helper;window.tavern_events=events;window.__eventSource=source;window.__eventListeners=listeners;
window.eventOn=(name,fn)=>{source.on(name,fn);return{stop:()=>source.removeListener(name,fn)};};window.eventMakeFirst=(name,fn)=>{source.makeFirst(name,fn);return{stop:()=>source.removeListener(name,fn)};};window.eventRemoveListener=(name,fn)=>source.removeListener(name,fn);
window.ReaderCoreConfig={bookseaBase:${JSON.stringify(assetOrigin+'/assets/')}};
window.__sendOriginal=async text=>{document.getElementById('send_textarea').value=text;await source.emit(events.GENERATION_AFTER_COMMANDS,'normal',{},false);const data=structuredClone(store.mvu),row={role:'user',is_user:true,is_system:false,message:text,mes:text,data,extra:{},swipe_id:0};store.messages.push(row);document.getElementById('send_textarea').value='';await source.emit(events.MESSAGE_SENT,store.messages.length-1);return row;};
</script></html>`;
 hostServer=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://local').pathname;if(pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}if(pathname==='/lodash.js'){await serve(path.join(impl,'node_modules/lodash/lodash.min.js'),res);return;}if(pathname==='/runtime.js'){res.writeHead(200,{'Content-Type':'application/javascript; charset=utf-8'});res.end(runtime);return;}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(harness);}catch(error){res.writeHead(500);res.end(String(error));}});
 const hostOrigin=await listen(hostServer);check('Synthetic host and game assets use separate local origins',hostOrigin!==assetOrigin,{hostOrigin,assetOrigin});
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--no-first-run','--disable-background-networking','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
 const context=await browser.newContext({viewport:{width:1440,height:1050}});page=await context.newPage();
 await page.addInitScript(()=>{window.__glDraws=0;for(const type of ['WebGLRenderingContext','WebGL2RenderingContext']){const proto=window[type]?.prototype;if(!proto)continue;for(const name of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){const fn=proto[name];if(typeof fn==='function')proto[name]=function(...args){window.__glDraws++;return fn.apply(this,args);};}}});
 page.on('pageerror',error=>errors.push(String(error)));page.on('console',message=>{consoleMessages.push(message.type()+': '+message.text());if(/SCRIPT ERROR|Parse Error|Assertion failed/.test(message.text()))errors.push(message.text());});
 page.on('response',response=>{if(response.url().startsWith(assetOrigin))requests.push({url:response.url().slice(assetOrigin.length),status:response.status()});});
 await page.route('**/*',route=>{const url=new URL(route.request().url());return ['127.0.0.1','localhost'].includes(url.hostname)||['blob:','data:'].includes(url.protocol)?route.continue():route.abort();});
 await page.goto(hostOrigin);
 await page.evaluate(async()=>{window.__readerModule=await import('/runtime.js');__readerModule.start();await ReaderCore.ready;});
 check('Reader starts without any dream message',await page.locator('#reader-core-controller').count()===1&&await page.locator('.mes').count()===0);
 await page.evaluate(()=>ReaderCore.open('lobby'));await page.locator('#dlb-overlay').waitFor();await page.evaluate(()=>ReaderCore.close());
 await page.evaluate(()=>ReaderCore.openBooksea('maze'));
 await page.locator('[data-reader-booksea] iframe').waitFor();frame=await(await page.locator('[data-reader-booksea] iframe').elementHandle()).contentFrame();
 await frame.locator('#download-core').waitFor({state:'visible',timeout:30000});
 check('Persistent resource page installs the shared theme and hides closed dialogs',await frame.evaluate(()=>document.getElementById('booksea-game').classList.contains('bs-root')&&getComputedStyle(document.getElementById('resource-menu')).display==='none'));
 await frame.locator('#download-core').click();await frame.locator('#resume').waitFor({state:'visible',timeout:180000});
 const core=await frame.evaluate(()=>BookseaResources.inspect());check('Light download verifies actual core resources without prefetching all audio',core.networkRequests>0&&core.downloadedBytes>30*1024*1024&&core.downloadedBytes<100*1024*1024,core);
 await frame.locator('#resume').click();await frame.waitForFunction(()=>window.BookseaPlay?.receipt().ready&&BookseaPlay.receipt().renderer?.fingerprint,null,{timeout:120000});
 await frame.waitForFunction(()=>BookseaPlay.inspect().paused===false,null,{timeout:30000});
 const initial=await frame.evaluate(()=>({view:BookseaPlay.inspect(),receipt:BookseaPlay.receipt(),draws:window.__glDraws}));
 check('Actual Godot WebGL presents the saved random floor',initial.receipt.renderer.source==='kernel'&&initial.receipt.renderer.triangles>5000&&initial.draws>0,{renderer:initial.receipt.renderer,draws:initial.draws});
 await frame.evaluate(()=>{window.__originalPlay=BookseaPlay;window.__originalCanvas=document.querySelector('canvas');window.__originalFingerprint=BookseaPlay.inspect().region.layout.fingerprint;});
 await frame.locator('.rpg-menu-button').click();await frame.getByRole('button',{name:'设置',exact:true}).click();await frame.locator('[data-enable]').click();await frame.getByRole('button',{name:'继续远征',exact:true}).click();
 await frame.waitForFunction(()=>BookseaAudio.inspect().playing&&BookseaAudio.inspect().contextState==='running',null,{timeout:60000});
 check('Actual encoded BGM is decoded and playing',await frame.evaluate(()=>BookseaAudio.inspect().errors.length===0),await frame.evaluate(()=>({playing:BookseaAudio.inspect().playing,state:BookseaAudio.inspect().contextState})));
 await page.screenshot({path:path.join(output,'persistent-godot-visible.png')});
 const startBanners=()=>consoleMessages.filter(message=>/Godot Engine v/.test(message)).length;
 const startsBefore=startBanners();await page.locator('[data-reader-booksea] header').getByRole('button',{name:'返回聊天',exact:true}).click();
 await page.waitForTimeout(400);const hiddenStart=await frame.evaluate(()=>({draws:window.__glDraws,view:BookseaPlay.inspect(),audio:BookseaAudio.inspect()}));await page.waitForTimeout(600);
 const hiddenEnd=await frame.evaluate(()=>({draws:window.__glDraws,view:BookseaPlay.inspect(),audio:BookseaAudio.inspect()}));
 check('Hidden retained game pauses numeric state, WebGL draw calls and audio',hiddenEnd.view.paused&&hiddenEnd.draws===hiddenStart.draws&&hiddenEnd.audio.contextState==='suspended',{draws:[hiddenStart.draws,hiddenEnd.draws],audio:hiddenEnd.audio.contextState});
 check('Hidden window keeps the same authoritative scene',hiddenEnd.view.region.layout.fingerprint===initial.view.region.layout.fingerprint&&hiddenEnd.view.x===hiddenStart.view.x&&hiddenEnd.view.z===hiddenStart.view.z);
 const largeBefore=requests.filter(item=>!item.url.includes('release-manifest')).length;
 await page.evaluate(()=>ReaderCore.openBooksea('maze'));await frame.waitForFunction(()=>window.__glDraws>0&&BookseaPlay.inspect().paused,null,{timeout:10000});
 await page.waitForTimeout(250);
 const warm=await frame.evaluate(()=>({same:BookseaPlay===window.__originalPlay&&document.querySelector('canvas')===window.__originalCanvas,view:BookseaPlay.inspect(),draws:window.__glDraws}));
 check('Reopening keeps one iframe, runtime, canvas and Godot startup',warm.same&&await page.locator('[data-reader-booksea] iframe').count()===1&&startBanners()===startsBefore,{engineStartsBefore:startsBefore,engineStartsAfter:startBanners(),same:warm.same});
 check('Warm reopen resumes rendering but leaves rules paused',warm.draws>hiddenEnd.draws&&warm.view.paused,{hiddenDraws:hiddenEnd.draws,warmDraws:warm.draws});
 check('Warm reopen downloads no new core assets',requests.filter(item=>!item.url.includes('release-manifest')).length===largeBefore);
 const text='我先停下脚步，向同行者说明眼前的局面。';const sent=await page.evaluate(text=>__sendOriginal(text),text);
 await page.waitForFunction(()=>document.querySelector('[data-reader-booksea]')?.hidden===true,null,{timeout:10000});
 const handed=await page.evaluate(()=>({messages:__audit.messages,mode:__audit.chat.booksea.narrativeMode,state:__audit.chat.booksea.activeExpedition,modelCalls:__audit.modelCalls,generationCalls:__audit.generationCalls}));
 check('Awaited host events attach facts to the original user message only',sent.mes===text&&handed.messages.length===2&&handed.messages.at(-1).mes===text&&handed.messages.at(-1).extra.bookseaHandoff?.kind==='narrative'&&handed.messages.at(-1).extra.bookseaHandoff?.messageId===1);
 check('Automatic prose contains the live position, party and unsettled gains',handed.mode?.transition==='user-message'&&handed.state?.narrative?.active&&handed.mode.breakpoint.includes('position')&&handed.mode.breakpoint.includes('party')&&handed.mode.breakpoint.includes('gains'),{depth:handed.mode?.depth,runId:handed.mode?.runId});
 check('Automatic transition starts no extra generation or model call',handed.modelCalls===0&&handed.generationCalls===0);
 await page.evaluate(()=>{const actor=__audit.mvu.stat_data.关系列表['测试伙伴甲'];actor.生命值.当前=13;actor.法力值.当前=9;actor.体力值.当前=5;});
 const beforeFp=await page.evaluate(()=>__audit.mvu.stat_data.命运点数);await page.evaluate(()=>ReaderCore.openBooksea('maze'));
 await frame.waitForFunction(()=>BookseaPlay.receipt().ready&&!BookseaPlay.inspect().narrative,null,{timeout:120000});
 const returned=await page.evaluate(()=>({fp:__audit.mvu.stat_data.命运点数,actor:__audit.mvu.stat_data.关系列表['测试伙伴甲'],active:__audit.chat.booksea.activeExpedition}));
 check('Returning to the game preserves prose resource use without FP debit or settlement',returned.fp===beforeFp&&returned.actor.生命值.当前===13&&returned.actor.法力值.当前===9&&returned.actor.体力值.当前===5&&returned.active.run.id===handed.state.run.id,{fp:returned.fp,hp:returned.actor.生命值.当前,mp:returned.actor.法力值.当前,sp:returned.actor.体力值.当前});
 await page.screenshot({path:path.join(output,'persistent-godot-after-narrative.png')});
 await page.evaluate(()=>__readerModule.stop());await page.waitForTimeout(600);
 check('Core stop removes controller, window, canvas and all host event listeners',await page.locator('#reader-core-controller,#reader-core-launcher,[data-reader-booksea]').count()===0&&await page.evaluate(()=>[...__eventListeners.values()].reduce((count,values)=>count+values.length,0))===0);
 check('No model calls occurred during the entire run',await page.evaluate(()=>__audit.modelCalls===0&&__audit.generationCalls===0));
 check('No uncaught JavaScript or Godot script errors occurred',errors.length===0,errors);
 await writeFile(path.join(output,'result.json'),JSON.stringify({kind:'synthetic-host-real-chromium-godot',checks,errors,requests,consoleMessages},null,2)+'\n');
 console.log('PASS',checks.length,'persistent reader / actual Godot browser checks');
}catch(error){
 const debug={error:String(error?.stack??error),checks,errors,requests,consoleMessages};
 if(page)try{debug.host=await page.evaluate(()=>({messages:window.__audit?.messages,chat:window.__audit?.chat,html:document.body.innerText.slice(0,1200)}));await page.screenshot({path:path.join(output,'failure.png')});}catch{}
 if(frame)try{debug.game=await frame.evaluate(()=>({status:document.body.innerText.slice(-4000),receipt:window.BookseaPlay?.receipt(),view:window.BookseaPlay?.inspect(),audio:window.BookseaAudio?.inspect()}));}catch{}
 await writeFile(path.join(output,'failure.json'),JSON.stringify(debug,null,2)+'\n');throw error;
}finally{await browser?.close();await Promise.all([assetServer,hostServer].filter(Boolean).map(server=>new Promise(resolve=>server.close(resolve))));}
