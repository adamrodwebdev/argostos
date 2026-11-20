import type { RandomSource } from '../../rules/random';
import { DEBRIS } from '../../rules/takedowns';
import type { SandSurface } from '../sand/GridSurface';
import type { SandThrower } from '../sand/SandThrower';

/** What a piece of wreckage is: it decides how it rolls and how it is drawn. */
export const DebrisKind = {
  /** A wheel torn off: it rolls. */
  Wheel: 0,
  /** A panel of the body (a door, the tailgate): it slides and stops. */
  Panel: 1,
} as const;
export type DebrisKindId = (typeof DebrisKind)[keyof typeof DebrisKind];

/** A piece thrown from a wreck (m, m/s, rad, rad/s). */
export interface DebrisThrow {
  readonly kind: DebrisKindId;
  readonly x: number;
  readonly z: number;
  readonly vx: number;
  readonly vz: number;
  readonly angle: number;
  readonly spin: number;
  readonly radius: number;
  /** Which part of the sprite it shows (a panel's piece of the body). */
  readonly variant: number;
  /** The way its truck faced (+1 right, −1 left): its sprite is mirrored the same way. */
  readonly facing: 1 | -1;
  /** Seconds it burns. */
  readonly burn: number;
}

const State = { Free: 0, Flying: 1, Resting: 2 } as const;

/** What the wreckage lands on and throws: the sand's surface, real sand, the arena's walls. */
export interface WreckageWorld {
  readonly surface: SandSurface;
  readonly thrower: SandThrower;
  readonly minX: number;
  readonly maxX: number;
  readonly random: RandomSource;
}

/**
 * The wreckage on the sand: wheels and panels thrown from a takedown, simple rigid bodies (a
 * disc each) that fall, hit the dunes' surface, bounce, roll or slide, settle, and slowly sink
 * into the sand. A hard landing throws sand up from where it lands (real grains). Typed arrays,
 * a fixed number of pieces (the oldest goes first): nothing allocated per step.
 */
export class Wreckage {
  readonly xs = new Float64Array(DEBRIS.max);
  readonly zs = new Float64Array(DEBRIS.max);
  readonly angles = new Float64Array(DEBRIS.max);
  readonly radii = new Float64Array(DEBRIS.max);
  readonly kinds = new Uint8Array(DEBRIS.max);
  readonly variants = new Uint8Array(DEBRIS.max);
  readonly facings = new Int8Array(DEBRIS.max);
  /** Seconds each piece still burns. */
  readonly burning = new Float64Array(DEBRIS.max);
  /** How deep each settled piece has sunk (m). */
  readonly sunk = new Float64Array(DEBRIS.max);
  private readonly vxs = new Float64Array(DEBRIS.max);
  private readonly vzs = new Float64Array(DEBRIS.max);
  private readonly spins = new Float64Array(DEBRIS.max);
  private readonly states = new Uint8Array(DEBRIS.max);
  private readonly born = new Uint32Array(DEBRIS.max);
  private steps = 0;
  private impacts = 0;

  constructor(private readonly world: WreckageWorld) {}

  /** True for a slot holding a piece. */
  isUsed(slot: number): boolean {
    return this.states[slot] !== State.Free;
  }

  /** Pieces on the sand or in the air now. */
  get count(): number {
    let n = 0;
    for (const state of this.states) if (state !== State.Free) n++;
    return n;
  }

  /** Hard landings so far (each threw sand up). */
  get hardLandings(): number {
    return this.impacts;
  }

  /** True when the piece in `slot` lies still on the sand. */
  isResting(slot: number): boolean {
    return this.states[slot] === State.Resting;
  }

  throwPiece(piece: DebrisThrow): void {
    const slot = this.freeSlot();
    this.xs[slot] = piece.x;
    this.zs[slot] = piece.z;
    this.vxs[slot] = piece.vx;
    this.vzs[slot] = piece.vz;
    this.angles[slot] = piece.angle;
    this.spins[slot] = piece.spin;
    this.radii[slot] = piece.radius;
    this.kinds[slot] = piece.kind;
    this.variants[slot] = piece.variant;
    this.facings[slot] = piece.facing;
    this.burning[slot] = piece.burn;
    this.sunk[slot] = 0;
    this.states[slot] = State.Flying;
    this.born[slot] = this.steps;
  }

  /** A free slot, or the oldest piece's (it makes room). */
  private freeSlot(): number {
    let oldest = 0;
    for (let slot = 0; slot < DEBRIS.max; slot++) {
      if (this.states[slot] === State.Free) return slot;
      if (this.born[slot]! < this.born[oldest]!) oldest = slot;
    }
    return oldest;
  }

  step(dt: number): void {
    this.steps++;
    for (let slot = 0; slot < DEBRIS.max; slot++) {
      const state = this.states[slot];
      if (state === State.Free) continue;
      this.burning[slot] = Math.max(0, this.burning[slot]! - dt);
      if (state === State.Resting) this.sink(slot, dt);
      else this.fly(slot, dt);
    }
  }

  private sink(slot: number, dt: number): void {
    this.sunk[slot] = this.sunk[slot]! + DEBRIS.sinkSpeed * dt;
    this.zs[slot] = this.zs[slot]! - DEBRIS.sinkSpeed * dt;
    if (this.sunk[slot] > DEBRIS.goneDepth + this.radii[slot]!) this.states[slot] = State.Free;
  }

  private fly(slot: number, dt: number): void {
    const { surface, minX, maxX } = this.world;
    const r = this.radii[slot]!;
    let vx = this.vxs[slot]!;
    let vz = this.vzs[slot]! - DEBRIS.gravity * dt;
    let x = this.xs[slot]! + vx * dt;
    let z = this.zs[slot]! + vz * dt;
    if (x < minX + r || x > maxX - r) {
      x = Math.min(maxX - r, Math.max(minX + r, x));
      vx = -vx * 0.4;
    }
    // The sand's surface under it, and its slope: the normal it bounces along.
    const ground = surface.heightAt(x);
    const slope = (surface.heightAt(x + 0.25) - surface.heightAt(x - 0.25)) / 0.5;
    const length = Math.hypot(slope, 1);
    const nx = -slope / length;
    const nz = 1 / length;
    const gap = (z - ground) * nz - r;
    let spin = this.spins[slot]!;
    if (gap < 0) {
      x -= nx * gap;
      z -= nz * gap;
      const into = vx * nx + vz * nz;
      if (into < 0) {
        if (-into > DEBRIS.splashSpeed) {
          this.xs[slot] = x;
          this.splash(slot, ground, -into);
        }
        vx -= (1 + DEBRIS.restitution) * into * nx;
        vz -= (1 + DEBRIS.restitution) * into * nz;
      }
      // Along the surface: the sand's grip slows it; a wheel rolls, a panel slides and stops.
      const tx = nz;
      const tz = -nx;
      const along = vx * tx + vz * tz;
      const kept = Math.max(
        0,
        1 - DEBRIS.friction * dt * (this.kinds[slot] === DebrisKind.Wheel ? 1 : 5),
      );
      vx += (along * kept - along) * tx;
      vz += (along * kept - along) * tz;
      spin = this.kinds[slot] === DebrisKind.Wheel ? -(along * kept) / r : spin * 0.85;
      if (Math.hypot(vx, vz) < DEBRIS.restSpeed) {
        this.states[slot] = State.Resting;
        vx = 0;
        vz = 0;
        spin = 0;
      }
    }
    this.xs[slot] = x;
    this.zs[slot] = z;
    this.vxs[slot] = vx;
    this.vzs[slot] = vz;
    this.spins[slot] = spin;
    this.angles[slot] = this.angles[slot]! + spin * dt;
  }

  /** A hard landing throws sand up from under the piece. */
  private splash(slot: number, ground: number, speed: number): void {
    this.impacts++;
    const grains = Math.min(
      DEBRIS.splashMax,
      Math.round((speed - DEBRIS.splashSpeed) * DEBRIS.splashPerSpeed),
    );
    if (grains <= 0) return;
    const r = this.radii[slot]!;
    this.world.thrower.throwRim({
      x: this.xs[slot]!,
      lowestZ: ground - 0.6,
      reachM: r,
      perColumn: Math.max(1, Math.ceil(grains / Math.max(1, (2 * r) / 0.25))),
      up: Math.min(8, 1.5 + speed * 0.45),
      spread: 2.5 + this.world.random.next(),
      carryX: this.vxs[slot]! * 0.3,
      carryZ: 0,
    });
  }
}
