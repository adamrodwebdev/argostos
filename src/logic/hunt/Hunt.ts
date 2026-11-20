import { DIGGING } from '../../rules/digging';
import { Element } from '../../rules/elements';
import { CRUISE } from '../../rules/swimming';
import { DuneProfile } from '../../rules/terrain';
import type { TruckGeometry } from '../../rules/truckManifest';
import {
  ARENA,
  gridMeasures,
  STEP_SECONDS,
  type GridDetail,
  type GridMeasures,
} from '../../rules/world';
import { Hero } from '../hero/Hero';
import { Transition } from '../hero/HeroMotion';
import type { SteeringIntent } from '../input/Steering';
import { SeededRandom } from '../SeededRandom';
import { GridProbe } from '../sand/GridProbe';
import { GridSurface } from '../sand/GridSurface';
import type { SandGrid } from '../sand/SandGrid';
import { SandThrower } from '../sand/SandThrower';
import { SprayPool } from '../sand/SprayPool';
import { TerrainBuilder } from '../sand/TerrainBuilder';
import { SwallowFromBelow } from '../takedown/SwallowFromBelow';
import { TakedownRegistry } from '../takedown/Takedown';
import { Wreckage } from '../takedown/Wreckage';
import type { Truck } from '../truck/Truck';
import { TruckFleet } from '../truck/TruckFleet';
import type { HuntEvents } from './HuntEvents';

export interface HuntOptions {
  /** The same seed builds the same desert and plays the same hunt for the same steering. */
  readonly seed: number;
  readonly detail: GridDetail;
  readonly truck: TruckGeometry;
  readonly events: HuntEvents;
}

/** How far ahead of the head's centre his jaws close, in body radii. */
const JAW_REACH = 1.6;

/**
 * One hunt in the desert arena: the sand, the hero, the thrown sand and the Company's trucks,
 * stepped together at a fixed rate. It decides everything and draws nothing; it tells the rest
 * of the game what happened through its events.
 */
export class Hunt {
  readonly measures: GridMeasures;
  readonly profile: DuneProfile;
  readonly grid: SandGrid;
  readonly spray: SprayPool;
  readonly surface: GridSurface;
  readonly hero: Hero;
  /** Wheels and panels thrown by takedowns, lying on (and sinking into) the sand. */
  readonly wreckage: Wreckage;
  private readonly fleet: TruckFleet;
  private readonly random: SeededRandom;
  private readonly events: HuntEvents;
  private readonly jaws = { x: 0, z: 0, heading: 0 };
  private steps = 0;

  constructor(options: HuntOptions) {
    const seeds = new SeededRandom(options.seed);
    this.random = seeds.fork();
    this.events = options.events;
    this.measures = gridMeasures(options.detail);
    this.profile = new DuneProfile(seeds.fork());
    this.grid = new TerrainBuilder(this.measures, this.profile).build(seeds.fork());
    this.spray = new SprayPool(DIGGING.sprayMax, this.measures, seeds.fork());
    this.surface = new GridSurface(this.grid, this.measures);
    this.hero = new Hero(
      {
        grid: this.grid,
        measures: this.measures,
        spray: this.spray,
        random: seeds.fork(),
        probe: new GridProbe(this.grid, this.measures),
        surface: this.surface,
      },
      { x: ARENA.widthM * 0.25, z: CRUISE.depthZ, heading: 0 },
      STEP_SECONDS,
    );
    const thrower = new SandThrower(this.grid, this.measures, this.spray, seeds.fork());
    this.wreckage = new Wreckage({
      surface: this.surface,
      thrower,
      minX: 0,
      maxX: ARENA.widthM,
      random: seeds.fork(),
    });
    this.fleet = new TruckFleet({
      geometry: options.truck,
      surface: this.surface,
      arenaWidthM: ARENA.widthM,
      random: seeds.fork(),
      events: options.events,
      stepSeconds: STEP_SECONDS,
      // A new takedown is one more strategy here (and its row in rules/takedowns.ts).
      takedowns: new TakedownRegistry([new SwallowFromBelow()]),
      takedownWorld: {
        wreckage: this.wreckage,
        thrower,
        events: options.events,
        random: seeds.fork(),
        stepSeconds: STEP_SECONDS,
      },
    });
  }

  /** Steps played so far (the hunt's own clock: steps × STEP_SECONDS). */
  get stepCount(): number {
    return this.steps;
  }

  /** The trucks in the arena now. */
  get trucks(): readonly Truck[] {
    return this.fleet.all;
  }

  /** Trucks the hero destroyed this hunt. */
  get swallowedCount(): number {
    return this.fleet.swallowedCount;
  }

  /** Every grain of sand of the hunt: in the grid, carried round the hero, or in flight. */
  sandTotal(): number {
    return this.grid.count(Element.Sand) + this.spray.airborne + this.hero.carriedGrains;
  }

  /** One fixed step of the whole hunt. */
  step(intent: SteeringIntent): void {
    const { hero, events } = this;
    const transition = hero.step(intent);
    if (transition === Transition.Breach) {
      events.emit('breach', { x: hero.x, z: hero.z, speed: hero.speed });
    } else if (transition === Transition.Dive) {
      events.emit('dive', { x: hero.x, z: hero.z, speed: hero.speed });
    }
    this.spray.step(STEP_SECONDS, this.grid);
    this.grid.simulate(this.random);
    const reach = hero.radius * JAW_REACH;
    this.jaws.x = hero.x + Math.cos(hero.heading) * reach;
    this.jaws.z = hero.z + Math.sin(hero.heading) * reach;
    this.jaws.heading = hero.heading;
    this.fleet.step(this.jaws, hero);
    this.wreckage.step(STEP_SECONDS);
    this.steps++;
  }
}
