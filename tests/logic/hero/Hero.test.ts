import { describe, expect, test } from 'vitest';
import { DIGGING } from '../../../src/rules/digging';
import { Element } from '../../../src/rules/elements';
import { DuneProfile } from '../../../src/rules/terrain';
import { gridMeasures, STEP_SECONDS } from '../../../src/rules/world';
import { Hero, type HeroStart } from '../../../src/logic/hero/Hero';
import { Transition } from '../../../src/logic/hero/HeroMotion';
import { IdleIntent, TargetIntent } from '../../../src/logic/input/Steering';
import { SeededRandom } from '../../../src/logic/SeededRandom';
import { GridProbe } from '../../../src/logic/sand/GridProbe';
import { GridSurface } from '../../../src/logic/sand/GridSurface';
import { SprayPool } from '../../../src/logic/sand/SprayPool';
import { TerrainBuilder } from '../../../src/logic/sand/TerrainBuilder';

const MEASURES = gridMeasures('standard');

/** A desert and its hero, without the trucks: what the hero's own tests need. */
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
  const step = (intent: Parameters<Hero['step']>[0]) => {
    const transition = hero.step(intent);
    spray.step(STEP_SECONDS, grid);
    grid.simulate(random);
    return transition;
  };
  const sand = () => grid.count(Element.Sand) + spray.airborne + hero.carriedGrains;
  return { grid, spray, surface, profile, hero, step, sand };
}

const DEEP: HeroStart = { x: 60, z: -20, heading: 0 };

describe('Hero: the farther the finger, the faster and the louder', () => {
  test('he swims toward the target and gets closer', () => {
    const { hero, step } = desert(1, DEEP);
    const target = new TargetIntent();
    target.aim(90, -20, 9);
    const start = Math.hypot(90 - hero.x, -20 - hero.z);
    for (let i = 0; i < 120; i++) step(target);
    expect(Math.hypot(90 - hero.x, -20 - hero.z)).toBeLessThan(start - 10);
  });

  test('a far finger makes him faster and louder than a near one', () => {
    const near = desert(2, DEEP);
    const far = desert(2, DEEP);
    const nearTarget = new TargetIntent();
    const farTarget = new TargetIntent();
    for (let i = 0; i < 90; i++) {
      nearTarget.aim(near.hero.x + 2, -20, 9);
      farTarget.aim(far.hero.x + 30, -20, 9);
      near.step(nearTarget);
      far.step(farTarget);
    }
    expect(far.hero.speed).toBeGreaterThan(near.hero.speed + 5);
    expect(far.hero.noise).toBeGreaterThan(near.hero.noise);
    expect(far.hero.noise).toBeLessThanOrEqual(1);
    expect(near.hero.noise).toBeGreaterThanOrEqual(0);
  });

  test('with no finger he cruises on slowly, quietly', () => {
    const { hero, step } = desert(3, DEEP);
    const idle = new IdleIntent();
    for (let i = 0; i < 240; i++) step(idle);
    expect(hero.speed).toBeLessThan(3);
    expect(hero.noise).toBeLessThan(0.05);
    expect(hero.medium).toBe('sand');
  });
});

describe('Hero: bursting out of the sand', () => {
  test('a fast rise bursts out into a leap, and he plunges back in', () => {
    const { hero, step } = desert(4, { x: 70, z: -12, heading: Math.PI / 2 });
    const target = new TargetIntent();
    const idle = new IdleIntent();
    const seen: number[] = [];
    let highest = -Infinity;
    for (let i = 0; i < 300; i++) {
      target.aim(hero.x, 30, 9);
      // The finger points at the sky until he is out, then lets go.
      const transition = step(seen.length === 0 ? target : idle);
      if (transition !== Transition.None) seen.push(transition);
      highest = Math.max(highest, hero.z);
    }
    expect(seen[0]).toBe(Transition.Breach);
    expect(seen).toContain(Transition.Dive);
    expect(highest).toBeGreaterThan(3);
    expect(hero.medium).toBe('sand');
  });

  test('a slow rise levels off under the surface instead of leaping', () => {
    const { hero, step, profile } = desert(5, { x: 70, z: -6, heading: Math.PI / 2 });
    const target = new TargetIntent();
    let breached = false;
    for (let i = 0; i < 400; i++) {
      // A finger just above the head: a slow throttle.
      target.aim(hero.x + 0.4, hero.z + 1.6, 9);
      if (step(target) === Transition.Breach) breached = true;
    }
    expect(breached).toBe(false);
    expect(hero.medium).toBe('sand');
    // His back may show above the dune, never his whole head.
    expect(hero.z).toBeLessThan(profile.height(hero.x) + hero.radius);
  });

  test('he never leaves the arena nor digs into the bedrock', () => {
    const { hero, step } = desert(6, { x: 20, z: -30, heading: Math.PI });
    const target = new TargetIntent();
    for (let i = 0; i < 400; i++) {
      target.aim(-50, -200, 9);
      step(target);
    }
    expect(hero.x).toBeGreaterThan(0);
    expect(hero.z).toBeGreaterThan(MEASURES.bottomZ + MEASURES.bedrockRows * MEASURES.cellM);
  });
});

describe('Hero: he swims through the sand, he does not carve tunnels', () => {
  test.each([11, 12, 13, 14, 15, 16])('not a grain is made or lost (seed %i)', (seed) => {
    const { step, sand } = desert(seed, DEEP);
    const random = new SeededRandom(seed * 31);
    const target = new TargetIntent();
    const before = sand();
    for (let i = 0; i < 900; i++) {
      if (i % 40 === 0) target.aim(10 + random.next() * 140, -40 + random.next() * 50, 9);
      step(target);
    }
    expect(sand()).toBe(before);
  });

  test('the cells his body fills hold no grain', () => {
    const { grid, step, hero } = desert(21, DEEP);
    const target = new TargetIntent();
    for (let i = 0; i < 200; i++) {
      target.aim(hero.x + 20, -15 + 10 * Math.sin(i / 20), 9);
      step(target);
    }
    let grainsInBody = 0;
    let bodyCells = 0;
    for (let i = 0; i < grid.cells.length; i++) {
      if (!grid.isBlocked(i)) continue;
      bodyCells++;
      if (grid.elementAt(i) !== Element.Air) grainsInBody++;
    }
    expect(bodyCells).toBeGreaterThan(100);
    expect(grainsInBody).toBe(0);
  });

  test('the sand closes behind him: deep down, no hollow is left once he has gone', () => {
    const { grid, step, hero } = desert(22, DEEP);
    const target = new TargetIntent();
    for (let i = 0; i < 360; i++) {
      target.aim(hero.x + 20, -20, 9);
      step(target);
    }
    const idle = new IdleIntent();
    for (let i = 0; i < 60; i++) step(idle);
    // Between x = 62 and 80 m and 12 to 28 m deep, behind him now: every cell is sand again.
    let hollows = 0;
    for (
      let y = Math.round((MEASURES.topZ + 12) / MEASURES.cellM);
      y < (MEASURES.topZ + 28) / MEASURES.cellM;
      y++
    ) {
      for (let x = Math.round(62 / MEASURES.cellM); x < 80 / MEASURES.cellM; x++) {
        const i = grid.index(x, y);
        if (!grid.isBlocked(i) && grid.elementAt(i) === Element.Air) hollows++;
      }
    }
    expect(hero.x).toBeGreaterThan(100);
    expect(hollows).toBe(0);
  });
});
