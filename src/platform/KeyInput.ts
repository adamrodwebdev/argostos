import { isHeldKey, readSteeringKey } from '../rules/keyInput';

/**
 * The arrow keys (or W A S D, Z Q S D on an AZERTY) steer the hero: their directions add up.
 * Codes are read at the door (an allow-list in a Map). Arrows and Space never scroll the page
 * (a portal's page around the game); Escape is never taken.
 */
export class KeyInput {
  private readonly held = new Map<string, { readonly dx: number; readonly dz: number }>();

  constructor(target: Window) {
    target.addEventListener('keydown', this.down);
    target.addEventListener('keyup', this.up);
    target.addEventListener('blur', this.release);
  }

  /** The direction held now (unit-less sums: −1 to 1 on each axis). */
  get dx(): number {
    let sum = 0;
    for (const direction of this.held.values()) sum += direction.dx;
    return Math.max(-1, Math.min(1, sum));
  }
  get dz(): number {
    let sum = 0;
    for (const direction of this.held.values()) sum += direction.dz;
    return Math.max(-1, Math.min(1, sum));
  }

  private readonly down = (event: KeyboardEvent): void => {
    if (isHeldKey(event.code)) event.preventDefault();
    const direction = readSteeringKey(event.code);
    if (direction && typeof event.code === 'string') this.held.set(event.code, direction);
  };

  private readonly up = (event: KeyboardEvent): void => {
    if (readSteeringKey(event.code) && typeof event.code === 'string') this.held.delete(event.code);
  };

  /** The window lost the focus: no key is held any more. */
  private readonly release = (): void => {
    this.held.clear();
  };
}
