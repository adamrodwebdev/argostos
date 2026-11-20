import type { RandomSource } from '../../rules/random';
import type { Wreckage } from '../../logic/takedown/Wreckage';
import type { Truck } from '../../logic/truck/Truck';
import type { Effects } from './Effects';

/** Flames, smoke and embers a burning thing gives off each second, at full strength. */
interface Rates {
  readonly fire: number;
  readonly smoke: number;
  readonly ember: number;
}
const WRECK_RATES: Rates = { fire: 70, smoke: 16, ember: 12 };
const PATCH_RATES: Rates = { fire: 28, smoke: 7, ember: 5 };
const DEBRIS_RATES: Rates = { fire: 14, smoke: 5, ember: 3 };

/** How each kind leaves the fire: its rise (m/s), its life (s), its height above the source (m). */
interface Plume {
  readonly kind: 'fire' | 'smoke' | 'ember';
  readonly lift: number;
  readonly life: number;
  readonly above: number;
}
const FIRE: Plume = { kind: 'fire', lift: 1.2, life: 0.55, above: 0 };
const SMOKE: Plume = { kind: 'smoke', lift: 0.6, life: 2.2, above: 0.8 };
const EMBER: Plume = { kind: 'ember', lift: 2.2, life: 1.6, above: 0 };
const MAX_PATCHES = 8;

/** What burns: the trucks (a wreck burns in the jaws) and the wreckage (smouldering wheels). */
export interface Burning {
  readonly trucks: readonly Truck[];
  readonly wreckage: Wreckage;
}

/**
 * What keeps burning after a fuel burst: the wreck in the jaws until it goes under, patches of
 * fuel on the sand, smouldering wheels. Each gives off flames, smoke and embers into the
 * effects' pools at a steady rate (one reused emitter: nothing allocated per frame).
 */
export class FireSources {
  private readonly wrecks = new Map<number, number>();
  private readonly patchX = new Float64Array(MAX_PATCHES);
  private readonly patchZ = new Float64Array(MAX_PATCHES);
  private readonly patchLeft = new Float64Array(MAX_PATCHES);
  private readonly patchLength = new Float64Array(MAX_PATCHES).fill(1);
  private nextPatch = 0;
  private readonly emit = { x: 0, z: 0, vx: 0, vz: 0, life: 0 };
  /** The source burning now. */
  private sourceX = 0;
  private sourceZ = 0;

  constructor(
    private readonly effects: Effects,
    private readonly random: RandomSource,
  ) {}

  /** The wreck of truck `id` burns for `seconds` (or until it is under the sand). */
  igniteWreck(id: number, seconds: number): void {
    this.wrecks.set(id, seconds);
  }

  /** Fuel burns on the sand at (x, z) for `seconds`. */
  ignitePatch(x: number, z: number, seconds: number): void {
    const i = this.nextPatch;
    this.nextPatch = (i + 1) % MAX_PATCHES;
    this.patchX[i] = x;
    this.patchZ[i] = z;
    this.patchLeft[i] = seconds;
    this.patchLength[i] = seconds;
  }

  step(dt: number, burning: Burning): void {
    for (const truck of burning.trucks) {
      const left = this.wrecks.get(truck.id);
      if (left === undefined) continue;
      if (!truck.isCaught || left <= 0) {
        this.wrecks.delete(truck.id);
        continue;
      }
      this.wrecks.set(truck.id, left - dt);
      this.at(truck.wreck.x, truck.wreck.z);
      this.flames(WRECK_RATES, dt);
    }
    for (let i = 0; i < MAX_PATCHES; i++) {
      if (this.patchLeft[i]! <= 0) continue;
      this.patchLeft[i] = this.patchLeft[i]! - dt;
      this.at(this.patchX[i]!, this.patchZ[i]!);
      this.flames(PATCH_RATES, Math.max(0, this.patchLeft[i]! / this.patchLength[i]!) * dt);
    }
    const { wreckage } = burning;
    for (let slot = 0; slot < wreckage.burning.length; slot++) {
      if (!wreckage.isUsed(slot) || wreckage.burning[slot]! <= 0) continue;
      this.at(wreckage.xs[slot]!, wreckage.zs[slot]!);
      this.flames(DEBRIS_RATES, Math.min(1, wreckage.burning[slot]!) * dt);
    }
  }

  private at(x: number, z: number): void {
    this.sourceX = x;
    this.sourceZ = z;
  }

  /** Flames, smoke and embers from the source: as many as the rates owe over this share. */
  private flames(rates: Rates, share: number): void {
    this.spawn(FIRE, rates.fire * share);
    this.spawn(SMOKE, rates.smoke * share);
    this.spawn(EMBER, rates.ember * share);
  }

  /** Emits a fractional count: the fraction is a chance, so low rates still emit on average. */
  private spawn(plume: Plume, count: number): void {
    const { random, emit } = this;
    let n = Math.floor(count);
    if (random.next() < count - n) n++;
    for (let i = 0; i < n; i++) {
      emit.x = this.sourceX + (random.next() - 0.5) * 1.6;
      emit.z = this.sourceZ + plume.above + (random.next() - 0.3) * 0.8;
      emit.vx = (random.next() - 0.5) * 1.2;
      emit.vz = plume.lift * (0.5 + random.next());
      emit.life = plume.life * (0.6 + 0.8 * random.next());
      this.effects.one(plume.kind, emit);
    }
  }
}
