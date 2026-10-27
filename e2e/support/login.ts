import type { Page } from '@playwright/test';

import type { StConfig } from '../fixtures/st';
import { mainNav, onPath, visible } from './page';
import { SafeError } from './safe-error.mjs';

/** Keycloak's own login form, selected by its stable ids rather than translated labels. */
const KEYCLOAK = {
  username: '#username',
  password: '#password',
  submit: '#kc-login',
  error: '#input-error, [id^="input-error"], .kc-feedback-text',
  requiredAction: '#kc-passwd-update-form, #kc-otp-login-form, #kc-totp-settings-form, #kc-update-profile-form',
};

/** Checks that the Keycloak form shows its username field, password field and submit button. */
export async function keycloakForm(page: Page): Promise<void> {
  await visible('login-username', page.locator(KEYCLOAK.username));
  await visible('login-password', page.locator(KEYCLOAK.password));
  await visible('login-submit', page.locator(KEYCLOAK.submit));
}

/**
 * The real PKCE login: the dashboard redirects to Keycloak, the tester signs in and comes
 * back to Home. The password is only typed into the field — every failure becomes a fixed
 * code without the original error, so it can never end up in a message or report.
 */
export async function login(page: Page, st: StConfig): Promise<void> {
  try {
    await page.goto('/');
  } catch {
    throw new SafeError('E2E_LOGIN_UNREACHABLE');
  }
  await keycloakForm(page);

  try {
    await page.locator(KEYCLOAK.username).fill(st.login);
    await page.locator(KEYCLOAK.password).fill(st.password);
    await page.locator(KEYCLOAK.submit).click();
  } catch {
    throw new SafeError('E2E_LOGIN_FORM');
  }

  try {
    await page.waitForURL(url => url.origin === st.baseURL, { timeout: 30_000 });
  } catch {
    if (await page.locator(KEYCLOAK.requiredAction).count()) throw new SafeError('E2E_LOGIN_REQUIRED_ACTION');
    if (await page.locator(KEYCLOAK.error).count()) throw new SafeError('E2E_LOGIN_REJECTED');
    throw new SafeError('E2E_LOGIN_TIMEOUT');
  }

  await onPath(page, '/');
  await visible('shell-header', page.getByRole('banner'));
  await visible('shell-nav', mainNav(page));
}
