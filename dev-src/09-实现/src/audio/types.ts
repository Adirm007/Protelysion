export type Tier = 'normal' | 'elite' | 'boss' | 'phase';
export type Asset = {
  id: string; title?: string; artist?: string; duration: number;
  files: Record<string, string>; mix: { gainDb: number };
  loopStart?: number; loopEnd?: number; decodedBytes?: number;
};
export type Cue = { variants: string[]; gainDb: number; cooldownMs: number; pitchVariation: number };
export type ThemeScore = {
  name: string; family: string; surface: string; explore: string[];
  scenes: {name: string; music: string}[]; boss?: string[]; phase?: string[];
};
export type AudioManifest = {
  version: 'booksea-audio/1'; music: Record<string, Asset>; sfx: Record<string, Asset>;
  cues: Record<string, Cue>; themes: Record<string, ThemeScore>;
  families: Record<string, {name: string} & Record<Tier, string[]>>;
  system: {title: string; success: string; failed: string};
  palettes: Record<string, {attack: string; hit: string}>;
  monsters: Record<string, {name: string; theme: string; tier: Exclude<Tier, 'phase'>; palette: string; music?: string}>;
};
export type AudioFrame = {
  mode: 'title' | 'explore' | 'event' | 'supplier' | 'battle' | 'ended'; theme: string; scene: string;
  battleKey: string; foeIds: string[]; phase: boolean; paused: boolean;
  outcome: string;
};
export type MusicRequest = {id: string; key: string; remember: boolean; fade: number};
export type Preferences = {master: number; music: number; effects: number; muted: boolean};
export const DEFAULT_PREFERENCES: Preferences = {master: .8, music: .7, effects: .8, muted: false};
export function clampLevel(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}
export function sanitizePreferences(value: Partial<Preferences>, previous = DEFAULT_PREFERENCES): Preferences {
  return {master: clampLevel(value.master, previous.master), music: clampLevel(value.music, previous.music),
    effects: clampLevel(value.effects, previous.effects), muted: typeof value.muted === 'boolean' ? value.muted : previous.muted};
}
export type UICue = 'ui.move' | 'ui.confirm' | 'ui.cancel' | 'ui.error';
export type UIAudioFeedback = {cue(name: UICue): void; writing(active: boolean): void};
