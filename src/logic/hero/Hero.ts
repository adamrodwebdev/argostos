import { BURST } from '../../rules/digging';
import { HERO_BODY, NOISE, noiseFor } from '../../rules/swimming';
import type { SteeringIntent } from '../input/Steering';
import type { GridProbe } from '../sand/GridProbe';
import type { SandSurface } from '../sand/GridSurface';
import { HeadTrace } from './HeadTrace';
import { HeroBody } from './HeroBody';
import { HeroDigging, type DiggingWorld } from './HeroDigging';
import { HeroMotion, Transition, type Medium, type TransitionId } from './HeroMotion';

/** Everything the hero swims in. */
export interface HeroWorld extends DiggingWorld {
  readonly probe: GridProbe;
  readonly surface: SandSurface;
}

/** Where the hero starts a hunt (m, radians). */
export interface HeroStart {
  readonly x: number;
  readonly z: number;
  readonly heading: number;
}

/** Points drawn along the body: one per segment of the stand-in (the mockup has 26). */
const POSE_POINTS = 30;
/** The head's recent path kept for the runes to come: a place every half metre, 256 of them. */
const TRACE_PLACES = 256;
const TRACE_SPACING_M = 0.5;

/**
 * The hero (code name only): a segmented worm that swims through the sand toward the player's
 * finger, bursts out when he rises fast, and moves the sand as he goes. He makes noise in
 * proportion to his speed: a number the Company's sonar drones will read (P2).
 */
export class Hero {
  readonly body: HeroBody;
  /** His head's recent path (a rune's recogniser will read it later). */
  readonly trace = new HeadTrace(TRACE_PLACES, TRACE_SPACING_M);
  private clock = 0;
  private readonly motion: HeroMotion;
  private readonly digging: HeroDigging;
  private loudness = 0;
  private readonly velocity = { x: 0, z: 0 };

  constructor(
    world: HeroWorld,
    start: HeroStart,
    private readonly stepSeconds: number,
  ) {
    const { cellM, columns, bottomZ, bedrockRows } = world.measures;
    const radiusM = HERO_BODY.radiusM;
    this.body = new HeroBody({
      lengthM: HERO_BODY.lengthM,
      radiusM,
      fillPoints: Math.ceil(HERO_BODY.lengthM / cellM) + 1,
      posePoints: POSE_POINTS,
    });
    this.motion = new HeroMotion({
      ...start,
      radiusM,
      cellM,
      bounds: {
        minX: radiusM + 0.5,
        maxX: columns * cellM - radiusM - 0.5,
        floorZ: bottomZ + bedrockRows * cellM + radiusM + 0.3,
      },
      probe: world.probe,
      surface: world.surface,
      stepSeconds,
    });
    this.digging = new HeroDigging(world);
    this.body.lay(start.x, start.z, start.heading);
    this.digging.dig(this.body, this.velocity);
  }

  get x(): number {
    return this.motion.x;
  }
  get z(): number {
    return this.motion.z;
  }
  get heading(): number {
    return this.motion.heading;
  }
  get speed(): number {
    return this.motion.speed;
  }
  get velocityX(): number {
    return this.motion.velocityX;
  }
  get velocityZ(): number {
    return this.motion.velocityZ;
  }
  get medium(): Medium {
    return this.motion.medium;
  }
  get radius(): number {
    return this.body.shape.radiusM;
  }

  /** How loud he is, from 0 (silent) to 1: what the sonar reads (P2). */
  get noise(): number {
    return this.loudness;
  }

  /** A burst of speed (the ram) is driving him on. */
  get boosting(): boolean {
    return this.motion.boosting;
  }

  /** A burst of speed along his way (the ram). */
  boost(speed: number, seconds: number): void {
    this.motion.boost(speed, seconds);
  }

  /** He hit something hard: he keeps only `share` of his speed. */
  recoil(share: number): void {
    this.motion.brake(share);
  }

  /** Grains carried round his body (still the desert's sand). */
  get carriedGrains(): number {
    return this.digging.carriedGrains;
  }

  /** One fixed step: he steers, moves, and moves the sand. */
  step(intent: SteeringIntent): TransitionId {
    const transition = this.motion.step(intent);
    this.body.follow(this.motion.x, this.motion.z);
    this.velocity.x = this.motion.velocityX;
    this.velocity.z = this.motion.velocityZ;
    this.digging.dig(this.body, this.velocity);
    if (transition === Transition.Breach) {
      this.digging.burst(this.motion.x, this.motion.z, BURST.breach);
      // A fast burst throws up what he carried: a mound round the hole.
      this.digging.mound(this.motion.x, this.motion.z, Math.min(1, this.motion.speed / 14));
    } else if (transition === Transition.Dive) {
      this.digging.burst(this.motion.x, this.motion.z, BURST.dive);
    }
    this.clock += this.stepSeconds;
    this.trace.record(this.motion.x, this.motion.z, this.clock);
    // Noise rises at once and fades smoothly; a burst out of the sand is loud.
    const heard = transition === Transition.Breach ? NOISE.breach : noiseFor(this.motion.speed);
    const fade = 1 - Math.exp(-NOISE.follow * this.stepSeconds);
    this.loudness = Math.max(heard, this.loudness + (heard - this.loudness) * fade);
    return transition;
  }
}
