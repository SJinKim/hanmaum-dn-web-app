# dn-app-dashboard

Web admin dashboard for **Hanmaum D+N** church management.

Requires the backend (`../dn-app`) and Keycloak (`../dn-app/infrastructure/docker-compose.yml`) to be running.

## Workflow

How work is done in this repo (Figma first, issue-first, board, API contract, checks): see [`CLAUDE.md`](CLAUDE.md).

## Setup

```bash
npm install
ng serve          # http://localhost:4200
```

## Vercel build variables

`npm run build` runs `scripts/generate-vercel-env.mjs` first, which writes `src/environments/environment.prod.ts` from these variables:

| Value | Variables, first one set wins |
| --- | --- |
| API base URL | `API_BASE_URL`, then `https://<API_DOMAIN>/api`, else `/api` |
| Keycloak URL | `KEYCLOAK_URL`, then the host of `APP_SECURITY_KEYCLOAK_PUBLIC_ISSUER`, then `AUTH_DOMAIN` |
| Realm | `KEYCLOAK_REALM`, then the realm in the issuer, else `hanmaum` |
| Client ID | `KEYCLOAK_CLIENT_ID`, else `hanmaum-dashboard` |

For a preview build (`VERCEL_ENV=preview`), each variable is read as `STAGING_<NAME>` first. A preview build that still resolves to the prod API host or a `-prod` realm fails. Test with `npm run test:scripts`.

## Regression against st (Playwright)

`npm run e2e:st` signs in to st with the tester account and checks five flows: Login, Home, Guide, Newcomers and Ministry. Each flow checks that the important parts of its screen are visible. There is no screenshot comparison.

### Run

```bash
npm ci
npx playwright install chromium     # once, the Chromium that matches the lockfile
export TESTER_PW=…                  # see below, never paste it into a file or the repo
npm run e2e:st
```

| Input | Source |
| --- | --- |
| Target URL | `staging_url` in `.team/config.yml`. Only an HTTPS `st` host is accepted, there is no override. |
| Login | `tester_login` in `.team/config.yml` |
| Password | Environment variable `TESTER_PW`. It is stored in Jin's Keychain under the service `graceops-tester`, account = `tester_login`. The test command never reads the Keychain itself. To set it for one shell: `export TESTER_PW="$(security find-generic-password -s graceops-tester -a graceops-tester -w)"`. |

The output is a short summary, one line per flow with `bestanden`, `fehlgeschlagen` or `nicht ausgeführt`, its duration and a fixed error code such as `E2E_MISSING:guide-year` or `E2E_API_STATUS:newcomers`. The exit code is 0 only if all five flows passed. Raw Playwright errors, traces, screenshots, videos and reports are never written or printed, because they could contain page data or the password. Do not run the suite with `--debug`, `--ui` or other reporters while using real credentials.

The suite does not change data on st. A guard aborts every `POST`, `PUT`, `PATCH` or `DELETE` to `/api/` and then fails the flow. Only the Keycloak login itself may post. No forms are submitted and nobody is logged out.

`npm run e2e:harness` checks these rules locally against a fake login and app with a synthetic password: fixed codes, blocked writes, and no password in output or files. `npm run e2e:typecheck` typechecks `e2e/`.

### Adding acceptance criteria of a new story (DoD)

A web story brings its acceptance criteria as E2E checks:

1. Add the checks to the flow of the affected screen in `e2e/flows/`, or add a new flow file whose test title is the flow name and add that name to `FLOWS` in `e2e/support/summary.mjs`.
2. Put a comment `// HDN-<nr> · <criterion>` above the checks.
3. Open screens through the main navigation (`openFromNav`). Before that, register the API waits (`nextGet`) and require a successful response (`apiData`). Branch between data and the empty state only on that response, never on a missing element.
4. Use only the helpers in `e2e/support/page.ts` (`visible`, `count`). Each check gets a stable component id, which becomes the error code.
5. Pick elements by role, accessible name or label, with the English texts from `public/i18n/en.json`. Add a `data-testid` only where there is no semantic hook, and cover it with a component test.
6. Rules: no fixed people, UUIDs, numbers or dates from st. No writes and no fixed waits. Never log or assert on credentials.

## Related repos

| Repo | Role |
| --- | --- |
| `../dn-app` | Backend API + infrastructure |
| `../HanmaumDnApp` | Mobile app (shared auth realm) |
