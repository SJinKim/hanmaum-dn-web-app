import { expect, test, type Page } from '@playwright/test';
import { Backend, fakeApi, fakeKeycloak, people } from './fake-backend';

/**
 * #277 acceptance criteria as a user flow, against the real web app with a synthetic
 * login and API. The st suite stays read-only; the writes are only proven here.
 */

const tid = (page: Page, id: string) => page.getByTestId(id);

async function open(page: Page, url: string, roles = ['pastor']): Promise<Backend> {
  await fakeKeycloak(page, roles);
  const backend = await fakeApi(page);
  await page.goto(url);
  return backend;
}

test('Home block leads straight to the 장기결석자 tab on the open filter', async ({ page }) => {
  const backend = await open(page, '/');
  await expect(tid(page, 'home-long-absent-open')).toHaveText('2');
  await expect(tid(page, 'home-long-absent-six')).toContainText('1');
  expect(backend.reads).not.toContain('/api/v1/attendance/long-absences');

  await tid(page, 'home-long-absent-link').click();
  await expect(page).toHaveURL(/\/analytics\/long-absences$/);
  await expect(tid(page, 'tab-long-absent')).toHaveAttribute('aria-current', 'page');
  await expect(tid(page, 'tab-statistics')).not.toHaveAttribute('aria-current', 'page');
  await expect(tid(page, 'long-absent-name')).toHaveText(['John Doe', '홍길동']);
  await expect(tid(page, 'long-absent-total')).toContainText('3');
  await expect(page.locator('[data-urgency="urgency-12"]')).toContainText('14');
  await expect(page.locator('[data-urgency="urgency-3"]')).toContainText('3');

  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await page.goForward();
  await expect(tid(page, 'tab-long-absent')).toHaveAttribute('aria-current', 'page');
});

test('Tabs switch between statistics and the list, survive reload and back', async ({ page }) => {
  const backend = await open(page, '/analytics');
  await expect(tid(page, 'tab-statistics')).toHaveAttribute('aria-current', 'page');
  await expect(tid(page, 'tab-count')).toContainText('2');
  await expect(page.locator('[data-testid="period"]')).toBeVisible();
  expect(backend.reads).not.toContain('/api/v1/attendance/long-absences');

  await tid(page, 'tab-long-absent').click();
  await expect(page).toHaveURL(/\/analytics\/long-absences$/);
  await expect(page.locator('[data-chart]')).toHaveCount(0);

  await page.goBack();
  await expect(tid(page, 'tab-statistics')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-testid="period"]')).toBeVisible();
  await page.goForward();
  await expect(tid(page, 'tab-long-absent')).toHaveAttribute('aria-current', 'page');

  // Reload last: the login-required Keycloak redirect adds its own history entry.
  await page.reload();
  await expect(tid(page, 'tab-long-absent')).toHaveAttribute('aria-current', 'page');
  await expect(tid(page, 'long-absent-name')).toHaveText(['John Doe', '홍길동']);
});

test('Marking contacted saves, moves the row and refreshes the tab counter', async ({ page }) => {
  const backend = await open(page, '/analytics/long-absences');
  await expect(tid(page, 'tab-count')).toContainText('2');
  await tid(page, 'long-absent-mark').first().click();

  await expect(tid(page, 'long-absent-name')).toHaveText(['홍길동']);
  await expect(tid(page, 'tab-count')).toContainText('1');
  expect(backend.writes).toEqual([
    {
      path: '/api/v1/attendance/long-absences/00000000-0000-4000-8000-000000000001/contact-status',
      body: { lastSundayDate: '2026-01-04', version: 0, contacted: true },
    },
  ]);

  await page.getByTestId('long-absent-filter').getByRole('button').nth(2).click();
  await expect(tid(page, 'long-absent-name')).toHaveText(['John Doe', 'Max Mustermann']);
  await expect(tid(page, 'long-absent-contacted-by').first()).toContainText('subject-tester');
});

test('Undo keeps the memo without details and appends details atomically', async ({ page }) => {
  const backend = await open(page, '/analytics/long-absences');
  await page.getByTestId('long-absent-filter').getByRole('button').nth(2).click();
  await expect(tid(page, 'long-absent-name')).toHaveText(['Max Mustermann']);

  await tid(page, 'long-absent-undo').click();
  await tid(page, 'undo-details').fill('다음 달 복귀 예정');
  await tid(page, 'undo-confirm').click();
  await expect(tid(page, 'long-absent-no-results')).toBeVisible();
  expect(backend.writes.at(-1)?.body).toEqual({
    lastSundayDate: '2026-01-04',
    version: 2,
    contacted: false,
    memoUpdate: { value: '직장 때문에 이사\n다음 달 복귀 예정' },
  });

  await page.getByTestId('long-absent-filter').getByRole('button').nth(1).click();
  await tid(page, 'long-absent-mark').nth(1).click();
  await page.getByTestId('long-absent-filter').getByRole('button').nth(2).click();
  await tid(page, 'long-absent-undo').click();
  await tid(page, 'undo-confirm').click();
  await expect(tid(page, 'long-absent-no-results')).toBeVisible();
  expect(backend.writes.at(-1)?.body).toEqual({ lastSundayDate: '2026-01-04', version: 4, contacted: false });
  expect(backend.rows[1].memo).toBe('직장 때문에 이사\n다음 달 복귀 예정');
});

test('Memo is limited, saved, and a 409 keeps the draft to copy without resending', async ({ page }) => {
  const backend = await open(page, '/analytics/long-absences');
  await tid(page, 'long-absent-edit-memo').first().click();
  await expect(page.getByRole('dialog')).toContainText(/2000/);

  await tid(page, 'memo-input').fill('a'.repeat(2001));
  await expect(tid(page, 'memo-too-long')).toBeVisible();
  await expect(tid(page, 'memo-save').getByRole('button')).toBeDisabled();
  await tid(page, 'memo-input').fill('이사 준비 중');
  await tid(page, 'memo-save').click();
  await expect(tid(page, 'long-absent-memo-text').first()).toHaveText('이사 준비 중');
  expect(backend.writes.at(-1)?.body).toEqual({ lastSundayDate: '2026-01-04', version: 0, memo: '이사 준비 중' });

  backend.failNextWrite = 409;
  await tid(page, 'long-absent-edit-memo').first().click();
  await tid(page, 'memo-input').fill('오래된 단계의 초안');
  await tid(page, 'memo-save').click();
  // #279 AK 5: the draft stays visible and copyable, but can no longer be saved.
  await expect(tid(page, 'memo-conflict')).toBeVisible();
  await expect(tid(page, 'memo-input')).toHaveValue('오래된 단계의 초안');
  await expect(tid(page, 'memo-input')).not.toBeEditable();
  await expect(tid(page, 'memo-save')).toHaveCount(0);
  await expect(tid(page, 'long-absent-memo-text')).toHaveCount(0);
  await page.getByRole('dialog').getByRole('button', { name: /닫기/ }).last().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(backend.writes.filter(w => w.body['memo'] === '오래된 단계의 초안')).toHaveLength(1);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('초안');
});

test('A memo draft does not survive leaving the tab', async ({ page }) => {
  const backend = await open(page, '/analytics/long-absences');
  await tid(page, 'long-absent-edit-memo').first().click();
  await tid(page, 'memo-input').fill('저장 안 할 초안');
  await page.goto('/analytics');
  await expect(tid(page, 'tab-statistics')).toHaveAttribute('aria-current', 'page');
  await page.goto('/analytics/long-absences');
  await expect(tid(page, 'long-absent-name')).toHaveText(['John Doe', '홍길동']);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(backend.writes).toEqual([]);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('초안');
  expect(page.url()).not.toContain('memo');
});

test('A failing summary leaves the list working and offers a retry', async ({ page }) => {
  await fakeKeycloak(page, ['ADMIN']);
  const backend = await fakeApi(page, people());
  backend.summaryStatus = 500;
  await page.goto('/analytics/long-absences');
  await expect(tid(page, 'long-absent-name')).toHaveText(['John Doe', '홍길동']);
  await expect(tid(page, 'tab-count')).toHaveCount(0);
  backend.summaryStatus = 200;
  await tid(page, 'tab-count-retry').click();
  await expect(tid(page, 'tab-count')).toContainText('2');
});

test('복귀 asks for confirmation, removes the person and finds them in the history (#279)', async ({ page }) => {
  const backend = await open(page, '/analytics/long-absences');
  await expect(tid(page, 'long-absent-history-empty')).toBeVisible();
  await expect(tid(page, 'tab-count')).toContainText('2');

  await tid(page, 'long-absent-return').first().click();
  await expect(tid(page, 'return-dialog')).toContainText('John Doe');
  await expect(page.getByRole('dialog').locator('textarea')).toHaveCount(0);
  await tid(page, 'return-confirm').click();

  await expect(tid(page, 'long-absent-name')).toHaveText(['홍길동']);
  await expect(tid(page, 'tab-count')).toContainText('1');
  await expect(tid(page, 'long-absent-history-name')).toHaveText(['John Doe']);
  await expect(tid(page, 'long-absent-history-returned-by')).toContainText('Tester');
  expect(backend.writes).toEqual([
    {
      path: '/api/v1/attendance/long-absences/00000000-0000-4000-8000-000000000001/return',
      body: { lastSundayDate: '2026-01-04', version: 0 },
    },
  ]);

  await page.goto('/');
  await expect(tid(page, 'home-long-absent-open')).toHaveText('1');
});

test('A parallel return answers 409, reloads and does not retry (#279)', async ({ page }) => {
  const backend = await open(page, '/analytics/long-absences');
  backend.failNextWrite = 409;
  await tid(page, 'long-absent-return').first().click();
  await tid(page, 'return-confirm').click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(tid(page, 'long-absent-name')).toHaveText(['John Doe', '홍길동']);
  expect(backend.writes.filter(w => w.path.endsWith('/return'))).toHaveLength(1);
});

test('The history panel shows a past phase with its memo; nothing lands in storage or URL (#279)', async ({ page }) => {
  await fakeKeycloak(page, ['pastor']);
  const backend = await fakeApi(page, people());
  // Max Mustermann came back by check-in: off the current list, into the history.
  const [max] = backend.rows.splice(1, 1);
  backend.closed.push({ row: max, endedOn: '2026-10-25', endReason: 'CHECK_IN', returnedAt: null });
  await page.goto('/analytics/long-absences');

  await expect(tid(page, 'long-absent-history-name')).toHaveText(['Max Mustermann']);
  await tid(page, 'long-absent-history-open').click();
  await expect(tid(page, 'history-panel')).toBeVisible();
  await expect(tid(page, 'panel-memo')).toHaveText('직장 때문에 이사');
  await expect(tid(page, 'panel-change')).toHaveCount(1);
  expect(page.url()).not.toMatch(/phase|memo/);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('직장');

  // PrimeNG keeps the empty drawer shell until its leave motion ends; what counts is
  // that the mask and every memo text are gone at once.
  await page.keyboard.press('Escape');
  await expect(page.locator('.p-drawer-mask')).toHaveCount(0);
  await expect(page.getByText('직장 때문에 이사')).toHaveCount(0);
});

test('On a phone the history panel fills the screen (#279)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fakeKeycloak(page, ['pastor']);
  const backend = await fakeApi(page, people());
  const [max] = backend.rows.splice(1, 1);
  backend.closed.push({ row: max, endedOn: '2026-10-25', endReason: 'CHECK_IN', returnedAt: null });
  await page.goto('/analytics/long-absences');

  await tid(page, 'long-absent-history-card').getByRole('button', { name: /이력/ }).click();
  await expect(tid(page, 'panel-memo')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.querySelector('.p-drawer')?.getBoundingClientRect().width))
    .toBe(390);
});

for (const roles of [['member'], ['group_leader'], ['note_taker']]) {
  test(`${roles[0]} cannot reach either tab and loads nothing`, async ({ page }) => {
    const backend = await open(page, '/analytics/long-absences', roles);
    await expect(page).toHaveURL(/\/forbidden/);
    await page.goto('/analytics');
    await expect(page).toHaveURL(/\/forbidden/);
    expect(backend.reads.filter(p => p.includes('long-absences'))).toEqual([]);
  });
}
