import type {Obj} from './actors';
const record=(v:unknown):Obj=>v&&typeof v==='object'&&!Array.isArray(v)?v as Obj:{};
function text(v:unknown):string {if(typeof v==='string'||typeof v==='number')return String(v);if(Array.isArray(v))return v.map(text).join('；');return Object.entries(record(v)).map(([k,x])=>k+' '+text(x)).join('；');}
export function itemEffectText(raw:unknown):string {
  const r=record(raw),effects=r.战斗效果??r.使用效果??r.效果;
  return text(effects??r.描述??'').normalize('NFKC').trim();
}
/** This gate precedes both model requests and local replacement. Flavour, money and
 * progression ingredients must never turn into free invented combat actions. */
export function hasBattleItemEffect(raw:unknown):boolean {
  const r=record(raw),tags=text(r.标签),effect=itemEffectText(r);
  if(r.战斗效力===false||r.可战斗使用===false)return false;
  if(/盲盒|未开启|兑换券|法则源质|制作素材|剧情物品|收藏品|^材料$/.test(tags))return false;
  if(!effect||/^(?:无|没有|无效果|无战斗效果|none|暂无|[-—])$/i.test(effect))return false;
  if(/不可在战斗中|不能在战斗中|仅(?:限|可|能)?(?:在)?(?:非战斗|战斗外)|只能在战斗外|仅.*(?:剧情|收藏|任务|制作|锻造|交易|出售)|永久.*(?:上限|属性|等级|力量|敏捷)|(?:经验值|属性点|升级所需|突破境界|提升生命层级)/.test(effect))return false;
  if(/(?:没有|不具备|不提供|不产生|不含|无)(?:任何|实际|直接)?(?:战斗效力|战斗效果|战斗作用|战斗用途)|战斗(?:效果|效力|作用)[:：\s]*(?:无|没有|不适用)/.test(effect))return false;
  const recovery=/(?:恢复|回复|补充|补满|回满).{0,18}(?:生命|法力|魔力|体力|精力|\bHP\b|\bMP\b|\bSP\b)|(?:生命|法力|魔力|体力|精力|HP|MP|SP).{0,6}(?:恢复|回复)/i.test(effect);
  return recovery||/(?:治疗|复活|复苏|伤害|护盾|屏障|防御|护甲|命中|回避|暴击|速度|行动|施法|冷却|充能|蓄能|净化|解毒|驱散|中毒|眩晕|冻结|燃烧|流血|沉默|束缚|恐惧|魅惑|反射|抵挡|免疫|抗性|增益|减益|负面状态|负面效果|力量|敏捷|精神|智力|体质|召唤|退出(?:当前|本次)?远征|返回入口|\b(?:HP|MP|SP)\b)/i.test(effect);
}
export function isBattleConsumable(raw:unknown):boolean {return record(raw).类型==='消耗品'&&hasBattleItemEffect(raw);}
