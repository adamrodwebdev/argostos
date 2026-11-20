import { FrameCap } from '../logic/FrameCap';

/** The longest frame passed on (ms): after a stall the game slows down rather than jumps. */
const MAX_FRAME_MS = 250;

/** What the loop drives each frame: the real time since the last one (ms). */
export interface FrameTarget {
  frame(elapsedMs: number): void;
}

/**
 * The game's one `requestAnimationFrame` loop, on the browser's real clock (the only place in
 * the game that reads it, with the frame probe). It stops while the tab is hidden and starts
 * again without owing the hidden time; touch screens are held to about 60 frames a second.
 */
export class FrameLoop {
  private handle = 0;
  private last: number | null = null;
  private running = false;
  private readonly cap: FrameCap;

  constructor(
    private readonly window: Window,
    private readonly target: FrameTarget,
  ) {
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    this.cap = new FrameCap(coarse ? 60 : null);
    window.document.addEventListener('visibilitychange', () => {
      if (window.document.hidden) this.stop();
      else this.start();
    });
  }

  /** The real clock (ms): for measuring a frame's parts. */
  now(): number {
    return this.window.performance.now();
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = null;
    this.cap.reset();
    this.handle = this.window.requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    this.window.cancelAnimationFrame(this.handle);
  }

  private readonly tick = (time: number): void => {
    if (!this.running) return;
    this.handle = this.window.requestAnimationFrame(this.tick);
    if (!this.cap.admits(time)) return;
    const elapsed = this.last === null ? 0 : Math.min(MAX_FRAME_MS, Math.max(0, time - this.last));
    this.last = time;
    try {
      this.target.frame(elapsed);
    } catch (error) {
      // Said, never hidden; the next frame still comes.
      console.error(error);
    }
  };
}
