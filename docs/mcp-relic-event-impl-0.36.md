# 遗物与事件系统重制实施记录：0.36.0（2026-09-25）

设计表：`docs/mcp-relic-event-redesign-99.md`（用户给出 15 条遗物 + 10 条事件，补全至 60 + 39 = 99；按用户反馈修订了 R29/R36/R39/R40/R50/R51/R53/R54/R56/R58/E16/E34/E35，并加入补给员商店与「杀害」）。

## 1. 结构

| 文件 | 内容 |
| --- | --- |
| `src/game/relic-catalog.ts`（新） | 60 条声明式遗物：`{id,name,description,rarity,scope,transferable,droppable,passive?,hooks?,grantFp?}`。`passive` 是挂在卡上的契约被动（modify / rule / 触发器 / 库），`hooks` 是跑段侧参数。 |
| `src/game/event-catalog.ts`（新） | 39 条事件，`EventResult` 新增 20 种结果（`fp / box / heal_all / cleanse_all / teleport / relic_random / relic_grant / relic_transform / relic_pick / encounter_tier / item / battle_mod / seal_skills / member_pick / run_mod / layer_mod / potions / swap_hp_mp / stairs / chest_spawn / withdraw`），`EventRequirement` 新增 `relic_any / fp / box / depth / party`，选项代价支持 `fp`。 |
| `src/game/run-hooks.ts`（新） | `relicHooks(s)` 聚合（乘算相乘、加算相加、布尔取或、最值取极值）；槽位 `relicCapacity = lifeTierOf(level) + 空遗物盒`；FP 账本 `pendingFp / adjustFp / scaleFp / grantFp`（可欠账）；盲盒计数与品质提档；商店药剂表 `POTIONS`。 |
| `src/game/mechanism-content.ts` | 旧的 96 遗物 / 248 事件生成器移除，改为再导出新目录；类型扩展。 |
| `src/game/expedition.ts` | `cardFor` 注入遗物被动（按 scope：holder 只给持有者、team 给全队、field 只注入一次）、封印契约、药剂指令；`newDepth` 读 `regionOptions`、每层 FP 扣减、层计数与层修正重置、逃票、「?」出现率；`interact` 楼梯门槛（寻宝罗盘）与宝箱品质提档；`supplierChoice` 四选一 + 商店页；`flee` 誓约之锁 / 逃生绳 / 烟雾弹；`enterBattle` 镜厅倍敌 + `applyBattleOpeners`（奇偶天平、高压训练、训练假人、沉睡的守卫）；`battleDrops` 掉率合成；`endBattle` FP 倍率 / 猎人告示 / 债主账本 / 灰烬骨灰 / 经验倍率 / 挑战奖励 / 三选一拾取；`applyNewEventResult` 与 `eventPickChoice`（选人 → 选技能 → 确认的多步拾取沿用事件选项界面）；`transferRelic` / `ringBell`。 |
| `src/game/region.ts` | `makeRegion(depth,visit,seed,options)`：宝箱率加减 / 必现、群狼哨 3–4 只、兽笼加精英、额外敌群、补给员必现；`Thing.eventReward`。 |
| `src/battle/executor.ts` | 新规则 `nth_skill_scale`（开幕号角：同一命令内多段都算）、`guard_first`（盾墙誓约，`actionUnavailable` 拦截）；`element_rewrite` 支持 `*|属性`（火种 / 寒露 / 附魔药）并按命令消耗次数。 |
| `src/game/supplier.ts` / `src/game/runtime.ts` / `src/ui/expedition-ui.ts` | 四个选项；`transferRelic` / `ringBell` 消息；遗物页显示槽位、持有者、交给谁、丢弃；行囊页显示药剂与传唤铃。 |

## 2. 关键规则落点

- **作用范围**：`scope:'holder'` 只注入持有者；`'team'` 注入全队（例：采集者之袋全队伤害 ×0.5、赞助契约全队 −20%）；`'field'` 只注入一次并以 `side:'any'` 目标全场（命中之眼）。
- **槽位**：`relicUnavailable` 检查同名与 `relicSlotsUsed >= relicCapacity`；空遗物盒不占槽且 +1。
- **转移 / 丢弃**：`transferRelic` 受 `transferable` 与对方槽位限制；`removeRelic` 受 `droppable` 限制；两者都重建世界并清理该遗物留下的 run 状态。
- **FP 账本**：负向调整先从既有 fp 奖励扣，扣不完记 `fpDebt`，之后 `grantFp` 先还账；宿主结算接口不变（只收到正数 fp 奖励）。
- **事件多步拾取**：`s.eventPick`（relic / member / skills / confirm）映射为事件选项按钮；封印契约的技能多选带“确认”。
- **补给员**：长椅 = 全队 HP/MP/SP 回满并清负面；商店价格 `base × (1 + depth/50) × 折扣`，药剂进 `s.bag`，全队卡上出现 `potion:<id>` 指令（category item，不受技能封印影响），用完自动移除；杀害 = 补给员变血迹、旁边刷宝箱（普通 / 宝箱怪各半）、`strayGuaranteedOnce` 在下一个个位 9 楼层消费为 100%。
- **「?」联动**：无字书签（步频 ÷4、刷新距离 18）、尾随者（100% + 多 1 盲盒）、时钟匠（追击 ×1.2）都从 hooks / runMods 读取。

## 3. 测试

- `tests/relics-events-036.test.ts`（10 项）：目录 99 条与用户原条目在列；槽位 / 同名 / 词条；holder / team / field 注入；开幕号角与盾墙誓约真实提交流程；FP 账本与欠账；寻宝罗盘门槛、群狼哨、生锈钥匙；清仓 / 翻倍减半 / 错位楼梯边界 / 尽头的门条件；封印契约三步流程与属性加成；高压训练与镜厅修正；杀害后「?」必现并消费标记。
- 既有测试改写：`mechanisms-system` 的“全部事件每个选项可执行并序列化”现在遍历 39 条事件的全部选项（含拾取 / 挑战 / 传送 / 撤离）；`supplier` 测试改为四选一、长椅全回复，新增商店与杀害；`features-024` 描述断言改为新目录。
- `npm run check`：1225 / 1225。

## 4. 与设计表的差异

- 0.36.0 曾把 R20/R27/R30/R31/R32/R42/R44/R46/R47/R56 改成现有修正；**0.36.1 补齐原语后全部按设计表原文实现**，无差异。
- 事件的“随机品质盲盒”按几何分布抽（普通最常见、传说最少）。

## 5. 0.36.1：为 10 条遗物补的原语

| 规则 | key | 行为 | 遗物 |
| --- | --- | --- | --- |
| `nth_use_free` | `3` | 同一非指令技能第 N 次使用费用为 0（`costFor(u,a,id)` 现在带技能 id） | R20 回响之弦 |
| `blood_tax` | `*` | MP 费用改为等量 HP，封顶在当前 HP−1 | R27 血税印 |
| `hp_gate_damage` | `lo|hi|阈值` | 攻击者血线低于阈值时输出 ×lo，否则 ×hi | R30 空腹护身符 |
| `hp_gate_attrs` | `hi|lo|阈值` | `recompute` 内按当前血线缩放五维；受伤 / 治疗后自动重算 | R31 满腹护身符 |
| `echo_first` | `*` | 每战第一个非指令技能记入 `echoQueue`，下一轮公共轮开始时对原目标免费再放一次 | R32 复读机 |
| `gear_cost` | `首动|其余` | `roundActions` 每轮清零；首动费用 ×首动、之后 ×其余 | R42 惰性齿轮 |
| `type_scale` | `属性|命中倍|其他倍` | 攻击者按解析后的伤害属性缩放输出 | R44 白纸 |
| `taken_type_scale` | `属性|命中倍|其他倍` | 防御者按伤害属性缩放承伤（“无”不受抗性表约束的问题由此解决） | R47 棱镜 |
| `dot_scale` | `tick|直接` | 事件点为 `tick`（中毒 / 燃烧 / 流血）的伤害 ×tick，其余 ×直接 | R46 忍耐之环 |
| `control_tax` | `比例` | 被免疫拦下的控制 / 负面每次让持有者失去当前 HP ×比例 | R56 破戒 |
| `Rule.absolute` | — | 新字段：带 `absolute` 的规则不参加“等级>速度>随机”的跨来源裁决，直接生效。遗物规则默认 absolute（否则同级敌人有一半概率无视你的“免疫”） | 全部遗物规则 |

测试 `tests/relic-primitives-0361.test.ts`（9 项，每条原语一项，含真实提交流程下的费用与回响）。
