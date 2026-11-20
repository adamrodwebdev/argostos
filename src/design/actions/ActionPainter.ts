import type { GlassDome } from '../../logic/actions/GlassDome';
import type { Rocks } from '../../logic/actions/Rocks';
import type { View } from '../View';

export interface ActionPainterOptions {
  readonly dome: GlassDome;
  readonly rocks: Rocks;
  /** The sand's height under any x (m): the dome stands on it. */
  readonly ground: (x: number) => number;
}

/** The dome's glass thickness (m), and when its cracks show (share of its standing). */
const SHELL_M = 1.1;
const CRACKS_AT = 0.72;
/** A rock's size (m) and its spin (radians per second). */
const ROCK_M = 0.55;
const ROCK_SPIN = 7;

/**
 * What the actions leave in the world: the glass dome (it rises from the sand, glows amber,
 * cools to sea-green and cracks before it shatters) and the rocks in flight. From the mockup,
 * drawn in code.
 */
export class ActionPainter {
  private time = 0;

  constructor(private readonly options: ActionPainterOptions) {}

  frame(dt: number): void {
    this.time += dt;
  }

  draw(context: CanvasRenderingContext2D, view: View): void {
    if (this.options.dome.isStanding) this.drawDome(context, view);
    this.drawRocks(context, view);
  }

  private drawDome(context: CanvasRenderingContext2D, view: View): void {
    const { dome, ground } = this.options;
    const s = view.scale;
    const grow = easeOut(dome.formed);
    const cx = view.screenX(dome.x);
    const base = view.screenY(ground(dome.x)) + 0.5 * s;
    const rx = dome.halfWidth * s * grow;
    const ry = dome.height * s * grow;
    const th = SHELL_M * s * grow;
    if (rx <= th) return;
    const heat = 1 - dome.cooled;
    context.save();
    // The glass where it meets the sand.
    context.fillStyle = 'rgb(160 224 210 / 0.35)';
    context.fillRect(cx - rx, base - 0.6 * s, 2 * rx, 1.6 * s);
    context.fillStyle = `rgb(255 226 170 / ${(0.05 + 0.12 * heat).toFixed(2)})`;
    context.beginPath();
    context.ellipse(cx, base, rx - th, ry - th, 0, Math.PI, Math.PI * 2);
    context.fill();
    // The shell.
    context.fillStyle = 'rgb(138 220 206 / 0.62)';
    context.beginPath();
    context.ellipse(cx, base, rx, ry, 0, Math.PI, Math.PI * 2);
    context.ellipse(cx, base, rx - th, ry - th, 0, Math.PI * 2, Math.PI, true);
    context.closePath();
    context.fill();
    // Its inner glow: amber while hot, cooling away.
    context.strokeStyle = `rgb(255 214 128 / ${(0.25 + 0.7 * heat).toFixed(2)})`;
    context.lineWidth = 0.42 * s;
    context.beginPath();
    context.ellipse(cx, base, rx - th * 0.8, ry - th * 0.8, 0, Math.PI * 1.02, Math.PI * 1.98);
    context.stroke();
    // A highlight on its shoulder.
    context.strokeStyle = 'rgb(255 255 255 / 0.85)';
    context.lineWidth = Math.max(1.5, 0.08 * s);
    context.beginPath();
    context.ellipse(cx, base, rx - 1, ry - 1, 0, Math.PI * 1.12, Math.PI * 1.42);
    context.stroke();
    if (dome.cooled > CRACKS_AT) this.drawCracks(context, { cx, base, rx, ry, s });
    context.restore();
  }

  /** Cracks spreading as the glass cools, just before it shatters. */
  private drawCracks(context: CanvasRenderingContext2D, shell: Shell): void {
    const { cx, base, rx, ry, s } = shell;
    const spread = (this.options.dome.cooled - CRACKS_AT) / (1 - CRACKS_AT);
    context.strokeStyle = 'rgb(255 255 255 / 0.8)';
    context.lineWidth = Math.max(1.2, 0.06 * s);
    context.beginPath();
    for (const angle of CRACK_ANGLES) {
      const a = Math.PI * angle;
      const x = cx + Math.cos(a) * rx;
      const y = base + Math.sin(a) * ry;
      const reach = (1.2 + 2.2 * spread) * s;
      context.moveTo(x, y);
      context.lineTo(x - 0.4 * reach, y + 0.5 * reach);
      context.lineTo(x - 0.1 * reach, y + 0.9 * reach);
      context.lineTo(x - 0.5 * reach, y + 1.3 * reach);
    }
    context.stroke();
  }

  private drawRocks(context: CanvasRenderingContext2D, view: View): void {
    const { rocks } = this.options;
    const r = ROCK_M * view.scale;
    for (let slot = 0; slot < rocks.capacity; slot++) {
      if (!rocks.isFlying(slot)) continue;
      context.save();
      context.translate(view.screenX(rocks.xs[slot]!), view.screenY(rocks.zs[slot]!));
      context.rotate(this.time * ROCK_SPIN + slot);
      context.fillStyle = '#6b5040';
      context.strokeStyle = '#2a1d14';
      context.lineWidth = Math.max(1, 0.06 * view.scale);
      context.beginPath();
      context.moveTo(-r, -0.3 * r);
      context.lineTo(-0.2 * r, -r);
      context.lineTo(0.9 * r, -0.5 * r);
      context.lineTo(r, 0.4 * r);
      context.lineTo(0.1 * r, r);
      context.lineTo(-0.8 * r, 0.6 * r);
      context.closePath();
      context.fill();
      context.stroke();
      context.restore();
    }
  }
}

interface Shell {
  readonly cx: number;
  readonly base: number;
  readonly rx: number;
  readonly ry: number;
  readonly s: number;
}

/** Where cracks start round the dome (shares of π, on its upper half). */
const CRACK_ANGLES: readonly number[] = [1.18, 1.46, 1.71, 1.88];

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}
