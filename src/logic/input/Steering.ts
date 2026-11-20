import { throttleFor } from '../../rules/swimming';

/** What the player asks of the hero this step: where to head (radians) and how hard (0–1). */
export interface Steering {
  heading: number;
  throttle: number;
}

/** A source of steering: the finger, the pointer, the keys, the autopilot. */
export interface SteeringIntent {
  /**
   * Writes the steering for a head at (x, z) into `out` (no allocation per step) and answers
   * whether the player asks anything at all; false leaves `out` as it was.
   */
  steer(headX: number, headZ: number, out: Steering): boolean;
}

/** Nobody steers: the hero cruises on by himself. */
export class IdleIntent implements SteeringIntent {
  steer(): boolean {
    return false;
  }
}

/**
 * A point to swim to (a finger, the pointer), in world metres. The farther it is from the head,
 * the harder the throttle, full at `fullAtM`.
 */
export class TargetIntent implements SteeringIntent {
  private x = 0;
  private z = 0;
  private fullAtM = 1;
  private active = false;

  /** The target moved (or appeared). */
  aim(x: number, z: number, fullAtM: number): void {
    if (!Number.isFinite(x) || !Number.isFinite(z) || !(fullAtM > 0)) return;
    this.x = x;
    this.z = z;
    this.fullAtM = fullAtM;
    this.active = true;
  }

  /** The finger lifted: no target any more. */
  release(): void {
    this.active = false;
  }

  steer(headX: number, headZ: number, out: Steering): boolean {
    if (!this.active) return false;
    const dx = this.x - headX;
    const dz = this.z - headZ;
    const distance = Math.hypot(dx, dz);
    out.throttle = throttleFor(distance, this.fullAtM);
    if (distance > 1e-6) out.heading = Math.atan2(dz, dx);
    return true;
  }
}

/** A direction held (the arrow keys): full throttle that way. */
export class HeadingIntent implements SteeringIntent {
  private heading = 0;
  private active = false;

  hold(dx: number, dz: number): void {
    if (!Number.isFinite(dx) || !Number.isFinite(dz) || (dx === 0 && dz === 0)) {
      this.active = false;
      return;
    }
    this.heading = Math.atan2(dz, dx);
    this.active = true;
  }

  steer(_headX: number, _headZ: number, out: Steering): boolean {
    if (!this.active) return false;
    out.heading = this.heading;
    out.throttle = 1;
    return true;
  }
}

/** The first of several intents that asks anything (the finger wins over the keys). */
export class FirstIntent implements SteeringIntent {
  constructor(private readonly intents: readonly SteeringIntent[]) {}

  steer(headX: number, headZ: number, out: Steering): boolean {
    for (const intent of this.intents) if (intent.steer(headX, headZ, out)) return true;
    return false;
  }
}
