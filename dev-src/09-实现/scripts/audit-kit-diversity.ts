import {MONSTER_ROSTER,MONSTER_THEME_BY_ID} from '../src/game/monsters/catalog';
import {monsterKit} from '../src/game/monsters/kits';
import {TIER_START} from '../src/game/monsters/numbers';
const strip=(x:unknown):unknown=>{if(Array.isArray(x))return x.map(strip);if(x&&typeof x==='object'){const o:Record<string,unknown>={};for(const [k,v] of Object.entries(x as Record<string,unknown>)){if(['name','description','source','sourceId','sourceFingerprint','reason','flat','factor','value','amount','multiplier','tags'].includes(k))continue;o[k]=typeof v==='number'?0:strip(v);}return o;}return x;};
const out:Record<string,unknown>={};
const pairs=new Map<string,string[]>();const cores=new Map<string,number>();
for(const m of MONSTER_ROSTER){const k=[...m.cores].sort().join('+');pairs.set(k,[...(pairs.get(k)??[]),m.id]);for(const c of m.cores)cores.set(c,(cores.get(c)??0)+1);}
out.monsters=MONSTER_ROSTER.length;out.corePairs=pairs.size;out.coreUse=Object.fromEntries([...cores].sort((a,b)=>b[1]-a[1]));
out.pairSizes=[...pairs.values()].map(v=>v.length).sort((a,b)=>b-a).slice(0,15);
const laws=new Map<string,number>();for(const t of Object.values(MONSTER_THEME_BY_ID))for(const l of t.laws)laws.set(l,(laws.get(l)??0)+1);out.lawUse=Object.fromEntries(laws);
for(const tier of [1,4,7]){const lvl=TIER_START[tier-1]!;const shapes=new Map<string,number>();const shapesNoNum=new Map<string,number>();let skills=0;
 for(const m of MONSTER_ROSTER){const kit=monsterKit(m.id,lvl);skills+=kit.card.skills.length;const sig=JSON.stringify(strip(kit.card.skills.map(s=>s.mapping.action)));shapes.set(sig,(shapes.get(sig)??0)+1);
  const roleSig=JSON.stringify(strip(kit.card.skills.filter(s=>s.sourceId.includes(':primary')||s.sourceId.includes(':secondary')).map(s=>s.mapping.action)));shapesNoNum.set(roleSig,(shapesNoNum.get(roleSig)??0)+1);}
 out['tier'+tier]={level:lvl,avgSkills:+(skills/MONSTER_ROSTER.length).toFixed(2),distinctFullKits:shapes.size,distinctSignaturePairs:shapesNoNum.size,largestGroup:Math.max(...shapes.values())};}
const sample=monsterKit('T05_B01',25);out.sampleBossLv25=sample.card.skills.map(s=>s.name+' ['+s.mapping.action!.effects.map(e=>e.op).join(',')+']'+(s.mapping.action!.library?' lib:'+Object.keys(s.mapping.action!.library.statuses).length+'st/'+Object.keys(s.mapping.action!.library.actions).length+'act':''));
const sampleN=monsterKit('T05_N01',25);out.sampleNormalLv25=sampleN.card.skills.map(s=>s.name+' ['+s.mapping.action!.effects.map(e=>e.op).join(',')+']');
const sameTheme=MONSTER_ROSTER.filter(m=>m.theme==='T05').map(m=>m.id+':'+m.name+':'+m.role+':'+m.build+':'+m.cores.join('+'));out.T05=sameTheme;
console.log(JSON.stringify(out,null,1));
