import type { MachineId } from '../../rules/machines';
import type { HuntEvents } from './HuntEvents';

/** Two machines caught this close together (s) were taken in one leap: a double bite. */
const ONE_LEAP_S = 1.5;

/** The experts' stars of a hunt (the mockup's end screen). */
export interface Stars {
  /** Never heard by a drone's sonar. */
  readonly unseen: boolean;
  /** Two machines taken in one leap. */
  readonly doubleBite: boolean;
  /** A convoy taken by the glass alone (every truck of it caught in a dome). */
  readonly glassOnly: boolean;
}

/**
 * What a hunt earned, for its end screen and the session log: crystals, the machines destroyed
 * by kind, and the experts' three stars. It only listens to the hunt's events.
 */
export class HuntStats {
  private gems = 0;
  private readonly fallen = new Map<MachineId, number>();
  private heard = false;
  private double = false;
  private glass = false;
  private clock = 0;
  private lastCatch = Number.NEGATIVE_INFINITY;

  constructor(events: HuntEvents) {
    events.on('destroyed', ({ machine, crystals }) => {
      this.gems += crystals;
      this.fallen.set(machine, (this.fallen.get(machine) ?? 0) + 1);
    });
    events.on('spotted', () => {
      this.heard = true;
    });
    events.on('truckCaught', () => {
      if (this.clock - this.lastCatch <= ONE_LEAP_S) this.double = true;
      this.lastCatch = this.clock;
    });
    events.on('convoyCleared', ({ inGlass }) => {
      if (inGlass) this.glass = true;
    });
  }

  /** Crystals earned this hunt (kept even when it fails). */
  get crystals(): number {
    return this.gems;
  }

  get stars(): Stars {
    return { unseen: !this.heard, doubleBite: this.double, glassOnly: this.glass };
  }

  /** Machines of `machine` destroyed this hunt. */
  destroyed(machine: MachineId): number {
    return this.fallen.get(machine) ?? 0;
  }

  /** The hunt's own clock moved on (`dt` seconds). */
  tick(dt: number): void {
    this.clock += dt;
  }
}
