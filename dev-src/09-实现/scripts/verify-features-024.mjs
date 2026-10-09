// Actual packed Godot textures -> production runtime -> browser image decode, all portraits.
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {mkdir,readFile,writeFile,stat} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {build} from 'esbuild';
const impl=fileURLToPath(new URL('../',import.meta.url)),project=path.dirname(impl.replace(/[\\/]$/,'')),out=path.resolve(impl,process.argv.find(a=>a.startsWith('--output='))?.slice(9)??'verification/changes-024'),web=path.join(project,'16-Godot可玩区域/web'),site=path.join(project,'22-发布/booksea-github/site');
const {chromium}=createRequire(path.join(project,'10-联调环境/package.json'))('playwright');
const manifest=JSON.parse(await readFile(path.join(site,'release-manifest.json'),'utf8'));
const bundle=await build({entryPoints:[path.join(impl,'tests/features-browser-fixture.ts')],bundle:true,write:false,format:'iife',globalName:'FeatureFixture',target:'es2022'});
await mkdir(out,{recursive:true});let browser,page;const checks=[],errors=[],rows=[];
const check=(name,ok,detail)=>{checks.push({name,passed:!!ok,detail});console.log(name,!!ok);if(!ok)throw Error(name);};
const server=createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://fixture'),p=u.pathname;
 if(p==='/home'){
  res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><main id="app"></main><script src="/site/distribution.js"></script><script>fetch("/site/release-manifest.json").then(r=>r.json()).then(manifest=>BookseaDistribution.boot(document.getElementById("app"),{base:new URL("/site/",location.href).href,manifest,mode:"standalone"})).catch(e=>window.fixtureError=String(e))</script>');return;
 }
 if(p==='/'){res.writeHead(200,{'Content-Type':'text/html;charset=utf-8'});res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}</style><main id="app"></main><script src="/game.js"></script><script src="/fixture.js"></script><script>FeatureFixture.boot().catch(e=>{console.error(e);window.fixtureError=String(e)})</script>');return;}
 if(p==='/fixture.js'){res.writeHead(200,{'Content-Type':'application/javascript'});res.end(bundle.outputFiles[0].text);return;}
 if(p==='/favicon.ico'){res.writeHead(204);res.end();return;}
 let file;
 if(p.startsWith('/site/')){const rel=p.slice(6);if(rel!=='release-manifest.json'&&!manifest.files[rel])throw Error('unlisted');file=path.join(site,rel);}
 else {const name=p.slice(1);if(name!==path.basename(name)||!/^game\.(js|wasm|pck|audio\.worklet\.js|audio\.position\.worklet\.js)$/.test(name))throw Error('not a runtime');file=path.join(web,name);}
 const info=await stat(file),ext=path.extname(file);res.writeHead(200,{'Content-Length':info.size,'Content-Type':ext==='.js'?'application/javascript':ext==='.json'?'application/json':ext==='.wasm'?'application/wasm':'application/octet-stream','Cache-Control':'no-store'});createReadStream(file).pipe(res);
 }catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
try{
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--no-first-run','--disable-background-networking']});
 page=await browser.newPage({viewport:{width:1440,height:960}});page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(/SCRIPT ERROR|Parse Error|Assertion failed/.test(m.text()))errors.push(m.text());});
 await page.goto(base+'/home');await page.locator('.bs-intro-title').waitFor();
 const copy=await page.locator('.bs-hero').innerText();check('Three requested homepage texts, addressing the reader as 你',copy.includes('普罗泰利西翁')&&copy.includes('将零散的书页钉在一起，看上去乱七八糟的无限迷宫。')&&copy.includes('向你和命定之人开放的训练场')&&!copy.includes('<user>')&&copy.includes('予你的乐园')&&!/万千书页|故事之外|与你的下一段故事/.test(copy));
 check('User placeholder is escaped, not an HTML element',await page.locator('.bs-intro-title user').count()===0);
 for(const viewport of [{width:1440,height:960},{width:390,height:844}]){
  await page.setViewportSize(viewport);const fit=await page.evaluate(()=>{const h=document.querySelector('.bs-hero').getBoundingClientRect(),c=document.querySelector('.bs-hero-copy').getBoundingClientRect(),d=document.querySelector('.bs-resource-card').getBoundingClientRect();return {inside:c.bottom<=h.bottom+1,notOverlapping:c.bottom<d.top,width:document.documentElement.scrollWidth<=innerWidth+1,copyBottom:c.bottom,heroBottom:h.bottom,downloadTop:d.top};});check('Homepage text fits '+viewport.width,fit.inside&&fit.notOverlapping&&fit.width,fit);await page.screenshot({path:path.join(out,'home-'+viewport.width+'.png')});
 }
 await page.setViewportSize({width:1440,height:960});await page.goto(base+'/');
 await page.waitForFunction(()=>{if(window.fixtureError)throw Error(fixtureError);return window.FeatureTest?.started&&window.BookseaPlay?.receipt().ready;},null,{timeout:90000});
 const props=await page.evaluate(()=>FeatureTest.state.region.things.filter(t=>['chest','mimic','camp','event','stairs'].includes(t.kind)).map(t=>({kind:t.kind,name:t.name})));
 check('Actual scene includes chest, disguised mimic, bench, event and next floor',props.length===5,props);await page.screenshot({path:path.join(out,'new-interaction-points.png')});
 const roster=await page.evaluate(()=>FeatureTest.roster);
 for(let i=0;i<roster.length;i+=12){const group=roster.slice(i,i+12);await page.evaluate(ids=>FeatureTest.show(ids),group.map(m=>m.id));
  let decoded=true;try{await page.waitForFunction(count=>{const a=[...document.querySelectorAll('.rpg-enemy-art')];return a.length===count&&a.every(i=>!i.hidden&&i.complete&&i.naturalWidth>0);},group.length,{timeout:10000});}catch{decoded=false;}
  const images=await page.locator('.rpg-enemy-art').evaluateAll(a=>a.map(i=>({decoded:!i.hidden&&i.complete&&i.naturalWidth>0,width:i.naturalWidth,height:i.naturalHeight,srcLength:i.src.length})));
  rows.push(...group.map((m,n)=>({...m,...images[n],decoded:!!images[n]?.decoded})));if(!decoded)console.log('FAILED_BATCH',group.map(m=>m.id).join(','));
 }
 check('All 433 original and mimic portraits decode in real Godot browser',rows.length===433&&rows.every(r=>r.decoded),{total:rows.length,failed:rows.filter(r=>!r.decoded)});
 await page.evaluate(()=>FeatureTest.show(['COMMON_MIMIC']));await page.waitForFunction(()=>document.querySelector('.rpg-enemy-art')?.naturalWidth>0);await page.screenshot({path:path.join(out,'mimic-battle.png')});
 await page.evaluate(()=>FeatureTest.summon());await page.waitForFunction(()=>[...document.querySelectorAll('.rpg-enemy-art')].length===2&&[...document.querySelectorAll('.rpg-enemy-art')].every(i=>i.complete&&i.naturalWidth>0));
 check('Hostile summoned enemy inherits actual decoded owner art',await page.locator('.rpg-enemy-art').evaluateAll(a=>a[0].src===a[1].src));
 await page.evaluate(()=>FeatureTest.event());const description=await page.locator('.rpg-menu-body').innerText().catch(()=>page.locator('.rpg-menu-panel').innerText());
 check('Event explains the three page editions in player UI',description.includes('行动速度+8%')&&description.includes('最大生命+12%')&&description.includes('法力与体力消耗各-8%'));await page.screenshot({path:path.join(out,'event-page-explanations.png')});
 await page.evaluate(()=>FeatureTest.choices());const choices=await page.locator('.rpg-event-description').allTextContents();check('Event UI shows costs, outcomes and weighted risk percentages',choices.some(t=>t.includes('代价：')&&t.includes('结果：'))&&choices.some(t=>t.includes('50%')&&t.includes('33.3%')&&t.includes('16.7%')));
 check('No browser or Godot script errors',errors.length===0,errors);
 await writeFile(path.join(out,'browser-features.json'),JSON.stringify({passed:true,checks,portraitRows:rows,missing:rows.filter(r=>!r.decoded),errors,pckSHA256:createHash('sha256').update(await readFile(path.join(web,'game.pck'))).digest('hex'),scope:'Real packed Godot and browser decoder; isolated synthetic actors; no real chat/model/settlement; mobile viewport is emulation.'},null,2)+'\n');console.log('FEATURE_BROWSER_PASS',checks.length,'PORTRAITS',rows.length);
}catch(e){await writeFile(path.join(out,'browser-features.json'),JSON.stringify({passed:false,error:String(e),checks,portraitRows:rows,errors},null,2)+'\n');try{await page?.screenshot({path:path.join(out,'feature-failure.png')});}catch{}console.error(e);process.exitCode=1;}
finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
