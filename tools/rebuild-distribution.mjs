// Rebuild only the text runtime and its manifest entry; game/audio assets remain untouched.
import {createRequire} from 'node:module';
import {readFile,writeFile,readdir,mkdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(new URL('../dev-src/09-实现/package.json',import.meta.url));
const {build}=require('esbuild');
const bundle=await build({entryPoints:[root+'dev-src/09-实现/src/distribution/entry.ts'],bundle:true,format:'iife',globalName:'BookseaDistribution',target:'es2022',charset:'utf8',write:false,minify:true,legalComments:'eof'});
const bytes=Buffer.from(bundle.outputFiles[0].text),manifestPath=root+'site/release-manifest.json';
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
manifest.files['distribution.js']={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
// 前端重置 8.2: mirror dev-src/09-实现/assets/ui/** into site/ui/** and its manifest entries (stale ui/ entries removed).
const ui={};async function walk(dir,prefix){for(const entry of await readdir(dir,{withFileTypes:true})){if(entry.isDirectory())await walk(dir+entry.name+'/',prefix+entry.name+'/');else ui[prefix+entry.name]=await readFile(dir+entry.name);}}
await walk(root+'dev-src/09-实现/assets/ui/','ui/');
for(const name of Object.keys(manifest.files))if(name.startsWith('ui/')&&!ui[name])delete manifest.files[name];
await rm(root+'site/ui',{recursive:true,force:true});
for(const [name,data] of Object.entries(ui).sort(([a],[b])=>a.localeCompare(b))){const dest=root+'site/'+name;await mkdir(dest.slice(0,dest.lastIndexOf('/')),{recursive:true});await writeFile(dest,data);manifest.files[name]={bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')};}
await writeFile(root+'site/distribution.js',bytes);
await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
console.log('Updated site/distribution.js, site/ui/ and their SHA-256 manifest entries. Commit them before building a fixed regex.');
