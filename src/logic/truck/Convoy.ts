import type { PanicCause } from '../../rules/hunts';
import { PATROL_MARGIN_M } from '../../rules/hunts';
import type { Box, Truck } from './Truck';

/**
 * A convoy (one truck or several, driving in file): it patrols the arena, turning back before
 * the exits, all its trucks together so they never drive into one another. Alarmed by what its
 * row says (a drone hearing the hero, one of it being hit), it flees for the exit ahead: a
 * truck that drives out got away. A stalled or glass-held truck stands still.
 */
export class Convoy {
  private fleeing = false;
  private turning = false;
  private cause: PanicCause | null = null;
  private readonly box: Box = { left: 0, right: 0, bottom: 0, top: 0 };

  constructor(
    readonly id: number,
    readonly trucks: readonly Truck[],
    private readonly panicsOn: ReadonlySet<PanicCause>,
  ) {}

  /** Running for an exit. */
  get isFleeing(): boolean {
    return this.fleeing;
  }

  /** Why it ran (null while it patrols). */
  get panicCause(): PanicCause | null {
    return this.cause;
  }

  /** Every truck of it is gone (taken, or out of the arena). */
  get isOver(): boolean {
    return this.trucks.every((truck) => truck.isGone);
  }

  /** True when it panics on `cause`: then it flees (once). */
  alarms(cause: PanicCause): boolean {
    return this.panicsOn.has(cause);
  }

  /** It runs for the exit ahead (when its row says this cause alarms it). */
  panic(cause: PanicCause): void {
    if (this.fleeing || !this.panicsOn.has(cause)) return;
    this.fleeing = true;
    this.turning = false;
    this.cause = cause;
    for (const truck of this.trucks) truck.run();
  }

  /** One step: every truck of it drives at the speed its state asks. */
  drive(arenaWidthM: number, dt: number): void {
    if (!this.fleeing) this.patrol(arenaWidthM);
    const all = this.turning && this.allStopped();
    for (const truck of this.trucks) {
      if (!truck.isDriving) continue;
      if (all) truck.rig.turnAround();
      truck.rig.step(this.speedFor(truck), dt);
    }
    if (all) this.turning = false;
  }

  private speedFor(truck: Truck): number {
    if (truck.isStalled || truck.isTrapped || this.turning) return 0;
    return this.fleeing ? truck.row.fleeSpeed : truck.row.cruiseSpeed;
  }

  /** The lead (the truck farthest along the way) nears an exit: the convoy stops to turn. */
  private patrol(arenaWidthM: number): void {
    if (this.turning) return;
    const lead = this.lead();
    if (!lead) return;
    lead.bodyBox(this.box);
    const way = lead.rig.direction;
    const nearExit =
      way === 1 ? this.box.right > arenaWidthM - PATROL_MARGIN_M : this.box.left < PATROL_MARGIN_M;
    // Coming in from past an exit, it drives in first.
    const inside = way === 1 ? this.box.left > 0 : this.box.right < arenaWidthM;
    if (nearExit && inside) this.turning = true;
  }

  private lead(): Truck | null {
    let lead: Truck | null = null;
    for (const truck of this.trucks) {
      if (!truck.isDriving) continue;
      if (!lead || truck.rig.direction * (truck.rig.rearX - lead.rig.rearX) > 0) lead = truck;
    }
    return lead;
  }

  private allStopped(): boolean {
    return this.trucks.every((truck) => !truck.isDriving || Math.abs(truck.rig.speed) <= 0.05);
  }
}
