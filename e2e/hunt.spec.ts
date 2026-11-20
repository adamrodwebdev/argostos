import { expect, test, type Page } from '@playwright/test';
import { playFrame } from '../src/rules/viewing';

/**
 * WebKit on GitHub's runners draws without a graphics card: a second of the game takes it several
 * seconds, so the journeys that play long stretches of a hunt run there in Chrome and Firefox
 * only (WebKit still plays them on a machine with one).
 */
const SLOW_ENGINE = 'webkit';
const SLOW_REASON = 'WebKit on the CI draws without a GPU: long stretches of play run elsewhere';

/** Opens the game with the page's clock in the test's hands (it moves only when told). */
async function openPaused(page: Page, query: string): Promise<void> {
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  await page.goto(`/?${query}`);
  await expect
    .poll(async () => {
      await page.clock.runFor(16);
      return page.locator('#game').getAttribute('data-state');
    })
    .toBe('playing');
}

/** Lets `ms` of the game's time pass, a quarter of a second at a time. */
async function play(page: Page, ms: number): Promise<void> {
  for (let t = 0; t < ms; t += 250) await page.clock.runFor(250);
}

test.describe('the hunt: one finger steers, the actions arrive one by one', () => {
  test('hunt 1 starts with steering only: the top row and the hint, no action button', async ({
    page,
  }) => {
    await page.goto('/?mute=1');
    await expect(page.locator('#game')).toHaveAttribute('data-hunting', 'playing');
    const pause = page.getByRole('button', { name: 'Pause' });
    await expect(pause).toBeVisible();
    const box = await pause.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
    await expect(page.getByRole('img', { name: 'Arena scanner' })).toBeVisible();
    await expect(page.getByText('Follow the vibrations')).toBeVisible();
    for (const name of ['Ram', /^Strike/, 'Breathe glass'] as const) {
      await expect(page.getByRole('button', { name })).toBeHidden();
    }
  });

  test('in hunt 1 the breath arrives at 20 s, full', async ({ page, browserName }) => {
    test.skip(browserName === SLOW_ENGINE && !!process.env.CI, SLOW_REASON);
    await openPaused(page, 'mute=1');
    const breath = page.getByRole('button', { name: 'Breathe glass' });
    await play(page, 15_000);
    await expect(breath).toBeHidden();
    await play(page, 6_000);
    await expect(breath).toBeVisible();
  });

  test('hunt 3 holds its three actions under the right thumb, 48 px or more', async ({ page }) => {
    await page.goto('/?mute=1&hunt=3');
    await expect(page.locator('#game')).toHaveAttribute('data-hunting', 'playing');
    const size = page.viewportSize();
    const frame = playFrame(size?.width ?? 0, size?.height ?? 0);
    const top = await page.locator('.hud-top').boundingBox();
    for (const name of ['Ram', /^Strike/, 'Breathe glass'] as const) {
      const button = page.getByRole('button', { name });
      await expect(button).toBeVisible();
      const box = await button.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(48);
      expect(box?.height).toBeGreaterThanOrEqual(48);
      // Never in the left half (one finger steers anywhere), never under the top row.
      expect(box?.x).toBeGreaterThanOrEqual(frame.x + frame.width / 2);
      expect(box?.y).toBeGreaterThanOrEqual((top?.y ?? 0) + (top?.height ?? 0));
    }
  });

  test('on a computer the keys show by the buttons: Space by the breath, the mouse’s buttons', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'a computer: a fine pointer, no touch screen');
    await page.goto('/?mute=1&hunt=3');
    await expect(page.locator('#game')).toHaveAttribute('data-hunting', 'playing');
    await expect(page.locator('.breath-wrap kbd')).toHaveText('Space');
    for (const hint of ['.breath-wrap kbd', '.acts .k-ram', '.acts .k-str']) {
      await expect(page.locator(hint)).toBeVisible();
    }
  });

  test('on a touch screen no key hint shows, only the buttons', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'desktop', 'the emulated phones are touch screens');
    await page.goto('/?mute=1&hunt=3');
    await expect(page.locator('#game')).toHaveAttribute('data-hunting', 'playing');
    await expect(page.getByRole('button', { name: 'Breathe glass' })).toBeVisible();
    const hints = page.locator('.acts kbd');
    await expect(hints).toHaveCount(3);
    for (const hint of await hints.all()) await expect(hint).toBeHidden();
  });

  test('hunt 1 shows its drilling tower on the scanner; undermined, it falls and its mark dims', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one look at the tower is enough');
    test.setTimeout(testInfo.timeout * 3);
    await openPaused(page, 'mute=1&autopilot=1');
    const tower = page.locator('.scan .it.t').first();
    await expect(tower).toBeVisible();
    await expect(tower).not.toHaveClass(/\bdone\b/);
    // The autopilot undermines it once the first truck is taken: it falls about 8 s in.
    await play(page, 10_000);
    await expect(tower).toBeVisible();
    await expect(tower).toHaveClass(/\bdone\b/);
  });

  test('the right mouse button on the play area never opens the browser’s menu', async ({
    page,
  }) => {
    await page.goto('/?mute=1&hunt=3');
    await expect(page.locator('#game')).toHaveAttribute('data-hunting', 'playing');
    const prevented = await page.locator('#world').evaluate((canvas) => {
      const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 });
      canvas.dispatchEvent(event);
      return event.defaultPrevented;
    });
    expect(prevented).toBe(true);
  });
});

test.describe('the pause and the end of a hunt', () => {
  test('the pause holds the hunt; its sound toggle answers; Resume goes back', async ({ page }) => {
    await page.goto('/?mute=1');
    await expect(page.locator('#game')).toHaveAttribute('data-hunting', 'playing');
    await page.getByRole('button', { name: 'Pause' }).click();
    const dialog = page.getByRole('dialog', { name: 'Paused' });
    await expect(dialog).toBeVisible();
    await expect(page.locator('#game')).toHaveAttribute('data-hunting', 'paused');
    const sound = dialog.getByRole('button', { name: 'Sound' });
    await expect(sound).toHaveAttribute('aria-pressed', 'false');
    await sound.click();
    await expect(sound).toHaveAttribute('aria-pressed', 'true');
    await dialog.getByRole('button', { name: 'Resume' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('#game')).toHaveAttribute('data-hunting', 'playing');
  });

  test('on a tester’s link the pause shows the session’s short code', async ({ page }) => {
    await page.goto('/?mute=1&tester=1');
    await expect(page.locator('#game')).toHaveAttribute('data-hunting', 'playing');
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(page.getByText('Tester code')).toBeVisible();
    await expect(page.locator('.tester .code')).toHaveText(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/);
  });

  test('the first hunt played to its end shows its result, and Next hunt opens the ram', async ({
    page,
    browserName,
  }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'one journey through a whole hunt is enough');
    test.skip(browserName === SLOW_ENGINE && !!process.env.CI, SLOW_REASON);
    // A minute of the game's time, frame by frame: WebKit, drawing without a graphics card,
    // needed about four and a half minutes of real time for it on the development machine.
    test.setTimeout(testInfo.timeout * 6);
    await openPaused(page, 'mute=1&autopilot=1');
    await expect
      .poll(
        async () => {
          await play(page, 5_000);
          return page.locator('#game').getAttribute('data-hunting');
        },
        { timeout: testInfo.timeout * 5, intervals: [0] },
      )
      .toBe('ended');
    const end = page.getByRole('dialog', { name: 'Hunt complete' });
    await expect(end).toBeVisible();
    await expect(end.getByText('Glass Desert · Hunt 1')).toBeVisible();
    await end.getByRole('button', { name: 'Next hunt' }).click();
    await expect(page.locator('#game')).toHaveAttribute('data-hunt', '2');
    await play(page, 500);
    await expect(page.getByRole('button', { name: 'Ram' })).toBeVisible();
  });
});
