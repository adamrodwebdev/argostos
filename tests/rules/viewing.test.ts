import { describe, expect, test } from 'vitest';
import { fullThrottleDistance, pixelsPerMetre, playFrame, VIEW } from '../../src/rules/viewing';
import { HERO_BODY } from '../../src/rules/swimming';

/** The screens the game must work on, smallest first (the user's rule: 320 px wide first). */
const SCREENS = [
  ['a small phone upright', 320, 568],
  ['a small phone on its side', 568, 320],
  ['a phone upright', 360, 800],
  ['an iPhone with Safari bars', 393, 659],
  ['a phone on its side', 844, 390],
  ['a tablet', 768, 1024],
  ['a laptop', 1280, 800],
  ['a full HD screen', 1920, 1080],
  ['an ultra-wide screen', 2560, 1080],
] as const;

describe('playFrame: the game fills the screen, the playing frame stops at 2:1', () => {
  test.each(SCREENS)('%s (%i × %i): the frame is inside the screen, at most 2:1', (_name, w, h) => {
    const frame = playFrame(w, h);
    expect(frame.x).toBeGreaterThanOrEqual(0);
    expect(frame.x + frame.width).toBeLessThanOrEqual(w + 1e-9);
    expect(frame.height).toBe(h);
    expect(frame.width / frame.height).toBeLessThanOrEqual(VIEW.maxAspect + 1e-9);
  });

  test('a screen up to 2:1 is all frame', () => {
    expect(playFrame(320, 568)).toEqual({ x: 0, y: 0, width: 320, height: 568 });
    expect(playFrame(568, 320)).toEqual({ x: 0, y: 0, width: 568, height: 320 });
    expect(playFrame(1280, 800)).toEqual({ x: 0, y: 0, width: 1280, height: 800 });
  });

  test('a screen wider than 2:1 gets a centred 2:1 frame, the art filling the sides', () => {
    expect(playFrame(2560, 1080)).toEqual({ x: 200, y: 0, width: 2160, height: 1080 });
  });

  test('a screen with no size still gives a frame', () => {
    const frame = playFrame(0, 0);
    expect(frame.width).toBeGreaterThan(0);
    expect(frame.height).toBeGreaterThan(0);
  });
});

describe('pixelsPerMetre: the zoom keeps the hero readable on every screen', () => {
  test.each(SCREENS)('%s (%i × %i): the hero is at least 14 px thick', (_name, w, h) => {
    const ppm = pixelsPerMetre(playFrame(w, h));
    expect(HERO_BODY.radiusM * 2 * ppm).toBeGreaterThanOrEqual(14);
  });

  test('a small upright phone shows the width of world the mockup shows', () => {
    const frame = playFrame(320, 568);
    expect(frame.width / pixelsPerMetre(frame)).toBeCloseTo(VIEW.minWidthM);
  });

  test('a small phone on its side keeps the smallest zoom', () => {
    expect(pixelsPerMetre(playFrame(568, 320))).toBe(VIEW.minPpm);
  });

  test('a laptop shows the height of world the mockup shows', () => {
    const frame = playFrame(1280, 800);
    expect(frame.height / pixelsPerMetre(frame)).toBeCloseTo(VIEW.heightM);
  });

  test('full throttle needs a finger a third of the short side away, in metres', () => {
    const frame = playFrame(320, 568);
    const ppm = pixelsPerMetre(frame);
    expect(fullThrottleDistance(frame, ppm)).toBeCloseTo((320 * VIEW.throttleShare) / ppm);
  });
});
