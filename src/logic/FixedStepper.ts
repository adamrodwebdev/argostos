/**
 * The fixed simulation step, whatever the screen's refresh rate: each frame adds the real time
 * it lasted, and the hunt runs as many whole steps as fit, the rest carried to the next frame.
 * 60, 120, 144 or 165 Hz, the hunt plays at the same pace (CrazyGames' rule). After a stall it
 * runs a few steps at most and lets the rest go: the game slows down rather than jumps.
 */
export class FixedStepper {
  private carried = 0;

  constructor(
    private readonly stepMs: number,
    private readonly maxStepsPerFrame: number,
  ) {
    if (!(stepMs > 0) || !Number.isSafeInteger(maxStepsPerFrame) || maxStepsPerFrame < 1) {
      throw new RangeError(`step ${stepMs} ms, ${maxStepsPerFrame} steps a frame`);
    }
  }

  /**
   * A frame lasted `elapsedMs` of real time: answers how many steps to run now, and keeps the
   * remainder. A frame that is not a finite, positive time runs nothing.
   */
  advance(elapsedMs: number): number {
    if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
    this.carried += elapsedMs;
    // A hair of tolerance: 1000 / 60 written in floating point never adds up exactly.
    const steps = Math.floor((this.carried + 1e-6) / this.stepMs);
    if (steps > this.maxStepsPerFrame) {
      this.carried = 0;
      return this.maxStepsPerFrame;
    }
    this.carried = Math.max(0, this.carried - steps * this.stepMs);
    return steps;
  }

  /** How far the next step is, from 0 to 1: the drawing blends the last two steps by it. */
  get blend(): number {
    return Math.min(1, this.carried / this.stepMs);
  }

  /** The loop restarts (a tab shown again): nothing is owed from before. */
  reset(): void {
    this.carried = 0;
  }
}
