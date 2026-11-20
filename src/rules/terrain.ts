import type { RandomSource } from './random';

/*
 * The shape of the desert when a hunt begins: rolling dunes over strata of sand. Pure: the
 * phases are drawn once from the hunt's seed, then every height is a function of x alone.
 */

/** Wavelengths (m) and heights (m) of the dunes, from the truck's test bench (seed 147). */
const DUNE_WAVES: readonly (readonly [amplitude: number, wavelength: number])[] = [
  [1.1, 70],
  [0.5, 27],
  [0.14, 7.5],
  [0.05, 3.1],
];

/**
 * Depths (m) of the strata's lower edges, from the mockup: thin near the surface, thicker deep
 * down. A grain keeps its stratum as it moves, so the worm's path shows in the layers it mixes.
 */
export const STRATA_DEPTHS: readonly number[] = [2.6, 5.4, 8.6, 12.5, 17, 22.5, 29, 36, 44, 53];
export const STRATA_COUNT = STRATA_DEPTHS.length + 1;

export class DuneProfile {
  private readonly amplitudes: Float64Array;
  private readonly wavenumbers: Float64Array;
  private readonly phases: Float64Array;

  constructor(random: RandomSource) {
    this.amplitudes = Float64Array.from(DUNE_WAVES, ([amplitude]) => amplitude);
    this.wavenumbers = Float64Array.from(
      DUNE_WAVES,
      ([, wavelength]) => (2 * Math.PI) / wavelength,
    );
    this.phases = Float64Array.from(DUNE_WAVES, () => random.next() * 2 * Math.PI);
  }

  /** Height of the sand's surface at x, around z = 0 (m). */
  height(x: number): number {
    let h = 0;
    for (let i = 0; i < this.amplitudes.length; i++) {
      h += this.amplitudes[i]! * Math.sin(this.wavenumbers[i]! * x + this.phases[i]!);
    }
    return h;
  }

  /**
   * The stratum of the sand at (x, z): 0 at the top. The layers follow the dunes, flatter with
   * depth, and wave a little on their own.
   */
  stratum(x: number, z: number): number {
    let depth = -z;
    depth += 0.45 * this.height(x) * Math.max(0, 1 - depth / 40);
    depth += 0.35 * Math.sin(x / 5.5 + depth * 0.05);
    let band = 0;
    while (band < STRATA_DEPTHS.length && depth > STRATA_DEPTHS[band]!) band++;
    return band;
  }
}
