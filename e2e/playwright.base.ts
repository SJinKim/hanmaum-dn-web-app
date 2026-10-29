import { defineConfig, devices } from '@playwright/test';

/**
 * Shared by the st suite and the local harness. Nothing is recorded: no trace, video or
 * screenshot, and the only reporter is the summary. `E2E_OUTPUT_DIR` is a temporary
 * directory the runner deletes afterwards, so not even Playwright's automatic error
 * context outlives the run.
 */
export function e2eConfig(testDir: string) {
  return defineConfig({
    testDir,
    // `*.test.mjs` next to the specs are `node --test` files, not Playwright tests.
    testMatch: '**/*.spec.ts',
    outputDir: process.env['E2E_OUTPUT_DIR'] ?? 'test-results/e2e',
    preserveOutput: 'never',
    fullyParallel: false,
    workers: 1,
    retries: 0,
    forbidOnly: true,
    timeout: 120_000,
    expect: { timeout: 20_000 },
    reporter: [['./reporters/summary-reporter.mjs']],
    use: {
      ...devices['Desktop Chrome'],
      viewport: { width: 1440, height: 1000 },
      locale: 'en-US',
      serviceWorkers: 'block',
      trace: 'off',
      video: 'off',
      screenshot: 'off',
    },
  });
}
