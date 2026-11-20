import type { SpringTuning } from '../../rules/driving';

/** A height on a spring and a damper (an axle's corner, a tyre): it follows its target with weight. */
export class SpringCorner {
  private y: number;
  private v = 0;

  constructor(
    start: number,
    private readonly tuning: SpringTuning,
  ) {
    this.y = start;
  }

  get height(): number {
    return this.y;
  }

  step(target: number, dt: number): void {
    this.v += (this.tuning.k * (target - this.y) - this.tuning.c * this.v) * dt;
    this.y += this.v * dt;
  }
}
