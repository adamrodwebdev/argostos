import type { SpringTuning } from '../../rules/driving';

/** A wheel this far above where it should rest (m) has lost the ground: it is falling. */
const OFF_GROUND_M = 0.12;
/** A tyre is never thrown up faster than this (m/s) by the sand rising under it. */
const MAX_RISE = 6;

/**
 * A height on a spring and a damper (an axle's corner, a tyre): it follows its target with
 * weight. A tyre also falls: when the sand drops away from under it faster than gravity would
 * take it down, it cannot be pulled down faster than it falls, and when it meets the ground again
 * it lands (the speed of its landing is kept for the step: a truck's fall damage).
 */
export class SpringCorner {
  private y: number;
  private v = 0;
  private falling = false;
  private landed = 0;

  constructor(
    start: number,
    private readonly tuning: SpringTuning,
    /** Gravity on a tyre that lost the ground (m/s²); null for a corner that never falls. */
    private readonly gravity: number | null = null,
  ) {
    this.y = start;
  }

  get height(): number {
    return this.y;
  }

  /** Off the ground, falling. */
  get airborne(): boolean {
    return this.falling;
  }

  /** The speed it landed at this step (m/s, downward), 0 when it did not land. */
  get landing(): number {
    return this.landed;
  }

  step(target: number, dt: number): void {
    this.landed = 0;
    if (this.gravity !== null && !this.falling && this.y - target > OFF_GROUND_M) {
      this.falling = true;
    }
    // The sand fell away: nothing holds the tyre, it falls until it meets the ground.
    const acceleration =
      this.falling && this.gravity !== null
        ? -this.gravity
        : this.tuning.k * (target - this.y) - this.tuning.c * this.v;
    this.v += acceleration * dt;
    if (this.gravity !== null) this.v = Math.min(this.v, MAX_RISE);
    this.y += this.v * dt;
    if (this.falling && this.y <= target) {
      // It meets the ground again: it lands, the blow taken here, not bounced back.
      this.landed = Math.max(0, -this.v);
      this.falling = false;
      this.y = target;
      this.v = Math.max(0, this.v);
    }
  }
}
