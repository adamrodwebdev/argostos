import type { Wreckage } from '../../logic/takedown/Wreckage';
import { DebrisKind } from '../../logic/takedown/Wreckage';
import type { Truck } from '../../logic/truck/Truck';
import type { RandomSource } from '../../rules/random';
import type { TruckGeometry, WheelStrip } from '../../rules/truckManifest';
import { STEP_SECONDS } from '../../rules/world';
import type { Effects } from '../fx/Effects';
import { clipAboveSand } from '../painters/sandClip';
import { CHARRED, SHADOW_COLOUR } from '../palette';
import type { View } from '../View';
import type { LoadedSet, TruckArt } from './TruckArt';

export interface TruckPainterOptions {
  readonly art: TruckArt;
  /** The trucks of the hunt and the wreckage on the sand (read only). */
  readonly trucks: () => readonly Truck[];
  readonly wreckage: Wreckage;
  /** The sand's height under any x (m): shadows sit on it, wrecks sink under it. */
  readonly ground: (x: number) => number;
  readonly effects: Effects;
  readonly random: RandomSource;
}

/** Dust raised per metre driven, and its life (s). */
const DUST_PER_METRE = 2.2;
const DUST_LIFE = 1.2;
/** A truck stuck in loose sand spins its wheels: this much dust a second, thrown back. */
const STUCK_DUST_PER_S = 34;
/** How far the folded halves turn (radians at a full fold), and how hard the wreck shudders. */
const FOLD_ANGLE = 0.5;
const SHUDDER_M = 0.05;
/**
 * The panels torn off are drawn from the body's sprite until the 3D team renders debris: the
 * cab's door and a side of the bed, as shares of the sprite (left, top, width, height).
 */
const PANELS: readonly (readonly [number, number, number, number])[] = [
  [0.66, 0.3, 0.14, 0.25],
  [0.15, 0.22, 0.17, 0.2],
];
/** The armoured truck's plates along its bed: where each starts and how wide (m from the rear hub). */
const PLATES: readonly (readonly [number, number])[] = [
  [-2.9, 2.3],
  [-0.45, 2.3],
  [2.0, 2.3],
];
/** Rivets along a plate (shares of its width). */
const RIVETS: readonly number[] = [0.12, 0.5, 0.88];
/** The sand's rim is sampled this often (m) for the clip that sinks wrecks into it. */

/**
 * Draws the Company's trucks from their Blender sprites (ported from the sprite test bench):
 * the body on its suspension, tilted with the sand; each wheel from its strip of 12 rendered
 * frames, the light fixed on the rim, plus the small turn left between two frames; a soft
 * contact shadow; dust behind the tyres. A wreck folds in two in the jaws, chars as it burns
 * and sinks into the sand (clipped by its surface); torn wheels and panels tumble on the dunes.
 * Machines only: the cabs are empty.
 */
export class TruckPainter {
  private readonly shadow: HTMLCanvasElement;
  private readonly geometry: TruckGeometry;
  private readonly wheel: WheelStrip;
  private readonly owed = new Map<number, number>();
  private readonly charred = new Map<number, HTMLCanvasElement>();
  private readonly emit = { x: 0, z: 0, vx: 0, vz: 0, life: 0 };
  private time = 0;

  constructor(private readonly options: TruckPainterOptions) {
    this.geometry = options.art.manifest.geometry;
    this.wheel = options.art.manifest.wheel;
    this.shadow = document.createElement('canvas');
    this.shadow.width = 64;
    this.shadow.height = 64;
    const context = this.shadow.getContext('2d');
    if (context) {
      const [r, g, b] = SHADOW_COLOUR;
      const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, `rgb(${r} ${g} ${b} / 0.42)`);
      gradient.addColorStop(1, `rgb(${r} ${g} ${b} / 0)`);
      context.fillStyle = gradient;
      context.fillRect(0, 0, 64, 64);
    }
  }

  /** A frame of `dt` seconds of the hunt's time: the tyres of the trucks raise dust. */
  frame(dt: number): void {
    this.time += dt;
    const { random, effects, ground } = this.options;
    const { emit } = this;
    for (const truck of this.options.trucks()) {
      if (!truck.isDriving) {
        this.owed.delete(truck.id);
        continue;
      }
      const { rig } = truck;
      const stuck = rig.stuck;
      const rate = stuck ? STUCK_DUST_PER_S : rig.speed * DUST_PER_METRE;
      let owed = (this.owed.get(truck.id) ?? 0) + rate * dt;
      while (owed >= 1) {
        owed -= 1;
        const fromRear = stuck || random.next() < 0.7;
        const r = this.geometry.wheelRadiusM;
        const x =
          (fromRear ? rig.rearX : rig.frontX) - rig.direction * (0.4 + 0.5 * random.next()) * r;
        emit.x = x;
        emit.z = ground(x) + 0.1;
        // Stuck, the spinning wheels throw it back and up, hard.
        emit.vx = stuck
          ? -rig.direction * (2.5 + 2.5 * random.next())
          : -0.25 * rig.speed * rig.direction + (random.next() - 0.5);
        emit.vz = stuck ? 1.6 + 2 * random.next() : 0.4 + 0.9 * random.next();
        emit.life = DUST_LIFE + random.next();
        effects.one('dust', emit);
      }
      this.owed.set(truck.id, owed);
    }
  }

  draw(context: CanvasRenderingContext2D, view: View, blend: number): void {
    const set = this.options.art.best(view.scale);
    if (!set) return;
    let sinking = false;
    for (const truck of this.options.trucks()) {
      if (truck.isDriving) this.drawDriving(context, view, { truck, set, blend });
      else if (truck.isCaught) sinking = true;
    }
    if (!sinking && this.options.wreckage.count === 0) return;
    // Wrecks and debris go under the sand: everything below its rim is cut away.
    context.save();
    clipAboveSand(context, view, this.options.ground);
    for (const truck of this.options.trucks()) {
      if (truck.isCaught) this.drawWreck(context, view, { truck, set, blend });
    }
    this.drawDebris(context, view, set);
    context.restore();
  }

  private drawDriving(context: CanvasRenderingContext2D, view: View, job: Job): void {
    const { truck, set, blend } = job;
    const { rig } = truck;
    // Between two steps, it has rolled on by its speed (no stutter on fast screens).
    const ahead = rig.direction * rig.speed * blend * STEP_SECONDS;
    const r = this.geometry.wheelRadiusM;
    const rearX = rig.rearX + ahead;
    const frontX = rig.frontX + ahead;
    this.drawShadow(context, view, rearX);
    this.drawShadow(context, view, frontX);
    const angle = rig.wheelAngle + (rig.speed * blend * STEP_SECONDS) / r;
    context.save();
    context.translate(view.screenX(rearX), view.screenY(rig.rearHubZ));
    context.scale(rig.direction, 1);
    context.rotate(-rig.pitch);
    this.drawBody(context, view, set);
    if (truck.row.plated) this.drawPlates(context, view.scale);
    context.restore();
    for (const [x, z] of [
      [rearX, rig.rearWheelZ],
      [frontX, rig.frontWheelZ],
    ] as const) {
      context.save();
      context.translate(view.screenX(x), view.screenY(z));
      context.scale(rig.direction, 1);
      this.drawWheel(context, view, { angle, set });
      context.restore();
    }
  }

  private drawShadow(context: CanvasRenderingContext2D, view: View, x: number): void {
    const s = view.scale;
    const r = this.geometry.wheelRadiusM;
    const gx = view.screenX(x);
    const gy = view.screenY(this.options.ground(x));
    context.drawImage(this.shadow, gx - r * 1.15 * s, gy - 0.24 * s, r * 2.3 * s, 0.48 * s);
  }

  /**
   * The wreck in the jaws: drawn about its body's centre, folded in two round the middle of its
   * underside (the bite), shuddering while it folds, charred as it burns, wheels gone once torn.
   */
  private drawWreck(context: CanvasRenderingContext2D, view: View, job: Job): void {
    const { truck, set } = job;
    const { wreck } = truck;
    const g = this.geometry;
    const s = view.scale;
    const k = s / set.set.pixelsPerMetre;
    const shudder = wreck.fold > 0 && wreck.fold < 1 ? Math.sin(this.time * 95) * SHUDDER_M * s : 0;
    context.save();
    context.translate(view.screenX(wreck.x) + shudder, view.screenY(wreck.z));
    context.rotate(-wreck.angle);
    context.scale(truck.rig.direction, 1);
    // From the body's centre: the sprite's corner, and the bite under the middle.
    const centreX = (g.frameLeftM + g.frameRightM) / 2;
    const centreZ = (g.frameTopM + g.frameBottomM) / 2;
    const left = (g.frameLeftM - centreX) * s;
    const top = -(g.frameTopM - centreZ) * s;
    const bite = (centreZ - g.frameBottomM) * s * 0.7;
    const { width, height } = set.set.body;
    const charred = this.charredOf(set);
    const bend = wreck.fold * FOLD_ANGLE;
    for (const half of [0, 1] as const) {
      context.save();
      context.translate(0, bite);
      context.rotate(half === 0 ? -bend : bend);
      context.translate(0, -bite);
      const sx = half === 0 ? 0 : width / 2;
      const dx = left + sx * k;
      context.drawImage(set.body, sx, 0, width / 2, height, dx, top, (width / 2) * k, height * k);
      if (wreck.burn > 0 && charred) {
        context.globalAlpha = wreck.burn * 0.85;
        context.drawImage(charred, sx, 0, width / 2, height, dx, top, (width / 2) * k, height * k);
        context.globalAlpha = 1;
      }
      context.restore();
    }
    if (wreck.wheelsOn) {
      for (const hub of [0, g.wheelbaseM]) {
        context.save();
        context.translate((hub - centreX) * s, centreZ * s);
        this.drawWheel(context, view, { angle: truck.rig.wheelAngle, set });
        context.restore();
      }
    }
    context.restore();
  }

  /** Wheels and panels on (or in) the sand, and in the air. */
  private drawDebris(context: CanvasRenderingContext2D, view: View, set: LoadedSet): void {
    const wreckage = this.options.wreckage;
    const s = view.scale;
    const k = s / set.set.pixelsPerMetre;
    const { width, height } = set.set.body;
    for (let slot = 0; slot < wreckage.xs.length; slot++) {
      if (!wreckage.isUsed(slot)) continue;
      context.save();
      context.translate(view.screenX(wreckage.xs[slot]!), view.screenY(wreckage.zs[slot]!));
      context.rotate(-wreckage.angles[slot]!);
      context.scale(wreckage.facings[slot]! < 0 ? -1 : 1, 1);
      if (wreckage.kinds[slot] === DebrisKind.Wheel) {
        this.drawWheel(context, view, { angle: 0, set });
      } else {
        const panel = PANELS[wreckage.variants[slot]! % PANELS.length]!;
        const sw = panel[2] * width;
        const sh = panel[3] * height;
        context.drawImage(
          set.body,
          panel[0] * width,
          panel[1] * height,
          sw,
          sh,
          (-sw * k) / 2,
          (-sh * k) / 2,
          sw * k,
          sh * k,
        );
      }
      context.restore();
    }
  }

  /** The body, its top-left placed from the rear hub (the current transform's origin). */
  private drawBody(context: CanvasRenderingContext2D, view: View, set: LoadedSet): void {
    const s = view.scale;
    const k = s / set.set.pixelsPerMetre;
    const { body } = set.set;
    context.drawImage(
      set.body,
      this.geometry.frameLeftM * s,
      -this.geometry.frameTopM * s,
      body.width * k,
      body.height * k,
    );
  }

  /**
   * The armoured truck's steel plates, bolted over the bed (drawn in code over the sprite until
   * the 3D team renders the variant): from the rear hub, in metres.
   */
  private drawPlates(context: CanvasRenderingContext2D, s: number): void {
    for (const [left, width] of PLATES) {
      context.fillStyle = 'rgb(74 79 86 / 0.94)';
      context.fillRect(left * s, -4.3 * s, width * s, 2.2 * s);
      context.fillStyle = 'rgb(150 156 164 / 0.9)';
      context.fillRect(left * s, -4.3 * s, width * s, 0.14 * s);
      context.fillStyle = 'rgb(28 30 34 / 0.9)';
      for (const along of RIVETS) {
        context.fillRect((left + along * width) * s - 0.06 * s, -4.0 * s, 0.12 * s, 0.12 * s);
        context.fillRect((left + along * width) * s - 0.06 * s, -2.4 * s, 0.12 * s, 0.12 * s);
      }
    }
  }

  /** One frame of the wheel's strip, plus the turn left between two frames (clockwise rolling right). */
  private drawWheel(context: CanvasRenderingContext2D, view: View, wheel: WheelTurn): void {
    const { periodDeg, stepDeg, frames } = this.wheel;
    const turned = ((((wheel.angle * 180) / Math.PI) % periodDeg) + periodDeg) % periodDeg;
    const nearest = Math.round(turned / stepDeg);
    const frame = nearest % frames;
    context.rotate(((turned - nearest * stepDeg) * Math.PI) / 180);
    const size = wheel.set.set.frameWidth;
    const shown = (size * view.scale) / wheel.set.set.pixelsPerMetre;
    context.drawImage(
      wheel.set.wheels,
      frame * size,
      0,
      size,
      size,
      -shown / 2,
      -shown / 2,
      shown,
      shown,
    );
  }

  /** The region above the sand's rim, across the view: a wreck below it is under the sand. */
  /** The body's sprite burnt dark (made once per scale): crossfaded in as the wreck burns. */
  private charredOf(set: LoadedSet): HTMLCanvasElement | null {
    const ppm = set.set.pixelsPerMetre;
    const ready = this.charred.get(ppm);
    if (ready) return ready;
    const canvas = document.createElement('canvas');
    canvas.width = set.set.body.width;
    canvas.height = set.set.body.height;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.drawImage(set.body, 0, 0);
    context.globalCompositeOperation = 'source-atop';
    context.fillStyle = CHARRED;
    context.fillRect(0, 0, canvas.width, canvas.height);
    this.charred.set(ppm, canvas);
    return canvas;
  }
}

interface Job {
  readonly truck: Truck;
  readonly set: LoadedSet;
  readonly blend: number;
}

interface WheelTurn {
  readonly angle: number;
  readonly set: LoadedSet;
}
