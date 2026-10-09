export type EffectOptions = {group?: string; pan?: number; gainDb?: number; force?: boolean; loop?: boolean};
export type EffectBeat = {cue: string; at: number; pan?: number; gainDb?: number};
export type SequenceClock = {now(): number; set(fn: () => void, delay: number): number; clear(id: number): void};
/** Cancelled/hidden/old scenes cannot play delayed hits after a later action. */
export class EffectSequence {
  private timers = new Set<number>();
  private epoch = 0;
  private last = '';
  constructor(private clock: SequenceClock, private play: (name: string, options: EffectOptions) => void,
    private stop: () => void) {}
  start(key: string, beats: readonly EffectBeat[], speed = 1): boolean {
    if (key === this.last) return false;
    this.cancel(); this.last = key;
    const epoch = this.epoch, started = this.clock.now(), rate = Math.max(1, Math.min(3, speed));
    for (const beat of beats.slice(0, 18)) {
      const delay = Math.max(0, beat.at / rate);
      const emit = () => {
        if (epoch !== this.epoch || this.clock.now() - started > delay + 250) return;
        this.play(beat.cue, {group: 'battle', force: true, pan: beat.pan ?? 0, gainDb: beat.gainDb ?? 0});
      };
      if (!delay) {emit(); continue;}
      const timer = this.clock.set(() => {this.timers.delete(timer); emit();}, delay);
      this.timers.add(timer);
    }
    return true;
  }
  cancel(): void {this.epoch++; for (const timer of this.timers) this.clock.clear(timer); this.timers.clear(); this.stop();}
  reset(): void {this.cancel(); this.last = '';}
  inspect() {return {key: this.last, pending: this.timers.size};}
}
