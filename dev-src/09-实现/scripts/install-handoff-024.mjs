// Update only the Booksea-owned EJS block in the already-enabled reader entry.
// Must run with the local lab stopped. No chat, actor, resource or model operations.
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createConnection} from 'node:net';
import ts from 'typescript';
const root=fileURLToPath(new URL('../../',import.meta.url)),runtime=path.join(root,'10-联调环境/.runtime');
const live=await new Promise(resolve=>{const s=createConnection({host:'127.0.0.1',port:8017});s.once('connect',()=>{s.destroy();resolve(true);});s.once('error',()=>resolve(false));s.setTimeout(1500,()=>{s.destroy();resolve(false);});});
if(live)throw Error('Stop the port-8017 lab before updating its enabled worldbook');
const file=path.join(runtime,'st-data/default-user/worlds/书海联调·命定之诗v4.3主API正文.json');
const source=await readFile(path.join(root,'22-发布/本地导入/读者核心本体 (new).txt'),'utf8');
const begin='<%_ /* BOOKSEA_READER_HANDOFF_BEGIN */ _%>',end='<%_ /* BOOKSEA_READER_HANDOFF_END */ _%>';
const sha=s=>createHash('sha256').update(s).digest('hex');
function span(s){if(s.split(begin).length!==2||s.split(end).length!==2)throw Error('Booksea block is absent or ambiguous');const a=s.indexOf(begin),b=s.indexOf(end)+end.length;if(b<a)throw Error('Invalid block order');return [a,b];}
const [sa,sb]=span(source),block=source.slice(sa,sb);if(block.includes('let bsApi =')||!block.includes("getvar('bookseaPromptHandoff'"))throw Error('New native EJS was not prepared');
const raw=await readFile(file,'utf8'),before=JSON.parse(raw.replace(/^\uFEFF/,'')),entries=Object.values(before.entries).filter(e=>e.uid===951741);
if(entries.length!==1||entries[0].disable)throw Error('Expected one enabled reader core (uid 951741)');
const entry=entries[0],[a,b]=span(entry.content),nextContent=entry.content.slice(0,a)+block+entry.content.slice(b);
const tree=ts.parseJsonText(file,raw),matches=[];if(tree.parseDiagnostics.length)throw Error('Invalid worldbook JSON');
function visit(n){if(ts.isObjectLiteralExpression(n)&&n.properties.some(p=>p.name?.text==='uid'&&ts.isNumericLiteral(p.initializer)&&Number(p.initializer.text)===951741))matches.push(n);ts.forEachChild(n,visit);}visit(tree);
if(matches.length!==1)throw Error('Ambiguous worldbook entry AST');const value=matches[0].properties.find(p=>p.name?.text==='content')?.initializer;if(!value||!ts.isStringLiteral(value))throw Error('Reader content is not a string');
const next=raw.slice(0,value.getStart(tree))+JSON.stringify(nextContent)+raw.slice(value.end);
const check=JSON.parse(next.replace(/^\uFEFF/,''));Object.values(check.entries).find(e=>e.uid===951741).content=entry.content;if(JSON.stringify(check)!==JSON.stringify(before))throw Error('A non-Booksea field would change');
const backups=path.join(runtime,'booksea-seven-fixes-024-backup');await mkdir(backups,{recursive:true});
if(next!==raw){try{await writeFile(path.join(backups,'world-before.json'),raw,{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}
 if(sha(await readFile(file,'utf8'))!==sha(raw))throw Error('Worldbook changed concurrently');await writeFile(file+'.booksea024-part',next);await rename(file+'.booksea024-part',file);}
const record={installed:true,worldbook:'书海联调·命定之诗v4.3主API正文',uid:951741,beforeSHA256:sha(raw),afterSHA256:sha(next),coreSHA256:sha(nextContent),changed:raw!==next,onlyMarkedBookseaBlockChanged:true,originalPrefixSHA256:sha(entry.content.slice(0,a)),originalSuffixSHA256:sha(entry.content.slice(b)),nativeEjsVariables:true,enabled:true,constant:!!entry.constant,activationKeys:entry.key??[],noChatOrActorWrites:true,noModelCalls:true};
await writeFile(path.join(root,'09-实现/verification/changes-024/worldbook-install.json'),JSON.stringify(record,null,2)+'\n');
const previousRecord=path.join(root,'09-实现/verification/release-audit-20260922/reader-installed.json');const prior=JSON.parse(await readFile(previousRecord,'utf8'));await writeFile(previousRecord,JSON.stringify({...prior,coreSha256:sha(nextContent),latestOwnedUpdate:'0.24.0',latestUpdateEvidence:'09-实现/verification/changes-024/worldbook-install.json'},null,2)+'\n');
console.log(JSON.stringify(record,null,2));
