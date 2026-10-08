// Conservative post-verification cleanup. No recursive workspace/archive/user-data deletion.
import {readFile,writeFile,mkdir,readdir,copyFile,unlink,rm,stat} from 'node:fs/promises';
import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../',import.meta.url)),audit=path.join(root,'09-实现/verification/release-audit-20260922'),godot=path.join(root,'16-Godot可玩区域/godot');
const verified=JSON.parse(await readFile(path.join(audit,'installed-release.json'),'utf8'));if(!verified.installed)throw Error('Verify actual deployment before cleanup');
const sha=x=>createHash('sha256').update(x).digest('hex');
async function walk(dir,files=[]){for(const e of await readdir(dir,{withFileTypes:true})){if(e.isSymbolicLink())continue;const full=path.join(dir,e.name);if(e.isDirectory()&&e.name!=='.godot')await walk(full,files);else if(e.isFile())files.push(full);}return files;}
for(const file of await walk(godot))if(/\.(gd|tscn|tres)$/.test(file)&&String(await readFile(file)).includes('res://assets/heroine.png'))throw Error('Old sprite is still referenced; no cleanup');
const removed=[];
for(const rel of ['assets/heroine.png','assets/heroine.png.import']){
 const file=path.join(godot,rel);let bytes;try{bytes=await readFile(file);}catch(e){if(e.code==='ENOENT')continue;throw e;}
 const backup=path.join(audit,'before','16-Godot可玩区域/godot',rel);await mkdir(path.dirname(backup),{recursive:true});try{const old=await readFile(backup);if(sha(old)!==sha(bytes))throw Error('An existing sprite backup differs');}catch(e){if(e.code!=='ENOENT')throw e;await copyFile(file,backup);}
 await unlink(file);removed.push({path:'16-Godot可玩区域/godot/'+rel,bytes:bytes.length,sha256:sha(bytes),reason:'Unreferenced obsolete runtime sprite; source backup preserved'});
}
const imports=path.join(godot,'.godot/imported');for(const name of await readdir(imports))if(name.startsWith('heroine.png-')&&/\.(ctex|md5)$/.test(name)){const file=path.join(imports,name),bytes=(await stat(file)).size;await unlink(file);removed.push({path:'16-Godot可玩区域/godot/.godot/imported/'+name,bytes,reason:'Cache of the removed obsolete sprite'});}
const temp=path.join(audit,'served-public');try{
 const manifest=JSON.parse(await readFile(path.join(temp,'release-manifest.json'),'utf8'));if(manifest.revision!=='booksea-20260922-r1')throw Error('Unexpected temporary directory');
 const files=await walk(temp);for(const file of files){const rel=path.relative(temp,file).split(path.sep).join('/');if(rel!=='game.pck'&&rel!=='release-manifest.json'&&!manifest.files[rel])throw Error('Untracked file in temporary directory: '+rel);}
 let bytes=0;for(const file of files)bytes+=(await stat(file)).size;await rm(temp,{recursive:true});removed.push({path:'09-实现/verification/release-audit-20260922/served-public',files:files.length,bytes,reason:'Expendable materialized browser-test copy; Git-ready release and live assets retained'});
}catch(e){if(e.code!=='ENOENT')throw e;}
for(const name of ['reader-easter-egg.b64.txt','external-game-gray-walker.b64.txt']){const file=path.join(audit,name);try{const bytes=(await stat(file)).size;await unlink(file);removed.push({path:'09-实现/verification/release-audit-20260922/'+name,bytes,reason:'Temporary screenshot transport encoding'});}catch(e){if(e.code!=='ENOENT')throw e;}}
const report={cleaned:true,removed,removedLogicalBytes:removed.reduce((n,f)=>n+f.bytes,0),retained:['Complete public distribution','Current deployed runtime','All source art/audio and original archives','Private installation backups','Audit logs and original screenshots','Dependencies required to rebuild'],note:'Logical sizes include hardlinks and are not a promise of physically freed disk space. No unrelated project or private chat data was removed.'};
await writeFile(path.join(audit,'cleanup.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
