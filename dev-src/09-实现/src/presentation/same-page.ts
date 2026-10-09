type BridgeEndpoint={sessionId:string;receive(wire:unknown):PresentationMessage[];close():void;setHostBlocked(reason:'hidden'|'context-lost'|'chat-changed'|'transport',blocked:boolean):PresentationMessage};
import {BRIDGE_VERSION, type PresentationMessage} from './protocol';

type Callback = (wire: string) => void;
type Slot = {BookseaBridge?: unknown};
/** Same-page JavaScriptBridge only. No postMessage listener, wildcard origin, parent scan or eval. */
export function mountSamePageBridge(target: Slot, bridge: BridgeEndpoint, onReceipt?: (sequence:number,count:number)=>void) {
  if (Object.hasOwn(target, 'BookseaBridge')) throw Error('已有呈现桥；不得同时挂载第二个控制器');
  let callback: Callback | undefined;
  let disposed = false;
  const publish = (message: PresentationMessage) => {
    if (disposed || !callback) return;
    try { callback(JSON.stringify(message)); }
    catch {
      callback = undefined;
      bridge.setHostBlocked('transport', true);
      throw Error('Godot呈现回调失败；规则已暂停，须重建呈现会话');
    }
  };
  const api = Object.freeze({
    protocolVersion: BRIDGE_VERSION,
    sessionId: bridge.sessionId,
    recordViewReceipt(sequence:number,count:number) {
      if(!disposed&&Number.isSafeInteger(sequence)&&sequence>0&&Number.isSafeInteger(count)&&count>=0&&count<=4)onReceipt?.(sequence,count);
    },
    attachRenderer(fn: Callback) {
      if (disposed || callback || typeof fn !== 'function') throw Error('呈现回调不可重复挂载');
      callback = fn;
    },
    send(wire: unknown) {
      if (disposed || !callback) return;
      for (const message of bridge.receive(wire)) publish(message);
    }
  });
  Object.defineProperty(target, 'BookseaBridge', {value: api, configurable: true, enumerable: false});
  return {publish, dispose() {
    if (disposed) return;
    disposed = true;
    callback = undefined;
    bridge.close();
    if (target.BookseaBridge === api) delete target.BookseaBridge;
  }};
}

/** Hidden/context loss/chat changes must be host blockers, not overridable UI pause flags. */
export function bindBridgeLifecycle(
  bridge: BridgeEndpoint, publish: (message: PresentationMessage) => void,
  document: Document, canvas: HTMLCanvasElement
): () => void {
  const visibility = () => publish(bridge.setHostBlocked('hidden', document.hidden));
  const lost = (event: Event) => {event.preventDefault(); publish(bridge.setHostBlocked('context-lost', true));};
  // Restoring WebGL does NOT resume the battle. The host must rebuild/verify the presentation first.
  document.addEventListener('visibilitychange', visibility);
  canvas.addEventListener('webglcontextlost', lost);
  visibility();
  return () => {
    document.removeEventListener('visibilitychange', visibility);
    canvas.removeEventListener('webglcontextlost', lost);
    bridge.setHostBlocked('transport', true);
  };
}
