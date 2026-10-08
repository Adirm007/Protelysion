// Real packed Godot + production runtime + real Web Audio. Isolated synthetic state only.
// Verifies that sounds follow actual resolved actions and that the paper-writing loop is cancellable.
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {mkdir, readFile, writeFile, stat} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {build} from 'esbuild';
const impl=fileURLToPath(new URL('../',import.meta.url)),project=path.dirname(impl.replace(/[\\/]$/,''));
const out=path.resolve(impl,process.argv.find(a=>a.startsWith('--output='))?.slice(9)??'verification/audio-0243/browser'),web=path.join(project,'16-Godot可玩区域/web');
const {chromium}=createRequire(path.join(project,'10-联调环境/package.json'))('playwright');
const bundle=await build({entryPoints:[path.join(impl,'tests/audio-feedback-browser-fixture.ts')],bundle:true,write:false,format:'iife',globalName:'FeedbackFixture',target:'es2022'});
await mkdir(out,{recursive:true});let browser,page;const checks=[],errors=[];const check=(name,ok,detail)=>{checks.push({name,passed:!!ok,detail});console.log(name,!!ok);if(!ok)throw Error(name);};
const server=createServer(async(req,res)=>{try{
 const p=decodeURIComponent(new URL(req.url,'http://fixture').pathname);
 if(p==='/'){res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});res.end('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style><main id="app"></main><script src="/game.js"></script><script src="/fixture.js"></script><script>FeedbackFixture.boot().catch(e=>{console.error(e);window.fixtureError=String(e)})</script>');return;}
 if(p==='/fixture.js'){res.writeHead(200,{'Content-Type':'application/javascript'});res.end(bundle.outputFiles[0].text);return;}
 if(p==='/favicon.ico'){res.writeHead(204);res.end();return;}
 const name=p.slice(1);if(name.split('/').includes('..'))throw Error('not a runtime');
 const runtime=/^game\.(js|wasm|pck|audio\.worklet\.js|audio\.position\.worklet\.js)$/.test(name),audio=/^audio\/(audio-manifest\.json|CREDITS\.txt|(music|sfx)\/[A-Za-z0-9._-]+)$/.test(name);
 if(!runtime&&!audio)throw Error('not a runtime');
 const file=path.join(web,name);if(!file.startsWith(web))throw Error('escape');
 const info=await stat(file),ext=path.extname(file);
 res.writeHead(200,{'Content-Length':info.size,'Content-Type':ext==='.js'?'application/javascript':ext==='.wasm'?'application/wasm':ext==='.json'?'application/json':ext==='.txt'?'text/plain;charset=utf-8':'application/octet-stream','Cache-Control':'no-store'});
 createReadStream(file).pipe(res);
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const audio=()=>page.evaluate(()=>BookseaAudio.inspect());
const cues=async(since)=>((await audio()).recentCues??[]).slice(since);
const opened=()=>page.waitForFunction(()=>document.querySelector('.rpg-supplier:not([hidden])')?.dataset.typing==='false'&&document.querySelector('.rpg-supplier-portrait')?.naturalWidth>0);
try{
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--no-first-run','--disable-background-networking','--autoplay-policy=no-user-gesture-required']});
 page=await browser.newPage({viewport:{width:1280,height:720}});
 page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(/SCRIPT ERROR|Parse Error|Assertion failed|音效加载失败|配乐加载失败/.test(m.text()))errors.push(m.text());});
 await page.goto(base+'/');
 await page.waitForFunction(()=>{if(window.fixtureError)throw Error(fixtureError);return window.FeedbackTest?.started&&window.BookseaPlay?.receipt().ready;},null,{timeout:90000});
 await page.mouse.click(210,520);
 await page.waitForFunction(()=>window.BookseaAudio.inspect().manifestLoaded===true&&window.BookseaAudio.inspect().contextState==='running',null,{timeout:40000});
 await page.waitForFunction(()=>window.BookseaAudio.inspect().cachedEffects>=8,null,{timeout:40000});
 await page.keyboard.press('e');
 await page.waitForFunction(()=>!!document.querySelector('.rpg-supplier:not([hidden])'));
 check('supplier line starts before the full question is shown',await page.evaluate(()=>document.querySelector('.rpg-supplier')?.dataset.typing==='true'&&document.querySelector('.rpg-supplier-question').innerText.length<7));
 const started=await audio();
 check('paper writing plays as a real looped sample while typing',started.writing===true&&started.loopVoices>=1&&(started.recentCues??[]).some(c=>c.cue==='dialogue.write'&&c.loop&&c.sample==='a2-paper-writing'&&c.group==='dialogue'),{writing:started.writing,loopVoices:started.loopVoices,recent:(started.recentCues??[]).slice(-3)});
 await opened();
 const finished=await audio();
 check('reaching the end reveals the exact question and stops the pen sound',await page.locator('.rpg-supplier-question').innerText()==='要选哪个呢？'&&finished.writing===false&&finished.loopVoices===0);
 const cursorBefore=await page.evaluate(()=>window.BookseaAudio.inspect().recentCues.length);
 await page.keyboard.press('ArrowDown');await page.waitForTimeout(60);
 check('arrowing between the two options plays move feedback while staying undecided',(await cues(cursorBefore)).some(c=>c.cue==='ui.move')&&await page.evaluate(()=>window.FeedbackTest.state.mode==='supplier'));
 await page.keyboard.press('Escape');await page.keyboard.press('e');
 await page.keyboard.press('Enter');
 check('first confirm press completes the line instead of silently choosing an outcome',await page.evaluate(()=>document.querySelector('.rpg-supplier-question').innerText==='要选哪个呢？'&&window.FeedbackTest.state.mode==='supplier'));
 const choiceBefore=await page.evaluate(()=>window.BookseaAudio.inspect().recentCues.length);
 await page.locator('.rpg-supplier-choice[data-choice="event"]').click();
 await page.waitForFunction(()=>window.FeedbackTest.state.mode==='explore');
 check('choosing a supplier outcome gives a distinct confirm sound and no lingering writing loop',(await cues(choiceBefore)).some(c=>c.cue==='ui.confirm')&&(await audio()).writing===false);
 // Ally turn: browse move vs confirm, then one real resolved action with separated beats.
 const beforeMenu=await page.evaluate(()=>({plan:null,count:window.BookseaAudio.inspect().recentCues.length}));
 await page.evaluate(()=>window.FeedbackTest.menu());
 await page.waitForFunction(()=>window.BookseaAudio.manifestLoaded!==false&&window.BookseaAudio.inspect().contextState==='running');
 await page.keyboard.press('ArrowDown');await page.waitForTimeout(60);
 const afterMove=await cues(beforeMenu.count);
 check('moving the skill cursor plays move feedback, not the confirmation sound',afterMove.some(c=>c.cue==='ui.move')&&!afterMove.some(c=>c.cue==='ui.confirm'),afterMove.map(c=>c.cue));
 const beforeConfirm=await page.evaluate(()=>window.BookseaAudio.inspect().recentCues.length);
 await page.keyboard.press('Enter');
 const afterConfirm=await cues(beforeConfirm);
 check('confirming the highlighted skill uses its own commit sound',afterConfirm.some(c=>c.cue==='ui.confirm'),afterConfirm.map(c=>c.cue));
 await page.evaluate(()=>window.FeedbackTest.ally('fire'));
 await page.waitForFunction(()=>window.BookseaAudio.inspect().lastBattlePlan?.side==='ally');
 const allyPlan=await page.evaluate(()=>window.BookseaAudio.inspect().lastBattlePlan);
 const release=allyPlan.events.find(e=>e.cue.startsWith('release.')),impact=allyPlan.events.find(e=>e.cue.startsWith('impact.'));
 check('ally action is heard as windup/release then impact, not one flat hit',!!release&&!!impact&&impact.at>release.at&&allyPlan.events.some(e=>e.cue.startsWith('hit.'))===false,allyPlan.events);
 check('impact timing is presentation-synced rather than instant',allyPlan.impactAt>=200&&impact.at-allyPlan.events[0].at>=200);
 const enemyStart=await page.evaluate(()=>window.BookseaAudio.inspect().recentCues.length);
 await page.evaluate(()=>window.FeedbackTest.enemy('fire'));
 await page.waitForFunction(()=>window.BookseaAudio.inspect().lastBattlePlan?.side==='enemy');
 const enemyPlan=await page.evaluate(()=>window.BookseaAudio.inspect().lastBattlePlan);
 check('enemy turn announces itself before the strike',enemyPlan.events[0].cue==='enemy.intent'&&enemyPlan.events.some(e=>e.cue==='release.fire')&&enemyPlan.events.some(e=>e.cue==='impact.fire')&&enemyPlan.events.some(e=>e.cue==='party.hurt'),enemyPlan.events);
 check('damage to the party is audibly acknowledged as a reaction, not hidden',enemyPlan.events.some(e=>['reaction.beast','party.hurt'].includes(e.cue)));
 await page.waitForTimeout(900);
 const played=await cues(enemyStart);
 check('the scheduled enemy beats actually reached the mixer in order',['enemy.intent','release.fire','impact.fire'].every((c,i)=>played.some(x=>x.cue===c)),played.map(c=>c.cue).slice(0,8));
 // Elemental and physical styles are acoustically different, verified in the actual mixer plan.
 await page.evaluate(()=>window.FeedbackTest.ally('ice'));
 await page.waitForFunction(()=>window.BookseaAudio.inspect().lastBattlePlan?.events.some(e=>e.cue==='impact.ice'));
 await page.evaluate(()=>window.FeedbackTest.ally('heavy'));
 await page.waitForFunction(()=>window.BookseaAudio.inspect().lastBattlePlan?.events.some(e=>e.cue==='impact.heavy'));
 const styles=await page.evaluate(()=>window.BookseaAudio.inspect().lastBattlePlan);
 check('a heavy blow does not reuse the ice-cast collision sound',styles.events.some(e=>e.cue==='impact.heavy')&&!styles.events.some(e=>e.cue==='impact.ice'));
 await page.evaluate(()=>window.FeedbackTest.enemy('miss'));
 await page.waitForFunction(()=>window.BookseaAudio.inspect().lastBattlePlan?.events.some(e=>e.cue==='miss'));
 const missPlan=await page.evaluate(()=>window.BookseaAudio.inspect().lastBattlePlan);
 check('a whiff is a miss sound with no fake flesh hit or successful impact',missPlan.events.some(e=>e.cue==='miss')&&!missPlan.events.some(e=>e.cue.startsWith('impact.')||e.cue.startsWith('hit.')),missPlan.events);
 await page.evaluate(()=>window.FeedbackTest.enemy('slash',true));
 await page.waitForFunction(()=>window.BookseaAudio.inspect().lastBattlePlan?.events.some(e=>e.cue==='guard.block'));
 const blockPlan=await page.evaluate(()=>window.BookseaAudio.inspect().lastBattlePlan);
 check('fully blocked damage clangs instead of pretending the target was hurt',blockPlan.events.some(e=>e.cue==='guard.block')&&!blockPlan.events.some(e=>e.cue.startsWith('impact.'))&&!blockPlan.events.some(e=>e.cue==='party.hurt'),blockPlan.events);
 const frozen=await page.evaluate(()=>{const count=window.BookseaAudio.inspect().recentCues.length;window.FeedbackTest.freeze();return count;});
 await page.waitForTimeout(700);
 check('pausing does not leave scheduled hits waiting to fire',await page.evaluate(c=>window.BookseaAudio.inspect().recentCues.length===c,frozen)&&(await page.evaluate(()=>window.BookseaAudio.inspect().feedbackSequence.pending))===0);
 // Mobile emulation: touch still produces cursor/confirm feedback and the layout stays usable.
 const mobile=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
 mobile.on('pageerror',e=>errors.push('mobile: '+String(e)));
 await mobile.goto(base+'/');
 await mobile.waitForFunction(()=>window.FeedbackTest?.started&&window.BookseaPlay?.receipt().ready,null,{timeout:90000});
 await mobile.evaluate(()=>window.FeedbackTest.menu());
 await mobile.waitForFunction(()=>window.BookseaAudio.inspect().contextState==='running');
 await mobile.locator('.rpg-command').first().tap();await mobile.waitForTimeout(250);
 const mobileCues=await mobile.evaluate(()=>window.BookseaAudio.inspect().recentCues.map(c=>c.cue));
 check('touch commands give the same commit feedback instead of silence',mobileCues.includes('ui.confirm'),mobileCues.slice(-4));
 check('no horizontal overflow with the new feedback for a phone viewport',await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await mobile.screenshot({path:path.join(out,'mobile-battle-audio.png')});await mobile.close();
 // Existing music is still the same single track across an effect-heavy action.
 await page.evaluate(()=>{window.FeedbackTest.resetNpc();window.FeedbackTest.music(.35);});
 await page.waitForFunction(()=>window.BookseaAudio.inspect().playing??false,null,{timeout:30000}).catch(()=>{});
 const track=await page.evaluate(()=>window.BookseaAudio.inspect().playing);
 await page.evaluate(()=>window.FeedbackTest.enemy('fire'));
 await page.waitForTimeout(1200);
 check('effect work does not restart or replace the current score',await page.evaluate(t=>(window.BookseaAudio.inspect().playing??null)===t,track)&&!!track,{track});
 const catalog=await page.evaluate(()=>window.BookseaAudio.inspect().catalog);
 check('runtime catalog keeps all 123 BGM tracks and now ships the expanded effect set',catalog.music===123&&catalog.sfx>=171&&catalog.cues>=125,catalog);
 check('no browser or Godot audio errors',errors.length===0,errors);
 const evidence={passed:true,checks,errors,catalog,pckSHA256:createHash('sha256').update(await readFile(path.join(web,'game.pck'))).digest('hex'),scope:'Real packed Godot, production UI/Web Audio, synthetic isolated state. Beat timing, cancellation and mixer plans are verified programmatically; speaker loudness and musical taste still need human listening, and mobile results are viewport emulation, not a physical-phone test.'};
 await writeFile(path.join(out,'browser-audio.json'),JSON.stringify(evidence,null,2)+'\n');console.log('COMBAT_AUDIO_BROWSER_PASS',checks.length);
}catch(e){await writeFile(path.join(out,'browser-audio.json'),JSON.stringify({passed:false,error:String(e),checks,errors},null,2)+'\n');try{await page?.screenshot({path:path.join(out,'browser-audio-failure.png')});}catch{}console.error(e);process.exitCode=1;}
finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
