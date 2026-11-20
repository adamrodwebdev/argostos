import { describe, expect, test } from 'vitest';
import manifestJson from '../../../src/assets/truck/manifest.json';
import { EventBus } from '../../../src/logic/EventBus';
import type { HuntEventMap, TakedownBeat } from '../../../src/logic/hunt/HuntEvents';
import { SeededRandom } from '../../../src/logic/SeededRandom';
import { GridSurface } from '../../../src/logic/sand/GridSurface';
import { SandThrower } from '../../../src/logic/sand/SandThrower';
import { SprayPool } from '../../../src/logic/sand/SprayPool';
import { TerrainBuilder } from '../../../src/logic/sand/TerrainBuilder';
import { SwallowFromBelow } from '../../../src/logic/takedown/SwallowFromBelow';
import { TakedownRegistry, type Strike } from '../../../src/logic/takedown/Takedown';
import { DebrisKind, Wreckage } from '../../../src/logic/takedown/Wreckage';
import { Truck } from '../../../src/logic/truck/Truck';
import { TruckRig } from '../../../src/logic/truck/TruckRig';
import { Element } from '../../../src/rules/elements';
import { DEBRIS, TAKEDOWNS } from '../../../src/rules/takedowns';
import { DuneProfile } from '../../../src/rules/terrain';
import { readTruckManifest } from '../../../src/rules/truckManifest';
import { ARENA, gridMeasures, STEP_SECONDS } from '../../../src/rules/world';

const GEOMETRY = readTruckManifest(manifestJson).geometry;
const MEASURES = gridMeasures('standard');

/** A desert with real sand, a spray pool, wreckage and the takedown's world. */
function arena(seed: number) {
  const seeds = new SeededRandom(seed);
  const grid = new TerrainBuilder(MEASURES, new DuneProfile(seeds.fork())).build(seeds.fork());
  const spray = new SprayPool(2048, MEASURES, seeds.fork());
  const surface = new GridSurface(grid, MEASURES);
  const thrower = new SandThrower(grid, MEASURES, spray, seeds.fork());
  const random = seeds.fork();
  const wreckage = new Wreckage({ surface, thrower, minX: 0, maxX: ARENA.widthM, random });
  const events = new EventBus<HuntEventMap>();
  const sand = () => grid.count(Element.Sand) + spray.airborne;
  const tick = () => {
    wreckage.step(STEP_SECONDS);
    spray.step(STEP_SECONDS, grid);
    grid.simulate(random);
  };
  return { grid, spray, surface, thrower, wreckage, events, random, sand, tick };
}

function strikeOn(truck: Truck, rising: number): Strike {
  return {
    truck,
    jaws: { x: truck.rig.rearX + 3, z: 1, heading: Math.PI / 2 },
    heroVx: 0,
    heroVz: rising,
    finale: false,
  };
}

describe('Wreckage: debris falls, bounces, rolls, settles and sinks', () => {
  test('a wheel dropped on the sand bounces, comes to rest on it, then sinks out of sight', () => {
    const world = arena(1);
    world.wreckage.throwPiece({
      kind: DebrisKind.Wheel,
      x: 80,
      z: 12,
      vx: 4,
      vz: 0,
      angle: 0,
      spin: 0,
      radius: 1.45,
      variant: 0,
      facing: 1,
      burn: 0,
    });
    let rested = false;
    for (let i = 0; i < 60 * 8 && !rested; i++) {
      world.tick();
      rested = world.wreckage.isResting(0);
    }
    expect(rested).toBe(true);
    const ground = world.surface.heightAt(world.wreckage.xs[0]!);
    expect(world.wreckage.zs[0]! - ground).toBeGreaterThan(1.0);
    expect(world.wreckage.zs[0]! - ground).toBeLessThan(1.7);
    for (let i = 0; i < 60 * 20; i++) world.tick();
    expect(world.wreckage.count).toBe(0);
  });

  test('a wheel rolling on the sand turns by the distance it rolls (it does not slide)', () => {
    const world = arena(2);
    const x = 60;
    world.wreckage.throwPiece({
      kind: DebrisKind.Wheel,
      x,
      z: world.surface.heightAt(x) + 1.46,
      vx: 4,
      vz: 0,
      angle: 0,
      spin: 0,
      radius: 1.45,
      variant: 0,
      facing: 1,
      burn: 0,
    });
    for (let i = 0; i < 30; i++) world.tick();
    const rolled = world.wreckage.xs[0]! - x;
    expect(rolled).toBeGreaterThan(1);
    expect(Math.abs(world.wreckage.angles[0]!) * 1.45).toBeCloseTo(rolled, 0);
  });

  test('a hard landing throws sand, and not a grain is made or lost', () => {
    const world = arena(3);
    const before = world.sand();
    world.wreckage.throwPiece({
      kind: DebrisKind.Panel,
      x: 70,
      z: 20,
      vx: 0,
      vz: -12,
      angle: 0,
      spin: 3,
      radius: DEBRIS.panelRadius,
      variant: 1,
      facing: -1,
      burn: 0,
    });
    for (let i = 0; i < 200; i++) world.tick();
    expect(world.wreckage.hardLandings).toBeGreaterThan(0);
    expect(world.sand()).toBe(before);
  });

  test("when full, a new piece takes the oldest one's place", () => {
    const world = arena(4);
    for (let i = 0; i < DEBRIS.max + 3; i++) {
      world.wreckage.throwPiece({
        kind: DebrisKind.Wheel,
        x: 20 + i,
        z: 10,
        vx: 0,
        vz: 0,
        angle: 0,
        spin: 0,
        radius: 1,
        variant: 0,
        facing: 1,
        burn: 0,
      });
    }
    expect(world.wreckage.count).toBe(DEBRIS.max);
  });
});

describe('Takedowns: a strategy per takedown, chosen by the registry', () => {
  test('swallowed from below fits a strike rising into the truck, not one coming down', () => {
    const world = arena(5);
    const truck = new Truck({
      id: 1,
      rig: new TruckRig(GEOMETRY, world.surface, { x: 60, direction: 1 }),
      geometry: GEOMETRY,
      machine: 'hauler',
      waveId: 0,
      arenaWidthM: ARENA.widthM,
    });
    const registry = new TakedownRegistry([new SwallowFromBelow()]);
    expect(registry.choose(strikeOn(truck, 8))?.id).toBe('swallowFromBelow');
    expect(registry.choose(strikeOn(truck, -8))).toBeNull();
  });

  test('its beats come in order, its wheels and panels fly, and the truck is gone at the end', () => {
    const world = arena(6);
    const truck = new Truck({
      id: 7,
      rig: new TruckRig(GEOMETRY, world.surface, { x: 60, direction: -1 }),
      geometry: GEOMETRY,
      machine: 'hauler',
      waveId: 0,
      arenaWidthM: ARENA.widthM,
    });
    const beats: TakedownBeat[] = [];
    world.events.on('takedownBeat', (event) => beats.push(event.beat));
    const run = new SwallowFromBelow().begin(strikeOn(truck, 9), {
      wreckage: world.wreckage,
      thrower: world.thrower,
      events: world.events,
      random: world.random,
      stepSeconds: STEP_SECONDS,
    });
    expect(truck.isCaught).toBe(true);
    const row = TAKEDOWNS.get('swallowFromBelow')!;
    let steps = 0;
    while (!run.done && steps < 600) {
      run.step({ x: 63, z: 1 - steps * 0.05, heading: -Math.PI / 2 });
      world.tick();
      steps++;
    }
    expect(beats).toEqual(['strike', 'tear', 'shatter', 'fuel', 'drag', 'buried']);
    expect(steps).toBeCloseTo(row.endsAt / STEP_SECONDS, -1);
    expect(truck.isGone).toBe(true);
    expect(truck.wreck.wheelsOn).toBe(false);
    expect(truck.wreck.fold).toBe(1);
    expect(truck.wreck.burn).toBeGreaterThan(0.5);
    expect(world.wreckage.count).toBe(2 + row.panels);
  });

  test('the sand it throws up all comes back down: the desert keeps every grain', () => {
    const world = arena(7);
    const before = world.sand();
    const truck = new Truck({
      id: 2,
      rig: new TruckRig(GEOMETRY, world.surface, { x: 90, direction: 1 }),
      geometry: GEOMETRY,
      machine: 'hauler',
      waveId: 0,
      arenaWidthM: ARENA.widthM,
    });
    const run = new SwallowFromBelow().begin(strikeOn(truck, 9), {
      wreckage: world.wreckage,
      thrower: world.thrower,
      events: world.events,
      random: world.random,
      stepSeconds: STEP_SECONDS,
    });
    expect(world.spray.airborne).toBeGreaterThan(20);
    for (let i = 0; i < 60 * 10; i++) {
      run.step({ x: 93, z: 0, heading: 0 });
      world.tick();
    }
    expect(world.sand()).toBe(before);
    expect(world.spray.airborne).toBe(0);
  });
});
