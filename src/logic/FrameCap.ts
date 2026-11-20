/** A frame this much early still counts (ms): screens' timing wobbles. */
const SLACK_MS = 1;

/**
 * A cap on the frames drawn per second, for touch screens (Lumirift's): a 90, 120 or 144 Hz
 * phone would otherwise draw twice the frames for the same hunt, and heat up. It lets about
 * `maxFps` frames through a second, evenly: the time a frame owes the next carries over. With
 * no cap (`null`), every frame passes.
 */
export class FrameCap {
  private readonly minMs: number;
  private last: number | null = null;
  private owed = 0;

  constructor(maxFps: number | null) {
    this.minMs = maxFps !== null && maxFps > 0 ? 1000 / maxFps : 0;
  }

  /** A screen frame at `time` (ms): true if it is drawn. */
  admits(time: number): boolean {
    if (!Number.isFinite(time)) return false;
    if (this.minMs === 0 || this.last === null) {
      this.last = time;
      return true;
    }
    const since = time - this.last + this.owed;
    if (since < this.minMs - SLACK_MS) return false;
    this.owed = Math.min(this.minMs, Math.max(0, since - this.minMs));
    this.last = time;
    return true;
  }

  /** The loop starts again: its first frame is drawn at once. */
  reset(): void {
    this.last = null;
    this.owed = 0;
  }
}
