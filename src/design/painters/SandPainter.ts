import { Element } from '../../rules/elements';
import type { GridMeasures } from '../../rules/world';
import type { SandGrid } from '../../logic/sand/SandGrid';
import { CHUNK_SHIFT } from '../../logic/sand/SandGrid';
import { SAND_RIM } from '../palette';
import type { View } from '../View';
import { SandColours } from './SandColours';

const CHUNK = 1 << CHUNK_SHIFT;

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
  private readonly colours: SandColours;
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
    this.colours = new SandColours(measures);
    this.changed = new Int32Array(grid.chunkColumns * grid.chunkRows);
    this.spanLeft = new Int32Array(grid.chunkRows);
    this.spanRight = new Int32Array(grid.chunkRows);
    this.tops = new Float64Array(columns);
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
    const { words, colours } = this;
    const x0 = cx * CHUNK;
    const x1 = Math.min(width, x0 + CHUNK);
    const y1 = Math.min(height, (cy + 1) * CHUNK);
    for (let y = cy * CHUNK; y < y1; y++) {
      for (let x = x0, i = y * width + x0; x < x1; x++, i++) {
        const element = cells[i]!;
        if (element === Element.Air) words[i] = 0;
        else if (element === Element.Sand) words[i] = colours.sandAt(y, shades[i]!);
        else words[i] = colours.rockAt(y, shades[i]!);
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
