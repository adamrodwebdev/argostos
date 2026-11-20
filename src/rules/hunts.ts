import type { ActionId } from './combat';
import type { MachineId } from './machines';

/*
 * The hunts of the prototype, as data rows: when each convoy drives in and from where, what
 * alarms it, when the drones come, and when each action unlocks (hunt 1: steer and swallow,
 * the breath at 20 s; hunt 2 adds the ram; hunt 3 the strike). Past the table, the last row is
 * played again on a new desert. The level designer's numbers, to tune with players and bots.
 */

/** What makes a convoy flee for an exit: a drone hearing the hero, or one of it being hit. */
export const PANIC_CAUSES = ['sonar', 'attack'] as const;
export type PanicCause = (typeof PANIC_CAUSES)[number];

/** Which way a convoy drives in: +1 to the right, −1 to the left. */
export type Heading = 1 | -1;

export interface WaveRow {
  /** When it drives in (s from the hunt's start). */
  readonly atS: number;
  /** Its machines, the lead first; several make a convoy. */
  readonly machines: readonly MachineId[];
  /** The lead's rear hub at the start (m): inside the arena, or past an exit to drive in. */
  readonly x: number;
  readonly heading: Heading;
  /** What makes it flee; an empty list: it never flees (the first hunt's prey). */
  readonly panic: readonly PanicCause[];
}

export interface DroneRow {
  readonly atS: number;
  /** The middle of its patrol (m) and how far it goes either side (m). */
  readonly x: number;
  readonly spanM: number;
}

/** A drilling tower standing in the arena from `atS`: undermine it and it tips and sinks. */
export interface TowerRow {
  readonly atS: number;
  /** The middle of its base (m). */
  readonly x: number;
}

export interface UnlockRow {
  readonly action: ActionId;
  /** When its button appears (s from the hunt's start; 0: from the start). */
  readonly atS: number;
}

/** The hints shown at the start of a hunt (a closed set; the design writes their words). */
export const HINT_IDS = ['followVibrations'] as const;
export type HintId = (typeof HINT_IDS)[number];

export interface HuntRow {
  readonly waves: readonly WaveRow[];
  readonly drones: readonly DroneRow[];
  /** Towers to bring down (a bonus: the hunt is won by its convoys). */
  readonly towers: readonly TowerRow[];
  readonly unlocks: readonly UnlockRow[];
  readonly hint: HintId | null;
}

/** Room between two trucks of a convoy, rear hub to rear hub (m): 13 m of truck and 5 of gap. */
export const CONVOY_SPACING_M = 18;
/** Patrolling trucks turn back this far from an exit (m): only a fleeing truck drives out. */
export const PATROL_MARGIN_M = 14;
/** The hunt ends this long after its last machine fell, or after a prey got away (s). */
export const END_DELAY_S = 1.4;

/** The arena's exits: a convoy that drives in comes from just past one of them. */
const FROM_LEFT = -14;
const FROM_RIGHT = 174;

export const HUNTS: readonly HuntRow[] = [
  {
    // Hunt 1: steer and swallow, a truck right above at once, the breath at 20 s for the
    // convoy, a drone before 60 s whose alarm is only shown (no prey flees in the first hunt).
    waves: [
      { atS: 0, machines: ['hauler'], x: 22, heading: 1, panic: [] },
      { atS: 16, machines: ['hauler', 'hauler'], x: FROM_LEFT, heading: 1, panic: [] },
      { atS: 42, machines: ['hauler', 'hauler', 'hauler'], x: FROM_RIGHT, heading: -1, panic: [] },
    ],
    drones: [{ atS: 36, x: 100, spanM: 24 }],
    // The first minute's sinking tower, met about 10 s in.
    towers: [{ atS: 0, x: 72 }],
    unlocks: [{ action: 'breath', atS: 20 }],
    hint: 'followVibrations',
  },
  {
    // Hunt 2: the ram, an armoured truck to ram, a drone from the start: being heard now
    // sends the convoys running for the exits.
    waves: [
      { atS: 0, machines: ['hauler'], x: 30, heading: 1, panic: ['sonar'] },
      { atS: 8, machines: ['armoredHauler'], x: FROM_RIGHT, heading: -1, panic: ['sonar'] },
      { atS: 30, machines: ['hauler', 'hauler'], x: FROM_LEFT, heading: 1, panic: ['sonar'] },
      {
        atS: 55,
        machines: ['hauler', 'armoredHauler', 'hauler'],
        x: FROM_RIGHT,
        heading: -1,
        panic: ['sonar'],
      },
    ],
    drones: [{ atS: 5, x: 90, spanM: 30 }],
    towers: [{ atS: 0, x: 118 }],
    unlocks: [
      { action: 'breath', atS: 0 },
      { action: 'ram', atS: 0 },
    ],
    hint: null,
  },
  {
    // Hunt 3: the strike (tail up close, rock at range), two drones, and convoys that flee
    // when one of them is hit: trap them in glass first.
    waves: [
      { atS: 0, machines: ['armoredHauler'], x: 34, heading: 1, panic: ['sonar', 'attack'] },
      {
        atS: 12,
        machines: ['hauler', 'hauler'],
        x: FROM_RIGHT,
        heading: -1,
        panic: ['sonar', 'attack'],
      },
      {
        atS: 35,
        machines: ['armoredHauler', 'hauler', 'armoredHauler'],
        x: FROM_LEFT,
        heading: 1,
        panic: ['sonar', 'attack'],
      },
      {
        atS: 60,
        machines: ['hauler', 'hauler', 'hauler'],
        x: FROM_RIGHT,
        heading: -1,
        panic: ['sonar', 'attack'],
      },
    ],
    drones: [
      { atS: 0, x: 60, spanM: 24 },
      { atS: 30, x: 110, spanM: 26 },
    ],
    towers: [{ atS: 0, x: 88 }],
    unlocks: [
      { action: 'breath', atS: 0 },
      { action: 'ram', atS: 0 },
      { action: 'strike', atS: 0 },
    ],
    hint: null,
  },
];

/** The highest hunt number read at all (the URL's `hunt`, the session code). */
export const MAX_HUNT_NUMBER = 99;

/** The row of hunt `n` (from 1); past the table, its last row. */
export function huntRow(n: number): HuntRow {
  const index = Number.isInteger(n) && n >= 1 ? Math.min(n, HUNTS.length) - 1 : 0;
  const row = HUNTS[index];
  if (!row) throw new Error('the hunt table is empty');
  return row;
}
