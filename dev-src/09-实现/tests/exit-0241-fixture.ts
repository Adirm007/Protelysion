/** Explicit isolated regression data. Never included in the distributable game. */
import {startExpedition} from '../src/game/expedition';
import {playtestParty,strike} from '../src/game/content';
import {makeRegion,chestSpawns} from '../src/game/region';
import {sessionPort,checkpointHost} from '../src/host/game-session';
import {MONSTER_CONTENT_VERSION} from '../src/game/monsters/numbers';
export {makeRegion,chestSpawns};
export async function seedLiveRun(base:Record<string,any>,kind:'chest'|'mimic'='mimic'){
 const g=window as any,h=g.TavernHelper,c=g.SillyTavern.getContext();
 if(!String(c.getCurrentChatId()).startsWith('书海0241'))throw Error('Test chats only');
 let seed=1;while(!chestSpawns(1,0,seed)[kind])seed++;
 const m=structuredClone(base);delete m.bookseaSessionReceipts;delete m.bookseaPromptHandoff;delete m.bookseaProgressRef;
 const p=playtestParty()[0]!;p.id='host-0';p.ref={kind:'player'};p.name=String(c.name1||'摘要验收员');
 const hit=strike(1_000_000);const damage=hit.effects[0]!;if(damage.op==='damage'){damage.hitRule='guaranteed';damage.critChance=0;}
 p.card.skills=[{sourceId:'/技能/验收斩',name:'验收斩',sourceFingerprint:'isolated-0241-fixture',mapping:{sourceId:'/技能/验收斩',disposition:'active',reason:'显式自动化测试技能，仅用于独立回归聊天',action:hit}}];
 p.card.numeric.max.hp=100000;p.current={...p.card.numeric.max};
 const a=m.stat_data.主角;Object.assign(a,{姓名:p.name,种族:'人类',等级:p.card.numeric.level,生命层级:'第一层级/普通',累计经验值:360,升级所需经验:720,属性:{...p.card.numeric.attributes},装备:{},背包:{},状态效果:{},技能:{验收斩:{品质:'普通',类型:'主动',消耗:'无',标签:['独立自动化测试'],效果:{伤害:'固定1000000物理伤害，必中，不暴击。'},描述:'仅用于自动化回归夹具，不进入游戏发行。'}}});
 for(const [key,res] of [['hp','生命值'],['mp','法力值'],['sp','体力值']] as const)a[res]={当前:p.current[key],上限:{_基础:p.card.numeric.max[key],额外:0}};
 m.stat_data.关系列表={};m.stat_data.命运点数=100;m.stat_data.世界={时间:'曙光纪元1000年-09月-23日-星期三-10:00',地点:'中央大陆-验收城-客栈-书桌旁'};
 if(m.date){m.date.npcs={};m.date.npcLevelUpWithPlayer=true;}
 await h.replaceVariables({dream_persona:'reader',dream_visual_theme:'cafe',booksea:{settings:{narrative:false}}},{type:'chat'});
 // MVU reparses an assistant on refresh and may clone its predecessor; initialize both fixture rows.
 await h.replaceVariables(structuredClone(m),{type:'message',message_id:0});
 await h.replaceVariables(m,{type:'message',message_id:-1});
 const port=sessionPort(g);await port.prepare!();
 const state=startExpedition([p],seed);state.source='host';state.hostContext=port.id();state.run.id='host-0241-'+crypto.randomUUID();state.writeback='pending';state.potions=0;state.inventory={};state.paused=true;port.bind!(state);
 await checkpointHost(port,state);
 return {seed,runId:state.run.id,contextId:state.hostContext,kind,monsterContentVersion:MONSTER_CONTENT_VERSION,things:state.region.things.map(t=>({kind:t.kind,x:t.x,z:t.z,name:t.name})),frame:state.hostSave};
}
