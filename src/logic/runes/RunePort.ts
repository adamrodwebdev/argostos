import type { RuneId } from '../../rules/runes';
import type { HeadTrace } from '../hero/HeadTrace';

/**
 * Where a rune's recogniser will plug in (after the game is accepted): it reads the hero's
 * recent path and says which rune, of those unlocked, it traces. Declared only: nothing
 * implements it in P2.
 */
export interface RunePort {
  /** The rune the path traces, among `unlocked`, or null. */
  recognise(trace: HeadTrace, unlocked: ReadonlySet<RuneId>): RuneId | null;
}
