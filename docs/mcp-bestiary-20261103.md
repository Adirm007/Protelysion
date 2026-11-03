# 敌役图鉴（2026-11-03，0.44.0）

## 玩法

- 收录 432 种主题怪物、通用宝箱怪与「?」，按 48 个主题与异客分组。默认全部锁定，只显示剪影与「？？？」。
- 遭遇即解锁，解锁单位是「物种 × 生命层级」：第一次在某一阶遇到它，就能查看这一阶的设定、战斗数值与全部技能。旧旅程击败过的物种只显示设定。
- 入口：书间顶栏、旅途手记的「图鉴」页签、战况里敌人条目的「查看图鉴」。面板不写“对策”，技能文案去掉开发者用语，只说明它做了什么。
- 图鉴只读名录与战斗模板（与战斗共用 `monsterKit`），不改变战斗、掉落或结算。

## 实现

规则在开战与战后把「见到了谁、几级、第几层、打倒几只」记进账本 `State.bestiaryLedger`；运行时存档前取走账本并入图鉴存档（去抖写入，写前重读再合并，失败退避重试，读档不重复计数）。

- 宿主：当前聊天的聊天变量 `booksea.bestiary`，按聊天保存、不随楼层回退，兼容旧的 `unlockedIds`。
- 独立试玩：存在这台设备（localStorage）。
- 怪物立绘在战斗中出现时顺手存一张缩略图到这台设备（IndexedDB），存不下时退回纹章占位。

源码：`09-实现/src/game/bestiary.ts`、`src/host/bestiary-host.ts`、`src/ui/bestiary-panel.ts`、`src/ui/bestiary-art.ts`；接线在 `src/game/expedition.ts`、`src/game/runtime.ts`、`src/ui/expedition-ui.ts`、`src/host-game-entry.ts`、`src/distribution/entry.ts`。宝箱怪与「?」的主题对象改为导出（`mimic.ts`、`stray.ts`）。

同一轮里曾放在书间与试玩页的「命运抽卡」已经撤掉：抽卡归读者，源码与说明在读者仓库的 `gacha/` 与 `docs/runtime.md`。

## 验证

- 发行仓 `dev-src` 快照全量回归 1486 项，1476 项通过；其余 10 项读取快照之外的目录（`02-宿主参考-只读`、`16-Godot可玩区域/godot`、`17-宿主可玩联调/entry-template.json`、`21-音频制作/assets`），与改动无关。图鉴 10 项定向测试全部通过。
- 类型检查只剩 `tests/loading-veil-p5.test.ts` 一处既有报错（未改动的 0.43.3 同样存在）。
- `site/distribution.js` 由 `tools/rebuild-distribution.mjs` 重建；用同一工具链重建 0.43.3 的源码与已发布文件逐字节一致。Godot 包与音频未改动。

## 交付范围

发行仓 `dev-src/09-实现`、`site/distribution.js` 与清单、README 已更新，发行标识 `protelysion-0.44.0-20261103-bestiary`。未安装到本机酒馆，未改动真实聊天、存档或结算。
