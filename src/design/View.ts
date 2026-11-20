import type { Rect } from '../rules/viewing';

/** The canvas this frame: its size in device pixels and CSS pixels, and the playing frame. */
export interface ViewLayout {
  readonly widthPx: number;
  readonly heightPx: number;
  /** Device pixels per CSS pixel (the backing store over the box). */
  readonly pixelRatio: number;
  /** The playing frame, in CSS pixels. */
  readonly frame: Rect;
  /** Zoom: CSS pixels per metre. */
  readonly cssPpm: number;
}

/**
 * Where the world is on the canvas this frame: metres to device pixels and back, z up on the
 * screen. The camera sets it once a frame; every painter reads it.
 */
export class View {
  private s = 1;
  private ox = 0;
  private oy = 0;
  private cx = 0;
  private cz = 0;
  private w = 1;
  private h = 1;
  private left = 0;
  private right = 1;
  private ratio = 1;

  /** The camera looks at (x, z) in this layout. */
  aim(x: number, z: number, layout: ViewLayout): void {
    const { frame, pixelRatio, cssPpm } = layout;
    this.s = cssPpm * pixelRatio;
    this.ox = (frame.x + frame.width / 2) * pixelRatio;
    this.oy = (frame.y + frame.height / 2) * pixelRatio;
    this.cx = x;
    this.cz = z;
    this.w = layout.widthPx;
    this.h = layout.heightPx;
    this.left = frame.x * pixelRatio;
    this.right = (frame.x + frame.width) * pixelRatio;
    this.ratio = pixelRatio;
  }

  /** Device pixels per metre. */
  get scale(): number {
    return this.s;
  }
  get pixelRatio(): number {
    return this.ratio;
  }
  get widthPx(): number {
    return this.w;
  }
  get heightPx(): number {
    return this.h;
  }
  /** The playing frame's edges (device px): actors are drawn only between them. */
  get frameLeftPx(): number {
    return this.left;
  }
  get frameRightPx(): number {
    return this.right;
  }

  screenX(x: number): number {
    return this.ox + (x - this.cx) * this.s;
  }
  screenY(z: number): number {
    return this.oy - (z - this.cz) * this.s;
  }
  worldX(px: number): number {
    return this.cx + (px - this.ox) / this.s;
  }
  worldZ(py: number): number {
    return this.cz - (py - this.oy) / this.s;
  }
}
