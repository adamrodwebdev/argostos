import type { RandomSource } from '../../rules/random';
import type { DuneProfile } from '../../rules/terrain';
import { ARENA, type GridMeasures } from '../../rules/world';
import { shadeOf } from '../../logic/sand/TerrainBuilder';
import { SAND_RIM } from '../palette';
import type { View } from '../View';
import { SandColours } from './SandColours';

/** How far past each exit the desert is drawn (m): enough for a 32:9 window at an exit. */
const MARGIN_M = 60;
/** The rim is drawn every so often (m). */
const RIM_STEP_M = 0.5;

/**
 * The desert past the arena's exits, seen beside the playing frame on a wide window: the same
 * dunes and strata as the arena's sand, its colours from the same table, so they meet without a
 * seam at the exits. Nothing moves there (no simulation): each side is drawn once into an image
 * at the grid's resolution, then scaled like the arena's sand.
 */
export class OutsideSandPainter {
  /** Each side's image, made the first time it shows (never on a phone, whose frame is all arena). */
  private left: HTMLCanvasElement | null = null;
  private right: HTMLCanvasElement | null = null;
  private colours: SandColours | null = null;
  private readonly columns: number;

  constructor(
    private readonly profile: DuneProfile,
    private readonly measures: GridMeasures,
    private readonly random: RandomSource,
  ) {
    this.columns = Math.round(MARGIN_M / measures.cellM);
  }

  draw(context: CanvasRenderingContext2D, view: View): void {
    const leftEdge = view.screenX(0);
    const rightEdge = view.screenX(ARENA.widthM);
    if (leftEdge <= 0 && rightEdge >= view.widthPx) return;
    context.imageSmoothingEnabled = true;
    if (leftEdge > 0) {
      this.left ??= this.paint(-MARGIN_M);
      this.drawSide(context, view, { image: this.left, from: -MARGIN_M });
    }
    if (rightEdge < view.widthPx) {
      this.right ??= this.paint(ARENA.widthM);
      this.drawSide(context, view, { image: this.right, from: ARENA.widthM });
    }
  }

  private drawSide(context: CanvasRenderingContext2D, view: View, side: Side): void {
    const { cellM, topZ, rows } = this.measures;
    const s = view.scale;
    context.drawImage(
      side.image,
      view.screenX(side.from),
      view.screenY(topZ),
      this.columns * cellM * s,
      rows * cellM * s,
    );
    context.strokeStyle = SAND_RIM;
    context.lineWidth = Math.max(1.2 * view.pixelRatio, 0.07 * s);
    context.beginPath();
    for (let x = side.from; x <= side.from + MARGIN_M; x += RIM_STEP_M) {
      const px = view.screenX(x);
      const py = view.screenY(this.profile.height(x));
      if (x === side.from) context.moveTo(px, py);
      else context.lineTo(px, py);
    }
    context.stroke();
  }

  /** One side's sand from `from` (m), at the grid's resolution: dunes, strata, bedrock. */
  private paint(from: number): HTMLCanvasElement {
    const { cellM, rows, topZ, bedrockRows } = this.measures;
    const { random } = this;
    this.colours ??= new SandColours(this.measures);
    const colours = this.colours;
    const canvas = document.createElement('canvas');
    canvas.width = this.columns;
    canvas.height = rows;
    const context = canvas.getContext('2d');
    if (!context) return canvas;
    const pixels = context.createImageData(this.columns, rows);
    const words = new Uint32Array(pixels.data.buffer);
    for (let c = 0; c < this.columns; c++) {
      const x = from + (c + 0.5) * cellM;
      const surface = this.profile.height(x);
      for (let y = 0; y < rows; y++) {
        const i = y * this.columns + c;
        if (y >= rows - bedrockRows) {
          words[i] = colours.rockAt(y, random.nextInt(4));
          continue;
        }
        const z = topZ - (y + 0.5) * cellM;
        if (z > surface) continue;
        const stratum = this.profile.stratum(x, z, surface);
        words[i] = colours.sandAt(y, shadeOf(stratum, random.nextInt(4)));
      }
    }
    context.putImageData(pixels, 0, 0);
    return canvas;
  }
}

interface Side {
  readonly image: HTMLCanvasElement;
  readonly from: number;
}
