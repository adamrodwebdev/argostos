import { describe, expect, test } from 'vitest';
import type { HitEvent, TakedownBeatEvent } from '../../../src/logic/hunt/HuntEvents';
import { TruckRig } from '../../../src/logic/truck/TruckRig';
import { Element } from '../../../src/rules/elements';
import { machineRow } from '../../../src/rules/machines';
import { GROUND, landingDamage, pastLimit } from '../../../src/rules/terrainTraps';
import { gridMeasures } from '../../../src/rules/world';
import { arena, GEOMETRY, wave } from '../arena';

const DT = 1 / 60;
const CRUISE = machineRow('hauler').cruiseSpeed;
const MEASURES = gridMeasures('standard');

/** Flat sand at z = 0 with a pit `depth` m deep between x = 30 and x = 30 + `width`. */
function pit(depth: number, width = 14) {
  return { heightAt: (x: number) => (x > 30 && x < 30 + width ? -depth : 0) };
}

describe('the ground’s rules: landings, tips and climbs', () => {
  test('a soft landing does no harm; a harder one takes plate in proportion', () => {
    expect(landingDamage(GROUND.safeLandingMps)).toBe(0);
    expect(landingDamage(GROUND.safeLandingMps + 2)).toBe(2 * GROUND.damagePerMps);
    expect(landingDamage(Number.NaN)).toBe(0);
  });

  test('a lean is past its limit only beyond it, either way', () => {
    const limit = (GROUND.tipDeg * Math.PI) / 180;
    expect(pastLimit(limit * 0.99, GROUND.tipDeg)).toBe(false);
    expect(pastLimit(-limit * 1.01, GROUND.tipDeg)).toBe(true);
    expect(pastLimit(Number.NaN, GROUND.tipDeg)).toBe(false);
  });
});

describe('TruckRig: a truck over a pit falls, lands, and is stuck in it', () => {
  test('its wheels fall freely into a pit and land at the speed of the fall', () => {
    const rig = new TruckRig(GEOMETRY, pit(3), { x: 20, direction: 1 });
    let landing = 0;
    let airborne = false;
    for (let i = 0; i < 60 * 6; i++) {
      rig.step(CRUISE, DT);
      airborne ||= rig.airborne;
      landing = Math.max(landing, rig.landing);
    }
    expect(airborne).toBe(true);
    // A free fall of 3 m lands at about √(2 g h).
    expect(landing).toBeGreaterThan(Math.sqrt(2 * GROUND.gravity * 3) * 0.8);
  });

  test('a truck on flat sand never leaves the ground', () => {
    const rig = new TruckRig(GEOMETRY, { heightAt: () => 0 }, { x: 20, direction: 1 });
    for (let i = 0; i < 60 * 5; i++) {
      rig.step(CRUISE, DT);
      expect(rig.airborne).toBe(false);
      expect(rig.landing).toBe(0);
    }
  });

  test('at the far wall of a pit it is stuck: it stops there, its wheels spinning', () => {
    const rig = new TruckRig(GEOMETRY, pit(3, 9), { x: 31, direction: 1 });
    for (let i = 0; i < 60 * 8; i++) rig.step(CRUISE, DT);
    expect(rig.stuck).toBe(true);
    expect(rig.speed).toBe(0);
    // It stays in the pit (the wall at x = 39), its wheels turning on.
    expect(rig.frontX).toBeLessThan(39);
    const turned = rig.wheelAngle;
    for (let i = 0; i < 60; i++) rig.step(CRUISE, DT);
    expect(rig.wheelAngle).toBeGreaterThan(turned + 1);
  });
});

/** Digs a pit straight into the grid's sand: `depth` m deep from x for `width` m. */
function dig(world: ReturnType<typeof arena>, x: number, size: { width: number; depth: number }) {
  const { grid } = world;
  const c0 = Math.round(x / MEASURES.cellM);
  const c1 = Math.round((x + size.width) / MEASURES.cellM);
  const rows = Math.round(size.depth / MEASURES.cellM);
  for (let c = c0; c <= c1; c++) {
    const top = grid.surfaceRow(c);
    for (let r = top; r < top + rows; r++) {
      const i = grid.index(c, r);
      if (grid.elementAt(i) === Element.Sand) grid.clear(i);
    }
  }
}

describe('TruckFleet: the moving ground hurts and fells the Company’s trucks', () => {
  test('a truck driving over a deep sinkhole falls into it and breaks: the fall plays', () => {
    const world = arena(41);
    const beats: TakedownBeatEvent[] = [];
    world.events.on('takedownBeat', (event) => beats.push(event));
    world.fleet.sendWave(wave({ machines: ['hauler'], x: 45 }), 0);
    dig(world, 62, { width: 16, depth: 4 });
    const truck = world.fleet.all[0]!;
    for (let i = 0; i < 60 * 12 && truck.isDriving; i++) world.tick();
    expect(truck.isCaught || truck.isGone).toBe(true);
    expect(beats[0]).toMatchObject({ takedown: 'fall', beat: 'strike' });
    for (let i = 0; i < 60 * 4; i++) world.tick();
    expect(beats.map((beat) => beat.beat)).toEqual([
      'strike',
      'tear',
      'shatter',
      'fuel',
      'drag',
      'buried',
    ]);
  });

  test('a shallow pit takes plate off by the landing, and the truck drives on', () => {
    const world = arena(42);
    const hits: HitEvent[] = [];
    world.events.on('hit', (event) => hits.push(event));
    world.fleet.sendWave(wave({ machines: ['armoredHauler'], x: 45 }), 0);
    dig(world, 62, { width: 12, depth: 2.3 });
    const truck = world.fleet.all[0]!;
    for (let i = 0; i < 60 * 10; i++) world.tick();
    const falls = hits.filter((hit) => hit.kind === 'fall');
    expect(falls.length).toBeGreaterThan(0);
    expect(truck.isDriving).toBe(true);
    expect(truck.integrity.hp).toBeLessThan(150);
  });
});
