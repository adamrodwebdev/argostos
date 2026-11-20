/** How the jaws move: their springs and their poses (0 shut, 1 wide open). */
const JAW_FREQUENCY = 9;
const SNAP_SECONDS = 0.22;
const AT_REST = 0.14;
const BREATH = 0.06;

/**
 * The hero's scissor jaws, a cosmetic motion with a gameplay cue: they open wide as prey comes
 * near or as he bursts out, snap shut on a bite, and breathe a little at rest. A critically
 * damped spring carries them from pose to pose: nothing pops.
 */
export class Jaws {
  private open = AT_REST;
  private speed = 0;
  private snapLeft = 0;
  private time = 0;

  /** How far open they are now, from 0 (shut) to about 1. */
  get opening(): number {
    return Math.max(0, this.open);
  }

  /** The jaws close on something: they snap shut for a moment. */
  snap(): void {
    this.snapLeft = SNAP_SECONDS;
    this.speed = -20;
  }

  /** A frame of `dt` seconds; `eager` from 0 (nothing near) to 1 (prey in reach, or a leap). */
  update(eager: number, dt: number): void {
    this.time += dt;
    this.snapLeft = Math.max(0, this.snapLeft - dt);
    const rest = AT_REST + BREATH * Math.sin(this.time * 2.1);
    const target = this.snapLeft > 0 ? 0 : rest + (1 - rest) * Math.min(1, Math.max(0, eager));
    const w = 2 * Math.PI * JAW_FREQUENCY;
    this.speed += (w * w * (target - this.open) - 2 * w * this.speed) * dt;
    this.open += this.speed * dt;
  }
}
