import test from 'node:test';import assert from 'node:assert/strict';
import {resumeHostExpedition} from '../src/host/resume';
import {enterHostExpedition,type SessionPort} from '../src/host/game-session';
import {withdraw} from '../src/game/expedition';
import {releaseFixture} from './release-browser-fixture';
const active=()=>releaseFixture().chat.booksea.activeExpedition;
test('malformed or inaccessible local storage cannot block a valid chat save',()=>{
 const s=active();for(const raw of ['{bad','null','{}',JSON.stringify({...s,version:-1})])assert.equal(resumeHostExpedition(s,()=>raw,s.hostContext!).run.id,s.run.id);
 assert.equal(resumeHostExpedition(s,()=>{throw Error('SecurityError')},s.hostContext!).run.id,s.run.id);
});
test('matching local run is restored as a deep copy and preserves fresher progress',()=>{
 const s=active(),local=structuredClone(s);local.steps+=12;const result=resumeHostExpedition(s,()=>JSON.stringify(local),s.hostContext!);assert.equal(result.steps,local.steps);result.steps++;assert.notEqual(result.steps,s.steps);
});
test('different run and cross-chat local copies cannot overwrite the chat-authorized run',()=>{
 const s=active(),other=structuredClone(s);other.steps+=20;other.hostContext='other-chat';assert.equal(resumeHostExpedition(s,()=>JSON.stringify(other),s.hostContext!).steps,s.steps);other.hostContext=s.hostContext;other.run.id='different-run';assert.equal(resumeHostExpedition(s,()=>JSON.stringify(other),s.hostContext!).steps,s.steps);
});
test('cleared or foreign chat record cannot be revived from local storage',()=>{
 const s=active();assert.throws(()=>resumeHostExpedition(null,()=>JSON.stringify(s),s.hostContext!),/没有未结束/);assert.throws(()=>resumeHostExpedition(s,()=>JSON.stringify(s),'other-chat'),/另一聊天/);
});
test('an offline-ended local run is recoverable for exactly-once checkpoint settlement',()=>{
 const s=active(),local=structuredClone(s);local.paused=false;withdraw(local);const restored=resumeHostExpedition(s,()=>JSON.stringify(local),s.hostContext!);assert.equal(restored.mode,'ended');assert.equal(restored.run.status,'success');
});
test('entry rechecks the active expedition after acquiring its cross-iframe lock',async()=>{
 let chat:any={booksea:{}},locked=false;
 const p={id:()=> 'entry-chat',chat:()=>chat,read:():Record<string,unknown>=>{throw Error('Should not read actor data')},lock:async(key:string,fn:()=>Promise<unknown>)=>{assert.equal(key,'booksea-entry:entry-chat');locked=true;chat={booksea:{activeExpedition:{run:{id:'won-the-race'}}}};return fn();}} as SessionPort;
 await assert.rejects(()=>enterHostExpedition(p,[]),/还有远征/);assert.equal(locked,true);
});
test('entry refuses a chat switch while waiting for the entry lock',async()=>{
 let context='A';const p={id:()=>context,lock:async(_key:string,fn:()=>Promise<unknown>)=>{context='B';return fn();}} as SessionPort;
 await assert.rejects(()=>enterHostExpedition(p,[]),/聊天已切换/);
});
