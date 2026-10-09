import type {State,Knockout,FoeRecord} from './expedition';
import {FOES,THEMES} from './content';
import {MONSTER_BY_ID} from './monsters/catalog';
import {STRAY_ID} from './monsters/stray';

/** 0.37.6 离场交接：每名成员在哪一层、被谁击倒；最后一战败给了谁；相关敌怪的资料。只给事实，叙事规则留给读者核心。 */
const foeLabel=(f:FoeRecord)=>f.id===STRAY_ID?'「?」':`「${f.name}」`;
function group(foes:FoeRecord[]):string{
 const counts=new Map<string,number>();for(const f of foes)counts.set(foeLabel(f),(counts.get(foeLabel(f))??0)+1);
 return [...counts].map(([name,n])=>n>1?`${name}×${n}`:name).join('、');
}
const place=(k:{depth:number;region:string;theme:string})=>`第${k.depth}层「${k.region}」（${k.theme}）`;
function knockoutText(k:Knockout):string{
 if(k.cause==='battle'&&k.foes.length)return `${k.name}：${place(k)}，在与${group(k.foes)}的战斗中被击倒`;
 const before=k.foes.length?`（此前最后交战的是${group(k.foes)}）`:'';
 return k.cause==='event'?`${k.name}：${place(k)}，在事件「${k.event??'未知'}」中倒下${before}`:`${k.name}：${place(k)}，在探索途中倒下${before}`;
}
/** 单个敌怪的资料。「?」只给标记，完整描写由读者核心注入（那里能解析系统名）。 */
export function foeInfo(f:FoeRecord):string{
 if(f.id===STRAY_ID)return `「?」Lv.${f.level}：资料见【「?」】`;
 const design=MONSTER_BY_ID[f.id],foe=FOES[f.id],parts=[`${foeLabel(f)}Lv.${f.level}`,foe?.role??design?.role??'普通'];
 if(design)parts.push('出没于'+(THEMES[design.theme]?.name??design.theme));
 if(design?.motif)parts.push('特征：'+design.motif);
 const skills=[...new Set(Object.values(foe?.skills??{}).map(a=>a.name).filter((n):n is string=>!!n))].slice(0,4);
 if(skills.length)parts.push('招式：'+skills.join('、'));
 return parts.join('，');
}
/** finalMembers：最后倒下那一批成员的局内 id（宿主按 failureSignal.finalDowned 换算）。成功离场时传空。 */
export function knockoutLines(s:State,finalMembers:string[]=[]):string[]{
 const all=s.knockouts??[];if(!all.length)return [];
 const lines=['各成员倒下经过：'+all.map(knockoutText).join('；')+'。'];
 const final=all.filter(k=>finalMembers.includes(k.member)),last=final.at(-1);
 if(last){
  if(last.cause==='battle'&&last.foes.length)lines.push(`最后一战：${place(last)}，队伍败给了${group(last.foes)}，被其送出普罗泰利西翁。`);
  else lines.push(`最后倒下发生在${place(last)}的${last.cause==='event'?'事件「'+(last.event??'未知')+'」中':'探索途中'}${last.foes.length?'，此前最后交战的是'+group(last.foes):''}。`);
 }
 const seen=new Set<string>(),foes:FoeRecord[]=[];
 for(const k of [...final,...all])for(const f of k.foes){const key=f.id+':'+f.level;if(!seen.has(key)){seen.add(key);foes.push(f);}}
 if(foes.length)lines.push('相关敌怪：'+foes.slice(0,8).map(foeInfo).join('；')+'。');
 return lines;
}
