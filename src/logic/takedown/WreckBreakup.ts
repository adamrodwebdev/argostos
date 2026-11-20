import { DEBRIS, type TakedownId, type TakedownRow } from '../../rules/takedowns';
import type { TakedownBeat } from '../hunt/HuntEvents';
import type { Truck } from '../truck/Truck';
import type { TakedownWorld } from './Takedown';
import { DebrisKind } from './Wreckage';

/** The cab's window and the fuel tank, as shares of the truck's frame from its rear end. */
const CAB_AT = { along: 0.78, up: 0.62 } as const;
const TANK_AT = { along: 0.5, up: 0.22 } as const;

export interface BreakupStart {
  readonly truck: Truck;
  readonly world: TakedownWorld;
  readonly row: TakedownRow;
  readonly takedown: TakedownId;
  /** The hunt's last prey: its beats say so (slow motion). */
  readonly finale: boolean;
}

/** Where a wreck is now: its centre (m), its tilt (radians), how fast it goes along x (m/s). */
export interface WreckPlace {
  x: number;
  z: number;
  angle: number;
  vx: number;
}

/** A throw of the sand where the machine broke (m, m/s). */
export interface PlumeAt {
  readonly x: number;
  readonly lowestZ: number;
  readonly carryX: number;
  readonly carryZ: number;
}

/**
 * How a truck breaks, whatever broke it (the jaws, a fall): the beats of its row on time (the
 * wheels and two panels torn off as debris, the cab's glass, the fuel's fire, the drag under
 * the sand, the end), the body folding and charring as the row says, the sand plumed where it
 * broke. A takedown moves the wreck; this breaks it. One per takedown that plays.
 */
export class WreckBreakup {
  readonly facing: 1 | -1;
  private readonly fired = new Set<TakedownBeat>();
  private readonly at: WreckPlace = { x: 0, z: 0, angle: 0, vx: 0 };
  private finished = false;

  constructor(private readonly start: BreakupStart) {
    this.facing = start.truck.rig.direction;
  }

  /** Its last beat came: the wreck is under the sand. */
  get done(): boolean {
    return this.finished;
  }

  /** The wreck is there now: its pose for the drawing. */
  place(place: WreckPlace): void {
    this.at.x = place.x;
    this.at.z = place.z;
    this.at.angle = place.angle;
    this.at.vx = place.vx;
    this.start.truck.wreck.hold(place.x, place.z, place.angle);
  }

  /** What is due by `time` (s from the start): beats, each once, in order; fold and fire. */
  advance(time: number): void {
    if (this.finished) return;
    const { row, truck } = this.start;
    truck.wreck.foldTo(smoothstep(row.foldFrom, row.foldTo, time));
    if (time >= row.fuelAt) truck.wreck.charTo((time - row.fuelAt) / 0.5);
    if (time >= row.wheelsAt && !this.fired.has('tear')) this.tear();
    if (time >= row.shatterAt && !this.fired.has('shatter')) this.beat('shatter', 0.7);
    if (time >= row.fuelAt && !this.fired.has('fuel')) this.beat('fuel', 0.8);
    if (time >= row.dragAt && !this.fired.has('drag')) this.beat('drag', 0.5);
    if (time >= row.endsAt && !this.fired.has('buried')) {
      this.beat('buried', 0.4);
      this.finished = true;
      truck.finish();
    }
  }

  /** A beat now, at the wreck (the glass at the cab, the fuel at the tank). */
  beat(beat: TakedownBeat, strength: number): void {
    this.fired.add(beat);
    const { world, truck, takedown, finale } = this.start;
    const at =
      beat === 'shatter' ? this.partAt(CAB_AT) : beat === 'fuel' ? this.partAt(TANK_AT) : null;
    world.events.emit('takedownBeat', {
      takedown,
      beat,
      truckId: truck.id,
      machine: truck.machine,
      x: at?.x ?? this.at.x,
      z: at?.z ?? this.at.z,
      strength,
      facing: this.facing,
      finale,
    });
  }

  /** The sand where it broke plumes up (real grains: they fall back). */
  plume(at: PlumeAt): void {
    const { row, world } = this.start;
    const reachM = 3.5;
    world.thrower.throwRim({
      x: at.x,
      lowestZ: at.lowestZ,
      reachM,
      perColumn: Math.ceil(row.plumeGrains / ((2 * reachM) / 0.25)),
      up: row.plumeSpeed,
      spread: 3,
      carryX: at.carryX,
      carryZ: at.carryZ,
    });
  }

  /** The wheels tear off and fly, two panels with them. */
  private tear(): void {
    const { row, world, truck } = this.start;
    const { random, wreckage } = world;
    const geometry = truck.frame;
    truck.wreck.loseWheels();
    const radius = geometry.wheelRadiusM;
    for (const [hub, side] of HUB_SIDES) {
      const at = this.hubAt(hub === 0 ? 0 : geometry.wheelbaseM);
      wreckage.throwPiece({
        kind: DebrisKind.Wheel,
        x: at.x,
        z: at.z,
        vx: this.at.vx + side * this.facing * row.wheelSpeed * (0.55 + 0.45 * random.next()),
        vz: row.wheelSpeed * (0.7 + 0.4 * random.next()),
        angle: 0,
        spin: (random.next() < 0.5 ? -1 : 1) * row.wheelSpin,
        radius,
        variant: 0,
        facing: this.facing,
        burn: 0.6 + random.next(),
      });
    }
    for (let panel = 0; panel < row.panels; panel++) {
      const at = this.partAt(panel === 0 ? CAB_AT : TANK_AT);
      wreckage.throwPiece({
        kind: DebrisKind.Panel,
        x: at.x,
        z: at.z,
        vx: this.at.vx + (random.next() - 0.5) * row.wheelSpeed * 1.4,
        vz: row.wheelSpeed * (0.8 + 0.5 * random.next()),
        angle: this.at.angle,
        spin: (random.next() - 0.5) * 2 * row.wheelSpin,
        radius: DEBRIS.panelRadius,
        variant: panel,
        facing: this.facing,
        burn: 0,
      });
    }
    this.beat('tear', 0.85);
  }

  /** A hub's place in the world now (`along` m from the rear hub). */
  private hubAt(along: number): { x: number; z: number } {
    const g = this.start.truck.frame;
    return this.fromFrame(
      along - (g.frameLeftM + g.frameRightM) / 2,
      -(g.frameTopM + g.frameBottomM) / 2,
    );
  }

  /** A part of the truck (shares of its frame from the rear end and the bottom) in the world now. */
  private partAt(part: { readonly along: number; readonly up: number }): { x: number; z: number } {
    const g = this.start.truck.frame;
    const width = g.frameRightM - g.frameLeftM;
    const height = g.frameTopM - g.frameBottomM;
    return this.fromFrame((part.along - 0.5) * width, (part.up - 0.5) * height);
  }

  /** A point given from the body's centre in the truck's own frame, placed in the world. */
  private fromFrame(along: number, up: number): { x: number; z: number } {
    const ax = along * this.facing;
    const cos = Math.cos(this.at.angle);
    const sin = Math.sin(this.at.angle);
    return { x: this.at.x + ax * cos - up * sin, z: this.at.z + ax * sin + up * cos };
  }
}

/** The rear hub flies backward, the front one forward. */
const HUB_SIDES: readonly (readonly [0 | 1, number])[] = [
  [0, -1],
  [1, 1],
];

export function smoothstep(from: number, to: number, t: number): number {
  const u = Math.min(1, Math.max(0, (t - from) / (to - from)));
  return u * u * (3 - 2 * u);
}
