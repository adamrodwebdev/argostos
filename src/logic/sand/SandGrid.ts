import { Element, Matter, MATTER_OF, type ElementId } from '../../rules/elements';
import type { RandomSource } from '../../rules/random';

/** Chunks of 16 × 16 cells sleep while nothing moves in them (and wake when something does). */
export const CHUNK_SHIFT = 4;
const CHUNK = 1 << CHUNK_SHIFT;

/**
 * The falling sand of the arena, ported from Lumirift's well and scaled up: one cell per grain,
 * row 0 at the top. Sand falls, then slides down a side; rock holds still; a body (the worm)
 * blocks the cells it fills, so no grain enters them. Typed arrays only, nothing allocated
 * while it steps.
 *
 * What Lumirift's well did not need: the arena is dozens of times larger, so it is cut into
 * chunks that sleep. Each step simulates only the chunks where something moved (or was changed
 * from outside) the step before; a resting desert costs a few thousand byte reads. The sweep
 * still runs bottom to top, its direction alternating by row, so nothing leans to one side.
 */
export class SandGrid {
  readonly width: number;
  readonly height: number;
  readonly chunkColumns: number;
  readonly chunkRows: number;
  /** The element of each cell (0: air). */
  readonly cells: Uint8Array;
  /** A value each grain carries with it (its stratum and grain), read by the painter. */
  readonly shades: Uint8Array;
  /** Cells held by a body: no grain may move into them. */
  private readonly blocked: Uint8Array;
  private readonly movedAt: Uint32Array;
  /** Chunks to simulate this step, and those woken for the next. */
  private running: Uint8Array;
  private waking: Uint8Array;
  /** Chunks changed since the painter last drew them. */
  private readonly changed: Uint8Array;
  private steps = 0;

  constructor(width: number, height: number) {
    if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 2 || height < 2) {
      throw new RangeError(`grid size must be whole and at least 2 × 2: ${width} × ${height}`);
    }
    this.width = width;
    this.height = height;
    this.chunkColumns = Math.ceil(width / CHUNK);
    this.chunkRows = Math.ceil(height / CHUNK);
    const size = width * height;
    const chunks = this.chunkColumns * this.chunkRows;
    this.cells = new Uint8Array(size);
    this.shades = new Uint8Array(size);
    this.blocked = new Uint8Array(size);
    this.movedAt = new Uint32Array(size);
    this.running = new Uint8Array(chunks);
    this.waking = new Uint8Array(chunks);
    this.changed = new Uint8Array(chunks).fill(1);
  }

  /** Steps simulated so far. */
  get stepCount(): number {
    return this.steps;
  }

  index(x: number, y: number): number {
    return y * this.width + x;
  }

  contains(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  elementAt(i: number): ElementId {
    return this.cells[i]! as ElementId;
  }

  /** No grain and no body there: a grain may move in. */
  isFree(i: number): boolean {
    return this.cells[i] === Element.Air && this.blocked[i] === 0;
  }

  isBlocked(i: number): boolean {
    return this.blocked[i] === 1;
  }

  /** Puts a grain (the terrain, sand pushed aside or landing); the cell must be free. */
  place(i: number, element: ElementId, shade: number): void {
    this.cells[i] = element;
    this.shades[i] = shade;
    this.touch(i);
  }

  /** Takes the grain out of a cell (a body pushes it aside). */
  clear(i: number): void {
    this.cells[i] = Element.Air;
    this.shades[i] = 0;
    this.touch(i);
  }

  /** A body now fills this cell (it must hold no grain): grains stay out of it. */
  block(i: number): void {
    this.blocked[i] = 1;
  }

  /** The body left this cell: the grains around may flow into it. */
  unblock(i: number): void {
    this.blocked[i] = 0;
    this.touch(i);
  }

  /**
   * The row of the first grain from the top in column x (the height of the sand there; a body's
   * cells hold no grain and never count). `height` when the column is empty.
   */
  surfaceRow(x: number): number {
    const column = Math.max(0, Math.min(this.width - 1, x));
    const { cells, width, height } = this;
    for (let y = 0, i = column; y < height; y++, i += width) {
      if (cells[i] !== Element.Air) return y;
    }
    return height;
  }

  /** Grains of one element in the whole grid (tests, the mass check). */
  count(element: ElementId): number {
    let n = 0;
    for (const cell of this.cells) if (cell === element) n++;
    return n;
  }

  /** Chunks the last step simulated (the debug readout). */
  runningChunks(): number {
    let n = 0;
    for (const chunk of this.running) n += chunk;
    return n;
  }

  /**
   * Writes the chunks changed since the last call into `out` (chunk indices) and forgets them:
   * the painter redraws only those. Returns how many were written.
   */
  drainChanged(out: Int32Array): number {
    let n = 0;
    const { changed } = this;
    for (let c = 0; c < changed.length && n < out.length; c++) {
      if (changed[c] === 0) continue;
      changed[c] = 0;
      out[n++] = c;
    }
    return n;
  }

  /** A fingerprint of every cell and shade (FNV-1a): two equal hunts give the same one. */
  fingerprint(): number {
    let hash = 0x811c9dc5;
    const { cells, shades } = this;
    for (let i = 0; i < cells.length; i++) {
      hash = Math.imul(hash ^ cells[i]!, 0x01000193);
      hash = Math.imul(hash ^ shades[i]!, 0x01000193);
    }
    return hash >>> 0;
  }

  /** One step of the sand: returns how many grains moved. */
  simulate(random: RandomSource): number {
    this.steps++;
    const run = this.waking;
    this.waking = this.running;
    this.running = run;
    this.waking.fill(0);
    const { width: W, height: H, cells, movedAt, chunkColumns: CW } = this;
    const step = this.steps;
    let moved = 0;
    for (let y = H - 1; y >= 0; y--) {
      const rowChunks = (y >> CHUNK_SHIFT) * CW;
      const forward = ((y + step) & 1) === 0;
      for (let c = 0; c < CW; c++) {
        const cx = forward ? c : CW - 1 - c;
        if (run[rowChunks + cx] === 0) continue;
        const x0 = cx << CHUNK_SHIFT;
        const x1 = Math.min(W, x0 + CHUNK);
        for (let k = x0; k < x1; k++) {
          const x = forward ? k : x0 + x1 - 1 - k;
          const i = y * W + x;
          const element = cells[i]!;
          if (element === Element.Air || movedAt[i] === step) continue;
          if (MATTER_OF[element] !== Matter.Powder) continue;
          if (this.fall(i, x, y, random)) moved++;
        }
      }
    }
    return moved;
  }

  /** Falls straight down, or slides down a side (a random side when both are open). */
  private fall(i: number, x: number, y: number, random: RandomSource): boolean {
    if (y >= this.height - 1) return false;
    const below = i + this.width;
    if (this.isFree(below)) {
      this.move(i, below);
      return true;
    }
    const left = x > 0 && this.isFree(below - 1);
    const right = x < this.width - 1 && this.isFree(below + 1);
    if (!left && !right) return false;
    const goLeft = left && right ? random.next() < 0.5 : left;
    this.move(i, goLeft ? below - 1 : below + 1);
    return true;
  }

  private move(from: number, to: number): void {
    const { cells, shades } = this;
    cells[to] = cells[from]!;
    shades[to] = shades[from]!;
    cells[from] = Element.Air;
    shades[from] = 0;
    this.movedAt[to] = this.steps;
    this.touch(from);
    this.touch(to);
  }

  /**
   * Something changed at cell i: its chunk, and any chunk holding one of its eight neighbours,
   * run next step; its chunk is redrawn.
   */
  private touch(i: number): void {
    const W = this.width;
    const x = i % W;
    const y = (i - x) / W;
    const CW = this.chunkColumns;
    const cx0 = Math.max(0, (x - 1) >> CHUNK_SHIFT);
    const cx1 = Math.min(CW - 1, (x + 1) >> CHUNK_SHIFT);
    const cy0 = Math.max(0, (y - 1) >> CHUNK_SHIFT);
    const cy1 = Math.min(this.chunkRows - 1, (y + 1) >> CHUNK_SHIFT);
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) this.waking[cy * CW + cx] = 1;
    }
    this.changed[(y >> CHUNK_SHIFT) * CW + (x >> CHUNK_SHIFT)] = 1;
  }
}
