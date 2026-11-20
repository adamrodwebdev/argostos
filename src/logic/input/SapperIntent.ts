import { ARENA } from '../../rules/world';
import type { Hunt } from '../hunt/Hunt';
import type { Truck } from '../truck/Truck';
import type { Autopilot } from './AutopilotIntent';
import { TargetIntent, type Steering } from './Steering';
import { UnderminingRun } from './Undermining';

/** The pit opens this far ahead of the truck's front (m), and spans this much either side. */
const PIT_AHEAD_M = 40;
const PIT_HALF_M = 6;
/** The pit keeps this far from a standing tower (m) and from the arena's exits. */
const TOWER_CLEAR_M = 16;
const EDGE_M = 30;
/** It digs until the pit is this deep (m), and goes on under a truck driving over it. */
const PIT_DEPTH_M = 3.6;
/** Where it waits for the fall: just past the pit, deep under it (m), so the pit is in view. */
const WAIT_PAST_M = 5;
const WAIT_DEPTH_M = 12;
/** With no truck, it waits mid-arena this deep (m). */
const IDLE_Z = -18;
const FULL_AT_M = 9;

/**
 * A bot that only digs (`?autopilot=1&bot=sapper`), to watch the moving ground take the
 * Company's trucks: it opens a pit in the way of the nearest truck with shallow passes (and goes
 * on under the truck when it comes over the pit before it is deep), waits deep past the pit for
 * the truck to drive in, undermines a truck stuck in it, and opens a new pit ahead of a truck
 * that got across. It never bites or acts. For films
 * of the fall and for the terrain's tests in the real game; deterministic.
 */
export class SapperIntent implements Autopilot {
  private readonly target = new TargetIntent();
  private readonly undermining: UnderminingRun;
  private truckId = -1;
  private pitX = 0;
  private pitTop = 0;

  constructor(
    private readonly hunt: Hunt,
    stepSeconds: number,
  ) {
    this.undermining = new UnderminingRun(hunt.surface, stepSeconds);
  }

  act(): void {
    // A sapper only digs.
  }

  steer(headX: number, headZ: number, out: Steering): boolean {
    const truck = this.quarry();
    const head = { x: headX, z: headZ };
    if (!truck) {
      this.target.aim(ARENA.widthM / 2, IDLE_Z, FULL_AT_M);
    } else if (truck.rig.stuck) {
      // Stuck in the pit: the sand under it goes too.
      const middle = (truck.rig.rearX + truck.rig.frontX) / 2;
      const way = truck.rig.direction;
      this.undermining.aim({ from: middle - way * 12, to: middle + way * 3 }, head, this.target);
    } else if (this.pitDepth() < PIT_DEPTH_M) {
      const span = { from: this.pitX - PIT_HALF_M, to: this.pitX + PIT_HALF_M };
      this.undermining.aim(span, head, this.target);
    } else {
      const x = this.pitX + truck.rig.direction * (PIT_HALF_M + WAIT_PAST_M);
      this.target.aim(x, this.pitTop - WAIT_DEPTH_M, FULL_AT_M);
    }
    return this.target.steer(headX, headZ, out);
  }

  /** How deep the pit is now (m, from the sand's top there when it chose it). */
  private pitDepth(): number {
    return this.pitTop - this.hunt.surface.heightAt(this.pitX);
  }

  /**
   * The truck it works on: the one it chose while it drives (with a new pit once it got across
   * the last), else the nearest driving one.
   */
  private quarry(): Truck | null {
    const { trucks, hero } = this.hunt;
    const kept = trucks.find((truck) => truck.id === this.truckId && truck.isDriving);
    if (kept) {
      if (this.across(kept)) this.choose(kept);
      return kept;
    }
    let best: Truck | null = null;
    for (const truck of trucks) {
      if (!truck.isDriving || !truck.hittable) continue;
      if (!best || Math.abs(truck.rig.frontX - hero.x) < Math.abs(best.rig.frontX - hero.x)) {
        best = truck;
      }
    }
    if (best) this.choose(best);
    return best;
  }

  /** A new pit for `truck`: ahead of it, clear of the towers and the exits. */
  private choose(truck: Truck): void {
    this.truckId = truck.id;
    const way = truck.rig.direction;
    let x = truck.rig.frontX + way * PIT_AHEAD_M;
    for (const tower of this.hunt.towerList) {
      if (tower.isStanding && Math.abs(tower.x - x) < TOWER_CLEAR_M) {
        x = tower.x + way * TOWER_CLEAR_M;
      }
    }
    this.pitX = Math.min(ARENA.widthM - EDGE_M, Math.max(EDGE_M, x));
    this.pitTop = this.hunt.surface.heightAt(this.pitX);
    this.undermining.restart();
  }

  /** The truck's rear got past the pit's far edge (it drove across, or turned away from it). */
  private across(truck: Truck): boolean {
    const way = truck.rig.direction;
    const rearPast = (truck.rig.rearX - (this.pitX + way * PIT_HALF_M)) * way > 0;
    const turnedAway = (this.pitX - truck.rig.frontX) * way < -PIT_HALF_M * 2;
    return rearPast || turnedAway;
  }
}
