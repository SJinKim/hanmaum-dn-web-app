import { test as base } from '@playwright/test';

import { SafeError } from '../support/safe-error.mjs';
import { loadStConfig } from '../support/st-config.mjs';
import { isBlockedWrite } from '../support/write-guard.mjs';

export interface StConfig {
  readonly baseURL: string;
  readonly login: string;
  readonly password: string;
}

/**
 * Every flow gets a fresh context — no stored session — that
 * - sends no business write: POST/PUT/PATCH/DELETE under `/api/` are aborted before they
 *   leave the browser, and the flow fails afterwards (popups included, the route is on
 *   the context; service workers are blocked in the config so they cannot bypass it);
 * - starts the dashboard in English, so the expectations can name the `en.json` texts.
 */
export const test = base.extend<object, { st: StConfig }>({
  st: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      await use(loadStConfig());
    },
    { scope: 'worker' },
  ],

  // The target comes from `.team/config.yml` only; there is no CLI or env override.
  baseURL: async ({ st }, use) => {
    await use(st.baseURL);
  },

  context: async ({ context, st }, use) => {
    let blockedWrites = 0;
    await context.route('**/*', route => {
      const request = route.request();
      if (isBlockedWrite(request.method(), request.url())) {
        blockedWrites++;
        return route.abort('blockedbyclient');
      }
      return route.continue();
    });
    await context.addInitScript(origin => {
      if (location.origin === origin) localStorage.setItem('app-lang', 'en');
    }, st.baseURL);

    await use(context);

    if (blockedWrites > 0) throw new SafeError('E2E_WRITE_BLOCKED');
  },
});
