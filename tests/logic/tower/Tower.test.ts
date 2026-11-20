import { describe, expect, test } from 'vitest';
import { Hero } from '../../../src/logic/hero/Hero';
import { EventBus } from '../../../src/logic/EventBus';
import type { HuntEventMap, TakedownBeatEvent } from '../../../src/logic/hunt/HuntEvents';
import { TargetIntent } from '../../../src/logic/input/Steering';
import { Combat } from '../../../src/logic/machine/Combat';
import { SeededRandom } from '../../../src/logic/SeededRandom';
import { GridProbe } from '../../../src/logic/sand/GridProbe';
import { GridSurface } from '../../../src/logic/sand/GridSurface';
import { SandThrower } from '../../../src/logic/sand/SandThrower';
import { SprayPool } from '../../../src/logic/sand/SprayPool';
import { TerrainBuilder } from '../../../src/logic/sand/TerrainBuilder';
import { Tower, type TowerMoment } from '../../../src/logic/tower/Tower';
import { TowerSite } from '../../../src/logic/tower/TowerSite';
import { DIGGING } from '../../../src/rules/digging';
import { Element } from '../../../src/rules/elements';
import { DuneProfile } from '../../../src/rules/terrain';
import { TOWER } from '../../../src/rules/terrainTraps';
import { gridMeasures, STEP_SECONDS } from '../../../src/rules/world';

const DT = STEP_SECONDS;
const MEASURES = gridMeasures('standard');

/** Sand at z = 0, dropped by `drop` m left of x = `edge` (a caved-in side). */
function ground(drop = 0, edge = 70) {
  const surface = { dropped: drop, heightAt: (x: number) => (x < edge ? -surface.dropped : 0) };
  return surface;
}

/** Steps the tower `seconds`, gathering its moments (other than none). */
function run(tower: Tower, seconds: number): TowerMoment[] {
  const moments: TowerMoment[] = [];
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    const moment = tower.step(DT);
    if (moment !== 'none') moments.push(moment);
  }
  return moments;
}

describe('Tower: the sand decides how it stands', () => {
  test('on level sand it stands straight, on its base, and can be hit', () => {
    const tower = new Tower(1, 70, ground());
    expect(run(tower, 5)).toEqual([]);
    expect(tower.lean).toBe(0);
    expect(tower.baseZ).toBe(0);
    expect(tower.hittable).toBe(true);
  });

  test('a small dip under one side leans it that way and settles it lower, still standing', () => {
    const sand = ground();
    const tower = new Tower(1, 70, sand);
    sand.dropped = 0.5;
    expect(run(tower, 4)).toEqual([]);
    // It leans left (toward the dip), about atan(0.5 / 9.2) = 3°, under its 6° limit.
    expect(tower.lean).toBeLessThan(-0.04);
    expect(tower.lean).toBeGreaterThan(-((TOWER.tipDeg * Math.PI) / 180));
    expect(tower.baseZ).toBeLessThan(-0.4);
    expect(tower.isStanding).toBe(true);
  });

  test('undermined past its limit it topples that way, crashes on the dunes and sinks', () => {
    const sand = ground();
    const tower = new Tower(1, 70, sand);
    sand.dropped = 2;
    expect(run(tower, 6)).toEqual(['topples', 'crashes', 'buried']);
    expect(tower.lean).toBeLessThan(-1.4);
    expect(tower.isGone).toBe(true);
  });

  test('brought to zero by the hero it topples too, the way it leaned', () => {
    const events = new EventBus<HuntEventMap>();
    const combat = new Combat(events);
    const sand = ground();
    const tower = new Tower(1, 70, sand);
    sand.dropped = 0.4;
    run(tower, 3);
    for (let i = 0; i < 10 && tower.hittable; i++) {
      combat.hit(tower, 'ram', { amount: 50, strong: true });
    }
    expect(tower.integrity.spent).toBe(true);
    expect(run(tower, 6)).toEqual(['topples', 'crashes', 'buried']);
    expect(tower.lean).toBeLessThan(-1.4);
  });
});

/** A tower site on `sand`, with a real grid for the sand its crash throws. */
function site(sand: ReturnType<typeof ground>) {
  const seeds = new SeededRandom(3);
  const grid = new TerrainBuilder(MEASURES, new DuneProfile(seeds.fork())).build(seeds.fork());
  const spray = new SprayPool(DIGGING.sprayMax, MEASURES, seeds.fork());
  const events = new EventBus<HuntEventMap>();
  const towers = new TowerSite({
    surface: sand,
    events,
    combat: new Combat(events),
    thrower: new SandThrower(grid, MEASURES, spray, seeds.fork()),
    stepSeconds: DT,
  });
  return { towers, events };
}

describe('TowerSite: a felled tower plays the fall, then gives its crystals', () => {
  test('its cables snap as it topples; the beats come in order; buried, it is destroyed', () => {
    const sand = ground();
    const { towers, events } = site(sand);
    const told: string[] = [];
    const beats: TakedownBeatEvent[] = [];
    let crystals = 0;
    events.on('towerToppled', ({ way }) => told.push(`toppled ${String(way)}`));
    events.on('takedownBeat', (event) => {
      beats.push(event);
      told.push(event.beat);
    });
    events.on('destroyed', (event) => {
      crystals += event.crystals;
      told.push('destroyed');
    });
    towers.send({ atS: 0, x: 70 });
    const away = { x: 0, z: -30, heading: 0 };
    for (let i = 0; i < 60; i++) towers.step(away);
    expect(told).toEqual([]);
    sand.dropped = 2;
    for (let i = 0; i < 60 * 6; i++) towers.step(away);
    expect(told).toEqual([
      'toppled -1',
      'strike',
      'tear',
      'shatter',
      'fuel',
      'drag',
      'buried',
      'destroyed',
    ]);
    expect(beats.every((beat) => beat.takedown === 'fall' && beat.machine === 'drillTower')).toBe(
      true,
    );
    expect(crystals).toBe(20);
    expect(towers.all).toHaveLength(0);
  });

  test('the jaws at its base bite it, with a rest between bites', () => {
    const { towers, events } = site(ground());
    const bites: number[] = [];
    events.on('hit', ({ kind, damage }) => {
      if (kind === 'bite') bites.push(damage);
    });
    towers.send({ atS: 0, x: 70 });
    const jaws = { x: 70, z: -0.3, heading: Math.PI / 2 };
    for (let i = 0; i < 60; i++) towers.step(jaws);
    // One second at its base: a bite, then one more after the rest.
    expect(bites.length).toBeGreaterThanOrEqual(1);
    expect(bites.length).toBeLessThanOrEqual(2);
    expect(towers.all[0]!.integrity.share).toBeLessThan(1);
  });
});

describe('Undermined by the hero on the real sand, the tower tips and sinks', () => {
  test('a shallow pass under one side of its base fells it; the sand is all still there', () => {
    const seeds = new SeededRandom(8);
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
      { x: 44, z: profile.height(44) - 2, heading: 0 },
      DT,
    );
    const tower = new Tower(1, 72, surface);
    const sand = () => grid.count(Element.Sand) + spray.airborne + hero.carriedGrains;
    const before = sand();
    const target = new TargetIntent();
    const step = (x: number, z: number) => {
      target.aim(x, z, 9);
      hero.step(target);
      spray.step(DT, grid);
      grid.simulate(random);
      return tower.step(DT);
    };
    const moments: TowerMoment[] = [];
    // Just under the dunes, up to the left side of its base (x = 67.4), then down and away.
    while (hero.x < 69) {
      const moment = step(hero.x + 6, profile.height(hero.x + 6) - 2);
      if (moment !== 'none') moments.push(moment);
    }
    // The sand has not caved in yet: it still stands straight.
    expect(tower.isStanding).toBe(true);
    let leaned = 0;
    for (let i = 0; i < 60 * 8; i++) {
      const moment = step(hero.x - 8, -24);
      if (moment !== 'none') moments.push(moment);
      if (tower.isStanding) leaned = Math.min(leaned, tower.lean);
    }
    // The ground slumps into his wake: it leans that way first (a moment to see), then falls.
    expect(leaned).toBeLessThan(-0.05);
    expect(moments).toEqual(['topples', 'crashes', 'buried']);
    expect(tower.lean).toBeLessThan(0);
    expect(sand()).toBe(before);
  });
});
