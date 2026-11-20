import type { Truck } from '../../logic/truck/Truck';
import { ARENA } from '../../rules/world';
import type { View } from '../View';

export interface ArenaMarksOptions {
  /** The sand's height under any x (m). */
  readonly ground: (x: number) => number;
  readonly trucks: () => readonly Truck[];
}

/** The exit gates' poles: their height (m) in blocks of one metre, and their light. */
const GATE_BLOCKS = 9;
/** Ripples under a driving truck: how many, how far they spread (m), how often (s). */
const RIPPLES = 3;
const RIPPLE_REACH_M = 6;
const RIPPLE_PERIOD_S = 1.3;

/**
 * Marks of the hunt drawn in the world: the two exits, striped poles with a cyan light at the
 * arena's ends (where a prey gets away, the scanner shows them too), and the vibrations every
 * driving truck sends through the sand under it (the first hunt's hint: follow them).
 */
export class ArenaMarksPainter {
  private time = 0;

  constructor(private readonly options: ArenaMarksOptions) {}

  frame(dt: number): void {
    this.time += dt;
  }

  /** The vibrations, under the sand (before the hero is drawn). */
  drawVibrations(context: CanvasRenderingContext2D, view: View): void {
    const s = view.scale;
    context.strokeStyle = 'rgb(255 236 200 / 1)';
    for (const truck of this.options.trucks()) {
      if (!truck.isDriving || truck.isStalled) continue;
      const x = (truck.rig.rearX + truck.rig.frontX) / 2;
      const cx = view.screenX(x);
      const cy = view.screenY(this.options.ground(x));
      for (let i = 0; i < RIPPLES; i++) {
        const age =
          ((this.time + (i * RIPPLE_PERIOD_S) / RIPPLES) % RIPPLE_PERIOD_S) / RIPPLE_PERIOD_S;
        context.globalAlpha = 0.32 * (1 - age);
        context.lineWidth = Math.max(1, 0.1 * s);
        context.beginPath();
        context.ellipse(
          cx,
          cy,
          (2 + age * RIPPLE_REACH_M) * s,
          (1 + age * 3) * s,
          0,
          0.1,
          Math.PI - 0.1,
        );
        context.stroke();
      }
    }
    context.globalAlpha = 1;
  }

  /** The two exits. */
  drawGates(context: CanvasRenderingContext2D, view: View): void {
    for (const x of GATES) this.drawGate(context, view, x);
  }

  private drawGate(context: CanvasRenderingContext2D, view: View, x: number): void {
    const s = view.scale;
    const gx = view.screenX(x);
    if (gx < -2 * s || gx > view.widthPx + 2 * s) return;
    context.save();
    context.translate(gx, view.screenY(this.options.ground(x)));
    context.scale(s, s);
    for (let i = 0; i < GATE_BLOCKS; i++) {
      context.fillStyle = i % 2 === 0 ? '#e8a21a' : '#1c1c1c';
      context.fillRect(-0.3, -1 - i, 0.6, 1);
    }
    context.fillStyle = '#4a4f55';
    context.fillRect(-0.9, -0.3, 1.8, 0.5);
    const blink = 0.55 + 0.45 * Math.sin(this.time * 4);
    context.fillStyle = `rgb(110 240 252 / ${blink.toFixed(2)})`;
    context.beginPath();
    context.arc(0, -GATE_BLOCKS - 0.6, 0.9, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#e0fdff';
    context.beginPath();
    context.arc(0, -GATE_BLOCKS - 0.6, 0.3, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
}

const GATES: readonly number[] = [0, ARENA.widthM];
