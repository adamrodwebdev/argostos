import { ARENA } from '../../rules/world';
import type { Hunt } from '../hunt/Hunt';
import type { Box, Truck } from '../truck/Truck';
import { TargetIntent, type Steering, type SteeringIntent } from './Steering';

/** How far from a truck (m, along x) the bot stops stalking and rises to bite. */
const STRIKE_RANGE_M = 7;
/** Depth of the stalk (m) and the height the bot aims at to burst out. */
const STALK_Z = -10;
const STRIKE_Z = 9;
/** Finger distance for full throttle (m). */
const FULL_AT_M = 9;

/**
 * A bot that hunts on its own (`?autopilot=1`): it stalks the truck from below and bursts out
 * under it, and sweeps the arena when there is none. It drives the frame-time measurements and
 * the smoke test with real digging, breaches and bites. Deterministic: it reads only the hunt.
 */
export class AutopilotIntent implements SteeringIntent {
  private readonly target = new TargetIntent();
  private readonly box: Box = { left: 0, right: 0, bottom: 0, top: 0 };

  constructor(
    private readonly hunt: Hunt,
    private readonly stepSeconds: number,
  ) {}

  steer(headX: number, headZ: number, out: Steering): boolean {
    const prey = this.hunt.trucks.find((truck) => truck.isDriving);
    if (prey) this.stalk(prey, headX);
    else this.sweep();
    return this.target.steer(headX, headZ, out);
  }

  private stalk(prey: Truck, headX: number): void {
    prey.bodyBox(this.box);
    const middle = (this.box.left + this.box.right) / 2 + prey.rig.direction * 2;
    const close = Math.abs(headX - middle) < STRIKE_RANGE_M;
    this.target.aim(middle, close ? STRIKE_Z : STALK_Z, FULL_AT_M);
  }

  private sweep(): void {
    const t = this.hunt.stepCount * this.stepSeconds;
    this.target.aim(
      ARENA.widthM / 2 + ARENA.widthM * 0.4 * Math.sin(t * 0.13),
      -14 + 8 * Math.sin(t * 0.5),
      FULL_AT_M,
    );
  }
}
