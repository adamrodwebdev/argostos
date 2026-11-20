import { describe, expect, test } from 'vitest';
import { PathTrail } from '../../../src/logic/hero/PathTrail';

const point = { x: 0, z: 0 };

describe('PathTrail: the body lies along the path the head swam', () => {
  test('a straight trail lies behind the head', () => {
    const trail = new PathTrail(0.25, 17);
    trail.reset(10, -5, 0);
    trail.pointAt(4, point);
    expect(point.x).toBeCloseTo(6);
    expect(point.z).toBeCloseTo(-5);
  });

  test('after a turn, a point behind the head is where the head was', () => {
    const trail = new PathTrail(0.25, 17);
    trail.reset(0, 0, 0);
    // Right 10 m, then up 10 m, in small moves.
    for (let i = 1; i <= 40; i++) trail.advance(i * 0.25, 0);
    for (let i = 1; i <= 40; i++) trail.advance(10, i * 0.25);
    trail.pointAt(15, point);
    expect(point.x).toBeCloseTo(5, 1);
    expect(point.z).toBeCloseTo(0, 1);
    trail.pointAt(5, point);
    expect(point.x).toBeCloseTo(10, 1);
    expect(point.z).toBeCloseTo(5, 1);
  });

  test('a big move in one go still lays samples all along it', () => {
    const trail = new PathTrail(0.25, 17);
    trail.reset(0, 0, 0);
    trail.advance(8, 0);
    trail.pointAt(3, point);
    expect(point.x).toBeCloseTo(5);
  });

  test("a point past the trail's length is its last one, never an extrapolation", () => {
    const trail = new PathTrail(0.25, 17);
    trail.reset(0, 0, 0);
    trail.pointAt(500, point);
    expect(point.x).toBeCloseTo(-17, 0);
    trail.pointAt(-5, point);
    expect(point.x).toBeCloseTo(0);
  });

  test('a spacing or a length that cannot work is refused', () => {
    expect(() => new PathTrail(0, 17)).toThrow(RangeError);
    expect(() => new PathTrail(1, 0.5)).toThrow(RangeError);
    expect(() => new PathTrail(Number.NaN, 17)).toThrow(RangeError);
  });
});
