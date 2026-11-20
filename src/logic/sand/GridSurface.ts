import type { GridMeasures } from '../../rules/world';
import type { SandGrid } from './SandGrid';

/** The height of the sand under any x: what bodies and wheels rest on. */
export interface SandSurface {
  /** Height (m) of the sand's top at x, smoothed between the centres of two columns. */
  heightAt(x: number): number;
}

/**
 * The sand's surface read from the grid: the top of the first grain of each column, joined by
 * straight lines from one column's centre to the next, so a wheel rolls instead of stepping
 * from cell to cell.
 */
export class GridSurface implements SandSurface {
  constructor(
    private readonly grid: SandGrid,
    private readonly measures: GridMeasures,
  ) {}

  /** Height of the top of column `column`'s sand (m). */
  columnTop(column: number): number {
    const { cellM, topZ } = this.measures;
    return topZ - this.grid.surfaceRow(column) * cellM;
  }

  heightAt(x: number): number {
    const { cellM, columns } = this.measures;
    const u = x / cellM - 0.5;
    const left = Math.max(0, Math.min(columns - 1, Math.floor(u)));
    const right = Math.min(columns - 1, left + 1);
    const t = Math.min(1, Math.max(0, u - left));
    return this.columnTop(left) * (1 - t) + this.columnTop(right) * t;
  }
}
