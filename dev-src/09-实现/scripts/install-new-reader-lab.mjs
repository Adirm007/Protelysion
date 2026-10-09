// Explicitly authorized Booksea lab install. Run with the lab server stopped.
// Backups containing settings/world data NEVER leave .runtime or enter the public package.
import {readFile,writeFile,mkdir,copyFile,rename,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createConnection} from 'node:net';
import ts from 'typescript';
const project=fileURLToPath(new URL('../../',import.meta.url)),runtime=path.join(project,'10-联调环境/.runtime');
const live=await new Promise(resolve=>{const socket=createConnection({host:'127.0.0.1',port:8017});socket.once('connect',()=>{socket.destroy();resolve(true)});socket.once('error',()=>resolve(false));socket.setTimeout(1500,()=>{socket.destroy();resolve(false)});});
if(live)throw Error('Lab server is running; refuse file replacement while it could overwrite settings. Stop it first.');
const dataRoot=path.join(runtime,'st-data/default-user'),backupRoot=path.join(runtime,'booksea-prompt-fix-0201-20260922');
const sha=s=>createHash('sha256').update(s).digest('hex'),parse=s=>JSON.parse(s.replace(/^\uFEFF/,''));
const reader=parse(await readFile(path.join(project,'02-宿主参考-只读/读者对话渲染0917 (new).json'),'utf8'));
const core=await readFile(path.join(project,'22-发布/本地导入/读者核心本体 (new).txt'),'utf8');
if(!core.includes('BOOKSEA_READER_HANDOFF_BEGIN')||!reader.replaceString.includes('function dlbEnterBooksea(){'))throw Error('The new reader has not been integrated');
let priorInstall;try{priorInstall=parse(await readFile(path.join(project,'09-实现/verification/release-audit-20260922/reader-installed.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
const files=[
 {rel:'settings.json',kind:'settings'},
 {rel:'worlds/书海联调·命定之诗v4.3主API正文.json',kind:'core'},
 {rel:'worlds/书海·结束交接v0.2.json',kind:'legacy'},
];
function property(node,key){return node.properties?.find(p=>p.name?.text===key);}
function objects(tree,key,value){const found=[];function visit(node){if(ts.isObjectLiteralExpression(node)){const p=property(node,key),v=p?.initializer;if(v&&((ts.isStringLiteral(v)&&v.text===String(value))||(ts.isNumericLiteral(v)&&Number(v.text)===value)))found.push(node);}ts.forEachChild(node,visit);}visit(tree);return found;}
function replaceSpans(raw,edits){for(const [start,end,text] of edits.sort((a,b)=>b[0]-a[0]))raw=raw.slice(0,start)+text+raw.slice(end);return raw;}
const prepared=[];
for(const spec of files){
 const file=path.join(dataRoot,spec.rel),raw=await readFile(file,'utf8'),before=parse(raw),tree=ts.parseJsonText(file,raw),edits=[];
 if(tree.parseDiagnostics.length)throw Error('Invalid JSON: '+spec.rel);
 const after=structuredClone(before);
 if(spec.kind==='settings'){
  const list=before.extension_settings?.regex;if(!Array.isArray(list))throw Error('Missing global regex list');
  const conflicts=list.filter(r=>r.id!==reader.id&&String(r.findRegex).includes('dream'));
  if(conflicts.length)throw Error('Unreviewed active reader regex; no settings changed');
  const match=list.filter(r=>r.id===reader.id);if(match.length>1)throw Error('Duplicate reader ID');
  if(match.length){
   const nodes=objects(tree,'id',reader.id);if(nodes.length!==1)throw Error('Ambiguous reader ID');
   if(JSON.stringify(match[0])!==JSON.stringify(reader)){if(!['95839689ef9bb0d237d2027c3c1da8dbceeee826b6a93d420b1328c4c8000782',priorInstall?.readerCodeSha256].includes(sha(match[0].replaceString)))throw Error('Installed reader changed outside the verified install; review before overwriting');edits.push([nodes[0].getStart(tree),nodes[0].end,JSON.stringify(reader)]);after.extension_settings.regex[after.extension_settings.regex.findIndex(r=>r.id===reader.id)]=reader;}
  }else{
   const top=tree.statements[0].expression,extension=property(top,'extension_settings')?.initializer,arr=property(extension,'regex')?.initializer;
   if(!arr||!ts.isArrayLiteralExpression(arr))throw Error('Missing regex array AST');
   edits.push([arr.end-1,arr.end-1,(arr.elements.length?',':'')+'\n'+JSON.stringify(reader)]);after.extension_settings.regex.push(reader);
  }
 }else if(spec.kind==='core'){
  const matches=Object.values(before.entries).filter(e=>e.uid===951741);if(matches.length!==1||matches[0].disable)throw Error('Expected one enabled lab reader core');
  const entry=matches[0],digest=sha(entry.content);
  if(!['05fca8cb8a488d9722421635d5963a1aae9d536b42c884edf2d06cecbbb1571d','7c4bc7060ed28ea8a9a041aa2eae0004feec60b2e00d3f7c21a80bfcd9bd5482',priorInstall?.coreSha256,sha(core)].includes(digest))throw Error('Reader core changed since discovery; refusing stale replacement');
  const nodes=objects(tree,'uid',951741);if(nodes.length!==1)throw Error('Ambiguous reader core UID');const p=property(nodes[0],'content').initializer;
  edits.push([p.getStart(tree),p.end,JSON.stringify(core)]);Object.values(after.entries).find(e=>e.uid===951741).content=core;
 }else{
  for(const uid of [0,1]){
   const entries=Object.values(before.entries).filter(e=>e.uid===uid);if(entries.length!==1||!String(entries[0].comment).includes('书海'))throw Error('Unexpected legacy handoff entry');
   const expected=['22118b3179d2dd9fa1b4a02d12b70b1f780e022b76de310e439c591954ad4812','aa1f3e2a59797e71061d9e17c401635cb2a16bdc0dcf4e34ce927adf34a825c9'][uid];
   if(sha(entries[0].content)!==expected)throw Error('Legacy handoff content changed');
   const nodes=objects(tree,'uid',uid);if(nodes.length!==1)throw Error('Ambiguous legacy UID');const p=property(nodes[0],'disable').initializer;
   edits.push([p.getStart(tree),p.end,'true']);Object.values(after.entries).find(e=>e.uid===uid).disable=true;
  }
 }
 const next=replaceSpans(raw,edits);
 if(JSON.stringify(parse(next))!==JSON.stringify(after))throw Error('Non-target changes detected');
 prepared.push({file,rel:spec.rel,raw,next,edits:edits.length,before:sha(raw),after:sha(next)});
}
await mkdir(backupRoot,{recursive:true});
// Pin untouched chat/character/script data using hashes; do not print or publicly export their contents.
async function inventory(base,rel='',result={}){for(const e of await readdir(base,{withFileTypes:true})){const sub=path.join(rel,e.name),full=path.join(base,e.name);if(e.isDirectory())await inventory(full,sub,result);else if(e.isFile())result[sub]=sha(await readFile(full));}return result;}
const preserved={};for(const folder of ['chats','characters','group chats']){try{preserved[folder]=await inventory(path.join(dataRoot,folder));}catch(e){if(e.code!=='ENOENT')throw e;}}
const baselineFile=path.join(backupRoot,'untouched-data-sha256.json');try{await readFile(baselineFile);}catch{await writeFile(baselineFile,JSON.stringify(preserved,null,2));}
if(sha(await readFile(path.join(project,'22-发布/本地导入/读者核心本体 (new).txt'),'utf8'))!==sha(core)||JSON.stringify(parse(await readFile(path.join(project,'02-宿主参考-只读/读者对话渲染0917 (new).json'),'utf8')))!==JSON.stringify(reader))throw Error('Reader import inputs changed during install; retry against the latest versions');
for(const p of prepared){if(sha(await readFile(p.file,'utf8'))!==p.before)throw Error('Concurrent update: '+p.rel);}
for(const p of prepared){
 if(p.next===p.raw)continue;
 const backup=path.join(backupRoot,p.rel);await mkdir(path.dirname(backup),{recursive:true});try{await readFile(backup);}catch{await copyFile(p.file,backup);}
 const temp=p.file+'.booksea-reader-part';await writeFile(temp,p.next,'utf8');await rename(temp,p.file);
}
const report={installed:true,coreSha256:sha(core),readerCodeSha256:sha(reader.replaceString),newReaderRegex:reader.id,activeWorldbook:'书海联调·命定之诗v4.3主API正文',readerUid:951741,legacySeparateHandoffDisabled:true,changed:prepared.map(p=>({file:p.rel,changed:p.raw!==p.next,before:p.before,after:p.after})),privateBackup:'10-联调环境/.runtime/booksea-prompt-fix-0201-20260922',noModelCalls:true,noChatOrActorWrites:true};
await writeFile(path.join(project,'09-实现/verification/release-audit-20260922/reader-installed.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
