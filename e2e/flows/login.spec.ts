import { test } from '../fixtures/st';
import { login } from '../support/login';
import { mainNav, visible } from '../support/page';

// HDN-272 · Login: Keycloak form, then Home with header, main navigation and the links of the other flows.
test('Login', async ({ page, st }) => {
  await login(page, st);

  await visible('home-heading', page.getByRole('heading', { level: 1, name: 'Home', exact: true }));
  await visible('nav-guide', mainNav(page).getByRole('link', { name: 'Worship attendance', exact: true }));
  await visible('nav-newcomers', mainNav(page).getByRole('link', { name: 'Newcomers', exact: true }));
  await visible('nav-ministry', mainNav(page).getByRole('link', { name: 'Ministry', exact: true }));
});
