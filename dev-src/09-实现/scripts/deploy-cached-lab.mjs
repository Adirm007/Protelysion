// Explicit, scoped installation. No chats, actor resources or API credentials are changed.
import {readFile,writeFile,mkdir,copyFile,rename,readdir,unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createConnection} from 'node:net';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import {makeLocalRegex} from './public-loader.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),source=path.join(root,'22-发布/booksea-github/site'),target=path.join(root,'10-联调环境/SillyTavern/public/booksea-release');
const sha=b=>createHash('sha256').update(b).digest('hex'),parse=s=>JSON.parse(s.replace(/^\uFEFF/,''));
async function assertStopped(){const active=await new Promise(resolve=>{const s=createConnection({host:'127.0.0.1',port:8017});s.once('connect',()=>{s.destroy();resolve(true);});s.once('error',()=>resolve(false));s.setTimeout(1000,()=>{s.destroy();resolve(false);});});if(active)throw Error('Stop the port-8017 lab before installing; active chat settings are not overwritten.');}
await assertStopped();
const manifest=JSON.parse(await readFile(path.join(source,'release-manifest.json'),'utf8')),browser=JSON.parse(await readFile(path.resolve(root,'09-实现',process.argv.find(a=>a.startsWith('--browser-report='))?.slice(17)??'verification/changes-024/release-browser/release-browser.json'),'utf8'));
if(!browser.passed||browser.publicDistributionBundleSha256!==manifest.files['distribution.js'].sha256)throw Error('Only the browser-verified distribution may be installed');
let previous;try{previous=JSON.parse(await readFile(path.join(target,'release-manifest.json'),'utf8'));if(!previous.revision.startsWith('protelysion-'))throw Error('Unknown existing public directory');}catch(e){if(e.code!=='ENOENT')throw e;try{if((await readdir(target)).length)throw Error('Unowned nonempty public directory');}catch(e){if(e.code!=='ENOENT')throw e;}}
await mkdir(target,{recursive:true});
let installed=0,unchanged=0;
for(const [name,spec]of Object.entries(manifest.files)){
 const file=path.resolve(target,name);if(!file.startsWith(target+path.sep))throw Error('Unsafe release path');const bytes=await readFile(path.join(source,name));if(bytes.length!==spec.bytes||sha(bytes)!==spec.sha256)throw Error('Stale source '+name);
 try{const before=await readFile(file),hash=sha(before);if(hash===spec.sha256){unchanged++;continue;}if(hash!==previous?.files?.[name]?.sha256)throw Error('Public file modified since previous release: '+name);}catch(e){if(e.code!=='ENOENT')throw e;}
 await mkdir(path.dirname(file),{recursive:true});await writeFile(file+'.part',bytes);await rename(file+'.part',file);installed++;
}
for(const [name,spec]of Object.entries(previous?.files??{}))if(!manifest.files[name]){const file=path.resolve(target,name);if(!file.startsWith(target+path.sep))throw Error('Unsafe old release path');try{if(sha(await readFile(file))!==spec.sha256)throw Error('Edited obsolete asset '+name);await unlink(file);}catch(e){if(e.code!=='ENOENT')throw e;}}
await copyFile(path.join(source,'release-manifest.json'),path.join(target,'release-manifest.json'));
const template=JSON.parse(await readFile(path.join(root,'17-宿主可玩联调/entry-template.json'),'utf8')),html=await readFile(path.join(root,'17-宿主可玩联调/web/index.html'),'utf8'),item=makeLocalRegex(template,html.match(/<style>([\s\S]*?)<\/style>/)[1]);
const settings=path.join(root,'10-联调环境/.runtime/st-data/default-user/settings.json'),raw=await readFile(settings,'utf8'),before=parse(raw);
const found=before.extension_settings.regex.filter(x=>x.id===template.id&&!x.disabled&&x.findRegex===template.findRegex);if(found.length!==1)throw Error('Expected exactly one enabled game regex');
const prior=JSON.parse(await readFile(path.join(root,'17-宿主可玩联调/verification/host-entry-install.json'),'utf8'));
let last;try{last=JSON.parse(await readFile(path.join(root,'09-实现/verification/release-20260922/cached-lab-install.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
const current=found[0],newHash=sha(item.replaceString);if(![prior.entryCodeSha256,last?.entryCodeSha256,newHash].includes(sha(current.replaceString)))throw Error('Current Booksea regex was edited; no settings replaced');
const tree=ts.parseJsonText(settings,raw),objects=[];if(tree.parseDiagnostics.length)throw Error('Invalid host settings JSON');
function visit(node){if(ts.isObjectLiteralExpression(node)&&node.properties.some(p=>p.name?.text==='id'&&ts.isStringLiteral(p.initializer)&&p.initializer.text===template.id))objects.push(node);ts.forEachChild(node,visit);}visit(tree);if(objects.length!==1)throw Error('Ambiguous game regex ID');
const edits=[];for(const key of ['replaceString','scriptName']){const value=objects[0].properties.find(p=>p.name?.text===key)?.initializer;if(!value||!ts.isStringLiteral(value))throw Error('Missing regex '+key);edits.push([value.getStart(tree),value.end,JSON.stringify(item[key])]);}
let next=raw;for(const [start,end,value]of edits.sort((a,b)=>b[0]-a[0]))next=next.slice(0,start)+value+next.slice(end);
const checked=parse(next),changed=checked.extension_settings.regex.find(x=>x.id===template.id);changed.replaceString=current.replaceString;changed.scriptName=current.scriptName;if(JSON.stringify(checked)!==JSON.stringify(before))throw Error('Non-target host settings would change');
await assertStopped();if(sha(await readFile(settings,'utf8'))!==sha(raw))throw Error('Host settings changed concurrently');
if(next!==raw){const backups=path.join(root,'10-联调环境/.runtime/booksea-cached-backup-20260922');await mkdir(backups,{recursive:true});try{await readFile(path.join(backups,'settings.json'));}catch(e){if(e.code!=='ENOENT')throw e;await copyFile(settings,path.join(backups,'settings.json'));}await writeFile(settings+'.booksea-cached-part',next);await rename(settings+'.booksea-cached-part',settings);}
await writeFile(path.join(root,'22-发布/本地导入/书海-本机加载正则.json'),JSON.stringify(item,null,2)+'\n');
const report={installed:true,revision:manifest.revision,scope:manifest.scope,player:manifest.player,publicDirectory:'10-联调环境/SillyTavern/public/booksea-release',files:installed+unchanged,newOrUpdated:installed,unchanged,regexId:template.id,entryCodeSha256:newHash,distributionSha256:manifest.files['distribution.js'].sha256,pck:manifest.pck,wasm:manifest.wasm,settingsSha256:sha(next),onlyHostFieldsChanged:['replaceString','scriptName'],noChatOrActorWrites:true,noModelCalls:true,privateBackup:'10-联调环境/.runtime/booksea-cached-backup-20260922'};
await writeFile(path.join(root,'09-实现/verification/release-20260922/cached-lab-install.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
