import type {SendGameInput} from './game-dom';

export const EXPLORE_STEP_MS = 160;
const SAME_DIR_MIN_MS = 60;

const DIR_BY_CODE: Readonly<Record<string, {dx: number; dz: number}>> = {
  KeyW: {dx: 0, dz: -1},
  ArrowUp: {dx: 0, dz: -1},
  KeyS: {dx: 0, dz: 1},
  ArrowDown: {dx: 0, dz: 1},
  KeyA: {dx: -1, dz: 0},
  ArrowLeft: {dx: -1, dz: 0},
  KeyD: {dx: 1, dz: 0},
  ArrowRight: {dx: 1, dz: 0},
};

export type ExploreKeyboardOptions = {
  now?: () => number;
  stepMs?: number;
};

/**
 * Unified DOM-level exploration keyboard controller (WASD + Arrows).
 *
 * Fixes two systemic WebGL/canvas issues:
 * 1. Focus loss after HTML overlays (battle, events, menus, supplier, warning) close:
 *    movement listens at the document level AND restores focus to the stage canvas,
 *    so the player never has to click the map to resume moving.
 * 2. Stuck keys & slow turn response after the 「?」 chase warning popup:
 *    entering any non-explore state immediately clears held keys; returning to explore
 *    resets the step cooldown so a fresh directional press turns and steps instantaneously
 *    using a most-recently-pressed (LIFO) direction stack instead of fixed W>S>A>D priority.
 */
export function mountExploreKeyboard(
  stage: HTMLElement,
  send: SendGameInput,
  canExplore: () => boolean,
  options: ExploreKeyboardOptions = {},
) {
  const doc = stage.ownerDocument;
  const win = doc.defaultView!;
  const now = options.now ?? (() => win.performance?.now?.() ?? Date.now());
  const stepMs = options.stepMs ?? EXPLORE_STEP_MS;

  const held: string[] = [];
  let repeatTimer = 0;
  let lastStepAt = -Infinity;
  let lastDirKey = '';
  let wasExplore = false;

  const stopTimer = () => {
    if (repeatTimer) {
      win.clearInterval(repeatTimer);
      repeatTimer = 0;
    }
  };

  const clearHeld = () => {
    held.length = 0;
    stopTimer();
  };

  const topDirection = () => {
    for (let i = held.length - 1; i >= 0; i--) {
      const dir = DIR_BY_CODE[held[i]!];
      if (dir) return dir;
    }
    return null;
  };

  const step = (immediateTurn = false) => {
    if (!canExplore()) {
      clearHeld();
      return;
    }
    const dir = topDirection();
    if (!dir) {
      stopTimer();
      return;
    }
    const dirKey = `${dir.dx},${dir.dz}`;
    const t = now();
    const changed = dirKey !== lastDirKey;
    const minGap = immediateTurn && changed ? 0 : immediateTurn ? SAME_DIR_MIN_MS : stepMs - 4;
    if (t - lastStepAt < minGap) return;
    lastStepAt = t;
    lastDirKey = dirKey;
    send('move', {dx: dir.dx, dz: dir.dz});
  };

  const ensureTimer = () => {
    stopTimer();
    repeatTimer = win.setInterval(() => step(false), stepMs);
  };

  const restoreFocus = () => {
    const active = doc.activeElement as HTMLElement | null;
    if (active?.matches?.('input,textarea,select') || active?.closest?.('[data-booksea-overlay]')) return;
    const canvas = stage.querySelector<HTMLElement>('canvas');
    if (!canvas || canvas === active) return;
    // Focus canvas whenever focus was lost to body or trapped on a hidden/overlay control inside stage.
    if (!active || active === doc.body || active === doc.documentElement || stage.contains(active)) {
      try {
        canvas.focus({preventScroll: true});
      } catch {
        canvas.focus();
      }
    }
  };

  const ignoredTarget = (target: EventTarget | null) => {
    const el = target as HTMLElement | null;
    if (!el) return false;
    if (el.matches?.('input,textarea,select') || el.closest?.('[data-booksea-overlay]')) return true;
    if (el !== doc.body && el !== doc.documentElement && !stage.contains(el)) return true;
    return false;
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const dir = DIR_BY_CODE[e.code];
    if (!dir) return;
    if (stage.hidden || !stage.isConnected || !canExplore()) return;
    if (ignoredTarget(e.target)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.repeat && held.includes(e.code)) return;
    const prevTop = held[held.length - 1];
    const existing = held.indexOf(e.code);
    if (existing >= 0) held.splice(existing, 1);
    held.push(e.code);
    const turned = prevTop !== e.code;
    step(true);
    if (turned || !repeatTimer) ensureTimer();
  };

  const onKeyUp = (e: KeyboardEvent) => {
    if (!DIR_BY_CODE[e.code]) return;
    const idx = held.indexOf(e.code);
    if (idx >= 0) {
      held.splice(idx, 1);
      if (canExplore()) e.stopImmediatePropagation();
      if (!held.length) stopTimer();
    }
  };

  const onBlur = () => clearHeld();
  const onVisibility = () => {
    if (doc.hidden) clearHeld();
  };

  win.addEventListener('keydown', onKeyDown, true);
  win.addEventListener('keyup', onKeyUp, true);
  win.addEventListener('blur', onBlur);
  doc.addEventListener('visibilitychange', onVisibility);

  return {
    sync(exploreActive: boolean) {
      if (!exploreActive) {
        clearHeld();
        wasExplore = false;
        return;
      }
      if (!wasExplore) {
        // Fresh entry into exploration (battle ended, warning dismissed, menu/event/supplier closed):
        // clear any stale cooldown/direction and return DOM focus cleanly to the map canvas.
        clearHeld();
        lastStepAt = -Infinity;
        lastDirKey = '';
        restoreFocus();
      }
      wasExplore = true;
    },
    clear: clearHeld,
    dispose() {
      clearHeld();
      win.removeEventListener('keydown', onKeyDown, true);
      win.removeEventListener('keyup', onKeyUp, true);
      win.removeEventListener('blur', onBlur);
      doc.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
