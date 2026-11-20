import type { ActionId, HitKind, StrikeMode } from '../../rules/combat';
import type { PanicCause } from '../../rules/hunts';
import type { MachineId } from '../../rules/machines';
import type { TakedownId } from '../../rules/takedowns';
import type { EventBus } from '../EventBus';
import type { Direction } from '../truck/TruckRig';

/** A place and a speed in the world (m, m/s). */
export interface Moment {
  readonly x: number;
  readonly z: number;
  readonly speed: number;
}

/** A place in the world (m). */
export interface Place {
  readonly x: number;
  readonly z: number;
}

/** The beats of a takedown, in the order they come. */
export const TAKEDOWN_BEATS = ['strike', 'tear', 'shatter', 'fuel', 'drag', 'buried'] as const;
export type TakedownBeat = (typeof TAKEDOWN_BEATS)[number];

/** A beat of a takedown: where, how hard (0 to 1), the way the truck faced, and if it ends a hunt. */
export interface TakedownBeatEvent {
  readonly takedown: TakedownId;
  readonly beat: TakedownBeat;
  readonly truckId: number;
  /** The machine taken (its weight sets the hit-stop). */
  readonly machine: MachineId;
  readonly x: number;
  readonly z: number;
  readonly strength: number;
  readonly facing: 1 | -1;
  readonly finale: boolean;
}

/** A hit that took plate off a machine: its number pops over the machine (x, top of its box). */
export interface HitEvent {
  readonly targetId: number;
  readonly machine: MachineId;
  readonly kind: HitKind;
  readonly damage: number;
  /** A strong hit (a full-speed ram): its number comes out bigger. */
  readonly strong: boolean;
  readonly x: number;
  readonly z: number;
  /** Its convoy (−1 for a drone). */
  readonly waveId: number;
}

/** A machine fell for good: the crystals it gives. */
export interface DestroyedEvent extends Place {
  readonly targetId: number;
  readonly machine: MachineId;
  readonly crystals: number;
}

/** How a hunt ended. */
export type HuntResult = 'success' | 'failure';
/** Why a hunt failed: a prey fled after the sonar heard the hero, or after an attack. */
export type FailureReason = 'spotted' | 'attacked' | 'escaped';

export interface HuntEndedEvent {
  readonly result: HuntResult;
  readonly reason: FailureReason | null;
  /** The prey that got away came in a convoy of this many (1: a single truck). */
  readonly convoySize: number;
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
  /** A convoy drove in (or appeared in the arena). */
  waveArrived: { readonly waveId: number; readonly size: number; readonly direction: Direction };
  /** The hero's jaws closed on a truck (from below). */
  truckCaught: { readonly id: number; readonly x: number; readonly z: number };
  /** The truck is gone down his throat. */
  truckSwallowed: { readonly id: number; readonly x: number; readonly z: number };
  /** The truck drove out of the arena: it got away. */
  truckLeft: { readonly id: number };
  /** A hit took plate off a machine. */
  hit: HitEvent;
  /** A machine's plate is gone: a truck stalls, a drone falls. */
  gaveOut: { readonly targetId: number; readonly machine: MachineId } & Place;
  /** A machine fell for good (a truck swallowed, a drone crashed). */
  destroyed: DestroyedEvent;
  /** A convoy is all taken; `inGlass`: a convoy of several, every one caught in a glass dome. */
  convoyCleared: { readonly waveId: number; readonly size: number; readonly inGlass: boolean };
  /** A convoy runs for an exit. */
  convoyFled: { readonly waveId: number; readonly cause: PanicCause };
  /** A drone's rings touched the hero's: he is spotted (once a hunt). */
  spotted: { readonly droneId: number } & Place;
  /** A drone came over the arena. */
  droneArrived: { readonly droneId: number } & Place;
  /** A drone's rotors gave out, and then it hit the sand. */
  droneFell: { readonly droneId: number } & Place;
  droneCrashed: { readonly droneId: number } & Place;
  /** An action's button appears. */
  actionUnlocked: { readonly action: ActionId };
  /** An action was used (its sound, its first flash). */
  actionUsed: { readonly action: ActionId; readonly mode: StrikeMode | null } & Place;
  /** The tail swept (`targetId`: what it hit, −1 for nothing). */
  tailSwept: { readonly targetId: number } & Place;
  /** A rock thrown by the strike hit the sand. */
  rockLanded: Place;
  /** A glass dome rose over the sand, and later shattered. */
  domeRaised: { readonly x: number; readonly halfWidth: number; readonly height: number };
  domeShattered: { readonly x: number; readonly halfWidth: number; readonly height: number };
  /** The hunt is over (the world goes on behind the end screen). */
  huntEnded: HuntEndedEvent;
}

export type HuntEvents = EventBus<HuntEventMap>;
