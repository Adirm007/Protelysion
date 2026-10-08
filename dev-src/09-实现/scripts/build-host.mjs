import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
await mkdir('release',{recursive:true});
const bundle=await build({entryPoints:['src/host-entry.ts'],bundle:true,format:'iife',globalName:'BookseaHostViewer',target:'es2022',write:false,charset:'utf8'});
const js=bundle.outputFiles[0].text;
const css=`*{box-sizing:border-box}body{margin:0;background:#15232c;color:#ecf0e8;font:16px/1.6 system-ui,sans-serif}main{max-width:1050px;margin:auto;padding:22px}header{display:flex;justify-content:space-between;gap:12px;color:#9cbea9}h1{font-size:clamp(25px,4vw,40px);margin:24px 0 10px}.actions{display:flex;flex-wrap:wrap;gap:12px}button{min-height:44px;padding:10px 18px;border:1px solid #83b9a0;border-radius:6px;background:#26483d;color:#fff;font:inherit;cursor:pointer}button:disabled{opacity:.45;cursor:not-allowed}.actor{display:flex;gap:14px;padding:14px;margin-top:10px;background:#21323a;border:1px solid #42544e;border-radius:7px}.actor input{width:23px;height:23px;flex-shrink:0}.actor p{margin:4px 0}.actor small,.note{color:#aec1b6}#godot-stage{margin-top:16px}canvas{display:block;width:100%;height:auto;aspect-ratio:16/9}#host-status{color:#efd995}`;
const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>书海 · 宿主角色查看器</title><link rel="icon" href="data:,"><style>${css}</style></head><body><main id="booksea-host"></main><script>${js.replace(/<\/script/gi,'<\\/script')}\nBookseaHostViewer.mountHostViewer(document.getElementById('booksea-host'));<\/script></body></html>\n`;
const regex={id:'4d86db28-5c30-4115-af93-aa9d1cc8950e',scriptName:'书海-Godot宿主角色查看-0.5.0（只读）',findRegex:'/<booksea-host>查看<\\/booksea-host>/g',replaceString:'```html\n'+html+'\n```',trimStrings:[],placement:[2],disabled:false,markdownOnly:true,promptOnly:false,runOnEdit:true,substituteRegex:0,minDepth:null,maxDepth:null};
const files={'booksea-host.html':html,'booksea-host.iife.js':js,'书海-Godot宿主角色查看正则.json':JSON.stringify(regex,null,2)+'\n'};
const sha256={};for(const [path,content] of Object.entries(files)){await writeFile('release/'+path,content);sha256[path]=createHash('sha256').update(content).digest('hex');}
await writeFile('release/host-manifest.json',JSON.stringify({version:'0.5.0-host-view',kind:'readonly-host-viewer-not-game',resourceBase:'/booksea-godot-host/',modelCalls:false,hostWrites:false,sha256},null,2)+'\n');
console.log('Built same-page Godot host viewer and separate importable regex. No implicit host calls.');
