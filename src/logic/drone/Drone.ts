import { machineRow, type MachineRow } from '../../rules/machines';
import { SONAR } from '../../rules/sonar';
import type { Integrity } from '../machine/Integrity';
import { MachineParts } from '../machine/MachineParts';
import type { Target } from '../machine/Target';
import type { SandSurface } from '../sand/GridSurface';
import type { Box } from '../truck/Truck';

/** A drone's patrol: the middle of its beat and how far it goes either side (m). */
export interface DroneBeat {
  readonly x: number;
  readonly spanM: number;
}

type DroneState = 'flying' | 'falling' | 'gone';

/** Its body's half-width and half-height (m): rotors to rotors, the hull's depth. */
const HALF_WIDTH_M = 2.2;
const HALF_HEIGHT_M = 0.7;
/** Falling: gravity (m/s²) and its spin (rad/s). */
const FALL_GRAVITY = 14;
const FALL_SPIN = 3;
/** How fast it keeps its height over the dunes (per second). */
const HOLD_HEIGHT = 2.5;

/**
 * A sonar drone of the Company (no pilot, nobody in it): it patrols over the arena at its
 * height above the dunes, its sonar pinging the sand under it. Once it has spotted the hero it
 * follows him. A rock or a leaping bite takes its plate off; at zero its rotors give out and it
 * falls into the sand.
 */
export class Drone implements Target {
  readonly row: MachineRow = machineRow('drone');
  readonly machine = 'drone';
  readonly waveId = -1;
  readonly parts: MachineParts;
  readonly integrity: Integrity;
  private state: DroneState = 'flying';
  private px: number;
  private pz: number;
  private vx = 0;
  private vz = 0;
  private way: 1 | -1 = 1;
  private tilt = 0;
  private marking = false;

  constructor(
    readonly id: number,
    private readonly beat: DroneBeat,
    private readonly surface: SandSurface,
  ) {
    this.parts = new MachineParts(this.row.parts);
    this.integrity = this.parts.body.integrity;
    this.px = beat.x;
    this.pz = surface.heightAt(beat.x) + SONAR.altitudeM;
  }

  get x(): number {
    return this.px;
  }
  get z(): number {
    return this.pz;
  }
  /** Its tilt (radians): into its motion while it flies, spinning as it falls. */
  get angle(): number {
    return this.tilt;
  }
  get hittable(): boolean {
    return this.state === 'flying';
  }
  get velocityX(): number {
    return this.state === 'flying' ? this.vx : 0;
  }
  get isFlying(): boolean {
    return this.state === 'flying';
  }
  get isFalling(): boolean {
    return this.state === 'falling';
  }
  get isGone(): boolean {
    return this.state === 'gone';
  }
  /** It has spotted the hero and marks him (its cyan reticle). */
  get isMarking(): boolean {
    return this.marking;
  }
  /** The sand under it, where its sonar rings start (m). */
  get sonarZ(): number {
    return this.surface.heightAt(this.px);
  }

  bodyBox(out: Box): void {
    out.left = this.px - HALF_WIDTH_M;
    out.right = this.px + HALF_WIDTH_M;
    out.bottom = this.pz - HALF_HEIGHT_M;
    out.top = this.pz + HALF_HEIGHT_M;
  }

  /** Its rotors give out: it falls. */
  giveOut(): void {
    if (this.state !== 'flying') return;
    this.state = 'falling';
    this.vz = 0;
  }

  /** It heard the hero: from now on it follows him. */
  mark(): void {
    this.marking = true;
  }

  /**
   * One step: it patrols (or follows the hero's `heroX`), keeping its height over the dunes; a
   * falling drone answers true the step it hits the sand.
   */
  fly(heroX: number, dt: number): boolean {
    if (this.state === 'gone') return false;
    if (this.state === 'falling') return this.fall(dt);
    const target = this.marking ? heroX : this.patrolTarget();
    const speed = this.marking ? SONAR.trackSpeed : SONAR.patrolSpeed;
    const gap = target - this.px;
    this.vx = Math.max(-speed, Math.min(speed, gap * 2));
    this.px += this.vx * dt;
    const height = this.surface.heightAt(this.px) + SONAR.altitudeM;
    this.pz += (height - this.pz) * (1 - Math.exp(-HOLD_HEIGHT * dt));
    this.tilt = -this.vx * 0.04;
    return false;
  }

  /** Back and forth over its beat. */
  private patrolTarget(): number {
    const { x, spanM } = this.beat;
    if (this.way === 1 && this.px >= x + spanM - 0.5) this.way = -1;
    else if (this.way === -1 && this.px <= x - spanM + 0.5) this.way = 1;
    return x + this.way * spanM;
  }

  private fall(dt: number): boolean {
    this.vz -= FALL_GRAVITY * dt;
    this.px += this.vx * dt;
    this.pz += this.vz * dt;
    this.tilt += FALL_SPIN * dt * (this.vx >= 0 ? 1 : -1);
    if (this.pz - HALF_HEIGHT_M > this.surface.heightAt(this.px)) return false;
    this.state = 'gone';
    return true;
  }
}
