/**
 * A short history of the hero's path: his head's recent places, one every `spacingM` metres
 * of travel, in a ring made once (nothing allocated as he swims). It is what a rune's
 * recogniser will read later (runes come after the game is accepted: Argostos traces a rune
 * with his own path through the sand). Sampled by distance, so a shape reads the same at any
 * speed.
 */
export class HeadTrace {
  private readonly xs: Float64Array;
  private readonly zs: Float64Array;
  private readonly times: Float64Array;
  private newest = -1;
  private filled = 0;

  constructor(
    capacity: number,
    private readonly spacingM: number,
  ) {
    if (!Number.isInteger(capacity) || capacity < 2) throw new Error(`a trace of ${capacity}?`);
    this.xs = new Float64Array(capacity);
    this.zs = new Float64Array(capacity);
    this.times = new Float64Array(capacity);
  }

  /** Places kept (up to the capacity). */
  get count(): number {
    return this.filled;
  }

  /** The head at (x, z) at `time` (s): kept once it is `spacingM` from the last place kept. */
  record(x: number, z: number, time: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(z) || !Number.isFinite(time)) return;
    if (this.filled > 0) {
      const last = this.newest;
      if (Math.hypot(x - this.xs[last]!, z - this.zs[last]!) < this.spacingM) return;
    }
    this.newest = (this.newest + 1) % this.xs.length;
    this.xs[this.newest] = x;
    this.zs[this.newest] = z;
    this.times[this.newest] = time;
    this.filled = Math.min(this.xs.length, this.filled + 1);
  }

  /** The place `back` samples ago (0: the newest), written into `out`; false when there is none. */
  pointAt(back: number, out: { x: number; z: number; time: number }): boolean {
    if (!Number.isInteger(back) || back < 0 || back >= this.filled) return false;
    const slot = (this.newest - back + this.xs.length) % this.xs.length;
    out.x = this.xs[slot]!;
    out.z = this.zs[slot]!;
    out.time = this.times[slot]!;
    return true;
  }
}
