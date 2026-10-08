// Actual Godot PCK + production HTML UI. Only isolated synthetic state is exercised.
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {mkdir, readFile, writeFile, stat} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {build} from 'esbuild';
const impl=fileURLToPath(new URL('../',import.meta.url)),project=path.dirname(impl.replace(/[\\/]$/,''));
const out=path.resolve(impl,process.argv.find(a=>a.startsWith('--output='))?.slice(9)??'verification/supplier-0242'),web=path.join(project,'16-Godot可玩区域/web');
const {chromium}=createRequire(path.join(project,'10-联调环境/package.json'))('playwright');
const bundle=await build({entryPoints:[path.join(impl,'tests/supplier-browser-fixture.ts')],bundle:true,write:false,format:'iife',globalName:'SupplierFixture',target:'es2022'});
await mkdir(out,{recursive:true});let browser,page;const checks=[],errors=[];
const check=(name,ok,detail)=>{checks.push({name,passed:!!ok,detail});console.log(name,!!ok);if(!ok)throw Error(name);};
const server=createServer(async(req,res)=>{try{
 const p=new URL(req.url,'http://fixture').pathname;
 if(p==='/'){res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});res.end('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style><main id="app"></main><script src="/game.js"></script><script src="/fixture.js"></script><script>SupplierFixture.boot().catch(e=>{console.error(e);window.fixtureError=String(e)})</script>');return;}
 if(p==='/fixture.js'){res.writeHead(200,{'Content-Type':'application/javascript'});res.end(bundle.outputFiles[0].text);return;}
 if(p==='/favicon.ico'){res.writeHead(204);res.end();return;}
 const name=p.slice(1);if(name!==path.basename(name)||!/^game\.(js|wasm|pck|audio\.worklet\.js|audio\.position\.worklet\.js)$/.test(name))throw Error('not a runtime');
 const file=path.join(web,name),info=await stat(file),ext=path.extname(file);res.writeHead(200,{'Content-Length':info.size,'Content-Type':ext==='.js'?'application/javascript':ext==='.wasm'?'application/wasm':'application/octet-stream','Cache-Control':'no-store'});createReadStream(file).pipe(res);
 }catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const supply=()=>page.evaluate(()=>BookseaPlay.receipt().renderer.supplyPoints);
const opened=()=>page.waitForFunction(()=>document.querySelector('.rpg-supplier:not([hidden])')?.dataset.typing==='false'&&document.querySelector('.rpg-supplier-portrait')?.naturalWidth>0);
try{
 const artDir=path.join(project,'20-正式怪物美术/M4-补给员'),artManifest=JSON.parse(await readFile(path.join(artDir,'asset-manifest.json'),'utf8'));
 const digest=data=>createHash('sha256').update(data).digest('hex'),sprite=await readFile(path.join(artDir,'supplier.png'));
 const artEvidence={spriteSHA256:digest(sprite),importedSpriteSHA256:digest(await readFile(path.join(project,'16-Godot可玩区域/godot/assets/interactions/supplier.png'))),portraitSHA256:digest(await readFile(path.join(artDir,'supplier-portrait.png'))),importedPortraitSHA256:digest(await readFile(path.join(project,'16-Godot可玩区域/godot/assets/interactions/supplier-portrait.png'))),nativeDimensions:[sprite.readUInt32BE(16),sprite.readUInt32BE(20)],manifestVersion:artManifest.version};
 check('Declared native sprite is imported byte-identically; original portrait unchanged',artEvidence.spriteSHA256===artManifest.files['supplier.png'].sha256&&artEvidence.importedSpriteSHA256===artEvidence.spriteSHA256&&artEvidence.portraitSHA256==='4c43d96797c855da9b3d6e6a324d92ccdc6040b1e7b9785b67a186a1b3eaadc9'&&artEvidence.importedPortraitSHA256===artEvidence.portraitSHA256&&JSON.stringify(artEvidence.nativeDimensions)===JSON.stringify([artManifest.sprite.width,artManifest.sprite.height]),artEvidence);
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--no-first-run','--disable-background-networking']});
 page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(/SCRIPT ERROR|Parse Error|Assertion failed/.test(m.text()))errors.push(m.text());});
 await page.goto(base+'/');
 await page.waitForFunction(()=>{if(window.fixtureError)throw Error(fixtureError);return window.SupplierTest?.started&&window.BookseaPlay?.receipt().ready;},null,{timeout:90000});
 const initial=await supply();check('Packed map contains one supplier sprite, no book or bench',initial.length===1&&initial[0].kind==='supplier'&&initial[0].visible&&initial[0].art.endsWith('/supplier.png'),initial);
 await page.screenshot({path:path.join(out,'map-supplier.png')});
 const before=await page.evaluate(()=>({resources:SupplierTest.state.party.map(p=>p.current),seed:SupplierTest.state.seed,position:[SupplierTest.state.x,SupplierTest.state.z],layout:SupplierTest.state.region.layout.fingerprint}));
 await page.keyboard.press('e');await opened();
 check('Exact name, question and four requested options',await page.locator('.rpg-supplier-name').innerText()==='补给员'&&await page.locator('.rpg-supplier-question').innerText()==='要选哪个呢？'&&JSON.stringify(await page.locator('.rpg-supplier-choice').allTextContents())===JSON.stringify(['事件','长椅','商店','杀害']));
 check('Original user portrait arrives from packed Godot without external image requests',await page.locator('.rpg-supplier-portrait').evaluate(i=>i.naturalWidth===832&&i.naturalHeight===1216&&i.src.startsWith('data:image/png;base64,')));
 for(const viewport of [{width:1280,height:720},{width:390,height:844},{width:844,height:390}]){
  await page.setViewportSize(viewport);
  const fit=await page.evaluate(()=>{
   const b=s=>document.querySelector(s).getBoundingClientRect(),d=b('.rpg-supplier-dialogue'),n=b('.rpg-supplier-name'),c=b('.rpg-supplier-choices'),p=b('.rpg-supplier-portrait'),r=b('.rpg-supplier');
   return {nameLeft:n.left<r.width*.25,portraitRight:p.left+p.width/2>r.width*.55,choicesCentre:Math.abs((c.left+c.width/2)/r.width-.5)<.09,dialogueBottom:d.top>r.height*.6&&d.bottom<=r.height,choicesClear:c.bottom<n.top,inside:c.left>=0&&c.right<=r.width&&n.top>=0,noOverflow:document.documentElement.scrollWidth<=innerWidth+1,rects:{dialogue:[d.x,d.y,d.width,d.height],name:[n.x,n.y,n.width,n.height],choices:[c.x,c.y,c.width,c.height],portrait:[p.x,p.y,p.width,p.height]}};
  });
  check('VN layout fits '+viewport.width+'x'+viewport.height,Object.entries(fit).filter(([k])=>k!=='rects').every(([,v])=>v===true),fit);
  await page.screenshot({path:path.join(out,`dialogue-${viewport.width}x${viewport.height}.png`)});
 }
 await page.setViewportSize({width:1280,height:720});
 await page.keyboard.press('w');
 check('Movement and RNG remain frozen while dialogue is open',await page.evaluate(b=>SupplierTest.state.x===b.position[0]&&SupplierTest.state.z===b.position[1]&&SupplierTest.state.seed===b.seed&&SupplierTest.state.explorationMs<3000,before));
 await page.keyboard.press('Escape');
 check('Escape leaves the same NPC unconsumed',await page.evaluate(()=>SupplierTest.state.mode==='explore'&&SupplierTest.state.region.things.some(t=>t.kind==='supplier'&&!t.used)));
 await page.locator('.rpg-interact').click();await opened();
 await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
 await page.waitForFunction(()=>BookseaPlay.receipt().renderer.supplyPoints?.[0]?.kind==='camp');
 const bench=await supply();
 check('Keyboard choice removes supplier and draws a bench at the same ID',bench.length===1&&bench[0].id===initial[0].id&&bench[0].kind==='camp'&&bench[0].art.endsWith('/bench.png'),bench);
 check('No heal on choosing bench; same floor, no immediate consumption',await page.evaluate(b=>JSON.stringify(SupplierTest.state.party.map(p=>p.current))===JSON.stringify(b.resources)&&SupplierTest.state.region.layout.fingerprint===b.layout&&SupplierTest.state.region.things.find(t=>t.kind==='camp')?.used===false,before));
 await page.waitForFunction(()=>{const n=document.querySelector('.rpg-nearby');return n&&!n.hidden;},null,{timeout:5000}).catch(()=>{});
 check('Choosing bench shows no notice; standing next to it shows exactly 椅子可以坐',await page.evaluate(()=>{const t=document.querySelector('.rpg-toast'),n=document.querySelector('.rpg-nearby');return SupplierTest.state.notice===''&&(!t||t.hidden||!t.textContent)&&n&&!n.hidden&&n.textContent==='椅子可以坐';}));
 await page.screenshot({path:path.join(out,'map-bench.png')});
 await page.keyboard.press('e');
 check('Fresh bench interaction fully restores the whole party once',await page.evaluate(()=>SupplierTest.state.region.things.find(t=>t.kind==='camp')?.used&&SupplierTest.state.party.every(p=>['hp','mp','sp'].every(k=>Math.abs(p.current[k]-p.card.numeric.max[k])<1.01))));
 await page.waitForFunction(()=>document.querySelector('.rpg-nearby')?.hidden,null,{timeout:5000}).catch(()=>{});
 check('One bench interaction: no notice, prompt gone, bench no longer drawn',await page.evaluate(()=>SupplierTest.state.notice===''&&document.querySelector('.rpg-nearby').hidden)&&(await supply()).every(x=>x.kind!=='camp'||!x.visible),await supply());
 await page.evaluate(()=>SupplierTest.reset());
 await page.keyboard.press('e');await opened();await page.locator('.rpg-supplier-choice[data-choice="event"]').click();
 await page.waitForFunction(()=>BookseaPlay.receipt().renderer.supplyPoints?.[0]?.kind==='event');
 const book=await supply();check('Mouse choice removes supplier and draws only the event book',book.length===1&&book[0].id===initial[0].id&&book[0].art.endsWith('/event-book.png'),book);
 check('Event selection only materialises a book, it does not open/settle the event',await page.evaluate(()=>SupplierTest.state.mode==='explore'&&!SupplierTest.state.eventState&&SupplierTest.state.run.rewards.length===0));
 await page.screenshot({path:path.join(out,'map-event-book.png')});
 const once=await page.evaluate(()=>JSON.stringify(SupplierTest.state.region.things));
 await page.evaluate(()=>BookseaPlay.input({type:'supplierChoice',payload:{choice:'bench'}}));
 check('Repeated/stale choice cannot grant both outcomes',await page.evaluate(x=>JSON.stringify(SupplierTest.state.region.things)===x,once));
 await page.keyboard.press('e');
 check('Fresh book interaction opens the existing event system',await page.evaluate(()=>SupplierTest.state.mode==='event'&&!!SupplierTest.state.eventState)&&await page.locator('.rpg-choice').count()>=1);
 await page.evaluate(()=>SupplierTest.reset());await page.keyboard.press('e');await opened();
 await page.locator('.rpg-supplier-close').click();check('Pointer close preserves supplier',await page.evaluate(()=>SupplierTest.state.mode==='explore'&&SupplierTest.state.region.things.some(t=>t.kind==='supplier'&&!t.used)));
 // 0.40.1：对话模式在桌面、手机竖屏/横屏、弹出键盘后的矮视口都不压关闭钮和名牌，输入框在画面内，她最新一句可见。合成状态，不发模型请求。
 await page.evaluate(()=>{SupplierTest.reset();SupplierTest.state.supplierTalkReady=true;SupplierTest.runtime.input({type:'settings',payload:{}});});
 await page.keyboard.press('e');await opened();
 check('Talk option comes first when the supplier agent is ready',JSON.stringify(await page.locator('.rpg-supplier-choice').allTextContents())===JSON.stringify(['对话','事件','长椅','商店','杀害']));
 await page.locator('.rpg-supplier-choice[data-choice="talk"]').click();
 await page.waitForFunction(()=>{const t=document.querySelector('.rpg-supplier-talk');return !!t&&!t.hidden;});
 await page.evaluate(()=>{const s=SupplierTest.state,t=s.supplierTalks[s.supplierState.thingId];for(let i=0;i<14;i++)t.log.push(i%2?{role:'supplier',text:'这一层的东西可不太好找，你确定要我现在去翻箱子吗？（'+i+'）'}:{role:'player',text:'有没有能回血的药？顺便问问下一层要注意什么。（'+i+'）'});t.log.push({role:'supplier',text:'拿好。下一层是水路，鞋子会湿。'});SupplierTest.runtime.input({type:'settings',payload:{}});});
 for(const viewport of [{width:1280,height:720},{width:390,height:844},{width:844,height:390},{width:390,height:460},{width:844,height:200}]){
  await page.setViewportSize(viewport);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.waitForTimeout(200);
  const fit=await page.evaluate(()=>{
   const shown=e=>!!e&&!e.closest('[hidden]')&&getComputedStyle(e).display!=='none';
   const b=s=>{const e=document.querySelector(s);return shown(e)?e.getBoundingClientRect():null;};
   const r=b('.rpg-supplier'),box=b('.rpg-supplier-talk'),log=b('.rpg-supplier-talk-log'),row=b('.rpg-supplier-talk-row'),close=b('.rpg-supplier-close'),full=b('.rpg-fullscreen'),name=b('.rpg-supplier-name'),dialogue=b('.rpg-supplier-dialogue');
   const apart=(a,c)=>!a||!c||Math.min(a.right,c.right)-Math.max(a.left,c.left)<=1||Math.min(a.bottom,c.bottom)-Math.max(a.top,c.top)<=1;
   const latest='拿好。下一层是水路',inLog=[...document.querySelectorAll('.rpg-supplier-talk-line')].some(l=>shown(l)&&l.textContent.includes(latest));
   const inDialogue=!!dialogue&&(document.querySelector('.rpg-supplier-question').getAttribute('aria-label')||'').includes(latest);
   return {rowInside:!!r&&!!row&&row.left>=r.left-.5&&row.right<=r.right+.5&&row.top>=r.top-.5&&row.bottom<=r.bottom+.5,logTall:!!log&&log.height>=44,closeClear:apart(close,box),fullscreenClear:!!full&&apart(full,box)&&apart(full,close)&&full.top>=r.top&&full.right<=r.right+.5,nameClear:apart(name,box),dialogueClear:apart(dialogue,box),latestVisible:inLog||inDialogue,noOverflow:document.documentElement.scrollWidth<=innerWidth+1,rects:{where:inLog?'log':inDialogue?'dialogue':'none',box:box&&[box.x,box.y,box.width,box.height],log:log&&[log.x,log.y,log.width,log.height]}};
  });
  await page.screenshot({path:path.join(out,`talk-${viewport.width}x${viewport.height}.png`)});
  check('Talk layout fits '+viewport.width+'x'+viewport.height,Object.entries(fit).filter(([k])=>k!=='rects').every(([,v])=>v===true),fit);
 }
 await page.setViewportSize({width:1280,height:720});
 await page.locator('.rpg-supplier-talk-back').click();
 await page.waitForFunction(()=>document.querySelector('.rpg-supplier-talk')?.hidden===true);
 await page.locator('.rpg-supplier-close').click();
 check('Leaving talk keeps the same supplier unconsumed',await page.evaluate(()=>SupplierTest.state.mode==='explore'&&SupplierTest.state.region.things.some(t=>t.kind==='supplier'&&!t.used)));
 for(const viewport of [{width:1280,height:800},{width:390,height:844}]){
  await page.setViewportSize(viewport);
  const panel=await page.evaluate(()=>{const mounted=SupplierTest.narrativePanel(),p=document.querySelector('#narrative-check .bs-narrative'),body=p.querySelector('.bs-narrative-body'),pr=p.getBoundingClientRect(),br=body.getBoundingClientRect(),buttons=[...p.querySelectorAll('.bs-narrative-actions .bs-button')].map(x=>x.getBoundingClientRect());
   return {mounted,compact:pr.bottom-br.bottom-parseFloat(getComputedStyle(p).paddingBottom)<=40,buttons:buttons.length===3&&buttons.every(x=>x.height>=44&&x.left>=0&&x.right<=innerWidth+1),height:Math.round(pr.height)};});
  await page.screenshot({path:path.join(out,`narrative-${viewport.width}x${viewport.height}.png`)});
  await page.evaluate(()=>SupplierTest.closeNarrativePanel());
  check('Narrative panel is compact at '+viewport.width+'x'+viewport.height,panel.mounted&&panel.compact&&panel.buttons,panel);
 }
 await page.setViewportSize({width:1280,height:720});
 // An additional, separated synthetic pose is for manual artwork review, not a gameplay teleport feature.
 const artPreviewPose=await page.evaluate(()=>{SupplierTest.reset();return SupplierTest.artPose();});
 await page.waitForFunction(()=>BookseaPlay.receipt().renderer.supplyPoints?.[0]?.kind==='supplier');
 await page.waitForTimeout(1000);
 for(const viewport of [{width:1280,height:720},{width:390,height:844},{width:844,height:390}]){
  await page.setViewportSize(viewport);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.screenshot({path:path.join(out,`art-map-${viewport.width}x${viewport.height}.png`)});
 }
 check('No browser or Godot errors',errors.length===0,errors);
 const evidence={passed:true,checks,errors,artEvidence,artPreviewPose,pckSHA256:createHash('sha256').update(await readFile(path.join(web,'game.pck'))).digest('hex'),scope:'Real packed Godot + browser + keyboard/pointer; synthetic fixture only, no real chat/model/settlement; mobile layouts are viewport emulation.'};
 await writeFile(path.join(out,'browser-supplier.json'),JSON.stringify(evidence,null,2)+'\n');console.log('SUPPLIER_BROWSER_PASS',checks.length);
}catch(e){await writeFile(path.join(out,'browser-supplier.json'),JSON.stringify({passed:false,error:String(e),checks,errors},null,2)+'\n');try{await page?.screenshot({path:path.join(out,'browser-failure.png')});}catch{}console.error(e);process.exitCode=1;}
finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
