import { describe, expect, test } from 'vitest';
import { FixedStepper } from '../../src/logic/FixedStepper';
import { FrameCap } from '../../src/logic/FrameCap';
import { TimeScale } from '../../src/logic/TimeScale';

const STEP_MS = 1000 / 60;

/** Steps run over one second of frames at `hz`. */
function stepsInOneSecond(hz: number): number {
  const stepper = new FixedStepper(STEP_MS, 4);
  let steps = 0;
  for (let frame = 0; frame < hz; frame++) steps += stepper.advance(1000 / hz);
  return steps;
}

describe('FixedStepper: the hunt runs at 60 steps a second on any screen', () => {
  test.each([30, 60, 120, 144, 165, 240])('at %i Hz, 60 steps a second (±1)', (hz) => {
    expect(Math.abs(stepsInOneSecond(hz) - 60)).toBeLessThanOrEqual(1);
  });

  test('a slow frame runs a few steps at most: the game slows down rather than jumps', () => {
    const stepper = new FixedStepper(STEP_MS, 4);
    expect(stepper.advance(1000)).toBe(4);
    expect(stepper.advance(STEP_MS)).toBe(1);
  });

  test('the blend between steps stays between 0 and 1', () => {
    const stepper = new FixedStepper(STEP_MS, 4);
    for (const ms of [3, 7, 11, 16.7, 25]) {
      stepper.advance(ms);
      expect(stepper.blend).toBeGreaterThanOrEqual(0);
      expect(stepper.blend).toBeLessThan(1);
    }
  });

  test.each([Number.NaN, Number.POSITIVE_INFINITY, -16, 0])(
    'a frame of %s ms runs nothing',
    (ms) => {
      expect(new FixedStepper(STEP_MS, 4).advance(ms)).toBe(0);
    },
  );

  test('a step or a frame limit that makes no sense is refused', () => {
    expect(() => new FixedStepper(0, 4)).toThrow(RangeError);
    expect(() => new FixedStepper(STEP_MS, 0)).toThrow(RangeError);
    expect(() => new FixedStepper(STEP_MS, 2.5)).toThrow(RangeError);
  });
});

describe('FrameCap: touch screens draw about 60 frames a second', () => {
  test('without a cap, every frame is drawn', () => {
    const cap = new FrameCap(null);
    let drawn = 0;
    for (let i = 0; i < 120; i++) if (cap.admits(i * (1000 / 120))) drawn++;
    expect(drawn).toBe(120);
  });

  test.each([90, 120, 144])('a %i Hz screen is held to about 60 frames', (hz) => {
    const cap = new FrameCap(60);
    let drawn = 0;
    for (let i = 0; i < hz; i++) if (cap.admits(i * (1000 / hz))) drawn++;
    expect(drawn).toBeGreaterThanOrEqual(55);
    expect(drawn).toBeLessThanOrEqual(62);
  });

  test('a broken timestamp is never drawn', () => {
    expect(new FrameCap(60).admits(Number.NaN)).toBe(false);
  });
});

describe('TimeScale: hit-stops and slow motion', () => {
  test('without a hold or a slow motion, the hunt keeps the real time', () => {
    expect(new TimeScale().advance(16)).toBe(16);
  });

  test('a hit-stop holds the hunt still for its length of real time', () => {
    const time = new TimeScale();
    time.hold(90);
    let hunt = 0;
    for (let i = 0; i < 6; i++) hunt += time.advance(16);
    expect(hunt).toBeCloseTo(96 - 90);
    expect(time.holding).toBe(false);
  });

  test('a hold lasts 140 ms at most, and the holds of a second 250 ms at most', () => {
    const time = new TimeScale();
    time.hold(1000);
    expect(time.advance(1000)).toBeCloseTo(1000 - 140);
    const busy = new TimeScale();
    for (let i = 0; i < 5; i++) {
      busy.hold(100);
      busy.advance(100);
    }
    // 250 ms of holds granted in that second, not 500.
    expect(busy.advance(0.001)).toBeGreaterThan(0);
  });

  test('a slow motion runs slower, then eases back to full speed', () => {
    const time = new TimeScale();
    time.slow(0.3, 1000);
    expect(time.advance(100)).toBeCloseTo(30);
    let late = 0;
    for (let i = 0; i < 9; i++) late = time.advance(100);
    expect(late).toBeGreaterThan(80);
    expect(time.advance(100)).toBe(100);
  });

  test.each([Number.NaN, -5, Number.POSITIVE_INFINITY])(
    'a hold or a frame of %s changes nothing',
    (ms) => {
      const time = new TimeScale();
      time.hold(ms);
      expect(time.holding).toBe(false);
      expect(time.advance(ms)).toBe(0);
    },
  );
});
