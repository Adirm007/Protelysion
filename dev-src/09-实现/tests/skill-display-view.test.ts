import test from 'node:test';
import assert from 'node:assert/strict';
import {lowerBlueprint} from '../src/compiler/blueprint/lower';
import {applyBattleEffects,createBattle} from '../src/battle/executor';
import {playtestParty} from '../src/game/content';
import {startExpedition,view} from '../src/game/expedition';
import {card,mitigation} from './compiler-fixtures';

test('战况状态详情读取施加者的效果库，展开周期与触发效果',()=>{
 const {action}=lowerBlueprint({kind:'active',target:{side:'ally'},steps:[{
  do:'status',status:{name:'回春印记',polarity:'positive',hotAmount:88,
   triggers:[{on:'damaged',steps:[{do:'heal',amount:37,target:{side:'self'}}]}]},turns:3,
 }]},{key:'回春',sourceId:'/技能/回春',name:'回春',level:20,tier:5,power:3000,cost:4000,
  attributeFactor:1,attributes:{力量:40,敏捷:40,体质:40,智力:40,精神:40},passive:false});
 const party=playtestParty();party[0]!.card=card(action,'/技能/回春');
 const s=startExpedition(party,17);
 s.encounterId=s.region.things.find(t=>t.kind==='enemy')!.id;
 const enemy=card();
 const battle=createBattle([...party.map(p=>({id:p.id,side:'ally' as const,card:p.card,
  current:{...p.card.numeric.max},mitigation:mitigation()})),
  {id:'enemy-0',side:'enemy',card:enemy,current:{...enemy.numeric.max},mitigation:mitigation()}],7);
 s.mode='battle';s.battle=applyBattleEffects(battle,'reader',action,['keeper'],'effect','/技能/回春');
 const recipient=s.battle.units.find(u=>u.id==='keeper')!;
 assert.equal(recipient.statuses![0]!.libraryOwner,'reader');
 assert.equal(Object.keys(recipient.library!.statuses).length,0,'被施加者没有该状态的效果库');
 const status=view(s).battle.units.find(u=>u.id==='keeper')!.statuses.find(x=>x.name==='回春印记')!;
 assert.match(status.description,/88.*生命/);
 assert.match(status.description,/受到伤害时.*37.*生命/);
 assert.doesNotMatch(status.description,/周期效果|附加效果|undefined|Unknown/);
});
