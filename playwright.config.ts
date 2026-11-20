import { defineConfig, devices } from '@playwright/test';

/** Its own port, never another project's server (`reuseExistingServer: false`). */
const PORT = 4362;
/** A phone's touch screen in Chrome, at any size. */
const PHONE = { ...devices['Pixel 7'], channel: 'chrome' } as const;

/**
 * The smoke test on the production build (`npm run build` first), in Chromium only for now:
 * the installed Chrome (`channel: 'chrome'`, also on GitHub's Ubuntu runners), so no browser
 * is downloaded. The smallest phone first (320 × 568, upright and on its side), a common phone
 * (390 × 844) and a desktop (1280 × 800). Two workers at most: about a third of the machine.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['line']] : [['list']],
  outputDir: 'test-results',
  use: {
    baseURL: `http://localhost:${PORT}/`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'phone-320', use: { ...PHONE, viewport: { width: 320, height: 568 } } },
    { name: 'phone-320-landscape', use: { ...PHONE, viewport: { width: 568, height: 320 } } },
    { name: 'mobile', use: { ...PHONE, viewport: { width: 390, height: 844 } } },
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
