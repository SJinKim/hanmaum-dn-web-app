import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SafeError, safeCode } from './safe-error.mjs';
import { readFlatKey, resolveStConfig } from './st-config.mjs';
import { FLOWS, flowResults, summarize } from './summary.mjs';
import { isBlockedWrite } from './write-guard.mjs';

const CONFIG = [
  'staging_url: https://dn-admin-dashboard.st.graceops.de   # st-Umgebung für st-Tests',
  'tester_login: graceops-tester    # Passwort nur in Jins Keychain',
].join('\n');
const MARKER = 'synthetic-pw-7f3a';

function codeOf(fn) {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof SafeError);
    assert.equal(error.cause, undefined);
    return error.message;
  }
  assert.fail('expected a SafeError');
}

test('flat keys drop inline comments and quotes, like board.sh', () => {
  assert.equal(readFlatKey(CONFIG, 'staging_url'), 'https://dn-admin-dashboard.st.graceops.de');
  assert.equal(readFlatKey("tester_login: 'x'  # c", 'tester_login'), 'x');
  assert.equal(readFlatKey(CONFIG, 'missing'), '');
});

test('the st config resolves to the origin, the login and the runtime password', () => {
  assert.deepEqual(resolveStConfig(CONFIG, { TESTER_PW: MARKER }), {
    baseURL: 'https://dn-admin-dashboard.st.graceops.de',
    login: 'graceops-tester',
    password: MARKER,
  });
});

test('missing values fail before any browser starts', () => {
  assert.equal(codeOf(() => resolveStConfig(CONFIG, {})), 'E2E_TESTER_PW_MISSING');
  assert.equal(codeOf(() => resolveStConfig('tester_login: a', { TESTER_PW: MARKER })), 'E2E_CONFIG_STAGING_URL_MISSING');
  assert.equal(codeOf(() => resolveStConfig('staging_url: https://a.st.b.de', { TESTER_PW: MARKER })), 'E2E_CONFIG_TESTER_LOGIN_MISSING');
});

test('a target other than an HTTPS st origin is refused', () => {
  const target = url => codeOf(() => resolveStConfig(`staging_url: ${url}\ntester_login: t`, { TESTER_PW: MARKER }));
  assert.equal(target('http://dn.st.graceops.de'), 'E2E_CONFIG_STAGING_URL_NOT_HTTPS');
  assert.equal(target('https://dn-admin-dashboard.graceops.de'), 'E2E_CONFIG_STAGING_URL_NOT_ST');
  assert.equal(target('http://localhost:4200'), 'E2E_CONFIG_STAGING_URL_NOT_HTTPS');
  assert.equal(target('https://u:p@dn.st.graceops.de'), 'E2E_CONFIG_STAGING_URL_HAS_CREDENTIALS');
  assert.equal(target('https://dn.st.graceops.de/guide'), 'E2E_CONFIG_STAGING_URL_NOT_ORIGIN');
  assert.equal(target('not a url'), 'E2E_CONFIG_STAGING_URL_INVALID');
});

test('config errors never carry the password', () => {
  const message = codeOf(() => resolveStConfig('tester_login: t', { TESTER_PW: MARKER }));
  assert.ok(!message.includes(MARKER));
});

test('business API writes are blocked, reads and Keycloak POSTs pass', () => {
  assert.equal(isBlockedWrite('GET', 'https://api.st.graceops.de/api/v1/newcomers'), false);
  assert.equal(isBlockedWrite('HEAD', 'https://dn.st.graceops.de/api/v1/ministries'), false);
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'post']) {
    assert.equal(isBlockedWrite(method, 'https://dn.st.graceops.de/api/v1/newcomers'), true, method);
  }
  assert.equal(isBlockedWrite('POST', 'https://auth.graceops.de/realms/hanmaum-dn-st/protocol/openid-connect/token'), false);
  assert.equal(isBlockedWrite('POST', 'https://auth.graceops.de/realms/hanmaum-dn-st/login-actions/authenticate?x=1'), false);
});

test('safeCode keeps only the fixed code of a message', () => {
  assert.equal(safeCode('Error: E2E_MISSING:guide-year'), 'E2E_MISSING:guide-year');
  assert.equal(safeCode(`expect(locator).toBeVisible() failed ${MARKER}`), 'E2E_UNEXPECTED');
  assert.equal(safeCode(undefined), 'E2E_UNEXPECTED');
});

test('all five flows passed is the only success', () => {
  const all = new Map(FLOWS.map(flow => [flow, { status: 'passed', durationMs: 1200 }]));
  const ok = summarize(flowResults(all));
  assert.equal(ok.exitCode, 0);
  assert.match(ok.lines.at(-1), /^OK: 5\/5/);
  assert.equal(summarize(flowResults(all), ['E2E_RUNNER_ERROR']).exitCode, 1);
});

test('failed, timed out, interrupted, skipped and missing flows fail the run', () => {
  const reported = new Map([
    ['Login', { status: 'passed', durationMs: 900 }],
    ['Home', { status: 'failed', durationMs: 5000, message: `E2E_MISSING:guide-home-status ${MARKER}` }],
    ['Guide', { status: 'timedOut', durationMs: 60000 }],
    ['Newcomers', { status: 'skipped', durationMs: 0 }],
  ]);
  const results = flowResults(reported);
  assert.deepEqual(results.map(r => r.outcome), ['passed', 'failed', 'failed', 'missing', 'missing']);
  assert.equal(results[1].code, 'E2E_MISSING:guide-home-status');
  assert.equal(results[2].code, 'E2E_TIMEDOUT');
  assert.equal(flowResults(new Map([['Login', { status: 'interrupted', durationMs: 1 }]]))[0].code, 'E2E_INTERRUPTED');

  const { lines, exitCode } = summarize(results);
  assert.equal(exitCode, 1);
  assert.ok(!lines.join('\n').includes(MARKER));
  assert.match(lines.join('\n'), /Ministry\s+nicht ausgeführt/);
});
