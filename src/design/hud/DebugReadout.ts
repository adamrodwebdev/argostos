import type { Hunt } from '../../logic/hunt/Hunt';
import type { Text } from '../text/Text';
import type { FrameProbe } from './FrameProbe';

/** How often the readout is rewritten (s): text changes are not free. */
const EVERY_SECONDS = 0.5;

/**
 * The frame-time readout (`?debug=1`): the frame's interval, the hunt's steps and the drawing
 * (mean and 95th percentile, ms), the grid's size and its awake chunks, the hero's speed and
 * noise. Written as text (never markup) into its element; the frame-time script reads the same
 * numbers from `data-` attributes.
 */
export class DebugReadout {
  private sinceWrite = EVERY_SECONDS;

  constructor(
    private readonly element: HTMLElement,
    private readonly text: Text,
    private readonly probe: FrameProbe,
  ) {
    element.hidden = false;
  }

  frame(dt: number, hunt: Hunt, particles: number): void {
    this.sinceWrite += dt;
    if (this.sinceWrite < EVERY_SECONDS) return;
    this.sinceWrite = 0;
    const { text, probe, element } = this;
    const f = (ms: number) => text.decimalOf(ms);
    const { interval, steps, paint } = probe;
    const lines = [
      `${text.get('readoutFrame')} ${f(interval.mean())} ms (p95 ${f(interval.percentile(0.95))})`,
      `${text.get('readoutStep')} ${f(steps.mean())} ms (p95 ${f(steps.percentile(0.95))})`,
      `${text.get('readoutPaint')} ${f(paint.mean())} ms (p95 ${f(paint.percentile(0.95))})`,
      `${text.get('readoutCells')} ${text.wholeOf(hunt.grid.width)} × ${text.wholeOf(hunt.grid.height)}, ${text.get('readoutAwake')} ${text.wholeOf(hunt.grid.runningChunks())}`,
      `${text.get('readoutSpeed')} ${f(hunt.hero.speed)} m/s, ${text.get('readoutNoise')} ${text.decimalOf(hunt.hero.noise)}`,
      `${text.get('readoutEaten')} ${text.wholeOf(hunt.swallowedCount)}, ${text.get('readoutParticles')} ${text.wholeOf(particles)}`,
    ];
    element.textContent = lines.join('\n');
    const data = element.dataset;
    data.frameMean = interval.mean().toFixed(3);
    data.frameP95 = interval.percentile(0.95).toFixed(3);
    data.stepMean = steps.mean().toFixed(3);
    data.stepP95 = steps.percentile(0.95).toFixed(3);
    data.paintMean = paint.mean().toFixed(3);
    data.paintP95 = paint.percentile(0.95).toFixed(3);
    data.samples = String(interval.size);
    data.cells = String(hunt.grid.width * hunt.grid.height);
    data.eaten = String(hunt.swallowedCount);
    data.steps = String(hunt.stepCount);
    data.particles = String(particles);
  }
}
