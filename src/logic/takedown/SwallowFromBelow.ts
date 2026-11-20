import { DEBRIS, TAKEDOWNS, type TakedownId, type TakedownRow } from '../../rules/takedowns';
import type { TakedownBeat } from '../hunt/HuntEvents';
import type { Box, Jaws, Truck } from '../truck/Truck';
import type { RunningTakedown, Strike, TakedownStrategy, TakedownWorld } from './Takedown';
import { DebrisKind } from './Wreckage';

const ID: TakedownId = 'swallowFromBelow';
/** Gravity on the wreck while it is thrown (m/s²), and how hard the jaws keep it (per second). */
const WRECK_GRAVITY = 14;
const JAWS_PULL = 3.5;
const DRAG_PULL = 7;
/** How the tip slows down (per second). */
const TIP_DAMPING = 1.6;
/** The cab's window and the fuel tank, as shares of the truck's frame from its rear end. */
const CAB_AT = { along: 0.78, up: 0.62 } as const;
const TANK_AT = { along: 0.5, up: 0.22 } as const;

/**
 * Swallowed from below: Argostos strikes up under the truck. It lifts and tips; its wheels tear
 * off and fly, two panels with them; the cab's glass shatters; the fuel bursts into fire; the
 * body folds in the jaws and is dragged down into the sand. The sand at the bite plumes up and
 * falls back. Its timing and forces are its row in `TAKEDOWNS`.
 */
export class SwallowFromBelow implements TakedownStrategy {
  readonly id = ID;
  private readonly row: TakedownRow;

  constructor() {
    const row = TAKEDOWNS.get(ID);
    if (!row) throw new Error(`no row for the takedown ${ID}`);
    this.row = row;
  }

  /** It needs the hero rising into the truck. */
  fits(strike: Strike): boolean {
    return strike.heroVz > 0;
  }

  begin(strike: Strike, world: TakedownWorld): RunningTakedown {
    return new SwallowRun(strike, world, this.row);
  }
}

class SwallowRun implements RunningTakedown {
  private readonly truck: Truck;
  private readonly facing: 1 | -1;
  private readonly finale: boolean;
  private readonly box: Box = { left: 0, right: 0, bottom: 0, top: 0 };
  private time = 0;
  private x: number;
  private z: number;
  private readonly vx: number;
  private vz: number;
  private angle: number;
  private spin: number;
  /** The wreck's place from the jaws at the bite (m), and the jaws' heading then. */
  private offsetX: number;
  private offsetZ: number;
  private readonly biteHeading: number;
  private readonly fired = new Set<TakedownBeat>();
  private ended = false;

  constructor(
    strike: Strike,
    private readonly world: TakedownWorld,
    private readonly row: TakedownRow,
  ) {
    this.truck = strike.truck;
    this.facing = strike.truck.rig.direction;
    this.finale = strike.finale;
    this.truck.catchIn(this.box);
    const { wreck } = this.truck;
    this.x = wreck.x;
    this.z = wreck.z;
    this.angle = wreck.angle;
    this.vx = strike.heroVx * 0.25;
    this.vz = row.liftSpeed + Math.max(0, strike.heroVz) * 0.2;
    // It tips over its rear, away from where it was going.
    this.spin = row.tipSpeed * this.facing * (0.8 + 0.4 * world.random.next());
    this.offsetX = this.x - strike.jaws.x;
    this.offsetZ = this.z - strike.jaws.z;
    this.biteHeading = strike.jaws.heading;
    this.beat('strike', Math.min(1, 0.55 + Math.abs(strike.heroVz) / 30));
    world.events.emit('truckCaught', { id: this.truck.id, x: strike.jaws.x, z: strike.jaws.z });
    this.plume(strike);
  }

  get done(): boolean {
    return this.ended;
  }

  step(jaws: Jaws): void {
    if (this.ended) return;
    const dt = this.world.stepSeconds;
    const { row } = this;
    this.time += dt;
    if (this.time < row.dragAt) {
      // Thrown up and tipping, but the jaws keep their hold.
      this.vz -= WRECK_GRAVITY * dt;
      this.x += this.vx * dt;
      this.z += this.vz * dt;
      const pull = 1 - Math.exp(-JAWS_PULL * dt);
      this.x += (jaws.x + this.offsetX - this.x) * pull;
      this.z += (jaws.z + this.offsetZ - this.z) * pull;
    } else {
      // Dragged down: into the mouth, turning with the head.
      const decay = Math.exp(-DRAG_PULL * dt);
      this.offsetX *= decay;
      this.offsetZ *= decay;
      const pull = 1 - Math.exp(-DRAG_PULL * dt);
      this.x += (jaws.x + this.offsetX - this.x) * pull;
      this.z += (jaws.z + this.offsetZ - this.z) * pull;
      this.spin += (jaws.heading - this.biteHeading) * 0.02;
    }
    this.angle += this.spin * dt;
    this.spin *= Math.exp(-TIP_DAMPING * dt);
    const { wreck } = this.truck;
    wreck.hold(this.x, this.z, this.angle);
    wreck.foldTo(smoothstep(row.foldFrom, row.foldTo, this.time));
    if (this.time >= row.fuelAt) wreck.charTo((this.time - row.fuelAt) / 0.5);
    this.beats();
  }

  /** The beats that are due, each once, in their order. */
  private beats(): void {
    const { row, time } = this;
    if (time >= row.wheelsAt && !this.fired.has('tear')) this.tear();
    if (time >= row.shatterAt && !this.fired.has('shatter')) this.beat('shatter', 0.7);
    if (time >= row.fuelAt && !this.fired.has('fuel')) this.beat('fuel', 0.8);
    if (time >= row.dragAt && !this.fired.has('drag')) this.beat('drag', 0.5);
    if (time >= row.endsAt && !this.fired.has('buried')) {
      this.beat('buried', 0.4);
      this.ended = true;
      this.truck.finish();
    }
  }

  private beat(beat: TakedownBeat, strength: number): void {
    this.fired.add(beat);
    const at =
      beat === 'shatter' ? this.partAt(CAB_AT) : beat === 'fuel' ? this.partAt(TANK_AT) : null;
    this.world.events.emit('takedownBeat', {
      takedown: ID,
      beat,
      truckId: this.truck.id,
      machine: this.truck.machine,
      x: at?.x ?? this.x,
      z: at?.z ?? this.z,
      strength,
      facing: this.facing,
      finale: this.finale,
    });
  }

  /** The wheels tear off and fly, two panels with them. */
  private tear(): void {
    const { row, world, truck } = this;
    const { random, wreckage } = world;
    const geometry = truck.frame;
    truck.wreck.loseWheels();
    const radius = geometry.wheelRadiusM;
    for (const [hub, side] of [
      [0, -1],
      [geometry.wheelbaseM, 1],
    ] as const) {
      const at = this.hubAt(hub);
      wreckage.throwPiece({
        kind: DebrisKind.Wheel,
        x: at.x,
        z: at.z,
        vx: this.vx + side * this.facing * row.wheelSpeed * (0.55 + 0.45 * random.next()),
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
      const part = panel === 0 ? CAB_AT : TANK_AT;
      const at = this.partAt(part);
      wreckage.throwPiece({
        kind: DebrisKind.Panel,
        x: at.x,
        z: at.z,
        vx: this.vx + (random.next() - 0.5) * row.wheelSpeed * 1.4,
        vz: row.wheelSpeed * (0.8 + 0.5 * random.next()),
        angle: this.angle,
        spin: (random.next() - 0.5) * 2 * row.wheelSpin,
        radius: DEBRIS.panelRadius,
        variant: panel,
        facing: this.facing,
        burn: 0,
      });
    }
    this.beat('tear', 0.85);
  }

  /** The sand round the bite plumes up (real grains: they fall back). */
  private plume(strike: Strike): void {
    const { row } = this;
    const reachM = 3.5;
    this.world.thrower.throwRim({
      x: strike.jaws.x,
      lowestZ: this.box.bottom - 1.5,
      reachM,
      perColumn: Math.ceil(row.plumeGrains / ((2 * reachM) / 0.25)),
      up: row.plumeSpeed,
      spread: 3,
      carryX: strike.heroVx * 0.2,
      carryZ: Math.max(0, strike.heroVz) * 0.25,
    });
  }

  /** A hub's place in the world now (`along` m from the rear hub). */
  private hubAt(along: number): { x: number; z: number } {
    const g = this.truck.frame;
    return this.fromFrame(
      along - (g.frameLeftM + g.frameRightM) / 2,
      -(g.frameTopM + g.frameBottomM) / 2,
    );
  }

  /** A part of the truck (shares of its frame from the rear end and the bottom) in the world now. */
  private partAt(part: { readonly along: number; readonly up: number }): { x: number; z: number } {
    const g = this.truck.frame;
    const width = g.frameRightM - g.frameLeftM;
    const height = g.frameTopM - g.frameBottomM;
    return this.fromFrame((part.along - 0.5) * width, (part.up - 0.5) * height);
  }

  /** A point given from the body's centre in the truck's own frame, placed in the world. */
  private fromFrame(along: number, up: number): { x: number; z: number } {
    const ax = along * this.facing;
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);
    return { x: this.x + ax * cos - up * sin, z: this.z + ax * sin + up * cos };
  }
}

function smoothstep(from: number, to: number, t: number): number {
  const u = Math.min(1, Math.max(0, (t - from) / (to - from)));
  return u * u * (3 - 2 * u);
}
