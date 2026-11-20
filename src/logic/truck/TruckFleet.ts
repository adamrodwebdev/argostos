import { DRIVE, FLEET } from '../../rules/driving';
import type { RandomSource } from '../../rules/random';
import { PREY_PER_HUNT } from '../../rules/takedowns';
import type { TruckGeometry } from '../../rules/truckManifest';
import type { HuntEvents } from '../hunt/HuntEvents';
import type { SandSurface } from '../sand/GridSurface';
import type { RunningTakedown, TakedownRegistry, TakedownWorld } from '../takedown/Takedown';
import { Truck, type Box, type Jaws } from './Truck';
import { TruckRig, type Direction } from './TruckRig';

export interface FleetOptions {
  readonly geometry: TruckGeometry;
  readonly surface: SandSurface;
  readonly arenaWidthM: number;
  readonly random: RandomSource;
  readonly events: HuntEvents;
  readonly stepSeconds: number;
  readonly takedowns: TakedownRegistry;
  readonly takedownWorld: TakedownWorld;
}

/** The hero's velocity (m/s): his strike comes from it. */
export interface Mover {
  readonly velocityX: number;
  readonly velocityZ: number;
}

/** The jaws close on what lies this close to them (m), around the truck's body. */
const BITE_MARGIN_M = 0.6;

/**
 * The Company's trucks in the arena: they drive in from an exit, cross, and drive out by the
 * other. When the hero's jaws reach one, the takedown registry picks how it is destroyed, and
 * the takedown plays out over the next steps. In P1 one truck at a time, the next coming in a
 * few seconds after the last left or was destroyed.
 */
export class TruckFleet {
  private readonly trucks: Truck[] = [];
  private readonly takedowns = new Map<number, RunningTakedown>();
  private readonly box: Box = { left: 0, right: 0, bottom: 0, top: 0 };
  private nextId = 1;
  private wait: number = FLEET.firstSeconds;
  private nextDirection: Direction;
  private eaten = 0;
  private strikes = 0;

  constructor(private readonly options: FleetOptions) {
    this.nextDirection = options.random.next() < 0.5 ? 1 : -1;
  }

  /** The trucks in the arena now (read-only: the drawing reads them). */
  get all(): readonly Truck[] {
    return this.trucks;
  }

  /** Trucks destroyed this hunt. */
  get swallowedCount(): number {
    return this.eaten;
  }

  /** One step: trucks drive, the jaws take those they reach, takedowns play, the next truck comes. */
  step(jaws: Jaws, hero: Mover): void {
    const { stepSeconds: dt, events } = this.options;
    for (const truck of this.trucks) {
      if (truck.isDriving) {
        truck.rig.step(DRIVE.cruiseSpeed, dt);
        truck.bodyBox(this.box);
        if (this.hasLeft(truck)) {
          truck.leave();
          events.emit('truckLeft', { id: truck.id });
        } else if (this.reaches(jaws)) {
          this.strike(truck, jaws, hero);
        }
      } else if (truck.isCaught) {
        const takedown = this.takedowns.get(truck.id);
        takedown?.step(jaws);
        if (truck.isGone) {
          this.takedowns.delete(truck.id);
          this.eaten++;
          events.emit('truckSwallowed', { id: truck.id, x: jaws.x, z: jaws.z });
        }
      }
    }
    this.removeGone();
    if (this.trucks.length === 0) {
      this.wait -= dt;
      if (this.wait <= 0) this.send();
    }
  }

  /** The jaws reached a truck: the first takedown that fits plays (none: the bite misses). */
  private strike(truck: Truck, jaws: Jaws, hero: Mover): void {
    const strike = {
      truck,
      jaws,
      heroVx: hero.velocityX,
      heroVz: hero.velocityZ,
      finale: (this.strikes + 1) % PREY_PER_HUNT === 0,
    };
    const strategy = this.options.takedowns.choose(strike);
    if (!strategy) return;
    this.strikes++;
    this.takedowns.set(truck.id, strategy.begin(strike, this.options.takedownWorld));
  }

  private reaches(jaws: Jaws): boolean {
    const { box } = this;
    return (
      jaws.x > box.left - BITE_MARGIN_M &&
      jaws.x < box.right + BITE_MARGIN_M &&
      jaws.z > box.bottom - BITE_MARGIN_M &&
      jaws.z < box.top + BITE_MARGIN_M
    );
  }

  private hasLeft(truck: Truck): boolean {
    const { box } = this;
    return truck.rig.direction === 1 ? box.left > this.options.arenaWidthM : box.right < 0;
  }

  private removeGone(): void {
    for (let i = this.trucks.length - 1; i >= 0; i--) {
      if (!this.trucks[i]!.isGone) continue;
      this.trucks.splice(i, 1);
      this.wait = FLEET.respawnSeconds;
    }
  }

  /** The next truck drives in by an exit, just outside the arena. */
  private send(): void {
    const { geometry, surface, arenaWidthM, events } = this.options;
    const direction = this.nextDirection;
    this.nextDirection = direction === 1 ? -1 : 1;
    const x = direction === 1 ? -geometry.frameRightM : arenaWidthM + geometry.frameRightM;
    const rig = new TruckRig(geometry, surface, { x, direction });
    const truck = new Truck(this.nextId++, rig, geometry);
    this.trucks.push(truck);
    events.emit('truckArrived', { id: truck.id, direction });
  }
}
