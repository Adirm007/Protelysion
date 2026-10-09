/** 0.38.2 原文治疗量识别：宿主卡的治疗多为固定值（《品质效果限定规则》资源类），只有原文写了 % 才是百分比治疗。 */
export type FixedHealResource='hp'|'mp'|'sp'|'all'|'mp+sp'|'auto';
export type FixedHeal={amount:number;resource:FixedHealResource;perRound:boolean;index:number};

const VERB='(?:恢复|回复|治疗|治愈|补充|回血|复原)';
const RES='(HP\\s*/\\s*MP\\s*/\\s*SP\\s*中?最少的一项|HP\\s*/\\s*MP\\s*/\\s*SP中[^，。；;]{0,4}最低的一项|HP\\s*[+＋/]\\s*MP\\s*[+＋/]\\s*SP|MP\\s*[+＋/]\\s*SP|HP|MP|SP|生命值?|法力值?|体力值?|血量|魔力|精力)';
/** 动词后 12 字以内的“N点 / N + 资源名”，数字后不能紧跟 %、回合、次、层、秒等。 */
const FIXED=new RegExp(VERB+'([^，。；;%\\d]{0,12}?)(\\d[\\d,]*(?:\\.\\d+)?)\\s*(?!\\d|\\.\\d|%|％|回合|次|层|秒|名|个|人|点?(?:伤害|护盾|攻击|防御))(点)?\\s*(?:的)?'+RES+'?','g');
const PERCENT=new RegExp(VERB+'[^，。；;]{0,14}?\\d+(?:\\.\\d+)?\\s*[%％]');

function resourceOf(word:string|undefined):FixedHealResource{
 const w=(word??'').replace(/\s/g,'');
 if(/最少|最低/.test(w))return 'auto';
 if(/HP.*MP.*SP/.test(w))return 'all';
 if(/MP.*SP/.test(w))return 'mp+sp';
 if(/MP|法力|魔力/.test(w))return 'mp';
 if(/SP|体力|精力/.test(w))return 'sp';
 return 'hp';
}

/** 原文里的固定值治疗（有“点”或资源名才算，避免把“恢复3回合”之类当成治疗量）。 */
export function fixedHeals(text:string):FixedHeal[]{
 const out:FixedHeal[]=[];
 for(const m of text.matchAll(FIXED)){
  const [,between,num,point,res]=m;
  if(!point&&!res)continue;
  if(/受到|被/.test(between??''))continue;
  const amount=Number(String(num).replace(/,/g,''));
  if(!(amount>0))continue;
  const index=m.index??0,before=text.slice(Math.max(0,index-12),index);
  out.push({amount,resource:resourceOf(res??(/HP|MP|SP|生命|法力|体力|魔力|精力|血量/.test(between??'')?between:undefined)),perRound:/每回合|每轮|回合(?:开始|结束)时/.test(before+(between??'')),index});
 }
 return out;
}
/** 原文是否写了百分比治疗。 */
export const hasPercentHeal=(text:string)=>PERCENT.test(text);

type AnyObj=Record<string,unknown>;
const flatAmount=(n:number)=>({flat:n,attribute:'none',factor:0,scale:'flat',maxResource:'none',maxFraction:0});
const pctHeal=(e:AnyObj)=>{const a=e.amount as AnyObj|undefined;return !!a&&Number(a.maxFraction)>0&&!Number(a.flat)&&!Number(a.lostFraction)&&!Number(a.eventFraction)&&!Number(a.currentFraction)&&!Number(a.factor);};
function walkHeals(v:unknown,hot:boolean,fn:(e:AnyObj,hot:boolean)=>void){
 if(Array.isArray(v)){for(const x of v)walkHeals(x,hot,fn);return;}
 if(!v||typeof v!=='object')return;const o=v as AnyObj;
 if(o.op==='heal')fn(o,hot);
 for(const [k,c] of Object.entries(o))if(c&&typeof c==='object')walkHeals(c,hot||/:hot$/.test(k),fn);
}
/** 旧缓存是否把原文固定值治疗编成了按最大值比例的治疗（需要重编）。 */
export function needsHealRefresh(mapping:unknown,text:string):boolean{
 if(!fixedHeals(text).length||hasPercentHeal(text))return false;
 let hit=false;walkHeals(mapping,false,e=>{if(pctHeal(e))hit=true;});return hit;
}
/** 确定性修复（模型不可用时的兜底）：按最大值比例的治疗改回原文固定值，说明里的“N%最大生命”同步改成“N点生命”。 */
export function repairFixedHealMapping<T>(mapping:T,text:string):{mapping:T;changed:boolean}{
 const fixed=fixedHeals(text);if(!fixed.length||hasPercentHeal(text))return {mapping,changed:false};
 const direct=fixed.filter(f=>!f.perRound),ticking=fixed.filter(f=>f.perRound);
 const match=(e:AnyObj,f:FixedHeal)=>f.resource===(e.adaptive?'auto':e.resource)||f.resource==='all'||(f.resource==='mp+sp'&&(e.resource==='mp'||e.resource==='sp'))||(f.resource==='auto'&&!!e.adaptive);
 let changed=false;
 walkHeals(mapping,false,(e,hot)=>{if(!pctHeal(e))return;const pool=hot&&ticking.length?ticking:direct.length?direct:fixed;const f=pool.find(x=>match(e,x))??pool[0]!;e.amount=flatAmount(f.amount);changed=true;});
 if(changed){const m=mapping as AnyObj;const n=(ticking[0]??fixed[0])!.amount,d=(direct[0]??fixed[0])!.amount;
  const fix=(s:unknown)=>typeof s==='string'?s.replace(/每回合恢复(?:最大(生命|法力|体力))?\d+(?:\.\d+)?%(?:最大(生命|法力|体力))?/g,(_x,a,b)=>`每回合恢复${n}点${a??b??'生命'}`).replace(/恢复(\d+(?:\.\d+)?)%最大(生命|法力|体力|资源（[^）]*）)/g,(_x,_p,r)=>`恢复${d}点${r}`):s;
  if(m.reason!==undefined)m.reason=fix(m.reason);const fid=m.fidelity as AnyObj|undefined;if(fid?.summary!==undefined)fid.summary=fix(fid.summary);}
 return {mapping,changed};
}
