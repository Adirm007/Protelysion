// Read only the current reader release outputs; never copy the archived host reference.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function currentReaderInstall(readerRoot){
 const manifestBytes=await readFile(path.join(readerRoot,'release-manifest.json'));
 const manifest=JSON.parse(manifestBytes.toString('utf8'));
 if(manifest.schema!==1||typeof manifest.version!=='string'||!manifest.version)throw Error('Reader release manifest is invalid');
 for(const name of ['reader.css','reader-body.html','reader.js']){
  const entry=manifest.files?.[name];
  if(!entry||!/^dist\/[\w.-]+$/.test(entry.path)||!Number.isSafeInteger(entry.bytes)||entry.bytes<=0||!/^[a-f0-9]{64}$/.test(entry.sha256))throw Error('Reader release entry is invalid: '+name);
  const bytes=await readFile(path.join(readerRoot,entry.path));
  if(bytes.length!==entry.bytes||sha(bytes)!==entry.sha256)throw Error('Stale reader release output: '+name+'; rebuild reader before Booksea');
 }
 const name='regex/读者对话渲染-外链版.json',regex=await readFile(path.join(readerRoot,name));
 const item=JSON.parse(regex.toString('utf8'));
 if(item.id!=='b1c5a3f2-1007-4e0a-9d7e-5a1e0c0d1007'||typeof item.findRegex!=='string'||!item.findRegex.includes('<dream>')||typeof item.replaceString!=='string'||!item.replaceString.includes('release-manifest.json'))throw Error('Reader compatibility regex is invalid');
 return {regex,source:{repository:'Adirm007/reader',version:manifest.version,manifestSha256:sha(manifestBytes),regex:{path:name,bytes:regex.length,sha256:sha(regex)}}};
}
