import { defineConfig } from 'vitest/config';

/** The project's own port (another project's server never answers for this one). */
const PORT = 4361;
/** About a third of the machine's threads (the user's laptop overheats under long full loads). */
const LOCAL_TEST_WORKERS = 4;

export default defineConfig({
  // Relative paths: the build can be served from any folder or game portal.
  base: './',
  server: { port: PORT, strictPort: true },
  preview: { port: PORT, strictPort: true },
  build: {
    target: 'es2022',
    // The sprites stay files (hashed, cached), never base64 inside the code.
    assetsInlineLimit: 0,
    reportCompressedSize: true,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    restoreMocks: true,
    unstubGlobals: true,
    ...(process.env.CI ? {} : { maxWorkers: LOCAL_TEST_WORKERS }),
  },
});
