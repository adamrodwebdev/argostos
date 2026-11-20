import { END_DELAY_S, type HuntRow, type PanicCause } from '../../rules/hunts';
import type { HeroActions } from '../actions/HeroActions';
import type { DroneSquad } from '../drone/DroneSquad';
import type { TruckFleet } from '../truck/TruckFleet';
import type { FailureReason, HuntEndedEvent, HuntEvents } from './HuntEvents';

export interface DirectorOptions {
  readonly row: HuntRow;
  readonly fleet: TruckFleet;
  readonly drones: DroneSquad;
  readonly actions: HeroActions;
  readonly events: HuntEvents;
  readonly stepSeconds: number;
}

/** Why a hunt failed, from what alarmed the convoy that got away. */
const REASONS: ReadonlyMap<PanicCause, FailureReason> = new Map<PanicCause, FailureReason>([
  ['sonar', 'spotted'],
  ['attack', 'attacked'],
]);

/**
 * Plays a hunt's row: sends each convoy and drone on time, unlocks each action when its time
 * comes, and ends the hunt: a success once every convoy was sent and the last truck taken, a
 * failure as soon as a prey gets away. The end is told a moment later (the last takedown, the
 * truck driving off, are seen first).
 */
export class HuntDirector {
  private clock = 0;
  private waves = 0;
  private drones = 0;
  private unlocks = 0;
  private outcome: HuntEndedEvent | null = null;
  private endIn = 0;
  private ended = false;

  constructor(private readonly options: DirectorOptions) {
    // What comes at the very start is there for the first frame.
    this.release();
  }

  /** Seconds played in this hunt. */
  get seconds(): number {
    return this.clock;
  }

  /** The end was told (the end screen shows; the world goes on behind it). */
  get isOver(): boolean {
    return this.ended;
  }

  /** How it ended (null while it plays, and during the moment before the end is told). */
  get result(): HuntEndedEvent | null {
    return this.ended ? this.outcome : null;
  }

  step(): void {
    this.clock += this.options.stepSeconds;
    this.release();
    if (this.ended) return;
    if (this.outcome) {
      this.endIn -= this.options.stepSeconds;
      if (this.endIn <= 0) {
        this.ended = true;
        this.options.events.emit('huntEnded', this.outcome);
      }
      return;
    }
    this.judge();
  }

  /** Whatever is due by now: convoys, drones, actions. */
  private release(): void {
    const { row, fleet, drones, actions } = this.options;
    while (this.waves < row.waves.length && row.waves[this.waves]!.atS <= this.clock) {
      fleet.sendWave(row.waves[this.waves]!, this.waves);
      this.waves++;
      if (this.waves === row.waves.length) fleet.lastWaveSent();
    }
    while (this.drones < row.drones.length && row.drones[this.drones]!.atS <= this.clock) {
      drones.send(row.drones[this.drones]!);
      this.drones++;
    }
    while (this.unlocks < row.unlocks.length && row.unlocks[this.unlocks]!.atS <= this.clock) {
      actions.unlock(row.unlocks[this.unlocks]!.action);
      this.unlocks++;
    }
  }

  private judge(): void {
    const { row, fleet } = this.options;
    const escape = fleet.firstEscape;
    if (escape) {
      const cause = escape.panicCause;
      this.finish({
        result: 'failure',
        reason: cause ? (REASONS.get(cause) ?? 'escaped') : 'escaped',
        convoySize: escape.trucks.length,
      });
    } else if (this.waves === row.waves.length && fleet.isClear) {
      this.finish({ result: 'success', reason: null, convoySize: 0 });
    }
  }

  private finish(outcome: HuntEndedEvent): void {
    this.outcome = outcome;
    this.endIn = END_DELAY_S;
  }
}
