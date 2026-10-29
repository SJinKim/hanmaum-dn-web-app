// `npm run e2e:st` — the Playwright regression against st (HDN-272).
//
// Checks the config and TESTER_PW before any browser starts, runs the five flows and
// prints only the summary. Playwright's stderr and its output directory are discarded:
// both can hold raw errors or page content.
import { runPlaywright, cleanup } from '../e2e/support/run.mjs';
import { safeCode } from '../e2e/support/safe-error.mjs';
import { loadStConfig } from '../e2e/support/st-config.mjs';

function fail(code) {
  process.stdout.write(`st-Regression\n  Runner     ${code}\nFEHLER: 0/5 Flows bestanden\n`);
  process.exitCode = 1;
}

try {
  loadStConfig();
} catch (error) {
  fail(safeCode(error?.message));
  process.exit();
}

const result = await runPlaywright('playwright.config.ts', { onStdout: chunk => process.stdout.write(chunk) });
cleanup(result.outputDir);
if (result.missingCli) fail('E2E_PLAYWRIGHT_MISSING');
else if (!result.stdout.includes('st-Regression')) fail('E2E_RUNNER_ERROR');
else process.exitCode = result.exitCode;
