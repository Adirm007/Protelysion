// Isolated real PCK/WebGL + actual DOM input; no real profile, chat, or model.
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {build} from 'esbuild';
const impl=fileURLToPath(new URL('../',import.meta.url)),project=path.dirname(impl.replace(/[\\/]$/,'')),out=path.join(impl,'verification/rpg-ui-023'),web=path.join(project,'16-Godot可玩区域/web');
await mkdir(out,{recursive:true});
const require=createRequire(path.join(project,'10-联调环境/package.json')),{chromium}=require('playwright');
const bundled=await build({entryPoints:[path.join(impl,'tests/rpg-browser-fixture.ts')],bundle:true,write:false,format:'iife',globalName:'RPGFixture',target:'es2022'});
const checks=[],errors=[],logs=[];let browser,page,game;
const check=(name,passed,detail)=>{checks.push({name,passed:!!passed,detail});console.log(name,!!passed);if(!passed)throw Error(name);};
const server=createServer(async(req,res)=>{try{
 const pathname=new URL(req.url,'http://local').pathname;
 if(pathname==='/host'){res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0}#shell{transform:translateZ(0);overflow:hidden;position:relative;z-index:1}</style><section id="shell"><iframe id="embed" src="/?mode=explore&count=4" sandbox="allow-scripts allow-same-origin" style="display:block;width:100%;height:1100px;border:6px solid gold"></iframe></section>');return;}
 if(pathname==='/'){res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>body{margin:0}#app{margin:0}</style><main id="app"></main><script src="/game.js"></script><script src="/fixture.js"></script><script>RPGFixture.boot().catch(e=>{console.error(e);window.fixtureError=String(e)})</script>');return;}
 if(pathname==='/fixture.js'){res.writeHead(200,{'Content-Type':'application/javascript'});res.end(bundled.outputFiles[0].text);return;}
 if(pathname==='/favicon.ico'){res.writeHead(204);res.end();return;}
 const file=path.join(web,path.basename(pathname)),info=await stat(file),ext=path.extname(file);
 res.writeHead(200,{'Content-Length':info.size,'Content-Type':ext==='.js'?'application/javascript':ext==='.wasm'?'application/wasm':'application/octet-stream','Cache-Control':'public,max-age=600'});createReadStream(file).pipe(res);
 }catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
async function ready(){await game.waitForFunction(()=>{if(window.fixtureError)throw Error(window.fixtureError);return window.RPGTest?.started&&window.BookseaPlay?.receipt().ready;},null,{timeout:90000});}
async function launch(mode='battle',count=4,viewport={width:1440,height:900},touch=false,host=false){
 if(page)await page.close();page=await browser.newPage({viewport,isMobile:touch,hasTouch:touch,deviceScaleFactor:touch?3:1});
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{logs.push(m.text());if(/SCRIPT ERROR|Parse Error|Assertion failed/.test(m.text()))errors.push(m.text());});
 await page.goto(base+(host?'/host':`/?mode=${mode}&count=${count}`));game=host?page.frames().find(f=>f.url().includes('mode=explore')):page;
 if(!game)throw Error('Missing game frame');await ready();
}
const settle=()=>game.waitForFunction(()=>!BookseaPlay.presentation().holding,null,{timeout:15000});
async function playerTurn(){await settle();await game.evaluate(()=>RPGTest.playerTurn());await game.locator('.rpg-commands:not([hidden])').waitFor();}
const resources=()=>game.evaluate(()=>{const v=BookseaPlay.inspect(),u=v.battle.units.find(u=>u.id===v.battle.actorId);return {sp:u.sp,hp:u.hp,id:u.id,cost:v.battle.allActions.find(a=>a.id==='test-0').sp};});
async function resolveAction(){await game.waitForFunction(()=>BookseaPlay.presentation().holding,null,{timeout:15000});}
async function skillLayout(label){
 const result=await game.evaluate(()=>{const s=document.querySelector('#stage').getBoundingClientRect(),h=document.querySelector('.rpg-skill-help').getBoundingClientRect(),a=document.querySelector('.rpg-action-window').getBoundingClientRect(),list=document.querySelector('.rpg-action-list'),rows=[...list.querySelectorAll('.rpg-action')].slice(0,2).map(e=>e.getBoundingClientRect());return {inside:h.top>=s.top-1&&h.bottom<a.top&&a.bottom<=s.bottom+1,wide:h.width>s.width*.94&&a.width>s.width*.94,two:Math.abs(rows[0].top-rows[1].top)<2&&rows[1].left>rows[0].right,scroll:list.scrollHeight>list.clientHeight&&list.clientHeight>24};});
 check('Top help and bottom two-column skill list '+label,result.inside&&result.wide&&result.two&&result.scroll,result);
 check('No skill/target confirmation buttons '+label,await game.locator('.rpg-battle button').filter({hasText:/确认/}).count()===0);
}
async function pixelFit(label){
 await game.waitForFunction(()=>{const c=document.querySelector('canvas'),s=document.querySelector('#stage').getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);return Math.abs(c.width-s.width*d)<3&&Math.abs(c.height-s.height*d)<3;},null,{timeout:8000});
 const data=await game.evaluate(()=>({quality:BookseaPlay.inspect().settings.graphicsQuality,renderer:BookseaPlay.receipt().renderer,canvas:[document.querySelector('canvas').width,document.querySelector('canvas').height],stage:[document.querySelector('#stage').clientWidth,document.querySelector('#stage').clientHeight],dpr:devicePixelRatio}));
 check('Backing pixels match the displayed viewport '+label,true,{canvas:data.canvas,stage:data.stage,dpr:data.dpr,raster:data.renderer.rasterSize});
 check('Standard quality, native 3D scale, no exploration DOF '+label,data.quality==='desktop'&&data.renderer.quality==='desktop'&&data.renderer.renderScale===1&&data.renderer.dofEnabled===false);
}
try{
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--no-first-run','--disable-background-networking']});
 await launch();await game.locator('.rpg-enemy-art:not([hidden])').first().waitFor();
 check('Two packed enemy portraits load',await game.locator('.rpg-enemy-art').evaluateAll(a=>a.length===2&&a.every(i=>i.complete&&i.naturalWidth>0)));
 check('Four exact-key host portraits load',await game.locator('.rpg-party-portrait').evaluateAll(a=>a.length===4&&a.every(i=>i.complete&&i.naturalWidth>0)));
 check('Actual map is the softened battle backdrop',await game.evaluate(()=>BookseaPlay.receipt().renderer.battleBackdrop&&getComputedStyle(document.querySelector('canvas')).filter.includes('blur')));
 await page.screenshot({path:path.join(out,'battle-player.png')});
 await game.getByRole('button',{name:'特技',exact:true}).click();await skillLayout('desktop');
 check('Browsing replaces party/command dock',await game.locator('.rpg-party-dock').isHidden());
 await game.locator('.rpg-action').first().focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowDown');check('Keyboard moves in two columns',await game.locator('.rpg-action').nth(3).evaluate(e=>e===document.activeElement));
 await page.keyboard.press('End');check('End reaches last long skill',await game.locator('.rpg-action-list').evaluate(e=>e.scrollTop>0)&&await game.locator('.rpg-skill-help').innerText().then(t=>t.includes('一项非常非常长')));
 await game.locator('[data-action="test-2"]').focus();await page.keyboard.press('Enter');check('Unavailable skill remains inspectable but cannot activate',!await game.evaluate(()=>BookseaPlay.inspect().battle.selected)&&await game.locator('.rpg-skill-unavailable').innerText().then(t=>t.includes('SP 不足')&&!t.includes('test-actor')));
 for(const key of ['Enter','Space','KeyE']){
  await game.locator('[data-action="test-0"]').focus();await page.keyboard.press(key==='KeyE'?'e':key);
  check('Desktop '+key+' selects the skill',await game.evaluate(()=>BookseaPlay.inspect().battle.selected==='test-0'));
  check('One target has a head arrow',await game.locator('.rpg-enemy.is-target .rpg-target-arrow').count()===1&&await game.locator('.rpg-enemy.is-target .rpg-target-arrow').isVisible());
  check('Chosen enemy slowly pulses',await game.locator('.rpg-enemy.is-target .rpg-enemy-art').evaluate(e=>getComputedStyle(e).animationName.includes('rpg-target-pulse')&&parseFloat(getComputedStyle(e).animationDuration)>=1));
  const first=await game.locator('.rpg-battle').getAttribute('data-target-cursor');await page.keyboard.press('ArrowRight');check('Arrow key changes target',await game.locator('.rpg-battle').getAttribute('data-target-cursor')!==first);
  await page.keyboard.press('Escape');
 }
 await game.locator('[data-action="test-0"]').focus();await game.locator('.rpg-action-list').evaluate(e=>e.scrollTop=0);await page.screenshot({path:path.join(out,'battle-skills.png')});
 const before=await resources();await game.locator('[data-action="test-0"]').click();check('Desktop mouse click activates the selected skill',!!await game.evaluate(()=>BookseaPlay.inspect().battle.selected));
 await game.locator('.rpg-enemy').nth(1).click();check('Single enemy click only changes focus',!!await game.evaluate(()=>BookseaPlay.inspect().battle.selected));await page.screenshot({path:path.join(out,'target-arrow.png')});
 await game.locator('.rpg-enemy').nth(1).dblclick();await resolveAction();
 check('Enemy double click casts exactly once',await game.evaluate(p=>BookseaPlay.inspect().battle.units.find(u=>u.id===p.id).sp===p.sp-p.cost,before));
 check('Commands stay hidden while an action resolves',await game.locator('.rpg-commands').isHidden());
 for(const key of ['Enter','Space','e']){await playerTurn();const before=await resources();await game.getByRole('button',{name:'特技',exact:true}).click();await game.locator('[data-action="test-0"]').focus();await page.keyboard.press('Enter');await page.keyboard.press('ArrowRight');await page.keyboard.press(key);await resolveAction();check('Target '+key+' commits exactly once',await game.evaluate(p=>BookseaPlay.inspect().battle.units.find(u=>u.id===p.id).sp===p.sp-p.cost,before));}
 await playerTurn();const multiBefore=await resources();await game.getByRole('button',{name:'特技',exact:true}).click();await game.locator('[data-action="test-multi"]').click();await page.keyboard.press('Shift+Space');await page.keyboard.press('ArrowRight');await page.keyboard.press('Shift+Space');check('Manual multi-target selection marks two without paying',await game.evaluate(p=>{const v=BookseaPlay.inspect();return v.battle.selectedTargets.length===2&&v.battle.units.find(u=>u.id===p.id).sp===p.sp;},multiBefore));await page.keyboard.press('Enter');await resolveAction();check('One input releases the marked multi-target skill with one payment',await game.evaluate(p=>BookseaPlay.inspect().battle.units.find(u=>u.id===p.id).sp===p.sp-5,multiBefore));
 await settle();await game.evaluate(()=>RPGTest.enemyTurn());await game.waitForFunction(()=>BookseaPlay.presentation().holding&&document.querySelector('.rpg-battle-log').textContent.includes('裂页冲击'));check('Enemy action keeps real damage log and no player commands',await game.locator('.rpg-commands').isHidden()&&await game.locator('.rpg-battle-log').innerText().then(t=>t.includes('伤害')));await page.screenshot({path:path.join(out,'battle-enemy.png')});
 await playerTurn();await game.getByRole('button',{name:'物品',exact:true}).click();check('Items are separate and display quantity',await game.locator('.rpg-action').innerText().then(t=>t.includes('恢复药')&&t.includes('持有')));const potions=await game.evaluate(()=>BookseaPlay.inspect().potions);await game.locator('.rpg-action').click();await page.keyboard.press('Enter');await resolveAction();check('One item activation spends one item',await game.evaluate(()=>BookseaPlay.inspect().potions)===potions-1);
 await settle();await game.locator('.rpg-menu-button').click();await game.getByRole('button',{name:'设置',exact:true}).click();await game.getByRole('button',{name:'全屏游玩',exact:true}).click();await game.waitForFunction(()=>document.fullscreenElement===document.querySelector('#stage')||document.querySelector('#stage').classList.contains('is-fullscreen'));await pixelFit('desktop fullscreen');await game.getByRole('button',{name:'继续远征',exact:true}).click();if(await game.evaluate(()=>!!document.fullscreenElement))await game.evaluate(()=>document.exitFullscreen());
 for(const viewport of [{width:844,height:390},{width:390,height:844},{width:1024,height:768}]){await page.setViewportSize(viewport);await playerTurn();await game.getByRole('button',{name:'特技',exact:true}).click();await skillLayout(viewport.width+'x'+viewport.height);await page.screenshot({path:path.join(out,`skills-${viewport.width}x${viewport.height}.png`)});await game.locator('.rpg-action-window').getByRole('button',{name:'返回',exact:true}).click();}
 await launch('battle',2,{width:844,height:390},true);await game.getByRole('button',{name:'特技',exact:true}).tap();await game.locator('[data-action="test-0"]').tap();check('First touch previews without firing',!await game.evaluate(()=>BookseaPlay.inspect().battle.selected));await game.getByRole('button',{name:'交互',exact:true}).tap();check('Touch interaction activates highlighted skill',!!await game.evaluate(()=>BookseaPlay.inspect().battle.selected));await game.locator('.rpg-enemy').nth(1).tap();check('First target touch is selection only',!!await game.evaluate(()=>BookseaPlay.inspect().battle.selected));await game.getByRole('button',{name:'交互',exact:true}).tap();await resolveAction();check('Touch interaction casts on focused target',true);
 await playerTurn();await game.getByRole('button',{name:'特技',exact:true}).tap();await game.locator('[data-action="test-0"]').tap();await game.locator('[data-action="test-0"]').tap();check('Second tap on same skill activates it',!!await game.evaluate(()=>BookseaPlay.inspect().battle.selected));await game.locator('.rpg-enemy').nth(1).tap();await game.locator('.rpg-enemy').nth(1).tap();await resolveAction();check('Second tap on selected enemy casts',true);
 await launch('explore',4,{width:390,height:844},true);await pixelFit('mobile portrait');const metrics=await game.evaluate(()=>BookseaPlay.receipt().renderer);check('Four-member party still renders one user-supplied walker',metrics.mapPlayerCount===1&&metrics.playerCell.join(',')==='192,304'&&metrics.playerFramesPerDirection===4,metrics.playerCell);check('Every map enemy owns a visible floating page',metrics.floatingPages.length>0&&metrics.floatingPages.every(p=>p.visible&&Math.abs(p.height-.72)<.001));await page.screenshot({path:path.join(out,'mobile-exploration.png')});
 const beforePages=metrics.floatingPages;await page.waitForTimeout(200);check('Map pages float over time',await game.evaluate(()=>BookseaPlay.receipt().renderer.floatingPages).then(p=>p.some((x,i)=>Math.abs(x.position[1]-beforePages[i].position[1])>.0001)));
 check('Joystick is not text and suppresses long-press callout',await game.locator('.rpg-joystick').evaluate(e=>e.textContent.trim()===''&&getComputedStyle(e).touchAction==='none'&&getComputedStyle(e).userSelect==='none'&&!e.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}))));
 await game.evaluate(()=>RPGTest.clearThings());const start=await game.evaluate(()=>{const v=BookseaPlay.inspect(),d=[[1,0],[-1,0],[0,1],[0,-1]].find(([x,z])=>v.region.tiles[v.z+z]?.[v.x+x]==='.');return {x:v.x,z:v.z,d};});if(!start.d)throw Error('No walkable fixture neighbor');
 const box=await game.locator('.rpg-joystick').boundingBox(),cx=box.x+box.width/2,cy=box.y+box.height/2,cdp=await page.context().newCDPSession(page);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx,y:cy,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx+start.d[0]*40,y:cy+start.d[1]*40,id:1}]});await page.waitForTimeout(280);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});const moved=await game.evaluate(()=>BookseaPlay.inspect());check('Held virtual stick moves the authoritative player',moved.x!==start.x||moved.z!==start.z);await page.waitForTimeout(230);check('Releasing joystick stops movement',await game.evaluate(p=>{const v=BookseaPlay.inspect();return v.x===p.x&&v.z===p.z;},{x:moved.x,z:moved.z}));
 await game.evaluate(()=>RPGTest.emptyGround());check('Empty-ground interaction still opens pause menu',await game.locator('.rpg-menu-shade').isVisible()&&await game.evaluate(()=>BookseaPlay.inspect().paused));
 await launch('explore',4,{width:844,height:390},true,true);await pixelFit('embedded mobile');const original=await page.locator('#embed').evaluate(e=>({width:e.style.width,height:e.style.height,border:e.style.border}));
 await game.evaluate(()=>{document.querySelector('#stage').requestFullscreen=()=>Promise.reject(new DOMException('Test native rejection','NotAllowedError'));});await game.locator('.rpg-menu-button').tap();await game.getByRole('button',{name:'设置',exact:true}).tap();await game.getByRole('button',{name:'全屏游玩',exact:true}).tap();
 for(const viewport of [{width:844,height:390},{width:390,height:844}]){
  await page.setViewportSize(viewport);await page.waitForFunction(()=>{const r=document.querySelector('#embed').getBoundingClientRect();return Math.abs(r.width-innerWidth)<2&&Math.abs(r.height-innerHeight)<2&&Math.abs(r.left)<2&&Math.abs(r.top)<2;},null,{timeout:8000});
  await pixelFit('host CSS fullscreen '+viewport.width+'x'+viewport.height);check('Rejected native fullscreen still fills host viewport '+viewport.width,await game.evaluate(()=>document.querySelector('#stage').classList.contains('is-fullscreen')&&document.documentElement.scrollWidth<=innerWidth+2&&document.documentElement.scrollHeight<=innerHeight+2));await page.screenshot({path:path.join(out,`mobile-host-fullscreen-${viewport.width}x${viewport.height}.png`)});
 }
 await game.getByRole('button',{name:'退出全屏',exact:true}).tap();const restored=await page.locator('#embed').evaluate(e=>({width:e.style.width,height:e.style.height,border:e.style.border}));check('CSS fullscreen restores host iframe styles without reloading game',JSON.stringify(restored)===JSON.stringify(original)&&await game.evaluate(()=>!!RPGTest.started),{original,restored});
 check('No uncaught browser/Godot errors',errors.length===0,errors);
 await writeFile(path.join(out,'rpg-browser.json'),JSON.stringify({passed:true,checks,errors,pckSha256:createHash('sha256').update(await readFile(path.join(web,'game.pck'))).digest('hex'),scope:'Real PCK, keyboard/mouse/touch, joystick, same-origin iframe fallback and DPR3 emulation; not a physical-device test.'},null,2)+'\n');console.log('RPG_BROWSER_PASS',checks.length);
}catch(error){try{await writeFile(path.join(out,'failure-state.json'),JSON.stringify(await game.evaluate(()=>({view:window.BookseaPlay?.inspect(),commands:document.querySelector('.rpg-commands')?.outerHTML,focus:document.activeElement?.outerHTML})),null,2)+'\n');}catch{}try{await page?.screenshot({path:path.join(out,'rpg-failure.png')});}catch{}await writeFile(path.join(out,'rpg-browser.json'),JSON.stringify({passed:false,error:String(error),checks,errors,logs:logs.slice(-40)},null,2)+'\n');console.error(error);process.exitCode=1;}
finally{await browser?.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
