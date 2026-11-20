import type { View } from '../View';

/** The sand's rim is followed in steps this long (m): one cell. */
const RIM_STEP_M = 0.25;

/** A stretch of the world along x (m). */
export interface Stretch {
  readonly left: number;
  readonly right: number;
}

/**
 * Clips the context to the air above the sand over `stretch` (the whole screen without one):
 * what sinks into the dunes is cut away at their rim. The caller saves and restores.
 */
export function clipAboveSand(
  context: CanvasRenderingContext2D,
  view: View,
  ground: (x: number) => number,
  stretch?: Stretch,
): void {
  const left = stretch?.left ?? view.worldX(0);
  const right = stretch?.right ?? view.worldX(view.widthPx);
  context.beginPath();
  context.moveTo(view.screenX(left), -1);
  for (let x = left; x <= right + RIM_STEP_M; x += RIM_STEP_M) {
    context.lineTo(view.screenX(x), view.screenY(ground(x)));
  }
  context.lineTo(view.screenX(right + RIM_STEP_M), -1);
  context.closePath();
  context.clip();
}
