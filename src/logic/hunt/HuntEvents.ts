import type { TakedownId } from '../../rules/takedowns';
import type { EventBus } from '../EventBus';
import type { Direction } from '../truck/TruckRig';

/** A place and a speed in the world (m, m/s). */
export interface Moment {
  readonly x: number;
  readonly z: number;
  readonly speed: number;
}

/** The beats of a takedown, in the order they come. */
export const TAKEDOWN_BEATS = ['strike', 'tear', 'shatter', 'fuel', 'drag', 'buried'] as const;
export type TakedownBeat = (typeof TAKEDOWN_BEATS)[number];

/** A beat of a takedown: where, how hard (0 to 1), the way the truck faced, and if it ends a hunt. */
export interface TakedownBeatEvent {
  readonly takedown: TakedownId;
  readonly beat: TakedownBeat;
  readonly truckId: number;
  readonly x: number;
  readonly z: number;
  readonly strength: number;
  readonly facing: 1 | -1;
  readonly finale: boolean;
}

/** What a hunt tells the rest of the game. */
export interface HuntEventMap {
  /** A takedown's beat: the bite, the wheels torn off, the glass, the fuel, the drag, the end. */
  takedownBeat: TakedownBeatEvent;
  /** The hero burst out of the sand. */
  breach: Moment;
  /** The hero plunged back in. */
  dive: Moment;
  truckArrived: { readonly id: number; readonly direction: Direction };
  /** The hero's jaws closed on a truck (from below). */
  truckCaught: { readonly id: number; readonly x: number; readonly z: number };
  /** The truck is gone down his throat. */
  truckSwallowed: { readonly id: number; readonly x: number; readonly z: number };
  /** The truck drove out of the arena. */
  truckLeft: { readonly id: number };
}

export type HuntEvents = EventBus<HuntEventMap>;
