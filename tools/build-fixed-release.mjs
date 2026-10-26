import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {makeFixedRegex,validateMetadata} from './fixed-loader.mjs';

export const REPOSITORY='Adirm007/Protelysion';
export const ASSET_NAME='protelysion-fixed.regex.json';
const repositoryRoot=fileURLToPath(new URL('../',import.meta.url));
const sha256=data=>createHash('sha256').update(data).digest('hex');
function git(root,...args){return execFileSync('git',['-C',root,...args],{maxBuffer:25000000});}

/** Read committed bytes only. Assets must remain at the pinned source commit, never generated under main URLs. */
export async function buildFixedRelease({version,commit='HEAD',output,root=repositoryRoot,releaseClientSource,cacheSource}){
 if(!/^\d{1,8}(?:\.\d{1,8}){1,5}$/.test(version??''))throw Error('版本必须是数字，例如 0.42.1');
 if(commit!=='HEAD'&&!/^[a-f0-9]{40}$/.test(commit))throw Error('source commit 必须为完整 40 位 SHA，或省略以使用 HEAD');
 const sourceCommit=git(root,'rev-parse','--verify',commit+'^{commit}').toString('utf8').trim();
 const manifestBytes=git(root,'show',sourceCommit+':site/release-manifest.json');
 if(manifestBytes.length>2000000)throw Error('根清单超过大小限制');
 const manifest=JSON.parse(manifestBytes.toString('utf8'));
 if(!manifest.files?.['distribution.js'])throw Error('根清单缺少 distribution.js');
 for(const [name,info] of Object.entries(manifest.files)){
  if(name.length>600||/[\\\x00-\x1f\x7f:#?%]/.test(name)||name.startsWith('/')||name.split('/').some(p=>!p||p==='.'||p==='..')||!Number.isSafeInteger(info.bytes)||info.bytes<0||info.bytes>100*1024*1024||!/^[a-f0-9]{64}$/.test(info.sha256))throw Error('清单文件条目无效：'+name);
 }
 const distribution=git(root,'show',sourceCommit+':site/distribution.js'),info=manifest.files['distribution.js'];
 if(distribution.length!==info.bytes||sha256(distribution)!==info.sha256)throw Error('提交中的 distribution.js 与清单不一致');
 if(!distribution.includes(Buffer.from('protelysion-fixed-v1:')))throw Error('此源码提交尚不支持固定版缓存与同提交镜像，请先提交固定版 runtime 构建结果');
 const template=JSON.parse(git(root,'show',sourceCommit+':install/普罗泰利西翁-书海外链加载正则.json').toString('utf8'));
 const css=template.replaceString.match(/<style>([\s\S]*?)<\/style>/i)?.[1]??'';
 const metadata=validateMetadata({schema:1,repository:REPOSITORY,version,sourceCommit,manifestSha256:sha256(manifestBytes)});
 const client=releaseClientSource??await readFile(new URL('./fixed-release-client.js',import.meta.url),'utf8');
 const cache=cacheSource??await readFile(new URL('./fixed-cache.js',import.meta.url),'utf8');
 const regex=makeFixedRegex({metadata,template,css,releaseClientSource:client,cacheSource:cache});
 const bytes=Buffer.from(JSON.stringify(regex,null,2)+'\n');
 const report={...metadata,tag:'v'+version,asset:ASSET_NAME,bytes:bytes.length,sha256:sha256(bytes)};
 if(output){
  await mkdir(output,{recursive:true});
  await writeFile(path.join(output,ASSET_NAME),bytes);
  await writeFile(path.join(output,'fixed-release.json'),JSON.stringify(report,null,2)+'\n');
 }
 return {metadata,regex,bytes,report};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const values={};
 for(let i=2;i<process.argv.length;i+=2){const key=process.argv[i],value=process.argv[i+1];if(!['--version','--commit','--output'].includes(key)||value===undefined)throw Error('用法：node tools/build-fixed-release.mjs --version 0.42.1 [--commit 40位SHA] [--output artifacts/fixed-release]');values[key.slice(2)]=value;}
 const result=await buildFixedRelease({...values,output:path.resolve(values.output??path.join(repositoryRoot,'artifacts/fixed-release'))});
 console.log(JSON.stringify(result.report,null,2));
}
