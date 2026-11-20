import type { HuntEvents } from '../../logic/hunt/HuntEvents';
import type { Truck } from '../../logic/truck/Truck';
import { hitRow } from '../../rules/combat';
import type { RandomSource } from '../../rules/random';
import type { SoundPort } from '../sound/SoundPort';
import type { Jolting, TimeControl } from '../takedown/TakedownEffects';
import type { Effects } from './Effects';
import type { FireSources } from './FireSources';

export interface CombatEffectsOptions {
  readonly events: HuntEvents;
  readonly effects: Effects;
  readonly fires: FireSources;
  readonly camera: Jolting;
  readonly time: TimeControl;
  readonly sound: SoundPort;
  readonly random: RandomSource;
  /** The trucks of the hunt: a stalled one smokes and sparks. */
  readonly trucks: () => readonly Truck[];
}

const UP = Math.PI / 2;
/** A strong hit holds the world longer and shakes the camera harder. */
const STRONG_HOLD = 1.4;
const STRONG_SHAKE = 1.5;
/** A stalled truck gives off this much smoke and these many sparks a second. */
const STALL_SMOKE_PER_S = 9;
const STALL_SPARKS_PER_S = 5;

/**
 * What the combat looks, sounds and feels like: each hit's sparks, its hit-stop and camera jolt
 * (stronger for a strong hit), the smoke of a machine at zero, the tail's swish, the rock's
 * landing, the ram's burst, the dome's chime and its shattering, a drone falling and crashing,
 * the alarm when a drone hears the hero. It listens to the hunt's events and decides nothing.
 */
export class CombatEffects {
  private readonly emit = { x: 0, z: 0, vx: 0, vz: 0, life: 0 };
  private smokeOwed = 0;
  private sparksOwed = 0;

  constructor(private readonly options: CombatEffectsOptions) {
    const { events, effects, sound, time, camera, fires } = options;
    events.on('hit', ({ kind, strong, x, z }) => {
      const row = hitRow(kind);
      time.hold(row.hitStopMs * (strong ? STRONG_HOLD : 1));
      camera.jolt(row.shake * (strong ? STRONG_SHAKE : 1));
      const heavy = kind === 'bite' || kind === 'ram';
      sound.play('impact', heavy ? (strong ? 0.95 : 0.6) : 0.35);
      if (heavy) sound.play('crunch', strong ? 0.8 : 0.45);
      effects.burst({
        kind: 'spark',
        x,
        z,
        count: strong ? 26 : 14,
        speed: 9,
        angle: UP,
        spread: 2.8,
        life: 0.4,
      });
      effects.burst({
        kind: 'chip',
        x,
        z,
        count: heavy ? 6 : 3,
        speed: 6,
        angle: UP,
        spread: 2,
        life: 1.4,
      });
    });
    events.on('gaveOut', ({ x, z }) => {
      sound.play('crunch', 0.6);
      effects.burst({
        kind: 'smoke',
        x,
        z,
        count: 10,
        speed: 1.4,
        angle: UP,
        spread: 1.6,
        life: 2,
      });
      effects.burst({ kind: 'spark', x, z, count: 20, speed: 8, angle: UP, spread: 3, life: 0.5 });
    });
    events.on('tailSwept', ({ x, z }) => {
      sound.play('swish', 0.7);
      effects.burst({ kind: 'dust', x, z, count: 16, speed: 5, angle: UP, spread: 2.6, life: 1.1 });
    });
    events.on('rockLanded', ({ x, z }) => {
      sound.play('sandBurst', 0.3);
      effects.burst({ kind: 'dust', x, z, count: 10, speed: 3, angle: UP, spread: 1.6, life: 1.2 });
    });
    events.on('actionUsed', ({ action, mode, x, z }) => {
      if (action === 'ram') {
        sound.play('whoosh', 0.45);
        effects.burst({
          kind: 'dust',
          x,
          z,
          count: 12,
          speed: 4,
          angle: UP,
          spread: Math.PI,
          life: 1,
        });
      } else if (action === 'strike' && mode === 'rock') {
        sound.play('swish', 0.4);
      }
    });
    events.on('domeRaised', ({ x, halfWidth }) => {
      sound.play('chime', 0.8);
      for (const side of SIDES) {
        effects.burst({
          kind: 'glass',
          x: x + side * halfWidth * 0.6,
          z: 0,
          count: 8,
          speed: 3,
          angle: UP,
          spread: 1.2,
          life: 0.9,
        });
      }
    });
    events.on('domeShattered', ({ x, halfWidth, height }) => {
      sound.play('shatter', 0.85);
      for (const [along, up] of DOME_POINTS) {
        effects.burst({
          kind: 'glass',
          x: x + along * halfWidth,
          z: up * height,
          count: 9,
          speed: 6,
          angle: UP,
          spread: Math.PI * 1.4,
          life: 1.3,
        });
      }
    });
    events.on('droneFell', ({ x, z }) => {
      sound.play('crunch', 0.55);
      effects.burst({
        kind: 'spark',
        x,
        z,
        count: 22,
        speed: 8,
        angle: UP,
        spread: Math.PI * 2,
        life: 0.5,
      });
    });
    events.on('droneCrashed', ({ x, z }) => {
      sound.play('impact', 0.75);
      effects.burst({ kind: 'chip', x, z, count: 12, speed: 7, angle: UP, spread: 2.2, life: 1.6 });
      effects.burst({
        kind: 'dust',
        x,
        z,
        count: 14,
        speed: 3.5,
        angle: UP,
        spread: Math.PI,
        life: 1.4,
      });
      fires.ignitePatch(x, z, 2.5);
    });
    events.on('spotted', () => {
      sound.play('alarm', 0.8);
    });
  }

  /** A frame of `dt` seconds of the hunt's time: stalled trucks smoke and spark. */
  frame(dt: number): void {
    const { effects, random } = this.options;
    for (const truck of this.options.trucks()) {
      if (!truck.isDriving || !truck.isStalled) continue;
      const x = (truck.rig.rearX + truck.rig.frontX) / 2;
      const z = truck.rig.rearHubZ + 3;
      this.smokeOwed += STALL_SMOKE_PER_S * dt;
      this.sparksOwed += STALL_SPARKS_PER_S * dt;
      while (this.smokeOwed >= 1) {
        this.smokeOwed -= 1;
        this.put(x + (random.next() - 0.5) * 3, z, 0.7, 2);
        effects.one('smoke', this.emit);
      }
      while (this.sparksOwed >= 1) {
        this.sparksOwed -= 1;
        this.put(x + (random.next() - 0.5) * 4, z - 1, 3 + 3 * random.next(), 0.4);
        this.emit.vx = (random.next() - 0.5) * 5;
        effects.one('spark', this.emit);
      }
    }
  }

  private put(x: number, z: number, rise: number, life: number): void {
    this.emit.x = x;
    this.emit.z = z;
    this.emit.vx = 0;
    this.emit.vz = rise;
    this.emit.life = life;
  }
}

const SIDES: readonly number[] = [-1, 1];
/** Points round the dome where its glass bursts (shares of its half-width and height). */
const DOME_POINTS: readonly (readonly [number, number])[] = [
  [-0.85, 0.35],
  [-0.5, 0.85],
  [0, 1],
  [0.5, 0.85],
  [0.85, 0.35],
];
