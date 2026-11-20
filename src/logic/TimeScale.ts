/**
 * The hunt's time against the real clock: a hit-stop holds it still for a few tens of
 * milliseconds at a bite, a slow motion runs it slower for the last prey; otherwise it runs at
 * one. The holds have a budget (Lumirift's rule): 140 ms at most each, 250 ms in any second, so
 * a chain of bites never stalls the game. The camera and the input keep the real time.
 */
export class TimeScale {
  private held = 0;
  private slowLeft = 0;
  private slowLength = 0;
  private slowScale = 1;
  private clock = 0;
  private readonly holds: number[] = [];
  private readonly holdTimes: number[] = [];

  static readonly MAX_HOLD_MS = 140;
  static readonly HOLD_BUDGET_MS = 250;

  /** Holds the hunt still for `ms` of real time (within the budget). */
  hold(ms: number): void {
    if (!Number.isFinite(ms) || ms <= 0) return;
    while (this.holdTimes.length > 0 && this.holdTimes[0]! <= this.clock - 1000) {
      this.holdTimes.shift();
      this.holds.shift();
    }
    const used = this.holds.reduce((sum, value) => sum + value, 0);
    const granted =
      Math.min(ms, TimeScale.MAX_HOLD_MS, TimeScale.HOLD_BUDGET_MS - used) - this.held;
    if (granted <= 0) return;
    this.held += granted;
    this.holds.push(granted);
    this.holdTimes.push(this.clock);
  }

  /** Runs the hunt at `scale` for `ms` of real time, easing back to full speed in its second half. */
  slow(scale: number, ms: number): void {
    if (!Number.isFinite(scale) || !Number.isFinite(ms) || ms <= 0) return;
    this.slowScale = Math.min(1, Math.max(0.05, scale));
    this.slowLength = ms;
    this.slowLeft = ms;
  }

  /** True while the hunt stands still. */
  get holding(): boolean {
    return this.held > 0;
  }

  /** The hunt's time for a frame of `realMs`: less while held or slowed. */
  advance(realMs: number): number {
    if (!Number.isFinite(realMs) || realMs <= 0) return 0;
    this.clock += realMs;
    const still = Math.min(realMs, this.held);
    this.held -= still;
    let scale = 1;
    if (this.slowLeft > 0) {
      const done = 1 - this.slowLeft / this.slowLength;
      scale =
        done < 0.5 ? this.slowScale : this.slowScale + (1 - this.slowScale) * ((done - 0.5) / 0.5);
      this.slowLeft = Math.max(0, this.slowLeft - realMs);
    }
    return (realMs - still) * scale;
  }
}
