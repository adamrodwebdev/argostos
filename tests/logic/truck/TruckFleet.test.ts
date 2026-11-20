import { describe, expect, test } from 'vitest';
import type { HitEvent } from '../../../src/logic/hunt/HuntEvents';
import { plainDamage } from '../../../src/rules/combat';
import { bodyHp, machineRow } from '../../../src/rules/machines';
import { BREATH } from '../../../src/rules/combat';
import { ARENA } from '../../../src/rules/world';
import { arena, FALLING, jawsUnder, RISING, wave } from '../arena';

function hits(world: ReturnType<typeof arena>): HitEvent[] {
  const seen: HitEvent[] = [];
  world.events.on('hit', (event) => seen.push(event));
  return seen;
}

describe('TruckFleet: the bite against the plate', () => {
  test('the first minute’s truck falls in one bite from below: its takedown plays at once', () => {
    const world = arena(1);
    const seen = hits(world);
    world.fleet.sendWave(wave({ machines: ['hauler'] }), 0);
    const truck = world.fleet.all[0]!;
    world.tick(jawsUnder(truck), RISING);
    expect(truck.isCaught).toBe(true);
    expect(seen).toEqual([]);
  });

  test('an armoured truck takes bites off its plate, its numbers shown, until one finishes it', () => {
    const world = arena(2);
    const seen = hits(world);
    world.fleet.sendWave(wave({ machines: ['armoredHauler'] }), 0);
    const truck = world.fleet.all[0]!;
    const bite = plainDamage('bite').amount;
    world.tick(jawsUnder(truck), RISING);
    expect(truck.isDriving).toBe(true);
    expect(truck.integrity.hp).toBe(bodyHp(machineRow('armoredHauler')) - bite);
    expect(seen.map((hit) => [hit.kind, hit.part, hit.damage])).toEqual([['bite', 'body', bite]]);
    // The jaws rest a moment: staying on it does not bite again at once.
    for (let i = 0; i < 20; i++) world.tick(jawsUnder(truck), RISING);
    expect(seen).toHaveLength(1);
    for (let i = 0; i < 60 && truck.isDriving; i++) world.tick(jawsUnder(truck), RISING);
    for (let i = 0; i < 60 && truck.isDriving; i++) world.tick(jawsUnder(truck), RISING);
    expect(truck.isCaught).toBe(true);
    expect(seen).toHaveLength(2);
  });

  test('a pounce from above takes plate but plays no takedown: at zero the truck stalls', () => {
    const world = arena(3);
    const stalled: number[] = [];
    world.events.on('gaveOut', ({ targetId }) => stalled.push(targetId));
    world.fleet.sendWave(wave({ machines: ['hauler'] }), 0);
    const truck = world.fleet.all[0]!;
    world.tick(jawsUnder(truck), FALLING);
    expect(truck.isCaught).toBe(false);
    expect(truck.isStalled).toBe(true);
    expect(stalled).toEqual([truck.id]);
    // Stalled, it stands still; the next bite from below finishes it.
    for (let i = 0; i < 120; i++) world.tick();
    expect(Math.abs(truck.rig.speed)).toBeLessThan(0.01);
    world.tick(jawsUnder(truck), RISING);
    expect(truck.isCaught).toBe(true);
  });

  test('a truck brought to zero by other hits waits, stalled, for the bite that finishes it', () => {
    const world = arena(4);
    world.fleet.sendWave(wave({ machines: ['armoredHauler'] }), 0);
    const truck = world.fleet.all[0]!;
    while (!truck.isStalled) world.combat.hit(truck, 'rock', plainDamage('rock'));
    expect(truck.integrity.hp).toBe(0);
    world.tick(jawsUnder(truck), RISING);
    expect(truck.isCaught).toBe(true);
  });

  test('a swallowed truck gives its crystals; a convoy all taken is cleared', () => {
    const world = arena(5);
    const crystals: number[] = [];
    const cleared: boolean[] = [];
    world.events.on('destroyed', (event) => crystals.push(event.crystals));
    world.events.on('convoyCleared', (event) => cleared.push(event.inGlass));
    world.fleet.sendWave(wave({ machines: ['hauler'] }), 0);
    const truck = world.fleet.all[0]!;
    world.tick(jawsUnder(truck), RISING);
    for (let i = 0; i < 60 * 3; i++) world.tick(jawsUnder(truck), RISING);
    expect(crystals).toEqual([machineRow('hauler').crystals]);
    expect(cleared).toEqual([false]);
    expect(world.fleet.isClear).toBe(true);
  });
});

describe('TruckFleet: convoys patrol, flee and get away', () => {
  test('a patrolling convoy turns back before the exits: it never gets away', () => {
    const world = arena(6);
    world.fleet.sendWave(wave({ machines: ['hauler', 'hauler'], x: 120, heading: 1 }), 0);
    const turned = new Set<number>();
    for (let i = 0; i < 60 * 120; i++) {
      world.tick();
      for (const truck of world.fleet.all) if (truck.rig.direction === -1) turned.add(truck.id);
    }
    expect(world.fleet.escapedCount).toBe(0);
    expect(turned.size).toBe(2);
    for (const truck of world.fleet.all) {
      expect(truck.rig.rearX).toBeGreaterThan(0);
      expect(truck.rig.rearX).toBeLessThan(ARENA.widthM);
    }
  });

  test('a convoy that panics on the sonar flees for the exit ahead when the hero is spotted', () => {
    const world = arena(7);
    const fled: string[] = [];
    world.events.on('convoyFled', ({ cause }) => fled.push(cause));
    world.fleet.sendWave(wave({ machines: ['hauler'], x: 100, panic: ['sonar'] }), 0);
    world.events.emit('spotted', { droneId: 1000, x: 0, z: 0 });
    for (let i = 0; i < 60 * 20; i++) world.tick();
    expect(fled).toEqual(['sonar']);
    expect(world.fleet.escapedCount).toBe(1);
    expect(world.fleet.firstEscape?.panicCause).toBe('sonar');
  });

  test('the first hunt’s convoys hear nothing: no panic, no escape', () => {
    const world = arena(8);
    world.fleet.sendWave(wave({ machines: ['hauler'], x: 100, panic: [] }), 0);
    world.events.emit('spotted', { droneId: 1000, x: 0, z: 0 });
    for (let i = 0; i < 60 * 30; i++) world.tick();
    expect(world.fleet.escapedCount).toBe(0);
  });

  test('a convoy that panics on attack flees when one of it is hit', () => {
    const world = arena(9);
    world.fleet.sendWave(wave({ machines: ['armoredHauler', 'hauler'], panic: ['attack'] }), 3);
    const [lead, mate] = world.fleet.all;
    world.combat.hit(lead!, 'rock', plainDamage('rock'));
    // From a standstill a loaded truck takes a few seconds to reach its flight speed.
    for (let i = 0; i < 60 * 8; i++) world.tick();
    expect(mate!.rig.speed).toBeGreaterThan(machineRow('hauler').cruiseSpeed);
  });

  test('a fleeing truck that drives into a glass dome stops, and drives on once it shatters', () => {
    const world = arena(10);
    world.fleet.sendWave(wave({ machines: ['hauler'], x: 55, panic: ['sonar'] }), 0);
    const truck = world.fleet.all[0]!;
    world.events.emit('spotted', { droneId: 1000, x: 0, z: 0 });
    world.dome.raise(80);
    for (let i = 0; i < 60 * 3; i++) world.tick();
    expect(truck.isTrapped).toBe(true);
    const held = truck.rig.rearX;
    for (let i = 0; i < 60; i++) world.tick();
    expect(truck.rig.rearX).toBeCloseTo(held, 1);
    for (let i = 0; i < 60 * BREATH.domeHoldS; i++) world.tick();
    expect(world.dome.isStanding).toBe(false);
    expect(truck.isTrapped).toBe(false);
    for (let i = 0; i < 60; i++) world.tick();
    expect(truck.rig.rearX).toBeGreaterThan(held + 1);
  });

  test('a convoy taken whole while held in glass is cleared “in glass”', () => {
    const world = arena(11);
    const cleared: boolean[] = [];
    world.events.on('convoyCleared', ({ inGlass }) => cleared.push(inGlass));
    world.fleet.sendWave(wave({ machines: ['hauler', 'hauler'], x: 90 }), 0);
    world.dome.raise(82);
    for (let i = 0; i < 60; i++) world.tick();
    // A snapshot: a truck taken leaves the fleet's list while the loop runs.
    for (const truck of Array.from(world.fleet.all)) {
      expect(truck.isTrapped).toBe(true);
      world.tick(jawsUnder(truck), RISING);
    }
    for (let i = 0; i < 60 * 3; i++) world.tick();
    expect(cleared).toEqual([true]);
  });
});
