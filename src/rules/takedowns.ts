/*
 * The takedowns: how Argostos destroys a machine. Each one is a strategy in the logic and a row
 * here (its timing, its forces, what it breaks), so a new takedown is a new strategy and a new
 * row. PEGI 12: the Company's machines run without drivers; nobody is in the cabs, no blood.
 */

/** The takedowns that exist, and those planned (each needs its strategy before it is used). */
export const TAKEDOWN_IDS = [
  'swallowFromBelow',
  'dragUnder',
  'glassDome',
  'towerSink',
  'ramAndFlip',
  'chainReaction',
] as const;
export type TakedownId = (typeof TAKEDOWN_IDS)[number];

/** One takedown's data. Times are in seconds from the bite, forces in m/s and rad/s. */
export interface TakedownRow {
  /** How long the world stands still at the bite (ms of real time): the hit-stop. */
  readonly hitStopMs: number;
  /** The camera's jolt at the bite, 0 to 1 (scaled again by the hit's strength). */
  readonly shake: number;
  /** The truck is thrown up and turned (it lifts and tips). */
  readonly liftSpeed: number;
  readonly tipSpeed: number;
  /** When the wheels tear off, and how hard they fly (up, out, spin). */
  readonly wheelsAt: number;
  readonly wheelSpeed: number;
  readonly wheelSpin: number;
  /** When the cab's glass shatters, and how many shards. */
  readonly shatterAt: number;
  readonly shards: number;
  /** When the fuel bursts into fire, and how long the wreck burns. */
  readonly fuelAt: number;
  readonly burnSeconds: number;
  /** Panels torn off with the wheels (debris drawn from the body's sprite). */
  readonly panels: number;
  /** The body folds (crumples) over this span. */
  readonly foldFrom: number;
  readonly foldTo: number;
  /** From here the wreck is dragged down into the sand by the jaws. */
  readonly dragAt: number;
  /** Sand thrown up at the bite (grains of the grid: it falls back). */
  readonly plumeGrains: number;
  readonly plumeSpeed: number;
  /** The takedown is over (the wreck is under the sand) after this long. */
  readonly endsAt: number;
}

export const TAKEDOWNS: ReadonlyMap<TakedownId, TakedownRow> = new Map([
  [
    'swallowFromBelow',
    {
      hitStopMs: 90,
      shake: 0.65,
      liftSpeed: 9,
      tipSpeed: 3.2,
      wheelsAt: 0.07,
      wheelSpeed: 7.5,
      wheelSpin: 9,
      shatterAt: 0.12,
      shards: 34,
      fuelAt: 0.24,
      burnSeconds: 3.2,
      panels: 2,
      foldFrom: 0.12,
      foldTo: 0.62,
      dragAt: 0.55,
      plumeGrains: 110,
      plumeSpeed: 9,
      endsAt: 1.6,
    },
  ],
]);

/** The last prey of a hunt plays in slow motion: how slow, for how long (s of real time). */
export const FINALE = { scale: 0.3, seconds: 1.1 } as const;

/**
 * P1 has no hunt goals yet (they come in P2): every fifth truck stands for a hunt's last prey,
 * so the slow motion can be seen and tuned.
 */
export const PREY_PER_HUNT = 5;

/** Debris (wheels, panels): simple rigid bodies on the sand. */
export const DEBRIS = {
  /** Wreckage pieces at most in the arena (the oldest sinks first). */
  max: 24,
  gravity: 14,
  /** Bounce on sand (share of the speed kept) and the sand's grip along the surface. */
  restitution: 0.28,
  friction: 0.55,
  /** Below this speed (m/s) on the ground, a piece settles. */
  restSpeed: 0.25,
  /** A settled piece sinks into the sand this fast (m/s), and is gone this deep (m). */
  sinkSpeed: 0.18,
  goneDepth: 1.6,
  /** An impact harder than this (m/s) throws sand up from where it lands. */
  splashSpeed: 3,
  /** Grains thrown per m/s of impact above that, at most `splashMax`. */
  splashPerSpeed: 3,
  splashMax: 24,
  /** A panel's collision radius (m): it lands flat-ish, like a sheet. */
  panelRadius: 0.7,
} as const;
