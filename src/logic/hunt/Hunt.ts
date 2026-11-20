import type { ActionId } from '../../rules/combat';
import { DIGGING } from '../../rules/digging';
import { Element } from '../../rules/elements';
import { huntRow, type HuntRow } from '../../rules/hunts';
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
import { BreathAction } from '../actions/BreathAction';
import { GlassDome } from '../actions/GlassDome';
import { ActionRequests, HeroActions, type ActionStrategy } from '../actions/HeroActions';
import { RamAction } from '../actions/RamAction';
import { Rocks } from '../actions/Rocks';
import { StrikeAction } from '../actions/StrikeAction';
import type { Drone } from '../drone/Drone';
import { DroneSquad } from '../drone/DroneSquad';
import { Hero } from '../hero/Hero';
import { Transition } from '../hero/HeroMotion';
import type { SteeringIntent } from '../input/Steering';
import { Combat } from '../machine/Combat';
import { Targets } from '../machine/Targets';
import { SeededRandom } from '../SeededRandom';
import { GridProbe } from '../sand/GridProbe';
import { GridSurface } from '../sand/GridSurface';
import type { SandGrid } from '../sand/SandGrid';
import { SandThrower } from '../sand/SandThrower';
import { SprayPool } from '../sand/SprayPool';
import { TerrainBuilder } from '../sand/TerrainBuilder';
import { SwallowFromBelow } from '../takedown/SwallowFromBelow';
import { TakedownRegistry } from '../takedown/Takedown';
import { TheFall } from '../takedown/TheFall';
import { Wreckage } from '../takedown/Wreckage';
import type { Truck } from '../truck/Truck';
import { TruckFleet } from '../truck/TruckFleet';
import { HuntDirector } from './HuntDirector';
import type { HuntEndedEvent, HuntEvents } from './HuntEvents';
import { HuntStats } from './HuntStats';

export interface HuntOptions {
  /** The same seed builds the same desert and plays the same hunt for the same steering. */
  readonly seed: number;
  readonly detail: GridDetail;
  readonly truck: TruckGeometry;
  readonly events: HuntEvents;
  /** Which hunt (from 1): its row says its convoys, drones and actions. */
  readonly number: number;
}

/** How far ahead of the head's centre his jaws close, in body radii. */
const JAW_REACH = 1.6;
/** Rocks in flight at most. */
const ROCKS = 8;

/**
 * One hunt in the desert arena: the sand, the hero and his actions, the Company's convoys and
 * drones, stepped together at a fixed rate by the hunt's director. It decides everything and
 * draws nothing; it tells the rest of the game what happened through its events.
 */
export class Hunt {
  readonly number: number;
  readonly row: HuntRow;
  readonly measures: GridMeasures;
  readonly profile: DuneProfile;
  readonly grid: SandGrid;
  readonly spray: SprayPool;
  readonly surface: GridSurface;
  readonly hero: Hero;
  /** Wheels and panels thrown by takedowns, lying on (and sinking into) the sand. */
  readonly wreckage: Wreckage;
  readonly dome: GlassDome;
  readonly rocks: Rocks;
  readonly actions: HeroActions;
  readonly breath: BreathAction;
  readonly strike: StrikeAction;
  readonly stats: HuntStats;
  private readonly drones: DroneSquad;
  private readonly fleet: TruckFleet;
  private readonly director: HuntDirector;
  private readonly targets: Targets;
  private readonly requests = new ActionRequests();
  private readonly random: SeededRandom;
  private readonly events: HuntEvents;
  private readonly jaws = { x: 0, z: 0, heading: 0 };
  private steps = 0;

  constructor(options: HuntOptions) {
    const { events } = options;
    const seeds = new SeededRandom(options.seed);
    this.number = options.number;
    this.row = huntRow(options.number);
    this.random = seeds.fork();
    this.events = events;
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
    const combat = new Combat(events);
    this.dome = new GlassDome(ARENA.widthM, events);
    this.fleet = new TruckFleet({
      geometry: options.truck,
      surface: this.surface,
      arenaWidthM: ARENA.widthM,
      events,
      stepSeconds: STEP_SECONDS,
      // A new takedown is one more strategy here (and its row in rules/takedowns.ts).
      takedowns: new TakedownRegistry([new SwallowFromBelow(), new TheFall()]),
      takedownWorld: {
        wreckage: this.wreckage,
        ground: this.surface,
        thrower,
        events,
        random: seeds.fork(),
        stepSeconds: STEP_SECONDS,
      },
      combat,
      dome: this.dome,
    });
    this.drones = new DroneSquad({
      surface: this.surface,
      events,
      thrower,
      combat,
      stepSeconds: STEP_SECONDS,
    });
    this.targets = new Targets([() => this.fleet.all, () => this.drones.all]);
    this.rocks = new Rocks(ROCKS, {
      surface: this.surface,
      targets: this.targets,
      combat,
      events,
      stepSeconds: STEP_SECONDS,
      minX: -20,
      maxX: ARENA.widthM + 20,
      bottomZ: this.measures.bottomZ,
    });
    const acting = { hero: this.hero, targets: this.targets, combat, events };
    this.breath = new BreathAction({ hero: this.hero, dome: this.dome, events });
    this.strike = new StrikeAction({ ...acting, rocks: this.rocks });
    // A new action is one more strategy here (and its row in rules/combat.ts).
    const strategies: readonly ActionStrategy[] = [new RamAction(acting), this.strike, this.breath];
    this.actions = new HeroActions(new Map(strategies.map((s) => [s.id, s])), events);
    this.stats = new HuntStats(events);
    this.director = new HuntDirector({
      row: this.row,
      fleet: this.fleet,
      drones: this.drones,
      actions: this.actions,
      events,
      stepSeconds: STEP_SECONDS,
    });
  }

  /** Steps played so far (the hunt's own clock: steps × STEP_SECONDS). */
  get stepCount(): number {
    return this.steps;
  }

  /** Seconds played in this hunt. */
  get seconds(): number {
    return this.director.seconds;
  }

  /** The trucks in the arena now. */
  get trucks(): readonly Truck[] {
    return this.fleet.all;
  }

  /** The drones over the arena now. */
  get droneList(): readonly Drone[] {
    return this.drones.all;
  }

  /** Trucks the hero destroyed this hunt. */
  get swallowedCount(): number {
    return this.fleet.swallowedCount;
  }

  /** A drone heard the hero this hunt. */
  get spotted(): boolean {
    return this.drones.spotted;
  }

  /** A spot's alarm is up now (the drones listen again once it is down). */
  get alarmed(): boolean {
    return this.drones.alarmed;
  }

  /** The end was told: the end screen shows while the world goes on. */
  get isOver(): boolean {
    return this.director.isOver;
  }

  /** How it ended (null while it plays). */
  get result(): HuntEndedEvent | null {
    return this.director.result;
  }

  /** Every grain of sand of the hunt: in the grid, carried round the hero, or in flight. */
  sandTotal(): number {
    return this.grid.count(Element.Sand) + this.spray.airborne + this.hero.carriedGrains;
  }

  /** The player asks for an action: it is done at the next step, if unlocked and ready. */
  request(action: ActionId): void {
    if (!this.director.isOver) this.requests.request(action);
  }

  /** One fixed step of the whole hunt. */
  step(intent: SteeringIntent): void {
    const { hero, events } = this;
    this.director.step();
    this.targets.refresh();
    this.actions.perform(this.requests);
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
    this.targets.refresh();
    this.actions.step(STEP_SECONDS);
    this.fleet.step(this.jaws, hero);
    this.drones.step(hero, this.jaws);
    this.rocks.step();
    this.dome.step(STEP_SECONDS);
    this.wreckage.step(STEP_SECONDS);
    this.stats.tick(STEP_SECONDS);
    this.steps++;
  }
}
