import { Element } from '../../rules/elements';
import type { RandomSource } from '../../rules/random';
import type { DuneProfile } from '../../rules/terrain';
import type { GridMeasures } from '../../rules/world';
import { SandGrid } from './SandGrid';

/** A grain's shade: its stratum in the high bits, a small random grain in the two low bits. */
export function shadeOf(stratum: number, grain: number): number {
  return ((stratum & 0x0f) << 2) | (grain & 3);
}

/** The stratum a shade carries. */
export function stratumOf(shade: number): number {
  return (shade >> 2) & 0x0f;
}

/**
 * Lays the desert of a new hunt into a grid: the dunes' sand over the bedrock, air above. The
 * dunes are gentler than the sand's own slope (45° in a grid), so the desert starts at rest.
 */
export class TerrainBuilder {
  constructor(
    private readonly measures: GridMeasures,
    private readonly profile: DuneProfile,
  ) {}

  build(random: RandomSource): SandGrid {
    const { columns, rows, cellM, topZ, bedrockRows } = this.measures;
    const grid = new SandGrid(columns, rows);
    for (let x = 0; x < columns; x++) {
      const worldX = (x + 0.5) * cellM;
      const surface = this.profile.height(worldX);
      for (let y = 0; y < rows; y++) {
        const i = grid.index(x, y);
        if (y >= rows - bedrockRows) {
          grid.place(i, Element.Rock, random.nextInt(4));
          continue;
        }
        const z = topZ - (y + 0.5) * cellM;
        if (z > surface) continue;
        grid.place(i, Element.Sand, shadeOf(this.profile.stratum(worldX, z), random.nextInt(4)));
      }
    }
    return grid;
  }
}
