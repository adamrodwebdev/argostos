import { BREATH } from '../../rules/combat';
import type { HuntEvents } from '../hunt/HuntEvents';
import type { Box } from '../truck/Truck';

/**
 * The glass dome Argostos breathes over the sand (the game's signature): it forms in a moment,
 * stands, then shatters. While it stands, the trucks inside it (and those that drive into its
 * wall) cannot move on: the convoy is held for the jaws. One dome at a time.
 */
export class GlassDome {
  private centre = 0;
  private age = 0;
  private standing = false;

  constructor(
    private readonly arenaWidthM: number,
    private readonly events: HuntEvents,
  ) {}

  get isStanding(): boolean {
    return this.standing;
  }
  get x(): number {
    return this.centre;
  }
  get halfWidth(): number {
    return BREATH.domeHalfWidthM;
  }
  get height(): number {
    return BREATH.domeHeightM;
  }
  /** How far it has formed, 0 to 1. */
  get formed(): number {
    return this.standing ? Math.min(1, this.age / BREATH.domeFormS) : 0;
  }
  /** How far through its standing it is, 0 (just formed, glowing) to 1 (cold, about to break). */
  get cooled(): number {
    if (!this.standing) return 0;
    return Math.min(1, Math.max(0, (this.age - BREATH.domeFormS) / BREATH.domeHoldS));
  }

  /** A dome over the sand at `x` (kept inside the arena); one standing already shatters first. */
  raise(x: number): void {
    if (!Number.isFinite(x)) return;
    if (this.standing) this.shatter();
    const half = BREATH.domeHalfWidthM;
    this.centre = Math.min(this.arenaWidthM - half, Math.max(half, x));
    this.age = 0;
    this.standing = true;
    this.events.emit('domeRaised', { x: this.centre, halfWidth: half, height: this.height });
  }

  step(dt: number): void {
    if (!this.standing) return;
    this.age += dt;
    if (this.age >= BREATH.domeFormS + BREATH.domeHoldS) this.shatter();
  }

  /** True when a body in `box` is held: it overlaps the dome once the glass has half formed. */
  holds(box: Box): boolean {
    if (!this.standing || this.formed < 0.5) return false;
    const half = BREATH.domeHalfWidthM;
    return box.right > this.centre - half && box.left < this.centre + half;
  }

  private shatter(): void {
    this.standing = false;
    this.events.emit('domeShattered', {
      x: this.centre,
      halfWidth: BREATH.domeHalfWidthM,
      height: BREATH.domeHeightM,
    });
  }
}
