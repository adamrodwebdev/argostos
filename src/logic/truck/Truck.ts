import { machineRow, type MachineId, type MachineRow } from '../../rules/machines';
import type { TruckGeometry } from '../../rules/truckManifest';
import type { Integrity } from '../machine/Integrity';
import { MachineParts } from '../machine/MachineParts';
import type { Target } from '../machine/Target';
import type { TruckRig } from './TruckRig';

/** A box in the world (m). */
export interface Box {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

/** Where the hero's jaws are and where they point. */
export interface Jaws {
  readonly x: number;
  readonly z: number;
  readonly heading: number;
}

export type TruckState = 'driving' | 'caught' | 'gone';

/**
 * The wreck of a caught truck, as its takedown moves it: the body's centre and tilt (m, rad,
 * counter-clockwise, z up), how far it has folded and burnt (0 to 1), and whether its wheels
 * are still on. The takedown writes it; the drawing reads it.
 */
export class WreckPose {
  private cx = 0;
  private cz = 0;
  private tilt = 0;
  private folded = 0;
  private charred = 0;
  private wheels = true;

  get x(): number {
    return this.cx;
  }
  get z(): number {
    return this.cz;
  }
  get angle(): number {
    return this.tilt;
  }
  get fold(): number {
    return this.folded;
  }
  get burn(): number {
    return this.charred;
  }
  get wheelsOn(): boolean {
    return this.wheels;
  }

  hold(x: number, z: number, angle: number): void {
    this.cx = x;
    this.cz = z;
    this.tilt = angle;
  }

  foldTo(share: number): void {
    this.folded = Math.min(1, Math.max(this.folded, share));
  }

  charTo(share: number): void {
    this.charred = Math.min(1, Math.max(this.charred, share));
  }

  loseWheels(): void {
    this.wheels = false;
  }
}

/** What a truck is made of. */
export interface TruckParts {
  readonly id: number;
  readonly rig: TruckRig;
  readonly geometry: TruckGeometry;
  /** Its row in the machines' table (the plain hauler, the armoured one…). */
  readonly machine: MachineId;
  /** Its convoy's number in the hunt. */
  readonly waveId: number;
  /** The arena's width (m): a truck is hittable once its middle is inside it. */
  readonly arenaWidthM: number;
}

/** After a bite that did not finish it, the jaws need this long before they bite it again (s). */
const BITE_REST_S = 0.7;
/** Its middle must be this far inside the arena (m) to be hit: never while it drives in or out. */
const INSIDE_MARGIN_M = 3;

/**
 * One of the Company's trucks (autonomous: no driver, nobody hurt). It drives with its convoy,
 * takes hits off its plate, stalls in sparks and smoke at zero, and is caught by the hero's
 * jaws: then its takedown plays (`WreckPose`), and it is gone. A truck that drives out of the
 * arena got away.
 */
export class Truck implements Target {
  readonly wreck = new WreckPose();
  readonly id: number;
  readonly rig: TruckRig;
  readonly machine: MachineId;
  readonly row: MachineRow;
  readonly parts: MachineParts;
  readonly integrity: Integrity;
  readonly waveId: number;
  private readonly geometry: TruckGeometry;
  private readonly arenaWidthM: number;
  private readonly box: Box = { left: 0, right: 0, bottom: 0, top: 0 };
  private state: TruckState = 'driving';
  private stall = false;
  private glass = false;
  private biteRest = 0;
  private bitten = false;
  private running = false;

  constructor(parts: TruckParts) {
    this.id = parts.id;
    this.rig = parts.rig;
    this.geometry = parts.geometry;
    this.machine = parts.machine;
    this.row = machineRow(parts.machine);
    this.parts = new MachineParts(this.row.parts);
    this.integrity = this.parts.body.integrity;
    this.waveId = parts.waveId;
    this.arenaWidthM = parts.arenaWidthM;
  }

  /** On the sand, in the hunt: not caught, not gone (it may be stalled or trapped). */
  get isDriving(): boolean {
    return this.state === 'driving';
  }
  get isCaught(): boolean {
    return this.state === 'caught';
  }
  get isGone(): boolean {
    return this.state === 'gone';
  }
  /** On the sand with its middle inside the arena (not while it drives in or out). */
  get hittable(): boolean {
    if (this.state !== 'driving') return false;
    this.bodyBox(this.box);
    const middle = (this.box.left + this.box.right) / 2;
    return middle > INSIDE_MARGIN_M && middle < this.arenaWidthM - INSIDE_MARGIN_M;
  }
  /** Its speed along x (m/s): a rock thrown at it leads it. */
  get velocityX(): number {
    return this.state === 'driving' ? this.rig.direction * this.rig.speed : 0;
  }
  /** At zero, it stands in sparks and smoke: the next bite from below finishes it. */
  get isStalled(): boolean {
    return this.stall;
  }
  /** Held in a glass dome: it cannot drive on. */
  get isTrapped(): boolean {
    return this.glass;
  }
  /** Its convoy runs for an exit (the scanner shows it). */
  get isFleeing(): boolean {
    return this.running;
  }
  /** It was caught while held in glass (a convoy taken by glass alone wins a star). */
  get caughtInGlass(): boolean {
    return this.bitten;
  }
  /** The jaws may bite it now (not just after a bite that left it standing). */
  get canBeBitten(): boolean {
    return this.biteRest <= 0 && this.hittable;
  }
  get frame(): TruckGeometry {
    return this.geometry;
  }

  /** The box its body fills now (m), written into `out`. */
  bodyBox(out: Box): void {
    const { frameLeftM, frameRightM, frameTopM, frameBottomM } = this.geometry;
    const x = this.rig.rearX;
    if (this.rig.direction === 1) {
      out.left = x + frameLeftM;
      out.right = x + frameRightM;
    } else {
      out.left = x - frameRightM;
      out.right = x - frameLeftM;
    }
    out.bottom = this.rig.rearHubZ + frameBottomM;
    out.top = this.rig.rearHubZ + frameTopM;
  }

  /** Its plate is gone: it stalls where it stands. */
  giveOut(): void {
    this.stall = true;
  }

  /** A bite took plate off without finishing it: the jaws rest a moment before the next. */
  restFromBite(): void {
    this.biteRest = BITE_REST_S;
  }

  /** Its convoy panicked: it runs for an exit. */
  run(): void {
    this.running = true;
  }

  /** Held in glass (or let go): the dome says so every step. */
  holdInGlass(held: boolean): void {
    this.glass = held;
  }

  /** A step of `dt` seconds of the hunt passed. */
  tick(dt: number): void {
    this.biteRest = Math.max(0, this.biteRest - dt);
  }

  /** The jaws closed on it: its wreck starts where its body was, as tilted as it was. */
  catchIn(box: Box): void {
    if (this.state !== 'driving') return;
    this.state = 'caught';
    this.bitten = this.glass;
    this.bodyBox(box);
    this.wreck.hold(
      (box.left + box.right) / 2,
      (box.bottom + box.top) / 2,
      this.rig.direction * this.rig.pitch,
    );
  }

  /** Its takedown is over: it is under the sand. */
  finish(): void {
    this.state = 'gone';
  }

  /** It drove out of the arena: it got away. */
  leave(): void {
    this.state = 'gone';
  }
}
