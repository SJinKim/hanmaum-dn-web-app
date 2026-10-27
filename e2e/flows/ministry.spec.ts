import type { Response } from '@playwright/test';

import { test } from '../fixtures/st';
import { login } from '../support/login';
import { apiData, count, loaded, nextGet, openFromNav, successData, visible } from '../support/page';

const MEMBERS = /\/api\/v1\/ministries\/[^/]+\/members$/;

// HDN-272 · Ministry: search and the card grid with loaded member counts, or the regular empty state.
test('Ministry', async ({ page, st }) => {
  await login(page, st);

  // One members request per card; a failed one leaves a skeleton and must not pass as loaded.
  const memberResponses: Response[] = [];
  page.on('response', response => {
    if (response.request().method() === 'GET' && MEMBERS.test(new URL(response.url()).pathname)) memberResponses.push(response);
  });
  const list = nextGet(page, '/v1/ministries');
  await openFromNav(page, 'Ministry', '/ministry');

  const ministries = await apiData<unknown[]>('ministries', list);
  await loaded('ministry', page);

  await count('ministry-error', page.getByRole('heading', { name: 'Could not load ministries', exact: true }), 0);
  await visible('ministry-heading', page.getByRole('heading', { level: 1, name: 'Ministries', exact: true }));
  await visible('ministry-search', page.getByRole('searchbox', { name: 'Search ministries', exact: true }));

  if (ministries.length > 0) {
    await visible('ministry-grid', page.getByTestId('ministry-grid'));
    await count('ministry-card', page.getByTestId('ministry-card'), ministries.length);
    // Each card shows its count only after its own members request succeeded in the UI.
    await count('member-count', page.getByTestId('member-count'), ministries.length);
    let withMembers = 0;
    for (const response of memberResponses) {
      const members = await successData<unknown[]>('ministry-members', response);
      if (members.length > 0) withMembers++;
    }
    await count('member-avatars', page.getByTestId('member-avatars'), withMembers);
  } else {
    await visible('ministry-empty', page.getByRole('heading', { name: 'No ministries yet', exact: true }));
  }
});
