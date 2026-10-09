import type {State} from '../game/expedition';
import type {Battle} from '../battle/executor';
import {EffectSequence} from './effect-sequence';
import {battleAudioPlan, actionStyle, styleCues, unitPalette} from './battle-feedback';
import {ScoreDirector, validateAudioManifest} from './policy';
import {ExpeditionSoundObserver} from './observer';
import {GameAudioEngine, type AudioStatus} from './web-audio';
import type {AudioFrame, AudioManifest, Preferences, UICue} from './types';

export type GameAudioOptions = {structuredBattle?: boolean; baseUrl?: string; controlsRoot?: HTMLElement; onLevels?: (levels: {music: number; effects: number}) => void};
const SILENT = {observe(_s: State | null) {}, intent(_type: string) {}, ui(_name: UICue) {}, writing(_active: boolean) {}, resolved(_before: Battle, _after: Battle, _speed: number) {}, dispose() {}};
/** Attach to the existing playable host. No Godot pack, mechanics or save schema changes. */
export function mountGameAudio(win: Window, options: GameAudioOptions | false = {}) {
  if (options === false || typeof win.document?.createElement !== 'function' || typeof win.fetch !== 'function') return SILENT;
  const doc = win.document, base = new URL(options.baseUrl ?? 'audio/', doc.baseURI);
  const root = options.controlsRoot ?? doc.querySelector<HTMLElement>('#stage') ?? doc.body;
  const panel = doc.createElement('details'); panel.dataset.bookseaAudio = 'true';
  panel.style.cssText = 'position:absolute;right:10px;top:10px;z-index:40;color:#eee3cb;background:#191a26ed;border:1px solid #8d7956;border-radius:8px;font:13px/1.6 system-ui;box-shadow:0 3px 16px #0006;max-width:280px';
  if (root === doc.body) panel.style.position = 'fixed';
  const oldPosition = root.style.position;
  if (win.getComputedStyle(root).position === 'static') root.style.position = 'relative';
  panel.innerHTML = `<summary style="cursor:pointer;padding:7px 12px;min-height:36px;user-select:none">♫ 声音</summary><div style="padding:0 13px 12px;width:250px;max-width:70vw"><button type="button" data-enable style="width:100%;margin:3px 0 10px">启用 / 重试</button><label style="display:block"><input type="checkbox" data-muted> 全部静音</label><label style="display:block">总音量 <output data-value="master"></output><input aria-label="总音量" data-level="master" type="range" min="0" max="100" step="1" style="width:100%"></label><label style="display:block">背景音乐 <output data-value="music"></output><input aria-label="背景音乐" data-level="music" type="range" min="0" max="100" step="1" style="width:100%"></label><label style="display:block">音效 <output data-value="effects"></output><input aria-label="音效" data-level="effects" type="range" min="0" max="100" step="1" style="width:100%"></label><p data-status role="status" aria-live="polite" style="margin:8px 0;color:#cbbf9c">首次点击或按键后启用声音</p></div>`;
  if(root.classList.contains('rpg-audio'))panel.open=true;
  root.append(panel);
  const status = panel.querySelector<HTMLElement>('[data-status]')!;
  let disposed = false, manifest: AudioManifest | undefined, director: ScoreDirector | undefined, frame: AudioFrame | undefined;
  let loading: Promise<void> | undefined, levels = '', metadataError = '';
  const aborter = new AbortController();
  const report = (s: AudioStatus) => {if (!disposed) {status.textContent = s.message; status.style.color = s.error ? '#f0a49b' : '#cbbf9c';}};
  const engine = new GameAudioEngine(win, base, report);
  const sequence = new EffectSequence({now:()=>win.performance.now(),set:(fn,ms)=>win.setTimeout(fn,ms),clear:id=>win.clearTimeout(id)},
    (name,options)=>{void engine.playCue(name,options);},()=>engine.stopGroup('battle'));
  let preparedBattle = '', lastPlan: ReturnType<typeof battleAudioPlan> = null;
  const reflect = () => {
    const prefs = engine.getPreferences();
    for (const key of ['master', 'music', 'effects'] as const) {
      const slider = panel.querySelector<HTMLInputElement>('[data-level="' + key + '"]')!;
      slider.value = String(Math.round(prefs[key] * 100));
      panel.querySelector<HTMLOutputElement>('[data-value="' + key + '"]')!.value = slider.value + '%';
    }
    panel.querySelector<HTMLInputElement>('[data-muted]')!.checked = prefs.muted;
  };
  const updateFrame = (next: AudioFrame) => {
    if (next.paused || frame && (next.battleKey !== frame.battleKey || next.mode !== frame.mode)) sequence.reset();
    frame = next; engine.setContext(next.paused, next.mode === 'event' || next.mode === 'supplier');
    if (director) {
      const request = director.select(next); engine.setMusic(request);
      if (!request && next.theme) report({message: '主题 ' + next.theme + ' 尚无音频配置；没有套用通用曲。', error: true});
    }
  };
  async function loadManifest(): Promise<void> {
    if (disposed || loading) return loading;
    loading = (async () => {
      try {
        const response = await win.fetch(new URL('audio-manifest.json', base), {signal: aborter.signal, cache: 'no-cache'});
        if (!response.ok) throw Error('HTTP ' + response.status);
        const data = await response.json() as AudioManifest;
        if (disposed) return;
        const errors = validateAudioManifest(data); if (errors.length) throw Error(errors.slice(0, 3).join('; '));
        manifest = data; director = new ScoreDirector(data); engine.setManifest(data); metadataError = '';
        if (frame) updateFrame(frame);
      } catch (e) {if (!disposed) {metadataError = String(e); report({message: '声音暂未加载，请点击重试。', error: true});}}
      finally {loading = undefined;}
    })();
    return loading;
  }
  const observer = new ExpeditionSoundObserver({frame: updateFrame, cue: name => {void engine.playCue(name);}, manifest: () => manifest}, options.structuredBattle ?? false);
  const setPreferences = (prefs: Partial<Preferences>, notify = true) => {
    engine.setPreferences(prefs); preparedBattle = ''; reflect();
    if (notify && ('music' in prefs || 'effects' in prefs)) {
      const p = engine.getPreferences(); options.onLevels?.({music: p.music, effects: p.effects});
    }
  };
  panel.querySelector<HTMLButtonElement>('[data-enable]')!.onclick = () => {engine.retry(); if (!manifest) void loadManifest();};
  panel.querySelector<HTMLInputElement>('[data-muted]')!.onchange = e => setPreferences({muted: (e.target as HTMLInputElement).checked});
  for (const slider of Array.from(panel.querySelectorAll<HTMLInputElement>('[data-level]'))) slider.oninput = () => setPreferences({[slider.dataset.level!]: Number(slider.value) / 100});
  // Sliders and keyboard focus may not accidentally move the player beneath the panel.
  for (const type of ['keydown', 'keyup', 'pointerdown', 'pointerup', 'click', 'touchstart'] as const) panel.addEventListener(type, e => e.stopPropagation());
  const gesture = () => {if (engine.inspect().contextState !== 'running') void engine.unlock();};
  const visibility = () => {if(doc.hidden)sequence.cancel();engine.setBackground(doc.hidden);};
  const pagehide = () => {sequence.cancel();engine.setBackground(true);};
  const pageshow = () => engine.setBackground(doc.hidden);
  win.addEventListener('pointerdown', gesture, true); win.addEventListener('keydown', gesture, true);
  doc.addEventListener('visibilitychange', visibility); win.addEventListener('pagehide', pagehide); win.addEventListener('pageshow', pageshow);
  const api = {
    inspect: () => ({...engine.inspect(), manifestLoaded: !!manifest, metadataError, theme: frame?.theme,
      feedbackSequence: sequence.inspect(), lastBattlePlan: lastPlan ? {...lastPlan,events:lastPlan.events.map(e=>({...e}))} : null,
      catalog: manifest ? {themes: Object.keys(manifest.themes).length, music: Object.keys(manifest.music).length,
        sfx: Object.keys(manifest.sfx).length, monsters: Object.keys(manifest.monsters).length} : null}),
    unlock: () => engine.unlock(), retry: () => {engine.retry(); if (!manifest) void loadManifest();},
    setPreferences,
    observe(state: State | null) {
      if (disposed) return;
      if (state?.settings) {
        const key = [state.settings.music, state.settings.effects].join('/');
        if (key !== levels) {levels = key; setPreferences({music: state.settings.music, effects: state.settings.effects}, false);}
      }
      observer.observe(state);
      if (state?.mode === 'battle' && state.battle && frame && manifest && !state.paused && !doc.hidden && preparedBattle !== frame.battleKey && engine.inspect().unlocked && !engine.getPreferences().muted && engine.getPreferences().effects > 0) {
        preparedBattle = frame.battleKey;
        const names = new Set(['enemy.intent','miss','guard.block','shield.break','critical','reaction.beast','party.hurt','cast.channel','cast.fail','low.hp','down']);
        for (const u of state.battle.units) {
          const palette = u.side === 'ally' ? 'metal' : unitPalette(state.battle,u.id,frame.foeIds,manifest);
          names.add('enemy.' + palette);
          for (const action of Object.values(u.actions)) for (const name of styleCues(actionStyle({...action,library:u.library ?? action.library},palette))) names.add(name);
          names.add(manifest.palettes[unitPalette(state.battle,u.id,frame.foeIds,manifest)]?.hit ?? 'hit.flesh');
        }
        void engine.warmCues([...names]);
      }
    },
    ui(name: UICue) {if (!disposed) void engine.playCue(name,{group:'ui'});},
    writing(active: boolean) {if (!disposed) engine.setLoop('dialogue.write',active,'dialogue');},
    resolved(before: Battle, after: Battle, speed = 1) {
      if (disposed || doc.hidden || frame?.paused) return;
      const plan = battleAudioPlan(before,after,frame?.foeIds ?? [],manifest); if (!plan) return;
      lastPlan = plan;
      if (sequence.start((frame?.battleKey ?? '') + '/' + plan.key,plan.events,speed)) engine.duckFor(680/Math.max(1,speed));
    },
    intent(type: string) {if (!disposed) observer.intent(type);},
    dispose() {
      if (disposed) return; disposed = true; aborter.abort(); sequence.cancel(); engine.setLoop('dialogue.write',false); engine.dispose(); panel.remove();
      if (root.style.position === 'relative' && !oldPosition) root.style.position = oldPosition;
      win.removeEventListener('pointerdown', gesture, true); win.removeEventListener('keydown', gesture, true);
      doc.removeEventListener('visibilitychange', visibility); win.removeEventListener('pagehide', pagehide); win.removeEventListener('pageshow', pageshow);
      const global = win as unknown as {BookseaAudio?: unknown}; if (global.BookseaAudio === api) delete global.BookseaAudio;
    }
  };
  Object.assign(win, {BookseaAudio: api}); reflect(); visibility(); void loadManifest();
  return api;
}
