import type { RandomSource } from '../../rules/random';
import type { TakedownId } from '../../rules/takedowns';
import type { HuntEvents } from '../hunt/HuntEvents';
import type { SandSurface } from '../sand/GridSurface';
import type { SandThrower } from '../sand/SandThrower';
import type { Jaws, Truck } from '../truck/Truck';
import type { Wreckage } from './Wreckage';

/** What brings a truck down: the hero's jaws, or the ground (it tipped over or landed hard). */
export type StrikeCause = 'bite' | 'fall';

/** The moment a truck is taken: which one, by what, where the jaws are, how the hero moves. */
export interface Strike {
  readonly truck: Truck;
  readonly cause: StrikeCause;
  readonly jaws: Jaws;
  /** The hero's velocity (m/s): a strike from below rises. */
  readonly heroVx: number;
  readonly heroVz: number;
  /** The hunt's last prey: it plays in slow motion. */
  readonly finale: boolean;
}

/** What a takedown acts on: the wreckage, the ground, real sand, the events, chance, the step. */
export interface TakedownWorld {
  readonly wreckage: Wreckage;
  /** The sand's height under any x: a falling wreck lands on it. */
  readonly ground: SandSurface;
  readonly thrower: SandThrower;
  readonly events: HuntEvents;
  readonly random: RandomSource;
  readonly stepSeconds: number;
}

/** A takedown playing out, step by step, until its wreck is gone. */
export interface RunningTakedown {
  readonly done: boolean;
  /** One fixed step: the wreck follows the jaws, the takedown's beats come on time. */
  step(jaws: Jaws): void;
}

/**
 * A way to destroy a machine. A new takedown is a new strategy (and its row in
 * `rules/takedowns.ts`): the registry plays the first one that fits a strike.
 */
export interface TakedownStrategy {
  readonly id: TakedownId;
  /** True when this takedown fits the strike. */
  fits(strike: Strike): boolean;
  begin(strike: Strike, world: TakedownWorld): RunningTakedown;
}

/** The takedowns the game knows, in order of preference. */
export class TakedownRegistry {
  constructor(private readonly strategies: readonly TakedownStrategy[]) {}

  /** The takedown for this strike, or null when none fits (the bite misses). */
  choose(strike: Strike): TakedownStrategy | null {
    return this.strategies.find((strategy) => strategy.fits(strike)) ?? null;
  }
}
