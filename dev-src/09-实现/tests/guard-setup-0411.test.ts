import {test} from 'node:test';
import assert from 'node:assert/strict';
import {playtestParty} from '../src/game/content';
import {startExpedition,move,interact,type State} from '../src/game/expedition';
import {walkable,type Thing} from '../src/game/region';
function bump(s:State,t:Thing){
 s.escapeMs=0;const error=console.error;console.error=()=>{};
 try{for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]] as const)if(walkable(s.region,t.x-dx,t.z-dz)){s.mode='explore';s.x=t.x-dx;s.z=t.z-dz;move(s,dx,dz);return;}}finally{console.error=error;}
 throw Error('no approach');
}
function guarded(){
 const s=startExpedition(playtestParty(),7),t=s.region.things.find(t=>t.kind==='enemy'&&!t.used)!;
 for(const o of s.region.things)if(o.kind==='enemy'&&o!==t)o.used=true;
 const boss=s.region.theme+'_B01';t.foes=[boss,'__missing_species__'];t.foeResources={'enemy-0':{hp:1,mp:1,sp:1}};
 return {s,t:()=>s.region.things.find(q=>q.id===t.id)!,boss};
}
const tryStairs=(s:State)=>{const st=s.region.things.find(t=>t.kind==='stairs')!;s.mode='explore';s.x=st.x;s.z=st.z;const d=s.depth;interact(s);return s.depth!==d||s.mode!=='explore'||!JSON.stringify(s).includes('先处理守关敌群');};
test('0.41.1 守关敌群建立失败：先刷新（清残血、可再挑战），刷新后能正常开战',()=>{
 const {s,t,boss}=guarded();bump(s,t());
 assert.equal(s.mode,'explore');assert.equal(t().used,false);assert.equal(t().setupFails,1);assert.equal(t().foeResources,undefined);
 assert.match(JSON.stringify((s as State&{log?:unknown}).log??s),/对手已重整/);
 t().foes=[boss];bump(s,t());assert.equal(s.mode,'battle');assert.ok(s.battle);
});
test('0.41.1 守关敌群连续两次建立失败：视为突破、无奖励、楼梯放行；普通敌群两次失败后移除',()=>{
 const {s,t}=guarded();const fp=JSON.stringify(s.run.rewards);
 bump(s,t());bump(s,t());
 assert.equal(t().used,true);assert.equal(t().setupFails,2);assert.equal(JSON.stringify(s.run.rewards),fp);
 assert.match(JSON.stringify(s),/视为突破（无奖励）/);
 assert.ok(!s.region.things.some(x=>x.kind==='enemy'&&!x.used&&x.foes.some(f=>f.endsWith('_B01'))));
 const n=startExpedition(playtestParty(),7),e=n.region.things.find(t=>t.kind==='enemy'&&!t.used)!;e.foes=['__missing_species__'];
 bump(n,e);assert.equal(n.region.things.find(q=>q.id===e.id)!.used,false);bump(n,n.region.things.find(q=>q.id===e.id)!);
 assert.equal(n.region.things.find(q=>q.id===e.id)!.used,true);void tryStairs;
});
