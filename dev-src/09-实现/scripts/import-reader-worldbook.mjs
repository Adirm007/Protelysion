// Explicit source synchronization, never a network fetch or a write to the live tavern.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const source=process.argv[process.argv.indexOf('--source')+1];
if(!process.argv.includes('--source')||!source)throw Error('Usage: node scripts/import-reader-worldbook.mjs --source <reader worldbook source>');
const bytes=Buffer.from((await readFile(source,'utf8')).replace(/\r\n/g,'\n')),text=bytes.toString('utf8');
for(const marker of ['DREAM_WORLDBOOK reader-core v','BOOKSEA_NARRATIVE_BEGIN','BOOKSEA_NARRATIVE_END','BOOKSEA_READER_HANDOFF_BEGIN','BOOKSEA_READER_HANDOFF_END'])
 if(text.split(marker).length!==2)throw Error('Ambiguous/missing reader core marker: '+marker);
await writeFile(new URL('../templates/reader-core.ejs',import.meta.url),bytes);
await writeFile(new URL('../templates/reader-core-source.json',import.meta.url),JSON.stringify({source:'reader/worldbook/读者核心本体.txt',newlines:'LF',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')},null,2)+'\n');
console.log('Imported the canonical reader worldbook; no live host data was touched.');
