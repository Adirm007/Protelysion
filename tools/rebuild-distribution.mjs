// Rebuild only the text runtime and its manifest entry; game/audio assets remain untouched.
import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(new URL('../dev-src/09-实现/package.json',import.meta.url));
const {build}=require('esbuild');
const bundle=await build({entryPoints:[root+'dev-src/09-实现/src/distribution/entry.ts'],bundle:true,format:'iife',globalName:'BookseaDistribution',target:'es2022',charset:'utf8',write:false,minify:true,legalComments:'eof'});
const bytes=Buffer.from(bundle.outputFiles[0].text),manifestPath=root+'site/release-manifest.json';
const manifest=JSON.parse(await readFile(manifestPath,'utf8'));
manifest.files['distribution.js']={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
await writeFile(root+'site/distribution.js',bytes);
await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
console.log('Updated site/distribution.js and its SHA-256 manifest entry. Commit both before building a fixed regex.');
