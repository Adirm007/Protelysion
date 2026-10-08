import test from 'node:test';
import assert from 'node:assert/strict';
import {SUPPLIER_APPEARANCE_RATE, supplierRoll, supplierSpawns} from '../src/game/supplier';
import {makeRegion, chestSpawns, near} from '../src/game/region';
import {playtestParty} from '../src/game/content';
import {startExpedition, interact, supplierChoice, closeSupplier, move, tickExploration, view, restoreExpedition, eventChoice} from '../src/game/expedition';
import {RendererFrameCodec} from '../src/game/renderer-frame';
import {mountExpeditionRuntime} from '../src/game/runtime';
import {gridPath} from '../src/game/maps/geometry';

function supplierSeed() {for (let n = 1; n < 10000; n++) if (supplierSpawns(1, 0, n)) return n; throw Error('No supplier seed');}
function encounter() {
  const s = startExpedition(playtestParty(), supplierSeed());
  const t = s.region.things.find(t => t.kind === 'supplier')!;
  assert.ok(t); s.x = t.x; s.z = t.z; return {s, t};
}
const resources = (s: ReturnType<typeof startExpedition>) => s.party.map(p => ({...p.current}));

test('Supplier: exactly 9% threshold in a separate seeded stream, not guaranteed or coupled to chests', () => {
  assert.equal(SUPPLIER_APPEARANCE_RATE, .09);
  let count = 0; const combinations = new Set<string>();
  for (let seed = 0; seed < 50000; seed++) {
    const depth = seed % 60 + 1, visit = seed % 7;
    const occurs = supplierSpawns(depth, visit, seed);
    assert.equal(occurs, supplierRoll(depth, visit, seed) < .09);
    assert.equal(occurs, supplierSpawns(depth, visit, seed)); count += Number(occurs);
    const chest = chestSpawns(depth, visit, seed);
    combinations.add([occurs, chest.chest, chest.mimic].join('/'));
  }
  assert.ok(count / 50000 > .082 && count / 50000 < .098, String(count / 50000));
  assert.equal(combinations.size, 6);
});
test('Supplier: every sampled floor has zero or one reachable supplier and no pre-revealed event/rest', () => {
  let present = 0, absent = 0;
  for (let seed = 1; seed <= 120; seed++) {
    const depth = seed % 15 + 1, visit = seed % 3, r = makeRegion(depth, visit, seed);
    const found = r.things.filter(t => t.kind === 'supplier');
    assert.equal(found.length, Number(supplierSpawns(depth, visit, seed)));
    assert.equal(r.things.some(t => t.kind === 'camp' || t.kind === 'event'), false);
    assert.equal(r.layout.pois.some(p => ['camp', 'event'].includes(p.kind)), false);
    assert.equal(r.layout.pois.filter(p => p.kind === 'supplier').length, found.length);
    for (const t of found) {assert.ok(gridPath(r.tiles, r.spawn, t).distance >= 0); assert.equal(t.name, '补给员');}
    found.length ? present++ : absent++;
  }
  assert.ok(present > 0 && absent > present);
});
test('Supplier: interaction requires proximity; opening displays the exact question and four choices without costs', () => {
  const {s, t} = encounter(); s.x = s.region.spawn.x; s.z = s.region.spawn.z;
  assert.equal(near(s, t), false); interact(s); assert.notEqual(s.mode, 'supplier');
  const fresh = encounter(), state = fresh.s; const before = resources(state), seed = state.seed;
  interact(state); const v = view(state);
  assert.equal(state.mode, 'supplier'); assert.equal(v.supplier?.name, '补给员');
  assert.equal(v.supplier?.question, '要选哪个呢？');
  assert.deepEqual(v.supplier?.choices.map(c => c.id), ['event', 'bench', 'shop', 'kill']);
  assert.deepEqual(resources(state), before); assert.equal(state.seed, seed); assert.equal(state.run.rewards.length, 0);
});
test('Supplier: dialogue freezes walking, enemy AI and exploration effect clocks', () => {
  const {s} = encounter(); interact(s); const before = JSON.stringify(s);
  move(s, 1, 0); tickExploration(s, 10000); assert.equal(JSON.stringify(s), before);
});
for (const choice of ['event', 'bench'] as const) test('Supplier: '+choice+' replaces only this NPC in place and needs a fresh interaction', () => {
  const {s, t} = encounter(), {id, x, z} = t, before = resources(s), layout = s.region.layout, seed = s.seed;
  const others = structuredClone(s.region.things.filter(p => p.id !== id));
  interact(s); supplierChoice(s, choice);
  assert.equal(s.mode, 'explore'); assert.equal(s.supplierState, undefined); assert.equal(view(s).supplier, null);
  assert.equal(t.kind, choice === 'event' ? 'event' : 'camp'); assert.equal(t.used, false);
  assert.deepEqual({id: t.id, x: t.x, z: t.z}, {id, x, z}); assert.equal(s.region.layout, layout);
  assert.deepEqual(s.region.things.filter(p => p.id !== id), others); assert.equal(s.seed, seed);
  assert.deepEqual(resources(s), before); assert.equal(s.run.rewards.length, 0); assert.equal(s.eventState, undefined);
  const once = JSON.stringify(s); supplierChoice(s, 'event'); supplierChoice(s, 'bench'); assert.equal(JSON.stringify(s), once);
  interact(s);
  if (choice === 'event') {assert.equal(s.mode, 'event'); assert.ok(view(s).event); const leave = view(s).event!.choices.findIndex(c => c.id === 'leave'); eventChoice(s, leave >= 0 ? leave : 0); assert.ok(t.used || s.mode !== 'event');}
  else {assert.equal(s.mode, 'explore'); assert.equal(t.used, true);}
});
test('Supplier: bench (0.37.3) silently leaves a bench; one interaction fully restores the whole party and the bench is gone', () => {
  const {s, t} = encounter();
  for (const p of s.party) p.current = {hp: p.card.numeric.max.hp * .1, mp: p.card.numeric.max.mp * .1, sp: p.card.numeric.max.sp * .1};
  s.world = undefined;
  interact(s); supplierChoice(s, 'bench');
  assert.equal(t.kind, 'camp'); assert.equal(t.name, '长椅'); assert.equal(t.used, false);
  assert.equal(s.notice, '', 'choosing the bench shows no notice'); assert.equal(view(s).nearby?.kind, 'camp');
  for (const p of s.party) for (const key of ['hp', 'mp', 'sp'] as const) assert.ok(p.current[key] < p.card.numeric.max[key] * .5, 'no heal on choosing: ' + key);
  interact(s);
  for (const p of s.party) for (const key of ['hp', 'mp', 'sp'] as const) assert.ok(Math.abs(p.current[key] - p.card.numeric.max[key]) < 1.01, key);
  assert.equal(t.used, true); assert.equal(s.notice, ''); assert.notEqual(view(s).nearby?.id, t.id);
  const once = resources(s); interact(s); assert.deepEqual(resources(s), once);
});
test('Supplier: shop sells potions for pending FP; potions become battle-usable item commands for the whole party', () => {
  const {s} = encounter(); s.run.rewards.push({kind: 'fp', amount: 5000, count: 1, source: 'test'});
  interact(s); supplierChoice(s, 'shop'); const v = view(s); assert.ok(v.supplier?.choices.some(c => c.id === 'buy:red'));
  supplierChoice(s, 'buy:red'); assert.equal(s.bag?.red, 1); assert.ok(view(s).pendingFp < 5000);
  supplierChoice(s, 'back'); assert.equal(view(s).supplier?.choices.length, 4);
  assert.ok(s.world!.units.filter(u => u.side === 'ally').every(u => u.actions['potion:red']));
});
test('Supplier: kill leaves a blood stain, spawns a chest next to it and guarantees the next floor-9 visitor', () => {
  const {s, t} = encounter(); interact(s); supplierChoice(s, 'kill');
  assert.equal(s.mode, 'explore'); assert.equal(t.used, true); assert.equal(t.name, '血迹');
  assert.ok(s.region.things.some(x => (x.kind === 'chest' || x.kind === 'mimic') && !x.used && Math.abs(x.x - t.x) + Math.abs(x.z - t.z) <= 1));
  assert.equal(s.strayGuaranteedOnce, true);
});
test('Supplier: cancel does not consume the NPC or lottery; invalid, paused and stale choices do nothing', () => {
  const {s, t} = encounter(), seed = s.seed;
  interact(s); supplierChoice(s, 'bogus'); assert.equal(t.kind, 'supplier');
  s.paused = true; const paused = JSON.stringify(s); supplierChoice(s, 'event'); closeSupplier(s); assert.equal(JSON.stringify(s), paused);
  s.paused = false; closeSupplier(s); assert.equal(s.mode, 'explore'); assert.equal(t.kind, 'supplier'); assert.equal(t.used, false); assert.equal(s.seed, seed);
  interact(s); assert.equal(s.mode, 'supplier'); s.supplierState!.thingId = 'stale'; const stale = JSON.stringify(s); supplierChoice(s, 'bench'); assert.equal(JSON.stringify(s), stale);
});
test('Supplier: save/restore during dialogue and after choice keeps the same instance and cannot offer both rewards', () => {
  const {s, t} = encounter(); interact(s);
  const resumed = restoreExpedition(JSON.parse(JSON.stringify(s))); assert.equal(resumed.paused, true);
  assert.equal(resumed.supplierState?.thingId, t.id); assert.deepEqual(resumed.region, s.region);
  resumed.paused = false; supplierChoice(resumed, 'event');
  const revealed = restoreExpedition(JSON.parse(JSON.stringify(resumed))); revealed.paused = false;
  const before = JSON.stringify(revealed); supplierChoice(revealed, 'bench'); assert.equal(JSON.stringify(revealed), before);
  assert.equal(revealed.region.things.find(p => p.id === t.id)!.kind, 'event');
});
test('Supplier: renderer delta contains the changed kind without rebuilding/resending the static floor', () => {
  const {s, t} = encounter(), codec = new RendererFrameCodec(); codec.encode(view(s)); codec.acknowledge(s.region.id);
  interact(s); supplierChoice(s, 'bench'); const frame = JSON.parse(codec.encode(view(s)));
  assert.equal(frame.region.layout, undefined); assert.equal(frame.region.things.find((p: {id: string}) => p.id === t.id).kind, 'camp');
  assert.equal(codec.readyFor(s.region.id), true);
});
test('Supplier: production runtime dispatches, checkpoints and persists each choice', async () => {
  const {s, t} = encounter(), storage = new Map<string, string>(), checkpoints: string[] = [];
  const win = {localStorage: {getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v)}, setInterval: () => 1, clearInterval() {}, document: {hidden: false, addEventListener() {}, removeEventListener() {}}, addEventListener() {}, removeEventListener() {}} as unknown as Window;
  const runtime = mountExpeditionRuntime({storageKey: 'supplier-test', initial: s, audio: false, checkpoint: async copy => {checkpoints.push(copy.mode);}}, win);
  runtime.attach(raw => {const f = JSON.parse(raw); runtime.rendered(f.mode, f.region.id);});
  runtime.input({type: 'interact'}); runtime.input({type: 'supplierChoice', payload: {choice: 'bench'}}); await runtime.flush();
  assert.deepEqual(checkpoints, ['supplier', 'explore']); assert.equal(t.kind, 'camp');
  assert.equal(JSON.parse(storage.get('supplier-test')!).region.things.find((p: {id: string}) => p.id === t.id).kind, 'camp');
  runtime.dispose();
});
