import { plainDamage } from '../../rules/combat';
import type { DroneRow } from '../../rules/hunts';
import { hears, SONAR } from '../../rules/sonar';
import type { HuntEvents } from '../hunt/HuntEvents';
import type { Combat } from '../machine/Combat';
import { distanceToBox } from '../machine/Target';
import type { SandSurface } from '../sand/GridSurface';
import type { SandThrower } from '../sand/SandThrower';
import type { Box, Jaws } from '../truck/Truck';
import { Drone } from './Drone';

/** What the drones listen to: the hero's head and his noise (0 to 1). */
export interface Heard {
  readonly x: number;
  readonly z: number;
  readonly noise: number;
}

export interface SquadOptions {
  readonly surface: SandSurface;
  readonly events: HuntEvents;
  /** Real sand thrown where a drone crashes. */
  readonly thrower: SandThrower;
  /** A leaping bite takes plate off a drone. */
  readonly combat: Combat;
  readonly stepSeconds: number;
}

/** Ids of drones start here, apart from the trucks'. */
const FIRST_ID = 1000;
/** The jaws close on a drone this close to its body (m). */
const BITE_MARGIN_M = 0.6;
/** Sand thrown where a drone hits the dunes: how wide (m), grains per column, how hard (m/s). */
const CRASH_REACH_M = 1.6;
const CRASH_PER_COLUMN = 3;
const CRASH_UP = 6;

/**
 * The hunt's sonar drones: they patrol, ping the sand, and the first whose rings touch the
 * hero's spots him and follows him; the convoys on the sand then run. The alarm stays up a
 * while, then the drones listen again: a hero who keeps racing keeps being heard. A drone
 * brought down falls and crashes into the sand.
 */
export class DroneSquad {
  private readonly drones: Drone[] = [];
  private readonly box: Box = { left: 0, right: 0, bottom: 0, top: 0 };
  private nextId = FIRST_ID;
  private heard = false;
  private alarmLeft = 0;

  constructor(private readonly options: SquadOptions) {}

  /** The drones over the arena now (read-only: the drawing reads them). */
  get all(): readonly Drone[] {
    return this.drones;
  }

  /** The hero was spotted this hunt (at least once). */
  get spotted(): boolean {
    return this.heard;
  }

  /** A spot's alarm is still up (the drones listen again once it is down). */
  get alarmed(): boolean {
    return this.alarmLeft > 0;
  }

  /** A drone comes over the arena. */
  send(row: DroneRow): void {
    const drone = new Drone(this.nextId++, row, this.options.surface);
    this.drones.push(drone);
    this.options.events.emit('droneArrived', { droneId: drone.id, x: drone.x, z: drone.z });
  }

  /** One step: they fly and listen; a drone the jaws reach (a leap) takes a bite. */
  step(hero: Heard, jaws: Jaws): void {
    const { events, combat, stepSeconds: dt } = this.options;
    this.alarmLeft = Math.max(0, this.alarmLeft - dt);
    for (const drone of this.drones) {
      const wasFlying = drone.isFlying;
      if (drone.isFlying) {
        drone.bodyBox(this.box);
        if (distanceToBox(jaws.x, jaws.z, this.box) <= BITE_MARGIN_M) {
          combat.hit(drone, 'bite', plainDamage('bite'));
        }
      }
      if (drone.fly(hero.x, dt)) this.crash(drone);
      else if (wasFlying && drone.isFalling) {
        events.emit('droneFell', { droneId: drone.id, x: drone.x, z: drone.z });
      }
      if (this.alarmLeft <= 0 && drone.isFlying) this.listen(drone, hero);
    }
    for (let i = this.drones.length - 1; i >= 0; i--) {
      if (this.drones[i]!.isGone) this.drones.splice(i, 1);
    }
  }

  private listen(drone: Drone, hero: Heard): void {
    const distance = Math.hypot(hero.x - drone.x, hero.z - drone.sonarZ);
    if (!hears(distance, hero.noise)) return;
    this.heard = true;
    this.alarmLeft = SONAR.alarmS;
    drone.mark();
    this.options.events.emit('spotted', { droneId: drone.id, x: hero.x, z: hero.z });
  }

  private crash(drone: Drone): void {
    const { events, thrower } = this.options;
    events.emit('droneCrashed', { droneId: drone.id, x: drone.x, z: drone.z });
    events.emit('destroyed', {
      targetId: drone.id,
      machine: drone.machine,
      crystals: drone.row.crystals,
      x: drone.x,
      z: drone.z,
    });
    thrower.throwRim({
      x: drone.x,
      lowestZ: drone.sonarZ - 0.6,
      reachM: CRASH_REACH_M,
      perColumn: CRASH_PER_COLUMN,
      up: CRASH_UP,
      spread: 3,
      carryX: 0,
      carryZ: 0,
    });
  }
}
