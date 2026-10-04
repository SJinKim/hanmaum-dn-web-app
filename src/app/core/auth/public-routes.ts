/**
 * Pages and API calls that work without a Keycloak session (#42). The list is
 * an allowlist: everything not named here stays behind login.
 */

/** App paths rendered without login: the QR newcomer form. */
const PUBLIC_PAGE_PREFIXES = ['/register/'] as const;

/**
 * API paths below the base path that are `security: []` in the contract.
 * The trailing slash keeps the admin `/v1/newcomer-form-links` protected.
 */
const PUBLIC_API_PREFIXES = ['/v1/newcomer-forms/'] as const;

/** True for a page path that must not trigger the Keycloak login. */
export function isPublicPath(path: string): boolean {
  return PUBLIC_PAGE_PREFIXES.some(prefix => path.startsWith(prefix));
}

/** True for a request to a public endpoint of the own API; it goes out without a token. */
export function isPublicApiUrl(url: string, apiBaseUrl: string, pageOrigin: string): boolean {
  const target = new URL(url, pageOrigin);
  const base   = new URL(apiBaseUrl, pageOrigin);
  if (target.origin !== base.origin) return false;
  const basePath = base.pathname.replace(/\/+$/, '');
  return PUBLIC_API_PREFIXES.some(prefix => target.pathname.startsWith(`${basePath}${prefix}`));
}
