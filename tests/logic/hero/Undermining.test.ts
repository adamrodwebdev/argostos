import { describe, expect, test } from 'vitest';
import { DIGGING } from '../../../src/rules/digging';
import { Element } from '../../../src/rules/elements';
import { DuneProfile } from '../../../src/rules/terrain';
import { layBackShare, UNDERMINING } from '../../../src/rules/terrainTraps';
import { gridMeasures, STEP_SECONDS } from '../../../src/rules/world';
import { Hero, type HeroStart } from '../../../src/logic/hero/Hero';
import { TargetIntent } from '../../../src/logic/input/Steering';
import { SeededRandom } from '../../../src/logic/SeededRandom';
import { GridProbe } from '../../../src/logic/sand/GridProbe';
import { GridSurface } from '../../../src/logic/sand/GridSurface';
import { SprayPool } from '../../../src/logic/sand/SprayPool';
import { TerrainBuilder } from '../../../src/logic/sand/TerrainBuilder';

const MEASURES = gridMeasures('standard');

function desert(seed: number, start: HeroStart) {
  const seeds = new SeededRandom(seed);
  const random = seeds.fork();
  const profile = new DuneProfile(seeds.fork());
  const grid = new TerrainBuilder(MEASURES, profile).build(seeds.fork());
  const spray = new SprayPool(DIGGING.sprayMax, MEASURES, seeds.fork());
  const surface = new GridSurface(grid, MEASURES);
  const world = {
    grid,
    measures: MEASURES,
    spray,
    random: seeds.fork(),
    probe: new GridProbe(grid, MEASURES),
    surface,
  };
  const hero = new Hero(world, start, STEP_SECONDS);
  const step = (intent: TargetIntent) => {
    hero.step(intent);
    spray.step(STEP_SECONDS, grid);
    grid.simulate(random);
  };
  const sand = () => grid.count(Element.Sand) + spray.airborne + hero.carriedGrains;
  /** The sand's mean height (m) over [from, to]. */
  const meanTop = (from: number, to: number) => {
    let sum = 0;
    let n = 0;
    for (let x = from; x <= to; x += 0.5) {
      sum += surface.heightAt(x);
      n++;
    }
    return sum / n;
  };
  return { hero, step, sand, meanTop, profile };
}

/** He swims level from x = 40 to about x = 100, `depth` m under the dunes, then settles. */
function pass(depth: number, seed = 5) {
  const world = desert(seed, { x: 40, z: -depth, heading: 0 });
  const before = world.meanTop(55, 85);
  const sand = world.sand();
  const target = new TargetIntent();
  for (let i = 0; i < 60 * 9; i++) {
    target.aim(world.hero.x + 6, world.profile.height(world.hero.x + 6) - depth, 9);
    world.step(target);
  }
  // He goes deep and the sand settles.
  for (let i = 0; i < 60 * 4; i++) {
    target.aim(world.hero.x + 6, -26, 9);
    world.step(target);
  }
  return { drop: before - world.meanTop(55, 85), sand, after: world.sand() };
}

describe('Undermining: a shallow pass caves the ground in, the desert keeps every grain', () => {
  test('just under the surface he refills only a share of his wake; deep down all of it', () => {
    expect(layBackShare(1.5)).toBe(UNDERMINING.layBackShare);
    expect(layBackShare(UNDERMINING.shallowPassM + 0.1)).toBe(1);
    expect(layBackShare(Number.NaN)).toBe(1);
    expect(layBackShare(-1)).toBe(1);
  });

  test('a shallow pass lowers the surface over his path, without a grain made or lost', () => {
    const shallow = pass(2);
    expect(shallow.drop).toBeGreaterThan(0.3);
    expect(shallow.after).toBe(shallow.sand);
  });

  test('a deep pass closes its wake: the surface stays where it was', () => {
    const deep = pass(14);
    expect(Math.abs(deep.drop)).toBeLessThan(0.08);
    expect(deep.after).toBe(deep.sand);
  });
});
