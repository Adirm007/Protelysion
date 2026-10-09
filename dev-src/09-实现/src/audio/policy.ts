import type {AudioFrame, AudioManifest, MusicRequest, Tier} from './types';

export function hashAudioKey(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return hash >>> 0;
}
export function encounterTier(ids: readonly string[], manifest: AudioManifest): Exclude<Tier, 'phase'> {
  let tier: Exclude<Tier, 'phase'> = 'normal';
  for (const id of ids) {
    const role = manifest.monsters[id]?.tier ?? (/_B\d+$/.test(id) ? 'boss' : /_E\d+$/.test(id) ? 'elite' : 'normal');
    if (role === 'boss') return 'boss';
    if (role === 'elite') tier = 'elite';
  }
  return tier;
}
/** Pure presentation policy. Never consumes the expedition RNG or changes a save. */
export class ScoreDirector {
  private previousByPool = new Map<string, string>();
  private locked?: MusicRequest;
  constructor(readonly manifest: AudioManifest) {}
  select(frame: AudioFrame): MusicRequest | null {
    if (frame.mode === 'title') return this.lock('system:title', [this.manifest.system.title], false, 1.25);
    if (frame.mode === 'ended') {
      const end = frame.outcome === 'failed' ? 'failed' : 'success';
      return this.lock('system:' + end, [this.manifest.system[end]], false, 1.6);
    }
    const theme = this.manifest.themes[frame.theme];
    if (!theme) return null; // No one-song fallback that silently masks missing themes.
    if (frame.mode !== 'battle') {
      const music = theme.scenes.find(s => s.name === frame.scene)?.music;
      const pool = music ? [music] : theme.explore;
      return this.lock('explore:' + frame.theme + ':' + pool.join(','), pool, true, 1.25);
    }
    // 专属战斗曲（如「?」）：任一敌人声明 music 即整场沿用，优先于层级池。
    const exclusive = frame.foeIds.map(id => this.manifest.monsters[id]?.music).find((x): x is string => !!x && !!this.manifest.music[x]);
    if (exclusive) return this.lock('battle:' + frame.battleKey + ':exclusive:' + exclusive, [exclusive], false, .5);
    const family = this.manifest.families[theme.family];
    if (!family) return null;
    const tier = frame.phase ? 'phase' : encounterTier(frame.foeIds, this.manifest);
    const pool = tier === 'boss' ? theme.boss ?? family.boss : tier === 'phase' ? theme.phase ?? family.phase : family[tier];
    return this.lock('battle:' + frame.battleKey + ':' + tier, pool, false, tier === 'phase' ? .65 : .5, theme.family + ':' + tier);
  }
  private lock(key: string, pool: string[], remember: boolean, fade: number, poolKey = key): MusicRequest | null {
    if (this.locked?.key === key) return this.locked;
    if (!pool.length) return null;
    let index = hashAudioKey(key) % pool.length;
    if (pool.length > 1 && pool[index] === this.previousByPool.get(poolKey)) index = (index + 1) % pool.length;
    const id = pool[index]!;
    this.previousByPool.set(poolKey, id);
    this.locked = {id, key, remember, fade};
    return this.locked;
  }
}
export function wrappedPosition(offset: number, elapsed: number, start: number, end: number): number {
  const position = Math.max(0, offset + elapsed);
  return position < end ? position : start + ((position - start) % (end - start));
}
export function validateAudioManifest(m: AudioManifest): string[] {
  const errors: string[] = [];
  if (m.version !== 'booksea-audio/1') errors.push('Unsupported audio manifest version');
  const hasMusic = (id: string, owner: string) => { if (!m.music[id]) errors.push(owner + ': missing music ' + id); };
  for (const [id, theme] of Object.entries(m.themes)) {
    if (!m.families[theme.family]) errors.push(id + ': missing family');
    if (!theme.explore.length || !theme.scenes.length) errors.push(id + ': empty exploration score');
    [...theme.explore, ...theme.scenes.map(s => s.music), ...theme.boss ?? [], ...theme.phase ?? []].forEach(x => hasMusic(x, id));
    if (!m.cues['step.' + theme.surface]) errors.push(id + ': missing footsteps');
  }
  for (const [id, monster] of Object.entries(m.monsters)) {
    if (monster.music) hasMusic(monster.music, id);
  }
  for (const [id, family] of Object.entries(m.families)) {
    for (const tier of ['normal', 'elite', 'boss', 'phase'] as const) {
      if (!family[tier].length) errors.push(id + ': empty ' + tier);
      family[tier].forEach(x => hasMusic(x, id));
    }
    if (new Set(family.normal).size < 2) errors.push(id + ': ordinary encounters need rotation');
  }
  Object.values(m.system).forEach(x => hasMusic(x, 'system'));
  for (const [id, asset] of Object.entries(m.music)) {
    if (!(asset.loopStart! >= 0 && asset.loopEnd! > asset.loopStart! && asset.loopEnd! <= asset.duration + .01)) errors.push(id + ': invalid loop');
    if (!Number.isFinite(asset.mix.gainDb)) errors.push(id + ': invalid gain');
  }
  for (const [id, cue] of Object.entries(m.cues)) {
    if (!cue.variants.length) errors.push(id + ': no samples');
    for (const sample of cue.variants) if (!m.sfx[sample]) errors.push(id + ': missing ' + sample);
  }
  for (const [id, monster] of Object.entries(m.monsters)) {
    if (!m.themes[monster.theme] || !m.palettes[monster.palette]) errors.push(id + ': missing sound palette');
  }
  for (const [id, palette] of Object.entries(m.palettes)) {
    if (!m.cues[palette.attack] || !m.cues[palette.hit]) errors.push(id + ': missing material cue');
  }
  return errors;
}
