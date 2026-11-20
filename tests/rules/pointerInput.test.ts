import { describe, expect, test } from 'vitest';
import { readPointer, type RawPointer } from '../../src/rules/pointerInput';

const AREA = { left: 10, top: 20, width: 320, height: 568 } as const;
const FINGER: RawPointer = {
  pointerId: 3,
  pointerType: 'touch',
  clientX: 110,
  clientY: 220,
  isPrimary: true,
};

describe('readPointer: a pointer is read at the door', () => {
  test('a finger inside the play area gives its place in it', () => {
    expect(readPointer(FINGER, AREA)).toEqual({
      id: 3,
      kind: 'touch',
      x: 100,
      y: 200,
      primary: true,
    });
  });

  test('a mouse and a pen are read too', () => {
    expect(readPointer({ ...FINGER, pointerType: 'mouse', pointerId: 1 }, AREA)?.kind).toBe(
      'mouse',
    );
    expect(readPointer({ ...FINGER, pointerType: 'pen' }, AREA)?.kind).toBe('pen');
  });

  test('a finger that slid past the edges is clamped to the play area', () => {
    const outside = readPointer({ ...FINGER, clientX: -500, clientY: 5000 }, AREA);
    expect(outside?.x).toBe(0);
    expect(outside?.y).toBe(AREA.height);
  });

  test.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
    ['far beyond any screen', 1e7],
    ['numeric text', '110'],
    ['null', null],
    ['undefined', undefined],
    ['true', true],
    ['an array', [110]],
    ['an object', { valueOf: () => 110 }],
  ])('a position that is %s is refused', (_case, clientX) => {
    expect(readPointer({ ...FINGER, clientX }, AREA)).toBeNull();
    expect(readPointer({ ...FINGER, clientY: clientX }, AREA)).toBeNull();
  });

  test.each(['Touch', 'finger', '', '__proto__', 'toString', 42, null])(
    'a pointer kind of %j is not on the list',
    (pointerType) => {
      expect(readPointer({ ...FINGER, pointerType }, AREA)).toBeNull();
    },
  );

  test.each([1.5, -2, 2 ** 31, '3', Number.NaN, null])(
    'a pointer id of %j is refused',
    (pointerId) => {
      expect(readPointer({ ...FINGER, pointerId }, AREA)).toBeNull();
    },
  );

  test.each(['true', 1, 0, null, undefined])('isPrimary of %j is refused', (isPrimary) => {
    expect(readPointer({ ...FINGER, isPrimary }, AREA)).toBeNull();
  });

  test('a play area with no size reads nothing', () => {
    expect(readPointer(FINGER, { ...AREA, width: 0 })).toBeNull();
    expect(readPointer(FINGER, { ...AREA, height: Number.NaN })).toBeNull();
  });
});
