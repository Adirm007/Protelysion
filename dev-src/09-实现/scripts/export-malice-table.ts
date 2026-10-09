/** 导出《怪物恶意配置表.csv》：433 只怪物 × 7 层级的恶意家族、形态、领域、脚本环、被封解法与剩余解法。
 *  用法：npx tsx scripts/export-malice-table.ts [输出路径]（默认写到 01-计划与制作清单/怪物恶意配置表.csv）。 */
import {writeFileSync} from 'node:fs';
import {MONSTER_ROSTER} from '../src/game/monsters/catalog';
import {MALICE,ARENAS,familyOrigin} from '../src/game/monsters/malice';
import {malicePlan,COUNTER_LABEL} from '../src/game/monsters/malice-plan';
import {THEME_EXCLUSIVE} from '../src/game/monsters/theme-malice';
const FORM:Record<string,string>={seed:'雏形',full:'完全体',unbound:'拿掉反制'};
const out=process.argv[2]??'../01-计划与制作清单/怪物恶意配置表.csv';
const rows=[['怪物ID','名称','职能','层级','家族数','家族与形态','family_origin','领域','exclusive','脚本环','阶段计数跨阶段','负向样本','被封解法','剩余解法','被无解墙检查拒绝']];
let walls=0;const familyCount:Record<string,number>={};
for(const m of MONSTER_ROSTER)for(let tier=1;tier<=7;tier++){
 const p=malicePlan(m,tier);walls+=p.walled.length;
 for(const s of p.slots)familyCount[s.family]=(familyCount[s.family]??0)+1;
 rows.push([m.id,m.name,m.role,String(tier),String(p.slots.length),p.slots.map(s=>MALICE[s.id]!.family+' '+MALICE[s.id]!.name+'·'+FORM[s.form]).join('；'),p.slots.map(s=>familyOrigin(s.family)).join(''),p.arenas.map(id=>ARENAS.find(a=>a.id===id)!.name).join('；'),p.exclusive?THEME_EXCLUSIVE[p.exclusive.id]!.name+'·'+(p.exclusive.form==='full'?'完全体':'雏形'):'',p.rotation?'是':'否',p.phaseCarry?'是':'否',p.idle?'是':'否',p.seals.map(k=>COUNTER_LABEL[k]).join('、'),p.counters.map(k=>COUNTER_LABEL[k]).join('、'),p.walled.join('；')]);
}
const csv='\uFEFF'+rows.map(r=>r.map(x=>'"'+x.replace(/"/g,'""')+'"').join(',')).join('\n')+'\n';
writeFileSync(out,csv,'utf8');
console.log('rows',rows.length-1,'walls',walls,JSON.stringify(familyCount));
