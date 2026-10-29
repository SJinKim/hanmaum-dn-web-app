import { e2eConfig } from './playwright.base';

/** The st regression (HDN-272). Start it with `npm run e2e:st`, not directly. */
export default e2eConfig('./flows');
