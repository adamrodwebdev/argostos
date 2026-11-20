import { TAKEDOWNS, type TakedownId, type TakedownRow } from '../../rules/takedowns';
import type { Box, Jaws } from '../truck/Truck';
import type { RunningTakedown, Strike, TakedownStrategy, TakedownWorld } from './Takedown';
import { WreckBreakup, type WreckPlace } from './WreckBreakup';

const ID: TakedownId = 'swallowFromBelow';
/** Gravity on the wreck while it is thrown (m/s²), and how hard the jaws keep it (per second). */
const WRECK_GRAVITY = 14;
const JAWS_PULL = 3.5;
const DRAG_PULL = 7;
/** How the tip slows down (per second). */
const TIP_DAMPING = 1.6;

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

  /** It needs the jaws, the hero rising into the truck. */
  fits(strike: Strike): boolean {
    return strike.cause === 'bite' && strike.heroVz > 0;
  }

  begin(strike: Strike, world: TakedownWorld): RunningTakedown {
    return new SwallowRun(strike, world, this.row);
  }
}

class SwallowRun implements RunningTakedown {
  private readonly breakup: WreckBreakup;
  private readonly box: Box = { left: 0, right: 0, bottom: 0, top: 0 };
  private readonly place: WreckPlace;
  private time = 0;
  private vz: number;
  private spin: number;
  /** The wreck's place from the jaws at the bite (m), and the jaws' heading then. */
  private offsetX: number;
  private offsetZ: number;
  private readonly biteHeading: number;

  constructor(
    strike: Strike,
    private readonly world: TakedownWorld,
    private readonly row: TakedownRow,
  ) {
    const { truck } = strike;
    this.breakup = new WreckBreakup({ truck, world, row, takedown: ID, finale: strike.finale });
    truck.catchIn(this.box);
    const { wreck } = truck;
    this.place = { x: wreck.x, z: wreck.z, angle: wreck.angle, vx: strike.heroVx * 0.25 };
    this.breakup.place(this.place);
    this.vz = row.liftSpeed + Math.max(0, strike.heroVz) * 0.2;
    // It tips over its rear, away from where it was going.
    this.spin = row.tipSpeed * this.breakup.facing * (0.8 + 0.4 * world.random.next());
    this.offsetX = this.place.x - strike.jaws.x;
    this.offsetZ = this.place.z - strike.jaws.z;
    this.biteHeading = strike.jaws.heading;
    this.breakup.beat('strike', Math.min(1, 0.55 + Math.abs(strike.heroVz) / 30));
    world.events.emit('truckCaught', { id: truck.id, x: strike.jaws.x, z: strike.jaws.z });
    this.breakup.plume({
      x: strike.jaws.x,
      lowestZ: this.box.bottom - 1.5,
      carryX: strike.heroVx * 0.2,
      carryZ: Math.max(0, strike.heroVz) * 0.25,
    });
  }

  get done(): boolean {
    return this.breakup.done;
  }

  step(jaws: Jaws): void {
    if (this.breakup.done) return;
    const dt = this.world.stepSeconds;
    const { row, place } = this;
    this.time += dt;
    if (this.time < row.dragAt) {
      // Thrown up and tipping, but the jaws keep their hold.
      this.vz -= WRECK_GRAVITY * dt;
      place.x += place.vx * dt;
      place.z += this.vz * dt;
      const pull = 1 - Math.exp(-JAWS_PULL * dt);
      place.x += (jaws.x + this.offsetX - place.x) * pull;
      place.z += (jaws.z + this.offsetZ - place.z) * pull;
    } else {
      // Dragged down: into the mouth, turning with the head.
      const decay = Math.exp(-DRAG_PULL * dt);
      this.offsetX *= decay;
      this.offsetZ *= decay;
      const pull = 1 - Math.exp(-DRAG_PULL * dt);
      place.x += (jaws.x + this.offsetX - place.x) * pull;
      place.z += (jaws.z + this.offsetZ - place.z) * pull;
      this.spin += (jaws.heading - this.biteHeading) * 0.02;
    }
    place.angle += this.spin * dt;
    this.spin *= Math.exp(-TIP_DAMPING * dt);
    this.breakup.place(place);
    this.breakup.advance(this.time);
  }
}
