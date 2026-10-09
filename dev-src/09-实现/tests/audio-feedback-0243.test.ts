import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Typewriter, graphemes} from '../src/ui/typewriter';
import {EffectSequence} from '../src/audio/effect-sequence';
import {actionStyle, actionEffects, battleAudioPlan, styleCues} from '../src/audio/battle-feedback';
import {createBattle, chooseAction, resolveAction} from '../src/battle/executor';
import {strike, contentCard, bareMitigation, heal, ward, flat} from '../src/game/content';
import {EMPTY_LIBRARY} from '../src/compiler/contract';
import {resolvedBattleCue, type GameView} from '../src/presentation/battle-cues';
import type {AudioManifest} from '../src/audio/types';

class Clock {
  time=0; id=0; jobs=new Map<number,{at:number;fn:()=>void}>();
  now=()=>this.time;
  set=(fn:()=>void,ms:number)=>{const id=++this.id;this.jobs.set(id,{at:this.time+ms,fn});return id;};
  clear=(id:number)=>{this.jobs.delete(id);};
  tick(ms:number){const end=this.time+ms;for(;;){const next=[...this.jobs].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;this.time=next[1].at;this.jobs.delete(next[0]);next[1].fn();}this.time=end;}
}
test('supplier question reveals one grapheme at a time and writing stops on completion',()=>{
  const clock=new Clock(),texts:string[]=[],writing:boolean[]=[];const writer=new Typewriter(clock,t=>texts.push(t),a=>writing.push(a));
  writer.start('要选哪个呢？');assert.equal(texts.at(-1),'');assert.equal(writer.typing,true);
  clock.tick(89);assert.equal(texts.at(-1),'');clock.tick(1);assert.equal(texts.at(-1),'要');
  clock.tick(180);assert.equal(texts.at(-1),'要选哪');clock.tick(270);assert.equal(texts.at(-1),'要选哪个呢？');
  assert.equal(writer.typing,false);assert.deepEqual(writing,[true,false]);assert.equal(clock.jobs.size,0);
});
test('skip/close/dispose cancel typing instead of leaving a delayed paper sound',()=>{
  const clock=new Clock(),texts:string[]=[],writing:boolean[]=[];const writer=new Typewriter(clock,t=>texts.push(t),a=>writing.push(a));
  writer.start('要选哪个呢？');clock.tick(90);writer.finish();assert.equal(texts.at(-1),'要选哪个呢？');
  const count=texts.length;clock.tick(2000);assert.equal(texts.length,count);assert.equal(writing.at(-1),false);
  writer.start('重新开口');clock.tick(90);writer.cancel();const last=texts.length;clock.tick(1000);assert.equal(texts.length,last);
  writer.start('销毁');writer.dispose();assert.equal(clock.jobs.size,0);assert.equal(writing.at(-1),false);
});
test('typing does not catch up in background; reduced motion reveals immediately',()=>{
  const clock=new Clock(),texts:string[]=[],writing:boolean[]=[];const writer=new Typewriter(clock,t=>texts.push(t),a=>writing.push(a));
  writer.start('甲乙丙');clock.tick(90);writer.pause(true);clock.tick(5000);assert.equal(texts.at(-1),'甲');assert.equal(writing.at(-1),false);
  writer.pause(false);clock.tick(90);assert.equal(texts.at(-1),'甲乙');writer.start('全文',true);assert.equal(texts.at(-1),'全文');assert.equal(writer.typing,false);assert.equal(clock.jobs.size,0);
});
test('combining marks and emoji families are not sliced into partial characters',()=>{
  assert.deepEqual(graphemes('你e\u0301👨‍👩‍👧‍👦'),['你','e\u0301','👨‍👩‍👧‍👦']);
});
test('effect sequence separates release and impact, scales time, and rejects duplicate callbacks',()=>{
  const clock=new Clock(),events:{name:string;at:number}[]=[];const sequence=new EffectSequence(clock,n=>events.push({name:n,at:clock.now()}),()=>{});
  const beats=[{cue:'enemy.intent',at:0},{cue:'release.fire',at:90},{cue:'impact.fire',at:240}];
  assert.equal(sequence.start('one',beats,2),true);assert.equal(sequence.start('one',beats,2),false);assert.equal(events.length,1);
  clock.tick(45);assert.equal(events.at(-1)!.name,'release.fire');clock.tick(75);assert.equal(events.at(-1)!.name,'impact.fire');assert.equal(events.at(-1)!.at,120);
});
test('pause/hidden/new action cancels every older scheduled beat and old decode group',()=>{
  const clock=new Clock(),events:string[]=[];let stops=0;const sequence=new EffectSequence(clock,n=>events.push(n),()=>{stops++;});
  sequence.start('old',[{cue:'windup',at:0},{cue:'stale-hit',at:240}]);clock.tick(50);sequence.start('new',[{cue:'new-hit',at:90}]);clock.tick(500);
  assert.deepEqual(events,['windup','new-hit']);sequence.start('paused',[{cue:'never',at:200}]);sequence.cancel();clock.tick(500);assert.equal(events.includes('never'),false);assert.ok(stops>=3);
});
test('no catch-up burst after a throttled timer',()=>{
  let fn=()=>{},now=0;const events:string[]=[];const sequence=new EffectSequence({now:()=>now,set:f=>{fn=f;return 1;},clear(){}},n=>events.push(n),()=>{});
  sequence.start('late',[{cue:'hit',at:240}]);now=2000;fn();assert.deepEqual(events,[]);
});
test('physical/energy/mental and elemental actions choose different sound families',()=>{
  const a=strike(10);assert.equal(actionStyle(a),'slash');a.name='重锤';assert.equal(actionStyle(a),'heavy');a.name='穿刺';assert.equal(actionStyle(a),'pierce');
  assert.equal(actionStyle(strike(10,'energy')),'energy');const mental=strike(10,'energy');if(mental.effects[0]!.op==='damage'){const zero=mental.effects[0]!.amounts.mental;mental.effects[0]!.amounts.mental=mental.effects[0]!.amounts.energy;mental.effects[0]!.amounts.energy=zero;}assert.equal(actionStyle(mental),'mental');
  for(const [element,wanted] of [['火','fire'],['冰','ice'],['雷','lightning'],['风','wind'],['水','water'],['土','earth'],['光','light'],['暗','dark']]){const spell=strike(10,'energy');const damage=spell.effects[0]!;if(damage.op==='damage')damage.element=element!;assert.equal(actionStyle(spell),wanted);}
  assert.equal(actionStyle(heal()),'heal');assert.equal(actionStyle(ward()),'guard');
});
test('nested active references are followed, unrelated library spells are not guessed',()=>{
  const flame=strike(10,'energy');if(flame.effects[0]!.op==='damage')flame.effects[0]!.element='火';
  const action=strike(10);action.library=EMPTY_LIBRARY();action.library.actions.flame=flame;
  assert.equal(actionStyle(action),'slash');action.effects=[{op:'sequence',action:'flame',repeat:2}];assert.equal(actionStyle(action),'fire');
  action.library.actions.loop={...strike(10),effects:[{op:'sequence',action:'loop',repeat:1}]};action.effects=[{op:'sequence',action:'loop',repeat:1}];assert.ok(actionEffects(action).length<10);
});
function resolved({miss=false,critical=false,shield=false,enemy=true,lethal=false}={}) {
  const action=strike(lethal?99999:15);action.castMs=0;action.name='斩击';
  if(action.effects[0]!.op==='damage'){action.effects[0]!.hitRule=miss?'impossible':'guaranteed';action.effects[0]!.critChance=critical?1:0;}
  const card=contentCard(1,100,10,{strike:action});
  let b=createBattle([{id:'hero',name:'测试同行者',side:'ally',card,current:{hp:100,mp:65,sp:100},mitigation:bareMitigation()},{id:'enemy-0',name:'测试敌人',side:'enemy',card,current:{hp:100,mp:65,sp:100},mitigation:bareMitigation()}],82);
  const caster=enemy?'enemy-0':'hero',target=enemy?'hero':'enemy-0';
  if(shield)b.units.find(u=>u.id===target)!.shields.push({id:'test-shield',amount:1000,channels:['physical','energy','mental','true'],clock:'permanent',remaining:1});
  b.clock.pending=[{kind:'ready',unitId:caster}];b.clock.units.find(u=>u.id===caster)!.atb=100;
  const before=chooseAction(b,caster,'strike',target),after=resolveAction(before);return {before,after,target};
}
test('enemy action gets an audible tell, release, and real impact rather than only generic damage',()=>{
  const {before,after}=resolved(),snapshot=JSON.stringify({before,after}),p=battleAudioPlan(before,after)!;
  assert.equal(p.side,'enemy');assert.equal(p.events[0]!.cue,'enemy.intent');assert.ok(p.events.some(e=>e.cue==='release.slash'&&e.at<p.impactAt));assert.ok(p.events.some(e=>e.cue==='impact.slash'));assert.ok(p.events.some(e=>e.cue==='party.hurt'));
  assert.equal(JSON.stringify({before,after}),snapshot);
});
test('a true miss produces a whiff but no fake flesh hit or successful impact',()=>{
  const {before,after}=resolved({miss:true}),p=battleAudioPlan(before,after)!;
  assert.ok(p.events.some(e=>e.cue==='miss'));assert.equal(p.events.some(e=>e.cue.startsWith('impact.')||e.cue.startsWith('hit.')),false);
});
test('fully absorbed damage uses guard clang rather than pretending the target lost HP',()=>{
  const {before,after,target}=resolved({shield:true}),p=battleAudioPlan(before,after)!;
  assert.equal(after.units.find(u=>u.id===target)!.current.hp,before.units.find(u=>u.id===target)!.current.hp);
  assert.ok(p.events.some(e=>e.cue==='guard.block'));assert.equal(p.events.some(e=>e.cue.startsWith('impact.')),false);
});
test('criticals and lethal last hits survive the expedition clearing the battle object',()=>{
  const {before,after}=resolved({critical:true,lethal:true,enemy:false}),p=battleAudioPlan(before,after)!;
  assert.equal(after.outcome,'victory');assert.ok(p.events.some(e=>e.cue==='critical'));assert.ok(p.events.some(e=>e.cue==='down'));assert.ok(p.events.some(e=>e.cue.startsWith('impact.')));
});
test('cancelled actions do not make up a successful strike',()=>{
  const {before,after}=resolved();Object.values(before.commands)[0]!.cancelled=true;
  const p=battleAudioPlan(before,after)!;assert.deepEqual(p.events.map(e=>e.cue),['cast.fail']);
});
test('every new gameplay sound family resolves to shipped licensed samples; UI move and confirm differ',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../../21-音频制作/assets/audio-manifest.json',import.meta.url),'utf8')) as AudioManifest;
  for(const style of ['slash','pierce','heavy','fire','ice','lightning','water','wind','earth','light','dark','energy','mental','paper','machine','beast','stone','wood','glass','slime','spirit','insect','heal','guard','status','buff','debuff','summon'] as const)for(const cue of styleCues(style)){assert.ok(manifest.cues[cue],cue);for(const sample of manifest.cues[cue]!.variants)assert.ok(manifest.sfx[sample],sample);}
  for(const cue of ['ui.move','ui.confirm','dialogue.write','miss','guard.block','enemy.intent','party.hurt','cast.channel','cast.fail'])assert.ok(manifest.cues[cue],cue);
  assert.ok(manifest.cues['ui.move']!.variants.every(v=>!manifest.cues['ui.confirm']!.variants.includes(v)));
  assert.ok(Object.keys(manifest.sfx).filter(k=>k.startsWith('a2-')).length>=40);
});

test('visible battle feedback labels enemy actions, actual crits, misses and blocks',()=>{
  for(const options of [{critical:true},{miss:true},{shield:true}]) {
    const {before,after}=resolved(options);
    const frame={battle:{units:after.units.map(u=>({id:u.id,name:u.name})),log:[]},party:[]} as unknown as GameView;
    const cue=resolvedBattleCue(before,after,frame);assert.equal(cue.side,'enemy');assert.ok(cue.lines[0]!.startsWith('敌方'));
    if(options.critical)assert.ok(cue.changes.some(c=>c.critical));
    if(options.miss)assert.ok(cue.misses?.length);
    if(options.shield)assert.ok(cue.blocks?.length);
  }
});

test('resolved library-based skills use the actor execution library, not a missing inline echo',()=>{
  const flame=strike(25,'energy');flame.name='火焰子动作';if(flame.effects[0]!.op==='damage'){flame.effects[0]!.element='火';flame.effects[0]!.hitRule='guaranteed';}
  const nested={...strike(10),name:'连锁术',effects:[{op:'sequence' as const,action:'fire-child',repeat:1}],library:EMPTY_LIBRARY()};nested.library.actions['fire-child']=flame;
  const card=contentCard(1,500,10,{nested});let b=createBattle([{id:'hero',side:'ally',card,current:{hp:500,mp:65,sp:100},mitigation:bareMitigation()},{id:'enemy-0',side:'enemy',card,current:{hp:500,mp:65,sp:100},mitigation:bareMitigation()}],12);
  b.clock.pending=[{kind:'ready',unitId:'hero'}];b.clock.units[0]!.atb=100;const before=chooseAction(b,'hero','nested','enemy-0'),after=resolveAction(before);const plan=battleAudioPlan(before,after)!;
  assert.equal(plan.style,'fire');assert.ok(plan.events.some(e=>e.cue==='impact.fire'));
});
test('harmful control and friendly enhancement do not use the same neutral status sound',()=>{
  const curse={...strike(1),effects:[{op:'cast' as const,mode:'interrupt' as const,value:1}]};assert.equal(actionStyle(curse),'debuff');
  const boost={...strike(1),target:'self' as const,effects:[{op:'armor' as const,channel:'physical' as const,amount:flat(20)}]};assert.equal(actionStyle(boost),'buff');
});
