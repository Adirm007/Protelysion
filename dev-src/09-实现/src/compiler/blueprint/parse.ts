/** 本地条款解析器：中文能力文本 → 能力蓝图。模型不可用或单条失败时使用。
 * 定量文本（威力/百分比/回合/DC/次数）逐项读取；定性文本按关键词语义给出有界的同阶数值。
 * 只依据原文，不按角色名做特殊处理。 */
import {mentionedStd,findStd} from './statuses';
import {fixedHeals} from './heal-text';
import type {Blueprint,BPStep,BPTarget,BPTrigger,BPCond,BPMod} from './types';

export type ParseContext={name:string;sourceId:string;level:number;tier:number;power:number;cost:number};
export type ParsedEntry={main:Blueprint;extra:Blueprint[];notes:string[]};
type Obj=Record<string,unknown>;
type Kind='active'|'passive';
const rec=(x:unknown):Obj=>x&&typeof x==='object'&&!Array.isArray(x)?x as Obj:{};
const flat=(x:unknown):string=>typeof x==='string'||typeof x==='number'?String(x):Array.isArray(x)?x.map(flat).join('、'):x&&typeof x==='object'?Object.entries(x).map(([k,v])=>k+':'+flat(v)).join('\n'):'';
const QUALITY_PCT:Record<string,number>={普通:10,优良:15,稀有:20,史诗:25,传说:30,神话:40,唯一:35};
const CN:Record<string,number>={一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10,数:3,许多:3,大量:4};
const n=(s:string|undefined)=>s===undefined?undefined:/^\d/.test(s)?Number(s):CN[s];
const NUM='(\\d+(?:\\.\\d+)?|[一二两三四五六七八九十数])';
const ATTRS=['力量','敏捷','体质','智力','精神'] as const;
const num0=(x:unknown)=>typeof x==='number'?x:undefined;
const esc=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const CH:Record<string,string>={物理:'physical',能量:'energy',魔法:'energy',精神:'mental',真实:'true',固定:'true'};

/** “召唤烈焰/雷电/陨石”这类元素现象不是召唤单位。 */
const ELEMENT_SUMMON=/召唤(?:并使用)?[^，。]{0,14}(?:烈焰|火焰|火雨|雷电|雷霆|闪电|风暴|陨石|冰雹|光芒)/;
export function normalize(t:string){return t.replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-65248)).replace(/％/g,'%').replace(/＋/g,'+').replace(/[－—]/g,'-').replace(/（/g,'(').replace(/）/g,')').replace(/：/g,':').replace(/＜/g,'<').replace(/＞/g,'>').replace(/[ \t\u3000]+/g,'');}
function channelOf(t:string):string{
 const mix=t.match(/(物理|能量|魔法|精神|真实)\]?\s*[+与和]\s*\[?\d*%?\[?(物理|能量|魔法|精神|真实)\]?(?:的)?(?:混合)?伤害/)??t.match(/\d+%\[?(物理|能量|魔法|精神|真实)\]?与\d+%\[?(物理|能量|魔法|精神|真实)\]?/);
 if(mix)return CH[mix[1]!]+'+'+CH[mix[2]!];
 const ex=t.match(/(物理|能量|魔法|精神|真实|固定)\]?伤害/);if(ex)return CH[ex[1]!]!;
 if(/真伤/.test(t))return 'true';
 const phys=/斩|劈|刺|拳|踢|剑|刀|斧|长枪|枪术|矛|枪击|射击|子弹|弹药|撕咬|爪|砸|锤|鞭|俯冲|冲锋|横扫|物理/.test(t),energy=/法术|元素|雷|火|炎|冰|霜|光|暗|吐息|魔力|电|等离子|冲击波|爆炸|爆破|射线|魔导|能量|弹幕|魔法/.test(t),mental=/灵魂|心灵|灵能|惑心|梦魇|精神/.test(t);
 if(mental&&!phys&&!energy)return 'mental';
 if(energy&&!phys)return 'energy';
 if(phys)return 'physical';
 return '';
}
function typesOf(t:string):string[]{const out:string[]=[];if(/火|炎|焰|燃|爆炸|熔|烧伤/.test(t))out.push('火');if(/雷|电|光|等离子|神圣|圣|伽马/.test(t))out.push('光');if(/冰|霜|水|寒|潮|冻伤/.test(t))out.push('水');if(/暗|影|毒|腐蚀|诅咒|死灵|酸/.test(t))out.push('暗');if(/精神|灵魂|心灵|灵能/.test(t))out.push('精');return out.slice(0,3);}
function magnitude(t:string){return /巨额|毁灭|极高|超高|海量|灰飞烟灭|巨大/.test(t)?2:/高额|大量|强力|重击|猛烈|致命一击/.test(t)?1.5:/微弱|少量|轻微|小范围|无害/.test(t)?.6:1;}
function targetOf(t:string,tier:number):BPTarget|undefined{
 const q:BPTarget={side:'enemy'};let hit=false;
 const cnt=t.match(new RegExp('至多'+NUM+'(?:个|名)?(?:目标|敌人|人)'))??t.match(new RegExp('影响'+NUM+'人'));
 if(cnt){q.count=Math.min(64,n(cnt[1])??1);q.select='single';hit=true;}
 else if(/所有敌|全体敌|范围内(?:的)?(?:所有|全部)?(?:敌|单位|目标|人|生物)|全部敌|敌方全体|所有敌方|群体|周围(?:的|所有)?(?:敌|生物|单位)|半径\d|扫射|横扫|吐息|全场|领域内|视距内所有|大范围|广域|AOE|范围攻击|范围伤害|沿途所有/i.test(t)){q.select='all';hit=true;}
 if(/低于自己层级|低于自身层级|层级低于自己|层级低于自身/.test(t)){q.belowCasterTier=true;hit=true;}
 if(/同层或更弱|同层级或更低|同层或更低/.test(t)){q.maxTier=tier;hit=true;}
 const below=t.match(/(?:低于)?第([一二三四五六七])层级以下|低于第([一二三四五六七])层级/);if(below){q.maxTier=Math.max(1,(n(below[1]??below[2])??tier)-1);hit=true;}
 return hit?q:undefined;
}
function turnsNear(t0:string,word:string):number|undefined{
 const t=t0.replace(/消耗\d+\[?回合\]?/g,'');const i=word?t.indexOf(word):0;const w=i<0?0:i;
 const before=t.slice(Math.max(0,w-14),w),after=t.slice(w,w+word.length+12);
 const m=before.match(/(\d+|[一二两三四五])(?:个)?回合(?:的|内)?(?:[^，,。]{0,6})?$/)??after.match(/(?:持续|，|,|\(|）|\))?(\d+|[一二两三四五])(?:个)?回合/)??t.match(/持续(\d+|[一二两三四五])(?:个)?回合/)??t.match(/(\d+|[一二两三四五])回合内/);
 if(m)return n(m[1]);
 if(/持续至战斗结束|直到战斗结束|持续到战斗结束|直至战斗结束|不会自主消除|不可移除|无法解除/.test(t))return 99;
 return undefined;
}
function chanceIn(t:string):number|undefined{const m=t.match(/(\d+)%(?:的)?(?:几率|概率|机率)/)??t.match(/(?:几率|概率)(\d+)%/)??t.match(/(\d+)%\(d20/)??t.match(/(\d+)%触发/);if(m)return Number(m[1])/100;if(/概率性|有几率|有概率/.test(t))return .3;return undefined;}
function saveIn(t:string):{attr:string;dc?:number}|undefined{
 const m=t.match(/(力量|敏捷|体质|智力|精神)(?:检定|判定|对抗)\(?DC(\d+)\)?/)??t.match(/DC(\d+)(力量|敏捷|体质|智力|精神)(?:检定|判定|对抗)/)??t.match(/\(DC(\d+)(力量|敏捷|体质|智力|精神)(?:检定|判定)?\)/);
 if(m)return /^\d/.test(m[1]!)?{attr:m[2]!,dc:Number(m[1])}:{attr:m[1]!,dc:Number(m[2])};
 const o=t.match(/[【\[]?(力量|敏捷|体质|智力|精神)(?:对抗|检定|判定)[】\]]?/);if(o&&/失败|成功|对抗|需/.test(t))return {attr:o[1]!};
 return undefined;
}
/** 判断状态词是否被“施加”，而不是被引用（条件、免疫、属性名、叙述）。 */
export function applied(s:string,word:string,loose:boolean):boolean{
 const i=s.indexOf(word);if(i<0)return false;
 const a=s.slice(i+word.length),b4=s.slice(Math.max(0,i-5),i),before=s.slice(Math.max(0,i-12),i);
 if(/^[\]】」]?(?:检定|率|值|评级|抗性|系数)?(?:值)?\s*[+\-]\d/.test(a))return false;
 if(/^[\]】」]?(?:检定|判定|类|系|学派)/.test(a))return false;
 if(/(?:带有|处于|拥有|若|如果|具有|身上有|每有|每带有|每拥有|免疫|无视|不受|抵抗|(?<!无法)解除|驱散|清除|平复|安抚|消除)[^，,。]{0,3}[\[【「]?$/.test(s.slice(Math.max(0,i-9),i))&&!/陷入[\[【「]?$/.test(b4))return false;
 if(/绝对$/.test(s.slice(Math.max(0,i-2),i)))return false;
 if(/^(?:目标|敌人|对方)/.test(a)&&!/[\[【]$/.test(s.slice(Math.max(0,i-1),i)))return true;
 if(/(?<!无法|不能|难以)(?:免疫|无视|不受|抵抗|解除|驱散|清除|平复|安抚|消除|净化)[^，,。的]{0,8}$/.test(before))return false;
 if(/[\[【「]$/.test(s.slice(Math.max(0,i-1),i))&&/^[\]】」]/.test(a))return true;
 if(/附加|施加|陷入|使|令|造成|进入|获得|给予|赋予|带来|让|致|施以|附带|叠加|触发|赐予|变成|变为|陷于|被/.test(before))return true;
 if(/^(?:状态|效果|\d+回合)/.test(a))return true;
 return loose;
}
function condsIn(s:string):BPCond[]{
 const out:BPCond[]=[];
 const th=s.match(/(?:对方|目标|敌人|敌方)(?:的)?(?:HP|生命)(?:值)?\s*(?:<|低于|少于|不足)\s*(\d+)%/);if(th)out.push({kind:'target_hp_below',value:Number(th[1])});
 const sh=s.match(/(?:自身|自己|你)(?:的)?(?:HP|生命)(?:值)?(?:首次)?(?:小于)?\s*(?:<|低于|少于|不足)\s*(\d+)%/);if(sh)out.push({kind:'hp_below',value:Number(sh[1])});
 const st=s.match(/(?:若|如果|当|对)(?:目标|对方|敌人)?(?:处于|带有|拥有|身上有)\s*[\[【]([^\]】]{1,10})[\]】]/);if(st)out.push({kind:'target_has_status',status:st[1]});
 const neg=s.match(/(?:对)?处于(?:负面|异常|减益)状态的目标/);if(neg)out.push({kind:'target_debuffs_at_least',value:1});
 return out;
}
function mods(t:string,q:number):BPMod[]{
 const out:BPMod[]=[];let m:RegExpExecArray|null;
 const re=/(力量|敏捷|体质|智力|精神)(?:值)?\s*\+\s*(\d+)(?!%)/g;while((m=re.exec(t)))if(!/检定$/.test(t.slice(0,m.index+m[1]!.length+2)))out.push({stat:m[1]!,add:Number(m[2])});
 const pre=/\+(\d+)(力量|敏捷|体质|智力|精神)(?!检定)/g;while((m=pre.exec(t)))out.push({stat:m[2]!,add:Number(m[1])});
 const chk=/((?:所有)?(?:力量|敏捷|体质|智力|精神|与|和|、|\+)+)(?:相关)?(?:检定|判定)(?:值)?\s*([+-]\d+)/g;while((m=chk.exec(t))){const attrs=ATTRS.filter(a=>m![1]!.includes(a));for(const a of attrs)out.push({stat:a+'检定',add:Number(m[2])});}
 const all=t.match(/(?:所有|全属性|所有属性的?|全部)(?:的)?检定(?:值)?\s*([+-]\d+)/)??t.match(/(?:对抗)?检定时(?:使)?检定值\s*([+-]\d+)/);if(all)out.push({stat:'检定',add:Number(all[1])});
 const hit=t.match(/命中(?:检定值?|率)?(?:固定)?\s*([+-]\d+)(%?)/);if(hit)out.push(hit[2]?{stat:'命中',pct:Number(hit[1])}:{stat:'命中',add:Number(hit[1])});
 if(!hit&&/命中(?:率)?(?:大幅)?(?:增加|提升|提高)/.test(t))out.push({stat:'命中',pct:/大幅/.test(t)?20:10});
 const ev=t.match(/闪避(?:检定值?|率)?(?:固定)?\s*([+-]\d+)(%?)/)??t.match(/\[?闪避\]?\s*([+-]\d+)(%?)/);if(ev)out.push(ev[2]?{stat:'闪避',pct:Number(ev[1])}:{stat:'闪避',add:Number(ev[1])});
 if(!ev&&/闪避(?:率)?(?:大幅)?(?:提升|提高|增加)/.test(t))out.push({stat:'闪避',pct:/大幅/.test(t)?q+10:q});
 const ini=t.match(/先攻(?:检定)?\s*\+\s*(\d+)/);if(ini)out.push({stat:'先攻',add:Number(ini[1])});
 const crit=t.match(/暴击率?\s*\+\s*(\d+)%/);if(crit)out.push({stat:'暴击',pct:Number(crit[1])});
 if(/固定暴击|必定暴击|必然暴击|必定造成\[?超暴击/.test(t))out.push({stat:'暴击',pct:/先手|先攻|首次|距离/.test(t)?35:50});
 const critX=t.match(/(?:暴击)?倍率(?:为|提升至)(\d+(?:\.\d+)?)倍/);if(critX)out.push({stat:'暴击伤害',pct:Math.round((Number(critX[1])-1.5)*100)});
 const critM=t.match(/暴击(?:时)?(?:倍率|伤害|评级系数)(?:额外)?\s*\+\s*(\d+(?:\.\d+)?)(%?)/);if(critM)out.push({stat:'暴击伤害',pct:critM[2]?Number(critM[1]):Math.round(Number(critM[1])*100)});
 const maxr=/(HP|SP|MP|生命|法力|体力)(?:值)?上限(?:与(HP|SP|MP)上限)?(?:额外)?(?:增加|提升|\+)(\d+)%/g;while((m=maxr.exec(t))){for(const r of [m[1],m[2]].filter(Boolean)){const k=/HP|生命/.test(r!)?'最大生命':/MP|法力/.test(r!)?'最大法力':'最大体力';out.push({stat:k,pct:Number(m[3])});}}
 const extra=/额外(生命|体力|法力)值?(?:、额外(生命|体力|法力)值?)?\s*\+\s*(\d+)/g;while((m=extra.exec(t))){for(const r of [m[1],m[2]].filter(Boolean))out.push({stat:r==='生命'?'最大生命':r==='法力'?'最大法力':'最大体力',add:Number(m[3])});}
 const allp=t.match(/(?:全属性|全数值|所有属性)(?:临时)?\s*\+\s*(\d+)(%?)/);if(allp)out.push(allp[2]?{stat:'全属性',pct:Number(allp[1])}:{stat:'全属性',add:Number(allp[1])});
 else if(/全属性(?:提升|提高|大幅提升)/.test(t))out.push({stat:'全属性',pct:/大幅|层次/.test(t)?40:q});
 const cost=t.match(/(?:技能)?消耗(?:减少|降低)(\d+)%/);if(cost)out.push({stat:'消耗',pct:-Number(cost[1])});
 const def=t.match(/防御力?(?:增加|提升|提高|\+)(\d+)%/);if(def)out.push({stat:'防御',pct:Number(def[1])});
 const spd=t.match(/速度(?:提升|提高|增加|\+)(\d+)%/);if(spd)out.push({stat:'速度',pct:Number(spd[1])});
 const heal=t.match(/受到(?:的)?治疗(?:效果)?(?:提升|提高|增加|\+)(\d+)%/);if(heal)out.push({stat:'受到治疗',pct:Number(heal[1])});
 const vul=t.match(/(?<!自身)受到(?:的)?伤害(?:增加|提高|提升|\+)(\d+)%/);if(vul)out.push({stat:'受到伤害',pct:Number(vul[1])});
 const dmgUp=t.match(/(?:造成(?:的)?|攻击(?:\/技能)?(?:基础)?)?(物理|能量|精神|魔法)?(?:伤害|威力|数值效果)(?:的倍率)?(?:固定)?(?:提高|提升|增加|\+)\s*(\d+)%/);
 if(dmgUp&&!/受到(?:的)?(?:[^，。]{0,4})?$/.test(t.slice(Math.max(0,(dmgUp.index??0)-6),dmgUp.index)))out.push({stat:(dmgUp[1]?dmgUp[1].replace('魔法','能量'):'')+'伤害',pct:Number(dmgUp[2])});
 const to=t.match(/伤害均?提升至(\d+)%/);if(to)out.push({stat:'伤害',pct:Number(to[1])-100});
 return out;
}
function reductions(t:string):BPStep[]{
 const out:BPStep[]=[];let m:RegExpExecArray|null;
 const re=/受到(?:的)?(物理|能量|精神|真实|魔法|全类型|所有|正面)?伤害\s*(?:-|降低|减少|减免)\s*(\d+)%/g;
 while((m=re.exec(t))){const ch=m[1];out.push({do:'guard',pct:Number(m[2]),...(ch&&CH[ch]?{channels:[CH[ch]]}:{})});}
 const dr=t.match(/DR\s*(\d+)%|(\d+)%的?全(?:类型)?(?:伤害)?减免|伤害减免\s*(\d+)%/);if(dr&&!out.length)out.push({do:'guard',pct:Number(dr[1]??dr[2]??dr[3])});
 if(!out.length&&/受到(?:的)?(?:[^，。]{0,6})?伤害(?:大幅)?(?:降低|减少|减免)(?!\d)|伤害抗性/.test(t))out.push({do:'guard',pct:/大幅|极大/.test(t)?40:25});
 return out;
}
/** 是否描述“造成伤害”这一动作（排除增伤、受伤、反击、转化等引用）。 */
function dealsDamage(s:string):boolean{
 const x=s.replace(/造成(?:的)?(?:物理|能量|精神|真实)?伤害(?:的倍率)?(?:固定)?(?:提高|提升|增加|降低|减少|\+|-)\s*\d*%?|造成伤害的(?:总值的)?\d+%|伤害的\d+%|受到(?:的)?[^，。;；]{0,8}伤害|反击伤害|对建筑物造成\d+%伤害|(?:不|无法)(?:直接)?(?:对自己)?造成伤害|伤害技能|伤害(?:效果|倍率)|伤害转变为|伤害将?\d*%?转化|溅射伤害|造成其伤害\d+%的|命中造成伤害的同时|与原技能完全相同|威力、效果与结算|对建筑物造成\d+%伤害|承受\d+点伤害|每造成\d+点伤害|抵消(?:一次)?伤害|无友军伤害|伤害\+\d+%/g,'');
 return /威力|造成[^，。;；]{0,28}伤害|伤害:|攻击手段|轰击|吐息|冲击波|射出|斩出|斩击|劈砍|爆炸伤害|鞭打|撕裂|穿刺|发射|倾泻|弹幕|射线暴|点伤害|俯冲|横切|横扫|扫射|连击|针刺攻击|吸取(?:对方|目标|敌人)?的?生命|抽取对方|附带[^，。]{0,18}伤害|斩杀|即死|处决|秒杀|魔导炮|炮击|释放[^，。]{0,12}炮/.test(x);
}
function hitContext(s:string){return /攻击(?:命中)?(?:后|时)|命中(?:后|时)|攻击附带|附带(?:对方|目标)?已损失|每次攻击|有效命中|攻击时附带|攻击命中造成伤害的同时/.test(s);}
type TrigSpec={on:string;hpPct?:number;chance?:number;uses?:number};
function passiveTrigger(s:string):TrigSpec|undefined{
 const pairs:[RegExp,string][]=[[/每回合(?:开始)?(?:前|时)|(?:^|[，,])回合(?:开始|初)(?:时|前)?|每回合(?!最多|受到)/,'round'],[/战斗开始时|进入战斗(?:时|后)?|战斗开始/,'battle_start'],[/受到致(?:死|命)伤害(?:或[^，,。]{0,6})?时/,'lethal'],
  [/(?:HP|生命)(?:值)?(?:首次)?(?:小于)?\s*(?:<|低于|降至|小于)\s*(\d+)%/,'hp_below'],[/遭受\[?任何\]?攻击时|受到(?:攻击|伤害)(?:时|后)|被攻击时|受击时|若受到攻击/,'damaged'],[/暴击时|若该次攻击触发暴击|触发暴击/,'crit'],
  [/(?:有效)?命中(?:后|时)|(?<!先手|属性|远程|近战)攻击(?:命中)?(?:后|时)|每次攻击|攻击附带|攻击时附带/,'hit'],[/击杀(?:敌人|目标)?(?:后|时)|成功击杀/,'kill'],[/同伴(?:倒下|死亡)时/,'ally_down'],[/被闪避或格挡|攻击被闪避|未命中/,'miss'],[/后出手时|敌方(?:行动|出手)时/,'enemy_action']];
 let best:{i:number;on:string;m:RegExpMatchArray}|undefined;
 for(const [re,on] of pairs){const m=s.match(re);if(m&&(best===undefined||m.index!<best.i))best={i:m.index!,on,m};}
 if(!best)return undefined;
 const t:TrigSpec={on:best.on};if(best.on==='hp_below')t.hpPct=Number(best.m[1]);const c=chanceIn(s);if(c!==undefined&&c<1)t.chance=c;
 const u=s.match(/每场(?:战斗)?(?:限|仅限)?(一|1|两|2|三|3)次|\((\d)次\/战斗\)/);if(u)t.uses=n(u[1]??u[2]);if(best.on==='hp_below'&&/首次/.test(s))t.uses=1;
 return t;
}
function isForm(s:string){return /(?<![转象幻变])化为(?!受其)|变身|化龙|(?<!将[^，。]{0,4})化作(?!沉重|连绵)|变化为(?!任何)|跨入第|进入[^，。]{0,6}形态|血魔化|化身/.test(s)&&!/部位化为|手脚化为|右手化为|化为利剑|化为等离子/.test(s);}

type State={steps:BPStep[];trig:Map<string,BPTrigger>;flags:Set<string>;notes:string[];fieldNeg:BPStep[];isField:boolean;damage?:BPStep};

/** 解析一个段落（主动或被动部分）。 */
function parseSection(text:string,ctx:ParseContext,q:number,kind:Kind,tagText:string,opts:{equipment?:boolean}={}):{bp:Blueprint;notes:string[]}{
 let t=normalize(text);const st:State={steps:[],trig:new Map(),flags:new Set(),notes:[],fieldNeg:[],isField:false};
 const bp:Blueprint={kind,steps:st.steps};
 // 费用、次数、冷却、吟唱
 const costRe=/(?:消耗)?(\d+)\s*(mp|sp|hp|法力|体力)(?![a-z上])/ig;let m:RegExpExecArray|null;const cost:NonNullable<Blueprint['cost']>={};
 for(const src of [t,normalize(tagText)])while((m=costRe.exec(src))){const r=/mp|法力/i.test(m[2]!)?'mp':/sp|体力/i.test(m[2]!)?'sp':'hp';const pre=src.slice(Math.max(0,m.index-6),m.index);if(!/恢复|回复|增加|上限|获得|额外|扣除|汲取/.test(pre)&&!/%$/.test(pre)&&!/每秒/.test(pre))cost[r]=Number(m[1]);}
 const pctCost=t.match(/消耗[^，。,;；\n]{0,14}?(\d+)%(?:的)?(?:最大)?(MP|SP|HP|法力|体力|生命)(\+(?:MP|SP|HP))?/i);
 if(pctCost&&!/流失|损失/.test(t.slice(Math.max(0,(pctCost.index??0)-2),(pctCost.index??0)+4))){for(const r0 of [pctCost[2]!,pctCost[3]?.slice(1)].filter(Boolean)){const r=/mp|法力/i.test(r0!)?'mpPct':/sp|体力/i.test(r0!)?'spPct':'hpPct';cost[r]=Number(pctCost[1]);}}
 if(Object.keys(cost).length&&kind==='active')bp.cost=cost;
 const pb=t.match(new RegExp('每场(?:战斗)?(?:限|仅限|仅能|只能)?(?:使用|发动|触发)?'+NUM+'次'))??t.match(new RegExp(NUM+'次/(?:战斗|场)'))??t.match(new RegExp('每日'+NUM+'次'))??t.match(/一场战斗(?:仅|只)?(?:可|能)?(?:使用)?(一)次/);
 if(pb&&kind==='active')bp.perBattle=n(pb[1]);
 if(/每场战斗对单一目标仅能使用一次|对同一目标(?:仅|只)(?:能)?(?:生效|使用)?(?:一|1)次|每个目标(?:仅|只)?(?:限)?(?:一|1)次/.test(t)){bp.perTarget=1;delete bp.perBattle;}
 const cd=t.match(/冷却(?:时间)?:?(\d+)回合/);if(cd)bp.cooldown=Number(cd[1]);
 const cast=t.match(/(?:吟唱|蓄力|引导)(\d+)回合|消耗(\d+)\[?回合\]?/);if(cast&&kind==='active')bp.castRounds=Number(cast[1]??cast[2]);
 if(/必定先攻|绝对先手|必定先手/.test(t))bp.firstStrike=true;
 const form=t.match(/([^\s,，。;；]{1,4}形态)(?:专属|限定)/);if(form&&!/^人/.test(form[1]!))bp.onlyInForm=form[1];
 if(/人形态(?:专属|可用|限定)/.test(t))bp.notInForm='形态';
 const main=targetOf(t.replace(/对[^，。]{0,6}单位造成伤害使其附近[^，。]*/g,''),ctx.tier);
 const nestedTags=tagText.replace(/威力[:：]?\s*(?:每段)?\s*\d+/g,'');
 // 对抗检定：成功则 A；失败则 B
 const chkRe=/(?:进行)?(?:分别)?(?:对抗)?(?:检定|判定)\(?(?:自身|己方)?\[?(力量|敏捷|体质|智力|精神)[^v)]{0,8}vs?(?:敌方|对方)?\[?(力量|敏捷|体质|智力|精神)[^)]{0,8}\)?[):：，,]*成功则([^；;。]+?)[；;，,]\s*失败则([^；;。]+)/;
 const ck=t.match(chkRe);
 const ck2=!ck&&t.match(/(?:进行)?(?:所有敌人)?(?:进行)?(?:分别)?(?:对抗)?(?:检定|判定)\(?(?:自身|己方)?\[?(力量|敏捷|体质|智力|精神)[^v)]{0,8}vs?(?:敌方|对方)?\[?(力量|敏捷|体质|智力|精神)[^)]{0,8}\)?[):：，,]*成功则((?:[^；;。(]|\([^)]*\))+)/);
 if(ck2){const succ=parseSection(ck2[3]!,ctx,q,'active',nestedTags).bp.steps;if(succ.length){st.steps.push({do:'check',attr:ck2[1],vs:ck2[2],success:succ});t=t.replace(ck2[3]!,'');}}
 if(ck){const succ=parseSection(ck[3]!,ctx,q,'active',nestedTags).bp.steps,fail=parseSection(ck[4]!,ctx,q,'active',nestedTags).bp.steps;if(succ.length||fail.length)st.steps.push({do:'check',attr:ck[1],vs:ck[2],success:succ.length?succ:[{do:'note',text:'检定成功'}],...(fail.length?{failure:fail}:{})});t=t.replace(ck[0],'');}
 // 句子：句号/分号/换行/编号条款
 const sentences=t.split(/[。；;\n]|(?:^|(?<=[:：，,]))\d\.(?!\d)/).map(s=>s.trim()).filter(s=>s.length>1);
 for(const s of sentences)sentence(s,st,ctx,q,kind,tagText,opts,t);
 // 标签中的数值：威力 / 范围
 const tagN=normalize(tagText);const tp=tagN.match(/威力[:：]?(?:每段)?(\d+)/);
 if(tp&&kind==='active'){const all=[...st.steps,...st.steps.flatMap(x=>Array.isArray(x.options)?(x.options as BPStep[][]).flat():[])];let d=all.filter(x=>x.do==='damage');
  if(!d.length&&!st.steps.some(x=>x.do==='check')){const nd:BPStep={do:'damage',channel:channelOf(t+tagText)||'physical'};st.steps.unshift(nd);st.damage=nd;d=[nd];}
  if(!d.length){const c=st.steps.find(x=>x.do==='check');if(c){const nd:BPStep={do:'damage',channel:channelOf(t+tagText)||'physical'};st.steps.splice(st.steps.indexOf(c),0,nd);st.damage=nd;d=[nd];}}
  for(const x of d)if(x.power===undefined)x.power=Math.round(Number(tp[1])*(num0(x.multiplier)??1)),delete x.multiplier;}
 if(/范围[:：]?\d|AOE|群体|广域/i.test(tagN)&&st.damage&&!st.damage.target)st.damage.target={side:'enemy',select:'all'};
 // 对处于[X]状态的敌人攻击时额外附加N伤害
 const bonus=t.match(/对处于[\[【]([^\]】]{1,10})[\]】]状态的敌人(?:进行)?攻击时[^。；]*?附加(\d+)(?:点)?伤害/);
 if(bonus&&st.damage){const pw=num0(st.damage.power)??ctx.power;st.damage.bonusVsStatus={status:bonus[1],pct:Math.round(Number(bonus[2])/pw*100)};}
 // 检定分支中的伤害：以主伤害威力为基准；主伤害排在检定之前
 const mainPower=num0(st.damage?.power);
 for(const c of st.steps.filter(x=>x.do==='check'))for(const k of ['success','failure'])for(const x of ((c[k] as BPStep[]|undefined)??[]))if(x.do==='damage'&&x.power===undefined){x.power=Math.round((mainPower??ctx.power)*(num0(x.multiplier)??1));delete x.multiplier;}
 if(st.damage){const ci=st.steps.findIndex(x=>x.do==='check'),di=st.steps.indexOf(st.damage);if(ci>=0&&di>ci){st.steps.splice(di,1);st.steps.splice(ci,0,st.damage);}}
 // 领域：按整段汇总
 if(st.isField)buildField(t,st,ctx,q);
 if(st.trig.size)bp.triggers=[...st.trig.values()].filter(x=>x.steps.length);
 const req=(st as {requires?:BPCond[]}).requires;if(req&&kind==='active')bp.requires=req;
 if(kind==='active'&&/仅[^，。]{0,70}在场时(?:才)?(?:可|能)使用/.test(t)){const k=(t.match(/三人|三位一体/)?2:1);bp.requires=[...(bp.requires??[]),{kind:'allies_alive_at_least',value:k+1}];st.notes.push('“指定同伴在场”按己方存活人数近似');}
 if(kind==='active'&&main&&!st.steps.some(s=>s.target&&s.target.side==='enemy'))bp.target=main;
 return {bp,notes:st.notes};
}

function bucketFor(st:State,spec:TrigSpec):BPStep[]{
 const key=spec.on+(spec.hpPct??'')+(spec.chance??'');let tr=st.trig.get(key);
 if(!tr){tr={on:spec.on,steps:[],...(spec.hpPct!==undefined?{hpPct:spec.hpPct}:{}),...(spec.chance!==undefined?{chance:spec.chance}:{}),...(spec.uses?{uses:spec.uses}:{})};st.trig.set(key,tr);}
 return tr.steps;
}

function sentence(s:string,st:State,ctx:ParseContext,q:number,kind:Kind,tagText:string,opts:{equipment?:boolean},whole:string){
 const passive=kind==='passive';
 s=s.replace(/[，,]?对建筑物造成\d+%伤害/g,'').replace(/若\d+次均对同一目标发动[^。；]*/g,'');
 let spec=passive?passiveTrigger(s):undefined;
 // 主动技能中的“每次攻击附加X”：自身增益状态，命中时施加
 const aura=!passive&&/每次攻击(?:都)?附加|攻击时附加|攻击附带|攻击命中后附加/.test(s);
 if(spec?.on==='lethal'&&!/幻影|替身|代偿|瞬移|传送/.test(s))spec=undefined;
 let bucket=spec?bucketFor(st,spec):st.steps;
 // 敌方自定义状态：“使对方陷入[X]状态(……)” / “为对方附加[X]，……”
 for(const g of [...s.matchAll(/(?:为|使|对)(?:对方|目标|敌方|敌人|其)(?:附加|陷入|施加)?\s*[\[【]([^\]】]{1,10})[\]】](?:状态|效果)?(\([^)]*\)|[，,][^；;。]*)?/g)]){
  const nm=g[1]!;const body=g[2]??'';if(!body||st.flags.has('ecs:'+nm))continue;if(findStd(nm)&&!body.startsWith('('))continue;
  st.flags.add('ecs:'+nm);const ms=mods(body,q).map(m=>((m.add??m.pct??0)>0&&m.stat!=='受到伤害')?{...m,add:m.add!==undefined?-Math.abs(m.add):undefined,pct:m.pct!==undefined?-Math.abs(m.pct):undefined}:m);
  const vul=body.match(/(?:下次)?受到(?:的)?伤害\+(\d+)%/);if(vul&&!ms.some(m=>m.stat==='受到伤害'))ms.push({stat:'受到伤害',pct:Number(vul[1])});
  const cs:Record<string,unknown>={name:nm,polarity:'negative',...(ms.length?{mods:ms}:{})};
  if(/无法(?:使用|进行)(?:任何)?\[?动作\]?|无法行动/.test(body))cs.control=/攻击/.test(body)?'stun':'no_action';
  if(/位移/.test(body)&&!cs.control)cs.control='root';
  if(/可叠加/.test(body+s))cs.stackable=true;
  if(/受击后全部消耗|下次受到/.test(body+s))cs.consumeOn='damaged';
  if(/无法解除|不可移除|不会自主消除/.test(body))cs.dispellable=false;
  const x:BPStep={do:'status',status:cs,turns:turnsNear(body,'')??(/1回合内/.test(body)?1:2)};const sv=saveIn(s);if(sv&&!/对抗判定|对抗检定/.test(s))x.save=sv;
  (st as {pendingEnemy?:BPStep[]}).pendingEnemy=[...((st as {pendingEnemy?:BPStep[]}).pendingEnemy??[]),x];
  s=s.replace(g[0],'');
 }
 const pending=(st as {pendingEnemy?:BPStep[]}).pendingEnemy??[];(st as {pendingEnemy?:BPStep[]}).pendingEnemy=[];
 const conds=condsIn(s);
 const tgt=targetOf(s,ctx.tier);
 const form=!passive&&isForm(s);
 const deathCtx=/HP归零时不会死亡|不会(?:被)?(?:消灭|死亡)|才会真的死亡|锁血|免死|复活|重生|不朽|无法被破坏|致(?:死|命)伤害时保留|受到致(?:死|命)伤害时/.test(s)&&!/无法复活|禁止复活|彻底消散/.test(s);
 if(deathCtx&&spec&&spec.on==='lethal'){spec=undefined;bucket=st.steps;}
 const push=(x:BPStep)=>{if(conds.length&&!x.when)x.when=conds;bucket.push(x);};
 const flag=(k:string)=>{if(st.flags.has(k))return false;st.flags.add(k);return true;};
 for(const x of pending){if(passive&&!spec){bucketFor(st,{on:/弹开|闪避|格挡/.test(s)?'dodge':/遭受|受到/.test(s)?'damaged':'hit'}).push(x);continue;}if(tgt&&!spec)x.target=tgt;push(x);}

 // ---- 伤害
 const drain=s.match(/抽取(?:对方|目标|敌人)(\d+)%(?:的)?(?:最大)?(?:HP|生命)/);
 if(drain&&flag('drainHp')){const d:BPStep={do:'damage',pctMaxHp:Number(drain[1]),channel:'true',lifesteal:100,power:0};push(d);st.damage??=d;s=s.replace(drain[0],'');}
 if(dealsDamage(s)&&!/不(?:直接)?造成伤害|绚丽无害(?!.*爆炸)/.test(s)&&!(passive&&!spec&&!hitContext(s))){
  if(passive&&!spec){spec={on:'hit'};bucket=bucketFor(st,spec);}
  const power=s.match(/(?:基础)?威力[:：]?\s*(?:每段|每次|单段)?\s*(\d+)/)??s.match(/造成(\d{3,})点(?:[^，。]{0,4})?伤害/)??s.match(/追加一段(\d+)(?:点)?伤害/);
  const newDmg:BPStep={do:'damage'};
  if(power)newDmg.power=Number(power[1]);
  const mult=s.match(/造成(\d+)%(?:的)?\[?(物理|能量|精神|真实|魔法)?\]?伤害/)??s.match(/造成(?:该武器)?基础攻击力(\d+)%的?(物理|能量|精神|真实)?伤害/);
  if(mult&&!/最大|生命|HP/.test(s.slice(mult.index!,mult.index!+12)))newDmg.multiplier=Number(mult[1])/100;
  const mw=s.match(/(\d+)%威力/);if(mw&&!newDmg.multiplier)newDmg.multiplier=Number(mw[1])/100;
  const ch=/伤害|威力|攻击/.test(s)?channelOf(s):undefined;
  const hits=s.match(new RegExp('(?:造成|进行|连续|共计)'+NUM+'(?:次|段|连)(?:攻击|伤害|打击|广域)?'))??s.match(/(\d+)连(?:击|斩|射)|(两|二|三)段/);if(hits)newDmg.hits=n(hits[1]??hits[2]);
  const rh=s.match(/(\d+)\s*[~～-]\s*(\d+)\s*(?:次|段)/);if(rh){newDmg.randomHits={min:Number(rh[1]),max:Number(rh[2])};delete newDmg.hits;}
  const pm=s.match(/(?:目标|对方)?(\d+)%(?:的)?(?:最大HP|最大生命)(?:值)?(?:的)?(?:最大)?(?:固定)?伤害|(?:目标|对方)(?:最大生命|最大HP|HP上限|生命上限)(?:值)?的?(\d+)%/);if(pm){newDmg.pctMaxHp=Number(pm[1]??pm[2]);if(/固定伤害|真实/.test(s)&&!power)newDmg.channel='true';}
  const sl=s.match(/自身已损失(?:的)?(?:HP|生命)(?:值)?(?:的)?(\d+)%/);if(sl)newDmg.selfPctLostHp=Number(sl[1]);
  const tl=!sl&&s.match(/(?:对方|目标|敌人)?已损失(?:的)?(?:HP|生命)(?:值)?的?(\d+)%/);if(tl)newDmg.pctLostHp=Number(tl[1]);
  const pr=s.match(/穿透(\d+)%|(\d+)%穿透/);if(pr)newDmg.pierce=Number(pr[1]??pr[2]);
  if(/必中|必定命中|无法闪避|无法被闪避|无视对方所有闪避/.test(s))newDmg.sure=true;
  const ign:string[]=[];if(/无视(?:一切|所有|任何)?护盾|无视屏障/.test(s))ign.push('shield');if(/无视(?:任何)?(?:防御|减伤|护甲|装备)|清空(?:对方)?防御|无视对方装备提供的防御/.test(s))ign.push('reduction');if(/无视任何装备和技能效果/.test(s))ign.push('shield','reduction','death');if(ign.length)newDmg.ignore=[...new Set(ign)];
  if(/吸取|吸血|汲取生命|抽取对方/.test(s)){const shield=/转化为(?:自身)?(?:临时)?护盾/.test(s);if(!shield)newDmg.lifesteal=Number(s.match(/(\d+)%.{0,6}(?:转化为|恢复).{0,4}生命/)?.[1]??100);}
  const sh=s.match(/伤害(?:的总值)?的(\d+)%(?:将被|会)?转化为(?:自身)?(?:的)?(?:临时)?护盾/);if(sh)newDmg.toShield=Number(sh[1]);else if(/转化为(?:自身)?(?:临时)?护盾/.test(s))newDmg.toShield=100;
  const ex=s.match(/(?:HP|生命)(?:值)?\s*(?:<|低于)\s*(\d+)%[^。]{0,16}(?:斩杀|即死|处决|击杀|秒杀)/);if(ex){newDmg.executeBelowPct=Number(ex[1]);newDmg.when=[{kind:'target_hp_below',value:Number(ex[1])}];}
  const cr=s.match(/暴击率\+?(\d+)%/);if(cr)newDmg.crit={chance:Number(cr[1])};if(/必定造成\[?超暴击|必定暴击/.test(s))newDmg.crit={chance:100,mult:2.5};else if(/强暴击/.test(s))newDmg.crit={chance:5,mult:2.5};
  const sd=s.match(/(?:使用后)?(?:损失|消耗|失去|扣除)(?:自身)?(\d+)%(?:的)?(?:最大)?(?:HP|生命)/);if(sd&&!passive){newDmg.selfDamagePct=Number(sd[1]);if(/双倍附加到威力/.test(s))newDmg.selfPctMaxHp=Number(sd[1])*2;}
  const ty=typesOf(s);if(ty.length)newDmg.types=ty;
  if(tgt&&!spec)newDmg.target=tgt;
  // 并入已有主伤害，除非两者都有独立威力（追加段）
  const primary=spec?bucket.find(x=>x.do==='damage'):st.damage;
  const separate=primary&&newDmg.power!==undefined&&primary.power!==undefined&&!/威力[:：]/.test(s)?true:false;
  if(primary&&!separate&&primary!==newDmg){
   for(const [k,v] of Object.entries(newDmg))if(k!=='do'&&(primary[k]===undefined||k==='target'&&(v as BPTarget).select==='all'))primary[k]=v;
   if(ch&&(primary.channel===undefined||primary.channel===''||/伤害/.test(s)&&/(物理|能量|精神|真实|魔法|固定)\]?伤害|混合/.test(s)&&!newDmg.pctMaxHp))primary.channel=ch;
  }else{
   newDmg.channel??=(ch||channelOf(s+tagText)||channelOf(whole.replace(/附加\d+(?:点)?伤害的固定伤害|固定伤害/g,''))||(opts.equipment?'physical':'energy'));
   if(newDmg.power===undefined&&!newDmg.pctMaxHp&&!newDmg.pctLostHp&&!newDmg.selfPctLostHp){const mg=magnitude(s);if(mg!==1)newDmg.power=Math.round(ctx.power*mg);}
   if(/追加一段|额外(?:追加|附加)一道/.test(s)&&primary){newDmg.sure=newDmg.sure??/必中/.test(s);}
   push(newDmg);if(!spec&&!st.damage)st.damage=newDmg;
  }
  // “对沿途所有敌人造成同样伤害” / 溅射
  if(/沿途所有敌人造成同样伤害|对所有被命中目标/.test(s)&&st.damage)st.damage.target={side:'enemy',select:'all'};
 }
 // 双分支概率：“50%几率A，50%几率B”
 const branches=[...s.matchAll(/(\d+)%(?:几率|概率)(?:\(d20[^)]*\))?/g)];
 if(branches.length>=2&&st.damage&&/伤害/.test(s)&&flag('branch')){
  const parts=s.split(/\d+%(?:几率|概率)(?:\(d20[^)]*\))?/).slice(1);const base=st.damage;
  const opts=parts.map(p=>{const hits=p.match(new RegExp('造成'+NUM+'次伤害'));const o:BPStep={...base,do:'damage'};delete o.target;if(hits)o.hits=n(hits[1]);else delete o.hits;if(targetOf(p,ctx.tier)?.select==='all')o.target={side:'enemy',select:'all'};return [o];});
  const i=st.steps.indexOf(base);if(i>=0)st.steps.splice(i,1,{do:'random',count:1,options:opts});st.damage=undefined;
 }
 // 不产生新伤害、但修饰主伤害的条款
 if(st.damage&&!spec){const d=st.damage;
  const sh=s.match(/伤害(?:的总值)?的(\d+)%(?:将被|会)?转化为(?:自身)?(?:的)?(?:临时)?护盾/);if(sh&&d.toShield===undefined)d.toShield=Number(sh[1]);
  const pr=s.match(/穿透(\d+)%|(\d+)%穿透/);if(pr&&d.pierce===undefined&&!opts.equipment)d.pierce=Number(pr[1]??pr[2]);
  const hc=s.match(new RegExp('(?:共计|进行)'+NUM+'次攻击'));if(hc&&!d.hits&&!d.randomHits)d.hits=n(hc[1]);
  if(/对范围内所有敌人|对视距内所有敌人/.test(s)&&!d.target)d.target={side:'enemy',select:'all'};
  const bx=s.match(/基础伤害为[^，。]*?(\d+(?:\.\d+)?)倍/);if(bx)d.multiplier=Number(bx[1]);
  if(/必定命中|必中/.test(s))d.sure=true;
  if(/必定造成\[?超暴击/.test(s))d.crit={chance:100,mult:2.5};
 }
 // 下次攻击翻倍 → [蓄力]
 if(/下次攻击(?:的)?(?:威力|伤害)翻倍|威力翻倍/.test(s)&&flag('charge'))push({do:'status',status:'蓄力',target:{side:'self'},turns:3});

 // ---- 状态
 const stds=mentionedStd(s);
 const random=s.match(new RegExp('随机(?:为|对)?[^，。]*?附加'+NUM+'(?:项|种|个)'));
 const statusSteps:BPStep[]=[];
 for(const x of stds){
  const loose=!passive&&!opts.equipment&&(ctx.name.includes(x.word)||tagText.includes(x.word));
  if(!applied(s,x.word,loose))continue;
  if(deathCtx){st.notes.push(`免死/复活条款中的[${x.std.name}]随免死效果一并近似`);continue;}
  if(st.flags.has('std:'+x.std.name+(spec?.on??'')))continue;st.flags.add('std:'+x.std.name+(spec?.on??''));
  const step:BPStep={do:'status',status:x.std.name};const turns=turnsNear(s,x.word);if(turns)step.turns=turns;
  const layers=s.match(new RegExp('(\\d+)层[\\[【]?'+esc(x.word)));if(layers)step.stacks=Number(layers[1]);
  const maxS=s.match(/最高叠加(\d+)层/);if(maxS)step.maxStacks=Number(maxS[1]);
  if(/不可(?:移除|驱散)|无法(?:被)?(?:移除|驱散|净化|解除)|不会自主消除|仅可被同等级以上的净化/.test(s))step.dispellable=false;
  const dot=s.match(/(?:每回合)?(?:损失|失去|受到)(?:其)?(\d+(?:\.\d+)?)%(?:的)?最大(?:HP|生命)(?:值)?(?:的)?(?:真实)?(?:伤害)?/);if(dot&&x.std.polarity==='negative')step.dotPct=Number(dot[1]);
  if(x.std.polarity==='negative'){
   const sv=saveIn(s);if(sv)step.save=sv;const c=chanceIn(s);if(c!==undefined&&c<1&&!random&&!spec?.chance)step.chance=c;
   if(form&&/失败则陷入/.test(s)){step.target={side:'self'};step.chance=.25;st.flags.add('formRisk');(st as {formRisk?:BPStep}).formRisk=step;continue;}
   if(tgt&&!spec)step.target=tgt;
   if(/(?:对|使)(?:命中|所有被命中|受击)/.test(s)&&st.damage&&!spec){st.damage.onHit=[...((st.damage.onHit as BPStep[]|undefined)??[]),step];continue;}
   if(/每次命中为目标叠加/.test(s)&&st.damage){st.damage.onHit=[...((st.damage.onHit as BPStep[]|undefined)??[]),{...step,stacks:1}];continue;}
  }else if(!/(?:为|使)(?:目标|对方|敌)/.test(s.slice(Math.max(0,s.indexOf(x.word)-10),s.indexOf(x.word)))||/友|同伴/.test(s))step.target={side:/友军|队友|同伴|己方|友方/.test(s)?'ally':'self',...(/所有友|全体友|全体队友|己方全体|所有友方/.test(s)?{select:'all' as const}:{})};
  statusSteps.push(step);
 }
 if(random&&statusSteps.length>1){const count=n(random[1])??1;push({do:'random',count:Math.min(count,statusSteps.length),options:statusSteps.map(x=>[{...x,target:{side:'enemy',select:'all'}}])});if(/无视一切免疫|无视免疫|必定强制附加/.test(s))st.notes.push('“无视一切免疫”按普通状态施加，免疫冲突由执行器仲裁');}
 else for(const x of statusSteps){
  if(passive&&!spec){
   if(findStd(String(x.status))?.polarity==='negative'){const on=hitContext(s)||/下毒|淬毒|附着|攻击/.test(s)?'hit':'battle_start';const b=bucketFor(st,{on,...(on==='hit'&&chanceIn(s)===undefined?{chance:.3}:{})});if(on==='battle_start')x.target={side:'enemy',select:'all'};b.push(x);continue;}
   if(x.turns===undefined)x.permanent=true;
  }
  if(aura&&findStd(String(x.status))?.polarity==='negative'){push({do:'status',status:{name:ctx.name,polarity:'positive',triggers:[{on:'hit',steps:[x]}]},target:{side:'self'},turns:turnsNear(s,'')??3});continue;}
  push(x);
 }
 if(st.isField===false&&/(?:展开|张开|开启|制造|形成)[^，。]{0,14}(?:领域|结界|空间|仲夏夜)|领域内|结界中|用[^，。]{0,8}覆盖|覆盖整个|绝对的混乱|陷入\[?黑夜/.test(s)&&!/对任意结界|高覆盖率/.test(s)&&!passive)st.isField=true;
 if(st.isField)for(const x of statusSteps)if(findStd(String(x.status))?.polarity==='negative')st.fieldNeg.push(x);
 // 原文自定义状态：获得/进入[X]状态；需要[X]
 for(const g of s.matchAll(/(?:使自身|自身|自己|伊瑟利亚|你)?(?:获得|进入|陷入)\s*[\[【]([^\]】]{1,12})[\]】]\s*(?:状态|效果)?(?:\((\d+)回合\))?/g)){
  const nm=g[1]!;if(findStd(nm)||st.flags.has('cs:'+nm)||deathCtx||/^(?:绝对闪避|超暴击|强暴击)$/.test(nm))continue;
  if(/^优势$/.test(nm)){if(flag('luck'))push({do:'luck',uses:1,...(passive&&!spec?{permanent:true}:{turns:3})});continue;}
  const subjSelf=/自身|自己|使用后|你|进入/.test(s.slice(Math.max(0,g.index!-8),g.index!+2))||!/(?:目标|敌|对方)/.test(s.slice(Math.max(0,g.index!-8),g.index!));if(!subjSelf)continue;
  st.flags.add('cs:'+nm);const tail=whole.slice(Math.max(0,whole.indexOf(g[0])));const ms=mods(tail.slice(0,120),q);
  push({do:'status',status:{name:nm,polarity:'positive',...(ms.length?{mods:ms}:{}),...(/伤害(?:转变|转化)为\[?真实/.test(tail)?{mods:[...ms,{stat:'穿透',pct:50}]}:{})},target:{side:'self'},turns:g[2]?Number(g[2]):turnsNear(s,nm)??99});
 }
 const need=s.match(/(?:需要|需|要求|必须)(?:自身)?(?:处于|拥有|具有)?\s*[\[【]([^\]】]{1,12})[\]】]\s*(?:状态)?(?:下)?(?:才)?(?:能|可)?/);
 if(need&&!passive&&!findStd(need[1]!)){(st as {requires?:BPCond[]}).requires=[{kind:'has_status',status:need[1]}];if(/消耗|移除|待发|装填|上膛|蓄/.test(s+need[1]))push({do:'consume',status:need[1]});}

 // ---- 防御类
 for(const r of reductions(s)){if(!passive&&!r.turns)r.turns=/下次受到/.test(s)?undefined:turnsNear(s,'伤害')??2;if(/下次受到/.test(s)){r.next=1;r.turns=3;}if(/执行\[?格挡\]?时/.test(s)){r.next=1;r.turns=3;}if(passive&&/在接下来/.test(s)){r.turns=turnsNear(s,'')??2;}push(r);}
 if(/护盾|屏障|护膜|无形之墙|魔法盾|护罩|盾牌/.test(s)&&!/无视[^，。]{0,6}护盾|转化为(?:自身)?(?:的)?(?:临时)?护盾|护盾值|护盾链接|护盾效果/.test(s)&&flag('shield')){
  const amt=s.match(/(\d+)点护盾/),pp=s.match(/(\d+)%(?:最大)?(?:生命|HP)的?护盾/);const sh:BPStep={do:'shield',...(amt?{amount:Number(amt[1])}:{}),...(pp?{pct:Number(pp[1])}:{})};
  if(!amt&&!pp)sh.pct=q;const tr=turnsNear(s,'护盾');if(tr)sh.turns=tr;if(/友军|队友|同伴|玩偶/.test(s))sh.target={side:'ally',...(/所有|全体/.test(s)?{select:'all' as const}:{})};push(sh);}
 const refl=s.match(/(?:将)?(?:受到(?:的)?)?(?:伤害的)?(\d+)%(?:反弹|等额反弹)|反弹(?:受到的)?(?:伤害的)?(\d+)%/);
 if(refl)push({do:'reflect',pct:Number(refl[1]??refl[2]),...(passive?{permanent:true}:{})});
 else if(/反弹|弹开|反射|折射|等额反弹|原封不动地同样施加/.test(s)&&!/减益|负面/.test(s)&&flag('reflect')){const once=/每场战斗一次|每场战斗限一次|\(1次\/战斗\)/.test(s);if(/弹开|完全无视本次攻击/.test(s)&&!/原封不动|等额/.test(s)){if(passive)push({do:'dodge',pct:/判定|对抗/.test(s)?50:q,permanent:true});else{push({do:'guard',pct:100,next:2,turns:2});if(/弹开/.test(s))push({do:'reflect',pct:q+30,uses:2,turns:2,...(/物理和魔法|物理与魔法/.test(s)?{channels:['physical','energy']}:{})});}}else push({do:'reflect',pct:/原封不动|等额/.test(s)?100:q+10,...(/物理和魔法|物理与魔法/.test(s)?{channels:['physical','energy']}:{}),...(once?{uses:1,permanent:true}:passive?{permanent:true,...(/判定|对抗/.test(s)?{reflectChance:.5}:{})}:{turns:2})});}
 if(/反弹(?:一切)?(?:减益|负面)/.test(s)){push({do:'immune',to:['debuffs']});st.notes.push('“反弹减益”按免疫负面状态近似');}
 if(/反击/.test(s)&&flag('counter')){const pd=s.match(/(?:其|对方)?伤害(\d+)%的反击/)??s.match(/反击.{0,6}(\d+)%/);push({do:'counter',...(pd?{pctOfDamage:Number(pd[1])}:{}),...(passive?{permanent:true}:{turns:turnsNear(s,'')??2})});}
 if(/格挡|招架/.test(s)&&!/无法格挡|被闪避或格挡|执行\[?格挡/.test(s)&&flag('parry'))push({do:'guard',pct:q+20,next:1,turns:3});
 if(/绝对闪避|必定闪避/.test(s)&&flag('dodgeU')){const u=s.match(/(\d+)次\/战斗|接下来(\d+)次/);push({do:'dodge',uses:Number(u?.[1]??u?.[2]??1),...(passive?{permanent:true}:{})});}
 if(/抵消(?:一次)?伤害/.test(s)&&flag('absorb'))push({do:'guard',pct:100,next:1,...(passive?{permanent:true}:{turns:3})});
 if(/嘲讽|强制所有敌对目标[^，。]{0,6}攻击自己|吸引(?:所有)?(?:敌人)?(?:的)?(?:攻击|仇恨)/.test(s)&&!stds.some(x=>x.std.name==='嘲讽')&&flag('taunt'))push({do:'status',status:'嘲讽',target:{side:'enemy',select:'all'},turns:1});

 // ---- 治疗与恢复
 const heal=s.match(/(?:恢复|回复|治疗|复活)(?:自身|目标)?(?:的)?(\d+)%(?:的)?(?:最大)?(HP\+MP\+SP|HP|生命|MP|法力|SP|体力|MP\+SP)?(?:或(SP|MP))?/);
 const fixedHeal=heal?undefined:fixedHeals(s)[0];
 if(/恢复全部状态|完全恢复/.test(s)){push({do:'heal',resource:'all',pct:100,target:{side:'self'}});push({do:'cleanse',target:{side:'self'}});}
 else if(heal&&!/受到(?:的)?治疗/.test(s)){
  const rs=heal[2]??'HP';const r=/HP\+MP\+SP/.test(rs)?'all':/MP\+SP/.test(rs)?'mp+sp':/MP|法力/.test(rs)?'mp':/SP|体力/.test(rs)?'sp':'hp';
  const everyRound=/每回合/.test(s);const ally=/友军|队友|同伴|己方|友方/.test(s)&&!/自身与其同时/.test(s);const who:BPTarget={side:ally?'ally':'self',...(/所有|全体|范围内/.test(s)&&ally?{select:'all' as const}:{})};
  if(everyRound&&passive&&!spec)bucketFor(st,{on:'round'}).push({do:'heal',resource:r,pct:Number(heal[1]),target:who});
  else if(everyRound&&!passive&&!ally){const nm=s.match(/[\[【]([^\]】]{1,10})[\]】]/)?.[1];if(nm)st.flags.add('cs:'+nm);push({do:'status',status:{name:nm&&!findStd(nm)?nm:ctx.name+'·恢复',polarity:'positive',...(r==='hp'?{hotPct:Number(heal[1])}:{mods:[]})},target:{side:'self'},turns:turnsNear(s,'')??3});}
  else if(everyRound&&!passive)push({do:'field',name:ctx.name+'·恢复',affects:'ally',hotPct:Number(heal[1]),turns:turnsNear(s,'')??3});
  else push({do:'heal',resource:r,pct:Number(heal[1]),target:who});}
 else if(fixedHeal&&!/受到(?:的)?治疗/.test(s)){
  // 0.38.2 原文固定值治疗照原值：“恢复300HP”“每回合恢复200点生命”。
  const r=fixedHeal.resource,n=fixedHeal.amount;
  const everyRound=fixedHeal.perRound;const ally=/友军|队友|同伴|己方|友方/.test(s)&&!/自身与其同时/.test(s);const who:BPTarget={side:ally?'ally':'self',...(/所有|全体|范围内/.test(s)&&ally?{select:'all' as const}:{})};
  if(everyRound&&passive&&!spec)bucketFor(st,{on:'round'}).push({do:'heal',resource:r,amount:n,target:who});
  else if(everyRound&&!passive&&!ally){const nm=s.match(/[\[【]([^\]】]{1,10})[\]】]/)?.[1];if(nm)st.flags.add('cs:'+nm);push({do:'status',status:{name:nm&&!findStd(nm)?nm:ctx.name+'·恢复',polarity:'positive',...(r==='hp'?{hotAmount:n}:{mods:[]})},target:{side:'self'},turns:turnsNear(s,'')??3});}
  else if(everyRound&&!passive)push({do:'field',name:ctx.name+'·恢复',affects:'ally',hotAmount:n,turns:turnsNear(s,'')??3});
  else push({do:'heal',resource:r,amount:n,target:who});}
 else if(/治疗|治愈|疗伤|恢复生命|回复生命|愈合|洗涤伤痛|修复身体/.test(s)&&!/受到治疗|治疗效果|无法(?:进行)?治疗|减疗|禁疗|阻碍愈合|转化为治疗/.test(s)&&!passive&&flag('heal'))push({do:'heal',.../友军|同伴|队友|单一目标|他人|伤者/.test(s)?{target:{side:'ally' as const}}:/自身|自己|自我|本身/.test(s)?{target:{side:'self' as const}}:{}});
 if(/无法(?:进行)?治疗|阻碍愈合|减疗|禁疗/.test(s)&&!stds.some(x=>x.std.name==='禁疗')&&flag('noheal')){const x:BPStep={do:'status',status:'禁疗',turns:turnsNear(s,'治疗')??2};if(passive&&!spec)bucketFor(st,{on:'hit'}).push(x);else push(x);}
 const regen=s.match(/(?:MP|魔力|法力)恢复\s*\+?\s*(\d+)%/);
 if((regen||/几乎无限的魔力|魔力(?:持续)?恢复/.test(s))&&passive)bucketFor(st,{on:'round'}).push({do:'heal',resource:'mp',pct:regen?Math.min(30,Number(regen[1])/5):q/2,target:{side:'self'}});
 if(/吸血|造成伤害的(\d+)%转化为(?:自身)?(?:HP|生命)/.test(s)&&passive&&flag('ls')){const p=s.match(/造成伤害的(\d+)%/);st.steps.push({do:'lifesteal_passive',pct:Number(p?.[1]??q)});}
 if(/(?:清除|驱散|解除|净化)(?:单一目标|自身|目标)?(?:身上)?(?:的)?(?:所有|全部)?负面/.test(s)&&!/无法/.test(s)&&!deathCtx&&flag('cleanse'))push({do:'cleanse',target:{side:/单一目标|友/.test(s)?'ally':'self'}});
 if(/平复|安抚/.test(s)&&/负面|恐惧|焦躁/.test(s)&&flag('calm'))push({do:'cleanse',target:{side:'ally',select:'all'}});

 // ---- 属性修正
 const md=form?[]:mods(s,q);
 if(md.length&&passive&&spec?.on==='round'&&!/叠加|每回合(?:提升|增加)/.test(s)){bucket=st.steps;spec=undefined;}
 if(md.length){
  const debuffEnemy=/(?:目标|敌人|异性|对方|敌方|所有敌|攻击自身时|面对你时)[^，。]{0,14}(?:命中|闪避|检定|力量|敏捷|体质|伤害)[^，。]{0,6}[-减]/.test(s)||/使(?:其|对方|敌方|目标)/.test(s);
  const pos=md.filter(x=>(x.add??x.pct??0)>0),neg=md.filter(x=>(x.add??x.pct??0)<0);const allyAura=/友军|队友|同伴|己方|友方/.test(s);
  const nm=ctx.name;const temp=!passive||!!spec||/接下来|下次|持续期间/.test(s);
  if(pos.length&&!(pos.length===1&&pos[0]!.stat==='受到伤害'))push({do:'stat',mods:pos.filter(x=>x.stat!=='受到伤害'||!debuffEnemy),target:allyAura?{side:'ally',select:'all'}:{side:'self'},...(temp?{turns:turnsNear(s,'')??3}:{}),name:nm});
  const vul=pos.filter(x=>x.stat==='受到伤害');
  if(neg.length||vul.length&&debuffEnemy){const list=[...neg,...(debuffEnemy?vul:[])];const x:BPStep={do:'stat',mods:list,target:debuffEnemy||!passive?{side:'enemy',select:tgt?.select??(passive?'all':'single')}:{side:'self'},turns:turnsNear(s,'')??3,name:nm};if(passive&&!spec&&debuffEnemy){delete x.turns;x.permanent=true;}push(x);}
 }

 // ---- 免死/不死/复活
 const dg=s.match(new RegExp('(?:受到)?致(?:死|命)伤害时保留(\\d+)点(?:HP|生命)(?:\\(每场(?:战斗)?'+NUM+'次\\))?'));
 if(dg&&flag('dg'))push({do:'death_guard',keepHp:Number(dg[1]),uses:n(dg[2])??1});
 else if(deathCtx&&!/保留/.test(s)&&flag('dg')){
  const uses=s.match(new RegExp('每(?:日|场)'+NUM+'次'));const hp=s.match(/以(\d+)%(?:HP|生命)/);
  if(/幻影|替身|代偿|瞬移|传送/.test(s)){push({do:'death_guard',uses:n(uses?.[1])??1,healPct:0});push({do:'untargetable',turns:1});}
  else push({do:'death_guard',uses:n(uses?.[1])??(/每当|每次|永远|只要|无限|总会|不会真正死/.test(s)?0:1),healPct:hp?Number(hp[1]):/复活|重生|恢复|休眠/.test(s)?q+10:0});
  if(/驱散所有负面|解除所有负面/.test(s))st.notes.push('复活时驱散负面效果按复苏治疗近似');}
 if(/\[不死\]|不死状态/.test(s)&&flag('undying'))push({do:'undying',turns:turnsNear(s,'不死')??2});
 if(/锁血/.test(s)&&!dg&&flag('dg'))push({do:'death_guard',uses:1});

 // ---- 免疫
 const imm=s.match(/免疫([^，。;；]{1,40})/);
 if(imm&&!/非高阶感知|衰老|疾病/.test(imm[1]!)){const words=imm[1]!.split(/[、,，/和与及]/).map(x=>x.replace(/[\[\]【】]/g,'').replace(/(?:类)?(?:技能)?效果$/,'')).filter(Boolean);
  const to=words.flatMap(w=>/负面|减益|异常/.test(w)?['debuffs']:/控制/.test(w)?['control']:/指向性/.test(w)?['debuffs']:/(物理|能量|精神|真实)伤害/.test(w)?[CH[w.match(/(物理|能量|精神|真实)/)![1]!]!]:findStd(w)?[findStd(w)!.name]:/惑心|预言/.test(w)?['魅惑','混乱']:[]);
  if(to.length&&flag('imm'))push({do:'immune',to:[...new Set(to)],...(!passive||spec?{turns:turnsNear(s,'')??2}:{})});}
 if(/无视(?:任何)?即死|免疫即死|无视任何即死/.test(s)&&flag('immI'))push({do:'immune',to:['instant']});

 // ---- 召唤/分身
 const summonVerb=/召唤|召集|活化|生成[^，。]{0,8}(?:召唤物|分身|士兵|玩偶|魔像)|制造一个[^，。]{0,18}分身|分出[^，。]{0,12}分身|具象化为|召出|唤出|赋予[^，。]{0,6}生命|玩偶[^，。]{0,10}(?:获得行动|作战能力)|人偶[^，。]{0,10}(?:战斗|辅助)/;
 if(/召唤[^，。]{0,10}(?:护盾|力场|屏障|结界)|虚影环绕|环绕周身/.test(s)&&/致命/.test(s)&&flag('dg'))push({do:'death_guard',uses:1,keepHp:1});
 // “召唤烈焰/雷电/陨石”是元素现象，不是召唤单位。
 if(summonVerb.test(s)&&!/召唤链接|召唤物\/构装体|召唤库|召唤[^，。]{0,10}(?:护盾|力场|屏障|结界)|虚影环绕|环绕周身/.test(s)&&!ELEMENT_SUMMON.test(s)&&flag('summon')){
  const cnt=s.match(/数量\s*[≤<=]*\s*(\d+)/)??s.match(new RegExp(NUM+'(?:名|个|只|具)(?!目标)'));const count=cnt?Math.min(6,n(cnt[1])??2):/大量|数名|许多|群/.test(s)?3:1;
  const lvl=s.match(/第([一二三四五六七])(?:到第([一二三四五六七]))?层级/)??s.match(/层级为.{0,6}低一层/);const tier=lvl?(lvl[1]?Math.max(n(lvl[1])!,n(lvl[2])??0):Math.max(1,ctx.tier-1)):undefined;
  const clone=/分身|二重身/.test(s);const hpP=s.match(/拥有自身(\d+)%HP/),inhP=s.match(/继承(?:自身|本体|施术者)?(?:的)?(?:全部)?(?:属性|能力|面板)?(\d+)%/);
  // 原文写明持续时间才限时；未写则伴随整场（不再默认5回合）。
  const durRe=[new RegExp('(?:持续|存在|存活|维持)(?:时间)?[:：]?'+NUM+'\\s*(?:个)?回合'),new RegExp(NUM+'\\s*(?:个)?回合(?:后)?(?:消失|消散|解除|离场|结束)')];const durM=durRe.map(r=>s.match(r)).find(Boolean)??whole.match(new RegExp('(?:召唤物|分身|玩偶|人偶|魔像|士兵|使魔|眷属)[^。\\n]{0,24}?(?:持续|存在|存活|维持)'+NUM+'\\s*(?:个)?回合'));const dur=/持续至战斗结束|伴随整场|直到战斗结束/.test(whole)?undefined:durM?n(durM[1]):undefined;
  const sm={name:clone?ctx.name+'分身':/王者/.test(s)?'王者':/人偶/.test(s)?'人偶':/玩偶/.test(s)?'玩偶':/魔像/.test(s)?'魔像':/士兵/.test(s)?'士兵':'召唤物',count,...(tier?{level:Math.max(1,tier*4-2)}:{}),...(hpP?{inheritPct:Number(hpP[1])}:inhP?{inheritPct:Number(inhP[1])}:{}),...(dur?{turns:dur}:{})};
  if(passive&&!spec)bucketFor(st,{on:'battle_start'}).push({do:clone?'clone':'summon',summon:sm});else push({do:clone?'clone':'summon',summon:sm});
  if(clone&&/逃跑|逃离/.test(s))push({do:'dodge',uses:1});}

 // ---- 变身/形态
 if(form&&flag('form')){
  const X=ctx.name.match(/化(\S)/)?.[1]??ctx.name.match(/(\S{1,2})化$/)?.[1];const formName=X?X+'形态':ctx.name+'形态';
  const fm=mods(s,q);const lv=s.match(/第([一二三四五六七])层级|跨入第([一二三四五六七])/);
  const drain=s.match(/每回合流失(\d+)%最大HP/);
  const f:BPStep={do:'form',name:formName,turns:turnsNear(whole,'')??4,mods:fm.length?fm:[{stat:'全属性',pct:lv?Math.min(80,Math.max(20,((n(lv[1]??lv[2])??ctx.tier)-ctx.tier)*25)):q}]};
  if(drain)f.drainPct=Number(drain[1]);
  (st as {formStep?:BPStep}).formStep=f;push(f);
  if(/无法攻击或施法|无法攻击/.test(s))push({do:'dodge',uses:2});
  if(lv)st.notes.push(`变身后的层级提升按全属性加成近似（原文第${lv[1]??lv[2]}层级）`);}
 const fs=(st as {formStep?:BPStep}).formStep,risk=(st as {formRisk?:BPStep}).formRisk;
 if(fs&&risk&&!fs.perRound){fs.perRound=[risk];}
 if(fs&&/每回合流失(\d+)%最大HP/.test(s)&&!fs.drainPct)fs.drainPct=Number(s.match(/每回合流失(\d+)%/)![1]);

 // ---- 复制/窃取/封印
 if(/复制(?:一项|一个)?技能|获取[^，。]{0,6}技能|吞噬[^，。]{0,10}技能|模仿[^，。]{0,6}技能|敌方使用过的(?:一个)?技能|使用本场战斗中敌方/.test(s)&&flag('copy'))push({do:'copy',what:'last_used',turns:99,activate:/立即|同时|使用本场/.test(s)});
 if(/窃取[^，。]{0,8}被动|夺取[^，。]{0,6}被动/.test(s)&&flag('stealP'))push({do:'steal_passive',turns:turnsNear(s,'')??3});
 if(/打断|使对方本回合(?:动作|攻击)(?:\/攻击)?失效|使[^，。]{0,6}(?:动作|行动)失效/.test(s)&&flag('interrupt')){if(passive){bucketFor(st,{on:spec?.on==='enemy_action'?'enemy_action':'enemy_cost',chance:chanceIn(s)??.3}).push({do:'cancel'});}else push({do:'interrupt'});}
 if(/封印(?:其)?施法|禁止施法|施放强制失败/.test(s)&&!stds.some(x=>x.std.name==='沉默')&&flag('silence'))push({do:'status',status:'沉默',turns:turnsNear(s,'')??2,...(/范围内所有/.test(s)?{target:{side:'enemy',select:'all'}}:{})});
 if(/禁用(?:所有|全部)?技能|封锁(?:所有|全部)?技能|无法使用技能|无法使用主动技能/.test(s)&&!/自身|自己/.test(s)&&!stds.some(x=>x.std.name==='沉默')&&flag('seal'))push({do:'seal',what:'skills',turns:turnsNear(s,'')??2});
 if(/无法使用\[?道具\]?/.test(s)&&flag('sealItem'))push({do:'seal',what:'item',turns:turnsNear(s,'道具')??2});
 if(/所有被动技能暂时失效|被动(?:技能|能力)?(?:暂时)?失效/.test(s)&&!/永久/.test(s)&&flag('sealP'))push({do:'seal',what:'passives',turns:turnsNear(s,'')??2});
 if(/(?:删除|移除|抹除|削除)[^，。]{0,8}被动/.test(s)&&flag('delP')){const x:BPStep={do:'seal',what:/装备/.test(s)?'all':'passives',count:1,remove:/永久|删除|抹除|削除/.test(s)};const c=chanceIn(s);if(c!==undefined)x.chance=c;if(passive&&!spec)bucketFor(st,{on:'hit'}).push(x);else push(x);}
 if(/无法(?:进行)?(?:任何)?\[?(?:动作|行动)\]?|无法使用\[?动作\]?|禁止\[?动作\]?|失去抵抗力/.test(s)&&/敌|目标|对方|单位/.test(s)&&!stds.some(x=>['禁动','眩晕','击倒','时停'].includes(x.std.name))&&flag('noact')){
  const x:BPStep={do:'status',status:/攻击/.test(s)&&/无法(?:进行)?(?:任何)?\[?动作\]?或\[?攻击/.test(s)?'眩晕':'禁动',turns:turnsNear(s,'')??(passive?1:2),...(/所有敌|全体敌|所有单位|所有在场敌方|范围内/.test(s)?{target:{side:'enemy',select:'all'} as BPTarget}:{})};
  if(passive&&!spec){x.target={side:'enemy',select:'all'};bucketFor(st,{on:/所有在场敌方/.test(s)?'round':'miss'}).push(x);}else push(x);}
 if(/衣服脱落|衣物脱落|卸除(?:其)?装备|剥夺(?:其)?装备|解除武装|打落武器/.test(s)&&flag('disarm'))push({do:'seal',what:'equipment',turns:turnsNear(s,'')??2});

 // ---- 隐匿/侦查/位移/时序
 if(/隐身|潜行|隐匿|光学迷彩|隐形|遁入阴影|存在感彻底消失/.test(s)&&!stds.some(x=>x.std.name==='隐身')&&flag('stealth')){const x:BPStep={do:'status',status:'隐身',target:/友军|友方/.test(s)?{side:'ally',select:'all'}:{side:'self'},turns:turnsNear(s,'')??2};if(passive&&!spec)bucketFor(st,{on:'battle_start'}).push(x);else push(x);}
 if(/分析|洞察|看破|侦查|演绎|找出真相|获取目标[^。]{0,30}信息/.test(s)&&flag('scan')){if(passive)push({do:'stat',mods:[{stat:'命中',pct:q/2},{stat:'暴击',pct:q/4}],target:{side:'self'},name:ctx.name});else{push({do:'status',status:'标记',turns:3});push({do:'reveal'});}}
 if(/瞬步|瞬移|传送|穿梭|闪现|高速移动|位移|空间转移/.test(s)&&!/位移类/.test(s)&&flag('blink')){if(passive&&!spec)push({do:'dodge',pct:/无消耗|任意/.test(s)?q:Math.round(q/2),permanent:true});else if(!passive){push({do:'status',status:'闪避',target:{side:'self'},turns:2});push({do:'atb',mode:'push',value:30,target:{side:'self'}});}}
 if(/互换|交换/.test(s)&&/状态|情感|态度|立场/.test(s)&&flag('swap'))push({do:'swap',what:/HP|MP|SP/.test(s)?'statuses':'statuses'});
 if(/(?:减益|负面)(?:效果|状态)?反转为增益|反转为增益/.test(s)&&flag('invert'))push({do:'invert',polarity:'negative',target:{side:'self'}});
 if(/额外(?:获得|开启)?(?:一个|一次)?(?:额外的)?回合|开启一个额外的回合|再行动一次|立即再次行动/.test(s)&&flag('extra')){const x:BPStep={do:'extra_turn'};if(/击杀/.test(s)&&(passive||opts.equipment))bucketFor(st,{on:'kill'}).push(x);else push(x);}
 if(/强制结束所有敌方回合/.test(s)&&flag('endturn'))push({do:'atb',mode:'retreat',value:100,target:{side:'enemy',select:'all'}});
 const atkP=!opts.equipment&&s.match(/攻击力(?:至少为|为)?:?(\d{3,})/);if(atkP&&flag('atkP'))st.steps.push({do:'stat',mods:[{stat:'物理伤害',add:Number(atkP[1])}],name:ctx.name,...(passive?{}:{turns:3})});
 if(/(?:兵器|武器)[^，。]{0,4}无法对自己造成伤害/.test(s)&&flag('immW'))st.steps.push({do:'guard',pct:50,channels:['physical']});
 const cap=s.match(/(?:每回合|单回合)(?:最多|至多)受到(\d+)%最大HP伤害|每回合(?:开始前|开始时)?[^，。]*承受(?:的)?伤害(?:最多|不超过)(?:最大生命的)?(\d+)%|(?:单回合|每回合)[^，。]{0,6}伤害上限(\d+)%/);
 if(cap&&flag('cap'))push({do:'damage_cap',pctMaxHp:Number(cap[1]??cap[2]??cap[3])});
 if(/(?:消耗|以)\s*MP\s*(?:100%)?\s*减免伤害|魔力护体|法力护盾/.test(s)&&flag('mshield'))push({do:'mana_shield',resource:'mp',pct:100,permanent:passive});
 if(/锁定为20|d20检定值都锁定|永远取优势骰|检定骰均取优势/.test(s)&&flag('luck'))push({do:'luck',uses:/下(\d+)回合/.test(s)?6:3,...(passive?{permanent:true}:{turns:turnsNear(s,'')??2})});
 if(/代偿|替身|分担/.test(s)&&passive&&!/HP\+SP|不足则/.test(s)&&flag('share')){if(/致命/.test(s)&&flag('dg')){st.steps.push({do:'death_guard',uses:1});}if(/控制/.test(s))st.steps.push({do:'immune',to:['control'],uses:1,permanent:true});}
}

function buildField(t:string,st:State,ctx:ParseContext,q:number){
 const turns=/持续至战斗结束|直到战斗结束|持续至少\d+天/.test(t)?99:turnsNear(t,'')??3;
 if(/伤害[^，。]*转化为治疗|治疗[^，。]*转化为伤害/.test(t)){
  st.steps.push({do:'ir',summary:'领域内伤害与治疗互相转化',effect:{op:'field',field:'reverse'},library:{fields:{reverse:{name:ctx.name,group:'reverse',priority:50,stack:'replace',targeting:{side:'any',selection:'all',life:'alive'},status:'law',duration:turns>=99?{clock:'permanent',value:0}:{clock:'round',value:turns}}},statuses:{law:{name:'伤疗反转',tags:['伤疗反转'],polarity:'neutral',duration:{clock:'permanent',value:0},stack:'refresh',maxStacks:1,scaleWithStacks:false,priority:0,dispellable:false,removeOnDeath:true,scope:'battle',triggers:[{id:'d',event:'before_damage',scope:'self',action:'d'},{id:'h',event:'before_heal',scope:'self',action:'h',conditions:[{kind:'event_resource',key:'hp'}]}]}},actions:{d:{target:'self',cost:{hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}},castMs:0,recoveryFactor:1,perBattleUses:0,effects:[{op:'alter_event',mode:'damage_to_heal'}]},h:{target:'self',cost:{hp:{flat:0,maxFraction:0},mp:{flat:0,maxFraction:0},sp:{flat:0,maxFraction:0}},castMs:0,recoveryFactor:1,perBattleUses:0,effects:[{op:'alter_event',mode:'heal_to_damage'}]}}}});
  return;}
 const f:BPStep={do:'field',name:ctx.name,affects:'enemy',turns};
 const neg=st.fieldNeg;
 if(neg.length){for(const x of neg){for(const list of [st.steps,...[...st.trig.values()].map(v=>v.steps)]){const i=list.indexOf(x);if(i>=0)list.splice(i,1);}}f.perRound=neg.length>1?[{do:'random',count:1,options:neg.map(x=>[{...x,chance:x.chance??.35,target:{side:'enemy',select:'all'}}])}]:[{...neg[0]!,chance:neg[0]!.chance??.35,target:{side:'enemy',select:'all'}}];}
 const dmg=st.steps.find(x=>x.do==='damage');
 if(dmg&&/倾泻|持续轰击|弹幕|每回合/.test(t)){f.perRound=[...((f.perRound as BPStep[]|undefined)??[]),{...dmg,target:{side:'enemy',select:'all'}}];}
 else if(!dmg&&/倾泻攻击|弹幕|爆破/.test(t)){st.steps.push({do:'damage',channel:'energy',target:{side:'enemy',select:'all'},power:Math.round(ctx.power*1.5)});}
 if(!f.perRound)f.mods=[{stat:'命中',pct:-q},{stat:'闪避',pct:-q}];
 if(/无法离开|无法逃跑|包括移动或逃跑/.test(t))st.notes.push('领域禁止离开：以战斗内不可撤离近似');
 st.steps.push(f);
}

function qualitative(bp:Blueprint,text:string,tags:string,ctx:ParseContext,q:number,equipment:string){
 const all=ctx.name+'。'+text+tags;const h=(x:number)=>Math.max(1,Math.round(x));
 if(equipment){
  // 乐器/演奏：每回合为同伴奏响增益、为敌人奏响减益
  if(/乐器|演奏|琴|笛|竖琴|歌/.test(all)&&/buff|debuff|增益|减益|鼓舞|削弱/i.test(all)){bp.triggers=[{on:'round',steps:[{do:'stat',mods:[{stat:'伤害',pct:h(q/3)}],target:{side:'ally',select:'all'},turns:1,name:ctx.name+'·增益乐章'},{do:'stat',mods:[{stat:'命中',pct:-h(q/3)}],target:{side:'enemy',select:'all'},turns:1,name:ctx.name+'·减益乐章'}]}];return;}
  if(/武器|剑|刀|枪|斧|弓|锤|杖|匕首|拳套|炮|镰|矛|弩/.test(equipment+all)){const staff=/法杖|魔杖|法器|施法媒介|魔导|法典|杖|能量炮|光束炮/.test(all);bp.steps.push({do:'stat',mods:[{stat:staff?'能量伤害':'物理伤害',pct:Math.round(q/2)}],name:ctx.name});if(/锚点/.test(all))bp.steps.push({do:'guard',pct:h(q/3),channels:['mental']});
   if(/淬毒|毒牙|毒/.test(all))bp.triggers=[{on:'hit',chance:.3,steps:[{do:'status',status:'中毒'}]}];return;}
  if(/防具|护甲|铠|盾|外套|衣|甲|靴/.test(equipment+all)){bp.steps.push({do:'guard',pct:Math.round(q/2)});return;}
  if(/无敌|不可被选中/.test(all)){bp.kind='active';bp.steps.push({do:'untargetable',turns:1});bp.cooldown=5;return;}
  if(/抵消/.test(all)){bp.steps.push({do:'guard',pct:100,next:1});return;}
  if(/灵体/.test(all)){bp.kind='active';bp.steps.push({do:'form',name:'灵体形态',turns:2,mods:[{stat:'闪避',pct:q},{stat:'物理减伤',pct:50}]});bp.perBattle=1;return;}
  if(/精神伤害/.test(all)){bp.steps.push({do:'stat',mods:[{stat:'精神伤害',pct:Math.round(q/2)}],name:ctx.name});return;}
  // 储物类饰品：战斗中取出应急物资（每场一次）
  if(/储物|收纳|储存|内部空间|异空间/.test(all)){bp.triggers=[{on:'hp_below',hpPct:50,uses:1,steps:[{do:'heal',resource:'hp',pct:h(q),target:{side:'self'}},{do:'heal',resource:'mp',pct:h(q/2),target:{side:'self'}}]}];return;}
  // 精神锚点：稳固心智，抵御精神伤害
  if(/锚点|护身符|心智/.test(all)){bp.steps.push({do:'guard',pct:h(q/2),channels:['mental']},{do:'stat',mods:[{stat:'精神检定',add:2}],name:ctx.name});return;}
  bp.steps.push({do:'stat',mods:[{stat:'检定',add:1},{stat:'精神',pct:Math.round(q/4)}],name:ctx.name});return;
 }
 if(bp.kind==='passive'){
  if(/抵挡致命|抵御致命|免疫致命/.test(all)){bp.steps.push({do:'death_guard',uses:1,keepHp:1});return;}
  if(/真祖|不死之身|再生力极强|超速再生|不死|致命伤后|持续的?恢复/.test(all)){bp.triggers=[{on:'round',steps:[{do:'heal',resource:'hp',pct:h(q/4),target:{side:'self'}}]}];bp.steps.push({do:'death_guard',uses:1,keepHp:1,healPct:h(q/2)});return;}
  // 战斗风格：按风格内容组合有界的常驻修正与触发（不做开场全体硬控）
  if(/战斗风格/.test(tags+ctx.name)){
   const mods:BPMod[]=[],st:BPStep[]=[],tr:BPTrigger[]=[];
   if(/拒绝|否定|隔离|防御|格挡|坚守/.test(all)){st.push({do:'guard',pct:h(q/2)});tr.push({on:'damaged',chance:Math.min(.5,q/100+.1),steps:[{do:'status',status:'虚弱',turns:2,target:{side:'attacker'}}]});}
   if(/控制|认知|变形|幻|掌控|节奏|迷惑|戏弄|游戏/.test(all)){tr.push({on:'hit',chance:Math.min(.6,q/100*1.5+.1),steps:[{do:'status',status:'幻觉',turns:2,target:{side:'hit_target'}}]});mods.push({stat:'闪避',pct:h(q/2)});}
   if(/规避|逃跑|躲|后方/.test(all))mods.push({stat:'闪避',pct:q},{stat:'速度',pct:h(q/2)});
   if(/玩偶|傀儡|操控|活化|魔像|使魔/.test(all))tr.push({on:'battle_start',steps:[{do:'summon',summon:{name:all.match(/玩偶|傀儡|魔像|使魔/)?.[0]??'造物',count:1,level:'caster'}}]});
   if(/剑|刀|枪|招|舞|格斗|身法|灵巧|刁钻|致命|武器|精细|多变/.test(all))mods.push({stat:'命中',pct:h(q/2)},{stat:'暴击',pct:h(q/3)});
   if(/以柔克刚|借力打力|反击/.test(all))st.push({do:'counter',pctOfDamage:h(q+10),counterChance:Math.min(.5,q/100+.1),permanent:true});
   if(/冰|寒|冻|霜/.test(all))tr.push({on:'hit',chance:.3,steps:[{do:'status',status:'冻伤',target:{side:'hit_target'}}]});else if(/火焰|烈焰|灼|炎/.test(all))tr.push({on:'hit',chance:.3,steps:[{do:'status',status:'烧伤',target:{side:'hit_target'}}]});
   if(!mods.length&&!st.length&&!tr.length)mods.push({stat:'命中',pct:Math.round(q/2)},{stat:'闪避',pct:Math.round(q/2)});
   if(mods.length)bp.steps.push({do:'stat',mods,name:ctx.name});bp.steps.push(...st);if(tr.length)bp.triggers=[...(bp.triggers??[]),...tr];return;
  }
  // 分析/看破：战场本就全可见，洞察力体现为命中、暴击与命中时施加[标记]
  if(/分析|洞察|看破|演绎|推理|识破|侦查|侦测|观察入微|弱点/.test(all)){bp.steps.push({do:'stat',mods:[{stat:'命中',pct:h(q/2)},{stat:'暴击',pct:h(q/4)}],name:ctx.name});bp.triggers=[{on:'hit',chance:Math.min(.6,q/100+.2),steps:[{do:'status',status:'标记',turns:2,target:{side:'hit_target'}}]}];return;}
  if(/伪装|掩盖|隐匿|潜伏/.test(all)){bp.triggers=[{on:'battle_start',steps:[{do:'status',status:'隐身',turns:2,target:{side:'self'}}]}];bp.steps.push({do:'stat',mods:[{stat:'闪避',pct:h(q/3)},{stat:'精神检定',add:2}],name:ctx.name});return;}
  if(/再生|恢复|治愈|回复/.test(all)&&/友方|队友|同伴|光环|全队/.test(all)){const both=/MP|法力/.test(all);bp.triggers=[{on:'round',steps:[{do:'heal',resource:'hp',pct:h(q/6),target:{side:'ally',select:'all'}},...(both?[{do:'heal',resource:'mp',pct:h(q/6),target:{side:'ally',select:'all'}} as BPStep]:[])]}];return;}
  if(/医学|医疗|生存|烹饪|觅食|草药/.test(all)){bp.triggers=[{on:'round',steps:[{do:'heal',resource:'hp',pct:h(q/8),target:{side:'self'}}]}];bp.steps.push({do:'stat',mods:[{stat:'体质检定',add:1}],name:ctx.name});return;}
  if(/速度|机动|迅捷|疾风|高速/.test(all)){bp.steps.push({do:'stat',mods:[{stat:'速度',pct:h(q/2)},{stat:'闪避',pct:h(q/4)}],name:ctx.name});return;}
  if(/威压|气压|压迫|震慑|王者之气/.test(all)){bp.steps.push({do:'stat',mods:[{stat:'命中',pct:-h(q/4)},{stat:'检定',add:-1}],target:{side:'enemy',select:'all'},name:ctx.name});return;}
  if(/感知|占卜|预知|气运|直觉|洞察/.test(all)){bp.steps.push({do:'stat',mods:[{stat:'闪避',pct:h(q/4)},{stat:'检定',add:2}],name:ctx.name});return;}
  if(/亲和|共鸣|灵兽/.test(all)){bp.steps.push({do:'stat',mods:[{stat:'精神检定',add:2}],name:ctx.name},{do:'guard',pct:h(q/3),channels:['mental']});return;}
  if(/阳光免疫|抗性|耐性/.test(all)){bp.steps.push({do:'immune',to:'烧伤'},{do:'guard',pct:h(q/4),channels:['energy']});return;}
  if(/破晓|神圣|圣权|光辉/.test(all)){bp.steps.push({do:'stat',mods:[{stat:'能量伤害',pct:h(q/2)}],name:ctx.name});bp.triggers=[{on:'round',steps:[{do:'heal',resource:'hp',pct:h(q/8),target:{side:'ally',select:'all'}}]}];return;}
  if(/龙|龙炎|龙血|龙裔/.test(all)){bp.steps.push({do:'stat',mods:[{stat:'最大生命',pct:h(q/2)},{stat:/冰|寒|霜/.test(all)?'能量伤害':'伤害',pct:h(q/2)}],name:ctx.name});return;}
  if(/人鱼|海|潮|水/.test(all)&&/血|混血|种族/.test(all+ctx.sourceId)){bp.steps.push({do:'stat',mods:[{stat:'闪避',pct:h(q/4)},{stat:'能量伤害',pct:h(q/4)}],name:ctx.name});return;}
  if(/圣翼|羽翼|翼/.test(all)){bp.steps.push({do:'stat',mods:[{stat:'速度',pct:h(q/3)},{stat:'闪避',pct:h(q/4)}],name:ctx.name});return;}
  if(/限制伤害|消除过强/.test(all)){bp.steps.push({do:'damage_cap',pctMaxHp:Math.max(15,40-q)});if(/否定|消除|削弱/.test(all)&&/防御|增益|能力/.test(all))bp.triggers=[{on:'hit',chance:Math.min(.6,q/100+.2),steps:[{do:'dispel',count:1,target:{side:'hit_target'}}]}];return;}
  if(/战斗风格|风格|身法/.test(all)){bp.steps.push({do:'stat',mods:[{stat:'命中',pct:Math.round(q/2)},{stat:'闪避',pct:Math.round(q/2)}],name:ctx.name});return;}
  // 制造/锻造：维护精良的装备 → 伤害与减伤；知识储备 → 找准弱点（命中/暴击/暴伤）；语言类确无战斗份量，只给检定
  if(/炼金|锻造|制造|修复|工匠|附魔/.test(all)){bp.steps.push({do:'stat',mods:[{stat:'伤害',pct:h(q/3)},{stat:'减伤',pct:h(q/4)}],name:ctx.name});return;}
  if(/知识|学识|储备|理论|博学|见识/.test(all)){bp.steps.push({do:'stat',mods:[{stat:'命中',pct:h(q/4)},{stat:'暴击',pct:h(q/4)},{stat:'暴击伤害',pct:h(q/2)},{stat:'检定',add:1}],name:ctx.name});return;}
  if(/语言/.test(all)){bp.steps.push({do:'stat',mods:[{stat:'智力检定',add:2},{stat:'精神检定',add:1}],name:ctx.name});return;}
  if(/吸收|汲取|掠夺/.test(all)){bp.triggers=[{on:'round',steps:[{do:'drain',resource:'mp',pct:Math.max(1,Math.round(q/10)),target:{side:'enemy',select:'all'}}]}];return;}
  if(/伪装|掩盖|隐匿|潜伏/.test(all)){bp.triggers=[{on:'battle_start',steps:[{do:'status',status:'隐身',turns:2,target:{side:'self'}}]}];bp.steps.push({do:'stat',mods:[{stat:'精神检定',add:2}],name:ctx.name});return;}
  if(/血脉|天赋|资质/.test(all)){bp.steps.push({do:'stat',mods:[{stat:/魔法|法术|魔力/.test(all)?'智力':'体质',pct:Math.round(q/2)},{stat:'最大法力',pct:Math.round(q/2)}],name:ctx.name});return;}
  if(/逃跑|撤退|求生/.test(all)){bp.steps.push({do:'stat',mods:[{stat:'速度',pct:q},{stat:'闪避',pct:Math.round(q/2)}],name:ctx.name});return;}
  if(/毒素|下毒|神经毒/.test(all)){bp.triggers=[{on:'hit',chance:.35,steps:[{do:'status',status:'中毒'}]},{on:'hit',chance:.2,steps:[{do:'status',status:'幻觉'}]}];return;}
  if(/伤害倍率|受伤倍率/.test(all)){bp.triggers=[{on:'damaged',steps:[{do:'status',status:{name:ctx.name,polarity:'positive',stackable:true,maxStacks:50,mods:[{stat:'伤害',pct:1}]},target:{side:'self'},permanent:true}]},{on:'damage_dealt',steps:[{do:'status',status:{name:ctx.name+'·反噬',polarity:'negative',stackable:true,maxStacks:50,mods:[{stat:'受到伤害',pct:1}]},target:{side:'self'},permanent:true}]}];return;}
  if(/防御|限制|否定/.test(all)){bp.steps.push({do:'guard',pct:Math.round(q/2)});return;}
  if(/精神控制|惑心|法术|魔法/.test(all)){bp.steps.push({do:'stat',mods:[{stat:'精神伤害',pct:q},{stat:'能量伤害',pct:Math.round(q/2)}],name:ctx.name});return;}
  return;
 }
 const layer=all.match(/第([一二三四五六七])层级/);const summonLevel=layer?Math.min(25,((CN[layer[1]!]??1)-1)*4+3):undefined;
 if(/召唤|伙伴|眷属|使魔|坐骑|灵兽/.test(all)&&!ELEMENT_SUMMON.test(all)){const nm=all.match(/[「“"]([^」”"]{1,12})[」”"]/)?.[1]??(/眷属/.test(all)?'眷属':ctx.name.replace(/^召唤/,'')||'召唤物');bp.steps.push({do:'summon',summon:{name:nm,count:/眷属|群|们/.test(all)?2:1,level:summonLevel??'caster'}});return;}
 // 解析并重构/改写目标的结构：瓦解其防护并造成伤害
 if(/重构|重塑|瓦解|频率/.test(all)){bp.steps.push({do:'damage',channel:'energy'},{do:'status',status:'破甲',turns:2},{do:'status',status:'标记',turns:2});return;}
 if(/侦测|侦查|分析|看破|洞察|识别|探查|扫描|感知/.test(all)&&!/伤害|攻击|命令权|支配|统御|号令/.test(all)){const aoe=/范围|所有|全部|周围/.test(all);bp.steps.push({do:'status',status:'标记',turns:3,...(aoe?{target:{side:'enemy',select:'all'}}:{})},{do:'stat',mods:[{stat:'命中',pct:h(q/2)},{stat:'暴击',pct:h(q/4)}],target:{side:'self'},turns:3,name:ctx.name});return;}
 // 当场创造的炼金产物/试剂/道具（0.38.1 敌我两用）：对敌人是多属性伤害（执行器自动取目标最弱属性），对同伴是回复其最缺的资源并解除负面
 if(/创造|制造|工具|试剂|炼金|调配|药剂|炸弹/.test(all)&&!/剧本|命运|因果|附魔|附加[^，。]{0,4}属性/.test(all)){bp.target={side:'any'};bp.steps.push({do:'damage',channel:'energy',types:['火','水','光','暗'],multiplier:.8,when:[{kind:'target_is_enemy'}]},{do:'heal',resource:'auto',pct:h(q/3),when:[{kind:'target_is_ally'}]},{do:'cleanse',count:1,when:[{kind:'target_is_ally'}]});return;}
 // 收纳/异空间：随时取出预存物资与护具；可指定位置取出时从高处砸落物体
 if(/收纳|储物|空间折叠|异空间|半位面|储存/.test(all)){const drop=/指定位置|任意位置|随时取出/.test(all);bp.steps.push(...(drop?[{do:'damage',channel:'physical',multiplier:.7} as BPStep]:[]),{do:'shield',pct:h(q/2),target:{side:'self'}},{do:'atb',mode:'push',value:h(q),target:{side:'self'}});return;}
 if(/幻术|幻象|幻境|幻觉|错觉|认知/.test(all)&&!/梦境|催眠|入梦|睡眠/.test(all)){bp.steps.push({do:'status',status:'幻觉',turns:2,target:{side:'enemy',select:'all'},save:{attr:'精神'}},{do:'status',status:'混乱',turns:1,chance:.3,target:{side:'enemy',select:'all'},save:{attr:'精神'}});return;}
 if(/否定|拒绝|弹开|隔绝/.test(all)){bp.steps.push({do:'guard',pct:100,next:1,turns:2},{do:'reflect',pct:q+30,uses:1,turns:2});return;}
 if(/剑术|剑路|刀法|枪法|连击|连斩|连环|[七五三]式/.test(all)){const k=all.match(/([二三四五六七八九])式/)??all.match(/由[^，。]{0,12}?([二三四五六七八九])式/);const hits=k?CN[k[1]!]??3:3;bp.steps.push({do:'damage',channel:channelOf(all)||'physical',hits,split:true});return;}
 if(/身法|步法|位移|闪现|瞬步|镜步/.test(all)){bp.steps.push({do:'dodge',uses:1},{do:'atb',mode:'push',value:h(q),target:{side:'self'}});return;}
 if(/陷阱|机关|整蛊/.test(all)){bp.steps.push({do:'damage',channel:channelOf(all)||'physical',multiplier:.5},{do:'status',status:'束缚',turns:1});return;}
 if(/寂静|静默|沉默/.test(all)){bp.steps.push({do:'status',status:'沉默',turns:2,target:{side:'enemy',select:'all'},save:{attr:'精神'}});return;}
 if(/梦境|催眠|入梦|睡眠/.test(all)){bp.steps.push({do:'status',status:'睡眠',turns:2,save:{attr:'精神'}},{do:'damage',channel:'mental',multiplier:.6});return;}
 if(/统御|王权|号令|统帅/.test(all)&&!/暗影/.test(all)){bp.steps.push({do:'stat',mods:[{stat:'伤害',pct:h(q/2)},{stat:'命中',pct:h(q/4)}],target:{side:'ally',select:'all'},turns:3,name:ctx.name},{do:'status',status:'恐惧',turns:1,target:{side:'enemy',select:'all'},save:{attr:'精神'}});return;}
 if(/暗影|阴影/.test(all)){bp.steps.push({do:'damage',channel:'energy',types:['暗']},{do:'status',status:'隐身',turns:1,target:{side:'self'}});return;}
 if(/破晓|神圣|圣权|光辉/.test(all)){bp.steps.push({do:'damage',channel:'energy',types:['光'],target:{side:'enemy',select:'all'}},{do:'heal',resource:'hp',pct:h(q/3),target:{side:'ally',select:'all'}});return;}
 if(/领域/.test(all)){bp.steps.push({do:'field',name:ctx.name,affects:'enemy',mods:[{stat:'受到伤害',pct:h(q/2)},{stat:'速度',pct:-h(q/4)}],turns:3});return;}
 if(/血魔法|血术|鲜血|血之/.test(all)){bp.steps.push({do:'damage',channel:'energy',types:['暗'],lifesteal:30});return;}
 if(/保护伞|守护|庇护|保护/.test(all)){bp.steps.push({do:'shield',pct:h(q/2),target:{side:'ally',select:'all'}},...(/镇压|精神/.test(all)?[{do:'damage',channel:'mental',multiplier:.5,target:{side:'enemy',select:'all'}} as BPStep]:[]));return;}
 if(/骨折|崩溃|下手没轻重|测试员/.test(all)){bp.steps.push({do:'damage',channel:'physical+mental'},{do:'status',status:'恐惧',turns:1,chance:.3});return;}
 if(/精神控制|话术|迷恋|支配|惑心|影响.{0,4}判断|强行控制|强制执行自己的命令|臣服|命令权/.test(all)){bp.steps.push({do:'status',status:'魅惑',turns:/(\d)回合/.test(all)?Number(all.match(/(\d)回合/)![1]):2,...(/所有|范围/.test(all)?{target:{side:'enemy',select:'all'}}:{}),...(/无视任何|仅可通过法则/.test(all)?{}:{save:{attr:'精神'}})});return;}
 if(/束缚|拘束|缠绕|禁锢|水带|锁链|银丝|触手/.test(all)&&/控制/.test(all)){bp.steps.push({do:'damage',channel:channelOf(all)},{do:'status',status:'束缚',turns:2});return;}
 if(/临时增强|临时削弱|升华/.test(all)){bp.steps.push({do:'random',count:1,options:[[{do:'stat',mods:[{stat:'伤害',pct:q},{stat:'防御',pct:q}],target:{side:'ally'},turns:99,name:ctx.name}],[{do:'stat',mods:[{stat:'伤害',pct:-q},{stat:'防御',pct:-q}],target:{side:'enemy'},turns:99,name:ctx.name}]]});return;}
 if(/剧本|引导事件|命运|因果/.test(all)){bp.steps.push({do:'luck',uses:3,turns:3},{do:'stat',mods:[{stat:'检定',add:3}],target:{side:'ally',select:'all'},turns:3,name:ctx.name});return;}
 if(/性格[^，。]{0,4}反转|反转/.test(all)){bp.steps.push({do:'invert',polarity:'positive'});return;}
 if(/塑形/.test(all)){bp.steps.push({do:'shield',pct:q,target:{side:'self'}},{do:'damage',channel:'energy',power:Math.round(ctx.power*.6)});return;}
 if(/攻击|伤害|战斗|爆发|打击|死灵|法术|魔法|雷|火|吐息|格斗|体术|龙|炮|破坏|突进|扫击|剑|拳|重压/.test(all)){bp.steps.push({do:'damage',channel:channelOf(all)||(/魔|法|咒|元素|水系|冰系|火系/.test(all)?'energy':'physical'),...(typesOf(all).length?{types:typesOf(all)}:{})});return;}
 if(/强化|附魔|硬化|加强/.test(all)){bp.steps.push({do:'stat',mods:[{stat:'伤害',pct:q},{stat:'减伤',pct:Math.round(q/2)}],target:{side:'ally'},turns:3,name:ctx.name});return;}
 if(/道具|空间/.test(all)){bp.steps.push({do:'shield',pct:h(q/2),target:{side:'self'}},{do:'atb',mode:'push',value:h(q),target:{side:'self'}});return;}
}

const EQUIP_ACTIVE=/主动(?:消耗|使用)|可使用\[|才能使用|可(?:展开|切换)?[^，。]{0,8}释放|发射[^，。]{0,6}(?:弹|炮)|每场战斗一次，(?:恢复|将)|每场战斗1次，(?:可|恢复)/;

/** 解析单个来源条目。返回 undefined 表示没有可用的解析结果。 */
export function parseEntry(entry:{sourceId:string;name:string;raw:unknown},ctx:ParseContext):ParsedEntry|undefined{
 if(/^\/(?:种族|状态定义)\//.test(entry.sourceId))return undefined;
 const item=entry.sourceId.startsWith('/道具定义/');
 const wrapper=rec(entry.raw),stage=typeof wrapper.阶段==='string'?wrapper.阶段:'';
 const raw=typeof entry.raw==='string'?{描述:entry.raw}:stage?(typeof wrapper.原文==='string'?{描述:wrapper.原文}:rec(wrapper.原文)):wrapper;
 const quality=String(raw.品质??raw.品阶??'').replace(/级$/,'');const q=QUALITY_PCT[quality]??(stage==='法则'?40:stage==='权能'?30:stage==='要素'?25:20);
 const type=String(raw.类型??'');const tags=flat(raw.标签);
 const body=[raw.效果,raw.描述,raw.效果描述,raw.主动,raw.被动].filter(x=>x!==undefined).map(flat).join('\n')||flat(Object.fromEntries(Object.entries(raw).filter(([k])=>!['品质','类型','标签','消耗','名称','主题'].includes(k))));
 if(/受不知名信号干扰|暂不可见/.test(body)&&body.length<30)return undefined;
 const text=body+(raw.消耗!==undefined?'\n消耗'+flat(raw.消耗):'');
 const equipment=entry.sourceId.startsWith('/装备/')?type||'装备':'';
 const notes:string[]=[];const extra:Blueprint[]=[];
 const norm=normalize(text).replace(/描述:[^\n]*$/,'').replace(/[。，,]?\s*数量[:：]?\s*\d+\s*$/,'');
 const pIdx=norm.search(/(?:^|\n)被动:/),aIdx=norm.search(/(?:^|\n)主动:/);
 let mainBp:Blueprint;
 const withReq=(r:{bp:Blueprint;notes:string[]},st?:unknown)=>{void st;return r;};
 if(pIdx>=0&&aIdx>=0){
  const [first,second]=pIdx<aIdx?[pIdx,aIdx]:[aIdx,pIdx];
  const partP=pIdx<aIdx?norm.slice(first,second):norm.slice(second),partA=pIdx<aIdx?norm.slice(second):norm.slice(first,second);
  const p=withReq(parseSection(partP.replace(/^\n?被动:/,''),ctx,q,'passive',tags)),a=withReq(parseSection(partA.replace(/^\n?主动:/,''),ctx,q,'active',tags));notes.push(...p.notes,...a.notes);
  mainBp=p.bp;if(a.bp.steps.length||a.bp.triggers?.length)extra.push(a.bp);else{const qa:Blueprint={kind:'active',steps:[]};qualitative(qa,partA,tags,ctx,q,'');if(qa.steps.length)extra.push(qa);}
  if(!mainBp.steps.length&&!mainBp.triggers?.length){qualitative(mainBp,partP,tags,ctx,q,'');}
 }else if(item){
  const r=parseSection(norm,ctx,q,'active',tags);notes.push(...r.notes);mainBp=r.bp;mainBp.category='item';
  if(!mainBp.steps.length&&!mainBp.triggers?.length)return undefined;
  delete mainBp.cost;delete mainBp.cooldown;
 }else if(equipment){
  // 装备：常驻部分（攻防数值 + 被动条款）为主，主动条款拆为附加行动
  const parts=norm.split(/[。；;\n]|(?:^|(?<=[:：，,]))\d\.(?!\d)/).map(s=>s.trim()).filter(Boolean);
  const act=parts.filter(s=>EQUIP_ACTIVE.test(s)||dealsDamage(s)&&!hitContext(s)&&!/攻击力|威力\+/.test(s)&&!/使用该武器的攻击/.test(s));
  const pas=parts.filter(s=>!act.includes(s));
  const p=parseSection(pas.join('。'),ctx,q,'passive',tags,{equipment:true});notes.push(...p.notes);mainBp=p.bp;
  const hdr=normalize(tags)+'。'+norm;const atk=hdr.match(/攻击(?:力)?(?:至少为)?:?(\d{2,})(?!%)/),def=hdr.match(/防御(?:力)?:?(\d{2,})(?!%)/),pen=norm.match(/(\d+)%穿透|穿透(\d+)%/);
  const staff=/法杖|魔杖|法器|施法媒介|魔导|光束炮|能量炮/.test(norm+type+tags);
  const eq:BPMod[]=[];if(atk)eq.push({stat:staff?'能量伤害':'物理伤害',add:Number(atk[1])});if(def)eq.push({stat:'防御',add:Number(def[1])});if(pen)eq.push({stat:'穿透',pct:Number(pen[1]??pen[2])});
  if(eq.length)mainBp.steps.unshift({do:'stat',mods:eq,name:entry.name});
  if(act.length){const a=parseSection(act.join('。'),ctx,q,'active',tags,{equipment:true});notes.push(...a.notes);if(a.bp.steps.length){if(!a.bp.perBattle&&/每场战斗(?:一|1)次|1次\/战斗|每场战斗限一次|一场战斗仅可使用一次/.test(act.join('')))a.bp.perBattle=1;if(!a.bp.perBattle&&!a.bp.cooldown)a.bp.cooldown=3;const req=norm.match(/(?:必须|需要)处于\[?([^\]\s]{1,12})\]?状态下才能使用/);if(req){a.bp.requires=[{kind:'has_status',status:req[1]}];if(!a.bp.steps.some(x=>x.do==='consume'))a.bp.steps.push({do:'consume',status:req[1]});}if(a.bp.steps.some(s=>s.do==='damage')&&atk&&!a.bp.steps.some(s=>s.do==='damage'&&s.power!==undefined)){const d=a.bp.steps.find(s=>s.do==='damage')!;const mult=act.join('').match(/(\d+)%的?(?:物理|能量)?伤害/);d.power=Number(atk[1])*(mult?Number(mult[1])/100:1);delete d.multiplier;}extra.push(a.bp);}}
 }else{
  const passive=/被动/.test(type)||/^\/种族特性\//.test(entry.sourceId)||['要素','神位','神国'].includes(stage)||/^被动[.。:]/.test(norm)||/^被动/.test(type+norm.slice(0,3));
  // 叙述性的风格/不死类被动不逐词抽状态（“致命伤后衰弱沉睡”是自身状态，不是对敌控制），交给主题规则
  const style=passive&&(/战斗风格/.test(tags+entry.name)||/不死|致命伤后|伤势会持续/.test(norm))&&!/\d/.test(norm);
  const r=style?{bp:{kind:'passive',steps:[]} as Blueprint,notes:[]}:parseSection(norm,ctx,q,passive?'passive':'active',tags);notes.push(...r.notes);mainBp=r.bp;
  const need=norm.match(/(?:需要|需|要求|必须)(?:自身)?(?:处于|拥有|具有)?\s*[\[【]([^\]】]{1,12})[\]】]/);if(need&&!passive&&!findStd(need[1]!))mainBp.requires=[{kind:'has_status',status:need[1]}];
 }
 if(!item&&!mainBp.steps.length&&!mainBp.triggers?.length){qualitative(mainBp,norm,tags,ctx,q,equipment);if(mainBp.steps.length||mainBp.triggers?.length)notes.push('原文没有可定量条款，按能力主题与品质给出有界效果');}
 if(!mainBp.steps.length&&!mainBp.triggers?.length){if(extra.length){mainBp=extra.shift()!;}else return undefined;}
 // 主动技能标签写明“伤害/攻击”却没有抽到伤害：补主伤害
 for(const b of [mainBp,...extra])if(!item&&b.kind==='active'&&/伤害|攻击|AOE|爆发|格斗|体术|剑术|刀术|枪术|武技/.test(tags)&&!/辅助|增益/.test(tags)&&!JSON.stringify(b.steps).includes('"damage"')&&!b.steps.some(x=>typeof x.status==='object'))b.steps.unshift({do:'damage',channel:channelOf(norm+tags)||(/格斗|体术|剑|刀|枪|武技/.test(tags)?'physical':undefined),...(/AOE|范围|群体/i.test(tags)?{target:{side:'enemy',select:'all'}}:{})});
 // “专攻要害/直击弱点”：主伤害附带暴击率
 for(const b of [mainBp,...extra]){const d=b.steps.find(x=>x.do==='damage');if(b.kind==='active'&&d&&!d.crit&&/要害|弱点|致命处|破绽/.test(norm))d.crit={chance:Math.min(60,q+20),mult:1.5};}
 // 登神阶段规则：权能/法则的费用与次数来自宿主数值表
 for(const b of [mainBp,...extra])if(b.kind==='active'){
  if(stage==='权能'){b.cost={...b.cost,mpPct:25,spPct:25};}
  if(stage==='法则'){b.cost={...b.cost,mpPct:50,spPct:50};b.perBattle=1;}
 }
 for(const b of [mainBp,...extra])if(b.kind==='active'&&!b.cost&&!equipment&&!item){const physical=b.steps.some(s=>s.do==='damage'&&String(s.channel??'').startsWith('physical'));b.cost=physical?{sp:ctx.cost}:{mp:ctx.cost};}
 mainBp.name=entry.name.slice(0,200);for(const [i,b] of extra.entries())b.name=(entry.name+(i?'·'+(i+1):'·主动')).slice(0,200);
 return {main:mainBp,extra,notes:[...new Set(notes)]};
}
