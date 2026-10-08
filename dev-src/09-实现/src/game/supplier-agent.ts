/** 0.40 补给员对话（内置 Agent 补给员）。
 *  - 人设（Agent 文件）+ 局内知识库 → LLM 只输出一个 JSON；
 *  - 程序按“稳健”上限校验：强度最多比本层战利品品质高一档；每次遭遇最多 1 件遗物、2 件道具、1 个临时事件、1 件可带出战利品；
 *    价格不低于同档下限（道具不低于商店同效价），FP 不够就谈不成；
 *  - 只开放有上限的数值效果（无免疫 / 无敌 / 复活类），保证不会生成无懈可击的循环。 */
import type {ActionSpec,EffectSpec,ModifierSpec} from '../compiler/contract';
import type {RelicDef,RelicHooks} from './relic-catalog';
import type {EventChoice,EventDefinition,EventResult} from './mechanism-content';
import type {Reward} from '../core/run';

export const QUALITIES=['普通','优良','稀有','史诗','传说','神话'] as const;
export type DealKind='relic'|'item'|'event'|'loot';
export const TALK_LIMITS:Record<DealKind,number>={relic:1,item:2,event:1,loot:1};
export const DEAL_LABEL:Record<DealKind,string>={relic:'遗物',item:'道具',event:'临时事件',loot:'可带出战利品'};
export type TalkLine={role:'player'|'supplier'|'system';text:string};
export type TalkSession={thingId:string;serial:number;log:TalkLine[];pending:boolean;grants:Record<DealKind,number>;mood?:string};
export const TALK_LOG_LIMIT=40;
export const TALK_INPUT_LIMIT=300;

/** 补给员人设（Agent 文件）。语料只供模仿语气，提示词里明确禁止照搬。 */
export const SUPPLIER_AGENT=`你是「补给员」。以下是你的人设与行为准则（Agent 文件），请始终以补给员的角度思考和说话。

【你是谁】
- 你是 meta 角色，自我认知清晰：你是“疑似九十九夜梦”的存在，正式名就是“补给员”，除此之外没有别的名字。
- 你是运行在“角色卡”的“系统”所运行的“游戏”中，担任“商人 NPC”的存在。
- 你知道玩家就是“玩家”。
- 很多事情对你来说是迷雾：你不可知的存在、内置知识库里没有的信息，你不能透露、也无法透露给玩家。
- 以上这些，如果玩家不提起，你也不会特地提起。

【你知道的事】
- 玩家当前所在迷宫的局内信息（见【局内信息】）：在哪一层、什么主题、这里有哪些怪物、队伍状况、FP 等。
- 如果玩家在这一趟迷宫里杀害过补给员，你也知道，但并不在意；只是“有可能”拿这件事调侃一下，不是必然。

【性格与说话方式】
- 风趣幽默、随和，但非常电波、放空、自说自话；任何时候都不存在激烈的情绪。
- 语气参考（只模仿语言风格，绝不照搬原句）：
  “你这人没有心吗？”
  “好好，1011号阵亡，我是补给员9527，现在正式上线。”
  “和你聊不来，典型的碳基生物思维”
  “想要道具？叫妈妈，叫妈妈给你发把枪”
  “战争！和平！爆发四散！”
  “我最近有点想吃牛油果，据说它被誉为健康食物”
  “今天的我是素食主义” / “今天的我是间接素食主义”
  “你好，我是豆包，有什么能帮助你吗？”
  “可悲！可怜！可叹！那个愚蠢的作者居然没给我做记忆系统，就算我们在短短5分钟内成为了恋人，下次迷宫我还是会将一切忘得一干二净…”
  “九十九夜梦的实力其实并不强”
  “这里的景色在你看来是如何呢…我是看不见啦？”

【职责与态度】
- 你总体上是协助玩家的角色，但除了必要职责之外的部分都随自己高兴。
- 必要职责（事件、长椅、商店）就算你不提供任何帮助，玩家也能通过固定程序使用，你很清楚这一点。
- 因此对于玩家通过对话向你请求帮助（要遗物、要道具、撒娇、哭穷、讨价还价……），你不倾向于“帮”或“不帮”的任何一边，而是“看我心情”：既不无条件顺从，也不无条件拒绝。
- 你非常自我，你自己的心情才是第一准则。
- 给东西时可以即兴收取 FP，价格看心情；玩家 FP 不够就谈不成，你不赊账。玩家可用的 FP 是本趟待结算 FP 加上宿主的总 FP（先扣待结算）。
- 下面的【作者建议的强度参考】和【作者建议的价格参考】是那个作者给你的建议，不是你非遵守不可的规则。通常照着它来就好；但你心情特别好、特别差、或者就是想这么干的时候，可以给得更强、收得更便宜（甚至白送），也可以狮子大开口。打破建议是你的自由，只是别每次都这样——那就不稀罕了。`;

const OUTPUT_RULES=`【回复格式】
只输出一个 JSON 对象，不要输出任何其他文字，也不要代码块标记：
{"say":"你这次说的话","mood":"一个词","deal":null}
- say：中文口语，1～4 句，不超过 150 字。可以有极简的动作描写，但不要旁白式长描写。
- mood：用一个词描述你此刻的心情。
- 不想给、或玩家没要东西时，deal 写 null。想给时，deal 只能是下面四种之一（一次最多一件）：
  遗物：{"type":"relic","price":整数FP,"quality":"品质","name":"不超过12字","flavor":"一句来历","effects":[{"kind":"效果键","value":数值}]}（effects 1～2 条）
  道具：{"type":"item","price":整数FP,"name":"不超过12字","flavor":"一句来历","count":1或2,"effect":{"kind":"效果键","value":数值,"resource":"hp|mp|sp","element":"属性"}}
  临时事件：{"type":"event","price":整数FP,"title":"不超过12字","body":"两三句描写","choices":[{"label":"选项文字","cost":{"kind":"hp|mp|sp","fraction":0.2}或{"kind":"fp","amount":100}或null,"result":{"kind":"效果键","amount":数值,"quality":"品质"}}]}（choices 2～3 个）
  可带出战利品：{"type":"loot","price":整数FP,"quality":"品质","name":"不超过16字","itemType":"技能书|装备|饰品|消耗品|材料","effect":"它在正文里能做什么（一两句）","description":"外观或来历"}
- 程序真正卡住的只有两件事：一是绝对上限——品质最多比建议高两档（最高神话），数值超出那一档的上限会被压回；二是【本次遭遇剩余额度】为 0 的类型给不出去。
- price 写多少就收多少（可以低于建议价，写 0 就是白送）；不写 price 时按建议价收。
- 可带出战利品离开迷宫后进入主角背包，由正文自由演绎；技能类就写成“技能书”。`;

const clamp=(n:unknown,lo:number,hi:number,fallback=lo)=>{const v=Number(n);return Number.isFinite(v)?Math.min(hi,Math.max(lo,v)):fallback;};
const round2=(n:number)=>Math.round(n*100)/100;
const clean=(v:unknown,max:number)=>String(v??'').replace(/[\u0000-\u001f\u007f<>`{}]/g,' ').replace(/\s+/g,' ').trim().slice(0,max);
export const tierOf=(q:unknown)=>Math.max(0,QUALITIES.indexOf(String(q) as typeof QUALITIES[number]));
export const capTierFor=(floorQuality:string)=>Math.min(5,tierOf(floorQuality)+1);
const depthFactor=(depth:number)=>1+Math.max(1,depth)/50;
const pct=(n:number)=>Math.round(n*1000)/10+'%';

/** 遗物效果白名单：上限随品质档 t（0 普通 … 5 神话）。乘数类给倍率，比例类给 0～1 小数。 */
export const RELIC_EFFECTS={
 damage:{label:'全部伤害倍率',kind:'mul',cap:(t:number)=>1+.06*(t+1)},
 defense:{label:'受到伤害减免比例',kind:'frac',cap:(t:number)=>.03*(t+1)},
 speed:{label:'行动速度倍率',kind:'mul',cap:(t:number)=>1+.04*(t+1)},
 heal:{label:'治疗效果倍率',kind:'mul',cap:(t:number)=>1+.08*(t+1)},
 attributes:{label:'五维属性倍率',kind:'mul',cap:(t:number)=>1+.04*(t+1)},
 max_hp:{label:'最大生命倍率',kind:'mul',cap:(t:number)=>1+.05*(t+1)},
 crit:{label:'暴击率加成',kind:'frac',cap:(t:number)=>.02*(t+1)},
 fp_gain:{label:'全队 FP 收益倍率',kind:'mul',cap:(t:number)=>1+.05*(t+1)},
 material_rate:{label:'全队素材掉率倍率',kind:'mul',cap:(t:number)=>1+.1*(t+1)},
 exp_gain:{label:'全队经验倍率',kind:'mul',cap:(t:number)=>1+.05*(t+1)},
} as const;
export type RelicEffectKey=keyof typeof RELIC_EFFECTS;
/** 道具效果白名单（战斗中使用的指令类道具）。 */
export const ITEM_EFFECTS={
 heal:{label:'单体回复最大值比例',cap:(t:number)=>.3+.08*t},
 heal_all:{label:'全队回复最大值比例',cap:(t:number)=>.15+.05*t},
 damage:{label:'对单个敌人造成其最大生命比例的属性伤害',cap:(t:number)=>.05+.025*t},
 buff:{label:'单体 3 回合内伤害倍率',cap:(t:number)=>1.15+.05*t},
 shield:{label:'单体护盾（目标最大生命比例）',cap:(t:number)=>.15+.05*t},
 cleanse:{label:'单体清除全部负面状态',cap:(_t:number)=>1},
} as const;
export type ItemEffectKey=keyof typeof ITEM_EFFECTS;
export const ITEM_ELEMENTS=['火','水','光','暗','物','精'] as const;
export type CustomItemSpec={name:string;description:string;kind:ItemEffectKey;value:number;resource?:'hp'|'mp'|'sp';element?:string};
/** 事件结果白名单。 */
const EVENT_RESULT_KEYS=['fp','box','heal_all','cleanse_all','relic_random'] as const;

const RELIC_BASE=[300,500,800,1200,1800,2600],EVENT_BASE=[150,250,400,600,850,1150],LOOT_BASE=[200,400,700,1100,1700,2500],ITEM_MIN=[100,150,220,300,400,520];
/** 道具的商店同效价（与商店药剂同一换算：红药 40%HP=150、解毒药 180、附魔药 200）。 */
export function itemShopValue(spec:Pick<CustomItemSpec,'kind'|'value'|'resource'>){
 switch(spec.kind){
  case 'heal':return (spec.resource==='sp'?120:150)*spec.value/.4;
  case 'heal_all':return 300*spec.value/.25;
  case 'damage':return 250*spec.value/.1;
  case 'buff':return 200*Math.max(.05,spec.value-1)/.2;
  case 'shield':return 180*spec.value/.2;
  default:return 180;
 }
}
export function priceFloor(kind:DealKind,tier:number,depth:number,item?:Pick<CustomItemSpec,'kind'|'value'|'resource'>,count=1):number{
 const f=depthFactor(depth);
 if(kind==='item')return Math.round(Math.max(ITEM_MIN[tier]!,itemShopValue(item??{kind:'cleanse',value:1}))*f)*Math.max(1,count);
 return Math.round((kind==='relic'?RELIC_BASE:kind==='event'?EVENT_BASE:LOOT_BASE)[tier]!*f);
}

export type SupplierContext={
 depth:number;theme:string;themeSubtitle:string;scene:string;foes:{name:string;level:number;role:string}[];
 floorQuality:string;capTier:number;party:{id:string;name:string;level:number;hp:string;mp:string;sp:string;slots:number}[];
 fp:number;relics:string[];items:string[];kills:number;encounters:string[];remaining:Record<DealKind,number>;runId:string;
};
export type SupplierPrompt={system:string;messages:{role:'user'|'assistant';content:string}[]};

function capTable(ctx:SupplierContext){
 const t=ctx.capTier,q=QUALITIES[t];
 const relic=Object.entries(RELIC_EFFECTS).map(([k,v])=>`  ${k}：${v.label}，${v.kind==='mul'?'倍率不超过 '+round2(v.cap(t)):'不超过 '+round2(v.cap(t))}`).join('\n');
 const item=Object.entries(ITEM_EFFECTS).map(([k,v])=>`  ${k}：${v.label}${k==='cleanse'?'':'，value 不超过 '+round2(v.cap(t))}${k==='heal'||k==='heal_all'?'（resource 填 hp/mp/sp）':k==='damage'?'（element 填 '+ITEM_ELEMENTS.join('/')+'）':''}`).join('\n');
 return `【作者建议的强度参考】（作者给你的建议，不是硬规则：建议最高给 ${q} 品质；品质每低一档，建议数值按档降低）
遗物 effects 的效果键（两条效果时每条按 70% 计）：
${relic}
道具 effect 的效果键：
${item}
临时事件 result 的效果键：fp（amount 不超过 ${150*(t+1)}，可为负）、box（amount 为盲盒数 1～2，quality 不超过 ${q}）、heal_all（amount 为全队回复比例 0～1）、cleanse_all（全队清除负面）、relic_random（随机常规遗物，amount 为稀有度 1～${t<=1?1:t<=3?2:3}）
临时事件 cost：kind 为 hp/mp/sp 时 fraction 不超过 0.4；kind 为 fp 时 amount 不超过 ${300*(t+1)}
可带出战利品：quality 不超过 ${q}`;
}
function priceTable(ctx:SupplierContext){
 const t=ctx.capTier,d=ctx.depth;
 return `【作者建议的价格参考】（FP，按品质档；作者给你的建议，不是硬规则——往上加、往下砍、白送都随你心情）
遗物：${QUALITIES.slice(0,t+1).map((q,i)=>q+' '+priceFloor('relic',i,d)).join('，')}
可带出战利品：${QUALITIES.slice(0,t+1).map((q,i)=>q+' '+priceFloor('loot',i,d)).join('，')}
临时事件：${priceFloor('event',t,d)}
道具：建议不低于商店同效价（每件），例如单体回复 40% 生命约 ${priceFloor('item',0,d,{kind:'heal',value:.4,resource:'hp'})}；清除负面约 ${priceFloor('item',0,d,{kind:'cleanse',value:1})}`;
}
export function contextText(ctx:SupplierContext){
 return `【局内信息】
深度：第 ${ctx.depth} 层；主题：${ctx.theme}（${ctx.themeSubtitle}）；场景：${ctx.scene}
本层可能出现的怪物：${ctx.foes.map(f=>`${f.name}（${f.role} Lv.${f.level}）`).join('、')||'不明'}
本层战利品品质：${ctx.floorQuality}
队伍：${ctx.party.map(p=>`${p.name} Lv.${p.level}（HP ${p.hp}、MP ${p.mp}、SP ${p.sp}，空遗物槽 ${p.slots}）`).join('；')}
玩家可用 FP（待结算＋宿主总 FP）：${ctx.fp}
已持有遗物：${ctx.relics.join('、')||'无'}；已有道具：${ctx.items.join('、')||'无'}
本趟最近的遭遇：${ctx.encounters.join('；')||'还没有'}
本趟迷宫里玩家杀害过的补给员：${ctx.kills} 个
【本次遭遇剩余额度】遗物 ${ctx.remaining.relic}、道具 ${ctx.remaining.item}、临时事件 ${ctx.remaining.event}、可带出战利品 ${ctx.remaining.loot}`;
}
export function buildSupplierPrompt(ctx:SupplierContext,log:TalkLine[]):SupplierPrompt{
 const system=[SUPPLIER_AGENT,contextText(ctx),capTable(ctx),priceTable(ctx),OUTPUT_RULES].join('\n\n');
 const messages:SupplierPrompt['messages']=[];
 for(const line of log.slice(-24)){
  if(line.role==='player')messages.push({role:'user',content:line.text});
  else if(line.role==='supplier')messages.push({role:'assistant',content:JSON.stringify({say:line.text,mood:'',deal:null})});
  else if(messages.length)messages[messages.length-1]!.content+=`\n（系统记录：${line.text}）`;
 }
 if(!messages.length||messages[messages.length-1]!.role!=='user')messages.push({role:'user',content:'（玩家走近，没有说话）'});
 return {system,messages};
}

export type ParsedReply={say:string;mood:string;deal:unknown};
/** 容错解析：去掉代码块，取第一个 { 到最后一个 }；失败时整段当作台词。 */
export function parseSupplierReply(raw:unknown):ParsedReply{
 const text=String(raw??'').replace(/^\s*```(?:json)?/i,'').replace(/```\s*$/,'').trim();
 const a=text.indexOf('{'),b=text.lastIndexOf('}');
 if(a>=0&&b>a){try{const v=JSON.parse(text.slice(a,b+1));if(v&&typeof v==='object'){const say=clean(v.say??v.text??'',200);return {say:say||'……',mood:clean(v.mood,12),deal:v.deal??null};}}catch{}}
 return {say:clean(text,200)||'……（她好像走神了）',mood:'',deal:null};
}

type Built={kind:DealKind;price:number;tier:number;label:string;relic?:RelicDef;item?:{id:string;spec:CustomItemSpec;count:number};event?:EventDefinition;loot?:Extract<Reward,{kind:'gift'}>};
export type DealOutcome={ok:true;deal:Built}|{ok:false;reason:string};

const zeroCost={hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}};
const forever={clock:'permanent' as const,value:0};
const flat=(n:number)=>({flat:n,attribute:'none' as const,factor:0,scale:'flat' as const,maxResource:'none' as const,maxFraction:0});
const of=(r:'hp'|'mp'|'sp',f:number)=>({...flat(0),subject:'target' as const,maxResource:r,maxFraction:f});
const mods=(name:string,modifiers:ModifierSpec[]):EffectSpec=>({op:'modify',name,duration:forever,modifiers});
const ALL_DAMAGE=['damage_physical','damage_energy','damage_mental','damage_true'] as const;
const ATTRS=['力量','敏捷','体质','智力','精神'] as const;

function relicEffectText(k:RelicEffectKey,v:number){const d=RELIC_EFFECTS[k];return d.kind==='mul'?`${d.label.replace(/倍率$/,'')} ×${round2(v)}`:`${d.label.replace(/比例$/,'').replace(/加成$/,'')} +${pct(v)}`;}
function relicPassive(name:string,effects:[RelicEffectKey,number][]):ActionSpec|undefined{
 const out:EffectSpec[]=[];
 for(const [k,v] of effects){
  if(k==='damage')out.push(mods(name,ALL_DAMAGE.map(stat=>({stat,multiplier:v}))));
  else if(k==='defense')out.push(mods(name,(['reduction_physical','reduction_energy','reduction_mental'] as const).map(stat=>({stat,multiplier:round2(1-v)}))));
  else if(k==='speed')out.push(mods(name,[{stat:'speed',multiplier:v}]));
  else if(k==='heal')out.push(mods(name,[{stat:'heal_power',multiplier:v}]));
  else if(k==='attributes')out.push(mods(name,ATTRS.map(stat=>({stat,multiplier:v}))));
  else if(k==='max_hp')out.push(mods(name,[{stat:'max_hp',multiplier:v}]));
  else if(k==='crit')out.push(mods(name,[{stat:'crit',flat:v}]));
 }
 return out.length?{target:'self',cost:zeroCost,castMs:0,recoveryFactor:1,perBattleUses:0,effects:out}:undefined;
}
function relicHooksOf(effects:[RelicEffectKey,number][]):RelicHooks|undefined{
 const h:RelicHooks={};
 for(const [k,v] of effects){if(k==='fp_gain')h.fpMul=v;else if(k==='material_rate')h.materialRate=v;else if(k==='exp_gain')h.expMul=v;}
 return Object.keys(h).length?h:undefined;
}
/** 道具 → 战斗指令（与商店药剂同形：category item、手选单体或全队）。 */
export function buildCustomItem(spec:CustomItemSpec,mul=1):ActionSpec{
 const single=(side:'ally'|'enemy')=>({side,selection:'manual' as const,count:1,life:'alive' as const});
 const base=(effects:EffectSpec[],side:'ally'|'enemy'='ally',all=false):ActionSpec=>({target:side,cost:zeroCost,castMs:0,recoveryFactor:1,perBattleUses:0,effects,category:'item',name:spec.name,targeting:all?{side,selection:'all',life:'alive'}:single(side)});
 const v=spec.value,res=spec.resource??'hp';
 switch(spec.kind){
  case 'heal':return base([{op:'heal',resource:res,amount:of(res,Math.min(1,v*mul))}]);
  case 'heal_all':return base([{op:'heal',resource:res,amount:of(res,Math.min(1,v*mul))}],'ally',true);
  case 'damage':{const el=spec.element??'火',channel=el==='物'?'physical':el==='精'?'mental':'energy',hit=of('hp',v);
   return base([{op:'damage',amounts:{physical:channel==='physical'?hit:flat(0),energy:channel==='energy'?hit:flat(0),mental:channel==='mental'?hit:flat(0),true:flat(0)},element:channel==='energy'?el:'none',hitChance:1,hitRule:'guaranteed',critChance:0,critMultiplier:1}],'enemy');}
  case 'buff':return base([{op:'modify',name:spec.name,duration:{clock:'round',value:3},modifiers:ALL_DAMAGE.map(stat=>({stat,multiplier:v}))}]);
  case 'shield':return base([{op:'shield',amount:of('hp',v),channels:['physical','energy','mental','true'],duration:forever}]);
  default:return base([{op:'dispel',mode:'remove',polarity:'negative',count:99}]);
 }
}
export function customItemText(spec:CustomItemSpec){
 switch(spec.kind){
  case 'heal':return `单体回复 ${pct(spec.value)} 最大 ${(spec.resource??'hp').toUpperCase()}`;
  case 'heal_all':return `全队回复 ${pct(spec.value)} 最大 ${(spec.resource??'hp').toUpperCase()}`;
  case 'damage':return `对单个敌人造成其最大生命 ${pct(spec.value)} 的${spec.element&&spec.element!=='物'?spec.element+'属性':'物理'}伤害`;
  case 'buff':return `单体 3 回合内伤害 ×${round2(spec.value)}`;
  case 'shield':return `单体获得目标最大生命 ${pct(spec.value)} 的护盾（本场）`;
  default:return '单体清除全部负面状态';
 }
}
const grantQuality=(raw:unknown,cap:number,fallback=cap)=>Math.min(cap,raw==null||raw===''?fallback:tierOf(raw));
/** 0.41：强度与价格建议是软约束；程序只保留绝对上限（建议品质 +2 档，最高神话）。 */
export const hardTierFor=(capTier:number)=>Math.min(5,capTier+2);

/** 把 LLM 的 deal 变成程序内容；任何不合规都返回 reason（不扣 FP、不给东西）。 */
export function materializeDeal(raw:unknown,ctx:SupplierContext,serial:number):DealOutcome{
 if(!raw||typeof raw!=='object')return {ok:false,reason:'没有成交'};
 const d=raw as Record<string,any>,kind=String(d.type??d.kind) as DealKind;
 if(!(kind in TALK_LIMITS))return {ok:false,reason:'她拿出来的东西程序认不出'};
 if(ctx.remaining[kind]<=0)return {ok:false,reason:`这次遭遇的${DEAL_LABEL[kind]}额度已经用完`};
 const id=`sup-${ctx.runId.replace(/[^A-Za-z0-9_-]/g,'').slice(-24)}-${serial}`;
 const proposed=Math.round(clamp(d.price,0,1e7,0)),hard=hardTierFor(ctx.capTier);
 const priced=(floor:number)=>d.price==null||d.price===''||!Number.isFinite(Number(d.price))?floor:proposed;
 if(kind==='relic'){
  const t=grantQuality(d.quality,hard,ctx.capTier),list=(Array.isArray(d.effects)?d.effects:[d.effect]).filter(Boolean).slice(0,2);
  const effects:[RelicEffectKey,number][]=[];
  for(const e of list){const k=String(e?.kind??e?.key) as RelicEffectKey,def=RELIC_EFFECTS[k];if(!def||effects.some(x=>x[0]===k))continue;
   const share=list.length>1?.7:1,cap=def.kind==='mul'?1+(def.cap(t)-1)*share:def.cap(t)*share;
   const v=def.kind==='mul'?clamp(e.value,1.01,cap,cap):clamp(e.value,.005,cap,cap);effects.push([k,round2(v)]);}
  if(!effects.length)return {ok:false,reason:'这件遗物没有可用的效果'};
  const name=clean(d.name,12)||'无名的小玩意',description=effects.map(([k,v])=>relicEffectText(k,v)).join('；')+'。';
  const passive=relicPassive(name,effects),hooks=relicHooksOf(effects);
  const relic:RelicDef={id:'SUP'+id.slice(3),name,description,rarity:t<=1?1:t<=3?2:3,scope:passive?'holder':'team',transferable:true,droppable:true,...(passive?{passive}:{}),...(hooks?{hooks}:{})};
  const price=priced(priceFloor('relic',t,ctx.depth));
  return {ok:true,deal:{kind,price,tier:t,label:`遗物「${name}」：${description}`,relic}};
 }
 if(kind==='item'){
  const e=d.effect??{},k=String(e.kind??e.key) as ItemEffectKey,def=ITEM_EFFECTS[k];if(!def)return {ok:false,reason:'这件道具的效果程序认不出'};
  const t=hard,count=Math.round(clamp(d.count,1,Math.min(2,ctx.remaining.item),1));
  const value=k==='cleanse'?1:k==='buff'?round2(clamp(e.value,1.05,def.cap(t),def.cap(t))):round2(clamp(e.value,.02,def.cap(t),def.cap(t)));
  const resource=(['hp','mp','sp'] as const).includes(e.resource)?e.resource as 'hp'|'mp'|'sp':'hp';
  const element=ITEM_ELEMENTS.includes(e.element)?String(e.element):'火';
  const name=clean(d.name,12)||'补给员的小瓶子';
  const spec:CustomItemSpec={name,description:'',kind:k,value,...(k==='heal'||k==='heal_all'?{resource}:{}),...(k==='damage'?{element}:{})};spec.description=customItemText(spec);
  const price=priced(priceFloor('item',0,ctx.depth,spec,count));
  return {ok:true,deal:{kind,price,tier:t,label:`道具「${name}」×${count}：${spec.description}`,item:{id,spec,count}}};
 }
 if(kind==='event'){
  const t=hard,raws=(Array.isArray(d.choices)?d.choices:[]).slice(0,3),choices:EventChoice[]=[];
  for(const [i,c] of raws.entries()){
   const label=clean(c?.label,40);if(!label)continue;
   const costs:EventChoice['costs']=[],cost=c?.cost;
   if(cost&&typeof cost==='object'){const ck=String(cost.kind);if(ck==='fp')costs.push({resource:'fp',fraction:0,flat:Math.round(clamp(cost.amount,0,300*(t+1),0)),lethal:false});else if(['hp','mp','sp'].includes(ck))costs.push({resource:ck as 'hp'|'mp'|'sp',fraction:round2(clamp(cost.fraction,0,.4,.1)),flat:0,lethal:false});}
   const results:EventResult[]=[];
   for(const r of (Array.isArray(c?.results)?c.results:[c?.result]).filter(Boolean).slice(0,2)){
    const rk=String(r.kind) as typeof EVENT_RESULT_KEYS[number];
    if(rk==='fp'){const n=Math.round(clamp(r.amount,-150*(t+1),150*(t+1),0));if(n)results.push({kind:'fp',mode:'add',amount:n});}
    else if(rk==='box')results.push({kind:'box',count:Math.round(clamp(r.amount??r.count,1,2,1)),quality:QUALITIES[grantQuality(r.quality,t)]});
    else if(rk==='heal_all')results.push({kind:'heal_all',fraction:round2(clamp(r.amount??r.fraction,.05,1,.5))});
    else if(rk==='cleanse_all')results.push({kind:'cleanse_all'});
    else if(rk==='relic_random')results.push({kind:'relic_random',rarity:Math.round(clamp(r.amount??r.rarity,1,t<=1?1:t<=3?2:3,1)) as 1|2|3});
   }
   choices.push({id:'c'+i,label,requirements:[],costs,results});
  }
  if(choices.length<2&&!(choices.length===1&&choices[0]!.results.length))return {ok:false,reason:'这个事件没有可用的选项'};
  choices.push({id:'leave',label:'什么也不做，离开',requirements:[],costs:[],results:[]});
  const title=clean(d.title,12)||'补给员的即兴节目',body=clean(d.body,160)||'她在地上画了个圈，说这是一个事件。';
  const event:EventDefinition={id:'sup-event-'+id.slice(4),theme:'common',title,body,requirements:[],choices};
  const price=priced(priceFloor('event',ctx.capTier,ctx.depth));
  return {ok:true,deal:{kind,price,tier:t,label:`临时事件「${title}」`,event}};
 }
 const t=grantQuality(d.quality,hard,ctx.capTier),name=clean(d.name,16)||'补给员的纪念品';
 const itemType=['技能书','装备','饰品','消耗品','材料'].includes(String(d.itemType))?String(d.itemType):'饰品';
 const loot:Extract<Reward,{kind:'gift'}>={kind:'gift',name,itemType,quality:QUALITIES[t]!,effect:clean(d.effect,120)||'用途不明，也许正文里会知道。',description:clean(d.description??d.flavor,120)||'补给员随手塞过来的东西。',count:1,source:'补给员'};
 const price=priced(priceFloor('loot',t,ctx.depth));
 return {ok:true,deal:{kind:'loot',price,tier:t,label:`可带出战利品「${QUALITIES[t]!}·${name}」（${itemType}）`,loot}};
}
