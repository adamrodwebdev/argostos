/*
 * The world's measures: a side view of the desert in section, x to the right and z up, in
 * metres. Pure data: the logic builds the grid and steps the hunt from it, the design draws it.
 */

/** One simulation step: 60 a second, whatever the screen's refresh rate (60, 120, 144, 165 Hz). */
export const STEP_SECONDS = 1 / 60;
/**
 * The most steps one frame may run: after a stall (a tab switch, a slow frame) the hunt slows
 * down rather than jumping ahead, and a slow device never falls into a spiral of catching up.
 */
export const MAX_STEPS_PER_FRAME = 4;

/** The arena of a hunt: several screens wide, its sand deep enough to dive and hide. */
export const ARENA = {
  /** From the left exit to the right exit. */
  widthM: 160,
  /** Sand below the mean surface (z = 0), down to the bottom of the grid. */
  depthM: 48,
  /** Air kept in the grid above the mean surface: thrown sand flies and lands there. */
  airM: 14,
  /** The bedrock at the bottom: nothing digs it, nothing falls through it. */
  bedrockM: 2,
} as const;

/** How fine the sand is: the side of one cell, in metres (a closed set, read from the URL). */
export const GRID_DETAILS = ['coarse', 'standard', 'fine'] as const;
export type GridDetail = (typeof GRID_DETAILS)[number];

const CELL_M: ReadonlyMap<GridDetail, number> = new Map([
  ['coarse', 1 / 3],
  ['standard', 0.25],
  ['fine', 0.2],
]);

/** The side of one cell, in metres. */
export function cellSize(detail: GridDetail): number {
  return CELL_M.get(detail) ?? 0.25;
}

/** The grid's measures for a detail: its columns and rows, and where it sits in the world. */
export interface GridMeasures {
  readonly cellM: number;
  readonly columns: number;
  readonly rows: number;
  /** World height of the grid's top edge (row 0), in metres. */
  readonly topZ: number;
  /** World height of the grid's bottom edge. */
  readonly bottomZ: number;
  /** Rows of bedrock at the bottom. */
  readonly bedrockRows: number;
}

export function gridMeasures(detail: GridDetail): GridMeasures {
  const cellM = cellSize(detail);
  const columns = Math.round(ARENA.widthM / cellM);
  const rows = Math.round((ARENA.depthM + ARENA.airM) / cellM);
  return {
    cellM,
    columns,
    rows,
    topZ: ARENA.airM,
    bottomZ: ARENA.airM - rows * cellM,
    bedrockRows: Math.max(1, Math.round(ARENA.bedrockM / cellM)),
  };
}
