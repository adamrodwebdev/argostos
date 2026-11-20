import type { DuneProfile } from '../../rules/terrain';
import { ARENA, type GridMeasures } from '../../rules/world';
import { FAR_DUNES, OUTSIDE_SAND, ROCK, SKY, type FarDune } from '../palette';
import type { View } from '../View';

/** Device pixels between two points of a far dune's outline. */
const OUTLINE_STEP_PX = 8;

/**
 * What lies behind and beyond the arena: the sky and the sun (drawn once per size into an image,
 * then copied each frame), the far dunes that slide slower than the sand (parallax), the desert
 * past the exits, drawn flat, and the rock under the arena on very tall screens.
 */
export class BackdropPainter {
  private readonly sky: HTMLCanvasElement;
  private skyWidth = 0;
  private skyHeight = 0;

  constructor(
    private readonly profile: DuneProfile,
    private readonly measures: GridMeasures,
  ) {
    this.sky = document.createElement('canvas');
  }

  draw(context: CanvasRenderingContext2D, view: View): void {
    this.drawSky(context, view);
    for (const layer of FAR_DUNES) this.drawFarDunes(context, view, layer);
    this.drawOutside(context, view);
    const floor = view.screenY(this.measures.bottomZ);
    if (floor < view.heightPx) {
      context.fillStyle = `rgb(${ROCK.r} ${ROCK.g} ${ROCK.b})`;
      context.fillRect(0, floor, view.widthPx, view.heightPx - floor);
    }
  }

  private drawSky(context: CanvasRenderingContext2D, view: View): void {
    const width = view.widthPx;
    const height = view.heightPx;
    if (width !== this.skyWidth || height !== this.skyHeight) this.paintSky(width, height);
    context.drawImage(this.sky, 0, 0);
  }

  /** The sky for this canvas size: two two-stop gradients (the fast path) and the sun's glow. */
  private paintSky(width: number, height: number): void {
    this.sky.width = width;
    this.sky.height = height;
    this.skyWidth = width;
    this.skyHeight = height;
    const context = this.sky.getContext('2d');
    if (!context) return;
    const middle = height * 0.42;
    const upper = context.createLinearGradient(0, 0, 0, middle);
    upper.addColorStop(0, SKY.top);
    upper.addColorStop(1, SKY.middle);
    context.fillStyle = upper;
    context.fillRect(0, 0, width, middle);
    const lower = context.createLinearGradient(0, middle, 0, height);
    lower.addColorStop(0, SKY.middle);
    lower.addColorStop(1, SKY.horizon);
    context.fillStyle = lower;
    context.fillRect(0, middle, width, height - middle);
    const x = SKY.sunX * width;
    const y = SKY.sunY * height;
    const radius = Math.max(width, height) * 0.6;
    const sun = context.createRadialGradient(x, y, 0, x, y, radius);
    sun.addColorStop(0, SKY.sun);
    sun.addColorStop(1, SKY.sunFade);
    context.fillStyle = sun;
    context.fillRect(0, 0, width, height);
  }

  /** A far dune, which slides by `parallax` of the camera's motion (from the mockup). */
  private drawFarDunes(context: CanvasRenderingContext2D, view: View, layer: FarDune): void {
    const width = view.widthPx;
    const height = view.heightPx;
    const s = Math.max(view.scale, 16 * view.pixelRatio) * layer.parallax;
    const horizon = view.screenY(0);
    const centre = view.worldX(width / 2) * layer.parallax;
    context.fillStyle = layer.tone;
    context.beginPath();
    context.moveTo(0, height);
    for (let px = 0; px <= width + OUTLINE_STEP_PX; px += OUTLINE_STEP_PX) {
      const x = centre + (px - width / 2) / s;
      const lift =
        layer.lift + 1.4 * Math.sin(x / 19 + layer.parallax * 7) + 0.6 * Math.sin(x / 7.3);
      context.lineTo(px, horizon - lift * s);
    }
    context.lineTo(width, height);
    context.fill();
  }

  /** The desert past the arena's exits: the dunes go on, flat-coloured (nothing moves there). */
  private drawOutside(context: CanvasRenderingContext2D, view: View): void {
    const left = view.screenX(0);
    const right = view.screenX(ARENA.widthM);
    context.fillStyle = OUTSIDE_SAND;
    if (left > 0) this.fillProfile(context, view, { from: 0, to: left });
    if (right < view.widthPx) this.fillProfile(context, view, { from: right, to: view.widthPx });
  }

  private fillProfile(context: CanvasRenderingContext2D, view: View, span: Span): void {
    context.beginPath();
    context.moveTo(span.from, view.heightPx);
    for (let px = span.from; px <= span.to + OUTLINE_STEP_PX; px += OUTLINE_STEP_PX) {
      const x = Math.min(px, span.to);
      context.lineTo(x, view.screenY(this.profile.height(view.worldX(x))));
    }
    context.lineTo(span.to, view.heightPx);
    context.fill();
  }
}

interface Span {
  readonly from: number;
  readonly to: number;
}
