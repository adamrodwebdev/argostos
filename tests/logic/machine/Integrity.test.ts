import { describe, expect, test } from 'vitest';
import { EventBus } from '../../../src/logic/EventBus';
import type { HuntEventMap } from '../../../src/logic/hunt/HuntEvents';
import { HuntStats } from '../../../src/logic/hunt/HuntStats';
import { Integrity } from '../../../src/logic/machine/Integrity';
import { MachineParts } from '../../../src/logic/machine/MachineParts';
import { machineRow } from '../../../src/rules/machines';

describe('Integrity: plate taken off hit by hit, never below zero', () => {
  test('hits take plate off; at zero the machine is spent, never below', () => {
    const plate = new Integrity(50);
    plate.take(30);
    expect(plate.hp).toBe(20);
    expect(plate.share).toBeCloseTo(0.4);
    expect(plate.spent).toBe(false);
    plate.take(30);
    expect(plate.hp).toBe(0);
    expect(plate.spent).toBe(true);
  });

  test.each([Number.NaN, Number.POSITIVE_INFINITY, -10, 0])(
    'a hit of %s takes nothing',
    (amount) => {
      const plate = new Integrity(50);
      plate.take(amount);
      expect(plate.hp).toBe(50);
    },
  );

  test.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'a machine of %s plate is refused',
    (max) => {
      expect(() => new Integrity(max)).toThrow();
    },
  );
});

function stats() {
  const events = new EventBus<HuntEventMap>();
  return { events, stats: new HuntStats(events) };
}

describe('MachineParts: a machine’s health is a list of parts', () => {
  test('a machine’s parts come from its row; the body carries its life', () => {
    const parts = new MachineParts(machineRow('armoredHauler').parts);
    expect(parts.all.map((part) => part.id)).toEqual(['body']);
    expect(parts.body.integrity.hp).toBe(150);
    expect(parts.body.effect.id).toBe('none');
    expect(parts.part('body')).toBe(parts.body);
  });

  test('a machine with no body is refused', () => {
    expect(() => new MachineParts([])).toThrow();
  });
});

describe('HuntStats: the experts’ three stars', () => {
  test('a hunt never heard, two trucks in one leap and a convoy taken in glass wins all three', () => {
    const { events, stats: hunt } = stats();
    events.emit('truckCaught', { id: 1, x: 0, z: 0 });
    hunt.tick(0.8);
    events.emit('truckCaught', { id: 2, x: 0, z: 0 });
    events.emit('convoyCleared', { waveId: 1, size: 2, inGlass: true });
    expect(hunt.stars).toEqual({ unseen: true, doubleBite: true, glassOnly: true });
  });

  test('a spot loses “unseen”; catches far apart are no double bite', () => {
    const { events, stats: hunt } = stats();
    events.emit('spotted', { droneId: 1000, x: 0, z: 0 });
    events.emit('truckCaught', { id: 1, x: 0, z: 0 });
    hunt.tick(4);
    events.emit('truckCaught', { id: 2, x: 0, z: 0 });
    events.emit('convoyCleared', { waveId: 1, size: 2, inGlass: false });
    expect(hunt.stars).toEqual({ unseen: false, doubleBite: false, glassOnly: false });
  });

  test('crystals and machines destroyed are counted by kind', () => {
    const { events, stats: hunt } = stats();
    events.emit('destroyed', { targetId: 1, machine: 'hauler', crystals: 8, x: 0, z: 0 });
    events.emit('destroyed', { targetId: 1000, machine: 'drone', crystals: 10, x: 0, z: 0 });
    expect(hunt.crystals).toBe(18);
    expect(hunt.destroyed('hauler')).toBe(1);
    expect(hunt.destroyed('armoredHauler')).toBe(0);
  });
});
