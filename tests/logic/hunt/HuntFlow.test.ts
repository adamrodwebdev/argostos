import { describe, expect, test } from 'vitest';
import manifestJson from '../../../src/assets/truck/manifest.json';
import { EventBus } from '../../../src/logic/EventBus';
import { Hunt } from '../../../src/logic/hunt/Hunt';
import type { HuntEndedEvent, HuntEventMap } from '../../../src/logic/hunt/HuntEvents';
import { AutopilotIntent } from '../../../src/logic/input/AutopilotIntent';
import { TargetIntent } from '../../../src/logic/input/Steering';
import { huntRow } from '../../../src/rules/hunts';
import { readTruckManifest } from '../../../src/rules/truckManifest';
import { STEP_SECONDS } from '../../../src/rules/world';

const TRUCK = readTruckManifest(manifestJson).geometry;
const PER_SECOND = Math.round(1 / STEP_SECONDS);

function newHunt(number: number, seed = 147) {
  const events = new EventBus<HuntEventMap>();
  const hunt = new Hunt({ seed, detail: 'standard', truck: TRUCK, events, number });
  const ended: HuntEndedEvent[] = [];
  events.on('huntEnded', (event) => ended.push(event));
  const unlocked: string[] = [];
  events.on('actionUnlocked', ({ action }) => unlocked.push(action));
  return { hunt, events, ended, unlocked };
}

describe('Hunt: the first hunt opens its actions on time', () => {
  test('no button at the start, the breath at 20 s', () => {
    const { hunt, unlocked } = newHunt(1);
    const idle = new TargetIntent();
    expect(hunt.actions.isUnlocked('breath')).toBe(false);
    for (let i = 0; i < 19.9 * PER_SECOND; i++) hunt.step(idle);
    expect(unlocked).toEqual([]);
    for (let i = 0; i < 0.2 * PER_SECOND; i++) hunt.step(idle);
    expect(unlocked).toEqual(['breath']);
    expect(hunt.breath.fill).toBe(1);
  });

  test('the first truck is in the arena from the first frame', () => {
    const { hunt } = newHunt(1);
    expect(hunt.trucks).toHaveLength(1);
  });
});

describe('Hunt: a bot that never pays finishes every hunt', () => {
  test.each([1, 2, 3, 4])('hunt %i: the autopilot takes every convoy, a success', (number) => {
    const { hunt, ended } = newHunt(number);
    const pilot = new AutopilotIntent(hunt, STEP_SECONDS);
    for (let i = 0; i < 180 * PER_SECOND && ended.length === 0; i++) {
      pilot.act();
      hunt.step(pilot);
    }
    expect(ended).toEqual([{ result: 'success', reason: null, convoySize: 0 }]);
    const trucks = huntRow(number).waves.reduce((sum, wave) => sum + wave.machines.length, 0);
    expect(hunt.swallowedCount).toBe(trucks);
    expect(hunt.stats.crystals).toBeGreaterThanOrEqual(trucks * 8);
    expect(hunt.isOver).toBe(true);
  });
});

describe('Hunt: the first failure, a prey that gets away', () => {
  test('in the second hunt, a hero racing under the drone is heard and the convoy escapes', () => {
    const { hunt, ended, events } = newHunt(2);
    const spotted: number[] = [];
    events.on('spotted', ({ droneId }) => spotted.push(droneId));
    const racing = new TargetIntent();
    for (let i = 0; i < 120 * PER_SECOND && ended.length === 0; i++) {
      const t = i * STEP_SECONDS;
      racing.aim(90 + 30 * Math.sin(t * 0.8), -12, 1);
      hunt.step(racing);
    }
    expect(spotted.length).toBeGreaterThan(0);
    expect(ended[0]).toMatchObject({ result: 'failure', reason: 'spotted' });
  });

  test('an action asked before it unlocks does nothing', () => {
    const { hunt } = newHunt(1);
    expect(hunt.isOver).toBe(false);
    hunt.request('breath');
    hunt.step(new TargetIntent());
    expect(hunt.actions.isUnlocked('breath')).toBe(false);
  });
});
