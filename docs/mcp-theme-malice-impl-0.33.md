# 主题专属恶意机制实施记录：0.33.0（T25–T48，2026-09-25）

对应计划：`docs/mcp-enemy-malice-plan-v2-20260925.md` §4（定稿 25–48 条）与 §5。前置 0.32.0（`4ed8b73`）。结构、槽位、测试骨架见 `docs/mcp-theme-malice-impl-0.32.md`；本版只把 `EXCLUSIVE_THEMES_UPTO` 从 24 改为 48，并补测试 033 与文档。

## 1. 改动文件

| 文件 | 内容 |
| --- | --- |
| `09-实现/src/game/monsters/malice-plan.ts` | `EXCLUSIVE_THEMES_UPTO = 48`。 |
| `09-实现/src/game/monsters/theme-malice.ts` | T26 租客夺取比例按数值铁律从 8% / 12% 提到 10% / 15%（<10% 的百分比不允许出现）。 |
| `09-实现/tests/monster-theme-malice-033.test.ts`（新） | 对 T25–T48 跑 `checkThemeRange` / `checkAssignment` / `checkKitsAndSmoke`。 |
| `09-实现/tests/monster-theme-malice-032.test.ts` | 加一条“48 个主题全部就位”。 |
| `package.json` / `build-public.mjs` / `build-host-game.mjs` / `numbers.ts` | 0.33.0、revision `protelysion-0.33.0-20260925-theme-malice-2`、`booksea-monsters/0.23.0`。 |

## 2. T25–T48 契约映射与偏离

标注 ★ 为与计划稿不一致、按引擎原语落地的条目。

| # | 机制 | 落地 | seals |
| --- | --- | --- | --- |
| T25 | 北辰熄灭 | `round` 触发（3 轮冷却）随机一人 3 轮“北辰熄灭”：`cost_mp ×2/×3`、`cost_sp` 同倍。★ “直到其对它单次 ≥10% 最大生命”改为固定 3 轮（没有“按伤害量解除”的原语）。 | — |
| T26 | 蜂后物业 | `round` 触发：全体物理扫荡 ×0.8 + 召 1 名租客（上限 3/6，蜂后 10% 生命，9 轮）；租客攻击：10% / 15% 最大生命 `drain 100%`（★ 回到租客而非蜂后）+ 叠“欠租”（`vulnerability ×1.15`/层，无上限）；完全体蜂后常驻 `vulnerability ×0.7`（★ 代替“每只租客 −10%”的动态减伤与“满员双动”）。 | ignore_adds |
| T27 | 永不毕业 | ★ `round` 触发 `uses seal most_used` 2 轮随机一人（“同一技能第 3 次即封、直到用新技能”需要按技能 key 计数的条件，引擎的 `uses` 条件要求已知 key）。雏形 2 轮一次。 | skill |
| T28 | 零库结算 | `round` 触发：`uses seal used_latest` 1/2 轮随机一人；完全体先 `copy skill used_latest`（`permanent` = 本场）到自己货架。 | skill |
| T29 | 白潮析命 | `round` 触发：全体敌人无属性伤害，量 = `current×k − max×k/2`（`minimum 0`，`lethal:false`，`bypass shield`），k = 0.3 / 0.5→1.0（t3→t7）；同时自身获得 15–25% 最大生命护盾（★ 固定盾值，非析出量）。★ “对半血以下目标伤害 ×1.5”未做。 | percent |
| T30 | 云层分割 | `round` 触发（3 轮冷却）：`highest_resource hp` 上“上层”（`vulnerability ×1.5`），`lowest_resource hp` 上“下层”（伤害 ×0.5），3 轮；完全体再对两人 `status_transform swap`。★ 只切最厚 / 最薄两人，不是全队按血量分层。 | — |
| T31 | 不落雨债 | 雏形 `before_heal enemy` `scale 0.5`；完全体 `no_heal '*'`；`damage_received self` + `hp ≤30%`（一次）→ 全体 30–45% 最大生命（★ 雨债总额改为按最大生命比例）。 | no_heal |
| T32 | 瓶海收藏 | `kill self`（uses 1/2）→ 对 `event_target`（含倒地）`rule no_revive`。★ “打掉它 25% 放出一瓶”未做（不可复活规则无按伤害解除的原语）。 | undying |
| T33 | 万芯神谕 | `round` 触发 `choose count 1` 四个子动作：全体 25% / 40%、全体沉默 1 轮、自疗 20%、`atb extra 2`。★ 等概率四面而非六面加权。 | — |
| T34 | 墓园旋转 | `round` 触发全体 `atb retreat 40`（雏形 2 轮一次）。★ “轮转一格”改为整体后退。 | — |
| T35 | 透明鲸梦 | 常驻 `damage_cap 25%/轮`；`round` 触发（3 轮冷却）全体 20% / 30% + 自疗 30%（★ “记账不结算 + 按存活人数倍率结算”改为限伤 + 定期结账）。 | burst |
| T36 | 黑日不落 | `round` 触发（雏形 2 轮一次）：全体敌人叠“被收割”（五维各 −1/层，scope run + 探索时钟，本次迷宫内）+ 自身叠“丰收”（五维各 +1/层）；`round` 触发 + 条件自身丰收 ≥10 → 全体物理 ×2 并清 10 层。 | — |
| T37 | 地心账本 | `round` 触发（5 轮冷却）：自疗 20% / 30% + 全体 20% / 30% 最大生命（★ 账本额改为按最大生命比例）。 | burst |
| T38 | 缝隙王权 | `damage_received self` → 攻击者 1 轮“已被王权记下”；`before_damage self` + 条件 `event_source` 有该状态 → `alter_event scale 0.3 / 0`。 | burst |
| T39 | 无始发站 | `before_action enemy`（技能）`chance 0.2 / 0.35` → `alter_event redirect recipient:event_source`（★ “随机目标含己方”改为固定打到自己）。 | — |
| T40 | 十三潮汐 | `counter x-tide13`：`round` +1、`damage_received self`+暴击 +1、`hit self` −1（`minimum 0`）；`round` 触发 + 表达式条件 `counter ≥ 16/13` → 全体 `execute` 并清零。方向与计划一致：暴击催潮、挨打退潮。 | timer |
| T41 | 黑雪投递 | 主动：`time delay` 3 轮 → 剥增益 + 2 轮 `vulnerability ×1.5` + 能量伤害 ×1.4 / ×1.8 必中。 | — |
| T42 | 玻璃之躯 | 常驻 `vulnerability ×2`；`damage_received self`（uses 3，`reset:'action'`）→ 攻击者 `eventFraction 0.6 / 1` 无属性、`bypass shield`。 | — |
| T43 | 节节高 | `round` 触发：叠“节”（上限 8/12：`max_hp ×1.1`、伤害 ×1.1、`evade +0.08`）+ 自疗 10%；`damage_received self` + 表达式条件 `event.actual ≥ 0.2 × 自身最大生命` → 消 3 层。 | evade |
| T44 | 超立方入库 | `round` 触发（3/2 轮冷却）：`highest_resource hp` 隔离 1 轮 + 清空其全部状态（★ “出库时剩余时间归零”改为直接清空）。 | — |
| T45 | 无人婚约 | 开战 `link life` 全体敌人（★ 引擎要求成员筛选为 `all`，不能只连两人），`recovery.hp 0.6 / 1.0`。★ “一方倒下另一方变 1”由 100% 分摊近似。 | undying |
| T46 | 彩噪 | `round` 触发 `choose count 1` 六个子动作，随机一人 2 轮“彩噪·X”（`element X ×1.5`）。★ 改写的是抗性而非“技能属性”。 | — |
| T47 | 低重力 | 开战对全场（`side:any`）`speed ×0.5` 永久；`round` 触发自身 `atb push 30 / 50`。★ “推条/退条效果 ×3” 无原语，未做。 | — |
| T48 | 幕间 | `round` 触发（6/4 轮冷却）：`variable set` 记下目标血线百分比 → `resource set` 目标 = 自身百分比 × 目标最大生命 → `resource set` 自身 = 变量 × 自身最大生命；★ 目标固定为“生命最高的敌人”（三步必须落在同一目标，随机筛选每一步会重抽）。 | — |

## 3. 分配与验证

- 48 主题 × Boss t3–t7 完全体 240 份、精英 t5–t7 雏形 432 份，全部挂入；普通怪与低层为空。
- 无解墙：3031 份模板硬解法封锁 ≥4 为 0，三封 / 双封为 0。
- 真实战斗冒烟：96 只（48 Boss + 48 精英）t7 套件开战后闲置 6 轮，无异常、玩家侧不全灭。
- `npm run check` / `build:release` / 配置表重导：见 §4。

## 4. 数字

- 测试：`npm run check` 1192 / 1192（0.32.0 为 1188，新增 4 项）；墙检查记录 146（基线 453）。

## 5. 计划 v2 收口清单

| 计划条目 | 状态 |
| --- | --- |
| §2.1 迷宫内限定 + run 清理测试 | 0.31.0 完成 |
| §2.2 `Uses.selection` 契约扩展、次数税 = 封印税 | 0.31.0 完成 |
| §2.3 失控（charm + AI） | 0.31.0 完成 |
| §3 G1–G12 + 分配器扩池 + 测试 031 | 0.31.0 完成 |
| 0.30.1 去攻略文案 | 0.31.0 完成 |
| §4 T01–T24 + 测试 032 + CSV `exclusive` | 0.32.0 完成 |
| §4 T25–T48 + 测试 033 | 0.33.0 完成 |
| UI：run 作用域后缀“（本次迷宫内）”、倒计时数字、失控标识 | 未做（计划标为 UI 层，本系列只做规则层） |
| 与引擎原语不一致的条目 | 各版文档 §2 逐条标 ★，共 G1、G7 与 T03/T04/T05/T06/T08/T09/T10/T12/T13/T15/T17/T19/T21/T22/T23/T25/T26/T27/T29/T30/T31/T32/T33/T34/T35/T37/T39/T44/T45/T46/T47/T48；若要严格还原，需要新增“按伤害量解除”“ATB/攻击力目标筛选”“跨轮携带事件量的延迟动作”三类原语 |
