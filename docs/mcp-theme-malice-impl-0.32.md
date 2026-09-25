# 主题专属恶意机制实施记录：0.32.0（T01–T24，2026-09-25）

对应计划：`docs/mcp-enemy-malice-plan-v2-20260925.md` §4（定稿 1–24 条）与 §5。前置 0.31.0（`b7cedae`）。

## 1. 结构

| 文件 | 内容 |
| --- | --- |
| `09-实现/src/game/monsters/theme-malice.ts`（新） | `THEME_EXCLUSIVE: Record<themeId, ThemeExclusive>`，每条 `{theme,name,summary:{seed,full},seals,passive,build(c,form)}`；本文件同时装了 T25–T48 的实现（0.33.0 才打开）。所有动作带 `monster:exclusive` 标签。 |
| `09-实现/src/game/monsters/malice.ts` | 导出 F/G 共用的构建助手（`passive/active/trigger/status/buff/aura/typeless/enemyRule/selfRule/scale/isCrit/isSkill/sourceHas` 与目标常量），供 theme-malice 复用。 |
| `09-实现/src/game/monsters/malice-plan.ts` | `MalicePlan.exclusive?: {id, form}`；`exclusiveFor(m,tier)`：Boss t3+ 完全体、精英 t5+ 雏形、普通怪无；`EXCLUSIVE_THEMES_UPTO = 24` 门控；专属 `seals` 在挑家族之前就并入墙检查集合，家族挑选自动让位。 |
| `09-实现/src/game/monsters/kits.ts` | 新槽位 `exclusive`（sourceId `monster:<id>:t<n>:exclusive`），描述追加“【主题专属·完全体/雏形】它做了什么”；主动型专属进入脚本环。 |
| `09-实现/scripts/export-malice-table.ts` | 配置表新增 `exclusive` 列。 |
| `09-实现/tests/theme-malice-shared.ts`（新） | 三个可按主题区间复用的检查：`checkThemeRange`（编译/被动判定/`monster:exclusive` 标签/无“对策”/状态作用域（run 必须走探索时钟，对玩家的永久负面必须是本场作用域，禁止宿主作用域）/隔离 1–3 轮/时停 ≤1 轮/失控 ≤2 轮/封印有期限/百分比 ≥10%）、`checkAssignment`（Boss t3+ 100% 完全体、精英 t5+ 100% 雏形、其余为空、与 `exclusiveFor` 一致、墙检查、累进不丢失）、`checkKitsAndSmoke`（套件挂载 + 真实 `createBattle` 开战后闲置 6 轮不抛错、玩家侧不全灭）。 |
| `09-实现/tests/monster-theme-malice-032.test.ts`（新） | 对 T01–T24 跑上面三项。 |
| `package.json` / `build-public.mjs` / `build-host-game.mjs` / `numbers.ts` | 0.32.0、revision `protelysion-0.32.0-20260925-theme-malice-1`、`booksea-monsters/0.22.0`。 |

## 2. T01–T24 契约映射与偏离

标注 ★ 为与计划稿不一致、按引擎原语落地的条目。

| # | 机制 | 落地 | seals |
| --- | --- | --- | --- |
| T01 | 感染潜伏期 | `hit self` → 目标上“潜伏”（6 轮、可驱散、无效果）；`before_heal enemy` + 条件 `event_target` 有潜伏 → 失控 1/2 轮（`lossOfControl`）、移除潜伏；完全体再给 `event_source`（施疗者）上潜伏。 | control |
| T02 | 倒悬丹理 | 开战 `resource exchange hp↔mp` 全体敌人；完全体 `round` 触发每 4 轮（`cooldownMs`）再换。 | — |
| T03 | 万面替身 | `death_guard uses 1/2, amount 30%`，`onTrigger` 对随机敌人 35–50% 最大生命（★ “伤害完整转给”改为按最大生命比例，免死回调拿不到原伤害量）。 | undying |
| T04 | 空冠加冕 | 开战给★随机一名敌人（引擎没有“攻击最高”目标筛选）上不可驱散的“空冠”：伤害 ×1.5、完全体 `vulnerability ×2`；`action_end enemy` + 条件 `event_source` 有空冠 → 全体敌人 15% / 25% 最大生命（★ 含戴冠者本人）。 | dispel |
| T05 | 零式引力 | `round` 触发 `atb set 0`，★ 随机一人（无“ATB 最高”筛选）；雏形 2 轮一次。 | — |
| T06 | 空轿迎亲 | `round` 触发（每战 2 次、5 轮冷却）：`space isolate` 随机一人 2/3 轮 + 召唤“空轿”（本体 25% / 40% 生命，同长存活）。★ 没有“3 轮后才被替代”的前摇；★ “轿子碎了才回来”改为固定期限（隔离必须有期限、始终留合法目标）。 | — |
| T07 | 无归铸剑 | 主动：`copy skill used_latest` + `uses seal used_latest`，雏形 `permanent`（本场）、完全体 `exploration_time`（本次迷宫内，随 `persistentUnit` 跨战斗、迷宫结束清空）；每战 1/2 次。 | skill |
| T08 | 无名观测 | `round` 触发随机一人 1 轮“被注视”：`crit −1`，完全体 + `vulnerability ×1.5`（★ 代替“承受暴击伤害 ×2”，没有该 stat）。 | — |
| T09 | 零点管理 | `round` 触发 `cooldownMs 5 轮`（★ 第 1/6/11 轮而非 5/10/15）：全体敌人 `seal_category skill+spell` 1 轮 + 自身 `atb extra` 1/2。 | skill |
| T10 | 零房拓扑 | ★ `status_transform swap polarity any` 作用于随机两名敌人（“交换位置与全部状态”没有原语，改为把两人身上的状态正负翻转）；雏形 2 轮一次。 | buff |
| T11 | 停钟工程 | 主动：`time stop` 1 轮全体 + `uses seal used_latest` 1/2 轮全体；每战 2 次。 | skill |
| T12 | 永冬圣谕 | ★ “增益上限 1 轮”没有原语，改为 `round` 触发剥除敌人全部增益 + 清自身全部负面（雏形 2 轮一次）。 | buff |
| T13 | 永生花床 | `hit self` → 叠“播种”（上限 4/3）；`hit self` + 条件目标播种 ≥4/3 → “扎根”2 轮（`speed ×0.5`）并消一层；`before_heal enemy` + 条件目标扎根 → 完全体 `redirect recipient:caster`，雏形 `scale 0.5` + 自疗 `eventFraction 0.5`。★ “每轮 −50 推条”用速度减半表达。 | no_heal |
| T14 | 溺冠潮誓 | `round` 触发：全体叠“水位”（永久、不可驱散、上限 7）；同一触发里带条件的效果：水位 ≥4/3 施法 ×0.5、≥6/5 溺水 15% / 20–30%、≥7 `execute`；`damage_received self` + `critical` → 攻击者水位 −2。 | timer |
| T15 | 无字著述 | `round` 触发 `uses seal used_random` 1 轮随机一人（★ “使用时作废本次行动”改为直接封 1 轮）；雏形 2 轮一次。 | skill |
| T16 | 终章留白 | `damage_received self` + `hp ≤30%`（无次数上限，2 轮冷却防抖）→ 自身 1 轮“留白”（`control:'stun'`、不可驱散），`onExpire` → 回 70% / 100% + 清自身负面。 | burst |
| T17 | 末班广播 | `round` 触发（6 轮冷却）：随机一人获得 3 轮“登机口”（★ 用 100% 最大生命的 `true` 护盾表达“在登机口就不受伤”），同时自身 3 轮倒计时状态 `onExpire` → 全体 25% / 40%。 | — |
| T18 | 无终旅程 | `round` 触发：自身叠加无上限“无终”（`max_hp ×1.1/1.15` + 伤害同倍）+ 自疗 10% / 15%。 | — |
| T19 | 总单归属 | `shield_break enemy` → 全体敌人 `eventFraction 0.5`；完全体 `action_end enemy` + 条件 `event_source` 有护盾 → 自身获得 20% 最大生命护盾（★ “复制一份”改为固定盾值）。 | shield |
| T20 | 永昼退房 | 自身 `guaranteed_hit '*'`；`miss self` → `event_target` 叠“退房”（`evade −0.1` 本场 / `−0.15` 本次迷宫内，scope run + 探索时钟）。 | evade |
| T21 | 十三地基 | `before_heal enemy` `heal_to_damage`（uses 7/13）；`before_damage self` + `critical` `damage_to_heal`（uses 7/13）。★ 计数公开依赖 UI，未做。 | no_heal |
| T22 | 未完树稿 | 主动 `branch`：目标有“线稿”→ 定稿（×2/×3 必中并消标记），否则草稿（×0.3 + 线稿 4 轮）。★ 作用对象是它自己的攻击而非玩家技能（“玩家首次用某技能是草稿”需要改玩家侧执行器）。 | — |
| T23 | 总务循环 | 开战 `link life` 全体敌人，`recovery.hp 0.2/0.3`，`minimumMembers 2`，`delayRounds 1`。★ “它只打链接内目标”未做（它本来只能打敌人）。 | — |
| T24 | 零场观众 | `after_cost enemy`（技能）→ 自身叠“观众”（上限 10/8）；同事件 + 条件自身观众 ≥10/8 → 全体 `atb set 0` + 沉默 1 轮 + 清空观众。 | skill |

## 3. 分配结果

- Boss t3–t7 全部带专属完全体（24 主题 × 5 层 = 120 份），精英 t5–t7 全部带专属雏形（24 × 3 × 3 = 216 份），普通怪与低层为空；`checkAssignment` 逐份断言。
- 专属 `seals` 先于家族进入墙集合；无解墙结论不变：没有任何模板硬解法封锁 ≥4，`evade+guard+break` 三封与 `command+skill` 双封均无。
- 真实战斗冒烟：48 只（24 Boss + 24 精英）t7 套件开战后闲置 6 轮，无异常、玩家侧不全灭（隔离/时停/失控都有期限）。

## 4. 验证

- `npm run check`：见 §5 数字；`build:release` 通过；配置表重导（新增 `exclusive` 列）。

## 5. 数字

- `npm run check`：1188 / 1188（0.31.0 为 1185，新增 3 项，每项覆盖 24 主题 × 双形态 × 多层级）；墙检查记录 130（基线 453）。
- 后 24 条（T25–T48）实现已在 `theme-malice.ts` 内，`EXCLUSIVE_THEMES_UPTO` 从 24 改为 48 即启用，随 0.33.0 发布。
