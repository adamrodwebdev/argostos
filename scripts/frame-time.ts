/*
 * Measures what a frame costs (`npm run frame-time -- <url> [headed]`): the game on its autopilot
 * (real digging, bites, takedowns), in Chrome, at phone and desktop sizes, with the processor
 * slowed 4× for the phones (a mid-range phone, roughly). It reads the debug readout's numbers
 * (mean and 95th percentile of the frame interval, the hunt's steps and the drawing, in ms) three
 * times over each run and prints a table. Serve the production build first
 * (`npm run build && npm run preview`), and run it alone on a cool, quiet machine.
 */
import { chromium, devices, type Page } from '@playwright/test';

interface Scenario {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly scale: number;
  readonly touch: boolean;
  /** How many times slower the processor runs (Chrome's CPU throttling). */
  readonly cpu: number;
  readonly detail: 'coarse' | 'standard' | 'fine';
}

const SCENARIOS: readonly Scenario[] = [
  { name: 'desktop', width: 1280, height: 800, scale: 1, touch: false, cpu: 1, detail: 'standard' },
  {
    name: 'desktop, DPR 2',
    width: 1280,
    height: 800,
    scale: 2,
    touch: false,
    cpu: 1,
    detail: 'standard',
  },
  { name: 'phone', width: 390, height: 844, scale: 2.625, touch: true, cpu: 1, detail: 'standard' },
  {
    name: 'phone, CPU 4×',
    width: 390,
    height: 844,
    scale: 2.625,
    touch: true,
    cpu: 4,
    detail: 'standard',
  },
  {
    name: 'small phone, CPU 4×',
    width: 320,
    height: 568,
    scale: 2,
    touch: true,
    cpu: 4,
    detail: 'standard',
  },
  {
    name: 'phone, CPU 4×, fine sand',
    width: 390,
    height: 844,
    scale: 2.625,
    touch: true,
    cpu: 4,
    detail: 'fine',
  },
  {
    name: 'phone, CPU 4×, coarse sand',
    width: 390,
    height: 844,
    scale: 2.625,
    touch: true,
    cpu: 4,
    detail: 'coarse',
  },
];

const WARM_UP_MS = 4000;
const READS = 3;
const BETWEEN_READS_MS = 4500;

function argument(index: number): string | undefined {
  const value = process.argv[index];
  return typeof value === 'string' && value.length > 0 && value.length < 300 ? value : undefined;
}

const url = argument(2) ?? 'http://localhost:4361/';
const headed = argument(3) === 'headed';
if (!/^http:\/\/localhost:\d{2,5}\/$/.test(url)) {
  console.error(`Only a local server is measured: ${url}`);
  process.exit(2);
}

/** The readout's numbers (strings of decimals written by the game), read as numbers. */
async function readout(page: Page): Promise<Record<string, number>> {
  const data = await page.evaluate(() =>
    Object.fromEntries(
      Object.entries(document.querySelector<HTMLElement>('#readout')?.dataset ?? {}),
    ),
  );
  const numbers: Record<string, number> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' && /^\d{1,9}(?:\.\d{1,6})?$/.test(value))
      numbers[key] = Number(value);
  }
  return numbers;
}

const browser = await chromium.launch({ channel: 'chrome', headless: !headed });
const rows: string[] = [];
try {
  for (const scenario of SCENARIOS) {
    const context = await browser.newContext({
      ...(scenario.touch ? devices['Pixel 7'] : {}),
      viewport: { width: scenario.width, height: scenario.height },
      deviceScaleFactor: scenario.scale,
      isMobile: scenario.touch,
      hasTouch: scenario.touch,
    });
    const page = await context.newPage();
    const session = await context.newCDPSession(page);
    await session.send('Emulation.setCPUThrottlingRate', { rate: scenario.cpu });
    await page.goto(`${url}?autopilot=1&debug=1&mute=1&detail=${scenario.detail}`);
    await page.waitForTimeout(WARM_UP_MS);
    let frameP95 = 0;
    let stepP95 = 0;
    let paintP95 = 0;
    let frameMean = 0;
    let stepMean = 0;
    let paintMean = 0;
    let cells = 0;
    for (let read = 0; read < READS; read++) {
      await page.waitForTimeout(BETWEEN_READS_MS);
      const numbers = await readout(page);
      frameP95 = Math.max(frameP95, numbers.frameP95 ?? 0);
      stepP95 = Math.max(stepP95, numbers.stepP95 ?? 0);
      paintP95 = Math.max(paintP95, numbers.paintP95 ?? 0);
      frameMean += (numbers.frameMean ?? 0) / READS;
      stepMean += (numbers.stepMean ?? 0) / READS;
      paintMean += (numbers.paintMean ?? 0) / READS;
      cells = numbers.cells ?? 0;
    }
    rows.push(
      `| ${scenario.name} | ${scenario.width} × ${scenario.height} @${scenario.scale} | ${cells} | ` +
        `${frameMean.toFixed(1)} / ${frameP95.toFixed(1)} | ${stepMean.toFixed(2)} / ${stepP95.toFixed(2)} | ` +
        `${paintMean.toFixed(2)} / ${paintP95.toFixed(2)} |`,
    );
    console.log(rows.at(-1));
    await context.close();
  }
} finally {
  await browser.close();
}
console.log(
  `\n${headed ? 'Headed' : 'Headless'} Chrome. Frame interval, steps and drawing: mean / p95 (ms).`,
);
console.log('| Scenario | Viewport | Cells | Frame | Steps | Drawing |');
console.log('|---|---|---|---|---|---|');
for (const row of rows) console.log(row);
