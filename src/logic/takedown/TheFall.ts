import { TAKEDOWNS, type TakedownId, type TakedownRow } from '../../rules/takedowns';
import { GROUND, TOWER } from '../../rules/terrainTraps';
import type { Box } from '../truck/Truck';
import type { RunningTakedown, Strike, TakedownStrategy, TakedownWorld } from './Takedown';
import { WreckBreakup, type WreckPlace } from './WreckBreakup';

const ID: TakedownId = 'fall';
/** A wreck on the sand keeps this share of its speed at each blow, and of its tumble. */
const SLIDE_KEEP = 0.7;
const TUMBLE_KEEP = 0.55;
/** How the tumble slows down in the air (per second). */
const TUMBLE_DAMPING = 0.8;

/**
 * The fall: a truck that tipped over or landed hard breaks by itself on the sand, through the
 * same beats as any takedown (its wheels and panels torn off, the glass, the fuel's fire and
 * smoke), then the moving ground swallows it. No jaws: it tumbles under gravity, crashes, slides
 * and sinks. Its timing and forces are its row in `TAKEDOWNS`.
 */
export class TheFall implements TakedownStrategy {
  readonly id = ID;
  private readonly row: TakedownRow;

  constructor() {
    const row = TAKEDOWNS.get(ID);
    if (!row) throw new Error(`no row for the takedown ${ID}`);
    this.row = row;
  }

  /** It needs the ground to have done it. */
  fits(strike: Strike): boolean {
    return strike.cause === 'fall';
  }

  begin(strike: Strike, world: TakedownWorld): RunningTakedown {
    return new FallRun(strike, world, this.row);
  }
}

class FallRun implements RunningTakedown {
  private readonly breakup: WreckBreakup;
  private readonly box: Box = { left: 0, right: 0, bottom: 0, top: 0 };
  private readonly place: WreckPlace;
  private readonly halfHeight: number;
  private time = 0;
  private vz: number;
  private spin: number;

  constructor(
    strike: Strike,
    private readonly world: TakedownWorld,
    private readonly row: TakedownRow,
  ) {
    const { truck } = strike;
    const { rig } = truck;
    this.breakup = new WreckBreakup({ truck, world, row, takedown: ID, finale: strike.finale });
    const speed = rig.direction * rig.speed;
    const tilt = rig.direction * rig.groundTilt;
    truck.catchIn(this.box);
    this.halfHeight = (this.box.top - this.box.bottom) / 2;
    const { wreck } = truck;
    this.place = { x: wreck.x, z: wreck.z, angle: wreck.angle, vx: speed * 0.6 };
    this.breakup.place(this.place);
    // The crash throws it up a little; it goes on tumbling the way it tipped.
    this.vz = row.liftSpeed;
    const side = tilt !== 0 ? Math.sign(tilt) : -this.breakup.facing;
    this.spin = side * row.tipSpeed * (0.7 + 0.5 * world.random.next());
    this.breakup.beat('strike', Math.min(1, 0.6 + strike.heroVz / 30));
    this.breakup.plume({
      x: this.place.x,
      lowestZ: this.box.bottom - 1.2,
      carryX: speed * 0.2,
      carryZ: 0,
    });
  }

  get done(): boolean {
    return this.breakup.done;
  }

  step(): void {
    if (this.breakup.done) return;
    const dt = this.world.stepSeconds;
    const { row, place } = this;
    this.time += dt;
    const ground = this.world.ground.heightAt(place.x);
    if (this.time < row.dragAt) {
      // Tumbling onto the sand: gravity, blows on the ground, a slide.
      this.vz -= GROUND.gravity * dt;
      place.x += place.vx * dt;
      place.z += this.vz * dt;
      place.angle += this.spin * dt;
      this.spin *= Math.exp(-TUMBLE_DAMPING * dt);
      const rest = ground + this.halfHeight * Math.abs(Math.cos(place.angle)) * 0.8;
      if (place.z < rest) {
        place.z = rest;
        this.vz = Math.max(0, -this.vz * 0.15);
        place.vx *= SLIDE_KEEP;
        this.spin *= TUMBLE_KEEP;
      }
    } else {
      // The moving ground swallows it.
      place.z -= TOWER.sinkSpeed * dt;
      place.x += place.vx * dt;
      place.vx *= Math.exp(-2 * dt);
    }
    this.breakup.place(place);
    this.breakup.advance(this.time);
  }
}
