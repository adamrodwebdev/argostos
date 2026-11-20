import { describe, expect, test } from 'vitest';
import { LabelPlacer, type ScreenBox } from '../../src/design/hud/labelPlacement';

const SCREEN: ScreenBox = { left: 0, top: 72, right: 390, bottom: 844 };
const SIZE = { width: 48, height: 24 } as const;

function place(x: number, y: number, keepOut: readonly ScreenBox[] = []) {
  const out = { x: 0, y: 0 };
  new LabelPlacer().place({ x, y, ...SIZE, bounds: SCREEN, keepOut }, out);
  return {
    left: out.x - SIZE.width / 2,
    right: out.x + SIZE.width / 2,
    top: out.y - SIZE.height / 2,
    bottom: out.y + SIZE.height / 2,
  };
}

function overlaps(a: ScreenBox, b: ScreenBox): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

describe('LabelPlacer: a damage number sits over its machine, never over the hero or a button', () => {
  test('with nothing in the way it sits right above the point', () => {
    expect(place(200, 400)).toEqual({ left: 176, right: 224, top: 376, bottom: 400 });
  });

  test('it never goes above the top row', () => {
    expect(place(200, 60).top).toBe(SCREEN.top);
  });

  test('it stays inside the screen at its edges', () => {
    const left = place(5, 400);
    const right = place(388, 400);
    expect(left.left).toBe(0);
    expect(right.right).toBe(390);
  });

  test('over the hero’s head it moves up out of the way', () => {
    const head: ScreenBox = { left: 170, top: 370, right: 230, bottom: 410 };
    const label = place(200, 400, [head]);
    expect(overlaps(label, head)).toBe(false);
    expect(label.bottom).toBeLessThanOrEqual(head.top);
  });

  test('next to the thumb’s buttons it never covers one', () => {
    const buttons: ScreenBox = { left: 230, top: 650, right: 390, bottom: 844 };
    const label = place(300, 700, [buttons]);
    expect(overlaps(label, buttons)).toBe(false);
  });

  test('right under the top row, with the hero above the point, it still avoids both', () => {
    const head: ScreenBox = { left: 150, top: 72, right: 250, bottom: 110 };
    const label = place(200, 100, [head]);
    expect(label.top).toBeGreaterThanOrEqual(SCREEN.top);
    expect(overlaps(label, head)).toBe(false);
  });
});
