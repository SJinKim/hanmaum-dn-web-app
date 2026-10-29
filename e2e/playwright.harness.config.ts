import { e2eConfig } from './playwright.base';

/** The local safety harness: fake login and app, synthetic password. Run via `npm run e2e:harness`. */
export default e2eConfig('./harness');
