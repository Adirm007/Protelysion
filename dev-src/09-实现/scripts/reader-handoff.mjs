import {readFile} from 'node:fs/promises';
export const HANDOFF_BEGIN='<%_ /* BOOKSEA_READER_HANDOFF_BEGIN */ _%>';
export const HANDOFF_END='<%_ /* BOOKSEA_READER_HANDOFF_END */ _%>';
/** Generate a derivative; never rewrite the read-only host reference or unrelated core. */
export async function currentReaderCore(){
 const reference=await readFile(new URL('../../02-宿主参考-只读/读者核心本体 (new).txt',import.meta.url),'utf8');
 if(reference.split(HANDOFF_BEGIN).length!==2||reference.split(HANDOFF_END).length!==2)throw Error('Ambiguous Booksea-owned core block');
 const start=reference.indexOf(HANDOFF_BEGIN),end=reference.indexOf(HANDOFF_END,start)+HANDOFF_END.length;
 const templates=await Promise.all(['entry','failure','success'].map(name=>readFile(new URL('../templates/'+name+'-handoff.ejs',import.meta.url),'utf8')));
 return reference.slice(0,start)+HANDOFF_BEGIN+'\n'+templates.map(t=>t.trimEnd()).join('\n\n')+'\n'+HANDOFF_END+reference.slice(end);
}
