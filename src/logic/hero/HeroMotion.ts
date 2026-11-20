import {
  angleBetween,
  approach,
  BREACH,
  CRUISE,
  maxTurnRate,
  speedChange,
  speedFor,
  SWIM,
  turnToward,
  type StepChange,
} from '../../rules/swimming';
import type { Steering, SteeringIntent } from '../input/Steering';
import type { SandSurface } from '../sand/GridSurface';
import { Feel, type GridProbe } from '../sand/GridProbe';

export type Medium = 'sand' | 'air';

/** What one step of motion did, for the hunt to tell the others. */
export const Transition = {
  None: 0,
  /** The head burst out of the sand (jaillir). */
  Breach: 1,
  /** The head plunged back in. */
  Dive: 2,
} as const;
export type TransitionId = (typeof Transition)[keyof typeof Transition];

/** Where the head may go. */
export interface HeroBounds {
  readonly minX: number;
  readonly maxX: number;
  /** The lowest the head may go: the bedrock's top plus the body's radius. */
  readonly floorZ: number;
}

export interface HeroMotionOptions {
  readonly x: number;
  readonly z: number;
  readonly heading: number;
  /** The head's radius (m): the medium is felt just beyond it. */
  readonly radiusM: number;
  /** The grid's cell (m). */
  readonly cellM: number;
  readonly bounds: HeroBounds;
  readonly probe: GridProbe;
  readonly surface: SandSurface;
  readonly stepSeconds: number;
}

/** Angles (from the heading) of the points where the head feels what is ahead of it. */
const FEELERS = Float64Array.from([-1.05, -0.52, 0, 0.52, 1.05]);
/** Open points among them that mean "the head is meeting the air". */
const OPEN_AHEAD = 3;
/** Grains among them that mean "the head is back in the sand". */
const GRAINS_AHEAD = 2;

/**
 * The hero's head: where it is, where it heads, how fast, and whether it is in the sand or in
 * the air. In the sand he swims toward the player's target with weight (a turning circle,
 * acceleration and braking); a fast rise bursts out of the sand into a leap under gravity, a
 * slow one levels off just under the surface. The body follows the head's path (`HeroBody`).
 */
export class HeroMotion {
  private headX: number;
  private headZ: number;
  private headHeading: number;
  private headSpeed: number = SWIM.cruiseSpeed;
  private vx = 0;
  private vz = 0;
  private where: Medium = 'sand';
  private readonly steering: Steering = { heading: 0, throttle: 0 };
  private readonly change: StepChange;
  private readonly dt: number;
  private readonly feelRadius: number;

  constructor(private readonly options: HeroMotionOptions) {
    this.headX = options.x;
    this.headZ = options.z;
    this.headHeading = options.heading;
    this.dt = options.stepSeconds;
    this.change = speedChange(options.stepSeconds);
    this.feelRadius = options.radiusM + options.cellM * 1.5;
  }

  get x(): number {
    return this.headX;
  }
  get z(): number {
    return this.headZ;
  }
  /** Where the head points (radians, 0 to the right, counter-clockwise, z up). */
  get heading(): number {
    return this.headHeading;
  }
  get speed(): number {
    return this.headSpeed;
  }
  get velocityX(): number {
    return this.vx;
  }
  get velocityZ(): number {
    return this.vz;
  }
  get medium(): Medium {
    return this.where;
  }

  /** One fixed step: steer, move, and say whether the head left or met the sand. */
  step(intent: SteeringIntent): TransitionId {
    const asked = intent.steer(this.headX, this.headZ, this.steering);
    return this.where === 'sand' ? this.swim(asked) : this.fly(asked);
  }

  private swim(asked: boolean): TransitionId {
    const target = asked ? speedFor(this.steering.throttle) : SWIM.cruiseSpeed;
    const desired = this.keepInside(asked ? this.steering.heading : this.cruiseHeading());
    this.headSpeed = approach(this.headSpeed, target, this.change);
    this.headHeading = wrap(
      turnToward(this.headHeading, desired, maxTurnRate(this.headSpeed) * this.dt),
    );
    let vx = Math.cos(this.headHeading) * this.headSpeed;
    let vz = Math.sin(this.headHeading) * this.headSpeed;
    let transition: TransitionId = Transition.None;
    if (vz > 0 && this.countAhead(this.headHeading, Feel.Open) >= OPEN_AHEAD) {
      if (vz >= BREACH.minUpSpeed) {
        // Jaillir: the burst out of the sand.
        this.where = 'air';
        vx *= BREACH.boost;
        vz *= BREACH.boost;
        this.headSpeed = Math.hypot(vx, vz);
        transition = Transition.Breach;
      } else {
        // Too slow to burst out: he levels off and skims, his back just out of the sand.
        const level = Math.cos(this.headHeading) >= 0 ? 0 : Math.PI;
        const lift = angleBetween(level, this.headHeading);
        const cap = level === 0 ? BREACH.skimAngle : -BREACH.skimAngle;
        if (Math.abs(lift) > BREACH.skimAngle) this.headHeading = wrap(level + cap);
        vx = Math.cos(this.headHeading) * this.headSpeed;
        vz = -BREACH.skimSink;
      }
    }
    this.move(vx, vz);
    return transition;
  }

  private fly(asked: boolean): TransitionId {
    let vx = this.vx;
    let vz = this.vz - BREACH.gravity * this.dt;
    let speed = Math.hypot(vx, vz);
    if (asked && speed > 0) {
      const course = turnToward(
        Math.atan2(vz, vx),
        this.steering.heading,
        BREACH.airTurnRate * this.dt,
      );
      vx = Math.cos(course) * speed;
      vz = Math.sin(course) * speed;
    }
    let transition: TransitionId = Transition.None;
    const course = Math.atan2(vz, vx);
    if (vz < 0 && this.countAhead(course, Feel.Grain) >= GRAINS_AHEAD) {
      // The plunge back into the sand costs a little speed.
      this.where = 'sand';
      speed *= BREACH.entryKeep;
      vx = Math.cos(course) * speed;
      vz = Math.sin(course) * speed;
      transition = Transition.Dive;
    }
    this.headHeading = course;
    this.headSpeed = speed;
    this.move(vx, vz);
    return transition;
  }

  /** Moves the head, kept off the walls and the bedrock (which turn him along them). */
  private move(vx: number, vz: number): void {
    const { minX, maxX, floorZ } = this.options.bounds;
    let x = this.headX + vx * this.dt;
    let z = this.headZ + vz * this.dt;
    let stopped = false;
    if (x < minX || x > maxX) {
      x = Math.min(maxX, Math.max(minX, x));
      vx = -vx * 0.3;
      stopped = true;
    }
    if (z < floorZ) {
      z = floorZ;
      vz = Math.max(0, vz);
      stopped = true;
    }
    this.headX = x;
    this.headZ = z;
    this.vx = vx;
    this.vz = vz;
    if (stopped && (vx !== 0 || vz !== 0)) {
      this.headHeading = Math.atan2(vz, vx);
      this.headSpeed = Math.hypot(vx, vz);
    }
  }

  /**
   * Feels the points on an arc just ahead of the head: how many hold `kind`. Open points count
   * only above the sand's surface, so a hollow under the dunes is never taken for the sky.
   */
  private countAhead(course: number, kind: typeof Feel.Open | typeof Feel.Grain): number {
    const { probe, surface } = this.options;
    let n = 0;
    for (const angle of FEELERS) {
      const a = course + angle;
      const px = this.headX + Math.cos(a) * this.feelRadius;
      const pz = this.headZ + Math.sin(a) * this.feelRadius;
      const felt = probe.feel(px, pz);
      if (felt !== kind) continue;
      if (kind === Feel.Open && pz < surface.heightAt(px) - this.options.cellM) continue;
      n++;
    }
    return n;
  }

  /** With nobody steering: on along his way, levelling toward the cruise depth. */
  private cruiseHeading(): number {
    const tilt = Math.max(
      -CRUISE.levelMax,
      Math.min(CRUISE.levelMax, (CRUISE.depthZ - this.headZ) * CRUISE.levelGain),
    );
    return Math.cos(this.headHeading) >= 0 ? tilt : Math.PI - tilt;
  }

  /** Turns a wish away from the walls and the bedrock before he reaches them. */
  private keepInside(desired: number): number {
    const { minX, maxX, floorZ } = this.options.bounds;
    let dx = Math.cos(desired);
    let dz = Math.sin(desired);
    if (this.headX < minX + CRUISE.wallMarginM && dx < 0) dx = -dx;
    if (this.headX > maxX - CRUISE.wallMarginM && dx > 0) dx = -dx;
    if (this.headZ < floorZ + CRUISE.floorMarginM && dz < 0) dz = -dz;
    return Math.atan2(dz, dx);
  }
}

/** An angle brought back into (−π, π]. */
function wrap(angle: number): number {
  return angleBetween(0, angle);
}
