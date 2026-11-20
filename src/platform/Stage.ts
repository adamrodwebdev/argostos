/** The canvas never draws more than 2 device pixels per CSS pixel, nor more than ~4 MP. */
const MAX_PIXEL_RATIO = 2;
const MAX_PIXELS = 4_200_000;

/**
 * The game's canvas and its size: the CSS box comes from the page's layout (the whole
 * viewport), the backing store follows it at a capped pixel ratio. Resizing or rotating never
 * restarts the hunt: the new size is applied at the start of the next frame, state kept.
 */
export class Stage {
  private cssWidth = 1;
  private cssHeight = 1;
  private pending = true;
  private readonly observer: ResizeObserver;

  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly window: Window,
  ) {
    this.observer = new ResizeObserver(() => {
      this.pending = true;
    });
    this.observer.observe(canvas);
    // The pixel ratio can change without a resize (a window moved to another screen, a zoom).
    this.watchPixelRatio();
  }

  private watchPixelRatio(): void {
    const query = this.window.matchMedia(`(resolution: ${this.window.devicePixelRatio}dppx)`);
    query.addEventListener(
      'change',
      () => {
        this.pending = true;
        this.watchPixelRatio();
      },
      { once: true },
    );
  }

  get widthCss(): number {
    return this.cssWidth;
  }
  get heightCss(): number {
    return this.cssHeight;
  }
  /** Device pixels per CSS pixel of the backing store, as applied. */
  get pixelRatio(): number {
    return this.canvas.width / this.cssWidth;
  }

  /** Applies a size change seen since the last frame; true when the canvas was resized. */
  applyPendingSize(): boolean {
    if (!this.pending) return false;
    this.pending = false;
    const box = this.canvas.getBoundingClientRect();
    this.cssWidth = Math.max(1, box.width);
    this.cssHeight = Math.max(1, box.height);
    const ratio = Math.min(this.window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    let width = Math.round(this.cssWidth * ratio);
    let height = Math.round(this.cssHeight * ratio);
    const fit = Math.min(1, Math.sqrt(MAX_PIXELS / (width * height)));
    width = Math.max(1, Math.floor(width * fit));
    height = Math.max(1, Math.floor(height * fit));
    // Assigning a size clears the canvas and resets its state: only when it changes.
    if (this.canvas.width === width && this.canvas.height === height) return false;
    this.canvas.width = width;
    this.canvas.height = height;
    return true;
  }

  /** The canvas's place on the page (CSS px), for reading pointers. */
  area(): { left: number; top: number; width: number; height: number } {
    const box = this.canvas.getBoundingClientRect();
    return { left: box.left, top: box.top, width: box.width, height: box.height };
  }

  dispose(): void {
    this.observer.disconnect();
  }
}
