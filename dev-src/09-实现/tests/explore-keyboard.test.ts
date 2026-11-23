import test from 'node:test';
import assert from 'node:assert/strict';
import {mountExploreKeyboard, EXPLORE_STEP_MS} from '../src/ui/explore-keyboard';

type Listener = (e: any) => void;

function mockStageEnv() {
  let clock = 1000;
  const winListeners = new Map<string, Set<Listener>>();
  const docListeners = new Map<string, Set<Listener>>();
  const intervals = new Map<number, {fn: () => void; ms: number}>();
  let nextTimer = 1;
  let focusCalls = 0;

  const add = (map: Map<string, Set<Listener>>, type: string, fn: Listener) => {
    let set = map.get(type);
    if (!set) {set = new Set(); map.set(type, set);}
    set.add(fn);
  };
  const remove = (map: Map<string, Set<Listener>>, type: string, fn: Listener) => {
    map.get(type)?.delete(fn);
  };

  const makeEl = (tag: string, extra: Record<string, unknown> = {}) => {
    const el: any = {
      tagName: tag.toUpperCase(),
      hidden: false,
      isConnected: true,
      matches: (sel: string) => sel.split(',').some(s => s.trim().toUpperCase() === tag.toUpperCase()),
      closest: () => null,
      contains: (node: unknown) => node === el,
      focus: () => {doc.activeElement = el; if (el === canvas) focusCalls++;},
      ...extra,
    };
    return el;
  };

  const body = makeEl('body');
  const canvas = makeEl('canvas');
  const battleBtn = makeEl('button');
  const warnBtn = makeEl('button');
  const inputEl = makeEl('input');
  const overlayEl = makeEl('div', {closest: (sel: string) => sel === '[data-booksea-overlay]' ? overlayEl : null});

  const stage: any = makeEl('section', {
    contains: (node: unknown) => node === stage || node === canvas || node === battleBtn || node === warnBtn || node === inputEl,
    querySelector: (sel: string) => sel === 'canvas' ? canvas : null,
  });

  const win: any = {
    performance: {now: () => clock},
    addEventListener: (type: string, fn: Listener) => add(winListeners, type, fn),
    removeEventListener: (type: string, fn: Listener) => remove(winListeners, type, fn),
    setInterval: (fn: () => void, ms: number) => {const id = nextTimer++; intervals.set(id, {fn, ms}); return id;},
    clearInterval: (id: number) => {intervals.delete(id);},
  };

  const doc: any = {
    body,
    documentElement: makeEl('html'),
    activeElement: body,
    hidden: false,
    defaultView: win,
    addEventListener: (type: string, fn: Listener) => add(docListeners, type, fn),
    removeEventListener: (type: string, fn: Listener) => remove(docListeners, type, fn),
  };

  stage.ownerDocument = doc;

  const emitKey = (type: 'keydown' | 'keyup', code: string, opts: {target?: any; repeat?: boolean} = {}) => {
    let prevented = false, stopped = false;
    const ev = {
      code,
      repeat: !!opts.repeat,
      target: opts.target ?? doc.activeElement,
      preventDefault() {prevented = true;},
      stopImmediatePropagation() {stopped = true;},
    };
    for (const fn of [...(winListeners.get(type) ?? [])]) fn(ev);
    return {prevented, stopped};
  };

  const emitWin = (type: string) => {
    for (const fn of [...(winListeners.get(type) ?? [])]) fn({});
  };

  const tickInterval = (ms = EXPLORE_STEP_MS) => {
    clock += ms;
    for (const item of [...intervals.values()]) item.fn();
  };

  return {
    stage, doc, win, body, canvas, battleBtn, warnBtn, inputEl, overlayEl,
    emitKey, emitWin, tickInterval,
    advance: (ms: number) => {clock += ms;},
    getFocusCalls: () => focusCalls,
    activeIntervalCount: () => intervals.size,
  };
}

test('战斗结束后无需鼠标点击地图即可直接键盘移动，并自动恢复画布焦点', () => {
  const env = mockStageEnv();
  const moves: Array<{dx: number; dz: number}> = [];
  let explore = false;
  const ctrl = mountExploreKeyboard(env.stage, (type, payload) => {
    if (type === 'move') moves.push(payload as {dx: number; dz: number});
  }, () => explore);

  // Simulate battle ended while focus was left on a battle button inside stage.
  env.doc.activeElement = env.battleBtn;
  ctrl.sync(false);
  explore = true;
  ctrl.sync(true);

  assert.equal(env.doc.activeElement, env.canvas, '退出战斗后应自动把焦点归还给地图画布');
  assert.equal(env.getFocusCalls(), 1);

  // Even if focus falls back to document.body, WASD still moves immediately without clicking map.
  env.doc.activeElement = env.body;
  const res = env.emitKey('keydown', 'KeyW', {target: env.body});
  assert.equal(res.prevented, true);
  assert.deepEqual(moves, [{dx: 0, dz: -1}]);

  ctrl.dispose();
});

test('「?」追击弹框打断移动后：清空旧方向按键不卡键，关闭弹框瞬间可 0ms 立刻变向', () => {
  const env = mockStageEnv();
  const moves: Array<{dx: number; dz: number}> = [];
  let explore = true;
  const ctrl = mountExploreKeyboard(env.stage, (type, payload) => {
    if (type === 'move') moves.push(payload as {dx: number; dz: number});
  }, () => explore);

  ctrl.sync(true);
  // Player holds Right (KeyD) walking down corridor.
  env.emitKey('keydown', 'KeyD');
  assert.deepEqual(moves, [{dx: 1, dz: 0}]);

  // 「?」 spawns and steals focus to warnButton while KeyD has NOT received keyup!
  explore = false;
  env.doc.activeElement = env.warnBtn;
  ctrl.sync(false);
  assert.equal(env.activeIntervalCount(), 0, '弹框打开瞬间应立即清除按住方向与定时器');

  // Even if interval ticks during warning, no stuck movement occurs.
  env.advance(30);
  // Player clicks confirm on warning popup -> explore resumes.
  explore = true;
  ctrl.sync(true);
  assert.equal(env.doc.activeElement, env.canvas, '关闭追击弹框后自动还原焦点');

  // Within 10ms (far less than 160ms cooldown), player immediately presses Up (KeyW) to turn!
  env.advance(10);
  env.emitKey('keydown', 'KeyW');
  assert.deepEqual(moves, [{dx: 1, dz: 0}, {dx: 0, dz: -1}], '确认后无需等待冷却即可立刻向新方向迈出第一步');

  // Holding KeyW keeps stepping every 160ms at full chase speed; never drifts back to stale KeyD.
  env.tickInterval(EXPLORE_STEP_MS);
  assert.deepEqual(moves, [{dx: 1, dz: 0}, {dx: 0, dz: -1}, {dx: 0, dz: -1}]);

  ctrl.dispose();
});

test('按住旧方向同时按下新方向：按最后按下优先（LIFO）立刻变向，松开新方向后恢复旧方向', () => {
  const env = mockStageEnv();
  const moves: Array<{dx: number; dz: number}> = [];
  const ctrl = mountExploreKeyboard(env.stage, (type, payload) => {
    if (type === 'move') moves.push(payload as {dx: number; dz: number});
  }, () => true);
  ctrl.sync(true);

  env.emitKey('keydown', 'KeyW');
  env.advance(20);
  // Press KeyD BEFORE releasing KeyW (classic quick turn while fleeing 「?」)
  env.emitKey('keydown', 'KeyD');
  assert.deepEqual(moves, [{dx: 0, dz: -1}, {dx: 1, dz: 0}], '新方向键应立即覆盖旧方向，而非被 W>S>A>D 死优先级卡住');

  // Release KeyD while still holding KeyW -> next repeat smoothly resumes North.
  env.emitKey('keyup', 'KeyD');
  env.tickInterval(EXPLORE_STEP_MS);
  assert.deepEqual(moves, [{dx: 0, dz: -1}, {dx: 1, dz: 0}, {dx: 0, dz: -1}]);

  ctrl.dispose();
});

test('输入框、外部浮层与窗口失焦时不会误触发或卡死方向键', () => {
  const env = mockStageEnv();
  const moves: Array<{dx: number; dz: number}> = [];
  const ctrl = mountExploreKeyboard(env.stage, (type, payload) => {
    if (type === 'move') moves.push(payload as {dx: number; dz: number});
  }, () => true);
  ctrl.sync(true);

  env.emitKey('keydown', 'KeyW', {target: env.inputEl});
  env.emitKey('keydown', 'KeyA', {target: env.overlayEl});
  assert.deepEqual(moves, []);

  env.emitKey('keydown', 'KeyS');
  assert.equal(moves.length, 1);
  env.emitWin('blur');
  assert.equal(env.activeIntervalCount(), 0);
  env.tickInterval(EXPLORE_STEP_MS);
  assert.equal(moves.length, 1, '窗口失焦后不应继续自动走步');

  ctrl.dispose();
});
