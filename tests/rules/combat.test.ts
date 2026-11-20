import { describe, expect, test } from 'vitest';
import {
  brings,
  HIT_KINDS,
  hitRow,
  plainDamage,
  ramDamage,
  RAM,
  rockFlightSeconds,
  STRIKE,
  strikeModeFor,
} from '../../src/rules/combat';
import { bodyHp, MACHINE_IDS, MACHINES, machineRow } from '../../src/rules/machines';
import { hears, NOISE_RINGS, noiseRadius, SONAR } from '../../src/rules/sonar';

describe('machines: the table the hunts are made of', () => {
  test('every machine has a row with plate, crystals and a hit-stop of 60 to 120 ms', () => {
    for (const id of MACHINE_IDS) {
      const row = machineRow(id);
      expect(bodyHp(row)).toBeGreaterThan(0);
      expect(row.crystals).toBeGreaterThan(0);
      expect(row.hitStopMs).toBeGreaterThanOrEqual(60);
      expect(row.hitStopMs).toBeLessThanOrEqual(120);
    }
    expect(MACHINES.size).toBe(MACHINE_IDS.length);
  });

  test('a machine is made of parts, its body among them, each part once', () => {
    for (const row of MACHINES.values()) {
      const ids = row.parts.map((part) => part.id);
      expect(ids).toContain('body');
      expect(new Set(ids).size).toBe(ids.length);
      for (const part of row.parts) expect(part.hp).toBeGreaterThan(0);
    }
  });

  test('a machine without a life bar falls in one bite (no bar on one-bite prey)', () => {
    for (const row of MACHINES.values()) {
      if (!row.bar) expect(brings(bodyHp(row), hitRow('bite').damage)).toBe(true);
    }
  });

  test('the first minute’s truck falls in one bite and shows no life bar', () => {
    expect(machineRow('hauler').bar).toBe(false);
    expect(brings(bodyHp(machineRow('hauler')), hitRow('bite').damage)).toBe(true);
  });

  test('the armoured truck takes several bites and shows its bar', () => {
    const row = machineRow('armoredHauler');
    expect(row.bar).toBe(true);
    expect(brings(bodyHp(row), hitRow('bite').damage)).toBe(false);
  });

  test('trucks flee faster than they cruise; drones never flee', () => {
    for (const row of MACHINES.values()) {
      if (row.kind === 'truck') expect(row.fleeSpeed).toBeGreaterThan(row.cruiseSpeed);
      else expect(row.fleeSpeed).toBe(0);
    }
  });
});

describe('combat: hits, the ram and the strike', () => {
  test('every kind of hit has a row', () => {
    for (const kind of HIT_KINDS) expect(hitRow(kind).damage).toBeGreaterThan(0);
  });

  test('a full-speed ram is a strong hit with its full damage; a slow one half of it', () => {
    expect(ramDamage(RAM.speed)).toEqual({ amount: hitRow('ram').damage, strong: true });
    expect(ramDamage(0)).toEqual({ amount: Math.round(hitRow('ram').damage / 2), strong: false });
    expect(ramDamage(RAM.speed * 0.89).strong).toBe(false);
    expect(ramDamage(RAM.speed * 3).amount).toBe(hitRow('ram').damage);
  });

  test.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -5])(
    'a ram at a broken speed (%s) is a weak hit, never a strong one',
    (speed) => {
      expect(ramDamage(speed)).toEqual({
        amount: Math.round(hitRow('ram').damage / 2),
        strong: false,
      });
    },
  );

  test('the tail, the rock and the bite take their rows’ damage, never a strong hit', () => {
    expect(plainDamage('tail')).toEqual({ amount: hitRow('tail').damage, strong: false });
    expect(plainDamage('rock')).toEqual({ amount: hitRow('rock').damage, strong: false });
    expect(plainDamage('bite')).toEqual({ amount: hitRow('bite').damage, strong: false });
  });

  test('the strike is a tail slap up close and a rock thrown beyond the tail’s reach', () => {
    expect(strikeModeFor(0)).toBe('tail');
    expect(strikeModeFor(STRIKE.tailRangeM)).toBe('tail');
    expect(strikeModeFor(STRIKE.tailRangeM + 0.01)).toBe('rock');
    expect(strikeModeFor(Number.POSITIVE_INFINITY)).toBe('rock');
    expect(strikeModeFor(Number.NaN)).toBe('rock');
  });

  test('a rock flies longer to a farther mark, within its bounds', () => {
    expect(rockFlightSeconds(0)).toBe(STRIKE.rockMinS);
    expect(rockFlightSeconds(20)).toBeGreaterThan(rockFlightSeconds(12));
    expect(rockFlightSeconds(1e6)).toBe(STRIKE.rockMaxS);
    expect(rockFlightSeconds(Number.NaN)).toBe(STRIKE.rockMinS);
  });

  test('a machine is at zero once a hit takes all its plate, not before', () => {
    expect(brings(50, 60)).toBe(true);
    expect(brings(60, 60)).toBe(true);
    expect(brings(61, 60)).toBe(false);
  });
});

describe('sonar: the drone hears the hero when their rings touch', () => {
  test('a quiet hero has no rings and is never heard, even right under a drone', () => {
    expect(noiseRadius(NOISE_RINGS.quietBelow - 0.01)).toBe(0);
    expect(hears(0, NOISE_RINGS.quietBelow - 0.01)).toBe(false);
  });

  test('a loud hero is heard from farther than a slightly noisy one', () => {
    const far = SONAR.rangeM + NOISE_RINGS.maxM * 0.9;
    expect(hears(far, 1)).toBe(true);
    expect(hears(far, 0.4)).toBe(false);
  });

  test('the rings touch exactly at the sonar’s reach plus his ring', () => {
    const ring = noiseRadius(0.5);
    expect(hears(SONAR.rangeM + ring, 0.5)).toBe(true);
    expect(hears(SONAR.rangeM + ring + 0.01, 0.5)).toBe(false);
  });

  test.each([Number.NaN, Number.POSITIVE_INFINITY])(
    'a broken reading (%s) is never heard',
    (broken) => {
      expect(hears(broken, 1)).toBe(false);
      expect(hears(1, broken)).toBe(false);
    },
  );
});
