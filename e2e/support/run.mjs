import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const CLI = join(ROOT, 'node_modules', '@playwright', 'test', 'cli.js');

/**
 * Runs Playwright with one of the e2e configs into a fresh temporary output directory.
 * stdout is the summary reporter's and is passed through `onStdout`; stderr is captured,
 * never printed — it can carry raw errors. The caller deletes `outputDir` (see `cleanup`).
 */
export function runPlaywright(config, { env = process.env, onStdout = () => {} } = {}) {
  if (!existsSync(CLI)) return Promise.resolve({ exitCode: 1, stdout: '', stderr: '', outputDir: null, missingCli: true });
  const outputDir = mkdtempSync(join(tmpdir(), 'hdn-e2e-'));
  return new Promise(resolve => {
    const child = spawn(process.execPath, [CLI, 'test', '--config', join(ROOT, 'e2e', config)], {
      cwd: ROOT,
      env: { ...env, E2E_OUTPUT_DIR: outputDir, FORCE_COLOR: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => {
      stdout += chunk;
      onStdout(chunk);
    });
    child.stderr.on('data', chunk => (stderr += chunk));
    const forward = signal => child.kill(signal);
    process.once('SIGINT', forward);
    process.once('SIGTERM', forward);
    child.on('error', () => resolve({ exitCode: 1, stdout, stderr, outputDir }));
    child.on('close', code => {
      process.off('SIGINT', forward);
      process.off('SIGTERM', forward);
      resolve({ exitCode: code ?? 1, stdout, stderr, outputDir });
    });
  });
}

export function cleanup(outputDir) {
  if (outputDir) rmSync(outputDir, { recursive: true, force: true });
}
