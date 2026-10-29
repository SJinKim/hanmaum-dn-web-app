import { test as st } from '../fixtures/st';
import { login } from '../support/login';
import { apiData, nextGet, visible } from '../support/page';
import { SafeError } from '../support/safe-error.mjs';
import { startServers } from './servers.mjs';

/**
 * The safety proof of HDN-272, against local fakes and a synthetic password from
 * `HARNESS_PW`. The five titles reuse the flow names so the real summary reporter
 * renders them; `harness.test.mjs` checks the expected code of each and that the
 * password shows up nowhere — not in stdout, stderr or any file left behind.
 *
 *   Login      passes: real form round trip, the login POST reaches the fake Keycloak
 *   Home       API answers 500                → E2E_API_STATUS:harness
 *   Guide      the page fires a business POST → E2E_WRITE_BLOCKED, the server never sees it
 *   Newcomers  a required component is missing → E2E_MISSING:harness-missing
 *   Ministry   wrong password                 → E2E_LOGIN_REJECTED
 */
type Servers = Awaited<ReturnType<typeof startServers>>;

const test = st.extend<object, { servers: Servers }>({
  servers: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const servers = await startServers(process.env['HARNESS_PW'] ?? '');
      await use(servers);
      await servers.close();
    },
    { scope: 'worker' },
  ],
  st: [
    async ({ servers }, use) => {
      await use({ baseURL: servers.appOrigin, login: 'tester', password: process.env['HARNESS_PW'] ?? '' });
    },
    { scope: 'worker' },
  ],
});

test('Login', async ({ page, st, servers }) => {
  const before = servers.seen.tokenPosts;
  await login(page, st);
  if (servers.seen.tokenPosts !== before + 1) throw new SafeError('E2E_HARNESS_TOKEN_POST');
});

test('Home', async ({ page, st }) => {
  await login(page, st);
  const broken = nextGet(page, '/v1/broken');
  await page.goto('/?broken=1');
  await apiData('harness', broken);
});

test('Guide', async ({ page, st, servers }) => {
  await login(page, st);
  const failed = page.waitForEvent('requestfailed');
  await page.goto('/?write=1');
  await failed;
  if (servers.seen.apiWrites !== 0) throw new SafeError('E2E_HARNESS_WRITE_ARRIVED');
});

test('Newcomers', async ({ page, st }) => {
  await login(page, st);
  await visible('harness-missing', page.getByRole('heading', { name: 'Not on this page', exact: true }));
});

test('Ministry', async ({ page, st }) => {
  await login(page, { ...st, password: `wrong-${st.password}` });
});
