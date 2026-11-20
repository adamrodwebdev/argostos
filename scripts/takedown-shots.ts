/*
 * Films a takedown frame by frame (`npm run takedown-shots -- <url> <out-dir> [bite] [hunt]`):
 * the game on its autopilot, its clock driven by Playwright (so every run films the same
 * frames), screenshots every 80 ms of game time from the chosen bite of the chosen hunt (1 by
 * default; the hunt's last prey plays in slow motion), then one contact sheet of them all, on
 * a phone held upright. The page must already be served (`npm run dev` or `npm run preview`).
 * Output goes to <out-dir>; delete it once looked at.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const SHOTS = 24;
const EVERY_MS = 80;
const LIMIT_MS = 180_000;

function argument(index: number, fallback: string): string {
  const value = process.argv[index];
  return typeof value === 'string' && value.length > 0 && value.length < 300 ? value : fallback;
}

const url = argument(2, 'http://localhost:4361/');
const out = argument(3, 'takedown-shots');
const biteText = argument(4, '1');
if (!/^[1-9]$/.test(biteText)) {
  console.error(`The bite to film is a number from 1 to 9: ${biteText}`);
  process.exit(2);
}
const bite = biteText;
const huntText = argument(5, '1');
if (!/^[1-9]$/.test(huntText)) {
  console.error(`The hunt to film is a number from 1 to 9: ${huntText}`);
  process.exit(2);
}
if (!/^http:\/\/localhost:\d{2,5}\/$/.test(url)) {
  console.error(`Only a local server is filmed: ${url}`);
  process.exit(2);
}
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  // Installed fake time still flows at the real pace: paused, it moves only when told to.
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  await page.goto(`${url}?autopilot=1&mute=1&seed=147&hunt=${huntText}`);
  let waited = 0;
  const strikes = async () =>
    page.evaluate(() => document.querySelector('#game')?.getAttribute('data-strikes'));
  while ((await strikes()) !== bite) {
    await page.clock.runFor(50);
    waited += 50;
    if (waited > LIMIT_MS)
      throw new Error(`no bite number ${bite} within three minutes of game time`);
  }
  const frames: Buffer[] = [];
  for (let i = 0; i < SHOTS; i++) {
    const shot = await page.screenshot();
    frames.push(shot);
    writeFileSync(join(out, `takedown-${String(i).padStart(2, '0')}.png`), shot);
    await page.clock.runFor(EVERY_MS);
  }
  // One contact sheet: six frames a row, each frame a quarter of its size, numbered by time.
  const sheet = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await sheet.setContent('<canvas id="sheet"></canvas>');
  const images = frames.map((frame) => `data:image/png;base64,${frame.toString('base64')}`);
  const png = await sheet.evaluate(
    async ({ sources, every }) => {
      const loaded = await Promise.all(
        sources.map(
          (source) =>
            new Promise<HTMLImageElement>((resolve) => {
              const image = new Image();
              image.addEventListener(
                'load',
                () => {
                  resolve(image);
                },
                { once: true },
              );
              image.src = source;
            }),
        ),
      );
      const first = loaded[0]!;
      const w = first.width / 4;
      const h = first.height / 4;
      const canvas = document.querySelector('canvas')!;
      canvas.width = w * 6;
      canvas.height = h * Math.ceil(loaded.length / 6);
      const context = canvas.getContext('2d')!;
      loaded.forEach((image, i) => {
        const x = (i % 6) * w;
        const y = Math.floor(i / 6) * h;
        context.drawImage(image, x, y, w, h);
        context.fillStyle = 'rgb(0 0 0 / 0.6)';
        context.fillRect(x, y, 64, 22);
        context.fillStyle = '#fff';
        context.font = '14px system-ui';
        context.fillText(`${i * every} ms`, x + 6, y + 16);
      });
      return canvas.toDataURL('image/png');
    },
    { sources: images, every: EVERY_MS },
  );
  writeFileSync(join(out, 'takedown-sheet.png'), Buffer.from(png.split(',')[1] ?? '', 'base64'));
  console.log(`${SHOTS} frames and takedown-sheet.png in ${out} (bite ${bite} after ${waited} ms)`);
} finally {
  await browser.close();
}
