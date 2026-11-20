import {
  defineConfig,
  devices,
  type PlaywrightTestOptions,
  type PlaywrightWorkerOptions,
} from '@playwright/test';

/** Its own port, never another project's server (`reuseExistingServer: false`). */
const PORT = 4362;

type Engine = 'chrome' | 'firefox' | 'webkit';
type BrowserUse = Partial<PlaywrightTestOptions & PlaywrightWorkerOptions>;
interface EngineUse {
  readonly desktop: BrowserUse;
  readonly phone: BrowserUse;
  /** How many times the usual time its tests are given (WebKit on the CI draws without a GPU). */
  readonly pace: number;
}

/**
 * The three engines (as Lumirift does): the installed Chrome by default (channel `chrome`, the
 * browser most players have, also on GitHub's runners: nothing downloaded); Playwright's own
 * Firefox and WebKit, Safari's engine, when `E2E_ENGINE` names one (the CI installs them on its
 * runner). A phone is a Pixel 7 in Chrome, the Pixel's screen in Firefox, an iPhone 13 in
 * WebKit; the projects set the sizes. Playwright's Firefox does not start on the Windows
 * machine of development (a missing system library, seen in Lumirift): the CI plays it.
 */
const ENGINES: Readonly<Record<Engine, EngineUse>> = {
  chrome: {
    desktop: { ...devices['Desktop Chrome'], channel: 'chrome' },
    phone: { ...devices['Pixel 7'], channel: 'chrome' },
    pace: 1,
  },
  firefox: {
    desktop: { ...devices['Desktop Firefox'] },
    phone: {
      browserName: 'firefox',
      deviceScaleFactor: devices['Pixel 7'].deviceScaleFactor,
      hasTouch: true,
    },
    pace: 1.5,
  },
  webkit: {
    desktop: { ...devices['Desktop Safari'] },
    phone: { ...devices['iPhone 13'] },
    pace: 2,
  },
};

const isEngine = (name: string): name is Engine => Object.hasOwn(ENGINES, name);
const ENGINE = process.env.E2E_ENGINE ?? 'chrome';
if (!isEngine(ENGINE)) {
  throw new Error(`E2E_ENGINE="${ENGINE}": expected one of ${Object.keys(ENGINES).join(', ')}`);
}
const { desktop, phone, pace } = ENGINES[ENGINE];

/**
 * The end-to-end tests on the production build (`npm run build` first), in the engine chosen
 * above: the smallest phone first (320 × 568, upright and on its side), a common phone
 * (390 × 844) and a desktop (1280 × 800); the overflow sweep sets its own sizes. Two workers
 * at most: about a third of the machine.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  timeout: 45_000 * pace,
  expect: { timeout: 10_000 * pace },
  reporter: process.env.CI ? [['line']] : [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: `http://localhost:${String(PORT)}/`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'phone-320', use: { ...phone, viewport: { width: 320, height: 568 } } },
    { name: 'phone-320-landscape', use: { ...phone, viewport: { width: 568, height: 320 } } },
    { name: 'mobile', use: { ...phone, viewport: { width: 390, height: 844 } } },
    { name: 'desktop', use: { ...desktop, viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: `npx vite preview --port ${String(PORT)} --strictPort`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
