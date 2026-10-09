import type {MonsterDesign,ThemeDesign} from './catalog';
import {authoredMonsterKit} from './kits';
export const MIMIC_ID='COMMON_MIMIC';
export const MIMIC_DESIGN:MonsterDesign={id:MIMIC_ID,designId:MIMIC_ID,theme:'T04',name:'宝箱怪',role:'精英',cores:['fang','drain'],motif:'贪食箱颚',build:'guard'};
const MIMIC_THEME:ThemeDesign={id:'T04',name:'通用宝箱怪',scenes:['封存宝箱','贪食内腔','藏财密室'],subtitle:'以宝物为饵的捕食者',lawNames:['吞食偿还','囊中税契'],laws:['hunger','tax'],realm:'囊中迷库',element:'暗'};
/** Display/challenge level is not capped at 25; the seventh life-tier kit scales past 25 as other monsters do. */
export function mimicLevel(floorEnemyLevel:number){return Math.max(6,floorEnemyLevel+5);}
export function mimicKit(displayLevel:number){
 const kit=authoredMonsterKit(MIMIC_DESIGN,MIMIC_THEME,displayLevel);
 kit.counterplay=['普通逃跑无效；可用间章等专门离场技能','只有实际击败才掉落1个未开启盲盒',...kit.counterplay];
 return kit;
}
