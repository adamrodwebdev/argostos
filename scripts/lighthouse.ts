/*
 * Lighthouse on the production build (`npm run build && npm run lighthouse -- [desktop]`): the
 * mobile profile by default, three runs, the worst of each category kept (the user's rule:
 * 100 in all four, the worst of three). It serves `dist` itself on its own port, prints each
 * run and the worst, and fails when a category is under 100. No report file is written.
 */
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import { preview } from 'vite';

const PORT = 4366;
const RUNS = 3;
const CATEGORIES = ['performance', 'accessibility', 'best-practices', 'seo'] as const;
const desktop = process.argv.slice(2).includes('desktop');

const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'error' });
const chrome = await chromeLauncher.launch({
  chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
});

const worst = new Map<string, number>(CATEGORIES.map((id) => [id, 100]));
try {
  for (let run = 1; run <= RUNS; run++) {
    const result = await lighthouse(
      `http://localhost:${String(PORT)}/`,
      { port: chrome.port, output: 'json', logLevel: 'error' },
      desktop ? desktopConfig : undefined,
    );
    if (!result) throw new Error('Lighthouse returned no result');
    const scores = CATEGORIES.map((id) => {
      const score = Math.round((result.lhr.categories[id]?.score ?? 0) * 100);
      worst.set(id, Math.min(worst.get(id) ?? 100, score));
      return `${id} ${String(score)}`;
    });
    const benchmark = result.lhr.environment.benchmarkIndex;
    console.log(`Run ${String(run)}: ${scores.join(', ')} (benchmark index ${String(benchmark)})`);
    for (const id of CATEGORIES) {
      for (const ref of result.lhr.categories[id]?.auditRefs ?? []) {
        const audit = result.lhr.audits[ref.id];
        if (ref.weight > 0 && audit && audit.score !== null && audit.score < 1) {
          console.log(`  ${id}: ${audit.id} ${String(Math.round(audit.score * 100))}`);
        }
      }
    }
  }
} finally {
  chrome.kill();
  await new Promise((resolve) => {
    server.httpServer.close(resolve);
  });
}

const summary = CATEGORIES.map((id) => `${id} ${String(worst.get(id))}`).join(', ');
console.log(`Worst of ${String(RUNS)} (${desktop ? 'desktop' : 'mobile'}): ${summary}`);
if (CATEGORIES.some((id) => (worst.get(id) ?? 0) < 100)) {
  console.error('A category is under 100.');
  process.exit(1);
}
