// The reader JSON owns a >700 KB single line, beyond the MCP patch limit.
// Pure bounded transformation, SHA-pinned first install, atomic replacement, no other reference edits.
import {readFile,writeFile,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const changes=[["function dlbBodyEggs(){", "function dlbEnterBooksea(){\nvar message=\"进入普罗泰利西翁\";\ntry{\n if(!pD||!pW){pToast('请在酒馆聊天中打开书海入口');return;}\n if(pW.__bookseaReaderSending)return;\n var ta=pD.querySelector('#send_textarea'),send=pD.querySelector('#send_but');\n if(!ta||!send){pToast('未找到酒馆输入框或发送按钮；请更新酒馆后重试');return;}\n if((ta.value||'').trim()&&(ta.value||'').trim()!==message){pToast('输入框已有草稿，请先发送或保存草稿，再点击书海入口');ta.focus();return;}\n var context=pW.SillyTavern&&pW.SillyTavern.getContext?pW.SillyTavern.getContext():null;\n if(context&&context.onlineStatus==='no_connection'){pToast('请先连接酒馆模型，再打开书海');return;}\n var stop=pD.querySelector('#mes_stop');\n if(send.disabled||send.getAttribute('aria-disabled')==='true'||(stop&&pW.getComputedStyle(stop).display!=='none')){pToast('正在生成或发送不可用，请等当前回复完成');return;}\n pW.__bookseaReaderSending=true;\n pW.setTimeout(function(){pW.__bookseaReaderSending=false;},1800);\n ta.value=message;ta.dispatchEvent(new pW.Event('input',{bubbles:true}));ta.dispatchEvent(new pW.Event('change',{bubbles:true}));ta.focus();\n closeDreamLobby();send.click();\n}catch(error){if(pW)pW.__bookseaReaderSending=false;pToast('书海指令未发送，请检查酒馆；已填写的指令可手动发送');}\n}\nfunction dlbBodyEggs(){"], ["var h='<div class=\"dlb-sub-h\">小开关<i>TOGGLES</i></div>';", "var h='';\nh+='<div class=\"dlb-sub-h\">书海迷宫<i>BOOKSEA</i></div><button type=\"button\" class=\"dlb-row\" data-dlb=\"eggbooksea\" style=\"width:100%;text-align:left;background:transparent;color:inherit;font:inherit;cursor:pointer\"><div class=\"ic\">'+dlbSvg('tuning')+'</div><div class=\"tx\"><div class=\"nm\">进入普罗泰利西翁<em>BOOKSEA</em></div><div class=\"ds\">发送固定入场指令 · 等待场景描写后打开迷宫；请先保存输入框草稿</div></div><div class=\"rt\"><span class=\"sv2\">进入</span></div></button>';\nh+='<div class=\"dlb-sub-h\">小开关<i>TOGGLES</i></div>';"], ["if(act==='eggdisplay'){toggleDisplayMode(e);dlbSyncEggs();return;}", "if(act==='eggbooksea'){dlbEnterBooksea();return;}\nif(act==='eggdisplay'){toggleDisplayMode(e);dlbSyncEggs();return;}"]];
export function integrateReader(raw){
 const before=JSON.parse(raw),html=before.replaceString;
 let result=html;
 if(html.includes('function dlbEnterBooksea(){')){
  if(html.includes(changes[0][1]))return raw;
  const start=html.indexOf('function dlbEnterBooksea(){'),end=html.indexOf('function dlbBodyEggs(){',start),current=html.slice(start,end),expected=changes[0][1].slice(0,-'function dlbBodyEggs(){'.length);
  const line=current.match(/^var message=(.+);$/m);
  if(!line)throw Error('Unknown reader entry declaration');
  const old=JSON.parse(line[1]);
  if(!old.startsWith('【书海·入口】')||!old.includes('普罗泰利西翁')||current.replace(line[0],'var message="进入普罗泰利西翁";')!==expected)throw Error('Reader entry was edited; review before replacing');
  result=html.slice(0,start)+expected+html.slice(end);
 }else for(const [from,to]of changes){if(result.split(from).length!==2)throw Error('Ambiguous reader anchor: '+from.slice(0,60));result=result.replace(from,to);}
 result=result.replaceAll('9 项 · 进入彩蛋页','10 项 · 进入彩蛋页').replaceAll('共 9 项 · 即开即用','共 10 项 · 即开即用');
 const lines=raw.split('\n'),i=lines.findIndex(line=>line.trimStart().startsWith('"replaceString":'));
 if(i<0)throw Error('Missing replaceString line');
 lines[i]='  "replaceString": '+JSON.stringify(result)+','+(lines[i].endsWith('\r')?'\r':'');
 const output=lines.join('\n'),after=JSON.parse(output);
 for(const key of Object.keys(before))if(key!=='replaceString'&&JSON.stringify(before[key])!==JSON.stringify(after[key]))throw Error('Unexpected metadata change: '+key);
 return output;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const target=new URL('../../02-宿主参考-只读/读者对话渲染0917 (new).json',import.meta.url);
 const raw=await readFile(target,'utf8'),next=integrateReader(raw);
 if(next!==raw){
  if(!['60bb046ac6a906e03f7163b23b82f888788fc2b1df30cbfba6a93d784bbbe9ab','ee05ae0e0e47832c4f833d32d5d81f5e834930ea8cff2bf96db24be6046bdb56'].includes(createHash('sha256').update(raw).digest('hex')))throw Error('Reader source changed; reread and explicitly review before installation');
  const temp=new URL(target.href+'.booksea-tmp');await writeFile(temp,next,'utf8');await rename(temp,target);
 }
 console.log('NEW_READER_INTEGRATED',createHash('sha256').update(next).digest('hex'));
}
