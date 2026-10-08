export function sourceLeaves(raw:unknown):string[]{return typeof raw==='string'||typeof raw==='number'?[String(raw)]:raw&&typeof raw==='object'?Object.values(raw).flatMap(sourceLeaves):[];}
export function sourceText(raw:unknown){return sourceLeaves(raw).join('\n');}
export function sourceCitation(raw:unknown){return [...sourceLeaves(raw)].sort((a,b)=>b.length-a.length)[0]?.slice(0,3500)||JSON.stringify(raw??null).slice(0,3500);}
export function normalizeCitation(text:string){return text.normalize('NFKC').replace(/[\s\p{P}]/gu,'');}
export function citationExists(raw:unknown,quote:string){const normalized=normalizeCitation(quote);return !!normalized&&normalizeCitation(JSON.stringify(raw)+'\n'+sourceText(raw)).includes(normalized);}
