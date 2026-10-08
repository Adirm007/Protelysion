import {wrappedPosition} from './policy';
import type {EffectOptions} from './effect-sequence';
import {DEFAULT_PREFERENCES, sanitizePreferences, type Asset, type AudioManifest, type MusicRequest, type Preferences} from './types';

type MusicVoice = {id: string; source: AudioBufferSourceNode; gain: GainNode; offset: number; started: number; remember: boolean; track: Asset};
type EffectVoice = {source: AudioBufferSourceNode; gain: GainNode; panner?: StereoPannerNode; cue: string; sample: string; group: string; loop: boolean; stopping?: boolean; priority: number; started: number};
type Cached = {buffer: AudioBuffer; used: number; bytes: number};
export type AudioStatus = {message: string; error?: boolean};
const db = (value: number) => Math.pow(10, value / 20);
const PREFS = 'booksea-audio-preferences-v1';
export function readPreferences(win: Window): Preferences {
  try {return sanitizePreferences(JSON.parse(win.localStorage.getItem(PREFS) ?? '{}'));} catch {return {...DEFAULT_PREFERENCES};}
}
/** Bounded Web Audio mixer. All network requests are to this game's own asset base. */
export class GameAudioEngine {
  private context?: AudioContext;
  private master?: GainNode;
  private musicBus?: GainNode;
  private effectsBus?: GainNode;
  private analyser?: AnalyserNode;
  private compressor?: DynamicsCompressorNode;
  private music?: MusicVoice;
  private musicVoices = new Set<MusicVoice>();
  private effects = new Set<EffectVoice>();
  private musicCache = new Map<string, Cached>();
  private sfxCache = new Map<string, AudioBuffer>();
  private sfxUsed = new Map<string, number>();
  private groupEpochs = new Map<string, number>();
  private loopIntents = new Map<string, string>();
  private duckTimer?: number;
  private impactDuck = false;
  private cueHistory: {cue:string; sample:string; group:string; at:number; pan:number; loop:boolean}[] = [];
  private inflight = new Map<string, Promise<AudioBuffer>>();
  private musicLoadCount = 0;
  private musicLoadWaiters: (() => void)[] = [];
  private bookmarks = new Map<string, number>();
  private failed = new Set<string>();
  private cooldowns = new Map<string, number>();
  private variants = new Map<string, number>();
  private aborter = new AbortController();
  private pendingMusic = -1;
  private generation = 0;
  private effectEpoch = 0;
  private disposed = false;
  private unlocked = false;
  private background = false;
  private paused = false;
  private eventDuck = false;
  private request: MusicRequest | null = null;
  private preferences: Preferences;
  private errors: string[] = [];
  private startedMusic = 0;
  private startedEffects = 0;
  private manifest?: AudioManifest;
  constructor(private win: Window, private base: URL, private report: (status: AudioStatus) => void, preferences = readPreferences(win)) {
    this.preferences = preferences;
  }
  setManifest(manifest: AudioManifest): void {this.manifest = manifest; void this.beginMusic(); void this.warmEffects(); this.resumeLoops();}
  getPreferences(): Preferences {return {...this.preferences};}
  setPreferences(value: Partial<Preferences>, persist = true): void {
    const wasSilent = this.preferences.muted || this.preferences.effects <= 0 || this.preferences.master <= 0;
    this.preferences = sanitizePreferences(value, this.preferences);
    if (persist) try {this.win.localStorage.setItem(PREFS, JSON.stringify(this.preferences));} catch { /* Private/restricted storage does not disable audio. */ }
    this.mix();
    if ((this.preferences.muted || this.preferences.effects <= 0 || this.preferences.master <= 0) && !wasSilent) {this.effectEpoch++; this.stopEffects();}
    if (!this.preferences.muted) {void this.beginMusic(); this.resumeLoops();}
  }
  private ramp(param: AudioParam, value: number, seconds = .08): void {
    const now = this.context!.currentTime;
    if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(now);
    else {param.cancelScheduledValues(now); param.setValueAtTime(param.value, now);}
    param.linearRampToValueAtTime(value, now + seconds);
  }
  private mix(): void {
    if (!this.context || !this.master || !this.musicBus || !this.effectsBus) return;
    this.ramp(this.master.gain, this.preferences.muted || this.background ? 0 : this.preferences.master);
    const duck = this.paused ? .28 : Math.min(this.eventDuck ? .55 : 1, this.impactDuck ? .64 : 1);
    this.ramp(this.musicBus.gain, this.preferences.music * duck, .2);
    this.ramp(this.effectsBus.gain, this.preferences.effects);
  }
  async unlock(): Promise<void> {
    if (this.disposed || this.background || this.win.document.hidden) return;
    try {
      if (!this.context) {
        const host = this.win as unknown as {AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext};
        const Context = host.AudioContext ?? host.webkitAudioContext;
        if (!Context) {this.report({message: '此浏览器不支持 Web Audio；游戏可继续。', error: true}); return;}
        // Construct/resume synchronously in the pointer/keyboard event, before any network await.
        this.context = new Context({latencyHint: 'interactive'});
        this.master = this.context.createGain(); this.master.gain.value = 0;
        this.musicBus = this.context.createGain(); this.effectsBus = this.context.createGain();
        this.compressor = this.context.createDynamicsCompressor();
        this.compressor.threshold.value = -3; this.compressor.knee.value = 6;
        this.compressor.ratio.value = 4; this.compressor.attack.value = .006; this.compressor.release.value = .15;
        this.analyser = this.context.createAnalyser(); this.analyser.fftSize = 512;
        this.musicBus.connect(this.master); this.effectsBus.connect(this.master);
        this.master.connect(this.compressor); this.compressor.connect(this.analyser); this.analyser.connect(this.context.destination);
      }
      await this.context.resume();
      if (this.disposed || this.background) {if (this.context.state !== 'closed') await this.context.suspend(); return;}
      this.unlocked = this.context.state === 'running'; this.mix();
      this.report({message: this.unlocked ? '声音已启用 · 素材按需加载' : '点击「启用 / 重试」恢复声音'});
      void this.beginMusic();
      void this.warmEffects(); this.resumeLoops();
    } catch (error) {if (!this.disposed) this.recordError('声音未解锁，请点击重试', error);}
  }
  setContext(paused: boolean, event: boolean): void {
    if (paused === this.paused && event === this.eventDuck) return;
    if (paused !== this.paused) {this.effectEpoch++; this.stopEffects();}
    this.paused = paused; this.eventDuck = event; this.mix();
    if (!paused) this.resumeLoops();
  }
  setBackground(hidden: boolean): void {
    if (hidden === this.background || this.disposed) return;
    this.background = hidden; this.effectEpoch++; this.mix();
    if (hidden) {this.stopEffects(); void this.context?.suspend().catch(() => {});}
    else if (this.unlocked) void this.unlock();
  }
  setMusic(request: MusicRequest | null): void {
    if (this.disposed) return;
    if (request?.id === this.request?.id) {
      this.request = request;
      if (this.music && request) this.music.remember = request.remember;
      return;
    }
    this.request = request; this.generation++;
    if (!request) {this.stopMusic(); return;}
    void this.beginMusic();
  }
  private remember(voice: MusicVoice): void {
    if (voice.remember && this.context) this.bookmarks.set(voice.id,
      wrappedPosition(voice.offset, this.context.currentTime - voice.started, voice.track.loopStart!, voice.track.loopEnd!));
  }
  private removeMusic(voice: MusicVoice): void {
    try {voice.source.stop();} catch { /* Already stopped. */ }
    voice.source.disconnect(); voice.gain.disconnect(); this.musicVoices.delete(voice);
  }
  private stopMusic(): void {
    if (this.music) this.remember(this.music);
    for (const voice of this.musicVoices) this.removeMusic(voice);
    this.music = undefined;
  }
  private async beginMusic(): Promise<void> {
    const ctx = this.context, request = this.request, manifest = this.manifest, generation = this.generation;
    if (this.disposed || !ctx || ctx.state !== 'running' || !this.unlocked || !request || !manifest || this.background || this.preferences.muted || this.preferences.music <= 0) return;
    if (this.music?.id === request.id || this.pendingMusic === generation || this.failed.has('music:' + request.id)) return;
    const track = manifest.music[request.id];
    if (!track) {this.recordError('音轨未登记：' + request.id); return;}
    this.pendingMusic = generation;
    try {
      const buffer = await this.load('music', request.id, track);
      if (this.disposed || generation !== this.generation || this.background || ctx.state !== 'running' || this.preferences.muted || this.preferences.music <= 0) return;
      const start = track.loopStart!, end = Math.min(buffer.duration, track.loopEnd!);
      if (!(start >= 0 && end > start)) throw Error('循环点无效');
      const now = ctx.currentTime;
      // A rapid sequence of scene changes may never accumulate three fading scores.
      for (const voice of this.musicVoices) if (voice !== this.music) this.removeMusic(voice);
      const source = ctx.createBufferSource(), gain = ctx.createGain();
      source.buffer = buffer; source.loop = true; source.loopStart = start; source.loopEnd = end;
      source.connect(gain); gain.connect(this.musicBus!);
      let offset = request.remember ? this.bookmarks.get(request.id) ?? 0 : 0;
      offset = wrappedPosition(offset, 0, start, end);
      gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(db(track.mix.gainDb), now + request.fade);
      const voice: MusicVoice = {id: request.id, source, gain, started: now, offset, remember: request.remember, track};
      this.musicVoices.add(voice);
      source.onended = () => {source.disconnect(); gain.disconnect(); this.musicVoices.delete(voice); this.evictMusic();};
      source.start(now, offset);
      if (this.music) {
        const old = this.music; this.remember(old); this.ramp(old.gain.gain, 0, request.fade);
        old.source.stop(now + request.fade + .02);
      }
      this.music = voice; this.startedMusic++; this.evictMusic();
      this.report({message: (track.title ?? request.id) + ' · Napi / M-ART'});
    } catch (error) {
      if (!this.disposed && generation === this.generation) {this.failed.add('music:' + request.id); this.recordError('配乐加载失败：' + request.id + '；可点击重试，游戏不受影响', error);}
    } finally {if (this.pendingMusic === generation) this.pendingMusic = -1;}
  }
  private safeUrl(path: string): string {
    if (!/^(music|sfx)\//.test(path) || path.split('/').includes('..')) throw Error('非法音频资源路径');
    const url = new URL(path, this.base);
    if (url.origin !== this.base.origin || !url.pathname.startsWith(this.base.pathname)) throw Error('音频资源越界');
    return url.href;
  }
  private async acquireMusicLoad(): Promise<void> {
    if (this.musicLoadCount < 2) {this.musicLoadCount++; return;}
    await new Promise<void>(resolve => this.musicLoadWaiters.push(resolve));
  }
  private releaseMusicLoad(): void {
    const next = this.musicLoadWaiters.shift();
    if (next) next(); else this.musicLoadCount--;
  }
  private load(kind: 'music' | 'sfx', id: string, asset: Asset): Promise<AudioBuffer> {
    const key = kind + ':' + id;
    const cached = kind === 'music' ? this.musicCache.get(id)?.buffer : this.sfxCache.get(id);
    if (cached) {const entry = this.musicCache.get(id); if (entry) entry.used = Date.now(); if (kind === 'sfx') this.sfxUsed.set(id,Date.now()); return Promise.resolve(cached);}
    const pending = this.inflight.get(key); if (pending) return pending;
    const work = (async () => {
      if (kind === 'music') await this.acquireMusicLoad();
      try {
      if (this.disposed || (kind === 'music' && this.request?.id !== id)) throw Error('Superseded audio request');
      let error: unknown;
      const paths = kind === 'music' ? [asset.files.ogg, asset.files.mp3] : [asset.files.wav, asset.files.ogg];
      for (const path of paths.filter((p): p is string => !!p)) {
        try {
          const response = await this.win.fetch(this.safeUrl(path), {signal: this.aborter.signal, cache: 'force-cache'});
          if (!response.ok) throw Error('HTTP ' + response.status);
          const data = await response.arrayBuffer();
          if (this.disposed || (kind === 'music' && this.request?.id !== id)) throw Error('Superseded audio request');
          const buffer = await this.context!.decodeAudioData(data);
          if (this.disposed) throw Error('Audio disposed');
          if (kind === 'music') this.musicCache.set(id, {buffer, used: Date.now(), bytes: buffer.length * buffer.numberOfChannels * 4});
          else {this.sfxCache.set(id, buffer); this.sfxUsed.set(id,Date.now()); this.evictEffects();}
          this.evictMusic(); return buffer;
        } catch (e) {error = e; if (this.disposed || (kind === 'music' && this.request?.id !== id)) break;}
      }
      throw error ?? Error('No supported audio encoding');
      } finally {if (kind === 'music') this.releaseMusicLoad();}
    })();
    this.inflight.set(key, work);
    void work.then(() => this.inflight.delete(key), () => this.inflight.delete(key));
    return work;
  }
  private evictMusic(): void {
    let bytes = [...this.musicCache.values()].reduce((n, v) => n + v.bytes, 0);
    const protectedIds = new Set([...this.musicVoices].map(v => v.id));
    if (this.request) protectedIds.add(this.request.id);
    for (const [id, value] of [...this.musicCache].sort((a, b) => a[1].used - b[1].used)) {
      if (bytes <= 96 * 1024 * 1024) break;
      if (protectedIds.has(id)) continue;
      this.musicCache.delete(id); bytes -= value.bytes;
    }
  }
  private evictEffects(): void {
    let bytes = [...this.sfxCache.values()].reduce((n,b)=>n+b.length*b.numberOfChannels*4,0);
    const active = new Set([...this.effects].map(v=>v.sample));
    for (const [id,buffer] of [...this.sfxCache].sort((a,b)=>(this.sfxUsed.get(a[0])??0)-(this.sfxUsed.get(b[0])??0))) {
      if (bytes <= 48*1024*1024) break;
      if (active.has(id)) continue;
      this.sfxCache.delete(id); this.sfxUsed.delete(id); bytes-=buffer.length*buffer.numberOfChannels*4;
    }
  }
  async playCue(name: string, options: EffectOptions = {}): Promise<void> {
    const ctx = this.context, manifest = this.manifest, epoch = this.effectEpoch;
    const group = options.group ?? 'effects', groupEpoch = this.groupEpochs.get(group) ?? 0;
    if (this.disposed || !ctx || ctx.state !== 'running' || !this.unlocked || this.background || this.preferences.muted || this.preferences.effects <= 0 || this.preferences.master <= 0 || !manifest || (this.paused && !name.startsWith('ui.'))) return;
    const cue = manifest.cues[name]; if (!cue) return;
    const at = this.win.performance.now();
    if (!options.force && at - (this.cooldowns.get(name) ?? -Infinity) < cue.cooldownMs) return;
    this.cooldowns.set(name, at);
    let index = Math.floor(Math.random() * cue.variants.length);
    if (cue.variants.length > 1 && this.variants.get(name) === index) index = (index + 1) % cue.variants.length;
    this.variants.set(name, index);
    const id = cue.variants[index]!, asset = manifest.sfx[id]; if (!asset || this.failed.has('sfx:' + id)) return;
    try {
      const buffer = await this.load('sfx', id, asset);
      if (this.disposed || epoch !== this.effectEpoch || groupEpoch !== (this.groupEpochs.get(group) ?? 0) || this.background || ctx.state !== 'running' || this.preferences.muted || this.preferences.effects <= 0 || this.preferences.master <= 0) return;
      if (options.loop) {
        if (this.loopIntents.get(group) !== name || [...this.effects].some(v=>v.group===group && v.loop && !v.stopping)) return;
      } else if (this.win.performance.now() - at > 350) return; // Never play stale hit/cursor backlogs.
      const priority = /^(boss\.|victory|defeat)/.test(name) ? 100 : group === 'battle' ? 80 : options.loop ? 25 : name.startsWith('step.') ? 10 : name.startsWith('ui.') ? 40 : 60;
      const same = [...this.effects].filter(v => v.cue === name);
      if (same.length >= 3) this.removeEffect(same[0]!);
      if (this.effects.size >= 12) {
        const victim = [...this.effects].sort((a,b)=>a.priority-b.priority||a.started-b.started)[0]!;
        if (victim.priority > priority) return;
        this.removeEffect(victim);
      }
      const source = ctx.createBufferSource(), gain = ctx.createGain();
      const pan = Math.max(-.65,Math.min(.65,options.pan ?? 0));
      const panner = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : undefined;
      source.buffer = buffer; source.loop = !!options.loop;
      source.playbackRate.value = options.loop ? 1 : 1 + (Math.random()*2-1)*cue.pitchVariation;
      const level = db(asset.mix.gainDb + cue.gainDb + Math.max(-24,Math.min(6,options.gainDb ?? 0)));
      gain.gain.setValueAtTime(0,ctx.currentTime); gain.gain.linearRampToValueAtTime(level,ctx.currentTime+.006);
      source.connect(gain);
      if (panner) {panner.pan.value=pan;gain.connect(panner);panner.connect(this.effectsBus!);} else gain.connect(this.effectsBus!);
      const voice: EffectVoice = {source,gain,panner,cue:name,sample:id,group,loop:!!options.loop,priority,started:ctx.currentTime};
      this.effects.add(voice);
      source.onended=()=>{source.disconnect();gain.disconnect();panner?.disconnect();this.effects.delete(voice);this.evictEffects();};
      source.start(); this.startedEffects++;
      this.cueHistory.push({cue:name,sample:id,group,at:this.win.performance.now(),pan,loop:!!options.loop});
      if (this.cueHistory.length>160) this.cueHistory.splice(0,this.cueHistory.length-160);
    } catch (error) {if (!this.disposed && groupEpoch === (this.groupEpochs.get(group) ?? 0)) {this.failed.add('sfx:'+id);this.recordError('音效加载失败：'+id,error);}}
  }
  /** A single cancellable paper-writing loop; asynchronous decode cannot outlive its line. */
  setLoop(name: string, active: boolean, group = 'dialogue'): void {
    if (active && this.loopIntents.get(group) === name) return;
    this.stopGroup(group);
    if (!active) {this.loopIntents.delete(group);return;}
    this.loopIntents.set(group,name); void this.playCue(name,{group,loop:true,force:true});
  }
  private resumeLoops(): void {
    for (const [group,name] of this.loopIntents) if (![...this.effects].some(v=>v.group===group&&v.loop&&!v.stopping)) void this.playCue(name,{group,loop:true,force:true});
  }
  stopGroup(group: string): void {
    this.groupEpochs.set(group,(this.groupEpochs.get(group)??0)+1);
    for (const voice of this.effects) if (voice.group===group && !voice.stopping) {
      if (!this.context || this.context.state!=='running') {this.removeEffect(voice);continue;}
      voice.stopping=true; this.ramp(voice.gain.gain,0,.025);
      try {voice.source.stop(this.context.currentTime+.03);} catch {this.removeEffect(voice);}
    }
  }
  duckFor(milliseconds: number): void {
    if (this.duckTimer!==undefined) this.win.clearTimeout(this.duckTimer);
    this.impactDuck=true; this.mix();
    this.duckTimer=this.win.setTimeout(()=>{this.duckTimer=undefined;this.impactDuck=false;this.mix();},Math.max(100,Math.min(1500,milliseconds)));
  }
  private removeEffect(voice: EffectVoice): void {
    try {voice.source.stop();} catch { /* Finished already. */ }
    voice.source.disconnect(); voice.gain.disconnect(); voice.panner?.disconnect(); this.effects.delete(voice);
  }
  private stopEffects(): void {for (const voice of this.effects) this.removeEffect(voice);}
  async warmCues(names: readonly string[]): Promise<void> {
    if (!this.manifest || !this.context || !this.unlocked || this.disposed || this.background || this.preferences.muted || this.preferences.effects<=0) return;
    const ids=[...new Set(names.flatMap(n=>this.manifest!.cues[n]?.variants??[]))];
    for (let i=0;i<ids.length&&!this.disposed&&!this.background;i+=4)
      await Promise.all(ids.slice(i,i+4).map(id=>this.load('sfx',id,this.manifest!.sfx[id]!).catch(()=>undefined)));
  }
  private async warmEffects(): Promise<void> {
    await this.warmCues(['ui.move','ui.select','ui.confirm','ui.cancel','ui.error','dialogue.write','book.open','book.flip','encounter','release.slash','impact.slash','hit.flesh','miss','guard.block','heal','shield','enemy.intent']);
  }
  retry(): void {this.failed.clear(); this.errors = []; void this.unlock();}
  private recordError(message: string, error?: unknown): void {
    this.errors.push(message + (error ? ': ' + String(error) : '')); this.errors = this.errors.slice(-8);
    this.report({message, error: true});
  }
  inspect() {
    let rms = 0;
    if (this.analyser && this.context?.state === 'running') {
      const samples = new Float32Array(this.analyser.fftSize); this.analyser.getFloatTimeDomainData(samples);
      rms = Math.sqrt(samples.reduce((sum, x) => sum + x * x, 0) / samples.length);
    }
    return {contextState: this.context?.state ?? 'locked', unlocked: this.unlocked, background: this.background,
      paused: this.paused, requested: this.request?.id ?? null, playing: this.music?.id ?? null,
      loop: this.music ? {start: this.music.source.loopStart, end: this.music.source.loopEnd} : null,
      musicVoices: this.musicVoices.size, effectVoices: this.effects.size, starts: this.startedMusic,
      effectsStarted: this.startedEffects, cachedMusic: this.musicCache.size,
      cachedEffects: this.sfxCache.size, cachedEffectsMiB: [...this.sfxCache.values()].reduce((n,b)=>n+b.length*b.numberOfChannels*4,0)/1048576,
      pendingEffects: [...this.inflight.keys()].filter(k=>k.startsWith('sfx:')).length,
      writing: this.loopIntents.has('dialogue'), loopVoices: [...this.effects].filter(v=>v.loop&&!v.stopping).length,
      recentCues: this.cueHistory.map(v=>({...v})), impactDuck: this.impactDuck,
      cachedMusicMiB: [...this.musicCache.values()].reduce((n, v) => n + v.bytes, 0) / 1048576,
      pendingMusicLoads: this.musicLoadCount, queuedMusicLoads: this.musicLoadWaiters.length,
      preferences: this.getPreferences(), errors: [...this.errors], rms, disposed: this.disposed};
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.generation++; this.effectEpoch++; this.aborter.abort();
    if (this.duckTimer!==undefined) this.win.clearTimeout(this.duckTimer);
    this.loopIntents.clear(); this.groupEpochs.clear(); this.sfxUsed.clear();
    this.stopEffects(); this.stopMusic(); this.musicCache.clear(); this.sfxCache.clear(); this.inflight.clear();
    this.musicBus?.disconnect(); this.effectsBus?.disconnect(); this.master?.disconnect(); this.compressor?.disconnect(); this.analyser?.disconnect();
    void this.context?.close().catch(() => {});
  }
}
