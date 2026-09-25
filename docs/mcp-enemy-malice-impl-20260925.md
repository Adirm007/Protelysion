# 敌方恶意机制实施记录：0.29.0 + 0.30.0（2026-09-25）

对应计划：`docs/mcp-enemy-malice-architecture-20260925.md`。两个版本一次实施、合并发布为 0.30.0。

## 1. 新增 / 改动文件

| 文件 | 内容 |
| --- | --- |
| `09-实现/src/game/monsters/malice.ts`（新） | 11 个恶意家族构建器（F1/F2/F3/F4/F6/F8/F9/F10/F11/F12/F14），每家族 seed / full / unbound 三档；7 条领域（F5）；`phasePack`（F7 阶段规则包）。每条声明 `counter`（玩家的解）与 `seals`（封掉的解）。 |
| `09-实现/src/game/monsters/malice-plan.ts`（新） | 分配器：家族解锁层级表（普通/精英/Boss × 三档）、每层配额、领域槽位、逐层累加（第 s 层 ⊇ 第 s−1 层）、强制项（t2 蓄力或必中、Boss t3 不死、t4 真多段、t5 不死或倒计时、t6 一项“拿掉反制”、t7 读取）、无解墙检查（硬解法封锁 <4；闪避/防御/打断不得同时被封；指令与技能不得同时被封）、一阶普通怪 20% 负向样本。 |
| `09-实现/src/game/monsters/kits.ts` | 挂入 `malice-N` / `arena-N` 技能；阶段改用 `phasePack`；精英/Boss 三阶起给技能打 `ai:rot:N` / `ai:rotlen:L` 脚本环标签；套件新增 `malice` 字段与 `对策：…` 面板行。 |
| `09-实现/src/game/combat-ai.ts` | 脚本环执行（环位 = 环内技能已用次数之和 mod 环长，跨阶段不重置）；`monster:unique` 与 `monster:regular` 同权；AoE 按可命中人数加分；`ai:charge` 在敌方增益 ≥3 或有人残血时 +20；`ai:guaranteed` 对高闪避目标 +25；`ai:percent` 对厚血目标 +20；`ai:mimic` 无历史时禁用。 |
| `09-实现/src/game/monsters/numbers.ts` | `MONSTER_CONTENT_VERSION` → `booksea-monsters/0.20.0`。 |
| `09-实现/tests/monster-malice-030.test.ts`（新） | 契约校验（3 职能 × 7 层 × 11 家族 × 3 档 + 7 领域 + 阶段包）、真多段 per_hit、分配器单调/低层禁令/无解墙/累加不丢失、负向样本比例、套件挂入与脚本环标签。 |
| `09-实现/tests/monster-mechanics-028.test.ts` | 阶段伤害倍率断言 1.25 → 1.15（阶段改为规则包）。 |
| `09-实现/scripts/export-malice-table.ts`（新） | 导出 `01-计划与制作清单/怪物恶意配置表.csv`（3024 行：433 怪 × 7 层）。 |
| `09-实现/package.json`、`scripts/build-public.mjs`、`scripts/build-host-game.mjs` | 版本 0.30.0、发布说明、revision `protelysion-0.30.0-20260925-enemy-malice`。 |

## 2. 家族实现要点（契约映射）

- F1 真多段：`powerMode:'per_hit'`，2/4/8 段；unbound 逐段 `onHitAction` 叠流血（2% 最大生命/轮，可叠 5 层）。
- F2 多次行动：`round` 触发 `atb extra`；seed 仅生命过半后；unbound +2，残血再 +1。
- F3 必中：`hitRule:'guaranteed'`；full 先上“锁定”（闪避 −10）再重击；unbound 全体 3 段 + `bypass:['reduction']`。必中不等于穿防，穿防单独发放。
- F4 百分比：`currentFraction 5%` / `maxFraction 25%` 必中 ×2 / `50%` 必中 ×1；七阶 Boss 附 `battle_start` 触发“白之冲击”（全体当前生命 99%，`lethal:false`）。全部为“无”属性，抗性恒 1。
- F6 蓄力：castMs 3500 / 2200 / 1500；unbound 开战获得 `uninterruptible` 规则；`refundOnInterrupt:0`。
- F8 不死：`death_guard` 的 `amount` 直接用 `pct('hp',.3/.5)`（执行器在扣血前评估 amount，因此 onTrigger 里不再补治疗）；`onTrigger` 清负面 + 叠“再起”；full/unbound 另有一条低优先级 `death_guard` → `undying` 2 轮 + “死守”状态（伤害 ×2、每轮追加行动），到期 `onExpire` 对自身造成 `bypass:['death_guard','shield']` 的致命伤；unbound 第二次复活附全体 `resource hp set 1`。
- F9 回血：`round` 触发 5% / 10% / 20%；unbound 生命 ≥50% 时回满。
- F10 限伤：`damage_cap` 50% / 35% / 25%，`reset:'round'`，四通道；unbound 附 `crit −1`。
- F5 领域：对敌方全体 `rule seal_category`（`command` / `skill`+`spell` / `item`）、永久不可驱散状态（闪避 −1、每轮扣 10%、攻击 ×0.1 + `no_heal`、最大生命 ×0.5、主题属性 ×1.5）、自身闪避 +0.6 并每轮剥除敌方增益。绝不同时封 `command` 与 `skill`。
- F7 阶段：清自身负面、剥敌方全部增益、`immune_status:'*'` 2 轮、推进行动；四阶 +追加行动；五阶 +两名衍生体；六阶 +回满（精英 50%）。数值加成降为 ×1.15 / ×1.1，视觉标签不变。
- F11 衍生：开战两名衍生体，`after_down ally` 触发再召唤；full 上限 6 增殖；unbound 衍生体倒下时本体追加行动并叠“逆援”。
- F12 倒计时：seed 粘着炸弹（5 轮后 60% 最大生命，防御可减）；full 原型（8 轮倒计时到期全体 `execute`，生命 <75% 重置一次）；unbound 坠落判决（3 轮后每次命中 `execute`）。
- F14 读取：seed 麻痹（`control:'stun'` 1 轮 + 闪避 −1 + 承伤 ×1.3，标签 `malice:paralyze`）；full 反魂（每轮剥除敌方一项增益，含不可驱散）；unbound 模仿（`copy used_latest activate`）。

## 3. 分配结果（433 怪 × 7 层）

- 家族出现次数：F1 2202、F4 1706、F6 1387、F3 1333、F8 941、F9 730、F2 455、F10 440、F12 374、F14 259、F11 195。
- 无解墙检查拒绝/降档 453 次（记录在配置表“被无解墙检查拒绝”列）；最终没有任何怪物硬解法封锁 ≥4，或闪避/防御/打断同时被封。
- 一阶普通怪 48/240 为负向样本（只有核心技，不带恶意家族）。
- 七阶：普通 ≥4 家族；精英 ≥5 家族 + 1 领域；Boss ≥7 家族 + 2 领域 + 读取。

## 4. 已验证的执行器行为

- `atb extra` 追加完整行动；`seal_category` 按 `action.category` 精确匹配（玩家普攻/防御为 `command`，编译技能为 `skill`/`spell`）；`death_guard.amount` 在扣血前评估；`undying` 到期后由自伤致命一击触发正常倒下；`damage_cap` 按轮重置；`untargetable` 未使用（避免 0.28 的集成测试停滞）。

## 5. 未做 / 后续

- 治疗反转（`alter_event heal_to_damage`）改用 `no_heal` 近似；决斗裁判（共享不死、先死者负）未实现；假分身（`summon clone` 真身可辨）未实现；不该打的同伴（自爆眼）未实现。
- UI 端未新增领域横幅/倒计时数字；现阶段依靠技能描述与面板“对策”行。
- 击破补偿（祝福镜像）、玩家侧 `reduction_percent`/`no_revive` 获取途径未做。
