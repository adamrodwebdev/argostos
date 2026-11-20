import type { Drone } from '../../logic/drone/Drone';
import { SONAR } from '../../rules/sonar';
import type { Effects } from '../fx/Effects';
import type { SoundPort } from '../sound/SoundPort';
import type { View } from '../View';

export interface DronePainterOptions {
  readonly drones: () => readonly Drone[];
  /** The hero's head (m): a ping is heard when he is near, and the mark circles him. */
  readonly hero: { readonly x: number; readonly z: number; readonly radius: number };
  /** True while a spot's alarm is up: the cyan mark circles the hero. */
  readonly alarmed: () => boolean;
  readonly effects: Effects;
  readonly sound: SoundPort;
}

/** Rings in the sand at once, per drone (each a pulse, spreading, fading). */
const RINGS = 3;
/** A ping is heard while the hero is this close to a drone (m, along x). */
const PING_HEARD_M = 30;
/** A falling drone trails smoke this often (per second). */
const SMOKE_PER_S = 24;

/**
 * The Company's sonar drones (a stand-in drawn in code until their Blender sprites): rotors on
 * two arms, an orange hull, a cyan eye and the cone of its sonar; its rings go down into the
 * sand, cyan, every pulse. A drone that has heard the hero wears a warning sign, and a cyan
 * mark circles him while the alarm is up. A falling drone spins and trails smoke.
 */
export class DronePainter {
  private time = 0;
  private readonly emit = { x: 0, z: 0, vx: 0, vz: 0, life: 0 };
  private smokeOwed = 0;
  private lastPulse = -1;

  constructor(private readonly options: DronePainterOptions) {}

  frame(dt: number): void {
    this.time += dt;
    const pulse = Math.floor(this.time / SONAR.pulseS);
    const { hero, sound, effects } = this.options;
    for (const drone of this.options.drones()) {
      if (drone.isFlying && pulse !== this.lastPulse && Math.abs(drone.x - hero.x) < PING_HEARD_M) {
        sound.play('ping', 0.35);
      }
      if (!drone.isFalling) continue;
      this.smokeOwed += SMOKE_PER_S * dt;
      while (this.smokeOwed >= 1) {
        this.smokeOwed -= 1;
        this.emit.x = drone.x;
        this.emit.z = drone.z;
        this.emit.vx = 0;
        this.emit.vz = 0.6;
        this.emit.life = 1.4;
        effects.one('smoke', this.emit);
      }
    }
    this.lastPulse = pulse;
  }

  /** The sonar's rings, under the sand (drawn before the hero, so he swims over them). */
  drawRings(context: CanvasRenderingContext2D, view: View): void {
    const s = view.scale;
    context.lineCap = 'round';
    for (const drone of this.options.drones()) {
      if (!drone.isFlying) continue;
      const cx = view.screenX(drone.x);
      const cy = view.screenY(drone.sonarZ);
      for (let i = 0; i < RINGS; i++) {
        const age = (this.time + (i * SONAR.pulseS) / RINGS) % SONAR.pulseS;
        const radius = Math.min(SONAR.rangeM, (age / SONAR.pulseS) * SONAR.rangeM * 1.1);
        const fade = 1 - radius / SONAR.rangeM;
        context.globalAlpha = 0.15 + 0.7 * fade;
        context.strokeStyle = '#56e8f4';
        context.lineWidth = Math.max(1.2 * view.pixelRatio, (0.12 + 0.18 * fade) * s);
        context.beginPath();
        context.arc(cx, cy, radius * s, 0.04, Math.PI - 0.04);
        context.stroke();
      }
    }
    context.globalAlpha = 1;
  }

  /** The drones themselves, their sonar cones, and the mark on the hero. */
  draw(context: CanvasRenderingContext2D, view: View): void {
    for (const drone of this.options.drones()) this.drawDrone(context, view, drone);
    if (this.options.alarmed()) this.drawMark(context, view);
  }

  private drawDrone(context: CanvasRenderingContext2D, view: View, drone: Drone): void {
    const s = view.scale;
    const x = view.screenX(drone.x);
    const y = view.screenY(drone.z);
    if (drone.isFlying) {
      // Its sonar's cone down to the sand: a wide pale one and a brighter core.
      const ground = view.screenY(drone.sonarZ);
      for (const [width, colour] of CONES) {
        context.fillStyle = colour;
        context.beginPath();
        context.moveTo(x - 0.3 * s, y + 0.7 * s);
        context.lineTo(x - width * s, ground);
        context.lineTo(x + width * s, ground);
        context.lineTo(x + 0.3 * s, y + 0.7 * s);
        context.fill();
      }
    }
    context.save();
    context.translate(x, y);
    context.rotate(-drone.angle);
    context.scale(s, s);
    // Rotors: blurred discs on two arms.
    context.fillStyle = 'rgb(70 74 80 / 0.35)';
    for (const side of ROTORS) {
      context.beginPath();
      context.ellipse(side, -0.62, 1.05, 0.17, 0, 0, Math.PI * 2);
      context.fill();
    }
    context.strokeStyle = '#5a5f66';
    context.lineWidth = 0.24;
    context.beginPath();
    context.moveTo(-2, -0.5);
    context.lineTo(-0.9, -0.05);
    context.moveTo(2, -0.5);
    context.lineTo(0.9, -0.05);
    context.stroke();
    // The hull: the Company's orange over a steel belly.
    context.fillStyle = '#c4572a';
    context.beginPath();
    context.moveTo(-1.35, -0.1);
    context.lineTo(1.35, -0.1);
    context.lineTo(1.7, 0.28);
    context.lineTo(-1.7, 0.28);
    context.closePath();
    context.fill();
    context.fillStyle = '#4a4f55';
    context.beginPath();
    context.moveTo(-1.7, 0.28);
    context.lineTo(1.7, 0.28);
    context.lineTo(1.3, 0.66);
    context.lineTo(-1.3, 0.66);
    context.closePath();
    context.fill();
    // Its eye.
    context.fillStyle = drone.isFlying ? 'rgb(120 244 255 / 0.55)' : 'rgb(60 70 74 / 0.6)';
    context.beginPath();
    context.arc(0, 0.78, 0.55, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = drone.isFlying ? '#e6feff' : '#3a4044';
    context.beginPath();
    context.arc(0, 0.78, 0.2, 0, Math.PI * 2);
    context.fill();
    if (drone.isMarking && drone.isFlying) this.drawWarning(context);
    context.restore();
  }

  /** A cyan warning sign over a drone that heard the hero. */
  private drawWarning(context: CanvasRenderingContext2D): void {
    context.translate(0, -2.3);
    context.fillStyle = '#5fe6f2';
    context.beginPath();
    context.moveTo(0, -0.95);
    context.lineTo(0.95, 0.65);
    context.lineTo(-0.95, 0.65);
    context.closePath();
    context.fill();
    context.fillStyle = '#0e1416';
    context.fillRect(-0.09, -0.45, 0.18, 0.62);
    context.fillRect(-0.09, 0.3, 0.18, 0.18);
  }

  /** The cyan mark round the hero's head while the alarm is up. */
  private drawMark(context: CanvasRenderingContext2D, view: View): void {
    const { hero } = this.options;
    const x = view.screenX(hero.x);
    const y = view.screenY(hero.z);
    const r = hero.radius * 2.6 * view.scale * (1 + 0.06 * Math.sin(this.time * 9));
    context.strokeStyle = '#4fe6f2';
    context.lineWidth = Math.max(2, 0.16 * view.scale);
    context.beginPath();
    for (const [sx, sy] of CORNERS) {
      context.moveTo(x + sx * r, y + sy * r * 0.55);
      context.lineTo(x + sx * r, y + sy * r);
      context.lineTo(x + sx * r * 0.55, y + sy * r);
    }
    context.stroke();
  }
}

const ROTORS: readonly number[] = [-2, 2];
const CONES: readonly (readonly [number, string])[] = [
  [3.2, 'rgb(120 240 250 / 0.12)'],
  [1.4, 'rgb(120 240 250 / 0.16)'],
];
const CORNERS: readonly (readonly [number, number])[] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];
