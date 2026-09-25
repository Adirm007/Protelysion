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

- R20 回响之弦、R27 血税印、R30/R31 护身符、R32 复读机、R42 惰性齿轮、R44 白纸、R46 忍耐之环、R47 棱镜、R56 破戒：设计表中我补的这几条原文需要“按次数计费 / 按 HP 区间切换 / 复制上一动作”等新原语，本版改成等价强度的现有修正（见 relic-catalog 描述字段，设计表已同步）。用户给出的 25 条全部按原文实现。
- 事件的“随机品质盲盒”按几何分布抽（普通最常见、传说最少）。
