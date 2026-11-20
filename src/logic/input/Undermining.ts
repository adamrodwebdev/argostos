import { UNDERMINING } from '../../rules/terrainTraps';
import type { SandSurface } from '../sand/GridSurface';
import type { TargetIntent } from './Steering';

/** A stretch of sand to undermine: the pass runs from `from` to `to` (m, along x). */
export interface UnderminedSpan {
  readonly from: number;
  readonly to: number;
}

type Phase = 'approach' | 'pass' | 'away';

/** The pass runs this far under the sand's top (m): well inside the undermining depth. */
const PASS_DEPTH_M = UNDERMINING.shallowPassM * 0.62;
/** It swims to the start of a pass this deep (m: deep enough to close its wake). */
const APPROACH_DEPTH_M = UNDERMINING.shallowPassM + 4;
/** It is at the start of a pass this close to it (m, along x). */
const AT_START_M = 2.5;
/** After a pass it dives away this long (s): the ground caves in behind it. */
const AWAY_S = 2.4;
/** It looks this far ahead along the pass, and aims this deep when diving away (m). */
const LOOK_M = 6;
const AWAY_Z = -24;
/** Finger distance for full throttle (m). */
const FULL_AT_M = 9;

/**
 * A bot's way of undermining the sand: down to the start of a stretch, a pass just under the
 * dunes along it (the ground caves in over its wake), a dive away, and again. The hunter uses it
 * on a drilling tower's side, the sapper to open a pit in a truck's way.
 */
export class UnderminingRun {
  private phase: Phase = 'approach';
  private awayLeft = 0;
  private passes = 0;

  constructor(
    private readonly surface: SandSurface,
    private readonly stepSeconds: number,
  ) {}

  /** Passes done since it began (or since `restart`). */
  get passCount(): number {
    return this.passes;
  }

  /** A new stretch: it starts over from its approach. */
  restart(): void {
    this.phase = 'approach';
    this.awayLeft = 0;
    this.passes = 0;
  }

  /** Aims `target` for the head at (x, z) to undermine `span`. */
  aim(
    span: UnderminedSpan,
    head: { readonly x: number; readonly z: number },
    target: TargetIntent,
  ): void {
    const way = span.to >= span.from ? 1 : -1;
    if (this.phase === 'approach') {
      target.aim(span.from, this.surface.heightAt(span.from) - APPROACH_DEPTH_M, FULL_AT_M);
      if (Math.abs(head.x - span.from) < AT_START_M) this.phase = 'pass';
      return;
    }
    if (this.phase === 'pass') {
      const ahead = head.x + way * LOOK_M;
      target.aim(ahead, this.surface.heightAt(ahead) - PASS_DEPTH_M, FULL_AT_M);
      if ((head.x - span.to) * way >= 0) {
        this.phase = 'away';
        this.awayLeft = AWAY_S;
        this.passes++;
      }
      return;
    }
    target.aim(head.x - way * LOOK_M * 1.4, AWAY_Z, FULL_AT_M);
    this.awayLeft -= this.stepSeconds;
    if (this.awayLeft <= 0) this.phase = 'approach';
  }
}
