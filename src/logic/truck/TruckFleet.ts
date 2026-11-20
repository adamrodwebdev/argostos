import { brings, plainDamage } from '../../rules/combat';
import { GROUND, landingDamage, pastLimit } from '../../rules/terrainTraps';
import { CONVOY_SPACING_M, type PanicCause, type WaveRow } from '../../rules/hunts';
import type { TruckGeometry } from '../../rules/truckManifest';
import type { GlassDome } from '../actions/GlassDome';
import type { HuntEvents } from '../hunt/HuntEvents';
import type { Combat } from '../machine/Combat';
import type { SandSurface } from '../sand/GridSurface';
import type { RunningTakedown, TakedownRegistry, TakedownWorld } from '../takedown/Takedown';
import { Convoy } from './Convoy';
import { Truck, type Box, type Jaws } from './Truck';
import { TruckRig } from './TruckRig';

export interface FleetOptions {
  readonly geometry: TruckGeometry;
  readonly surface: SandSurface;
  readonly arenaWidthM: number;
  readonly events: HuntEvents;
  readonly stepSeconds: number;
  readonly takedowns: TakedownRegistry;
  readonly takedownWorld: TakedownWorld;
  readonly combat: Combat;
  /** The glass dome the hero breathes: it holds the trucks inside it. */
  readonly dome: GlassDome;
}

/** The hero's velocity (m/s): his strike comes from it. */
export interface Mover {
  readonly velocityX: number;
  readonly velocityZ: number;
}

/** The jaws close on what lies this close to them (m), around the truck's body. */
const BITE_MARGIN_M = 0.6;

/**
 * The Company's trucks in the arena, in convoys sent by the hunt's director. They patrol, flee
 * when alarmed, take hits, and are caught by the hero's jaws: a bite that brings a truck to zero
 * (or finds it stalled there) plays the takedown the registry picks; a bite that does not takes
 * plate off. The moving ground hurts them too: a hard landing in a pit takes plate off, and a
 * truck that tips past its limit, lands very hard, or is finished by its landing falls (the fall
 * takedown). A truck that drives out of the arena got away.
 */
export class TruckFleet {
  private readonly trucks: Truck[] = [];
  private readonly convoys: Convoy[] = [];
  private readonly takedowns = new Map<number, RunningTakedown>();
  private readonly away = new Set<number>();
  private readonly box: Box = { left: 0, right: 0, bottom: 0, top: 0 };
  private nextId = 1;
  private eaten = 0;
  private escapedFrom: Convoy | null = null;
  private allSent = false;

  constructor(private readonly options: FleetOptions) {
    options.events.on('hit', ({ waveId }) => {
      this.panicConvoy(waveId, 'attack');
    });
    options.events.on('spotted', () => {
      for (const convoy of this.convoys) this.panic(convoy, 'sonar');
    });
  }

  /** The trucks in the arena now (read-only: the drawing reads them). */
  get all(): readonly Truck[] {
    return this.trucks;
  }

  /** Trucks destroyed this hunt. */
  get swallowedCount(): number {
    return this.eaten;
  }

  /** Trucks that got away this hunt. */
  get escapedCount(): number {
    return this.away.size;
  }

  /** The convoy the first truck that got away belonged to (null: none got away). */
  get firstEscape(): Convoy | null {
    return this.escapedFrom;
  }

  /** No truck left: none on the sand, none in a takedown. */
  get isClear(): boolean {
    return this.trucks.length === 0;
  }

  /** The director sent its last convoy: the last truck standing is the hunt's last prey. */
  lastWaveSent(): void {
    this.allSent = true;
  }

  /** A convoy drives in: its lead where the row says, the others in file behind it. */
  sendWave(wave: WaveRow, waveId: number): void {
    const { geometry, surface, events } = this.options;
    const trucks: Truck[] = [];
    wave.machines.forEach((machine, place) => {
      const x = wave.x - wave.heading * place * CONVOY_SPACING_M;
      const rig = new TruckRig(geometry, surface, { x, direction: wave.heading });
      const truck = new Truck({
        id: this.nextId++,
        rig,
        geometry,
        machine,
        waveId,
        arenaWidthM: this.options.arenaWidthM,
      });
      trucks.push(truck);
      this.trucks.push(truck);
      events.emit('truckArrived', { id: truck.id, direction: wave.heading });
    });
    this.convoys.push(new Convoy(waveId, trucks, new Set(wave.panic)));
    events.emit('waveArrived', { waveId, size: trucks.length, direction: wave.heading });
  }

  /** One step: convoys drive, glass holds, the jaws bite, takedowns play, prey may get away. */
  step(jaws: Jaws, hero: Mover): void {
    const { stepSeconds: dt, arenaWidthM, dome } = this.options;
    for (const convoy of this.convoys) convoy.drive(arenaWidthM, dt);
    for (const truck of this.trucks) {
      truck.tick(dt);
      if (truck.isDriving) {
        truck.bodyBox(this.box);
        const held = dome.holds(this.box);
        if (held && !truck.isTrapped) truck.rig.stopDead();
        truck.holdInGlass(held);
        if (this.hasLeft(truck)) {
          this.getAway(truck);
        } else if (truck.hittable && this.groundTakes(truck)) {
          continue;
        } else if (truck.canBeBitten && this.reaches(jaws)) {
          this.bite(truck, jaws, hero);
        }
      } else if (truck.isCaught) {
        this.takedowns.get(truck.id)?.step(jaws);
        if (truck.isGone) this.swallowed(truck, jaws);
      }
    }
    this.removeGone();
  }

  /**
   * The jaws reach a truck. A bite that brings it to zero, or finds it stalled there, plays a
   * takedown when one fits (from below); otherwise the bite takes plate off.
   */
  private bite(truck: Truck, jaws: Jaws, hero: Mover): void {
    const damage = plainDamage('bite');
    if (truck.isStalled || brings(truck.integrity.hp, damage.amount)) {
      const strike = {
        truck,
        cause: 'bite' as const,
        jaws,
        heroVx: hero.velocityX,
        heroVz: hero.velocityZ,
        finale: this.isLastPrey(),
      };
      const strategy = this.options.takedowns.choose(strike);
      if (strategy) {
        this.takedowns.set(truck.id, strategy.begin(strike, this.options.takedownWorld));
        this.panicConvoy(truck.waveId, 'attack');
        return;
      }
    }
    this.options.combat.hit(truck, 'bite', damage);
    truck.restFromBite();
  }

  /**
   * The ground's turn: a truck tipped past its limit, or landed in a pit. A hard landing takes
   * plate off (its number shows); one that finishes it, one very hard, or a tip over: it falls.
   * True when the truck fell (it is no longer on the sand).
   */
  private groundTakes(truck: Truck): boolean {
    const { rig } = truck;
    const landing = rig.landing;
    const damage = landingDamage(landing);
    const falls =
      pastLimit(rig.groundTilt, GROUND.tipDeg) ||
      landing >= GROUND.crashMps ||
      (damage > 0 && brings(truck.integrity.hp, damage));
    if (falls) {
      this.fall(truck, landing);
      return true;
    }
    if (damage > 0) this.options.combat.hit(truck, 'fall', { amount: damage, strong: false });
    return false;
  }

  /** The fall takedown plays: the ground brought it down (the hero's undermining, credited). */
  private fall(truck: Truck, landing: number): void {
    const centre = this.box;
    truck.bodyBox(centre);
    const strike = {
      truck,
      cause: 'fall' as const,
      jaws: { x: (centre.left + centre.right) / 2, z: centre.bottom, heading: 0 },
      heroVx: 0,
      heroVz: landing,
      finale: this.isLastPrey(),
    };
    const strategy = this.options.takedowns.choose(strike);
    if (!strategy) return;
    this.takedowns.set(truck.id, strategy.begin(strike, this.options.takedownWorld));
    this.panicConvoy(truck.waveId, 'attack');
  }

  /** The last truck standing once the director sent every convoy. */
  private isLastPrey(): boolean {
    return this.allSent && this.trucks.filter((truck) => truck.isDriving).length === 1;
  }

  private swallowed(truck: Truck, jaws: Jaws): void {
    const { events } = this.options;
    this.takedowns.delete(truck.id);
    this.eaten++;
    events.emit('truckSwallowed', { id: truck.id, x: jaws.x, z: jaws.z });
    events.emit('destroyed', {
      targetId: truck.id,
      machine: truck.machine,
      crystals: truck.row.crystals,
      x: truck.wreck.x,
      z: truck.wreck.z,
    });
    const convoy = this.convoyOf(truck.waveId);
    if (!convoy?.isOver || convoy.trucks.some((member) => this.away.has(member.id))) return;
    events.emit('convoyCleared', {
      waveId: convoy.id,
      size: convoy.trucks.length,
      inGlass: convoy.trucks.length > 1 && convoy.trucks.every((member) => member.caughtInGlass),
    });
  }

  private getAway(truck: Truck): void {
    truck.leave();
    this.away.add(truck.id);
    this.escapedFrom ??= this.convoyOf(truck.waveId);
    this.options.events.emit('truckLeft', { id: truck.id });
  }

  private panicConvoy(waveId: number, cause: PanicCause): void {
    const convoy = this.convoyOf(waveId);
    if (convoy) this.panic(convoy, cause);
  }

  private panic(convoy: Convoy, cause: PanicCause): void {
    if (convoy.isFleeing || convoy.isOver || !convoy.alarms(cause)) return;
    convoy.panic(cause);
    this.options.events.emit('convoyFled', { waveId: convoy.id, cause });
  }

  private convoyOf(waveId: number): Convoy | null {
    return this.convoys.find((convoy) => convoy.id === waveId) ?? null;
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

  /** It drove right through an exit: its whole body is past the arena's edge. */
  private hasLeft(truck: Truck): boolean {
    const { box } = this;
    return truck.rig.direction === 1 ? box.left > this.options.arenaWidthM : box.right < 0;
  }

  private removeGone(): void {
    for (let i = this.trucks.length - 1; i >= 0; i--) {
      if (this.trucks[i]!.isGone) this.trucks.splice(i, 1);
    }
  }
}
