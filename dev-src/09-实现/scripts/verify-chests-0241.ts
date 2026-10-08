import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {chestSpawns,makeRegion,CHEST_APPEARANCE_RATE,MIMIC_FRACTION} from '../src/game/region';
assert.equal(CHEST_APPEARANCE_RATE,.08);assert.equal(MIMIC_FRACTION,.5);
const draws={samples:200000,chest:0,mimic:0,both:0},maps={samples:3000,chest:0,mimic:0,both:0,samePoi:true,sameAppearance:true};
for(let n=1;n<=draws.samples;n++){
 const seed=Math.imul(n,2654435761)>>>0,depth=1+n%144,visit=Math.floor(n/144)%5;
 const flags=chestSpawns(depth,visit,seed);draws.chest+=Number(flags.chest);draws.mimic+=Number(flags.mimic);draws.both+=Number(flags.chest&&flags.mimic);
 if(n<=maps.samples){
  const region=makeRegion(depth,visit,seed),things=region.things.filter(t=>t.kind==='chest'||t.kind==='mimic'),poi=region.layout.pois.find(p=>p.kind==='chest')!;
  maps.chest+=things.filter(t=>t.kind==='chest').length;maps.mimic+=things.filter(t=>t.kind==='mimic').length;maps.both+=Number(things.length>1);
  assert.equal(things.length,Number(flags.chest)+Number(flags.mimic));
  for(const t of things){assert.equal(t.name,'封存的宝匣');assert.equal(t.x,poi.x);assert.equal(t.z,poi.z);}
 }
}
assert.equal(draws.both,0);assert.equal(maps.both,0);
for(const type of ['chest','mimic'] as const){assert.ok(draws[type]/draws.samples>.036&&draws[type]/draws.samples<.044);assert.ok(maps[type]/maps.samples>.025&&maps[type]/maps.samples<.055);}
const rates=(c:{samples:number;chest:number;mimic:number})=>({ordinary:c.chest/c.samples,mimic:c.mimic/c.samples,total:(c.chest+c.mimic)/c.samples});
const report={passed:true,theory:{totalAppearance:.08,ordinary:.04,mimic:.04,conditionalMimicShare:.5},draws:{...draws,rates:rates(draws)},actualGeneratedMaps:{...maps,rates:rates(maps)},note:'Deterministic sampling across 144 depths and five visit indices. Equal theoretical probabilities do not force alternation in short runs.'};
await mkdir('verification/exit-0241',{recursive:true});await writeFile('verification/exit-0241/chest-frequency.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
