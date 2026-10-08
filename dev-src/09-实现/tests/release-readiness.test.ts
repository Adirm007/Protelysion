import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {promptTemplateChat,promptTemplateVariables} from './prompt-template-fixture';
import _ from 'lodash';
import {assetBase,createGodotLoader} from '../src/host/godot-loader';
import {mechanismPanelKey} from '../src/game/mechanism-panel';
import {startExpedition,view,withdraw,type State} from '../src/game/expedition';
import {playtestParty} from '../src/game/content';
import {checkpointHost,sessionPort,type SessionPort} from '../src/host/game-session';
import {object,type Obj} from '../src/core/actors';
import {fixture,partner} from './fixtures';
import {ENTRY_REQUEST,EXIT_REQUEST,exitExtra} from '../src/core/handoff-message';

const readerPath='../02-宿主参考-只读/读者对话渲染0917 (new).json';
// 发布仓库 install/ 里的是生成版读者核心；本地导入那份可能被作者手动修改，不作为生成物校验。
const corePath='../22-发布/booksea-github/install/读者核心本体 (new).txt';
const reader=JSON.parse(readFileSync(readerPath,'utf8')),html:string=reader.replaceString;
const core=readFileSync(corePath,'utf8').replace(/\r\n/g,'\n');
const entry=readFileSync('templates/entry-handoff.ejs','utf8'),failure=readFileSync('templates/failure-handoff.ejs','utf8'),success=readFileSync('templates/success-handoff.ejs','utf8');
const enterFn=html.slice(html.indexOf('function dlbEnterBooksea(){'),html.indexOf('function dlbBodyEggs(){'));
const fixed=JSON.parse(enterFn.match(/var message=(.*);/)![1]!);
function ejsCode(template:string){
 let code="let output='';\n";
 for(const chunk of template.split(/(<%[\s\S]*?%>)/g)){
  if(chunk.startsWith('<%')){
   const expr=chunk.replace(/^<%[-=_]?/,'').replace(/[-_]?%>$/,'');
   code+=chunk[2]==='-'||chunk[2]==='='?'output+=('+expr+');\n':expr+'\n';
  }else code+='output+='+JSON.stringify(chunk)+';\n';
 }
 return code+'return output;';
}
async function render(template:string,message:string,vars:Obj={},role='user',extra:Obj={},withHelper=true){
 const api={getChatMessages:()=>[{role,message,extra}],getVariables:()=>structuredClone(vars)};
 const native={...promptTemplateChat([{role,message}]),...promptTemplateVariables([{role,message,data:{bookseaPromptHandoff:extra.bookseaHandoff}}],vars)};
 return String(await vm.runInNewContext('(async()=>{'+ejsCode(template)+'})()',{
  ...native,...(withHelper?{TavernHelper:api}:{}),getLocalVar:()=> '既有复活规则',
  setLocalVar:()=>{throw Error('Handoff must not mutate variables');},setMessageVar:()=>{throw Error('Handoff must not mutate variables');},
 }));
}
function readerUI(options:{draft?:string;disabled?:boolean;connected?:boolean;generating?:boolean;missing?:boolean}={}){
 const messages:string[]=[],events:string[]=[],timeouts:(()=>void)[]=[];let sent=0,closed=0;
 const ta={value:options.draft??'',focus(){},dispatchEvent(e:{type:string}){events.push(e.type);}};
 const send={disabled:options.disabled??false,getAttribute:()=>null,click(){sent++;}};
 const stop={};
 const pD={querySelector:(q:string)=>options.missing?null:q==='#send_textarea'?ta:q==='#send_but'?send:q==='#mes_stop'?stop:null};
 const pW={__bookseaReaderSending:false,Event:class{constructor(public type:string,_?:unknown){}},setTimeout(fn:()=>void){timeouts.push(fn);},getComputedStyle:()=>({display:options.generating?'block':'none'}),SillyTavern:{getContext:()=>({onlineStatus:options.connected===false?'no_connection':'connected'})}};
 const context=vm.createContext({pD,pW,pToast:(s:string)=>messages.push(s),closeDreamLobby:()=>closed++});new vm.Script(enterFn).runInContext(context);
 return {click:()=>vm.runInContext('dlbEnterBooksea()',context),ta,events,messages,timeouts,get sent(){return sent;},get closed(){return closed;}};
}

test('new reader regex metadata is preserved and integration is idempotent',()=>{
 const backup=JSON.parse(readFileSync('verification/release-audit-20260922/before/02-宿主参考-只读/读者对话渲染0917 (new).json','utf8'));
 for(const key of Object.keys(backup))if(key!=='replaceString')assert.deepEqual(reader[key],backup[key]);
 const before=readFileSync(readerPath,'utf8');execFileSync(process.execPath,['scripts/integrate-new-reader.mjs']);assert.equal(readFileSync(readerPath,'utf8'),before);
 assert.equal((html.match(/data-dlb="eggbooksea"/g)??[]).length,1);assert.match(html,/if\(act==='eggbooksea'\)/);assert.match(html,/10 项 · 进入彩蛋页/);
});
test('new reader original core remains intact; entire EJS and inline JS have valid syntax',()=>{
 const backup=readFileSync('verification/release-audit-20260922/before/02-宿主参考-只读/读者核心本体 (new).txt','utf8').replace(/\r\n/g,'\n');assert.ok(core.startsWith(backup.trimEnd()));
 new vm.Script('(async function(){'+ejsCode(core)+'})');
 const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]!).filter(Boolean);assert.ok(scripts.length>0);for(const s of scripts)new vm.Script(s);
 assert.ok(core.includes(entry.trim()));assert.ok(core.includes(failure.trim()));assert.ok(core.includes(success.trim()));
});
test('reader click fills the actual input and sends the fixed prompt only once',()=>{
 const ui=readerUI();ui.click();ui.click();assert.equal(ui.ta.value,ENTRY_REQUEST);assert.equal(fixed,ENTRY_REQUEST);assert.equal(ui.sent,1);assert.equal(ui.closed,1);assert.deepEqual(ui.events,['input','change']);
});
test('reader click preserves unsent drafts instead of sending or deleting them',()=>{
 const ui=readerUI({draft:'尚未发送的正文草稿'});ui.click();assert.equal(ui.ta.value,'尚未发送的正文草稿');assert.equal(ui.sent,0);assert.match(ui.messages[0]!,/草稿/);
});
test('reader refuses disconnected, busy, disabled and missing-host entry',()=>{
 for(const options of [{connected:false},{generating:true},{disabled:true},{missing:true}]){const ui=readerUI(options);ui.click();assert.equal(ui.sent,0);assert.equal(ui.ta.value,'');assert.ok(ui.messages.length);}
});
test('latest user input containing the trigger accepts transition prose before and after it',async()=>{
 assert.equal(fixed,ENTRY_REQUEST);
 for(const prompt of [fixed, '我向同伴点了点头，进入普罗泰利西翁。', '进入普罗泰利西翁，先观察周围的景象。', '夜梦陪我穿过门廊。\n进入普罗泰利西翁\n请衔接此前的对话。', '进入普罗泰利西翁吗？']){
  const output=await render(entry,prompt);
  assert.equal(output.split('<booksea-game>进入</booksea-game>').length,2,prompt);assert.match(output,/描写抵达普罗泰利西翁/);
  assert.doesNotMatch(output,/不要代玩|不代打|不代选|预扣|不自动给奖励/);
 }
});
test('ordinary latest input without the trigger does not activate entry',async()=>{
 for(const prompt of ['继续普通剧情','书海','普罗泰利西翁','进入另一个地方'])assert.equal((await render(entry,prompt)).trim(),'');
});
test('entry copies the knee-pillow native matcher and has no additional input predicates',()=>{
 assert.ok(core.includes("matchChatMessages(/膝枕|躺.*腿|枕.*腿|靠.*腿/, { start: -1, role: 'user' })"));
 assert.equal(entry.split('\n')[0],"<%_ if (matchChatMessages(/进入普罗泰利西翁/, { start: -1, role: 'user' })) { _%>");
 assert.doesNotMatch(entry,/TavernHelper|bsLatest|bsText|typeof|getChatMessages|&&|\|\|/);
});
test('native EJS getChatMessages returns strings; the entry works without a Helper object API',async()=>{
 const message='我握住她的手，进入普罗泰利西翁。然后停下来等她。',native=promptTemplateChat([{role:'user',message}]);
 assert.equal(typeof native.getChatMessages(-1)[0],'string');assert.equal(native.getChatMessages(-1)[0],message);
 assert.ok((await render(entry,message,{},'user',{},false)).includes('<booksea-game>进入</booksea-game>'));
 const own=core.slice(core.indexOf('<%_ /* BOOKSEA_READER_HANDOFF_BEGIN'),core.indexOf('<%_ /* BOOKSEA_READER_HANDOFF_END'));
 assert.equal((await render(own,message,{},'user',{},false)).split('<booksea-game>进入</booksea-game>').length,2);
});
test('native matcher checks the current input rather than an older entry request',()=>{
 const native=promptTemplateChat([{role:'user',message:ENTRY_REQUEST},{role:'assistant',message:'旧场景已结束'},{role:'user',message:'继续普通剧情'}]);
 assert.equal(native.matchChatMessages(/进入普罗泰利西翁/,{start:-1,role:'user'}),false);
});
test('new EJS follows the original let style and has real multiline text, not escaped paragraph separators',()=>{
 const own=core.slice(core.indexOf('BOOKSEA_READER_HANDOFF_BEGIN'),core.indexOf('BOOKSEA_READER_HANDOFF_END'));
 for(const template of [entry,success,failure]){assert.doesNotMatch(template,/\bconst\s/);assert.ok(template.includes('\n'));assert.doesNotMatch(template,/\\n/);}
 assert.ok(own.split('\n').length>50);assert.doesNotMatch(own,/\\n|bsReaderRequest/);
});
test('failure reads facts only from matching ended-run metadata; original revival is one handoff',async()=>{
 const vars={booksea:{lastExpedition:{mode:'ended',hostContext:'audit',run:{id:'test',status:'failed'}}}},extra=exitExtra('audit','test','failed','最终倒下成员：测试伙伴甲');
 const output=await render(failure,EXIT_REQUEST,vars,'user',extra);assert.match(output,/最终倒下成员：测试伙伴甲/);assert.match(output,/同一次离场事件/);assert.match(output,/既有复活规则/);assert.doesNotMatch(output,/<booksea-game>/);
 for(const [text,role,data] of [[EXIT_REQUEST+'继续','user',extra],['普通剧情','user',extra],[EXIT_REQUEST,'assistant',extra],[EXIT_REQUEST,'user',{}],[EXIT_REQUEST,'user',exitExtra('another-chat','test','failed','错误')],[EXIT_REQUEST,'user',exitExtra('audit','other-run','failed','错误')]] as const)assert.equal((await render(failure,text,vars,role,data)).trim(),'',JSON.stringify({text,role,data}));
 assert.equal((await render(failure,EXIT_REQUEST,{booksea:{...vars.booksea,activeExpedition:{run:{id:'newer'}}}},'user',extra)).trim(),'');
});
test('legacy failure adapter also triggers via metadata, never through the old visible marker',async()=>{
 const vars={booksea:{lastEndedRun:{id:'legacy-test',status:'failed'},endings:{'legacy-test':{contextId:'audit',phase:'delivered'}}}};
 assert.match(await render(failure,EXIT_REQUEST,vars,'user',exitExtra('audit','legacy-test','failed','已确认败退记录')),/已确认败退记录/);
});
test('success needs matching ended-run identity and reads facts from metadata without reopening the game',async()=>{
 const vars={booksea:{lastExpedition:{mode:'ended',hostContext:'audit',run:{id:'host-a',status:'success'}}}},extra=exitExtra('audit','host-a','success','经验与盲盒已经结算');
 const output=await render(success,EXIT_REQUEST,vars,'user',extra,false);assert.match(output,/经验与盲盒已经结算/);assert.doesNotMatch(output,/<booksea-game>/);
 assert.equal((await render(success,EXIT_REQUEST,vars,'user',exitExtra('audit','host-ab','success','别的一趟'))).trim(),'');assert.equal((await render(success,EXIT_REQUEST,{},'user',extra)).trim(),'');
 assert.equal((await render(success,EXIT_REQUEST,vars,'user',exitExtra('audit','host-a','failed','状态不符'))).trim(),'');
});
test('remote asset base is explicit HTTPS, keeps project subpaths, and rejects unsafe URLs',()=>{
 assert.equal(assetBase('https://example.github.io/booksea/','http://localhost:8000/',true).href,'https://example.github.io/booksea/');
 assert.equal(assetBase('http://127.0.0.1:8888/assets','http://127.0.0.1:8000/',true).href,'http://127.0.0.1:8888/assets/');
 for(const s of ['http://external.example/','javascript:alert(1)','https://u:p@example.org/','https://example.org/?key=x','https://example.org/#x'])assert.throws(()=>assetBase(s,'https://host.example/',true));
 assert.throws(()=>assetBase('https://external.example/','https://host.example/'));assert.equal(assetBase('/booksea-play','http://localhost:8000/').pathname,'/booksea-play/');
});
function loaderEnvironment(){
 const scripts:any[]=[],timers:(()=>void)[]=[];const win:any={setTimeout(fn:()=>void){timers.push(fn);return timers.length;},clearTimeout(){}};
 const doc:any={createElement(){return {remove(){this.removed=true;},removed:false};},head:{append(s:any){scripts.push(s);}}};
 return {win,scripts,timers,load:createGodotLoader(win,doc,new URL('https://cdn.example/game/'))};
}
test('Godot timeout can be retried; late callbacks cannot claim success',async()=>{
 const e=loaderEnvironment();const one=e.load();assert.equal(e.load(),one);e.timers[0]!();await assert.rejects(one,/超时/);assert.equal(e.scripts[0].removed,true);assert.equal(e.scripts[0].onload,null);
 const two=e.load();assert.notEqual(two,one);assert.equal(e.scripts.length,2);e.win.Engine=class{};e.scripts[1].onload();await two;assert.equal(e.load(),two);
});
test('Godot invalid script and network failure both release the pending loader',async()=>{
 const e=loaderEnvironment(),first=e.load();e.scripts[0].onload();await assert.rejects(first,/有效/);const second=e.load();e.scripts[1].onerror();await assert.rejects(second,/下载失败/);const third=e.load();e.win.Engine=class{};e.scripts[2].onload();await third;
});
test('mechanism panel ignores ATB-only ticks but notices actions and settlement commitment',()=>{
 const a=view(startExpedition(playtestParty(),8192));(a.battle.units as any[]).push({id:'unit',atb:0,statuses:[]});const b=structuredClone(a);b.battle.timeMs+=50;b.battle.units[0]!.atb+=1;
 assert.equal(mechanismPanelKey(a),mechanismPanelKey(b));b.battle.ready=!a.battle.ready;assert.notEqual(mechanismPanelKey(a),mechanismPanelKey(b));
 const c=structuredClone(a);(c as any).settlement={committed:true};assert.notEqual(mechanismPanelKey(a),mechanismPanelKey(c));
});
test('committed settlement repairs failed chat metadata without paying twice or clearing another run',async()=>{
 let m=fixture(),chat:Obj={},writes=0,failOnce=false,notices=0;
 const p:SessionPort={id:()=> 'audit-chat',messageId:()=>1,read:()=>structuredClone(m),write:async v=>{m=structuredClone(v);writes++;},chat:()=>structuredClone(chat),updateChat:async fn=>{if(failOnce){failOnce=false;throw Error('simulated metadata save failure');}chat=fn(chat);},env:{} as any,lodash:_,lock:async(_key,fn)=>fn(),deliver:async()=>{notices++;}};
 const party=playtestParty().slice(0,1);party[0]!.ref=partner();const s=startExpedition(party,8251);s.source='host';s.hostContext=p.id();s.potions=0;
 await checkpointHost(p,s);withdraw(s);failOnce=true;await assert.rejects(()=>checkpointHost(p,s),/metadata save/);const after=structuredClone(m),count=writes;
 await checkpointHost(p,s);assert.deepEqual(m,after);assert.equal(writes,count);assert.equal(object(chat.booksea).activeExpedition,null);assert.equal((object(chat.booksea).lastExpedition as State).run.id,s.run.id);assert.equal(notices,1);
 const later=structuredClone(s);later.run.id='newer';object(chat.booksea).activeExpedition=later;object(chat.booksea).lastExpedition=later;await checkpointHost(p,s);assert.equal((object(chat.booksea).activeExpedition as State).run.id,'newer');assert.equal((object(chat.booksea).lastExpedition as State).run.id,'newer');
});
test('host startup explains missing helper and insecure-context lock instead of opaque crashes',()=>{
 assert.throws(()=>sessionPort({}),/酒馆助手/);assert.throws(()=>sessionPort({SillyTavern:{getContext(){}},getVariables(){},navigator:{}}),/HTTPS/);
});
test('user-supplied four-by-four walker replaces the old sprite and only one map walker is created',()=>{
 const png=readFileSync('../16-Godot可玩区域/art/player/heroine-chibi.png');
 assert.equal(png.readUInt32BE(16),768);assert.equal(png.readUInt32BE(20),1216);assert.equal(png[25],6);
 const metadata=JSON.parse(readFileSync('../16-Godot可玩区域/art/player/heroine-chibi.json','utf8'));assert.equal(metadata.frames.length,16);assert.deepEqual(metadata.directions,['down','left','right','up']);
 const credits=readFileSync('../16-Godot可玩区域/art/player/CREDITS.md','utf8');assert.match(credits,/用户.*提供/);assert.match(credits,/未使用 AI 重绘/);
 const code=readFileSync('../16-Godot可玩区域/godot/game.gd','utf8');assert.match(code,/res:\/\/assets\/heroine.png/);assert.match(code,/mini\(1,state.party.size\(\)\)/);assert.match(code,/frame\*192,int\(map_scene.facing\)\*304/);
 const sync=readFileSync('../16-Godot可玩区域/tools/sync-random-assets.py','utf8');assert.match(sync,/art\/player\/heroine-chibi.png/);assert.doesNotMatch(sync,/heroine-pipoya|generate_neutral_walker/);
});
