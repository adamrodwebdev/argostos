/**
 * The source of chance, injected everywhere it is needed: a seed replays the exact same hunt
 * (bots, tests, a bug report), and no rule or logic ever calls `Math.random`.
 */
export interface RandomSource {
  /** A float in [0, 1). */
  next(): number;
  /** An integer in [0, max). */
  nextInt(max: number): number;
}
