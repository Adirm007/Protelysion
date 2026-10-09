/** Synthetic manual bridge harness only. This entry is NEVER included in release/booksea-flow.mjs. */
import {BattleBridge} from '../src/presentation/battle-bridge';
import {mountSamePageBridge, bindBridgeLifecycle} from '../src/presentation/same-page';
import {createBattle} from '../src/battle/executor';
import {card, damageAction, mitigation} from './compiler-fixtures';
const battle = createBattle([
  {id:'fixture-ally',side:'ally',card:card(damageAction()),current:{hp:100,mp:80,sp:100},mitigation:mitigation()},
  {id:'fixture-enemy',side:'enemy',card:card(damageAction()),current:{hp:100,mp:80,sp:100},mitigation:mitigation()}
],123);
const bridge = new BattleBridge(battle, crypto.randomUUID());
const mounted = mountSamePageBridge(window as unknown as {BookseaBridge?:unknown}, bridge);
const canvas = document.querySelector('canvas')!;
const unbind = bindBridgeLifecycle(bridge, mounted.publish, document, canvas);
const evidence = {view:bridge.view()};
Object.defineProperty(window,'__bridgeEvidence',{value:evidence});
const timer = setInterval(() => {
  try {
    const b = bridge.exportBattle();
    // Test strategy is explicit; this is not production EnemyAI or a default actor fallback.
    if (!bridge.view().blockers.length && b.clock.pending[0]?.kind === 'resolve') mounted.publish(bridge.resolvePending());
    else mounted.publish(bridge.advanceRules(50).message);
    evidence.view = bridge.view();
  } catch (e) {
    bridge.setHostBlocked('transport', true);
    document.querySelector('#status')!.textContent = String(e);
  }
},50);
window.addEventListener('pagehide',()=>{clearInterval(timer);unbind();mounted.dispose();},{once:true});
