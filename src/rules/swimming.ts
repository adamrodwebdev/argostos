/*
 * How the hero swims: a finger (or the pointer) gives a target; the farther it is from the
 * head, the faster he goes and the more noise he makes. Pure data and functions; the logic
 * keeps the state (position, heading, speed) and applies them once per fixed step.
 */

/** The hero at his first stage of growth (the mockup: 17 m long, 1.8 m thick). */
export const HERO_BODY = {
  lengthM: 17,
  /** Radius of the body just behind the head. */
  radiusM: 0.9,
  /** The tail's radius, as a share of the body's. */
  tailShare: 0.36,
  /** Where the body is thickest, as a share of its length from the head. */
  shoulder: 0.16,
} as const;

export const SWIM = {
  /** Fastest swim through the sand (m/s), finger far from the head. */
  maxSpeed: 14,
  /** Speed with no finger on the screen: he cruises on, slowly. */
  cruiseSpeed: 2.2,
  /** Gaining and losing speed (m/s²): he starts and stops with weight. */
  accel: 22,
  decel: 11,
  /** Tightest turn at speed (m) and the turn rate kept at a standstill (rad/s). */
  minTurnRadiusM: 3.4,
  minTurnRate: 1.8,
  /** Below this distance between head and finger (m), the throttle is 0. */
  deadZoneM: 0.8,
} as const;

/** Leaving the sand (jaillir) and coming back. */
export const BREACH = {
  /** Upward speed needed to burst out (m/s); slower, he skims under the surface. */
  minUpSpeed: 4,
  /** The burst out of the sand speeds him up this much. */
  boost: 1.25,
  /** Gravity on the body in the air (m/s²): a little more than Earth's, for snappy leaps. */
  gravity: 14,
  /** How fast the finger still turns him in the air (rad/s): a nudge, not a flight. */
  airTurnRate: 0.9,
  /** Speed kept when the head plunges back into the sand. */
  entryKeep: 0.82,
  /** A slow rise that meets the air levels off: at most this angle above level (rad). */
  skimAngle: 0.12,
  /** …and sinks back this fast (m/s), so he skims with his back just out of the sand. */
  skimSink: 0.5,
} as const;

/** Where the hero cruises when nobody steers him, and how close to a wall he turns back. */
export const CRUISE = {
  /** Depth of the cruise (m, below the mean surface). */
  depthZ: -9,
  /** How hard he levels toward that depth (rad per metre off it, capped). */
  levelGain: 0.08,
  levelMax: 0.6,
  /** Distance from a wall (m) where he turns back. */
  wallMarginM: 10,
  /** Height above the bedrock (m) where he turns up. */
  floorMarginM: 3,
} as const;

/** Noise: what the Company's sonar will read (the drones come in P2). */
export const NOISE = {
  /** Under this speed (m/s), he makes no noise at all. */
  quietSpeed: 1.2,
  /** How noise grows with speed: above 1, quiet at cruise, loud at full speed. */
  exponent: 1.6,
  /** How fast the noise number follows the speed (per second). */
  follow: 6,
  /** A burst out of the sand is loud whatever the speed. */
  breach: 1,
} as const;

/**
 * The throttle a finger at `distanceM` from the head asks for: 0 in the dead zone, 1 at
 * `fullAtM` and beyond, eased in between (a finger near the head creeps, far away it races).
 * Non-finite inputs give 0: a broken reading never becomes full speed.
 */
export function throttleFor(distanceM: number, fullAtM: number): number {
  if (!Number.isFinite(distanceM) || !Number.isFinite(fullAtM)) return 0;
  const span = Math.max(fullAtM - SWIM.deadZoneM, 0.001);
  const t = Math.min(1, Math.max(0, (distanceM - SWIM.deadZoneM) / span));
  return t * t * (3 - 2 * t);
}

/** The speed a throttle asks for: the cruise when idle, up to the fastest swim. */
export function speedFor(throttle: number): number {
  const t = Math.min(1, Math.max(0, throttle));
  return SWIM.cruiseSpeed + (SWIM.maxSpeed - SWIM.cruiseSpeed) * t;
}

/** The fastest he can turn at this speed (rad/s): a turning circle, never a pivot. */
export function maxTurnRate(speed: number): number {
  return SWIM.minTurnRate + Math.abs(speed) / SWIM.minTurnRadiusM;
}

/** How much a value may rise or fall in one step. */
export interface StepChange {
  readonly up: number;
  readonly down: number;
}

/** `current` moved toward `target` by at most `change.up` when rising, `change.down` when falling. */
export function approach(current: number, target: number, change: StepChange): number {
  if (target > current) return Math.min(target, current + change.up);
  return Math.max(target, current - change.down);
}

/** The swim's acceleration and braking over one step of `dt` seconds. */
export function speedChange(dt: number): StepChange {
  return { up: SWIM.accel * dt, down: SWIM.decel * dt };
}

/** The angle from `from` to `to`, the short way round, in (−π, π]. */
export function angleBetween(from: number, to: number): number {
  const d = (to - from) % (2 * Math.PI);
  if (d > Math.PI) return d - 2 * Math.PI;
  if (d <= -Math.PI) return d + 2 * Math.PI;
  return d;
}

/** `heading` turned toward `desired` by at most `maxStep` radians. */
export function turnToward(heading: number, desired: number, maxStep: number): number {
  const d = angleBetween(heading, desired);
  return heading + Math.max(-maxStep, Math.min(maxStep, d));
}

/** The noise his speed makes, from 0 (silent) to 1 (full speed). */
export function noiseFor(speed: number): number {
  if (!Number.isFinite(speed)) return 0;
  const t = (Math.abs(speed) - NOISE.quietSpeed) / (SWIM.maxSpeed - NOISE.quietSpeed);
  return Math.min(1, Math.max(0, t)) ** NOISE.exponent;
}

/**
 * The body's radius at `u` along it (0 at the head, 1 at the tail): it swells to the shoulder,
 * then thins to the tail, like the mockup's stand-in.
 */
export function bodyRadiusAt(u: number, radius: number): number {
  const s = Math.min(1, Math.max(0, u));
  const { shoulder, tailShare } = HERO_BODY;
  if (s < shoulder) return radius * (0.92 + 0.08 * (s / shoulder));
  return radius * (1 - (1 - tailShare) * ((s - shoulder) / (1 - shoulder)) ** 1.3);
}
