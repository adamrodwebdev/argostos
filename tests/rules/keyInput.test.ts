import { describe, expect, test } from 'vitest';
import { isHeldKey, readCommandKey, readSteeringKey } from '../../src/rules/keyInput';

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

describe('readCommandKey: the actions and the pause have their keys', () => {
  test.each([
    ['Space', 'breath'],
    ['KeyJ', 'ram'],
    ['KeyK', 'strike'],
    ['KeyP', 'pause'],
  ])('%s asks for %s', (code, command) => {
    expect(readCommandKey(code)).toBe(command);
  });

  test.each([
    'Escape',
    'KeyL',
    'space',
    'ArrowUp',
    '',
    '__proto__',
    'constructor',
    'valueOf',
    'Space'.repeat(10),
  ])('%s asks for nothing', (code) => {
    expect(readCommandKey(code)).toBeNull();
  });

  test.each([[32], [null], [true], [['Space']], [{ toString: () => 'Space' }]])(
    'a code that is not text (%j) asks for nothing',
    (code) => {
      expect(readCommandKey(code)).toBeNull();
    },
  );
});
