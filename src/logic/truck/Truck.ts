import type { TruckGeometry } from '../../rules/truckManifest';
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

/**
 * One of the Company's trucks (autonomous: no driver, nobody hurt). It drives across the arena
 * until the hero's jaws close on it from below; then its takedown plays (`WreckPose`), and it
 * is gone.
 */
export class Truck {
  readonly wreck = new WreckPose();
  private state: TruckState = 'driving';

  constructor(
    readonly id: number,
    readonly rig: TruckRig,
    private readonly geometry: TruckGeometry,
  ) {}

  get isDriving(): boolean {
    return this.state === 'driving';
  }
  get isCaught(): boolean {
    return this.state === 'caught';
  }
  get isGone(): boolean {
    return this.state === 'gone';
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

  /** The jaws closed on it: its wreck starts where its body was, as tilted as it was. */
  catchIn(box: Box): void {
    if (this.state !== 'driving') return;
    this.state = 'caught';
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

  /** It drove out of the arena. */
  leave(): void {
    this.state = 'gone';
  }
}
