import * as s from './schema';
/** Bounded postfix expressions. Data only: no eval, functions, host objects or arbitrary property paths. */
export const FormulaToken=s.union(
 s.object({constant:s.number(-1e12,1e12)}),
 s.object({read:s.enumeration(['attribute','stat','resource','max_resource','lost_resource','resource_ratio','level','tier','status_stacks','status_kinds','shield','distance','alive_count','member_count','counter','counter_pair','variable','event','dependency','round']),subject:s.optional(s.enumeration(['caster','target','owner','event_source','event_target'])),names:s.optional(s.array(s.text(200),1,64)),tags:s.optional(s.array(s.text(100),1,32)),life:s.optional(s.enumeration(['alive','downed','any'])),key:s.optional(s.text(200))}),
 s.object({operator:s.enumeration(['add','sub','mul','div','mod','min','max','abs','neg','floor'])})
);
const tokens=s.array(FormulaToken,1,48);
export const Formula:s.Schema<s.Infer<typeof tokens>>={json:tokens.json,parse(input,path){const result=tokens.parse(input,path);let stack=0;for(const t of result){if('operator'in t){const need=['abs','neg','floor'].includes(t.operator)?1:2;if(stack<need)throw Error('表达式操作数不足');stack-=need-1;}else{if('read'in t&&['attribute','stat','resource','max_resource','lost_resource','resource_ratio','status_stacks','counter','counter_pair','variable','event','dependency'].includes(t.read)&&!t.key)throw Error('表达式读取缺少key');stack++;}}if(stack!==1)throw Error('表达式必须产生一个数值');
const keys:Record<string,readonly string[]>={stat:['speed','initiative','hit','evade','crit','check_strength','check_agility','check_constitution','check_intelligence','check_spirit'],attribute:['力量','敏捷','体质','智力','精神'],resource:['hp','mp','sp'],max_resource:['hp','mp','sp'],lost_resource:['hp','mp','sp'],resource_ratio:['hp','mp','sp'],status_kinds:['positive','negative','neutral','any'],alive_count:['ally','enemy','any'],event:['raw','actual','critical','hits','misses','blocked','total_damage','hit_index','paid_hp','paid_mp','paid_sp','paid_total_hp','paid_total_mp','paid_total_sp','status_negative','status_priority','time_ms','round','pair_hits','pair_attempts','distinct_targets','distinct_attempted_targets','action_attacking','action_area']};
for(const t of result)if('read'in t&&keys[t.read]&&t.key&&!keys[t.read]!.includes(t.key))throw Error('表达式读取字段不存在: '+t.key);return result;}};
export type FormulaSpec=s.Infer<typeof Formula>;
export const MAX_ATTACK_BEATS=24;
export const MAX_EFFECT_STEPS=1024;
export const ROUND_MS=4000;
