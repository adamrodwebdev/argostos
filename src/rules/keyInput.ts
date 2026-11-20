import type { ActionId } from './combat';

/*
 * The keys that steer, by their place on the keyboard (`KeyboardEvent.code`): the arrows, and
 * W A S D where a QWERTY has them, which are Z Q S D on an AZERTY. Looked up in a Map, never in
 * a plain object: `constructor` or `__proto__` sent as a key code finds nothing.
 */

/** A direction held: x to the right, z up. */
export interface KeyDirection {
  readonly dx: number;
  readonly dz: number;
}

const LEFT: KeyDirection = { dx: -1, dz: 0 };
const RIGHT: KeyDirection = { dx: 1, dz: 0 };
const UP: KeyDirection = { dx: 0, dz: 1 };
const DOWN: KeyDirection = { dx: 0, dz: -1 };

export const STEERING_KEYS: ReadonlyMap<string, KeyDirection> = new Map([
  ['ArrowLeft', LEFT],
  ['ArrowRight', RIGHT],
  ['ArrowUp', UP],
  ['ArrowDown', DOWN],
  ['KeyA', LEFT],
  ['KeyD', RIGHT],
  ['KeyW', UP],
  ['KeyS', DOWN],
]);

/** What a key asks besides steering: an action (Space, J, K) or the pause (P, never Escape). */
export type KeyCommand = ActionId | 'pause';

/**
 * The keys of the actions, by their place on the keyboard: Space breathes the glass dome, J
 * rams, K strikes (the roadmap's keyboard-only keys; the mouse has its two buttons), P pauses.
 */
export const COMMAND_KEYS: ReadonlyMap<string, KeyCommand> = new Map<string, KeyCommand>([
  ['Space', 'breath'],
  ['KeyJ', 'ram'],
  ['KeyK', 'strike'],
  ['KeyP', 'pause'],
]);

/** Keys whose default the page stops while playing (they would scroll a portal's page). */
export const HELD_KEYS: ReadonlySet<string> = new Set([
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'ArrowDown',
  'Space',
]);

/** The longest key code read at all. */
const MAX_CODE_LENGTH = 32;

/** The direction a key code steers, or null for any other code (or anything not a code). */
export function readSteeringKey(code: unknown): KeyDirection | null {
  if (typeof code !== 'string' || code.length > MAX_CODE_LENGTH) return null;
  return STEERING_KEYS.get(code) ?? null;
}

/** The command a key code asks, or null for any other code (or anything not a code). */
export function readCommandKey(code: unknown): KeyCommand | null {
  if (typeof code !== 'string' || code.length > MAX_CODE_LENGTH) return null;
  return COMMAND_KEYS.get(code) ?? null;
}

/** True for a key the page keeps from scrolling (never Escape: it leaves fullscreen). */
export function isHeldKey(code: unknown): boolean {
  return typeof code === 'string' && code.length <= MAX_CODE_LENGTH && HELD_KEYS.has(code);
}
