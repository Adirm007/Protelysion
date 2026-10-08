import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {playtestParty} from '../src/game/content';
import {interludeAction} from '../src/compiler/interlude';
import {startExpedition,interact,move,answerExit,useOutsideBattle,view,type State} from '../src/game/expedition';

const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const withRest=()=>{const party=playtestParty();party[0]!.card.skills.push({sourceId:'/技能/间章:小憩',name:'间章:小憩',sourceFingerprint:'t',mapping:{sourceId:'/技能/间章:小憩',disposition:'active',reason:'t',action:interludeAction('间章:小憩')}} as never);return party;};

test('入口：互动只弹出确认，不直接返程；确认期间不能移动', ()=>{
 const s=startExpedition(playtestParty() as never,1 as never) as State;
 const exit=s.region.things.find(t=>t.kind==='exit')!;
 assert.ok(exit,'每层都有入口');assert.equal(s.x+','+s.z,exit.x+','+exit.z,'进层时站在入口上');
 interact(s);
 assert.equal(s.exitAsk,true);assert.equal(s.mode,'explore');assert.equal(s.run.status,'active');
 assert.equal((view(s) as {exitAsk:boolean}).exitAsk,true);
 const at=[s.x,s.z];for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]])move(s,dx!,dz!);
 assert.deepEqual([s.x,s.z],at,'确认框挡住移动');
 answerExit(s,false);
 assert.equal(s.exitAsk,false);assert.equal(s.mode,'explore');assert.equal(s.run.status,'active');
});

test('入口：确认返程后全员返程、本趟成功结算', ()=>{
 const s=startExpedition(playtestParty() as never,1 as never) as State;
 interact(s);answerExit(s,true);
 assert.equal(s.mode,'ended');assert.equal(s.run.status,'success');
});

test('间章:小憩：探索中使用，全员返程', ()=>{
 const s=startExpedition(withRest() as never,1 as never) as State;
 const v=view(s) as {party:{id:string;outsideActions:{id:string;name:string;rest?:boolean}[]}[]};
 const rest=v.party[0]!.outsideActions.find(a=>a.rest);
 assert.ok(rest,'小憩出现在探索技能里，并标记为返程');
 assert.ok(!v.party[1]!.outsideActions.some(a=>a.rest),'没带小憩的成员没有');
 useOutsideBattle(s,v.party[0]!.id,rest!.id,[v.party[0]!.id]);
 assert.equal(s.mode,'ended');assert.equal(s.run.status,'success');
 assert.ok(s.run.participants.every(p=>p.status!=='active'),'没有人留在迷宫里');
});

test('菜单与书间：不再有撤退结算、返回书间、离队返回、上次旅程', ()=>{
 const ui=read('src/ui/expedition-ui.ts'),host=read('src/host-game-entry.ts');
 for(const word of ['撤退结算','返回书间','离队返回'])assert.ok(!ui.includes(word),'菜单里不应再有'+word);
 assert.ok(!host.includes('上次旅程')&&!host.includes("el('last')"),'书间不应再有上次旅程');
});

test('全屏：右上角常驻，面板打开时移到关闭键旁；设置页不再藏全屏', ()=>{
 const ui=read('src/ui/expedition-ui.ts'),css=read('src/ui/rpg-style.ts');
 assert.match(ui,/fullFloat = button\('', toggleFull, 'rpg-fullscreen'\)/);
 assert.match(ui,/fullInline\.hidden = shade\.hidden; fullFloat\.hidden = !shade\.hidden/);
 assert.ok(!/全屏游玩'.*quality\.append/.test(ui));
 assert.match(css,/\.rpg-ui \.rpg-fullscreen\{position:absolute;top:70px;right:16px;z-index:45/);
});

test('小窗菜单：矮窗的两栏布局只在宽窗生效，窄窗页签换行不被挤出', ()=>{
 const css=read('src/ui/rpg-style.ts');
 assert.match(css,/@container\(max-height:520px\) and \(min-width:761px\)\{\.rpg-window\.is-menu\{grid-template-areas:"header header" "tabs body" "tabs footer"\}\}/);
 assert.ok(!/@container\(max-height:520px\)\{[^\n]*grid-template-areas/.test(css),'矮窗通用规则不再改栅格');
 assert.match(css,/\.is-menu>\.rpg-menu-tabs\{flex-direction:row;flex-wrap:wrap;overflow:visible/);
});
