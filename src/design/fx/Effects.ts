import type { RandomSource } from '../../rules/random';
import type { View } from '../View';
import { BiteFlashes } from './BiteFlashes';
import { DRAW_ORDER, PARTICLE_KINDS, type ParticleKindName } from './particleKinds';
import { ParticlePool, type Emit, type Ground } from './ParticlePool';

/** A burst of particles of one kind round a point: how many, how fast, how long. */
export interface Burst {
  readonly kind: ParticleKindName;
  readonly x: number;
  readonly z: number;
  readonly count: number;
  /** Speed range (m/s) and the direction's spread round `angle` (radians, z up). */
  readonly speed: number;
  readonly angle: number;
  readonly spread: number;
  readonly life: number;
  /** A velocity every particle also carries (m/s). */
  readonly carryX?: number;
  readonly carryZ?: number;
}

/**
 * The cosmetic effects of the hunt: one fixed pool per kind of particle (smoke, dust, chips,
 * glass, fire, sparks, embers) and the bite flashes. They follow the hunt's time (they stand
 * still in a hit-stop) and change nothing in it.
 */
export class Effects {
  readonly flashes: BiteFlashes;
  private readonly pools = new Map<ParticleKindName, ParticlePool>();
  private readonly order: readonly ParticlePool[];
  private readonly emit: { x: number; z: number; vx: number; vz: number; life: number } = {
    x: 0,
    z: 0,
    vx: 0,
    vz: 0,
    life: 0,
  };

  constructor(
    private readonly random: RandomSource,
    reducedMotion: boolean,
  ) {
    for (const name of DRAW_ORDER)
      this.pools.set(name, new ParticlePool(PARTICLE_KINDS[name], random));
    this.order = DRAW_ORDER.map((name) => this.pool(name));
    this.flashes = new BiteFlashes(reducedMotion);
  }

  private pool(name: ParticleKindName): ParticlePool {
    const pool = this.pools.get(name);
    if (!pool) throw new Error(`no pool for ${name}`);
    return pool;
  }

  /** Particles alive now, all kinds. */
  get count(): number {
    let n = 0;
    for (const pool of this.order) n += pool.count;
    return n;
  }

  /** One particle (the emitter object is reused: nothing allocated). */
  one(kind: ParticleKindName, particle: Emit): void {
    this.pool(kind).emit(particle);
  }

  burst(burst: Burst): void {
    const { random, emit } = this;
    const pool = this.pool(burst.kind);
    for (let i = 0; i < burst.count; i++) {
      const angle = burst.angle + (random.next() - 0.5) * burst.spread;
      const speed = burst.speed * (0.35 + 0.65 * random.next());
      emit.x = burst.x;
      emit.z = burst.z;
      emit.vx = Math.cos(angle) * speed + (burst.carryX ?? 0);
      emit.vz = Math.sin(angle) * speed + (burst.carryZ ?? 0);
      emit.life = burst.life * (0.6 + 0.8 * random.next());
      pool.emit(emit);
    }
  }

  step(dt: number, ground: Ground): void {
    for (const pool of this.order) pool.step(dt, ground);
    this.flashes.frame(dt);
  }

  draw(context: CanvasRenderingContext2D, view: View): void {
    for (const pool of this.order) pool.draw(context, view);
    this.flashes.draw(context, view);
  }
}
