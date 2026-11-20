import {
  readMouseButton,
  readPointer,
  type MouseButton,
  type PlayArea,
  type PointerSample,
} from '../rules/pointerInput';

/** What the pointer tells the game besides where it steers. */
export interface PointerHandlers {
  /** A mouse button pressed on the play area (left: ram, right: strike). */
  button(button: MouseButton): void;
  /** The player touched or moved over the game (the first gesture). */
  gesture(): void;
}

/**
 * The finger or the pointer that steers, read from the canvas's pointer events at the door
 * (`readPointer`): a mouse steers by hovering, a finger or a pen while it touches. Only the first
 * finger steers (the thumb's buttons are elements of their own). A mouse's left button rams and
 * its right button strikes. A cancelled touch (iOS taking it over for a gesture) counts as
 * lifted.
 */
export class PointerInput {
  private steering: number | null = null;
  private x = 0;
  private y = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly area: () => PlayArea,
    private readonly handlers: PointerHandlers,
  ) {
    canvas.addEventListener('pointerdown', this.down);
    canvas.addEventListener('pointermove', this.move);
    canvas.addEventListener('pointerup', this.up);
    canvas.addEventListener('pointercancel', this.up);
    canvas.addEventListener('pointerleave', this.leave);
  }

  /** True while someone steers; then `targetX` and `targetY` say where (CSS px in the canvas). */
  get active(): boolean {
    return this.steering !== null;
  }
  get targetX(): number {
    return this.x;
  }
  get targetY(): number {
    return this.y;
  }

  private read(event: PointerEvent): PointerSample | null {
    return readPointer(event, this.area());
  }

  private readonly down = (event: PointerEvent): void => {
    const sample = this.read(event);
    if (!sample) return;
    this.handlers.gesture();
    if (sample.kind === 'mouse') {
      const pressed = readMouseButton(event.button);
      if (pressed) this.handlers.button(pressed);
    }
    if (this.steering !== null && this.steering !== sample.id) return;
    this.steering = sample.id;
    this.x = sample.x;
    this.y = sample.y;
    // The finger keeps steering even when it slides off the canvas's edge.
    if (sample.kind !== 'mouse') this.capture(sample.id);
  };

  private readonly move = (event: PointerEvent): void => {
    const sample = this.read(event);
    if (!sample) return;
    if (sample.kind === 'mouse' && this.steering === null) {
      this.steering = sample.id;
      this.handlers.gesture();
    }
    if (this.steering !== sample.id) return;
    this.x = sample.x;
    this.y = sample.y;
  };

  private readonly up = (event: PointerEvent): void => {
    const sample = this.read(event);
    if (sample === null) return;
    if (sample.id !== this.steering) return;
    // A mouse lifted still hovers: it goes on steering.
    if (sample.kind === 'mouse' && event.type === 'pointerup') return;
    this.steering = null;
  };

  private readonly leave = (event: PointerEvent): void => {
    const sample = this.read(event);
    if (sample?.kind === 'mouse' && sample.id === this.steering) this.steering = null;
  };

  private capture(id: number): void {
    try {
      this.canvas.setPointerCapture(id);
    } catch {
      // A pointer already gone cannot be captured: nothing to steer then.
    }
  }
}
