import { GLASS } from '../palette';
import type { View } from '../View';

/** A point of the seam every this many metres of the hero's path, and how far it shows (m). */
const SPACING_M = 0.5;
const LENGTH_M = 14;
const CAPACITY = 128;
const ALPHA = 0.2;

/**
 * The warm seam the sand closes over behind him (the mockup's heat trail): the path his tail
 * left, glowing and fading over the last metres. The sand itself has already closed there; this
 * is only light.
 */
export class Seam {
  private readonly xs = new Float64Array(CAPACITY);
  private readonly zs = new Float64Array(CAPACITY);
  private readonly ds = new Float64Array(CAPACITY);
  private newest = -1;
  private count = 0;

  /** The tail passed (x, z) with `distance` metres swum so far. */
  mark(x: number, z: number, distance: number): void {
    if (this.count > 0 && distance - this.ds[this.newest]! < SPACING_M) return;
    this.newest = (this.newest + 1) % CAPACITY;
    this.xs[this.newest] = x;
    this.zs[this.newest] = z;
    this.ds[this.newest] = distance;
    this.count = Math.min(CAPACITY, this.count + 1);
  }

  draw(context: CanvasRenderingContext2D, view: View, width: number): void {
    if (this.count < 2) return;
    const [r, g, b] = GLASS.seam;
    const newest = this.ds[this.newest]!;
    context.lineCap = 'round';
    context.strokeStyle = `rgb(${r} ${g} ${b})`;
    for (let k = 1; k < this.count; k++) {
      const a = (this.newest - k + 1 + CAPACITY) % CAPACITY;
      const p = (a - 1 + CAPACITY) % CAPACITY;
      const behind = newest - this.ds[p]!;
      if (behind > LENGTH_M) break;
      const fade = 1 - behind / LENGTH_M;
      context.globalAlpha = ALPHA * fade;
      context.lineWidth = width * (0.5 + 0.5 * fade);
      context.beginPath();
      context.moveTo(view.screenX(this.xs[a]!), view.screenY(this.zs[a]!));
      context.lineTo(view.screenX(this.xs[p]!), view.screenY(this.zs[p]!));
      context.stroke();
    }
    context.globalAlpha = 1;
  }
}
