import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { SafeError } from './safe-error.mjs';

/** `.team/config.yml`, read from the repo the suite lives in. */
export const CONFIG_PATH = fileURLToPath(new URL('../../.team/config.yml', import.meta.url));

/**
 * Reads one flat `key: value` line of `.team/config.yml`, the same way `board.sh` does:
 * inline comments and quotes are dropped. No YAML library — the file promises flat lines.
 */
export function readFlatKey(text, key) {
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith(`${key}:`)) continue;
    return line.slice(key.length + 1).replace(/[ \t]+#.*$/, '').replace(/["']/g, '').trim();
  }
  return '';
}

/**
 * The st target and the tester account. The URL comes only from the config — there is
 * no override — and must be an HTTPS st host without credentials, so a typo can never
 * point the suite at prod or localhost. The password comes only from `TESTER_PW`.
 */
export function resolveStConfig(configText, env) {
  const rawUrl = readFlatKey(configText, 'staging_url');
  const login = readFlatKey(configText, 'tester_login');
  if (!rawUrl) throw new SafeError('E2E_CONFIG_STAGING_URL_MISSING');
  if (!login) throw new SafeError('E2E_CONFIG_TESTER_LOGIN_MISSING');

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SafeError('E2E_CONFIG_STAGING_URL_INVALID');
  }
  if (url.protocol !== 'https:') throw new SafeError('E2E_CONFIG_STAGING_URL_NOT_HTTPS');
  if (url.username || url.password) throw new SafeError('E2E_CONFIG_STAGING_URL_HAS_CREDENTIALS');
  if (!url.hostname.split('.').includes('st')) throw new SafeError('E2E_CONFIG_STAGING_URL_NOT_ST');
  if (url.pathname !== '/' || url.search || url.hash) throw new SafeError('E2E_CONFIG_STAGING_URL_NOT_ORIGIN');

  const password = env.TESTER_PW;
  if (!password) throw new SafeError('E2E_TESTER_PW_MISSING');

  return { baseURL: url.origin, login, password };
}

export function loadStConfig(env = process.env) {
  let text;
  try {
    text = readFileSync(CONFIG_PATH, 'utf8');
  } catch {
    throw new SafeError('E2E_CONFIG_UNREADABLE');
  }
  return resolveStConfig(text, env);
}
