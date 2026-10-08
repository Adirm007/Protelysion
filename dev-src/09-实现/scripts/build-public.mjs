// Explicit allowlist: a complete playable game release, never the workspace, secrets or chats.
import {mkdir,readFile,writeFile,copyFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {build} from 'esbuild';
import {makeExternalRegex,makeExternalHtml,makeLocalRegex} from './public-loader.mjs';
import {currentReaderCore} from './reader-handoff.mjs';
const project=fileURLToPath(new URL('../../',import.meta.url));
const root=path.join(project,'22-发布'),repo=path.join(root,'booksea-github'),site=path.join(repo,'site'),imports=path.join(root,'本地导入');
const play=path.join(project,'16-Godot可玩区域/web'),host=path.join(project,'17-宿主可玩联调/web');
const base=process.argv.find(a=>a.startsWith('--base='))?.slice(7)??'https://adirm007.github.io/Protelysion/';
const revision='protelysion-0.41.1-20261008-guard-setup-fix';
const sha=data=>createHash('sha256').update(data).digest('hex');
const manifest=JSON.parse(await readFile(path.join(project,'16-Godot可玩区域/verification/web-manifest.json'),'utf8'));
const template=JSON.parse(await readFile(path.join(project,'17-宿主可玩联调/entry-template.json'),'utf8'));
const hostHtml=await readFile(path.join(host,'index.html'),'utf8'),css=hostHtml.match(/<style>([\s\S]*?)<\/style>/)[1];
await Promise.all([mkdir(site,{recursive:true}),mkdir(imports,{recursive:true}),mkdir(path.join(repo,'install'),{recursive:true}),mkdir(path.join(repo,'.github/workflows'),{recursive:true})]);
const files={},pckParts=[],wasmParts=[];let previous;try{previous=JSON.parse(await readFile(path.join(site,'release-manifest.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
async function put(relative,data){
 if(Buffer.byteLength(data)>=100*1024*1024)throw Error('GitHub single-file limit: '+relative);
 const dest=path.join(site,relative);await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,data);files[relative]={bytes:Buffer.byteLength(data),sha256:sha(data)};
}
for(const [name,info]of Object.entries(manifest.files)){
 const data=await readFile(path.join(play,name));if(sha(data)!==info.sha256)throw Error('Stale build: '+name);
 if(name==='game.pck'||name==='game.wasm'){
  const parts=name==='game.pck'?pckParts:wasmParts,stem=name;
  const compressed=gzipSync(data,{level:9});if(sha(gunzipSync(compressed))!==info.sha256)throw Error('PCK compression verification failed');
  for(let offset=0;offset<compressed.length;offset+=16*1024*1024){const name=stem+'.gz.'+String(parts.length+1).padStart(3,'0');await put(name,compressed.subarray(offset,offset+16*1024*1024));parts.push(name);}
 }else if(!['index.html','play.js'].includes(name))await put(name,data);
}
const bundle=await build({entryPoints:[path.join(project,'09-实现/src/distribution/entry.ts')],bundle:true,format:'iife',globalName:'BookseaDistribution',target:'es2022',charset:'utf8',write:false,minify:true,legalComments:'eof',metafile:true});
await put('distribution.js',bundle.outputFiles[0].text);
const audioRoot=path.join(project,'21-音频制作/assets'),audioRaw=await readFile(path.join(audioRoot,'audio-manifest.json')),audio=JSON.parse(audioRaw);
const audioFiles=new Map();for(const item of [...Object.values(audio.music),...Object.values(audio.sfx)])for(const rel of Object.values(item.files)){
 if(!/^(music|sfx)\//.test(rel)||rel.split('/').includes('..'))throw Error('Invalid audio path');audioFiles.set(rel,item.sha256[rel]);
}
for(const [rel,expected]of audioFiles){const data=await readFile(path.join(audioRoot,rel));if(sha(data)!==expected)throw Error('Audio SHA mismatch: '+rel);await put('audio/'+rel,data);}
await put('audio/audio-manifest.json',audioRaw);await put('audio/CREDITS.txt',await readFile(path.join(audioRoot,'CREDITS.txt')));
const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const license=await readFile(path.join(root,'licenses/CC-BY-NC-4.0.txt'),'utf8');
const notice=`普罗泰利西翁（Protelysion）·《书海》迷宫\nCopyright (c) 2026 Adirm007\n原作链接：https://github.com/Adirm007/Protelysion\n\n原创游戏内容及本项目原创代码：Creative Commons Attribution-NonCommercial 4.0 International（CC BY-NC 4.0）。允许非商业使用及改编，须署名原作和作者、附许可链接并说明修改；禁止未经另行许可的商业使用。\nhttps://creativecommons.org/licenses/by-nc/4.0/\n推荐署名：基于 Adirm007《普罗泰利西翁（书海迷宫）》修改，原作见上述仓库；修改内容：……。\n\n重要排除：此授权仅覆盖权利由本项目作者持有的原创部分。第三方音乐、少女素材、音效、字体、引擎、库及宿主来源内容分别受其原许可约束，不因本项目许可变为CC BY-NC，也不授予本项目未拥有的权利。本游戏是非商业可修改项目，不声称属于OSI意义的开源软件。\n\n界面夜梦立绘、头像和咖啡馆背景：来自Adirm007提供的读者正则。作者于2026-09-22明确授权任意取用；本项目压缩为WebP并随程序内嵌。图源：\nhttps://img.baibai.cv/f/yeV2Fj/22-54-15-3016377526.png\nhttps://img.baibai.cv/f/WrevH4/%E9%BB%98%E8%AE%A4.png\nhttps://img.baibai.cv/f/56AzHz/cafe_bg.png\n\n默认行走精灵：用户提供的 chibi_sprite_4dir_fixed.png，经裁剪、抠图与脚底对齐后随运行包使用。不冒称Pipoya素材，不从项目代码许可推导原图版权或授权；处理记录见Player-CREDITS.txt。\n补给员原图由用户于2026-09-23随需求提供，像素精灵由该图辅助生成并处理；用户于2026-09-24确认v3形象并授权随本版本推送仓库；不声称拥有原图或角色版权，不由本项目代码许可授予额外素材版权。详见Supplier-CREDITS.txt。\nNapi / M-ART：https://mart.kitunebi.com/；允许作为游戏素材使用，不放弃著作权，禁止独立原声/音乐素材库再分发。本仓库是可运行的完整游戏，不是音乐素材库。\nKenney：原有音效与短jingle，CC0 1.0。新增RPG音效：rubberduck、artisticdude、bart（CC0）；Iwan qubodup Gabovitch（CC BY 3.0）；纸笔书写录音：johannesschmidt（CC BY 4.0）。已作裁剪、单声道转换、响度校准与短淡化。逐项作者、原页面、许可链接及修改见audio/CREDITS.txt和audio/audio-manifest.json，不并入项目代码许可。\nGodot及其第三方库：见site/Godot-LICENSES.txt。Noto Sans SC：见site/NotoSansSC-OFL.txt。\n音乐逐曲信息见site/audio/audio-manifest.json；少女详细加工与许可见site/Player-CREDITS.txt。\n`;
await writeFile(path.join(repo,'LICENSE'),license);await writeFile(path.join(repo,'NOTICE.md'),notice);await put('LICENSE-CC-BY-NC-4.0.txt',license);await put('NOTICE.txt',notice);
await put('M-ART-terms.txt',await readFile(path.join(root,'licenses/M-ART-terms.txt')));
await put('credits.html','<!doctype html><meta charset="utf-8"><title>普罗泰利西翁 · 许可与署名</title><style>body{max-width:850px;margin:40px auto;padding:20px;font:16px/1.8 system-ui;background:#191c2b;color:#eee}a{color:#d9cba7}pre{white-space:pre-wrap}</style><h1>普罗泰利西翁 · 许可与署名</h1><pre>'+escape(notice)+'</pre><pre>'+escape(await readFile(path.join(audioRoot,'CREDITS.txt'),'utf8'))+'</pre><p><a href="LICENSE-CC-BY-NC-4.0.txt">原创部分CC BY-NC 4.0</a> · <a href="Godot-LICENSES.txt">Godot许可</a> · <a href="NotoSansSC-OFL.txt">字体OFL</a> · <a href="Player-CREDITS.txt">行走精灵说明</a> · <a href="M-ART-terms.txt">M-ART官方规则记录</a></p>');
const generator=(await readFile(new URL('public-loader.mjs',import.meta.url),'utf8')).replaceAll('export function ','function ');
await put('loader.html','<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>普罗泰利西翁 · 安装</title><style>body{max-width:820px;margin:40px auto;padding:20px;font:17px/1.8 system-ui;background:#191c2b;color:#eee}button,input{font:inherit;padding:12px;max-width:100%}input{width:95%}a{color:#dbc494}</style><h1>普罗泰利西翁 · 单正则安装</h1><p>先更新两个带new的读者文件；保留现有酒馆助手、MVU与EJS扩展。迷宫本体只需下面这一条书海正则，不需要另装游戏脚本。</p><label>外链目录 <input id="base"></label><p><button id="download">下载《书海》外链加载正则</button></p><p id="status" role="status"></p><p><a href="./">独立试玩（不读写宿主）</a> · <a href="credits.html">许可与署名</a> · <a href="https://github.com/Adirm007/Protelysion/tree/main/install">更新后的读者文件</a></p><script>'+generator.replace(/<\/script/gi,'<\\/script')+'\nconst template='+JSON.stringify(template)+',css='+JSON.stringify(css)+';document.getElementById("base").value=new URL("./",location.href).href;document.getElementById("download").onclick=()=>{try{const item=makeExternalRegex(document.getElementById("base").value,template,css),blob=new Blob([JSON.stringify(item,null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="普罗泰利西翁-书海外链加载正则.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);document.getElementById("status").textContent="已生成，请在酒馆导入。匹配书海标签的游戏正则只启用一份。";}catch(e){document.getElementById("status").textContent=e.message;}};<\/script></html>');
await put('index.html',makeExternalHtml(base,css,'standalone'));await put('.nojekyll','');
const publicManifest={revision,scope:{themes:48,species:433,tierTemplates:3031,themeSpecies:432,commonSpecies:1},player:{provider:'user-supplied',asset:'chibi_sprite_4dir_fixed.png',cell:[192,304],framesPerDirection:4,mapActors:1},pck:manifest.files['game.pck'],pckParts,wasm:manifest.files['game.wasm'],wasmParts,files};
const manifestData=JSON.stringify(publicManifest,null,2)+'\n';await writeFile(path.join(site,'release-manifest.json'),manifestData);
// Runtime uses verified compressed chunks directly. No raw >100 MiB file or LFS is needed anywhere in Git.
await mkdir(path.join(repo,'tools'),{recursive:true});
await writeFile(path.join(repo,'tools/materialize.py'),`import gzip,hashlib,json,pathlib,sys
root=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else pathlib.Path(__file__).resolve().parents[1]/'site'
m=json.loads((root/'release-manifest.json').read_text(encoding='utf-8'))
for name,entry in m['files'].items():
 p=root/name
 if len(p.read_bytes())!=entry['bytes'] or hashlib.sha256(p.read_bytes()).hexdigest()!=entry['sha256']:raise SystemExit('Corrupt file: '+name)
for kind in ['pck','wasm']:
 payload=gzip.decompress(b''.join((root/name).read_bytes() for name in m[kind+'Parts']))
 if len(payload)!=m[kind]['bytes'] or hashlib.sha256(payload).hexdigest()!=m[kind]['sha256']:raise SystemExit('Corrupt '+kind)
 if '--raw' in sys.argv:(root/('game.'+kind)).write_bytes(payload)
print('Verified 48-theme game distribution. Compressed chunks are loaded and cached by the browser.')
`);
await writeFile(path.join(repo,'.github/workflows/pages.yml'),`name: Publish Protelysion
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: protelysion-pages
  cancel-in-progress: true
jobs:
  deploy:
    environment:
      name: github-pages
      url: \${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - name: Verify every asset and complete Godot package
        run: python tools/materialize.py
      - uses: actions/upload-pages-artifact@v3
        with:
          path: site
      - name: Deploy
        id: deployment
        uses: actions/deploy-pages@v4
`);
await writeFile(path.join(repo,'.gitignore'),'site/game.pck\nsite/game.wasm\n*.tmp\n.DS_Store\n');await writeFile(path.join(repo,'.gitattributes'),'game.pck.gz.* binary\n*.wasm binary\n*.ogg binary\n*.mp3 binary\n*.wav binary\n');
const instructions=`# 普罗泰利西翁（Protelysion）·《书海》迷宫

**版本：0.41.1 · 2026-10-08 守关敌群遭遇未展开修复**

原作：**Adirm007**。48主题、432种常规怪物＋1种通用宝箱怪（共433种）、3031份七生命层级模板；随机地图、场景、少女行走图、怪物立绘、BGM与音效均已接入运行包。

## 游玩 / 安装

- 独立试玩：https://adirm007.github.io/Protelysion/ （不会读写宿主，不调用LLM）
- 单正则安装：https://adirm007.github.io/Protelysion/loader.html
- \`install/\`：已更新的读者正则、读者核心和书海外链正则。必须已有酒馆助手、MVU及EJS提示词模板扩展。

1. 导入\`读者对话渲染0917 (new).json\`，替换/停用原读者正则，不同时启用两版。
2. 将当前世界书的读者核心条目内容替换为\`读者核心本体 (new).txt\`，保留原条目设置并启用。此核心已包含书海进/出场条件，不再同时启用旧的独立书海交接条目。TXT是可直接粘贴的多行EJS；原核心中字符串或正则的合法反斜杠转义需原样保留。
3. 导入\`普罗泰利西翁-书海外链加载正则.json\`，匹配书海占位标签的正则只启用这一份。
4. **读者大厅 → 彩蛋设置 → 进入普罗泰利西翁**。有草稿时先保存；按钮只填入并发送“进入普罗泰利西翁”。也可自行写过渡剧情：沿用原读者膝枕模块的matchChatMessages方法匹配用户输入，只要包含“进入普罗泰利西翁”就触发，前后可自由加文字或换行。触发后的EJS负责场景和入口标签，正则随即加载游戏。离场时用户消息同样仅为“离开普罗泰利西翁”，结算事实和防重复标识通过消息元数据交接。
5. 首次选择“完整下载”或“轻装启程”；之后直接进入书间。完整模式预先保存全部音频，轻装模式在首次播放时下载音频。
6. 勾选1—4名同行者，点击“整备队伍”；每张角色卡上的“角色详情”可查看实际属性、技能、费用和转换结果。也可直接“进入书海”，程序会先整备尚未就绪的成员。旧远征保留原快照，不清空角色或聊天。

## 0.41.1 守关敌群遭遇未展开修复

- 遭遇未能展开、退回原地后，这只怪会被「刷新」：清掉残留血量与追击状态并换一个随机种子，下次碰到会重新建立战斗，通常就能正常开打。
- 同一只怪连续两次无法展开时：守关敌群视为已突破（无奖励），楼梯放行，不会再卡在「先处理守关敌群」；普通敌群从地图上消失。

## 0.41.0 商店总 FP、学习装置与补给员自由交易

- 商店与补给员（含「对话」交易）可直接使用宿主的总 FP：先扣本局待结算 FP，不够再扣总 FP，离场结算时一次性扣除。
- 新遗物「学习装置」：3000 FP，每局限购 1 件，离场时把经验分给全队。
- 每位补给员额外出售一件不同的随机遗物，价格随品质与层数变化。
- 补给员的强度与价格参考改为「作者给她的建议」：她很自我，心情才是第一准则，可以开低价、送东西或给出更强的货；程序只保留绝对上限（建议品质再高两档，最高神话）和每次遭遇的额度。

## 0.40.2 开场清场卡死修复

- 靠「战斗开始时造成伤害」等开场效果在选择行动前就击倒全部敌人时，现在直接结算胜利并回到探索，不再卡在敌人 0 血、没有敌我单位的「战斗开始」画面。
- 开场连锁效果出错不再让战斗建立失败；建立战斗中途出错时整体退回遭遇前，不会写出坏档。
- 已经卡住的旧存档：读档后自动退回遭遇前的位置继续探索。

## 0.40.1 手机端对话与正文面板布局修复

- 补给员「对话」：对话记录不再被左上角的关闭按钮和「补给员」名牌压住；手机横屏时对话区让到关闭按钮右侧；弹出键盘后可见区域很矮时，下方对话框自动收起，她最新的一句改在记录区显示，键盘弹出/收起时记录区保持贴着最新消息。
- 触屏设备上对话输入框为 16px（iOS 聚焦时不再整页放大），键盘回车键显示为“发送”。
- 正文模式面板按内容收紧，不再固定撑到 560px 高；窄屏边距调小。
- 读者正则「独立API」等弹窗在电脑上拉不到底的问题已在读者外链版修复，见 https://github.com/Adirm007/reader 。

## 0.40.0 补给员对话与正文模式

- 补给员事件新增「对话」（在酒馆中游玩时出现）：可以和她聊天、撒娇、哭穷，请她生成遗物、道具、临时事件或能带出书海的战利品；给不给、要多少 FP 全看她的心情。程序按“稳健”上限把关：强度最多比本层战利品品质高一档；每次遇到她最多 1 件遗物、2 件道具、1 个临时事件、1 件可带出战利品；价格不低于同档下限（道具不低于商店同效价），FP 不够就谈不成；只开放有上限的数值效果，不会生成无敌、免疫或复活类循环。可带出战利品成功离开迷宫后进入主角背包，由正文演绎。
- 新增「正文模式」：迷宫中打开手记，点“正文模式”后进度缓存，以用户身份发送“普罗泰利西翁正文模式”，正文从断点继续；正文末尾的面板可以随时选择迷宫模式（沿用缓存的队伍状态，层数用正文推进到的层数）、进入下一层（以正文方式深入）或离开迷宫（结算缓存存档所得、结束本趟）。正文模式期间迷宫资料常驻，本层主题、场景与敌怪资料自动触发，补给员、宝箱怪、「?」不会出现。需要读者核心 v2026.10.07.5 或更新（读者正则会提示更新世界书）。
- 读者「独立API」支持多套方案与按调用类型分别设置；书海的技能整备、补给员对话分别读取各自的方案，未设置时沿用酒馆当前连接。

## 0.39.0 强控目标、共享背包与死亡不掉落

- 被魅惑等强控的敌人不必等效果结束才能打：单体攻击可以选任意单体（被控制的敌人、友方均可，不含自己）；群体攻击也会命中被暂时魅惑过去的敌方单位，不会打到真正的队友。
- 迷宫内背包改为全队共享：同行成员携带的道具，队伍里任何人都能在战斗中使用，数量共用。
- 「?」不再“检定自动成功”；满足刷新条件时的刷新率由 50% 降为 33%。
- 商店新增「死亡不掉落」（3000 FP，每趟限购一次）：本趟全灭仍会败退离场，但经验、盲盒、素材与 FP 全部保留结算。
- 读者「彩蛋设置 → 独立API」启用后，书海的角色编译等请求同样改走该 OpenAI 兼容端点；未设置时沿用酒馆当前连接。读者正则的最新外链版与相册见 https://github.com/Adirm007/reader 。

## 0.38.0 战斗规则重构

- 0.38.2：治疗量照原文：原版写固定数值的治疗（“恢复300HP”“每回合恢复200点生命”）编译后就是这个固定值，只有原版写了百分比才编成百分比；持续恢复同样支持固定值。旧存档里被编成低百分比的治疗，重新整备时自动重编；连不上模型时也会按原文固定值修好。迷宫里遗物与事件增减五维时，HP/MP/SP上限按宿主卡世界书公式随之变化（HP=体×100×HP乘数+五维总和，MP=(智+精)×50×MP/SP乘数，SP=(力+敏)×50×MP/SP乘数，乘数按生命层级）；战斗中技能的增减益不改上限。
- 0.38.1：修复目标选择：增益技能与增益道具（正面状态、净化、承伤降低等）不再被当成攻击而只能选敌人；纯辅助的治疗/护盾/增益默认可选己方任一成员（含自己），原文写明“自身”的仍只作用于自己，格挡/闪避/免死等姿态默认自身；道具用在谁身上就作用于谁。新增“敌我两用”：同一技能可选敌人或同伴，按所选目标的阵营只发动对应部分（如调配药剂：对敌人自动取其抗性最弱的属性攻击，对同伴回复其最缺的生命/法力/体力）。旧缓存中“选敌人、效果却只作用于同伴”的死效果在开战时按结构修复；点击“重新整备”时，旧版本编出且可能受影响的条目会交给模型重编，模型不可用时保留修复后的旧结果。
- 0.38.0：角色能力改由“能力蓝图”编译：模型只描述高层能力，数值与效果由程序换算，几乎不再落到通用替代技能。等级优先：秒杀/斩杀、免疫一切、必定无效、交换生命只对等级更低的对手生效。让对手动不了的控制（眩晕、封印全部、推条、打断、取消行动、恐惧、魅惑、敌对隔离、回溯行动条等）可以挣脱，同一来源要等对方自己行动一次才能再控（沉默、缴械这类单项控制叠加时同样如此），必定生效只对等级更低的对手；待机与防御永远不会被封。保命效果（锁血、免死、不死、倒地复活、回溯复活）每场最多发动“生命层级”次。不存在任何情况下都完美无缺的无敌技能组：面对等级不低于自己的对手，完全抵消伤害（免疫、100%格挡、承伤归零、不可选中、隐身、隔离等）每场最多维持“生命层级”个回合，之后每次至少承受原始伤害的20%；一切伤害都被减免到80%以上时按80%计；把伤害反弹或转移给对手、真实反射、伤害转治疗、能力抗性、几个单通道格挡拼成的全覆盖、按次数抵挡的护盾、把伤害转成自己免疫的类型，都按同一条规则计。对等级不低于施加者的单位，敌方强加的减速、延长后摇和加税最多让行动频率减半，零消耗的行动与待机/防御始终可用；把对手的伤害削到零同样按完全抵消计。单一属性的免疫与抗性、对等级更低对手的效果不受影响；迷宫遗物不在此列。

## 0.37.0 八方旅人式界面重制

- 0.37.7：返程只剩两条路：「间章:小憩」（战斗中下下回合全员撤退；探索中在队伍页使用，全员返程），以及每层入口（进层时站的位置，互动后确认返程）。菜单里的撤退结算、返回书间与各成员的离队返回全部移除，书间去掉「上次旅程」。全屏按钮常驻右上角书本图标下方，打开任何面板时移到面板关闭键旁。修复小窗（窄且矮）时旅途手记栅格错位、页签被挤出、找不到设置的问题。
- 0.37.6：「?」的初始刷新距离从 9 格改为 18 格（遗物无字书签相应改为 36 格）。暧昧的线可以跨趟累计，集满九根可在迷宫里合成「银十字」：战斗中队伍不足四人时召来「?」助战（每趟一次），探索中举起后不再遭遇「?」，放下即恢复。主角的「间章:小憩」改为固定编译：战斗中使用后，下下回合开始时我方所有存活成员必定撤离，不会被打断或失败。离场交接写明每名成员在哪一层、被谁击倒，以及最后一战败给了谁，并附上相关敌怪资料。
- 0.37.5：组队卡片有头像时只显示头像，没有头像才显示名字首字；首页文案不再显示 user 占位符，改为「向你和命定之人开放的训练场」；室内场景的下层门不再贴着墙放，门后留两格、门前和两侧各留一格空地，门不会再被墙挡住一半。
- 0.37.4：三套加载动画（书库 / 童话立体书 / 提线木偶剧场）整体重制：AI 分层插画加灯光、粒子与视差；提线木偶拆为十个关节部件，随提线起舞；幕布开合换景；字幕改为八方旅人式横幅。动画仍只用合成器属性，生成楼层时不会冻结。
- 0.37.3：选「长椅」时不再弹任何提示；走到长椅旁显示「椅子可以坐」，互动一次全队完全恢复，长椅随即消失。同时删掉了游戏内一批说明文式提示（补给员选事件/杀害、长椅休息、宝箱怪、逃跑、传唤铃等），只保留简短结果。
- 0.37.2：补给员选「长椅」不再当场回复——补给员消失，原地留下一张长椅；再次与长椅互动才全队完全恢复（生命、法力、体力回满并清除负面状态，遗物类整局状态保留），每张长椅只能用一次。
- 0.37.1：补给员选项在任何窗口尺寸下都停在「补给员」名牌上方（矮窗口自动收紧间距）；商店的长列表改为在选项区内滚动，键盘上下选择会自动滚到可见位置，不再盖住对话框。
- 游戏内界面整体换成深蓝底、金色细线、四角花饰、衬线标题：标题画面、探索地点牌、旅途手记（竖排标签＋队伍 HP/MP/SP 条、行囊与遗物格子）、事件、远征结算、警告框。
- 战斗只换配色与边框，站位、尺寸与排列不变。
- 书间大厅、资源准备、同行者档案与设置弹窗同步换装；夜梦新立绘与标题主视觉。
- 夜梦头像跟随读者正则「眼中的她」当前形象（13 套头像外链，自定义人格优先用其头像链接）；读不到或外链失败时用内置头像。只读，不写回。
- 补给员对话沿用原布局；选项「长椅（全队完全恢复）」改为「长椅」，效果不变。
- 移除「返回浅层」。

## 0.36.0 遗物与事件系统重制：拿了就有感觉

- 0.36.3：T16 主题「虚海终章」更名为「无名夹缝」（地图、怪物图鉴、战斗曲目标注同步；机制、怪物、存档不变）。
- 0.36.2：「?」刷出时屏幕弹出“有什么在接近…”（无立绘、无发言人），点掉之前她和你都不能动、探索时钟不走——不会再在加载动画期间被她贴脸；她的面板改为“队伍最高等级 +1”这一等级的常规怪物面板，不再随被复制者放大。
- 0.36.1：为回响之弦 / 血税印 / 空腹与满腹护身符 / 复读机 / 惰性齿轮 / 白纸 / 忍耐之环 / 棱镜 / 破戒补齐了 10 条规则原语，全部按设计原文生效；遗物规则不再参加“等级>速度>随机”的裁决，免疫就是免疫。
- 60 条声明式遗物 + 39 条事件 = 99 条，全部重写。遗物默认只作用于持有者，涉及 FP / 宝箱 / 遇敌 / 掉率 / 楼层规则 / 来访者的为全队，少数为敌我全场；每名角色可持有数 = 生命层级；遗物页可把遗物交给队友或丢弃（带“不可转移 / 不可丢弃”词条的除外）。
- 遗物效果分两侧：战斗侧（速度 ×2 攻击 ×0.5、开幕号角首个伤害技能 ×2、盾墙誓约前两次只能防御、荆棘之心等量反射且战中不回血、命中之眼全场必中、赌徒硬币暴击 +100% 被暴击 +100%……）与跑段侧（寻宝罗盘 +3% 宝箱但每层须打 3 场、采集者之袋掉率 ×2、赞助契约 FP +20%、预支借据先拿 6000 再每层 −1000 可欠账、奇偶天平奇场 ×1.3 偶场 ×0.7、群狼哨普通敌群 3–4 个、无字书签让「?」每 4 步走 1 步……）。
- 事件只经补给员接触：清仓、采集运势、转变、翻倍或减半、错位楼梯（±50 层不越百位段）、有偿疗愈、遭遇即遗物（普通 ×4 / 精英 ×2 / Boss ×1）、传唤铃、高压训练、封印契约（选人选技能，每封一个 +10% 全属性）、黑市、竞技场、空椅子、命运卡、尽头的门（50 层以深可直接结算 ×1.2）……
- 补给员四选一：事件 / 长椅（留下长椅，再次互动全队完全恢复）/ 商店（红蓝黄三色药剂、三色药剂、六种附魔药、解毒药、烟雾弹，用待结算 FP 购买，战斗中作为指令使用）/ 杀害（补给员消失留下血迹，旁边刷出宝箱，下一次个位 9 楼层「?」必定出现）。
- 待结算 FP 现在是真账本：可扣、可翻倍减半、可欠账（之后的收入先还）。

## 0.35.0 特殊单位「?」

- 0.35.3：修正复制判定误报——中毒 / 燃烧这类状态的持续伤害在引擎里走真实通道，遗物与道具的效果也曾被算进“持有真伤技能”，导致没有百分比 / 真伤技能的队伍也被整队复制。现在只看角色自己技能直接造成的伤害；遗物 / 道具 / 系统指令既不参与判定也不被复制。队伍里没人持有这两类技能时，她只会投掷飞刀。
- 0.35.2：修正追击方式——她按玩家的跑步步频（每 160ms 一格）沿最短路径自主追击，**玩家站着不动她也会追过来**；不再是“玩家走一步她走一步”。
- 0.35.1：她在战斗中会实时镜像玩家单位新获得的技能（只要那名单位持有百分比 / 真实伤害技能）；超立方入库（T44）期间被隔离者的状态计时暂停，出库后照常，与定稿一致。
- 进入个位数为 9 的楼层（9、19、49、79、109……）时 50% 概率出现在你最短路径 9 格外，此后你每走一步她沿最短路径追一步（与你同速，不受隐匿影响）；离开迷宫或换层即可摆脱。被追上开战后普通逃跑成功率为零，只有间章等专门离场技能能脱身。
- 面板比队伍中最高等级成员高 1 级。无属性与精神属性攻击对她无效；**百分比伤害全额反转为她的治疗，真实伤害在任何减免之前原样弹回攻击者**（一千万真实伤害打过去就是一千万弹回来）；敌方无法在她身上留下任何效果（状态 / 修正 / 护盾 / 速度）；一切检定对她默认成功。
- 技能组：她复制队伍里**所有持有百分比伤害或真实伤害技能的成员**的全部主动与被动技能（资源与五维不低于被复制者），并按威力与局势选用；没人持有这两类技能时，她只会投掷飞刀。
- 击败必掉一个符合其等级的盲盒与经验；小概率掉落专属神话级消耗品「暧昧的线」——可以转为任何想要的素材，也许就连源质也……（尚未成型、排布成字的笔画，因此也有成为任何名作的可能性）。
- 专属战斗曲：M-ART「To Everything There Is a Season」；用户提供的战斗立绘与三帧四向行走图已接入（地图上她是真正会走的单位，不是漂浮书页）。

## 0.34.0 补齐规则原语，48 条主题专属与 G 系全部按定稿还原

- 执行器新增原语：公式 mod 运算与公共轮读取（“第 5/10/15 轮”真的按轮数走）；状态与规则可“按累计伤害解除”（北辰熄灭要挨够一记 10% 才换人、瓶海收藏打掉它 25% 才放人）；目标筛选新增“行动条最高”“攻击最高”（零式引力、空冠加冕）；行动条整体轮转（墓园旋转）与推条退条倍率（低重力 ×3）；两名目标互换位置与全部状态（零房拓扑）；隔离可被解除（空轿碎裂即回来）；掷骰可带权重（万芯神谕六面）；效果承受者可改为全场随机（无始发站含己方）；护盾获得事件（总单归属复制同值护盾）；四条新规则：草稿/定稿（未完树稿：每招首次 ×0.3 留线稿，落在线稿上 ×3 必中）、重复封印（永不毕业：同一招第 3 次即封，用新招解封）、空白页（无字著述：翻到那页作废本次行动）、增益/负面时长上限（永冬圣谕）、技能属性改写（彩噪）；承受暴击倍率（无名观测 ×2）。
- 按定稿还原：回声债真的两轮后回声；双生每 4 轮再分裂；万面替身把那一击原样转走；感染/花床/潮誓/末班广播/幕间等按状态标签精确点名；不落雨债、透明鲸梦、地心账本、白潮析命都用真实记账（记多少还多少、按存活人数均摊）；云层分割全队按半血分层；无人婚约只连两个人、一方倒下另一方变 1；蜂后的租金真的交给蜂后、租客越多蜂后越硬、满员双动。
- 界面：状态名自动带“（本次迷宫内）”与剩余轮数；失控单位头顶显示“⇄失控”、面板注明由敌方操控；公开计数（十三地基、雨债、账单、潮汐）直接显示在单位徽章上。
- 测试新增 10 项原语行为测试（含真实提交流程下的重复封印、空白页、草稿定稿）。

## 0.33.0 主题专属机制（后 24 个主题）：48 个主题全部就位

- T25 无星天文馆·北辰熄灭（熄灭一人的星，技能费用 ×3）、T26 蜂巢公寓·蜂后物业（蜂后每轮扫场并放租客，租客收租叠欠租）、T27 永久开学日·永不毕业（用得最多的技能被没收）、T28 无货超市·零库结算（最近技能下架并复制到自己货架）、T29 发光盐田·白潮析命（超过半血的部分被析成它的护盾）、T30 云上屠宰厂·云层分割（最厚血者承伤加深、最薄血者输出减半）、T31 雨伞沙漠·不落雨债（治疗记成雨债，残血时倾盆）、T32 瓶中群岛·瓶海收藏（击倒者装瓶不可复活）、T33 机械神社·万芯神谕（每轮公开掷骰）、T34 骨白游乐园·墓园旋转（全体行动条后退）、T35 梦境水族馆·透明鲸梦（限伤 + 每三轮醒来结账）、T36 黑日农场·黑日不落（每轮收割全体五维，本次迷宫内；十点丰收重击）、T37 极深钻井酒店·地心账本（每五轮结账）、T38 缝隙城堡·缝隙王权（连续攻击它的人下一击落空）、T39 折叠地铁·无始发站（技能坐过站打到自己）、T40 大潮钟表行·十三潮汐（计数到 13 处决全场，暴击催潮、挨打退潮）、T41 黑雪邮局·黑雪投递（三轮后送达 ×1.8 并把增益转为易伤）、T42 玻璃墓园·玻璃之躯（承伤 ×2，碎片等量反弹）、T43 蒸汽竹海·节节高（每轮长一节，重击砍三节）、T44 超立方仓储·超立方入库（入库隔离一轮，出库清空状态）、T45 无人的婚宴·无人婚约（全体 100% 连命）、T46 彩色噪声海·彩噪（随机改写抗性）、T47 低重力垃圾环·低重力（全场速度减半，它每轮漂前）、T48 无尽后台剧院·幕间（与生命最高的敌人互换血线百分比）。
- 至此敌人改造计划 v2 收口：11 个 F 系 + 12 个 G 系通用家族、7 条领域、48 条主题专属，全部经过无解墙检查；对玩家的影响不带出本次迷宫。

## 0.32.0 主题专属机制（前 24 个主题）：每个主题的 Boss 与精英都有一条只属于它的规则

- 只给 Boss（三阶起完全体）与精英（五阶起雏形，数值或频率减半），普通怪不拿；不占家族配额，但计入无解墙检查。
- T01 废墟末日·感染潜伏期（命中留潜伏，对潜伏者施疗即失控并传染）、T02 玄门山海·倒悬丹理（互换生命与法力）、T03 巫祭荒原·万面替身（致命伤转给别人）、T04 龙与王冠·空冠加冕（诅咒的王冠：戴冠者更强，但每次出手全队掉血）、T05 轨道失落·零式引力（行动条拉回 0）、T06 鬼城旧事·空轿迎亲（隔离进空轿）、T07 刀剑江湖·无归铸剑（偷技能并封原版，本次迷宫内有效）、T08 深渊观测·无名观测（被注视者暴击归零、承伤加深）、T09 午夜都市·零点管理（每五轮宵禁只剩指令）、T10 无尽客房·零房拓扑（状态正负翻转）、T11 齿轮黄昏·停钟工程（时停一轮封全体最近技能）、T12 冻土教堂·永冬圣谕（增益与自身负面都活不过一轮）、T13 血肉温室·永生花床（播种扎根，治疗流向它）、T14 沉没王庭·溺冠潮誓（水位上涨到没顶，暴击退潮）、T15 纸页天穹·无字著述（技能页涂白）、T16 无名夹缝·终章留白（每次见底都蓄力一轮，打不死就回满）、T17 倒灌机场·末班广播（三轮后不在登机口的人被甩下）、T18 无人高速服务区·无终旅程（每轮生命上限与伤害无上限增长）、T19 无限货运港·总单归属（护盾碎裂全场结账）、T20 永昼雪原旅馆·永昼退房（隐匿无效、每次回避闪避递减，本次迷宫内）、T21 倒置住宅群·十三地基（前十三次治疗变伤害、暴击变补药）、T22 铅笔森林·未完树稿（草稿 ×0.3、定稿 ×3 必中）、T23 巨人体内行政区·总务循环（全体生命链接）、T24 淹没的电影院·零场观众（每招叠观众，满座散场）。
- 后 24 个主题（T25–T48）随 0.33.0 发布（见上）。

## 0.31.0 十二个原创恶意家族：通用池从 11 扩到 23

- 新增通用原创家族 G1–G12，每条三档（雏形 / 完全体 / 去反制）：回声债（受到的伤害按 25% / 50% / 75% 回声打向攻击者）、贪食护盾（吞掉敌人护盾转为自身生命）、代价转嫁（敌方每用一次技能额外失去最大生命 15% / 25% / 35%，去反制档可致死）、逆位（反转敌人的数值型增益，去反制档新增益立即反转）、封印税（每轮封印敌人最近使用的技能，去反制档每被暴击一次再封全体）、拖延判决（伤害延迟 1–2 轮结算，×1.6 / ×2.4，去反制档无视护盾减伤并把增益转成易伤）、双生（30% 生命的分身，分身倒下时本体扣血 / 回血 / 再分裂）、恐惧点名（被点名者本轮打它就挨等量反伤，去反制档全队连坐一半）、饥渴（敌方治疗先给它护盾 → 一半改为治疗它 → 全部改为治疗它）、凝视（被凝视者施法时间加倍 → 行动后退条 30 → 用技能后失控 1 轮）、同归（倒下时对击杀者 / 全体造成最大生命 30% / 60% 并眩晕）、借命（生命低于 30% 时从最厚血的敌人处夺取其最大生命 30%，之后每轮再夺 20%，去反制档夺来的部分叠为自己的最大生命上限）。
- 数值铁律：所有百分比一律按最大生命计算、≥15% 起步、随层级线性增长；分配器配额不变，G 系雏形 t2–4 / 完全体 t4–6 / 去反制 t6–7，与 F 系同表；累进规则改为“新增项撞墙就让位、已继承项永远保留”，全库 3031 份模板没有任何一份硬解法封锁 ≥4。
- 迷宫内限定：敌方对玩家的“永久”效果（封技能、偷技能、失衡……）只活在本次迷宫内，退出 / 通关 / 团灭即清（新增回归测试）。
- 失控：新增控制类状态“失控”（charm），被魅惑的己方单位阵营临时反转，由怪物 AI 代打，优先用带伤害的技能打原队友，其次普攻。
- 契约扩展：uses 效果新增 selection（used_latest / used_random / most_used），按目标的使用记录挑技能封印 / 扣次数（指令类不在候选内）。
- 文案：怪物面板与技能描述不再写“对策”，只写它做了什么。

## 0.29.0 / 0.30.0 敌方恶意机制：怪物不再是数值靶子

参考 BLACK SOULS II DLC3「冬之钟」与『アルミオシオンの医術師』的整体敌方设计语言：**改写玩家能按哪个键、每一招拆上一步的标准解、每条恶意都有一个可查到但不是同一个按钮的解**。高层级强、低层级弱不变——由“家族数量、形态档位（窗口宽窄）、是否脚本化”三个旋钮实现，数值曲线未改。

- 0.29 数值型恶意：真多段（每段全额 2/4/8 段）、多次行动（每公共轮追加 1–3 动）、必中三档（必中一击 / 锁定射击 / 全体必中穿防）、百分比与定血（5% 当前 / 25% 最大 / 50% 肉体破坏 / 七阶 Boss 开战“白之冲击”削至 1%）、蓄力大招（3.5s 可打断 → 2.2s 必中 → 1.5s 不可打断）、复活与死守（30% 站起 / 50% 复活强化 / 死守两轮不倒后必倒 / 三度再起并把全体打到 1）、回血分层（5% / 10% / 20%，七阶 Boss 上半管回满）、限伤分层（50% / 35% / 25% 每轮）。
- 0.30 规则型恶意：七条领域（无风：禁指令、闪避归零；狮子奋迅：禁技能、防御闪避递减；圣域：每轮扣 10%、禁道具；不可视：每轮剥增益；唱声：攻击归一成、禁疗；熔毁：最大生命减半；罪裁：主题属性改写为弱点），开战即放、不可解除；阶段转换改为规则包（清负面、剥敌方全部增益、两轮免疫状态、四阶追加行动、五阶召唤、六阶回满）；杂兵关系（复活衍生体 / 增殖 / 逆援）；倒计时（粘着炸弹五轮 / 原型八轮处决 / 三轮后坠落判决）；读取与反读取（麻痹不在全异常抗性里 / 反魂每轮剥一项增益 / 模仿敌人上一招）。
- 脚本连段：精英与 Boss 三阶起按固定环出招，环位由已用次数推出，阶段切换不重置。
- 每条恶意机制在敌人面板写明“对策”（高闪避 / 防御 / 护盾 / 打断 / 驱散 / 禁疗 / 比例伤害 / 必中 / 血线前爆发 / 无视杂兵 / 倒计时 / 不死硬接……）；分配器做“无解墙检查”：任何怪物不会同时封掉四种以上解法，或同时封掉闪避、防御、打断。一阶普通怪保留两成“负向样本”（只有单一花招）。

## 0.28.0 怪物机制重构：每只怪物都有自己的打法

- 新增机制词表（19 种被动、30 种独有主动、18 种权能、10 种改写全场的独有法则、10 种神国原型）与 433 只怪物的机制设计表：同一主题内没有两只怪物的首被动 / 首独有主动 / 权能相同，全库 432 套七阶套件两两不同。
- 层级越高手段越多，主动与被动同时增加：一阶普通怪仍是“普通”（只有两招核心技），精英 / Boss 一阶起带被动；二阶起约 65% 普通怪获得被动；三阶独有主动；四阶第二被动；五阶权能（改自身规则：不朽躯壳、双生、王者威压、概率支配、时间偏差……）；六阶第二独有主动；七阶独有法则（静默律 / 血税律 / 缓时律 / 真名律 / 均衡律 / 回响律 / 冻土律 / 熔炉律 / 通行律 / 元素律，对敌我双方同时生效）；七阶 Boss 再叠神国原型（熔炉 / 冰封 / 属性改写 / 献祭 / 静默 / 引力 / 疫病 / 审判 / 镜像 / 王权）与第三条被动。七阶普通怪≥15 项手段，Boss≥20 项。
- 多阶段：Boss 三阶起、精英五阶起，生命降至一半时进入第二阶段——Boss 立绘蒙红（伤害×1.25、速度×1.15、护盾并驱散负面），精英出现红蓝重影（闪避+15%、招架）。真正的特殊单位登场前只用这两种表现。
- 敌人面板的“应对提示”列出该怪物的全部独有机制与阶段说明。数值预算、品质与费用规则未改，旧远征可直接继续。

## 0.27.0 六属性伤害与怪物抗性表

- 所有伤害分为 物 / 火 / 水 / 暗 / 光 / 精 / 无 七类（雷电归光，冰归水，风土归物，毒腐归暗，音波为物＋精）。每个伤害技能都带属性标签；技能说明与战斗日志会显示属性和“弱点 / 特攻 / 抵抗 / 无效”。
- 433 种怪物各有一张抗性表，倍率只取 0 / 0.5 / 1 / 1.5 / 2：机械傀儡对精神无效而怕雷光，纸书怕火，火焰怪耐火怕水，亡灵鬼影耐暗耐物怕光……没有明显相性的怪物不强加弱点。精英与 Boss 从第 5 生命层级起主耐性升为无效，Lv25 创世位格的弱点也收敛为 1.5。
- 多属性技能默认按目标最弱的一项抗性结算；写明“各属性分别结算”的技能每个属性各打一次。百分比伤害与真实伤害视为无属性，无视抗性（真实伤害同时无视护甲）。
- 玩家与同行者默认全属性 1.0；种族与被动只在原文明确时改写（花灵弱火；读者核心的「故事的主人」使精神属性伤害归零）。附魔等属性转换会改变普通攻击的属性。
- 旧远征可直接继续；进行中的战斗按新表结算。

## 0.26.0 怪物独特素材掉落

- 盲盒只来自宝箱与宝箱怪；日常战斗不再掉盲盒。
- 战斗胜利沿用原概率（普通/精英敌群10%，含Boss敌群必掉），改为掉落本场被击败怪物的独特素材：432种怪物各一种，名称、固定效果“于{主题}·{区域}掉落的{素材名}，可用做素材”与一句人格点评。
- 素材品质随怪物等级（普通→优良→稀有→史诗→传说→神话）；Boss比同层小怪高一级，封顶神话。
- 宝箱怪盲盒品质等同宝箱怪等级；神话级宝箱怪另有9%掉落神话素材「价值的结晶」。
- 素材在成功撤离时以“材料”写入背包，失败清零；FP、宝箱与事件奖励未改。进行中的远征可直接继续。

## 0.25.1 室内暗场修正

- 室内楼层（大厅、走廊、书库等剖切视角）中，房间以外的区域改为暗场，不再被环境雾染成一整片灰蓝色；户外地图不变。
- 玩法、地图生成与存档格式均未改：0.25.0 的远征可直接继续，无需重开。

## 0.25.0 P5 HD-2D 地图与加载过场

- 随机地图升级为P5（\`p5-hd2d-2\`／建筑\`hd2d-architecture-3\`）：48个主题各有自己的建筑语言、材质与标志性建筑（如钟楼、宝塔、风车、水车磨坊、灯塔、木构教堂、天文台、书塔、马戏帐篷与剧院吊景塔）；外景有多层台地、楼梯、挡墙、水道、树木与门口道具簇，室内有剖切视角；暖冷光、移轴景深、泛光与暗角参照HD-2D画面调校。
- 建筑、地形与像素材质由浏览器内的渲染内核按存档布局确定性生成，再交给Godot直接导入；不再下载旧P4环境贴图与整模，游戏包更小。相同楼层每次进入画面一致。
- 新增三种地图加载过场：图书馆（翻页与飞书）、童话仙境（立体书城堡、怀表与兔子）、提线剧场（幕布与提线人偶）。首次进入迷宫和每次跨层时显示，Godot建好楼层后淡出，避免误以为卡死；遵循系统“减少动态效果”设置。
- 敌群候选点不再堵死唯一通道：未击败的敌群总能绕行或迎战。默认2%出现四类后室式异常层，仍保证连通。
- 旧P4地图存档按既定策略不迁移：进行中的旧远征需重新开始远征（角色、背包、聊天不受影响）。战斗、掉落、结算与补给员规则未改。

本轮构建、验证与发布范围见 \`docs/mcp-p5-map-optimization-report.md\`。

## 0.24.3 对话与战斗音效

- 已采用用户确认的补给员v3地图形象：黑色笔线溢出画板，不是金属环边；原对话立绘保持不变。
- 对话逐字显现并伴随纸笔沙沙声；点击文本或首次按E/Enter可显示全文，不会同时误选选项。完成、关闭或切后台及时停声。
- 光标移动、确认、返回、无效选择使用不同反馈；覆盖键盘、鼠标与触屏。
- 战斗按实际结算安排敌方出手提示、释放、命中/挥空、材质受击、格挡/破盾、暴击与倒下；物理和多类元素不再统一使用一个受击声。
- 新增51段许可明确的素材，共171段音效、127种cue；BGM123首保持不变。声音有短暂音乐压低、变体轮换、时序取消及声部限制。
- 原战斗数值、命中判定、掉落、真实聊天与结算逻辑未改。来源和许可见audio/CREDITS.txt。

## 0.24.2 补给员

- 原先每层固定事件/休息点合并为补给员；每次生成楼层独立9%出现，至多一名，无保底。
- 靠近互动显示右侧原图立绘、左侧姓名「补给员」、底部「要选哪个呢？」与中央「事件 / 长椅」。
- 二选一后补给员消失，在相同位置留下书或长椅，再次互动才执行原事件或40%三资源休息；不会同时获得两者。
- 地图使用遮脸两头身透明像素精灵（2026-09-24，美术修订3）；遮脸效果是黑线溢出画板的超现实绘画，不是金属环边。原对话立绘与9%生成规则不变。用户提供原图及衍生像素素材不从项目许可推导版权；见site/Supplier-CREDITS.txt。

本轮构建、验证与发布范围见 \`docs/mcp-dialogue-battle-audio-0243-20260924.md\`。构建命令本身不会更新运行中的酒馆或公网；新生成规则在新版实际加载后的新楼层生效。

## 0.24.1 撤离摘要与等概率宝箱

- 撤离摘要绑定实际的用户消息页；手动重新生成及滑动重生成均可读取已结算事实。聊天镜像丢失时仍可读取本次消息自身的记录，不补发奖励。
- 存档同时更新原生消息与所选 swipe 的元数据，兼容酒馆助手的 swipe_info 封装；保留其他消息页与宿主字段。
- 最终概率：每个新区宝箱类总出现率8%，普通宝箱4%、宝箱怪4%；同位置、同外观、互斥生成。短程随机结果不保证严格轮流。
- 本地构建从只读参考生成读者核心衍生文件，只替换 Booksea 标记区块。

## 0.24 首页、交互美术、宝箱怪与退出修复

- 首页三段文案与四类交互点像素美术更新；新增宝箱怪战斗图。
- 宝箱怪等级+5/最低6，不能普通逃跑，专门离场技能可用，击败必掉未开启盲盒。生成概率以0.24.1说明为准。
- FP直接结算，事件明确显示代价/效果/概率与三类页型取舍。
- 退出世界书改用原生EJS消息变量；更新加载正则的同时必须更新new核心的Booksea标记区块。
- 修复128处战斗ID/美术ID不一致及敌方召唤物空图；433张立绘实际浏览器显示通过，无需补画旧图。
- 构建只生成本地文件，不自动推送GitHub；公开地址何时生效以其资源清单版本为准。

详细说明：\`docs/mcp-exit-mimic-0241-20260923.md\`。以下0.23/0.22为沿用功能说明。

## 0.23 操作、移动端与聊天回退

- 默认行走图换为用户提供的四向四帧角色，已透明抠图；地图上始终只显示一名行走角色。
- 技能页仍是顶部介绍、底部双列列表。桌面选中后可鼠标单击或 Enter / 空格 / E 使用；触屏点选后再次点同一技能、双击或点交互键使用，不再提供确认按钮。
- 目标选择以立绘头顶箭头和缓慢明灭表示；方向键切目标，双击目标或 Enter / 空格 / E / 交互键施放。多目标技能可点选标记后施放；键盘 Shift+空格可标记。
- 默认保持标准画质与1.0渲染比例，关闭探索景深模糊；只有手动选择轻量时才降低渲染比例。
- 移动全屏后备模式同步扩展同源宿主iframe，跟随屏幕旋转与可视视口；退出还原样式，不移动或重载iframe。文本方向键改为虚拟摇杆。
- 已有完整物品编译与实物库存扣除；新增常见物品本地规则，非战斗消耗品在模型请求前跳过，不转成通用攻击。
- 远征、起始层解锁及交接记录按聊天消息保存。删楼后从保留楼层恢复，旧页面的延迟写入和未来本地缓存不能覆盖回退数据。完整存档存于有游戏活动的消息元数据，普通消息只继承短引用，不逐帧扫描聊天。
- 旧版本没有历史快照：升级时只把当前已提交进度绑定到当前楼层，不回填或伪造更早记录；无法定位楼层的旧本地缓存不再覆盖消息存档。无需清空角色、背包或聊天，新的角色整备会使用0.23物品筛选规则。

## 0.22 画面与操作修复

- 修复地图上通用漂浮书页的锚点和尺寸初始化，保持所有432张现有战斗立绘。
- 全屏只显示游戏舞台；空地按 E 或右上角菜单键打开队伍、行囊、遗物与设置。
- 前视RPG战斗：中央敌人、底部队伍头像、右侧分类指令；攻击时收起指令，显示战报、受击与倒地。
- 战斗背景保留实际遭遇地图并模糊处理；技能页改为顶部整栏介绍、底部整栏双列列表，长列表滚动，浏览后确认选取目标；不可用技能也能查看原因。
- 读取当前角色状态栏上传的头像，也支持状态栏保存的图片链接。只读，不上传头像、不改宿主头像库；没有头像时显示姓名占位。
- 盲盒效果改为“打开后获得轨道失落主题随机稀有消耗品*1”这类直接描述。
- 存档格式和0.21能力转换策略保持兼容，不清档，不改角色数值或结算规则。

## 发布到本仓库

只推送此发行目录，**不要上传上级开发工作区、酒馆data、密钥、聊天、原素材下载包**。

\`\`\`bash
git init -b main
git add .
git commit -m "Release Protelysion 0.41.1"
git remote add origin https://github.com/Adirm007/Protelysion.git
git push -u origin main
\`\`\`

仓库 Settings → Pages → Source 选 **GitHub Actions**。Actions 中的 Publish Protelysion 会校验全部文件后部署；等待绿色勾号。首次登录请在本机浏览器/GitHub Desktop完成，不在聊天中发送密码或Token。

## 首次下载、缓存与更新

PCK与WASM无损gzip并按最多16 MiB分片，低于GitHub单文件限制；浏览器校验SHA-256、缓存分片，启动时无损解包。全部音乐只缓存压缩文件，播放时按需解码，不把数百首常驻内存。
完整资源下载有逐字节进度（慢速网络有相应超时预算），中断后重试只补缺失的文件/分片；未完成的单个分片会重下；每次入口仅检查小发布清单，版本相同不重复下载大资源。清理浏览器数据、隐私模式、浏览器空间回收、换酒馆地址/浏览器或更新资源版本后可能重下，不能保证永久不被浏览器清理。
资源缓存与角色/存档分离，页面上的“清理游戏资源缓存”不删除聊天和存档。宿主需要HTTPS或本机localhost；手机HTTP局域网地址不能提供安全上下文的Web Locks/Web Crypto。

## 许可

原创部分采用 **CC BY-NC 4.0（署名—非商业性使用）**：可非商业使用、分享、修改，须注明Adirm007与原作链接、附许可并说明改动；禁止未经另行许可的商用。见\`LICENSE\`和\`NOTICE.md\`。
第三方音乐、用户提供的行走精灵、Kenney音效、Godot、字体等保留各自原许可，不能据项目许可单独再分发受限制的素材。这里是完整游戏发行仓库，不是原声或美术素材库。

## 测试边界

自动测试与实际Godot浏览器验证见随交付提供的审计报告；不承诺“绝无bug”。真实宿主复杂角色的LLM编译保真、个人难度平衡、手机真机发热和长时间稳定性仍需要实际试玩。
`;
await writeFile(path.join(repo,'README.md'),instructions.replaceAll('\\`','`'));
await mkdir(path.join(repo,'docs'),{recursive:true});
for(const name of ['mcp-rpg-ui-022-20260922.md','mcp-controls-mobile-rollback-023-20260922.md','mcp-seven-fixes-024-20260923.md','mcp-exit-mimic-0241-20260923.md','mcp-supplier-0242-20260923.md','mcp-dialogue-battle-audio-0243-20260924.md','mcp-p5-map-optimization-report.md'])await copyFile(path.join(project,'docs',name),path.join(repo,'docs',name));
const readerCore=await currentReaderCore();
// 本地导入的读者核心可能被作者手动修改过：只有文件不存在、或自上次生成后未被改动时才覆盖；发布仓库 install/ 始终写入生成版。
const importCore=path.join(imports,'读者核心本体 (new).txt'),importStamp=path.join(project,'09-实现/verification/reader-core-import.sha256');
let keepImportCore=false;
try{const existing=await readFile(importCore,'utf8');let stamp='';try{stamp=(await readFile(importStamp,'utf8')).trim();}catch(error){if(error.code!=='ENOENT')throw error;}keepImportCore=existing!==readerCore&&sha(existing)!==stamp;}catch(error){if(error.code!=='ENOENT')throw error;}
for(const dest of [imports,path.join(repo,'install')]){
 await copyFile(path.join(project,'02-宿主参考-只读/读者对话渲染0917 (new).json'),path.join(dest,'读者对话渲染0917 (new).json'));
 if(dest===imports&&keepImportCore){console.warn('本地导入/读者核心本体 (new).txt 已被手动修改，保留不覆盖。');continue;}
 await writeFile(path.join(dest,'读者核心本体 (new).txt'),readerCore);
 if(dest===imports)await writeFile(importStamp,sha(readerCore)+'\n');
}
await writeFile(path.join(imports,'书海-本机加载正则.json'),JSON.stringify(makeLocalRegex(template,css),null,2)+'\n');
const regex=JSON.stringify(makeExternalRegex(base,template,css),null,2)+'\n';
for(const dest of [imports,path.join(repo,'install')])await writeFile(path.join(dest,'普罗泰利西翁-书海外链加载正则.json'),regex);
await writeFile(path.join(imports,'安装说明.md'),instructions.replaceAll('\\`','`'));
// Only clean obsolete generated release files whose old content still matches our previous manifest.
for(const [name,old]of Object.entries(previous?.files??{})){
 if(files[name]||name==='release-manifest.json')continue;const file=path.resolve(site,name);if(!file.startsWith(site+path.sep))throw Error('Invalid old manifest path');
 try{const bytes=await readFile(file);if(sha(bytes)!==old.sha256)throw Error('Obsolete output was edited; refusing deletion: '+name);await unlink(file);}catch(error){if(error.code!=='ENOENT')throw error;}
}
const total=Object.values(files).reduce((n,f)=>n+f.bytes,0),compressed=pckParts.reduce((n,k)=>n+files[k].bytes,0);
if(total>950*1024*1024)throw Error('Pages size budget exceeded');
const report={passed:true,revision,repo:'22-发布/booksea-github',imports:'22-发布/本地导入',publicBase:base,files:Object.keys(files).length,gitBytes:total,maxGitFileBytes:Math.max(...Object.values(files).map(f=>f.bytes)),pckCompressed:{bytes:compressed,parts:pckParts},pckOriginal:manifest.files['game.pck'],scope:publicManifest.scope,player:publicManifest.player,license:'CC-BY-NC-4.0 (original portions only)',persistentResourceCache:true,allAudioPrefetchAvailable:true,containsPrivateHostData:false,containsOriginalMaterialDownloads:false,uploaded:false};
await writeFile(path.join(root,'发布包校验.json'),JSON.stringify(report,null,2)+'\n');
await writeFile(path.join(project,'09-实现/verification/release-20260922/distribution-build.json'),JSON.stringify({...report,inputs:Object.keys(bundle.metafile.inputs)},null,2)+'\n');console.log(JSON.stringify(report,null,2));
