/*
 * Where a damage number goes (the mockup's rule, made a rule rather than a place chosen by hand
 * for each hit): above the machine it hit, below the top row, never over Argostos or a
 * control. Pure: boxes in, a position out.
 */

/** A box on the screen (px, y down). */
export interface ScreenBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** A label to place: the point it belongs over, its size, where it may go, what it avoids. */
export interface LabelRequest {
  /** The point over the machine (px): the label's bottom centre sits on it, ideally. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Where labels may be: the playing frame below the top row. */
  readonly bounds: ScreenBox;
  /** What a label never covers: the hero's head, the buttons, the top row. */
  readonly keepOut: readonly ScreenBox[];
}

/**
 * Moves tried in turn, in label widths (sideways) and heights (up negative): above first, then
 * to the sides, then farther out, then below as a last resort.
 */
const TRIES: readonly (readonly [number, number])[] = [
  [0, 0],
  [0, -1],
  [0, -2],
  [-0.75, -0.5],
  [0.75, -0.5],
  [-1.25, 0],
  [1.25, 0],
  [0, -3],
  [-2.25, 0],
  [2.25, 0],
  [-2.25, -1],
  [2.25, -1],
  [0, 1],
  [0, 2],
  [0, 3],
];

/**
 * Places labels (one placer per overlay: its scratch box is its own, nothing is allocated per
 * label).
 */
export class LabelPlacer {
  private readonly box: ScreenBox = { left: 0, top: 0, right: 0, bottom: 0 };

  /**
   * Writes the label's centre into `out`. The first move that stays inside the bounds and over
   * no kept-out box wins; with none, the label stays above its machine, kept inside the bounds
   * (it may then touch what it should avoid, never leave the screen).
   */
  place(request: LabelRequest, out: { x: number; y: number }): void {
    const { width, height } = request;
    for (const [sideways, up] of TRIES) {
      this.frameAt(request, request.x + sideways * width, request.y + up * height);
      if (!overlapsAny(this.box, request.keepOut)) {
        this.centreInto(out);
        return;
      }
    }
    this.frameAt(request, request.x, request.y);
    this.centreInto(out);
  }

  /** The label's box with its bottom centre at (x, y), moved inside the bounds. */
  private frameAt(request: LabelRequest, x: number, y: number): void {
    const { width, height, bounds } = request;
    const left = Math.min(bounds.right - width, Math.max(bounds.left, x - width / 2));
    const top = Math.min(bounds.bottom - height, Math.max(bounds.top, y - height));
    this.box.left = left;
    this.box.top = top;
    this.box.right = left + width;
    this.box.bottom = top + height;
  }

  private centreInto(out: { x: number; y: number }): void {
    out.x = (this.box.left + this.box.right) / 2;
    out.y = (this.box.top + this.box.bottom) / 2;
  }
}

function overlapsAny(box: ScreenBox, others: readonly ScreenBox[]): boolean {
  for (const other of others) {
    if (
      box.left < other.right &&
      box.right > other.left &&
      box.top < other.bottom &&
      box.bottom > other.top
    ) {
      return true;
    }
  }
  return false;
}
