import { BURST, DIGGING, SPRAY } from '../../rules/digging';
import { Element, isLoose } from '../../rules/elements';
import type { RandomSource } from '../../rules/random';
import type { GridMeasures } from '../../rules/world';
import type { SandGrid } from '../sand/SandGrid';
import { SandThrower } from '../sand/SandThrower';
import type { SprayPool } from '../sand/SprayPool';
import type { HeroBody } from './HeroBody';

/** The world the hero digs: its grid, the grid's measures, the pool of thrown sand, chance. */
export interface DiggingWorld {
  readonly grid: SandGrid;
  readonly measures: GridMeasures;
  readonly spray: SprayPool;
  readonly random: RandomSource;
}

/** The head's velocity (m/s), for the sand it throws. */
export interface Velocity {
  readonly x: number;
  readonly z: number;
}

/**
 * The cells the hero's body fills, step by step, and what happens to the sand there. A cell the
 * body enters gives up its grain: pushed into a gap close by, thrown when the gap is open air,
 * or carried round the body. A cell the body leaves is unblocked and filled from what it
 * carries, so the wake closes behind him; what it cannot fill, the sand above falls into. The
 * desert's sand is always the grid's, the carried and the thrown: nothing is made or lost.
 */
export class HeroDigging {
  /** The step at which each cell was last filled by the body. */
  private readonly filledAt: Uint32Array;
  private filled: Int32Array;
  private filledCount = 0;
  private wasFilled: Int32Array;
  private wasFilledCount = 0;
  private steps = 0;
  /** Shades of the grains carried round the body, first in first out. */
  private readonly carried = new Uint8Array(DIGGING.carriedMax);
  private carriedHead = 0;
  private carriedCount = 0;
  /** The head's velocity this step (the sand it throws flies along with it). */
  private velocity: Velocity = { x: 0, z: 0 };
  private readonly thrower: SandThrower;

  constructor(private readonly world: DiggingWorld) {
    const { columns, rows } = world.measures;
    this.thrower = new SandThrower(world.grid, world.measures, world.spray, world.random);
    this.filledAt = new Uint32Array(columns * rows);
    this.filled = new Int32Array(8192);
    this.wasFilled = new Int32Array(8192);
  }

  /** Grains carried round the body now (they are still the desert's). */
  get carriedGrains(): number {
    return this.carriedCount;
  }

  /** Cells the body fills now. */
  get filledCells(): number {
    return this.filledCount;
  }

  /** The body moved: fills the cells it now covers, frees those it left. */
  dig(body: HeroBody, velocity: Velocity): void {
    this.steps++;
    this.velocity = velocity;
    const swap = this.wasFilled;
    this.wasFilled = this.filled;
    this.filled = swap;
    this.wasFilledCount = this.filledCount;
    this.filledCount = 0;
    const { fillXs, fillZs, fillRadii } = body;
    for (let k = 0; k < fillXs.length; k++) this.fillDisc(fillXs[k]!, fillZs[k]!, fillRadii[k]!);
    this.leave();
  }

  private fillDisc(x: number, z: number, radius: number): void {
    const { grid, measures } = this.world;
    const { cellM, topZ } = measures;
    const cx = x / cellM;
    const cy = (topZ - z) / cellM;
    const r = radius / cellM;
    const r2 = r * r;
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(grid.height - 1, Math.floor(cy + r));
    const x0 = Math.max(0, Math.floor(cx - r));
    const x1 = Math.min(grid.width - 1, Math.floor(cx + r));
    for (let gy = y0; gy <= y1; gy++) {
      const dy = gy + 0.5 - cy;
      for (let gx = x0; gx <= x1; gx++) {
        const dx = gx + 0.5 - cx;
        if (dx * dx + dy * dy > r2) continue;
        const i = grid.index(gx, gy);
        const before = this.filledAt[i]!;
        if (before === this.steps || grid.elementAt(i) === Element.Rock) continue;
        if (this.filledCount >= this.filled.length) return;
        this.filledAt[i] = this.steps;
        this.filled[this.filledCount++] = i;
        if (before === this.steps - 1 && before !== 0) continue;
        if (isLoose(grid.elementAt(i))) this.pushAside(i, dx, dy);
        grid.block(i);
      }
    }
  }

  /**
   * He bursts out of the sand at (x, z), or plunges back in: the rim of the hole is thrown up,
   * harder for a stronger burst. Grains come from the top of the rim's columns (never from the
   * bottom of his own hole), so the desert keeps them all.
   */
  burst(x: number, z: number, strength: number): void {
    this.thrower.throwRim({
      x,
      lowestZ: z - BURST.rimDepthM,
      reachM: BURST.reachM,
      perColumn: BURST.grainsPerColumn,
      up: BURST.up * strength,
      spread: BURST.spread * strength,
      carryX: this.velocity.x * 0.4,
      carryZ: Math.max(0, this.velocity.z) * 0.2,
    });
  }

  /** The body left these cells: they open, and what it carries flows back into them. */
  private leave(): void {
    const { grid } = this.world;
    for (let n = 0; n < this.wasFilledCount; n++) {
      const i = this.wasFilled[n]!;
      if (this.filledAt[i] === this.steps) continue;
      grid.unblock(i);
      if (this.carriedCount > 0 && grid.isFree(i)) grid.place(i, Element.Sand, this.takeCarried());
    }
  }

  /**
   * The grain at cell i (offset dx, dy in cells from the centre of the disc that took it) leaves
   * for a gap along the same line outward; into the open air it is thrown; with no gap it is
   * carried round the body.
   */
  private pushAside(i: number, dx: number, dy: number): void {
    const { grid } = this.world;
    const shade = grid.shades[i]!;
    grid.clear(i);
    const length = Math.hypot(dx, dy);
    const ux = length > 1e-6 ? dx / length : 0;
    const uy = length > 1e-6 ? dy / length : -1;
    const x = i % grid.width;
    const y = (i - x) / grid.width;
    for (let k = 1; k <= DIGGING.pushReach; k++) {
      const gx = Math.floor(x + 0.5 + ux * k);
      const gy = Math.floor(y + 0.5 + uy * k);
      if (!grid.contains(gx, gy)) break;
      const gap = grid.index(gx, gy);
      if (!grid.isFree(gap)) continue;
      // Rows grow downward: the world's outward direction has z = −uy.
      if (this.isOpenAir(gap) && this.world.spray.hasRoom)
        this.throwGrain(gap, { x: ux, z: -uy }, shade);
      else grid.place(gap, Element.Sand, shade);
      return;
    }
    this.carry(shade, x);
  }

  /** A free cell under a free cell (or the sky): sand pushed there flies rather than rests. */
  private isOpenAir(gap: number): boolean {
    const { grid } = this.world;
    return gap < grid.width || grid.elementAt(gap - grid.width) === Element.Air;
  }

  /** Throws the grain from cell `gap`, outward and along with the hero. */
  private throwGrain(gap: number, outward: Velocity, shade: number): void {
    const { grid, measures, random, spray } = this.world;
    const { cellM, topZ } = measures;
    const gx = gap % grid.width;
    const gy = (gap - gx) / grid.width;
    const { velocity } = this;
    const push = SPRAY.base + SPRAY.perSpeed * Math.hypot(velocity.x, velocity.z);
    spray.launch({
      x: (gx + 0.5) * cellM,
      z: topZ - (gy + 0.5) * cellM,
      vx: outward.x * push + velocity.x * SPRAY.carry + (random.next() - 0.5) * 2 * SPRAY.jitter,
      vz: outward.z * push + velocity.z * SPRAY.carry + (random.next() - 0.5) * 2 * SPRAY.jitter,
      shade,
    });
  }

  /** Carries a grain round the body; when it carries too many, the grain goes on the sand's top. */
  private carry(shade: number, column: number): void {
    if (this.carriedCount < this.carried.length) {
      this.carried[(this.carriedHead + this.carriedCount) % this.carried.length] = shade;
      this.carriedCount++;
      return;
    }
    const { grid } = this.world;
    for (let y = grid.surfaceRow(column) - 1; y >= 0; y--) {
      const i = grid.index(column, y);
      if (!grid.isFree(i)) continue;
      grid.place(i, Element.Sand, shade);
      return;
    }
  }

  private takeCarried(): number {
    const shade = this.carried[this.carriedHead]!;
    this.carriedHead = (this.carriedHead + 1) % this.carried.length;
    this.carriedCount--;
    return shade;
  }
}
