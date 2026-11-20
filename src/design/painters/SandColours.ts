import { STRATA_COUNT, STRATA_DEPTHS } from '../../rules/terrain';
import type { GridMeasures } from '../../rules/world';
import { stratumOf } from '../../logic/sand/TerrainBuilder';
import {
  DEPTH_SHADOW,
  GRAIN_CONTRAST,
  ROCK,
  SAND_DEPTH_STOPS,
  STRATUM_CONTRAST,
  type Rgb,
} from '../palette';

/** Shades a grain may carry: 16 strata × 4 grains. */
export const SHADES = 64;

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
 * The colours of the sand and the bedrock, by row of the grid (the light fades with depth) and
 * by shade (a grain's stratum and its own small variation): made once, packed for image data.
 * The arena's sand and the desert past its exits share them, so the two meet without a seam.
 */
export class SandColours {
  private readonly sand: Uint32Array;
  private readonly rock: Uint32Array;

  constructor(measures: GridMeasures) {
    const { rows, cellM, topZ, bottomZ } = measures;
    this.sand = new Uint32Array(rows * SHADES);
    this.rock = new Uint32Array(rows * 4);
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
        this.rock[y * 4 + grain] = pack(ROCK, light * (1 + (grain - 1.5) * 0.04));
      }
    }
  }

  /** A grain of sand of `shade` on row `y`. */
  sandAt(y: number, shade: number): number {
    return this.sand[y * SHADES + shade]!;
  }

  /** Bedrock of `grain` (0 to 3) on row `y`. */
  rockAt(y: number, grain: number): number {
    return this.rock[y * 4 + (grain & 3)]!;
  }
}
