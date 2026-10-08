import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import _ from 'lodash';
import {createMessageTimeline} from '../src/host/message-timeline';
import {sessionPort} from '../src/host/game-session';
import {unwrapMessageExtra,writeNativeMessageExtra} from '../src/core/message-extra';
import {EXIT_REQUEST,exitExtra,exitMeta,exitPromptData} from '../src/core/handoff-message';
import {startExpedition,withdraw} from '../src/game/expedition';
import {playtestParty} from '../src/game/content';
import {fixture,partner} from './fixtures';
import {promptTemplateChat,promptTemplateVariables} from './prompt-template-fixture';

// Use the INSTALLED Helper's own process_message implementation. Its real swipe-info
// envelope was absent from the old mocks and is the regression this file protects.
const helperSource=readFileSync('../10-联调环境/SillyTavern/public/scripts/extensions/third-party/JS-Slash-Runner/src/function/chat_message.ts','utf8');
const start=helperSource.indexOf('  const process_message ='),end=helperSource.indexOf('  const chat_messages:');
assert.ok(start>=0&&end>start,'Review changed upstream Helper implementation');
const readerCode=ts.transpileModule(helperSource.slice(start,end),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
function nativeHarness(legacy:Record<string,unknown>={}){
 const native=(role:string,message:string,data:Record<string,unknown>=fixture(),extra:Record<string,unknown>={})=>({name:role,is_user:role==='user',is_system:false,mes:message,swipe_id:0,swipes:[message],variables:[structuredClone(data)],extra:structuredClone(extra),swipe_info:[{send_date:'preserve-time',extra:structuredClone(extra)}]});
 const messages:any[]=[native('assistant','原场景',fixture(),{unrelated:'keep'})];
 let chat:any={unrelated:'keep',booksea:{settings:{narrative:false},...legacy}},creates=0;
 const read=vm.runInNewContext('(function(){'+readerCode+';return process_message;})()', {chat:messages,_,get_role:(m:any)=>m.is_user?'user':'assistant',role:'all',hide_state:'all',include_swipes:false});
 const helper:any={getLastMessageId:()=>messages.length-1,getChatMessages:(range:string|number)=>typeof range==='number'?[read(range<0?messages.length+range:range)]:messages.map((_,i)=>read(i)),getVariables:(o:any)=>structuredClone(o.type==='chat'?chat:messages[o.message_id??messages.length-1].variables[messages[o.message_id??messages.length-1].swipe_id??0]),updateVariablesWith:async(fn:any,o:any)=>{if(o.type==='chat')chat=fn(structuredClone(chat));else{const m=messages[o.message_id??messages.length-1];m.variables[m.swipe_id??0]=fn(structuredClone(m.variables[m.swipe_id??0]));}},createChatMessages:async(rows:any[])=>{creates++;for(const row of rows)messages.push(native(row.role,row.message,row.data??messages.at(-1).variables[0],row.extra));},triggerSlash:async()=>{throw Error('No model calls in unit tests');}};
 const globals:any={TavernHelper:helper,SillyTavern:{getContext:()=>({characterId:'card',getCurrentChatId:()=> 'chat',chat:messages,saveChat:async()=>{},onlineStatus:'connected'})},_:_,navigator:{locks:{request:async(_k:string,fn:any)=>fn()}}};
 return {messages,helper,globals,read,get chat(){return chat;},get creates(){return creates;},reload(){const copy=JSON.parse(JSON.stringify(messages));messages.splice(0,messages.length,...copy);chat=JSON.parse(JSON.stringify(chat));}};
}
test('0241 negative control: native-only writes are invisible to actual Helper swipe-info reads',()=>{
 const f=nativeHarness();f.messages[0].extra.bookseaCheckpointV1={token:'lost'};
 assert.equal(f.read(0).extra.bookseaCheckpointV1,undefined);
 assert.equal(f.read(0).extra.extra.bookseaCheckpointV1,undefined);
 assert.equal(f.messages[0].extra.bookseaCheckpointV1.token,'lost');
});
test('0241 metadata round-trips through actual Helper, JSON reload and selected swipe without loss',async()=>{
 const f=nativeHarness(),t=createMessageTimeline(f.globals);await t.prepare();
 const s=startExpedition(playtestParty(),41);s.source='host';s.hostContext='card:chat';s.depth=7;s.hostSave=t.stamp();
 await t.commit(undefined,(v:any)=>({...v,booksea:{...v.booksea,activeExpedition:s}}),s.hostSave);
 const raw=f.read(0);assert.equal(unwrapMessageExtra(raw.extra).bookseaFrameV1,f.messages[0].extra.bookseaFrameV1);
 assert.equal((unwrapMessageExtra(raw.extra).bookseaCheckpointV1 as any).progress.activeExpedition.depth,7);
 assert.equal(f.messages[0].swipe_info[0].send_date,'preserve-time');assert.equal(f.messages[0].extra.unrelated,'keep');
 f.reload();const reloaded=createMessageTimeline(f.globals);await reloaded.prepare();assert.equal((reloaded.chat().booksea as any).activeExpedition.depth,7);
 await reloaded.ownedAppend(()=>f.helper.createChatMessages([{role:'user',message:'ordinary'}]));
 assert.equal((reloaded.chat().booksea as any).activeExpedition.depth,7);assert.equal(f.chat.unrelated,'keep');
});
test('0241 syncing the selected swipe preserves every unrelated swipe and host field',()=>{
 const m:any={swipe_id:1,extra:{reasoning:'preserve'},swipe_info:[{extra:{bookseaFrameV1:'old-branch'},send_date:'old'},{extra:{reasoning:'preserve'},send_date:'current'}]};
 const other=structuredClone(m.swipe_info[0]);writeNativeMessageExtra(m,{bookseaFrameV1:'current-branch'});
 assert.deepEqual(m.swipe_info[0],other);assert.equal(m.swipe_info[1].send_date,'current');assert.deepEqual(m.swipe_info[1].extra,m.extra);assert.equal(m.extra.reasoning,'preserve');
});
test('0241 real Helper envelope confirms exactly one game exit and retains the ended run',async()=>{
 const party=playtestParty().slice(0,1);party[0]!.ref=partner();const s=startExpedition(party,42);withdraw(s);s.source='host';s.hostContext='card:chat';s.writeback='done';s.depthLog!.maximum=7;
 const f=nativeHarness({lastExpedition:s,activeExpedition:null}),port=sessionPort(f.globals);
 await port.deliver(s);await port.deliver(s);assert.equal(f.creates,1);assert.equal(f.messages.at(-1).mes,EXIT_REQUEST);
 assert.equal(exitMeta(f.read(1))?.runId,s.run.id);assert.match(exitMeta(f.read(1))!.summary,/最深7/);
 assert.equal(f.chat.booksea.lastExpedition.run.id,s.run.id);
 f.reload();const reloaded=sessionPort(f.globals);await reloaded.prepare?.();await reloaded.deliver(s);assert.equal(f.creates,1);
});
function render(template:string,context:Record<string,unknown>){let code="let output='';";for(const chunk of template.split(/(<%[\s\S]*?%>)/g)){if(chunk.startsWith('<%')){const e=chunk.replace(/^<%[-=_]?/,'').replace(/[-_]?%>$/,'');code+=(chunk[2]==='-'||chunk[2]==='=')?'output+=('+e+');':e+';';}else code+='output+='+JSON.stringify(chunk)+';';}return String(vm.runInNewContext('(function(){'+code+'return output;})()',context));}
for(const status of ['success','failed'] as const){
 const template=readFileSync('templates/'+(status==='success'?'success':'failure')+'-handoff.ejs','utf8');
 const extra=exitExtra('card:chat','run-0241',status,'最深7；击败宝箱怪；FP、经验与盲盒已经结算。');
 const data=exitPromptData({...fixture(),bookseaSessionReceipts:{'run-0241':{settled:true}}},extra);
 for(const mode of ['bound-extra','message-receipt','swipe','regenerate'] as const)test('0241 '+status+' injects settled message facts with missing chat mirror: '+mode,()=>{
  const rows:any[]=[{role:'assistant',message:'入口剧情'},{role:'user',message:EXIT_REQUEST,data,...(mode==='bound-extra'?{extra}:{})}];
  if(mode==='swipe'||mode==='regenerate')rows.push({role:'assistant',message:'过时回复',data:{}});
  const native=promptTemplateVariables(rows,{}),context={...promptTemplateChat(rows),...native,SillyTavern:{...native.SillyTavern,characterId:'card',getCurrentChatId:()=> 'chat'},generateType:mode};
  const before=JSON.stringify(rows),out=render(template,context);assert.match(out,/最深7；击败宝箱怪/);assert.doesNotMatch(out,/<booksea-game>/);assert.equal(JSON.stringify(rows),before);
 });
 test('0241 '+status+' does not leak prior facts on normal continuation, different chat, different run, or active expedition',()=>{
  const rows=[{role:'user',message:EXIT_REQUEST,data,extra},{role:'assistant',message:'完成回复'}],native=promptTemplateVariables(rows,{});
  const ctx={...promptTemplateChat(rows),...native,SillyTavern:{...native.SillyTavern,characterId:'card',getCurrentChatId:()=> 'chat'}};
  assert.equal(render(template,ctx).trim(),'');
  assert.equal(render(template,{...ctx,generateType:'swipe',SillyTavern:{...ctx.SillyTavern,getCurrentChatId:()=> 'other'}}).trim(),'');
  for(const book of [{activeExpedition:{run:{id:'new-run'}}},{lastExpedition:{mode:'ended',hostContext:'card:chat',run:{id:'different',status}}}]){
   const vars=promptTemplateVariables(rows,{booksea:book});assert.equal(render(template,{...ctx,...vars,generateType:'swipe'}).trim(),'');
  }
 });
}
