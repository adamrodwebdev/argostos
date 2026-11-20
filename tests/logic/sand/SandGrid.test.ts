import { describe, expect, test } from 'vitest';
import { Element } from '../../../src/rules/elements';
import { SeededRandom } from '../../../src/logic/SeededRandom';
import { CHUNK_SHIFT, SandGrid } from '../../../src/logic/sand/SandGrid';

/** A grid with a rock floor, so every fixture is a state the sand can hold. */
function gridWithFloor(width: number, height: number): SandGrid {
  const grid = new SandGrid(width, height);
  for (let x = 0; x < width; x++) grid.place(grid.index(x, height - 1), Element.Rock, 0);
  return grid;
}

/** Steps the sand until nothing moves (at most `max` steps); returns the steps taken. */
function settle(grid: SandGrid, random: SeededRandom, max = 500): number {
  for (let step = 1; step <= max; step++) if (grid.simulate(random) === 0) return step;
  return max;
}

/** A flat bed of sand `depth` rows deep on the floor. */
function layBed(grid: SandGrid, depth: number): void {
  for (let y = grid.height - 1 - depth; y < grid.height - 1; y++) {
    for (let x = 0; x < grid.width; x++) grid.place(grid.index(x, y), Element.Sand, 0);
  }
}

describe('SandGrid: sand falls, slides and rests', () => {
  test('a grain falls straight down to the floor and stays there', () => {
    const grid = gridWithFloor(8, 12);
    grid.place(grid.index(3, 0), Element.Sand, 5);
    settle(grid, new SeededRandom(1));
    expect(grid.elementAt(grid.index(3, 10))).toBe(Element.Sand);
    expect(grid.shades[grid.index(3, 10)]).toBe(5);
    expect(grid.count(Element.Sand)).toBe(1);
  });

  test('a grain landing on another slides down to a free side', () => {
    const grid = gridWithFloor(5, 6);
    grid.place(grid.index(2, 4), Element.Sand, 0);
    grid.place(grid.index(2, 3), Element.Sand, 0);
    settle(grid, new SeededRandom(2));
    const left = grid.elementAt(grid.index(1, 4));
    const right = grid.elementAt(grid.index(3, 4));
    expect([left, right].filter((e) => e === Element.Sand)).toHaveLength(1);
    expect(grid.elementAt(grid.index(2, 3))).toBe(Element.Air);
  });

  test('sand never enters a cell a body blocks', () => {
    const grid = gridWithFloor(5, 8);
    for (let x = 0; x < 5; x++) grid.block(grid.index(x, 5));
    grid.place(grid.index(2, 0), Element.Sand, 0);
    settle(grid, new SeededRandom(3));
    expect(grid.elementAt(grid.index(2, 4))).toBe(Element.Sand);
    for (let x = 0; x < 5; x++) expect(grid.elementAt(grid.index(x, 5))).toBe(Element.Air);
  });

  test('rock holds still with nothing under it', () => {
    const grid = new SandGrid(4, 6);
    grid.place(grid.index(1, 1), Element.Rock, 0);
    settle(grid, new SeededRandom(4));
    expect(grid.elementAt(grid.index(1, 1))).toBe(Element.Rock);
  });

  test('stepping never makes or loses a grain', () => {
    const random = new SeededRandom(5);
    const grid = gridWithFloor(40, 40);
    for (let i = 0; i < 600; i++) {
      const x = random.nextInt(40);
      const y = random.nextInt(30);
      if (grid.isFree(grid.index(x, y))) grid.place(grid.index(x, y), Element.Sand, 0);
    }
    const before = grid.count(Element.Sand);
    for (let step = 0; step < 200; step++) grid.simulate(random);
    expect(grid.count(Element.Sand)).toBe(before);
  });
});

describe('SandGrid: chunks that sleep', () => {
  test('a desert at rest stops simulating once it has settled', () => {
    const grid = gridWithFloor(64, 48);
    layBed(grid, 20);
    const random = new SeededRandom(6);
    grid.simulate(random);
    grid.simulate(random);
    expect(grid.runningChunks()).toBe(0);
  });

  test('a gap opened deep in the sand wakes it, and the sand above closes the gap', () => {
    const grid = gridWithFloor(64, 48);
    layBed(grid, 30);
    const random = new SeededRandom(7);
    settle(grid, random);
    const top = grid.surfaceRow(32);
    const hole = grid.index(32, 40);
    grid.clear(hole);
    expect(grid.elementAt(hole)).toBe(Element.Air);
    settle(grid, random);
    expect(grid.elementAt(hole)).toBe(Element.Sand);
    // The grain that filled it came from the surface: the column sank by one somewhere near.
    expect(grid.count(Element.Sand)).toBe(64 * 30 - 1);
    expect(grid.surfaceRow(32)).toBeGreaterThanOrEqual(top);
  });

  test('sand falling across a chunk boundary keeps falling (the chunk below wakes)', () => {
    const size = 1 << CHUNK_SHIFT;
    const grid = gridWithFloor(size, size * 3);
    grid.place(grid.index(4, 2), Element.Sand, 0);
    settle(grid, new SeededRandom(8));
    expect(grid.elementAt(grid.index(4, size * 3 - 2))).toBe(Element.Sand);
  });

  test('the painter is told which chunks changed, once', () => {
    const grid = gridWithFloor(64, 32);
    const out = new Int32Array(64);
    grid.drainChanged(out);
    grid.simulate(new SeededRandom(9));
    expect(grid.drainChanged(out)).toBe(0);
    grid.place(grid.index(40, 3), Element.Sand, 0);
    const changed = grid.drainChanged(out);
    expect(changed).toBe(1);
    expect(out[0]).toBe((3 >> CHUNK_SHIFT) * grid.chunkColumns + (40 >> CHUNK_SHIFT));
    expect(grid.drainChanged(out)).toBe(0);
  });
});

/** Drops 400 grains at places drawn from the seed, then lets them fall: the grid's fingerprint. */
function play(seed: number): number {
  const random = new SeededRandom(seed);
  const grid = gridWithFloor(48, 40);
  for (let i = 0; i < 400; i++) {
    const x = random.nextInt(48);
    const y = random.nextInt(25);
    if (grid.isFree(grid.index(x, y))) grid.place(grid.index(x, y), Element.Sand, i & 3);
  }
  for (let step = 0; step < 120; step++) grid.simulate(random);
  return grid.fingerprint();
}

describe('SandGrid: determinism', () => {
  test('the same seed and the same changes give the same sand', () => {
    expect(play(11)).toBe(play(11));
    expect(play(11)).not.toBe(play(12));
  });

  test('a grid smaller than 2 × 2 or not whole is refused', () => {
    expect(() => new SandGrid(1, 10)).toThrow(RangeError);
    expect(() => new SandGrid(10.5, 10)).toThrow(RangeError);
    expect(() => new SandGrid(Number.NaN, 10)).toThrow(RangeError);
  });
});
