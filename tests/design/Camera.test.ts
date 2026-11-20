import { describe, expect, test } from 'vitest';
import { Camera, type Followed } from '../../src/design/Camera';
import { View, type ViewLayout } from '../../src/design/View';
import { CAMERA, pixelsPerMetre, playFrame } from '../../src/rules/viewing';
import { ARENA } from '../../src/rules/world';

const BOTTOM_Z = -48;

function layout(width: number, height: number): ViewLayout {
  const frame = playFrame(width, height);
  return { widthPx: width, heightPx: height, pixelRatio: 1, frame, cssPpm: pixelsPerMetre(frame) };
}

/** Where `z` sits on the screen after the camera has followed `followed` for two seconds. */
function screenShare(followed: Followed, screen: ViewLayout): number {
  const view = new View();
  const camera = new Camera({ view, bottomZ: BOTTOM_Z, reducedMotion: true });
  for (let frame = 0; frame < 120; frame++) camera.frame(followed, screen, 1 / 60);
  return view.screenY(followed.z) / screen.heightPx;
}

const STILL = { velocityX: 0, velocityZ: 0 } as const;

describe('Camera: a takedown plays in the middle of the screen, room above it', () => {
  test.each([
    ['the smallest phone held upright', 320, 568],
    ['a phone held upright', 390, 844],
    ['the smallest phone on its side', 568, 320],
    ['a laptop', 1280, 800],
  ] as const)('%s: a bite at the surface sits mid-screen, a little low', (_name, w, h) => {
    const share = screenShare(
      { x: ARENA.widthM / 2, z: 2, ...STILL, takedown: true },
      layout(w, h),
    );
    expect(share).toBeGreaterThan(0.48);
    expect(share).toBeLessThan(0.62);
  });

  test('a phone held upright keeps the sky above a takedown for what it throws (20 m and more)', () => {
    const screen = layout(390, 844);
    const view = new View();
    const camera = new Camera({ view, bottomZ: BOTTOM_Z, reducedMotion: true });
    const bite = { x: 80, z: 2, ...STILL, takedown: true };
    for (let frame = 0; frame < 120; frame++) camera.frame(bite, screen, 1 / 60);
    expect(view.worldZ(0) - bite.z).toBeGreaterThan(20);
  });

  test('the sky stops at its top: a leap never shows the empty space above it', () => {
    const screen = layout(390, 844);
    const view = new View();
    const camera = new Camera({ view, bottomZ: BOTTOM_Z, reducedMotion: true });
    for (let frame = 0; frame < 240; frame++) {
      camera.frame({ x: 80, z: 60, ...STILL }, screen, 1 / 60);
    }
    expect(view.worldZ(0)).toBeCloseTo(CAMERA.skyTopM, 5);
  });

  test('away from takedowns the camera centres the hero swimming at cruise depth', () => {
    const share = screenShare({ x: 80, z: -10, ...STILL }, layout(390, 844));
    expect(share).toBeCloseTo(0.5, 2);
  });
});
