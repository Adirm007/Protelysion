// Isolated browser fixture only. Never bundled into host-game.js or copied to the public release.
import {startExpedition} from '../src/game/expedition';
import {playtestParty} from '../src/game/content';
import {fixture,partner} from './fixtures';
import {actorAt,object} from '../src/core/actors';
export function releaseFixture(){
 const mvu=fixture(),party=playtestParty();
 for(const [i,p] of party.entries()){
  const name=i?'测试伙伴乙':'测试伙伴甲';p.ref=partner(name);p.name=name;const a=actorAt(mvu,p.ref);a.等级=p.card.numeric.level;a.种族='人类';a.属性={...p.card.numeric.attributes};
  for(const [k,r] of [['hp','生命值'],['mp','法力值'],['sp','体力值']] as const)a[r]={当前:p.current[k],上限:{_基础:p.card.numeric.max[k],额外:0}};
  object(object(mvu.date).npcs)[name]={level:a.等级,exp:0,required_exp:720};
 }
 const run=startExpedition(party,9220619);run.run.id='release-browser-host';run.source='host';run.hostContext='release-card:release-chat';run.potions=0;run.paused=true;
 return {mvu,chat:{booksea:{settings:{narrative:false},activeExpedition:run}},messages:[{role:'assistant',message:'隔离浏览器测试，不是真实聊天'}],writes:0,modelCalls:0,sends:[]};
}
