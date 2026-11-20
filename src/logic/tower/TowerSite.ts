import { plainDamage } from '../../rules/combat';
import type { TowerRow } from '../../rules/hunts';
import { TAKEDOWNS } from '../../rules/takedowns';
import { TOWER } from '../../rules/terrainTraps';
import type { HuntEvents, TakedownBeat } from '../hunt/HuntEvents';
import type { Combat } from '../machine/Combat';
import { distanceToBox } from '../machine/Target';
import type { SandSurface } from '../sand/GridSurface';
import type { SandThrower } from '../sand/SandThrower';
import type { Box, Jaws } from '../truck/Truck';
import { Tower } from './Tower';

export interface TowerSiteOptions {
  readonly surface: SandSurface;
  readonly events: HuntEvents;
  readonly combat: Combat;
  /** Throws the sand where a tower crashes (real grains: they fall back). */
  readonly thrower: SandThrower;
  readonly stepSeconds: number;
}

/** A beat of the fall after the crash: when (s after it) and how hard. */
interface TimedBeat {
  readonly beat: TakedownBeat;
  readonly at: number;
  readonly strength: number;
}

/** Ids of towers start here, apart from the trucks' and the drones'. */
const FIRST_ID = 2000;
/** The jaws close on a tower this close to its mast (m), and rest this long between bites (s). */
const BITE_MARGIN_M = 0.6;
const BITE_REST_S = 0.7;
/** Sand thrown along the mast where it crashes: this many spots, this many grains a column. */
const CRASH_SPOTS = 4;
const CRASH_REACH_M = 2.2;
const CRASH_PER_COLUMN = 3;
const CRASH_UP = 5;

/**
 * The hunt's drilling towers: they stand as the sand lets them, take the hero's hits, and fall
 * (undermined past their limit, or brought to zero) through the beats of the fall takedown,
 * timed by its row from the moment the tower crashes on the dunes: the crash, the steel torn,
 * the pump house's glass, the fuel, the sand closing over it. Buried, it gives its crystals.
 */
export class TowerSite {
  private readonly towers: Tower[] = [];
  private readonly fired = new Map<number, Set<TakedownBeat>>();
  private readonly rests = new Map<number, number>();
  private readonly box: Box = { left: 0, right: 0, bottom: 0, top: 0 };
  private readonly later: readonly TimedBeat[];
  private nextId = FIRST_ID;

  constructor(private readonly options: TowerSiteOptions) {
    const row = TAKEDOWNS.get('fall');
    if (!row) throw new Error('no row for the takedown fall');
    this.later = [
      { beat: 'tear', at: row.wheelsAt, strength: 0.9 },
      { beat: 'shatter', at: row.shatterAt, strength: 0.6 },
      { beat: 'fuel', at: row.fuelAt, strength: 0.8 },
      { beat: 'drag', at: row.dragAt, strength: 0.6 },
    ];
  }

  /** The towers in the arena now (read-only: the drawing reads them). */
  get all(): readonly Tower[] {
    return this.towers;
  }

  /** Towers still standing. */
  get standingCount(): number {
    let n = 0;
    for (const tower of this.towers) if (tower.isStanding) n++;
    return n;
  }

  /** A tower rises in the arena. */
  send(row: TowerRow): void {
    this.towers.push(new Tower(this.nextId++, row.x, this.options.surface));
  }

  /** One step: the towers stand or fall; the jaws bite one they reach. */
  step(jaws: Jaws): void {
    const { stepSeconds: dt } = this.options;
    for (const tower of this.towers) {
      this.bite(tower, jaws, dt);
      const moment = tower.step(dt);
      if (moment === 'topples') this.toppled(tower);
      else if (moment === 'crashes') this.crash(tower);
      else if (moment === 'buried') this.bury(tower);
      if (tower.isDown) this.afterCrash(tower);
    }
    for (let i = this.towers.length - 1; i >= 0; i--) {
      if (this.towers[i]!.isGone) this.towers.splice(i, 1);
    }
  }

  private bite(tower: Tower, jaws: Jaws, dt: number): void {
    const rest = Math.max(0, (this.rests.get(tower.id) ?? 0) - dt);
    this.rests.set(tower.id, rest);
    if (!tower.hittable || rest > 0) return;
    tower.bodyBox(this.box);
    if (distanceToBox(jaws.x, jaws.z, this.box) > BITE_MARGIN_M) return;
    this.options.combat.hit(tower, 'bite', plainDamage('bite'));
    this.rests.set(tower.id, BITE_REST_S);
  }

  private toppled(tower: Tower): void {
    this.options.events.emit('towerToppled', {
      towerId: tower.id,
      way: tower.lean >= 0 ? 1 : -1,
      x: tower.x,
      z: tower.baseZ,
    });
  }

  /** It hits the dunes: the strike of its fall, and the sand thrown up along the mast. */
  private crash(tower: Tower): void {
    this.beat(tower, 'strike', 1);
    const { surface, thrower } = this.options;
    const along = Math.sin(tower.lean);
    for (let k = 1; k <= CRASH_SPOTS; k++) {
      const x = tower.x + along * TOWER.heightM * (k / (CRASH_SPOTS + 0.5));
      thrower.throwRim({
        x,
        lowestZ: surface.heightAt(x) - 1,
        reachM: CRASH_REACH_M,
        perColumn: CRASH_PER_COLUMN,
        up: CRASH_UP,
        spread: 3,
        carryX: along * 1.5,
        carryZ: 0,
      });
    }
  }

  /** The beats after its crash, each once, timed by the fall's row. */
  private afterCrash(tower: Tower): void {
    const time = tower.downSeconds;
    for (const timed of this.later) {
      if (time >= timed.at && !this.has(tower, timed.beat)) {
        this.beat(tower, timed.beat, timed.strength);
      }
    }
  }

  private bury(tower: Tower): void {
    this.beat(tower, 'buried', 0.5);
    this.options.events.emit('destroyed', {
      targetId: tower.id,
      machine: tower.machine,
      crystals: tower.row.crystals,
      x: tower.x,
      z: tower.baseZ,
    });
    this.fired.delete(tower.id);
    this.rests.delete(tower.id);
  }

  private has(tower: Tower, beat: TakedownBeat): boolean {
    return this.fired.get(tower.id)?.has(beat) ?? false;
  }

  /** A beat of its fall, at the middle of its mast (where it lies). */
  private beat(tower: Tower, beat: TakedownBeat, strength: number): void {
    let fired = this.fired.get(tower.id);
    if (!fired) {
      fired = new Set();
      this.fired.set(tower.id, fired);
    }
    fired.add(beat);
    const half = TOWER.heightM / 2;
    this.options.events.emit('takedownBeat', {
      takedown: 'fall',
      beat,
      truckId: tower.id,
      machine: tower.machine,
      x: tower.x + Math.sin(tower.lean) * half,
      z: tower.baseZ + Math.cos(tower.lean) * half,
      strength,
      facing: tower.lean >= 0 ? 1 : -1,
      finale: false,
    });
  }
}
