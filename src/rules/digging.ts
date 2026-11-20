/*
 * How the hero moves the sand: he swims through it, he does not carve fixed tunnels. The sand
 * his head meets is pushed aside into any gap close by, thrown up when that gap is open air, or
 * carried round his body and laid back behind him, so his wake closes as he passes and the
 * desert keeps every grain.
 */

export const DIGGING = {
  /** How far (in cells) a grain is pushed out from the body to find a gap. */
  pushReach: 4,
  /** Grains carried round the body at most; beyond, they are laid on the sand's top. */
  carriedMax: 4096,
  /** Grains in flight at most (thrown sand). */
  sprayMax: 2048,
} as const;

/**
 * The burst of sand when he leaves the dunes (jaillir) or plunges back: the sand round the hole
 * is thrown up. It comes from the rim, so the desert keeps every grain.
 */
export const BURST = {
  /** Half-width of the rim thrown up (m). */
  reachM: 2.2,
  /** Grains taken from the top of each column of the rim. */
  grainsPerColumn: 3,
  /** Only sand this close under the head's height (m) belongs to the rim. */
  rimDepthM: 2,
  /** Upward and sideways speed (m/s) at full strength. */
  up: 7.5,
  spread: 4,
  /** Strength of a burst out, and of a plunge back in. */
  breach: 1,
  dive: 0.55,
} as const;

/** The speed (m/s) of sand thrown into the air by the hero. */
export const SPRAY = {
  /** Out from the body, whatever his speed. */
  base: 1.6,
  /** …plus this share of his speed. */
  perSpeed: 0.38,
  /** …plus this share of his own velocity (sand dragged along). */
  carry: 0.3,
  /** Random spread, either way. */
  jitter: 0.7,
} as const;
