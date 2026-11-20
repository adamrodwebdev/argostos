import { describe, expect, test } from 'vitest';
import { HeadTrace } from '../../../src/logic/hero/HeadTrace';
import { RELICS, RUNES } from '../../../src/rules/runes';

describe('HeadTrace: the head’s recent path, kept for the runes to come', () => {
  test('a place is kept every half metre of travel, whatever the speed', () => {
    const trace = new HeadTrace(8, 0.5);
    for (let i = 0; i <= 20; i++) trace.record(i * 0.1, 0, i / 60);
    expect(trace.count).toBe(5);
    const out = { x: 0, z: 0, time: 0 };
    expect(trace.pointAt(0, out)).toBe(true);
    expect(out.x).toBeCloseTo(2);
  });

  test('the ring keeps the newest places, the oldest giving way', () => {
    const trace = new HeadTrace(4, 1);
    for (let i = 0; i < 10; i++) trace.record(i, 0, i);
    const out = { x: 0, z: 0, time: 0 };
    expect(trace.count).toBe(4);
    expect(trace.pointAt(0, out) && out.x).toBe(9);
    expect(trace.pointAt(3, out) && out.x).toBe(6);
    expect(trace.pointAt(4, out)).toBe(false);
  });

  test.each([Number.NaN, Number.POSITIVE_INFINITY])('a broken place (%s) is not kept', (bad) => {
    const trace = new HeadTrace(4, 1);
    trace.record(bad, 0, 0);
    trace.record(0, bad, 0);
    expect(trace.count).toBe(0);
  });

  test('the rune and relic tables are there, empty until the runes come', () => {
    expect(RUNES.size).toBe(0);
    expect(RELICS.size).toBe(0);
  });
});
