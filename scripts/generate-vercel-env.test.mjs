import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveEnvironment } from './generate-vercel-env.mjs';

const SHARED = {
  API_DOMAIN: 'api.graceops.de',
  STAGING_API_DOMAIN: 'api.staging.graceops.de',
  AUTH_DOMAIN: 'auth.graceops.de',
  KEYCLOAK_REALM: 'hanmaum-dn-prod',
  STAGING_KEYCLOAK_REALM: 'hanmaum-dn-st',
};

test('preview prefers the STAGING_* values over shared ones (#127)', () => {
  const env = resolveEnvironment({ ...SHARED, VERCEL_ENV: 'preview' });
  assert.equal(env.apiBaseUrl, 'https://api.staging.graceops.de/api');
  assert.equal(env.keycloak.realm, 'hanmaum-dn-st');
  assert.equal(env.keycloak.url, 'https://auth.graceops.de');
});

test('production keeps the plain values', () => {
  const env = resolveEnvironment({ ...SHARED, VERCEL_ENV: 'production' });
  assert.equal(env.apiBaseUrl, 'https://api.graceops.de/api');
  assert.equal(env.keycloak.realm, 'hanmaum-dn-prod');
});

test('a preview that still resolves to the prod API fails the build', () => {
  assert.throws(
    () => resolveEnvironment({ VERCEL_ENV: 'preview', API_DOMAIN: 'api.graceops.de', KEYCLOAK_REALM: 'hanmaum-dn-st' }),
    /prod API/,
  );
});

test('a preview that still resolves to a prod realm fails the build', () => {
  assert.throws(
    () => resolveEnvironment({
      VERCEL_ENV: 'preview',
      STAGING_API_DOMAIN: 'api.staging.graceops.de',
      APP_SECURITY_KEYCLOAK_PUBLIC_ISSUER: 'https://auth.graceops.de/realms/hanmaum-dn-prod',
    }),
    /prod realm/,
  );
});

test('the realm and Keycloak URL come from the issuer when not set', () => {
  const env = resolveEnvironment({
    VERCEL_ENV: 'preview',
    STAGING_APP_SECURITY_KEYCLOAK_PUBLIC_ISSUER: 'https://auth.graceops.de/realms/hanmaum-dn-st',
  });
  assert.equal(env.keycloak.url, 'https://auth.graceops.de');
  assert.equal(env.keycloak.realm, 'hanmaum-dn-st');
  assert.equal(env.apiBaseUrl, '/api');
});

test('local builds without variables fall back to the dev defaults', () => {
  assert.deepEqual(resolveEnvironment({}), {
    production: true,
    apiBaseUrl: '/api',
    keycloak: { url: 'http://localhost:8091', realm: 'hanmaum', clientId: 'hanmaum-dashboard' },
  });
});
