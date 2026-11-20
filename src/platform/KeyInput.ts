import { readBoolean, orElse } from '../rules/input';
import { isHeldKey, readCommandKey, readSteeringKey, type KeyCommand } from '../rules/keyInput';

/**
 * The arrow keys (or W A S D, Z Q S D on an AZERTY) steer the hero: their directions add up.
 * Space, J and K ask for the actions, P for the pause (a key held down asks once). Codes are
 * read at the door (an allow-list in a Map). While the hunt plays, arrows and Space never
 * scroll the page (a portal's page around the game); over a menu they work as usual, so a
 * focused button still answers Space. Escape is never taken.
 */
export class KeyInput {
  private readonly held = new Map<string, { readonly dx: number; readonly dz: number }>();
  private playing = true;

  constructor(
    target: Window,
    private readonly command: (command: KeyCommand) => void,
  ) {
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

  /** The hunt plays (true) or a menu is open (false: only the pause key counts). */
  setPlaying(playing: boolean): void {
    this.playing = playing;
    if (!playing) this.held.clear();
  }

  private readonly down = (event: KeyboardEvent): void => {
    const command = readCommandKey(event.code);
    const repeated = orElse(() => readBoolean(event.repeat, 'repeat'), true);
    if (!this.playing) {
      if (command === 'pause' && !repeated) this.command(command);
      return;
    }
    if (isHeldKey(event.code)) event.preventDefault();
    const direction = readSteeringKey(event.code);
    if (direction && typeof event.code === 'string') this.held.set(event.code, direction);
    if (command && !repeated) this.command(command);
  };

  private readonly up = (event: KeyboardEvent): void => {
    if (readSteeringKey(event.code) && typeof event.code === 'string') this.held.delete(event.code);
  };

  /** The window lost the focus: no key is held any more. */
  private readonly release = (): void => {
    this.held.clear();
  };
}
