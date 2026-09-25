# 特殊单位「?」实施记录：0.35.0（2026-09-25）

用户需求原文见本次对话；本文记录落点、与需求的逐条对应、以及素材 / 音频接入方式。

## 1. 逐条对应

| 需求 | 落点 |
| --- | --- |
| 单位名 `?` | `src/game/monsters/stray.ts`：`STRAY_ID='COMMON_STRAY'`，`STRAY_NAME='?'`；`content.ts` 的 `FOES` 注册（shape `ghost`）。 |
| 面板比队伍最高等级 +1 | `expedition.enterBattle`：`strayLevel = max(party.card.numeric.level) + 1`，套件以该等级生成，`combatLevel` 也用它（不受 25 上限影响）。 |
| 无 / 精抗性 0，其余 1.0 | `strayKit`：`mitigation.elementMultipliers` 置 `无:0, 精:0`；同时本质被动上 `immune_element '无'` 与 `'精'` 两条规则（引擎对“无”恒 1，所以用规则保证无效）。她若复制到玩家改抗性的技能，正常被动影响。 |
| 百分比伤害全额反转为治疗（先于抗性） | 新规则 `percent_to_heal`：`resolveHit` 在减免与抗性之前检测任一通道带 `maxFraction / currentFraction`，把未减免的原始量作为治疗给她，伤害不落地。 |
| 真实伤害全额反射给来源（先于抗性） | 新规则 `true_reflect`：`resolveHit` 在减免前取真实通道原始量，用 `bypass:['shield','reduction']`、必中、可致死的真实伤害打回攻击者（`replayDepth` 防递归）；其余通道照常结算。一千万打过去 → 一千万弹回。 |
| 敌方无法挂上任何效果 | 本质被动 `immune_status '*'` + 执行器新守卫 `hostileBlocked`：敌对阵营的 `apply_status / modify / rule / shield / speed` 全部拦下（隔离、时停原本就查 immune_status）。己方与自身效果不受影响。 |
| 属性对抗 / 豁免默认成功 | 战斗系统有：`checkRoll`（`check` 效果、带 `opposedAttribute` 的状态）。本质被动 `luck 'best'`（无限次）→ 她发起的检定必成功；针对她的对抗因免疫直接不发生。 |
| 技能组：复制持有百分比 / 真实伤害技能成员的全部主动与被动 | `carriesTargetDamage(card)` 扫描每张卡的主动、被动、子动作与库内动作；命中者的 `card.skills` 整体克隆（sourceId 前缀 `stray/<i>/`）。她的 MP/SP 不低于被复制者 ×2、五维不低于被复制者，保证付得起打得出。AI 沿用 `decide()` 的效用评分（威力最大、局势最优）。 |
| 无人持有 → 只有飞刀 | `knife()`：物理远程普攻（射程 6，命中 95%，暴击 15%）。 |
| 个位 9 楼层 50% 刷新在 9 格外 | `newDepth` → `strayFloor(depth)`（`depth % 10 === 9`）→ `rng < .5` → `spawnStray`：BFS 最短路径距离表，取恰好 9 格的可行走空格（没有则取 ≥9 最近；再没有则最远格）。 |
| 与玩家同速沿最短路径追逐 | `move()` 每当玩家成功走一步 → `strayStep()`：她沿 BFS 距离下降方向走一步（不受隐匿影响，不走敌人 / 宝箱占格，可穿过入口 / 楼梯 / 事件点）；到达玩家格即 `enterBattle`。`tickExploration` 的巡逻 AI 跳过她。 |
| 换层 / 离开迷宫摆脱 | 她只存在于当前 `region.things`，`newDepth` 重建楼层即消失。 |
| 追上后普通逃跑为零 | `flee()`：遭遇物带 `hunter` 时直接拒绝；间章等 `retreat` 效果走 `exitTeleported` 不受影响。 |
| 必掉盲盒 + 经验 | `battleDrops`：`hunter` 分支必加一个 `box`（品质 = `levelQuality(她的等级)`）；经验走 `awardVictory`（按她的真实等级）。 |
| 小概率掉「暧昧的线」 | 同分支 6%：`material` 奖励，`quality:'神话'`，`effect:'可以转为任何想要的素材，也许就连源质也……'`，`description:'尚未成型，排布成字的笔画，因此，也有可以成为任何名作的可能性'`；与「价值的结晶」同一条通路，成功撤离时写入宿主背包，转化方式交给读者。 |
| 战斗立绘 / 行走图 | 立绘原图已透明，直接进 `16-Godot可玩区域/godot/monsters/portraits/COMMON_STRAY.png`；行走图 3×4 白底 → 键出 alpha、去除碎片、按格对齐脚底 → `godot/monsters/shared/stray-walker.png`（cell 224×320，down/left/right/up，walk `[0,1,2,1]`，idle 1）。`manifest.json` 新增角色 `COMMON_STRAY`（battle + walker）。 |
| 地图上真正会走 | `monster_art.gd`：`walker` 条目走 AtlasTexture 分帧（`texture(id,'map',index)` / `frame_for` 按朝向与行走时钟取帧）；`game.gd` 对 walker 不做漂浮书页的上下浮动，落地 y=0.02。朝向由 `_present` 中已有的位移判定给出。 |
| 战斗 BGM | `21-音频制作/audio-plan.json` 新增 `ToEverythingThereIsSeason`（M-ART，含作者循环点）与 `monsters.COMMON_STRAY.music`；`prepare_audio.py` 增量下载、测响度、出 mp3；`ScoreDirector.select` 新增“任一敌人声明 music 即整场专属曲”（优先于层级池）；`validateAudioManifest` 校验该曲存在。 |

## 2. 引擎改动清单

- `contract.ts`：`Rule.rule` 增 `percent_to_heal`、`true_reflect`。
- `executor.ts`：`resolveHit` 顶部新增两条先于抗性的规则分支；`hostileBlocked()` 守卫接入 `addStatus / shield / speed`。
- `region.ts`：`Thing.hunter?: boolean`。
- `expedition.ts`：`distanceMap / spawnStray / strayStep`（后两者导出供测试）、`newDepth` 刷新、`move` 追逐、`tickExploration` 跳过、`enterBattle` 专属套件与等级、`flee` 拒绝、`battleDrops` 掉落。
- `audio/policy.ts`、`audio/types.ts`：怪物专属曲。
- `ui/ability-text.ts`：两条新规则文案。

## 3. 测试

`tests/stray-035.test.ts`（6 项）：套件形态与抗性；复制规则（只复制有资格者、含被动、资源下限）；战斗规则（比例→治疗、真实 1e7 原样弹回且她不掉血、无 / 精无效、物 / 火正常、敌方效果挂不上）；遭遇（刷新距离 ≥9、逐步逼近、追上开战、等级 = 最高 +1、普通逃跑无效且不消耗行动）；掉落（必掉盲盒）；BGM 选曲。
既有测试更新：音频清单 123→124 曲、怪物条目按 `T\d\d_` 计数并跳过专属曲单位、`FOES` 433→434、十五层集成跑法允许多出「?」这一场。

## 4. 数字

- `npm run check`：1209 / 1209（0.34.0 为 1202，新增 6 项，另有 1 项因 `?` 加入而改写计数）。
- 版本 0.35.0，revision `protelysion-0.35.0-20260925-stray-question`，`booksea-monsters/0.25.0`，音频 124 曲。

## 5. 未尽

- 「暧昧的线」的“转化”发生在宿主 / 读者侧（与「价值的结晶」一致），书海内不提供转化界面。
- 她复制的是进入战斗那一刻的卡（含遗物被动）；战斗中玩家学到的新技能不追加。
