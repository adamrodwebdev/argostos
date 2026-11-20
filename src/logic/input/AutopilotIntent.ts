import { STRIKE } from '../../rules/combat';
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
/** It breathes a dome over a convoy whose middle is this close (m, along x). */
const DOME_REACH_M = 9;
/** It rams a truck this close (m, along x) while rising under it. */
const RAM_REACH_M = 6;

/**
 * A bot that hunts on its own (`?autopilot=1`): it stalks the nearest truck from below and
 * bursts out under it, breathes a dome over a convoy, rams and strikes once those unlock, and
 * sweeps the arena when nothing is left to hunt. It drives the frame-time measurements and the
 * smoke tests with real digging, hits and takedowns. Deterministic: it reads only the hunt.
 */
export class AutopilotIntent implements SteeringIntent {
  private readonly target = new TargetIntent();
  private readonly box: Box = { left: 0, right: 0, bottom: 0, top: 0 };

  constructor(
    private readonly hunt: Hunt,
    private readonly stepSeconds: number,
  ) {}

  /** Chooses its actions for the next step (called before each step). */
  act(): void {
    const { hunt } = this;
    const prey = this.prey();
    if (!prey) return;
    const { hero, actions } = hunt;
    prey.bodyBox(this.box);
    const near = Math.abs(hero.x - (this.box.left + this.box.right) / 2);
    if (actions.isUnlocked('breath') && hunt.breath.fill >= 1 && near < DOME_REACH_M) {
      const mates = hunt.trucks.filter((truck) => truck.waveId === prey.waveId && truck.isDriving);
      if (mates.length > 1) hunt.request('breath');
    }
    if (actions.isUnlocked('ram') && near < RAM_REACH_M && hero.velocityZ > 3) hunt.request('ram');
    if (actions.isUnlocked('strike')) {
      const drone = hunt.droneList.find((one) => one.isFlying);
      const range = drone ? Math.hypot(drone.x - hero.x, drone.z - hero.z) : Infinity;
      if (range < STRIKE.rockRangeM || near < STRIKE.tailRangeM) hunt.request('strike');
    }
  }

  steer(headX: number, headZ: number, out: Steering): boolean {
    const prey = this.prey();
    if (prey) this.stalk(prey, headX);
    else this.sweep();
    return this.target.steer(headX, headZ, out);
  }

  /** The truck to hunt: the nearest one standing on the sand. */
  private prey(): Truck | null {
    let best: Truck | null = null;
    let bestGap = Infinity;
    for (const truck of this.hunt.trucks) {
      if (!truck.isDriving) continue;
      const gap = Math.abs(truck.rig.rearX - this.hunt.hero.x);
      if (gap < bestGap) {
        bestGap = gap;
        best = truck;
      }
    }
    return best;
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
