/*
 * Runes and relics, a place kept in the code for after the game is accepted (the user's
 * decision of 20 November): Argostos traces a rune with his own path through the sand, the
 * glass trail glows, the game recognises the shape and a short boost follows; the runes are
 * unlocked by glass relics he digs up and the elders decode. Types and empty tables only: no
 * behaviour, no interface yet. A rune will be one more row, its recogniser a strategy behind
 * `RunePort`.
 */

/** The runes that exist (none yet). */
export const RUNE_IDS = [] as const;
export type RuneId = (typeof RUNE_IDS)[number];

/** The relics that exist (none yet). */
export const RELIC_IDS = [] as const;
export type RelicId = (typeof RELIC_IDS)[number];

/** What a rune's boost does (none yet: a closed set like the others once they come). */
export const RUNE_BOOST_IDS = [] as const;
export type RuneBoostId = (typeof RUNE_BOOST_IDS)[number];

export interface RuneRow {
  /** The shape to trace: points (m) relative to its start, in order. */
  readonly shape: readonly (readonly [x: number, z: number])[];
  /** How close a traced path must stay to the shape (m). */
  readonly toleranceM: number;
  /** The boost it gives, and for how long (s). */
  readonly boost: RuneBoostId;
  readonly seconds: number;
  /** The relic that unlocks it. */
  readonly relic: RelicId;
}

export interface RelicRow {
  /** The rune the elders decode from it. */
  readonly rune: RuneId;
  /** How deep it lies in the sand of a hunt (m below the surface). */
  readonly depthM: number;
}

export const RUNES: ReadonlyMap<RuneId, RuneRow> = new Map<RuneId, RuneRow>();
export const RELICS: ReadonlyMap<RelicId, RelicRow> = new Map<RelicId, RelicRow>();
