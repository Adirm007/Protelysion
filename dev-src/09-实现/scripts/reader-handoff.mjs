import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export const HANDOFF_BEGIN='<%_ /* BOOKSEA_READER_HANDOFF_BEGIN */ _%>';
export const HANDOFF_END='<%_ /* BOOKSEA_READER_HANDOFF_END */ _%>';
/** Generate a derivative of the explicitly imported reader source. */
export async function currentReaderCore(){
 const reference=await readFile(new URL('../templates/reader-core.ejs',import.meta.url),'utf8');
 const source=await readFile(new URL('../templates/reader-core-source.json',import.meta.url),'utf8').then(JSON.parse);
 if(Buffer.byteLength(reference)!==source.bytes||createHash('sha256').update(reference).digest('hex')!==source.sha256)throw Error('Reader core source changed; run the explicit reader-worldbook import first');
 if(reference.split(HANDOFF_BEGIN).length!==2||reference.split(HANDOFF_END).length!==2)throw Error('Ambiguous Booksea-owned core block');
 const start=reference.indexOf(HANDOFF_BEGIN);let end=reference.indexOf(HANDOFF_END,start)+HANDOFF_END.length;
 // The imported reader puts the last failure block's two closing braces just
 // after its end marker. Our three standalone templates already close them.
 const trailingClose=reference.slice(end).match(/^\r?\n<%_\s*}\s*}\s*_%>/);
 if(trailingClose)end+=trailingClose[0].length;
 const templates=await Promise.all(['entry','failure','success'].map(name=>readFile(new URL('../templates/'+name+'-handoff.ejs',import.meta.url),'utf8').then(text=>text.replace(/\r\n/g,'\n'))));
 return reference.slice(0,start)+HANDOFF_BEGIN+'\n'+templates.map(t=>t.trimEnd()).join('\n\n')+'\n'+HANDOFF_END+reference.slice(end);
}
