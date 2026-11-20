import { Element } from '../../rules/elements';
import type { RandomSource } from '../../rules/random';
import type { GridMeasures } from '../../rules/world';
import type { SandGrid } from './SandGrid';

/** Gravity on a thrown grain (m/s²) and the air's drag on it (per second). */
const GRAIN_GRAVITY = 18;
const GRAIN_DRAG = 0.6;
/** A grain falling on a body slides off its side, this many times at most, then rests. */
const MAX_BOUNCES = 12;
/** How fast it slides off (m/s, sideways, at least). */
const SLIDE_OFF = 3;

/** A grain to throw: where it leaves from and how fast (m, m/s). */
export interface Throw {
  readonly x: number;
  readonly z: number;
  readonly vx: number;
  readonly vz: number;
  readonly shade: number;
}

/**
 * Sand thrown into the air (a burst out of the dunes, a dive back in): real grains that left
 * the grid, flying on their own until they land, where they become grains of the grid again.
 * A grain that falls on a body (the hero's back) slides off it, as sand pours off a round head.
 * Nothing is lost on the way: the hunt's sand is the grid's plus the pool's.
 */
export class SprayPool {
  readonly xs: Float32Array;
  readonly zs: Float32Array;
  private readonly vxs: Float32Array;
  private readonly vzs: Float32Array;
  private readonly bounces: Uint8Array;
  readonly shades: Uint8Array;
  readonly alive: Uint8Array;
  private live = 0;
  private cursor = 0;

  constructor(
    readonly capacity: number,
    private readonly measures: GridMeasures,
    private readonly random: RandomSource,
  ) {
    this.xs = new Float32Array(capacity);
    this.zs = new Float32Array(capacity);
    this.vxs = new Float32Array(capacity);
    this.vzs = new Float32Array(capacity);
    this.bounces = new Uint8Array(capacity);
    this.shades = new Uint8Array(capacity);
    this.alive = new Uint8Array(capacity);
  }

  /** Grains in flight. */
  get airborne(): number {
    return this.live;
  }

  /** True when a grain can still be thrown (otherwise the caller lays it in the grid). */
  get hasRoom(): boolean {
    return this.live < this.capacity;
  }

  /** Throws a grain; the pool must have room (`hasRoom`), or the grain would be lost. */
  launch(grain: Throw): void {
    if (!this.hasRoom) throw new RangeError('spray pool full: lay the grain in the grid instead');
    let slot = this.cursor;
    while (this.alive[slot] === 1) slot = (slot + 1) % this.capacity;
    this.cursor = (slot + 1) % this.capacity;
    this.xs[slot] = grain.x;
    this.zs[slot] = grain.z;
    this.vxs[slot] = grain.vx;
    this.vzs[slot] = grain.vz;
    this.shades[slot] = grain.shade;
    this.bounces[slot] = 0;
    this.alive[slot] = 1;
    this.live++;
  }

  /** One step of flight: grains fall, and those that meet the sand (or a wall) land in it. */
  step(dt: number, grid: SandGrid): void {
    if (this.live === 0) return;
    const { cellM, topZ, columns, rows } = this.measures;
    const drag = Math.exp(-GRAIN_DRAG * dt);
    const left = cellM * 0.5;
    const right = columns * cellM - cellM * 0.5;
    for (let p = 0; p < this.capacity; p++) {
      if (this.alive[p] === 0) continue;
      let vx = this.vxs[p]! * drag;
      let vz = this.vzs[p]! * drag - GRAIN_GRAVITY * dt;
      let x = this.xs[p]! + vx * dt;
      let z = this.zs[p]! + vz * dt;
      // The arena's side walls send grains back in.
      if (x < left || x > right) {
        vx = -vx * 0.4;
        x = Math.min(right, Math.max(left, x));
      }
      const column = Math.floor(x / cellM);
      const row = Math.floor((topZ - z) / cellM);
      if (row >= 0) {
        const i = row < rows ? grid.index(column, row) : -1;
        if (i >= 0 && grid.isBlocked(i) && this.bounces[p]! < MAX_BOUNCES) {
          // On the hero's back: it slides off one side or the other.
          this.bounces[p] = this.bounces[p]! + 1;
          // It keeps sliding the way it was going (a grain falling straight picks a side).
          const side = vx !== 0 ? Math.sign(vx) : this.random.next() < 0.5 ? -1 : 1;
          vx = side * Math.max(SLIDE_OFF, Math.abs(vx));
          vz = Math.max(0.6, -vz * 0.25);
          x = this.xs[p]!;
          z = this.zs[p]!;
        } else if (i < 0 || !grid.isFree(i)) {
          const fromRow = Math.floor((topZ - this.zs[p]!) / cellM);
          this.land(p, column, Math.min(rows - 1, fromRow), grid);
          continue;
        }
      }
      this.xs[p] = x;
      this.zs[p] = z;
      this.vxs[p] = vx;
      this.vzs[p] = vz;
    }
  }

  /** The grain becomes sand again: in the free cell it came from, or the first free one above. */
  private land(p: number, column: number, fromRow: number, grid: SandGrid): void {
    for (let y = Math.max(0, fromRow); y >= 0; y--) {
      const i = grid.index(column, y);
      if (!grid.isFree(i)) continue;
      grid.place(i, Element.Sand, this.shades[p]!);
      this.alive[p] = 0;
      this.live--;
      return;
    }
    // A column full to the top: the grain waits in the air, still counted, and tries next step.
    this.vxs[p] = 0;
    this.vzs[p] = 0;
  }
}
