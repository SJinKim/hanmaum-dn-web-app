import { test } from '../fixtures/st';
import { login } from '../support/login';
import { apiData, count, loaded, nextGet, visible } from '../support/page';

/** The part of `GET /v1/guide/worship-counts/home` that decides which branch Home shows. */
interface GuideHomeSnapshot {
  attendance: { report: { reportMode: 'SUMMARY_ONLY' | string } | null } | null;
}

// HDN-272 · Home: the Guide Home block with status, key statistics, both chart slots and the history link.
test('Home', async ({ page, st }) => {
  const snapshot = nextGet(page, '/v1/guide/worship-counts/home');
  await login(page, st);
  await visible('home-heading', page.getByRole('heading', { level: 1, name: 'Home', exact: true }));

  // With more than one Home group the Guide block sits in an accordion; open it if collapsed.
  const group = page.getByRole('button', { name: 'Guide ministry' });
  if ((await group.count()) > 0 && (await group.getAttribute('aria-expanded')) === 'false') await group.click();

  const data = await apiData<GuideHomeSnapshot>('guide-home', snapshot);
  await loaded('home', page);

  await count('guide-home-error', page.getByRole('heading', { name: 'Could not load Guide Home', exact: true }), 0);
  await visible('guide-home-status', page.getByTestId('guide-home-status'));
  if (data.attendance?.report) {
    await visible('guide-home-attendance', page.getByTestId('guide-attendance-title'));
  } else {
    await visible('guide-home-empty', page.getByRole('heading', { name: 'No confirmed worship counts yet', exact: true }));
  }

  await visible('guide-home-metrics', page.getByRole('heading', { name: 'Key statistics', exact: true }));
  await visible('guide-home-change', page.getByText('Change from previous complete report', { exact: true }));
  await visible('guide-home-mean', page.getByText('Mean of last four complete reports', { exact: true }));
  await visible('guide-home-trend', page.getByRole('heading', { name: 'Total attendance · last 8 Sundays', exact: true }));
  await visible('guide-home-shares', page.getByRole('heading', { name: /^Service shares/ }));
  await visible('guide-home-statistics-link', page.getByRole('link', { name: 'View statistics', exact: true }));
  await visible('guide-home-history-link', page.getByRole('link', { name: 'Full history', exact: true }));
});
