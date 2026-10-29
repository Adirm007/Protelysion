import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {currentReaderInstall} from '../scripts/reader-install.mjs';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function fixture(t){
 const root=await mkdtemp(path.join(tmpdir(),'booksea-reader-install-'));
 t.after(async()=>{assert.ok(path.resolve(root).startsWith(path.resolve(tmpdir())+path.sep+'booksea-reader-install-'));await rm(root,{recursive:true,force:true});});
 await mkdir(path.join(root,'dist'));await mkdir(path.join(root,'regex'));
 const files={};for(const name of ['reader.css','reader-body.html','reader.js']){
  const bytes=Buffer.from('current generated '+name),file='dist/'+name;
  files[name]={path:file,bytes:bytes.length,sha256:sha(bytes)};await writeFile(path.join(root,file),bytes);
 }
 const manifest={schema:1,version:'2026.10.29.1',files};
 const regex=Buffer.from(JSON.stringify({id:'b1c5a3f2-1007-4e0a-9d7e-5a1e0c0d1007',findRegex:'/<dream>.*<\\/dream>/g',replaceString:'current loader release-manifest.json'}));
 await writeFile(path.join(root,'release-manifest.json'),JSON.stringify(manifest));
 await writeFile(path.join(root,'regex/读者对话渲染-外链版.json'),regex);
 return {root,manifest,regex};
}
test('Booksea imports the current coherent reader compatibility output with auditable provenance',async t=>{
 const f=await fixture(t),loaded=await currentReaderInstall(f.root);
 assert.deepEqual(loaded.regex,f.regex);assert.equal(loaded.source.version,f.manifest.version);
 assert.equal(loaded.source.regex.sha256,sha(f.regex));assert.equal(loaded.source.repository,'Adirm007/reader');
});
test('a stale reader build aborts release preparation instead of falling back to the archived regex',async t=>{
 const f=await fixture(t);await writeFile(path.join(f.root,'dist/reader.js'),'changed after manifest');
 await assert.rejects(()=>currentReaderInstall(f.root),/Stale reader release output: reader.js/);
});
test('reader manifest entries cannot escape the selected release directory',async t=>{
 const f=await fixture(t);f.manifest.files['reader.js'].path='../outside.js';
 await writeFile(path.join(f.root,'release-manifest.json'),JSON.stringify(f.manifest));
 await assert.rejects(()=>currentReaderInstall(f.root),/Reader release entry is invalid/);
});
