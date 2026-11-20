import { Element } from '../../rules/elements';
import { STRATA_COUNT, STRATA_DEPTHS } from '../../rules/terrain';
import type { GridMeasures } from '../../rules/world';
import type { SandGrid } from '../../logic/sand/SandGrid';
import { CHUNK_SHIFT } from '../../logic/sand/SandGrid';
import { stratumOf } from '../../logic/sand/TerrainBuilder';
import {
  DEPTH_SHADOW,
  GRAIN_CONTRAST,
  ROCK,
  SAND_DEPTH_STOPS,
  SAND_RIM,
  STRATUM_CONTRAST,
  type Rgb,
} from '../palette';
import type { View } from '../View';

/** Shades a grain may carry: 16 strata × 4 grains. */
const SHADES = 64;
const CHUNK = 1 << CHUNK_SHIFT;

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
 * Draws the arena's sand, one pixel per grain in an image the size of the grid, scaled up
 * smoothly (no pixel art: the sand reads as soft masses), with a sunlit rim along its top. Only
 * the chunks the grid reports changed are repainted. A grain's colour is its stratum's, so the
 * hero's path shows in the layers he mixes; the light fades with depth.
 */
export class SandPainter {
  private readonly image: HTMLCanvasElement;
  private readonly imageContext: CanvasRenderingContext2D;
  private readonly pixels: ImageData;
  private readonly words: Uint32Array;
  /** Colours by row and shade (sand), and by row and grain (rock). */
  private readonly sandColours: Uint32Array;
  private readonly rockColours: Uint32Array;
  private readonly changed: Int32Array;
  private readonly spanLeft: Int32Array;
  private readonly spanRight: Int32Array;
  /** The columns the view shows this frame, and the height of each column's sand (m). */
  private firstColumn = 0;
  private endColumn = 0;
  private readonly tops: Float64Array;

  constructor(
    private readonly grid: SandGrid,
    private readonly measures: GridMeasures,
  ) {
    const { columns, rows } = measures;
    this.image = document.createElement('canvas');
    this.image.width = columns;
    this.image.height = rows;
    const context = this.image.getContext('2d');
    if (!context) throw new Error('2D canvas unavailable');
    this.imageContext = context;
    this.pixels = context.createImageData(columns, rows);
    this.words = new Uint32Array(this.pixels.data.buffer);
    this.sandColours = new Uint32Array(rows * SHADES);
    this.rockColours = new Uint32Array(rows * 4);
    this.buildColours();
    this.changed = new Int32Array(grid.chunkColumns * grid.chunkRows);
    this.spanLeft = new Int32Array(grid.chunkRows);
    this.spanRight = new Int32Array(grid.chunkRows);
    this.tops = new Float64Array(columns);
  }

  private buildColours(): void {
    const { rows, cellM, topZ, bottomZ } = this.measures;
    for (let y = 0; y < rows; y++) {
      const z = topZ - (y + 0.5) * cellM;
      const light = 1 - DEPTH_SHADOW * Math.min(1, Math.max(0, -z / -bottomZ));
      for (let shade = 0; shade < SHADES; shade++) {
        const stratum = Math.min(STRATA_COUNT - 1, stratumOf(shade));
        const band = stratum % 2 === 0 ? STRATUM_CONTRAST : -STRATUM_CONTRAST;
        const grain = (((shade & 3) - 1.5) / 1.5) * GRAIN_CONTRAST;
        this.sandColours[y * SHADES + shade] = pack(
          sandAt(stratumDepth(stratum)),
          light * (1 + band + grain),
        );
      }
      for (let grain = 0; grain < 4; grain++) {
        this.rockColours[y * 4 + grain] = pack(ROCK, light * (1 + (grain - 1.5) * 0.04));
      }
    }
  }

  /** Brings the image up to date: repaints only the chunks that changed since last time. */
  refresh(): void {
    const n = this.grid.drainChanged(this.changed);
    if (n === 0) return;
    const { chunkColumns, chunkRows } = this.grid;
    this.spanLeft.fill(chunkColumns);
    this.spanRight.fill(-1);
    for (let k = 0; k < n; k++) {
      const chunk = this.changed[k]!;
      const cx = chunk % chunkColumns;
      const cy = (chunk - cx) / chunkColumns;
      this.paintChunk(cx, cy);
      this.spanLeft[cy] = Math.min(this.spanLeft[cy]!, cx);
      this.spanRight[cy] = Math.max(this.spanRight[cy]!, cx);
    }
    // One upload per row of chunks: from its first changed chunk to its last.
    for (let cy = 0; cy < chunkRows; cy++) {
      const right = this.spanRight[cy]!;
      if (right < 0) continue;
      const x0 = this.spanLeft[cy]! * CHUNK;
      const y0 = cy * CHUNK;
      const width = Math.min(this.grid.width, (right + 1) * CHUNK) - x0;
      const height = Math.min(this.grid.height, y0 + CHUNK) - y0;
      this.imageContext.putImageData(this.pixels, 0, 0, x0, y0, width, height);
    }
  }

  private paintChunk(cx: number, cy: number): void {
    const { cells, shades, width, height } = this.grid;
    const { words, sandColours, rockColours } = this;
    const x0 = cx * CHUNK;
    const x1 = Math.min(width, x0 + CHUNK);
    const y1 = Math.min(height, (cy + 1) * CHUNK);
    for (let y = cy * CHUNK; y < y1; y++) {
      for (let x = x0, i = y * width + x0; x < x1; x++, i++) {
        const element = cells[i]!;
        if (element === Element.Air) words[i] = 0;
        else if (element === Element.Sand) words[i] = sandColours[y * SHADES + shades[i]!]!;
        else words[i] = rockColours[y * 4 + (shades[i]! & 3)]!;
      }
    }
  }

  /** Draws the part of the sand the view shows, then its sunlit rim. */
  draw(context: CanvasRenderingContext2D, view: View): void {
    const { cellM, topZ, columns, rows } = this.measures;
    const c0 = Math.max(0, Math.floor(view.worldX(0) / cellM) - 1);
    const c1 = Math.min(columns, Math.ceil(view.worldX(view.widthPx) / cellM) + 1);
    this.firstColumn = c0;
    this.endColumn = c1;
    const r0 = Math.max(0, Math.floor((topZ - view.worldZ(0)) / cellM) - 1);
    const r1 = Math.min(rows, Math.ceil((topZ - view.worldZ(view.heightPx)) / cellM) + 1);
    if (c1 <= c0 || r1 <= r0) return;
    const s = view.scale * cellM;
    context.imageSmoothingEnabled = true;
    context.drawImage(
      this.image,
      c0,
      r0,
      c1 - c0,
      r1 - r0,
      view.screenX(c0 * cellM),
      view.screenY(topZ - r0 * cellM),
      (c1 - c0) * s,
      (r1 - r0) * s,
    );
    this.drawRim(context, view);
  }

  /**
   * The sunlit rim along the sand's top, smoothed over three columns so it reads as a dune's
   * edge, not as the grid's steps (a column with no sand breaks it).
   */
  private drawRim(context: CanvasRenderingContext2D, view: View): void {
    const { cellM, topZ, rows, columns } = this.measures;
    const { firstColumn: c0, endColumn: c1, tops } = this;
    for (let c = Math.max(0, c0 - 1); c < Math.min(columns, c1 + 1); c++) {
      const row = this.grid.surfaceRow(c);
      tops[c] = row >= rows ? Number.NaN : topZ - row * cellM;
    }
    context.strokeStyle = SAND_RIM;
    context.lineWidth = Math.max(1.2 * view.pixelRatio, 0.07 * view.scale);
    context.lineJoin = 'round';
    context.beginPath();
    let drawing = false;
    for (let c = c0; c < c1; c++) {
      const here = tops[c]!;
      if (Number.isNaN(here)) {
        drawing = false;
        continue;
      }
      const left = c > 0 && !Number.isNaN(tops[c - 1]!) ? tops[c - 1]! : here;
      const right = c < columns - 1 && !Number.isNaN(tops[c + 1]!) ? tops[c + 1]! : here;
      const px = view.screenX((c + 0.5) * cellM);
      const py = view.screenY((left + 2 * here + right) / 4);
      if (drawing) context.lineTo(px, py);
      else context.moveTo(px, py);
      drawing = true;
    }
    context.stroke();
  }
}
