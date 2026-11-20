import { STRATA_COUNT, STRATA_DEPTHS } from '../../rules/terrain';
import type { GridMeasures } from '../../rules/world';
import { stratumOf } from '../../logic/sand/TerrainBuilder';
import {
  DEPTH_SHADOW,
  FOUNDATION,
  GRAIN_CONTRAST,
  ROCK,
  SAND_DEPTH_STOPS,
  STRATUM_CONTRAST,
  type Rgb,
} from '../palette';

/** Shades a grain may carry: 16 strata × 4 grains. */
export const SHADES = 64;
/** Shades of rock: the bedrock's four, then the four of the concrete under the exit gates. */
const ROCK_SHADES = 8;

/** A colour packed for an `ImageData` seen as 32-bit words (little-endian: ABGR). */
function pack({ r, g, b }: Rgb, light: number): number {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * light)));
  return ((255 << 24) | (c(b) << 16) | (c(g) << 8) | c(r)) >>> 0;
}

/** The sand's colour at a depth (m), along the mockup's four stops over 46 m. */
function sandAt(depth: number): Rgb {
  const stops = SAND_DEPTH_STOPS;
  const t = Math.min(0.999, Math.max(0, depth / 46)) * (stops.length - 1);
  const i = Math.floor(t);
  const a = stops[i]!;
  const b = stops[Math.min(stops.length - 1, i + 1)]!;
  const f = t - i;
  return { r: a.r + (b.r - a.r) * f, g: a.g + (b.g - a.g) * f, b: a.b + (b.b - a.b) * f };
}

/** Middle depth of each stratum (m): its colour, carried by its grains wherever they go. */
function stratumDepth(stratum: number): number {
  const top = stratum === 0 ? 0 : STRATA_DEPTHS[stratum - 1]!;
  const bottom = STRATA_DEPTHS[stratum] ?? top + 8;
  return (top + bottom) / 2;
}

/**
 * The colours of the sand and the rock, by row of the grid (the light fades with depth) and by
 * shade (a grain's stratum and its own small variation; the bedrock, or the Company's concrete
 * under the exit gates): made once, packed for image data. The arena's sand and the desert past
 * its exits share them, so the two meet without a seam.
 */
export class SandColours {
  private readonly sand: Uint32Array;
  private readonly rock: Uint32Array;

  constructor(measures: GridMeasures) {
    const { rows, cellM, topZ, bottomZ } = measures;
    this.sand = new Uint32Array(rows * SHADES);
    this.rock = new Uint32Array(rows * ROCK_SHADES);
    for (let y = 0; y < rows; y++) {
      const z = topZ - (y + 0.5) * cellM;
      const light = 1 - DEPTH_SHADOW * Math.min(1, Math.max(0, -z / -bottomZ));
      for (let shade = 0; shade < SHADES; shade++) {
        const stratum = Math.min(STRATA_COUNT - 1, stratumOf(shade));
        const band = stratum % 2 === 0 ? STRATUM_CONTRAST : -STRATUM_CONTRAST;
        const grain = (((shade & 3) - 1.5) / 1.5) * GRAIN_CONTRAST;
        this.sand[y * SHADES + shade] = pack(
          sandAt(stratumDepth(stratum)),
          light * (1 + band + grain),
        );
      }
      for (let grain = 0; grain < 4; grain++) {
        this.rock[y * ROCK_SHADES + grain] = pack(ROCK, light * (1 + (grain - 1.5) * 0.04));
        this.rock[y * ROCK_SHADES + 4 + grain] = pack(
          FOUNDATION,
          light * (1 + (grain - 1.5) * 0.03),
        );
      }
    }
  }

  /** A grain of sand of `shade` on row `y`. */
  sandAt(y: number, shade: number): number {
    return this.sand[y * SHADES + shade]!;
  }

  /** Rock of `shade` on row `y`: the bedrock (0 to 3) or the gates' concrete (4 to 7). */
  rockAt(y: number, shade: number): number {
    return this.rock[y * ROCK_SHADES + (shade & (ROCK_SHADES - 1))]!;
  }
}
