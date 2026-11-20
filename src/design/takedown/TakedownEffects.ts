import type { HuntEvents, TakedownBeat, TakedownBeatEvent } from '../../logic/hunt/HuntEvents';
import { machineRow } from '../../rules/machines';
import { FINALE, TAKEDOWNS } from '../../rules/takedowns';
import type { Effects } from '../fx/Effects';
import type { FireSources } from '../fx/FireSources';
import type { SoundPort } from '../sound/SoundPort';

/** The hunt's time, held at a bite and slowed for the last prey (the loop owns it). */
export interface TimeControl {
  hold(ms: number): void;
  slow(scale: number, ms: number): void;
}

/** The camera, for a jolt scaled to the hit. */
export interface Jolting {
  jolt(amount: number): void;
}

export interface TakedownEffectsOptions {
  readonly events: HuntEvents;
  readonly effects: Effects;
  readonly fires: FireSources;
  readonly camera: Jolting;
  readonly time: TimeControl;
  readonly sound: SoundPort;
  /** The sand's height under any x (m). */
  readonly ground: (x: number) => number;
}

const UP = Math.PI / 2;

/**
 * What a takedown looks, sounds and feels like: each beat the logic reports (the bite, the
 * wheels torn off, the glass, the fuel, the drag, the end) has its handler here, a registry
 * keyed by beat: particles from the pools, the sounds, the camera's jolt scaled to the hit, the
 * hit-stop, the slow motion of a hunt's last prey, the fires that keep burning.
 */
export class TakedownEffects {
  private readonly handlers: ReadonlyMap<TakedownBeat, (event: TakedownBeatEvent) => void>;

  constructor(private readonly options: TakedownEffectsOptions) {
    this.handlers = new Map<TakedownBeat, (event: TakedownBeatEvent) => void>([
      [
        'strike',
        (event) => {
          this.strike(event);
        },
      ],
      [
        'tear',
        (event) => {
          this.tear(event);
        },
      ],
      [
        'shatter',
        (event) => {
          this.shatter(event);
        },
      ],
      [
        'fuel',
        (event) => {
          this.fuel(event);
        },
      ],
      [
        'drag',
        (event) => {
          this.drag(event);
        },
      ],
      [
        'buried',
        (event) => {
          this.buried(event);
        },
      ],
    ]);
    options.events.on('takedownBeat', (event) => this.handlers.get(event.beat)?.(event));
  }

  /** The bite: the world stops a moment, the camera jolts, sparks and sand fly. */
  private strike(event: TakedownBeatEvent): void {
    const { effects, camera, time, sound } = this.options;
    const row = TAKEDOWNS.get(event.takedown);
    // The heavier the machine, the longer the world stands still (60 to 120 ms).
    time.hold(machineRow(event.machine).hitStopMs);
    if (row) camera.jolt(row.shake * event.strength);
    if (event.finale) time.slow(FINALE.scale, FINALE.seconds * 1000);
    sound.play('impact', event.strength);
    sound.play('sandBurst', event.strength * 0.8);
    effects.flashes.flash(event.x, event.z);
    effects.burst({
      kind: 'spark',
      x: event.x,
      z: event.z,
      count: 26,
      speed: 10,
      angle: UP,
      spread: 2.6,
      life: 0.45,
    });
    effects.burst({
      kind: 'dust',
      x: event.x,
      z: event.z,
      count: 18,
      speed: 3.5,
      angle: UP,
      spread: Math.PI,
      life: 1.5,
    });
    effects.burst({
      kind: 'chip',
      x: event.x,
      z: event.z,
      count: 8,
      speed: 7,
      angle: UP,
      spread: 2.2,
      life: 1.4,
    });
  }

  /** The wheels and panels tear off: metal screams, sparks and chips. */
  private tear(event: TakedownBeatEvent): void {
    const { effects, camera, sound } = this.options;
    camera.jolt(0.25 * event.strength);
    sound.play('crunch', event.strength);
    effects.burst({
      kind: 'spark',
      x: event.x,
      z: event.z,
      count: 34,
      speed: 9,
      angle: UP,
      spread: 3.4,
      life: 0.5,
    });
    effects.burst({
      kind: 'chip',
      x: event.x,
      z: event.z,
      count: 18,
      speed: 7.5,
      angle: UP,
      spread: 2.8,
      life: 1.6,
    });
  }

  /** The cab's glass shatters and rains on the sand. */
  private shatter(event: TakedownBeatEvent): void {
    const { effects, sound } = this.options;
    const row = TAKEDOWNS.get(event.takedown);
    sound.play('shatter', event.strength);
    effects.burst({
      kind: 'glass',
      x: event.x,
      z: event.z,
      count: row?.shards ?? 24,
      speed: 7,
      angle: UP - event.facing * 0.5,
      spread: 2.2,
      life: 1.8,
    });
  }

  /** The fuel bursts into fire: a fireball, smoke, embers, and fires that keep burning. */
  private fuel(event: TakedownBeatEvent): void {
    const { effects, fires, camera, sound, ground } = this.options;
    const row = TAKEDOWNS.get(event.takedown);
    const seconds = row?.burnSeconds ?? 2.5;
    camera.jolt(0.3 * event.strength);
    sound.play('whoosh', event.strength);
    sound.play('crackle', event.strength * 0.8);
    effects.burst({
      kind: 'fire',
      x: event.x,
      z: event.z,
      count: 56,
      speed: 4.5,
      angle: UP,
      spread: 2.2,
      life: 0.65,
    });
    effects.burst({
      kind: 'smoke',
      x: event.x,
      z: event.z,
      count: 14,
      speed: 1.6,
      angle: UP,
      spread: 1.6,
      life: 2.4,
    });
    effects.burst({
      kind: 'ember',
      x: event.x,
      z: event.z,
      count: 28,
      speed: 4,
      angle: UP,
      spread: 2.4,
      life: 1.8,
    });
    fires.igniteWreck(event.truckId, seconds);
    fires.ignitePatch(event.x, ground(event.x), seconds * 0.8);
  }

  /** The wreck is dragged under: the sand gives way round it. */
  private drag(event: TakedownBeatEvent): void {
    const { effects, sound, ground } = this.options;
    sound.play('sandBurst', 0.6 * event.strength);
    const z = ground(event.x);
    effects.burst({
      kind: 'dust',
      x: event.x,
      z,
      count: 12,
      speed: 2.5,
      angle: UP,
      spread: 2.4,
      life: 1.4,
    });
  }

  /** Gone under the sand: a last puff where it went down. */
  private buried(event: TakedownBeatEvent): void {
    const { effects, sound, ground } = this.options;
    sound.play('sandBurst', 0.4 * event.strength);
    const z = ground(event.x);
    effects.burst({
      kind: 'dust',
      x: event.x,
      z,
      count: 16,
      speed: 2,
      angle: UP,
      spread: 2.8,
      life: 1.6,
    });
  }
}
