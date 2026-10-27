// `npm run e2e:harness` — proves the safety rules of the st regression locally (HDN-272):
// expected fixed codes per scenario, and the synthetic password nowhere in stdout,
// stderr or the files Playwright wrote. Needs the Chromium of `npx playwright install`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { cleanup, runPlaywright } from '../support/run.mjs';

const MARKER = `harness-pw-${process.pid}-${Date.now()}`;

function files(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

test('the harness flows fail with fixed codes and never leak the password', { timeout: 300_000 }, async () => {
  const { TESTER_PW: _ignored, ...env } = process.env;
  const result = await runPlaywright('playwright.harness.config.ts', { env: { ...env, HARNESS_PW: MARKER } });
  try {
    assert.ok(!result.missingCli, 'Playwright is not installed');
    const lines = result.stdout.split('\n');
    const line = flow => lines.find(l => l.trimStart().startsWith(flow)) ?? '';

    assert.match(line('Login'), /bestanden/);
    assert.match(line('Home'), /fehlgeschlagen.*E2E_API_STATUS:harness/);
    assert.match(line('Guide'), /fehlgeschlagen.*E2E_WRITE_BLOCKED/);
    assert.match(line('Newcomers'), /fehlgeschlagen.*E2E_MISSING:harness-missing/);
    assert.match(line('Ministry'), /fehlgeschlagen.*E2E_LOGIN_REJECTED/);
    assert.match(result.stdout, /FEHLER: 1\/5 Flows bestanden/);
    assert.notEqual(result.exitCode, 0);

    assert.ok(!result.stdout.includes(MARKER), 'password in stdout');
    assert.ok(!result.stderr.includes(MARKER), 'password in stderr');
    for (const file of files(result.outputDir)) {
      assert.ok(!readFileSync(file).includes(MARKER), `password in ${file}`);
    }
  } finally {
    cleanup(result.outputDir);
  }
});
