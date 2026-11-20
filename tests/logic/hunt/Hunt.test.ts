import { describe, expect, test } from 'vitest';
import manifestJson from '../../../src/assets/truck/manifest.json';
import { EventBus } from '../../../src/logic/EventBus';
import { Hunt } from '../../../src/logic/hunt/Hunt';
import type { HuntEventMap } from '../../../src/logic/hunt/HuntEvents';
import { AutopilotIntent } from '../../../src/logic/input/AutopilotIntent';
import { readTruckManifest } from '../../../src/rules/truckManifest';
import { STEP_SECONDS } from '../../../src/rules/world';

const TRUCK = readTruckManifest(manifestJson).geometry;

function hunt(seed: number) {
  const events = new EventBus<HuntEventMap>();
  const played = new Hunt({ seed, detail: 'standard', truck: TRUCK, events });
  const pilot = new AutopilotIntent(played, STEP_SECONDS);
  return {
    hunt: played,
    events,
    play: (steps: number) => {
      for (let i = 0; i < steps; i++) played.step(pilot);
    },
  };
}

describe('Hunt: a seeded hunt replays exactly', () => {
  test('the same seed and the same steering give the same desert, hero and trucks', () => {
    const a = hunt(147);
    const b = hunt(147);
    a.play(900);
    b.play(900);
    expect(a.hunt.grid.fingerprint()).toBe(b.hunt.grid.fingerprint());
    expect(a.hunt.hero.x).toBe(b.hunt.hero.x);
    expect(a.hunt.hero.z).toBe(b.hunt.hero.z);
    expect(a.hunt.trucks.map((truck) => truck.rig.rearX)).toEqual(
      b.hunt.trucks.map((truck) => truck.rig.rearX),
    );
  });

  test('another seed gives another desert', () => {
    expect(hunt(1).hunt.grid.fingerprint()).not.toBe(hunt(2).hunt.grid.fingerprint());
  });
});

describe('Hunt: the autopilot hunts the trucks down', () => {
  test('within 30 s it bites a truck from below and the takedown plays to its end', () => {
    const { hunt: played, events, play } = hunt(147);
    const beats: string[] = [];
    events.on('takedownBeat', (event) => beats.push(event.beat));
    play(60 * 30);
    expect(beats.slice(0, 6)).toEqual(['strike', 'tear', 'shatter', 'fuel', 'drag', 'buried']);
    expect(played.swallowedCount).toBeGreaterThanOrEqual(1);
  });

  test('through bites, wreckage and thrown sand, not a grain is made or lost', () => {
    const { hunt: played, play } = hunt(31);
    const before = played.sandTotal();
    play(60 * 25);
    expect(played.sandTotal()).toBe(before);
  });
});
