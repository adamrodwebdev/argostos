/*
 * Terrain traps (the user's decision of 20 November): the ground itself is a weapon, in one
 * system with the sinking tower of the first minute. Argostos swimming just under the surface
 * lays back fewer grains behind him, so the ground caves in; machines on the moving ground tip
 * past a slope, fall into pits, get stuck in loose sand, and take damage from their falls. Data
 * rows and pure functions only; the desert still keeps every grain.
 */

/** Undermining: a shallow pass leaves a void the sand above falls into. */
export const UNDERMINING = {
  /** Within this depth (m, from the head up to the sand's top over it), a pass undermines. */
  shallowPassM: 3.2,
  /** Share of the cells he leaves that a shallow pass refills (the rest caves in). */
  layBackShare: 0.3,
  /** Grains he carries thrown up as a mound when he bursts out, at most, at full strength. */
  moundGrains: 260,
  /** The mound's grains fly up and out this fast (m/s). */
  moundUp: 6.5,
  moundSpread: 3,
} as const;

/** Machines on the moving ground. */
export const GROUND = {
  /** A wheel the sand drops away from falls under this gravity (m/s²). */
  gravity: 14,
  /** A truck tilted past this angle (degrees) tips over: the fall. */
  tipDeg: 30,
  /** Sand rising ahead steeper than this (degrees): the truck is stuck in it. */
  climbDeg: 24,
  /** A stuck truck stops (m/s): its wheels spin as if it drove on, it goes nowhere. */
  stuckSpeed: 0,
  /**
   * A landing slower than this (m/s) does no harm: a fall of about 1.5 m, so one pass's cave-in
   * only jolts a truck; a pit dug on purpose hurts it.
   */
  safeLandingMps: 6.5,
  /** Plate a landing takes per m/s above that (a 2.5 m fall: about a light truck's half). */
  damagePerMps: 14,
  /** A landing this hard (m/s), a fall of about 3.2 m, breaks the machine: the fall. */
  crashMps: 9.5,
} as const;

/** The drilling tower of the first minute: tall, standing on a wide base on the sand. */
export const TOWER = {
  /** Its height and the half-width of its base (m). */
  heightM: 21,
  baseHalfM: 4.6,
  /** Leaning past this (degrees), it topples. */
  tipDeg: 6,
  /** How fast it settles on what holds its base (per second). */
  settle: 2.2,
  /** Toppling: gravity on its fall (rad/s² at a full lean), and how fast it sinks once down (m/s). */
  toppleGravity: 3.2,
  sinkSpeed: 0.9,
  /** Once down, it is under the sand after this long (s). */
  buriedAfterS: 2.6,
} as const;

/** The plate a landing at `speed` (m/s) takes off: nothing below the safe speed. */
export function landingDamage(speed: number): number {
  if (!Number.isFinite(speed) || speed <= GROUND.safeLandingMps) return 0;
  return Math.round((speed - GROUND.safeLandingMps) * GROUND.damagePerMps);
}

/** True when a lean of `radians` is past `limitDeg`. */
export function pastLimit(radians: number, limitDeg: number): boolean {
  return Number.isFinite(radians) && Math.abs(radians) > (limitDeg * Math.PI) / 180;
}

/** The share of the cells he leaves that he refills, at `depthM` under the sand's top. */
export function layBackShare(depthM: number): number {
  return Number.isFinite(depthM) && depthM >= 0 && depthM < UNDERMINING.shallowPassM
    ? UNDERMINING.layBackShare
    : 1;
}
