/*
 * Combat in numbers (the roadmap, "Le combat en chiffres"): every hit takes plate off a machine
 * and shows its number; a machine at zero stalls in sparks and smoke, and the next bite from
 * below plays its cinematic takedown (the bite that brings it to zero plays it at once). The
 * actions arrive one by one over the first hunts. Data rows and pure functions only.
 */

/** What can hit a machine. */
export const HIT_KINDS = ['bite', 'ram', 'tail', 'rock'] as const;
export type HitKind = (typeof HIT_KINDS)[number];

export interface HitRow {
  /** Plate taken off (before any scaling). */
  readonly damage: number;
  /** The world stands still this long (ms) and the camera jolts this much (0 to 1). */
  readonly hitStopMs: number;
  readonly shake: number;
}

export const HITS: ReadonlyMap<HitKind, HitRow> = new Map<HitKind, HitRow>([
  ['bite', { damage: 60, hitStopMs: 70, shake: 0.35 }],
  ['ram', { damage: 40, hitStopMs: 80, shake: 0.5 }],
  ['tail', { damage: 22, hitStopMs: 45, shake: 0.25 }],
  ['rock', { damage: 14, hitStopMs: 30, shake: 0.15 }],
]);

export function hitRow(kind: HitKind): HitRow {
  const row = HITS.get(kind);
  if (!row) throw new Error(`no row for the hit ${kind}`);
  return row;
}

/** The thumb's actions (steering and swallowing need no button). */
export const ACTION_IDS = ['ram', 'strike', 'breath'] as const;
export type ActionId = (typeof ACTION_IDS)[number];

export const RAM = {
  /** The burst of speed (m/s) and how long it lasts (s). */
  speed: 22,
  seconds: 0.42,
  /** Ready again after this long (s): shown as a sweep on its button. */
  cooldownS: 2.2,
  /** At or above this share of the burst's speed, the hit is a strong one (its number grows). */
  strongShare: 0.9,
} as const;

export const STRIKE = {
  /** Ready again after this long (s). */
  cooldownS: 0.8,
  /** Up to this far (m, from the head to the machine), a tail slap; beyond, a rock thrown. */
  tailRangeM: 7,
  /** The farthest a rock is aimed at a machine (m); beyond, it flies straight ahead. */
  rockRangeM: 36,
  /** A rock's flight time per metre (s/m), within these bounds (s). */
  rockSecondsPerM: 0.03,
  rockMinS: 0.32,
  rockMaxS: 1.1,
  /** Gravity on a rock (m/s²), and the radius it hits with (m). */
  rockGravity: 14,
  rockRadiusM: 0.45,
} as const;

export const BREATH = {
  /** The gauge: a dome takes it all; each machine eaten gives back this share. */
  perMachine: 0.5,
  /** The glass dome: its half-width and height (m), as it forms, stands, then shatters (s). */
  domeHalfWidthM: 12,
  domeHeightM: 9,
  domeFormS: 0.45,
  domeHoldS: 6.5,
} as const;

/** A hit as the numbers show it: the plate it takes off, and whether it is a strong one. */
export interface Damage {
  readonly amount: number;
  readonly strong: boolean;
}

/** A ram's hit: harder the faster the hero goes (a full-speed ram is a strong hit). */
export function ramDamage(speed: number): Damage {
  const share = Number.isFinite(speed) ? Math.min(1, Math.max(0, speed / RAM.speed)) : 0;
  return {
    amount: Math.round(hitRow('ram').damage * (0.5 + 0.5 * share)),
    strong: share >= RAM.strongShare,
  };
}

/** Any other hit: its row's damage. */
export function plainDamage(kind: Exclude<HitKind, 'ram'>): Damage {
  return { amount: hitRow(kind).damage, strong: false };
}

/** The strike is one action whose effect depends on the distance (validated 20 November). */
export type StrikeMode = 'tail' | 'rock';

/** A tail slap up close, a rock thrown at range (or straight ahead with nothing in range). */
export function strikeModeFor(distanceM: number): StrikeMode {
  return Number.isFinite(distanceM) && distanceM <= STRIKE.tailRangeM ? 'tail' : 'rock';
}

/** A rock's flight time to a mark this far (s). */
export function rockFlightSeconds(distanceM: number): number {
  const d = Number.isFinite(distanceM) ? Math.max(0, distanceM) : 0;
  return Math.min(STRIKE.rockMaxS, Math.max(STRIKE.rockMinS, d * STRIKE.rockSecondsPerM));
}

/** True when a hit of `damage` leaves a machine of `hp` at zero (or below). */
export function brings(hp: number, damage: number): boolean {
  return hp - damage <= 0;
}
