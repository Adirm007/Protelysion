/** 能力蓝图 booksea-blueprint/1：模型与本地解析器共同的高层语义层，由 lower.ts 确定性降级为合同 IR。
 * 约定：所有 *Pct / pierce / lifesteal 等比例字段使用百分数本身（30 表示 30%，0.05 表示 0.05%）；chance 概率 0~1 与 0~100 皆可。 */
export const BLUEPRINT_VERSION='booksea-blueprint/1';
export type Side='enemy'|'ally'|'self'|'any'|'attacker'|'hit_target'|'downed_ally';
export type Select='single'|'all'|'random'|'lowest_hp'|'highest_attack'|'bounce';
export type BPTarget={side:Side;select?:Select;count?:number;maxTier?:number;minTier?:number;belowCasterTier?:boolean;excludeSelf?:boolean};
export type BPCond={kind:'hp_below'|'hp_above'|'target_hp_below'|'target_hp_above'|'mp_below'|'has_status'|'target_has_status'|'lacks_status'|'target_lacks_status'|'status_stacks_at_least'|'target_status_stacks_at_least'|'target_debuffs_at_least'|'allies_alive_at_least'|'enemies_alive_at_least'|'allies_alive_at_most'|'first_use'|'round_at_least'|'kills_at_least'|'crit'|'target_tier_below'|'in_field'|'target_is_enemy'|'target_is_ally';value?:number;status?:string};
export type BPMod={stat:string;add?:number;pct?:number;mul?:number};
export type BPCustomStatus={name:string;polarity?:'positive'|'negative'|'neutral';control?:string;mods?:BPMod[];dotPct?:number;hotPct?:number;hotAmount?:number;stackable?:boolean;maxStacks?:number;dispellable?:boolean;reflectPct?:number;reducePct?:number;consumeOn?:'attack'|'damaged';triggers?:BPTrigger[];desc?:string};
export type BPStep={do:string;target?:BPTarget;chance?:number;when?:BPCond[];[k:string]:unknown};
export type BPTrigger={on:string;chance?:number;uses?:number;perRound?:boolean;when?:BPCond[];target?:BPTarget;hpPct?:number;steps:BPStep[]};
export type BPSummon={name:string;count?:number;level?:number|'caster';inheritPct?:number;hpPct?:number;power?:number;channel?:string;turns?:number;limit?:number;tags?:string[];steps?:BPStep[];taunt?:boolean;role?:string};
export type BPForm={name:string;turns?:number;mods?:BPMod[];drainPct?:number;steps?:BPStep[];permanent?:boolean};
export type Blueprint={
 name?:string;kind:'active'|'passive';category?:'skill'|'spell'|'item';
 target?:BPTarget;cost?:{hp?:number;mp?:number;sp?:number;hpPct?:number;mpPct?:number;spPct?:number};
 perBattle?:number;perTarget?:number;cooldown?:number;charges?:number;castRounds?:number;firstStrike?:boolean;
 requires?:BPCond[];onlyInForm?:string;notInForm?:string;
 steps:BPStep[];triggers?:BPTrigger[];
 summary?:string;fidelity?:'exact'|'equivalent'|'approximate';changes?:{original?:string;implemented:string;reason?:string}[];
};

type Obj=Record<string,unknown>;
const isObj=(x:unknown):x is Obj=>!!x&&typeof x==='object'&&!Array.isArray(x);
const CN_DIGIT:Record<string,number>={零:0,一:1,二:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9,十:10,百:100,千:1000,万:10000};
/** 宽松数值：数字、"3回合"、"30%"、"三"、"1.5倍"。 */
export function num(x:unknown):number|undefined{
 if(typeof x==='number'&&Number.isFinite(x))return x;
 if(typeof x==='boolean')return x?1:0;
 if(typeof x!=='string')return undefined;
 const t=x.replace(/[,，\s]/g,'');const m=t.match(/-?\d+(?:\.\d+)?/);if(m)return Number(m[0]);
 const c=t.match(/[零一二两三四五六七八九十百千万]+/);if(!c)return undefined;
 let total=0,cur=0;for(const ch of c[0]){const v=CN_DIGIT[ch]!;if(v>=10){total+=(cur||1)*v;cur=0;}else cur=v;}return total+cur;
}
/** 百分数字段按字面百分数解释：30 → 30%；0.05 → 0.05%；"30%" → 30。（原文“0.05%最大HP”不能被放大成 5%。） */
export function pct(x:unknown):number|undefined{return num(x);}
/** 概率：0~1 或 0~100 皆可，返回 0~1。 */
export function chance(x:unknown):number|undefined{const n=num(x);if(n===undefined)return undefined;const v=n>1?n/100:n;return Math.max(0,Math.min(1,v));}
const str=(x:unknown)=>typeof x==='string'?x.trim():typeof x==='number'?String(x):undefined;
const arr=(x:unknown):unknown[]=>Array.isArray(x)?x:x===undefined||x===null?[]:[x];
const SIDE_ALIASES:Record<string,Side>={enemy:'enemy',enemies:'enemy',foe:'enemy',敌:'enemy',敌人:'enemy',敌方:'enemy',ally:'ally',allies:'ally',friend:'ally',友:'ally',友方:'ally',队友:'ally',同伴:'ally',self:'self',me:'self',caster:'self',自身:'self',自己:'self',any:'any',all:'any',attacker:'attacker',event_source:'attacker',source:'attacker',攻击者:'attacker',hit_target:'hit_target',event_target:'hit_target',downed_ally:'downed_ally',dead_ally:'downed_ally'};
const SELECT_ALIASES:Record<string,Select>={single:'single',one:'single',manual:'single',all:'all',aoe:'all',area:'all',全体:'all',random:'random',随机:'random',lowest_hp:'lowest_hp',lowest:'lowest_hp',highest_attack:'highest_attack',bounce:'bounce'};
export function normTarget(x:unknown):BPTarget|undefined{
 if(typeof x==='string'){const [side,sel]=x.split(/[:：\s]+/);const s=SIDE_ALIASES[side!.toLowerCase()]??SIDE_ALIASES[side!];if(!s)return undefined;return {side:s,...(sel&&SELECT_ALIASES[sel]?{select:SELECT_ALIASES[sel]}:{})};}
 if(!isObj(x))return undefined;
 const side=SIDE_ALIASES[String(x.side??x.who??x.team??'').toLowerCase()]??SIDE_ALIASES[String(x.side??'')];if(!side)return undefined;
 const t:BPTarget={side};const sel=SELECT_ALIASES[String(x.select??x.selection??x.scope??'').toLowerCase()];if(sel)t.select=sel;
 const count=num(x.count??x.max??x.targets);if(count&&count>0)t.count=Math.min(64,Math.round(count));if(t.count&&t.count>1&&!t.select)t.select='single';
 for(const k of ['maxTier','minTier'] as const){const v=num(x[k]);if(v)t[k]=Math.max(1,Math.min(7,Math.round(v)));}
 if(x.belowCasterTier)t.belowCasterTier=true;if(x.excludeSelf)t.excludeSelf=true;return t;
}
const COND_KINDS=new Set<BPCond['kind']>(['hp_below','hp_above','target_hp_below','target_hp_above','mp_below','has_status','target_has_status','lacks_status','target_lacks_status','status_stacks_at_least','target_status_stacks_at_least','target_debuffs_at_least','allies_alive_at_least','enemies_alive_at_least','allies_alive_at_most','first_use','round_at_least','kills_at_least','crit','target_tier_below','in_field','target_is_enemy','target_is_ally']);
/** 敌我两用条件的常见写法。 */
const COND_ALIAS:Record<string,BPCond['kind']>={target_enemy:'target_is_enemy',on_enemy:'target_is_enemy',vs_enemy:'target_is_enemy',enemy_target:'target_is_enemy',is_enemy:'target_is_enemy',target_ally:'target_is_ally',on_ally:'target_is_ally',vs_ally:'target_is_ally',ally_target:'target_is_ally',is_ally:'target_is_ally'};
export function normConds(x:unknown):BPCond[]{return arr(x).flatMap(c=>{if(!isObj(c))return [];const raw=String(c.kind??c.if??c.type??'');const kind=(COND_ALIAS[raw]??raw) as BPCond['kind'];if(!COND_KINDS.has(kind))return [];const out:BPCond={kind};const v=kind.includes('hp_')||kind==='mp_below'?pct(c.value??c.pct):num(c.value??c.count);if(v!==undefined)out.value=v;const st=str(c.status??c.name);if(st)out.status=st;return [out];});}
export function normMods(x:unknown):BPMod[]{
 const list=isObj(x)&&!('stat'in x)?Object.entries(x).map(([stat,v])=>isObj(v)?{stat,...v}:{stat,value:v}):arr(x);
 return list.flatMap(r=>{if(!isObj(r))return [];const stat=str(r.stat);if(!stat)return [];const o:BPMod={stat};
  const add=num(r.add??r.flat),p=pct(r.pct??r.percent),mul=num(r.mul??r.multiplier);
  if(add!==undefined)o.add=add;if(p!==undefined)o.pct=p;if(mul!==undefined)o.mul=mul;
  if(add===undefined&&p===undefined&&mul===undefined){const v=r.value;if(typeof v==='string'&&v.includes('%'))o.pct=num(v);else if(typeof v==='string'&&/^[x×*]/i.test(v.trim()))o.mul=num(v);else{const n=num(v);if(n!==undefined)o.add=n;}}
  return o.add===undefined&&o.pct===undefined&&o.mul===undefined?[]:[o];});
}
const NUMERIC_FIELDS=['power','multiplier','pct','amount','turns','hits','stacks','uses','count','value','keepHp','healPct','pctMaxHp','pctCurrentHp','pctLostHp','selfPctMaxHp','selfPctLostHp','pierce','lifesteal','pctOfDamage','executeBelowPct','dotPct','hotPct','hotAmount','dc','reflectChance','counterChance'];
function normStep(x:unknown,depth=0):BPStep|undefined{
 if(!isObj(x)||depth>4)return undefined;
 const op=str(x.do??x.op??x.type??x.effect);if(!op)return undefined;
 const out:BPStep={...x,do:op.toLowerCase()};delete (out as Obj).op;delete (out as Obj).type;
 const t=normTarget(x.target);if(t)out.target=t;else delete out.target;
 const c=chance(x.chance??x.probability);if(c!==undefined&&c<1)out.chance=c;else delete out.chance;
 const w=normConds(x.when??x.if??x.conditions);if(w.length)out.when=w;else delete out.when;
 for(const k of ['onHit','then','else','success','failure','steps','perRound','onExpire','onKill'])if(x[k]!==undefined)(out as Obj)[k]=normSteps(x[k],depth+1);
 if(Array.isArray(x.options))out.options=x.options.map(o=>normSteps(o,depth+1));
 if(x.triggers!==undefined)out.triggers=normTriggers(x.triggers,depth+1);
 for(const k of NUMERIC_FIELDS)if(typeof out[k]==='string'){const v=num(out[k]);if(v!==undefined)out[k]=v;}
 return out;
}
export function normSteps(x:unknown,depth=0):BPStep[]{return arr(x).map(s=>normStep(s,depth)).filter((s):s is BPStep=>!!s).slice(0,32);}
export function normTriggers(x:unknown,depth=0):BPTrigger[]{return arr(x).flatMap(t=>{if(!isObj(t))return [];const on=str(t.on??t.event??t.when);if(!on)return [];const steps=normSteps(t.steps??t.do??t.effects,depth);if(!steps.length)return [];
 const out:BPTrigger={on:on.toLowerCase(),steps};const c=chance(t.chance);if(c!==undefined&&c<1)out.chance=c;const u=num(t.uses??t.limit);if(u&&u>0)out.uses=Math.round(u);if(t.perRound)out.perRound=true;
 const w=normConds(t.if??t.conditions??t.cond);if(w.length)out.when=w;const tg=normTarget(t.target);if(tg)out.target=tg;const hp=pct(t.hpPct??t.threshold??t.value);if(hp!==undefined)out.hpPct=hp;return [out];}).slice(0,12);}
/** 模型或解析器给出的任意对象 → 规范蓝图；无法识别时返回 undefined。 */
export function normalizeBlueprint(x:unknown):Blueprint|undefined{
 if(!isObj(x))return undefined;
 const kindRaw=String(x.kind??x.type??x.disposition??'').toLowerCase();
 const kind:Blueprint['kind']=/passive|被动|always|aura/.test(kindRaw)?'passive':'active';
 const bp:Blueprint={kind,steps:normSteps(x.steps??x.effects)};
 const name=str(x.name);if(name)bp.name=name.slice(0,200);
 const cat=str(x.category);if(cat==='spell'||cat==='skill'||cat==='item')bp.category=cat;
 const t=normTarget(x.target);if(t)bp.target=t;
 if(isObj(x.cost)){const c:NonNullable<Blueprint['cost']>={};for(const k of ['hp','mp','sp'] as const){const v=num(x.cost[k]);if(v&&v>0)c[k]=v;const p=pct(x.cost[k+'Pct']);if(p&&p>0)c[(k+'Pct') as 'hpPct']=Math.min(100,p);}if(Object.keys(c).length)bp.cost=c;}
 for(const k of ['perBattle','perTarget','cooldown','charges','castRounds'] as const){const v=num(x[k]);if(v&&v>0)bp[k]=Math.round(v);}
 if(x.firstStrike===true)bp.firstStrike=true;
 const req=normConds(x.requires??x.conditions);if(req.length)bp.requires=req;
 for(const k of ['onlyInForm','notInForm'] as const){const v=str(x[k]);if(v)bp[k]=v.slice(0,100);}
 const tr=normTriggers(x.triggers);if(tr.length)bp.triggers=tr;
 const summary=str(x.summary);if(summary)bp.summary=summary.slice(0,2000);
 const f=str(x.fidelity);if(f==='exact'||f==='equivalent'||f==='approximate')bp.fidelity=f;
 const ch=arr(x.changes).flatMap(c=>isObj(c)&&str(c.implemented)?[{original:str(c.original)?.slice(0,1000),implemented:str(c.implemented)!.slice(0,1000),reason:str(c.reason)?.slice(0,500)}]:typeof c==='string'&&c.trim()?[{implemented:c.trim().slice(0,1000)}]:[]);if(ch.length)bp.changes=ch.slice(0,16);
 if(!bp.steps.length&&!bp.triggers?.length)return undefined;
 return bp;
}
