// Production runtime + real Godot + real Web Audio; isolated synthetic state only.
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {build} from 'esbuild';
const impl=fileURLToPath(new URL('../',import.meta.url)),project=path.dirname(impl.replace(/[\\/]$/,''));
const out=path.resolve(impl,process.argv.find(a=>a.startsWith('--output='))?.slice(9)??'verification/audio-0243/browser');
const web=path.join(project,'16-Godot可玩区域/web'),audio=path.join(web,'audio');
const {chromium}=createRequire(path.join(project,'10-联调环境/package.json'))('playwright');
const bundle=await build({entryPoints:[path.join(impl,'tests/audio-feedback-browser-fixture.ts')],bundle:true,write:false,format:'iife',globalName:'FeedbackFixture',target:'es2022'});
await mkdir(out,{recursive:true});const checks=[],errors=[],requests=[];let browser,page;
const check=(name,ok,detail)=>{checks.push({name,passed:!!ok,detail});console.log(name,!!ok);if(!ok)throw Error(name);};
const server=createServer(async(req,res)=>{try{
 const p=new URL(req.url,'http://fixture').pathname;
 if(p==='/'){res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});res.end('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style><main id="app"></main><script src="/game.js"></script><script src="/fixture.js"></script><script>FeedbackFixture.boot().catch(e=>{console.error(e);window.fixtureError=String(e)})</script>');return;}
 if(p==='/fixture.js'){res.writeHead(200,{'Content-Type':'application/javascript'});res.end(bundle.outputFiles[0].text);return;}
 if(p==='/favicon.ico'){res.writeHead(204);res.end();return;}
 const audioPath=p.startsWith('/audio/'),base=audioPath?audio:web,name=audioPath?p.slice(7):p.slice(1),file=path.resolve(base,name);
 if(!file.startsWith(base+path.sep)||name.split('/').includes('..')||!audioPath&&!/^game\.(js|wasm|pck|audio\.worklet\.js|audio\.position\.worklet\.js)$/.test(name))throw Error('Not a fixture resource');
 const info=await stat(file),ext=path.extname(file),mime={'.js':'application/javascript','.json':'application/json','.wasm':'application/wasm','.wav':'audio/wav','.ogg':'audio/ogg','.mp3':'audio/mpeg'}[ext]??'application/octet-stream';
 res.writeHead(200,{'Content-Length':info.size,'Content-Type':mime,'Cache-Control':'no-store'});createReadStream(file).pipe(res);
 }catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const idle=()=>page.waitForFunction(()=>!FeedbackTest.runtime.presentation().holding);
const recent=()=>page.evaluate(()=>BookseaAudio.inspect().recentCues);
const freshCues=since=>page.evaluate(t=>BookseaAudio.inspect().recentCues.filter(c=>c.at>=t),since);
const timestamp=()=>page.evaluate(()=>performance.now());
async function ready() {
 await page.goto(base+'/');
 await page.waitForFunction(()=>{if(window.fixtureError)throw Error(fixtureError);return window.FeedbackTest?.started&&BookseaPlay.receipt().ready&&window.BookseaAudio?.inspect().manifestLoaded;},null,{timeout:90000});
 // A genuine keyboard input unlocks audio even when UI handles E/Enter itself.
 await page.evaluate(()=>{FeedbackTest.music(0);BookseaAudio.setPreferences({music:0,effects:1,master:.8});});
 await page.keyboard.press('k');await page.waitForFunction(()=>BookseaAudio.inspect().unlocked);
 await page.waitForFunction(()=>BookseaAudio.inspect().cachedEffects>=25&&BookseaAudio.inspect().pendingEffects===0,null,{timeout:15000});
}
async function prepareMenu() {await idle();await page.evaluate(()=>FeedbackTest.menu());await page.waitForFunction(()=>BookseaPlay.inspect().mode==='battle'&&BookseaPlay.inspect().battle.ready);await page.waitForFunction(()=>BookseaAudio.inspect().pendingEffects===0);}
async function action(kind,side='enemy',shield=false) {
 await idle();const since=await timestamp();
 await page.evaluate(({kind,side,shield})=>side==='enemy'?FeedbackTest.enemy(kind,shield):FeedbackTest.ally(kind),{kind,side,shield});
 await page.waitForFunction(()=>FeedbackTest.runtime.presentation().holding);
 await page.waitForTimeout(700);return {since,cues:await freshCues(since),plan:await page.evaluate(()=>BookseaAudio.inspect().lastBattlePlan)};
}
try {
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--no-first-run','--disable-background-networking']});
 page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(/SCRIPT ERROR|Parse Error|Assertion failed/.test(m.text()))errors.push(m.text());});
 page.on('request',r=>requests.push(r.url()));
 await page.addInitScript(()=>{
  // Capture only this game's final analyser output, not Godot's silent driver or any microphone.
  const connect=AudioNode.prototype.connect;
  AudioNode.prototype.connect=function(destination,...rest){const result=connect.call(this,destination,...rest);if(this instanceof AnalyserNode&&destination===this.context.destination&&!window.__soundTap){const tap=this.context.createMediaStreamDestination();connect.call(this,tap);window.__soundTap=tap;}return result;};
 });
 await ready();check('Keyboard-first audio unlock works before document key interception',await page.evaluate(()=>BookseaAudio.inspect().contextState==='running'));
 await page.evaluate(()=>{
  const recorder=new MediaRecorder(window.__soundTap.stream,{mimeType:'audio/webm;codecs=opus',audioBitsPerSecond:128000});const chunks=[];
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};window.__recording={recorder,chunks};recorder.start();
  window.__typingTrace=[];new MutationObserver(()=>__typingTrace.push({text:document.querySelector('.rpg-supplier-question').textContent,at:performance.now()})).observe(document.querySelector('.rpg-supplier-question'),{subtree:true,childList:true,characterData:true});
 });
 await page.keyboard.press('e');await page.waitForFunction(()=>document.querySelector('.rpg-supplier:not([hidden])')?.dataset.typing==='true');
 check('Supplier starts in a real partial-text state',await page.evaluate(()=>document.querySelector('.rpg-supplier-question').textContent!=='要选哪个呢？'));
 await page.waitForFunction(()=>BookseaAudio.inspect().loopVoices===1);check('Paper writing is a real Web Audio loop, not one beep per character',await page.evaluate(()=>BookseaAudio.inspect().recentCues.some(c=>c.cue==='dialogue.write'&&c.loop)));
 await page.screenshot({path:path.join(out,'supplier-typing.png')});
 await page.waitForFunction(()=>document.querySelector('.rpg-supplier').dataset.typing==='false'&&BookseaAudio.inspect().loopVoices===0);
 const trace=await page.evaluate(()=>__typingTrace);check('Chinese characters appear progressively without a 20Hz restart',trace.some(x=>x.text==='要')&&trace.some(x=>x.text==='要选哪')&&trace.at(-1)?.text==='要选哪个呢？',trace);
 check('Writing stops automatically when the sentence is complete',await page.evaluate(()=>!BookseaAudio.inspect().writing));
 await page.keyboard.press('Escape');await page.keyboard.press('e');await page.waitForFunction(()=>document.querySelector('.rpg-supplier').dataset.typing==='true');await page.keyboard.press('Enter');
 check('First Enter reveals the sentence without choosing an outcome',await page.evaluate(()=>BookseaPlay.inspect().mode==='supplier'&&document.querySelector('.rpg-supplier-question').textContent==='要选哪个呢？'&&FeedbackTest.state.region.things.some(t=>t.kind==='supplier'&&!t.used)));
 await page.keyboard.press('Escape');await page.keyboard.press('e');await page.waitForFunction(()=>document.querySelector('.rpg-supplier').dataset.typing==='true');await page.getByRole('button',{name:'暂不选择，返回地图'}).click();
 await page.waitForFunction(()=>BookseaAudio.inspect().loopVoices===0);check('Closing mid-sentence cancels the timer, loop and any late decode',await page.evaluate(()=>BookseaPlay.inspect().mode==='explore'&&!BookseaAudio.inspect().writing));
 await page.keyboard.press('e');await page.waitForFunction(()=>document.querySelector('.rpg-supplier').dataset.typing==='true');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForFunction(()=>BookseaAudio.inspect().background&&BookseaAudio.inspect().effectVoices===0);check('Backgrounding silences typing and suspends audio',await page.evaluate(()=>BookseaAudio.inspect().contextState==='suspended'));
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await page.keyboard.press('Escape');await page.waitForTimeout(650);await page.keyboard.press('Escape');
 await prepareMenu();await page.getByRole('button',{name:'特技',exact:true}).click();
 const start=await timestamp();await page.locator('.rpg-action').first().focus();await page.keyboard.press('ArrowRight');await page.waitForTimeout(100);
 let cues=await freshCues(start);check('Keyboard selection cursor produces movement audio without submitting',cues.some(c=>c.cue==='ui.move')&&!cues.some(c=>c.cue==='ui.confirm')&&await page.evaluate(()=>!BookseaPlay.inspect().battle.selected&&FeedbackTest.state.selected===null),cues);
 const selected=await timestamp();await page.keyboard.press('Enter');await page.waitForTimeout(150);cues=await freshCues(selected);
 check('Skill confirmation uses a different sample family',cues.some(c=>c.cue==='ui.confirm')&&await page.evaluate(()=>!!BookseaPlay.inspect().battle.selected),cues);
 await page.keyboard.press('Escape');await page.keyboard.press('Escape');
 const fire=await action('fire');check('Enemy tell, fire release, and fire hit all actually start',fire.cues.some(c=>c.cue.startsWith('enemy.'))&&fire.cues.some(c=>c.cue==='release.fire')&&fire.cues.some(c=>c.cue==='impact.fire'),fire);
 const release=fire.cues.find(c=>c.cue==='release.fire'),impact=fire.cues.find(c=>c.cue==='impact.fire');check('Release precedes impact with audible temporal separation',impact.at-release.at>=70,{release:release.at,impact:impact.at});
 check('Enemy action is visibly identified, not only a changing HP number',await page.locator('.rpg-battle-log').textContent().then(s=>s.includes('敌方')&&s.includes('火焰术')));
 await page.screenshot({path:path.join(out,'enemy-fire-impact.png')});
 const ice=await action('ice');check('Ice uses different actual hit samples from fire',ice.cues.some(c=>c.cue==='impact.ice')&&ice.cues.filter(c=>c.cue==='impact.ice').every(c=>c.sample!==impact.sample),ice);
 const heavy=await action('heavy','ally');check('Physical heavy/critical has its own strike and accent',heavy.cues.some(c=>c.cue==='impact.heavy')&&heavy.cues.some(c=>c.cue==='critical'),heavy);
 const miss=await action('miss');check('Actual miss produces a whiff with no false flesh hit',miss.cues.some(c=>c.cue==='miss')&&!miss.cues.some(c=>c.cue.startsWith('impact.')||c.cue.startsWith('hit.')),miss);
 const guard=await action('slash','enemy',true);check('Fully absorbed attack produces block clang, not HP impact',guard.cues.some(c=>c.cue==='guard.block')&&!guard.cues.some(c=>c.cue.startsWith('impact.')),guard);
 const heal=await action('mend','ally');check('Recovery has a distinct recovery sound',heal.cues.some(c=>c.cue==='heal')&&!heal.cues.some(c=>c.cue.startsWith('impact.')),heal);
 await idle();const cancelAt=await timestamp();await page.evaluate(()=>FeedbackTest.enemy('fire'));await page.waitForFunction(()=>FeedbackTest.runtime.presentation().holding);await page.keyboard.press('Escape');await page.waitForTimeout(450);
 cues=await freshCues(cancelAt);check('Pausing cancels later battle hits instead of replaying them behind the menu',!cues.some(c=>c.cue==='impact.fire')&&await page.evaluate(()=>BookseaAudio.inspect().feedbackSequence.pending===0),cues);
 await page.keyboard.press('Escape');await idle();
 await page.evaluate(()=>BookseaAudio.setPreferences({muted:true}));const silentStart=await page.evaluate(()=>BookseaAudio.inspect().effectsStarted);await page.evaluate(()=>FeedbackTest.enemy('ice'));await page.waitForTimeout(700);
 check('Mute creates no new audible effect voices',await page.evaluate(n=>BookseaAudio.inspect().effectsStarted===n&&BookseaAudio.inspect().effectVoices===0,silentStart));
 await page.evaluate(()=>BookseaAudio.setPreferences({muted:false}));await idle();
 check('Audio polyphony/cache remain bounded',await page.evaluate(()=>BookseaAudio.inspect().effectVoices<=12&&BookseaAudio.inspect().cachedEffectsMiB<=48));
 const recording=await page.evaluate(async()=>{const r=window.__recording;await new Promise(resolve=>{r.recorder.onstop=resolve;r.recorder.stop();});const data=new Uint8Array(await new Blob(r.chunks).arrayBuffer());let s='';for(let i=0;i<data.length;i+=16384)s+=String.fromCharCode(...data.subarray(i,i+16384));return btoa(s);});await writeFile(path.join(out,'in-game-effects.webm'),Buffer.from(recording,'base64'));
 await page.evaluate(()=>{window.__oldAudio=BookseaAudio;FeedbackTest.runtime.dispose();});await page.waitForTimeout(70);check('Disposal stops loops, delayed cues and all effect nodes',await page.evaluate(()=>__oldAudio.inspect().disposed&&__oldAudio.inspect().effectVoices===0&&__oldAudio.inspect().feedbackSequence.pending===0));
 // Touch uses a separate fresh browser context and real pointer/tap events.
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
 await ready();await page.locator('.rpg-interact').tap();await page.waitForFunction(()=>document.querySelector('.rpg-supplier').dataset.typing==='true');await page.locator('.rpg-supplier-dialogue').tap();
 check('Touch can reveal the line without selecting an outcome',await page.evaluate(()=>BookseaPlay.inspect().mode==='supplier'&&document.querySelector('.rpg-supplier').dataset.typing==='false'));
 await page.screenshot({path:path.join(out,'supplier-mobile.png')});await page.getByRole('button',{name:'暂不选择，返回地图'}).tap();await prepareMenu();await page.getByRole('button',{name:'特技',exact:true}).tap();
 const first=page.locator('.rpg-action').first();await first.tap();check('First touch previews a skill instead of committing it',await page.evaluate(()=>!BookseaPlay.inspect().battle.selected&&FeedbackTest.state.selected===null));await first.tap();check('Second touch confirms the skill',await page.evaluate(()=>!!BookseaPlay.inspect().battle.selected));
 const layout=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,rect:document.getElementById('stage').getBoundingClientRect().toJSON()}));check('Portrait phone remains usable without horizontal overflow',!layout.overflow,layout);
 await page.setViewportSize({width:844,height:390});await page.screenshot({path:path.join(out,'battle-mobile-landscape.png')});check('Landscape phone remains inside the viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await context.close();check('No uncaught browser or Godot errors',errors.length===0,errors);
 const summary={passed:true,checks,errors,requests:requests.filter(u=>u.includes('/audio/')),pckSHA256:createHash('sha256').update(await readFile(path.join(web,'game.pck'))).digest('hex'),audioManifestSHA256:createHash('sha256').update(await readFile(path.join(audio,'audio-manifest.json'))).digest('hex'),scope:'Actual packed Godot, production UI/runtime/mixer and real decoded sound nodes. Synthetic party only. Keyboard/mouse/touch and phone viewport emulation; not physical-device acoustic or aesthetic acceptance. Recording is the game SFX bus with BGM muted, never microphone audio.'};
 await writeFile(path.join(out,'audio-feedback-browser.json'),JSON.stringify(summary,null,2)+'\n');console.log('AUDIO_FEEDBACK_BROWSER_PASS',checks.length);
}catch(error){try{await page?.screenshot({path:path.join(out,'failure.png')});}catch{}await writeFile(path.join(out,'audio-feedback-browser.json'),JSON.stringify({passed:false,error:String(error),stack:error.stack,checks,errors},null,2)+'\n');console.error(error);process.exitCode=1;}
finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
