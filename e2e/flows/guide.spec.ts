import type { Response } from '@playwright/test';

import { test } from '../fixtures/st';
import { login } from '../support/login';
import { apiData, count, loaded, nextGet, openFromNav, successData, visible } from '../support/page';

const PATH = '/api/v1/guide/worship-counts';
const COLUMNS = ['Service date', 'Service 1', 'Service 2', 'Service 3', 'Total', 'Previous week', 'Notes'];

// HDN-272 · Guide: count history with year selection, links, and the table or the regular empty state.
test('Guide', async ({ page, st }) => {
  await login(page, st);

  // The screen asks several pages of the same endpoint (list, newest, first, last); all must succeed.
  const responses: Response[] = [];
  page.on('response', response => {
    if (response.request().method() === 'GET' && new URL(response.url()).pathname.endsWith(PATH)) responses.push(response);
  });
  const list = nextGet(page, '/v1/guide/worship-counts', params => params.get('size') !== '1');
  await openFromNav(page, 'Worship attendance', '/guide');

  const reports = await apiData<{ content: unknown[] }>('guide-reports', list);
  await loaded('guide', page);
  for (const response of responses) await successData('guide-reports', response);

  await count('guide-error', page.getByRole('heading', { name: 'Could not load count history.', exact: true }), 0);
  await visible('guide-heading', page.getByRole('heading', { level: 1, name: 'Worship attendance', exact: true }));
  await visible('guide-areas-link', page.getByRole('link', { name: 'Counting areas', exact: true }));
  await visible('guide-statistics-link', page.getByRole('link', { name: 'Statistics', exact: true }));
  await visible('guide-year', page.getByRole('combobox', { name: 'Year', exact: true }));

  if (reports.content.length > 0) {
    await visible('guide-overview', page.getByTestId('guide-overview'));
    for (const name of COLUMNS) {
      await visible(`guide-column-${name.toLowerCase().replace(/\W+/g, '-')}`, page.getByRole('columnheader', { name, exact: true }));
    }
    await visible('guide-report-row', page.getByTestId('guide-report-row').first());
  } else {
    await visible('guide-empty', page.getByRole('heading', { name: 'No count records.', exact: true }));
  }
});
