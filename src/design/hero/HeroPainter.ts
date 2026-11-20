import { bodyRadiusAt } from '../../rules/swimming';
import { GLASS } from '../palette';
import type { View } from '../View';
import { HeroSprites } from './HeroSprites';
import { Jaws } from './Jaws';
import { Seam } from './Seam';

/** What the painter reads of the hero (the logic's `Hero` fits it): it never changes him. */
export interface HeroLook {
  readonly body: {
    readonly poseXs: Float64Array;
    readonly poseZs: Float64Array;
    readonly lastPoseXs: Float64Array;
    readonly lastPoseZs: Float64Array;
    readonly shape: { readonly lengthM: number; readonly radiusM: number };
    readonly distanceSwum: number;
  };
  readonly x: number;
  readonly z: number;
  readonly speed: number;
  readonly noise: number;
}

/** The body's travelling wave: its length (m), its height (share of the radius). */
const WAVE_M = 6;
const WAVE_HEIGHT = 0.26;
/** At rest the wave still travels this fast (m/s): he breathes. */
const IDLE_WAVE = 0.7;
/** The paddles beat along the body with this wavelength (m) and swing (radians). */
const PADDLE_WAVE_M = 2.6;
const PADDLE_SWING = 0.38;
/** Rings of noise round his head (m, at full noise), and how fast they spread (per second). */
const NOISE_RINGS = Float64Array.from([2.4, 4.2, 6.2]);
const NOISE_PULSE = 1.4;
/** The glass needles of his crest, near the head. */
const CREST_NEEDLES = 9;

/**
 * Draws the hero, a stand-in for his Blender sprites: a segmented glass worm after the studio
 * sheets (rings, paddles and bristles, a crest, four amber eyes, scissor jaws), laid along his
 * body as the logic placed it, blended between the last two steps. A wave runs down his body
 * by the distance he swims (and slowly at rest), his paddles beat with it; his noise ripples
 * round his head; a warm seam fades behind him.
 */
export class HeroPainter {
  readonly jaws = new Jaws();
  private readonly seam = new Seam();
  private readonly count: number;
  private readonly px: Float64Array;
  private readonly py: Float64Array;
  /** Forward (toward the head) and dorsal unit vectors on screen, and the radius (px). */
  private readonly fx: Float64Array;
  private readonly fy: Float64Array;
  private readonly nx: Float64Array;
  private readonly ny: Float64Array;
  private readonly radius: Float64Array;
  private readonly taper: Float64Array;
  private sprites: HeroSprites | null = null;
  private dorsal: 1 | -1 = 1;
  private time = 0;

  constructor(private readonly hero: HeroLook) {
    const n = hero.body.poseXs.length;
    this.count = n;
    this.px = new Float64Array(n);
    this.py = new Float64Array(n);
    this.fx = new Float64Array(n);
    this.fy = new Float64Array(n);
    this.nx = new Float64Array(n);
    this.ny = new Float64Array(n);
    this.radius = new Float64Array(n);
    this.taper = Float64Array.from({ length: n }, (_, k) =>
      bodyRadiusAt(k / (n - 1), hero.body.shape.radiusM),
    );
  }

  /** A frame of `dt` seconds: the jaws move (`eager`: prey in reach, 0 to 1), the seam grows. */
  frame(dt: number, eager: number): void {
    this.time += dt;
    this.jaws.update(eager, dt);
    const { body } = this.hero;
    const tail = this.count - 1;
    this.seam.mark(body.poseXs[tail]!, body.poseZs[tail]!, body.distanceSwum);
  }

  draw(context: CanvasRenderingContext2D, view: View, blend: number): void {
    this.pose(view, blend);
    const s = view.scale;
    const { radiusM, lengthM } = this.hero.body.shape;
    const segment = lengthM / (this.count - 1);
    if (!this.sprites || Math.abs(this.sprites.scale / s - 1) > 0.08) {
      this.sprites = new HeroSprites(s, radiusM, segment);
    }
    const sprites = this.sprites;
    context.save();
    this.seam.draw(context, view, this.radius[this.count - 1]! * 2.6);
    this.drawNoise(context, view);
    this.drawGlow(context);
    this.drawPaddles(context, sprites);
    this.drawGut(context);
    this.drawRings(context, sprites);
    this.drawRim(context);
    this.drawCrest(context);
    this.drawHead(context, sprites);
    context.restore();
  }

  /** The body on screen this frame: blended, waved, with its tangents and its back's side. */
  private pose(view: View, blend: number): void {
    const { body, speed } = this.hero;
    const n = this.count;
    const s = view.scale;
    for (let k = 0; k < n; k++) {
      const x = body.lastPoseXs[k]! + (body.poseXs[k]! - body.lastPoseXs[k]!) * blend;
      const z = body.lastPoseZs[k]! + (body.poseZs[k]! - body.lastPoseZs[k]!) * blend;
      this.px[k] = view.screenX(x);
      this.py[k] = view.screenY(z);
      this.radius[k] = this.taper[k]! * s;
    }
    for (let k = 0; k < n; k++) {
      const a = Math.max(0, k - 1);
      const b = Math.min(n - 1, k + 1);
      // Forward points from the tail toward the head (index 0).
      let dx = this.px[a]! - this.px[b]!;
      let dy = this.py[a]! - this.py[b]!;
      const length = Math.hypot(dx, dy) || 1;
      dx /= length;
      dy /= length;
      this.fx[k] = dx;
      this.fy[k] = dy;
    }
    // His back stays up: the side is chosen by the way his head faces, with some hysteresis.
    const facing = this.fx[0]!;
    if (facing > 0.2) this.dorsal = 1;
    else if (facing < -0.2) this.dorsal = -1;
    const d = this.dorsal;
    const lengthM = body.shape.lengthM;
    const phase = body.distanceSwum + this.time * IDLE_WAVE;
    const vigour = 0.35 + 0.65 * Math.min(1, speed / 8);
    for (let k = 0; k < n; k++) {
      // The dorsal normal: the forward vector turned a quarter toward the screen's top.
      const nx = d * this.fy[k]!;
      const ny = -d * this.fx[k]!;
      this.nx[k] = nx;
      this.ny[k] = ny;
      const along = (k / (n - 1)) * lengthM;
      const wave = Math.sin((2 * Math.PI * (phase - along)) / WAVE_M);
      const lift = this.radius[k]! * WAVE_HEIGHT * vigour * (0.25 + 0.75 * (k / (n - 1))) * wave;
      this.px[k] = this.px[k]! + nx * lift;
      this.py[k] = this.py[k]! + ny * lift;
    }
  }

  private drawNoise(context: CanvasRenderingContext2D, view: View): void {
    const { noise } = this.hero;
    if (noise < 0.04) return;
    const [r, g, b] = GLASS.noise;
    const x = this.px[0]!;
    const y = this.py[0]!;
    const pulse = (this.time * NOISE_PULSE) % 1;
    context.strokeStyle = `rgb(${r} ${g} ${b})`;
    context.lineWidth = Math.max(1, 0.08 * view.scale);
    for (let i = 0; i < NOISE_RINGS.length; i++) {
      const radius = (NOISE_RINGS[i]! + pulse * 1.8) * (0.35 + 0.65 * noise) * view.scale;
      context.globalAlpha = noise * (0.5 - i * 0.14) * (1 - pulse * 0.6);
      context.beginPath();
      context.arc(x, y, radius, 0, Math.PI * 2);
      context.stroke();
    }
    context.globalAlpha = 1;
  }

  /** A soft warm light round the body (a wide stroke: no blur filter on the canvas). */
  private drawGlow(context: CanvasRenderingContext2D): void {
    context.strokeStyle = GLASS.glow;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = this.radius[2]! * 3.2;
    this.strokeSpine(context, 0, this.count);
  }

  private strokeSpine(context: CanvasRenderingContext2D, from: number, to: number): void {
    context.beginPath();
    context.moveTo(this.px[from]!, this.py[from]!);
    for (let k = from + 1; k < to; k++) context.lineTo(this.px[k]!, this.py[k]!);
    context.stroke();
  }

  /** The paddles under each ring, beating in a wave down the body. */
  private drawPaddles(context: CanvasRenderingContext2D, sprites: HeroSprites): void {
    const phase = this.hero.body.distanceSwum + this.time * IDLE_WAVE;
    const lengthM = this.hero.body.shape.lengthM;
    const anchorY = sprites.paddle.height / 2;
    for (let k = 2; k < this.count - 1; k++) {
      const fx = this.fx[k]!;
      const fy = this.fy[k]!;
      const nx = this.nx[k]!;
      const ny = this.ny[k]!;
      const r = this.radius[k]!;
      const share = r / (sprites.radiusM * sprites.scale);
      // Down and back from the belly, swinging with the wave.
      const along = (k / (this.count - 1)) * lengthM;
      const swing = PADDLE_SWING * Math.sin((2 * Math.PI * (phase - along)) / PADDLE_WAVE_M);
      let qx = -nx * 0.85 - fx * 0.55;
      let qy = -ny * 0.85 - fy * 0.55;
      const cos = Math.cos(swing);
      const sin = Math.sin(swing);
      const rx = qx * cos - qy * sin;
      const ry = qx * sin + qy * cos;
      const length = Math.hypot(rx, ry) || 1;
      qx = rx / length;
      qy = ry / length;
      const bx = this.px[k]! - nx * r * 0.7;
      const by = this.py[k]! - ny * r * 0.7;
      context.setTransform(qx * share, qy * share, -qy * share, qx * share, bx, by);
      context.drawImage(sprites.paddle, -2, -anchorY);
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
  }

  private drawGut(context: CanvasRenderingContext2D): void {
    context.strokeStyle = GLASS.gut;
    context.lineWidth = Math.max(1.2, this.radius[3]! * 0.2);
    context.lineCap = 'round';
    this.strokeSpine(context, 3, this.count - 4);
  }

  /** The glass rings, tail first, each turned along the body, its back up. */
  private drawRings(context: CanvasRenderingContext2D, sprites: HeroSprites): void {
    const ring = sprites.ring;
    const anchorX = ring.width / 2;
    const anchorY = sprites.ringAnchorY;
    const reference = sprites.radiusM * sprites.scale;
    for (let k = this.count - 1; k >= 1; k--) {
      const share = this.radius[k]! / reference;
      context.setTransform(
        this.fx[k]!,
        this.fy[k]!,
        -this.nx[k]! * share,
        -this.ny[k]! * share,
        this.px[k]!,
        this.py[k]!,
      );
      context.drawImage(ring, -anchorX, -anchorY);
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** The highlight along his back. */
  private drawRim(context: CanvasRenderingContext2D): void {
    const from = Math.round(this.count * 0.08);
    const to = Math.round(this.count * 0.82);
    context.strokeStyle = GLASS.rim;
    context.globalAlpha = 0.85;
    context.lineWidth = Math.max(1, this.radius[2]! * 0.1);
    context.beginPath();
    for (let k = from; k < to; k++) {
      const x = this.px[k]! + this.nx[k]! * this.radius[k]! * 0.55;
      const y = this.py[k]! + this.ny[k]! * this.radius[k]! * 0.55;
      if (k === from) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();
    context.globalAlpha = 1;
  }

  /** Swept-back glass needles on the first rings. */
  private drawCrest(context: CanvasRenderingContext2D): void {
    const r0 = this.radius[0]!;
    context.fillStyle = GLASS.crest;
    context.strokeStyle = GLASS.crestEdge;
    context.lineWidth = 0.8;
    for (let j = 0; j < CREST_NEEDLES; j++) {
      const u = j / (CREST_NEEDLES - 1);
      const k = Math.min(this.count - 2, Math.round(u * 4));
      const fx = this.fx[k]!;
      const fy = this.fy[k]!;
      const nx = this.nx[k]!;
      const ny = this.ny[k]!;
      const length = (0.8 + 1.1 * Math.sin(Math.PI * (0.15 + 0.8 * u))) * r0;
      const qx = nx * 0.72 - fx * 0.72;
      const qy = ny * 0.72 - fy * 0.72;
      const ox = this.px[k]! + nx * this.radius[k]! * 0.85 + fx * (0.6 - u) * r0;
      const oy = this.py[k]! + ny * this.radius[k]! * 0.85 + fy * (0.6 - u) * r0;
      const half = 0.07 * r0;
      context.beginPath();
      context.moveTo(ox + fx * half, oy + fy * half);
      context.lineTo(ox + qx * length, oy + qy * length);
      context.lineTo(ox - fx * half, oy - fy * half);
      context.closePath();
      context.fill();
      context.stroke();
    }
  }

  /** The head: its dome, the scissor jaws on their hinges, the antennae and four amber eyes. */
  private drawHead(context: CanvasRenderingContext2D, sprites: HeroSprites): void {
    const r0 = sprites.radiusM * sprites.scale;
    const fx = this.fx[0]!;
    const fy = this.fy[0]!;
    const nx = this.nx[0]!;
    const ny = this.ny[0]!;
    const x = this.px[0]!;
    const y = this.py[0]!;
    // The dome, its back up (the sprite's −y is its back).
    context.setTransform(fx, fy, -nx, -ny, x, y);
    context.drawImage(sprites.head, -sprites.headAnchorX, -sprites.headAnchorY);
    // From here, units of the head's radius: a along him, b toward his back.
    context.setTransform(fx * r0, fy * r0, nx * r0, ny * r0, x, y);
    const open = this.jaws.opening * 0.5;
    for (const side of [1, -1] as const) this.drawJaw(context, side, open);
    context.strokeStyle = GLASS.bristle;
    context.lineWidth = Math.max(0.7, 0.04 * r0) / r0;
    for (const [angle, length] of ANTENNAE) {
      const qa = Math.cos(angle);
      const qb = Math.sin(angle);
      context.beginPath();
      context.moveTo(0.62, 0.55);
      context.quadraticCurveTo(
        0.62 + qa * length * 0.6,
        0.55 + qb * length * 0.6 + 0.3,
        0.62 + qa * length,
        0.55 + qb * length,
      );
      context.stroke();
    }
    const eye = Math.max(1.8, 0.13 * r0) / r0;
    const glow = sprites.eyeGlow;
    for (const [a, b] of EYES) {
      context.drawImage(glow, a - eye * 3, b - eye * 3, eye * 6, eye * 6);
      context.fillStyle = GLASS.eye;
      context.beginPath();
      context.arc(a, b, eye, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = GLASS.eyeGlint;
      context.beginPath();
      context.arc(a - eye * 0.3, b + eye * 0.3, eye * 0.4, 0, Math.PI * 2);
      context.fill();
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** One jaw (side +1 on his back's side, −1 on his belly's), turned open on its hinge. */
  private drawJaw(context: CanvasRenderingContext2D, side: 1 | -1, open: number): void {
    context.save();
    context.translate(1.4, 0);
    context.rotate(side * open);
    context.translate(-1.4, 0);
    context.fillStyle = GLASS.jaw;
    context.beginPath();
    context.moveTo(1.4, 0.3 * side);
    context.quadraticCurveTo(2.35, 1.2 * side, 3.3, 0.22 * side);
    context.quadraticCurveTo(2.3, 0.62 * side, 1.45, 0.02 * side);
    context.closePath();
    context.fill();
    context.strokeStyle = GLASS.jawEdge;
    context.lineWidth = 0.05;
    context.beginPath();
    context.moveTo(1.6, 0.42 * side);
    context.quadraticCurveTo(2.35, 1.02 * side, 3.05, 0.34 * side);
    context.stroke();
    context.restore();
  }
}

/** The antennae (angle from his heading toward his back, length), and his eyes (a, b). */
const ANTENNAE: readonly (readonly [number, number])[] = [
  [0.35, 1.7],
  [0.7, 2.1],
  [1.05, 1.6],
];
const EYES: readonly (readonly [number, number])[] = [
  [0.6, 0.55],
  [0.38, 0.74],
  [0.08, 0.84],
  [-0.16, 0.84],
];
