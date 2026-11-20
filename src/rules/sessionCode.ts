/*
 * The session code a remote tester sends back (the roadmap's 60-second gate): a few numbers
 * about how the session went, packed into 16 characters, and no personal data at all (no
 * identifier, no device, no date, nothing stored, nothing sent: the tester copies it by hand).
 * Pure: facts in, a code out, and a strict reader for the team.
 */

/** Where the player was when the code was made. */
export const SESSION_STAGES = ['playing', 'ended', 'paused'] as const;
export type SessionStage = (typeof SESSION_STAGES)[number];

/** Why the last failed hunt failed (none: no hunt failed). */
export const FAILURE_CAUSES = ['none', 'spotted', 'attacked', 'escaped'] as const;
export type FailureCause = (typeof FAILURE_CAUSES)[number];

export interface SessionFacts {
  /** Seconds from the game's start to the player's first gesture (null: none yet). */
  readonly firstGestureS: number | null;
  /** Seconds played: the page shown and the hunt not paused. */
  readonly playedS: number;
  /** The hunt the player was at, and how far into it (s). */
  readonly hunt: number;
  readonly huntS: number;
  readonly stage: SessionStage;
  readonly huntsStarted: number;
  readonly wins: number;
  readonly failures: number;
  readonly lastFailure: FailureCause;
}

/** Each field's width in bits, in the order they are packed (with the code's version first). */
const LAYOUT = {
  version: 4,
  firstGesture: 12,
  played: 14,
  hunt: 7,
  huntS: 10,
  stage: 2,
  started: 7,
  wins: 7,
  failures: 7,
  lastFailure: 2,
} as const;
const VERSION = 1;
/** The first gesture is counted in tenths of a second; all ones means "no gesture yet". */
const NO_GESTURE = (1 << LAYOUT.firstGesture) - 1;
const PAYLOAD_BITS = Object.values(LAYOUT).reduce((sum, bits) => sum + bits, 0);
const CHECK_BITS = 8;
/** Crockford's base 32: no I, L, O or U, easy to read aloud and to type. */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const CODE_CHARACTERS = (PAYLOAD_BITS + CHECK_BITS) / 5;
/** The longest text read as a code (with its hyphens and spaces). */
const MAX_INPUT = 40;

function clampInt(value: number, bits: number): number {
  const max = (1 << bits) - 1;
  return Number.isFinite(value) ? Math.min(max, Math.max(0, Math.round(value))) : 0;
}

/** A check over the payload's bytes, so a mistyped character is caught. */
function check(payload: bigint): number {
  let sum = 0;
  let rest = payload;
  for (let i = 1; rest > 0n; i++) {
    sum = (sum + Number(rest & 0xffn) * i) % 251;
    rest >>= 8n;
  }
  return sum;
}

/** The code of a session: 16 characters in four groups (`7K2M-…`). */
export function encodeSession(facts: SessionFacts): string {
  const fields: readonly (readonly [number, number])[] = [
    [VERSION, LAYOUT.version],
    [
      facts.firstGestureS === null
        ? NO_GESTURE
        : Math.min(NO_GESTURE - 1, clampInt(facts.firstGestureS * 10, LAYOUT.firstGesture)),
      LAYOUT.firstGesture,
    ],
    [clampInt(facts.playedS, LAYOUT.played), LAYOUT.played],
    [clampInt(facts.hunt, LAYOUT.hunt), LAYOUT.hunt],
    [clampInt(facts.huntS, LAYOUT.huntS), LAYOUT.huntS],
    [Math.max(0, SESSION_STAGES.indexOf(facts.stage)), LAYOUT.stage],
    [clampInt(facts.huntsStarted, LAYOUT.started), LAYOUT.started],
    [clampInt(facts.wins, LAYOUT.wins), LAYOUT.wins],
    [clampInt(facts.failures, LAYOUT.failures), LAYOUT.failures],
    [Math.max(0, FAILURE_CAUSES.indexOf(facts.lastFailure)), LAYOUT.lastFailure],
  ];
  let payload = 0n;
  for (const [value, bits] of fields) payload = (payload << BigInt(bits)) | BigInt(value);
  let all = (payload << BigInt(CHECK_BITS)) | BigInt(check(payload));
  let text = '';
  for (let i = 0; i < CODE_CHARACTERS; i++) {
    text = ALPHABET.charAt(Number(all & 31n)) + text;
    all >>= 5n;
  }
  return text.match(/.{4}/g)?.join('-') ?? text;
}

/**
 * Reads a code back (the team's side): case, hyphens and spaces do not matter, O reads as 0
 * and I or L as 1; anything else that does not fit (length, letters, check, version, values)
 * is refused with null, never guessed.
 */
export function decodeSession(raw: unknown): SessionFacts | null {
  if (typeof raw !== 'string' || raw.length > MAX_INPUT) return null;
  const cleaned = raw.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  if (cleaned.length !== CODE_CHARACTERS) return null;
  let all = 0n;
  for (const character of cleaned) {
    const digit = ALPHABET.indexOf(character);
    if (digit < 0) return null;
    all = (all << 5n) | BigInt(digit);
  }
  const payload = all >> BigInt(CHECK_BITS);
  if (Number(all & 0xffn) !== check(payload)) return null;
  const read: number[] = [];
  let rest = payload;
  const widths = Object.values(LAYOUT).toReversed();
  for (const bits of widths) {
    read.unshift(Number(rest & ((1n << BigInt(bits)) - 1n)));
    rest >>= BigInt(bits);
  }
  const [version, gesture, played, hunt, huntS, stage, started, wins, failures, lastFailure] = read;
  const stageName = SESSION_STAGES[stage ?? -1];
  const cause = FAILURE_CAUSES[lastFailure ?? -1];
  if (version !== VERSION || !stageName || !cause || hunt === undefined || hunt < 1) return null;
  return {
    firstGestureS: gesture === NO_GESTURE || gesture === undefined ? null : gesture / 10,
    playedS: played ?? 0,
    hunt,
    huntS: huntS ?? 0,
    stage: stageName,
    huntsStarted: started ?? 0,
    wins: wins ?? 0,
    failures: failures ?? 0,
    lastFailure: cause,
  };
}
