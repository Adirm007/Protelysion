// Isolated browser + synthetic host API, using the actual loopback static server.
// Does not open a real chat, reuse a personal browser profile or call a model.
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
const root=fileURLToPath(new URL('../../',import.meta.url)),impl=path.join(root,'09-实现'),output=path.join(impl,'verification/release-20260922'),origin='http://127.0.0.1:8017';
const {chromium}=createRequire(path.join(root,'10-联调环境/package.json'))('playwright');
const bundled=await build({stdin:{contents:"export {releaseFixture} from './tests/release-browser-fixture';export {MONSTER_ROSTER} from './src/game/monsters/catalog';",resolveDir:impl},bundle:true,format:'esm',platform:'node',write:false});
const {releaseFixture,MONSTER_ROSTER}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const item=JSON.parse(await readFile(path.join(root,'22-发布/本地导入/书海-本机加载正则.json'),'utf8')),installed=JSON.parse(await readFile(path.join(output,'cached-lab-install.json'),'utf8'));
if(createHash('sha256').update(item.replaceString).digest('hex')!==installed.entryCodeSha256)throw Error('Test must match installed local regex');
const html=item.replaceString.replace(/^```html\s*/,'').replace(/\s*```\s*$/,'').replace('<script>','<script>Object.assign(window,parent.__hostShim);</script><script>'),escape=s=>JSON.stringify(s).replace(/</g,'\\u003c');
const lodash=await readFile(path.join(impl,'node_modules/lodash/lodash.min.js'),'utf8');
const body=`<!doctype html><meta charset="utf-8"><script>${lodash}</script><iframe id="game" sandbox="allow-scripts allow-same-origin" style="width:100%;height:960px;border:0"></iframe><script>
window.__audit=${escape(releaseFixture())};const s=window.__audit;
const h={getLastMessageId:()=>s.messages.length-1,getChatMessages:()=>s.messages,getVariables:o=>structuredClone(o.type==='chat'?s.chat:s.mvu),updateVariablesWith:async(f,o)=>{if(o.type==='chat')s.chat=f(structuredClone(s.chat));else s.mvu=f(structuredClone(s.mvu));s.writes++;},replaceVariables:async(v,o)=>{if(o.type==='chat')s.chat=structuredClone(v);else s.mvu=structuredClone(v);s.writes++;},createChatMessages:async m=>s.messages.push(...m),generateRaw:async()=>{s.modelCalls++;throw Error('Model forbidden');},stopGenerationById(){}};
window.__hostShim={TavernHelper:h,SillyTavern:{getContext:()=>({characterId:'release-card',getCurrentChatId:()=> 'release-chat',onlineStatus:'connected',saveChat:async()=>{}})},_:window._};document.getElementById('game').srcdoc=${escape(html)};
</script>`;
const checks=[],errors=[],requests=[];let browser,page,frame;const check=(name,pass,detail)=>{checks.push({name,passed:!!pass,detail});if(!pass)throw Error(name);};
try{
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--disable-background-networking']});const context=await browser.newContext({viewport:{width:1440,height:1080}});page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('request',r=>requests.push(new URL(r.url()).pathname));page.on('console',m=>{if(/SCRIPT ERROR|Parse Error/.test(m.text()))errors.push(m.text());});
 await page.route(origin+'/booksea-isolated-audit',r=>r.fulfill({status:200,contentType:'text/html',body}));await page.goto(origin+'/booksea-isolated-audit');frame=page.frames().find(f=>f.url()==='about:srcdoc');if(!frame)throw Error('No srcdoc frame');
 await frame.locator('#download-core').waitFor({state:'visible',timeout:30000});check('Installed local regex resolves relative assets from an actual srcdoc frame',await frame.evaluate(()=>document.baseURI)===origin+'/booksea-isolated-audit');
 await frame.locator('#download-core').click();await frame.locator('#resume').waitFor({state:'visible',timeout:90000});await frame.locator('#resume').click();await frame.waitForFunction(()=>window.BookseaPlay?.receipt().renderer.fingerprint,null,{timeout:90000});
 check('Actual lab-served cached package renders in the Helper-style frame',await frame.evaluate(()=>BookseaPlay.receipt().ready));
 const steps=await frame.evaluate(()=>{const v=BookseaPlay.inspect(),seen=new Set([v.x+','+v.z]),q=[{x:v.x,z:v.z,path:[]}];while(q.length){const n=q.shift();if(n.path.length&&v.region.things.some(t=>t.kind==='enemy'&&t.x===n.x&&t.z===n.z))return n.path;for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){const x=n.x+dx,z=n.z+dz,k=x+','+z;if(seen.has(k)||v.region.tiles[z]?.[x]!=='.')continue;const t=v.region.things.find(t=>t.x===x&&t.z===z);if(t&&t.kind!=='enemy')continue;seen.add(k);q.push({x,z,path:[...n.path,{dx,dz}]});}}return null;});
 if(!steps)throw Error('No reachable fixture encounter');await frame.evaluate(steps=>{for(const payload of steps)BookseaPlay.input({type:'move',payload});},steps);await frame.waitForFunction(()=>BookseaPlay.inspect().mode==='battle'&&BookseaPlay.receipt().lastMode==='battle',null,{timeout:30000});
 const battle=await frame.evaluate(()=>BookseaPlay.inspect().battle),names=battle.units.filter(u=>u.side==='enemy').map(u=>u.name);check('A real encounter enters the Godot battle interface with formal monster names',names.length>0&&names.every(n=>MONSTER_ROSTER.some(m=>m.name===n)),{enemies:names,steps:steps.length});
 await page.screenshot({path:path.join(output,'actual-lab-battle.png'),fullPage:false});check('No real model was called',await page.evaluate(()=>__audit.modelCalls)===0);check('No private host HTTP APIs were requested',requests.every(p=>!p.startsWith('/api/')),requests.length);check('No uncaught local-frame or Godot errors',errors.length===0,errors);
 await writeFile(path.join(output,'local-srcdoc-browser.json'),JSON.stringify({passed:true,checks,errors,scope:'Actual loopback static server, srcdoc inherited base URI, synthetic host, real Godot encounter; no real chat or model',entryCodeSha256:installed.entryCodeSha256,distributionSha256:installed.distributionSha256},null,2)+'\n');console.log('LOCAL_SRCDOC_PASS',checks.length,names);
}catch(e){let diagnostic;try{diagnostic=await frame?.evaluate(()=>({base:document.baseURI,loader:document.getElementById('loader-status')?.textContent,resources:document.getElementById('resource-status')?.textContent,status:document.getElementById('status')?.textContent,mode:window.BookseaPlay?.inspect().mode}));}catch{}await writeFile(path.join(output,'local-srcdoc-browser.json'),JSON.stringify({passed:false,error:String(e),diagnostic,checks,errors},null,2)+'\n');console.error(e,diagnostic);process.exitCode=1;}finally{await browser?.close();}
