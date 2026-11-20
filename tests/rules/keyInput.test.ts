import { describe, expect, test } from 'vitest';
import { isHeldKey, readSteeringKey } from '../../src/rules/keyInput';

describe('readSteeringKey: keys steer by their place on the keyboard', () => {
  test.each([
    ['ArrowLeft', -1, 0],
    ['ArrowRight', 1, 0],
    ['ArrowUp', 0, 1],
    ['ArrowDown', 0, -1],
    // W A S D on a QWERTY, Z Q S D on an AZERTY: the same codes.
    ['KeyA', -1, 0],
    ['KeyD', 1, 0],
    ['KeyW', 0, 1],
    ['KeyS', 0, -1],
  ])('%s steers (%i, %i)', (code, dx, dz) => {
    expect(readSteeringKey(code)).toEqual({ dx, dz });
  });

  test.each([
    'KeyQ',
    'KeyZ',
    'Escape',
    'Space',
    'arrowleft',
    '',
    '__proto__',
    'constructor',
    'toString',
    'hasOwnProperty',
    'ArrowLeft'.repeat(10),
  ])('%s steers nothing', (code) => {
    expect(readSteeringKey(code)).toBeNull();
  });

  test.each([[42], [null], [undefined], [['ArrowLeft']], [{ toString: () => 'ArrowLeft' }]])(
    'a code that is not text (%j) steers nothing',
    (code) => {
      expect(readSteeringKey(code)).toBeNull();
    },
  );
});

describe('isHeldKey: the keys that would scroll a portal page', () => {
  test('arrows and Space are kept from scrolling', () => {
    expect(isHeldKey('ArrowDown')).toBe(true);
    expect(isHeldKey('Space')).toBe(true);
  });

  test('Escape is never taken (it leaves fullscreen), nor any other key', () => {
    expect(isHeldKey('Escape')).toBe(false);
    expect(isHeldKey('KeyW')).toBe(false);
    expect(isHeldKey('__proto__')).toBe(false);
    expect(isHeldKey(32)).toBe(false);
  });
});
