const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * True for a request the regression must never send: anything but a read against the
 * business API (`/api/…`). Keycloak's login and token POSTs live under `/realms/…` and
 * stay allowed, so the real PKCE login still works.
 */
export function isBlockedWrite(method, url) {
  if (READ_METHODS.has(method.toUpperCase())) return false;
  let pathname;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return true;
  }
  return pathname.includes('/api/') || pathname.endsWith('/api');
}
