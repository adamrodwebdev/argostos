/** Frames kept for the readout's statistics (about four seconds at 60 Hz). */
const WINDOW = 240;

/** A ring of measured durations (ms) and their statistics: the mean and a percentile. */
export class DurationRing {
  private readonly values = new Float64Array(WINDOW);
  private readonly sorted = new Float64Array(WINDOW);
  private next = 0;
  private count = 0;

  add(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) return;
    this.values[this.next] = ms;
    this.next = (this.next + 1) % WINDOW;
    this.count = Math.min(WINDOW, this.count + 1);
  }

  get size(): number {
    return this.count;
  }

  mean(): number {
    if (this.count === 0) return 0;
    let sum = 0;
    for (let i = 0; i < this.count; i++) sum += this.values[i]!;
    return sum / this.count;
  }

  /** The value under which `share` of the samples lie (0.95: the 95th percentile). */
  percentile(share: number): number {
    if (this.count === 0) return 0;
    const view = this.sorted.subarray(0, this.count);
    view.set(this.values.subarray(0, this.count));
    view.sort();
    return view[Math.min(this.count - 1, Math.floor(share * this.count))]!;
  }
}

/**
 * What a frame costs, measured by the loop on the real clock: the time between frames, the
 * hunt's steps and the drawing. Read by the debug readout (`?debug=1`) and the frame-time
 * script; it changes nothing in the game.
 */
export class FrameProbe {
  readonly interval = new DurationRing();
  readonly steps = new DurationRing();
  readonly paint = new DurationRing();
}
