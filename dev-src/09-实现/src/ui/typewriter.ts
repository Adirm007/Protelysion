export type RevealClock = {set(fn: () => void, delay: number): number; clear(id: number): void};
export function graphemes(text: string): string[] {
  const Segmenter = (Intl as unknown as {Segmenter?: new (locale: string, options: {granularity: string}) => {segment(text: string): Iterable<{segment: string}>}}).Segmenter;
  return Segmenter ? Array.from(new Segmenter('zh-CN', {granularity: 'grapheme'}).segment(text), p => p.segment) : Array.from(text);
}
/** UI time only. No game tick, RNG, save or reward state is touched. */
export class Typewriter {
  private letters: string[] = [];
  private index = 0;
  private timer?: number;
  private generation = 0;
  private paused = false;
  private active = false;
  constructor(private clock: RevealClock, private update: (text: string, typing: boolean) => void,
    private writing: (active: boolean) => void, readonly interval = 90) {}
  get typing(): boolean {return this.active;}
  start(text: string, instant = false): void {
    this.cancel(); this.letters = graphemes(text); this.index = 0; this.paused = false;
    if (instant || !this.letters.length) {this.index = this.letters.length; this.update(text, false); return;}
    this.active = true; this.update('', true); this.writing(true); this.schedule();
  }
  private schedule(): void {
    if (!this.active || this.paused) return;
    const generation = this.generation;
    this.timer = this.clock.set(() => {
      this.timer = undefined;
      if (generation !== this.generation || !this.active || this.paused) return;
      this.index++;
      if (this.index >= this.letters.length) {this.finish(); return;}
      this.update(this.letters.slice(0, this.index).join(''), true); this.schedule();
    }, this.interval);
  }
  finish(): void {
    if (!this.active) return;
    this.clear(); this.active = false; this.index = this.letters.length;
    this.writing(false); this.update(this.letters.join(''), false);
  }
  pause(value: boolean): void {
    if (this.paused === value) return;
    this.paused = value;
    if (!this.active) return;
    this.clear(); this.writing(!value);
    if (!value) this.schedule();
  }
  private clear(): void {this.generation++; if (this.timer !== undefined) this.clock.clear(this.timer); this.timer = undefined;}
  cancel(): void {this.clear(); const wasActive = this.active; this.active = false; if (wasActive) this.writing(false);}
  dispose(): void {this.cancel(); this.letters = [];}
}
