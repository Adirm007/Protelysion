# 恶意机制原语补齐与定稿还原：0.34.0（2026-09-25）

回答一个问题：0.31–0.33 文档里标 ★ 的偏离，是不是引擎的死限制？**不是。** 全部是缺原语，本版把原语补进 `booksea-effects` 契约与执行器，然后把 ★ 条目按 §3/§4 定稿重写。UI 层三项也一并做了。

## 1. 新增原语（契约 + 执行器）

| 原语 | 契约位置 | 执行器行为 | 服务于 |
| --- | --- | --- | --- |
| 公式 `mod` 运算、`round` 读取 | `formula.ts` FormulaToken | `left % right`；`b.round` | T09 每 5 轮、T30 每 3 轮、T35/T37/T48、G7 每 4 轮 |
| 按累计伤害解除 `breakAfterDamage:{from,fraction}` | `Status`、`Rule` 效果 | `from: received`（持有者累计受伤）/ `dealt_to_source`（持有者对状态来源累计造成）/ `source_received`（状态来源累计受伤）；fraction 按被打者最大生命；规则状态同样适用 | T25 北辰熄灭（挨够 10% 才换人）、T32 瓶海收藏（打掉它 25% 放瓶） |
| 目标筛选 `highest_atb`、`highest_attack` | `Targeting.selection` | 按时钟 ATB / `max(力量,智力)×伤害倍率` 排序 | T05、T04、T25 |
| `atb rotate`、stat `atb_scale` | `Atb.mode`、`Modifier.stat` | 同阵营活跃单位 ATB 整体轮转 value 格（每帧一次）；push/retreat 乘以目标 `atb_scale` | T34 墓园旋转、T47 低重力 ×3 |
| `space swap_pair`、`status_transform swap_pair`、`space release` | `Space.mode`、`StatusTransform.mode` | 同一效果选中的两名目标互换位置 / 全部状态（帧内配对）；解除由施法者施加的隔离 | T10 零房拓扑、T30 两层状态互换、T06 轿子碎裂即回 |
| `choose.weights` | `Choose` | 加权抽取（无权重时随机序列不变） | T33 六面骰 |
| `alter_event redirect recipient:'random_any'` | `AlterEvent.recipient` | 全场随机活体 | T39 无始发站（含己方） |
| `shield_gained` 事件 | `TriggerPoint` | `shield` 效果结算后发出，`actual` = 盾值 | T19 复制同值护盾 |
| stat `crit_taken` | `Modifier.stat` | 暴击倍率乘以目标 `crit_taken` | T08 承受暴击 ×2 |
| 规则 `draft` | `Rule.rule` | 攻击者每个技能首次使用 ×0.3 并给目标留“线稿”；对带线稿者的下一击 ×key 必中并消线稿 | T22 未完树稿 |
| 规则 `repeat_seal` | `Rule.rule` | 同一非指令技能用到第 key 次即封（`sealed` 永久）；用一个本场首次使用的技能时全部解封 | T27 永不毕业 |
| 规则 `blank_page` | `Rule.rule` + `selection` | 结算时若命令技能 = 规则 key，命令作废（费用已付）并消耗规则 | T15 无字著述 |
| 规则 `buff_cap` / `debuff_cap` | `Rule.rule` | `addStatus` 时把持有者的增益 / 负面时长压到 key 轮（中性状态按修正方向推断增减益） | T12 永冬圣谕 |
| 规则 `element_rewrite` | `Rule.rule` + `selection` | key = `技能|属性`；攻击者用该技能时伤害属性改写 | T46 彩噪 |
| `Rule.selection` | `Rule` 效果 | 与 `uses.selection` 同源（`pickBySelection`），按目标使用记录选技能 | T15、T46 |

其余定稿还原不需要新原语，只是之前没用对现有能力：状态标签可作为目标筛选（`tags` / `excludeTags` 命中状态标签）→ T04 “其他人”、T17 “不在登机口”、T48 “同一个目标三步”、T13 扎根者退条；效果级 `conditions` 按目标逐个评估 → T29/T30 按半血分层；`onHitAction` 携带命中事件 → T29 析出量即盾值；`variable` 随 `time delay` 排期 → G1 两轮后按原量回声；`counter` + 公式读取 → T31/T35/T37 真实记账；`death_guard.onTrigger` 上下文带原事件 → T03 原样转走；`link.members` 可随机两人 → T45。

## 2. 按定稿重写的条目

G1 回声债（2 轮后按记录量回声）、G7 双生（每 4 轮再分裂）、T03、T04（攻击最高 + 其他人 + 每 5 轮转冠）、T05、T06（先下聘 3/4 轮 → 隔离 + 轿子，轿子碎裂 `space release`）、T08、T09、T10、T12、T13（每轮 −50 退条）、T15、T17、T19、T21（公开计数）、T22、T25、T26（租金交给蜂后、每租客 −10% 承伤、满员双动）、T27、T29（析出即盾值、半血以下 ×1.5）、T30（全队分层 + 两层互换）、T31（雨债记账、均摊）、T32、T33（权重 1/2/2/1，2–3 沉默 + 减速）、T34、T35（记账不结算、÷存活人数结算、账单 30% 全体）、T37（账本记账、30% 回复、30% 均摊）、T39、T45（两人、一方倒下另一方变 1）、T46、T47（推退条 ×2/×3）、T48（随机目标）。

仍与定稿有细微差别的两处（不影响玩法方向）：T44 “入库期间状态时钟暂停”未做（隔离一轮后清空全部状态，效果更强）；T23 “它只打链接内目标”本来就成立。

## 3. UI（`expedition.view` → `battle-stage` / `expedition-ui`）

- 状态名自动后缀：`scope==='run'` 或探索时钟 → “（本次迷宫内）”；带 `monster:timer` 标签或失控 / 隔离 / 时停 / 眩晕 / 沉默的按轮状态 → “·N轮”。
- 失控：单位视图新增 `charmed`，战斗徽章显示“⇄失控”，面板标题注明“失控中（由敌方操控）”。
- 公开计数：单位视图新增 `counters`（十三地基·治疗反转 / 暴击反转、雨债、鲸梦账单、地心账本、潮汐等），战斗徽章与面板“公开计数”行直接显示。

## 4. 测试

- `tests/primitives-034.test.ts`（新，10 项）：mod/round；highest_atb/highest_attack；crit_taken；breakAfterDamage 两种口径；atb rotate / atb_scale；buff_cap；真实提交流程下的 repeat_seal、blank_page、draft；新增枚举契约校验。
- `tests/monster-kits.test.ts`：闲置函数改为分步推进并停用途中出现的召唤物（G7 每 4 轮分裂后公共时间仍在走）。
- `tests/theme-malice-shared.ts`：隔离允许“1–3 轮或同动作内可解除”。
- 全量：见 §5。

## 5. 数字

- `npm run check`：1202 / 1202（0.33.0 为 1192，新增 10 项）；墙检查记录 146（基线 453）。
- 版本 0.34.0，revision `protelysion-0.34.0-20260925-malice-primitives`，`booksea-monsters/0.24.0`。
