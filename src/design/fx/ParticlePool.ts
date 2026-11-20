import type { RandomSource } from '../../rules/random';
import type { View } from '../View';

/** The height of the ground under any x (m). */
export type Ground = (x: number) => number;

/** How a kind of particle lands on the sand. */
export type Landing = 'vanish' | 'bounce' | 'ignore';

/** One kind of particle: its physics and its look (m, s, m/s²). Data, so a new kind is a row. */
export interface ParticleKind {
  readonly capacity: number;
  /** Pull down (m/s², gravity) and up (buoyancy: smoke and flames rise). */
  readonly gravity: number;
  readonly lift: number;
  /** Air drag (per second). */
  readonly drag: number;
  /** Size at birth (m) and its change per second of life. */
  readonly size: number;
  readonly growth: number;
  /** Opacity at birth; it fades to nothing over the life. */
  readonly alpha: number;
  readonly landing: Landing;
  /** Light adds up (fire, sparks, embers) instead of covering. */
  readonly additive: boolean;
  /** How it is drawn: a soft sprite, a spinning chip, a streak along its motion. */
  readonly shape: 'soft' | 'chip' | 'streak';
  /** Its colours (one is drawn per particle, or a ramp over its life for soft ones). */
  readonly colours: readonly string[];
  /** Soft particles' colours change along their life (fire: white, yellow, orange, red). */
  readonly ramp: boolean;
}

/** A particle to start: where, how fast, how long (m, m/s, s). */
export interface Emit {
  readonly x: number;
  readonly z: number;
  readonly vx: number;
  readonly vz: number;
  readonly life: number;
}

/**
 * A pool of particles of one kind (sparks, glass, smoke, fire…), fixed in size: a new one takes
 * the oldest slot when the pool is full. Cosmetic only: nothing in the hunt depends on them.
 * Typed arrays, sprites drawn once: nothing allocated per frame.
 */
export class ParticlePool {
  private readonly x: Float32Array;
  private readonly z: Float32Array;
  private readonly vx: Float32Array;
  private readonly vz: Float32Array;
  private readonly age: Float32Array;
  private readonly life: Float32Array;
  private readonly spin: Float32Array;
  private readonly tone: Uint8Array;
  private next = 0;
  private live = 0;
  private readonly sprites: HTMLCanvasElement[];
  /** The particle being drawn: its share of life, its place and size on screen (px). */
  private t = 0;
  private px = 0;
  private py = 0;
  private size = 0;

  constructor(
    private readonly kind: ParticleKind,
    private readonly random: RandomSource,
  ) {
    const n = kind.capacity;
    this.x = new Float32Array(n);
    this.z = new Float32Array(n);
    this.vx = new Float32Array(n);
    this.vz = new Float32Array(n);
    this.age = new Float32Array(n).fill(1);
    this.life = new Float32Array(n).fill(1);
    this.spin = new Float32Array(n);
    this.tone = new Uint8Array(n);
    this.sprites = kind.shape === 'soft' ? kind.colours.map((colour) => softSprite(colour)) : [];
  }

  /** Particles alive now. */
  get count(): number {
    return this.live;
  }

  emit(particle: Emit): void {
    const i = this.next;
    this.next = (i + 1) % this.kind.capacity;
    if (this.age[i]! >= this.life[i]!) this.live++;
    this.x[i] = particle.x;
    this.z[i] = particle.z;
    this.vx[i] = particle.vx;
    this.vz[i] = particle.vz;
    this.age[i] = 0;
    this.life[i] = Math.max(0.05, particle.life);
    this.spin[i] = (this.random.next() - 0.5) * 16;
    this.tone[i] = this.random.nextInt(this.kind.colours.length);
  }

  step(dt: number, ground: Ground): void {
    if (this.live === 0) return;
    const { kind } = this;
    const drag = Math.exp(-kind.drag * dt);
    const pull = (kind.lift - kind.gravity) * dt;
    for (let i = 0; i < kind.capacity; i++) {
      if (this.age[i]! >= this.life[i]!) continue;
      this.vx[i] = this.vx[i]! * drag;
      this.vz[i] = this.vz[i]! * drag + pull;
      this.x[i] = this.x[i]! + this.vx[i]! * dt;
      this.z[i] = this.z[i]! + this.vz[i]! * dt;
      this.age[i] = this.age[i]! + dt;
      if (kind.landing !== 'ignore' && this.vz[i]! < 0) {
        const floor = ground(this.x[i]!);
        if (this.z[i]! < floor) {
          if (kind.landing === 'vanish') this.age[i] = this.life[i]!;
          else {
            this.z[i] = floor;
            this.vz[i] = -this.vz[i]! * 0.3;
            this.vx[i] = this.vx[i]! * 0.5;
            this.spin[i] = this.spin[i]! * 0.5;
          }
        }
      }
      if (this.age[i]! >= this.life[i]!) this.live--;
    }
  }

  draw(context: CanvasRenderingContext2D, view: View): void {
    if (this.live === 0) return;
    const { kind } = this;
    context.globalCompositeOperation = kind.additive ? 'lighter' : 'source-over';
    for (let i = 0; i < kind.capacity; i++) {
      const age = this.age[i]!;
      const life = this.life[i]!;
      if (age >= life) continue;
      this.t = age / life;
      this.px = view.screenX(this.x[i]!);
      this.py = view.screenY(this.z[i]!);
      this.size = Math.max(0.02, kind.size + kind.growth * age) * view.scale;
      context.globalAlpha = kind.alpha * (1 - this.t);
      if (kind.shape === 'soft') this.drawSoft(context, i);
      else if (kind.shape === 'chip') this.drawChip(context, i);
      else this.drawStreak(context, i, view.scale);
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
  }

  private drawSoft(context: CanvasRenderingContext2D, i: number): void {
    const { sprites, px, py, size } = this;
    const index = this.kind.ramp
      ? Math.min(sprites.length - 1, Math.floor(this.t * sprites.length))
      : this.tone[i]!;
    const sprite = sprites[index] ?? sprites[0];
    if (sprite) context.drawImage(sprite, px - size, py - size, size * 2, size * 2);
  }

  private drawChip(context: CanvasRenderingContext2D, i: number): void {
    const { px, py, size } = this;
    const angle = this.spin[i]! * this.age[i]!;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    context.setTransform(cos, sin, -sin, cos, px, py);
    context.fillStyle = this.kind.colours[this.tone[i]!] ?? '#fff';
    context.beginPath();
    context.moveTo(-size / 2, -size / 3);
    context.lineTo(size / 2, 0);
    context.lineTo(-size / 4, size / 3);
    context.closePath();
    context.fill();
    context.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** A spark: a short line along its motion, as a fast light blurs. */
  private drawStreak(context: CanvasRenderingContext2D, i: number, scale: number): void {
    const { px, py, size } = this;
    const vx = this.vx[i]! * 0.035 * scale;
    const vz = -this.vz[i]! * 0.035 * scale;
    context.strokeStyle = this.kind.colours[this.tone[i]!] ?? '#fff';
    context.lineWidth = Math.max(1, size);
    context.beginPath();
    context.moveTo(px, py);
    context.lineTo(px - vx, py - vz);
    context.stroke();
  }
}

/** A soft round blob of an `rgb(r g b)` colour, fading to nothing at its edge (drawn once). */
function softSprite(colour: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 48;
  const context = canvas.getContext('2d');
  if (context) {
    const gradient = context.createRadialGradient(24, 24, 0, 24, 24, 24);
    gradient.addColorStop(0, colour);
    // Fades to the same colour, transparent (fading to transparent black would leave a dark rim).
    gradient.addColorStop(1, colour.replace(')', ' / 0)'));
    context.fillStyle = gradient;
    context.fillRect(0, 0, 48, 48);
  }
  return canvas;
}
