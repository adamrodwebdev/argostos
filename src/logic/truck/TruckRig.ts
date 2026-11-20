import { DRIVE, SUSPENSION, TYRE } from '../../rules/driving';
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

/**
 * A truck rolling over the moving sand (ported from the sprite test bench): its wheels rest on
 * the highest sand under them and turn by the distance driven, never sliding; its body rides on
 * a spring and a damper at each axle, squats as it pulls away and dives as it brakes.
 */
export class TruckRig {
  readonly direction: Direction;
  private rear: number;
  private front: number;
  private driven = 0;
  private velocity = 0;
  private acceleration = 0;
  private readonly rearTyre: SpringCorner;
  private readonly frontTyre: SpringCorner;
  private readonly rearAxle: SpringCorner;
  private readonly frontAxle: SpringCorner;

  constructor(
    private readonly geometry: TruckGeometry,
    private readonly surface: SandSurface,
    start: TruckStart,
  ) {
    this.direction = start.direction;
    this.rear = start.x;
    this.front = start.x + start.direction * geometry.wheelbaseM;
    const rearZ = this.wheelRest(this.rear);
    const frontZ = this.wheelRest(this.front);
    this.rearTyre = new SpringCorner(rearZ, TYRE);
    this.frontTyre = new SpringCorner(frontZ, TYRE);
    this.rearAxle = new SpringCorner(rearZ, SUSPENSION);
    this.frontAxle = new SpringCorner(frontZ, SUSPENSION);
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
  /** How far the wheels have turned (radians): the distance driven over the radius. */
  get wheelAngle(): number {
    return this.driven / this.geometry.wheelRadiusM;
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
    const dv = Math.max(-DRIVE.brake * dt, Math.min(DRIVE.accel * dt, targetSpeed - this.velocity));
    this.acceleration = dv / dt;
    this.velocity += dv;
    this.rear += this.direction * this.velocity * dt;
    this.driven += this.velocity * dt;
    const slope = Math.atan2(
      this.frontTyre.height - this.rearTyre.height,
      this.geometry.wheelbaseM,
    );
    this.front = this.rear + this.direction * this.geometry.wheelbaseM * Math.cos(slope);
    this.rearTyre.step(this.wheelRest(this.rear), dt);
    this.frontTyre.step(this.wheelRest(this.front), dt);
    // It squats as it pulls away and dives as it brakes.
    const squat = DRIVE.squat * this.acceleration;
    this.rearAxle.step(this.rearTyre.height - squat, dt);
    this.frontAxle.step(this.frontTyre.height + DRIVE.diveShare * squat, dt);
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
