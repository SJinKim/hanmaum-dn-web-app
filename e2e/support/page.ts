import { expect, type Locator, type Page, type Response } from '@playwright/test';

import { SafeError } from './safe-error.mjs';

/**
 * Helpers that turn every Playwright failure into a fixed code. The original error is
 * dropped on purpose: it can quote page content, and the summary must not.
 */

/** `E2E_MISSING:<component>` unless the element becomes visible. */
export async function visible(component: string, locator: Locator): Promise<void> {
  try {
    await expect(locator).toBeVisible();
  } catch {
    throw new SafeError(`E2E_MISSING:${component}`);
  }
}

/** `E2E_COUNT:<component>` unless exactly `count` elements match. */
export async function count(component: string, locator: Locator, expected: number): Promise<void> {
  try {
    await expect(locator).toHaveCount(expected);
  } catch {
    throw new SafeError(`E2E_COUNT:${component}`);
  }
}

/** Waits for the app's own GET to `/api<path>`. Register before the navigation that triggers it. */
export function nextGet(page: Page, path: string, query?: (params: URLSearchParams) => boolean): Promise<Response> {
  return page.waitForResponse(response => {
    if (response.request().method() !== 'GET') return false;
    const url = new URL(response.url());
    return url.pathname.endsWith(`/api${path}`) && (!query || query(url.searchParams));
  });
}

/**
 * The `data` of a successful `ApiResponse`. A non-2xx status or `success: false` fails the
 * flow — an error or skeleton fallback in the UI must never pass as loaded.
 */
export async function apiData<T>(api: string, pending: Promise<Response>): Promise<T> {
  let response: Response;
  try {
    response = await pending;
  } catch {
    throw new SafeError(`E2E_API_TIMEOUT:${api}`);
  }
  return successData<T>(api, response);
}

export async function successData<T>(api: string, response: Response): Promise<T> {
  if (!response.ok()) throw new SafeError(`E2E_API_STATUS:${api}`);
  let body: { success?: boolean; data?: T };
  try {
    body = await response.json();
  } catch {
    throw new SafeError(`E2E_API_BODY:${api}`);
  }
  if (body.success !== true) throw new SafeError(`E2E_API_FAILED:${api}`);
  return body.data as T;
}

/** Fails with `E2E_FORBIDDEN` on the 403 screen, `E2E_PATH:<path>` anywhere else unexpected. */
export async function onPath(page: Page, path: string): Promise<void> {
  try {
    await expect(page).toHaveURL(url => url.pathname === path || url.pathname === '/forbidden');
  } catch {
    throw new SafeError(`E2E_PATH:${path.replace(/\W+/g, '') || 'home'}`);
  }
  if (new URL(page.url()).pathname === '/forbidden') throw new SafeError('E2E_FORBIDDEN');
}

/** The main navigation of the shell. */
export function mainNav(page: Page): Locator {
  return page.getByRole('navigation', { name: 'Main navigation' });
}

/** Opens a screen through the main navigation, the way a user does. */
export async function openFromNav(page: Page, linkName: string, path: string): Promise<void> {
  const link = mainNav(page).getByRole('link', { name: linkName, exact: true });
  await visible(`nav-${path.replace(/\W+/g, '')}`, link);
  await link.click();
  await onPath(page, path);
}

/** Every `aria-busy` region in the page content has finished loading. */
export async function loaded(component: string, page: Page): Promise<void> {
  await count(`${component}-busy`, page.locator('main [aria-busy="true"]'), 0);
}
