import {roll} from '../battle/damage';
import {SUPPLIER_NAME} from './supplier';
import {MIMIC_ID} from './monsters/mimic';
import {THEMES,THEME_ORDER,type ThemeId} from './content';
import {generateFloor,type FloorLayout} from './maps/generator';
import type {EventDefinition} from './mechanism-content';
export type Thing={id:string;kind:'enemy'|'chest'|'mimic'|'camp'|'event'|'supplier'|'stairs'|'exit';x:number;z:number;name:string;used:boolean;foes:string[];hunter?:boolean;eventReward?:{relic?:number;fp?:number;box?:number};ai?:{mode:'patrol'|'alert'|'chase'|'return';homeX:number;homeZ:number;lostMs:number;stepMs:number};foeResources?:Record<string,{hp:number;mp:number;sp:number}>;customEvent?:EventDefinition;setupFails?:number};
export type Region={id:string;theme:ThemeId;name:string;depth:number;visit:number;width:number;height:number;tiles:string[];spawn:{x:number;z:number};things:Thing[];layout:FloorLayout};
/** An independent seeded permutation: every theme can occur at every life tier across seeds.
 * All 48 occur once per 144-floor cycle; revisit/rolls in combat cannot bias the theme stream. */
export function themeFor(depth:number,seed:number):ThemeId {
 const block=Math.floor((depth-1)/3),order=[...THEME_ORDER];let state=(seed^Math.imul(1+Math.floor(block/order.length),0x45d9f3b))>>>0;
 for(let i=order.length-1;i>0;i--){const r=roll(state);state=r.seed;const j=Math.floor(r.value*(i+1));[order[i],order[j]]=[order[j]!,order[i]!];}
 return order[block%order.length]!;
}
export const CHEST_APPEARANCE_RATE=.08;
export const MIMIC_FRACTION=.5;
/** One chest lottery and one location: 8% total, 4% ordinary / 4% mimic.
 * Final user setting: both types use equal-width intervals, with half the prior total.
 * Never place a mimic in a separate encounter slot with different discoverability. */
export function chestSpawns(depth:number,visit:number,seed:number){
 const value=roll((seed+Math.imul(depth,2654435761)+Math.imul(visit,1597334677))>>>0).value;
 const ordinaryCutoff=CHEST_APPEARANCE_RATE*(1-MIMIC_FRACTION);
 return {chest:value<ordinaryCutoff,mimic:value>=ordinaryCutoff&&value<CHEST_APPEARANCE_RATE};
}
export type RegionOptions={chestRate?:number;chestForce?:boolean;groupEnemies?:boolean;extraGroups?:number;eliteBoost?:boolean;supplierForced?:boolean};
export function makeRegion(depth:number,visit:number,seed:number,options:RegionOptions={}):Region {
 const theme=themeFor(depth,seed),scene=(depth-1)%3;let spawns=chestSpawns(depth,visit,seed);
 // 0.36 遗物：宝箱率加减（同一抽签值上移动区间）与宝箱必现。
 if(options.chestRate){const value=roll((seed+Math.imul(depth,2654435761)+Math.imul(visit,1597334677))>>>0).value,rate=Math.max(0,CHEST_APPEARANCE_RATE+options.chestRate),cut=rate*(1-MIMIC_FRACTION);spawns={chest:value<cut,mimic:value>=cut&&value<rate};}
 if(options.chestForce&&!spawns.chest&&!spawns.mimic){const value=roll((seed^0x51ed270b)>>>0).value;spawns={chest:value<.5,mimic:value>=.5};}
 const layout=generateFloor({seed,depth,visit,theme});
 const pad=(kind:FloorLayout['pois'][number]['kind'],index=0)=>layout.pois.filter(p=>p.kind===kind)[index]!;
 const things:Thing[]=[];
 const add=(kind:Thing['kind'],x:number,z:number,name:string,foes:string[]=[])=>things.push({id:`${seed}-${depth}-${visit}-${kind}-${things.length}`,kind,x,z,name,used:false,foes});
 add('exit',layout.spawn.x,layout.spawn.z,'返回书海入口');
 if(spawns.chest||spawns.mimic)add(spawns.mimic?'mimic':'chest',pad('chest').x,pad('chest').z,'封存的宝匣',spawns.mimic?[MIMIC_ID]:[]);
 const supplier=layout.pois.find(p=>p.kind==='supplier');
 if(supplier)add('supplier',supplier.x,supplier.z,SUPPLIER_NAME);
 else if(options.supplierForced){const spot=layout.pois.find(p=>p.kind==='entry')??layout.pois.find(p=>p.kind==='encounter');if(spot)add('supplier',spot.x,spot.z,SUPPLIER_NAME);}
 const N=(n:number)=>`${theme}_N0${n}`,E=(n:number)=>`${theme}_E0${n}`;
 const shift=((seed>>>0)+visit)%5;
 // 0.36 R12 群狼哨：普通敌群扩为 3–4 个本主题随机 N 系（可重复）；R51 兽笼：普通敌群加入一名精英；R43/R53：额外敌群。
 const pack=(base:string[],salt:number)=>{if(!options.groupEnemies)return options.eliteBoost&&!base.some(id=>/_E0/.test(id))?[...base,E(1+(shift+salt)%3)]:base;let state=(seed^Math.imul(depth+salt,0x9e3779b1)^visit)>>>0;const n=3+(state%2);const out:string[]=[];for(let i=0;i<n;i++){const r=roll(state);state=r.seed;out.push(N(1+Math.floor(r.value*5)));}if(options.eliteBoost)out.push(E(1+(shift+salt)%3));return out;};
 add('enemy',pad('encounter',0).x,pad('encounter',0).z,scene===2?'精英护卫':'游荡敌群',scene===2?[E(1),N(1)]:pack([N(1+shift),N(1+(shift+1)%5)],1));
 add('enemy',pad('encounter',2).x,pad('encounter',2).z,'深处敌群',[E(scene+1)]);
 if(scene===2)add('enemy',pad('encounter',3).x,pad('encounter',3).z,'区域守关者',[`${theme}_B01`]);
 else add('enemy',pad('encounter',3).x,pad('encounter',3).z,'巡游敌群',pack([N(1+(shift+2)%5),N(1+(shift+3)%5)],2));
 for(let i=0;i<(options.extraGroups??0);i++){const slot=layout.pois.filter(p=>p.kind==='encounter')[(i+1)%Math.max(1,layout.pois.filter(p=>p.kind==='encounter').length)];if(!slot)break;let x=slot.x,z=slot.z;for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1]] as const){if(walkable({tiles:layout.tiles} as Region,slot.x+dx,slot.z+dz)&&!things.some(t=>t.x===slot.x+dx&&t.z===slot.z+dz)){x=slot.x+dx;z=slot.z+dz;break;}}add('enemy',x,z,'游荡敌群',pack([N(1+(shift+4+i)%5),N(1+(shift+i)%5)],3+i));}
 add('stairs',layout.down.x,layout.down.z,'继续下潜');
 for(const t of things)if(t.kind==='enemy')t.ai={mode:'patrol',homeX:t.x,homeZ:t.z,lostMs:0,stepMs:0};
 return {id:`region-${seed}-${depth}-${visit}`,theme,name:THEMES[theme]!.scenes[scene]!,depth,visit,width:layout.width,height:layout.height,tiles:layout.tiles,spawn:{...layout.spawn},things,layout};
}
export const walkable=(r:Region,x:number,z:number)=>r.tiles[z]?.[x]==='.';
export const near=(a:{x:number;z:number},b:{x:number;z:number})=>Math.abs(a.x-b.x)+Math.abs(a.z-b.z)<=1;
