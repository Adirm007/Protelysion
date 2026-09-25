# 敌人改造 v2 实施记录：0.31.0（2026-09-25）

对应计划：`docs/mcp-enemy-malice-plan-v2-20260925.md`（§2 跨系统 + §3 通用原创家族 G1–G12 + 0.30.1 去攻略文案）。0.30.0（`fa9fcc7`）的 11 个 F 系家族、7 条领域、累进分配器与无解墙检查全部保留，本版只做加法与修正。

## 1. 改动文件

| 文件 | 内容 |
| --- | --- |
| `09-实现/src/compiler/contract.ts` | **唯一契约扩展**：`Uses` 新增 `selection?: 'used_latest' \| 'used_random' \| 'most_used'`。给出 `selection` 时 `skill` 只作占位（写 `'*'`）。 |
| `09-实现/src/battle/executor.ts` | `uses` 执行器解析 `selection`：候选取自目标 `history`（最近 / 随机）或 `used` 计数（最多），排除 `category==='command'`（普攻 / 防御）；没有候选则 fizzle 并记录日志。 |
| `09-实现/src/game/combat-ai.ts` | 失控：单位身上有 `control:'charm'` 状态时强制 `preference='strike'`，带伤害 / 扣资源且 `target==='enemy'` 的技能 +60（指令 +20），非敌对目标的技能得分 ×0.2。目标合法性仍由 `legalTargets` 的阵营解析（`allegiance`）决定，所以“敌人”实际是原队友。 |
| `09-实现/src/game/expedition.ts` | 时钟侧 `side` 已按阵营解析，被 charm 的己方单位 ready 时走怪物 AI；对非 enemy 侧单位不再去 `FOES` 表查行为模板。 |
| `09-实现/src/game/monsters/malice.ts` | `Family` 增 `G1…G12`，`CounterTag` 增 `buff`，导出 `familyOrigin()`、`lossOfControl(c,rounds)`（失控状态：`control:'charm'`，tags 含 `control:charm`，1–2 轮，`stack:'refresh'`）；新增 12 个 G 系构建器（见 §2）；`arenaAction` 描述去掉“对策：…”。 |
| `09-实现/src/game/monsters/malice-plan.ts` | `UNLOCK` 加入 12 个 G 系（雏形 t2–4 / 完全体 t4–6 / 去反制 t6–7，普通怪不拿双生）；配额与领域槽不变；累进规则修正（见 §3）；`COUNTER_LABEL` 增 `buff`。 |
| `09-实现/src/game/monsters/kits.ts` | 技能描述与面板不再拼“对策：…”（0.30.1），只保留“【家族·形态】它做了什么”。 |
| `09-实现/src/game/monsters/numbers.ts` | `MONSTER_CONTENT_VERSION` → `booksea-monsters/0.21.0`。 |
| `09-实现/scripts/export-malice-table.ts` | 配置表新增 `family_origin` 列（每个槽位 F / G 串联，如 `FFG`）。 |
| `09-实现/tests/monster-malice-031.test.ts`（新） | 7 项：G 系齐全与 origin；3 职能 × 7 层 × 12 家族 × 3 档契约校验与被动判定；无 permanent 负面 / 百分比下限 / 封印有期限；数值随层级单调；`Uses.selection` 与失控状态；分配器（池 23、解锁层区间、累进不丢失且形态不回退、t1 无 G、墙检查、G 占比、每个 G 都被分配到）；套件整卡校验。 |
| `09-实现/tests/run-end-clears-malice.test.ts`（新） | 2 项：`persistentUnit` 只带走 run 作用域（本场状态、按轮封印、来源租借不出战斗）；迷宫退出后 `party.persistent` 整体清空。 |
| `09-实现/tests/monster-malice-030.test.ts` | “面板有对策行”断言反转为“面板与文案都没有对策”。 |
| `09-实现/package.json`、`scripts/build-public.mjs`、`scripts/build-host-game.mjs` | 版本 0.31.0、发布说明、revision `protelysion-0.31.0-20260925-original-malice`。 |

## 2. G1–G12 契约映射（`malice.ts`）

数值全部走 `scale(c,lo,hi)`：t3 取 lo、t7 取 hi、线性插值，不写死。所有百分比按最大生命（`pct('hp',x,'target')`），≥15% 起步。

| # | 家族 | key | 实现要点 | seals |
| --- | --- | --- | --- | --- |
| G1 | 回声债 | `echo` | `damage_received self` 触发 → 对 `event_source` 的无属性伤害 `eventFraction` 0.25 / 0.5 / 0.75；去反制 `guaranteed` + `bypass:['shield']`。计划里的“2 轮后结算”改为即时回声（延迟结算需要跨轮携带事件量，引擎没有该原语）。 | burst |
| G2 | 贪食护盾 | `devour` | `round` 触发：`remove_shield count:99`（随机一人 / 全体）+ 条件 `target shield ≥1` 时自疗 15%→25% 最大生命；去反制加 `action_end enemy` 触发即时吞 `event_source` 护盾。 | shield |
| G3 | 代价转嫁 | `toll` | `after_cost enemy` 触发（条件 `category ≠ command`）→ 对 `event_source` 无属性 15–20% / 20–30% / 30–40% 最大生命，`bypass:['shield']`；雏形 / 完全体 `lethal:false`，去反制可致死；完全体起对全体敌人常驻 `cost_mp ×2`（唯一允许 permanent 的对敌状态，属于开战光环）。 | burst |
| G4 | 逆位 | `invert` | `round` 触发 `status_transform invert_numeric polarity:positive`（随机一人 / 全体）；去反制加 `after_status enemy` 触发对 `event_target` 立即反转。 | buff |
| G5 | 封印税 | `sealTax` | `round` 触发 `uses seal skill:'*' selection:'used_latest'` 1 轮 / 2 轮（1 人 / 2 人）；去反制加 `damage_received self` + 条件 `critical` → 全体封最近技能 1 轮。 | skill |
| G6 | 拖延判决 | `verdict` | 主动技：`time delay key duration:round(1/2)` → 子动作必中物理 ×1.6 / ×2.4；去反制 `bypass:['shield','reduction']`，结算前 `dispel positive` 并上 2 轮 `vulnerability ×1.5`。 | — |
| G7 | 双生 | `twin` | 开战 `summon mode:'clone'`（`cloneResources hp/mp/sp 0.3`，`limit` 1 / 1 / 3，tag `monster:twin`）；`after_down ally`（条件 `event_target tag monster:twin`）雏形本体自伤 10%（`lethal:false`），完全体自疗 30%→40%；去反制在分身倒下时立即再分裂（每战 3 次）。计划里的“每 4 轮再分裂”改为倒下时点：`round` 触发会在无人行动的时段凭空出新单位，卡住探索 / 挂机时钟（`monster-kits` 的神国到期测试即因此失败）。 | ignore_adds（完全体起） |
| G8 | 恐惧点名 | `dread` | `round` 触发给随机 1 / 2 人上 1 轮“被点名”（tag `malice:dread`）；`damage_received self` + 条件 `event_source status m-dread` → 对 `event_source` 必中 `eventFraction 1`；去反制再对全体 `eventFraction 0.5`。 | burst |
| G9 | 饥渴 | `thirst` | 雏形 `after_heal enemy` → 自身护盾 `eventFraction 0.5`（3 轮）；完全体 `before_heal enemy` → `alter_event scale 0.5` + 自疗 `eventFraction 0.5`；去反制 `before_heal enemy` → `alter_event redirect recipient:'caster'`。 | no_heal（完全体起） |
| G10 | 凝视 | `gaze` | `round` 触发给随机一人 1 轮“被凝视”（`cast_speed ×0.5`）；完全体加 `action_end enemy` + 条件 `event_source status m-gaze` → `atb retreat 30`；去反制再加同触发 + `category ≠ command` → `lossOfControl(1)`（charm 来源为怪物本身，阵营反转正确）。 | control（仅去反制） |
| G11 | 同归 | `mutual` | `before_down self`（`uses:1`）→ 无属性必中：雏形对 `event_source` 30–40%，完全体全体 30–45%，去反制全体 50–60% + 1 轮 `stun`。 | — |
| G12 | 借命 | `borrow` | `damage_received self` + `hp ≤30%`（`uses:1`）→ 对 `highest_resource hp` 敌人 30–40% 最大生命，`drain hp fraction:1 basis:actual`，`bypass:['shield']`；完全体起同时上常驻自身状态“借命”，其 `round` 触发每轮再夺 20–25%（随机一人 / 全体）；去反制每次夺取叠一层 `max_hp ×1.1`（无上限）。 | burst |

分配统计（433 怪 × 7 层）：F1 2160、F4 1394、F6 1249、F3 1177、F8 924、G1 325、F12 299、G11 296、G6 276、G8 224、F14 200、G10 195、G12 184、F9 177、G3 151、G2 124、G9 123、G4 120、F2 107、G5 99、F10 94、G7 76、F11 50。G 系占全部槽位 21.9%。

## 3. 分配器修正（`malice-plan.ts`）

- 池从 11 扩到 23 后，原“强制项可以越过硬解法封锁 ≥4”的分支会让 t6/t7 的“拿掉反制”强制挑选（以及领域）把 Boss 推到 4 项硬封（例：T01_B01 t7 = 打断 + 护盾 + 驱散 + 禁疗）。现在：**新增项无论是否强制，撞墙就让位**（记入 `walled`，标注“强制项让位”）；**已继承项永远保留**，升档若撞墙（含 ≥4 计数，不只是“同时”类）则保留低层形态。
- 结果：3031 份模板硬解法封锁 ≥4 的数量 0（0.30.0 通过“最终保险”兜底，现在在挑选阶段就不会发生）；墙检查记录 124 次（0.30.0 基线 453）。
- 配额、领域槽、强制项顺序（t2 蓄力 / 必中、Boss t3 不死、t4 真多段、t5 不死 / 倒计时、t6 一项去反制、t7 读取）、t1 普通怪 20% 负向样本均未改。

## 4. 跨系统（§2）落地说明

- **迷宫内限定**：引擎没有 `clock:'run'`；对应的原语是状态 `scope:'run'`、`sealClocks[id]==='exploration_time'`、`copied[id].clock==='exploration_time'`，由 `persistentUnit()` 在战斗间携带，`expedition.finish()` → `clearTemporary()` 把 `party.persistent` 整体置空。G 系本版对玩家的持续效应全部是 battle 作用域（`round` 时钟），run 作用域留给 0.32 的 T07 / T20 / T36。`run-end-clears-malice.test.ts` 锁定这条链路。UI 自动追加“（本次迷宫内）”后缀未做（本版没有 run 作用域的恶意效果，留到 0.32 一并做）。
- **玩家技能次数**：不给玩家技能加 `perBattleUses`；“次数税”一律用 `uses seal` + `duration` 表达；`selection` 让封印能选“最近用的 / 随机用过的 / 用得最多的”。若日后玩家技能有 `perBattleUses>0`，`uses spend` 会自动生效。
- **失控**：复用 `control:'charm'` 与 `allegiance()`；时钟侧 `cu.side` 已反转，因此 `expedition.tick` 中被魅惑的己方单位自然进入怪物 AI 分支；`decide()` 里加了失控偏好。同一怪不同时拥有“失控”+“沉默全队”：G10 去反制 seals 标 `control`，与领域 `lion`（seals `skill`）在墙检查里不冲突但在 §4 T01 实施时需要再加一条互斥规则（本版 G10 只封 1 轮、且只对被凝视者，不算全队沉默）。

## 5. 验证

- `npm run check`：typecheck 通过，测试 1185 / 1185（0.30.0 为 1176，新增 9 项），五个构建脚本全部完成。
- `npm run build:release`：Godot web 导出 + 公开站点重建，revision `protelysion-0.31.0-20260925-original-malice`。
- 配置表 `01-计划与制作清单/怪物恶意配置表.csv`：3024 行，新增 `family_origin` 列。

## 6. 未做 / 后续（0.32.0 / 0.33.0）

- 主题专属 T01–T48（`theme-malice.ts`、`exclusive` 字段、测试 032 / 033、CSV `exclusive` 列）。
- UI：run 作用域后缀、失控单位的头顶标识、G6 延迟判决倒计时数字。
- 计划中与引擎原语不一致、本版按引擎能力落地的两处：G1 即时回声（非 2 轮后）、G7 倒下再分裂（非每 4 轮）。若要严格按计划，需要新增“跨轮携带事件量的延迟动作”原语。
