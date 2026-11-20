/*
 * How the Company's truck drives over the moving sand: the tuning of the sprite test bench
 * (2026-11-20). Its wheels roll by the distance driven, never sliding; its body rides on a
 * spring and a damper at each axle, squats as it pulls away and dives as it brakes.
 */

/** Natural frequency (Hz) and damping ratio of a suspension corner. */
const BODY_HZ = 1.4;
const BODY_DAMPING = 0.45;
/** The tyres follow the sand faster than the body: a stiff, well-damped spring. */
const TYRE_HZ = 6;
const TYRE_DAMPING = 0.9;

export interface SpringTuning {
  /** Stiffness per unit mass (1/s²). */
  readonly k: number;
  /** Damping per unit mass (1/s). */
  readonly c: number;
}

function spring(hz: number, damping: number): SpringTuning {
  const w = 2 * Math.PI * hz;
  return { k: w * w, c: 2 * damping * w };
}

export const SUSPENSION: SpringTuning = spring(BODY_HZ, BODY_DAMPING);
export const TYRE: SpringTuning = spring(TYRE_HZ, TYRE_DAMPING);

export const DRIVE = {
  /** Acceleration and braking (m/s²): a loaded haul truck is slow to start and stop. */
  accel: 1.4,
  brake: 2.4,
  /** How far the body squats (m) per m/s² of acceleration. */
  squat: 0.025,
  /** The front dives this share of the rear's squat. */
  diveShare: 0.6,
  /** Points under a wheel where it may rest on the sand (an odd number, centre included). */
  probes: 9,
} as const;
