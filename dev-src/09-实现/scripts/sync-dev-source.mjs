// Copy only reviewable development sources into the existing release repository.
// Saves, verification outputs, installed dependencies and host data are excluded.
import {readdir,readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),dest=new URL('../../22-发布/booksea-github/dev-src/09-实现/',import.meta.url);
const files={};
async function put(name,source=new URL(name,root)){
 const bytes=Buffer.from((await readFile(source,'utf8')).replace(/\r\n/g,'\n')),target=new URL(name,dest);await mkdir(new URL('./',target),{recursive:true});
 let old;try{old=await readFile(target);}catch(error){if(error.code!=='ENOENT')throw error;}
 if(!old?.equals(bytes))await writeFile(target,bytes);
 files[name]={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
}
async function copyTree(folder){
 for(const entry of await readdir(new URL(folder+'/',root),{withFileTypes:true})){
  const name=folder+'/'+entry.name;
  if(entry.isSymbolicLink())throw Error('Source export does not follow symlinks: '+name);
  if(entry.isDirectory())await copyTree(name);else if(/\.(?:ts|mts|mjs|js|json|ejs)$/.test(name))await put(name);
 }
}
for(const folder of ['src','scripts','templates','tests'])await copyTree(folder);
for(const name of ['package.json','package-lock.json','tsconfig.json'])await put(name);
await put('godot/game.gd',new URL('../../16-Godot可玩区域/godot/game.gd',import.meta.url));
await put('docs/script-runtime-20261028.md',new URL('../../docs/mcp-script-runtime-20261028.md',import.meta.url));
await writeFile(new URL('source-snapshot.json',dest),JSON.stringify({source:'《书海》开发计划架构/09-实现',godotSource:'16-Godot可玩区域/godot/game.gd',newlines:'LF',files},null,2)+'\n');
console.log('Synchronized '+Object.keys(files).length+' source files; no host data or verification output was copied.');
