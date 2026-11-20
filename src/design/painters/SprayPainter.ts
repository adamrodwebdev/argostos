import type { SprayPool } from '../../logic/sand/SprayPool';
import { SPRAY_COLOUR } from '../palette';
import type { View } from '../View';

/** Sand in flight: each thrown grain drawn as a small square of sand, a cell's size. */
export class SprayPainter {
  constructor(
    private readonly spray: SprayPool,
    private readonly cellM: number,
  ) {}

  draw(context: CanvasRenderingContext2D, view: View): void {
    if (this.spray.airborne === 0) return;
    const { xs, zs, alive, capacity } = this.spray;
    const size = Math.max(1, this.cellM * view.scale);
    const half = size / 2;
    context.fillStyle = SPRAY_COLOUR;
    for (let p = 0; p < capacity; p++) {
      if (alive[p] === 0) continue;
      context.fillRect(view.screenX(xs[p]!) - half, view.screenY(zs[p]!) - half, size, size);
    }
  }
}
