// Isolated synthetic party; no real chat, model, account or settlement access.
import {startExpedition, startNarrative, narrativeDescend} from '../src/game/expedition';
import {mountNarrativePanel} from '../src/distribution/narrative-panel';
import {playtestParty} from '../src/game/content';
import {supplierSpawns} from '../src/game/supplier';
import {walkable} from '../src/game/region';
import {mountExpeditionRuntime} from '../src/game/runtime';
import {installPlayerTheme} from '../src/ui/theme';

export async function boot() {
  const g = window as any; let seed = 1; while (!supplierSpawns(1, 0, seed)) seed++;
  const state = startExpedition(playtestParty().slice(0, 1), seed);
  function prepare() {
    for (const t of state.region.things) if (t.kind === 'enemy') t.used = true;
    for (const p of state.party) p.current = {hp: p.card.numeric.max.hp * .1, mp: p.card.numeric.max.mp * .1, sp: p.card.numeric.max.sp * .1};
    state.world = undefined;
    const t = state.region.things.find(t => t.kind === 'supplier')!;
    const p = [[-1, 0], [1, 0], [0, 1], [0, -1]].map(([dx, dz]) => ({x: t.x + dx!, z: t.z + dz!})).find(p => walkable(state.region, p.x, p.z))!;
    state.x = p.x; state.z = p.z;
  }
  prepare(); const root = document.getElementById('app')!; installPlayerTheme(root); root.classList.add('bs-playing');
  root.innerHTML = '<div class="bs-portal"><section id="stage"><canvas id="canvas" tabindex="0"></canvas></section></div>';
  const runtime = mountExpeditionRuntime({storageKey: 'supplier-0242-isolated-fixture', uiRoot: document.getElementById('stage')!, initial: state, audio: false});
  g.SupplierTest = {state, runtime, artPose() {
    const t = state.region.things.find(t => t.kind === 'supplier')!;
    const p = [[-3, 0], [0, 3], [3, 0], [0, -3], [-2, 0], [0, 2], [2, 0], [0, -2]]
      .map(([dx, dz]) => ({x: t.x + dx!, z: t.z + dz!})).find(p => walkable(state.region, p.x, p.z));
    if (!p) throw Error('No separated synthetic art-review pose');
    state.x = p.x; state.z = p.z;
    runtime.input({type: 'settings', payload: {}});
    return {player: p, supplier: {x: t.x, z: t.z}};
  }, narrativePanel() {
    // 0.40.1 正文模式面板版式：独立容器 + 合成远征状态，不读写宿主、不发消息。
    const host = document.createElement('div'); host.id = 'narrative-check'; host.style.cssText = 'position:fixed;inset:0;overflow:auto;z-index:99;background:#111';
    const panelRoot = document.createElement('div'); host.append(panelRoot); document.body.append(host); installPlayerTheme(panelRoot);
    const s = startExpedition(playtestParty().slice(0, 1), seed); startNarrative(s); narrativeDescend(s); s.hostContext = '1:fixture';
    const globals = {TavernHelper: {getVariables: () => ({booksea: {activeExpedition: s}}), getLastMessageId: () => 1, getCurrentMessageId: () => 1}, SillyTavern: {getContext: () => ({characterId: 1, getCurrentChatId: () => 'fixture'})}, localStorage: {getItem: () => null}};
    return !!mountNarrativePanel(panelRoot, globals, () => {});
  }, closeNarrativePanel() {document.getElementById('narrative-check')?.remove();}, reset() {
    for (const key of Object.keys(state)) delete (state as any)[key];
    Object.assign(state, startExpedition(playtestParty().slice(0, 1), seed)); prepare();
    runtime.input({type: 'settings', payload: {}});
  }};
  const engine = new g.Engine({executable: new URL('/game', location.href).href, mainPack: new URL('/game.pck', location.href).href, canvas: document.querySelector('canvas'), canvasResizePolicy: 0, focusCanvas: true});
  await engine.startGame(); g.SupplierTest.started = true;
}
