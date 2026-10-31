import { fileURLToPath } from 'node:url';
import { e2eConfig } from './playwright.base';

const PORT = 4277;

/**
 * 장기결석자 (#277) against the real web app on a local dev server, with a synthetic
 * Keycloak and API (`long-absent/fake-backend.ts`). Nothing is recorded, as on st.
 * Run: `npx playwright test -c e2e/playwright.long-absent.config.ts`.
 */
const config = e2eConfig('./long-absent');

export default {
  ...config,
  reporter: [['list']],
  use: { ...config.use, baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `npx ng serve --port ${PORT} --configuration development`,
    // From the repo root: Tailwind resolves its `content` globs against the cwd.
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 240_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
};
