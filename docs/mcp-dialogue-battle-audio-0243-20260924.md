# 补给员逐字对话与战斗音效重制 · 0.24.3

2026-09-24。用户已确认补给员美术v3，并要求两项完成后直接推送最新版到仓库。后续明确选择：**仅更新仓库/网页，不停止、不重启、不安装到本机8017酒馆。**

本文是本版本的功能与构建验收记录。下列09/16/21目录路径指开发工作区；发行仓库主要包含 `site/`、导入入口、许可和交付文档。推送/Pages实际结果以Git和Actions记录及网页资源清单为准，不将本地构建冒称已经部署。

## 1. 补给员

- 使用用户确认的v3地图精灵：黑色笔线溢出画板的超现实表现，不是金属环、装订圈或实体边框。未再重绘其形象。
- 地图PNG SHA256仍为 `644a81ab241a1325ab3c8a1631522c5733de3e8c6acccb2704a137983221c3a8`。
- 原对话立绘SHA256仍为 `4c43d96797c855da9b3d6e6a324d92ccdc6040b1e7b9785b67a186a1b3eaadc9`。
- 「要选哪个呢？」按字素逐个显现，默认每字90ms；新增字有轻微浮现，稳定DOM的20Hz状态刷新不重开文本。
- 播放真实纸笔摩擦录音的低音量短循环，不是逐字蜂鸣。全文显现、跳过、关闭、隐藏或销毁及时停声；旧解码任务不能在已关闭对话后突然起声。
- 点击文本或首次E/Enter/空格只显示全文，不会同时确认「事件 / 长椅」。方向键、鼠标与触屏仍可选择。减少动态效果偏好直接显示全文。
- 独立9%生成、非每层保底、原地变成书/长椅、再次互动才触发、取消保留NPC等机制不变。

## 2. 战斗与菜单音效

原问题不只是素材少：技能浏览和目标光标是UI内部状态，没有接音效；原音频观察器主要依赖快照与滚动日志，缺少释放/碰撞的时间层次。

现在的链路：

1. **UI移动、确认、返回、无效选择分开**；浏览不会向玩法层发送假输入，不为一声光标音保存游戏。
2. **实际结算驱动声音**：读取真实before/after行动，不重新计算命中/伤害、不消费战斗随机数。
3. **敌方出手提示 → 释放 → 命中/挥空 → 材质与结果反馈**分段；命中基准在240ms，随原演出速度缩放。敌我标题明确区分，敌方行动栏有不同强调色。
4. 斩击、穿刺、钝击、火、冰、雷、水、风、土、光、暗、能量、精神、材质类攻击，以及治疗、增益、减益、护盾与召唤使用相应声音；同类有多样本轮换，不等同于每个技能拥有独占录音。
5. 库引用型技能按执行者的实际动作库追踪，不因动作内未回显library就退化成通用提示。
6. 真正未命中只播放挥空，不假装命中肉体；完全被盾吸收使用格挡声。暴击、破盾、倒下和受击也有对应反馈，最后一击不因战斗对象清除而丢失。
7. 关键瞬间适度压低音乐，保留原音乐文件/曲目/循环点。最多12个活动音效声部、48MiB已解码SFX缓存目标；多段动作合并为有界声音节拍，不同时堆叠24次爆声。
8. 暂停、换场、后台、静音、销毁取消后续节拍；键盘启声监听在窗口捕获阶段，避免被文档层游戏按键拦截。

主要实现：`09-实现/src/audio/{battle-feedback,effect-sequence,mount,observer,web-audio}.ts`，`src/ui/{typewriter,supplier-dialogue,battle-stage,expedition-ui}.ts`，`src/presentation/battle-cues.ts` 与runtime表现回调。没有修改战斗executor与core规则。

## 3. 素材、处理与许可

新增 **51段**，总计 **171段音效 / 127种cue**。新增PCM约2.51MiB；123首BGM源文件和记录保持不变。

| 素材 | 作者 | 许可 | 原始页面 |
|---|---|---|---|
| 80 CC0 RPG SFX | rubberduck | CC0 1.0 | https://opengameart.org/content/80-cc0-rpg-sfx |
| RPG Sound Pack | artisticdude | CC0 1.0 | https://opengameart.org/content/rpg-sound-pack |
| Ice spells | bart；原声Stephan / pdsounds | CC0 1.0 | https://opengameart.org/content/ice-spells |
| Ice & Electricity Magic | Iwan 'qubodup' Gabovitch | CC BY 3.0 | https://opengameart.org/content/ice-electricity-magic |
| Paper Scratch Pencil drawing line | johannesschmidt | CC BY 4.0 | https://freesound.org/people/johannesschmidt/sounds/339741/ |

选择性裁剪、44.1kHz单声道PCM、峰值校准至-6dBFS、短淡入淡出；书写段做35ms循环交叠。素材作者、作品名、原页面、许可链接、原包/原文件/产物SHA及修改方式均保留。CC BY素材不改标成项目CC BY-NC许可，不暗示原作者认可本项目。

配置：`21-音频制作/combat-dialogue-plan.json`；导入器：`tools/prepare-combat-dialogue.py`；新版资产验收：`tools/verify-combat-dialogue.py`。原始包和页面仅保留在authoring sources，不打入发行包。历史A1专用冻结构建/验收不是本轮入口；主音频导入器在A1后续接A2，避免重导时丢掉新增声音。

参考视频 `https://www.bilibili.com/video/BV1kZCxBDEiW/` 页面可读，但当前环境未取得可听辨音轨，已告知用户不能声称完成试听。没有抽取视频/RPG Maker授权不明的RTP声音。

## 4. 验收

| 项目 | 结果 |
|---|---|
| 类型检查、生产构建、Godot/PCK与发行构建 | 通过 |
| 全回归 | **1146/1146**，0失败/0跳过 |
| 新音频/交互真实浏览器 | **28/28** |
| 补给员实际PCK浏览器 | **18/18** |
| 完整发行包双源/缓存/离线浏览器 | **45/45** |
| 音频、许可、保护范围与波形检查 | **1635项** |
| 待发布资源SHA/字节与压缩包验证 | **442项资源** |
| 生产TS诊断 | 0错误、0警告 |
| 核心规则、批准美术、现用静态清单 | 20份保护文件SHA不变 |
| 原BGM | 123首SHA/记录不变 |

真实Web Audio节点确认了书写、UI移动/确认、敌方提示、释放/命中、冰火差别、重击暴击、挥空、格挡与治疗。验证首次Enter不误选、关闭/后台停声、暂停取消后续攻击、静音不新增声部、销毁释放，以及键鼠/触屏和横竖屏布局。

录制的是隔离夹具内实际混音输出：**14.04秒**，BGM故意静音以听清音效，不使用麦克风。峰值0.49615、RMS0.04094，无硬削波。它不是从参考视频抽取的声音，也不冒充实体手机扬声器或人工逐音色审美验收。

证据：`09-实现/verification/audio-0243/` 内有各阶段日志、`pre-publish.json`、`audio-assets-audit.json`、浏览器JSON与截图、`browser/in-game-effects.webm/mp3`。全部为合成测试状态，不访问真实聊天、模型或结算。

## 5. 发行标识与复现

- 版本：`protelysion-0.24.3-20260924-dialogue-battle-audio`。
- 发行JS SHA256：`6dd2f61e9c426e7dbebb3bccbfdef6bb3da682bad5829154758a1a39b8eb914a`。
- 音频清单SHA256：`304cbda6d3b7379815a00d742bc613c167318a1e810bab90138c935e4371398a`。
- PCK：107831776 bytes；SHA256 `f5682b2d059d2091f42eddc4d89c90361c411a7bbd695cc0bb0a893020147148`。
- 本机现用酒馆仍为 `protelysion-0.24.1-20260923-r2`。用户明确选择不更新本机，不停服务、不清存档、不改聊天/角色/模型设置。

从 `09-实现/`：

```bash
python ../21-音频制作/tools/prepare-combat-dialogue.py
npm run typecheck
npm run build
node ../16-Godot可玩区域/tools/build-web.mjs
npm run build:public
node --import tsx --test --test-reporter=spec --test-timeout=60000 tests/*.test.ts
node scripts/verify-audio-feedback-browser.mjs
python ../21-音频制作/tools/verify-combat-dialogue.py
node scripts/verify-supplier-browser.mjs --output=verification/audio-0243/supplier
node scripts/verify-release-browser.mjs --output=verification/audio-0243/release-browser
python ../22-发布/booksea-github/tools/materialize.py
```

发行库为 `https://github.com/Adirm007/Protelysion`，网页入口为 `https://adirm007.github.io/Protelysion/`。依用户授权在上述门禁完成后提交与推送；推送和Pages生效是两个独立步骤，均需再核验，不能由本地构建结果推断。

## 6. 实际发布结果

- 已发布到 `main`：提交 `2ac97804283b0f5d780ebb6274388106d3b8e216`，69个变更文件。远端引用与本机HEAD完全相同，远端跟踪引用已校准，发行库工作树干净。
- 原生Git HTTPS多次发生TLS握手失败/超时；最终通过GitHub官方Git Database API发布。69个blob、完整tree和commit SHA均与已经验证的本地提交完全一致，非强制快进，没有改作者/时间/父提交或另造代码版本。
- 使用本机已有Git登录，仅在本机进程内进行GitHub认证；未打印、写入或转送凭据，未关闭TLS证书校验，也未永久改Git传输配置。中途失败的对象上传由校验缓存续传。
- GitHub Pages工作流 `35916579755` 已完成，结论 `success`：https://github.com/Adirm007/Protelysion/actions/runs/35916579755
- 网页：https://adirm007.github.io/Protelysion/ ，HTTP 200；实际公开资源清单为 `protelysion-0.24.3-20260924-dialogue-battle-audio`。
- 公开发行JS、音频清单、纸笔/火焰样本与两份署名说明共6项SHA/字节数和测试版本一致。CI另完整校验全部发行资源/PCK。没有把静态资源校验描述成真人在线全流程或实体手机音质验收。
- 69个变更文件与未压缩PCK的GitHub令牌/私钥模式检查未见命中；没有发布原素材下载包或宿主数据。
- 再次核对20份保护文件SHA，现用酒馆仍未更改；没有停服、重启、清聊天/角色/存档或调用真实模型。

机器证据：`verification/audio-0243/publication.json`、`public-web-verification.json`、`release-secret-pattern-audit.json`（均位于09实现目录）。校验记录不包含认证秘密。
