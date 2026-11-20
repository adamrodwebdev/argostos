import { expect, test, type Page } from '@playwright/test';

/** From the smallest phone to a 2560 px screen (the user's rule: no sideways scroll anywhere). */
const WIDTHS = [
  320, 360, 375, 390, 412, 480, 568, 640, 768, 820, 1024, 1280, 1366, 1440, 1920, 2048, 2560,
] as const;
/** Each width upright-ish and short: a tall window and a short one. */
const HEIGHTS = [800, 420] as const;

/**
 * The elements that stick out of the window sideways (by id or class), and how far the page
 * scrolls sideways: both must be nothing.
 */
async function sideways(page: Page) {
  return page.evaluate(() => {
    const width = window.innerWidth;
    const out: string[] = [];
    for (const element of document.querySelectorAll('body *')) {
      if (!(element instanceof HTMLElement) && !(element instanceof SVGElement)) continue;
      // Hidden, the icons' sprite, and text kept for screen readers (1 px, clipped) take no room.
      if (element.closest('[hidden], #game-icons, .visually-hidden')) continue;
      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) continue;
      if (box.left < -0.5 || box.right > width + 0.5) {
        out.push(
          `${element.tagName.toLowerCase()}#${element.id}.${element.getAttribute('class') ?? ''}`,
        );
      }
    }
    return { scroll: document.documentElement.scrollWidth - width, out };
  });
}

test.describe('no sideways scroll, 320 to 2560 px, the controls always on screen', () => {
  test.beforeEach(({ page: _page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the sweep sets its own sizes');
  });

  for (const height of HEIGHTS) {
    test(`every width at ${String(height)} px high`, async ({ page }) => {
      await page.goto('/?mute=1&hunt=3');
      await expect(page.locator('#game')).toHaveAttribute('data-hunting', 'playing');
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height });
        const { scroll, out } = await sideways(page);
        expect(scroll, `${String(width)} × ${String(height)}`).toBeLessThanOrEqual(0);
        expect(out, `${String(width)} × ${String(height)}`).toEqual([]);
      }
    });
  }

  test('at 320 × 256 (a phone at 400 % zoom) the pause and the actions still fit', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 256 });
    await page.goto('/?mute=1&hunt=3');
    await expect(page.locator('#game')).toHaveAttribute('data-hunting', 'playing');
    const { scroll, out } = await sideways(page);
    expect(scroll).toBeLessThanOrEqual(0);
    expect(out).toEqual([]);
    for (const name of ['Pause', 'Ram', /^Strike/, 'Breathe glass'] as const) {
      const box = await page.getByRole('button', { name }).boundingBox();
      expect(box?.y).toBeGreaterThanOrEqual(0);
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(256);
    }
  });
});
