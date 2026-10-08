import {test} from 'node:test';
import assert from 'node:assert/strict';
import {playtestParty} from '../src/game/content';
import {startExpedition,move,tick,restoreExpedition,view,type State} from '../src/game/expedition';
import {walkable} from '../src/game/region';
import {action,amount} from '../src/compiler/adaptive';

/** 开场伤害被动：战斗开始时对敌方造成巨额真实伤害（可叠加多份）。 */
function opener(selection:'all'|'random'){
 const hit=action([{op:'damage',amounts:{physical:amount(),energy:amount(),mental:amount(),true:amount(9_999_999)},element:'none',hitChance:1,hitRule:'guaranteed',critChance:0,critMultiplier:1.5} as never],'enemy');
 hit.targeting=(selection==='all'?{side:'enemy',selection:'all',life:'alive'}:{side:'enemy',selection:'random',count:1,life:'alive'}) as never;
 const root=action([]);root.activation='always';root.library={actions:{k:hit},statuses:{},summons:{},fields:{}} as never;
 root.triggers=[{id:'k',event:'battle_start',scope:'self',action:'k',uses:1,payCost:false,reset:'battle'}] as never;
 return root;
}
function partyWith(count:number,selection:'all'|'random'){
 const party=playtestParty() as unknown as {card:{skills:unknown[]}}[];
 for(let i=0;i<count;i++)party[i%party.length]!.card.skills.push({sourceId:'/技能/开场斩'+i,name:'开场斩'+i,mapping:{disposition:'passive',action:opener(selection)}});
 return party as never;
}
function bump(s:State){
 const t=s.region.things.find(t=>t.kind==='enemy'&&!t.used)!;
 for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]] as const)if(walkable(s.region,t.x-dx,t.z-dz)){s.x=t.x-dx;s.z=t.z-dz;move(s,dx,dz);return t;}
 throw Error('no approach');
}
for(const [label,count,selection] of [['全体开场伤害',1,'all'],['叠加单体开场伤害',6,'random']] as const)
 test('开场伤害在行动前清场：立即结算胜利，不停在敌方 0 血的战斗画面（'+label+'）',()=>{
  const s=startExpedition(partyWith(count,selection),7),fights=s.fights,t=bump(s);
  assert.equal(s.mode,'explore');assert.equal(s.battle,null);assert.equal(t.used,true);assert.equal(s.fights,fights+1);
  assert.equal(s.run.battleActive,false);
  const again=restoreExpedition(JSON.parse(JSON.stringify(s)));assert.equal(again.mode,'explore');
 });
test('战斗建立中途出错时整体回滚到探索，不留下没有战斗数据的战斗模式',()=>{
 const s=startExpedition(playtestParty(),7),t=s.region.things.find(t=>t.kind==='enemy'&&!t.used)!;
 t.foes=['__missing_species__'];const x=s.x,z=s.z,error=console.error;console.error=()=>{};
 try{for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]] as const)if(walkable(s.region,t.x-dx,t.z-dz)){s.x=t.x-dx;s.z=t.z-dz;move(s,dx,dz);break;}}finally{console.error=error;}
 assert.equal(s.mode,'explore');assert.equal(s.battle,null);assert.equal(s.run.battleActive,false);
 assert.equal(s.region.things.find(q=>q.id===t.id)!.used,false);assert.ok((s.escapeMs??0)>0);void x;void z;
});
test('旧坏档（战斗模式但没有战斗数据）读档与时钟推进都会自动退回探索',()=>{
 const s=startExpedition(playtestParty(),7);
 const broken={...JSON.parse(JSON.stringify(s)),mode:'battle',battle:null,origin:{x:s.x,z:s.z}} as State;broken.run.battleActive=true;
 const restored=restoreExpedition(broken);
 assert.equal(restored.mode,'explore');assert.equal(restored.run.battleActive,false);assert.equal(view(restored).mode,'explore');
 const live={...JSON.parse(JSON.stringify(broken)),paused:false} as State;tick(live,50);
 assert.equal(live.mode,'explore');
});
