/** A point the trail writes into, so that reading it allocates nothing. */
export interface PointOut {
  x: number;
  z: number;
}

/**
 * The path the head has swum, kept at a fixed spacing: the body lies along it, so every part of
 * the worm passes exactly where the head passed, the way a worm fills its own tunnel. Driving
 * the body by distance (not by time) keeps it from sliding through the sand.
 */
export class PathTrail {
  private readonly xs: Float64Array;
  private readonly zs: Float64Array;
  /** Index of the newest sample (the one nearest the head). */
  private newest = 0;
  private count = 1;
  private headX = 0;
  private headZ = 0;
  /** How far the head is past the newest sample (m), always under one spacing. */
  private lead = 0;

  constructor(
    private readonly spacingM: number,
    private readonly lengthM: number,
  ) {
    if (!(spacingM > 0) || !(lengthM > spacingM)) {
      throw new RangeError(`trail spacing ${spacingM} and length ${lengthM} do not fit`);
    }
    const capacity = Math.ceil(lengthM / spacingM) + 4;
    this.xs = new Float64Array(capacity);
    this.zs = new Float64Array(capacity);
  }

  /** Lays a straight trail behind a head at (x, z) facing `heading` (radians). */
  reset(x: number, z: number, heading: number): void {
    const capacity = this.xs.length;
    const bx = -Math.cos(heading) * this.spacingM;
    const bz = -Math.sin(heading) * this.spacingM;
    // Oldest first, so the newest sample sits at the head.
    for (let k = 0; k < capacity; k++) {
      const back = capacity - 1 - k;
      this.xs[k] = x + bx * back;
      this.zs[k] = z + bz * back;
    }
    this.newest = capacity - 1;
    this.count = capacity;
    this.headX = x;
    this.headZ = z;
    this.lead = 0;
  }

  /** The head moved to (x, z): the trail grows behind it, a sample every spacing. */
  advance(x: number, z: number): void {
    const dx = x - this.headX;
    const dz = z - this.headZ;
    const distance = Math.hypot(dx, dz);
    if (distance === 0) return;
    const capacity = this.xs.length;
    let travelled = this.spacingM - this.lead;
    while (travelled <= distance) {
      const t = travelled / distance;
      this.newest = (this.newest + 1) % capacity;
      this.xs[this.newest] = this.headX + dx * t;
      this.zs[this.newest] = this.headZ + dz * t;
      this.count = Math.min(capacity, this.count + 1);
      travelled += this.spacingM;
    }
    this.lead = distance - (travelled - this.spacingM);
    this.headX = x;
    this.headZ = z;
  }

  /** The point `distanceM` behind the head along the path (clamped to the trail's length). */
  pointAt(distanceM: number, out: PointOut): void {
    const d = Math.min(Math.max(0, distanceM), this.lengthM);
    if (d <= this.lead) {
      const t = this.lead === 0 ? 0 : d / this.lead;
      out.x = this.headX + (this.xs[this.newest]! - this.headX) * t;
      out.z = this.headZ + (this.zs[this.newest]! - this.headZ) * t;
      return;
    }
    const capacity = this.xs.length;
    const back = (d - this.lead) / this.spacingM;
    const k = Math.min(Math.floor(back), this.count - 2);
    const t = Math.min(1, back - k);
    const a = (this.newest - k + capacity) % capacity;
    const b = (a - 1 + capacity) % capacity;
    out.x = this.xs[a]! + (this.xs[b]! - this.xs[a]!) * t;
    out.z = this.zs[a]! + (this.zs[b]! - this.zs[a]!) * t;
  }
}
