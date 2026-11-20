import { describe, expect, test } from 'vitest';
import {
  angleBetween,
  approach,
  bodyRadiusAt,
  HERO_BODY,
  maxTurnRate,
  noiseFor,
  speedFor,
  SWIM,
  throttleFor,
  turnToward,
} from '../../src/rules/swimming';

describe('throttleFor: the farther the finger, the harder he swims', () => {
  test('a finger in the dead zone asks for nothing', () => {
    expect(throttleFor(0, 9)).toBe(0);
    expect(throttleFor(SWIM.deadZoneM, 9)).toBe(0);
  });

  test('a finger at the full distance or beyond asks for everything', () => {
    expect(throttleFor(9, 9)).toBe(1);
    expect(throttleFor(90, 9)).toBe(1);
  });

  test('the throttle never drops as the finger moves away', () => {
    let last = 0;
    for (let d = 0; d <= 12; d += 0.25) {
      const throttle = throttleFor(d, 9);
      expect(throttle).toBeGreaterThanOrEqual(last);
      last = throttle;
    }
  });

  test.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'a broken distance (%s) never becomes full speed',
    (distance) => {
      expect(throttleFor(distance, 9)).toBe(0);
      expect(throttleFor(5, distance)).toBe(0);
    },
  );

  test('a full distance inside the dead zone still gives a number', () => {
    expect(Number.isFinite(throttleFor(3, 0.1))).toBe(true);
  });
});

describe('speed, turning and noise', () => {
  test('the speed runs from the cruise to the fastest swim, clamped', () => {
    expect(speedFor(0)).toBe(SWIM.cruiseSpeed);
    expect(speedFor(1)).toBe(SWIM.maxSpeed);
    expect(speedFor(5)).toBe(SWIM.maxSpeed);
    expect(speedFor(-1)).toBe(SWIM.cruiseSpeed);
  });

  test('he turns faster the faster he goes, never pivoting at rest', () => {
    expect(maxTurnRate(0)).toBe(SWIM.minTurnRate);
    expect(maxTurnRate(14)).toBeGreaterThan(maxTurnRate(4));
  });

  test('speed changes by at most one step of acceleration or braking', () => {
    const change = { up: 0.4, down: 0.2 };
    expect(approach(0, 10, change)).toBe(0.4);
    expect(approach(10, 0, change)).toBe(9.8);
    expect(approach(5, 5.1, change)).toBe(5.1);
  });

  test('the angle between two headings is the short way round', () => {
    expect(angleBetween(0.1, -0.1)).toBeCloseTo(-0.2);
    expect(angleBetween(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2);
    expect(angleBetween(0, Math.PI)).toBeCloseTo(Math.PI);
  });

  test('a turn is limited to its step, and reaches a near target', () => {
    expect(turnToward(0, 1, 0.1)).toBeCloseTo(0.1);
    expect(turnToward(0, -1, 0.1)).toBeCloseTo(-0.1);
    expect(turnToward(0, 0.05, 0.1)).toBeCloseTo(0.05);
  });

  test('he is silent at rest and at a crawl, loudest at full speed, louder when faster', () => {
    expect(noiseFor(0)).toBe(0);
    expect(noiseFor(1)).toBe(0);
    expect(noiseFor(SWIM.maxSpeed)).toBe(1);
    expect(noiseFor(SWIM.maxSpeed * 2)).toBe(1);
    expect(noiseFor(10)).toBeGreaterThan(noiseFor(5));
    expect(noiseFor(Number.NaN)).toBe(0);
  });
});

describe('bodyRadiusAt: the body swells to the shoulder, then thins to the tail', () => {
  test('head, shoulder and tail', () => {
    const r = HERO_BODY.radiusM;
    expect(bodyRadiusAt(0, r)).toBeCloseTo(r * 0.92);
    expect(bodyRadiusAt(HERO_BODY.shoulder, r)).toBeCloseTo(r);
    expect(bodyRadiusAt(1, r)).toBeCloseTo(r * HERO_BODY.tailShare);
  });

  test('outside the body it is clamped', () => {
    const r = HERO_BODY.radiusM;
    expect(bodyRadiusAt(-1, r)).toBe(bodyRadiusAt(0, r));
    expect(bodyRadiusAt(2, r)).toBe(bodyRadiusAt(1, r));
  });
});
