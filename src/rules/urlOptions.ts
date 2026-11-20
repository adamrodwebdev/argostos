import { MAX_HUNT_NUMBER } from './hunts';
import { InvalidInput, orElse, parseNumber, readChoice, readText } from './input';
import { GRID_DETAILS, type GridDetail } from './world';

/*
 * The URL is a door: its options are an allow-list, each read strictly. A value that does not
 * fit keeps the option's default (never a guess); an unknown option is ignored. Nothing here
 * throws: a hand-typed or hostile address still opens the game.
 */

export interface UrlOptions {
  /** The hunt's seed: the same seed replays the same desert. */
  readonly seed: number;
  /** How fine the sand is (to measure what the engine holds). */
  readonly detail: GridDetail;
  /** Shows the frame-time readout. */
  readonly debug: boolean;
  /** The hero swims a scripted path on his own (measurements, smoke tests). */
  readonly autopilot: boolean;
  /** The game starts muted (recordings, tests). */
  readonly mute: boolean;
  /** The hunt to start with (tests, the review of a later hunt): 1 for a first visit. */
  readonly hunt: number;
  /** A remote tester's link: the pause shows the session code to send back. */
  readonly tester: boolean;
}

export const DEFAULT_OPTIONS: UrlOptions = {
  seed: 147,
  detail: 'standard',
  debug: false,
  autopilot: false,
  mute: false,
  hunt: 1,
  tester: false,
};

/** The longest query string read at all: what is longer is refused before parsing. */
export const MAX_QUERY_LENGTH = 512;
/** The longest value of one option, once cleaned. */
const MAX_VALUE_LENGTH = 16;
const SEED = { min: 0, max: 2_147_483_647, integer: true } as const;
const HUNT = { min: 1, max: MAX_HUNT_NUMBER, integer: true } as const;
const SWITCH_ON = ['1'] as const;

/** The one value of `key`, as cleaned text; refused when missing, repeated or too long. */
function single(params: URLSearchParams, key: string): string {
  const values = params.getAll(key);
  if (values.length !== 1) throw new InvalidInput(key, values.length === 0 ? 'empty' : 'too-many');
  return readText(values[0], { maxLength: MAX_VALUE_LENGTH, required: true }, key);
}

/** A switch: on only when its one value is exactly `1`. */
function flag(params: URLSearchParams, key: string): boolean {
  return orElse(() => {
    readChoice(single(params, key), SWITCH_ON, key);
    return true;
  }, false);
}

/** Reads the options from a query string (`location.search`), strictly. */
export function readUrlOptions(search: unknown): UrlOptions {
  if (typeof search !== 'string' || search.length > MAX_QUERY_LENGTH) return DEFAULT_OPTIONS;
  const params = new URLSearchParams(search);
  return {
    seed: orElse(() => parseNumber(single(params, 'seed'), SEED, 'seed'), DEFAULT_OPTIONS.seed),
    detail: orElse(
      () => readChoice(single(params, 'detail'), GRID_DETAILS, 'detail'),
      DEFAULT_OPTIONS.detail,
    ),
    debug: flag(params, 'debug'),
    autopilot: flag(params, 'autopilot'),
    mute: flag(params, 'mute'),
    hunt: orElse(() => parseNumber(single(params, 'hunt'), HUNT, 'hunt'), DEFAULT_OPTIONS.hunt),
    tester: flag(params, 'tester'),
  };
}
