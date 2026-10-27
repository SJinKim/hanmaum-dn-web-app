import { safeCode } from './safe-error.mjs';

/** The flows every run must pass, in report order. A test title is exactly one of these. */
export const FLOWS = ['Login', 'Home', 'Guide', 'Newcomers', 'Ministry'];

const LABEL = { passed: 'bestanden', failed: 'fehlgeschlagen', missing: 'nicht ausgeführt' };

/**
 * One result per expected flow. Playwright's `timedOut` and `interrupted` count as failed,
 * `skipped` and a flow that never reported as not run. Only the fixed code of an error
 * is kept.
 */
export function flowResults(reported) {
  return FLOWS.map(flow => {
    const result = reported.get(flow);
    if (!result || result.status === 'skipped') return { flow, outcome: 'missing', durationMs: result?.durationMs ?? 0 };
    if (result.status === 'passed') return { flow, outcome: 'passed', durationMs: result.durationMs };
    return { flow, outcome: 'failed', durationMs: result.durationMs, code: result.status === 'failed' ? safeCode(result.message) : `E2E_${result.status.toUpperCase()}` };
  });
}

/** The summary lines and the exit code: 0 only when all five flows passed and the runner raised nothing. */
export function summarize(results, runnerCodes = []) {
  const lines = ['st-Regression'];
  for (const { flow, outcome, durationMs, code } of results) {
    const seconds = (durationMs / 1000).toFixed(1);
    lines.push(`  ${flow.padEnd(10)} ${LABEL[outcome].padEnd(16)} ${seconds}s${code ? `  ${code}` : ''}`);
  }
  for (const code of runnerCodes) lines.push(`  Runner     ${code}`);
  const passed = results.filter(r => r.outcome === 'passed').length;
  const ok = passed === FLOWS.length && runnerCodes.length === 0;
  lines.push(`${ok ? 'OK' : 'FEHLER'}: ${passed}/${FLOWS.length} Flows bestanden`);
  return { lines, exitCode: ok ? 0 : 1 };
}
