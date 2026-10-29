import test from 'node:test';
import assert from 'node:assert/strict';
import _ from 'lodash';
import {startExpedition,startNarrative,narrativeDescend} from '../src/game/expedition';
import {playtestParty} from '../src/game/content';
import {resumeFromNarrative} from '../src/host/narrative-mode';
import {checkpointHost,type SessionPort} from '../src/host/game-session';
import {actorAt,object,type Obj} from '../src/core/actors';
import {fixture,partner} from './fixtures';

for(const descend of [0,2])test(`正文成长后${descend?'推进两层再':''}回游戏不把新资源截断为旧上限`,async()=>{
 let mvu=fixture(),chat:Obj={booksea:{}};
 const member=playtestParty()[0]!;member.ref=partner();member.card.numeric={...member.card.numeric,level:5,max:{hp:100,mp:40,sp:30}};member.current={hp:90,mp:35,sp:25};
 const s=startExpedition([member],91);s.source='host';s.hostContext='card:chat';startNarrative(s);for(let i=0;i<descend;i++)narrativeDescend(s);
 const actor=actorAt(mvu,partner());actor.等级=6;
 const current={hp:180,mp:120,sp:110},max={hp:200,mp:140,sp:130};
 for(const [key,label] of [['hp','生命值'],['mp','法力值'],['sp','体力值']] as const)actor[label]={当前:current[key],上限:{_基础:max[key],额外:0}};
 const port={id:()=> 'card:chat',read:()=>structuredClone(mvu),write:async(v:Obj)=>{mvu=v;},chat:()=>chat,updateChat:async(fn:(v:Obj)=>Obj)=>{chat=fn(chat);},lock:async(_key:string,fn:()=>Promise<unknown>)=>fn(),lodash:_,deliver:async()=>{}} as unknown as SessionPort;
 await resumeFromNarrative(port,s);await checkpointHost(port,s);
 const adopted=actorAt(mvu,partner());
 assert.deepEqual({hp:object(adopted.生命值).当前,mp:object(adopted.法力值).当前,sp:object(adopted.体力值).当前},current,'模式切换不能把正文中新上限内的当前资源写回旧上限');
 assert.deepEqual(s.party[0]!.card.numeric.max,max);
 assert.equal(s.party[0]!.card.numeric.level,6);
 const u=s.world!.units.find(u=>u.id===member.id)!;assert.deepEqual(u.current,current);assert.deepEqual(u.base!.max,max);assert.equal(u.level,6);
});
