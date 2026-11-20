import type { Box } from '../truck/Truck';
import { distanceToBox, type Target } from './Target';

/**
 * The machines the hero can hit this step (the trucks on the sand, the drones in the air),
 * gathered once a step into one list: the ram, the strike and the rocks look through it.
 */
export class Targets {
  private readonly list: Target[] = [];
  private readonly box: Box = { left: 0, right: 0, bottom: 0, top: 0 };
  private nearestDistance = Number.POSITIVE_INFINITY;

  constructor(private readonly sources: readonly (() => readonly Target[])[]) {}

  /** The hittable machines, as of the last refresh. */
  get all(): readonly Target[] {
    return this.list;
  }

  /** How far the machine `nearest` found lies (m; infinite when it found none). */
  get lastDistance(): number {
    return this.nearestDistance;
  }

  /** Gathers the hittable machines now. */
  refresh(): void {
    this.list.length = 0;
    for (const source of this.sources) {
      for (const target of source()) if (target.hittable) this.list.push(target);
    }
  }

  /** The machine whose body lies nearest (x, z), or null (its distance: `lastDistance`). */
  nearest(x: number, z: number): Target | null {
    let best: Target | null = null;
    this.nearestDistance = Number.POSITIVE_INFINITY;
    for (const target of this.list) {
      target.bodyBox(this.box);
      const distance = distanceToBox(x, z, this.box);
      if (distance < this.nearestDistance) {
        this.nearestDistance = distance;
        best = target;
      }
    }
    return best;
  }
}
