import { safeCode } from '../support/safe-error.mjs';
import { flowResults, summarize } from '../support/summary.mjs';

/**
 * The suite's only reporter. It prints the five fixed flow names, their outcome, the
 * duration and a fixed code — never Playwright's error text, stdout/stderr, steps or
 * attachments, which can quote page content or the values typed into the login form.
 */
export default class SummaryReporter {
  reported = new Map();
  runnerCodes = [];

  printsToStdio() {
    return true;
  }

  onTestEnd(test, result) {
    this.reported.set(test.title, {
      status: result.status,
      durationMs: result.duration,
      message: result.error?.message,
    });
  }

  onError(error) {
    this.runnerCodes.push(safeCode(error?.message) === 'E2E_UNEXPECTED' ? 'E2E_RUNNER_ERROR' : safeCode(error?.message));
  }

  onEnd() {
    const { lines, exitCode } = summarize(flowResults(this.reported), this.runnerCodes);
    process.stdout.write(`${lines.join('\n')}\n`);
    return { status: exitCode === 0 ? 'passed' : 'failed' };
  }
}
