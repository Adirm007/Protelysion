import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ScoreDirector, encounterTier, validateAudioManifest, wrappedPosition} from '../src/audio/policy';
import {sanitizePreferences, type AudioFrame, type AudioManifest} from '../src/audio/types';
import {ExpeditionSoundObserver, newLogs, actionCue} from '../src/audio/observer';
import {startExpedition} from '../src/game/expedition';
import {playtestParty, contentCard, strike, heal, ward, bareMitigation} from '../src/game/content';
import {createBattle} from '../src/battle/executor';

const manifest = JSON.parse(readFileSync(new URL('../../21-音频制作/assets/audio-manifest.json', import.meta.url), 'utf8')) as AudioManifest;
const frame = (change: Partial<AudioFrame> = {}): AudioFrame => ({mode:'explore',theme:'T15',scene:'漂浮书架',battleKey:'test/1',foeIds:['T15_N01'],phase:false,paused:false,outcome:'active',...change});
function probe() {
  const cues: string[] = [], frames: AudioFrame[] = [];
  const observer = new ExpeditionSoundObserver({manifest:()=>manifest,frame:f=>frames.push(f),cue:s=>cues.push(s)});
  return {observer,cues,frames};
}
function combatFixture() {
  const state=startExpedition(playtestParty(),123);
  const encounter=state.region.things.find(t=>t.kind==='enemy')!;
  encounter.foes=['T15_N01']; state.encounterId=encounter.id; state.mode='battle';
  const card=contentCard(1,100,10,{slash:strike(10)});
  state.battle=createBattle([
    {id:'reader',name:'技术夹具',side:'ally',card,current:{hp:100,mp:65,sp:100},mitigation:bareMitigation()},
    {id:'enemy-0',name:'折纸鸟',side:'enemy',card,current:{hp:100,mp:65,sp:100},mitigation:bareMitigation()}
  ],456);
  return state;
}

test('audio manifest is closed over all referenced tracks, samples and palettes',()=>assert.deepEqual(validateAudioManifest(manifest),[]));
test('48 themes / 144 scene slots have 48 distinct exploration identities',()=>{
  assert.equal(Object.keys(manifest.themes).length,48);
  assert.equal(Object.values(manifest.themes).flatMap(t=>t.scenes).length,144);
  assert.equal(new Set(Object.values(manifest.themes).map(t=>t.explore[0])).size,48);
  for(const [theme,t] of Object.entries(manifest.themes)) for(const scene of t.scenes) {
    assert.equal(new ScoreDirector(manifest).select(frame({theme,scene:scene.name}))?.id,scene.music);
  }
});
test('432 roster IDs resolve to a real tier and material palette',()=>{
  assert.equal(Object.keys(manifest.monsters).filter(k=>/^T\d{2}_/.test(k)).length,432);// 0.35：另有特殊单位 COMMON_STRAY
  for(let n=1;n<=48;n++) {
    const id='T'+String(n).padStart(2,'0'), monsters=Object.entries(manifest.monsters).filter(([k])=>k.startsWith(id+'_'));
    assert.equal(monsters.length,9);assert.equal(monsters.filter(([,m])=>m.tier==='normal').length,5);
    assert.equal(monsters.filter(([,m])=>m.tier==='elite').length,3);assert.equal(monsters.filter(([,m])=>m.tier==='boss').length,1);
    for(const [,m] of monsters) assert.ok(manifest.palettes[m.palette]);
  }
});
test('all 16 battle families have two ordinary tracks and distinct escalation',()=>{
  assert.equal(Object.keys(manifest.families).length,16);
  for(const f of Object.values(manifest.families)) {
    assert.equal(new Set(f.normal).size,2);
    assert.ok(!f.normal.includes(f.elite[0]!));assert.notEqual(f.elite[0],f.boss[0]);assert.notEqual(f.boss[0],f.phase[0]);
  }
});
test('mixed encounters use the highest threat, not the first monster',()=>{
  assert.equal(encounterTier(['T01_N01','T01_E02'],manifest),'elite');
  assert.equal(encounterTier(['T01_N01','T01_E02','T01_B01'],manifest),'boss');
});
test('every roster monster selects its family tier and never exploration music',()=>{
  for(const [id,m] of Object.entries(manifest.monsters)) {
    if(m.music)continue;// 专属战斗曲单位（「?」）另有测试
    const t=manifest.themes[m.theme]!, f=manifest.families[t.family]!;
    const pool=m.tier==='boss'?t.boss??f.boss:f[m.tier];
    const result=new ScoreDirector(manifest).select(frame({mode:'battle',theme:m.theme,foeIds:[id],battleKey:id}));
    assert.ok(result && pool.includes(result.id),id);
  }
});
test('20 Hz identical state snapshots do not restart/reselect a track',()=>{
  const director=new ScoreDirector(manifest), f=frame({mode:'battle'}), first=director.select(f);
  for(let i=0;i<2000;i++) assert.strictEqual(director.select({...f,foeIds:[...f.foeIds]}),first);
});
test('ordinary battle rotation avoids immediately repeating the last family track',()=>{
  const director=new ScoreDirector(manifest);let last='';
  for(let i=0;i<100;i++) {
    const selected=director.select(frame({mode:'battle',battleKey:'encounter/'+i}))!.id;
    assert.notEqual(selected,last);last=selected;
    director.select(frame());
  }
});
test('pause and event overlay retain the exploration cue',()=>{
  const director=new ScoreDirector(manifest), first=director.select(frame());
  assert.strictEqual(director.select(frame({paused:true})),first);
  assert.strictEqual(director.select(frame({mode:'event'})),first);
});
test('boss stage and thematic boss overrides select different real compositions',()=>{
  const director=new ScoreDirector(manifest), base=frame({theme:'T48',mode:'battle',foeIds:['T48_B01']});
  assert.equal(director.select(base)?.id,'BattleOpera');
  assert.equal(director.select({...base,phase:true})?.id,'Operette');
  assert.equal(new ScoreDirector(manifest).select(frame({theme:'T45',mode:'battle',foeIds:['T45_B01']}))?.id,'TillDeathDoUsPart');
});
test('missing themes do not quietly fall back to a universal score',()=>assert.equal(new ScoreDirector(manifest).select(frame({theme:'T99'})),null));
test('title / successful return / defeat have explicit routes',()=>{
  const director=new ScoreDirector(manifest);
  assert.equal(director.select(frame({mode:'title'}))?.id,manifest.system.title);
  assert.equal(director.select(frame({mode:'ended',outcome:'success'}))?.id,manifest.system.success);
  assert.equal(director.select(frame({mode:'ended',outcome:'failed'}))?.id,manifest.system.failed);
});
test('authored intro and sample loop offsets wrap correctly',()=>{
  assert.equal(wrappedPosition(0,2,5,15),2);assert.equal(wrappedPosition(0,15,5,15),5);
  assert.equal(wrappedPosition(8,12,5,15),10);assert.equal(wrappedPosition(14,1,5,15),5);
});
test('volume values clamp and non-finite/untrusted values cannot reach AudioParams',()=>{
  const prefs=sanitizePreferences({master:Infinity,music:-1,effects:50,muted:true});
  assert.deepEqual(prefs,{master:.8,music:0,effects:1,muted:true});
  assert.equal(sanitizePreferences({music:NaN}).music,.7);
});
test('all music loop bounds and EBU gain measurements are finite',()=>{
  assert.equal(Object.keys(manifest.music).length,124);
  for(const track of Object.values(manifest.music)) {
    assert.ok(track.loopStart!>=0 && track.loopEnd!>track.loopStart! && track.loopEnd!<=track.duration+.01);
    assert.ok(track.files.ogg && track.files.mp3);assert.ok(Number.isFinite(track.mix.gainDb));
  }
});
test('rolling combat log appends are one-shot and restored history is not replayed',()=>{
  const a={kind:'damage',unit:'x',detail:'命中',value:10}, b={...a,value:20}, c={...a,value:30};
  assert.deepEqual(newLogs([a],1,[a],1),[]);assert.deepEqual(newLogs([a],1,[a,b],2),[b]);
  assert.deepEqual(newLogs([a,b],1000,[b,c],1000),[c]);assert.deepEqual(newLogs([a,b],1000,[b,c],2),[]);
});
test('observer is read-only, including RNG and 200 repeated snapshots',()=>{
  const s=startExpedition(playtestParty(),123), before=JSON.stringify(s),p=probe();
  for(let i=0;i<200;i++)p.observer.observe(s);
  assert.equal(JSON.stringify(s),before);assert.deepEqual(p.cues,[]);
});
test('footsteps require actual successful displacement, not move intent',()=>{
  const s=startExpedition(playtestParty(),123),p=probe();p.observer.observe(s);p.observer.intent('move');p.observer.observe(s);
  assert.equal(p.cues.length,0);s.x++;p.observer.observe(s);assert.deepEqual(p.cues,['step.'+manifest.themes[s.region.theme]!.surface]);
});
test('pause/resume does not replay steps, chests or old combat effects',()=>{
  const s=startExpedition(playtestParty(),123),p=probe();p.observer.observe(s);s.paused=true;s.x++;p.observer.observe(s);
  s.paused=false;p.observer.observe(s);p.observer.observe(s);assert.deepEqual(p.cues,[]);
});
test('chest and reward events play once after actual state changes',()=>{
  const s=startExpedition(playtestParty(),123),p=probe();
  s.region.things.push({id:'audio-chest',kind:'chest',x:s.x,z:s.z,name:'音频技术夹具',used:false,foes:[]});
  p.observer.observe(s);s.region.things.find(t=>t.id==='audio-chest')!.used=true;
  s.run.rewards.push({kind:'voucher',faceValue:1,count:1,source:'isolated audio test'});
  p.observer.observe(s);p.observer.observe(s);assert.deepEqual(p.cues,['chest.open','reward']);
});
test('damage, critical, shield and heal are semantic effects, not button-click audio',()=>{
  const s=combatFixture(),p=probe();p.observer.observe(s);
  s.battle!.log.push({kind:'damage',unit:'enemy-0',detail:'暴击',value:10});s.battle!.units[1]!.current.hp-=10;
  p.observer.observe(s);assert.ok(p.cues.includes('hit.paper'));assert.ok(p.cues.includes('critical'));
  const count=p.cues.length;p.observer.observe(s);assert.equal(p.cues.length,count);
  s.battle!.units[1]!.current.hp+=5;p.observer.observe(s);assert.ok(p.cues.includes('heal'));
});
test('entering combat and boss phase are one-shot cues',()=>{
  const s=combatFixture(),p=probe();s.mode='explore';p.observer.observe(s);s.mode='battle';p.observer.observe(s);
  assert.deepEqual(p.cues,['encounter']);s.bossPhases=['enemy-0'];p.observer.observe(s);p.observer.observe(s);
  assert.equal(p.cues.filter(x=>x==='boss.phase').length,1);
});
test('battle victory, escape and failure are different outcomes',()=>{
  for(const result of ['victory','flee','defeat']) {
    const s=combatFixture(),p=probe();p.observer.observe(s);s.battle=null;s.mode='explore';
    if(result==='victory')s.fights++;if(result==='defeat'){s.mode='ended';s.run.status='failed';}
    p.observer.observe(s);assert.ok(p.cues.includes(result));p.observer.observe(s);assert.equal(p.cues.filter(c=>c===result).length,1);
  }
});
test('action audio prioritizes real damage element, recovery and shield semantics',()=>{
  assert.equal(actionCue(heal(),'metal',manifest),'heal');assert.equal(actionCue(ward(),'metal',manifest),'shield');
  assert.equal(actionCue(strike(10,'energy'),'metal',manifest),'magic.energy');
  assert.equal(actionCue(strike(10),'paper',manifest),'attack.paper');
  const fire=strike(10,'energy');const damage=fire.effects[0]!;if(damage.op==='damage')damage.element='火';
  assert.equal(actionCue(fire,'metal',manifest),'magic.fire');
});

test('outside-battle healing and damage respond to actual world resource changes',()=>{
  const s=startExpedition(playtestParty(),123),p=probe();p.observer.observe(s);
  s.world!.units[0]!.current.hp-=10;p.observer.observe(s);assert.ok(p.cues.includes('hit.flesh'));
  s.world!.units[0]!.current.hp+=8;p.observer.observe(s);assert.ok(p.cues.includes('heal'));
  const count=p.cues.length;p.observer.observe(s);assert.equal(p.cues.length,count);
});
test('the final resolved action still plays when the rules remove the battle object',()=>{
  const s=combatFixture(),p=probe(),a=strike(10);
  s.battle!.commands['audio-command']={id:'audio-command',caster:'reader',target:'enemy-0',targets:['enemy-0'],sourceId:'slash',action:a};
  s.battle!.clock.pending=[{kind:'resolve',unitId:'reader',commandId:'audio-command'}] as NonNullable<typeof s.battle>['clock']['pending'];
  p.observer.observe(s);s.battle=null;s.mode='explore';s.fights++;p.observer.observe(s);
  assert.ok(p.cues.includes('attack.slash'));assert.ok(p.cues.includes('victory'));
});
