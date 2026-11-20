import type { FailureReason, HuntResult } from '../hunt/HuntEvents';
import type { FailureCause, SessionFacts, SessionStage } from '../../rules/sessionCode';

/**
 * The session's log for the remote testers of the 60-second gate: when the player first
 * touched the game, how long they played, where they stopped, the hunts begun, won and failed.
 * Kept in memory only (nothing stored, nothing sent, no identifier); the tester reads it as a
 * short code (`rules/sessionCode`). Its clock is the frames' real time, handed in.
 */
export class SessionLog {
  private clock = 0;
  private played = 0;
  private firstGesture: number | null = null;
  private hunt = 1;
  private huntStart = 0;
  private started = 0;
  private won = 0;
  private failed = 0;
  private lastFailure: FailureCause = 'none';
  private stage: SessionStage = 'playing';

  /** `seconds` of real time passed; they count as played while a hunt plays. */
  tick(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    this.clock += seconds;
    if (this.stage === 'playing') this.played += seconds;
  }

  /** The player touched, clicked or pressed a key (only the first one counts). */
  gesture(): void {
    this.firstGesture ??= this.clock;
  }

  /** A hunt begins (a first one, a next one, or the same again). */
  huntBegun(number: number): void {
    this.hunt = number;
    this.huntStart = this.played;
    this.started++;
    this.stage = 'playing';
  }

  /** A hunt ended. */
  huntEnded(result: HuntResult, reason: FailureReason | null): void {
    this.stage = 'ended';
    if (result === 'success') {
      this.won++;
      return;
    }
    this.failed++;
    this.lastFailure = reason ?? 'escaped';
  }

  /** The pause opened (true) or closed. */
  paused(paused: boolean): void {
    if (this.stage === 'ended') return;
    this.stage = paused ? 'paused' : 'playing';
  }

  /** The facts as they are now, for the code. */
  facts(): SessionFacts {
    return {
      firstGestureS: this.firstGesture,
      playedS: this.played,
      hunt: this.hunt,
      huntS: this.played - this.huntStart,
      stage: this.stage,
      huntsStarted: this.started,
      wins: this.won,
      failures: this.failed,
      lastFailure: this.lastFailure,
    };
  }
}
