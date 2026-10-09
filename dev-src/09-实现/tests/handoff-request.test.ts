import test from 'node:test';
import assert from 'node:assert/strict';
import _ from 'lodash';
import {sessionPort} from '../src/host/game-session';
import {createTavernHandoffPort} from '../src/host/tavern-handoff';
import {ENTRY_REQUEST,EXIT_REQUEST,exitExtra,type HandoffMessage} from '../src/core/handoff-message';
import {startExpedition,withdraw,type State} from '../src/game/expedition';
import {playtestParty} from '../src/game/content';
import {exitMembers} from '../src/core/run';
import {type Obj,object} from '../src/core/actors';
import {fixture,partner} from './fixtures';

function hostValues(data:Obj|undefined){const {bookseaProgressRef,bookseaSessionReceipts,bookseaPromptHandoff,...rest}=data??{};assert.ok(bookseaSessionReceipts===undefined||Object.keys(object(bookseaSessionReceipts)).length===0);return rest;}
type Message=HandoffMessage&{data?:Obj};
function ended(seed=1,failed=false){
 const party=playtestParty().slice(0,1);party[0]!.ref=partner();const s=startExpedition(party,seed);s.source='host';s.hostContext='card:chat';s.run.id='exit-'+seed;
 if(failed){s.run=exitMembers(s.run,[{ref:partner(),reason:'downedExit'}]);s.mode='ended';}else withdraw(s);
 s.writeback='done';return s;
}
function host(s=ended(),narrative=false){
 let chat:Obj={booksea:{lastExpedition:structuredClone(s),activeExpedition:null,settings:{narrative}}},creates=0,triggers=0,throwAfterCreate=false,throwOnTrigger=false;
 const messages:Message[]=[{role:'assistant',message:'原场景',message_id:0,data:fixture()}];
 const context={chat:messages,characterId:'card',getCurrentChatId:()=> 'chat',onlineStatus:'connected',saveChat:async()=>{}};
 const h={getLastMessageId:()=>messages.length-1,getChatMessages:(range:string|number)=>structuredClone(typeof range==='number'?[messages[range===-1?messages.length-1:range]!]:messages),
  getVariables:(o:Obj)=>structuredClone(o.type==='chat'?chat:messages[Number(o.message_id??messages.length-1)]?.data??fixture()),
  updateVariablesWith:async(fn:(v:Obj)=>Obj,o:Obj)=>{if(o.type==='chat')chat=fn(structuredClone(chat));else{const row=messages[Number(o.message_id??messages.length-1)]!;const next=fn(structuredClone(row.data??fixture()));assert.deepEqual(object(next.stat_data),object((row.data??fixture()).stat_data),'Timeline metadata must not change actor data during handoff');row.data=next;}},
  replaceVariables:async()=>{throw Error('User messages must carry their MVU data atomically, not through a second write');},
  createChatMessages:async(ms:Message[])=>{creates++;for(const m of ms){assert.deepEqual(hostValues(m.data),hostValues(h.getVariables({type:'message',message_id:messages.length-1})),'MVU must already accompany the creation');if((m.extra?.bookseaHandoff as Obj)?.kind==='exit')assert.deepEqual(m.data?.bookseaPromptHandoff,m.extra?.bookseaHandoff);messages.push({...structuredClone(m),message_id:messages.length});}if(throwAfterCreate){throwAfterCreate=false;throw Error('create acknowledgement lost');}},
  triggerSlash:async(command:string)=>{assert.equal(command,'/trigger await=true');triggers++;if(throwOnTrigger){throwOnTrigger=false;throw Error('narrative unavailable');}messages.push({role:'assistant',message:'已离开，继续原场景。',message_id:messages.length,data:structuredClone(messages.at(-1)?.data)});},
 };
 const port=sessionPort({TavernHelper:h,SillyTavern:{getContext:()=>context},_:_,navigator:{locks:{request:async(_key:string,fn:()=>Promise<unknown>)=>fn()}}});
 return {port,h,messages,get chat(){return chat;},get creates(){return creates;},get triggers(){return triggers;},loseAck(){throwAfterCreate=true;},failNarrative(){throwOnTrigger=true;},async select(next:State){await port.prepare?.();await port.updateChat(v=>({...v,booksea:{...object(v.booksea),lastExpedition:structuredClone(next)}}));}};
}

test('programmatic entry sends only the plain trigger with MVU in the same message creation',async()=>{
 const f=host();await f.port.enterNarrative!([partner()],1,'entry-test');const sent=f.messages.find(m=>m.role==='user')!;
 assert.equal(sent.message,ENTRY_REQUEST);assert.deepEqual(hostValues(sent.data),fixture());assert.equal((sent.extra!.bookseaHandoff as Obj).kind,'entry');assert.equal(f.creates,1);assert.equal(f.triggers,1);
});
test('success sends one plain exit; summary and identity are hidden metadata and data is atomic',async()=>{
 const s=ended(),f=host(s);await f.port.deliver(s);await f.port.deliver(s);
 assert.equal(f.creates,1);assert.equal(f.triggers,0);const m=f.messages.at(-1)!;assert.equal(m.message,EXIT_REQUEST);assert.deepEqual(hostValues(m.data),fixture());
 const info=m.extra!.bookseaHandoff as Obj;assert.equal(info.runId,s.run.id);assert.equal(info.contextId,'card:chat');assert.equal(info.status,'success');assert.match(String(info.summary),/已结算/);assert.doesNotMatch(m.message,/标识|JSON|结算|<booksea-game>|\n/);
});
test('failure uses the same plain exit while retaining final-downed facts outside user text',async()=>{
 const s=ended(2,true),f=host(s);await f.port.deliver(s);const m=f.messages.at(-1)!,info=m.extra!.bookseaHandoff as Obj;
 assert.equal(m.message,EXIT_REQUEST);assert.equal(info.status,'failed');assert.match(String(info.summary),/最终在局内倒下/);assert.match(String(info.summary),/主角未参战/);assert.deepEqual(hostValues(m.data),fixture());
});
test('lost create acknowledgement is recovered from metadata without a second user message',async()=>{
 const s=ended(),f=host(s);f.loseAck();await assert.rejects(f.port.deliver(s),/acknowledgement lost/);await f.port.deliver(s);
 assert.equal(f.creates,1);assert.equal(f.messages.filter(m=>m.role==='user').length,1);assert.deepEqual(hostValues(f.messages.at(-1)!.data),fixture());
});
test('identical visible exits from two runs are each sent once rather than matching all history',async()=>{
 const one=ended(31),two=ended(32),f=host(one);await f.port.deliver(one);await f.select(two);await f.port.deliver(two);await f.port.deliver(two);
 assert.equal(f.creates,2);assert.deepEqual(f.messages.filter(m=>m.role==='user').map(m=>m.message),[EXIT_REQUEST,EXIT_REQUEST]);
 assert.deepEqual(f.messages.filter(m=>m.role==='user').map(m=>(m.extra!.bookseaHandoff as Obj).runId),[one.run.id,two.run.id]);
});
test('deleting a delivered exit does not authorize the program to resend it',async()=>{
 const s=ended(),f=host(s);await f.port.deliver(s);f.messages.pop();await assert.rejects(f.port.deliver(s),/楼层|已被删除/);assert.equal(f.creates,1);
});
test('editing a delivered exit is preserved, not overwritten or silently resubmitted',async()=>{
 const s=ended(),f=host(s);await f.port.deliver(s);f.messages.at(-1)!.message='我的修改';await assert.rejects(f.port.deliver(s),/已被编辑/);assert.equal(f.creates,1);assert.equal(f.messages.at(-1)!.message,'我的修改');
});
test('explicit narrative retry reuses the same exit message; successful generation is not repeated',async()=>{
 const s=ended(),f=host(s,true);f.failNarrative();await assert.rejects(f.port.deliver(s),/narrative unavailable/);await f.port.deliver(s);await f.port.deliver(s);
 assert.equal(f.creates,1);assert.equal(f.triggers,2);assert.equal(object(object(f.chat.booksea).narrativeRequests)['exit:'+s.run.id],'delivered');
});
test('an old settled run cannot take over a newer ended run',async()=>{
 const one=ended(81),two=ended(82),f=host(two);await f.port.deliver(one);assert.equal(f.creates,0);assert.equal((object(f.chat.booksea).lastExpedition as State).run.id,two.run.id);
});
test('existing pre-update exit text is preserved rather than rewritten or duplicated',async()=>{
 const s=ended(),f=host(s);f.messages.push({role:'user',message:'【书海·离开｜成功】\n结束标识：booksea-success:'+s.run.id,message_id:1,data:fixture()});await f.port.deliver(s);assert.equal(f.creates,0);
});
test('legacy real Helper/MVU adapter sends short text, facts and current MVU in one creation',async()=>{
 const received:Message[]=[],mvu=fixture();const p=createTavernHandoffPort({context:()=>({characterId:'card',chatId:'chat',saveChat:async()=>{}}),helper:{getLastMessageId:()=>0,getVariables:()=>({}),updateVariablesWith:()=>{},getChatMessages:()=>received,createChatMessages:async ms=>{received.push(...structuredClone(ms));}},mvu:{getMvuData:()=>mvu,replaceMvuData:async()=>{}},locks:{request:async(_k,fn)=>fn()}});
 await p.sendUser(EXIT_REQUEST,exitExtra('card:chat','legacy','failed','事实'));assert.equal(received[0]!.message,EXIT_REQUEST);assert.deepEqual(hostValues(received[0]!.data),mvu);assert.deepEqual(received[0]!.data?.bookseaPromptHandoff,received[0]!.extra?.bookseaHandoff);assert.equal((received[0]!.extra!.bookseaHandoff as Obj).runId,'legacy');assert.equal(p.userMessages().length,1);
});
