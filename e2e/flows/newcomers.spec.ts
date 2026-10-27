import { test } from '../fixtures/st';
import { login } from '../support/login';
import { apiData, count, loaded, nextGet, openFromNav, visible } from '../support/page';

const COLUMNS = ['Registered', 'Name', 'Gender', 'Caregiver', 'Group', 'Attendance', 'Round', 'Birth date', 'Baptism', 'Status', 'Work / school'];

// HDN-272 · Newcomers: search, three filters, links to visits and QR links, and the list or the regular empty state.
test('Newcomers', async ({ page, st }) => {
  await login(page, st);

  const list = nextGet(page, '/v1/newcomers');
  const options = nextGet(page, '/v1/newcomers/options');
  await openFromNav(page, 'Newcomers', '/newcomers');

  const newcomers = await apiData<{ content: unknown[] }>('newcomers', list);
  await apiData('newcomer-options', options);
  await loaded('newcomers', page);

  await count('newcomers-error', page.getByRole('heading', { name: "Couldn't load newcomers", exact: true }), 0);
  await visible('newcomers-heading', page.getByRole('heading', { level: 1, name: 'Newcomers', exact: true }));
  await visible('newcomers-search', page.getByRole('searchbox', { name: 'Search newcomers', exact: true }));
  await visible('newcomers-filter-attendance', page.getByRole('button', { name: 'Attendance', exact: true }));
  await visible('newcomers-filter-caregiver', page.getByRole('button', { name: 'Caregiver', exact: true }));
  await visible('newcomers-filter-identity', page.getByRole('button', { name: 'Status', exact: true }));
  await visible('newcomers-visits-link', page.getByTestId('visits-link'));
  await visible('newcomers-qr-links-link', page.getByTestId('qr-links-link'));

  if (newcomers.content.length > 0) {
    const table = page.getByRole('table', { name: 'Newcomer list', exact: true });
    await visible('newcomers-table', table);
    for (const name of COLUMNS) {
      await visible(`newcomers-column-${name.toLowerCase().replace(/\W+/g, '-')}`, table.getByRole('columnheader', { name, exact: true }));
    }
    await visible('newcomers-row', table.locator('tbody').getByRole('row').first());
  } else {
    await visible('newcomers-empty', page.getByRole('heading', { name: 'No newcomers yet', exact: true }));
  }
});
