import { expect, test, type Page } from '@playwright/test';
import { playFrame } from '../src/rules/viewing';

/** Console errors and uncaught exceptions of a page, collected from its first load. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/** How many different colours the canvas shows, sampled on a 24 × 24 grid. */
async function coloursOnCanvas(page: Page): Promise<number> {
  return page.locator('#world').evaluate((canvas) => {
    if (!(canvas instanceof HTMLCanvasElement)) return 0;
    const context = canvas.getContext('2d');
    if (!context) return 0;
    const seen = new Set<number>();
    for (let row = 0; row < 24; row++) {
      for (let column = 0; column < 24; column++) {
        const x = Math.floor(((column + 0.5) / 24) * canvas.width);
        const y = Math.floor(((row + 0.5) / 24) * canvas.height);
        const [r = 0, g = 0, b = 0] = context.getImageData(x, y, 1, 1).data;
        seen.add((r << 16) | (g << 8) | b);
      }
    }
    return seen.size;
  });
}

test.describe('the game loads, draws and stays clean', () => {
  test('the first paint comes from the page, then the game draws, with no console error', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto('/?autopilot=1&mute=1');
    await expect(page.getByRole('heading', { level: 1, name: 'Argostos' })).toBeAttached();
    await expect(page.locator('#game')).toHaveAttribute('data-state', 'playing');
    await expect(page.locator('#status')).toBeHidden();
    await expect.poll(() => coloursOnCanvas(page)).toBeGreaterThan(20);
    // The world moves on: two samples a moment apart are not the same picture.
    const first = await page.locator('#world').screenshot();
    await expect
      .poll(async () => (await page.locator('#world').screenshot()).equals(first))
      .toBe(false);
    expect(errors).toEqual([]);
  });

  test('the page never scrolls sideways, zoom stays allowed, only the play area holds still', async ({
    page,
  }) => {
    await page.goto('/?mute=1');
    await expect(page.locator('#game')).toHaveAttribute('data-state', 'playing');
    const layout = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      viewport: document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '',
      canvasTouch: getComputedStyle(document.querySelector('#world')!).touchAction,
      bodyTouch: getComputedStyle(document.body).touchAction,
    }));
    expect(layout.overflow).toBeLessThanOrEqual(0);
    expect(layout.viewport).not.toMatch(/user-scalable\s*=\s*no|maximum-scale/);
    expect(layout.canvasTouch).toBe('none');
    expect(layout.bodyTouch).not.toBe('none');
  });

  test('on a window wider than 2:1 the interface stays inside the centred 2:1 frame', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one wide desktop window is enough');
    await page.setViewportSize({ width: 2560, height: 1080 });
    await page.goto('/?mute=1&hunt=3');
    await expect(page.locator('#game')).toHaveAttribute('data-state', 'playing');
    const frame = playFrame(2560, 1080);
    for (const name of ['Pause', 'Ram', /^Strike/, 'Breathe glass'] as const) {
      const box = await page.getByRole('button', { name }).boundingBox();
      const right = box && box.x + box.width;
      expect(box?.x).toBeGreaterThanOrEqual(frame.x);
      expect(right).toBeLessThanOrEqual(frame.x + frame.width);
    }
  });

  test('the cursor says what can be clicked: an aim on the play area, a hand on a button', async ({
    page,
  }) => {
    await page.goto('/?mute=1');
    await expect(page.locator('#game')).toHaveAttribute('data-state', 'playing');
    const cursors = await page.evaluate(() => ({
      page: getComputedStyle(document.documentElement).cursor,
      canvas: getComputedStyle(document.querySelector('#world')!).cursor,
      button: getComputedStyle(document.querySelector('.hud .pause')!).cursor,
    }));
    expect(cursors).toEqual({ page: 'default', canvas: 'crosshair', button: 'pointer' });
  });
});
