import { describe, expect, test } from 'vitest';
import manifestJson from '../../../src/assets/truck/manifest.json';
import { EventBus } from '../../../src/logic/EventBus';
import { Hunt } from '../../../src/logic/hunt/Hunt';
import type { HuntEventMap, TakedownBeatEvent } from '../../../src/logic/hunt/HuntEvents';
import { AutopilotIntent, type Autopilot } from '../../../src/logic/input/AutopilotIntent';
import { SapperIntent } from '../../../src/logic/input/SapperIntent';
import { readTruckManifest } from '../../../src/rules/truckManifest';
import { STEP_SECONDS } from '../../../src/rules/world';

const TRUCK = readTruckManifest(manifestJson).geometry;

/** Plays hunt `number` with `bot` for at most `seconds`, or until `done` says so. */
function play(number: number, bot: (hunt: Hunt) => Autopilot, seconds: number) {
  const events = new EventBus<HuntEventMap>();
  const hunt = new Hunt({ seed: 147, detail: 'standard', truck: TRUCK, events, number });
  const pilot = bot(hunt);
  const beats: (TakedownBeatEvent & { readonly at: number })[] = [];
  const toppled: number[] = [];
  events.on('takedownBeat', (event) => beats.push({ ...event, at: hunt.seconds }));
  events.on('towerToppled', () => toppled.push(hunt.seconds));
  for (let i = 0; i < seconds / STEP_SECONDS && !hunt.isOver; i++) {
    pilot.act();
    hunt.step(pilot);
  }
  return { hunt, beats, toppled };
}

describe('The moving ground in a real hunt, the hero digging it', () => {
  test('the first hunt: the tower undermined about 10 s in tips, crashes and sinks', () => {
    const { hunt, beats, toppled } = play(1, (h) => new AutopilotIntent(h, STEP_SECONDS), 20);
    expect(toppled).toHaveLength(1);
    expect(toppled[0]!).toBeLessThan(12);
    const tower = beats.filter((beat) => beat.machine === 'drillTower');
    expect(tower.map((beat) => beat.beat)).toEqual([
      'strike',
      'tear',
      'shatter',
      'fuel',
      'drag',
      'buried',
    ]);
    // Its crash comes about 10 s in, as the first minute plans; its crystals are counted.
    expect(tower[0]!.at).toBeGreaterThan(7);
    expect(tower[0]!.at).toBeLessThan(13);
    expect(hunt.stats.destroyed('drillTower')).toBe(1);
    expect(hunt.towerList).toHaveLength(0);
  });

  test('a sapper that only digs opens a sinkhole a truck falls into: the fall plays', () => {
    const { beats } = play(1, (h) => new SapperIntent(h, STEP_SECONDS), 45);
    const fall = beats.find((beat) => beat.takedown === 'fall' && beat.machine === 'hauler');
    expect(fall).toMatchObject({ beat: 'strike' });
    // It never bit: every takedown of the trucks was the ground's.
    expect(beats.some((beat) => beat.takedown === 'swallowFromBelow')).toBe(false);
  });
});
