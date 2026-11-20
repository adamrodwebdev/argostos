import { isLoose } from '../../rules/elements';
import type { RandomSource } from '../../rules/random';
import type { GridMeasures } from '../../rules/world';
import type { SandGrid } from './SandGrid';
import type { SprayPool } from './SprayPool';

/** A throw of sand from the dunes' top round x: how wide, how much, how hard (m, m/s). */
export interface RimThrow {
  readonly x: number;
  /** Only sand above this height (m) is thrown: never the bottom of a hole. */
  readonly lowestZ: number;
  readonly reachM: number;
  readonly perColumn: number;
  /** Upward speed, and the sideways spread away from x. */
  readonly up: number;
  readonly spread: number;
  /** A velocity every grain also carries (a body that bursts out, a falling wheel). */
  readonly carryX: number;
  readonly carryZ: number;
}

/**
 * Throws real sand from the top of the dunes into the air (a burst out, a bite, a wheel that
 * lands): grains taken from the grid, flying in the spray pool, landing back as grains. The
 * desert keeps every one.
 */
export class SandThrower {
  constructor(
    private readonly grid: SandGrid,
    private readonly measures: GridMeasures,
    private readonly spray: SprayPool,
    private readonly random: RandomSource,
  ) {}

  /** Returns how many grains flew. */
  throwRim(rim: RimThrow): number {
    const { grid, measures, spray, random } = this;
    const { cellM, topZ } = measures;
    const reach = Math.max(1, Math.round(rim.reachM / cellM));
    const centre = Math.floor(rim.x / cellM);
    const lowestRow = Math.floor((topZ - rim.lowestZ) / cellM);
    let thrown = 0;
    for (let c = Math.max(0, centre - reach); c <= Math.min(grid.width - 1, centre + reach); c++) {
      const side = (c - centre) / reach;
      for (let n = 0; n < rim.perColumn && spray.hasRoom; n++) {
        const row = grid.surfaceRow(c);
        if (row > lowestRow || row >= grid.height) break;
        const i = grid.index(c, row);
        if (!isLoose(grid.elementAt(i))) break;
        const shade = grid.shades[i]!;
        grid.clear(i);
        spray.launch({
          x: (c + 0.5) * cellM,
          z: topZ - (row + 0.5) * cellM,
          vx: side * rim.spread + (random.next() - 0.5) * 2 + rim.carryX,
          vz: rim.up * (0.55 + 0.45 * random.next()) + rim.carryZ,
          shade,
        });
        thrown++;
      }
    }
    return thrown;
  }
}
