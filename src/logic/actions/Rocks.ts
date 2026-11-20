import { plainDamage, rockFlightSeconds, STRIKE } from '../../rules/combat';
import type { HuntEvents } from '../hunt/HuntEvents';
import type { Combat } from '../machine/Combat';
import type { Target } from '../machine/Target';
import type { Targets } from '../machine/Targets';
import type { SandSurface } from '../sand/GridSurface';
import type { Box } from '../truck/Truck';

export interface RockWorld {
  readonly surface: SandSurface;
  readonly targets: Targets;
  readonly combat: Combat;
  readonly events: HuntEvents;
  readonly stepSeconds: number;
  /** Rocks are gone past these bounds (m). */
  readonly minX: number;
  readonly maxX: number;
  readonly bottomZ: number;
}

/** A rock thrown with nothing in range flies straight ahead at this speed (m/s), a little up. */
const BLIND_SPEED = 18;
const BLIND_LIFT = 6;

/**
 * Rocks flung from the jaws by the strike at range, from a pool made once (nothing allocated
 * during the hunt): each flies in an arc toward its mark (through the loose sand on its way up)
 * and hits the first machine it meets, or lands in the sand.
 */
export class Rocks {
  readonly xs: Float64Array;
  readonly zs: Float64Array;
  private readonly vxs: Float64Array;
  private readonly vzs: Float64Array;
  private readonly alive: Uint8Array;
  private readonly box: Box = { left: 0, right: 0, bottom: 0, top: 0 };
  private next = 0;

  constructor(
    capacity: number,
    private readonly world: RockWorld,
  ) {
    this.xs = new Float64Array(capacity);
    this.zs = new Float64Array(capacity);
    this.vxs = new Float64Array(capacity);
    this.vzs = new Float64Array(capacity);
    this.alive = new Uint8Array(capacity);
  }

  get capacity(): number {
    return this.alive.length;
  }

  isFlying(slot: number): boolean {
    return this.alive[slot] === 1;
  }

  /** Throws a rock from (x, z) at `target`'s body, or straight along `heading` (null target). */
  throwAt(x: number, z: number, target: Target | null, heading: number): void {
    const slot = this.slot();
    let vx: number;
    let vz: number;
    if (target) {
      target.bodyBox(this.box);
      const cx = (this.box.left + this.box.right) / 2;
      const tz = (this.box.bottom + this.box.top) / 2;
      // It leads the machine: aimed where it will be when the rock gets there.
      const first = rockFlightSeconds(Math.hypot(cx - x, tz - z));
      const tx = cx + target.velocityX * first;
      const t = rockFlightSeconds(Math.hypot(tx - x, tz - z));
      vx = (tx - x) / t;
      vz = (tz - z) / t + (STRIKE.rockGravity * t) / 2;
    } else {
      vx = Math.cos(heading) * BLIND_SPEED;
      vz = Math.max(Math.sin(heading) * BLIND_SPEED, BLIND_LIFT);
    }
    this.xs[slot] = x;
    this.zs[slot] = z;
    this.vxs[slot] = vx;
    this.vzs[slot] = vz;
    this.alive[slot] = 1;
  }

  step(): void {
    const { stepSeconds: dt, surface, events, minX, maxX, bottomZ } = this.world;
    for (let slot = 0; slot < this.alive.length; slot++) {
      if (this.alive[slot] !== 1) continue;
      this.vzs[slot] = this.vzs[slot]! - STRIKE.rockGravity * dt;
      const x = this.xs[slot]! + this.vxs[slot]! * dt;
      const z = this.zs[slot]! + this.vzs[slot]! * dt;
      this.xs[slot] = x;
      this.zs[slot] = z;
      if (this.hits(x, z)) {
        this.alive[slot] = 0;
      } else if (this.vzs[slot]! < 0 && z < surface.heightAt(x)) {
        this.alive[slot] = 0;
        events.emit('rockLanded', { x, z: surface.heightAt(x) });
      } else if (x < minX || x > maxX || z < bottomZ) {
        this.alive[slot] = 0;
      }
    }
  }

  /** The first machine at (x, z) takes the rock's hit. */
  private hits(x: number, z: number): boolean {
    const { targets, combat } = this.world;
    const r = STRIKE.rockRadiusM;
    for (const target of targets.all) {
      target.bodyBox(this.box);
      const box = this.box;
      if (x < box.left - r || x > box.right + r || z < box.bottom - r || z > box.top + r) continue;
      combat.hit(target, 'rock', plainDamage('rock'));
      return true;
    }
    return false;
  }

  /** A free slot, or the next one round (the oldest rock gives way). */
  private slot(): number {
    for (let i = 0; i < this.alive.length; i++) if (this.alive[i] !== 1) return i;
    const slot = this.next;
    this.next = (this.next + 1) % this.alive.length;
    return slot;
  }
}
