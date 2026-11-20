import { describe, expect, test } from 'vitest';
import { Hero } from '../../../src/logic/hero/Hero';
import type { HitEvent, TakedownBeatEvent } from '../../../src/logic/hunt/HuntEvents';
import { TargetIntent } from '../../../src/logic/input/Steering';
import { SeededRandom } from '../../../src/logic/SeededRandom';
import { GridProbe } from '../../../src/logic/sand/GridProbe';
import { GridSurface } from '../../../src/logic/sand/GridSurface';
import { SprayPool } from '../../../src/logic/sand/SprayPool';
import { TerrainBuilder } from '../../../src/logic/sand/TerrainBuilder';
import { DIGGING } from '../../../src/rules/digging';
import { Element } from '../../../src/rules/elements';
import { HERO_BODY } from '../../../src/rules/swimming';
import { DuneProfile } from '../../../src/rules/terrain';
import { EXIT_GROUND, onExitRock } from '../../../src/rules/terrainTraps';
import { ARENA, gridMeasures, STEP_SECONDS } from '../../../src/rules/world';
import { arena, wave } from '../arena';

const MEASURES = gridMeasures('standard');
const { cellM, columns } = MEASURES;
const RIGHT_ROCK = ARENA.widthM - EXIT_GROUND.widthM;

/** A desert and a hero in it, stepped together. */
function desert(seed: number, start: { x: number; depth: number }) {
  const seeds = new SeededRandom(seed);
  const random = seeds.fork();
  const profile = new DuneProfile(seeds.fork());
  const grid = new TerrainBuilder(MEASURES, profile).build(seeds.fork());
  const spray = new SprayPool(DIGGING.sprayMax, MEASURES, seeds.fork());
  const surface = new GridSurface(grid, MEASURES);
  const hero = new Hero(
    {
      grid,
      measures: MEASURES,
      spray,
      random: seeds.fork(),
      probe: new GridProbe(grid, MEASURES),
      surface,
    },
    { x: start.x, z: profile.height(start.x) - start.depth, heading: Math.PI },
    STEP_SECONDS,
  );
  const target = new TargetIntent();
  const step = (x: number, z: number) => {
    target.aim(x, z, 9);
    hero.step(target);
    spray.step(STEP_SECONDS, grid);
    grid.simulate(random);
  };
  const sand = () => grid.count(Element.Sand) + spray.airborne + hero.carriedGrains;
  return { grid, surface, hero, step, sand };
}

describe('The rock under the exit gates: no trap forms there', () => {
  test('it lies within its width of either gate, and nowhere between', () => {
    expect(onExitRock(0.1)).toBe(true);
    expect(onExitRock(EXIT_GROUND.widthM - 0.1)).toBe(true);
    expect(onExitRock(EXIT_GROUND.widthM + 0.1)).toBe(false);
    expect(onExitRock(ARENA.widthM / 2)).toBe(false);
    expect(onExitRock(RIGHT_ROCK + 0.1)).toBe(true);
    expect(onExitRock(Number.NaN)).toBe(false);
  });

  test('under each gate the ground is rock from the dunes’ top down to the bedrock', () => {
    const { grid } = desert(5, { x: 40, depth: 6 });
    for (let column = 0; column < columns; column++) {
      const x = (column + 0.5) * cellM;
      const top = grid.surfaceRow(column);
      const element = grid.elementAt(grid.index(column, top));
      if (!onExitRock(x)) {
        expect(element).toBe(Element.Sand);
        continue;
      }
      for (let row = top; row < grid.height; row++) {
        expect(grid.elementAt(grid.index(column, row))).toBe(Element.Rock);
      }
    }
  });

  test('a shallow pass toward an exit lowers nothing on its rock; inside, the ground still caves in', () => {
    const world = desert(6, { x: 44, depth: 2 });
    const rockTops = () =>
      Array.from({ length: Math.round(EXIT_GROUND.widthM / cellM) }, (_, column) =>
        world.grid.surfaceRow(column),
      );
    const meanTop = () => {
      let sum = 0;
      for (let x = 16; x <= 36; x += 0.5) sum += world.surface.heightAt(x);
      return sum / 41;
    };
    const tops = rockTops();
    const inside = meanTop();
    const sand = world.sand();
    let leftmost = Infinity;
    // Just under the dunes toward the left gate, on against the rock for 5 s, then deep and away.
    for (let i = 0; i < 60 * 9; i++) {
      const x = world.hero.x - 6;
      world.step(x, world.surface.heightAt(x) - 2);
      leftmost = Math.min(leftmost, world.hero.x);
    }
    for (let i = 0; i < 60 * 4; i++) world.step(60, -26);
    // He never got onto the rock: it is a wall to him.
    expect(leftmost).toBeGreaterThanOrEqual(EXIT_GROUND.widthM + HERO_BODY.radiusM);
    expect(rockTops()).toEqual(tops);
    expect(inside - meanTop()).toBeGreaterThan(0.3);
    expect(world.sand()).toBe(sand);
  });

  test('a truck fleeing to an exit never falls at it, whatever is dug there', () => {
    const world = arena(43);
    const beats: TakedownBeatEvent[] = [];
    const falls: HitEvent[] = [];
    world.events.on('takedownBeat', (event) => beats.push(event));
    world.events.on('hit', (event) => {
      if (event.kind === 'fall') falls.push(event);
    });
    world.fleet.sendWave(wave({ machines: ['hauler'], x: 112, panic: ['sonar'] }), 0);
    // Try to open a 4 m pit under the right gate: it is rock, nothing comes out.
    const { grid } = world;
    const sandBefore = grid.count(Element.Sand);
    for (let column = Math.ceil(RIGHT_ROCK / cellM); column < columns; column++) {
      const top = grid.surfaceRow(column);
      for (let row = top; row < top + Math.round(4 / cellM); row++) {
        const i = grid.index(column, row);
        if (grid.elementAt(i) === Element.Sand) grid.clear(i);
      }
    }
    expect(grid.count(Element.Sand)).toBe(sandBefore);
    world.events.emit('spotted', { droneId: 1000, x: 0, z: 0 });
    for (let i = 0; i < 60 * 20 && world.fleet.escapedCount === 0; i++) world.tick();
    expect(world.fleet.escapedCount).toBe(1);
    expect(beats).toEqual([]);
    expect(falls).toEqual([]);
  });
});
