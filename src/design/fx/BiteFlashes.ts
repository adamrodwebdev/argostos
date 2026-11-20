import { BITE_FLASH } from '../palette';
import type { View } from '../View';

const MAX_FLASHES = 4;
/** A flash lasts this long (s) and spreads this far (m). */
const FLASH_SECONDS = 0.28;
const FLASH_REACH_M = 4.5;

/**
 * The flash when the jaws close on a truck: a bright ring that spreads and fades in a quarter
 * of a second, where the bite happened. Under reduced motion it is not drawn.
 */
export class BiteFlashes {
  private readonly xs = new Float64Array(MAX_FLASHES);
  private readonly zs = new Float64Array(MAX_FLASHES);
  private readonly ages = new Float64Array(MAX_FLASHES).fill(FLASH_SECONDS);
  private next = 0;

  constructor(private readonly reducedMotion: boolean) {}

  flash(x: number, z: number): void {
    if (this.reducedMotion) return;
    const i = this.next;
    this.next = (i + 1) % MAX_FLASHES;
    this.xs[i] = x;
    this.zs[i] = z;
    this.ages[i] = 0;
  }

  frame(dt: number): void {
    for (let i = 0; i < MAX_FLASHES; i++) this.ages[i] = this.ages[i]! + dt;
  }

  draw(context: CanvasRenderingContext2D, view: View): void {
    const [r, g, b] = BITE_FLASH;
    context.strokeStyle = `rgb(${r} ${g} ${b})`;
    for (let i = 0; i < MAX_FLASHES; i++) {
      const t = this.ages[i]! / FLASH_SECONDS;
      if (t >= 1) continue;
      context.globalAlpha = 0.85 * (1 - t);
      context.lineWidth = Math.max(2, 0.35 * view.scale * (1 - t));
      context.beginPath();
      context.arc(
        view.screenX(this.xs[i]!),
        view.screenY(this.zs[i]!),
        (0.6 + t) * FLASH_REACH_M * view.scale * 0.6,
        0,
        Math.PI * 2,
      );
      context.stroke();
    }
    context.globalAlpha = 1;
  }
}
