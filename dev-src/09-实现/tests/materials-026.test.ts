import test from 'node:test';
import assert from 'node:assert/strict';
import {startExpedition,battleDrops,enemyLevel} from '../src/game/expedition';
import {playtestParty,FOES,THEMES} from '../src/game/content';
import {MONSTER_ROSTER} from '../src/game/monsters/catalog';
import {MIMIC_ID,mimicLevel} from '../src/game/monsters/mimic';
import {MONSTER_MATERIALS,materialFor,levelQuality,lifeTierOf,MATERIAL_DROP_CHANCE,VALUE_CRYSTAL_CHANCE,VALUE_CRYSTAL} from '../src/game/monsters/materials';
import {settleRunRewards,rewardFP,rewardLabel} from '../src/core/settlement';
import {addReward,exitMembers,settlementProposal,type Reward} from '../src/core/run';
import {fixture} from './fixtures';
import {actorAt,object} from '../src/core/actors';
const dead=(i:number)=>({id:'enemy-'+i,side:'enemy',defeated:true,current:{hp:0,mp:0,sp:0}});
function drops(depth:number,foes:string[],kind:'enemy'|'mimic',seeds:number){
 const out:Reward[][]=[];
 for(let seed=1;seed<=seeds;seed++){const s=startExpedition(playtestParty().slice(0,1),seed);s.depth=depth;s.seed=(seed*2654435761)>>>0;s.region={...s.region,theme:'T15',name:THEMES.T15!.scenes[seed%3]!};
  const thing:any={id:'t',kind,foes,x:0,z:0,name:'x',used:false},b:any={seed:(seed*2246822519+7)>>>0,units:foes.map((_,i)=>dead(i))};
  const boss=kind==='enemy'&&foes.some(id=>FOES[id]?.role==='Boss');battleDrops(s,thing,b,boss);out.push(s.run.rewards);}
 return out;
}
test('026 every formal monster has exactly one reviewed material in five voices',()=>{
 assert.equal(MONSTER_ROSTER.length,432);assert.equal(Object.keys(MONSTER_MATERIALS).length,432);
 const voices=new Set<string>();
 for(const m of MONSTER_ROSTER){const e=materialFor(m.id);assert.ok(e.name.startsWith(m.name),m.id);assert.ok(e.description.length>6);voices.add(e.voice);}
 assert.deepEqual([...voices].sort(),['读者','阳角少女','心爱的少女','怪人','黑幕'].sort());
 assert.ok(!JSON.stringify(MONSTER_MATERIALS).includes('哀怜'));
});
test('026 quality follows level; Boss is one step higher, never 普通, capped at 神话',()=>{
 const q=[[1,'普通'],[4,'普通'],[5,'优良'],[9,'稀有'],[13,'史诗'],[17,'传说'],[21,'神话'],[24,'神话'],[25,'神话'],[40,'神话']] as const;
 for(const [lv,name] of q)assert.equal(levelQuality(lv),name);
 const b=[[1,'优良'],[5,'稀有'],[9,'史诗'],[13,'传说'],[17,'神话'],[21,'神话'],[30,'神话']] as const;
 for(const [lv,name] of b)assert.equal(levelQuality(lv,true),name);
 for(let lv=1;lv<60;lv++)assert.notEqual(levelQuality(lv,true),'普通');
 assert.equal(lifeTierOf(25),7);
});
test('026 ordinary fights never drop boxes; 10% drop one defeated monster material with theme·region effect',()=>{
 const foes=['T15_N04','T15_N01'],all=drops(5,foes,'enemy',3000),got=all.filter(r=>r.length);
 assert.ok(all.every(r=>r.every(x=>x.kind==='material')));
 const rate=got.length/all.length;assert.ok(Math.abs(rate-MATERIAL_DROP_CHANCE)<.025,String(rate));
 const ids=new Set(got.map(r=>(r[0] as any).monsterId));assert.deepEqual([...ids].sort(),[...foes].sort());
 const r=got[0]![0]! as Extract<Reward,{kind:'material'}>;
 assert.equal(r.quality,levelQuality(enemyLevel(5)));assert.equal(r.theme,'纸页天穹');assert.ok(THEMES.T15!.scenes.includes(r.region));
 assert.equal(r.effect,`于纸页天穹·${r.region}掉落的${r.name}，可用做素材`);assert.equal(r.description,materialFor(r.monsterId).description);
});
test('026 Boss fights always drop the Boss material one quality above the floor',()=>{
 for(const depth of [1,9,17,33,41,80]){const all=drops(depth,['T15_B01','T15_N02'],'enemy',40);
  for(const r of all){assert.equal(r.length,1);const m=r[0] as any;assert.equal(m.kind,'material');assert.equal(m.monsterId,'T15_B01');assert.equal(m.name,'无字的作者空白稿纸');assert.equal(m.quality,levelQuality(enemyLevel(depth),true));}}
});
test('026 mimic box quality equals mimic level quality; only mythic mimics add 9% 价值的结晶',()=>{
 for(const depth of [1,10,20,31,38,50]){const ml=mimicLevel(enemyLevel(depth)),all=drops(depth,[MIMIC_ID],'mimic',depth>=31?4000:300);
  for(const r of all){const box=r.filter(x=>x.kind==='box');assert.equal(box.length,1);assert.equal((box[0] as any).quality,levelQuality(ml));}
  const crystals=all.filter(r=>r.some(x=>x.kind==='material'));
  if(levelQuality(ml)!=='神话')assert.equal(crystals.length,0,'depth '+depth);
  else{const rate=crystals.length/all.length;assert.ok(Math.abs(rate-VALUE_CRYSTAL_CHANCE)<.02,String(rate));const c=crystals[0]!.find(x=>x.kind==='material') as any;assert.equal(c.name,'价值的结晶');assert.equal(c.quality,'神话');assert.equal(c.effect,VALUE_CRYSTAL.effect);}
 }
 assert.equal(levelQuality(24),'神话');
});
test('026 materials settle into the host bag as 材料, stack by quality, cost no FP and clear on failure',()=>{
 const mat=(q:string,region='漂浮书架'):Reward=>({kind:'material',name:'缺页卫兵残页',quality:q,theme:'纸页天穹',region,effect:`于纸页天穹·${region}掉落的缺页卫兵残页，可用做素材`,description:'d',monsterId:'T15_N04',count:1,source:'x'});
 assert.equal(rewardFP(mat('普通')),0);assert.equal(rewardLabel(mat('普通')),'普通·缺页卫兵残页');
 const m=fixture(),before=structuredClone(m),n=settleRunRewards(m,[mat('普通'),mat('普通'),mat('优良'),mat('普通','折纸庭')]);
 assert.deepEqual(m,before);const bag=object(actorAt(n,{kind:'player'}).背包);
 const a=object(bag['缺页卫兵残页']);assert.equal(a.数量,2);assert.equal(a.类型,'材料');assert.equal(a.品质,'普通');assert.deepEqual(a.效果,{素材:'于纸页天穹·漂浮书架掉落的缺页卫兵残页，可用做素材'});assert.equal(a.描述,'d');
 assert.equal(object(bag['缺页卫兵残页（优良·纸页天穹·漂浮书架）']).数量,1);assert.equal(object(bag['缺页卫兵残页（普通·纸页天穹·折纸庭）']).数量,1);
 const s=startExpedition(playtestParty().slice(0,1),8);s.run=addReward(s.run,mat('稀有'));s.run=exitMembers(s.run,s.run.participants.map(p=>({ref:p.ref,reason:'downedExit' as const})));assert.equal(settlementProposal(s.run).rewards.length,0);
});
