import { DRIVE, SUSPENSION, TYRE } from '../../rules/driving';
import { GROUND } from '../../rules/terrainTraps';
import type { TruckGeometry } from '../../rules/truckManifest';
import type { SandSurface } from '../sand/GridSurface';
import { SpringCorner } from './SpringCorner';

/** Which way a truck drives: +1 to the right, −1 to the left. */
export type Direction = 1 | -1;

/** Where a truck starts: its rear hub's x (m) and its way. */
export interface TruckStart {
  readonly x: number;
  readonly direction: Direction;
}

/** How far ahead of the front wheel (m) a truck reads the sand it must climb. */
const CLIMB_LOOK_M = 2.5;
/** A wall rising this much (m) above the front tyre in one step stops the truck dead. */
const WALL_M = 0.6;
const CLIMB_SLOPE = Math.tan((GROUND.climbDeg * Math.PI) / 180);

/**
 * A truck rolling over the moving sand (ported from the sprite test bench): its wheels rest on
 * the highest sand under them and turn by the distance driven, never sliding; its body rides on
 * a spring and a damper at each axle, squats as it pulls away and dives as it brakes. When the
 * sand drops away under a wheel it falls, and lands (`landing`); when the sand ahead rises too
 * steeply it is stuck: it crawls, its wheels spinning in the loose sand.
 */
export class TruckRig {
  private way: Direction;
  private rear: number;
  private front: number;
  private driven = 0;
  private spun = 0;
  private stuckNow = false;
  private bumped = 0;
  private velocity = 0;
  private acceleration = 0;
  private rearTyre: SpringCorner;
  private frontTyre: SpringCorner;
  private rearAxle: SpringCorner;
  private frontAxle: SpringCorner;

  constructor(
    private readonly geometry: TruckGeometry,
    private readonly surface: SandSurface,
    start: TruckStart,
  ) {
    this.way = start.direction;
    this.rear = start.x;
    this.front = start.x + start.direction * geometry.wheelbaseM;
    const rearZ = this.wheelRest(this.rear);
    const frontZ = this.wheelRest(this.front);
    this.rearTyre = new SpringCorner(rearZ, TYRE, GROUND.gravity);
    this.frontTyre = new SpringCorner(frontZ, TYRE, GROUND.gravity);
    this.rearAxle = new SpringCorner(rearZ, SUSPENSION);
    this.frontAxle = new SpringCorner(frontZ, SUSPENSION);
  }

  /** Which way it drives (+1 to the right, −1 to the left). */
  get direction(): Direction {
    return this.way;
  }
  get rearX(): number {
    return this.rear;
  }
  get frontX(): number {
    return this.front;
  }
  /** Speed along its way (m/s). */
  get speed(): number {
    return this.velocity;
  }
  /** How far the wheels have turned (radians): the distance driven, and their spin when stuck. */
  get wheelAngle(): number {
    return (this.driven + this.spun) / this.geometry.wheelRadiusM;
  }
  /** Stuck in the sand ahead, too steep to climb: it crawls, its wheels spinning. */
  get stuck(): boolean {
    return this.stuckNow;
  }
  /** A wheel lost the ground and is falling. */
  get airborne(): boolean {
    return this.rearTyre.airborne || this.frontTyre.airborne;
  }
  /** How hard it landed (a wheel back on the sand) or hit a wall this step (m/s; 0: neither). */
  get landing(): number {
    return Math.max(this.rearTyre.landing, this.frontTyre.landing, this.bumped);
  }
  /** The tilt of the ground under its wheels (radians, nose up positive, whichever its way). */
  get groundTilt(): number {
    return Math.atan2(this.frontTyre.height - this.rearTyre.height, this.geometry.wheelbaseM);
  }
  get rearWheelZ(): number {
    return this.rearTyre.height;
  }
  get frontWheelZ(): number {
    return this.frontTyre.height;
  }
  /** Height of the body's rear hub on its suspension. */
  get rearHubZ(): number {
    return this.rearAxle.height;
  }
  /** The body's tilt in its own frame (radians, nose up positive, whichever way it drives). */
  get pitch(): number {
    return Math.atan2(this.frontAxle.height - this.rearAxle.height, this.geometry.wheelbaseM);
  }

  step(targetSpeed: number, dt: number): void {
    this.stuckNow = this.climbsTooSteep();
    const wanted = this.stuckNow ? Math.min(targetSpeed, GROUND.stuckSpeed) : targetSpeed;
    if (this.stuckNow) {
      // Its wheels turn as fast as it asks, spinning in the loose sand that barely moves it.
      this.spun += Math.max(0, targetSpeed - this.velocity) * dt;
    }
    const dv = Math.max(-DRIVE.brake * dt, Math.min(DRIVE.accel * dt, wanted - this.velocity));
    this.acceleration = dv / dt;
    this.velocity += dv;
    // A wall ahead higher than a wheel can climb: it goes no farther, its wheels spinning.
    const nextFront = this.front + this.way * this.velocity * dt;
    this.bumped = 0;
    if (this.wheelRest(nextFront) - this.frontTyre.height > WALL_M) {
      this.bumped = this.velocity;
      this.velocity = 0;
      this.stuckNow = true;
    }
    this.rear += this.way * this.velocity * dt;
    this.driven += this.velocity * dt;
    const slope = Math.atan2(
      this.frontTyre.height - this.rearTyre.height,
      this.geometry.wheelbaseM,
    );
    this.front = this.rear + this.way * this.geometry.wheelbaseM * Math.cos(slope);
    this.rearTyre.step(this.wheelRest(this.rear), dt);
    this.frontTyre.step(this.wheelRest(this.front), dt);
    // It squats as it pulls away and dives as it brakes.
    const squat = DRIVE.squat * this.acceleration;
    this.rearAxle.step(this.rearTyre.height - squat, dt);
    this.frontAxle.step(this.frontTyre.height + DRIVE.diveShare * squat, dt);
  }

  /**
   * Stopped, it turns round where it stands (in a side view, its body swaps ends): the front
   * axle becomes the rear one. A moving truck must stop first; a call while moving does nothing.
   */
  turnAround(): void {
    if (Math.abs(this.velocity) > 0.05) return;
    this.velocity = 0;
    this.way = this.way === 1 ? -1 : 1;
    [this.rear, this.front] = [this.front, this.rear];
    [this.rearTyre, this.frontTyre] = [this.frontTyre, this.rearTyre];
    [this.rearAxle, this.frontAxle] = [this.frontAxle, this.rearAxle];
  }

  /** It ran into something that does not give (a glass wall): it stops dead. */
  stopDead(): void {
    this.velocity = 0;
  }

  /** The sand ahead of the front wheel rises steeper than it can climb. */
  private climbsTooSteep(): boolean {
    const here = this.surface.heightAt(this.front);
    const ahead = this.surface.heightAt(this.front + this.way * CLIMB_LOOK_M);
    return (ahead - here) / CLIMB_LOOK_M > CLIMB_SLOPE;
  }

  /** A hub rests on the highest sand under its tyre, not on the single point below it. */
  private wheelRest(x: number): number {
    const r = this.geometry.wheelRadiusM;
    const half = (DRIVE.probes - 1) / 2;
    let best = -Infinity;
    for (let i = -half; i <= half; i++) {
      const s = (r * i) / half;
      best = Math.max(best, this.surface.heightAt(x + s) + Math.sqrt(r * r - s * s));
    }
    return best;
  }
}
