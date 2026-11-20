import { describe, expect, test } from 'vitest';
import { ACTION_IDS, type ActionId } from '../../src/rules/combat';
import { HUNTS, huntRow, MAX_HUNT_NUMBER } from '../../src/rules/hunts';
import { MACHINES } from '../../src/rules/machines';
import { ARENA } from '../../src/rules/world';

/** The actions a hunt has unlocked once `seconds` have passed. */
function unlockedAt(n: number, seconds: number): ActionId[] {
  return huntRow(n)
    .unlocks.filter((unlock) => unlock.atS <= seconds)
    .map((unlock) => unlock.action)
    .toSorted();
}

describe('hunts: the actions arrive one by one', () => {
  test('hunt 1: no button at the start, the breath at 20 s', () => {
    expect(unlockedAt(1, 0)).toEqual([]);
    expect(unlockedAt(1, 19.9)).toEqual([]);
    expect(unlockedAt(1, 20)).toEqual(['breath']);
  });

  test('hunt 2 adds the ram, hunt 3 the strike, from their first second', () => {
    expect(unlockedAt(2, 0)).toEqual(['breath', 'ram']);
    expect(unlockedAt(3, 0)).toEqual(['breath', 'ram', 'strike']);
  });

  test('past the table the last hunt plays again, all actions open', () => {
    expect(huntRow(HUNTS.length + 5)).toBe(HUNTS.at(-1));
    expect(unlockedAt(MAX_HUNT_NUMBER, 0)).toEqual(ACTION_IDS.toSorted());
  });

  test.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'a hunt number of %s plays the first hunt',
    (n) => {
      expect(huntRow(n)).toBe(HUNTS[0]);
    },
  );
});

describe('hunts: every row can be played', () => {
  test.each(HUNTS.map((row, index) => [index + 1, row] as const))(
    'hunt %i: its convoys come in order, made of known machines, from the arena or an exit',
    (_n, row) => {
      const times = row.waves.map((wave) => wave.atS);
      expect(times).toEqual(times.toSorted((a, b) => a - b));
      for (const wave of row.waves) {
        expect(wave.machines.length).toBeGreaterThan(0);
        for (const machine of wave.machines) expect(MACHINES.get(machine)?.kind).toBe('truck');
        expect(wave.x).toBeGreaterThan(-20);
        expect(wave.x).toBeLessThan(ARENA.widthM + 20);
      }
      for (const drone of row.drones) {
        expect(drone.x - drone.spanM).toBeGreaterThan(0);
        expect(drone.x + drone.spanM).toBeLessThan(ARENA.widthM);
      }
    },
  );

  test('the first hunt’s prey never flee: no failure before the second hunt', () => {
    for (const wave of huntRow(1).waves) expect(wave.panic).toEqual([]);
  });

  test('the first truck of the first hunt starts right in the arena, near the hero', () => {
    const first = huntRow(1).waves[0];
    expect(first?.atS).toBe(0);
    expect(first?.x).toBeGreaterThan(0);
    expect(first?.x).toBeLessThan(ARENA.widthM / 2);
  });
});
