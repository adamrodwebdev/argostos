/*
 * The game's colours, from the validated mockup: a desert by day under a pale sky, sand in
 * strata that darken with depth, the hero in clear glass with an amber gut. The world's art is
 * the same in both themes (only the interface follows light and dark).
 */

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

const HEX_DIGITS = '0123456789abcdef';

/** A colour written `#rrggbb` (the game's own constants, never outside text). */
export function rgb(hex: string): Rgb {
  const byte = (at: number) =>
    HEX_DIGITS.indexOf(hex.charAt(at).toLowerCase()) * 16 +
    HEX_DIGITS.indexOf(hex.charAt(at + 1).toLowerCase());
  return { r: byte(1), g: byte(3), b: byte(5) };
}

/** The sky: top, middle and horizon (the mockup's day sky), and the sun's glow. */
export const SKY = {
  top: '#86aad2',
  middle: '#cfdde6',
  horizon: '#efe2c8',
  sun: 'rgba(255,246,214,0.55)',
  sunFade: 'rgba(255,246,214,0)',
  /** The sun's place, as shares of the canvas. */
  sunX: 0.16,
  sunY: 0.1,
} as const;

/** A far dune behind the arena: how much it follows the camera, its tone, its height (m). */
export interface FarDune {
  readonly parallax: number;
  readonly tone: string;
  readonly lift: number;
}

/** Hazier than the near sand (air between): a dip in the near dunes never reads as sand. */
export const FAR_DUNES: readonly FarDune[] = [
  { parallax: 0.35, tone: '#e6d8bd', lift: 3.2 },
  { parallax: 0.6, tone: '#ddc8a3', lift: 1.6 },
];

/** The sand at the surface, then deeper and deeper (the mockup's four stops over 46 m). */
export const SAND_DEPTH_STOPS: readonly Rgb[] = ['#d6b47f', '#b98d59', '#8a633e', '#5f432a'].map(
  rgb,
);
/** Each stratum is a little lighter or darker than the one above it. */
export const STRATUM_CONTRAST = 0.05;
/** A grain's own variation, either way. */
export const GRAIN_CONTRAST = 0.035;
/** How much the light fades from the surface to the bottom of the arena. */
export const DEPTH_SHADOW = 0.22;
export const ROCK = rgb('#4b3a2c');
/** The Company's concrete under its exit gates (rock nothing digs). */
export const FOUNDATION = rgb('#8f8a80');
/** The sand's sunlit edge. */
export const SAND_RIM = 'rgba(255,242,218,0.85)';
/** Sand beyond the arena's exits, drawn flat (no simulation there). */
export const OUTSIDE_SAND = '#c9a26f';

/** The hero in clear glass (the first of his five glasses). */
export const GLASS = {
  hi: 'rgba(250,255,255,0.62)',
  mid: 'rgba(214,236,240,0.30)',
  lo: 'rgba(120,160,170,0.38)',
  edge: 'rgba(30,52,58,0.62)',
  rim: 'rgba(255,255,255,0.9)',
  gut: 'rgba(255,170,64,0.9)',
  fin: 'rgba(230,248,250,0.5)',
  bristle: 'rgba(255,255,255,0.55)',
  jaw: '#0c0d10',
  jawEdge: 'rgba(255,255,255,0.7)',
  eye: '#ffb43b',
  eyeGlint: '#fff4cc',
  eyeGlow: 'rgba(255,170,50,0.75)',
  crest: 'rgba(238,250,255,0.82)',
  crestEdge: 'rgba(40,70,80,0.55)',
  glow: 'rgba(255,150,60,0.12)',
  /** The warm seam the sand closes over behind him. */
  seam: [255, 160, 84],
  /** His noise, rippling through the sand. */
  noise: [255, 214, 150],
} as const;

/** Sand thrown into the air, and the dust under the trucks' tyres. */
export const SPRAY_COLOUR = '#d9bb8a';
export const DUST_COLOUR = [234, 208, 164] as const;
export const SHADOW_COLOUR = [70, 46, 24] as const;
/** Bits of a swallowed truck: steel and the Company's orange. */
export const DEBRIS = ['#3d4146', '#5a5f65', '#c4572a', '#e08a3c'] as const;
/** A burnt wreck: the body's sprite darkened to this (alpha kept). */
export const CHARRED = 'rgba(28,18,10,0.86)';
/** The flash when the jaws close. */
export const BITE_FLASH = [255, 236, 190] as const;
/** The art beyond a 2:1 playing frame is dimmed: no one plays out there. */
export const SIDE_SHADE = ['rgba(24,18,12,0.12)', 'rgba(24,18,12,0.42)'] as const;
