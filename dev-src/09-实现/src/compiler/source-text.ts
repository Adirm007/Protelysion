export function sourceLeaves(raw:unknown):string[]{return typeof raw==='string'||typeof raw==='number'?[String(raw)]:raw&&typeof raw==='object'?Object.values(raw).flatMap(sourceLeaves):[];}
export function sourceText(raw:unknown){return sourceLeaves(raw).join('\n');}
/** 给模型看的原文：保留字段名与“效果名: 效果”的结构（装备的每条效果名是一条独立条款，主动条款要以效果名命名）。 */
export function keyedText(raw:unknown,depth=0):string{
 if(typeof raw==='string'||typeof raw==='number')return String(raw);
 if(Array.isArray(raw))return raw.map(x=>keyedText(x,depth+1)).join('；');
 if(!raw||typeof raw!=='object')return '';
 return Object.entries(raw).filter(([,v])=>v!==undefined&&v!==null&&v!=='').map(([k,v])=>{const inner=keyedText(v,depth+1);return /^\d+$/.test(k)?inner:v&&typeof v==='object'&&!Array.isArray(v)?k+'：\n'+inner.split('\n').map(l=>'  '+l).join('\n'):k+'：'+inner;}).join('\n');
}
export function sourceCitation(raw:unknown){return [...sourceLeaves(raw)].sort((a,b)=>b.length-a.length)[0]?.slice(0,3500)||JSON.stringify(raw??null).slice(0,3500);}
export function normalizeCitation(text:string){return text.normalize('NFKC').replace(/[\s\p{P}]/gu,'');}
export function citationExists(raw:unknown,quote:string){const normalized=normalizeCitation(quote);return !!normalized&&normalizeCitation(JSON.stringify(raw)+'\n'+sourceText(raw)).includes(normalized);}
