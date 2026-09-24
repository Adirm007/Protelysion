# 六属性伤害与抗性表实装记录（2026-09-25）

对应审计：`docs/mcp-damage-types-audit-20260923.md`。本次把物 / 火 / 水 / 暗 / 光 / 精 / 无 七类伤害属性、433 种怪物（含宝箱怪）的抗性表、玩家方抗性表以及提示词规则全部接入 `09-实现`。

## 1. 规则落点

| 规则 | 实装位置 |
| --- | --- |
| 七类属性常量、旧元素名归并（雷/电→光，冰→水，风/土→物，毒/腐蚀→暗，神圣/净化→光，音波→物+精 等） | `src/battle/elements.ts` `DAMAGE_TYPES` / `elementKey` |
| 伤害效果携带 `types`（1~3 个）与 `perType` | `src/compiler/contract.ts` Damage effect（保留 `element` 仅作兼容，不升 EFFECT_VERSION） |
| 缺失标签的推导：物理通道→物，精神通道→精，能量/真实→无 | `elements.ts` `resolveDamageTypes` |
| 百分比伤害（含目标/事件的 maxFraction / currentFraction / lostFraction / eventFraction）→ 无属性，无视抗性 | `resolveDamageTypes(...).fixed==='percent'`；自身生命献祭是费用，不在此列 |
| 真实伤害→无属性，无视护甲与抗性 | `fixed==='true'`；护甲绕过沿用 `battle/damage.ts` |
| 多属性默认按目标最弱抗性（倍率最高）结算一次；`perType` 时每属性全额各一次 | `elements.ts` `bestType`；`src/battle/executor.ts` `damage()` / `resolveHit()` |
| 无属性对任何表恒为 1；倍率 0 记 `无效` 日志但命中、附带状态照常 | `typeMultiplier`；执行器 `affinity` 日志 |
| 属性转换（附魔火焰等）与 `element_resist` / `immune_element` 键 | 执行器接收侧统一走 `elementKey` 归并；`convert` 反应输出改用属性名 |
| 抗性倍率只取 0 / 0.5 / 1 / 1.5 / 2 | `contract.ts` `RESISTANCE_STEPS`；执行器 `recompute` 夹紧 ≥0；生成器只输出五档 |

## 2. 怪物抗性表

- 数据文件：`src/game/monsters/resistances.ts`（每只怪物一条显式条目：`base` 表、`primary` 主耐性、`note` 依据），由 `08-模板制作工具/生成怪物属性抗性表.py` 从 `怪物设计名录.csv` + 主题元素 + 双核心生成；对照表 `01-计划与制作清单/怪物属性抗性表.csv`（433 行，含 7 个层级列）。
- 统计：0.5 档 600 项、1.5 档 257 项、2 档 270 项、0 档 102 项；5 只怪物无任何相性（原文无依据，不强加）。
- 层级缩放（`monsterResistance(id, lifeTier, role)`）：1~4 层用基础表；5~6 层精英/Boss 的主耐性 0.5→0；7 层（Lv25 创世位格）额外把 2.0 弱点收敛为 1.5。普通怪不因层级新增无效档。
- 接线：`kits.ts` 把表写进 `mitigation.elementMultipliers`，并在 `counterplay` 追加“属性：…”提示；`ascension.ts` 删除了旧的第 4 阶 ×0.86 元素修正（与新表重复）。
- `MONSTER_CONTENT_VERSION` → `booksea-monsters/0.18.0`。

## 3. 玩家方抗性表

- `src/game/content.ts` `hostMitigation`：六属性默认 1.0；`RACE_RESISTANCE` 只登记原文明确的种族特例（当前：花灵 火 1.5 / 水 0.5），通过编译卡 `traits.tags` 的 `种族:` 匹配。
- 被动/状态继续用 `element_resist` / `immune_element` 叠乘；`故事的主人`（examples.ts `STORY_MASTER`）追加 `element_resist 精 ×0`，并在 `adaptive.ts` 中优先于通用控制免疫匹配。
- 提示词 `RULE_TEXT`（engine.ts）v0.25 写明属性分类表、多属性/百分比/真实规则以及玩家抗性只在原文明确时写入。

## 4. 展示与反馈

- `ui/ability-text.ts`：技能说明显示“火/水属性，取目标最弱抗性”“各结算一次”“百分比·无属性，无视抗性”；玩家战斗日志显示“X属性弱点/特攻/抵抗/无效”。
- `presentation/battle-cues.ts`：每目标一条相性提示行，`BattleCue.affinities` 供舞台使用。
- `audio/battle-feedback.ts`：击中音效按属性分流。

## 5. 验证

- `npm run typecheck` 通过。
- 新增 `tests/damage-types-025.test.ts`（13 项）：归并、单/多属性、perType、百分比与真实、通道推导、修复器归并、降级推断、抗性表 433 条与五档校验、层级缩放、宝箱怪、玩家默认表与种族特例、故事的主人、说明文本。
- 夹具 `tests/compiler-fixtures.ts` 的 `damageAction()` 增加 `types:['物']`，其余既有测试未改。
- `npm run check`（typecheck + test + build）：1164 / 1164 通过，构建成功。
- `npm run build:release`：Godot 导出与公开站点物化成功，`revision = protelysion-0.27.0-20260925-damage-types`。

## 6. 发布

- 版本号：`09-实现/package.json` 0.27.0；`build-host-game.mjs` 版本 `0.27.0-damage-types`、怪物内容 `booksea-monsters/0.18.0`；`build-public.mjs` revision 同上。
- `22-发布/booksea-github`：README 追加 0.27.0 说明；提交范围仅 README、`site/distribution.js`、`site/release-manifest.json` 与本文档副本。开发区副本里 `docs/mcp-p5-map-optimization-report.md` 的 9.3 节按其自身说明不随本次发布。
- 提交与 Pages 结果见文末追记。
