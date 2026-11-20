import type { RandomSource } from '../rules/random';

/** Mulberry32 (Lumirift's): tiny, fast, and the same seed draws the same numbers everywhere. */
export class SeededRandom implements RandomSource {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }

  /** An independent source for another part of the game, drawn from this one. */
  fork(): SeededRandom {
    return new SeededRandom(Math.floor(this.next() * 4294967296));
  }
}
