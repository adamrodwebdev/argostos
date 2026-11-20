import { Element } from '../../rules/elements';
import type { GridMeasures } from '../../rules/world';
import type { SandGrid } from './SandGrid';

/** What a point of the world holds, as a body feels it. */
export const Feel = {
  /** Air, or outside the grid. */
  Open: 0,
  /** A grain or the rock. */
  Grain: 1,
  /** A cell a body fills (the worm's own). */
  Body: 2,
} as const;
export type FeelId = (typeof Feel)[keyof typeof Feel];

/** Reads the grid at world points (m), for the bodies that move through it. */
export class GridProbe {
  constructor(
    private readonly grid: SandGrid,
    private readonly measures: GridMeasures,
  ) {}

  feel(x: number, z: number): FeelId {
    const { cellM, topZ } = this.measures;
    const column = Math.floor(x / cellM);
    const row = Math.floor((topZ - z) / cellM);
    if (!this.grid.contains(column, row)) return Feel.Open;
    const i = this.grid.index(column, row);
    if (this.grid.isBlocked(i)) return Feel.Body;
    return this.grid.elementAt(i) === Element.Air ? Feel.Open : Feel.Grain;
  }
}
