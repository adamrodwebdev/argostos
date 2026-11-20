import { DEBRIS as DEBRIS_TONES } from '../palette';
import type { ParticleKind } from './ParticlePool';

/*
 * The kinds of particles, as data rows (a new kind is a row): their physics, their look, and
 * the size of their pool. The pools add up to about 1,400 particles at most, a budget a
 * mid-range phone draws within its frame (a takedown uses about 300 of them).
 */

export const PARTICLE_KINDS = {
  smoke: {
    capacity: 160,
    gravity: 0,
    lift: 1.1,
    drag: 0.9,
    size: 0.55,
    growth: 1.1,
    alpha: 0.42,
    landing: 'ignore',
    additive: false,
    shape: 'soft',
    colours: ['rgb(58 54 50)', 'rgb(84 78 72)', 'rgb(40 37 34)'],
    ramp: false,
  },
  dust: {
    capacity: 220,
    gravity: 0.15,
    lift: 0,
    drag: 1.6,
    size: 0.3,
    growth: 0.7,
    alpha: 0.32,
    landing: 'vanish',
    additive: false,
    shape: 'soft',
    colours: ['rgb(234 208 164)', 'rgb(214 186 140)'],
    ramp: false,
  },
  chip: {
    capacity: 140,
    gravity: 16,
    lift: 0,
    drag: 0.2,
    size: 0.32,
    growth: 0,
    alpha: 1,
    landing: 'bounce',
    additive: false,
    shape: 'chip',
    colours: [...DEBRIS_TONES],
    ramp: false,
  },
  glass: {
    capacity: 180,
    gravity: 14,
    lift: 0,
    drag: 0.3,
    size: 0.2,
    growth: 0,
    alpha: 0.95,
    landing: 'bounce',
    additive: false,
    shape: 'chip',
    colours: ['#e6fbff', '#bfeef2', '#9fdbe0', '#ffffff'],
    ramp: false,
  },
  spark: {
    capacity: 240,
    gravity: 9,
    lift: 0,
    drag: 0.6,
    size: 0.06,
    growth: 0,
    alpha: 1,
    landing: 'vanish',
    additive: true,
    shape: 'streak',
    colours: ['#fff6c8', '#ffd27a', '#ffb347'],
    ramp: false,
  },
  fire: {
    capacity: 260,
    gravity: 0,
    lift: 4.5,
    drag: 2.2,
    size: 0.6,
    growth: -0.45,
    alpha: 0.85,
    landing: 'ignore',
    additive: true,
    shape: 'soft',
    // Over its life: white-hot, yellow, orange, then a dull red.
    colours: ['rgb(255 248 220)', 'rgb(255 214 120)', 'rgb(255 150 50)', 'rgb(190 64 20)'],
    ramp: true,
  },
  ember: {
    capacity: 160,
    gravity: 0,
    lift: 0.9,
    drag: 0.8,
    size: 0.08,
    growth: 0,
    alpha: 1,
    landing: 'ignore',
    additive: true,
    shape: 'soft',
    colours: ['rgb(255 170 60)', 'rgb(255 120 40)'],
    ramp: false,
  },
} as const satisfies Readonly<Record<string, ParticleKind>>;

export type ParticleKindName = keyof typeof PARTICLE_KINDS;

/** The order they are drawn in: smoke behind, light on top. */
export const DRAW_ORDER: readonly ParticleKindName[] = [
  'smoke',
  'dust',
  'chip',
  'glass',
  'fire',
  'spark',
  'ember',
];
