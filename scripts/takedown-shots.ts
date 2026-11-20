/*
 * Films a takedown frame by frame
 * (`npm run takedown-shots -- <url> <out-dir> [bite] [hunt] [bot] [lead-ms]`): the game on its
 * autopilot (`hunter` by default, or `sapper`, the bot that only digs pits), its clock driven by
 * Playwright (so every run films the same frames), screenshots every 80 ms of game time from the
 * chosen takedown of the chosen hunt (1 by default; the hunt's last prey plays in slow motion),
 * then one contact sheet of them all, on a phone held upright. With a lead (500 to 2000 ms), a
 * first run finds the takedown's moment and a second one, the same hunt played again, films from
 * that long before it, every 120 ms (a truck driving into a sinkhole, then its fall). The page
 * must already be served (`npm run dev` or `npm run preview`). Output goes to <out-dir>; delete
 * it once looked at.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from '@playwright/test';

const SHOTS = 24;
const LIMIT_MS = 180_000;
const STEP_MS = 50;
const BOTS = ['hunter', 'sapper'] as const;
/** How long before the takedown filming may start (ms): a closed list. */
const LEADS: ReadonlyMap<string, number> = new Map([
  ['0', 0],
  ['500', 500],
  ['1000', 1000],
  ['1500', 1500],
  ['2000', 2000],
]);

function argument(index: number, fallback: string): string {
  const value = process.argv[index];
  return typeof value === 'string' && value.length > 0 && value.length < 300 ? value : fallback;
}

/** A digit from 1 to 9 at `index`, or the script stops. */
function digit(index: number, what: string): string {
  const text = argument(index, '1');
  if (!/^[1-9]$/.test(text)) {
    console.error(`The ${what} to film is a number from 1 to 9: ${text}`);
    process.exit(2);
  }
  return text;
}

const url = argument(2, 'http://localhost:4361/');
const out = argument(3, 'takedown-shots');
const bite = digit(4, 'takedown');
const huntText = digit(5, 'hunt');
const botText = argument(6, 'hunter');
const bot = BOTS.find((one) => one === botText);
if (!bot) {
  console.error(`The bot is one of ${BOTS.join(', ')}: ${botText}`);
  process.exit(2);
}
const leadText = argument(7, '0');
const lead = LEADS.get(leadText);
if (lead === undefined) {
  console.error(`The lead is one of ${[...LEADS.keys()].join(', ')} ms: ${leadText}`);
  process.exit(2);
}
const every = lead > 0 ? 120 : 80;
if (!/^http:\/\/localhost:\d{2,5}\/$/.test(url)) {
  console.error(`Only a local server is filmed: ${url}`);
  process.exit(2);
}
mkdirSync(out, { recursive: true });

/** The hunt opened on a paused clock that moves only when told to. */
async function openHunt(browser: Browser): Promise<Page> {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  // Installed fake time still flows at the real pace: paused, it moves only when told to.
  await page.clock.install({ time: 0 });
  await page.clock.pauseAt(1000);
  await page.goto(`${url}?autopilot=1&bot=${bot}&mute=1&seed=147&hunt=${huntText}`);
  return page;
}

/** Runs the clock until the takedown number `bite` began: how long that took (ms). */
async function untilTakedown(page: Page): Promise<number> {
  let waited = 0;
  const strikes = async () =>
    page.evaluate(() => document.querySelector('#game')?.getAttribute('data-strikes'));
  while ((await strikes()) !== bite) {
    await page.clock.runFor(STEP_MS);
    waited += STEP_MS;
    if (waited > LIMIT_MS) throw new Error(`no takedown ${bite} within three minutes of game time`);
  }
  return waited;
}

const browser = await chromium.launch({ channel: 'chrome' });
try {
  let page = await openHunt(browser);
  const waited = await untilTakedown(page);
  if (lead > 0) {
    // The same hunt again, stopped `lead` ms before the takedown (the same steps, the same frames).
    await page.close();
    page = await openHunt(browser);
    for (let ran = 0; ran < waited - lead; ran += STEP_MS) await page.clock.runFor(STEP_MS);
  }
  const frames: Buffer[] = [];
  for (let i = 0; i < SHOTS; i++) {
    const shot = await page.screenshot();
    frames.push(shot);
    writeFileSync(join(out, `takedown-${String(i).padStart(2, '0')}.png`), shot);
    await page.clock.runFor(every);
  }
  // One contact sheet: six frames a row, each frame a quarter of its size, numbered by time.
  const sheet = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await sheet.setContent('<canvas id="sheet"></canvas>');
  const images = frames.map((frame) => `data:image/png;base64,${frame.toString('base64')}`);
  const png = await sheet.evaluate(
    async ({ sources, cadence, before }) => {
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
        context.fillText(`${i * cadence - before} ms`, x + 6, y + 16);
      });
      return canvas.toDataURL('image/png');
    },
    { sources: images, cadence: every, before: lead },
  );
  writeFileSync(join(out, 'takedown-sheet.png'), Buffer.from(png.split(',')[1] ?? '', 'base64'));
  console.log(
    `${SHOTS} frames and takedown-sheet.png in ${out} (takedown ${bite} after ${waited} ms)`,
  );
} finally {
  await browser.close();
}
