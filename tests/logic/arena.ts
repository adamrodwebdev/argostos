import manifestJson from '../../src/assets/truck/manifest.json';
import { GlassDome } from '../../src/logic/actions/GlassDome';
import { EventBus } from '../../src/logic/EventBus';
import type { HuntEventMap } from '../../src/logic/hunt/HuntEvents';
import { Combat } from '../../src/logic/machine/Combat';
import { SeededRandom } from '../../src/logic/SeededRandom';
import { GridSurface } from '../../src/logic/sand/GridSurface';
import { SandThrower } from '../../src/logic/sand/SandThrower';
import { SprayPool } from '../../src/logic/sand/SprayPool';
import { TerrainBuilder } from '../../src/logic/sand/TerrainBuilder';
import { SwallowFromBelow } from '../../src/logic/takedown/SwallowFromBelow';
import { TakedownRegistry } from '../../src/logic/takedown/Takedown';
import { Wreckage } from '../../src/logic/takedown/Wreckage';
import type { Box, Jaws, Truck } from '../../src/logic/truck/Truck';
import { TruckFleet } from '../../src/logic/truck/TruckFleet';
import type { WaveRow } from '../../src/rules/hunts';
import { DuneProfile } from '../../src/rules/terrain';
import { readTruckManifest } from '../../src/rules/truckManifest';
import { ARENA, gridMeasures, STEP_SECONDS } from '../../src/rules/world';

export const GEOMETRY = readTruckManifest(manifestJson).geometry;
const MEASURES = gridMeasures('standard');

/** Jaws far below the sand: they bite nothing. */
export const AWAY: Jaws = { x: -50, z: -40, heading: 0 };
/** The hero standing still. */
export const STILL = { velocityX: 0, velocityZ: 0 } as const;

/**
 * A desert with real sand, the combat, a glass dome and a fleet of trucks, for the tests of the
 * convoys, the hits and the takedowns: one `tick()` is one fixed step of all of it.
 */
export function arena(seed: number) {
  const seeds = new SeededRandom(seed);
  const grid = new TerrainBuilder(MEASURES, new DuneProfile(seeds.fork())).build(seeds.fork());
  const spray = new SprayPool(2048, MEASURES, seeds.fork());
  const surface = new GridSurface(grid, MEASURES);
  const thrower = new SandThrower(grid, MEASURES, spray, seeds.fork());
  const random = seeds.fork();
  const wreckage = new Wreckage({ surface, thrower, minX: 0, maxX: ARENA.widthM, random });
  const events = new EventBus<HuntEventMap>();
  const combat = new Combat(events);
  const dome = new GlassDome(ARENA.widthM, events);
  const fleet = new TruckFleet({
    geometry: GEOMETRY,
    surface,
    arenaWidthM: ARENA.widthM,
    events,
    stepSeconds: STEP_SECONDS,
    takedowns: new TakedownRegistry([new SwallowFromBelow()]),
    takedownWorld: { wreckage, thrower, events, random: seeds.fork(), stepSeconds: STEP_SECONDS },
    combat,
    dome,
  });
  const tick = (jaws: Jaws = AWAY, hero: { velocityX: number; velocityZ: number } = STILL) => {
    fleet.step(jaws, hero);
    dome.step(STEP_SECONDS);
    wreckage.step(STEP_SECONDS);
    spray.step(STEP_SECONDS, grid);
    grid.simulate(random);
  };
  return { grid, spray, surface, thrower, wreckage, events, combat, dome, fleet, tick };
}

/** A convoy row: machines, where the lead starts, its way, what makes it flee. */
export function wave(row: Partial<WaveRow> & Pick<WaveRow, 'machines'>): WaveRow {
  return { atS: 0, x: 60, heading: 1, panic: [], ...row };
}

/** Jaws rising into the middle of a truck's body from just under it. */
export function jawsUnder(truck: Truck): Jaws {
  const box: Box = { left: 0, right: 0, bottom: 0, top: 0 };
  truck.bodyBox(box);
  return { x: (box.left + box.right) / 2, z: box.bottom, heading: Math.PI / 2 };
}

/** The hero rising fast (a bite from below). */
export const RISING = { velocityX: 0, velocityZ: 9 } as const;
/** The hero coming down (a pounce from above). */
export const FALLING = { velocityX: 0, velocityZ: -9 } as const;
