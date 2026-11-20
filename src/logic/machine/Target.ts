import type { MachineId, MachineRow } from '../../rules/machines';
import type { Box } from '../truck/Truck';
import type { Integrity } from './Integrity';

/**
 * A machine the hero can hit: a truck on the sand or a drone in the air. The combat reads its
 * box and takes plate off it; the machine says how it takes being brought to zero.
 */
export interface Target {
  readonly id: number;
  readonly machine: MachineId;
  readonly row: MachineRow;
  readonly integrity: Integrity;
  /** Still in the hunt and hittable: not caught in a takedown, not falling, not gone. */
  readonly hittable: boolean;
  /** Its convoy (−1 for a drone): a convoy that panics on an attack flees when one is hit. */
  readonly waveId: number;
  /** Its speed along x (m/s): a rock thrown at it leads it. */
  readonly velocityX: number;
  /** The box its body fills now (m), written into `out`. */
  bodyBox(out: Box): void;
  /** Its plate is gone: a truck stalls in sparks and smoke, a drone falls. */
  giveOut(): void;
}

/** The distance (m) from a point to a box, 0 inside it. */
export function distanceToBox(x: number, z: number, box: Box): number {
  const dx = Math.max(box.left - x, 0, x - box.right);
  const dz = Math.max(box.bottom - z, 0, z - box.top);
  return Math.hypot(dx, dz);
}
