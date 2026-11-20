/*
 * The Company's sonar drones, and how they hear the hero. Read without text: the drone's cyan
 * rings go down into the sand, Argostos's amber rings grow with his speed; when they touch, he
 * is spotted. A quiet hero makes no rings at all, so a slow approach under a drone is safe and
 * a burst out of the sand (always loud) near one is not.
 */

export const SONAR = {
  /** Drones fly this high above the sand under them (m). */
  altitudeM: 10,
  /** Their rings reach this far into the sand, from the sand right under them (m). */
  rangeM: 14,
  /** A new ring every so often (s), spreading this fast (m/s): the drawing's rhythm. */
  pulseS: 1.4,
  ringSpeed: 12,
  /** Patrol speed (m/s), and how fast a drone that spotted the hero follows him (m/s). */
  patrolSpeed: 3.5,
  trackSpeed: 6,
  /** After a spot the alarm stays up this long (s); then a drone may hear him again. */
  alarmS: 8,
} as const;

/** The hero's rings of noise. */
export const NOISE_RINGS = {
  /** The outer ring's radius at full noise (m). */
  maxM: 9,
  /** Under this much noise (0 to 1), no ring at all: nothing to hear. */
  quietBelow: 0.22,
} as const;

/** The radius of the hero's outer noise ring (m): 0 while he is quiet. */
export function noiseRadius(noise: number): number {
  if (!Number.isFinite(noise) || noise < NOISE_RINGS.quietBelow) return 0;
  return Math.min(1, noise) * NOISE_RINGS.maxM;
}

/**
 * True when a drone's rings touch the hero's: his head lies `distanceM` from the sand under the
 * drone, and he makes `noise`.
 */
export function hears(distanceM: number, noise: number): boolean {
  const ring = noiseRadius(noise);
  return ring > 0 && Number.isFinite(distanceM) && distanceM <= SONAR.rangeM + ring;
}
