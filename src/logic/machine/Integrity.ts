/**
 * A machine's plate: its hit points, taken off hit by hit, never below zero. The numbers count
 * metal, never wounds.
 */
export class Integrity {
  private left: number;

  constructor(readonly max: number) {
    if (!(max > 0) || !Number.isFinite(max)) throw new Error(`a machine needs plate: ${max}`);
    this.left = max;
  }

  get hp(): number {
    return this.left;
  }

  /** What is left, from 1 (untouched) to 0. */
  get share(): number {
    return this.left / this.max;
  }

  /** True once all its plate is gone: it stalls, and the next bite finishes it. */
  get spent(): boolean {
    return this.left <= 0;
  }

  /** A hit takes `amount` off (a broken amount takes nothing). */
  take(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) return;
    this.left = Math.max(0, this.left - amount);
  }
}
